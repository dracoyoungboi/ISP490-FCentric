package com.dev.backend.dto.response.phanquyen;

import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

/**
 * Quyền của người đang đăng nhập (tab Quyền của tôi ở Hồ sơ). Đọc từ CSDL, không từ token:
 * chỉ quyền đang bật tại kho đang có hiệu lực. So với token để biết có cần đăng nhập lại không.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class QuyenCuaToiDto {
    String vaiTro;
    /** Quản trị viên: toàn quyền ở mọi kho, không có danh sách quyền theo kho. */
    boolean toanQuyen;
    KhoTomTatDto kho;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayBatDau;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayKetThuc;
    List<QuyenHanDto> quyen;
    /** Lần cập nhật phân quyền gần nhất: lúc nào, do ai. */
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant capNhatLuc;
    String capNhatBoi;
    /** Email người cập nhật gần nhất: nhân viên liên hệ khi cần đổi kho hoặc thêm quyền. */
    String capNhatBoiEmail;
    /** Quyền trong CSDL khác quyền trong phiên đăng nhập hiện tại: cần đăng nhập lại để dùng quyền mới. */
    boolean canDangNhapLai;
    /** Mã quyền mới có so với phiên hiện tại. */
    List<String> quyenMoi;
    /** Tên quyền đã bị thu hồi so với phiên hiện tại. */
    List<String> quyenDaThuHoi;
    /**
     * Mã quyền có API thật sự kiểm: quyền ngoài danh sách chưa có tác dụng. Null khi không quét được, và với quản trị
     * viên (toàn quyền, không tính).
     */
    List<String> quyenDaApDung;
}
