package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Dựng từng mẫu bằng engine Thymeleaf thật (đặc tả 7.1 "Dựng từng mẫu", có sửa theo soát chéo): không sót "{{",
 * không "null", escape giá trị người dùng nhập, "FCentric" chỉ trong cụm cho phép, mỗi thông tin cửa hàng một lần,
 * tổng số lượng chỉ khi cùng đơn vị tính, các biến thể theo vai trò / trạng thái / dữ liệu thiếu.
 */
class MauEmailTest {

    private static final Instant YEU_CAU = Instant.parse("2026-10-19T02:12:00Z");
    private static final Instant HET_HAN = Instant.parse("2026-10-19T02:17:00Z");
    private static final String TEN_DANG_KY = "Công ty TNHH Thời trang Linh Lan";
    private static final String MST = "0109123456";
    private static final String EMAIL_CUA_HANG = "lienhe@linhlan.vn";
    private static final String TAI_XE = "Nguyễn Văn Hùng · biển số 30K-288.23";

    private final MauEmailFixture f = new MauEmailFixture();

    // ---------------- Dữ liệu ----------------

    record BienThe(String ten, LoaiEmail loai, Consumer<EmailNghiepVuServiceImpl> goi) {
        @Override
        public String toString() {
            return ten;
        }
    }

    static DonMuaHang voiTrangThai(DonMuaHang d, int trangThai) {
        d.setTrangThai(trangThai);
        return d;
    }

    static Stream<BienThe> moiBienThe() {
        List<BienThe> ds = new ArrayList<>();
        ds.add(new BienThe("E1", LoaiEmail.E1,
                s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "482913", YEU_CAU, HET_HAN)));
        for (String vt : List.of("nhan_vien_kho", "quan_ly_kho", "nhan_vien_ban_hang", "nhan_vien_mua_hang",
                "quan_tri_vien")) {
            ds.add(new BienThe("E2 " + vt, LoaiEmail.E2,
                    s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu(vt), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET)));
        }
        ds.add(new BienThe("E3", LoaiEmail.E3, s -> s.guiCapLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), MauEmailFixture.MA_LIEN_KET, YEU_CAU,
                MauEmailFixture.HET_HAN_LIEN_KET)));
        ds.add(new BienThe("E3 khóa", LoaiEmail.E3, s -> {
            NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
            nd.setTrangThai(0);
            s.guiCapLaiMatKhau(nd, MauEmailFixture.MA_LIEN_KET, YEU_CAU,
                MauEmailFixture.HET_HAN_LIEN_KET);
        }));
        for (CachDoiMatKhau c : CachDoiMatKhau.values()) {
            ds.add(new BienThe("M4 " + c, LoaiEmail.M4,
                    s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), c, YEU_CAU)));
        }
        ds.add(new BienThe("E4", LoaiEmail.E4, s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false))));
        ds.add(new BienThe("E5", LoaiEmail.E5, s -> s.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC,
                MauEmailFixture.TEN_NCC, "771204", Instant.parse("2026-10-19T07:27:00Z"))));
        ds.add(new BienThe("E5 không tên nhà cung cấp", LoaiEmail.E5, s -> s.guiMaDangNhapCong(
                MauEmailFixture.EMAIL_NCC, null, "771204", Instant.parse("2026-10-19T07:27:00Z"))));
        ds.add(new BienThe("E7", LoaiEmail.E7, s -> e7(s, MauEmailFixture.bienBan(), "GUI", null)));
        ds.add(new BienThe("E7 cập nhật", LoaiEmail.E7, s -> e7(s, MauEmailFixture.bienBan(), "CAP_NHAT", null)));
        ds.add(new BienThe("E7 nhắc hạn", LoaiEmail.E7, s -> e7(s, MauEmailFixture.bienBan(), "NHAC", null)));
        ds.add(new BienThe("E7 không đơn giá", LoaiEmail.E7, s -> {
            BienBanTraHangNcc bb = MauEmailFixture.bienBan();
            bb.getPhieuNhapKho().getDonMuaHang().getChiTietDonMuaHangs().get(1).setDonGia(null);
            e7(s, bb, "GUI", null);
        }));
        ds.add(new BienThe("E7 đã giao tài xế", LoaiEmail.E7,
                s -> e7(s, MauEmailFixture.bienBan("DA_TRA_HANG"), "GUI", TAI_XE)));
        ds.add(new BienThe("M5 giao bù, nhận lại", LoaiEmail.M5, s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(),
                MauEmailFixture.banDaTraLoi("DOI_HANG", "NHAN_LAI", "Trần Thị Thu Hà"), false)));
        ds.add(new BienThe("M5 trừ tiền, tiêu hủy", LoaiEmail.M5, s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(),
                MauEmailFixture.banDaTraLoi("TRU_CONG_NO", "TIEU_HUY", "Trần Thị Thu Hà"), false)));
        ds.add(new BienThe("M5 quá hạn, không người phụ trách", LoaiEmail.M5, s -> {
            BienBanTraHangNcc bb = MauEmailFixture.bienBan();
            bb.getPhieuNhapKho().getDonMuaHang().setNguoiTao(null);
            s.guiDaGhiNhanTraLoi(bb, MauEmailFixture.banQuaHan(), true);
        }));
        ds.add(new BienThe("M5 theo từng dòng", LoaiEmail.M5, s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(),
                banTheoDong(), false)));
        ds.add(new BienThe("M5 cần chọn lại cách bù", LoaiEmail.M5, s -> s.guiCanChonLaiCachBu(MauEmailFixture.bienBan(),
                banChonLai(), List.of(51))));
        ds.add(new BienThe("M6", LoaiEmail.M6, s -> s.guiBienBanDaHuy(MauEmailFixture.bienBan("DA_HUY"))));
        ds.add(new BienThe("M3", LoaiEmail.M3, s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(null))));
        ds.add(new BienThe("M3 ghi chú", LoaiEmail.M3,
                s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(MauEmailFixture.GHI_CHU))));
        ds.add(new BienThe("M1", LoaiEmail.M1,
                s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3))));
        ds.add(new BienThe("M1 ghi chú", LoaiEmail.M1,
                s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(MauEmailFixture.GHI_CHU), 3))));
        ds.add(new BienThe("M2 đã báo giá có lý do", LoaiEmail.M2, s -> {
            DonMuaHang d = voiTrangThai(MauEmailFixture.donDaBaoGia(null), 4);
            d.setLyDoTuChoi("Đơn giá cao hơn báo giá được chọn.");
            s.guiKetQuaBaoGia(d);
        }));
        ds.add(new BienThe("M2 đã báo giá không lý do", LoaiEmail.M2,
                s -> s.guiKetQuaBaoGia(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 4))));
        ds.add(new BienThe("M2 chưa báo giá", LoaiEmail.M2,
                s -> s.guiKetQuaBaoGia(voiTrangThai(MauEmailFixture.don(false), 4))));
        ds.add(new BienThe("M2 chưa báo giá có lý do", LoaiEmail.M2, s -> {
            DonMuaHang d = voiTrangThai(MauEmailFixture.don(false), 4);
            d.setLyDoTuChoi("Không dùng");
            s.guiKetQuaBaoGia(d);
        }));
        // dữ liệu thiếu: các nhánh colspan, dòng th:unless, câu liên hệ dự phòng
        ds.add(new BienThe("E2 vai trò lạ", LoaiEmail.E2,
                s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu("vai_tro_la"), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET)));
        ds.add(new BienThe("E4 không ngày giao, dòng thiếu thuộc tính hoặc SKU", LoaiEmail.E4,
                s -> s.guiYeuCauBaoGia(dongThieu(khongNgayGiao(MauEmailFixture.don(false))))));
        ds.add(new BienThe("M1 không ngày giao, không người phụ trách", LoaiEmail.M1, s -> {
            DonMuaHang d = khongNgayGiao(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3));
            d.setNguoiTao(null);
            s.guiXacNhanDatHang(d);
        }));
        return ds.stream();
    }

    /** E7 với bản DTO mẫu (chờ chọn cả hai việc), hạn 28/10/2026. */
    static void e7(EmailNghiepVuServiceImpl s, BienBanTraHangNcc bb, String loai, String moTaHangLoi) {
        s.guiBienBanTraHang(bb, MauEmailFixture.ban(), loai, MauEmailFixture.HAN_TRA_LOI, moTaHangLoi, null, null);
    }

    static DonMuaHang khongNgayGiao(DonMuaHang d) {
        d.setNgayGiaoDuKien(null);
        return d;
    }

    /** Dòng 901 không có SKU, dòng 902 không có màu và cỡ. */
    static DonMuaHang dongThieu(DonMuaHang d) {
        for (var ct : d.getChiTietDonMuaHangs()) {
            if (ct.getId() == 901) {
                ct.getBienTheSanPham().setMaSku(null);
            } else if (ct.getId() == 902) {
                ct.getBienTheSanPham().setMauSac(null);
                ct.getBienTheSanPham().setSize(null);
            }
        }
        return d;
    }

    private BanThu dung(BienThe b, CuaHangEmail ch) {
        return f.dung(b.goi(), ch);
    }

    /** Chữ hiện ra trong thân email (bỏ head, thẻ, giải mã thực thể). Gồm cả dòng xem trước ẩn. */
    static String chuHien(String html) {
        String than = html.replaceAll("(?s)<head>.*?</head>", " ");
        than = than.replaceAll("(?s)<[^>]+>", " ");
        return HtmlUtils.htmlUnescape(than).replaceAll("\\s+", " ");
    }

    static int dem(String chu, String tim) {
        int n = 0;
        for (int i = chu.indexOf(tim); i >= 0; i = chu.indexOf(tim, i + tim.length())) {
            n++;
        }
        return n;
    }

    // ---------------- Quy tắc chung cho mọi mẫu ----------------

    @ParameterizedTest(name = "{0}")
    @MethodSource("moiBienThe")
    void quyTacChung(BienThe b) {
        BanThu thu = dung(b, MauEmailFixture.cuaHang());
        String html = thu.html();
        String text = thu.text();
        for (String ban : List.of(html, text)) {
            assertFalse(ban.contains("{{"), b + ": còn {{");
            assertFalse(ban.contains("${"), b + ": còn ${");
            assertFalse(Pattern.compile("\\bnull\\b").matcher(ban).find(), b + ": có chữ null");
            assertFalse(ban.contains("chỉ dành cho người nhận"), b.ten());
            String boCumChoPhep = ban.replaceAll("(?i)(phần mềm|tài khoản|Đăng nhập|Mật khẩu|Mã đặt lại mật khẩu|trên)"
                    + " FCentric", "");
            assertFalse(boCumChoPhep.contains("FCentric"), b + ": FCentric ngoài cụm cho phép");
        }
        assertTrue(html.contains("<html lang=\"vi\""), b + ": lang=vi");
        assertTrue(html.contains("max-width:600px"), b + ": khung 600px");
        assertTrue(html.contains("display:none"), b + ": dòng xem trước ẩn");
        assertFalse(Pattern.compile("\\sth:[a-z]").matcher(html).find(), b + ": còn thuộc tính Thymeleaf");

        String chu = chuHien(html);
        assertEquals(1, dem(chu, TEN_DANG_KY), b + ": tên đăng ký đúng 1 lần");
        assertEquals(1, dem(text, TEN_DANG_KY), b + ": tên đăng ký đúng 1 lần (txt)");
        assertTrue(chu.contains("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội"), b + ": có địa chỉ đăng ký");
        int soLanMstEmail = b.loai().nhaCungCap() ? 1 : 0;
        assertEquals(soLanMstEmail, dem(chu, MST), b + ": mã số thuế");
        assertEquals(soLanMstEmail, dem(text, MST), b + ": mã số thuế (txt)");
        assertEquals(soLanMstEmail, dem(chu, EMAIL_CUA_HANG), b + ": email cửa hàng");
        assertEquals(soLanMstEmail, dem(text, EMAIL_CUA_HANG), b + ": email cửa hàng (txt)");
        // tên cửa hàng chỉ ở đầu email (phần ký không lặp tên cửa hàng); tiêu đề E4, M1 nằm ở <title>, không tính
        assertEquals(1, dem(chu, "Thời trang Linh Lan") - dem(chu, TEN_DANG_KY), b + ": tên cửa hàng chỉ ở đầu email");
    }

    @Test
    void tieuDe_theoDacTaMuc1() {
        Map<String, String> mong = new LinkedHashMap<>();
        mong.put("E1", "Mã đặt lại mật khẩu FCentric");
        mong.put("E2 nhan_vien_kho", "Tài khoản FCentric của bạn đã được tạo");
        mong.put("E3", "Đặt lại mật khẩu tài khoản FCentric");
        mong.put("M4 DAT_LAI_BANG_MA", "Mật khẩu FCentric của bạn vừa được thay đổi");
        mong.put("E4", "Yêu cầu báo giá PO202610195101 – Thời trang Linh Lan");
        mong.put("E5", "Mã đăng nhập Cổng nhà cung cấp");
        mong.put("E7", "Biên bản trả hàng RTV-20261021-003 – Thời trang Linh Lan");
        mong.put("E7 cập nhật", "Biên bản trả hàng RTV-20261021-003 đã cập nhật – Thời trang Linh Lan");
        mong.put("E7 nhắc hạn", "Nhắc trả lời biên bản trả hàng RTV-20261021-003 – Thời trang Linh Lan");
        mong.put("M5 giao bù, nhận lại", "Đã ghi nhận trả lời biên bản RTV-20261021-003");
        mong.put("M5 quá hạn, không người phụ trách",
                "Biên bản trả hàng RTV-20261021-003 quá hạn trả lời: đã chuyển trừ tiền");
        mong.put("M6", "Biên bản trả hàng RTV-20261021-003 đã hủy");
        mong.put("M3", "Đã nhận báo giá đơn PO202610195101");
        mong.put("M1", "Xác nhận đặt hàng PO202610195101 – Thời trang Linh Lan");
        mong.put("M2 đã báo giá có lý do", "Kết quả báo giá đơn PO202610195101");
        mong.put("M2 chưa báo giá", "Yêu cầu báo giá đơn PO202610195101 đã kết thúc");
        Map<String, BienThe> theoTen = new HashMap<>();
        moiBienThe().forEach(b -> theoTen.put(b.ten(), b));
        mong.forEach((ten, tieuDe) -> assertEquals(tieuDe,
                dung(theoTen.get(ten), MauEmailFixture.cuaHang()).tieuDe(), ten));

        // cửa hàng chưa có tên: E4, M1 không có đuôi tên
        assertEquals("Yêu cầu báo giá PO202610195101", dung(theoTen.get("E4"), CuaHangEmail.TRONG).tieuDe());
        // tiêu đề email chứa mã không chứa mã
        assertFalse(dung(theoTen.get("E1"), MauEmailFixture.cuaHang()).tieuDe().contains("482913"));
        assertFalse(dung(theoTen.get("E5"), MauEmailFixture.cuaHang()).tieuDe().contains("771204"));
    }

    @Test
    void dongXemTruoc_vaKhongCoNutDangNhapTrongEmailChuaMa() {
        BanThu e1 = f.dung(s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "482913",
                YEU_CAU, HET_HAN), MauEmailFixture.cuaHang());
        assertTrue(e1.html().contains("Mã có hiệu lực 5 phút, đến 09:17 ngày 19/10/2026. Bỏ qua email này nếu bạn không yêu cầu."));
        assertTrue(chuHien(e1.html()).contains("lúc 09:12 ngày 19/10/2026"));
        assertTrue(chuHien(e1.html()).contains("Hiệu lực đến 09:17 ngày 19/10/2026 · Chỉ dùng được một lần"));
        assertFalse(e1.html().contains("<a "), "E1 không có nút hay liên kết");
        BanThu e5 = f.dung(s -> s.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC, MauEmailFixture.TEN_NCC,
                "771204", Instant.parse("2026-10-19T07:27:00Z")), MauEmailFixture.cuaHang());
        assertFalse(e5.html().contains("Gửi báo giá</a>"), "E5 không có nút");
        assertFalse(e5.html().contains("<a href=\"https"), "E5 không có liên kết");
        assertTrue(e5.html().contains("Mã có hiệu lực 5 phút, đến 14:27 ngày 19/10/2026. Không đưa mã này cho người khác."));
    }

    @Test
    void e5_dangNhapTheoEmail_khongNhacDon_khongMoiTraLoi() {
        BanThu e5 = f.dung(s -> s.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC, MauEmailFixture.TEN_NCC,
                "771204", Instant.parse("2026-10-19T07:27:00Z")), MauEmailFixture.cuaHang());
        // không có người phụ trách riêng: Trả lời tới là email cửa hàng, chân thư không mời trả lời (thư chứa mã)
        assertEquals(EMAIL_CUA_HANG, e5.traLoiToi().email());
        for (String ban : List.of(chuHien(e5.html()), e5.text())) {
            assertTrue(ban.contains("Kính gửi Xưởng May Hoàng Anh,"), ban);
            assertTrue(ban.contains("đăng nhập Cổng nhà cung cấp bằng email " + MauEmailFixture.EMAIL_NCC), ban);
            assertTrue(ban.contains("báo giá cho các đơn đang chờ, chọn cách xử lý biên bản trả hàng"));
            assertTrue(ban.contains("771204"));
            assertFalse(ban.contains(MauEmailFixture.MA_DON), "E5 không nhắc đơn");
            assertFalse(ban.contains("Trả lời email này"));
            assertFalse(ban.contains("Cần hỗ trợ"));
            assertFalse(ban.contains("Trân trọng"), "không có phần ký người phụ trách");
        }
        BanThu khongTen = f.dung(s -> s.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC, " ", "771204",
                Instant.parse("2026-10-19T07:27:00Z")), MauEmailFixture.cuaHang());
        assertTrue(chuHien(khongTen.html()).contains("Kính gửi Quý công ty,"));
        assertTrue(khongTen.text().contains("Kính gửi Quý công ty,"));
    }

    // ---------------- E7, M5, M6 biên bản trả hàng ----------------

    @Test
    void e7_theoDemo_giaTriTuDonGiaDongDon_dongXepTheoId_haiViecCanChon() {
        String d = DinhDangEmail.KY_HIEU_DONG;
        BanThu thu = f.dung(s -> e7(s, MauEmailFixture.bienBan(), "GUI", null), MauEmailFixture.cuaHang());
        String chu = chuHien(thu.html());
        assertTrue(chu.contains("Biên bản trả hàng RTV-20261021-003 Kính gửi Xưởng May Hoàng Anh,"), chu);
        assertTrue(chu.contains("Khi nhận hàng đơn PO202610195101 , chúng tôi kiểm thấy 4 sản phẩm không đạt chất lượng ."
                + " Biên bản trả hàng đính kèm thư này. Kính đề nghị Quý công ty trả lời trên Cổng nhà cung cấp"
                + " trước hết ngày 28/10/2026 ."), chu);
        assertTrue(chu.contains("Giá trị hàng lỗi 645.000" + d + " 4 sản phẩm · phiếu nhập PN202610210004"), chu);
        assertTrue(chu.contains("Hàng lỗi đang ở Kho tổng Lô B2, KCN Quang Minh, xã Quang Minh, Hà Nội"), chu);
        assertTrue(thu.html().contains("href=\"https://fcentric.net/supplier/login?bienBan=12&amp;email="
                + "lan.tran%40xuongmayhoanganh.vn\""));
        assertTrue(chu.contains("Trả lời biên bản Bấm nút, nhận mã xác nhận 6 số qua email này, rồi chọn."), chu);
        assertTrue(chu.contains("Sản phẩm · lý do Giá trị (₫)"));
        int i1 = chu.indexOf("1. Áo polo nam cơ bản Trắng · M · APL-NAM-TRANG-M Lỗi phụ liệu · 2 cái × 145.000 290.000");
        int i2 = chu.indexOf("2. Áo polo nam cơ bản Xanh navy · L · APL-NAM-NAVY-L Rách vải · 1 cái × 145.000 145.000");
        int i3 = chu.indexOf("3. Quần kaki nam slim Be · 31 · QKK-NAM-BE-31 Ố bẩn · 1 cái × 210.000 210.000");
        assertTrue(i1 > 0 && i1 < i2 && i2 < i3, chu);
        assertTrue(chu.contains("Tổng cộng · 4 cái 645.000"));
        // Hai việc nhà cung cấp phải chọn: cách bù và hàng lỗi còn ở kho
        assertTrue(chu.contains("Quý công ty cần chọn Bù hàng lỗi Giao bù hàng: Quý công ty giao lại 4 sản phẩm đạt;"
                + " đơn PO202610195101 vẫn chờ nhận số này."), chu);
        assertTrue(chu.contains("Trừ tiền hàng: không giao lại; đơn giảm 4 sản phẩm và trừ 645.000" + d
                + " khi thanh toán."), chu);
        assertTrue(chu.contains("Hàng lỗi đang ở kho của chúng tôi Nhận lại: Quý công ty đến lấy hoặc nhờ chúng tôi gửi"
                + " đơn vị vận chuyển. Đồng ý tiêu hủy: chúng tôi tiêu hủy, Quý công ty không cần lấy về."), chu);
        assertTrue(chu.contains("Quá hạn mà chưa chọn cách bù, chúng tôi từ chối nhận số hàng lỗi này và trừ tiền hàng"
                + " khi thanh toán. Hàng lỗi vẫn giữ ở kho của chúng tôi; chúng tôi chỉ tiêu hủy khi Quý công ty đồng ý."),
                chu);
        assertTrue(chu.contains("Trân trọng, Phạm Thu Hà Nhân viên mua hàng 0912 345 678 · ha.pham@linhlan.vn"), chu);
        assertEquals("ha.pham@linhlan.vn", thu.traLoiToi().email(), "Trả lời tới người tạo đơn mua");
        assertTrue(chu.contains("Trả lời email này để liên hệ trực tiếp người phụ trách đơn."));
        assertFalse(chu.contains("đã cập nhật"));
        assertEquals(3, dem(thu.html(), "<tr class=\"dong-sp\">"));
        assertTrue(thu.html().contains("Trả lời trên Cổng nhà cung cấp trước hết ngày 28/10/2026."), "dòng xem trước");

        String text = thu.text();
        assertTrue(text.contains("Kính đề nghị Quý công ty trả lời trên Cổng nhà cung cấp trước hết ngày 28/10/2026."),
                text);
        assertTrue(text.contains("Giá trị hàng lỗi: 645.000" + d + " (4 sản phẩm) · phiếu nhập PN202610210004"), text);
        assertTrue(text.contains("Hàng lỗi đang ở: Kho tổng, Lô B2, KCN Quang Minh"), text);
        assertTrue(text.contains("Trả lời biên bản: https://fcentric.net/supplier/login?bienBan=12&email="
                + "lan.tran%40xuongmayhoanganh.vn"), text);
        assertTrue(text.contains("1. Áo polo nam cơ bản (Trắng · M · APL-NAM-TRANG-M): Lỗi phụ liệu · 2 cái × 145.000"
                + " = 290.000"), text);
        assertTrue(text.contains("Tổng cộng: 4 cái, 645.000" + d), text);
        assertTrue(text.contains("Bù hàng lỗi:\n- Giao bù hàng:"), text);
        assertTrue(text.contains("Hàng lỗi đang ở kho của chúng tôi:\n- Nhận lại:"), text);
        assertTrue(text.indexOf("1. Áo polo") < text.indexOf("3. Quần kaki"));
    }

    @Test
    void e7_capNhat_cauTraLoiTruocKhongConHieuLuc() {
        BanThu thu = f.dung(s -> e7(s, MauEmailFixture.bienBan(), "CAP_NHAT", null), MauEmailFixture.cuaHang());
        for (String ban : List.of(chuHien(thu.html()), thu.text())) {
            assertTrue(ban.contains("Biên bản trả hàng RTV-20261021-003 đã cập nhật"), ban);
            assertTrue(ban.contains("Câu trả lời trước đây cho biên bản này (nếu có) không còn hiệu lực"), ban);
            assertTrue(ban.contains("Kính đề nghị Quý công ty trả lời lại trước hết ngày 28/10/2026"), ban);
            assertFalse(ban.contains("Khi nhận hàng đơn"));
        }
    }

    @Test
    void e7_nhacHan_neuHanVaDangCho() {
        BanThu thu = f.dung(s -> e7(s, MauEmailFixture.bienBan(), "NHAC", null), MauEmailFixture.cuaHang());
        assertEquals("Nhắc trả lời biên bản trả hàng RTV-20261021-003 – Thời trang Linh Lan", thu.tieuDe());
        for (String ban : List.of(chuHien(thu.html()), thu.text())) {
            assertTrue(ban.contains("Nhắc trả lời biên bản trả hàng RTV-20261021-003"), ban);
            assertTrue(ban.contains("Biên bản trả hàng RTV-20261021-003 (đơn PO202610195101, 4 sản phẩm không đạt) vẫn"
                    + " đang chờ Quý công ty trả lời. Hạn trả lời: hết ngày 28/10/2026"), ban);
            assertFalse(ban.contains("Khi nhận hàng đơn"));
            assertFalse(ban.contains("đã cập nhật"));
        }
    }

    @Test
    void e7_daChonHet_khongConKhoiCanChon() {
        BanThu thu = f.dung(s -> s.guiBienBanTraHang(MauEmailFixture.bienBan(),
                MauEmailFixture.banDaTraLoi("DOI_HANG", "NHAN_LAI", "Hà"), "GUI", MauEmailFixture.HAN_TRA_LOI, null,
                null, null), MauEmailFixture.cuaHang());
        for (String ban : List.of(chuHien(thu.html()), thu.text())) {
            assertFalse(ban.contains("Quý công ty cần chọn"), ban);
            assertFalse(ban.contains("Quá hạn mà chưa chọn cách bù"), ban);
            assertTrue(ban.contains("Hàng lỗi đang ở kho của chúng tôi, xử lý theo lựa chọn Quý công ty đã gửi."), ban);
        }
    }

    @Test
    void e7_khongCoDonGia_boCotTien_chiSoLuong() {
        BienBanTraHangNcc bb = MauEmailFixture.bienBan();
        // bỏ giá dòng 902 (Áo polo navy L, có trong biên bản) thì cả thư bỏ phần tiền
        bb.getPhieuNhapKho().getDonMuaHang().getChiTietDonMuaHangs().stream().filter(ct -> ct.getId() == 902)
                .findFirst().orElseThrow().setDonGia(null);
        BanThu thu = f.dung(s -> e7(s, bb, "GUI", null), MauEmailFixture.cuaHang());
        String chu = chuHien(thu.html());
        assertFalse(chu.contains("₫"), chu);
        assertFalse(thu.text().contains("₫"));
        assertTrue(chu.contains("Sản phẩm không đạt 4 cái phiếu nhập PN202610210004"), chu);
        assertTrue(chu.contains("Sản phẩm · lý do Số lượng"));
        assertTrue(chu.contains("1. Áo polo nam cơ bản Trắng · M · APL-NAM-TRANG-M Lỗi phụ liệu 2 cái"), chu);
        assertTrue(chu.contains("Tổng số lượng 4 cái"));
        assertTrue(chu.contains("đơn giảm 4 sản phẩm và trừ tiền theo đơn giá của đơn khi thanh toán."));
        assertTrue(thu.text().contains("1. Áo polo nam cơ bản (Trắng · M · APL-NAM-TRANG-M): Lỗi phụ liệu · 2 cái\n"),
                thu.text());
        assertTrue(thu.text().contains("Sản phẩm không đạt: 4 sản phẩm · phiếu nhập PN202610210004"), thu.text());
    }

    @Test
    void e7_daGiaoTaiXe_oThuHaiGhiTaiXe_khongGhiKho() {
        BanThu thu = f.dung(s -> e7(s, MauEmailFixture.bienBan("DA_TRA_HANG"), "GUI", TAI_XE),
                MauEmailFixture.cuaHang());
        String chu = chuHien(thu.html());
        assertTrue(chu.contains("Hàng lỗi Đã giao trả Nguyễn Văn Hùng · biển số 30K-288.23"), chu);
        assertFalse(chu.contains("Lô B2"));
        assertTrue(thu.text().contains("Hàng lỗi: Đã giao trả, Nguyễn Văn Hùng · biển số 30K-288.23"), thu.text());

        // không truyền mô tả: bỏ dòng phụ
        String khongMoTa = chuHien(f.dung(s -> e7(s, MauEmailFixture.bienBan("DA_TRA_HANG"), "GUI", null),
                MauEmailFixture.cuaHang()).html());
        assertTrue(khongMoTa.contains("Hàng lỗi Đã giao trả Trả lời biên bản"), khongMoTa);
    }

    @Test
    void e7_cauKetQuaKy_daKy_benVanChuyen_chuaCoThiBo() {
        com.dev.backend.dto.response.inbound.BienBanTraHangDto daKy = MauEmailFixture.ban();
        daKy.setNguoiGiao("Lê Văn Tài");
        daKy.setBenKy("DAI_DIEN_NCC");
        daKy.setBienSoXe("29C-123.45");
        daKy.setKyBienBan("DA_KY");
        daKy.setThoiDiemKy(Instant.parse("2026-10-21T03:40:00Z"));
        BanThu thu = f.dung(s -> s.guiBienBanTraHang(MauEmailFixture.bienBan(), daKy, "GUI", MauEmailFixture.HAN_TRA_LOI,
                null, null, null), MauEmailFixture.cuaHang());
        String cau = "Đại diện của Quý công ty Lê Văn Tài, biển số 29C-123.45 đã ký biên bản này lúc 10:40 ngày"
                + " 21/10/2026; bản giấy có chữ ký lưu tại kho của chúng tôi.";
        assertTrue(chuHien(thu.html()).contains(cau), chuHien(thu.html()));
        assertTrue(thu.text().contains(cau), thu.text());
        String chu = chuHien(thu.html());
        assertTrue(chu.indexOf("Khi nhận hàng đơn") < chu.indexOf(cau), "câu ký ngay sau câu mở đầu");

        com.dev.backend.dto.response.inbound.BienBanTraHangDto vc = MauEmailFixture.ban();
        vc.setNguoiGiao("Lê Văn Tài");
        vc.setBenKy("VAN_CHUYEN");
        vc.setDonViVanChuyen("GHN");
        vc.setKyBienBan("DA_KY");
        BanThu thuVc = f.dung(s -> s.guiBienBanTraHang(MauEmailFixture.bienBan(), vc, "GUI", MauEmailFixture.HAN_TRA_LOI,
                null, null, null), MauEmailFixture.cuaHang());
        for (String ban : List.of(chuHien(thuVc.html()), thuVc.text())) {
            assertTrue(ban.contains("Người giao hàng Lê Văn Tài của GHN đã ký xác nhận số hàng lỗi"), ban);
            assertTrue(ban.contains("Bên vận chuyển không đại diện cho Quý công ty."), ban);
        }

        // Biên bản cũ (không có bước ký): không có câu ký
        BanThu cu = f.dung(s -> e7(s, MauEmailFixture.bienBan(), "GUI", null), MauEmailFixture.cuaHang());
        assertFalse(cu.text().contains("ký biên bản này"), cu.text());
        assertFalse(chuHien(cu.html()).contains("người giao hàng ký biên bản"));
    }

    @Test
    void m5_giaoBuNhanLai_truTienTieuHuy_nguoiXacNhan_ghiChuDoi() {
        String d = DinhDangEmail.KY_HIEU_DONG;
        BanThu bu = f.dung(s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(),
                MauEmailFixture.banDaTraLoi("DOI_HANG", "NHAN_LAI", "Trần Thị Thu Hà"), false), MauEmailFixture.cuaHang());
        String chu = chuHien(bu.html());
        assertTrue(chu.contains("Đã ghi nhận trả lời biên bản RTV-20261021-003 Kính gửi Xưởng May Hoàng Anh,"), chu);
        assertTrue(chu.contains("Chúng tôi đã ghi nhận câu trả lời của Quý công ty cho biên bản trả hàng "
                + "RTV-20261021-003 (đơn PO202610195101)."), chu);
        assertFalse(chu.contains("đính kèm"), "M5 không kèm biên bản");
        assertTrue(chu.contains("Bù hàng lỗi Giao bù hàng Giao lại 4 sản phẩm đạt"), chu);
        assertTrue(chu.contains("Hàng lỗi Nhận lại hàng lỗi Quý công ty đến lấy hoặc nhờ chúng tôi gửi vận chuyển"), chu);
        assertFalse(chu.contains("645.000"), "giao bù thì không ghi số tiền");
        assertTrue(chu.contains("Người xác nhận: Trần Thị Thu Hà · Ghi nhận lúc 14:22 ngày 19/10/2026"), chu);
        assertTrue(chu.contains("Quý công ty còn đổi cách bù trên Cổng nhà cung cấp cho tới khi chúng tôi nhập kho phiếu"
                + " PN202610210004. Lựa chọn cho hàng lỗi đổi được trên Cổng nhà cung cấp cho tới khi chúng tôi giao trả"
                + " hoặc tiêu hủy. Cần đổi điều đã chốt, xin liên hệ người phụ trách đơn."), chu);
        assertTrue(bu.html().contains("href=\"https://fcentric.net/supplier/login?bienBan=12&amp;email="));
        assertTrue(chu.contains("Mở Cổng nhà cung cấp"));
        assertTrue(bu.html().contains("Đã ghi nhận: Giao bù hàng, Nhận lại hàng lỗi."), "dòng xem trước");
        assertTrue(bu.text().contains("Bù hàng lỗi: Giao bù hàng (Giao lại 4 sản phẩm đạt)\n"
                + "Hàng lỗi: Nhận lại hàng lỗi (Quý công ty đến lấy hoặc nhờ chúng tôi gửi vận chuyển)\n"
                + "Người xác nhận: Trần Thị Thu Hà\nGhi nhận lúc: 14:22 ngày 19/10/2026"), bu.text());

        BanThu tru = f.dung(s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(),
                MauEmailFixture.banDaTraLoi("TRU_CONG_NO", "TIEU_HUY", "Trần Thị Thu Hà"), false), MauEmailFixture.cuaHang());
        assertTrue(chuHien(tru.html()).contains("Bù hàng lỗi Trừ tiền hàng Trừ 645.000" + d + " khi thanh toán"
                + " Hàng lỗi Đồng ý tiêu hủy Chúng tôi tiêu hủy, Quý công ty không cần lấy về"), chuHien(tru.html()));
        assertTrue(tru.text().contains("Bù hàng lỗi: Trừ tiền hàng (Trừ 645.000" + d + " khi thanh toán)"), tru.text());
        assertTrue(tru.text().contains("Hàng lỗi: Đồng ý tiêu hủy (Chúng tôi tiêu hủy, Quý công ty không cần lấy về)"));
    }

    @Test
    void m5_quaHan_daChuyenTruTien_khongNguoiXacNhan_hangLoiVanCho() {
        BienBanTraHangNcc bb = MauEmailFixture.bienBan();
        bb.getPhieuNhapKho().getDonMuaHang().setNguoiTao(null);
        BanThu thu = f.dung(s -> s.guiDaGhiNhanTraLoi(bb, MauEmailFixture.banQuaHan(), true),
                MauEmailFixture.cuaHang());
        assertEquals("Biên bản trả hàng RTV-20261021-003 quá hạn trả lời: đã chuyển trừ tiền", thu.tieuDe());
        for (String ban : List.of(chuHien(thu.html()), thu.text())) {
            assertTrue(ban.contains("Biên bản RTV-20261021-003: đã chuyển trừ tiền"), ban);
            assertTrue(ban.contains("Biên bản trả hàng RTV-20261021-003 (đơn PO202610195101) đã quá hạn trả lời (hết ngày"
                    + " 28/10/2026) mà Quý công ty chưa chọn cách bù. Chúng tôi từ chối nhận 4 sản phẩm lỗi và trừ tiền"
                    + " hàng khi thanh toán."), ban);
            assertTrue(ban.contains("Hàng lỗi vẫn ở kho của chúng tôi. Vui lòng chọn nhận lại hoặc đồng ý tiêu hủy trên"
                    + " Cổng nhà cung cấp; chúng tôi chỉ tiêu hủy khi Quý công ty đồng ý."), ban);
            assertTrue(ban.contains("Cần đổi điều đã chốt, xin liên hệ chúng tôi."), ban);
            assertFalse(ban.contains("Người xác nhận"), "quá hạn: không có người xác nhận");
            assertFalse(ban.contains("Trân trọng"), "đơn không có người tạo: bỏ phần ký");
        }
        assertTrue(chuHien(thu.html()).contains("Hàng lỗi Chưa chọn Ghi nhận lúc 14:22 ngày 19/10/2026"),
                chuHien(thu.html()));
        assertTrue(thu.text().contains("Hàng lỗi: Chưa chọn\nGhi nhận lúc: 14:22 ngày 19/10/2026"), thu.text());
    }

    /** Dòng 51 (2 sp) trừ tiền + nhận lại, dòng 52 (1) giao bù + tiêu hủy, dòng 53 (1) giao bù + nhận lại. */
    private static com.dev.backend.dto.response.inbound.BienBanTraHangDto banTheoDong() {
        return MauEmailFixture.banTheoDong(new String[]{"TRU_CONG_NO", "DOI_HANG", "DOI_HANG"},
                new String[]{"NHAN_LAI", "TIEU_HUY", "NHAN_LAI"}, "Trần Thị Thu Hà");
    }

    /** Nhà cung cấp chọn trừ tiền cả 3 dòng, nhập kho không trừ được dòng 51 (về chờ chọn), dòng 52, 53 đã trừ. */
    private static com.dev.backend.dto.response.inbound.BienBanTraHangDto banChonLai() {
        com.dev.backend.dto.response.inbound.BienBanTraHangDto b = MauEmailFixture.banTheoDong(
                new String[]{null, "TRU_CONG_NO", "TRU_CONG_NO"}, new String[]{"NHAN_LAI", "NHAN_LAI", "NHAN_LAI"}, "Lan");
        b.getItems().get(0).setNguonCachBu("NHAP_KHO");
        b.setPhieuDaNhap(true);
        return b;
    }

    @Test
    void m5_theoTungDong_tomTatVaBangTungSanPham() {
        String d = DinhDangEmail.KY_HIEU_DONG;
        BanThu thu = f.dung(s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), banTheoDong(), false),
                MauEmailFixture.cuaHang());
        assertEquals("Đã ghi nhận trả lời biên bản RTV-20261021-003", thu.tieuDe());
        String chu = chuHien(thu.html());
        assertTrue(chu.contains("Bù hàng lỗi Theo từng sản phẩm Trừ 290.000" + d + " cho 2 sản phẩm, giao bù 2 sản phẩm"
                + " Hàng lỗi Theo từng sản phẩm Nhận lại 3 sản phẩm, đồng ý tiêu hủy 1 sản phẩm"), chu);
        assertTrue(chu.contains("Người xác nhận: Trần Thị Thu Hà · Ghi nhận lúc 14:22 ngày 19/10/2026"), chu);
        // Bảng từng sản phẩm: đủ 3 dòng, mỗi dòng cách bù + hàng lỗi riêng
        assertEquals(3, dem(thu.html(), "class=\"dong-sp\""), "mỗi dòng biên bản một hàng trong bảng");
        assertTrue(chu.contains("Sản phẩm lỗi Cách xử lý"), chu);
        assertTrue(chu.contains("Áo polo nam cơ bản Trắng · M · Lỗi phụ liệu · 2 sản phẩm Trừ tiền · 290.000" + d
                + " Hàng lỗi: Nhận lại"), chu);
        assertTrue(chu.contains("Xanh navy · L · Rách vải · 1 sản phẩm Giao bù Hàng lỗi: Đồng ý tiêu hủy"), chu);
        assertTrue(chu.contains("Quần kaki nam slim Be · 31 · Ố bẩn · 1 sản phẩm Giao bù Hàng lỗi: Nhận lại"), chu);
        assertFalse(thu.html().contains("#b45309"), "không có dòng cần chọn lại");
        assertTrue(thu.html().contains("Đã ghi nhận: Theo từng sản phẩm, Theo từng sản phẩm."), "dòng xem trước");

        assertTrue(thu.text().contains("Bù hàng lỗi: Theo từng sản phẩm (Trừ 290.000" + d
                + " cho 2 sản phẩm, giao bù 2 sản phẩm)\nHàng lỗi: Theo từng sản phẩm (Nhận lại 3 sản phẩm, đồng ý tiêu hủy 1 sản phẩm)"),
                thu.text());
        assertTrue(thu.text().contains("Từng sản phẩm lỗi:\n"
                + "- Áo polo nam cơ bản (Trắng · M) · Lỗi phụ liệu · 2 sản phẩm: Trừ tiền · 290.000" + d + " · hàng lỗi: Nhận lại\n"
                + "- Áo polo nam cơ bản (Xanh navy · L) · Rách vải · 1 sản phẩm: Giao bù · hàng lỗi: Đồng ý tiêu hủy\n"
                + "- Quần kaki nam slim (Be · 31) · Ố bẩn · 1 sản phẩm: Giao bù · hàng lỗi: Nhận lại\n"), thu.text());
    }

    @Test
    void m5_canChonLaiCachBu_chiDongVuot_khongKhungTomTat() {
        BanThu thu = f.dung(s -> s.guiCanChonLaiCachBu(MauEmailFixture.bienBan(), banChonLai(), List.of(51)),
                MauEmailFixture.cuaHang());
        assertEquals("Biên bản trả hàng RTV-20261021-003: cần chọn lại cách bù", thu.tieuDe());
        // Mã biên bản in đậm trong HTML: bỏ khoảng trắng chuHien chèn trước dấu phẩy
        for (String ban : List.of(chuHien(thu.html()).replace(" ,", ","), thu.text())) {
            assertTrue(ban.contains("Biên bản RTV-20261021-003: cần chọn lại cách bù"), ban);
            assertTrue(ban.contains("Khi nhập kho lô hàng của biên bản RTV-20261021-003, chúng tôi chưa trừ tiền được cho"
                    + " 2 sản phẩm lỗi Quý công ty chọn trừ tiền, vì đơn PO202610195101 không còn chờ đủ số này (đã có hàng"
                    + " giao ở đợt khác hoặc đang chờ nhập kho). Vui lòng chọn lại cách bù cho các sản phẩm ghi \"Cần chọn lại\" bên dưới trên Cổng"
                    + " nhà cung cấp trước hết ngày 28/10/2026."), ban);
            assertFalse(ban.contains("Bù hàng lỗi"), "thư chọn lại không có khung tóm tắt");
            assertFalse(ban.contains("Người xác nhận"), "không phải câu trả lời của nhà cung cấp");
            assertFalse(ban.contains("Đã ghi nhận trả lời"), ban);
        }
        String chu = chuHien(thu.html());
        assertEquals(3, dem(thu.html(), "class=\"dong-sp\""));
        assertTrue(chu.contains("Áo polo nam cơ bản Trắng · M · Lỗi phụ liệu · 2 sản phẩm Cần chọn lại Hàng lỗi: Nhận lại"), chu);
        assertTrue(chu.contains("Xanh navy · L · Rách vải · 1 sản phẩm Trừ tiền"), chu);
        assertEquals(1, dem(thu.html(), "#b45309"), "chỉ dòng cần chọn lại tô màu");
        assertTrue(chu.contains("Chọn lại trên Cổng nhà cung cấp"), chu);
        assertTrue(thu.html().contains("Cần chọn lại cách bù cho 2 sản phẩm lỗi."), "dòng xem trước");
        assertTrue(thu.text().contains("- Áo polo nam cơ bản (Trắng · M) · Lỗi phụ liệu · 2 sản phẩm: Cần chọn lại · hàng lỗi:"
                + " Nhận lại\n"), thu.text());
    }

    @Test
    void m5_quaHan_moiDongCoiNhuDaGiaoBu_khongNoiTruTien() {
        com.dev.backend.dto.response.inbound.BienBanTraHangDto ban = MauEmailFixture.banTheoDong(
                new String[]{"DOI_HANG", "DOI_HANG", "DOI_HANG"}, new String[]{null, null, null}, null);
        ban.getItems().forEach(it -> it.setNguonCachBu("TU_DONG"));
        BanThu thu = f.dung(s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), ban, true), MauEmailFixture.cuaHang());
        assertEquals("Biên bản trả hàng RTV-20261021-003 quá hạn trả lời", thu.tieuDe());
        for (String ban2 : List.of(chuHien(thu.html()), thu.text())) {
            assertTrue(ban2.contains("Biên bản RTV-20261021-003: quá hạn trả lời"), ban2);
            assertTrue(ban2.contains("mà Quý công ty chưa chọn cách bù."), ban2);
            assertFalse(ban2.contains("từ chối nhận"), "không dòng nào trừ tiền");
            assertFalse(ban2.contains("đã chuyển trừ tiền"), ban2);
            assertTrue(ban2.contains("4 sản phẩm lỗi coi như đã giao bù vì đơn PO202610195101 đã nhận đủ số này ở đợt"
                    + " giao khác, không trừ tiền."), ban2);
        }
        assertTrue(thu.html().contains("Quá hạn trả lời, hàng lỗi coi như đã giao bù."), "dòng xem trước");
    }

    @Test
    void m6_bienBanDaHuy() {
        BanThu thu = f.dung(s -> s.guiBienBanDaHuy(MauEmailFixture.bienBan("DA_HUY")), MauEmailFixture.cuaHang());
        for (String ban : List.of(chuHien(thu.html()), thu.text())) {
            assertTrue(ban.contains("Biên bản trả hàng RTV-20261021-003 đã hủy"), ban);
            assertTrue(ban.contains("lập ngày 21/10/2026 cho đơn PO202610195101 đã được hủy vì phiếu nhập "
                    + "PN202610210004 bị hủy hoặc không còn hàng lỗi."), ban);
            assertTrue(ban.contains("Quý công ty không cần xử lý biên bản này nữa."));
        }
        assertFalse(thu.html().contains("supplier/login"), "M6 không có nút");
    }

    // ---------------- E2 theo vai trò ----------------

    @Test
    void e2_duNamVaiTro_dongNoiLamViec_vaDongEmailNhaCungCap() {
        Map<String, String> nhan = Map.of("nhan_vien_kho", "Nhân viên kho", "quan_ly_kho", "Quản lý kho",
                "nhan_vien_ban_hang", "Nhân viên bán hàng", "nhan_vien_mua_hang", "Nhân viên mua hàng",
                "quan_tri_vien", "Quản trị viên");
        // SRS 4.4 "RFQ – Create / View / Process": chỉ nhân viên mua hàng (và quản trị viên) gửi yêu cầu báo giá, nên
        // chỉ họ được báo thông tin liên hệ của mình hiện trong email gửi nhà cung cấp. Viết tay, không đọc lại hằng số.
        Set<String> guiBaoGia = Set.of("quan_tri_vien", "nhan_vien_mua_hang");
        assertEquals(guiBaoGia, com.dev.backend.constant.variables.IRoleType.GUI_YEU_CAU_BAO_GIA,
                "dòng trong E2 phải theo cùng tập vai trò với API gửi yêu cầu báo giá");
        nhan.forEach((vt, ten) -> {
            BanThu thu = f.dung(s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu(vt), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET),
                    MauEmailFixture.cuaHang());
            String chu = chuHien(thu.html());
            assertTrue(chu.contains("Vai trò " + ten), vt);
            assertEquals(!vt.equals("quan_tri_vien"), chu.contains("Nơi làm việc và quyền của bạn"), vt);
            assertEquals(guiBaoGia.contains(vt), chu.contains("Khi bạn gửi yêu cầu báo giá"), vt);
            assertEquals(!vt.equals("quan_tri_vien"), thu.text().contains("Nơi làm việc và quyền của bạn"), vt);
            assertEquals(guiBaoGia.contains(vt), thu.text().contains("Khi bạn gửi yêu cầu báo giá"), vt);
            // Vai trò không gửi yêu cầu báo giá: không nhắc tới email gửi nhà cung cấp ở bất kỳ chỗ nào trong thư
            assertEquals(guiBaoGia.contains(vt), chu.contains("email gửi nhà cung cấp"), vt);
            assertEquals(guiBaoGia.contains(vt), thu.text().contains("email gửi nhà cung cấp"), vt);
            assertTrue(chu.contains("Tài khoản FCentric của bạn đã được tạo"), "tiêu đề trong thân trùng tiêu đề thư");
            assertLienKetDatMatKhau(thu, false);
        });
    }

    /** Sửa L4 (01/11/2026): E2, E3 không còn mật khẩu tạm, chỉ có liên kết đặt mật khẩu dùng một lần kèm hạn. */
    static void assertLienKetDatMatKhau(BanThu thu, boolean dangKhoa) {
        // chuHien thay mỗi thẻ bằng dấu cách: "…20/10/2026</strong>." thành "…20/10/2026 ."
        String chu = chuHien(thu.html()).replace(" .", ".");
        for (String ban : List.of(chu, thu.text())) {
            assertFalse(ban.toLowerCase(Locale.ROOT).contains("mật khẩu tạm"), "không còn mật khẩu tạm");
            assertTrue(ban.contains("Liên kết dùng được một lần, hết hạn lúc 14:22 ngày 20/10/2026."), ban);
            // tài khoản bị khóa không nhận được mã Quên mật khẩu: chỉ nhắc nhờ quản trị viên gửi lại
            assertEquals(!dangKhoa, ban.contains("Hết hạn thì dùng Quên mật khẩu ở trang đăng nhập, hoặc nhờ quản trị viên gửi lại."), ban);
            assertEquals(dangKhoa, ban.contains("Hết hạn thì nhờ quản trị viên gửi lại."), ban);
        }
        assertEquals(2, dem(thu.html(), "href=\"" + MauEmailFixture.LIEN_KET_DAT_MAT_KHAU + "\""), "nút + liên kết chữ");
        assertTrue(chu.contains("Đặt mật khẩu Liên kết dùng được"), "nút Đặt mật khẩu");
        assertTrue(chu.contains("Chép liên kết này vào trình duyệt: " + MauEmailFixture.LIEN_KET_DAT_MAT_KHAU));
        assertTrue(thu.text().contains("Đặt mật khẩu: " + MauEmailFixture.LIEN_KET_DAT_MAT_KHAU + "\n"));
        assertFalse(thu.html().contains("/login\""), "không còn nút Đăng nhập");
    }

    // ---------------- E3, M4 ----------------

    @Test
    void e3_coVaKhongCoKhungTamKhoa_coLienKetDatMatKhau() {
        NguoiDung khoa = MauEmailFixture.nhanSu("nhan_vien_kho");
        khoa.setTrangThai(0);
        BanThu thuKhoa = f.dung(s -> s.guiCapLaiMatKhau(khoa, MauEmailFixture.MA_LIEN_KET, YEU_CAU,
                MauEmailFixture.HET_HAN_LIEN_KET), MauEmailFixture.cuaHang());
        BanThu thuKhongKhoa = f.dung(s -> s.guiCapLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                MauEmailFixture.MA_LIEN_KET, YEU_CAU, MauEmailFixture.HET_HAN_LIEN_KET), MauEmailFixture.cuaHang());
        String coKhoa = chuHien(thuKhoa.html());
        String khongKhoa = chuHien(thuKhongKhoa.html());
        assertTrue(coKhoa.contains("Tài khoản đang tạm khóa"));
        assertTrue(thuKhoa.text().contains("Tài khoản đang tạm khóa"));
        assertFalse(khongKhoa.contains("Tài khoản đang tạm khóa"));
        assertFalse(thuKhongKhoa.text().contains("Tài khoản đang tạm khóa"));
        assertLienKetDatMatKhau(thuKhoa, true);
        assertLienKetDatMatKhau(thuKhongKhoa, false);
        String cauCapLai = "Quản trị viên đã đặt lại mật khẩu cho tài khoản minhanh lúc 09:12 ngày 19/10/2026. Mật khẩu cũ "
                + "không còn dùng được và các thiết bị đang đăng nhập đã bị đăng xuất.";
        assertTrue(khongKhoa.contains(cauCapLai));
        assertTrue(thuKhongKhoa.text().contains(cauCapLai));
        assertTrue(thuKhongKhoa.html().contains("Đặt mật khẩu mới trước 14:22 ngày 20/10/2026."), "dòng xem trước");
    }

    @Test
    void m4_baCachThayDoi_khongCoMatKhau() {
        String bangMa = chuHien(f.dung(s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                CachDoiMatKhau.DAT_LAI_BANG_MA, YEU_CAU), MauEmailFixture.cuaHang()).html());
        String daDangNhap = chuHien(f.dung(s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                CachDoiMatKhau.DOI_KHI_DA_DANG_NHAP, YEU_CAU), MauEmailFixture.cuaHang()).html());
        String lienKet = chuHien(f.dung(s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                CachDoiMatKhau.DAT_QUA_LIEN_KET, YEU_CAU), MauEmailFixture.cuaHang()).html());
        assertTrue(bangMa.contains("Cách thay đổi Đặt lại bằng mã gửi qua email"));
        assertTrue(daDangNhap.contains("Cách thay đổi Đổi khi đã đăng nhập"));
        assertTrue(lienKet.contains("Cách thay đổi Đặt bằng liên kết gửi qua email"));
        assertTrue(bangMa.contains("Tài khoản minhanh"));
        assertFalse(bangMa.contains("Mật khẩu tạm"));
    }

    // ---------------- Email nhà cung cấp ----------------

    @Test
    void dongXepTheoIdDong_skuKhongNgat_tongSoLuongCungDonVi() {
        for (BanThu thu : List.of(
                f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), MauEmailFixture.cuaHang()),
                f.dung(s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(null)), MauEmailFixture.cuaHang()),
                f.dung(s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3)),
                        MauEmailFixture.cuaHang()))) {
            String chu = chuHien(thu.html());
            int dong1 = chu.indexOf("Trắng · M · APL-NAM-TRANG-M");
            int dong4 = chu.indexOf("Đen · S · ATN-NU-DEN-S");
            assertTrue(dong1 > 0 && dong4 > dong1, thu.tieuDe() + ": dòng theo id tăng dần");
            // SKU một khối: máy tính giữ trên một dòng (khối min-width), màn hẹp và ứng dụng bỏ khối style thì được ngắt
            assertTrue(thu.html().contains("<span class=\"sku\">APL-NAM-TRANG-M</span>"), thu.tieuDe() + ": SKU một khối");
            assertTrue(Pattern.compile("@media only screen and \\(min-width:481px\\) \\{\\s*\\.bang-sp \\.sku\\{white-space:nowrap;\\}")
                    .matcher(thu.html()).find(), thu.tieuDe() + ": SKU không ngắt trên máy tính");
            assertTrue(chu.contains("360 cái"), thu.tieuDe() + ": tổng số lượng khi cùng đơn vị tính");
            assertTrue(chu.contains("120 cái"), thu.tieuDe());
            assertTrue(thu.text().contains("1. Áo polo nam cơ bản (Trắng · M · APL-NAM-TRANG-M): 120 cái"));
        }
    }

    @Test
    void donViTinhKhacNhau_khongCoTongSoLuong() {
        Consumer<DonMuaHang> tronBo = d -> d.getChiTietDonMuaHangs().stream()
                .filter(ct -> ct.getId() == 903).findFirst().orElseThrow()
                .getBienTheSanPham().getSanPham().setDonViTinh("Bộ");
        DonMuaHang e4 = MauEmailFixture.don(false);
        tronBo.accept(e4);
        DonMuaHang m3 = MauEmailFixture.donDaBaoGia(null);
        tronBo.accept(m3);
        DonMuaHang m1 = voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3);
        tronBo.accept(m1);

        String chuE4 = chuHien(f.dung(s -> s.guiYeuCauBaoGia(e4), MauEmailFixture.cuaHang()).html());
        assertFalse(chuE4.contains("Tổng số lượng"));
        assertTrue(chuE4.contains("60 bộ"));
        assertTrue(chuE4.contains("4 mặt hàng, giao tại Kho tổng"), "xem trước đếm dòng");
        for (BanThu thu : List.of(f.dung(s -> s.guiDaNhanBaoGia(m3), MauEmailFixture.cuaHang()),
                f.dung(s -> s.guiXacNhanDatHang(m1), MauEmailFixture.cuaHang()))) {
            String chu = chuHien(thu.html());
            assertFalse(chu.contains("360"), thu.tieuDe() + ": không cộng cái với bộ");
            assertTrue(chu.contains("Tổng cộng 51.400.000\u00A0₫"), thu.tieuDe() + ": vẫn có tổng tiền");
            assertTrue(thu.text().contains("Tổng cộng: 51.400.000\u00A0₫"));
        }
    }

    @Test
    void tienCoKhoangTrangKhongNgat_bangChuChiOM1() {
        String m1 = chuHien(f.dung(s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3)),
                MauEmailFixture.cuaHang()).html());
        // khoảng trắng KHÔNG NGẮT trước ₫ (không để ₫ rơi xuống dòng riêng)
        assertTrue(m1.contains("51.400.000\u00A0₫"));
        assertFalse(m1.contains("51.400.000 ₫"));
        assertTrue(m1.contains("Bằng chữ: Năm mươi mốt triệu bốn trăm nghìn đồng."));
        String m3 = chuHien(f.dung(s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(null)),
                MauEmailFixture.cuaHang()).html());
        assertFalse(m3.contains("Bằng chữ"));
    }

    @Test
    void m3m1_coVaKhongCoGhiChu() {
        for (boolean coGhiChu : new boolean[]{true, false}) {
            String ghiChu = coGhiChu ? MauEmailFixture.GHI_CHU : null;
            String m3 = chuHien(f.dung(s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(ghiChu)),
                    MauEmailFixture.cuaHang()).html());
            String m1 = chuHien(f.dung(s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(ghiChu), 3)),
                    MauEmailFixture.cuaHang()).html());
            assertEquals(coGhiChu, m3.contains("Ghi chú trong báo giá của Quý công ty: " + MauEmailFixture.GHI_CHU));
            assertEquals(coGhiChu, m1.contains("Ghi chú trong báo giá của Quý công ty: " + MauEmailFixture.GHI_CHU));
        }
        String m3 = chuHien(f.dung(s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(null)),
                MauEmailFixture.cuaHang()).html());
        assertTrue(m3.contains("Chúng tôi nhận được lúc 14:35 ngày 19/10/2026"));
    }

    @Test
    void m1_ngayDatHang_bangChuDuoiTong_thayMatBenMua() {
        BanThu m1 = f.dung(s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3)),
                MauEmailFixture.cuaHang());
        String chu = chuHien(m1.html());
        assertTrue(chu.contains("Ngày đặt hàng 19/10/2026"), "ngày đặt hàng nằm trong thân thư, không chỉ ở dòng xem trước");
        assertTrue(m1.text().contains("Ngày đặt hàng: 19/10/2026"));
        assertTrue(chu.contains("Tổng cộng · 360 cái 51.400.000 ₫ Bằng chữ: Năm mươi mốt triệu"), "bằng chữ ngay dưới tổng");
        assertTrue(chu.contains("Trân trọng, Thay mặt bên mua Phạm Thu Hà"));
        assertTrue(m1.text().contains("Trân trọng,\nThay mặt bên mua\nPhạm Thu Hà"));
        assertTrue(chu.contains("Vui lòng trả lời email này trước khi giao hàng."));
        assertFalse(chuHien(f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), MauEmailFixture.cuaHang()).html())
                .contains("Thay mặt"), "chỉ M1 ký thay mặt");

        // không có Trả lời tới (không người phụ trách, cửa hàng không có email): điều 5 không mời trả lời
        DonMuaHang khongNguoiTao = voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3);
        khongNguoiTao.setNguoiTao(null);
        BanThu khongTraLoi = f.dung(s -> s.guiXacNhanDatHang(khongNguoiTao),
                new CuaHangEmail("Thời trang Linh Lan", TEN_DANG_KY, MST, "Địa chỉ", null, null, null));
        assertNull(khongTraLoi.traLoiToi());
        for (String ban : List.of(chuHien(khongTraLoi.html()), khongTraLoi.text())) {
            assertFalse(ban.contains("Trả lời email này"));
            assertFalse(ban.contains("trả lời email này"));
            assertTrue(ban.contains("Vui lòng liên hệ chúng tôi trước khi giao hàng."));
        }
    }

    @Test
    void khung_cheDoToi_outlook_dongXemTruocCoDem_bangSanPhamHaiCot() {
        for (BanThu thu : List.of(
                f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), MauEmailFixture.cuaHang()),
                f.dung(s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "482913", YEU_CAU, HET_HAN),
                        MauEmailFixture.cuaHang()))) {
            String html = thu.html();
            assertTrue(html.contains("<meta name=\"color-scheme\" content=\"light dark\">"));
            assertTrue(html.contains("@media (prefers-color-scheme: dark)"));
            assertTrue(html.contains("[data-ogsc] .chu"), "chế độ tối của Outlook.com");
            assertTrue(html.contains("<!--[if mso]><table role=\"presentation\" width=\"600\""), "thẻ 600px cho Outlook");
            assertTrue(html.contains("<!--[if mso]><style>"), "font cho Outlook");
            assertTrue(html.contains("&#847;&zwnj;&nbsp;"), "dòng xem trước có phần đệm");
        }
        String e4 = f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), MauEmailFixture.cuaHang()).html();
        int nut = e4.indexOf("Gửi báo giá</a>");
        assertTrue(nut > 0 && nut < e4.indexOf("Sản phẩm cần báo giá"), "nút trước bảng sản phẩm");
        assertTrue(e4.contains("mso-padding-alt:12px 24px;"), "nút có khoảng đệm trên Outlook");
        String m3 = f.dung(s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(null)), MauEmailFixture.cuaHang()).html();
        assertTrue(m3.contains(">Thành tiền (₫)</th>"), "cột tiền ghi đơn vị");
        assertTrue(m3.contains("<th scope=\"col\""));
        assertTrue(chuHien(m3).contains("1. Áo polo nam cơ bản Trắng · M · APL-NAM-TRANG-M 120 cái × 145.000 17.400.000"));
    }

    @Test
    void duLieuThieu_ngayGiao_vaiTro_thuocTinh_nguoiPhuTrach() {
        Map<String, BanThu> thu = new HashMap<>();
        moiBienThe().forEach(b -> thu.put(b.ten(), dung(b, MauEmailFixture.cuaHang())));

        String e4 = thu.get("E4 không ngày giao, dòng thiếu thuộc tính hoặc SKU").html();
        String chuE4 = chuHien(e4);
        assertFalse(chuE4.contains("Ngày cần giao"));
        assertTrue(Pattern.compile("<td(?=[^>]*colspan=\"2\")(?![^>]*width=)[^>]*><p[^>]*>Giao tại</p>")
                .matcher(e4).find(), "Giao tại chiếm cả hàng khi không có ngày giao");
        assertTrue(chuE4.contains("1. Áo polo nam cơ bản Trắng · M 120 cái"), "chỉ có thuộc tính: không dấu · thừa");
        assertTrue(chuE4.contains("2. Áo polo nam cơ bản APL-NAM-NAVY-L 80 cái"), "chỉ có SKU: không dấu · thừa");
        assertTrue(thu.get("E4 không ngày giao, dòng thiếu thuộc tính hoặc SKU").text()
                .contains("1. Áo polo nam cơ bản (Trắng · M): 120 cái"));

        String e2 = chuHien(thu.get("E2 vai trò lạ").html());
        assertFalse(e2.contains("Vai trò"));
        assertTrue(e2.contains("Tên đăng nhập minhanh Đặt mật khẩu của bạn"));
        assertFalse(e2.contains("Nơi làm việc và quyền của bạn"));
        assertFalse(e2.contains("Khi bạn gửi yêu cầu báo giá"));

        BanThu m5 = thu.get("M5 quá hạn, không người phụ trách");
        assertFalse(chuHien(m5.html()).contains("Trân trọng"), "không có người phụ trách thì bỏ phần ký");
        assertFalse(m5.text().contains("Trân trọng"));
        assertFalse(chuHien(m5.html()).contains("Người xác nhận"));

        BanThu m1 = thu.get("M1 không ngày giao, không người phụ trách");
        String chuM1 = chuHien(m1.html());
        assertTrue(chuM1.contains("Ngày đặt hàng 19/10/2026 Giao tại"), "Ngày đặt hàng chiếm cả hàng");
        assertTrue(chuM1.contains("Trân trọng, Thay mặt bên mua"), "M1 vẫn ký khi không có người phụ trách");
        assertTrue(chuM1.contains("vui lòng báo trước cho chúng tôi."));
        assertFalse(chuM1.contains("báo trước cho người phụ trách"), "không nhắc người phụ trách không có");
        assertTrue(m1.text().contains("Trân trọng,\nThay mặt bên mua\n"));
        assertTrue(m1.text().contains("vui lòng báo trước cho chúng tôi."));
    }

    @Test
    void nhanBaoMat_chiOEmailBaoMatTaiKhoan() {
        Map<String, BanThu> thu = new LinkedHashMap<>();
        moiBienThe().forEach(b -> thu.put(b.ten(), dung(b, MauEmailFixture.cuaHang())));
        thu.forEach((ten, banThu) -> {
            boolean baoMat = ten.startsWith("E1") || ten.startsWith("E3") || ten.startsWith("M4");
            assertEquals(baoMat, chuHien(banThu.html()).contains("Bảo mật tài khoản"), ten);
        });
    }

    @Test
    void tieuDeTrongThan_trungTieuDeThu_E2E3() {
        BanThu e2 = f.dung(s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu("nhan_vien_kho"), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET),
                MauEmailFixture.cuaHang());
        BanThu e3 = f.dung(s -> s.guiCapLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), MauEmailFixture.MA_LIEN_KET, YEU_CAU,
                MauEmailFixture.HET_HAN_LIEN_KET),
                MauEmailFixture.cuaHang());
        for (BanThu thu : List.of(e2, e3)) {
            Matcher h1 = Pattern.compile("<h1[^>]*>([^<]*)</h1>").matcher(thu.html());
            assertTrue(h1.find());
            assertEquals(thu.tieuDe(), h1.group(1));
            assertTrue(thu.text().contains(thu.tieuDe()));
        }
    }

    @Test
    void m2_bonBienThe() {
        DonMuaHang coLyDo = voiTrangThai(MauEmailFixture.donDaBaoGia(null), 4);
        coLyDo.setLyDoTuChoi("Đơn giá cao hơn báo giá được chọn.");
        String a = chuHien(f.dung(s -> s.guiKetQuaBaoGia(coLyDo), MauEmailFixture.cuaHang()).html());
        assertTrue(a.contains("Cảm ơn Quý công ty đã gửi báo giá ngày 19/10/2026."));
        assertTrue(a.contains("Lý do Đơn giá cao hơn báo giá được chọn."));
        assertTrue(a.contains("Yêu cầu báo giá này đã kết thúc. Hai bên không phát sinh nghĩa vụ"));

        String b = chuHien(f.dung(s -> s.guiKetQuaBaoGia(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 4)),
                MauEmailFixture.cuaHang()).html());
        assertFalse(b.contains("Lý do"));

        String c = chuHien(f.dung(s -> s.guiKetQuaBaoGia(voiTrangThai(MauEmailFixture.don(false), 4)),
                MauEmailFixture.cuaHang()).html());
        assertTrue(c.contains("Chúng tôi đã chọn được nhà cung cấp cho yêu cầu gửi ngày 19/10/2026."));
        assertFalse(c.contains("Yêu cầu báo giá này đã kết thúc."));
        assertTrue(c.contains("Hai bên không phát sinh nghĩa vụ"));
        assertFalse(c.contains("Cảm ơn Quý công ty đã gửi báo giá"));

        DonMuaHang chuaBaoGiaCoLyDo = voiTrangThai(MauEmailFixture.don(false), 4);
        chuaBaoGiaCoLyDo.setLyDoTuChoi("Không dùng");
        String d = chuHien(f.dung(s -> s.guiKetQuaBaoGia(chuaBaoGiaCoLyDo), MauEmailFixture.cuaHang()).html());
        assertFalse(d.contains("Lý do"), "lý do chỉ ở bản đã báo giá (demo)");
    }

    // ---------------- Escape ----------------

    @Test
    void giaTriNguoiDungNhap_duocEscape_trongHtml_nguyenVanTrongTxt() {
        DonMuaHang d = MauEmailFixture.donDaBaoGia("<b>x</b> & <a href=\"https://gia.mao\">bấm</a>");
        d.getNhaCungCap().setTenNhaCungCap("<b>x</b> Linh & Lan");
        BanThu thu = f.dung(s -> s.guiDaNhanBaoGia(d), MauEmailFixture.cuaHang());

        assertFalse(thu.html().contains("<b>x</b>"));
        assertFalse(thu.html().contains("href=\"https://gia.mao\""));
        assertTrue(thu.html().contains("&lt;b&gt;x&lt;/b&gt; Linh &amp; Lan"));
        assertTrue(thu.text().contains("Kính gửi <b>x</b> Linh & Lan,"), "bản chữ thường không mã hóa HTML");
        assertFalse(thu.text().contains("&amp;"));

        CuaHangEmail chDoc = new CuaHangEmail("<script>x</script>", "<i>Công ty</i>", null, "Địa chỉ", null, null,
                null);
        BanThu e1 = f.dung(s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "482913", YEU_CAU,
                HET_HAN), chDoc);
        assertFalse(e1.html().contains("<script>x</script>"));
        assertFalse(e1.html().contains("<i>Công ty</i>"));
    }

    // ---------------- Dữ liệu thiếu ----------------

    @Test
    void cuaHangThieuLogoMstDienThoaiEmail_boDong_khongDauChamThua() {
        CuaHangEmail thieu = new CuaHangEmail("Thời trang Linh Lan", TEN_DANG_KY, null,
                "Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội", null, null, null);
        BanThu e4 = f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), thieu);
        String chu = chuHien(e4.html());
        assertFalse(chu.contains("MST"));
        assertFalse(chu.contains("Điện thoại 0"));
        assertFalse(chu.contains(" ·  ·"));
        assertFalse(Pattern.compile("· (Email gửi|Tầng)").matcher(chu).find(), "không dấu · đầu dòng thừa");
        assertFalse(e4.text().contains("MST"));
        assertFalse(Pattern.compile("(?m)^ · |· $").matcher(e4.text()).find());

        // M1: Email nhận hóa đơn lấy email người phụ trách khi cửa hàng không có email; bỏ dòng Mã số thuế
        BanThu m1 = f.dung(s -> s.guiXacNhanDatHang(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3)), thieu);
        String chuM1 = chuHien(m1.html());
        assertTrue(chuM1.contains("Email nhận hóa đơn ha.pham@linhlan.vn"));
        assertFalse(chuM1.contains("Mã số thuế"));
        assertFalse(chuM1.contains("Điện thoại 0"));
        assertTrue(m1.text().contains("Email nhận hóa đơn: ha.pham@linhlan.vn"));
    }

    @Test
    void cuaHangTrong_emailNhanSu_khongCoDauEmail_khongInFCentric() {
        BanThu e2 = f.dung(s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu("nhan_vien_kho"), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET),
                CuaHangEmail.TRONG);
        assertFalse(e2.html().contains("<img"));
        assertFalse(e2.html().contains("class=\"khung-dau"), "không có ô đầu email");
        String chu = chuHien(e2.html());
        assertTrue(chu.contains("Bạn nhận email này vì có tài khoản FCentric. Email gửi tự động, vui lòng không trả lời."));
        assertFalse(Pattern.compile("\\bnull\\b").matcher(e2.html() + e2.text()).find());
    }

    @Test
    void coLogo_hienAnh_khongHienTenBangChu() {
        BanThu e4 = f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), MauEmailFixture.cuaHangCoLogo());
        assertTrue(e4.html().contains("<img src=\"https://minio.slmglobal.vn/fashion/logo-linh-lan.png\" "
                + "alt=\"Thời trang Linh Lan\""));
        assertEquals(0, dem(chuHien(e4.html()), "Thời trang Linh Lan") - dem(chuHien(e4.html()), TEN_DANG_KY));
    }

    @Test
    void nguoiPhuTrachKhongCoDienThoai_vaDonKhongCoNguoiTao() {
        DonMuaHang khongDt = MauEmailFixture.don(false);
        khongDt.getNguoiTao().setSoDienThoai(" ");
        String chu = chuHien(f.dung(s -> s.guiYeuCauBaoGia(khongDt), MauEmailFixture.cuaHang()).html());
        assertTrue(chu.contains("Nhân viên mua hàng ha.pham@linhlan.vn"));
        assertFalse(chu.contains("· ha.pham@linhlan.vn"));

        DonMuaHang khongNguoiTao = MauEmailFixture.don(false);
        khongNguoiTao.setNguoiTao(null);
        BanThu thu = f.dung(s -> s.guiYeuCauBaoGia(khongNguoiTao), MauEmailFixture.cuaHang());
        assertFalse(chuHien(thu.html()).contains("Trân trọng"), "không có người phụ trách thì bỏ phần ký");
        assertEquals(EMAIL_CUA_HANG, thu.traLoiToi().email(), "Trả lời tới dùng email cửa hàng");
        assertTrue(chuHien(thu.html()).contains("Trả lời email này để liên hệ trực tiếp người phụ trách đơn."));

        BanThu khongTraLoi = f.dung(s -> s.guiYeuCauBaoGia(khongNguoiTao),
                new CuaHangEmail("Thời trang Linh Lan", TEN_DANG_KY, MST, "Địa chỉ", null, null, null));
        assertNull(khongTraLoi.traLoiToi());
        assertFalse(chuHien(khongTraLoi.html()).contains("Trả lời email này"),
                "không có Trả lời tới thì không mời trả lời");
    }

    @Test
    void quanTriVienTaoDon_phanKyKhongCoChucDanh() {
        DonMuaHang d = MauEmailFixture.don(false);
        d.getNguoiTao().setVaiTro("quan_tri_vien");
        String chu = chuHien(f.dung(s -> s.guiYeuCauBaoGia(d), MauEmailFixture.cuaHang()).html());
        assertTrue(chu.contains("Trân trọng, Phạm Thu Hà 0912 345 678 · ha.pham@linhlan.vn"));
        assertFalse(chu.contains("Quản trị viên"));
    }

    @Test
    void duongDanCong_maHoaEmail() {
        DonMuaHang d = MauEmailFixture.don(false);
        d.getNhaCungCap().setEmail("lan+bao.gia@xuong.vn");
        BanThu e4 = f.dung(s -> s.guiYeuCauBaoGia(d), MauEmailFixture.cuaHang());
        assertTrue(e4.html().contains("href=\"https://fcentric.net/supplier/login?id=1287&amp;email=lan%2Bbao.gia%40xuong.vn\""));
        assertTrue(e4.html().contains(">fcentric.net/supplier/login</a>"));
    }

    // ---------------- Dò thư mục mẫu ----------------

    @Test
    void thuMucMau_khongCoThUtext_htmlKhongCoInlineKhongEscape() throws IOException, URISyntaxException {
        Path thuMuc = Path.of(Objects.requireNonNull(getClass().getClassLoader().getResource("templates/email")).toURI());
        List<Path> tep;
        try (Stream<Path> s = Files.list(thuMuc)) {
            tep = s.toList();
        }
        assertTrue(tep.size() >= 19, "9 cặp mẫu + khung");
        for (LoaiEmail l : LoaiEmail.values()) {
            assertTrue(Files.exists(thuMuc.resolve(l.mauHtml() + ".html")), l.mauHtml());
            assertTrue(Files.exists(thuMuc.resolve(l.mauText())), l.mauText());
        }
        Matcher m;
        for (Path p : tep) {
            String noiDung = Files.readString(p, StandardCharsets.UTF_8);
            assertFalse(Pattern.compile("th:utext\\s*=").matcher(noiDung).find(), p.getFileName() + ": cấm th:utext");
            if (p.toString().endsWith(".html")) {
                assertFalse(Pattern.compile("\\[\\(\\s*[$#*@~]\\{").matcher(noiDung).find(),
                        p.getFileName() + ": HTML cấm [(…)] (không escape)");
                m = Pattern.compile("th:inline").matcher(noiDung);
                assertFalse(m.find(), p.getFileName().toString());
            }
        }
    }
}
