package com.dev.backend.dto.email;

/**
 * Thông tin cửa hàng in trong email, đọc từ Cấu hình › Thông tin cửa hàng lúc gửi. Ô trống là null (không phải
 * chuỗi rỗng) để mẫu bỏ dòng đó. Không lấy tên cửa hàng thay tên đăng ký kinh doanh.
 *
 * @param tenHienThi   tên cửa hàng (biển hiệu): tên người gửi, đầu email, đuôi tiêu đề
 * @param tenDangKy    tên đăng ký kinh doanh, đúng giấy chứng nhận: chân email, khối thông tin xuất hóa đơn
 * @param diaChiDangKy địa chỉ đăng ký
 * @param dienThoai    đã nhóm số để hiện ("024 3999 8888")
 * @param logoUrl      chỉ có khi là ảnh PNG/JPG qua https://
 */
public record CuaHangEmail(String tenHienThi, String tenDangKy, String maSoThue, String diaChiDangKy,
                           String dienThoai, String email, String logoUrl) {

    /** Tên phần mềm: chỉ dùng làm tên người gửi khi cửa hàng chưa có tên (email nhân sự). */
    public static final String TEN_PHAN_MEM = "FCentric";

    /** Chưa có dòng Thông tin cửa hàng. */
    public static final CuaHangEmail TRONG = new CuaHangEmail(null, null, null, null, null, null, null);

    public String tenNguoiGui() {
        return tenHienThi != null && !tenHienThi.isBlank() ? tenHienThi : TEN_PHAN_MEM;
    }

    public boolean coLogo() {
        return logoUrl != null && !logoUrl.isBlank();
    }

    /**
     * Mục còn thiếu để gửi email nhà cung cấp: quy tắc chung ở ThongTinCuaHangBatBuoc (cùng quy tắc chặn gửi yêu cầu
     * báo giá và khung chặn ở giao diện). Danh sách rỗng là đủ.
     */
    public java.util.List<String> thieuChoEmailNhaCungCap() {
        return com.dev.backend.utils.ThongTinCuaHangBatBuoc.thieuDeGuiNhaCungCap(tenDangKy, diaChiDangKy);
    }

    /** Có gì để hiện ở đầu email không (logo hoặc tên). Không có cả hai thì bỏ hẳn đầu email. */
    public boolean coDau() {
        return coLogo() || (tenHienThi != null && !tenHienThi.isBlank());
    }
}
