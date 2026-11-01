package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.entities.DanhSachNhatHang;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.ChiTietNhatHangRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Thông báo của xuất kho bán hàng: giao phiếu nhặt, đơn bị hủy khi đang nhặt / chờ đóng gói, sàn hủy đơn đã xuất kho.
 * Service nghiệp vụ gọi ngay sau khi ghi xong; ở đây chỉ chụp các trường đã có trong bộ nhớ, tìm người nhận và ghi thông
 * báo chạy sau commit ({@link ThongBaoService#guiSauCommit}). Không bao giờ ném lỗi.
 * <pre>
 *   Sự kiện                                          Người nhận
 *   X2 Giao phiếu nhặt (tạo kèm người nhặt / phân công) Người được giao (tự nhận thì không); người bị đổi ra
 *   X3 Đơn bị hủy khi đang nhặt hoặc chờ đóng gói       Người nhặt; có hàng phải cất về kệ thì thêm quản lý kho xuất
 *                                                     (không có thì quản trị viên)
 *   B1 Sàn hủy đơn đã xuất kho (chưa hoàn trả)         Quản trị viên + quản lý kho xuất + người lập đơn (nếu có)
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoXuatKhoService {

    /** Giai đoạn của phiếu nhặt lúc đơn bị hủy. */
    public enum GiaiDoanHuy { DANG_NHAT, CHO_DONG_GOI }

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final DonBanHangRepository donBanHangRepository;
    private final ChiTietNhatHangRepository chiTietNhatHangRepository;

    /**
     * X2: phiếu nhặt vừa được giao cho {@code nguoiNhatMoiId} (lúc tạo phiếu hoặc phân công). Người được giao nhận "Bạn
     * được giao…"; người đang giữ phiếu trước đó (nếu khác) nhận "đã chuyển cho…". Người thao tác không nhận gì (tự nhận
     * phiếu thì không có thông báo). Khóa sự kiện kèm thời điểm: giao đi giao lại vẫn báo mỗi lần.
     */
    public void daGiaoPhieuNhat(DanhSachNhatHang pl, Integer nguoiNhatCuId, Integer nguoiNhatMoiId, Integer nguoiThaoTacId) {
        if (nguoiNhatMoiId == null || Objects.equals(nguoiNhatCuId, nguoiNhatMoiId)) return;
        dangKy("giao phiếu nhặt", () -> {
            Integer id = pl.getId();
            String ma = ma(pl);
            Integer khoId = pl.getKhoXuat() == null ? null : pl.getKhoXuat().getId();
            long moc = Instant.now().toEpochMilli();
            return new Lan("phiếu nhặt " + ma + " giao người nhặt", () -> {
                String tenKho = tenKho(khoId);
                List<String> cau = new ArrayList<>();
                cau.add(tenKho);
                // Đơn bị hủy vẫn nối với phiếu: không đếm
                long soDon = donBanHangRepository.findByDanhSachNhatHang_Id(id).stream()
                        .filter(d -> !Objects.equals(d.getTrangThai(), ITrangThaiDonBanHang.DA_HUY)).count();
                if (soDon > 0) cau.add(soDon + " đơn");
                BigDecimal tong = chiTietNhatHangRepository.findByDanhSachNhatHang_Id(id).stream()
                        .map(ct -> ct.getSoLuongCanNhat() == null ? BigDecimal.ZERO : ct.getSoLuongCanNhat())
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                if (tong.signum() > 0) cau.add(so(tong) + " sản phẩm");
                String duongDan = "/goods-issues/pick-lists/" + id;
                List<GuiDi> gui = new ArrayList<>();
                gui.add(new GuiDi(List.of(nguoiNhatMoiId), nguoiThaoTacId,
                        new NoiDung(ThongBaoService.LOAI_PHIEU_NHAT_HANG, ThongBaoService.TONE_INFO,
                                "Bạn được giao phiếu nhặt " + ma, String.join(", ", cau) + ". Bắt đầu nhặt hàng.",
                                duongDan, ThongBaoService.LOAI_PHIEU_NHAT_HANG, id, khoId,
                                "PL:" + id + ":GIAO:" + nguoiNhatMoiId + ":" + moc)));
                if (nguoiNhatCuId != null) {
                    String tenMoi = nguoiDungRepository.findById(nguoiNhatMoiId).map(NguoiDung::getHoTen)
                            .filter(t -> t != null && !t.isBlank()).map(String::trim).orElse("người khác");
                    gui.add(new GuiDi(List.of(nguoiNhatCuId), nguoiThaoTacId,
                            new NoiDung(ThongBaoService.LOAI_PHIEU_NHAT_HANG, ThongBaoService.TONE_INFO,
                                    "Phiếu nhặt " + ma + " đã chuyển cho " + tenMoi,
                                    "Bạn không cần nhặt phiếu này nữa.", duongDan,
                                    ThongBaoService.LOAI_PHIEU_NHAT_HANG, id, khoId,
                                    "PL:" + id + ":BO:" + nguoiNhatCuId + ":" + moc)));
                }
                return gui;
            });
        });
    }

    /**
     * X3: đơn {@code don} trong phiếu nhặt {@code pl} vừa bị hủy (sàn hủy). {@code catKeTheoMa}: mã SKU → số sản phẩm phải
     * cất lại kệ (đã quét thừa, hoặc cả đơn khi đã nhặt xong), đúng bằng các lệnh hoàn kệ vừa tạo; {@code caPhieuHuy}: mọi
     * đơn của phiếu đã hủy nên phiếu bị hủy theo. Người nhặt luôn nhận; có hàng phải cất về kệ thì thêm quản lý kho xuất
     * (không có thì quản trị viên) vì lệnh hoàn kệ chưa có màn hiển thị, nên câu thông báo ghi luôn mã nào, bao nhiêu.
     */
    public void donHuyTrongPhieuNhat(DanhSachNhatHang pl, DonBanHang don, GiaiDoanHuy giaiDoan,
                                     Map<String, BigDecimal> catKeTheoMa, boolean caPhieuHuy) {
        dangKy("đơn hủy trong phiếu nhặt", () -> {
            Integer id = pl.getId();
            String ma = ma(pl);
            Integer khoId = pl.getKhoXuat() == null ? null : pl.getKhoXuat().getId();
            Integer nguoiNhatId = pl.getNguoiNhat() == null ? null : pl.getNguoiNhat().getId();
            Integer donId = don.getId();
            String soDon = don.getSoDonHang() == null || don.getSoDonHang().isBlank() ? "#" + donId : don.getSoDonHang().trim();
            Map<String, BigDecimal> catKe = new LinkedHashMap<>();
            if (catKeTheoMa != null) {
                catKeTheoMa.forEach((sku, sl) -> {
                    if (sku != null && sl != null && sl.signum() > 0) catKe.merge(sku, sl, BigDecimal::add);
                });
            }
            return new Lan("đơn " + soDon + " hủy trong phiếu nhặt " + ma, () -> {
                List<Integer> nhan = new ArrayList<>();
                if (nguoiNhatId != null) nhan.add(nguoiNhatId);
                if (!catKe.isEmpty()) {
                    nhan.addAll(nguoiNhan.hoacQuanTri(nguoiNhan.quanLyKho(khoId), "Phiếu nhặt " + ma + " có hàng cần cất về kệ"));
                }
                String catCau = catKe.isEmpty() ? null : cauCatKe(catKe);
                String tieuDe;
                String moTa;
                if (caPhieuHuy) {
                    tieuDe = "Phiếu nhặt " + ma + " đã hủy";
                    moTa = "Mọi đơn trong phiếu đã bị hủy. "
                            + (giaiDoan == GiaiDoanHuy.CHO_DONG_GOI ? "Dừng đóng gói. " : "Dừng nhặt. ")
                            + (catCau != null ? catCau : "Không có hàng phải cất lại.");
                } else if (giaiDoan == GiaiDoanHuy.CHO_DONG_GOI) {
                    tieuDe = "Đơn " + soDon + " bị hủy lúc chờ đóng gói";
                    moTa = "Phiếu nhặt " + ma + ". Đơn không cần đóng gói nữa." + (catCau != null ? " " + catCau : "");
                } else {
                    tieuDe = "Đơn " + soDon + " bị hủy khi đang nhặt";
                    moTa = "Số cần nhặt của phiếu " + ma + " đã giảm." + (catCau != null ? " " + catCau : "");
                }
                return List.of(new GuiDi(nhan, null, new NoiDung(ThongBaoService.LOAI_PHIEU_NHAT_HANG,
                        ThongBaoService.TONE_WARNING, tieuDe, moTa, "/goods-issues/pick-lists/" + id,
                        ThongBaoService.LOAI_PHIEU_NHAT_HANG, id, khoId, "PL:" + id + ":DON_HUY:" + donId)));
            });
        });
    }

    /**
     * B1: sàn báo hủy một đơn đã xuất kho (đơn giữ nguyên, cần nhận hàng hoàn) → quản trị viên + quản lý kho xuất + người
     * lập đơn (đơn sàn thường không có). Đơn đã ở Hoàn trả (hàng đã về) thì không báo. Đồng bộ đơn chạy lại nhiều lần vẫn
     * chỉ một thông báo (khóa theo đơn).
     */
    public void sanHuyDonDaXuat(DonBanHang don, String lyDo) {
        if (don != null && Objects.equals(don.getTrangThai(), ITrangThaiDonBanHang.BI_HOAN_TRA)) return;
        dangKy("sàn hủy đơn đã xuất", () -> {
            Integer donId = don.getId();
            String soDon = don.getSoDonHang() == null || don.getSoDonHang().isBlank() ? "#" + donId : don.getSoDonHang().trim();
            Integer khoId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            Integer nguoiTaoId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            String tenKenh = don.getKenhBanHang() == null || don.getKenhBanHang().getTenKenh() == null
                    || don.getKenhBanHang().getTenKenh().isBlank() ? "Sàn" : don.getKenhBanHang().getTenKenh().trim();
            String lyDoGon = lyDoHuySan(lyDo);
            return new Lan("sàn hủy đơn đã xuất " + soDon, () -> {
                List<Integer> nhan = new ArrayList<>(nguoiNhan.quanTriVien());
                nhan.addAll(nguoiNhan.quanLyKho(khoId));
                if (nguoiTaoId != null) nhan.add(nguoiTaoId);
                String moTa = (lyDoGon.isEmpty() ? "" : "Lý do: " + lyDoGon + ". ")
                        + "Cần nhận lại hàng hoàn từ đơn vị giao hàng.";
                return List.of(new GuiDi(nhan, null, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                        ThongBaoService.TONE_DANGER, tenKenh + " hủy đơn " + soDon + " đã xuất kho", moTa,
                        "/sales-orders/" + donId, ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId,
                        "DBH:" + donId + ":SAN_HUY_DA_XUAT")));
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    private record Lan(String moTa, Supplier<List<GuiDi>> lap) {}

    /** Chụp dữ liệu ngay (trong giao dịch nghiệp vụ), soạn và ghi sau commit. Không ném lỗi. */
    private void dangKy(String suKien, Supplier<Lan> chup) {
        try {
            Lan lan = chup.get();
            thongBaoService.guiSauCommit("Thông báo " + lan.moTa(), lan.lap());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo xuất kho ({}): {}", suKien, e.getMessage());
        }
    }

    /** Tối đa 3 mã thì ghi từng mã: "Cất về kệ: POLO-X ×5, AO-Y ×2."; nhiều hơn thì "Cất 12 sản phẩm (5 mã) về kệ." */
    static String cauCatKe(Map<String, BigDecimal> catKe) {
        if (catKe.size() <= 3) {
            List<String> ds = new ArrayList<>();
            catKe.forEach((sku, sl) -> ds.add(sku + " ×" + so(sl)));
            return "Cất về kệ: " + String.join(", ", ds) + ".";
        }
        BigDecimal tong = catKe.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return "Cất " + so(tong) + " sản phẩm (" + catKe.size() + " mã) về kệ.";
    }

    private String tenKho(Integer khoId) {
        if (khoId == null) return "Kho";
        return khoRepository.findById(khoId).map(k -> k.getTenKho()).filter(t -> t != null && !t.isBlank())
                .map(String::trim).orElse("Kho #" + khoId);
    }

    private static String ma(DanhSachNhatHang pl) {
        return pl.getMaPickList() != null && !pl.getMaPickList().isBlank() ? pl.getMaPickList().trim() : "#" + pl.getId();
    }

    /** Mã lý do hủy của Shopify (cancel_reason) → câu tiếng Việt; "other" và mã lạ không ghi. */
    private static final Map<String, String> LY_DO_SHOPIFY = Map.of(
            "customer", "khách hủy",
            "fraud", "nghi gian lận",
            "inventory", "hết hàng",
            "declined", "thanh toán bị từ chối",
            "staff", "nhân viên shop hủy");

    /**
     * Lý do sàn gửi kèm → phần đáng đọc: bỏ tiền tố "Hủy từ sàn X:" mà job đồng bộ đơn tự thêm (chỉ còn tiền tố thì không
     * ghi gì), đổi mã lý do Shopify sang tiếng Việt, bỏ dấu chấm cuối.
     */
    static String lyDoHuySan(String lyDo) {
        String s = lyDo == null ? "" : lyDo.trim();
        if (s.toLowerCase(Locale.ROOT).startsWith("hủy từ sàn")) {
            int haiCham = s.indexOf(':');
            s = haiCham < 0 ? "" : s.substring(haiCham + 1).trim();
            String ma = s.toLowerCase(Locale.ROOT);
            if (ma.equals("other")) s = "";
            else if (LY_DO_SHOPIFY.containsKey(ma)) s = LY_DO_SHOPIFY.get(ma);
        }
        return s.replaceAll("[.\\s]+$", "");
    }

    /** Số lượng không kèm số 0 thừa: 3.000 → "3", 2.5 → "2,5". */
    static String so(BigDecimal sl) {
        return sl.stripTrailingZeros().toPlainString().replace('.', ',');
    }
}
