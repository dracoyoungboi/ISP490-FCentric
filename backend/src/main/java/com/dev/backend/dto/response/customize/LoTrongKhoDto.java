package com.dev.backend.dto.response.customize;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Một lô đang tồn của một mã ở một kho — phần sổ xuống dưới dòng của Báo cáo tồn kho
 * (GET /thong-ke-he-thong/ton-kho-tong-quan/lo).
 *
 * @param ngayNhap          lần gần nhất lô vào kho này (nhập hàng, nhận chuyển kho, khách trả)
 * @param soLuongTon        tồn của lô ở kho; cộng mọi lô bằng On Hand của dòng
 * @param soLuongDangGiu    phần đã gắn cho phiếu xuất / đơn tại quầy chưa xuất xong
 * @param soLuongDangKiemKe phần thuộc đợt kiểm kê đang mở (tạm không bán, xuất, chuyển); 0 khi không có
 * @param maDotKiemKe       mã đợt kiểm kê khi {@code soLuongDangKiemKe} > 0
 * @param ke                các kệ đang chứa lô ở kho, theo mã kệ
 * @param soChuaCoKe        phần đã vào kho nhưng chưa xếp lên kệ nào
 */
public record LoTrongKhoDto(
        Integer loHangId,
        String maLo,
        Instant ngayNhap,
        Instant ngaySanXuat,
        String tenNhaCungCap,
        BigDecimal giaVon,
        BigDecimal soLuongTon,
        BigDecimal soLuongDangGiu,
        BigDecimal soLuongDangKiemKe,
        String maDotKiemKe,
        List<KeCuaLo> ke,
        BigDecimal soChuaCoKe
) {

    /** Một kệ đang chứa lô: mã kệ và số đang nằm trên kệ đó. */
    public record KeCuaLo(Integer viTriKhoId, String maViTri, Integer soLuong) {
    }
}
