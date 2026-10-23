package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.entities.ChiTietDonMuaHang;
import com.dev.backend.entities.DonMuaHang;
import org.junit.jupiter.api.Test;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Email trên màn hẹp (demo M1-DienThoai; review T-email P1, P2; test đầu-cuối F1): ở khung nhìn điện thoại không có
 * mẫu nào tràn ngang, kể cả SKU dài như dữ liệu thật; bản máy tính giữ nguyên style inline.
 *
 * <p>Phần đo chạy bằng Chromium không giao diện (headless shell của Playwright) nếu tìm được: {@code -Demail.chromium=…},
 * biến môi trường {@code EMAIL_CHROMIUM}, hoặc thư mục trình duyệt của Playwright ({@code PLAYWRIGHT_BROWSERS_PATH},
 * {@code ~/.cache/ms-playwright}). Không có thì bỏ qua phần đo; phần kiểm cấu trúc luôn chạy.
 */
class EmailManHepTest {

    /** SKU dài nhất trong dữ liệu thật (db-baseline): 23 ký tự. */
    static final String SKU_THAT = "AT2603191-CL001-XL-M003";
    static final int[] KHUNG_DIEN_THOAI = {320, 375, 414};

    private final MauEmailFixture f = new MauEmailFixture();

    // ---------------- Cấu trúc (luôn chạy) ----------------

    @Test
    void khungCoMediaManHep_bangSanPhamHaiCot_luoiThongTinXepDoc_maXacNhanCoLop() throws Exception {
        String khung = new String(Objects.requireNonNull(getClass().getResourceAsStream("/templates/email/khung.html"))
                .readAllBytes(), StandardCharsets.UTF_8);
        assertTrue(khung.contains("@media only screen and (max-width:480px)"), "khung.html thiếu khối màn hẹp");
        assertTrue(khung.contains(".luoi .o-luoi{display:block !important;"), "lưới thông tin xếp dọc ở màn hẹp");

        Map<String, BanThu> thu = new LinkedHashMap<>();
        thu.put("E4", f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)), MauEmailFixture.cuaHang()));
        thu.put("M3", f.dung(s -> s.guiDaNhanBaoGia(MauEmailFixture.donDaBaoGia(null)), MauEmailFixture.cuaHang()));
        thu.put("M1", f.dung(s -> s.guiXacNhanDatHang(MauEmailTest.voiTrangThai(MauEmailFixture.donDaBaoGia(null), 3)),
                MauEmailFixture.cuaHang()));
        for (var e : thu.entrySet()) {
            String html = e.getValue().html();
            // bảng hai cột (sản phẩm, số lượng / thành tiền) đọc được cả khi ứng dụng thư bỏ khối style: không cần xếp chồng
            Matcher bang = Pattern.compile("<table([^>]*)class=\"bang-sp ").matcher(html);
            assertTrue(bang.find(), e.getKey() + ": có bảng sản phẩm");
            assertFalse(bang.group(1).contains("role="), e.getKey() + ": bảng dữ liệu không gắn role=presentation");
            assertEquals(4, dem(html, "<tr class=\"dong-sp\">"), e.getKey() + ": 4 dòng sản phẩm");
            Matcher dong = Pattern.compile("(?s)<tr class=\"dong-sp\">(.*?)</tr>").matcher(html);
            while (dong.find()) {
                assertEquals(1, dem(dong.group(1), "<th scope=\"row\""), e.getKey() + ": tên sản phẩm là tiêu đề hàng");
                assertEquals(1, dem(dong.group(1), "<td "), e.getKey() + ": mỗi dòng đúng hai ô");
            }
            assertFalse(html.contains("chi-hep"), e.getKey() + ": không còn chữ chỉ hiện ở màn hẹp");
            if (!e.getKey().equals("M3")) {
                assertTrue(html.contains("class=\"luoi "), e.getKey() + ": lưới thông tin (Giao tại…) xếp dọc được");
            }
        }
        for (BanThu ma : List.of(
                f.dung(s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "482913",
                        MauEmailFixture.BAY_GIO, MauEmailFixture.BAY_GIO.plusSeconds(300)), MauEmailFixture.cuaHang()),
                f.dung(s -> s.guiMaXacNhanBaoGia(MauEmailFixture.don(false), MauEmailFixture.EMAIL_NCC, "771204",
                        MauEmailFixture.BAY_GIO.plusSeconds(300)), MauEmailFixture.cuaHang()))) {
            assertTrue(ma.html().contains("class=\"o-ma\""), "ô mã thu nhỏ khoảng cách chữ ở màn hẹp");
        }
    }

    // ---------------- Đo bằng trình duyệt (khi có Chromium) ----------------

    @Test
    void dienThoai_khongMauNaoTranNgang_keCaSkuDai() throws Exception {
        Path chromium = timChromium();
        assumeTrue(chromium != null, "không tìm thấy Chromium không giao diện: bỏ qua phần đo");

        Map<String, String> thu = new LinkedHashMap<>();
        CuaHangEmail ch = MauEmailFixture.cuaHang();
        MauEmailTest.moiBienThe().forEach(b -> thu.put(b.ten(), f.dung(b.goi(), ch).html()));
        thu.put("E4 có logo", f.dung(s -> s.guiYeuCauBaoGia(MauEmailFixture.don(false)),
                MauEmailFixture.cuaHangCoLogo()).html());
        // logo cùng nhãn "Bảo mật tài khoản" ở đầu email
        thu.put("E1 có logo", f.dung(s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "482913",
                MauEmailFixture.BAY_GIO, MauEmailFixture.BAY_GIO.plusSeconds(300)), MauEmailFixture.cuaHangCoLogo()).html());
        thu.put("E4 SKU thật", f.dung(s -> s.guiYeuCauBaoGia(skuDai(MauEmailFixture.don(false))), ch).html());
        thu.put("M3 SKU thật", f.dung(s -> s.guiDaNhanBaoGia(skuDai(MauEmailFixture.donDaBaoGia(null))), ch).html());
        thu.put("M1 SKU thật", f.dung(s -> s.guiXacNhanDatHang(
                MauEmailTest.voiTrangThai(skuDai(MauEmailFixture.donDaBaoGia(MauEmailFixture.GHI_CHU)), 3)), ch).html());

        List<String> tran = new ArrayList<>();
        for (int rong : KHUNG_DIEN_THOAI) {
            List<Integer> kq = doChieuRong(chromium, new ArrayList<>(thu.values()), rong);
            int i = 0;
            for (String ten : thu.keySet()) {
                int sw = kq.get(i++);
                if (sw > rong) {
                    tran.add(ten + " ở " + rong + "px: " + sw + "px");
                }
            }
        }
        assertEquals(List.of(), tran, "tràn ngang trên điện thoại");

        // ứng dụng thư bỏ khối style (Gmail với tài khoản ngoài Google): chỉ còn style inline, vẫn không được tràn
        List<String> khongStyle = thu.values().stream().map(h -> h.replaceAll("(?s)<style>.*?</style>", "")).toList();
        List<String> tranKhongStyle = new ArrayList<>();
        for (int rong : KHUNG_DIEN_THOAI) {
            List<Integer> kq = doChieuRong(chromium, khongStyle, rong);
            int i = 0;
            for (String ten : thu.keySet()) {
                int sw = kq.get(i++);
                if (sw > rong) {
                    tranKhongStyle.add(ten + " ở " + rong + "px: " + sw + "px");
                }
            }
        }
        assertEquals(List.of(), tranKhongStyle, "tràn ngang khi ứng dụng thư bỏ khối style");

        // máy tính: thẻ 600px, không tràn ở khung nhìn 640 (dữ liệu demo)
        List<Integer> mayTinh = doChieuRong(chromium, new ArrayList<>(thu.values()), 640);
        assertTrue(mayTinh.stream().allMatch(sw -> sw <= 640), "tràn ở 640px: " + mayTinh);
    }

    private static DonMuaHang skuDai(DonMuaHang d) {
        for (ChiTietDonMuaHang ct : d.getChiTietDonMuaHangs()) {
            ct.getBienTheSanPham().setMaSku(SKU_THAT);
        }
        return d;
    }

    /**
     * Mỗi thư một iframe srcdoc rộng {@code rong} px (đủ cao để không có thanh cuộn: media query tính theo đúng bề
     * rộng này), đọc scrollWidth của từng thư sau khi trang tải xong.
     */
    static List<Integer> doChieuRong(Path chromium, List<String> cacThu, int rong) throws IOException, InterruptedException {
        StringBuilder trang = new StringBuilder("<!DOCTYPE html><html><body style=\"margin:0\">");
        for (String html : cacThu) {
            trang.append("<iframe width=\"").append(rong).append("\" height=\"8000\" scrolling=\"no\" srcdoc=\"")
                    .append(HtmlUtils.htmlEscape(html, StandardCharsets.UTF_8.name())).append("\"></iframe>");
        }
        trang.append("<script>window.addEventListener('load',function(){document.documentElement.setAttribute('data-kq',"
                + "Array.prototype.map.call(document.querySelectorAll('iframe'),function(f){"
                + "return f.contentDocument.documentElement.scrollWidth;}).join(','));});</script></body></html>");
        Path tep = Files.createTempFile("email-man-hep", ".html");
        Path ketQua = Files.createTempFile("email-man-hep", ".txt");
        try {
            Files.writeString(tep, trang, StandardCharsets.UTF_8);
            // --headless: headless shell bỏ qua cờ này, Chrome thường cần nó. Ghi kết quả ra tệp rồi mới chờ, để giới hạn
            // 60 giây có tác dụng khi trình duyệt không thoát.
            Process p = new ProcessBuilder(chromium.toString(), "--headless", "--no-sandbox", "--disable-gpu",
                    "--hide-scrollbars", "--window-size=1400,900", "--dump-dom", tep.toUri().toString())
                    .redirectError(ProcessBuilder.Redirect.DISCARD).redirectOutput(ketQua.toFile()).start();
            if (!p.waitFor(60, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                fail("Chromium không dừng sau 60 giây");
            }
            String ra = Files.readString(ketQua, StandardCharsets.UTF_8);
            Matcher m = Pattern.compile("data-kq=\"([0-9,]*)\"").matcher(ra);
            assertTrue(m.find(), "không đọc được kết quả đo");
            List<Integer> kq = Arrays.stream(m.group(1).split(",")).map(Integer::valueOf).toList();
            assertEquals(cacThu.size(), kq.size());
            return kq;
        } finally {
            xoaTepTam(tep);
            xoaTepTam(ketQua);
        }
    }

    /** Trên Windows tiến trình con của trình duyệt có thể còn giữ tệp một lúc: không xóa được thì để JVM xóa khi thoát. */
    private static void xoaTepTam(Path tep) {
        try {
            Files.deleteIfExists(tep);
        } catch (IOException e) {
            tep.toFile().deleteOnExit();
        }
    }

    /** Headless shell của Chromium (Playwright): chỉ định rõ, hoặc tìm trong thư mục trình duyệt của Playwright. */
    static Path timChromium() throws IOException {
        for (String chiDinh : new String[]{System.getProperty("email.chromium"), System.getenv("EMAIL_CHROMIUM")}) {
            if (chiDinh != null && !chiDinh.isBlank()) {
                Path p = Path.of(chiDinh.trim());
                return Files.isExecutable(p) ? p : null;
            }
        }
        List<Path> thuMuc = new ArrayList<>();
        String pw = System.getenv("PLAYWRIGHT_BROWSERS_PATH");
        if (pw != null && !pw.isBlank() && !"0".equals(pw.trim())) {
            thuMuc.add(Path.of(pw.trim()));
        }
        thuMuc.add(Path.of(System.getProperty("user.home"), ".cache", "ms-playwright"));
        String localAppData = System.getenv("LOCALAPPDATA");
        if (localAppData != null && !localAppData.isBlank()) {
            thuMuc.add(Path.of(localAppData, "ms-playwright"));
        }
        for (Path goc : thuMuc) {
            if (!Files.isDirectory(goc)) {
                continue;
            }
            try (Stream<Path> ds = Files.list(goc)) {
                for (Path ban : ds.filter(p -> p.getFileName().toString().startsWith("chromium_headless_shell-"))
                        .sorted(Comparator.reverseOrder()).toList()) {
                    for (String duoi : new String[]{"chrome-linux/headless_shell",
                            "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-win/headless_shell.exe",
                            "chrome-headless-shell-win64/chrome-headless-shell.exe"}) {
                        Path p = ban.resolve(duoi);
                        if (Files.isExecutable(p)) {
                            return p;
                        }
                    }
                }
            }
        }
        return null;
    }

    private static int dem(String chu, String tim) {
        return MauEmailTest.dem(chu, tim);
    }
}
