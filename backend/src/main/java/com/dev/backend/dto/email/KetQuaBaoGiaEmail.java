package com.dev.backend.dto.email;

/**
 * M2 · Kết quả báo giá.
 *
 * @param daBaoGia       true: bản "đã báo giá, không được chọn"; false: bản "yêu cầu đã kết thúc"
 * @param ngayThamChieu  ngày báo giá (đã báo giá) hoặc ngày gửi yêu cầu (chưa báo giá)
 * @param lyDo           lý do không chấp nhận; null thì không hiện
 */
public record KetQuaBaoGiaEmail(String tenNhaCungCap, String maDon, boolean daBaoGia, String ngayThamChieu,
                                String lyDo) {
}
