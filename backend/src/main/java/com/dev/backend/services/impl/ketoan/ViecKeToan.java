package com.dev.backend.services.impl.ketoan;

/**
 * Mã việc kế toán làm thêm trên AMIS (trường {@code viec} của DungChungTuAmis.VanDe). Màn Tạo lô xuất xếp các việc theo
 * mã này thành ba tầng: cần làm ngay, làm khi có hóa đơn, không cần lập (frontend components/ke-toan/viecKeToan.js giữ
 * tiêu đề, hướng dẫn và cột của từng mã). Việc không có mã hiện ở nhóm "Xem lại trước khi nhập".
 */
public final class ViecKeToan {
    private ViecKeToan() {
    }

    // Biến động kho không có chứng từ (XuatKeToanService.bienDong)
    public static final String XUAT_KHO_HAO_HUT = "xuat_kho_hao_hut";
    public static final String DIEU_CHINH_KIEM_KE = "dieu_chinh_kiem_ke";
    public static final String XUAT_KHO_KHAC = "xuat_kho_khac";
    public static final String NHAP_KHO_KHAC = "nhap_kho_khac";
    public static final String NHAP_LAI_TRUOC_MOC = "nhap_lai_truoc_moc";
    public static final String BIEN_DONG_KHAC = "bien_dong_khac";
    /** Phiếu xuất bán của đơn hủy / hoàn trả chưa có phiếu nhập lại: hàng không về, lập phiếu xuất kho khác. */
    public static final String XUAT_KHO_DON_HUY = "xuat_kho_don_huy";
    /** Phiếu nhập lại (PN-RET) không ghép được với phiếu xuất của đơn hủy trong lô: kế toán xét theo đơn. */
    public static final String NHAP_HANG_HOAN = "nhap_hang_hoan";
    /** Phiếu xuất và phiếu nhập lại của cùng đơn hủy, số lượng bù trừ hết: không lập gì. */
    public static final String KHOP_DON_HUY = "khop_don_huy";
    /** Phiếu xuất và phiếu nhập lại của cùng đơn hủy nhưng số lượng lệch: kiểm lại. */
    public static final String LECH_DON_HUY = "lech_don_huy";

    // Cảnh báo khi dựng chứng từ (DungChungTuAmis)
    public static final String LAP_PHIEU_THU = "lap_phieu_thu";
    public static final String LAP_PHIEU_CHI = "lap_phieu_chi";
    public static final String TRA_LAI_DON = "tra_lai_don";
    public static final String NHAN_HOA_DON = "nhan_hoa_don";
    public static final String KIEM_TON_DAU_KY = "kiem_ton_dau_ky";
    public static final String HANG_LOI = "hang_loi";
    public static final String DE_BIET = "de_biet";
    public static final String XEM_LAI = "xem_lai";

    // Phát sinh sau khi xuất (lô trước)
    public static final String HOA_DON_SAU_XUAT = "hoa_don_sau_xuat";
    public static final String TRA_LAI_SAU_XUAT = "tra_lai_sau_xuat";
}
