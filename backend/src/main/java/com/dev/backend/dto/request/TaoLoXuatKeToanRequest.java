package com.dev.backend.dto.request;

import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaoLoXuatKeToanRequest {
    /** Lô gồm mọi chứng từ chưa xuất có ngày hạch toán từ ngày mốc đến hết ngày này. */
    private LocalDate denNgay;
    private String ghiChu;
    /** dauVet của lần Kiểm tra mà người dùng đã xem (không bắt buộc); khác dấu vết lúc tạo thì báo 409. */
    private String dauVet;
}
