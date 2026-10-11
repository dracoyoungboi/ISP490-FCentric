package com.dev.backend.services.multitable;

import com.dev.backend.dto.response.TongQuanAdminResponse;

public interface TongQuanAdminService {

    /**
     * @param ky     kỳ xem: 7_ngay | 30_ngay | 12_thang
     * @param khoId  null = tất cả kho
     * @param lamMoi true = bỏ qua bản đã tính trong 60 giây gần nhất (nút "Cập nhật")
     */
    TongQuanAdminResponse layTongQuan(String ky, Integer khoId, boolean lamMoi);
}
