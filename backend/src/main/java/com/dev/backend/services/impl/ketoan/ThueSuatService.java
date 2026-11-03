package com.dev.backend.services.impl.ketoan;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Bảng thuế suất GTGT có ngày hiệu lực. Mức chung (không danh mục) áp cho mọi hàng; dòng có danh mục ghi đè cho danh
 * mục đó và danh mục con. Cùng một phạm vi (mức chung, hoặc cùng một danh mục) các khoảng ngày không được chồng nhau.
 * Đổi bảng này không ảnh hưởng chứng từ đã giao kế toán (tệp của lô đã lưu nguyên).
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

    public ThueSuatService(ThueSuatGtgtRepository repository,
                           DanhMucQuanAoRepository danhMucRepository,
                           CauHinhKeToanService cauHinhKeToanService,
                           LichSuThayDoiService lichSuThayDoiService) {
        this.repository = repository;
        this.danhMucRepository = danhMucRepository;
        this.cauHinhKeToanService = cauHinhKeToanService;
        this.lichSuThayDoiService = lichSuThayDoiService;
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

    @Transactional
    public ThueSuatGtgtDto them(ThueSuatGtgtRequest req) {
        ThueSuatGtgt moi = new ThueSuatGtgt();
        ganVaKiemTra(moi, req);
        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        moi.setNguoiCapNhatId(nguoi.getId());
        moi.setNgayCapNhat(Instant.now());
        moi = repository.save(moi);
        ghiNhatKy(moi.getId(), null, tomTat(moi), nguoi);
        return toDto(moi);
    }

    @Transactional
    public ThueSuatGtgtDto sua(Integer id, ThueSuatGtgtRequest req) {
        ThueSuatGtgt t = repository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy dòng thuế suất"));
        String truoc = tomTat(t);
        ganVaKiemTra(t, req);
        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        t.setNguoiCapNhatId(nguoi.getId());
        t.setNgayCapNhat(Instant.now());
        t = repository.save(t);
        ghiNhatKy(t.getId(), truoc, tomTat(t), nguoi);
        return toDto(t);
    }

    @Transactional
    public void xoa(Integer id) {
        ThueSuatGtgt t = repository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy dòng thuế suất"));
        String truoc = tomTat(t);
        repository.delete(t);
        ghiNhatKy(id, truoc, null, cauHinhKeToanService.nguoiDangThucHien());
    }

    private void ganVaKiemTra(ThueSuatGtgt t, ThueSuatGtgtRequest req) {
        if (req == null) {
            throw new CommonException("Thiếu dữ liệu thuế suất");
        }
        BigDecimal tyLe = req.getTyLe();
        if (tyLe == null || THUE_SUAT_HOP_LE.stream().noneMatch(h -> h.compareTo(tyLe) == 0)) {
            throw new CommonException("Thuế suất chỉ nhận 0%, 5%, 8% hoặc 10%");
        }
        if (req.getHieuLucTu() == null) {
            throw new CommonException("Chọn ngày bắt đầu áp dụng");
        }
        if (req.getHieuLucDen() != null && req.getHieuLucDen().isBefore(req.getHieuLucTu())) {
            throw new CommonException("Ngày kết thúc phải từ ngày bắt đầu trở đi");
        }
        DanhMucQuanAo danhMuc = null;
        if (req.getDanhMucId() != null) {
            danhMuc = danhMucRepository.findById(req.getDanhMucId())
                    .orElseThrow(() -> new CommonException("Danh mục không tồn tại"));
        }
        String ghiChu = req.getGhiChu() == null ? null : req.getGhiChu().trim();
        if (ghiChu != null && ghiChu.length() > 255) {
            throw new CommonException("Ghi chú tối đa 255 ký tự");
        }
        Integer dmId = danhMuc == null ? null : danhMuc.getId();
        for (ThueSuatGtgt khac : repository.findAll()) {
            if (Objects.equals(khac.getId(), t.getId())) continue;
            Integer khacDm = khac.getDanhMuc() == null ? null : khac.getDanhMuc().getId();
            if (!Objects.equals(khacDm, dmId)) continue;
            if (chongNhau(req.getHieuLucTu(), req.getHieuLucDen(), khac.getHieuLucTu(), khac.getHieuLucDen())) {
                throw new CommonException(HttpStatus.CONFLICT, "Khoảng ngày chồng lên dòng " + khac.getTyLe().stripTrailingZeros().toPlainString()
                        + "% từ " + khac.getHieuLucTu() + (dmId == null ? " của mức chung" : " của cùng danh mục")
                        + ". Đặt ngày kết thúc cho dòng cũ trước.");
            }
        }
        t.setTyLe(tyLe.setScale(2));
        t.setHieuLucTu(req.getHieuLucTu());
        t.setHieuLucDen(req.getHieuLucDen());
        t.setDanhMuc(danhMuc);
        t.setGhiChu(ghiChu == null || ghiChu.isEmpty() ? null : ghiChu);
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
                + ",\"danhMucId\":" + (t.getDanhMuc() == null ? "null" : t.getDanhMuc().getId()) + "}";
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
