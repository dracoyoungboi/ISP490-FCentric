package com.dev.backend.dto.response.customize;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Một trang của danh sách "Sản phẩm theo sàn" (phân trang theo sản phẩm), kèm {@code tongSku}: tổng SKU khớp bộ lọc
 * trên mọi trang. Trả về như một Page bình thường (content, totalElements…), chỉ thêm trường tongSku.
 */
public class TrangNhomLienKet extends PageImpl<NhomLienKetDto> {

    private final long tongSku;

    public TrangNhomLienKet(List<NhomLienKetDto> content, Pageable pageable, long tongSanPham, long tongSku) {
        super(content, pageable, tongSanPham);
        this.tongSku = tongSku;
    }

    public long getTongSku() {
        return tongSku;
    }
}
