package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.ChiTietPhieuXuatKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoYeuCau;
import com.dev.backend.dto.response.customize.PhieuChuyenKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService.KhaDungChuyen;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.multitable.NhatHangService;
import com.dev.backend.utils.BienSoXe;
import com.dev.backend.utils.HienThiBienThe;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.SoChungTu;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Chuyển kho nội bộ theo đặc tả BA (UC-7.1, BR-TRF-01…05, ma trận chuyển trạng thái 3.2, SDS Phần III):
 * <pre>
 *   CHO_DUYET ──duyệt + lệnh điều động──▶ DA_DUYET ──xác nhận xuất (người chở, xe, XKNB)──▶ DANG_VAN_CHUYEN
 *       │                                    │                                              │        │
 *       └──────────── hủy ──▶ DA_HUY ◀── hủy ┘                    nhận đủ (PN-TRF) ─────────┘        │ nhận lệch (PN-TRF phần đạt + BBGN)
 *                              ▲ (hủy khi đang đi: nhập hoàn trả PN-RET)       ▼                     ▼
 *                              └──────────────────────────────────────────── HOAN_TAT ◀── xử lý lệch ── CHO_XU_LY_LECH
 * </pre>
 * Tồn kho: tạo / duyệt giữ chỗ ở kho nguồn (GiuChoChuyenKhoService); xuất: nguồn −, KHO_TRANSIT +; nhận: KHO_TRANSIT −,
 * đích +; phần thiếu, hỏng giữ ở KHO_TRANSIT tới khi Quản lý Kho tổng (mặc định, đổi ở Cấu hình › Chuyển kho) chọn Ghi
 * giảm hoặc Giao bù. Cả hai đều lập phiếu
 * điều chỉnh kho giảm cho phần lệch (giao bù không được trừ trung chuyển mà không có chứng từ), giao bù sinh thêm phiếu
 * chuyển mới nối phiếu gốc.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhieuChuyenKhoService {

    private static final Pattern KY_HIEU_XKNB = Pattern.compile("^6[CK][0-9]{2}N[A-Z0-9]{2}$");
    private static final Pattern SO_XKNB = Pattern.compile("^[0-9]{7}$");
    private static final Pattern SO_DIEN_THOAI = Pattern.compile("^0[35789][0-9]{8}$");
    private static final String MA_KHO_TRUNG_CHUYEN = "KHO_TRANSIT";
    private static final String CAU_THIEU_XKNB = "Cần ký hiệu và số của giấy đi đường (phiếu XKNB) trước khi hàng rời kho";
    private static final String CAU_CHUA_NHAT_XONG = "Phiếu chưa nhặt hàng: bấm Mở phiếu nhặt, nhặt đủ hàng rồi Hoàn tất nhặt "
            + "trước khi xác nhận xuất";

    private final PhieuChuyenKhoRepository phieuChuyenKhoRepository;
    private final ChiTietPhieuChuyenKhoRepository chiTietPhieuChuyenKhoRepository;
    private final BienBanGiaoNhanRepository bienBanGiaoNhanRepository;
    private final ChiTietBienBanGiaoNhanRepository chiTietBienBanGiaoNhanRepository;
    private final PhieuDieuChinhKhoRepository phieuDieuChinhKhoRepository;
    private final ChiTietPhieuDieuChinhRepository chiTietPhieuDieuChinhRepository;
    private final PhieuXuatKhoRepository phieuXuatKhoRepository;
    private final ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    private final PhieuNhapKhoRepository phieuNhapKhoRepository;
    private final ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    private final TonKhoTheoLoRepository tonKhoTheoLoRepository;
    private final LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    private final BienTheSanPhamRepository bienTheSanPhamRepository;
    private final LoHangRepository loHangRepository;
    private final PhieuXuatKhoService phieuXuatKhoService;
    private final KhaDungChuyenKhoService khaDungChuyenKhoService;
    private final LoDangGiuService loDangGiuService;
    private final DieuHanhHeThongService dieuHanhHeThongService;
    private final LichSuThayDoiService lichSuThayDoiService;
    private final SanPhamQuanAoService sanPhamQuanAoService;
    private final ThongBaoChuyenKhoService thongBaoChuyenKhoService;
    /** Phiếu nhặt của PX-CK (đặc tả bước 8–9): tạo khi duyệt, hủy cùng phiếu chuyển. */
    private final NhatHangService nhatHangService;
    private final DanhSachNhatHangRepository danhSachNhatHangRepository;
    /** Ảnh chụp đính kèm biên bản giao nhận (mockup B.4): danh sách ở chi tiết, cờ được thêm ảnh. */
    private final AnhBienBanGiaoNhanService anhBienBanGiaoNhanService;

    // ─────────────────────────────────────────────────────────────
    // TẠO YÊU CẦU (UC bước 5–6)
    // ─────────────────────────────────────────────────────────────

    /**
     * Tạo yêu cầu ở trạng thái Chờ duyệt và giữ chỗ tồn ở kho nguồn. Người tạo: kho nhận (kéo hàng), Quản lý Kho tổng
     * (đẩy hàng, mọi tuyến) hoặc quản trị viên. Chuyển ngang giữa hai cửa hàng được phép.
     * READ_COMMITTED: sau khi chờ khóa dòng tồn, lần đọc giữ chỗ / chờ xuất thấy được phiếu, đơn vừa ghi xong.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PhieuChuyenKho tao(PhieuChuyenKhoCreating yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (yeuCau.getKhoXuatId() == null || yeuCau.getKhoNhapId() == null) {
            throw new CommonException("Vui lòng chọn đầy đủ kho xuất và kho nhận");
        }
        if (yeuCau.getKhoXuatId().equals(yeuCau.getKhoNhapId())) {
            throw new CommonException("Kho nhận phải khác kho xuất");
        }
        if (yeuCau.getChiTietXuat() == null || yeuCau.getChiTietXuat().isEmpty()) {
            throw new CommonException("Yêu cầu chuyển kho phải có ít nhất 1 sản phẩm");
        }
        // Khóa dòng tồn của kho xuất cho các mã cần chuyển: hai yêu cầu (hoặc bán POS) cùng lúc trên cùng mã chạy lần lượt,
        // lần sau đọc được phần giữ chỗ lần trước vừa ghi
        loDangGiuService.khoaTonTheoBienThe(yeuCau.getKhoXuatId(), yeuCau.getChiTietXuat().stream()
                .map(ChiTietPhieuXuatKhoCreating::getBienTheSanPhamId).filter(Objects::nonNull).distinct().toList());
        Kho khoXuat = khoRepository.findById(yeuCau.getKhoXuatId()).orElse(null);
        Kho khoNhap = khoRepository.findById(yeuCau.getKhoNhapId()).orElse(null);
        KhoService.kiemTraKhoGiaoDich(khoXuat, "Kho xuất");
        KhoService.kiemTraKhoGiaoDich(khoNhap, "Kho nhận");
        if (!laQuanTri(user) && !laQuanLyKhoTong(user) && !thuocKho(user, khoNhap)) {
            throw new CommonException(HttpStatus.FORBIDDEN, "Bạn chỉ tạo được yêu cầu chuyển hàng về kho mình phụ trách");
        }

        // Gộp các dòng cùng biến thể; số lượng chuyển là số nguyên dương
        Map<Integer, Integer> soLuongTheoBienThe = new LinkedHashMap<>();
        for (ChiTietPhieuXuatKhoCreating dong : yeuCau.getChiTietXuat()) {
            if (dong.getBienTheSanPhamId() == null) throw new CommonException("Thiếu sản phẩm ở dòng yêu cầu");
            BigDecimal sl = dong.getSoLuongXuat();
            if (sl == null || sl.signum() <= 0 || sl.stripTrailingZeros().scale() > 0) {
                throw new CommonException("Số lượng chuyển phải là số nguyên lớn hơn 0");
            }
            // Cộng không tràn số: dòng quá lớn hoặc gộp nhiều dòng cùng mã vượt giới hạn int thì báo 400 (không tạo phiếu âm)
            try {
                soLuongTheoBienThe.merge(dong.getBienTheSanPhamId(), sl.intValueExact(), Math::addExact);
            } catch (ArithmeticException ex) {
                throw new CommonException("Số lượng chuyển quá lớn");
            }
        }
        Map<Integer, BienTheSanPham> bienThe = bienTheSanPhamRepository.findAllById(soLuongTheoBienThe.keySet()).stream()
                .collect(Collectors.toMap(BienTheSanPham::getId, Function.identity()));
        for (Integer id : soLuongTheoBienThe.keySet()) {
            if (!bienThe.containsKey(id)) throw new CommonException("Sản phẩm ID " + id + " không tồn tại");
        }
        kiemTraKhaDung(khoXuat, soLuongTheoBienThe, bienThe, null);

        NguoiDung nguoiTao = nguoiDungRepository.findById(user.getId()).orElseThrow();
        PhieuChuyenKho phieu = phieuChuyenKhoRepository.save(PhieuChuyenKho.builder()
                .soPhieuChuyen(soPhieuMoi())
                .khoXuat(khoXuat)
                .khoNhap(khoNhap)
                .trangThai(IChuyenKho.CHO_DUYET)
                .ghiChu(chuoiHoacNull(yeuCau.getGhiChu()))
                .nguoiTao(nguoiTao)
                .build());
        for (Map.Entry<Integer, Integer> e : soLuongTheoBienThe.entrySet()) {
            chiTietPhieuChuyenKhoRepository.save(ChiTietPhieuChuyenKho.builder()
                    .phieuChuyenKho(phieu)
                    .bienTheSanPham(bienThe.get(e.getKey()))
                    .soLuongChuyen(e.getValue())
                    .build());
        }
        ghiNhatKy(phieu, IHanhDong.tao_phieu_chuyen, null, IChuyenKho.CHO_DUYET, null, nguoiTao);
        thongBaoChuyenKhoService.choDuyet(phieu, nguoiTao);
        return phieu;
    }

    // ─────────────────────────────────────────────────────────────
    // DUYỆT VÀ LẬP LỆNH ĐIỀU ĐỘNG (UC bước 7–8, BR-TRF-01)
    // ─────────────────────────────────────────────────────────────

    /**
     * Quản lý Kho tổng thẩm định tồn, duyệt và lập lệnh điều động LDD-yyyyMMdd-XXX; khóa cứng số lượng; tự tạo phiếu xuất
     * PX-CK và đẩy vào danh sách chờ nhặt (đặc tả bước 8): phiếu nhặt ở kho xuất, chưa phân công, phân bổ lô FIFO — cùng
     * giao dịch. Số lệnh / PX-CK / mã phiếu nhặt bị giao dịch khác dùng trước thì cả thao tác rollback và controller chạy
     * lại (ThuLaiKhiTrungSo).
     * READ_COMMITTED (như {@link #tao}): sau khi chờ khóa phiếu chuyển / dòng tồn, lần đọc khả dụng, giữ chỗ và phần lô
     * đang giữ thấy phiếu, đơn vừa ghi xong.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PhieuChuyenKho duyet(Integer id, PhieuChuyenKhoYeuCau.Duyet yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        batBuocTrangThai(phieu, IChuyenKho.CHO_DUYET, "duyệt");
        if (!laQuanLyKhoTong(user)) {
            throw new CommonException(HttpStatus.FORBIDDEN, "Chỉ Quản lý Kho tổng duyệt và lập lệnh điều động");
        }
        String lyDo = yeuCau == null ? null : chuoiHoacNull(yeuCau.getLyDoDieuDong());
        if (lyDo == null || !IChuyenKho.LY_DO_DIEU_DONG.contains(lyDo)) {
            throw new CommonException("Chọn lý do điều động");
        }
        String ghiChuLenh = chuoiHoacNull(yeuCau.getGhiChuLenh());
        if (IChuyenKho.LY_DO_KHAC.equals(lyDo) && ghiChuLenh == null) {
            throw new CommonException("Ghi rõ lý do điều động");
        }
        List<ChiTietPhieuChuyenKho> dong = chiTietPhieuChuyenKhoRepository.findByPhieuChuyenKho_IdOrderByIdAsc(id);
        Map<Integer, Integer> soLuong = new LinkedHashMap<>();
        Map<Integer, BienTheSanPham> bienThe = new HashMap<>();
        for (ChiTietPhieuChuyenKho ct : dong) {
            soLuong.merge(ct.getBienTheSanPham().getId(), ct.getSoLuongChuyen(), Integer::sum);
            bienThe.put(ct.getBienTheSanPham().getId(), ct.getBienTheSanPham());
        }
        // Thẩm định tồn: tồn khả dụng hiện tại, không tính phần giữ chỗ của chính phiếu này
        kiemTraKhaDung(phieu.getKhoXuat(), soLuong, bienThe, phieu.getId());

        NguoiDung quanLy = nguoiDungRepository.findById(user.getId()).orElseThrow();
        String tienTo = IChuyenKho.TIEN_TO_LENH + ngayHomNay() + "-";
        phieu.setSoLenhDieuDong(SoChungTu.tiepTheoBaChuSo(tienTo, phieuChuyenKhoRepository.soLenhLonNhat(tienTo)));
        phieu.setNgayLenhDieuDong(Instant.now());
        phieu.setNguoiRaLenh(quanLy);
        phieu.setLyDoDieuDong(lyDo);
        phieu.setGhiChuLenh(ghiChuLenh);
        phieu.setTrangThai(IChuyenKho.DA_DUYET);
        phieuChuyenKhoRepository.save(phieu);
        PhieuXuatKho px = taoPhieuXuatCon(phieu, dong);
        nhatHangService.taoPhieuNhatChuyenKho(phieu, px, dong);
        ghiNhatKy(phieu, IHanhDong.duyet_phieu_chuyen, IChuyenKho.CHO_DUYET, IChuyenKho.DA_DUYET, phieu.getSoLenhDieuDong(), quanLy);
        thongBaoChuyenKhoService.daDuyet(phieu, quanLy);
        return phieu;
    }

    /**
     * Kết quả "Mở phiếu nhặt": phiếu xuất PX-CK và phiếu nhặt của nó. {@code phieuNhat} null = PX-CK đã có lô chọn tay
     * (phiếu duyệt trước bản phiếu nhặt, lô đang giữ qua so_luong_da_dat): giữ đường chọn lô tay cũ.
     */
    public record MoPhieuNhat(PhieuXuatKho phieuXuat, DanhSachNhatHang phieuNhat) {}

    /**
     * Đảm bảo phiếu Đã duyệt có phiếu nhặt (N7), kho xuất gọi khi bấm "Mở phiếu nhặt": PX-CK tạo nếu chưa có (phiếu duyệt
     * trước khi nâng cấp không có phiếu xuất con); PX-CK đã có phiếu nhặt thì trả phiếu đó; PX-CK chưa có dòng lô thì tạo
     * phiếu nhặt; PX-CK đã có lô chọn tay (dữ liệu cũ) thì giữ đường chọn lô tay, không tạo phiếu nhặt. Không tạo hàng loạt
     * lúc triển khai: phiếu cũ chỉ có phiếu nhặt khi được mở.
     * READ_COMMITTED (như {@link #tao}): sau khi chờ khóa phiếu chuyển, lần đọc phiếu xuất / phiếu nhặt / dòng lô thấy bản
     * vừa ghi xong (lần bấm song song không tạo thêm phiếu), phân bổ FIFO thấy phần lô vừa bị giữ.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MoPhieuNhat damBaoPhieuXuat(Integer id) {
        PhieuChuyenKho phieu = khoa(id);
        KhoDangChon.kiemTra(phieu.getKhoXuat(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
        batBuocTrangThai(phieu, IChuyenKho.DA_DUYET, "nhặt hàng");
        List<ChiTietPhieuChuyenKho> dong = chiTietPhieuChuyenKhoRepository.findByPhieuChuyenKho_IdOrderByIdAsc(id);
        PhieuXuatKho px = phieuXuatKhoRepository.findFirstByPhieuChuyenKho_IdAndTrangThaiNot(id, ITrangThaiPhieuXuat.DA_HUY)
                .orElseGet(() -> taoPhieuXuatCon(phieu, dong));
        Optional<DanhSachNhatHang> co = danhSachNhatHangRepository.findByPhieuXuatKho_Id(px.getId());
        if (co.isPresent()) {
            return new MoPhieuNhat(px, co.get());
        }
        if (!chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(px.getId()).isEmpty()) {
            return new MoPhieuNhat(px, null);
        }
        return new MoPhieuNhat(px, nhatHangService.taoPhieuNhatChuyenKho(phieu, px, dong));
    }

    private PhieuXuatKho taoPhieuXuatCon(PhieuChuyenKho phieu, List<ChiTietPhieuChuyenKho> dong) {
        String tienTo = IChuyenKho.TIEN_TO_PHIEU_XUAT_CON + ngayHomNay();
        PhieuXuatKho px = phieuXuatKhoRepository.save(PhieuXuatKho.builder()
                .soPhieuXuat(SoChungTu.tiepTheo(tienTo, phieuXuatKhoRepository.soDuoiLonNhat(tienTo)))
                .phieuChuyenKho(phieu)
                .kho(phieu.getKhoXuat())
                .khoChuyenDen(phieu.getKhoNhap())
                .loaiXuat("chuyen_kho")
                .trangThai(ITrangThaiPhieuXuat.NHAP)
                .ngayTao(Instant.now())
                .ghiChu("Phiếu xuất của phiếu chuyển " + phieu.getSoPhieuChuyen()
                        + (phieu.getSoLenhDieuDong() != null ? ", lệnh điều động " + phieu.getSoLenhDieuDong() : ""))
                .build());
        for (ChiTietPhieuChuyenKho ct : dong) {
            chiTietPhieuXuatKhoRepository.save(ChiTietPhieuXuatKho.builder()
                    .phieuXuatKho(px)
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .soLuongXuat(BigDecimal.valueOf(ct.getSoLuongChuyen()))
                    .build());
        }
        return px;
    }

    // ─────────────────────────────────────────────────────────────
    // HỦY (A5)
    // ─────────────────────────────────────────────────────────────

    /**
     * Chờ duyệt / Đã duyệt: hủy phiếu và phiếu xuất con chưa xuất, nhả hàng đang giữ. Đang vận chuyển: phiếu sang Đã hủy,
     * hàng còn ở kho trung chuyển tới khi kho xuất nhập hoàn trả (bắt buộc). Chờ xử lý chênh lệch, Hoàn tất: không hủy.
     * Đã duyệt có phiếu nhặt (N6): khóa phiếu chuyển → dòng nhặt; phiếu nhặt chưa hủy sang Đã hủy, hàng đã nhặt sinh lệnh
     * trả kệ (lý do "Phiếu chuyển kho bị hủy"), màn nhặt nhận PICK_LIST_CANCELLED; rồi hủy PX-CK như cũ (nhả đang giữ).
     * READ_COMMITTED (như {@link #tao}): sau khi chờ khóa phiếu chuyển, lần đọc phiếu xuất con / phiếu nhặt / dòng lô thấy
     * bản vừa ghi xong (hoàn tất nhặt chạy trước thì nhả đúng lô vừa ghi vào PX-CK).
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PhieuChuyenKho huy(Integer id, PhieuChuyenKhoYeuCau.Huy yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        String truoc = phieu.getTrangThai();
        if (!duocHuy(user, phieu)) {
            throw new CommonException(HttpStatus.FORBIDDEN, IChuyenKho.DANG_VAN_CHUYEN.equals(truoc)
                    ? "Hàng đang trên đường: chỉ Quản lý Kho tổng hủy được phiếu"
                    : "Bạn không có quyền hủy phiếu chuyển này");
        }
        if (!IChuyenKho.CHO_DUYET.equals(truoc) && !IChuyenKho.DA_DUYET.equals(truoc) && !IChuyenKho.DANG_VAN_CHUYEN.equals(truoc)) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu " + tenTrangThai(truoc).toLowerCase() + " không hủy được");
        }
        if (IChuyenKho.DA_DUYET.equals(truoc)) {
            for (PhieuXuatKho px : phieuXuatKhoRepository.findByPhieuChuyenKho_IdOrderByIdDesc(id)) {
                if (Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(px.getTrangThai())) {
                    nhatHangService.huyPhieuNhatChuyenKho(px, phieu.getSoPhieuChuyen());
                    px.setGhiChu(noi(px.getGhiChu(), "Hủy theo phiếu chuyển " + phieu.getSoPhieuChuyen()));
                    phieuXuatKhoService.huyPhieuXuatCon(px);
                }
            }
        }
        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        phieu.setTrangThai(IChuyenKho.DA_HUY);
        phieu.setNguoiHuy(nguoi);
        phieu.setLyDoHuy(yeuCau == null ? null : toiDa(chuoiHoacNull(yeuCau.getLyDo()), 255, "Lý do hủy"));
        phieu.setNgayHuy(Instant.now());
        phieuChuyenKhoRepository.save(phieu);
        ghiNhatKy(phieu, IHanhDong.huy_phieu_chuyen, truoc, IChuyenKho.DA_HUY, phieu.getLyDoHuy(), nguoi);
        thongBaoChuyenKhoService.daHuy(phieu, truoc, nguoi);
        return phieu;
    }

    /** Kho xuất nhập hàng hoàn trả từ kho trung chuyển cho phiếu bị hủy khi đang vận chuyển (A5 bước 2): PN-RET. */
    @Transactional
    public PhieuNhapKho nhapHoanTra(Integer id) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        KhoDangChon.kiemTra(phieu.getKhoXuat(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
        batBuocTrangThai(phieu, IChuyenKho.DA_HUY, "nhập hoàn trả");
        List<DongLo> daXuat = hangDaXuatTheoLo(id);
        if (daXuat.isEmpty()) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu hủy trước khi xuất hàng, không có hàng để nhập hoàn trả");
        }
        Map<String, BigDecimal> conLai = conTrenDuongTheoLo(id, daXuat);
        List<DongNhap> dong = new ArrayList<>();
        for (DongLo d : daXuat) {
            BigDecimal sl = conLai.getOrDefault(khoaLo(d.bienThe().getId(), d.lo().getId()), BigDecimal.ZERO);
            if (sl.signum() > 0) dong.add(new DongNhap(d.bienThe(), d.lo(), sl, d.giaVon()));
        }
        // Phiếu nhập nháp (PN-RET / PN-TRF) của luồng cũ: hủy để không còn treo cạnh phiếu nhập hoàn trả mới
        huyPhieuNhapNhapCu(id);
        if (dong.isEmpty()) {
            throw new CommonException(HttpStatus.CONFLICT, "Hàng của phiếu đã được nhập hoàn trả");
        }
        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        PhieuNhapKho pn = nhapTuTrungChuyen(phieu, phieu.getKhoXuat(), IChuyenKho.TIEN_TO_NHAP_HOAN_TRA, dong, nguoi,
                "Nhập hoàn trả: phiếu chuyển " + phieu.getSoPhieuChuyen() + " hủy khi đang vận chuyển");
        ghiNhatKy(phieu, IHanhDong.nhap_hoan_tra, IChuyenKho.DA_HUY, IChuyenKho.DA_HUY, pn.getSoPhieuNhap(), nguoi);
        return pn;
    }

    // ─────────────────────────────────────────────────────────────
    // XÁC NHẬN XUẤT (UC bước 10–11, BR-TRF-02, A3)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public PhieuChuyenKho xacNhanXuat(Integer id, PhieuChuyenKhoYeuCau.XacNhanXuat yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        KhoDangChon.kiemTra(phieu.getKhoXuat(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
        batBuocTrangThai(phieu, IChuyenKho.DA_DUYET, "xác nhận xuất");
        if (yeuCau == null) throw new CommonException("Thiếu thông tin vận chuyển");

        String hinhThuc = chuoiHoacNull(yeuCau.getHinhThucVanChuyen());
        if (hinhThuc == null || !IChuyenKho.HINH_THUC_VAN_CHUYEN.contains(hinhThuc)) {
            throw new CommonException("Chọn hình thức vận chuyển");
        }
        boolean canPhuongTien = IChuyenKho.XE_CONG_TY.equals(hinhThuc) || IChuyenKho.THUE_NGOAI.equals(hinhThuc);
        boolean canDonVi = IChuyenKho.THUE_NGOAI.equals(hinhThuc) || IChuyenKho.CHUYEN_PHAT.equals(hinhThuc);
        String nguoiVanChuyen = batBuoc(yeuCau.getNguoiVanChuyen(), "Nhập tên người vận chuyển");
        String soDienThoai = batBuoc(yeuCau.getSoDienThoaiVanChuyen(), "Nhập số điện thoại người vận chuyển").replaceAll("\\s", "");
        if (!SO_DIEN_THOAI.matcher(soDienThoai).matches()) {
            throw new CommonException("Số điện thoại gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09");
        }
        String loaiPhuongTien = chuoiHoacNull(yeuCau.getLoaiPhuongTien());
        String bienSo = chuoiHoacNull(yeuCau.getBienSoXe());
        String donVi = chuoiHoacNull(yeuCau.getDonViVanChuyen());
        String maVanDon = chuoiHoacNull(yeuCau.getMaVanDonHopDong());
        toiDa(nguoiVanChuyen, 100, "Tên người vận chuyển");
        toiDa(loaiPhuongTien, 50, "Loại phương tiện");
        toiDa(bienSo, 20, "Biển số xe");
        toiDa(donVi, 150, "Tên đơn vị vận chuyển");
        toiDa(maVanDon, 50, "Mã vận đơn / số hợp đồng");
        toiDa(chuoiHoacNull(yeuCau.getMaTraCuuXknb()), 100, "Mã tra cứu XKNB");
        kiemTraNgayLapXknb(yeuCau.getNgayLapXknb());
        if (yeuCau.getNgayDuKienDen() != null && yeuCau.getNgayDuKienDen().isBefore(Instant.now().minus(Duration.ofMinutes(10)))) {
            throw new CommonException("Thời gian dự kiến đến phải sau lúc xuất hàng");
        }
        if (canPhuongTien && loaiPhuongTien == null) throw new CommonException("Nhập loại phương tiện");
        if (canPhuongTien && bienSo == null) throw new CommonException("Nhập biển số xe");
        if (canPhuongTien) {
            // Biển số theo mẫu biển Việt Nam, lưu cách viết chuẩn (cùng luật ô Biển số ở giao diện)
            BienSoXe.KetQua kqBienSo = BienSoXe.kiemTra(bienSo);
            // Câu lỗi hiện ở chân hộp (không nằm dưới ô) nên ghi rõ là ô nào; chuỗi chỉ có ký tự trắng lạ thì báo như để trống
            if (!kqBienSo.hopLe()) {
                String cau = kqBienSo.loi();
                throw new CommonException(BienSoXe.LOI_TRONG.equals(cau) ? cau : "Biển số xe: " + cau);
            }
            bienSo = kqBienSo.giaTri();
        }
        if (canDonVi && donVi == null) throw new CommonException("Nhập tên đơn vị vận chuyển");
        if (IChuyenKho.CHUYEN_PHAT.equals(hinhThuc) && maVanDon == null) throw new CommonException("Nhập mã vận đơn");

        // Giấy đi đường: ký hiệu + số do phần mềm hóa đơn điện tử cấp; thiếu thì chặn trừ khi bật Chỉ cảnh báo
        String kyHieu = chuoiHoacNull(yeuCau.getKyHieuXknb());
        String soXknb = chuoiHoacNull(yeuCau.getSoPhieuXknb());
        if (kyHieu != null) kyHieu = kyHieu.toUpperCase(Locale.ROOT);
        boolean thieuXknb = kyHieu == null || soXknb == null;
        if (thieuXknb) {
            String cheDo = dieuHanhHeThongService.getCauHinhString(DieuHanhHeThongServiceImpl.CAU_HINH_XKNB_CHE_DO, IChuyenKho.XKNB_CHI_CANH_BAO);
            if (!IChuyenKho.XKNB_CHI_CANH_BAO.equals(cheDo)) {
                throw new CommonException(CAU_THIEU_XKNB, HttpStatus.CONFLICT, null);
            }
            if (!Boolean.TRUE.equals(yeuCau.getVanXuatKhiChuaCoSo())) {
                throw new CommonException(CAU_THIEU_XKNB + ". Đang bật Chỉ cảnh báo: xác nhận lại để xuất trước, ghi số sau.",
                        HttpStatus.CONFLICT, null);
            }
            kyHieu = null;
            soXknb = null;
        } else {
            kiemTraSoXknb(kyHieu, soXknb, phieu.getId());
        }

        PhieuXuatKho px = phieuXuatKhoRepository.findFirstByPhieuChuyenKho_IdAndTrangThaiNot(id, ITrangThaiPhieuXuat.DA_HUY)
                .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT, CAU_CHUA_NHAT_XONG));
        if (!Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(px.getTrangThai())) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu xuất " + px.getSoPhieuXuat() + " không còn chờ xuất");
        }
        // Hàng chỉ rời kho sau khi phiếu nhặt hoàn tất (lô đã nhặt ghi vào PX-CK); phiếu cũ chọn lô tay thì phiếu xuất
        // kiểm đủ lô khi xuất
        Optional<DanhSachNhatHang> phieuNhat = danhSachNhatHangRepository.findByPhieuXuatKho_Id(px.getId());
        if (phieuNhat.isPresent() && !"da_nhat".equals(phieuNhat.get().getTrangThai())) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu nhặt " + phieuNhat.get().getMaPickList()
                    + " chưa hoàn tất: nhặt đủ hàng và bấm Hoàn tất nhặt trước khi xác nhận xuất");
        }
        if (phieuNhat.isEmpty() && chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(px.getId()).isEmpty()) {
            throw new CommonException(HttpStatus.CONFLICT, CAU_CHUA_NHAT_XONG);
        }

        phieu.setHinhThucVanChuyen(hinhThuc);
        phieu.setNguoiVanChuyen(nguoiVanChuyen);
        phieu.setSoDienThoaiVanChuyen(soDienThoai);
        phieu.setLoaiPhuongTien(canPhuongTien ? loaiPhuongTien : null);
        phieu.setBienSoXe(canPhuongTien ? bienSo : null);
        phieu.setDonViVanChuyen(canDonVi ? donVi : null);
        phieu.setMaVanDonHopDong(maVanDon);
        phieu.setNgayDuKienDen(yeuCau.getNgayDuKienDen());
        phieu.setKyHieuXknb(kyHieu);
        phieu.setSoPhieuXknb(soXknb);
        phieu.setNgayLapXknb(thieuXknb ? null : (yeuCau.getNgayLapXknb() != null ? yeuCau.getNgayLapXknb() : LocalDate.now()));
        phieu.setMaTraCuuXknb(thieuXknb ? null : chuoiHoacNull(yeuCau.getMaTraCuuXknb()));
        if (!thieuXknb) luuSoXknb(phieu, kyHieu, soXknb);

        // Trừ tồn nguồn, cộng kho trung chuyển (kiểm đã chọn đủ lô, khóa dòng tồn) rồi chuyển trạng thái
        phieuXuatKhoService.xuatPhieuXuatCon(px.getId(), user.getId());
        phieu.setTrangThai(IChuyenKho.DANG_VAN_CHUYEN);
        phieuChuyenKhoRepository.save(phieu);
        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        ghiNhatKy(phieu, IHanhDong.xuat_chuyen_kho, IChuyenKho.DA_DUYET, IChuyenKho.DANG_VAN_CHUYEN,
                thieuXknb ? "Xuất khi chưa có số phiếu XKNB (Chỉ cảnh báo)" : "Phiếu XKNB " + kyHieu + " · " + soXknb, nguoi);
        thongBaoChuyenKhoService.daXuat(phieu, nguoi);
        return phieu;
    }

    /** Ghi số phiếu XKNB cho phiếu đã xuất khi chưa có số ("xuất trước, ghi số sau"). */
    @Transactional
    public PhieuChuyenKho ghiSoXknb(Integer id, PhieuChuyenKhoYeuCau.GhiSoXknb yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        KhoDangChon.kiemTra(phieu.getKhoXuat(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
        if (!daXuat(phieu)) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu chưa xuất hàng: ghi số XKNB ở hộp Xác nhận xuất");
        }
        if (phieu.getSoPhieuXknb() != null) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu đã có số XKNB " + phieu.getKyHieuXknb() + " · " + phieu.getSoPhieuXknb());
        }
        String kyHieu = batBuoc(yeuCau == null ? null : yeuCau.getKyHieuXknb(), "Nhập ký hiệu phiếu XKNB").toUpperCase(Locale.ROOT);
        String soXknb = batBuoc(yeuCau.getSoPhieuXknb(), "Nhập số phiếu XKNB");
        kiemTraSoXknb(kyHieu, soXknb, phieu.getId());
        kiemTraNgayLapXknb(yeuCau.getNgayLapXknb());
        toiDa(chuoiHoacNull(yeuCau.getMaTraCuuXknb()), 100, "Mã tra cứu XKNB");
        phieu.setKyHieuXknb(kyHieu);
        phieu.setSoPhieuXknb(soXknb);
        phieu.setNgayLapXknb(yeuCau.getNgayLapXknb() != null ? yeuCau.getNgayLapXknb() : LocalDate.now());
        phieu.setMaTraCuuXknb(chuoiHoacNull(yeuCau.getMaTraCuuXknb()));
        luuSoXknb(phieu, kyHieu, soXknb);
        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        ghiNhatKy(phieu, IHanhDong.ghi_so_xknb, phieu.getTrangThai(), phieu.getTrangThai(), kyHieu + " · " + soXknb, nguoi);
        return phieu;
    }

    /**
     * Ghi số XKNB xuống CSDL ngay: hai chuyến cùng lúc ghi một số (cả hai lọt qua kiemTraSoXknb) thì bên sau chờ khóa duy
     * nhất uk_pck_xknb rồi bị chặn ở đây, báo 409 câu rõ thay vì lỗi máy chủ lúc flush về sau.
     */
    private void luuSoXknb(PhieuChuyenKho phieu, String kyHieu, String soXknb) {
        try {
            phieuChuyenKhoRepository.saveAndFlush(phieu);
        } catch (DataIntegrityViolationException ex) {
            String loi = ex.getMessage() + " " + ex.getMostSpecificCause().getMessage();
            if (!loi.contains("uk_pck_xknb")) throw ex;
            throw new CommonException(HttpStatus.CONFLICT, "Số " + soXknb + " của ký hiệu " + kyHieu + " vừa được ghi cho chuyến khác");
        }
    }

    /**
     * Số phiếu XKNB tiếp theo của một ký hiệu (đặc tả BA mục 1.3: số nhảy tăng dần theo ký hiệu): số lớn nhất đã ghi + 1,
     * chưa có thì 0000001. Chỉ để điền sẵn ở hộp Xác nhận xuất / Ghi số XKNB, người dùng sửa được; số trùng vẫn bị chặn
     * khi lưu (kiemTraSoXknb + khóa duy nhất).
     */
    @Transactional(readOnly = true)
    public String soXknbTiepTheo(String kyHieu) {
        String kh = batBuoc(kyHieu, "Nhập ký hiệu phiếu XKNB").toUpperCase(Locale.ROOT);
        if (!KY_HIEU_XKNB.matcher(kh).matches()) {
            throw new CommonException("Ký hiệu phiếu XKNB gồm 7 ký tự, ví dụ 6K26NAB");
        }
        Number lonNhat = phieuChuyenKhoRepository.soXknbLonNhat(kh);
        long tiep = (lonNhat == null ? 0 : lonNhat.longValue()) + 1;
        if (tiep > 9_999_999L) {
            throw new CommonException(HttpStatus.CONFLICT, "Ký hiệu " + kh + " đã dùng hết số 7 chữ số, đổi ký hiệu khác");
        }
        return String.format("%07d", tiep);
    }

    private void kiemTraSoXknb(String kyHieu, String soXknb, Integer phieuId) {
        if (!KY_HIEU_XKNB.matcher(kyHieu).matches()) {
            throw new CommonException("Ký hiệu phiếu XKNB gồm 7 ký tự, ví dụ 6K26NAB");
        }
        if (!SO_XKNB.matcher(soXknb).matches()) {
            throw new CommonException("Số phiếu XKNB gồm 7 chữ số, ví dụ 0000125");
        }
        if (phieuChuyenKhoRepository.existsByKyHieuXknbAndSoPhieuXknbAndIdNot(kyHieu, soXknb, phieuId)) {
            throw new CommonException(HttpStatus.CONFLICT, "Số " + soXknb + " của ký hiệu " + kyHieu + " đã ghi cho chuyến khác");
        }
    }

    // ─────────────────────────────────────────────────────────────
    // NHẬN HÀNG (UC bước 13–15, A4)
    // ─────────────────────────────────────────────────────────────

    /** Xác nhận nhận đủ: PN-TRF tự phát hành cho toàn bộ hàng đã xuất, trung chuyển −, kho đích +, phiếu Hoàn tất. */
    @Transactional
    public PhieuNhapKho nhanDu(Integer id) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        KhoDangChon.kiemTra(phieu.getKhoNhap(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
        batBuocTrangThai(phieu, IChuyenKho.DANG_VAN_CHUYEN, "nhận hàng");
        huyPhieuNhapNhapCu(id);
        List<DongNhap> dong = hangDaXuatTheoLo(id).stream()
                .map(d -> new DongNhap(d.bienThe(), d.lo(), d.soLuong(), d.giaVon())).toList();
        if (dong.isEmpty()) throw new CommonException(HttpStatus.CONFLICT, "Phiếu chưa có hàng đã xuất");
        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        PhieuNhapKho pn = nhapTuTrungChuyen(phieu, phieu.getKhoNhap(), IChuyenKho.TIEN_TO_PHIEU_NHAP, dong, nguoi,
                "Nhận đủ hàng của phiếu chuyển " + phieu.getSoPhieuChuyen());
        phieu.setNgayThucTeDen(Instant.now());
        phieu.setTrangThai(IChuyenKho.HOAN_TAT);
        phieuChuyenKhoRepository.save(phieu);
        ghiNhatKy(phieu, IHanhDong.nhan_chuyen_kho, IChuyenKho.DANG_VAN_CHUYEN, IChuyenKho.HOAN_TAT, pn.getSoPhieuNhap(), nguoi);
        return pn;
    }

    /**
     * Nhận có chênh lệch: PN-TRF cho phần đạt (vào kho đích để bán), biên bản BBGN cho phần thiếu và hỏng (giữ ở kho trung
     * chuyển), phiếu sang Chờ xử lý chênh lệch. Phải khai đủ mọi dòng đã xuất; đạt + hỏng không vượt số gửi.
     */
    @Transactional
    public BienBanGiaoNhan nhanLech(Integer id, PhieuChuyenKhoYeuCau.NhanLech yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        KhoDangChon.kiemTra(phieu.getKhoNhap(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
        batBuocTrangThai(phieu, IChuyenKho.DANG_VAN_CHUYEN, "nhận hàng");
        if (yeuCau == null || yeuCau.getDong() == null || yeuCau.getDong().isEmpty()) {
            throw new CommonException("Thiếu số đếm của các dòng hàng");
        }
        String nguoiGiao = batBuoc(yeuCau.getNguoiVanChuyen(), "Nhập tên người giao hàng");
        if (yeuCau.getThoiDiem() == null) throw new CommonException("Chọn thời điểm giao nhận");
        if (yeuCau.getThoiDiem().isAfter(Instant.now().plus(Duration.ofMinutes(5)))) {
            throw new CommonException("Thời điểm giao nhận không được sau thời điểm hiện tại");
        }
        toiDa(nguoiGiao, 100, "Tên người giao hàng");

        List<DongLo> daXuat = hangDaXuatTheoLo(id);
        Map<String, PhieuChuyenKhoYeuCau.DongNhan> theoLo = new HashMap<>();
        for (PhieuChuyenKhoYeuCau.DongNhan d : yeuCau.getDong()) {
            if (d.getBienTheSanPhamId() == null || d.getLoHangId() == null) throw new CommonException("Dòng đếm thiếu sản phẩm hoặc lô");
            if (theoLo.put(khoaLo(d.getBienTheSanPhamId(), d.getLoHangId()), d) != null) {
                throw new CommonException("Một lô của một sản phẩm chỉ khai một dòng");
            }
        }
        if (theoLo.size() != daXuat.size()) throw new CommonException("Khai số đếm cho đủ mọi dòng hàng đã xuất");

        List<DongNhap> dat = new ArrayList<>();
        List<Object[]> lech = new ArrayList<>(); // [DongLo, dat, hong, lyDo]
        int tongGui = 0, tongDat = 0, tongHong = 0, tongThieu = 0;
        for (DongLo d : daXuat) {
            PhieuChuyenKhoYeuCau.DongNhan n = theoLo.get(khoaLo(d.bienThe().getId(), d.lo().getId()));
            if (n == null) throw new CommonException("Thiếu số đếm của " + d.bienThe().getMaSku() + " lô " + d.lo().getMaLo());
            int gui = d.soLuong().setScale(0, RoundingMode.HALF_UP).intValue();
            int soDat = n.getSoLuongDat() == null ? 0 : n.getSoLuongDat();
            int soHong = n.getSoLuongHong() == null ? 0 : n.getSoLuongHong();
            if (soDat < 0 || soHong < 0) throw new CommonException("Số đạt, số hỏng không được âm");
            if (soDat + soHong > gui) {
                throw new CommonException(d.bienThe().getMaSku() + " lô " + d.lo().getMaLo() + ": đạt + hỏng vượt số gửi " + gui
                        + ". Hàng dư ngoài phiếu không nhập theo phiếu này.");
            }
            int thieu = gui - soDat - soHong;
            tongGui += gui; tongDat += soDat; tongHong += soHong; tongThieu += thieu;
            if (soDat > 0) dat.add(new DongNhap(d.bienThe(), d.lo(), BigDecimal.valueOf(soDat), d.giaVon()));
            if (thieu > 0 || soHong > 0) {
                String lyDo = toiDa(chuoiHoacNull(n.getLyDo()), 255, "Lý do lệch");
                if (lyDo == null) {
                    throw new CommonException("Nhập lý do giải trình cho dòng lệch " + d.bienThe().getMaSku() + " lô " + d.lo().getMaLo());
                }
                lech.add(new Object[]{d, soDat, soHong, lyDo});
            }
        }
        if (lech.isEmpty()) {
            throw new CommonException("Số đếm khớp đủ số gửi: dùng Xác nhận nhận đủ");
        }
        huyPhieuNhapNhapCu(id);
        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        PhieuNhapKho pn = dat.isEmpty() ? null : nhapTuTrungChuyen(phieu, phieu.getKhoNhap(), IChuyenKho.TIEN_TO_PHIEU_NHAP, dat, nguoi,
                "Nhận phần đạt của phiếu chuyển " + phieu.getSoPhieuChuyen() + " (có chênh lệch)");

        String tienTo = IChuyenKho.TIEN_TO_BIEN_BAN + ngayHomNay() + "-";
        BienBanGiaoNhan bb = bienBanGiaoNhanRepository.save(BienBanGiaoNhan.builder()
                .soBienBan(SoChungTu.tiepTheoBaChuSo(tienTo, bienBanGiaoNhanRepository.soDuoiLonNhat(tienTo)))
                .phieuChuyenKho(phieu)
                .ngayLap(yeuCau.getThoiDiem())
                .nguoiLap(nguoi)
                .nguoiVanChuyen(nguoiGiao)
                .tongSoLuongGui(tongGui)
                .tongSoLuongNhan(tongDat)
                .tongSoLuongThieu(tongThieu)
                .tongSoLuongHong(tongHong)
                .ghiChu(chuoiHoacNull(yeuCau.getKetLuan()))
                .phuongAnXuLy(IChuyenKho.CHUA_XU_LY)
                .build());
        for (Object[] l : lech) {
            DongLo d = (DongLo) l[0];
            int gui = d.soLuong().setScale(0, RoundingMode.HALF_UP).intValue();
            int soDat = (Integer) l[1], soHong = (Integer) l[2];
            chiTietBienBanGiaoNhanRepository.save(ChiTietBienBanGiaoNhan.builder()
                    .bienBan(bb)
                    .bienTheSanPham(d.bienThe())
                    .loHang(d.lo())
                    .soLuongGui(gui)
                    .soLuongNhan(soDat)
                    .soLuongThieu(gui - soDat - soHong)
                    .soLuongHong(soHong)
                    .lyDoHongThieu((String) l[3])
                    .build());
        }
        phieu.setNgayThucTeDen(Instant.now());
        phieu.setTrangThai(IChuyenKho.CHO_XU_LY_LECH);
        phieuChuyenKhoRepository.save(phieu);
        ghiNhatKy(phieu, IHanhDong.lap_bien_ban_giao_nhan, IChuyenKho.DANG_VAN_CHUYEN, IChuyenKho.CHO_XU_LY_LECH,
                bb.getSoBienBan() + (pn != null ? ", " + pn.getSoPhieuNhap() : ""), nguoi);
        thongBaoChuyenKhoService.nhanLech(phieu, bb, nguoi);
        return bb;
    }

    // ─────────────────────────────────────────────────────────────
    // XỬ LÝ CHÊNH LỆCH (A4 bước 5, SDS bước 5; sửa R1, R2)
    // ─────────────────────────────────────────────────────────────

    /**
     * Người được xử lý chênh lệch (theo Cấu hình › Chuyển kho, xem {@link #duocXuLyChenhLech}) chọn một phương án cho cả
     * biên bản. Cả hai phương án lập phiếu điều chỉnh kho giảm phần lệch (thiếu + hỏng) khỏi kho trung chuyển theo từng lô,
     * nên tổng tồn công ty chỉ giảm qua chứng từ. Giao bù sinh thêm phiếu chuyển mới (Chờ duyệt, giữ chỗ ở kho nguồn) nối
     * phiếu gốc, đúng số lệch.
     * READ_COMMITTED (như {@link #tao}): Giao bù giữ chỗ mới ở kho nguồn, nên sau khi chờ khóa dòng tồn kho nguồn, lần đọc
     * khả dụng phải thấy bán POS / phiếu chuyển vừa ghi xong.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PhieuDieuChinhKho xuLyChenhLech(Integer id, PhieuChuyenKhoYeuCau.XuLyChenhLech yeuCau) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho phieu = khoa(id);
        batBuocTrangThai(phieu, IChuyenKho.CHO_XU_LY_LECH, "xử lý chênh lệch");
        kiemTraQuyenXuLyChenhLech(user, phieu);
        String phuongAn = yeuCau == null ? null : chuoiHoacNull(yeuCau.getPhuongAn());
        if (!IChuyenKho.GHI_GIAM_HAO_HUT.equals(phuongAn) && !IChuyenKho.GIAO_BU_HANG.equals(phuongAn)) {
            throw new CommonException("Chọn phương án: Ghi giảm hao hụt / Đền bù hoặc Giao bù hàng");
        }
        String lyDo = batBuoc(yeuCau.getLyDo(), "Nhập lý do xử lý chênh lệch");
        BienBanGiaoNhan bb = bienBanGiaoNhanRepository.findFirstByPhieuChuyenKho_IdOrderByIdDesc(id)
                .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT, "Phiếu chưa có biên bản giao nhận"));
        if (!IChuyenKho.CHUA_XU_LY.equals(bb.getPhuongAnXuLy())) {
            throw new CommonException(HttpStatus.CONFLICT, "Biên bản " + bb.getSoBienBan() + " đã được xử lý");
        }
        List<ChiTietBienBanGiaoNhan> dongBb = chiTietBienBanGiaoNhanRepository.findByBienBan_IdOrderByIdAsc(bb.getId());
        NguoiDung quanLy = nguoiDungRepository.findById(user.getId()).orElseThrow();
        Kho trungChuyen = khoTrungChuyen();

        // Kiểm phần còn đi đường của chính phiếu này theo lô (kho trung chuyển dùng chung cho mọi phiếu)
        List<DongLo> daXuatTheoLo = hangDaXuatTheoLo(id);
        Map<String, BigDecimal> conTrenDuong = conTrenDuongTheoLo(id, daXuatTheoLo);
        // Giá vốn ghi giảm = giá vốn lúc xuất của lô (cùng giá với phiếu nhập PN-TRF), không lấy giá lô hiện tại
        Map<String, BigDecimal> giaVonXuat = new HashMap<>();
        daXuatTheoLo.forEach(d -> giaVonXuat.put(khoaLo(d.bienThe().getId(), d.lo().getId()), d.giaVon()));
        List<Integer> loIds = dongBb.stream().map(ct -> ct.getLoHang().getId()).distinct().toList();
        // Khóa dòng trung chuyển của các lô; Giao bù khóa thêm dòng tồn kho nguồn của các mã lệch (giữ chỗ mới, như tao:
        // bán POS / tạo phiếu chuyển cùng lúc trên các mã đó chạy lần lượt). Gộp rồi khóa một lần theo PK tăng dần, cùng
        // thứ tự với xuất / nhập chuyển kho (khóa kho nguồn sau dòng trung chuyển là ngược thứ tự → kẹt khóa chéo).
        List<Integer> idsCanKhoa = new ArrayList<>(tonKhoTheoLoRepository.findIdsByKhoAndLots(trungChuyen.getId(), loIds));
        if (IChuyenKho.GIAO_BU_HANG.equals(phuongAn)) {
            List<Integer> maLech = dongBb.stream().filter(ct -> ct.getSoLuongGui() - ct.getSoLuongNhan() > 0)
                    .map(ct -> ct.getBienTheSanPham().getId()).distinct().toList();
            if (!maLech.isEmpty()) {
                idsCanKhoa.addAll(tonKhoTheoLoRepository.findIdsByKhoAndVariants(phieu.getKhoXuat().getId(), maLech));
            }
        }
        if (!idsCanKhoa.isEmpty()) {
            tonKhoTheoLoRepository.lockLotsForUpdateByIds(idsCanKhoa.stream().distinct().sorted().toList());
        }

        String tienTo = IChuyenKho.TIEN_TO_DIEU_CHINH + ngayHomNay() + "-";
        PhieuDieuChinhKho dck = new PhieuDieuChinhKho();
        dck.setSoPhieu(SoChungTu.tiepTheoBaChuSo(tienTo, phieuDieuChinhKhoRepository.soDuoiLonNhat(tienTo)));
        dck.setNguon("chuyen_kho");
        dck.setPhieuChuyenKho(phieu);
        dck.setBienBanGiaoNhan(bb);
        dck.setKho(trungChuyen);
        dck.setLoaiDieuChinh("giam");
        dck.setNgayDieuChinh(Instant.now());
        dck.setTrangThai(2); // Đã áp dụng: duyệt xử lý chênh lệch chính là duyệt phiếu
        dck.setLyDo(lyDo);
        dck.setNguoiLap(quanLy);
        dck.setNguoiDuyet(quanLy);
        dck.setNgayDuyet(Instant.now());
        dck.setGhiChu((IChuyenKho.GIAO_BU_HANG.equals(phuongAn) ? "Giao bù" : "Ghi giảm hao hụt / Đền bù")
                + " theo biên bản " + bb.getSoBienBan() + " của phiếu chuyển " + phieu.getSoPhieuChuyen());
        dck.setTongGiaTriTang(BigDecimal.ZERO);
        dck = phieuDieuChinhKhoRepository.save(dck);

        BigDecimal tongGiam = BigDecimal.ZERO;
        Map<Integer, Integer> lechTheoBienThe = new LinkedHashMap<>();
        Map<Integer, BienTheSanPham> bienThe = new HashMap<>();
        Set<Integer> sanPhamIds = new HashSet<>();
        for (ChiTietBienBanGiaoNhan ct : dongBb) {
            int sl = ct.getSoLuongGui() - ct.getSoLuongNhan();
            if (sl <= 0) continue;
            BigDecimal soLuong = BigDecimal.valueOf(sl);
            String khoa = khoaLo(ct.getBienTheSanPham().getId(), ct.getLoHang().getId());
            if (conTrenDuong.getOrDefault(khoa, BigDecimal.ZERO).compareTo(soLuong) < 0) {
                throw new CommonException(HttpStatus.CONFLICT, "Phần đi đường của " + ct.getBienTheSanPham().getMaSku()
                        + " lô " + ct.getLoHang().getMaLo() + " không còn đủ " + sl + " để ghi giảm");
            }
            TonKhoTheoLo ton = tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(trungChuyen.getId(), ct.getLoHang().getId())
                    .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT, "Kho trung chuyển không có lô " + ct.getLoHang().getMaLo()));
            BigDecimal truoc = ton.getSoLuongTon() == null ? BigDecimal.ZERO : ton.getSoLuongTon();
            if (truoc.compareTo(soLuong) < 0) {
                throw new CommonException(HttpStatus.CONFLICT, "Kho trung chuyển không đủ lô " + ct.getLoHang().getMaLo()
                        + " (còn " + hienThi(truoc) + ", cần " + sl + ")");
            }
            ton.setSoLuongTon(truoc.subtract(soLuong));
            ton.setNgayXuatGanNhat(Instant.now());
            tonKhoTheoLoRepository.save(ton);

            BigDecimal giaVon = giaVonXuat.get(khoa) != null ? giaVonXuat.get(khoa)
                    : ct.getLoHang().getGiaVon() != null ? ct.getLoHang().getGiaVon() : BigDecimal.ZERO;
            ChiTietPhieuDieuChinh dong = new ChiTietPhieuDieuChinh();
            dong.setPhieuDieuChinhKho(dck);
            dong.setChiTietBienBan(ct);
            dong.setBienTheSanPham(ct.getBienTheSanPham());
            dong.setLoHang(ct.getLoHang());
            dong.setSoLuongDieuChinh(soLuong.negate());
            dong.setGiaVon(giaVon);
            dong.setThanhTien(giaVon.multiply(soLuong));
            dong.setLoaiDieuChinh("giam");
            dong.setGhiChu(ct.getLyDoHongThieu());
            chiTietPhieuDieuChinhRepository.save(dong);
            tongGiam = tongGiam.add(dong.getThanhTien());

            lichSuGiaoDichKhoRepository.save(LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(Instant.now())
                    .loaiGiaoDich("dieu_chinh")
                    .loaiThamChieu(ITable.phieu_dieu_chinh_kho)
                    .idThamChieu(dck.getId())
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .loHang(ct.getLoHang())
                    .kho(trungChuyen)
                    .soLuong(soLuong.negate())
                    .soLuongTruoc(truoc)
                    .soLuongSau(ton.getSoLuongTon())
                    .giaVon(giaVon)
                    .nguoiDung(quanLy)
                    .ghiChu("Ghi giảm chênh lệch " + dck.getSoPhieu() + " của phiếu chuyển " + phieu.getSoPhieuChuyen())
                    .build());
            lechTheoBienThe.merge(ct.getBienTheSanPham().getId(), sl, Integer::sum);
            bienThe.put(ct.getBienTheSanPham().getId(), ct.getBienTheSanPham());
            if (ct.getBienTheSanPham().getSanPham() != null) sanPhamIds.add(ct.getBienTheSanPham().getSanPham().getId());
        }
        dck.setTongGiaTriGiam(tongGiam);
        dck.setGiaTriChenhLechThuan(tongGiam.negate());
        phieuDieuChinhKhoRepository.save(dck);

        bb.setPhuongAnXuLy(phuongAn);
        bb.setNguoiDuyetXuLy(quanLy);
        bb.setNgayDuyetXuLy(Instant.now());
        bienBanGiaoNhanRepository.save(bb);
        phieu.setTrangThai(IChuyenKho.HOAN_TAT);
        phieuChuyenKhoRepository.save(phieu);

        String ghiChu = dck.getSoPhieu();
        if (IChuyenKho.GIAO_BU_HANG.equals(phuongAn) && !lechTheoBienThe.isEmpty()) {
            kiemTraKhaDung(phieu.getKhoXuat(), lechTheoBienThe, bienThe, null);
            PhieuChuyenKho bu = phieuChuyenKhoRepository.save(PhieuChuyenKho.builder()
                    .soPhieuChuyen(soPhieuMoi())
                    .khoXuat(phieu.getKhoXuat())
                    .khoNhap(phieu.getKhoNhap())
                    .trangThai(IChuyenKho.CHO_DUYET)
                    .phieuGoc(phieu)
                    .ghiChu("Giao bù cho " + phieu.getSoPhieuChuyen() + " theo biên bản " + bb.getSoBienBan())
                    .nguoiTao(quanLy)
                    .build());
            for (Map.Entry<Integer, Integer> e : lechTheoBienThe.entrySet()) {
                chiTietPhieuChuyenKhoRepository.save(ChiTietPhieuChuyenKho.builder()
                        .phieuChuyenKho(bu)
                        .bienTheSanPham(bienThe.get(e.getKey()))
                        .soLuongChuyen(e.getValue())
                        .build());
            }
            ghiNhatKy(bu, IHanhDong.tao_phieu_chuyen, null, IChuyenKho.CHO_DUYET, "Giao bù cho " + phieu.getSoPhieuChuyen(), quanLy);
            thongBaoChuyenKhoService.choDuyet(bu, quanLy);
            ghiChu += ", phiếu giao bù " + bu.getSoPhieuChuyen();
        }
        ghiNhatKy(phieu, IHanhDong.xu_ly_chenh_lech, IChuyenKho.CHO_XU_LY_LECH, IChuyenKho.HOAN_TAT, ghiChu, quanLy);
        sanPhamIds.forEach(sanPhamQuanAoService::recalculatePriceAndStatus);
        return dck;
    }

    // ─────────────────────────────────────────────────────────────
    // ĐỌC: DANH SÁCH (B.6), CHI TIẾT (B.1), PHIẾU ĐIỀU CHỈNH
    // ─────────────────────────────────────────────────────────────

    public static final List<String> TAB = List.of("TAT_CA", "CHO_DUYET", "DANG_VAN_CHUYEN", "TRE_HEN", "CHO_XU_LY_LECH", "THIEU_XKNB");

    @Transactional(readOnly = true)
    public PhieuChuyenKhoDto.DanhSach danhSach(String tab, String tuKhoa, Integer khoXuatId, Integer khoNhapId,
                                              String trangThai, int trang, int soDong) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        // Quản lý Kho tổng, quản trị viên xem toàn mạng lưới (SRS 7.2); người khác xem phiếu có kho đang chọn là một bên
        Integer khoDangChon = laQuanLyKhoTong(user) ? null : SecurityContextHolder.getKhoId();
        if (!laQuanLyKhoTong(user) && khoDangChon == null) {
            throw new CommonException("Chọn kho làm việc để xem phiếu chuyển kho");
        }
        Instant bayGio = Instant.now();
        Function<String, Specification<PhieuChuyenKho>> loc = t -> (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (khoDangChon != null) {
                p.add(cb.or(cb.equal(root.get("khoXuat").get("id"), khoDangChon), cb.equal(root.get("khoNhap").get("id"), khoDangChon)));
            }
            if (tuKhoa != null && !tuKhoa.isBlank()) {
                String k = "%" + tuKhoa.trim().toLowerCase(Locale.ROOT) + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("soPhieuChuyen")), k), cb.like(cb.lower(root.get("soLenhDieuDong")), k)));
            }
            if (khoXuatId != null) p.add(cb.equal(root.get("khoXuat").get("id"), khoXuatId));
            if (khoNhapId != null) p.add(cb.equal(root.get("khoNhap").get("id"), khoNhapId));
            if (trangThai != null && !trangThai.isBlank()) p.add(cb.equal(root.get("trangThai"), trangThai));
            switch (t == null ? "TAT_CA" : t) {
                case "CHO_DUYET" -> p.add(cb.equal(root.get("trangThai"), IChuyenKho.CHO_DUYET));
                case "DANG_VAN_CHUYEN" -> p.add(cb.equal(root.get("trangThai"), IChuyenKho.DANG_VAN_CHUYEN));
                case "TRE_HEN" -> {
                    p.add(cb.equal(root.get("trangThai"), IChuyenKho.DANG_VAN_CHUYEN));
                    p.add(cb.lessThan(root.get("ngayDuKienDen"), bayGio));
                }
                case "CHO_XU_LY_LECH" -> p.add(cb.equal(root.get("trangThai"), IChuyenKho.CHO_XU_LY_LECH));
                case "THIEU_XKNB" -> {
                    // Cùng điều kiện với thieuXknb(): mọi phiếu hàng đã đi mà chưa có số, kể cả đã nhận / đã hủy sau khi xuất
                    p.add(cb.or(cb.isNull(root.get("soPhieuXknb")), cb.equal(root.get("soPhieuXknb"), "")));
                    p.add(cb.or(
                            root.get("trangThai").in(IChuyenKho.DANG_VAN_CHUYEN, IChuyenKho.CHO_XU_LY_LECH),
                            cb.and(root.get("trangThai").in(IChuyenKho.HOAN_TAT, IChuyenKho.DA_HUY),
                                    cb.isNotNull(root.get("nguoiVanChuyen")))));
                }
                default -> { }
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
        // Không gửi tab (List.of không nhận contains(null)) hoặc tab lạ: tab mặc định Tất cả
        String tabChon = tab != null && TAB.contains(tab) ? tab : "TAT_CA";
        Page<PhieuChuyenKho> page = phieuChuyenKhoRepository.findAll(loc.apply(tabChon),
                PageRequest.of(Math.max(trang, 0), Math.min(Math.max(soDong, 1), 100),
                        Sort.by(Sort.Order.desc("ngayTao"), Sort.Order.desc("id"))));
        Map<String, Long> soTheoTab = new LinkedHashMap<>();
        for (String t : TAB) soTheoTab.put(t, phieuChuyenKhoRepository.count(loc.apply(t)));

        List<Integer> ids = page.getContent().stream().map(PhieuChuyenKho::getId).toList();
        Map<Integer, Integer> tongSl = new HashMap<>();
        Set<Integer> coChenhLech = new HashSet<>();
        if (!ids.isEmpty()) {
            for (Object[] row : chiTietPhieuChuyenKhoRepository.tongSoLuongTheoPhieu(ids)) {
                tongSl.put((Integer) row[0], ((Number) row[1]).intValue());
            }
            for (BienBanGiaoNhan bb : bienBanGiaoNhanRepository.findByPhieuChuyenKho_IdIn(ids)) {
                if (IChuyenKho.GHI_GIAM_HAO_HUT.equals(bb.getPhuongAnXuLy())) coChenhLech.add(bb.getPhieuChuyenKho().getId());
            }
        }
        List<PhieuChuyenKhoDto.DongDanhSach> dong = page.getContent().stream().map(p -> PhieuChuyenKhoDto.DongDanhSach.builder()
                .id(p.getId())
                .soPhieuChuyen(p.getSoPhieuChuyen())
                .ngayTao(p.getNgayTao())
                .khoXuatId(p.getKhoXuat().getId())
                .khoXuatTen(p.getKhoXuat().getTenKho())
                .khoNhapId(p.getKhoNhap().getId())
                .khoNhapTen(p.getKhoNhap().getTenKho())
                .trangThai(p.getTrangThai())
                .coChenhLech(IChuyenKho.HOAN_TAT.equals(p.getTrangThai()) && coChenhLech.contains(p.getId()))
                .soLenhDieuDong(p.getSoLenhDieuDong())
                .kyHieuXknb(p.getKyHieuXknb())
                .soPhieuXknb(p.getSoPhieuXknb())
                .ngayDuKienDen(p.getNgayDuKienDen())
                .ngayThucTeDen(p.getNgayThucTeDen())
                .tongSoLuong(tongSl.getOrDefault(p.getId(), 0))
                .tre(laTre(p, bayGio))
                .thieuXknb(thieuXknb(p))
                .phieuGocId(p.getPhieuGoc() != null ? p.getPhieuGoc().getId() : null)
                .soPhieuGoc(p.getPhieuGoc() != null ? p.getPhieuGoc().getSoPhieuChuyen() : null)
                .build()).toList();
        return PhieuChuyenKhoDto.DanhSach.builder()
                .content(dong)
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .page(page.getNumber())
                .size(page.getSize())
                .soTheoTab(soTheoTab)
                .build();
    }

    @Transactional(readOnly = true)
    public PhieuChuyenKhoDto.ChiTiet chiTiet(Integer id) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuChuyenKho p = phieuChuyenKhoRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu chuyển kho id: " + id));
        if (!laQuanLyKhoTong(user)) {
            KhoDangChon.kiemTraXemMotTrong(p.getKhoXuat(), p.getKhoNhap(), "Phiếu chuyển " + p.getSoPhieuChuyen());
        }
        List<ChiTietPhieuChuyenKho> dong = chiTietPhieuChuyenKhoRepository.findByPhieuChuyenKho_IdOrderByIdAsc(id);
        List<PhieuXuatKho> dsPx = phieuXuatKhoRepository.findByPhieuChuyenKho_IdOrderByIdDesc(id);
        PhieuXuatKho px = dsPx.stream().filter(x -> !Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(x.getTrangThai()))
                .findFirst().orElse(dsPx.isEmpty() ? null : dsPx.get(0));
        List<PhieuNhapKho> dsPn = phieuNhapKhoRepository.findByPhieuChuyenKho_IdOrderByIdAsc(id);
        Optional<BienBanGiaoNhan> bb = bienBanGiaoNhanRepository.findFirstByPhieuChuyenKho_IdOrderByIdDesc(id);
        Optional<PhieuDieuChinhKho> dck = bb.flatMap(b -> phieuDieuChinhKhoRepository.findFirstByBienBanGiaoNhan_Id(b.getId()));

        // Phiếu nhặt của PX-CK (đặc tả bước 8–9); không có = phiếu chưa mở phiếu nhặt hoặc phiếu cũ chọn lô tay
        DanhSachNhatHang phieuNhat = px == null ? null : danhSachNhatHangRepository.findByPhieuXuatKho_Id(px.getId()).orElse(null);
        boolean phieuNhatMo = phieuNhat != null
                && ("cho_nhat".equals(phieuNhat.getTrangThai()) || "dang_nhat".equals(phieuNhat.getTrangThai()));

        // Số theo biến thể: đã nhặt (phiếu nhặt đang mở: số đã quét; sau đó: lô trên phiếu xuất nháp), đã xuất, đã nhận
        // (PN-TRF hoàn tất), hỏng, còn trên đường
        Map<Integer, BigDecimal> daNhat = new HashMap<>(), daXuatMap = new HashMap<>(), daNhan = new HashMap<>(),
                hong = new HashMap<>(), ghiGiam = new HashMap<>(), hoanTra = new HashMap<>();
        boolean coLoTrenPhieuXuat = false;
        if (px != null && !Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(px.getTrangThai())) {
            Map<Integer, BigDecimal> dich = Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(px.getTrangThai()) ? daXuatMap : daNhat;
            for (ChiTietPhieuXuatKho c : chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(px.getId())) {
                dich.merge(c.getBienTheSanPham().getId(), c.getSoLuongXuat(), BigDecimal::add);
                coLoTrenPhieuXuat = true;
            }
        }
        if (phieuNhatMo && phieuNhat.getChiTietNhatHangs() != null) {
            daNhat.clear();
            for (ChiTietNhatHang c : phieuNhat.getChiTietNhatHangs()) {
                if (c.getSoLuongDaQuet() != null) daNhat.merge(c.getBienTheSanPham().getId(), c.getSoLuongDaQuet(), BigDecimal::add);
            }
        }
        // Được xác nhận xuất: phiếu nhặt đã hoàn tất VÀ PX-CK đã đủ lô (tổng lô theo biến thể = số chuyển; phiếu nhặt đã
        // nhặt mà lô PX-CK thiếu là dữ liệu lệch, xuất sẽ bị chặn), hoặc phiếu cũ không có phiếu nhặt đã chọn đủ lô tay
        boolean daNhatXong = phieuNhat != null
                ? "da_nhat".equals(phieuNhat.getTrangThai()) && coLoTrenPhieuXuat
                        && dong.stream().allMatch(ct -> daNhat.getOrDefault(ct.getBienTheSanPham().getId(), BigDecimal.ZERO)
                                .compareTo(BigDecimal.valueOf(ct.getSoLuongChuyen())) == 0)
                : coLoTrenPhieuXuat && dong.stream().allMatch(ct -> daNhat.getOrDefault(ct.getBienTheSanPham().getId(), BigDecimal.ZERO)
                        .compareTo(BigDecimal.valueOf(ct.getSoLuongChuyen())) >= 0);
        boolean coHoanTra = false;
        for (PhieuNhapKho pn : dsPn) {
            if (!Integer.valueOf(TrangThaiPhieuNhap.COMPLETED.getValue()).equals(pn.getTrangThai())) continue;
            boolean laHoanTra = pn.getKho().getId().equals(p.getKhoXuat().getId());
            coHoanTra |= laHoanTra;
            for (ChiTietPhieuNhapKho c : chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(pn.getId())) {
                (laHoanTra ? hoanTra : daNhan).merge(c.getBienTheSanPham().getId(), c.getSoLuongNhap(), BigDecimal::add);
            }
        }
        List<ChiTietBienBanGiaoNhan> dongBb = bb.map(b -> chiTietBienBanGiaoNhanRepository.findByBienBan_IdOrderByIdAsc(b.getId())).orElse(List.of());
        dongBb.forEach(c -> hong.merge(c.getBienTheSanPham().getId(), BigDecimal.valueOf(c.getSoLuongHong()), BigDecimal::add));
        dck.ifPresent(d -> chiTietPhieuDieuChinhRepository.findByPhieuDieuChinhKho_IdOrderByIdAsc(d.getId())
                .forEach(c -> ghiGiam.merge(c.getBienTheSanPham().getId(), c.getSoLuongDieuChinh().abs(), BigDecimal::add)));

        List<PhieuChuyenKhoDto.DongHang> hang = dong.stream().map(ct -> {
            BienTheSanPham bt = ct.getBienTheSanPham();
            Integer btId = bt.getId();
            BigDecimal xuat = daXuatMap.getOrDefault(btId, BigDecimal.ZERO);
            BigDecimal con = xuat.subtract(daNhan.getOrDefault(btId, BigDecimal.ZERO))
                    .subtract(ghiGiam.getOrDefault(btId, BigDecimal.ZERO))
                    .subtract(hoanTra.getOrDefault(btId, BigDecimal.ZERO)).max(BigDecimal.ZERO);
            return PhieuChuyenKhoDto.DongHang.builder()
                    .bienTheId(btId)
                    .sanPhamId(HienThiBienThe.sanPhamId(bt))
                    .sku(bt.getMaSku())
                    .tenSanPham(HienThiBienThe.tenSanPham(bt))
                    .tenMau(HienThiBienThe.tenMau(bt))
                    .maMauHex(HienThiBienThe.maMauHex(bt))
                    .kichCo(HienThiBienThe.kichCo(bt))
                    .anh(HienThiBienThe.anh(bt))
                    .donViTinh(bt.getSanPham() != null ? bt.getSanPham().getDonViTinh() : null)
                    .soLuongChuyen(ct.getSoLuongChuyen())
                    .daNhat(daNhat.getOrDefault(btId, BigDecimal.ZERO))
                    .daXuat(xuat)
                    .daNhan(daNhan.getOrDefault(btId, BigDecimal.ZERO))
                    .hong(hong.getOrDefault(btId, BigDecimal.ZERO))
                    .conTrenDuong(con)
                    .build();
        }).toList();

        List<PhieuChuyenKhoDto.DongLo> hangTheoLo = hangDaXuatTheoLo(id).stream().map(d -> {
            BienTheSanPham bt = d.bienThe();
            return PhieuChuyenKhoDto.DongLo.builder()
                    .bienTheId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenSanPham(HienThiBienThe.tenSanPham(bt))
                    .tenMau(HienThiBienThe.tenMau(bt))
                    .maMauHex(HienThiBienThe.maMauHex(bt))
                    .kichCo(HienThiBienThe.kichCo(bt))
                    .anh(HienThiBienThe.anh(bt))
                    .maVach(bt.getMaVachSku())
                    .loHangId(d.lo().getId())
                    .maLo(d.lo().getMaLo())
                    .soLuong(d.soLuong())
                    .giaVon(d.giaVon())
                    .build();
        }).toList();

        Instant bayGio = Instant.now();
        boolean daXuatHang = px != null && Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(px.getTrangThai());
        boolean huyKhiDangChuyen = IChuyenKho.DA_HUY.equals(p.getTrangThai()) && daXuatHang;
        String cheDoXuLyLech = cheDoXuLyLech();
        PhieuChuyenKhoDto.BienBan bienBan = bb.map(b -> bienBanDto(b, dongBb)).orElse(null);
        if (bienBan != null) bienBan.setAnh(anhBienBanGiaoNhanService.danhSach(bb.get(), p, user));
        return PhieuChuyenKhoDto.ChiTiet.builder()
                .id(p.getId())
                .soPhieuChuyen(p.getSoPhieuChuyen())
                .trangThai(p.getTrangThai())
                .coChenhLech(bb.map(b -> IChuyenKho.GHI_GIAM_HAO_HUT.equals(b.getPhuongAnXuLy())).orElse(false))
                .ngayTao(p.getNgayTao())
                .khoXuat(khoTomTat(p.getKhoXuat()))
                .khoNhap(khoTomTat(p.getKhoNhap()))
                .nguoiTao(ten(p.getNguoiTao()))
                .ghiChu(p.getGhiChu())
                .soLenhDieuDong(p.getSoLenhDieuDong())
                .ngayLenhDieuDong(p.getNgayLenhDieuDong())
                .nguoiRaLenh(ten(p.getNguoiRaLenh()))
                .lyDoDieuDong(p.getLyDoDieuDong())
                .ghiChuLenh(p.getGhiChuLenh())
                .hinhThucVanChuyen(daXuatHang ? p.getHinhThucVanChuyen() : null)
                .nguoiVanChuyen(p.getNguoiVanChuyen())
                .soDienThoaiVanChuyen(p.getSoDienThoaiVanChuyen())
                .loaiPhuongTien(p.getLoaiPhuongTien())
                .bienSoXe(p.getBienSoXe())
                .donViVanChuyen(p.getDonViVanChuyen())
                .maVanDonHopDong(p.getMaVanDonHopDong())
                .ngayDuKienDen(p.getNgayDuKienDen())
                .ngayThucTeDen(p.getNgayThucTeDen())
                .tre(laTre(p, bayGio))
                .kyHieuXknb(p.getKyHieuXknb())
                .soPhieuXknb(p.getSoPhieuXknb())
                .ngayLapXknb(p.getNgayLapXknb())
                .maTraCuuXknb(p.getMaTraCuuXknb())
                .nguoiHuy(ten(p.getNguoiHuy()))
                .lyDoHuy(p.getLyDoHuy())
                .ngayHuy(p.getNgayHuy())
                .huyKhiDangChuyen(huyKhiDangChuyen)
                .daNhapHoanTra(coHoanTra)
                .phieuGoc(p.getPhieuGoc() == null ? null : chungTu(p.getPhieuGoc()))
                .phieuGiaoBu(phieuChuyenKhoRepository.findByPhieuGoc_Id(id).stream().map(this::chungTu).toList())
                .phieuXuat(px == null ? null : PhieuChuyenKhoDto.ChungTu.builder()
                        .id(px.getId()).so(px.getSoPhieuXuat()).trangThai(String.valueOf(px.getTrangThai()))
                        .ngay(px.getNgayXuat()).nguoi(ten(px.getNguoiXuat())).build())
                .phieuNhat(phieuNhat == null ? null : PhieuChuyenKhoDto.ChungTu.builder()
                        .id(phieuNhat.getId()).so(phieuNhat.getMaPickList()).trangThai(phieuNhat.getTrangThai())
                        .ngay(phieuNhat.getNgayHoanTat() != null ? phieuNhat.getNgayHoanTat() : phieuNhat.getNgayTao())
                        .nguoi(ten(phieuNhat.getNguoiNhat())).build())
                .daNhatXong(daNhatXong)
                .chonLoTay(phieuNhat == null && coLoTrenPhieuXuat)
                .phieuNhap(dsPn.stream().map(pn -> PhieuChuyenKhoDto.ChungTu.builder()
                        .id(pn.getId()).so(pn.getSoPhieuNhap()).trangThai(String.valueOf(pn.getTrangThai()))
                        .ngay(pn.getNgayNhap()).nguoi(ten(pn.getNguoiNhap()))
                        .laHoanTra(pn.getKho().getId().equals(p.getKhoXuat().getId())).build()).toList())
                .bienBan(bienBan)
                .phieuDieuChinh(dck.map(d -> PhieuChuyenKhoDto.ChungTu.builder()
                        .id(d.getId()).so(d.getSoPhieu()).trangThai(String.valueOf(d.getTrangThai())).ngay(d.getNgayDieuChinh()).build()).orElse(null))
                .hang(hang)
                .hangTheoLo(hangTheoLo)
                .xknbKyHieuMacDinh(dieuHanhHeThongService.getCauHinhString(DieuHanhHeThongServiceImpl.CAU_HINH_XKNB_KY_HIEU, ""))
                .xknbCheDo(dieuHanhHeThongService.getCauHinhString(DieuHanhHeThongServiceImpl.CAU_HINH_XKNB_CHE_DO, IChuyenKho.XKNB_CHI_CANH_BAO))
                .aiXuLyChenhLech(moTaNguoiXuLyChenhLech(p, cheDoXuLyLech))
                .quyen(quyen(user, p, px, huyKhiDangChuyen && !coHoanTra, cheDoXuLyLech, bb.orElse(null)))
                .build();
    }

    /** Phiếu điều chỉnh kho (ghi giảm chênh lệch chuyển kho): đầu phiếu, dòng hàng, dòng sổ kho ghi kèm. */
    @Transactional(readOnly = true)
    public PhieuChuyenKhoDto.PhieuDieuChinh phieuDieuChinh(Integer id) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        PhieuDieuChinhKho d = phieuDieuChinhKhoRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu điều chỉnh kho id: " + id));
        PhieuChuyenKho p = d.getPhieuChuyenKho();
        if (p == null) throw new CommonException(HttpStatus.NOT_FOUND, "Phiếu điều chỉnh kiểm kê xem ở màn Kiểm kê");
        if (!laQuanLyKhoTong(user)) {
            KhoDangChon.kiemTraXemMotTrong(p.getKhoXuat(), p.getKhoNhap(), "Phiếu điều chỉnh " + d.getSoPhieu());
        }
        BienBanGiaoNhan bb = d.getBienBanGiaoNhan();
        List<PhieuChuyenKhoDto.DongDieuChinh> dong = chiTietPhieuDieuChinhRepository.findByPhieuDieuChinhKho_IdOrderByIdAsc(id).stream()
                .map(c -> {
                    BienTheSanPham bt = c.getBienTheSanPham();
                    ChiTietBienBanGiaoNhan ctbb = c.getChiTietBienBan();
                    return PhieuChuyenKhoDto.DongDieuChinh.builder()
                            .bienTheId(bt.getId())
                            .sku(bt.getMaSku())
                            .tenSanPham(HienThiBienThe.tenSanPham(bt))
                            .tenMau(HienThiBienThe.tenMau(bt))
                            .maMauHex(HienThiBienThe.maMauHex(bt))
                            .kichCo(HienThiBienThe.kichCo(bt))
                            .donViTinh(bt.getSanPham() != null ? bt.getSanPham().getDonViTinh() : null)
                            .maLo(c.getLoHang().getMaLo())
                            .soLuong(c.getSoLuongDieuChinh().abs())
                            .giaVon(c.getGiaVon())
                            .thanhTien(c.getThanhTien())
                            .thieu(ctbb != null ? ctbb.getSoLuongThieu() : null)
                            .hong(ctbb != null ? ctbb.getSoLuongHong() : null)
                            .lyDo(c.getGhiChu())
                            .build();
                }).toList();
        List<PhieuChuyenKhoDto.DongSoKho> soKho = lichSuGiaoDichKhoRepository
                .findByLoaiThamChieuAndIdThamChieuOrderByIdAsc(ITable.phieu_dieu_chinh_kho, id).stream()
                .map(ls -> PhieuChuyenKhoDto.DongSoKho.builder()
                        .kho(ls.getKho().getTenKho())
                        .sku(ls.getBienTheSanPham().getMaSku())
                        .maLo(ls.getLoHang().getMaLo())
                        .loai(ls.getLoaiGiaoDich())
                        .soLuong(ls.getSoLuong())
                        .truoc(ls.getSoLuongTruoc())
                        .sau(ls.getSoLuongSau())
                        .ngay(ls.getNgayGiaoDich())
                        .build()).toList();
        PhieuChuyenKho bu = IChuyenKho.GIAO_BU_HANG.equals(bb != null ? bb.getPhuongAnXuLy() : null)
                ? phieuChuyenKhoRepository.findByPhieuGoc_Id(p.getId()).stream().findFirst().orElse(null) : null;
        return PhieuChuyenKhoDto.PhieuDieuChinh.builder()
                .id(d.getId())
                .soPhieu(d.getSoPhieu())
                .nguon(d.getNguon())
                .kho(d.getKho().getTenKho())
                .loaiDieuChinh(d.getLoaiDieuChinh())
                .ngayDieuChinh(d.getNgayDieuChinh())
                .trangThai(d.getTrangThai())
                .tongGiaTriGiam(d.getTongGiaTriGiam())
                .lyDo(d.getLyDo())
                .nguoiLap(ten(d.getNguoiLap()))
                .nguoiDuyet(ten(d.getNguoiDuyet()))
                .ngayDuyet(d.getNgayDuyet())
                .phieuChuyen(chungTu(p))
                .khoXuatTen(p.getKhoXuat().getTenKho())
                .khoNhapTen(p.getKhoNhap().getTenKho())
                .soLenhDieuDong(p.getSoLenhDieuDong())
                .bienBan(bb == null ? null : PhieuChuyenKhoDto.ChungTu.builder().id(bb.getId()).so(bb.getSoBienBan()).ngay(bb.getNgayLap()).build())
                .phuongAn(bb != null ? bb.getPhuongAnXuLy() : null)
                .phieuGiaoBu(bu == null ? null : chungTu(bu))
                .dong(dong)
                .soKho(soKho)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // QUYỀN THEO VAI TRÒ (đặc tả BA, bảng phân quyền SRS)
    // ─────────────────────────────────────────────────────────────

    private PhieuChuyenKhoDto.Quyen quyen(NguoiDungAuthInfo user, PhieuChuyenKho p, PhieuXuatKho px, boolean conHoanTra,
                                          String cheDoXuLyLech, BienBanGiaoNhan bb) {
        String tt = p.getTrangThai();
        boolean laKhoXuat = laQuanTri(user) || thuocKho(user, p.getKhoXuat());
        boolean laKhoNhap = laQuanTri(user) || thuocKho(user, p.getKhoNhap());
        return PhieuChuyenKhoDto.Quyen.builder()
                .duyet(IChuyenKho.CHO_DUYET.equals(tt) && laQuanLyKhoTong(user))
                .huy(duocHuy(user, p) && (IChuyenKho.CHO_DUYET.equals(tt) || IChuyenKho.DA_DUYET.equals(tt) || IChuyenKho.DANG_VAN_CHUYEN.equals(tt)))
                .nhat(IChuyenKho.DA_DUYET.equals(tt) && laKhoXuat)
                .xuat(IChuyenKho.DA_DUYET.equals(tt) && laKhoXuat)
                .ghiSoXknb(thieuXknb(p) && laKhoXuat)
                .nhan(IChuyenKho.DANG_VAN_CHUYEN.equals(tt) && laKhoNhap)
                .xuLyChenhLech(IChuyenKho.CHO_XU_LY_LECH.equals(tt) && duocXuLyChenhLech(user, p, cheDoXuLyLech))
                .nhapHoanTra(conHoanTra && laKhoXuat)
                .themAnhBienBan(anhBienBanGiaoNhanService.duocThem(user, p, bb))
                .build();
    }

    /** Quản lý Kho tổng, quản trị viên: mọi trạng thái hủy được; kho nhận (quản lý, người tạo) hủy khi chưa xuất. */
    private boolean duocHuy(NguoiDungAuthInfo user, PhieuChuyenKho p) {
        if (laQuanLyKhoTong(user)) return true;
        if (IChuyenKho.DANG_VAN_CHUYEN.equals(p.getTrangThai())) return false;
        boolean laNguoiTao = p.getNguoiTao() != null && p.getNguoiTao().getId().equals(user.getId());
        return thuocKho(user, p.getKhoNhap())
                && (laNguoiTao || (user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_ly_kho)));
    }

    private static boolean laQuanTri(NguoiDungAuthInfo user) {
        return user != null && user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien);
    }

    /** Quản trị viên, hoặc quản lý kho đang được phân công ở một Kho tổng. */
    private boolean laQuanLyKhoTong(NguoiDungAuthInfo user) {
        if (laQuanTri(user)) return true;
        if (user == null || user.getVaiTro() == null || !user.getVaiTro().contains(IRoleType.quan_ly_kho)) return false;
        return phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndActive(user.getId()).stream()
                .anyMatch(pq -> KhoService.laKhoTong(pq.getKho()));
    }

    private boolean thuocKho(NguoiDungAuthInfo user, Kho kho) {
        if (user == null || kho == null) return false;
        if (laQuanTri(user)) return true;
        return phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndActive(user.getId()).stream()
                .anyMatch(pq -> pq.getKho() != null && kho.getId().equals(pq.getKho().getId()));
    }

    // ─────────────────────────────────────────────────────────────
    // AI ĐƯỢC XỬ LÝ CHÊNH LỆCH (Cấu hình › Chuyển kho: CHUYEN_KHO_QUYEN_XU_LY_LECH, mockup B.5)
    // Kiểm quyền, cờ quyen.xuLyChenhLech và câu mô tả cùng đọc ở đây; phần thông báo sau này tìm người nhận theo cùng luật.
    // ─────────────────────────────────────────────────────────────

    /** Cách chọn người xử lý chênh lệch đang đặt; thiếu hoặc giá trị lạ (sửa tay CSDL) thì theo mặc định Quản lý Kho tổng. */
    public String cheDoXuLyLech() {
        String cheDo = dieuHanhHeThongService.getCauHinhString(
                DieuHanhHeThongServiceImpl.CAU_HINH_CHUYEN_KHO_QUYEN_XU_LY_LECH, IChuyenKho.XU_LY_LECH_QL_KHO_TONG);
        return cheDo != null && IChuyenKho.QUYEN_XU_LY_LECH.contains(cheDo) ? cheDo : IChuyenKho.XU_LY_LECH_QL_KHO_TONG;
    }

    /**
     * Người dùng có được xử lý chênh lệch của phiếu không. Quản trị viên luôn được; QL_KHO_TONG (mặc định) thêm Quản lý Kho
     * tổng; QL_KHO_TONG_VA_KHO_XUAT thêm quản lý kho được phân công ở kho xuất của chính phiếu; CHI_QUAN_TRI chỉ quản trị
     * viên. Người lập biên bản không bị loại (có quyền thì tự duyệt được). Kho đang chọn kiểm riêng khi bấm
     * ({@link #kiemTraQuyenXuLyChenhLech}).
     */
    public boolean duocXuLyChenhLech(NguoiDungAuthInfo user, PhieuChuyenKho p) {
        return duocXuLyChenhLech(user, p, cheDoXuLyLech());
    }

    private boolean duocXuLyChenhLech(NguoiDungAuthInfo user, PhieuChuyenKho p, String cheDo) {
        if (laQuanTri(user)) return true;
        if (IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI.equals(cheDo)) return false;
        if (laQuanLyKhoTong(user)) return true;
        return IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT.equals(cheDo) && laQuanLyKho(user, p.getKhoXuat());
    }

    /**
     * Ai được xử lý chênh lệch của phiếu, viết thành câu cho giao diện và câu báo lỗi: "Quản trị viên hoặc Quản lý Kho
     * tổng", "Quản trị viên, Quản lý Kho tổng hoặc quản lý Cửa hàng 1", "Quản trị viên".
     */
    public String moTaNguoiXuLyChenhLech(PhieuChuyenKho p) {
        return moTaNguoiXuLyChenhLech(p, cheDoXuLyLech());
    }

    private static String moTaNguoiXuLyChenhLech(PhieuChuyenKho p, String cheDo) {
        if (IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI.equals(cheDo)) return "Quản trị viên";
        // Kho xuất là Kho tổng thì quản lý kho xuất chính là Quản lý Kho tổng: không kể hai lần
        if (IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT.equals(cheDo) && p.getKhoXuat() != null && !KhoService.laKhoTong(p.getKhoXuat())) {
            return "Quản trị viên, Quản lý Kho tổng hoặc quản lý " + p.getKhoXuat().getTenKho();
        }
        return "Quản trị viên hoặc Quản lý Kho tổng";
    }

    /**
     * Chặn khi bấm Xử lý chênh lệch: không được theo cấu hình → 403 nêu ai được làm. Quản lý kho xuất (không phải Quản lý
     * Kho tổng) phải đang chọn đúng kho xuất, như các bước ghi khác của kho xuất (xác nhận xuất, nhập hoàn trả).
     */
    private void kiemTraQuyenXuLyChenhLech(NguoiDungAuthInfo user, PhieuChuyenKho p) {
        String cheDo = cheDoXuLyLech();
        if (!duocXuLyChenhLech(user, p, cheDo)) {
            throw new CommonException(HttpStatus.FORBIDDEN,
                    "Chỉ " + moTaNguoiXuLyChenhLech(p, cheDo) + " xử lý được chênh lệch của phiếu này");
        }
        if (!laQuanLyKhoTong(user)) {
            KhoDangChon.kiemTra(p.getKhoXuat(), "Phiếu chuyển " + p.getSoPhieuChuyen());
        }
    }

    /** Quản lý kho (vai trò quan_ly_kho) đang được phân công ở kho này. */
    private boolean laQuanLyKho(NguoiDungAuthInfo user, Kho kho) {
        return user != null && user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_ly_kho) && thuocKho(user, kho);
    }

    // ─────────────────────────────────────────────────────────────
    // TỒN KHO
    // ─────────────────────────────────────────────────────────────

    private void kiemTraKhaDung(Kho khoXuat, Map<Integer, Integer> soLuong, Map<Integer, BienTheSanPham> bienThe, Integer boQuaPhieuId) {
        Map<Integer, KhaDungChuyen> khaDung = khaDungChuyenKhoService.theoBienThe(khoXuat.getId(), soLuong.keySet(), boQuaPhieuId);
        for (Map.Entry<Integer, Integer> e : soLuong.entrySet()) {
            if (e.getValue() == null || e.getValue() <= 0) {
                throw new CommonException("Số lượng chuyển của [" + bienThe.get(e.getKey()).getMaSku()
                        + "] phải lớn hơn 0. Hủy phiếu này rồi lập yêu cầu mới.");
            }
            KhaDungChuyen kd = khaDung.get(e.getKey());
            BigDecimal can = BigDecimal.valueOf(e.getValue());
            if (kd == null || kd.khaDung().compareTo(can) < 0) {
                BigDecimal co = kd == null ? BigDecimal.ZERO : kd.khaDung();
                StringBuilder chiTiet = new StringBuilder();
                if (kd != null && kd.choXuat().signum() > 0) chiTiet.append(", đơn bán chờ xuất ").append(hienThi(kd.choXuat()));
                if (kd != null && kd.giuChoChuyen().signum() > 0) chiTiet.append(", phiếu chuyển khác đang giữ ").append(hienThi(kd.giuChoChuyen()));
                throw new CommonException(HttpStatus.CONFLICT, "Sản phẩm [" + bienThe.get(e.getKey()).getMaSku() + "] chỉ còn "
                        + hienThi(co) + " có thể chuyển tại " + khoXuat.getTenKho()
                        + (chiTiet.length() > 0 ? " (" + chiTiet.substring(2) + ")" : "") + ". Yêu cầu: " + e.getValue() + ".");
            }
        }
    }

    private record DongLo(BienTheSanPham bienThe, LoHang lo, BigDecimal soLuong, BigDecimal giaVon) {}

    private record DongNhap(BienTheSanPham bienThe, LoHang lo, BigDecimal soLuong, BigDecimal giaVon) {}

    /** Hàng đã xuất của phiếu theo (biến thể, lô): dòng lô của phiếu xuất con đã xuất. */
    private List<DongLo> hangDaXuatTheoLo(Integer phieuChuyenId) {
        Map<String, DongLo> gop = new LinkedHashMap<>();
        for (PhieuXuatKho px : phieuXuatKhoRepository.findByPhieuChuyenKho_IdOrderByIdDesc(phieuChuyenId)) {
            if (!Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(px.getTrangThai())) continue;
            for (ChiTietPhieuXuatKho c : chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(px.getId())) {
                String k = khoaLo(c.getBienTheSanPham().getId(), c.getLoHang().getId());
                BigDecimal giaVon = c.getGiaVon() != null ? c.getGiaVon() : (c.getLoHang().getGiaVon() != null ? c.getLoHang().getGiaVon() : BigDecimal.ZERO);
                gop.merge(k, new DongLo(c.getBienTheSanPham(), c.getLoHang(), c.getSoLuongXuat(), giaVon),
                        (a, b) -> new DongLo(a.bienThe(), a.lo(), a.soLuong().add(b.soLuong()), a.giaVon()));
            }
        }
        return new ArrayList<>(gop.values());
    }

    /** Phần còn đi đường của phiếu theo lô: đã xuất − đã nhận / nhập hoàn trả (phiếu nhập hoàn tất) − đã ghi giảm. */
    private Map<String, BigDecimal> conTrenDuongTheoLo(Integer phieuChuyenId, List<DongLo> daXuat) {
        Map<String, BigDecimal> con = new HashMap<>();
        daXuat.forEach(d -> con.merge(khoaLo(d.bienThe().getId(), d.lo().getId()), d.soLuong(), BigDecimal::add));
        for (PhieuNhapKho pn : phieuNhapKhoRepository.findByPhieuChuyenKho_IdOrderByIdAsc(phieuChuyenId)) {
            if (!Integer.valueOf(TrangThaiPhieuNhap.COMPLETED.getValue()).equals(pn.getTrangThai())) continue;
            for (ChiTietPhieuNhapKho c : chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(pn.getId())) {
                con.merge(khoaLo(c.getBienTheSanPham().getId(), c.getLoHang().getId()), c.getSoLuongNhap().negate(), BigDecimal::add);
            }
        }
        bienBanGiaoNhanRepository.findFirstByPhieuChuyenKho_IdOrderByIdDesc(phieuChuyenId)
                .flatMap(b -> phieuDieuChinhKhoRepository.findFirstByBienBanGiaoNhan_Id(b.getId()))
                .ifPresent(d -> chiTietPhieuDieuChinhRepository.findByPhieuDieuChinhKho_IdOrderByIdAsc(d.getId())
                        .forEach(c -> con.merge(khoaLo(c.getBienTheSanPham().getId(), c.getLoHang().getId()),
                                c.getSoLuongDieuChinh(), BigDecimal::add)));
        return con;
    }

    /**
     * Lập phiếu nhập đã hoàn tất cho hàng lấy ra từ kho trung chuyển: trung chuyển −, kho nhận +, ghi sổ kho hai dòng
     * (trung chuyển xuất, kho nhận nhập). Khóa dòng tồn theo thứ tự PK như mọi luồng ghi tồn.
     */
    private PhieuNhapKho nhapTuTrungChuyen(PhieuChuyenKho phieu, Kho khoNhan, String tienToSo, List<DongNhap> dong,
                                           NguoiDung nguoi, String ghiChu) {
        Kho trungChuyen = khoTrungChuyen();
        List<Integer> loIds = dong.stream().map(d -> d.lo().getId()).distinct().toList();
        List<Integer> idsCanKhoa = new ArrayList<>(tonKhoTheoLoRepository.findIdsByKhoAndLots(trungChuyen.getId(), loIds));
        idsCanKhoa.addAll(tonKhoTheoLoRepository.findIdsByKhoAndLots(khoNhan.getId(), loIds));
        if (!idsCanKhoa.isEmpty()) tonKhoTheoLoRepository.lockLotsForUpdateByIds(idsCanKhoa.stream().distinct().sorted().toList());

        String tienTo = tienToSo + ngayHomNay();
        Instant bayGio = Instant.now();
        PhieuNhapKho pn = phieuNhapKhoRepository.save(PhieuNhapKho.builder()
                .soPhieuNhap(SoChungTu.tiepTheo(tienTo, phieuNhapKhoRepository.soDuoiLonNhat(tienTo)))
                .kho(khoNhan)
                .phieuChuyenKho(phieu)
                .trangThai(TrangThaiPhieuNhap.COMPLETED.getValue())
                .ngayTao(bayGio)
                .ngayNhap(bayGio)
                .nguoiNhap(nguoi)
                .ghiChu(ghiChu)
                .tongTien(BigDecimal.ZERO)
                .build());
        BigDecimal tongTien = BigDecimal.ZERO;
        Set<Integer> sanPhamIds = new HashSet<>();
        for (DongNhap d : dong) {
            BigDecimal sl = d.soLuong();
            TonKhoTheoLo tonTc = tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(trungChuyen.getId(), d.lo().getId())
                    .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT, "Kho trung chuyển không có lô " + d.lo().getMaLo()));
            BigDecimal truocTc = tonTc.getSoLuongTon() == null ? BigDecimal.ZERO : tonTc.getSoLuongTon();
            if (truocTc.compareTo(sl) < 0) {
                throw new CommonException(HttpStatus.CONFLICT, "Kho trung chuyển không đủ lô " + d.lo().getMaLo()
                        + " (còn " + hienThi(truocTc) + ", cần " + hienThi(sl) + ")");
            }
            tonTc.setSoLuongTon(truocTc.subtract(sl));
            tonTc.setNgayXuatGanNhat(bayGio);
            tonKhoTheoLoRepository.save(tonTc);

            TonKhoTheoLo tonNhan = tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(khoNhan.getId(), d.lo().getId())
                    .orElse(TonKhoTheoLo.builder().kho(khoNhan).loHang(d.lo())
                            .soLuongTon(BigDecimal.ZERO).soLuongDaDat(BigDecimal.ZERO).build());
            BigDecimal truocNhan = tonNhan.getSoLuongTon() == null ? BigDecimal.ZERO : tonNhan.getSoLuongTon();
            tonNhan.setSoLuongTon(truocNhan.add(sl));
            tonNhan.setNgayNhapGanNhat(bayGio);
            tonKhoTheoLoRepository.save(tonNhan);

            chiTietPhieuNhapKhoRepository.save(ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(pn)
                    .bienTheSanPham(d.bienThe())
                    .loHang(d.lo())
                    .soLuongNhap(sl)
                    .donGia(d.giaVon())
                    .thanhTien(d.giaVon().multiply(sl))
                    .ghiChu("Từ hàng đi đường của " + phieu.getSoPhieuChuyen())
                    .build());
            tongTien = tongTien.add(d.giaVon().multiply(sl));

            String ghi = ghiChu + " (" + pn.getSoPhieuNhap() + ")";
            lichSuGiaoDichKhoRepository.save(LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(bayGio).loaiGiaoDich("xuat_kho")
                    .loaiThamChieu(ITable.phieu_nhap_kho).idThamChieu(pn.getId())
                    .bienTheSanPham(d.bienThe()).loHang(d.lo()).kho(trungChuyen)
                    .soLuong(sl).soLuongTruoc(truocTc).soLuongSau(tonTc.getSoLuongTon())
                    .giaVon(d.giaVon()).nguoiDung(nguoi).ghiChu(ghi).build());
            lichSuGiaoDichKhoRepository.save(LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(bayGio).loaiGiaoDich("nhap_kho")
                    .loaiThamChieu(ITable.phieu_nhap_kho).idThamChieu(pn.getId())
                    .bienTheSanPham(d.bienThe()).loHang(d.lo()).kho(khoNhan)
                    .soLuong(sl).soLuongTruoc(truocNhan).soLuongSau(tonNhan.getSoLuongTon())
                    .giaVon(d.giaVon()).nguoiDung(nguoi).ghiChu(ghi).build());
            if (d.bienThe().getSanPham() != null) sanPhamIds.add(d.bienThe().getSanPham().getId());
        }
        pn.setTongTien(tongTien);
        phieuNhapKhoRepository.save(pn);
        sanPhamIds.forEach(sanPhamQuanAoService::recalculatePriceAndStatus);
        return pn;
    }

    /** Phiếu nhập nháp lập tay ở luồng cũ (trước khi nâng cấp) chưa hề cộng tồn: hủy trước khi nhận theo luồng mới. */
    private void huyPhieuNhapNhapCu(Integer phieuChuyenId) {
        for (PhieuNhapKho pn : phieuNhapKhoRepository.findByPhieuChuyenKho_IdOrderByIdAsc(phieuChuyenId)) {
            if (Integer.valueOf(TrangThaiPhieuNhap.DRAFT.getValue()).equals(pn.getTrangThai())) {
                pn.setTrangThai(TrangThaiPhieuNhap.CANCELLED.getValue());
                pn.setGhiChu(noi(pn.getGhiChu(), "Hủy khi nhận hàng theo luồng chuyển kho mới"));
                phieuNhapKhoRepository.save(pn);
            }
        }
    }

    private Kho khoTrungChuyen() {
        return khoRepository.findByMaKho(MA_KHO_TRUNG_CHUYEN)
                .orElseThrow(() -> new CommonException("Hệ thống chưa cấu hình kho trung chuyển KHO_TRANSIT"));
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    private PhieuChuyenKho khoa(Integer id) {
        return phieuChuyenKhoRepository.khoaTheoId(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu chuyển kho id: " + id));
    }

    private static void batBuocTrangThai(PhieuChuyenKho p, String trangThai, String thaoTac) {
        if (!trangThai.equals(p.getTrangThai())) {
            // Tên trạng thái đã có "Đang/Đã/Chờ" nên không ghép thêm "đang" (tránh "đang đang vận chuyển")
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu " + p.getSoPhieuChuyen() + " ở trạng thái "
                    + tenTrangThai(p.getTrangThai()) + ", không " + thaoTac + " được");
        }
    }

    /**
     * Hàng đã rời kho xuất: đang đi / chờ xử lý lệch, hoặc đã hoàn tất / đã hủy sau khi xác nhận xuất theo luồng mới
     * (người vận chuyển chỉ ghi ở Xác nhận xuất; phiếu cũ chuyển sang không có nên không lẫn vào).
     */
    private static boolean daXuat(PhieuChuyenKho p) {
        String tt = p.getTrangThai();
        return IChuyenKho.DANG_VAN_CHUYEN.equals(tt) || IChuyenKho.CHO_XU_LY_LECH.equals(tt)
                || ((IChuyenKho.HOAN_TAT.equals(tt) || IChuyenKho.DA_HUY.equals(tt)) && p.getNguoiVanChuyen() != null);
    }

    /** Hàng đã đi mà chưa ghi số phiếu XKNB ("xuất trước, ghi số sau"): còn ghi số được kể cả sau khi đã nhận / đã hủy. */
    private static boolean thieuXknb(PhieuChuyenKho p) {
        return daXuat(p) && (p.getSoPhieuXknb() == null || p.getSoPhieuXknb().isBlank());
    }

    private static boolean laTre(PhieuChuyenKho p, Instant bayGio) {
        return IChuyenKho.DANG_VAN_CHUYEN.equals(p.getTrangThai()) && p.getNgayDuKienDen() != null && p.getNgayDuKienDen().isBefore(bayGio);
    }

    public static String tenTrangThai(String trangThai) {
        if (trangThai == null) return "Không rõ";
        return switch (trangThai) {
            case IChuyenKho.CHO_DUYET -> "Chờ duyệt";
            case IChuyenKho.DA_DUYET -> "Đã duyệt";
            case IChuyenKho.DANG_VAN_CHUYEN -> "Đang vận chuyển";
            case IChuyenKho.CHO_XU_LY_LECH -> "Chờ xử lý chênh lệch";
            case IChuyenKho.HOAN_TAT -> "Hoàn tất";
            case IChuyenKho.DA_HUY -> "Đã hủy";
            default -> trangThai;
        };
    }

    private String soPhieuMoi() {
        String tienTo = IChuyenKho.TIEN_TO_PHIEU_CHUYEN + ngayHomNay();
        return SoChungTu.tiepTheo(tienTo, phieuChuyenKhoRepository.soDuoiLonNhat(tienTo));
    }

    private static String ngayHomNay() {
        return LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private static String khoaLo(Integer bienTheId, Integer loId) {
        return bienTheId + ":" + loId;
    }

    private static String chuoiHoacNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String batBuoc(String s, String loi) {
        String v = chuoiHoacNull(s);
        if (v == null) throw new CommonException(loi);
        return v;
    }

    /** Chuỗi không quá độ dài cột (vượt thì báo rõ thay vì lỗi "Data too long" 500 của MySQL). */
    private static String toiDa(String v, int doDai, String ten) {
        if (v != null && v.length() > doDai) throw new CommonException(ten + " tối đa " + doDai + " ký tự");
        return v;
    }

    /** Ngày lập phiếu XKNB không ở tương lai. */
    private static void kiemTraNgayLapXknb(LocalDate ngayLap) {
        if (ngayLap != null && ngayLap.isAfter(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")))) {
            throw new CommonException("Ngày lập phiếu XKNB không được sau hôm nay");
        }
    }

    private static String noi(String cu, String them) {
        return cu == null || cu.isBlank() ? them : cu + " | " + them;
    }

    private static String hienThi(BigDecimal soLuong) {
        return soLuong.stripTrailingZeros().toPlainString();
    }

    private static String ten(NguoiDung n) {
        return n == null ? null : n.getHoTen();
    }

    private static PhieuChuyenKhoDto.KhoTomTat khoTomTat(Kho k) {
        return PhieuChuyenKhoDto.KhoTomTat.builder().id(k.getId()).ten(k.getTenKho()).diaChi(k.getDiaChi()).loaiKho(k.getLoaiKho()).build();
    }

    private PhieuChuyenKhoDto.ChungTu chungTu(PhieuChuyenKho p) {
        return PhieuChuyenKhoDto.ChungTu.builder().id(p.getId()).so(p.getSoPhieuChuyen()).trangThai(p.getTrangThai()).ngay(p.getNgayTao()).build();
    }

    private static PhieuChuyenKhoDto.BienBan bienBanDto(BienBanGiaoNhan b, List<ChiTietBienBanGiaoNhan> dong) {
        return PhieuChuyenKhoDto.BienBan.builder()
                .id(b.getId())
                .soBienBan(b.getSoBienBan())
                .ngayLap(b.getNgayLap())
                .nguoiLap(ten(b.getNguoiLap()))
                .nguoiVanChuyen(b.getNguoiVanChuyen())
                .tongGui(b.getTongSoLuongGui())
                .tongNhan(b.getTongSoLuongNhan())
                .tongThieu(b.getTongSoLuongThieu())
                .tongHong(b.getTongSoLuongHong())
                .ketLuan(b.getGhiChu())
                .phuongAn(b.getPhuongAnXuLy())
                .nguoiDuyet(ten(b.getNguoiDuyetXuLy()))
                .ngayDuyet(b.getNgayDuyetXuLy())
                .dong(dong.stream().map(c -> {
                    BienTheSanPham bt = c.getBienTheSanPham();
                    return PhieuChuyenKhoDto.DongBienBan.builder()
                            .id(c.getId())
                            .bienTheId(bt.getId())
                            .sku(bt.getMaSku())
                            .tenSanPham(HienThiBienThe.tenSanPham(bt))
                            .tenMau(HienThiBienThe.tenMau(bt))
                            .maMauHex(HienThiBienThe.maMauHex(bt))
                            .kichCo(HienThiBienThe.kichCo(bt))
                            .loHangId(c.getLoHang().getId())
                            .maLo(c.getLoHang().getMaLo())
                            .gui(c.getSoLuongGui())
                            .nhan(c.getSoLuongNhan())
                            .thieu(c.getSoLuongThieu())
                            .hong(c.getSoLuongHong())
                            .lyDo(c.getLyDoHongThieu())
                            .build();
                }).toList())
                .build();
    }

    private void ghiNhatKy(PhieuChuyenKho p, String hanhDong, String cu, String moi, String ghiChu, NguoiDung nguoi) {
        try {
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.phieu_chuyen_kho)
                    .idThamChieu(p.getId())
                    .kho(p.getKhoXuat())
                    .hanhDong(hanhDong)
                    .giaTriCu(cu == null ? null : "trang_thai = " + cu)
                    .giaTriMoi(moi == null ? null : "trang_thai = " + moi)
                    .ghiChu(ghiChu)
                    .nguoiThucHien(nguoi)
                    .ngayThucHien(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("Lỗi ghi nhật ký phiếu chuyển {}: {}", p.getSoPhieuChuyen(), e.getMessage());
        }
    }
}
