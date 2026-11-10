package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.entities.BienBanGiaoNhan;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuChuyenKho;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.PhieuChuyenKhoRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Thông báo của chuyển kho nội bộ (SRS UC 7.2: duyệt thì báo kho xuất được làm tiếp; từ chối thì báo kho yêu cầu và kho
 * cung cấp). PhieuChuyenKhoService gọi một hàm ở đây ngay sau mỗi lần ghi nhật ký đổi trạng thái.
 * <p>
 * Lúc gọi chỉ chụp lại các trường đã có trong bộ nhớ (id kho, id người tạo, số phiếu…), không đọc CSDL trong giao dịch
 * nghiệp vụ và không bao giờ ném lỗi. Tìm người nhận, tên kho và ghi thông báo chạy sau khi giao dịch nghiệp vụ commit,
 * trong giao dịch mới ({@link ThongBaoService#guiSauCommit}). Người vừa thao tác không nhận; người nhận trùng chỉ nhận một.
 * <p>
 * "Quản lý kho X" = tài khoản đang hoạt động vai trò quan_ly_kho có phân quyền hiệu lực ở kho X; "Quản lý Kho tổng" = như
 * vậy ở một kho loại kho_tong. Quản trị viên không gắn kho nên không nhận, trừ khi chỉ quản trị viên xử lý được chênh lệch
 * hoặc không có quản lý kho nào đang hiệu lực để duyệt / xử lý chênh lệch (khi đó gửi quản trị viên, có log warn).
 * <pre>
 *   Sự kiện                         Người nhận
 *   Tạo phiếu / phiếu giao bù        Quản lý Kho tổng (duyệt); không có ai thì quản trị viên
 *   Duyệt                            quản lý kho xuất + người tạo phiếu
 *   Từ chối                          người tạo phiếu + quản lý kho nhận + quản lý kho xuất
 *   Hủy                              người tạo phiếu + quản lý kho nhận (+ quản lý kho xuất nếu đã duyệt / đang vận chuyển)
 *   Xác nhận xuất                    quản lý kho nhận (kèm giờ dự kiến đến)
 *   Nhận lệch (lập biên bản)         quản lý kho gửi (kho xuất) để xác nhận biên bản; không có ai thì quản trị viên
 *   Kho gửi xác nhận biên bản        người xử lý chênh lệch theo Cấu hình › Chuyển kho (CHUYEN_KHO_QUYEN_XU_LY_LECH);
 *                                    không có ai thì quản trị viên
 *   Xử lý chênh lệch giao bù         như Duyệt cho phiếu giao bù (Quản lý Kho tổng xử lý); như Tạo phiếu nếu phiếu giao bù
 *                                    còn chờ duyệt
 * </pre>
 * Kho gửi xác nhận xong thì thông báo "chờ kho gửi xác nhận" của mọi người đánh dấu đã đọc; xử lý chênh lệch xong thì
 * thông báo "chờ xử lý chênh lệch" cũng vậy (việc đã có người làm).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoChuyenKhoService {

    private static final DateTimeFormatter GIO_NGAY = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final ThongBaoService thongBaoService;
    private final PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final KhoRepository khoRepository;
    private final PhieuChuyenKhoRepository phieuChuyenKhoRepository;
    private final DieuHanhHeThongService dieuHanhHeThongService;

    /**
     * Ảnh chụp phiếu lúc thao tác. Quan hệ (kho, người tạo, phiếu gốc) chỉ lấy id: id của proxy Hibernate đọc không cần
     * nạp, nên không có câu SQL nào chạy thêm trong giao dịch nghiệp vụ.
     */
    record Phieu(Integer id, String so, Integer khoXuatId, Integer khoNhapId, Integer nguoiTaoId, Integer phieuGocId,
                 String soLenh, String lyDoHuy, Instant ngayDuKienDen) {
        static Phieu tu(PhieuChuyenKho p) {
            return new Phieu(p.getId(), p.getSoPhieuChuyen(),
                    p.getKhoXuat() == null ? null : p.getKhoXuat().getId(),
                    p.getKhoNhap() == null ? null : p.getKhoNhap().getId(),
                    p.getNguoiTao() == null ? null : p.getNguoiTao().getId(),
                    p.getPhieuGoc() == null ? null : p.getPhieuGoc().getId(),
                    p.getSoLenhDieuDong(), p.getLyDoHuy(), p.getNgayDuKienDen());
        }
    }

    /** Người vừa thao tác (không nhận thông báo của chính mình). */
    record NguoiThaoTac(Integer id) {
        static NguoiThaoTac tu(NguoiDung n) {
            return new NguoiThaoTac(n == null ? null : n.getId());
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SỰ KIỆN (gọi ngay sau ghiNhatKy trong PhieuChuyenKhoService)
    // ─────────────────────────────────────────────────────────────

    /** Phiếu mới hoặc phiếu giao bù vào Chờ duyệt → Quản lý Kho tổng. */
    public void choDuyet(PhieuChuyenKho p, NguoiDung nguoi) {
        dangKy("chờ duyệt", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            String soGoc = ph.phieuGocId() == null ? null : phieuChuyenKhoRepository.findById(ph.phieuGocId())
                    .map(PhieuChuyenKho::getSoPhieuChuyen).orElse(null);
            boolean giaoBu = ph.phieuGocId() != null;
            String tieuDe = tieuDeChoDuyet(giaoBu, ph.so());
            String moTa = moTaChoDuyet(ten(ten, ph.khoXuatId()), ten(ten, ph.khoNhapId()), soGoc);
            return List.of(new GuiDi(hoacQuanTri(quanLyKhoTong(), ph, "chờ duyệt"), ng.id(),
                    noiDung(ph, "CHO_DUYET", ThongBaoService.TONE_INFO, tieuDe, moTa, ph.khoXuatId())));
        });
    }

    /** Duyệt (UC 7.2 bước 10: báo kho xuất được làm tiếp) → quản lý kho xuất + người tạo phiếu. */
    public void daDuyet(PhieuChuyenKho p, NguoiDung nguoi) {
        dangKy("đã duyệt", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            List<Integer> nhan = new ArrayList<>(quanLyKho(ph.khoXuatId()));
            nhan.add(ph.nguoiTaoId());
            String moTa = moTaDaDuyet(ph.soLenh(), ten(ten, ph.khoXuatId()), ten(ten, ph.khoNhapId()));
            return List.of(new GuiDi(nhan, ng.id(), noiDung(ph, "DUYET", ThongBaoService.TONE_SUCCESS,
                    tieuDeDaDuyet(ph.so()), moTa, ph.khoXuatId())));
        });
    }

    /**
     * Hủy / từ chối (UC 7.2 A1 bước 4) → người tạo phiếu + quản lý kho nhận; thêm quản lý kho xuất khi phiếu bị từ chối
     * (kho cung cấp, UC 7.2) hoặc bị hủy lúc đã duyệt / đang vận chuyển. {@code tuChoi}: Quản lý Kho tổng từ chối phiếu
     * Chờ duyệt (PhieuChuyenKhoService.tuChoi) → câu "bị từ chối"; mọi lần hủy khác (người lập hay quản lý kho nhận rút
     * yêu cầu, hủy sau khi duyệt) → "đã hủy". Trạng thái phiếu vẫn là DA_HUY.
     */
    public void daHuy(PhieuChuyenKho p, String trangThaiTruoc, NguoiDung nguoi, boolean tuChoi) {
        dangKy(tuChoi ? "bị từ chối" : "đã hủy", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            boolean khoXuatDaLam = IChuyenKho.DA_DUYET.equals(trangThaiTruoc) || IChuyenKho.DANG_VAN_CHUYEN.equals(trangThaiTruoc);
            List<Integer> nhan = new ArrayList<>();
            nhan.add(ph.nguoiTaoId());
            nhan.addAll(quanLyKho(ph.khoNhapId()));
            if (tuChoi || khoXuatDaLam) nhan.addAll(quanLyKho(ph.khoXuatId()));

            String lyDo = ph.lyDoHuy() == null ? "" : ph.lyDoHuy().trim().replaceAll("[.\\s]+$", "");
            String moTa = moTaDaHuy(ten(ten, ph.khoXuatId()), ten(ten, ph.khoNhapId()), lyDo,
                    IChuyenKho.DANG_VAN_CHUYEN.equals(trangThaiTruoc));
            return List.of(new GuiDi(nhan, ng.id(), noiDung(ph, "HUY",
                    tuChoi ? ThongBaoService.TONE_DANGER : ThongBaoService.TONE_WARNING,
                    tieuDeDaHuy(ph.so(), tuChoi), moTa, ph.khoNhapId())));
        });
    }

    /** Xác nhận xuất → quản lý kho nhận, kèm giờ dự kiến đến. */
    public void daXuat(PhieuChuyenKho p, NguoiDung nguoi) {
        dangKy("đã xuất", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            String moTa = moTaDaXuat(ten(ten, ph.khoXuatId()),
                    ph.ngayDuKienDen() != null ? GIO_NGAY.format(ph.ngayDuKienDen()) : null);
            return List.of(new GuiDi(quanLyKho(ph.khoNhapId()), ng.id(), noiDung(ph, "XUAT", ThongBaoService.TONE_INFO,
                    tieuDeDaXuat(ph.so()), moTa, ph.khoNhapId())));
        });
    }

    /**
     * Nhận lệch (kho nhận lập biên bản giao nhận) → quản lý kho gửi (kho xuất) vào phiếu xác nhận biên bản (BA 03/11).
     * Người lập biên bản không tự xác nhận được: bỏ họ ra trước khi chọn; không còn ai (kho xuất chưa phân công quản lý,
     * hoặc quản lý duy nhất chính là người lập) thì quản trị viên (xác nhận thay được).
     */
    public void nhanLech(PhieuChuyenKho p, BienBanGiaoNhan bb, NguoiDung nguoi) {
        BienBan bienBan = bienBan(bb);
        dangKy("nhận lệch", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            String moTa = moTaNhanLech(ten(ten, ph.khoNhapId()), bienBan);
            List<Integer> khoGui = quanLyKho(ph.khoXuatId()).stream().filter(id -> id != null && !id.equals(ng.id())).toList();
            return List.of(new GuiDi(hoacQuanTri(khoGui, ph, "nhận lệch"), ng.id(),
                    noiDung(ph, "NHAN_LECH", ThongBaoService.TONE_WARNING,
                            tieuDeNhanLech(ph.so()), moTa, ph.khoXuatId())));
        });
    }

    /**
     * Kho gửi xác nhận biên bản → người được xử lý theo Cấu hình › Chuyển kho: QL_KHO_TONG → Quản lý Kho tổng;
     * QL_KHO_TONG_VA_KHO_XUAT → thêm quản lý kho xuất; CHI_QUAN_TRI → mọi quản trị viên đang hoạt động (chỉ họ xử lý được).
     * Thông báo "chờ kho gửi xác nhận" của phiếu đánh dấu đã đọc.
     */
    public void daXacNhanBienBan(PhieuChuyenKho p, BienBanGiaoNhan bb, NguoiDung nguoi) {
        BienBan bienBan = bienBan(bb);
        String yKien = bb == null || bb.getGhiChuKhoGui() == null ? "" : bb.getGhiChuKhoGui().trim().replaceAll("[.\\s]+$", "");
        if (p != null && p.getId() != null) thongBaoService.daXuLySauCommit("PCK:" + p.getId() + ":NHAN_LECH");
        dangKy("kho gửi xác nhận biên bản", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            String moTa = moTaXacNhanBienBan(ten(ten, ph.khoXuatId()), bienBan, yKien);
            return List.of(new GuiDi(nguoiXuLyLech(ph), ng.id(), noiDung(ph, "XAC_NHAN_BB", ThongBaoService.TONE_WARNING,
                    tieuDeXacNhanBienBan(ph.so()), moTa, ph.khoNhapId())));
        });
    }

    /** Xử lý chênh lệch xong (ghi giảm / giao bù): thông báo "chờ xử lý chênh lệch" của phiếu đánh dấu đã đọc. */
    public void daXuLyChenhLech(PhieuChuyenKho p) {
        if (p != null && p.getId() != null) thongBaoService.daXuLySauCommit("PCK:" + p.getId() + ":XAC_NHAN_BB");
    }

    /**
     * Biên bản giao nhận rút gọn để ghép câu: {@code so} null = chưa có số ("biên bản giao nhận"); {@code thieu} / {@code hong}
     * null = không lệch loại đó. Chụp ngay lúc gọi (không đọc CSDL sau commit).
     */
    record BienBan(String so, String thieu, String hong) {
    }

    static BienBan bienBan(BienBanGiaoNhan bb) {
        if (bb == null || bb.getSoBienBan() == null) return new BienBan(null, null, null);
        String thieu = bb.getTongSoLuongThieu() != null && bb.getTongSoLuongThieu() > 0
                ? String.valueOf(bb.getTongSoLuongThieu()) : null;
        String hong = bb.getTongSoLuongHong() != null && bb.getTongSoLuongHong() > 0
                ? String.valueOf(bb.getTongSoLuongHong()) : null;
        return new BienBan(bb.getSoBienBan(), thieu, hong);
    }

    /** Người được xử lý chênh lệch theo Cấu hình › Chuyển kho (cùng luật PhieuChuyenKhoService.duocXuLyChenhLech). */
    private List<Integer> nguoiXuLyLech(Phieu ph) {
        String cheDo = cheDoXuLyLech();
        if (IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI.equals(cheDo)) {
            return nguoiDungRepository.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien);
        }
        List<Integer> xuLy = new ArrayList<>(quanLyKhoTong());
        if (IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT.equals(cheDo)) xuLy.addAll(quanLyKho(ph.khoXuatId()));
        return hoacQuanTri(xuLy, ph, "kho gửi xác nhận biên bản");
    }

    // ─────────────────────────────────────────────────────────────
    // NGƯỜI NHẬN, TIỆN ÍCH (chạy sau commit, trong giao dịch mới)
    // ─────────────────────────────────────────────────────────────

    private interface Lap {
        List<GuiDi> lap(Phieu ph, NguoiThaoTac ng);
    }

    /** Chụp phiếu + người thao tác ngay (trong giao dịch nghiệp vụ, không đọc CSDL), soạn và ghi sau commit. Không ném lỗi. */
    private void dangKy(String suKien, PhieuChuyenKho p, NguoiDung nguoi, Lap lap) {
        try {
            Phieu ph = Phieu.tu(p);
            NguoiThaoTac ng = NguoiThaoTac.tu(nguoi);
            thongBaoService.guiSauCommit("Thông báo phiếu chuyển " + ph.so() + " " + suKien, () -> lap.lap(ph, ng));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo phiếu chuyển ({}): {}", suKien, e.getMessage());
        }
    }

    /** Quản lý kho đang được phân công ở một Kho tổng. */
    private List<Integer> quanLyKhoTong() {
        return phanQuyenNguoiDungKhoRepository.nguoiDungTheoLoaiKhoTai(KhoService.KHO_TONG, IRoleType.quan_ly_kho, Instant.now());
    }

    /**
     * Người duyệt / xử lý theo luật; không có ai (vd. Kho tổng chưa phân công quản lý nào đang hiệu lực) thì gửi các quản
     * trị viên đang hoạt động (họ luôn xử lý được) để việc không bị bỏ quên, kèm log warn để cấu hình lại phân quyền.
     */
    private List<Integer> hoacQuanTri(List<Integer> nguoiXuLy, Phieu ph, String suKien) {
        if (nguoiXuLy != null && !nguoiXuLy.isEmpty()) return nguoiXuLy;
        log.warn("[THONG-BAO] Phiếu chuyển {} {}: không có quản lý kho nào đang hiệu lực để nhận, gửi quản trị viên",
                ph.so(), suKien);
        return nguoiDungRepository.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien);
    }

    /** Quản lý kho đang được phân công ở kho này. */
    private List<Integer> quanLyKho(Integer khoId) {
        if (khoId == null) return List.of();
        return phanQuyenNguoiDungKhoRepository.nguoiDungTheoKhoTai(List.of(khoId), IRoleType.quan_ly_kho, Instant.now());
    }

    /** Cùng luật với PhieuChuyenKhoService.cheDoXuLyLech: thiếu hoặc giá trị lạ thì theo mặc định Quản lý Kho tổng. */
    String cheDoXuLyLech() {
        String cheDo = dieuHanhHeThongService.getCauHinhString(
                DieuHanhHeThongServiceImpl.CAU_HINH_CHUYEN_KHO_QUYEN_XU_LY_LECH, IChuyenKho.XU_LY_LECH_QL_KHO_TONG);
        return cheDo != null && IChuyenKho.QUYEN_XU_LY_LECH.contains(cheDo) ? cheDo : IChuyenKho.XU_LY_LECH_QL_KHO_TONG;
    }

    private Map<Integer, String> tenKho(Phieu ph) {
        List<Integer> ids = new ArrayList<>();
        if (ph.khoXuatId() != null) ids.add(ph.khoXuatId());
        if (ph.khoNhapId() != null) ids.add(ph.khoNhapId());
        if (ids.isEmpty()) return Map.of();
        Map<Integer, String> ten = new HashMap<>();
        for (Kho k : khoRepository.findAllById(ids)) {
            if (k != null && k.getId() != null && k.getTenKho() != null) ten.put(k.getId(), k.getTenKho());
        }
        return ten;
    }

    private static String ten(Map<Integer, String> ten, Integer khoId) {
        return Optional.ofNullable(ten.get(khoId)).orElse(khoId == null ? "kho" : ThongDiep.vi("thongBaoChung.khoSoThuong", khoId));
    }

    // ─────────────────────────────────────────────────────────────
    // CÂU THÔNG BÁO — nhóm thongBaoChuyenKho. Lưu tiếng Việt (ThongDiep.vi), DichThongBao dịch lúc đọc theo mẫu của khóa.
    // Nội dung nhiều câu / có phần tùy chọn dùng một khóa nguyên chuỗi cho mỗi biến thể (mẫu nuốt đủ tham số, không
    // phải tách câu); đổi chữ ở đây thì đổi cả hai tệp thongBaoChuyenKho*.properties.
    // ─────────────────────────────────────────────────────────────

    private static final String NHOM = "thongBaoChuyenKho.";

    static String tieuDeChoDuyet(boolean giaoBu, String so) {
        return ThongDiep.vi(NHOM + (giaoBu ? "choDuyetGiaoBuTieuDe" : "choDuyetTieuDe"), so);
    }

    /** {@code soGoc} khác null: phiếu giao bù cho phiếu gốc đó. */
    static String moTaChoDuyet(String khoXuat, String khoNhap, String soGoc) {
        return soGoc == null
                ? ThongDiep.vi(NHOM + "choDuyetMoTa", khoXuat, khoNhap)
                : ThongDiep.vi(NHOM + "choDuyetGiaoBuMoTa", khoXuat, khoNhap, soGoc);
    }

    static String tieuDeDaDuyet(String so) {
        return ThongDiep.vi(NHOM + "daDuyetTieuDe", so);
    }

    static String moTaDaDuyet(String soLenh, String khoXuat, String khoNhap) {
        return soLenh != null
                ? ThongDiep.vi(NHOM + "daDuyetCoLenhMoTa", soLenh, khoXuat, khoNhap)
                : ThongDiep.vi(NHOM + "daDuyetMoTa", khoXuat, khoNhap);
    }

    static String tieuDeDaHuy(String so, boolean tuChoi) {
        return ThongDiep.vi(NHOM + (tuChoi ? "huyTuChoiTieuDe" : "huyTieuDe"), so);
    }

    /**
     * Chỉ có tuyến kho (không lý do, không hàng đang đi) thì câu không có chữ nào cần dịch: "kho A → kho B." giữ nguyên
     * ở cả hai ngôn ngữ nên không cần khóa.
     */
    static String moTaDaHuy(String khoXuat, String khoNhap, String lyDo, boolean dangVanChuyen) {
        boolean coLyDo = lyDo != null && !lyDo.isEmpty();
        if (!coLyDo && !dangVanChuyen) return khoXuat + " → " + khoNhap + ".";
        if (coLyDo && dangVanChuyen) return ThongDiep.vi(NHOM + "huyLyDoDuongMoTa", khoXuat, khoNhap, lyDo, khoXuat);
        if (coLyDo) return ThongDiep.vi(NHOM + "huyLyDoMoTa", khoXuat, khoNhap, lyDo);
        return ThongDiep.vi(NHOM + "huyDuongMoTa", khoXuat, khoNhap, khoXuat);
    }

    static String tieuDeDaXuat(String so) {
        return ThongDiep.vi(NHOM + "daXuatTieuDe", so);
    }

    /** {@code denDuKien} đã định dạng giờ ngày; null = chưa hẹn giờ đến. */
    static String moTaDaXuat(String khoXuat, String denDuKien) {
        return denDuKien != null
                ? ThongDiep.vi(NHOM + "daXuatDuKienMoTa", khoXuat, denDuKien)
                : ThongDiep.vi(NHOM + "daXuatChuaHenMoTa", khoXuat);
    }

    static String tieuDeNhanLech(String so) {
        return ThongDiep.vi(NHOM + "nhanLechTieuDe", so);
    }

    static String moTaNhanLech(String khoNhap, BienBan bb) {
        return ThongDiep.vi(NHOM + "nhanLech" + hauKhoaBienBan(bb) + "MoTa", thamSoBienBan(khoNhap, bb).toArray());
    }

    static String tieuDeXacNhanBienBan(String so) {
        return ThongDiep.vi(NHOM + "xacNhanTieuDe", so);
    }

    /** {@code yKien} rỗng: không kèm câu "Ý kiến kho gửi". */
    static String moTaXacNhanBienBan(String khoXuat, BienBan bb, String yKien) {
        List<Object> thamSo = thamSoBienBan(khoXuat, bb);
        boolean coYKien = yKien != null && !yKien.isEmpty();
        if (coYKien) thamSo.add(yKien);
        return ThongDiep.vi(NHOM + "xacNhan" + hauKhoaBienBan(bb) + (coYKien ? "YKien" : "") + "MoTa", thamSo.toArray());
    }

    /** Chung = chưa có số biên bản; "" = có số, không lệch; Thieu / Hong / ThieuHong = kèm số lệch. */
    private static String hauKhoaBienBan(BienBan bb) {
        if (bb.so() == null) return "Chung";
        if (bb.thieu() != null && bb.hong() != null) return "ThieuHong";
        if (bb.thieu() != null) return "Thieu";
        if (bb.hong() != null) return "Hong";
        return "";
    }

    private static List<Object> thamSoBienBan(String kho, BienBan bb) {
        List<Object> thamSo = new ArrayList<>();
        thamSo.add(kho);
        if (bb.so() != null) thamSo.add(bb.so());
        if (bb.thieu() != null) thamSo.add(bb.thieu());
        if (bb.hong() != null) thamSo.add(bb.hong());
        return thamSo;
    }

    private static NoiDung noiDung(Phieu ph, String suKien, String tone, String tieuDe, String moTa, Integer khoId) {
        return new NoiDung(ThongBaoService.LOAI_PHIEU_CHUYEN_KHO, tone, tieuDe, moTa, "/transfer-tickets/" + ph.id(),
                ITable.phieu_chuyen_kho, ph.id(), khoId, "PCK:" + ph.id() + ":" + suKien);
    }
}
