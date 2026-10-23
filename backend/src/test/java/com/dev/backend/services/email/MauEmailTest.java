package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
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
                    s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu(vt), "Hk7#mQ2v")));
        }
        ds.add(new BienThe("E3", LoaiEmail.E3, s -> s.guiCapLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                "pR4@vZ9k", YEU_CAU)));
        ds.add(new BienThe("E3 khóa", LoaiEmail.E3, s -> {
            NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
            nd.setTrangThai(0);
            s.guiCapLaiMatKhau(nd, "pR4@vZ9k", YEU_CAU);
        }));
        for (CachDoiMatKhau c : CachDoiMatKhau.values()) {
            ds.add(new BienThe("M4 " + c, LoaiEmail.M4,
                    s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), c, YEU_CAU)));
        }
        ds.add(new BienThe("E4", LoaiEmail.E4, s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false))));
        ds.add(new BienThe("E5", LoaiEmail.E5, s -> s.guiMaXacNhanBaoGia(MauEmailFixture.don(false),
                MauEmailFixture.EMAIL_NCC, "771204", Instant.parse("2026-10-19T07:27:00Z"))));
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
                s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu("vai_tro_la"), "Hk7#mQ2v")));
        ds.add(new BienThe("E4 không ngày giao, dòng thiếu thuộc tính hoặc SKU", LoaiEmail.E4,
                s -> s.guiYeuCauBaoGia(dongThieu(khongNgayGiao(MauEmailFixture.don(false))))));
        ds.add(new BienThe("E5 người phụ trách không điện thoại", LoaiEmail.E5, s -> {
            DonMuaHang d = MauEmailFixture.don(false);
            d.getNguoiTao().setSoDienThoai(null);
            s.guiMaXacNhanBaoGia(d, MauEmailFixture.EMAIL_NCC, "771204", Instant.parse("2026-10-19T07:27:00Z"));
        }));
        ds.add(new BienThe("M1 không ngày giao, không người phụ trách", LoaiEmail.M1, s -> {
            DonMuaHang d = khongNgayGiao(voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3));
            d.setNguoiTao(null);
            s.guiXacNhanDatHang(d);
        }));
        return ds.stream();
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
        mong.put("E3", "Mật khẩu tạm thời mới cho tài khoản FCentric");
        mong.put("M4 DAT_LAI_BANG_MA", "Mật khẩu FCentric của bạn vừa được thay đổi");
        mong.put("E4", "Yêu cầu báo giá PO202610195101 – Thời trang Linh Lan");
        mong.put("E5", "Mã xác nhận báo giá đơn PO202610195101");
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
        BanThu e5 = f.dung(s -> s.guiMaXacNhanBaoGia(MauEmailFixture.don(false), MauEmailFixture.EMAIL_NCC,
                "771204", Instant.parse("2026-10-19T07:27:00Z")), MauEmailFixture.cuaHang());
        assertFalse(e5.html().contains("Gửi báo giá</a>"), "E5 không có nút");
        assertTrue(e5.html().contains("Mã có hiệu lực 5 phút, đến 14:27 ngày 19/10/2026. Không đưa mã này cho người khác."));
    }

    @Test
    void e5_khongMoiTraLoi_ghiNguoiPhuTrach() {
        BanThu e5 = f.dung(s -> s.guiMaXacNhanBaoGia(MauEmailFixture.don(false), MauEmailFixture.EMAIL_NCC,
                "771204", Instant.parse("2026-10-19T07:27:00Z")), MauEmailFixture.cuaHang());
        // trả lời thư chứa mã sẽ trích nguyên mã gửi cho nhân viên: chân thư không mời trả lời (kể cả khi có Trả lời tới)
        assertNotNull(e5.traLoiToi());
        for (String ban : List.of(chuHien(e5.html()), e5.text())) {
            assertFalse(ban.contains("Trả lời email này"));
            assertTrue(ban.contains("Cần hỗ trợ, Quý công ty vui lòng liên hệ người phụ trách đơn Phạm Thu Hà, 0912 345 678."));
        }

        DonMuaHang khongNguoiTao = MauEmailFixture.don(false);
        khongNguoiTao.setNguoiTao(null);
        String chu = chuHien(f.dung(s -> s.guiMaXacNhanBaoGia(khongNguoiTao, MauEmailFixture.EMAIL_NCC, "771204",
                Instant.parse("2026-10-19T07:27:00Z")), MauEmailFixture.cuaHang()).html());
        assertFalse(chu.contains("Cần hỗ trợ"), "không có người phụ trách thì bỏ câu liên hệ");
    }

    // ---------------- E2 theo vai trò ----------------

    @Test
    void e2_duNamVaiTro_dongNoiLamViec_vaDongEmailNhaCungCap() {
        Map<String, String> nhan = Map.of("nhan_vien_kho", "Nhân viên kho", "quan_ly_kho", "Quản lý kho",
                "nhan_vien_ban_hang", "Nhân viên bán hàng", "nhan_vien_mua_hang", "Nhân viên mua hàng",
                "quan_tri_vien", "Quản trị viên");
        nhan.forEach((vt, ten) -> {
            BanThu thu = f.dung(s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu(vt), "Hk7#mQ2v"),
                    MauEmailFixture.cuaHang());
            String chu = chuHien(thu.html());
            assertTrue(chu.contains("Vai trò " + ten), vt);
            assertEquals(!vt.equals("quan_tri_vien"), chu.contains("Nơi làm việc và quyền của bạn"), vt);
            assertEquals(!vt.equals("nhan_vien_ban_hang"), chu.contains("Khi bạn gửi yêu cầu báo giá"), vt);
            assertEquals(!vt.equals("quan_tri_vien"), thu.text().contains("Nơi làm việc và quyền của bạn"), vt);
            assertEquals(!vt.equals("nhan_vien_ban_hang"), thu.text().contains("Khi bạn gửi yêu cầu báo giá"), vt);
            assertTrue(chu.contains("Hk7#mQ2v"), "mật khẩu tạm có trong thư");
            assertTrue(chu.contains("Tài khoản FCentric của bạn đã được tạo"), "tiêu đề trong thân trùng tiêu đề thư");
            assertTrue(chu.contains("Đổi xong, bạn nên xóa email này."));
            assertTrue(chu.contains("Lần đầu đăng nhập, hệ thống sẽ yêu cầu bạn đổi sang mật khẩu riêng."));
            assertTrue(thu.html().contains("href=\"https://fcentric.net/login\""));
        });
    }

    // ---------------- E3, M4 ----------------

    @Test
    void e3_coVaKhongCoKhungTamKhoa_coMatKhauTam() {
        NguoiDung khoa = MauEmailFixture.nhanSu("nhan_vien_kho");
        khoa.setTrangThai(0);
        String coKhoa = chuHien(f.dung(s -> s.guiCapLaiMatKhau(khoa, "pR4@vZ9k", YEU_CAU),
                MauEmailFixture.cuaHang()).html());
        String khongKhoa = chuHien(f.dung(s -> s.guiCapLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                "pR4@vZ9k", YEU_CAU), MauEmailFixture.cuaHang()).html());
        assertTrue(coKhoa.contains("Tài khoản đang tạm khóa"));
        assertFalse(khongKhoa.contains("Tài khoản đang tạm khóa"));
        assertTrue(khongKhoa.contains("pR4@vZ9k"), "sửa L9: thư có mật khẩu tạm");
        assertTrue(khongKhoa.contains("Quản trị viên đã cấp lại mật khẩu cho bạn lúc 09:12 ngày 19/10/2026."));
    }

    @Test
    void m4_haiCachThayDoi_khongCoMatKhau() {
        String bangMa = chuHien(f.dung(s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                CachDoiMatKhau.DAT_LAI_BANG_MA, YEU_CAU), MauEmailFixture.cuaHang()).html());
        String daDangNhap = chuHien(f.dung(s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"),
                CachDoiMatKhau.DOI_KHI_DA_DANG_NHAP, YEU_CAU), MauEmailFixture.cuaHang()).html());
        assertTrue(bangMa.contains("Cách thay đổi Đặt lại bằng mã gửi qua email"));
        assertTrue(daDangNhap.contains("Cách thay đổi Đổi khi đã đăng nhập"));
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
        assertTrue(e2.contains("Tên đăng nhập minhanh Mật khẩu tạm thời"));
        assertFalse(e2.contains("Nơi làm việc và quyền của bạn"));
        assertFalse(e2.contains("Khi bạn gửi yêu cầu báo giá"));

        BanThu e5 = thu.get("E5 người phụ trách không điện thoại");
        assertTrue(chuHien(e5.html()).contains("liên hệ người phụ trách đơn Phạm Thu Hà, ha.pham@linhlan.vn."));
        assertTrue(e5.text().contains("liên hệ người phụ trách đơn Phạm Thu Hà, ha.pham@linhlan.vn."));

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
        BanThu e2 = f.dung(s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu("nhan_vien_kho"), "Hk7#mQ2v"),
                MauEmailFixture.cuaHang());
        BanThu e3 = f.dung(s -> s.guiCapLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "pR4@vZ9k", YEU_CAU),
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
        BanThu e2 = f.dung(s -> s.guiTaiKhoanMoi(MauEmailFixture.nhanSu("nhan_vien_kho"), "Hk7#mQ2v"),
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
