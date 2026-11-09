package com.dev.backend.i18n;

/** IllegalStateException mang câu theo khóa (giữ nguyên kiểu để các khối catch cũ vẫn bắt được). */
public class LoiTrangThaiException extends IllegalStateException implements CoThongDiep {

    private final transient ThongDiep thongDiep;

    public LoiTrangThaiException(ThongDiep thongDiep) {
        super(thongDiep.tiengViet());
        this.thongDiep = thongDiep;
    }

    public LoiTrangThaiException(ThongDiep thongDiep, Throwable nguyenNhan) {
        super(thongDiep.tiengViet(), nguyenNhan);
        this.thongDiep = thongDiep;
    }

    @Override
    public ThongDiep getThongDiep() {
        return thongDiep;
    }
}
