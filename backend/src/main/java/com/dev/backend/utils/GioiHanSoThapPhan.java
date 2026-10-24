package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;

import java.math.BigDecimal;

/**
 * Giới hạn số thập phân nhận từ client (tiền, số lượng). Số có số mũ khổng lồ (vd. "1e900000000") đọc vào rất rẻ, nhưng
 * cộng / nhân / làm tròn với số khác, hay ghi xuống CSDL (driver gọi toPlainString) thì phải dựng hàng trăm triệu chữ số
 * — vài request là treo hoặc hết bộ nhớ máy chủ.
 * <ul>
 *   <li>Phần nguyên tối đa {@link #MAX_CHU_SO_NGUYEN} chữ số (gấp nhiều lần số tiền / số lượng thật).</li>
 *   <li>Phần lẻ tối đa {@link #MAX_CHU_SO_LE} chữ số: rộng tay, vì chặn số mũ là đủ chống treo máy; số do JavaScript
 *   tính ra (6 × 16666.67 = 100000.01999999999) không bị từ chối oan.</li>
 * </ul>
 */
public final class GioiHanSoThapPhan {

    public static final int MAX_CHU_SO_NGUYEN = 20;
    public static final int MAX_CHU_SO_LE = 30;

    private GioiHanSoThapPhan() {
    }

    public static boolean hopLe(BigDecimal so) {
        if (so == null) return true;
        // precision − scale = số chữ số phần nguyên (âm khi |so| < 1); scale âm = có số mũ dương
        return so.scale() <= MAX_CHU_SO_LE && (long) so.precision() - so.scale() <= MAX_CHU_SO_NGUYEN;
    }

    /** Ném 400 khi vượt giới hạn; trả lại chính số đó để dùng tiếp. */
    public static BigDecimal kiemTra(BigDecimal so, String tenTruong) {
        if (!hopLe(so)) {
            throw new CommonException(tenTruong + " vượt giới hạn cho phép");
        }
        return so;
    }
}
