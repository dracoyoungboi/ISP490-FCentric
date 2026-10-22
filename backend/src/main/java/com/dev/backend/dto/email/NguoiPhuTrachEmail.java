package com.dev.backend.dto.email;

/**
 * Người phụ trách đơn (người tạo đơn mua): phần ký và Trả lời tới của email gửi nhà cung cấp.
 *
 * @param chucDanh         tên vai trò; null khi là Quản trị viên (vai trò trong phần mềm, không phải chức danh)
 * @param dienThoai        đã nhóm số để hiện; null thì bỏ
 * @param dienThoaiLienKet chỉ chữ số, cho liên kết tel:
 */
public record NguoiPhuTrachEmail(String hoTen, String chucDanh, String dienThoai, String dienThoaiLienKet,
                                 String email) {
}
