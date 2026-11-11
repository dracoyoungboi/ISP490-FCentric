package com.dev.backend.services.impl.trahang;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

/**
 * Quy tắc thuần (không đụng CSDL) của trả hàng tại quầy — tách riêng để kiểm bằng unit test.
 */
public final class TraHangQuyTac {

    /** GBR-RET-02: trong vòng 03 ngày (72 giờ) kể từ lúc thanh toán. */
    public static final Duration HAN_TRA = Duration.ofDays(3);
    /** Mã PIN quản lý: hiệu lực nhập 10 phút, sai tối đa 5 lần. */
    public static final Duration HAN_MA = Duration.ofMinutes(10);
    public static final int SO_LAN_SAI_TOI_DA = 5;
    /** Số yêu cầu duyệt (gửi mã) tối đa cho một đơn trong 24 giờ. */
    public static final int SO_YEU_CAU_DUYET_TOI_DA = 5;
    /** Duyệt đã nhập đúng mã dùng được trong 30 phút (thu ngân còn kiểm hàng, nhập thông tin hoàn tiền). */
    public static final Duration HIEU_LUC_DUYET = Duration.ofMinutes(30);
    /** Gửi lại mã sau ít nhất 60 giây. */
    public static final Duration GIAN_CACH_GUI_LAI = Duration.ofSeconds(60);

    /** Lý do trả (đặc tả BA bước 3 + bảng dòng hàng): mã lưu CSDL, nhãn ở giao diện. */
    public static final Set<String> LY_DO = Set.of("mac_chat", "mac_rong", "khong_ung_mau_kieu", "loi_san_xuat",
            "doi_y", "khac");
    /** Nhóm lỗi khi hàng Lỗi (rách vải, hỏng khóa, ố bẩn, bung chỉ…). */
    public static final Set<String> NHOM_LOI = Set.of("rach_vai", "hong_khoa", "o_ban", "bung_chi", "khac");

    private TraHangQuyTac() {
    }

    /** Đã quá hạn trả (lúc {@code bayGio} cách lúc thanh toán hơn 03 ngày). Không rõ lúc thanh toán thì coi là quá hạn. */
    public static boolean quaHan(Instant thanhToanLuc, Instant bayGio) {
        return thanhToanLuc == null || Duration.between(thanhToanLuc, bayGio).compareTo(HAN_TRA) > 0;
    }

    /**
     * GBR-RET-05: đơn giá hoàn = (thành tiền dòng − giảm giá dòng) / số lượng mua, làm tròn tới đồng. Không hoàn giá
     * niêm yết khi dòng có giảm giá.
     */
    public static BigDecimal donGiaThucTra(BigDecimal thanhTien, BigDecimal giamGia, BigDecimal soLuongMua) {
        if (soLuongMua == null || soLuongMua.signum() <= 0) return BigDecimal.ZERO;
        BigDecimal daTra = so(thanhTien).subtract(so(giamGia));
        if (daTra.signum() < 0) daTra = BigDecimal.ZERO;
        return daTra.divide(soLuongMua, 0, RoundingMode.HALF_UP);
    }

    /**
     * Tiền hoàn của lần trả này. Trả hết phần còn lại của dòng thì hoàn đúng phần tiền còn lại (khách đã trả − đã hoàn
     * các lần trước) để tổng hoàn của dòng không lệch số khách đã trả vì làm tròn đơn giá.
     */
    public static BigDecimal tienHoan(BigDecimal thanhTien, BigDecimal giamGia, BigDecimal soLuongMua,
                                      BigDecimal daTra, BigDecimal daHoan, BigDecimal soLuongTra) {
        BigDecimal conLai = so(soLuongMua).subtract(so(daTra));
        if (soLuongTra.compareTo(conLai) >= 0) {
            BigDecimal tien = so(thanhTien).subtract(so(giamGia)).subtract(so(daHoan));
            return tien.signum() < 0 ? BigDecimal.ZERO : tien.setScale(2, RoundingMode.HALF_UP);
        }
        return donGiaThucTra(thanhTien, giamGia, soLuongMua).multiply(soLuongTra).setScale(2, RoundingMode.HALF_UP);
    }

    /** Che số điện thoại: giữ 2 số đầu và 3 số cuối ("09xx xxx 218"). Quá ngắn thì che hết. */
    public static String cheSoDienThoai(String sdt) {
        if (sdt == null) return null;
        String so = sdt.replaceAll("\\D", "");
        if (so.isEmpty()) return null;
        if (so.length() < 7) return "x".repeat(so.length());
        String giua = "x".repeat(so.length() - 5);
        String che = so.substring(0, 2) + giua + so.substring(so.length() - 3);
        // nhóm 4-3-3 như 09xx xxx 218 (số 10 chữ số); số dài hơn thì nhóm cuối giữ 3
        int n = che.length();
        return che.substring(0, n - 6) + " " + che.substring(n - 6, n - 3) + " " + che.substring(n - 3);
    }

    /** Số tài khoản: chỉ chữ số, 6–20 ký tự. */
    public static boolean soTaiKhoanHopLe(String stk) {
        return stk != null && stk.matches("\\d{6,20}");
    }

    private static BigDecimal so(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
