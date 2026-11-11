package com.dev.backend.dto.chuyenke;

import java.math.BigDecimal;
import java.util.List;

/**
 * Yêu cầu chốt chuyển kệ (BA bước 8–9): mọi dòng đi từ cùng một kệ nguồn; một lô tách cất nhiều kệ đích là nhiều dòng.
 * {@code vuotSucChua}: quản lý kho cho cất vượt sức chứa kệ đích (Manager Override, BR-BIN-05); vai trò khác gửi true bị
 * từ chối.
 */
public record ChuyenKeYeuCau(Integer keNguonId, List<Dong> dong, String ghiChu, Boolean vuotSucChua) {

    /** {@code soLuong} nhận số thập phân để báo lỗi số lẻ (khai Integer thì 1.5 bị cắt thành 1 im lặng). */
    public record Dong(Integer loHangId, Integer keDichId, BigDecimal soLuong) {
    }
}
