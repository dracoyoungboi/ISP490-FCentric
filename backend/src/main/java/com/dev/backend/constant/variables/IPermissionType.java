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

    /**
     * Trần quyền theo vai trò: những quyền chi tiết được cấp cho người mang vai trò đó tại kho của họ, theo ma trận
     * phân quyền SRS mục 4.4 (dòng "No" của vai trò thì không có quyền tương ứng). Ngăn kéo Phân quyền, mẫu quyền và
     * API gán quyền cũ đều từ chối quyền ngoài trần. Quản trị viên không cần quyền chi tiết (toàn quyền ở mọi kho).
     * <p>
     * Mọi cặp (vai trò, quyền) mà máy chủ thật sự kiểm — {@code @RequireAuth(permissions)} có vai trò đó, hoặc kiểm trong
     * service như {@code KiemKeQuyen} — phải nằm trong trần, nếu không người dùng không bao giờ được cấp đủ quyền để làm.
     * Không có ai được cấp: quản lý nhân viên kho, cấp quyền nhân viên, quản lý sản phẩm (SRS: chỉ quản trị viên).
     */
    java.util.Map<String, java.util.Set<String>> TRAN_THEO_VAI_TRO = java.util.Map.of(
            IRoleType.quan_ly_kho, java.util.Set.of(
                    xem_ton_kho, xem_chi_tiet_lo, dieu_chinh_ton_kho, chuyen_kho,
                    tao_don_mua_hang, duyet_don_mua_hang, tao_phieu_nhap, duyet_phieu_nhap, huy_phieu_nhap,
                    tao_phieu_xuat, duyet_phieu_xuat, huy_phieu_xuat,
                    xem_bao_cao_ton_kho, xem_bao_cao_nhap_xuat, xuat_bao_cao),
            IRoleType.nhan_vien_kho, java.util.Set.of(
                    xem_ton_kho, xem_chi_tiet_lo, chuyen_kho, tao_dot_kiem_ke,
                    tao_phieu_nhap, duyet_phieu_nhap, huy_phieu_nhap, tao_phieu_xuat, duyet_phieu_xuat,
                    xem_bao_cao_nhap_xuat, xuat_bao_cao),
            IRoleType.nhan_vien_mua_hang, java.util.Set.of(
                    xem_ton_kho, tao_don_mua_hang, duyet_don_mua_hang, quan_ly_nha_cung_cap, xuat_bao_cao),
            IRoleType.nhan_vien_ban_hang, java.util.Set.of(
                    xem_ton_kho, tao_don_ban_hang, duyet_don_ban_hang, xem_bao_cao_doanh_thu, quan_ly_khach_hang,
                    xuat_bao_cao));

    /** Quyền {@code maQuyen} có được cấp cho vai trò {@code vaiTro} không (vai trò ngoài bảng: không quyền nào). */
    static boolean trongTran(String vaiTro, String maQuyen) {
        return vaiTro != null && maQuyen != null
                && TRAN_THEO_VAI_TRO.getOrDefault(vaiTro, java.util.Set.of()).contains(maQuyen);
    }
}
