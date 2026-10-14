package com.dev.backend.services.multitable;

import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.customize.PhienDongGoiDto;

/**
 * Đóng gói đơn bán (Scan-to-Pack): sau khi nhặt xong, mỗi đơn có phiếu xuất nháp; nhân viên quét từng sản phẩm
 * để đối chiếu, đủ thì hoàn tất → phiếu xuất "Chờ xuất" (6), đơn "Chờ xuất kho" (8).
 */
public interface DongGoiService {

    /** Phiên đóng gói của đơn (phiếu xuất đang mở, hoặc phiếu gần nhất nếu đã đóng gói / đơn bị hủy). */
    PhienDongGoiDto layPhienTheoDon(Integer donBanHangId);

    /** Quét một mã (SKU hoặc mã vạch) vào phiếu xuất đang đóng gói. */
    PhienDongGoiDto quet(Integer phieuXuatKhoId, QuetBarcodeRequest request);

    /** Hoàn tất đóng gói khi đã quét đủ mọi dòng. Gọi lại khi đã hoàn tất thì trả về phiên hiện tại. */
    PhienDongGoiDto hoanTat(Integer phieuXuatKhoId);
}
