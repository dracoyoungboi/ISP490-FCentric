package com.dev.backend.dto.request.congncc;

/** Body các API công khai của Cổng nhà cung cấp. */
public final class CongNccRequest {

    private CongNccRequest() {
    }

    public record LayMa(String email) {
    }

    public record XacNhanMa(String email, String ma) {
    }

    /**
     * phuongAn: DOI_HANG (giao bù) | TRU_CONG_NO (trừ tiền); hangLoi: NHAN_LAI | TIEU_HUY; null là giữ như cũ.
     * phienBan: BienBan.phienBan nhà cung cấp đang xem (kho lập lại trong lúc đó thì 409, không ghi câu trả lời cho số lỗi
     * cũ).
     */
    public record TraLoiBienBan(String phuongAn, String hangLoi, String nguoiXacNhan, String ghiChu, Integer phienBan) {
    }
}
