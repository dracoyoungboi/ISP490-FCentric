package com.dev.backend.utils;

import java.util.ArrayList;
import java.util.List;

/**
 * Quy tắc "thiếu thông tin cửa hàng để gửi nhà cung cấp" (soát chéo 3.4), đặt một nơi cho cả máy chủ:
 * - chặn gửi yêu cầu báo giá và gửi lại (ThongTinCuaHangMuaHang → 409 THIEU_THONG_TIN_CUA_HANG, data.thieu);
 * - cảnh báo khi email nhà cung cấp đi lúc còn thiếu (CuaHangEmail, EmailDispatcher).
 * Khung chặn ở giao diện dùng cùng nhãn và thứ tự (frontend/src/validations/companyProfileSchema.js,
 * NHAN_THONG_TIN_CUA_HANG + KHOA_BAT_BUOC_GUI_NHA_CUNG_CAP); test ở chanGuiYeuCauBaoGia.test.js so với tệp này.
 */
public final class ThongTinCuaHangBatBuoc {

    /** Nhãn đúng chữ Cấu hình › Thông tin cửa hàng; data.thieu trả nguyên các nhãn này, theo thứ tự khai báo. */
    public static final String TEN_DANG_KY = "Tên đăng ký kinh doanh";
    public static final String DIA_CHI_DANG_KY = "Địa chỉ đăng ký";

    private ThongTinCuaHangBatBuoc() {
    }

    /**
     * Các mục còn thiếu, theo thứ tự cố định; rỗng là đủ. Thiếu khi null hoặc chỉ khoảng trắng.
     * Chưa có hồ sơ cửa hàng: gọi với (null, null) → thiếu cả hai.
     */
    public static List<String> thieuDeGuiNhaCungCap(String tenDangKy, String diaChiDangKy) {
        List<String> thieu = new ArrayList<>(2);
        if (tenDangKy == null || tenDangKy.isBlank()) {
            thieu.add(TEN_DANG_KY);
        }
        if (diaChiDangKy == null || diaChiDangKy.isBlank()) {
            thieu.add(DIA_CHI_DANG_KY);
        }
        return List.copyOf(thieu);
    }
}
