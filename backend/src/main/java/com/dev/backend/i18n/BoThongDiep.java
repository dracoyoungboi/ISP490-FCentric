package com.dev.backend.i18n;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.ChoiceFormat;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Kho câu thông báo đa ngôn ngữ (Spring MessageSource) — đọc mọi tệp {@code classpath:i18n/thong-diep/<nhom>.properties}
 * (tiếng Việt, mặc định) và {@code <nhom>_en.properties} (tiếng Anh). Thêm nhóm mới chỉ cần thêm cặp tệp, không sửa cấu hình.
 *
 * <p>Tệp viết UTF-8, theo cú pháp MessageFormat: tham số {@code {0}}, {@code {1}}; dấu nháy đơn phải viết đôi ({@code ''}).
 * Tham số luôn được đổi sang chuỗi trước khi ghép (giữ đúng câu tiếng Việt cũ: số không bị chèn dấu phân cách).
 * Câu chia số ít/nhiều ({@code {0,choice,0#{0} items|1#{0} item|1<{0} items}}, chỉ có ở tệp tiếng Anh) do
 * {@link #dich} tự chọn nhánh theo giá trị số của tham số đếm, rồi ghép như mọi câu khác: số hiện đúng chuỗi nơi gọi
 * truyền vào (không thêm dấu phân cách). Tham số đếm không đọc được thành số thì trả câu tiếng Việt.
 * Gọi thẳng bean {@code messageSource} với khóa có choice thì phải truyền tham số đếm kiểu số.
 *
 * <p>Dùng tĩnh (không cần tiêm bean) để exception và lớp tiện ích gọi được; cùng một thể hiện cũng là bean
 * {@code messageSource} của Spring ({@link CauHinhThongDiep}).
 */
public final class BoThongDiep {

    private static final Logger log = LoggerFactory.getLogger(BoThongDiep.class);
    private static final String THU_MUC = "i18n/thong-diep/";
    private static final Pattern THAM_SO = Pattern.compile("\\{(\\d+)}");
    private static final Pattern THAM_SO_DEM = Pattern.compile("\\{(\\d+),\\s*choice\\s*,");

    private static final ResourceBundleMessageSource NGUON;
    /** Câu tiếng Việt (không tham số) → khóa, để dịch câu đã ghép sẵn (annotation kiểm dữ liệu, câu cũ chưa chuyển khóa). */
    private static final Map<String, String> KHOA_THEO_CAU = new LinkedHashMap<>();
    /** Câu tiếng Việt có tham số → mẫu so khớp. */
    private static final List<MauCau> MAU_CAU = new ArrayList<>();
    /** "ngôn ngữ:khóa" → mẫu câu gốc có {@code {n,choice,...}} (đọc thẳng từ tệp). */
    private static final Map<String, String> MAU_CO_SO_DEM = new HashMap<>();
    /**
     * Nhóm không nạp vào bảng dò ngược: {@code nhan} là nhãn ngắn ("Phiếu xuất {0}", "Đợt kiểm kê {0}") chỉ dùng qua
     * {@link NhanChungTu} (theo khóa); làm mẫu dò ngược thì khớp nhầm câu khác ("Phiếu xuất kho" → "... kho").
     * Khai báo trước khối static bên dưới (khối đó dùng tới).
     */
    private static final Set<String> NHOM_KHONG_DO_NGUOC = Set.of("nhan");
    /** Khóa lẻ cùng loại nhãn "&lt;chứng từ&gt; {0}" ở nhóm khác, chỉ dùng chiều xuôi (ThongDiep.dich/of): không dò ngược. */
    private static final Set<String> KHOA_KHONG_DO_NGUOC = Set.of(
            "chungTuKho.phieuXuatSo", "chungTuKho.phieuNhatSo", "sanPhamMuaHang.donMuaSo");

    private record MauCau(String khoa, Pattern mau, List<Integer> thuTuThamSo) {
    }

    static {
        NGUON = new ResourceBundleMessageSource();
        NGUON.setDefaultEncoding(StandardCharsets.UTF_8.name());
        NGUON.setFallbackToSystemLocale(false);
        NGUON.setAlwaysUseMessageFormat(true);
        NGUON.setUseCodeAsDefaultMessage(false);
        NGUON.setBasenames(timCacNhom().stream().map(nhom -> THU_MUC + nhom).toArray(String[]::new));
        napBangNguoc();
        napThamSoDem();
    }

    private BoThongDiep() {
    }

    public static ResourceBundleMessageSource nguon() {
        return NGUON;
    }

    /** Câu theo khóa ở ngôn ngữ chỉ định; thiếu ở tiếng Anh thì lấy tiếng Việt; thiếu hẳn thì trả lại khóa (và ghi log). */
    public static String dich(String khoa, Object[] thamSo, Locale ngonNgu) {
        Locale dich = ngonNgu == null ? NgonNgu.VI : ngonNgu;
        Object[] chuoi = thanhChuoi(thamSo, dich);
        String mauDem = MAU_CO_SO_DEM.get(dich.getLanguage() + ":" + khoa);
        if (mauDem != null) {
            String cau = ghepCoSoDem(mauDem, thamSo, chuoi, dich);
            if (cau != null) return cau;
            // Tham số đếm thiếu hoặc không phải số: câu tiếng Việt vẫn đúng hơn câu tiếng Anh sai/hỏng
            log.warn("Không chia được số ít/nhiều cho khóa '{}', dùng câu tiếng Việt", khoa);
            return NgonNgu.VI.equals(dich) ? khoa : dich(khoa, thamSo, NgonNgu.VI);
        }
        try {
            return NGUON.getMessage(khoa, chuoi, dich);
        } catch (NoSuchMessageException e) {
            log.warn("Thiếu câu thông báo cho khóa '{}'", khoa);
            return khoa;
        }
    }

    /**
     * Thay từng khối {@code {n,choice,...}} bằng nhánh hợp với giá trị số của tham số n, rồi ghép phần còn lại bằng
     * MessageFormat với tham số dạng chuỗi (số trong nhánh hiện đúng như nơi gọi truyền). Không làm được thì trả null.
     */
    private static String ghepCoSoDem(String mau, Object[] thamSo, Object[] chuoi, Locale ngonNgu) {
        if (thamSo == null || chuoi == null) return null;
        StringBuilder ra = new StringBuilder();
        Matcher m = THAM_SO_DEM.matcher(mau);
        int viTri = 0;
        try {
            while (m.find(viTri)) {
                int n = Integer.parseInt(m.group(1));
                int dau = m.end();
                int cuoi = dau;
                for (int sau = 1; cuoi < mau.length(); cuoi++) {
                    char c = mau.charAt(cuoi);
                    if (c == '{') sau++;
                    else if (c == '}' && --sau == 0) break;
                }
                if (cuoi >= mau.length() || n >= thamSo.length) return null;
                BigDecimal so = thanhSo(thamSo[n]);
                if (so == null) return null;
                ra.append(mau, viTri, m.start()).append(new ChoiceFormat(mau.substring(dau, cuoi)).format(so.doubleValue()));
                viTri = cuoi + 1;
            }
            ra.append(mau.substring(viTri));
            return new MessageFormat(ra.toString(), ngonNgu).format(chuoi);
        } catch (IllegalArgumentException e) {
            log.warn("Mẫu chia số ít/nhiều sai cú pháp: {}", e.getMessage());
            return null;
        }
    }

    /** Giá trị số của tham số đếm (số thô hoặc chuỗi toPlainString, dấu chấm là dấu thập phân); không đọc được thì null. */
    private static BigDecimal thanhSo(Object x) {
        if (x instanceof BigDecimal so) return so;
        if (x instanceof Number so) return new BigDecimal(so.toString());
        if (x == null) return null;
        try {
            String s = String.valueOf(x).trim();
            // "2,5" (số thập phân kiểu Việt) → 2.5; chuỗi khác giữ nguyên
            if (s.matches("\\d+,\\d+")) s = s.replace(',', '.');
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Ghi lại mẫu câu gốc của mọi khóa có {@code {n,choice,...}}, theo từng tệp ngôn ngữ. */
    private static void napThamSoDem() {
        Pattern duoiNgonNgu = Pattern.compile("_([a-z]{2})(_[A-Z]{2})?$");
        try {
            Resource[] tep = new PathMatchingResourcePatternResolver(BoThongDiep.class.getClassLoader())
                    .getResources("classpath*:" + THU_MUC + "*.properties");
            for (Resource r : tep) {
                String ten = r.getFilename();
                if (ten == null || !ten.endsWith(".properties")) continue;
                Matcher duoi = duoiNgonNgu.matcher(ten.substring(0, ten.length() - ".properties".length()));
                String ma = duoi.find() ? duoi.group(1) : NgonNgu.VI.getLanguage();
                Properties p = new Properties();
                try (var vao = r.getInputStream(); Reader doc = new InputStreamReader(vao, StandardCharsets.UTF_8)) {
                    p.load(doc);
                }
                for (String khoa : p.stringPropertyNames()) {
                    String mau = p.getProperty(khoa);
                    if (THAM_SO_DEM.matcher(mau).find()) MAU_CO_SO_DEM.put(ma + ":" + khoa, mau);
                }
            }
        } catch (IOException e) {
            log.error("Không đọc được thư mục câu thông báo {}", THU_MUC, e);
        }
    }

    public static boolean coKhoa(String khoa) {
        try {
            NGUON.getMessage(khoa, null, NgonNgu.VI);
            return true;
        } catch (NoSuchMessageException e) {
            return false;
        }
    }

    /**
     * Dịch một câu tiếng Việt ĐÃ GHÉP sẵn (không biết khóa) sang ngôn ngữ chỉ định, nếu câu đó có trong kho
     * (khớp nguyên văn, hoặc khớp mẫu có tham số). Không nhận ra thì trả {@code null}.
     */
    public static String dichCauViet(String cauViet, Locale ngonNgu) {
        if (cauViet == null || cauViet.isBlank()) return null;
        String cau = cauViet.trim();
        String khoa = KHOA_THEO_CAU.get(cau);
        if (khoa != null) return dich(khoa, null, ngonNgu);
        mau:
        for (MauCau mau : MAU_CAU) {
            Matcher khop = mau.mau().matcher(cau);
            if (!khop.matches()) continue;
            int soThamSo = mau.thuTuThamSo().stream().mapToInt(i -> i).max().orElse(-1) + 1;
            Object[] thamSo = new Object[soThamSo];
            for (int i = 0; i < mau.thuTuThamSo().size(); i++) {
                String giaTri = khop.group(i + 1);
                // Phần tham số còn chữ Việt nghĩa là mẫu chung khớp nhầm câu khác (vd. "{0} đang trống"):
                // bỏ, để không ra câu nửa Anh nửa Việt
                if (CHU_VIET.matcher(giaTri).find()) continue mau;
                thamSo[mau.thuTuThamSo().get(i)] = giaTri;
            }
            return dich(mau.khoa(), thamSo, ngonNgu);
        }
        return null;
    }

    private static final Pattern CHU_VIET = Pattern.compile("[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /** Tham số lồng là ThongDiep thì dịch CÙNG ngôn ngữ với câu ngoài (câu Việt không lẫn chữ Anh và ngược lại). */
    private static Object[] thanhChuoi(Object[] thamSo, Locale ngonNgu) {
        if (thamSo == null || thamSo.length == 0) return null;
        Object[] ra = new Object[thamSo.length];
        for (int i = 0; i < thamSo.length; i++) {
            Object x = thamSo[i];
            if (x instanceof ThongDiep td) ra[i] = td.theoNgonNgu(ngonNgu);
            else ra[i] = String.valueOf(x);
        }
        return ra;
    }

    private static TreeSet<String> timCacNhom() {
        TreeSet<String> nhom = new TreeSet<>();
        try {
            Resource[] tep = new PathMatchingResourcePatternResolver(BoThongDiep.class.getClassLoader())
                    .getResources("classpath*:" + THU_MUC + "*.properties");
            for (Resource r : tep) {
                String ten = r.getFilename();
                if (ten == null || !ten.endsWith(".properties")) continue;
                String goc = ten.substring(0, ten.length() - ".properties".length());
                if (goc.matches(".*_[a-z]{2}(_[A-Z]{2})?$")) continue; // tệp theo ngôn ngữ, vd. kho_en
                nhom.add(goc);
            }
        } catch (IOException e) {
            log.error("Không đọc được thư mục câu thông báo {}", THU_MUC, e);
        }
        return nhom;
    }

    private static void napBangNguoc() {
        for (String nhom : timCacNhom()) {
            // thongBao*: có bảng dò ngược riêng ở DichThongBao (tham số được phép có chữ Việt), không trộn vào bảng chung
            if (NHOM_KHONG_DO_NGUOC.contains(nhom) || nhom.startsWith(DichThongBao.TIEN_TO_NHOM)) continue;
            Properties p = new Properties();
            try (var vao = BoThongDiep.class.getClassLoader().getResourceAsStream(THU_MUC + nhom + ".properties")) {
                if (vao == null) continue;
                try (Reader doc = new InputStreamReader(vao, StandardCharsets.UTF_8)) {
                    p.load(doc);
                }
            } catch (IOException e) {
                log.error("Không đọc được tệp câu thông báo {}", nhom, e);
                continue;
            }
            for (String khoa : new TreeSet<>(p.stringPropertyNames())) {
                if (KHOA_KHONG_DO_NGUOC.contains(khoa)) continue;
                String mau = p.getProperty(khoa);
                // Câu như người dùng thấy: bỏ nháy đôi của MessageFormat
                String cau = mau.replace("''", "'").trim();
                if (!THAM_SO.matcher(mau).find()) {
                    KHOA_THEO_CAU.putIfAbsent(cau, khoa);
                    continue;
                }
                // Mẫu gần như chỉ có tham số ("{0} {1}", "{0}, {1}") khớp mọi câu: không dùng để dò ngược
                String phanChu = THAM_SO.matcher(cau).replaceAll("").replaceAll("[\\s\\p{Punct}·…]", "");
                if (phanChu.length() < 4) continue;
                MAU_CAU.add(taoMau(khoa, cau));
            }
        }
        // Mẫu dài (cụ thể) thử trước mẫu ngắn
        MAU_CAU.sort((a, b) -> Integer.compare(b.mau().pattern().length(), a.mau().pattern().length()));
    }

    private static MauCau taoMau(String khoa, String cau) {
        Matcher m = THAM_SO.matcher(cau);
        StringBuilder regex = new StringBuilder("^");
        List<Integer> thuTu = new ArrayList<>();
        int viTri = 0;
        while (m.find()) {
            regex.append(Pattern.quote(cau.substring(viTri, m.start())));
            regex.append("(.+?)");
            thuTu.add(Integer.parseInt(m.group(1)));
            viTri = m.end();
        }
        regex.append(Pattern.quote(cau.substring(viTri))).append("$");
        return new MauCau(khoa, Pattern.compile(regex.toString(), Pattern.DOTALL), thuTu);
    }
}
