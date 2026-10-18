package com.dev.backend.dto.response.phanquyen;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.Map;

/** Cấu hình dùng cho ngăn kéo Phân quyền: mẫu quyền theo vai trò, quyền nhạy cảm, quyền máy chủ đã kiểm. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CauHinhPhanQuyenDto {
    /** Vai trò → id các quyền trong mẫu (bảng mau_quyen_vai_tro). */
    Map<String, List<Integer>> mauQuyen;
    /** Id các quyền nhạy cảm (quyen_han.nhay_cam = 1). */
    List<Integer> quyenNhayCam;
    /**
     * Mã các quyền đang được ít nhất một API kiểm (@RequireAuth permissions), đọc từ mã nguồn lúc chạy;
     * null khi không quét được (khác danh sách rỗng = không API nào kiểm quyền). Thực tế luôn có API kiểm quyền nên
     * giao diện coi danh sách rỗng cũng như null (máy chủ bản cũ trả rỗng khi quét lỗi).
     */
    List<String> quyenDaApDung;
}
