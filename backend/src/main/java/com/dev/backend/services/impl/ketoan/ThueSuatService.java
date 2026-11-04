package com.dev.backend.services.impl.ketoan;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.ThueSuatCaBangRequest;
import com.dev.backend.dto.request.ThueSuatGtgtRequest;
import com.dev.backend.dto.response.ketoan.ThueSuatGtgtDto;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.ThueSuatGtgt;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DanhMucQuanAoRepository;
import com.dev.backend.repository.ThueSuatGtgtRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Bảng thuế suất GTGT có ngày hiệu lực. Mức chung (không danh mục) áp cho mọi hàng; dòng có danh mục ghi đè cho danh
 * mục đó và danh mục con. Cùng một phạm vi (mức chung, hoặc cùng một danh mục) các khoảng ngày không được chồng nhau.
 * Bảng dùng chung cho hóa đơn bán hàng (mức chung, ThueGtgtService) và xuất kế toán; sửa ở Cấu hình › Thuế GTGT, lưu cả
 * bảng một lần (luuCaBang). Đổi bảng này không ảnh hưởng chứng từ đã giao kế toán (tệp của lô đã lưu nguyên).
 */
@Service
public class ThueSuatService {

    /** Thuế suất GTGT hiện hành ở Việt Nam (AMIS còn nhận KCT, KKKNT, KHAC — không dùng cho hàng may mặc). */
    public static final Set<BigDecimal> THUE_SUAT_HOP_LE = Set.of(
            new BigDecimal("0"), new BigDecimal("5"), new BigDecimal("8"), new BigDecimal("10"));

    private final ThueSuatGtgtRepository repository;
    private final DanhMucQuanAoRepository danhMucRepository;
    private final CauHinhKeToanService cauHinhKeToanService;
    private final LichSuThayDoiService lichSuThayDoiService;
    private final DieuHanhHeThongService dieuHanhHeThongService;

    private static final DateTimeFormatter NGAY_VN = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public ThueSuatService(ThueSuatGtgtRepository repository,
                           DanhMucQuanAoRepository danhMucRepository,
                           CauHinhKeToanService cauHinhKeToanService,
                           LichSuThayDoiService lichSuThayDoiService,
                           @Lazy DieuHanhHeThongService dieuHanhHeThongService) {
        this.repository = repository;
        this.danhMucRepository = danhMucRepository;
        this.cauHinhKeToanService = cauHinhKeToanService;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
    }

    @Transactional(readOnly = true)
    public List<ThueSuatGtgtDto> danhSach() {
        return repository.findAllKemDanhMuc().stream().map(ThueSuatService::toDto).toList();
    }

    /** Bộ tra thuế suất cho một lô xuất: bảng thuế suất + cây danh mục. */
    @Transactional(readOnly = true)
    public TraThueSuat boTra() {
        List<TraThueSuat.Muc> muc = repository.findAll().stream()
                .map(t -> new TraThueSuat.Muc(t.getDanhMuc() == null ? null : t.getDanhMuc().getId(),
                        t.getTyLe(), t.getHieuLucTu(), t.getHieuLucDen()))
                .toList();
        Map<Integer, Integer> cha = new HashMap<>();
        for (DanhMucQuanAo dm : danhMucRepository.findAll()) {
            cha.put(dm.getId(), dm.getDanhMucCha() == null ? null : dm.getDanhMucCha().getId());
        }
        return new TraThueSuat(muc, cha);
    }

    /** Số dòng tối đa của bảng (mức chung + theo danh mục). */
    static final int TOI_DA_DONG = 50;

    /**
     * Lưu cả bảng thuế suất (và công tắc In thuế GTGT nếu inThue khác null) trong một giao dịch: dòng có id thì sửa,
     * dòng không id thì thêm, dòng đang có mà không gửi lên thì xóa. Lỗi ở bất kỳ dòng nào thì không lưu gì.
     * Kiểm chồng ngày giữa các dòng gửi lên (không so với bảng cũ), nên rút ngắn dòng cũ và thêm dòng mới được trong một lần.
     */
    @Transactional
    public List<ThueSuatGtgtDto> luuCaBang(ThueSuatCaBangRequest req) {
        List<ThueSuatGtgtRequest> dong = req == null || req.getDong() == null ? List.of() : req.getDong();
        if (dong.size() > TOI_DA_DONG) {
            throw new CommonException("Bảng thuế suất tối đa " + TOI_DA_DONG + " dòng");
        }
        // Khóa các dòng đang có tới hết giao dịch: hai người lưu cùng lúc thì người sau chờ, rồi đọc bảng mới
        Map<Integer, ThueSuatGtgt> cu = new HashMap<>();
        for (ThueSuatGtgt t : repository.khoaTatCa()) cu.put(t.getId(), t);
        // Có dòng người khác vừa thêm mà trang này chưa thấy: lưu đè sẽ xóa mất dòng đó, nên bắt tải lại
        if (req != null && req.getIdDaXem() != null && !req.getIdDaXem().containsAll(cu.keySet())) {
            throw new CommonException(HttpStatus.CONFLICT, "Bảng thuế suất vừa được người khác sửa. Tải lại bảng rồi sửa lại.");
        }

        // Kiểm từng dòng trước, chưa ghi gì
        List<DongHopLe> hopLe = new ArrayList<>();
        Set<Integer> idGui = new HashSet<>();
        for (int i = 0; i < dong.size(); i++) {
            ThueSuatGtgtRequest r = dong.get(i);
            if (r == null) throw new CommonException("Thiếu dữ liệu thuế suất ở dòng " + (i + 1));
            if (r.getId() != null) {
                if (!cu.containsKey(r.getId())) {
                    throw new CommonException(HttpStatus.CONFLICT,
                            "Bảng thuế suất vừa được người khác sửa. Tải lại bảng rồi sửa lại.");
                }
                if (!idGui.add(r.getId())) throw new CommonException("Dòng thuế suất bị gửi trùng");
            }
            hopLe.add(kiemTraDong(r, i + 1));
        }
        for (int i = 0; i < hopLe.size(); i++) {
            for (int j = 0; j < i; j++) {
                DongHopLe a = hopLe.get(j), b = hopLe.get(i);
                if (Objects.equals(a.danhMucId(), b.danhMucId()) && chongNhau(a.tu(), a.den(), b.tu(), b.den())) {
                    throw new CommonException(HttpStatus.CONFLICT, "Dòng " + b.thuTu() + " trùng khoảng ngày với dòng "
                            + a.tyLe().stripTrailingZeros().toPlainString() + "% từ " + a.tu().format(NGAY_VN)
                            + (a.danhMucId() == null ? " (mức chung)" : " của cùng danh mục")
                            + ". Đặt ngày kết thúc cho dòng trước.");
                }
            }
        }

        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        Instant bayGio = Instant.now();
        for (ThueSuatGtgt t : cu.values()) {
            if (idGui.contains(t.getId())) continue;
            String truoc = tomTat(t);
            repository.delete(t);
            ghiNhatKy(t.getId(), truoc, null, nguoi);
        }
        for (int i = 0; i < dong.size(); i++) {
            Integer id = dong.get(i).getId();
            DongHopLe h = hopLe.get(i);
            ThueSuatGtgt t = id == null ? new ThueSuatGtgt() : cu.get(id);
            String truoc = id == null ? null : tomTat(t);
            boolean doi = id == null
                    || t.getTyLe().compareTo(h.tyLe()) != 0
                    || !t.getHieuLucTu().equals(h.tu())
                    || !Objects.equals(t.getHieuLucDen(), h.den())
                    || !Objects.equals(t.getDanhMuc() == null ? null : t.getDanhMuc().getId(), h.danhMucId())
                    || !Objects.equals(t.getGhiChu(), h.ghiChu());
            if (!doi) continue;
            t.setTyLe(h.tyLe().setScale(2));
            t.setHieuLucTu(h.tu());
            t.setHieuLucDen(h.den());
            t.setDanhMuc(h.danhMuc());
            t.setGhiChu(h.ghiChu());
            t.setNguoiCapNhatId(nguoi.getId());
            t.setNgayCapNhat(bayGio);
            t = repository.save(t);
            ghiNhatKy(t.getId(), truoc, tomTat(t), nguoi);
        }

        if (req != null && req.getInThue() != null) {
            CauHinhHeThongBulkUpdateRequest bat = new CauHinhHeThongBulkUpdateRequest();
            bat.setMaCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_VAT_BAT);
            bat.setGiaTri(String.valueOf(req.getInThue()));
            dieuHanhHeThongService.bulkUpdateCauHinh(List.of(bat), nguoi.getId());
        }
        repository.flush();
        return danhSach();
    }

    private record DongHopLe(int thuTu, BigDecimal tyLe, LocalDate tu, LocalDate den, DanhMucQuanAo danhMuc,
                             Integer danhMucId, String ghiChu) {
    }

    private DongHopLe kiemTraDong(ThueSuatGtgtRequest req, int thuTu) {
        String o = " (dòng " + thuTu + ")";
        BigDecimal tyLe = req.getTyLe();
        if (tyLe == null || THUE_SUAT_HOP_LE.stream().noneMatch(h -> h.compareTo(tyLe) == 0)) {
            throw new CommonException("Thuế suất chỉ nhận 0%, 5%, 8% hoặc 10%" + o);
        }
        if (req.getHieuLucTu() == null) {
            throw new CommonException("Chọn ngày bắt đầu áp dụng" + o);
        }
        if (req.getHieuLucDen() != null && req.getHieuLucDen().isBefore(req.getHieuLucTu())) {
            throw new CommonException("Ngày kết thúc phải từ ngày bắt đầu trở đi" + o);
        }
        DanhMucQuanAo danhMuc = null;
        if (req.getDanhMucId() != null) {
            danhMuc = danhMucRepository.findById(req.getDanhMucId())
                    .orElseThrow(() -> new CommonException("Danh mục không tồn tại" + o));
        }
        String ghiChu = req.getGhiChu() == null ? null : req.getGhiChu().trim();
        if (ghiChu != null && ghiChu.length() > 255) {
            throw new CommonException("Ghi chú tối đa 255 ký tự" + o);
        }
        return new DongHopLe(thuTu, tyLe, req.getHieuLucTu(), req.getHieuLucDen(), danhMuc,
                danhMuc == null ? null : danhMuc.getId(), ghiChu == null || ghiChu.isEmpty() ? null : ghiChu);
    }

    static boolean chongNhau(LocalDate tu1, LocalDate den1, LocalDate tu2, LocalDate den2) {
        LocalDate cuoi1 = den1 == null ? LocalDate.MAX : den1;
        LocalDate cuoi2 = den2 == null ? LocalDate.MAX : den2;
        return !tu1.isAfter(cuoi2) && !tu2.isAfter(cuoi1);
    }

    private void ghiNhatKy(Integer id, String cu, String moi, NguoiDung nguoi) {
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.thue_suat_gtgt)
                .idThamChieu(id)
                .hanhDong(IHanhDong.cap_nhat_thue_suat)
                .giaTriCu(cu)
                .giaTriMoi(moi)
                .nguoiThucHien(nguoi)
                .ngayThucHien(Instant.now())
                .build());
    }

    private static String tomTat(ThueSuatGtgt t) {
        return "{\"tyLe\":" + t.getTyLe().stripTrailingZeros().toPlainString()
                + ",\"tu\":\"" + t.getHieuLucTu() + "\",\"den\":" + (t.getHieuLucDen() == null ? "null" : "\"" + t.getHieuLucDen() + "\"")
                + ",\"danhMucId\":" + (t.getDanhMuc() == null ? "null" : t.getDanhMuc().getId())
                + ",\"ghiChu\":" + (t.getGhiChu() == null ? "null" : "\"" + t.getGhiChu().replace("\\", "\\\\").replace("\"", "\\\"") + "\"") + "}";
    }

    static ThueSuatGtgtDto toDto(ThueSuatGtgt t) {
        DanhMucQuanAo dm = t.getDanhMuc();
        return ThueSuatGtgtDto.builder()
                .id(t.getId())
                .tyLe(t.getTyLe())
                .hieuLucTu(t.getHieuLucTu())
                .hieuLucDen(t.getHieuLucDen())
                .danhMucId(dm == null ? null : dm.getId())
                .maDanhMuc(dm == null ? null : dm.getMaDanhMuc())
                .tenDanhMuc(dm == null ? null : dm.getTenDanhMuc())
                .ghiChu(t.getGhiChu())
                .build();
    }
}
