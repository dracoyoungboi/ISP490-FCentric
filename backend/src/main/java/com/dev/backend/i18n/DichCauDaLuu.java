package com.dev.backend.i18n;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dịch LÚC ĐỌC một câu tiếng Việt đã lưu sẵn (lý do lỗi giao dịch payOS, lý do lỗi đẩy tồn của từng SKU...) để hiện
 * trên giao diện tiếng Anh. Dữ liệu lưu giữ nguyên tiếng Việt; câu không nhận ra thì trả nguyên văn.
 *
 * <p>Ngoài dò ngược thường ({@link BoThongDiep#dichCauViet}), còn tách được câu "bọc" một câu khác — vd.
 * "Đã nhận tiền nhưng chưa tạo được đơn: khách mới chuyển 50000đ / 100000đ": phần trong được dịch trước rồi ghép
 * vào câu ngoài (dò ngược thường bỏ qua mẫu khi tham số còn chữ Việt).
 */
public final class DichCauDaLuu {

    /** Khóa có câu là tiền tố / khung bọc lấy một câu khác (tham số có thể là câu tiếng Việt cũng cần dịch). */
    private static final List<String> KHOA_BOC = List.of(
            "hienThiKenhPos.posDaNhanTienChuaTaoDon",
            "banHang.payosKhongTaoDuocQr",
            "hienThiKenhPos.lazadaGioiHanTanSuat",
            "hienThiKenhPos.loiKetNoiToiLazada",
            "hienThiKenhPos.loiKetNoi",
            "hienThiKenhPos.lazadaTuChoi",
            "hienThiKenhPos.shopifyTuChoiSoTonChiTiet");
    private static final int SO_THAM_SO_TOI_DA = 3;
    private static final int DO_SAU_TOI_DA = 3;
    private static final List<MauBoc> MAU_BOC = new ArrayList<>();

    /**
     * Lưu tạm kết quả theo (ngôn ngữ, câu Việt đã trim) — kể cả "không nhận ra" ({@link #KHONG_NHAN_RA}): dò ngược chạy
     * qua cả trăm mẫu regex mỗi câu, còn kho câu là tĩnh nên kết quả không đổi. LRU giới hạn {@link #SO_CAU_LUU_TAM} câu;
     * câu quá dài (dữ liệu lạ, ít lặp lại) không lưu.
     */
    private static final int SO_CAU_LUU_TAM = 2000;
    private static final int DAI_TOI_DA_LUU_TAM = 1000;
    private static final Object KHONG_NHAN_RA = new Object();
    private static final Map<String, Object> LUU_TAM = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Object> cu) {
            return size() > SO_CAU_LUU_TAM;
        }
    };

    private record MauBoc(String khoa, Pattern mau, List<Integer> thuTuThamSo) {
    }

    static {
        Object[] dauHieu = new Object[SO_THAM_SO_TOI_DA];
        for (int i = 0; i < dauHieu.length; i++) dauHieu[i] = "\u0001" + i + "\u0001";
        Pattern thamSo = Pattern.compile("\u0001(\\d)\u0001");
        for (String khoa : KHOA_BOC) {
            if (!BoThongDiep.coKhoa(khoa)) continue;
            String cau = BoThongDiep.dich(khoa, dauHieu, NgonNgu.VI);
            Matcher m = thamSo.matcher(cau);
            StringBuilder regex = new StringBuilder("^");
            List<Integer> thuTu = new ArrayList<>();
            int viTri = 0;
            while (m.find()) {
                regex.append(Pattern.quote(cau.substring(viTri, m.start()))).append("(.+?)");
                thuTu.add(Integer.parseInt(m.group(1)));
                viTri = m.end();
            }
            if (thuTu.isEmpty()) continue;
            regex.append(Pattern.quote(cau.substring(viTri))).append("$");
            MAU_BOC.add(new MauBoc(khoa, Pattern.compile(regex.toString(), Pattern.DOTALL), thuTu));
        }
    }

    private DichCauDaLuu() {
    }

    /** Theo ngôn ngữ của request hiện tại (ngoài request: tiếng Việt, trả nguyên văn). */
    public static String dich(String cau) {
        return dich(cau, NgonNgu.hienTai());
    }

    /** Câu theo ngôn ngữ chỉ định; tiếng Việt, câu rỗng hoặc không nhận ra thì trả nguyên văn. */
    public static String dich(String cau, Locale ngonNgu) {
        if (cau == null || cau.isBlank() || ngonNgu == null
                || NgonNgu.VI.getLanguage().equals(ngonNgu.getLanguage())) {
            return cau;
        }
        String gon = cau.trim();
        String ra;
        if (gon.length() > DAI_TOI_DA_LUU_TAM) {
            ra = dichDeQuy(gon, ngonNgu, 0);
        } else {
            String khoa = ngonNgu + "\u0000" + gon;
            Object daCo;
            synchronized (LUU_TAM) {
                daCo = LUU_TAM.get(khoa);
            }
            if (daCo != null) {
                ra = daCo == KHONG_NHAN_RA ? null : (String) daCo;
            } else {
                ra = dichDeQuy(gon, ngonNgu, 0);
                synchronized (LUU_TAM) {
                    LUU_TAM.put(khoa, ra != null ? ra : KHONG_NHAN_RA);
                }
            }
        }
        return ra != null ? ra : cau;
    }

    private static String dichDeQuy(String cau, Locale ngonNgu, int doSau) {
        String ra = BoThongDiep.dichCauViet(cau, ngonNgu);
        if (ra != null || doSau >= DO_SAU_TOI_DA) return ra;
        for (MauBoc mau : MAU_BOC) {
            Matcher khop = mau.mau().matcher(cau);
            if (!khop.matches()) continue;
            Object[] thamSo = new Object[SO_THAM_SO_TOI_DA];
            for (int i = 0; i < mau.thuTuThamSo().size(); i++) {
                String giaTri = khop.group(i + 1);
                String daDich = dichDeQuy(giaTri.trim(), ngonNgu, doSau + 1);
                thamSo[mau.thuTuThamSo().get(i)] = daDich != null ? daDich : giaTri;
            }
            return BoThongDiep.dich(mau.khoa(), thamSo, ngonNgu);
        }
        return null;
    }
}
