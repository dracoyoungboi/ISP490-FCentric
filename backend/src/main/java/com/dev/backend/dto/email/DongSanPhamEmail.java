package com.dev.backend.dto.email;

import java.util.ArrayList;
import java.util.List;

/**
 * Một dòng sản phẩm (xếp theo id dòng tăng dần, giống nhau ở E4, M3, M1 và trên cổng). Giá trị đã định dạng.
 *
 * @param thuocTinh "Trắng · M" (màu · cỡ); null nếu không có
 * @param soLuong   "120 cái" (kèm đơn vị tính viết thường)
 * @param donGia    "145.000"; null ở E4 (chưa có giá)
 * @param thanhTien "17.400.000" = số lượng × đơn giá (tự tính, không đọc cột thanh_tien); null ở E4
 */
public record DongSanPhamEmail(int stt, String tenSanPham, String thuocTinh, String maSku, String soLuong,
                               String donGia, String thanhTien) {

    /** "Trắng · M · APL-NAM-TRANG-M" cho bản chữ thường; không có gì thì null. */
    public String moTa() {
        List<String> phan = new ArrayList<>();
        if (thuocTinh != null && !thuocTinh.isBlank()) {
            phan.add(thuocTinh);
        }
        if (maSku != null && !maSku.isBlank()) {
            phan.add(maSku);
        }
        return phan.isEmpty() ? null : String.join(" · ", phan);
    }
}
