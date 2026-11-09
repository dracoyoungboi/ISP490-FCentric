package com.dev.backend.constant.variables;

public interface IPermissionType {

    /* ================= QUẢN LÝ KHO ================= */
    String
            xem_ton_kho = "xem_ton_kho",
            xem_chi_tiet_lo = "xem_chi_tiet_lo",
            dieu_chinh_ton_kho = "dieu_chinh_ton_kho",
            chuyen_kho = "chuyen_kho",
            /** Nhân viên kho lập đợt kiểm kê nháp (BA kiểm kê mục 3); quản trị viên, quản lý kho không cần. */
            tao_dot_kiem_ke = "tao_dot_kiem_ke";

    /* ================= NHẬP KHO ================= */
    String
            tao_don_mua_hang = "tao_don_mua_hang",
            duyet_don_mua_hang = "duyet_don_mua_hang",
            tao_phieu_nhap = "tao_phieu_nhap",
            duyet_phieu_nhap = "duyet_phieu_nhap",
            huy_phieu_nhap = "huy_phieu_nhap";

    /* ================= XUẤT KHO ================= */
    String
            tao_don_ban_hang = "tao_don_ban_hang",
            duyet_don_ban_hang = "duyet_don_ban_hang",
            tao_phieu_xuat = "tao_phieu_xuat",
            duyet_phieu_xuat = "duyet_phieu_xuat",
            huy_phieu_xuat = "huy_phieu_xuat";

    /* ================= BÁO CÁO ================= */
    String
            xem_bao_cao_ton_kho = "xem_bao_cao_ton_kho",
            xem_bao_cao_nhap_xuat = "xem_bao_cao_nhap_xuat",
            xem_bao_cao_doanh_thu = "xem_bao_cao_doanh_thu",
            xuat_bao_cao = "xuat_bao_cao";

    /* ================= CÀI ĐẶT ================= */
    String
            quan_ly_nhan_vien_kho = "quan_ly_nhan_vien_kho",
            cap_quyen_nhan_vien = "cap_quyen_nhan_vien",
            quan_ly_san_pham = "quan_ly_san_pham",
            quan_ly_nha_cung_cap = "quan_ly_nha_cung_cap",
            quan_ly_khach_hang = "quan_ly_khach_hang";
}
