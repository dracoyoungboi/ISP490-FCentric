package com.dev.backend.services.multitable;

import com.dev.backend.dto.response.TongQuanAdminResponse;

import java.time.LocalDate;

public interface TongQuanAdminService {

    /**
     * @param ky      hom_nay | hom_qua | 7_ngay | 30_ngay | thang_nay | thang_truoc | 12_thang | tuy_chon
     * @param tuNgay  ngày đầu của kỳ tùy chọn (tính cả ngày đó); bỏ qua với kỳ khác
     * @param denNgay ngày cuối của kỳ tùy chọn (tính cả ngày đó)
     * @param khoId   null = tất cả kho
     * @param lamMoi  true = bỏ qua bản đã tính trong 60 giây gần nhất (nút "Cập nhật")
     */
    TongQuanAdminResponse layTongQuan(String ky, LocalDate tuNgay, LocalDate denNgay, Integer khoId, boolean lamMoi);
}
