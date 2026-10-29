package com.dev.backend.constant.variables;

import java.util.Set;

/**
 * Hằng số của chuyển kho nội bộ theo đặc tả BA (UC-7.1, ma trận chuyển trạng thái 3.2).
 * Lưu ở bảng phieu_chuyen_kho / bien_ban_giao_nhan dưới dạng chữ (ENUM của MySQL).
 */
public interface IChuyenKho {

    // Trạng thái phiếu chuyển (phieu_chuyen_kho.trang_thai)
    String CHO_DUYET = "CHO_DUYET",
            DA_DUYET = "DA_DUYET",
            DANG_VAN_CHUYEN = "DANG_VAN_CHUYEN",
            CHO_XU_LY_LECH = "CHO_XU_LY_LECH",
            HOAN_TAT = "HOAN_TAT",
            DA_HUY = "DA_HUY";

    /** Phiếu đang giữ chỗ tồn ở kho nguồn (BA: giữ chỗ khi tạo, khóa cứng khi duyệt). */
    Set<String> DANG_GIU_CHO = Set.of(CHO_DUYET, DA_DUYET);

    // Lý do điều động (B.2)
    String LY_DO_BO_SUNG = "BO_SUNG",
            LY_DO_CAN_BANG = "CAN_BANG",
            LY_DO_TRA_VE = "TRA_VE",
            LY_DO_KHAC = "KHAC";
    Set<String> LY_DO_DIEU_DONG = Set.of(LY_DO_BO_SUNG, LY_DO_CAN_BANG, LY_DO_TRA_VE, LY_DO_KHAC);

    // Hình thức vận chuyển (B.3)
    String XE_CONG_TY = "XE_CONG_TY",
            THUE_NGOAI = "THUE_NGOAI",
            CHUYEN_PHAT = "CHUYEN_PHAT";
    Set<String> HINH_THUC_VAN_CHUYEN = Set.of(XE_CONG_TY, THUE_NGOAI, CHUYEN_PHAT);

    // Phương án xử lý chênh lệch (bien_ban_giao_nhan.phuong_an_xu_ly)
    String CHUA_XU_LY = "CHUA_XU_LY",
            GHI_GIAM_HAO_HUT = "GHI_GIAM_HAO_HUT",
            GIAO_BU_HANG = "GIAO_BU_HANG";

    // Cấu hình khi xác nhận xuất mà chưa có số XKNB (BR-TRF-02)
    String XKNB_CHAN = "CHAN",
            XKNB_CHI_CANH_BAO = "CHI_CANH_BAO";

    // Cấu hình ai được xử lý chênh lệch (B.5 "đổi trong Cấu hình"); quản trị viên luôn được
    String XU_LY_LECH_QL_KHO_TONG = "QL_KHO_TONG",
            XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT = "QL_KHO_TONG_VA_KHO_XUAT",
            XU_LY_LECH_CHI_QUAN_TRI = "CHI_QUAN_TRI";
    Set<String> QUYEN_XU_LY_LECH = Set.of(XU_LY_LECH_QL_KHO_TONG, XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT, XU_LY_LECH_CHI_QUAN_TRI);

    // Tiền tố số chứng từ
    String TIEN_TO_PHIEU_CHUYEN = "PX-TRF-",
            TIEN_TO_PHIEU_XUAT_CON = "PX-CK-",
            TIEN_TO_PHIEU_NHAP = "PN-TRF-",
            TIEN_TO_NHAP_HOAN_TRA = "PN-RET-",
            TIEN_TO_LENH = "LDD-",
            TIEN_TO_BIEN_BAN = "BBGN-",
            TIEN_TO_DIEU_CHINH = "DCK-";
}
