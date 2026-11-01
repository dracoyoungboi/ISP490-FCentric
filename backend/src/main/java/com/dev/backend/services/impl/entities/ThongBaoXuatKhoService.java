package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.DanhSachNhatHang;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Set;
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
 *   X1 Đơn gửi sang kho (tóm tắt DCX:{kho})            Quản lý kho + nhân viên kho của kho xuất: "N đơn chờ xuất"
 *   X4 Nhặt xong mà thiếu tồn theo lô (lỗi, rollback)  Quản lý kho xuất (không có thì quản trị viên), mỗi mã một lần/ngày
 *   X4b Tạo lại phiếu xuất còn dòng chưa đủ lô         Quản lý kho
 *   X5 Phiếu xuất bán hàng đã xuất kho                 Người lập đơn (đơn sàn không có người lập → không báo)
 *   B2 Khách yêu cầu hủy trên sàn (TikTok)            Quản trị viên (+ quản lý kho xuất khi đơn đã sang kho)
 *   B3 Đơn sàn mới chờ gửi sang kho (tóm tắt DSM:{mã}) Quản trị viên: "N đơn Shopify chờ gửi sang kho"
 *   B4 Đơn sàn thiếu dòng (một thông báo mỗi lượt)      Quản trị viên
 * </pre>
 * Tóm tắt: số đếm tính lại từ dữ liệu mỗi lần, hết việc thì tự đánh dấu đã đọc (ThongBaoService.capNhatTomTatSauCommit).
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
            String moc = ThongBaoService.mocDuyNhat();
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
        // Cả phiếu bị hủy: thông báo "thiếu tồn theo lô" của phiếu (nếu có) không còn việc gì để làm
        if (caPhieuHuy && pl != null) phieuNhatDaHoanTat(pl.getId());
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
                if (nguoiTaoId != null) nhan.add(nguoiTaoId);
                String moTa = (lyDoGon.isEmpty() ? "" : "Lý do: " + lyDoGon + ". ")
                        + "Nhận lại hàng hoàn rồi bấm Ghi nhận hoàn trả.";
                return List.of(new GuiDi(nhan, null, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                        ThongBaoService.TONE_DANGER, tenKenh + " hủy đơn " + soDon + " đã xuất kho", moTa,
                        "/sales-orders/" + donId, ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId,
                        "DBH:" + donId + ":SAN_HUY_DA_XUAT")));
            });
        });
    }

    /**
     * X1: đơn {@code don} vừa gửi sang kho → dòng tóm tắt "N đơn chờ xuất ở {kho}" của quản lý kho + nhân viên kho hiện lại
     * chưa đọc. Đơn sàn thì dòng "N đơn {kênh} chờ gửi sang kho" của quản trị viên giảm theo.
     */
    public void donGuiSangKho(DonBanHang don, Integer nguoiThaoTacId) {
        try {
            Integer khoId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            String soDon = soDon(don);
            tomTatDonChoXuat(khoId, soDon, true, nguoiThaoTacId);
            if (don.getKenhBanHang() != null) lamMoiDonSanCho(don.getKenhBanHang());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đơn chờ xuất: {}", e.getMessage());
        }
    }

    /** Số đơn chờ xuất của kho vừa đổi (tạo phiếu nhặt, hủy đơn): chỉ sửa số, hết đơn thì đánh dấu đã đọc. */
    public void lamMoiDonChoXuat(Integer khoId) {
        try {
            tomTatDonChoXuat(khoId, null, false, null);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không làm mới được thông báo đơn chờ xuất: {}", e.getMessage());
        }
    }

    private void tomTatDonChoXuat(Integer khoId, String soDonMoi, boolean baoMoi, Integer nguoiThaoTacId) {
        if (khoId == null) return;
        String khoa = "DCX:" + khoId;
        thongBaoService.capNhatTomTatSauCommit("Thông báo đơn chờ xuất kho " + khoId, () -> {
            long n = donBanHangRepository.demDonChoXuat(khoId);
            if (n <= 0) {
                return ThongBaoService.TomTat.hetViec(khoa, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                        ThongBaoService.TONE_INFO, "Không còn đơn chờ xuất ở " + tenKho(khoId),
                        "Các đơn đã vào phiếu nhặt hoặc đã hủy.", "/goods-issues/pending-orders", ThongBaoService.LOAI_DON_BAN_HANG,
                        null, khoId, khoa));
            }
            List<Integer> nhan = new ArrayList<>(nguoiNhan.quanLyKho(khoId));
            nhan.addAll(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_kho));
            String moTa = (soDonMoi == null ? "" : "Mới nhất: đơn " + soDonMoi + ". ") + "Tạo phiếu nhặt để xuất hàng.";
            return new ThongBaoService.TomTat(khoa, nguoiNhan.hoacQuanTri(nhan, "Đơn chờ xuất kho " + khoId), nguoiThaoTacId,
                    new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG, ThongBaoService.TONE_INFO,
                            n + " đơn chờ xuất ở " + tenKho(khoId), moTa, "/goods-issues/pending-orders",
                            ThongBaoService.LOAI_DON_BAN_HANG, null, khoId, khoa),
                    baoMoi);
        });
    }

    /**
     * B3: lượt lấy đơn của kênh vừa tạo đơn mới ở Nháp → dòng tóm tắt "N đơn {kênh} chờ gửi sang kho" của quản trị viên
     * hiện lại chưa đọc. Chỉ quản trị viên gửi được đơn sàn sang kho (đơn sàn không có người lập).
     */
    public void donSanMoi(KenhBanHang kenh) {
        try {
            tomTatDonSanCho(kenh, true);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đơn sàn mới: {}", e.getMessage());
        }
    }

    /** Số đơn sàn chờ gửi sang kho vừa đổi (gửi sang kho, hủy): chỉ sửa số, hết đơn thì đánh dấu đã đọc. */
    public void lamMoiDonSanCho(KenhBanHang kenh) {
        try {
            tomTatDonSanCho(kenh, false);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không làm mới được thông báo đơn sàn: {}", e.getMessage());
        }
    }

    private void tomTatDonSanCho(KenhBanHang kenh, boolean baoMoi) {
        if (kenh == null || kenh.getId() == null) return;
        Integer kenhId = kenh.getId();
        String ma = maKenh(kenh);
        String ten = tenKenh(kenh);
        String khoa = "DSM:" + ma;
        thongBaoService.capNhatTomTatSauCommit("Thông báo đơn " + ten + " chờ gửi sang kho", () -> {
            long n = donBanHangRepository.demDonSanChoGuiKho(kenhId);
            String duongDan = "/sales-orders?kenh=" + ma.toLowerCase(Locale.ROOT) + "&trangThai=nhap";
            if (n <= 0) {
                return ThongBaoService.TomTat.hetViec(khoa, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                        ThongBaoService.TONE_INFO, "Không còn đơn " + ten + " chờ gửi sang kho",
                        "Mọi đơn đã gửi sang kho hoặc đã hủy.", duongDan, ThongBaoService.LOAI_DON_BAN_HANG, null, null, khoa));
            }
            return new ThongBaoService.TomTat(khoa, nguoiNhan.quanTriVien(), null,
                    new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG, ThongBaoService.TONE_INFO,
                            n + " đơn " + ten + " chờ gửi sang kho", "Gửi đơn sang kho để nhặt hàng.", duongDan,
                            ThongBaoService.LOAI_DON_BAN_HANG, null, null, khoa),
                    baoMoi);
        });
    }

    /** Một đơn sàn của lượt lấy đơn bị thiếu dòng: mã SKU chưa liên kết → số lượng, hoặc không lấy được dòng hàng nào. */
    public record DonThieuDong(String soDon, Map<String, Integer> skuThieu, boolean khongLayDuocDong) {}

    /**
     * B4: lượt lấy đơn của kênh có đơn thiếu dòng (dòng có SKU chưa liên kết bị bỏ, hoặc không lấy được dòng hàng) → dòng
     * tóm tắt SKU:{mã}:{ngày} của quản trị viên ghi theo lượt mới nhất và hiện lại chưa đọc.
     */
    public void donSanThieuDong(KenhBanHang kenh, List<DonThieuDong> cacDon) {
        if (kenh == null || cacDon == null || cacDon.isEmpty()) return;
        try {
            String ma = maKenh(kenh);
            String ten = tenKenh(kenh);
            Map<String, Integer> tongSku = new LinkedHashMap<>();
            List<String> soDon = new ArrayList<>();
            int khongLayDuoc = 0;
            for (DonThieuDong d : cacDon) {
                if (d == null) continue;
                if (d.soDon() != null && !d.soDon().isBlank()) soDon.add(d.soDon().trim());
                if (d.khongLayDuocDong()) khongLayDuoc++;
                if (d.skuThieu() != null) d.skuThieu().forEach((sku, sl) -> {
                    if (sku != null && sl != null) tongSku.merge(sku, sl, Integer::sum);
                });
            }
            int tong = cacDon.size();
            List<String> cau = new ArrayList<>();
            cau.add("Đơn " + String.join(", ", soDon.stream().limit(3).toList())
                    + (soDon.size() > 3 ? " và " + (soDon.size() - 3) + " đơn khác" : "") + ".");
            if (!tongSku.isEmpty()) {
                List<String> ds = new ArrayList<>();
                tongSku.entrySet().stream().limit(3).forEach(e -> ds.add(e.getKey() + " ×" + e.getValue()));
                cau.add("SKU chưa liên kết: " + String.join(", ", ds)
                        + (tongSku.size() > 3 ? " và " + (tongSku.size() - 3) + " mã khác" : "") + ".");
            }
            if (khongLayDuoc > 0) cau.add(khongLayDuoc + " đơn không lấy được dòng hàng.");
            cau.add("Liên kết SKU để đơn sau đủ dòng; kiểm tra các đơn này trước khi gửi sang kho.");
            // Một dòng mỗi kênh mỗi ngày: lượt mới có đơn thiếu dòng thì sửa chữ theo lượt đó và hiện lại chưa đọc
            // (kênh còn SKU chưa liên kết mà phút nào cũng có đơn mới không sinh hàng trăm dòng)
            String khoa = "SKU:" + ma + ":" + NGAY_KHOA.format(Instant.now());
            NoiDung nd = new NoiDung(ThongBaoService.LOAI_KENH_BAN_HANG, ThongBaoService.TONE_WARNING,
                    tong + " đơn " + ten + " thiếu dòng hàng", String.join(" ", cau),
                    "/channels/" + ma.toLowerCase(Locale.ROOT) + "/products",
                    ThongBaoService.LOAI_KENH_BAN_HANG, kenh.getId(), null, khoa);
            thongBaoService.capNhatTomTatSauCommit("Thông báo đơn " + ten + " thiếu dòng",
                    () -> new ThongBaoService.TomTat(khoa, nguoiNhan.quanTriVien(), null, nd, true));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đơn sàn thiếu dòng: {}", e.getMessage());
        }
    }

    /**
     * B2: khách yêu cầu hủy đơn trên sàn (TikTok) → quản trị viên (xử lý trên sàn); thêm quản lý kho xuất khi đơn đã sang
     * kho (chờ nhặt / đóng gói) vì đơn đang bị chặn nhặt và xuất. Đơn đã hủy / đã xuất thì không báo. Gắn cờ một lần nên
     * khóa theo đơn.
     */
    public void khachYeuCauHuy(DonBanHang don, KenhBanHang kenh) {
        Integer tt = don == null ? null : don.getTrangThai();
        if (tt == null || !Set.of(0, 1, 7, 8).contains(tt)) return;
        dangKy("khách yêu cầu hủy", () -> {
            Integer donId = don.getId();
            String soDon = soDon(don);
            Integer khoId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            // Tên kênh lấy từ kênh của job (đã nạp): đơn có sẵn là bản tách rời, đọc don.getKenhBanHang() ném lỗi tải chậm
            String ten = kenh == null ? "sàn" : tenKenh(kenh);
            boolean daSangKho = tt != 0;
            return new Lan("khách yêu cầu hủy " + soDon, () -> {
                String tieuDe = "Khách yêu cầu hủy đơn " + soDon;
                String khoa = "DBH:" + donId + ":KHACH_YEU_CAU_HUY";
                String duongDan = "/sales-orders/" + donId;
                List<GuiDi> gui = new ArrayList<>();
                // Chỉ quản trị viên xử lý được trên sàn; quản lý kho chỉ cần dừng tay
                gui.add(new GuiDi(nguoiNhan.quanTriVien(), null, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                        ThongBaoService.TONE_WARNING, tieuDe,
                        (daSangKho ? "Đơn đang bị chặn nhặt và xuất. " : "") + "Xử lý yêu cầu hủy trên " + ten + ".",
                        duongDan, ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId, khoa)));
                if (daSangKho) {
                    gui.add(new GuiDi(nguoiNhan.quanLyKho(khoId), null, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                            ThongBaoService.TONE_WARNING, tieuDe,
                            "Tạm dừng nhặt và đóng gói đơn này, chờ quản trị viên xử lý trên " + ten + ".",
                            duongDan, ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId, khoa)));
                }
                return gui;
            });
        });
    }

    /**
     * X4: hoàn tất nhặt bị chặn vì tồn theo lô không đủ (thao tác ném lỗi, giao dịch hoàn tác) → quản lý kho xuất, gửi sau
     * khi hoàn tác (ThongBaoService.guiSauRollback). Bấm lại nhiều lần trong ngày chỉ một thông báo mỗi mã. Chỉ nhận giá
     * trị đã chụp, không đọc thực thể.
     */
    public void thieuTonTheoLo(Integer phieuNhatId, String maPhieuNhat, Integer khoId, Integer bienTheId, String sku,
                               BigDecimal can, BigDecimal co, Integer nguoiThaoTacId) {
        if (phieuNhatId == null) return;
        try {
            String ma = maPhieuNhat == null || maPhieuNhat.isBlank() ? "#" + phieuNhatId : maPhieuNhat.trim();
            String maSku = sku == null || sku.isBlank() ? "#" + bienTheId : sku.trim();
            String ngay = NGAY_KHOA.format(Instant.now());
            thongBaoService.guiSauRollback("Thông báo phiếu nhặt " + ma + " thiếu tồn theo lô", () -> List.of(
                    new GuiDi(nguoiNhan.hoacQuanTri(nguoiNhan.quanLyKho(khoId), "Phiếu nhặt " + ma + " thiếu tồn theo lô"),
                            nguoiThaoTacId, new NoiDung(ThongBaoService.LOAI_PHIEU_NHAT_HANG, ThongBaoService.TONE_WARNING,
                            "Phiếu nhặt " + ma + " thiếu tồn theo lô",
                            maSku + ": cần " + so(can == null ? BigDecimal.ZERO : can) + ", theo lô còn "
                                    + so(co == null ? BigDecimal.ZERO : co) + ". Phân bổ lại lô hoặc kiểm kê, rồi báo người nhặt.",
                            "/goods-issues/pick-lists/" + phieuNhatId, ThongBaoService.LOAI_PHIEU_NHAT_HANG, phieuNhatId,
                            khoId, "PL:" + phieuNhatId + ":THIEU_LO:" + bienTheId + ":" + ngay))));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo thiếu tồn theo lô: {}", e.getMessage());
        }
    }

    /** Phiếu nhặt đã hoàn tất: các thông báo "thiếu tồn theo lô" của phiếu coi như đã xử lý. */
    public void phieuNhatDaHoanTat(Integer phieuNhatId) {
        if (phieuNhatId == null) return;
        try {
            thongBaoService.daXuLyTheoTienToSauCommit("PL:" + phieuNhatId + ":THIEU_LO:");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được phiếu nhặt đã hoàn tất: {}", e.getMessage());
        }
    }

    /** X4b: tạo lại phiếu xuất mà còn dòng chưa đủ lô → quản lý kho sửa lô trước khi xuất. */
    public void phieuXuatCanSuaLo(Integer phieuId, String soPhieu, DonBanHang don, Integer khoId, List<String> skus,
                                  Integer nguoiThaoTacId) {
        if (phieuId == null || skus == null || skus.isEmpty()) return;
        dangKy("phiếu xuất cần sửa lô", () -> {
            String so = soPhieu == null || soPhieu.isBlank() ? "#" + phieuId : soPhieu.trim();
            String soDon = don == null ? null : soDon(don);
            List<String> ds = skus.stream().filter(Objects::nonNull).limit(5).toList();
            String moTa = (soDon == null ? "" : "Đơn " + soDon + ": ") + String.join(", ", ds)
                    + (skus.size() > 5 ? " và " + (skus.size() - 5) + " mã khác" : "") + " chưa đủ lô. Chọn lô cho các dòng thiếu trước khi xuất.";
            return new Lan("phiếu xuất " + so + " cần sửa lô", () -> List.of(new GuiDi(
                    nguoiNhan.hoacQuanTri(nguoiNhan.quanLyKho(khoId), "Phiếu xuất " + so + " cần sửa lô"), nguoiThaoTacId,
                    new NoiDung(ThongBaoService.LOAI_PHIEU_XUAT_KHO, ThongBaoService.TONE_WARNING,
                            "Phiếu xuất " + so + " chưa đủ lô", moTa, "/goods-issues/" + phieuId,
                            ThongBaoService.LOAI_PHIEU_XUAT_KHO, phieuId, khoId, "PXK:" + phieuId + ":CAN_SUA_LO"))));
        });
    }

    /** Phiếu xuất đã xuất kho hoặc bị hủy: thông báo "cần sửa lô" coi như đã xử lý. */
    public void phieuXuatDaXong(Integer phieuId) {
        if (phieuId == null) return;
        try {
            thongBaoService.daXuLySauCommit("PXK:" + phieuId + ":CAN_SUA_LO");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được phiếu xuất đã xong: {}", e.getMessage());
        }
    }

    /**
     * X5: phiếu xuất bán hàng vừa xuất kho → người lập đơn (nhân viên bán hàng) để xác nhận đã giao. Đơn sàn không có người
     * lập nên không báo. Đơn xuất một phần (dữ liệu cũ) chỉ báo, không nhắc xác nhận giao (chỉ đơn đã xuất đủ mới xác nhận
     * được).
     */
    public void daXuatKho(Integer phieuId, String soPhieu, DonBanHang don, Integer trangThaiDon, String maVanDon,
                          Integer nguoiThaoTacId) {
        if (phieuId == null || don == null || don.getNguoiTao() == null) return;
        dangKy("đã xuất kho", () -> {
            Integer donId = don.getId();
            String soDon = soDon(don);
            Integer nguoiTaoId = don.getNguoiTao().getId();
            Integer khoId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            boolean du = Objects.equals(trangThaiDon, ITrangThaiDonBanHang.DA_XUAT_TOAN_BO);
            String so = soPhieu == null || soPhieu.isBlank() ? "#" + phieuId : soPhieu.trim();
            String vanDon = maVanDon == null || maVanDon.isBlank() ? "" : ", mã vận đơn " + maVanDon.trim();
            return new Lan("đơn " + soDon + " đã xuất kho", () -> List.of(new GuiDi(List.of(nguoiTaoId), nguoiThaoTacId,
                    new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG, du ? ThongBaoService.TONE_SUCCESS : ThongBaoService.TONE_INFO,
                            "Đơn " + soDon + (du ? " đã xuất kho" : " đã xuất một phần"),
                            (du ? "Bấm Xác nhận đã giao khi khách nhận hàng. " : "") + "Phiếu xuất " + so + vanDon + ".",
                            "/sales-orders/" + donId, ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId,
                            "DBH:" + donId + ":DA_XUAT:" + phieuId))));
        });
    }

    /**
     * Đơn vừa được ghi nhận hoàn trả (đã xuất, khách / sàn trả lại): kho xuất cần lập phiếu nhập hoàn trả để cộng lại tồn →
     * quản lý kho + nhân viên kho của kho xuất (không có ai thì quản trị viên). Thông báo "sàn hủy đơn đã xuất" và "đã xuất
     * kho, bấm Xác nhận đã giao" của đơn coi như xong.
     */
    public void donHoanTra(DonBanHang don, Integer nguoiThaoTacId) {
        if (don == null || don.getId() == null) return;
        try {
            thongBaoService.daXuLySauCommit("DBH:" + don.getId() + ":SAN_HUY_DA_XUAT");
            thongBaoService.daXuLyTheoTienToSauCommit("DBH:" + don.getId() + ":DA_XUAT:");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn hoàn trả: {}", e.getMessage());
        }
        dangKy("đơn hoàn trả", () -> {
            Integer donId = don.getId();
            String soDon = soDon(don);
            Integer khoId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            return new Lan("đơn " + soDon + " hoàn trả", () -> {
                List<Integer> nhan = new ArrayList<>(nguoiNhan.quanLyKho(khoId));
                nhan.addAll(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_kho));
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nhan, "Đơn " + soDon + " hoàn trả"), nguoiThaoTacId,
                        new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG, ThongBaoService.TONE_WARNING,
                                "Đơn " + soDon + " bị hoàn trả",
                                "Khi hàng về " + tenKho(khoId) + ", lập phiếu nhập hoàn trả để cộng lại tồn.",
                                "/goods-receipts/create", ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId,
                                "DBH:" + donId + ":HOAN_TRA")));
            });
        });
    }

    /** Đã lập phiếu nhập hoàn trả cho đơn: thông báo "đơn bị hoàn trả" coi như xong. */
    public void daLapPhieuNhapHoanTra(Integer donId) {
        if (donId == null) return;
        try {
            thongBaoService.daXuLySauCommit("DBH:" + donId + ":HOAN_TRA");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn đã nhập hoàn trả: {}", e.getMessage());
        }
    }

    /** Đơn đã giao (Xác nhận đã giao): lời nhắc X5 của đơn coi như xong. */
    public void donDaGiao(Integer donId) {
        if (donId == null) return;
        try {
            thongBaoService.daXuLyTheoTienToSauCommit("DBH:" + donId + ":DA_XUAT:");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn đã giao: {}", e.getMessage());
        }
    }

    /** Đơn đã hủy: thông báo "khách yêu cầu hủy" (B2) của đơn coi như xong. */
    public void donDaHuy(Integer donId) {
        if (donId == null) return;
        try {
            thongBaoService.daXuLySauCommit("DBH:" + donId + ":KHACH_YEU_CAU_HUY");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn đã hủy: {}", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    private static final DateTimeFormatter NGAY_KHOA = DateTimeFormatter.ofPattern("yyyyMMdd")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private static String soDon(DonBanHang don) {
        return don.getSoDonHang() == null || don.getSoDonHang().isBlank() ? "#" + don.getId() : don.getSoDonHang().trim();
    }

    private static String maKenh(KenhBanHang kenh) {
        return kenh.getMaKenh() == null || kenh.getMaKenh().isBlank() ? String.valueOf(kenh.getId()) : kenh.getMaKenh().trim();
    }

    /** Tên sàn như giao diện ghi (Shopify, Lazada, TikTok Shop), không lấy tên tự đặt trong CSDL. */
    private static String tenKenh(KenhBanHang kenh) {
        return KenhBanHangServiceImpl.tenSan(maKenh(kenh));
    }

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
