package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietYeuCauMuaHangCreating;
import com.dev.backend.dto.request.YeuCauMuaHangCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.YeuCauMuaHangMapper;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.YeuCauMuaHangRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class YeuCauMuaHangService extends BaseServiceImpl<YeuCauMuaHang, Integer> {

    // Trạng thái yêu cầu nhập hàng (khớp comment cột trang_thai của entity)
    public static final int TRANG_THAI_CHO_DUYET = 1;
    public static final int TRANG_THAI_DA_DUYET = 2;
    public static final int TRANG_THAI_DA_GUI_BAO_GIA = 3;
    public static final int TRANG_THAI_TU_CHOI = 4;

    /** loai_tham_chieu của yêu cầu nhập hàng trong bảng lich_su_thay_doi. */
    public static final String LOAI_THAM_CHIEU = "yeu_cau_mua_hang";
    private static final int LY_DO_TU_CHOI_MAX = 500;
    private static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter MA_NGAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private KhoService khoService;
    @Autowired
    private NguoiDungService nguoiDungService;
    @Autowired
    private BienTheSanPhamService bienTheSanPhamService;
    @Autowired
    private ChiTietYeuCauMuaHangService chiTietYeuCauMuaHangService;


    @Autowired
    private YeuCauMuaHangMapper yeuCauMuaHangMapper;
    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;
    @Autowired
    private LichSuThayDoiRepository lichSuThayDoiRepository;

    public YeuCauMuaHangService(YeuCauMuaHangRepository repository) {
        super(repository);
    }

    @Override
    protected EntityManager getEntityManager() {
        return this.entityManager;
    }

    // nhân viên kho yêu cầu nhập hàng
    @Transactional
    public ResponseEntity<ResponseData<YeuCauMuaHangDto>> create(YeuCauMuaHangCreating creating) {
        // kiểm tra xem NVK có quyền hạn kho này ko
        Kho khoNhap = khoService.getOne(creating.getKhoNhapId()).orElseThrow(
                () -> new CommonException("Không tìm thấy kho id: " + creating.getKhoNhapId())
        );

        // lấy người dùng đang đăng nhập
        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();
        if (authInfo == null) throw new CommonException("Bạn phải đănh nhập");

        // lấy người dùng đang đăng nhập trong DB
        // người dùng đăng nhập thì để lại ID cho mình và mình lấy ID check trong DB
        NguoiDung nguoiTao = nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException("Người dùng không tồn tại trong hệ thống id:" + authInfo.getId())
        );

        // phải có ít nhất 1 mặt hàng, số lượng > 0 (không để phiếu rỗng / số âm in ra)
        if (creating.getChiTietYeuCauMuaHangs() == null || creating.getChiTietYeuCauMuaHangs().isEmpty()) {
            throw new CommonException("Yêu cầu nhập hàng phải có ít nhất một sản phẩm");
        }
        for (ChiTietYeuCauMuaHangCreating item : creating.getChiTietYeuCauMuaHangs()) {
            if (item.getSoLuongDat() == null || item.getSoLuongDat().compareTo(BigDecimal.ZERO) <= 0) {
                throw new CommonException("Số lượng yêu cầu phải lớn hơn 0");
            }
        }

        Instant now = Instant.now();

        //tạo phiếu yêu cầu nhập hàng( build ra entities)
        YeuCauMuaHang yeuCauMuaHang = YeuCauMuaHang.builder()
                .khoNhap(khoNhap)
                .ngayGiaoDuKien(creating.getNgayGiaoDuKien())
                .ghiChu(chuanHoaGhiChu(creating.getGhiChu()))
                .nguoiTao(nguoiTao)
                .trangThai(TRANG_THAI_CHO_DUYET)
                .ngayTao(now)
                .build();

        //lưu vào DB
        yeuCauMuaHang = create(yeuCauMuaHang);

        // Sinh mã phiếu cố định ngay khi tạo (cần id nên làm sau khi lưu).
        // Mã này dùng suốt vòng đời, kể cả khi đã gửi yêu cầu báo giá.
        yeuCauMuaHang.setSoYeuCauMuaHang(taoMaYeuCau(yeuCauMuaHang.getId(), now));
        yeuCauMuaHang = create(yeuCauMuaHang);

        //khởi tạo danh sách chi tiết YCMH
        List<ChiTietYeuCauMuaHang> chiTietYeuCauMuaHangs = new ArrayList<>();

        //duyệt qua danh sách mặt hàng để kiểm tra xem biến thể có tổn tại hay ko
        for (ChiTietYeuCauMuaHangCreating ycmhCreating : creating.getChiTietYeuCauMuaHangs()) {
            //với mỗi mặt hàng, kiểm tra xem "Biến thể sản phẩm" có tồn tại không.
            BienTheSanPham bienTheSanPham = bienTheSanPhamService.getOne(ycmhCreating.getBienTheSanPhamId()).orElseThrow(
                    () -> new CommonException("Không tìm thấy biến thể sản phẩm id: " + ycmhCreating.getBienTheSanPhamId())
            );
            //tạo chi tiết yêu cầu mua hàng của biến thể, liên kết nó với phiếu tổng (yeuCauMuaHang)
            ChiTietYeuCauMuaHang chiTietYeuCauMuaHang = ChiTietYeuCauMuaHang.builder()
                    .yeuCauMuaHang(yeuCauMuaHang)
                    .bienTheSanPham(bienTheSanPham)
                    .soLuongDat(ycmhCreating.getSoLuongDat())
                    .build();
            //thêm vào danh sách
            chiTietYeuCauMuaHangs.add(chiTietYeuCauMuaHang);
        }
        //lưu hàng loạt danh sách chi tiết xuống DB
        yeuCauMuaHang.setChiTietYeuCauMuaHangs(chiTietYeuCauMuaHangService.create(chiTietYeuCauMuaHangs));
        return ResponseEntity.ok(
                ResponseData.<YeuCauMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(
                                yeuCauMuaHangMapper.toDto(yeuCauMuaHang)
                        )
                        .build()
        );
    }

    // ── Mã phiếu ───────────────────────────────────────────────────────────

    /**
     * Mã yêu cầu nhập hàng: "PR" + ngày tạo (yyyyMMdd, giờ VN) + id (≥ 4 chữ số),
     * vd. PR202610080012. Dựa trên id nên luôn duy nhất (cột có UNIQUE).
     */
    public static String taoMaYeuCau(Integer id, Instant ngayTao) {
        Instant moc = ngayTao != null ? ngayTao : Instant.now();
        return "PR" + MA_NGAY.format(moc.atZone(MUI_GIO_VN)) + String.format("%04d", id);
    }

    /** Bổ sung mã cho yêu cầu cũ chưa có mã (tạo trước khi có quy tắc sinh mã). */
    public void damBaoCoMa(YeuCauMuaHang yeuCauMuaHang) {
        if (yeuCauMuaHang.getSoYeuCauMuaHang() == null || yeuCauMuaHang.getSoYeuCauMuaHang().isBlank()) {
            yeuCauMuaHang.setSoYeuCauMuaHang(taoMaYeuCau(yeuCauMuaHang.getId(), yeuCauMuaHang.getNgayTao()));
        }
    }

    private static String chuanHoaGhiChu(String ghiChu) {
        if (ghiChu == null || ghiChu.isBlank()) return null;
        return ghiChu.trim();
    }

    // ── Duyệt / từ chối ────────────────────────────────────────────────────

    /**
     * Duyệt (2) hoặc từ chối (4) một yêu cầu đang Chờ duyệt (1).
     * - Chỉ quản trị viên, hoặc quản lý kho CỦA ĐÚNG kho nhập của yêu cầu.
     * - Từ chối bắt buộc có lý do (≤ 500 ký tự).
     * - Lưu người duyệt (cả khi từ chối — người ra quyết định) và ghi
     *   lich_su_thay_doi: ai, lúc nào, trạng thái cũ/mới, lý do từ chối.
     * - Khoá dòng (PESSIMISTIC_WRITE) để hai người bấm cùng lúc không cùng
     *   vượt qua bước kiểm tra trạng thái.
     */
    @Transactional
    public void duyetTuChoi(Integer id, Integer trangThaiMoi, String lyDoTuChoi) {
        if (trangThaiMoi == null
                || (trangThaiMoi != TRANG_THAI_DA_DUYET && trangThaiMoi != TRANG_THAI_TU_CHOI)) {
            throw new CommonException("Trạng thái không hợp lệ: chỉ được Duyệt (2) hoặc Từ chối (4)");
        }
        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();
        if (authInfo == null) {
            throw new CommonException("Bạn phải đăng nhập", HttpStatus.UNAUTHORIZED, null);
        }

        YeuCauMuaHang yeuCauMuaHang = entityManager.find(YeuCauMuaHang.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (yeuCauMuaHang == null) {
            throw new CommonException("Không tìm thấy yêu cầu mua hàng id: " + id);
        }
        if (!Objects.equals(yeuCauMuaHang.getTrangThai(), TRANG_THAI_CHO_DUYET)) {
            throw new CommonException("Chỉ duyệt hoặc từ chối được yêu cầu đang ở trạng thái Chờ duyệt");
        }
        if (!coQuyenDuyetKho(authInfo, yeuCauMuaHang.getKhoNhap())) {
            String tenKho = yeuCauMuaHang.getKhoNhap() != null ? yeuCauMuaHang.getKhoNhap().getTenKho() : "";
            throw new AccessDeniedException("Bạn không phải quản lý của kho " + tenKho + " nên không thể duyệt yêu cầu này");
        }

        String lyDo = lyDoTuChoi == null ? null : lyDoTuChoi.trim();
        if (trangThaiMoi == TRANG_THAI_TU_CHOI) {
            if (lyDo == null || lyDo.isEmpty()) {
                throw new CommonException("Vui lòng nhập lý do từ chối");
            }
            if (lyDo.length() > LY_DO_TU_CHOI_MAX) {
                throw new CommonException("Lý do từ chối không được quá " + LY_DO_TU_CHOI_MAX + " ký tự");
            }
        }

        NguoiDung nguoiDuyet = nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException("Người dùng không tồn tại trong hệ thống id:" + authInfo.getId())
        );
        Instant now = Instant.now();

        yeuCauMuaHang.setTrangThai(trangThaiMoi);
        yeuCauMuaHang.setNguoiDuyet(nguoiDuyet);
        yeuCauMuaHang.setNgayCapNhat(now);
        damBaoCoMa(yeuCauMuaHang);
        create(yeuCauMuaHang);

        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(LOAI_THAM_CHIEU)
                .idThamChieu(yeuCauMuaHang.getId())
                .kho(yeuCauMuaHang.getKhoNhap())
                .hanhDong(trangThaiMoi == TRANG_THAI_DA_DUYET
                        ? IHanhDong.duyet_yeu_cau_mua_hang
                        : IHanhDong.tu_choi_yeu_cau_mua_hang)
                .giaTriCu(String.valueOf(TRANG_THAI_CHO_DUYET))
                .giaTriMoi(String.valueOf(trangThaiMoi))
                .nguoiThucHien(nguoiDuyet)
                .ngayThucHien(now)
                .ghiChu(trangThaiMoi == TRANG_THAI_TU_CHOI ? lyDo : null)
                .build());
    }

    /**
     * Quản trị viên: mọi kho. Quản lý kho: chỉ kho mình quản lý — là quản lý
     * ghi trên kho, hoặc được phân quyền (còn hiệu lực) tại kho đó.
     */
    static boolean coQuyenDuyetKho(NguoiDungAuthInfo authInfo, Kho kho) {
        Set<String> vaiTro = authInfo.getVaiTro() == null ? Set.of() : authInfo.getVaiTro();
        if (vaiTro.contains(IRoleType.quan_tri_vien)) return true;
        if (!vaiTro.contains(IRoleType.quan_ly_kho) || kho == null) return false;
        if (kho.getQuanLy() != null && Objects.equals(kho.getQuanLy().getId(), authInfo.getId())) return true;
        List<PhanQuyenNguoiDungKhoDto> phanQuyen = authInfo.getPhanQuyenNguoiDungKhos();
        return phanQuyen != null && phanQuyen.stream().anyMatch(pq ->
                pq.getKho() != null
                        && Objects.equals(pq.getKho().getId(), kho.getId())
                        && (pq.getTrangThai() == null || pq.getTrangThai() == 1));
    }

    /**
     * Điền lý do từ chối + thời điểm duyệt/từ chối gần nhất (từ lich_su_thay_doi)
     * vào DTO chi tiết. Yêu cầu chưa từng được duyệt/từ chối -> giữ null.
     */
    @Transactional(readOnly = true)
    public YeuCauMuaHangDto boSungThongTinDuyet(YeuCauMuaHangDto dto) {
        if (dto == null || dto.getId() == null) return dto;
        lichSuThayDoiRepository
                .findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        LOAI_THAM_CHIEU, dto.getId(),
                        List.of(IHanhDong.duyet_yeu_cau_mua_hang, IHanhDong.tu_choi_yeu_cau_mua_hang))
                .ifPresent(lichSu -> {
                    dto.setNgayDuyet(lichSu.getNgayThucHien());
                    if (IHanhDong.tu_choi_yeu_cau_mua_hang.equals(lichSu.getHanhDong())) {
                        dto.setLyDoTuChoi(lichSu.getGhiChu());
                    }
                });
        return dto;
    }
}
