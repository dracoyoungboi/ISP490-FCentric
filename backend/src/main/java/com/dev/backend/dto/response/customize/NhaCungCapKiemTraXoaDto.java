package com.dev.backend.dto.response.customize;

import lombok.*;

/**
 * Kết quả kiểm tra trước khi xóa nhà cung cấp. Chỉ xóa được nhà cung cấp chưa phát sinh
 * giao dịch nào (đơn mua hàng / phiếu nhập kho / lô hàng đều trỏ tới nhà cung cấp bằng khóa ngoại);
 * đã có giao dịch thì chuyển sang Ngừng hoạt động để giữ lịch sử.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NhaCungCapKiemTraXoaDto {
    private boolean coTheXoa;
    private long soDonMuaHang;
    private long soPhieuNhapKho;
    private long soLoHang;
}
