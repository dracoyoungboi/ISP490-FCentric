package com.dev.backend.services.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Định dạng dữ liệu cho email theo quy ước tiếng Việt (đặc tả 2 "Định dạng", 7.1).
 * Hàm tĩnh, an toàn khi nhiều luồng gọi: {@link DecimalFormat} không an toàn luồng nên tạo mới mỗi lần.
 */
public final class DinhDangEmail {

    private static final Logger log = LoggerFactory.getLogger(DinhDangEmail.class);

    /** Giờ Việt Nam cho mọi ngày, giờ trong email. */
    public static final ZoneId MUI_GIO = ZoneId.of("Asia/Ho_Chi_Minh");
    public static final Locale TIENG_VIET = Locale.forLanguageTag("vi");
    /** Khoảng trắng không ngắt trước ký hiệu ₫ (không để ₫ rơi xuống dòng riêng). */
    public static final String KY_HIEU_DONG = " ₫";
    /** Đơn vị tính khi sản phẩm chưa có (cột don_vi_tinh mặc định 'Cái'). */
    public static final String DON_VI_TINH_MAC_DINH = "cái";

    private static final DateTimeFormatter NGAY = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(MUI_GIO);
    private static final DateTimeFormatter GIO_NGAY =
            DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy").withZone(MUI_GIO);

    /** Ngược với /[^0-9\s.\-()]/ của fmtPhone: chỉ chữ số, khoảng trắng, dấu chấm, gạch nối, ngoặc thì mới nhóm lại. */
    private static final java.util.regex.Pattern DIEN_THOAI_KY_TU_HOP_LE =
            java.util.regex.Pattern.compile("[0-9\\s.\\-()]*", java.util.regex.Pattern.UNICODE_CHARACTER_CLASS);

    private static final String[] CHU_SO = {"không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"};
    private static final long MOT_TY = 1_000_000_000L;

    private DinhDangEmail() {
    }

    // ---------------- Ngày giờ ----------------

    /** "20/10/2026" theo giờ Việt Nam; null vào thì null ra. */
    public static String ngay(Instant luc) {
        return luc == null ? null : NGAY.format(luc);
    }

    /** "14:35 ngày 19/10/2026" theo giờ Việt Nam; null vào thì null ra. */
    public static String gioNgay(Instant luc) {
        return luc == null ? null : GIO_NGAY.format(luc);
    }

    /** "5 phút": làm tròn lên theo phút, tối thiểu 1 phút. */
    public static String phut(Duration thoiHan) {
        if (thoiHan == null || thoiHan.isNegative() || thoiHan.isZero()) {
            return "1 phút";
        }
        long giay = thoiHan.toSeconds();
        long phut = Math.max(1, (giay + 59) / 60);
        return phut + " phút";
    }

    // ---------------- Số ----------------

    /** "1.500.000". Có phần lẻ (dữ liệu sai) thì ghi WARN và hiện đúng giá trị: "1.500.000,5". */
    public static String tien(BigDecimal soTien) {
        if (soTien == null) {
            throw new IllegalArgumentException("Số tiền không được null");
        }
        if (coPhanLe(soTien)) {
            log.warn("Số tiền có phần lẻ khi dựng email: {}", soTien.toPlainString());
        }
        return dinhDangSo(soTien, 2);
    }

    /** "51.400.000 ₫" (khoảng trắng không ngắt trước ₫). */
    public static String tienDong(BigDecimal soTien) {
        return tien(soTien) + KY_HIEU_DONG;
    }

    /**
     * "120 cái": số lượng không phần lẻ, kèm đơn vị tính viết thường; đơn vị trống thì "cái".
     * Có phần lẻ khác 0 (dữ liệu sai) thì ghi WARN và hiện đúng giá trị với dấu phẩy ("1,5 bộ").
     */
    public static String soLuong(BigDecimal soLuong, String donViTinh) {
        if (soLuong == null) {
            throw new IllegalArgumentException("Số lượng không được null");
        }
        if (coPhanLe(soLuong)) {
            log.warn("Số lượng có phần lẻ khi dựng email: {}", soLuong.toPlainString());
        }
        return dinhDangSo(soLuong, 3) + " " + donViTinh(donViTinh);
    }

    /** Đơn vị tính để hiện và để so sánh: cắt khoảng trắng, viết thường; trống thì "cái". */
    public static String donViTinh(String donViTinh) {
        if (donViTinh == null || donViTinh.isBlank()) {
            return DON_VI_TINH_MAC_DINH;
        }
        return donViTinh.trim().toLowerCase(TIENG_VIET);
    }

    static boolean coPhanLe(BigDecimal so) {
        return so.signum() != 0 && so.stripTrailingZeros().scale() > 0;
    }

    private static String dinhDangSo(BigDecimal so, int toiDaSoLe) {
        DecimalFormatSymbols kyHieu = new DecimalFormatSymbols(TIENG_VIET);
        kyHieu.setGroupingSeparator('.');
        kyHieu.setDecimalSeparator(',');
        kyHieu.setMinusSign('-');
        DecimalFormat df = new DecimalFormat("#,##0", kyHieu);
        df.setMaximumFractionDigits(toiDaSoLe);
        df.setRoundingMode(RoundingMode.HALF_UP);
        df.setGroupingUsed(true);
        return df.format(so);
    }

    // ---------------- Số tiền bằng chữ ----------------

    /**
     * "Năm mươi mốt triệu bốn trăm nghìn đồng". Đọc theo nhóm 3 chữ số; nhóm không đứng đầu đọc đủ "không trăm",
     * "linh"; phần từ hàng tỷ trở lên đọc như một số riêng rồi thêm "tỷ" (1.234 tỷ = "một nghìn hai trăm ba mươi tư
     * tỷ"). Số âm thì báo lỗi.
     */
    public static String bangChu(long soTien) {
        if (soTien < 0) {
            throw new IllegalArgumentException("Không đọc được số tiền âm");
        }
        if (soTien == 0) {
            return "Không đồng";
        }
        String chu = docSo(soTien);
        return Character.toUpperCase(chu.charAt(0)) + chu.substring(1) + " đồng";
    }

    /** Như {@link #bangChu(long)}; null, âm hoặc có phần lẻ thì báo lỗi. */
    public static String bangChu(BigDecimal soTien) {
        if (soTien == null) {
            throw new IllegalArgumentException("Số tiền không được null");
        }
        if (soTien.signum() < 0) {
            throw new IllegalArgumentException("Không đọc được số tiền âm");
        }
        if (coPhanLe(soTien)) {
            throw new IllegalArgumentException("Không đọc bằng chữ số tiền có phần lẻ: " + soTien.toPlainString());
        }
        return bangChu(soTien.longValueExact());
    }

    /** Đọc số dương, chữ thường, không có "đồng". */
    private static String docSo(long so) {
        List<String> phan = new ArrayList<>();
        long ty = so / MOT_TY;
        long duoiTy = so % MOT_TY;
        if (ty > 0) {
            phan.add(docSo(ty) + " tỷ");
        }
        if (duoiTy > 0) {
            phan.add(docDuoiTy(duoiTy, ty > 0));
        }
        return String.join(" ", phan);
    }

    /** Phần dưới một tỷ (0 < so < 1.000.000.000). {@code coPhanTruoc}: đã có phần tỷ đứng trước. */
    private static String docDuoiTy(long so, boolean coPhanTruoc) {
        long[] nhom = {so / 1_000_000, (so / 1_000) % 1_000, so % 1_000};
        String[] donVi = {"triệu", "nghìn", ""};
        List<String> phan = new ArrayList<>();
        boolean daCoTruoc = coPhanTruoc;
        for (int i = 0; i < nhom.length; i++) {
            if (nhom[i] == 0) {
                continue;
            }
            String chu = docBaSo((int) nhom[i], daCoTruoc);
            phan.add(donVi[i].isEmpty() ? chu : chu + " " + donVi[i]);
            daCoTruoc = true;
        }
        return String.join(" ", phan);
    }

    /** Một nhóm 3 chữ số (1..999). {@code dayDu}: nhóm không đứng đầu, đọc đủ "không trăm" và "linh". */
    private static String docBaSo(int so, boolean dayDu) {
        int tram = so / 100;
        int chuc = (so / 10) % 10;
        int donVi = so % 10;
        List<String> tu = new ArrayList<>();
        boolean coTram = dayDu || tram > 0;
        if (coTram) {
            tu.add(CHU_SO[tram]);
            tu.add("trăm");
        }
        if (chuc == 0) {
            if (donVi != 0) {
                if (coTram) {
                    tu.add("linh");
                }
                tu.add(CHU_SO[donVi]);
            }
        } else if (chuc == 1) {
            tu.add("mười");
            if (donVi == 5) {
                tu.add("lăm");
            } else if (donVi != 0) {
                tu.add(CHU_SO[donVi]);
            }
        } else {
            tu.add(CHU_SO[chuc]);
            tu.add("mươi");
            if (donVi == 1) {
                tu.add("mốt");
            } else if (donVi == 4) {
                tu.add("tư");
            } else if (donVi == 5) {
                tu.add("lăm");
            } else if (donVi != 0) {
                tu.add(CHU_SO[donVi]);
            }
        }
        return String.join(" ", tu);
    }

    // ---------------- Điện thoại ----------------

    /**
     * Cách nhóm số điện thoại khi hiện (dữ liệu lưu như đã nhập). Chép đúng {@code fmtPhone} của demo Thông tin cửa
     * hàng ({@code docs/demo-cua-hang/Main.dc.html}), cùng bộ ca test với {@code dinhDangDienThoai} ở frontend
     * (soát chéo 3.4):
     * <ul>
     *   <li>có ký tự ngoài chữ số, khoảng trắng, ". - ( )" (ví dụ "+84 912…"): giữ nguyên như đã nhập;</li>
     *   <li>11 số bắt đầu "02" (máy bàn): 3-4-4 ("028 7300 9999");</li>
     *   <li>10 số bắt đầu "0": 4-3-3 ("0912 345 678");</li>
     *   <li>1800/1900 8 số: 4-4 ("1900 1234"); 10 số: 4-3-3 ("1900 123 456");</li>
     *   <li>khác: giữ nguyên.</li>
     * </ul>
     * Trống thì null (mẫu bỏ dòng).
     */
    public static String dienThoai(String soDienThoai) {
        if (soDienThoai == null || soDienThoai.isBlank()) {
            return null;
        }
        String goc = soDienThoai.trim();
        if (!DIEN_THOAI_KY_TU_HOP_LE.matcher(goc).matches()) {
            return goc;
        }
        String so = goc.replaceAll("[^0-9]", "");
        if (so.matches("02\\d{9}")) {
            return nhom(so, 3, 4, 4);
        }
        if (so.matches("0\\d{9}")) {
            return nhom(so, 4, 3, 3);
        }
        if (so.matches("1[89]00\\d{4}")) {
            return nhom(so, 4, 4);
        }
        if (so.matches("1[89]00\\d{6}")) {
            return nhom(so, 4, 3, 3);
        }
        return goc;
    }

    /** Chuỗi cho liên kết {@code tel:}: chỉ chữ số (và dấu + đầu nếu có); trống thì null. */
    public static String dienThoaiLienKet(String soDienThoai) {
        if (soDienThoai == null || soDienThoai.isBlank()) {
            return null;
        }
        String goc = soDienThoai.trim();
        String so = goc.replaceAll("[^0-9]", "");
        if (so.isEmpty()) {
            return null;
        }
        return goc.startsWith("+") ? "+" + so : so;
    }

    private static String nhom(String so, int... doDai) {
        StringBuilder sb = new StringBuilder();
        int i = 0;
        for (int d : doDai) {
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(so, i, i + d);
            i += d;
        }
        return sb.toString();
    }
}
