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
     * dong: lựa chọn của từng dòng sản phẩm lỗi ({@link TraLoiDong}). phuongAn / hangLoi: lựa chọn chung cho các dòng
     * không có trong {@code dong} (cách gửi cũ); DOI_HANG (giao bù) | TRU_CONG_NO (trừ tiền), NHAN_LAI | TIEU_HUY; null là
     * giữ như cũ. phienBan: BienBan.phienBan nhà cung cấp đang xem (kho lập lại trong lúc đó thì 409, không ghi câu trả lời
     * cho số lỗi cũ). camKet: đã đánh dấu câu cam kết trong hộp xác nhận.
     */
    public record TraLoiBienBan(String phuongAn, String hangLoi, String nguoiXacNhan, String ghiChu, Integer phienBan,
                                java.util.List<TraLoiDong> dong, Boolean camKet) {

        /** Cách gửi cũ: một lựa chọn cho mọi dòng. */
        public TraLoiBienBan(String phuongAn, String hangLoi, String nguoiXacNhan, String ghiChu, Integer phienBan) {
            this(phuongAn, hangLoi, nguoiXacNhan, ghiChu, phienBan, null, null);
        }
    }

    /** Lựa chọn của một dòng: id dòng (CongNcc.DongLoi.id), cách bù, hàng lỗi; null là giữ như cũ. */
    public record TraLoiDong(Integer id, String phuongAn, String hangLoi) {
    }
}
