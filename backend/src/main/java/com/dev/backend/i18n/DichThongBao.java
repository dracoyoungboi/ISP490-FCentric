package com.dev.backend.i18n;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dịch LÚC ĐỌC tiêu đề và nội dung thông báo (chuông trên thanh trên cùng). Thông báo lưu sẵn tiếng Việt trong bảng
 * {@code thong_bao}; câu nào được ghi qua {@code ThongDiep.vi("thongBao…", …)} thì có mẫu ở nhóm {@code thongBao*} và dịch
 * ngược được theo mẫu.
 *
 * <p>Khác {@link DichCauDaLuu}: tham số được phép có chữ Việt (tên nhà cung cấp, tên kho, tên kênh…) — mẫu ở đây chỉ
 * gồm câu thông báo nên không khớp nhầm câu thuộc nhóm khác. Câu ghép được tách dần: cả chuỗi → từng câu (tách ở
 * dấu chấm + khoảng trắng) → từng cụm (tách ở dấu phẩy). Chỉ dịch khi MỌI mảnh đều nhận ra; còn sót mảnh nào thì trả
 * nguyên văn tiếng Việt, tránh câu nửa Anh nửa Việt. Tham số cũng được dịch nếu bản thân nó là một câu/cụm đã biết
 * (tên vai trò, tên quyền…).
 *
 * <p>Nhóm {@code thongBao*} không nạp vào bảng dò ngược chung của {@link BoThongDiep} (xem
 * {@code NHOM_KHONG_DO_NGUOC}) để mẫu có tham số không khớp nhầm câu của nhóm khác.
 */
public final class DichThongBao {

    private static final Logger log = LoggerFactory.getLogger(DichThongBao.class);
    private static final String THU_MUC = "i18n/thong-diep/";
    /** Tên nhóm (và tiền tố khóa) của mọi câu thông báo: thongBaoXuatKho, thongBaoMuaHang… */
    public static final String TIEN_TO_NHOM = "thongBao";
    private static final Pattern THAM_SO = Pattern.compile("\\{(\\d+)}");
    private static final int DAI_TOI_DA = 600;
    private static final int SO_CAU_LUU_TAM = 3000;

    private record Mau(String khoa, Pattern mau, List<Integer> thuTuThamSo, int doDaiChu) {
    }

    /** Câu không tham số → khóa. */
    private static final Map<String, String> THEO_CAU = new LinkedHashMap<>();
    private static final List<Mau> MAU = new ArrayList<>();
    private static final Object KHONG_NHAN_RA = new Object();
    private static final Map<String, Object> LUU_TAM = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Object> cu) {
            return size() > SO_CAU_LUU_TAM;
        }
    };

    private DichThongBao() {
    }

    /** Có nhóm thông báo nào (mọi khóa thuộc nhóm {@code thongBao*}) không — kiểm tra nhanh cho kiểm thử. */
    public static int soMau() {
        return THEO_CAU.size() + MAU.size();
    }

    /**
     * Dịch câu thông báo tiếng Việt sang ngôn ngữ chỉ định. Tiếng Việt (hoặc null) trả nguyên; không nhận ra hết thì trả
     * nguyên văn.
     */
    public static String dich(String cauViet, Locale ngonNgu) {
        if (cauViet == null || cauViet.isBlank()) return cauViet;
        if (ngonNgu == null || NgonNgu.VI.getLanguage().equals(ngonNgu.getLanguage())) return cauViet;
        if (cauViet.length() > DAI_TOI_DA) return cauViet;
        String khoaLuu = ngonNgu.getLanguage() + "\u0001" + cauViet;
        synchronized (LUU_TAM) {
            Object da = LUU_TAM.get(khoaLuu);
            if (da != null) return da == KHONG_NHAN_RA ? cauViet : (String) da;
        }
        String ra = dichKhongLuu(cauViet.trim(), ngonNgu);
        synchronized (LUU_TAM) {
            LUU_TAM.put(khoaLuu, ra == null ? KHONG_NHAN_RA : ra);
        }
        return ra == null ? cauViet : ra;
    }

    /** Như {@link #dich(String, Locale)} theo ngôn ngữ của request hiện tại. */
    public static String dich(String cauViet) {
        return dich(cauViet, NgonNgu.hienTai());
    }

    /**
     * Thứ tự thử (quan trọng: mẫu có tham số dùng {@code (.+?)} nên có thể "nuốt" cả đoạn nhiều câu, vì vậy tách trước,
     * khớp cả chuỗi sau): câu cố định nguyên văn → tách thành câu (". ") → từng câu: nguyên văn → tách thành cụm (", ") →
     * khớp mẫu có tham số cả mảnh. Tách mà có mảnh không nhận ra thì lùi về khớp cả chuỗi (tên riêng có ". " / ", ").
     */
    static String dichKhongLuu(String cau, Locale ngonNgu) {
        String coDinh = THEO_CAU.get(cau);
        if (coDinh != null) return BoThongDiep.dich(coDinh, null, ngonNgu);
        List<String> cacCau = tach(cau, SAU_DAU_CHAM);
        if (cacCau.size() > 1) {
            StringBuilder ra = new StringBuilder();
            boolean duHet = true;
            for (String c : cacCau) {
                String d = dichMotCau(c, ngonNgu);
                if (d == null) {
                    duHet = false;
                    break;
                }
                if (ra.length() > 0) ra.append(' ');
                ra.append(d);
            }
            if (duHet) return ra.toString();
        }
        return dichMotCau(cau, ngonNgu);
    }

    private static final Pattern SAU_DAU_CHAM = Pattern.compile("(?<=[.!?]) +(?=\\S)");
    private static final Pattern SAU_DAU_PHAY = Pattern.compile("(?<=,) +(?=\\S)");

    private static String dichMotCau(String cau, Locale ngonNgu) {
        String coDinh = THEO_CAU.get(cau);
        if (coDinh != null) return BoThongDiep.dich(coDinh, null, ngonNgu);
        List<String> cum = tach(cau, SAU_DAU_PHAY);
        if (cum.size() > 1) {
            String ghep = dichTungCum(cum, ngonNgu);
            if (ghep != null) return ghep;
        }
        return khopMotMau(cau, ngonNgu);
    }

    /** Dấu chấm cuối câu thuộc cụm cuối ("…, tổng 960.000 ₫.") — khớp cả cụm có và không có dấu chấm. */
    private static String dichTungCum(List<String> cum, Locale ngonNgu) {
        StringBuilder ra = new StringBuilder();
        for (int i = 0; i < cum.size(); i++) {
            String c = cum.get(i);
            boolean cuoi = i == cum.size() - 1;
            if (cuoi && c.endsWith(".")) {
                String d = khopMotMau(c, ngonNgu);
                String hauTo = "";
                if (d == null) {
                    d = khopMotMau(c.substring(0, c.length() - 1), ngonNgu);
                    hauTo = ".";
                }
                if (d == null) return null;
                ra.append(d).append(hauTo);
            } else {
                String d = khopMotMau(c.endsWith(",") ? c.substring(0, c.length() - 1) : c, ngonNgu);
                if (d == null) return null;
                ra.append(d);
                if (!cuoi) ra.append(", ");
            }
        }
        return ra.toString();
    }

    private static List<String> tach(String cau, Pattern ranhGioi) {
        List<String> ra = new ArrayList<>();
        int dau = 0;
        Matcher m = ranhGioi.matcher(cau);
        while (m.find()) {
            ra.add(cau.substring(dau, m.start()));
            dau = m.end();
        }
        ra.add(cau.substring(dau));
        return ra;
    }

    /** Khớp CẢ chuỗi với đúng một mẫu (hoặc câu cố định); tham số cũng được dịch nếu là câu/cụm đã biết. */
    private static String khopMotMau(String cau, Locale ngonNgu) {
        String khoa = THEO_CAU.get(cau);
        if (khoa != null) return BoThongDiep.dich(khoa, null, ngonNgu);
        for (Mau mau : MAU) {
            Matcher khop = mau.mau().matcher(cau);
            if (!khop.matches()) continue;
            int soThamSo = mau.thuTuThamSo().stream().mapToInt(i -> i).max().orElse(-1) + 1;
            Object[] thamSo = new Object[soThamSo];
            for (int i = 0; i < mau.thuTuThamSo().size(); i++) {
                thamSo[mau.thuTuThamSo().get(i)] = dichThamSo(khop.group(i + 1), ngonNgu);
            }
            return BoThongDiep.dich(mau.khoa(), thamSo, ngonNgu);
        }
        return null;
    }

    /** Tham số là câu/cụm đã biết (vai trò, quyền, tên kho mặc định…) thì dịch; còn lại (tên riêng, mã) giữ nguyên. */
    private static String dichThamSo(String giaTri, Locale ngonNgu) {
        if (giaTri == null || giaTri.isBlank()) return giaTri;
        String khoa = THEO_CAU.get(giaTri);
        if (khoa != null) return BoThongDiep.dich(khoa, null, ngonNgu);
        // Tham số là cả một mẫu có tham số (vd "Kho #7"): dịch bằng chính bảng thông báo
        String mauCon = khopMotMau(giaTri, ngonNgu);
        if (mauCon != null) return mauCon;
        String chung = BoThongDiep.dichCauViet(giaTri, ngonNgu);
        if (chung != null) return chung;
        if (giaTri.contains(", ")) {
            // Danh sách "A, B, C": dịch từng phần tử nếu phần tử nào nhận ra, còn lại giữ nguyên
            String[] phan = giaTri.split(", ");
            StringBuilder ra = new StringBuilder();
            boolean daDich = false;
            for (int i = 0; i < phan.length; i++) {
                String p = phan[i];
                String d = THEO_CAU.containsKey(p) ? BoThongDiep.dich(THEO_CAU.get(p), null, ngonNgu)
                        : BoThongDiep.dichCauViet(p, ngonNgu);
                if (d != null) daDich = true;
                if (i > 0) ra.append(", ");
                ra.append(d != null ? d : p);
            }
            if (daDich) return ra.toString();
        }
        return giaTri;
    }

    private static void nap() {
        TreeSet<String> nhom = new TreeSet<>();
        try {
            Resource[] tep = new PathMatchingResourcePatternResolver(DichThongBao.class.getClassLoader())
                    .getResources("classpath*:" + THU_MUC + TIEN_TO_NHOM + "*.properties");
            for (Resource r : tep) {
                String ten = r.getFilename();
                if (ten == null || !ten.endsWith(".properties")) continue;
                String goc = ten.substring(0, ten.length() - ".properties".length());
                if (goc.matches(".*_[a-z]{2}(_[A-Z]{2})?$")) continue;
                nhom.add(goc);
            }
        } catch (IOException e) {
            log.error("Không đọc được thư mục câu thông báo {}", THU_MUC, e);
            return;
        }
        List<Mau> mau = new ArrayList<>();
        for (String n : nhom) {
            Properties p = new Properties();
            try (var vao = DichThongBao.class.getClassLoader().getResourceAsStream(THU_MUC + n + ".properties")) {
                if (vao == null) continue;
                try (Reader doc = new InputStreamReader(vao, StandardCharsets.UTF_8)) {
                    p.load(doc);
                }
            } catch (IOException e) {
                log.error("Không đọc được tệp câu thông báo {}", n, e);
                continue;
            }
            Properties pEn = new Properties();
            try (var vao = DichThongBao.class.getClassLoader().getResourceAsStream(THU_MUC + n + "_en.properties")) {
                if (vao != null) {
                    try (Reader doc = new InputStreamReader(vao, StandardCharsets.UTF_8)) {
                        pEn.load(doc);
                    }
                }
            } catch (IOException e) {
                log.error("Không đọc được tệp câu thông báo tiếng Anh {}", n, e);
            }
            for (String khoa : new TreeSet<>(p.stringPropertyNames())) {
                String cau = p.getProperty(khoa).replace("''", "'").trim();
                if (!THAM_SO.matcher(cau).find()) {
                    THEO_CAU.putIfAbsent(cau, khoa);
                    continue;
                }
                mau.add(taoMau(khoa, cau, thamSoDem(pEn.getProperty(khoa))));
            }
        }
        // Mẫu có nhiều chữ cố định (cụ thể) thử trước; bằng nhau thì mẫu có ít tham số hơn trước
        mau.sort((a, b) -> {
            int c = Integer.compare(b.doDaiChu(), a.doDaiChu());
            return c != 0 ? c : Integer.compare(a.thuTuThamSo().size(), b.thuTuThamSo().size());
        });
        MAU.addAll(mau);
    }

    private static final Pattern THAM_SO_DEM = Pattern.compile("\\{(\\d+),\\s*choice\\s*,");
    /** Số (nguyên hoặc thập phân kiểu Việt "2,5", ngăn nghìn "1.500"): tham số đếm và số sau dấu {@code #}. */
    private static final String SO = "([0-9]+(?:[.,][0-9]+)*)";

    /** Chỉ số tham số mà bản tiếng Anh dùng làm số đếm ({@code {n,choice,...}}): mẫu dò ngược chỉ nhận số ở đó. */
    private static java.util.Set<Integer> thamSoDem(String mauAnh) {
        java.util.Set<Integer> ra = new java.util.HashSet<>();
        if (mauAnh == null) return ra;
        Matcher m = THAM_SO_DEM.matcher(mauAnh);
        while (m.find()) ra.add(Integer.parseInt(m.group(1)));
        return ra;
    }

    private static Mau taoMau(String khoa, String cau, java.util.Set<Integer> thamSoDem) {
        Matcher m = THAM_SO.matcher(cau);
        StringBuilder regex = new StringBuilder("^");
        List<Integer> thuTu = new ArrayList<>();
        int viTri = 0;
        int doDaiChu = 0;
        while (m.find()) {
            String chu = cau.substring(viTri, m.start());
            doDaiChu += chu.length();
            regex.append(Pattern.quote(chu));
            int n = Integer.parseInt(m.group(1));
            // Tên riêng có dấu phẩy / " và " không được lọt vào ô số đếm; "Kho #7" chỉ nhận số sau dấu #
            boolean laSo = thamSoDem.contains(n) || (m.start() > 0 && cau.charAt(m.start() - 1) == '#');
            regex.append(laSo ? SO : "(.+?)");
            thuTu.add(n);
            viTri = m.end();
        }
        String duoi = cau.substring(viTri);
        doDaiChu += duoi.length();
        regex.append(Pattern.quote(duoi)).append("$");
        return new Mau(khoa, Pattern.compile(regex.toString(), Pattern.DOTALL), thuTu, doDaiChu);
    }

    // Đặt CUỐI lớp: nap() dùng các hằng ở trên (SO, THAM_SO_DEM...) nên phải chạy sau khi chúng được khởi tạo
    static {
        nap();
    }
}
