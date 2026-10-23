package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * Yêu cầu nhập hàng gốc đi kèm đơn mua hàng: chỉ mã, số, ngày tạo, trạng thái và số báo giá khác đang chờ.
 * Không dùng YeuCauMuaHangDto đầy đủ để đơn mua không kéo theo cả danh sách chi tiết yêu cầu.
 * Frontend đọc `donMuaHang.yeuCauMuaHang.soYeuCauMuaHang` (danh sách, chi tiết đơn mua, tạo đơn từ báo giá).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class YeuCauMuaHangRutGonDto implements Serializable {
    Integer id;
    String soYeuCauMuaHang;
    Instant ngayTao;
    /** Trạng thái yêu cầu (3: đang nhận báo giá, 5: đã chọn nhà cung cấp): FE ẩn nút xét báo giá / gửi lại khi khác 3. */
    Integer trangThai;
    /**
     * Số đơn KHÁC của cùng yêu cầu đang ở 2 (chờ / đã báo giá), không tính đơn đang xem: chấp nhận đơn này thì chừng
     * ấy nhà cung cấp nhận email kết quả (K1). Máy chủ điền khi map từ đơn mua (DonMuaHangMapper).
     */
    Integer soBaoGiaDangCho;
}
