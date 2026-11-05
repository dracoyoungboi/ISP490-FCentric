package com.dev.backend.constant.variables;

/**
 * Cột lich_su_thay_doi.nguon: ai / cái gì gây ra thay đổi. Dòng cũ để trống = người dùng. Nguồn sàn dùng khi đơn sàn
 * tự tạo khách hàng (job đồng bộ, không có người đăng nhập).
 */
public interface INguonNhatKy {
    String
            nguoi_dung = "nguoi_dung",
            // Job, tác vụ nền không gắn với sàn
            he_thong = "he_thong",
            shopify = "shopify",
            lazada = "lazada",
            tiktok = "tiktok",
            shopee = "shopee";
}
