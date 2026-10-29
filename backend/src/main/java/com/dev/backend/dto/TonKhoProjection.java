package com.dev.backend.dto;

import java.math.BigDecimal;

/**
 * Projection interface để nhận kết quả query tồn kho tổng hợp.
 * Spring Data JPA sẽ tự động map các getter này với alias trong JPQL SELECT.
 */
public interface TonKhoProjection {

    // ── Thông tin sản phẩm ──────────────────────────────────────────────────
    Integer getBienTheId();
    String  getMaSku();
    String  getMaSanPham();
    String  getTenSanPham();
    String  getTenMau();
    String  getMaSize();
    String  getTenChatLieu();
    Integer getMucTonToiThieu();

    // ── Thông tin kho ────────────────────────────────────────────────────────
    Integer getKhoId();
    String  getTenKho();

    // ── Số liệu tồn kho ─────────────────────────────────────────────────────

    /** Tổng tồn kho thực tế trong kho (SUM so_luong_ton) */
    BigDecimal getOnHand();

    /**
     * Hàng đang về: tổng (so_luong_dat - so_luong_da_nhan) từ đơn mua hàng
     * có trạng thái 1-Đã gửi, 2-Đã duyệt, 3-Nhận một phần
     */
    BigDecimal getIncoming();

    /**
     * Hàng đang xuất: tổng (so_luong_dat - so_luong_da_giao) từ đơn bán hàng
     * có trạng thái 1-Đã xác nhận, 2-Đang lấy hàng
     */
    BigDecimal getOutgoing();

    /**
     * Hàng khả dụng thực sự: on_hand - outgoing
     * (có thể âm nếu dữ liệu không nhất quán)
     */
    BigDecimal getFreeToUse();

    /** Tổng giá trị tồn kho = SUM(so_luong_ton * gia_von_lo) */
    BigDecimal getTongGiaTri();
}
