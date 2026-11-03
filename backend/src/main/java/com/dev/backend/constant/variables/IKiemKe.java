package com.dev.backend.constant.variables;

/**
 * Hằng số của kiểm kê khoanh vùng (đặc tả BA 03/11).
 * <pre>
 * Đợt (dot_kiem_ke.trang_thai):        0 Nháp → 1 Đang kiểm kê → 2 Chờ duyệt → 3 Đã duyệt; 2 → 1 khi đếm lại; 0/1/2 → 4 Đã hủy
 * Dòng (chi_tiet_kiem_ke.trang_thai):  0 Chưa kiểm · 1 Đã kiểm · 2 Cần kiểm lại · 3 Đã xác nhận
 * </pre>
 * Khóa nghiệp vụ chỉ có ở đợt 1 và 2.
 */
public interface IKiemKe {

    byte NHAP = 0,
            DANG_KIEM_KE = 1,
            CHO_DUYET = 2,
            DA_DUYET = 3,
            DA_HUY = 4;

    byte DONG_CHUA_KIEM = 0,
            DONG_DA_KIEM = 1,
            DONG_CAN_KIEM_LAI = 2,
            DONG_DA_XAC_NHAN = 3;

    /** Loại phạm vi (dot_kiem_ke.loai_kiem_ke). dot_xuat chỉ còn ở dữ liệu cũ. */
    String TOAN_BO = "toan_bo",
            THEO_KHU_VUC = "theo_khu_vuc",
            THEO_KE = "theo_ke",
            THEO_DANH_MUC = "theo_danh_muc";

    /** Chế độ khóa của kệ (dot_kiem_ke_vi_tri.che_do_khoa). */
    String TOAN_KE = "toan_ke",
            THEO_LO = "theo_lo";

    /** Trạng thái vận hành của kệ (vi_tri_kho.trang_thai). KHOA_KIEM_KE chỉ do kiểm kê ghi khi khóa toàn kệ. */
    String KE_HOAT_DONG = "HOAT_DONG",
            KE_DAY_HANG = "DAY_HANG",
            KE_BAO_TRI = "BAO_TRI",
            KE_KHOA_KIEM_KE = "KHOA_KIEM_KE";

    /** Kho ảo chứa hàng đang chuyển: không kiểm kê (BR-STK-03). */
    String MA_KHO_AO = "KHO_TRANSIT";

    /** Hàng thời trang tính theo chiếc: số đếm nguyên từ 0 tới mốc này (mục 6.2). */
    int SO_LUONG_TOI_DA = 1_000_000;

    /** Mã đợt KK-yyyyMMdd-001, cùng kiểu số chứng từ của BA. */
    String TIEN_TO_MA_DOT = "KK-";

    /** Cây danh mục sâu hơn mốc này coi là lỗi dữ liệu (không chốt tập bị cắt ngầm). */
    int DO_SAU_DANH_MUC_TOI_DA = 20;

    int TEN_DOT_TOI_DA = 200;
    int LY_DO_TOI_DA = 2000;

    /** Loại lệnh lưu ở kiem_ke_lenh (idempotency). */
    String LENH_TAO_VA_BAT_DAU = "tao_va_bat_dau",
            LENH_BAT_DAU = "bat_dau",
            LENH_TRINH_DUYET = "trinh_duyet",
            LENH_DEM_LAI = "dem_lai",
            LENH_PHE_DUYET = "phe_duyet",
            LENH_HUY = "huy";

    /** Hành động ghi ở lich_su_kiem_ke. */
    String HD_TAO = "Tạo đợt",
            HD_SUA_NHAP = "Sửa nháp",
            HD_BAT_DAU = "Bắt đầu kiểm kê",
            HD_PHAT_SINH = "Thêm lô phát sinh",
            HD_TRINH_DUYET = "Trình duyệt",
            HD_DEM_LAI = "Yêu cầu đếm lại",
            HD_PHE_DUYET = "Phê duyệt",
            HD_HUY = "Hủy đợt";

    /** Trạng thái hàng đợi đẩy tồn (kiem_ke_outbox.trang_thai). */
    String OUTBOX_CHO_GUI = "cho_gui",
            OUTBOX_DANG_GUI = "dang_gui",
            OUTBOX_DA_GUI = "da_gui",
            OUTBOX_LOI = "loi";

    static boolean dangGiuKhoa(Byte trangThai) {
        return trangThai != null && (trangThai == DANG_KIEM_KE || trangThai == CHO_DUYET);
    }

    static boolean laKhoaToanKe(String loai) {
        return TOAN_BO.equals(loai) || THEO_KHU_VUC.equals(loai) || THEO_KE.equals(loai);
    }
}
