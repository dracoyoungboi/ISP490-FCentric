package com.dev.backend.dto.response.phanquyen;

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
 * Một lần thay đổi phân quyền của người dùng (tab Lịch sử phân quyền).
 * Các bản ghi cũ ghi từng quyền một được gộp theo cùng thời điểm, người thực hiện và kho.
 * Câu mô tả do giao diện ghép từ các trường này.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LichSuPhanQuyenDto {
    /** Id bản ghi lịch sử đầu tiên của nhóm (dùng làm khóa hiển thị). */
    Integer id;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant luc;
    Integer nguoiThucHienId;
    String nguoiThucHien;
    /** Vai trò trước và sau (bằng nhau nếu không đổi vai trò; null với bản ghi cũ). */
    String vaiTroCu;
    String vaiTroMoi;
    KhoTomTatDto khoCu;
    KhoTomTatDto khoMoi;
    boolean doiHieuLuc;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayKetThucMoi;
    /** Tên các quyền được cấp thêm / bị thu hồi trong lần thay đổi này. */
    List<String> quyenThem;
    List<String> quyenBo;
}
