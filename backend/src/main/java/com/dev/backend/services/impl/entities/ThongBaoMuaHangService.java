package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Thông báo của mua hàng: yêu cầu nhập hàng (chờ duyệt, duyệt, từ chối) và báo giá nhà cung cấp gửi về qua cổng nhà cung
 * cấp. Service nghiệp vụ gọi ngay sau khi ghi xong; ở đây chỉ chụp các trường đã có trong bộ nhớ, tìm người nhận, tên kho
 * và ghi thông báo chạy sau commit ({@link ThongBaoService#guiSauCommit}). Không bao giờ ném lỗi.
 * <pre>
 *   Sự kiện                              Người nhận
 *   M1 Yêu cầu nhập hàng mới, chờ duyệt   Quản lý kho của kho nhập (+ quản lý ghi trên kho); không có ai thì quản trị viên
 *   M2 Yêu cầu được duyệt                 Người lập yêu cầu; người lập không gửi được yêu cầu báo giá (vd. nhân
 *                                         viên bán hàng) thì báo thêm nhân viên mua hàng của kho nhập
 *   M3 Yêu cầu bị từ chối                 Người lập yêu cầu (kèm lý do)
 *   M4 Nhà cung cấp gửi / gửi lại báo giá  Người gửi yêu cầu báo giá + người lập yêu cầu (nếu vai trò xem được báo giá);
 *                                         không ai trong số đó chốt được báo giá thì thêm nhân viên mua hàng của kho
 *                                         nhập (không có thì quản trị viên)
 * </pre>
 * Người duyệt theo đúng luật YeuCauMuaHangService.coQuyenDuyetKho: quản lý kho có phân quyền hiệu lực ở kho nhập, hoặc
 * là quản lý ghi trên kho (kho.quanLy).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoMuaHangService {

    /** Vai trò gửi được yêu cầu báo giá (khớp NghiepVuSanPhamController, frontend vaiTroGuiYeuCauBaoGia.js). */
    static final Set<String> VAI_TRO_GUI_YEU_CAU_BAO_GIA = Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_kho);
    /** Vai trò mở được màn báo giá /quotation/:id (khớp DonMuaHangController.getById). */
    static final Set<String> VAI_TRO_XEM_BAO_GIA = VAI_TRO_GUI_YEU_CAU_BAO_GIA;
    /** Vai trò có nút Chấp nhận / Không chấp nhận báo giá (khớp VAI_TRO_CHOT_BAO_GIA ở QuotationDetail.jsx). */
    static final Set<String> VAI_TRO_CHOT_BAO_GIA = Set.of(IRoleType.quan_tri_vien, IRoleType.nhan_vien_mua_hang);

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;

    /** M1: yêu cầu nhập hàng vừa lập, đang Chờ duyệt → quản lý kho nhập. {@code soMaHang}: số dòng sản phẩm. */
    public void yeuCauChoDuyet(YeuCauMuaHang yc, NguoiDung nguoiTao, int soMaHang) {
        dangKy("chờ duyệt", () -> {
            Integer id = yc.getId();
            String so = so(yc);
            Integer khoId = yc.getKhoNhap() == null ? null : yc.getKhoNhap().getId();
            String tenNguoiTao = nguoiTao == null ? null : nguoiTao.getHoTen();
            Integer nguoiTaoId = nguoiTao == null ? null : nguoiTao.getId();
            return new Lan("yêu cầu nhập hàng " + so + " chờ duyệt", nguoiTaoId, () -> {
                List<Integer> nhan = new ArrayList<>(nguoiNhan.quanLyKho(khoId));
                Integer quanLyGhiTrenKho = quanLyGhiTrenKho(khoId);
                if (quanLyGhiTrenKho != null) nhan.add(quanLyGhiTrenKho);
                String tenKho = tenKho(khoId);
                String moTa = (tenNguoiTao == null || tenNguoiTao.isBlank() ? "Đề nghị" : tenNguoiTao.trim() + " đề nghị")
                        + " nhập " + soMaHang + " mã hàng về " + tenKho + ".";
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nhan, "Yêu cầu nhập hàng " + so + " chờ duyệt"), nguoiTaoId,
                        new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_INFO,
                                "Yêu cầu nhập hàng " + so + " chờ duyệt", moTa, "/purchase-requests/" + id,
                                ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, id, khoId, "YCNH:" + id + ":CHO_DUYET")));
            });
        });
    }

    /**
     * M2 / M3: yêu cầu vừa được duyệt hoặc bị từ chối → người lập yêu cầu. Duyệt mà người lập không gửi được yêu cầu báo
     * giá thì nhân viên mua hàng của kho nhập (không có thì quản trị viên) nhận câu nhắc gửi yêu cầu báo giá.
     */
    public void yeuCauDaXet(YeuCauMuaHang yc, boolean duyet, String lyDoTuChoi, NguoiDung nguoiXet) {
        dangKy(duyet ? "đã duyệt" : "bị từ chối", () -> {
            Integer id = yc.getId();
            String so = so(yc);
            Integer khoId = yc.getKhoNhap() == null ? null : yc.getKhoNhap().getId();
            Integer nguoiTaoId = yc.getNguoiTao() == null ? null : yc.getNguoiTao().getId();
            Integer nguoiXetId = nguoiXet == null ? null : nguoiXet.getId();
            String tenNguoiXet = nguoiXet == null || nguoiXet.getHoTen() == null || nguoiXet.getHoTen().isBlank()
                    ? null : nguoiXet.getHoTen().trim();
            String lyDo = lyDoTuChoi == null ? "" : lyDoTuChoi.trim().replaceAll("[.\\s]+$", "");
            return new Lan("yêu cầu nhập hàng " + so + (duyet ? " đã duyệt" : " bị từ chối"), nguoiXetId, () -> {
                String tieuDe = "Yêu cầu nhập hàng " + so + (duyet ? " đã được duyệt" : " bị từ chối");
                String khoa = "YCNH:" + id + (duyet ? ":DUYET" : ":TU_CHOI");
                String duongDan = "/purchase-requests/" + id;
                List<Integer> nguoiLap = nguoiTaoId == null ? List.of() : List.of(nguoiTaoId);
                if (!duyet) {
                    String moTa = (tenNguoiXet == null ? "Bị từ chối" : tenNguoiXet + " từ chối")
                            + (lyDo.isEmpty() ? "." : ". Lý do: " + lyDo + ".");
                    return List.of(new GuiDi(nguoiLap, nguoiXetId, new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            ThongBaoService.TONE_DANGER, tieuDe, moTa, duongDan, ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            id, khoId, khoa)));
                }
                String daDuyet = (tenNguoiXet == null ? "Đã duyệt" : tenNguoiXet + " đã duyệt") + ".";
                String nhac = daDuyet + " Gửi yêu cầu báo giá cho nhà cung cấp.";
                // Người lập không gửi được yêu cầu báo giá (vd. nhân viên bán hàng): không nhắc việc họ không làm được,
                // báo nhân viên mua hàng của kho nhập làm tiếp
                if (nguoiTaoId == null || coVaiTro(VAI_TRO_GUI_YEU_CAU_BAO_GIA, vaiTro(nguoiTaoId))) {
                    return List.of(new GuiDi(nguoiLap, nguoiXetId, noiDungDuyet(tieuDe, nhac, duongDan, id, khoId, khoa)));
                }
                List<Integer> muaHang = nguoiNhan.hoacQuanTri(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_mua_hang),
                        "Yêu cầu nhập hàng " + so + " đã duyệt, chờ gửi yêu cầu báo giá");
                return List.of(
                        new GuiDi(nguoiLap, nguoiXetId, noiDungDuyet(tieuDe, daDuyet, duongDan, id, khoId, khoa)),
                        new GuiDi(muaHang, nguoiXetId, noiDungDuyet(tieuDe, nhac, duongDan, id, khoId, khoa)));
            });
        });
    }

    /**
     * M4: nhà cung cấp vừa gửi (hoặc gửi lại) báo giá qua cổng nhà cung cấp → người gửi yêu cầu báo giá (người lập đơn
     * mua) + người lập yêu cầu nhập hàng. Khóa sự kiện theo {@code ngayBaoGia}: mỗi lần gửi lại là một thông báo mới.
     */
    public void baoGiaMoi(DonMuaHang don, YeuCauMuaHang yc, Instant ngayBaoGia, boolean guiLai) {
        dangKy(guiLai ? "báo giá gửi lại" : "báo giá mới", () -> {
            Integer donId = don.getId();
            String tenNcc = don.getNhaCungCap() == null || don.getNhaCungCap().getTenNhaCungCap() == null
                    || don.getNhaCungCap().getTenNhaCungCap().isBlank()
                    ? "Nhà cung cấp" : don.getNhaCungCap().getTenNhaCungCap().trim();
            BigDecimal tongTien = don.getTongTien();
            Integer khoId = don.getKhoNhap() == null ? null : don.getKhoNhap().getId();
            Integer nguoiGuiId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            Integer nguoiLapId = yc == null || yc.getNguoiTao() == null ? null : yc.getNguoiTao().getId();
            String soYc = yc == null ? null : so(yc);
            String soDon = don.getSoDonMua() == null || don.getSoDonMua().isBlank() ? null : don.getSoDonMua().trim();
            long moc = ngayBaoGia == null ? Instant.now().getEpochSecond() : ngayBaoGia.getEpochSecond();
            return new Lan("báo giá đơn mua " + donId, null, () -> {
                List<Integer> nhan = new ArrayList<>();
                boolean coNguoiChot = false;
                for (Integer id : new Integer[]{nguoiGuiId, nguoiLapId}) {
                    String vt = vaiTro(id);
                    // Vai trò không mở được màn báo giá (vd. nhân viên bán hàng lập yêu cầu): không gửi
                    if (id == null || !coVaiTro(VAI_TRO_XEM_BAO_GIA, vt)) continue;
                    nhan.add(id);
                    coNguoiChot |= coVaiTro(VAI_TRO_CHOT_BAO_GIA, vt);
                }
                // Không ai trong số đó chốt được báo giá (vd. nhân viên kho gửi yêu cầu): báo nhân viên mua hàng của kho nhập
                if (!coNguoiChot) {
                    nhan.addAll(nguoiNhan.hoacQuanTri(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_mua_hang),
                            "Báo giá đơn mua " + donId));
                }
                String tieuDe = tenNcc + (guiLai ? " đã gửi lại báo giá" : " đã gửi báo giá");
                List<String> cau = new ArrayList<>();
                if (soDon != null) cau.add("Đơn mua hàng " + soDon);
                if (soYc != null) cau.add(cau.isEmpty() ? "Yêu cầu nhập hàng " + soYc : "yêu cầu nhập hàng " + soYc);
                if (tongTien != null) cau.add("tổng " + tien(tongTien));
                String moTa = cau.isEmpty() ? "Xem báo giá." : String.join(", ", cau) + ".";
                return List.of(new GuiDi(nhan, null,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_INFO, tieuDe, moTa,
                                "/quotation/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId,
                                "DMH:" + donId + ":BAO_GIA:" + moc)));
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    /** Một lần gửi: mô tả cho log, người thao tác (chỉ để log) và phần soạn chạy sau commit. */
    private record Lan(String moTa, Integer nguoiThaoTac, Supplier<List<GuiDi>> lap) {}

    /** Chụp dữ liệu ngay (trong giao dịch nghiệp vụ), soạn và ghi sau commit. Không ném lỗi. */
    private void dangKy(String suKien, Supplier<Lan> chup) {
        try {
            Lan lan = chup.get();
            thongBaoService.guiSauCommit("Thông báo " + lan.moTa(), lan.lap());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo mua hàng ({}): {}", suKien, e.getMessage());
        }
    }

    /** Quản lý ghi trên kho (kho.quanLy, luật duyệt cũ) nếu còn hoạt động và đúng vai trò quản lý kho. */
    private Integer quanLyGhiTrenKho(Integer khoId) {
        if (khoId == null) return null;
        return khoRepository.findById(khoId)
                .map(k -> k.getQuanLy())
                .filter(n -> Objects.equals(n.getTrangThai(), 1) && IRoleType.quan_ly_kho.equals(n.getVaiTro()))
                .map(NguoiDung::getId)
                .orElse(null);
    }

    private static NoiDung noiDungDuyet(String tieuDe, String moTa, String duongDan, Integer id, Integer khoId, String khoa) {
        return new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_SUCCESS, tieuDe, moTa, duongDan,
                ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, id, khoId, khoa);
    }

    /** Set.of không nhận contains(null): vai trò trống (không tìm thấy người) coi như không thuộc nhóm. */
    private static boolean coVaiTro(Set<String> nhom, String vaiTro) {
        return vaiTro != null && nhom.contains(vaiTro);
    }

    /** Vai trò hiện tại của một người (null nếu không tìm thấy). */
    private String vaiTro(Integer nguoiDungId) {
        if (nguoiDungId == null) return null;
        return nguoiDungRepository.findById(nguoiDungId).map(NguoiDung::getVaiTro).orElse(null);
    }

    private String tenKho(Integer khoId) {
        if (khoId == null) return "kho";
        return khoRepository.findById(khoId).map(k -> k.getTenKho()).filter(t -> t != null && !t.isBlank())
                .map(String::trim).orElse("kho #" + khoId);
    }

    private static String so(YeuCauMuaHang yc) {
        return yc.getSoYeuCauMuaHang() != null && !yc.getSoYeuCauMuaHang().isBlank()
                ? yc.getSoYeuCauMuaHang().trim() : "#" + yc.getId();
    }

    /** 48500000 → "48.500.000 ₫" (làm tròn tới đồng, cùng cách ghi với giao diện). */
    static String tien(BigDecimal soTien) {
        DecimalFormatSymbols kyHieu = new DecimalFormatSymbols();
        kyHieu.setGroupingSeparator('.');
        DecimalFormat dinhDang = new DecimalFormat("#,##0", kyHieu);
        return dinhDang.format(soTien.setScale(0, RoundingMode.HALF_UP)) + " ₫";
    }
}
