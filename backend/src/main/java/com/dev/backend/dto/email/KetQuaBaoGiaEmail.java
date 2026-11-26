package com.dev.backend.dto.email;

/**
 * M2 · Kết quả báo giá.
 *
 * @param daBaoGia       true: bản "đã báo giá, không được chọn"; false: bản "yêu cầu đã kết thúc" (hoặc "đã hết hạn")
 * @param ngayThamChieu  ngày báo giá (đã báo giá) hoặc ngày gửi yêu cầu (chưa báo giá)
 * @param lyDo           lý do không chấp nhận; null thì không hiện
 * @param hetHan         true: bản "yêu cầu đã hết hạn" (chưa báo giá mà qua hạn)
 * @param hanBaoGia      "01/12/2026" khi {@code hetHan}; null ở hai bản kia
 */
public record KetQuaBaoGiaEmail(String tenNhaCungCap, String maDon, boolean daBaoGia, String ngayThamChieu,
                                String lyDo, boolean hetHan, String hanBaoGia) {

    /** Bản kết quả thường (không phải hết hạn). */
    public KetQuaBaoGiaEmail(String tenNhaCungCap, String maDon, boolean daBaoGia, String ngayThamChieu, String lyDo) {
        this(tenNhaCungCap, maDon, daBaoGia, ngayThamChieu, lyDo, false, null);
    }
}
