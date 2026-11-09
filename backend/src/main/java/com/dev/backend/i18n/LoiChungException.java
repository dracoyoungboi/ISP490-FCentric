package com.dev.backend.i18n;

/** RuntimeException mang câu theo khóa — thay cho {@code new RuntimeException("câu tiếng Việt")} (cùng cách xử lý lỗi). */
public class LoiChungException extends RuntimeException implements CoThongDiep {

    private final transient ThongDiep thongDiep;

    public LoiChungException(ThongDiep thongDiep) {
        super(thongDiep.tiengViet());
        this.thongDiep = thongDiep;
    }

    public LoiChungException(ThongDiep thongDiep, Throwable nguyenNhan) {
        super(thongDiep.tiengViet(), nguyenNhan);
        this.thongDiep = thongDiep;
    }

    @Override
    public ThongDiep getThongDiep() {
        return thongDiep;
    }
}
