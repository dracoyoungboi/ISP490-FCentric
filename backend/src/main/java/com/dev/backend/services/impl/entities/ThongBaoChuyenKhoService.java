package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.entities.BienBanGiaoNhan;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuChuyenKho;
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
 *   Hủy / từ chối                    người tạo phiếu + quản lý kho nhận (+ quản lý kho xuất nếu đã duyệt / đang vận chuyển)
 *   Xác nhận xuất                    quản lý kho nhận (kèm giờ dự kiến đến)
 *   Nhận lệch (chờ xử lý)            người xử lý chênh lệch theo Cấu hình › Chuyển kho (CHUYEN_KHO_QUYEN_XU_LY_LECH);
 *                                    không có ai thì quản trị viên
 * </pre>
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
            String tieuDe = (giaoBu ? "Phiếu giao bù " : "Phiếu chuyển ") + ph.so() + " chờ duyệt";
            String moTa = (giaoBu && soGoc != null ? "Giao bù cho " + soGoc + ": " : "") + tuyen(ph, ten)
                    + ". Kiểm tồn và lập lệnh điều động.";
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
            String moTa = (ph.soLenh() != null ? "Lệnh điều động " + ph.soLenh() + ". " : "")
                    + ten(ten, ph.khoXuatId()) + " nhặt và xuất hàng cho " + ten(ten, ph.khoNhapId()) + ".";
            return List.of(new GuiDi(nhan, ng.id(), noiDung(ph, "DUYET", ThongBaoService.TONE_SUCCESS,
                    "Phiếu chuyển " + ph.so() + " đã được duyệt", moTa, ph.khoXuatId())));
        });
    }

    /**
     * Hủy / từ chối (UC 7.2 A1 bước 4) → người tạo phiếu + quản lý kho nhận, thêm quản lý kho xuất khi phiếu đã duyệt
     * hoặc đang vận chuyển. Câu ghi "bị từ chối" khi phiếu Chờ duyệt bị người không phải người tạo hủy; còn lại (người
     * tạo tự hủy, hủy sau khi đã duyệt) ghi "đã hủy". Trạng thái phiếu vẫn là DA_HUY.
     */
    public void daHuy(PhieuChuyenKho p, String trangThaiTruoc, NguoiDung nguoi) {
        dangKy("đã hủy", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            boolean khoXuatDaLam = IChuyenKho.DA_DUYET.equals(trangThaiTruoc) || IChuyenKho.DANG_VAN_CHUYEN.equals(trangThaiTruoc);
            List<Integer> nhan = new ArrayList<>();
            nhan.add(ph.nguoiTaoId());
            nhan.addAll(quanLyKho(ph.khoNhapId()));
            if (khoXuatDaLam) nhan.addAll(quanLyKho(ph.khoXuatId()));

            boolean tuChoi = IChuyenKho.CHO_DUYET.equals(trangThaiTruoc) && ng.id() != null
                    && !ng.id().equals(ph.nguoiTaoId());
            List<String> cau = new ArrayList<>();
            cau.add(tuyen(ph, ten));
            String lyDo = ph.lyDoHuy() == null ? "" : ph.lyDoHuy().trim().replaceAll("[.\\s]+$", "");
            if (!lyDo.isEmpty()) cau.add("Lý do: " + lyDo);
            if (IChuyenKho.DANG_VAN_CHUYEN.equals(trangThaiTruoc)) {
                cau.add("Hàng đang trên đường, " + ten(ten, ph.khoXuatId()) + " nhập hoàn trả");
            }
            return List.of(new GuiDi(nhan, ng.id(), noiDung(ph, "HUY",
                    tuChoi ? ThongBaoService.TONE_DANGER : ThongBaoService.TONE_WARNING,
                    "Phiếu chuyển " + ph.so() + (tuChoi ? " bị từ chối" : " đã hủy"),
                    String.join(". ", cau) + ".", ph.khoNhapId())));
        });
    }

    /** Xác nhận xuất → quản lý kho nhận, kèm giờ dự kiến đến. */
    public void daXuat(PhieuChuyenKho p, NguoiDung nguoi) {
        dangKy("đã xuất", p, nguoi, (ph, ng) -> {
            Map<Integer, String> ten = tenKho(ph);
            String moTa = "Từ " + ten(ten, ph.khoXuatId()) + ", "
                    + (ph.ngayDuKienDen() != null ? "dự kiến đến " + GIO_NGAY.format(ph.ngayDuKienDen()) : "chưa hẹn giờ đến")
                    + ".";
            return List.of(new GuiDi(quanLyKho(ph.khoNhapId()), ng.id(), noiDung(ph, "XUAT", ThongBaoService.TONE_INFO,
                    "Phiếu chuyển " + ph.so() + " đang trên đường đến", moTa, ph.khoNhapId())));
        });
    }

    /**
     * Nhận lệch (Chờ xử lý chênh lệch) → người được xử lý theo Cấu hình › Chuyển kho: QL_KHO_TONG → Quản lý Kho tổng;
     * QL_KHO_TONG_VA_KHO_XUAT → thêm quản lý kho xuất; CHI_QUAN_TRI → mọi quản trị viên đang hoạt động (chỉ họ xử lý được).
     */
    public void nhanLech(PhieuChuyenKho p, BienBanGiaoNhan bb, NguoiDung nguoi) {
        String soBienBan = bb == null ? null : bb.getSoBienBan();
        Integer thieu = bb == null ? null : bb.getTongSoLuongThieu();
        Integer hong = bb == null ? null : bb.getTongSoLuongHong();
        dangKy("nhận lệch", p, nguoi, (ph, ng) -> {
            String cheDo = cheDoXuLyLech();
            List<Integer> nhan = new ArrayList<>();
            if (IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI.equals(cheDo)) {
                nhan.addAll(nguoiDungRepository.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien));
            } else {
                List<Integer> xuLy = new ArrayList<>(quanLyKhoTong());
                if (IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT.equals(cheDo)) xuLy.addAll(quanLyKho(ph.khoXuatId()));
                nhan.addAll(hoacQuanTri(xuLy, ph, "nhận lệch"));
            }
            List<String> lech = new ArrayList<>();
            if (thieu != null && thieu > 0) lech.add("thiếu " + thieu);
            if (hong != null && hong > 0) lech.add("hỏng " + hong);
            String moTa = (soBienBan != null ? "Biên bản " + soBienBan + (lech.isEmpty() ? "" : ": " + String.join(", ", lech)) + ". " : "")
                    + "Chọn ghi giảm hao hụt hoặc giao bù.";
            return List.of(new GuiDi(nhan, ng.id(), noiDung(ph, "NHAN_LECH", ThongBaoService.TONE_WARNING,
                    "Phiếu chuyển " + ph.so() + " nhận lệch, chờ xử lý", moTa, ph.khoNhapId())));
        });
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
        return Optional.ofNullable(ten.get(khoId)).orElse(khoId == null ? "kho" : "kho #" + khoId);
    }

    private static String tuyen(Phieu ph, Map<Integer, String> ten) {
        return ten(ten, ph.khoXuatId()) + " → " + ten(ten, ph.khoNhapId());
    }

    private static NoiDung noiDung(Phieu ph, String suKien, String tone, String tieuDe, String moTa, Integer khoId) {
        return new NoiDung(ThongBaoService.LOAI_PHIEU_CHUYEN_KHO, tone, tieuDe, moTa, "/transfer-tickets/" + ph.id(),
                ITable.phieu_chuyen_kho, ph.id(), khoId, "PCK:" + ph.id() + ":" + suKien);
    }
}
