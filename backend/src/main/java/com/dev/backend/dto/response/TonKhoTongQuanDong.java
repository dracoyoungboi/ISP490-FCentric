package com.dev.backend.dto.response;

import java.math.BigDecimal;

/**
 * Một dòng của Báo cáo tồn kho (GET /api/v1/thong-ke-he-thong/ton-kho-tong-quan): một biến thể tại một kho.
 *
 * - Các trường từ bienTheId đến tongGiaTri giữ đúng tên của TonKhoProjection (các màn đang đọc chúng không phải sửa).
 * - khaDung, nguong, tinhTrang tính theo cùng quy tắc với Tổng quan (TongQuanAdminServiceImpl.tinhTrangTon), để số
 *   trên các tab của báo cáo khớp số ở Tổng quan.
 * - deXuat, soLuongDeXuat, khaDungKhoTong, choXuatKhoTong chỉ có ở dòng het_hang / thieu_hang, cùng quy tắc với
 *   khối Cần bổ sung của Tổng quan; các dòng khác để null.
 */
public record TonKhoTongQuanDong(
        Integer bienTheId,
        String maSku,
        String maSanPham,
        String tenSanPham,
        String tenMau,
        String maSize,
        String tenChatLieu,
        Integer mucTonToiThieu,
        Integer khoId,
        String tenKho,
        BigDecimal onHand,
        BigDecimal incoming,
        BigDecimal outgoing,
        BigDecimal freeToUse,
        BigDecimal tongGiaTri,
        /** Tồn − đang giữ của các lô ở kho này (cùng số Khả dụng ở Tổng quan). */
        BigDecimal khaDung,
        /** Ngưỡng dùng để xếp mức: mức tồn tối thiểu của sản phẩm, chưa đặt thì ngưỡng mặc định của hệ thống. */
        int nguong,
        /** true khi sản phẩm chưa đặt mức tồn tối thiểu nên đang dùng ngưỡng mặc định. */
        boolean nguongMacDinh,
        /**
         * het_hang, thieu_hang, binh_thuong, du_hang; null khi mã chưa từng có lô ở kho này hoặc kho là kho trung chuyển
         * (Tổng quan cũng không đếm các cặp đó).
         */
        String tinhTrang,
        boolean laKhoTong,
        /** chuyen_kho (chuyển từ Kho tổng) hoặc yeu_cau_nhap (nhập về Kho tổng từ nhà cung cấp). */
        String deXuat,
        Long soLuongDeXuat,
        /** Số Kho tổng có thể chuyển (đã trừ chờ xuất của đơn bán ở Kho tổng); null khi không có Kho tổng hoặc dòng là Kho tổng. */
        Long khaDungKhoTong,
        Long choXuatKhoTong
) {}
