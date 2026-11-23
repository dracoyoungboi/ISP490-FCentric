package com.dev.backend.dto.email;

import java.util.ArrayList;
import java.util.List;

/**
 * Một dòng sản phẩm không đạt trong biên bản trả hàng (E7), xếp theo id dòng biên bản tăng dần. Giá trị đã định dạng.
 *
 * @param thuocTinh "Đen · S" (màu · cỡ); null nếu không có
 * @param lyDo      lý do không đạt như kho đã ghi ("Lỗi phụ liệu")
 * @param soLuong   "2 cái" (kèm đơn vị tính viết thường)
 * @param donGia    "500.000" = đơn giá dòng đơn mua cùng biến thể; null khi biên bản không có đủ đơn giá
 * @param giaTri    "1.000.000" = số lượng lỗi × đơn giá; null khi không có đơn giá
 */
public record DongTraHangEmail(int stt, String tenSanPham, String thuocTinh, String maSku, String lyDo,
                               String soLuong, String donGia, String giaTri) {

    /** "Đen · S · AK-DEN-S" cho bản chữ thường; không có gì thì null. */
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
