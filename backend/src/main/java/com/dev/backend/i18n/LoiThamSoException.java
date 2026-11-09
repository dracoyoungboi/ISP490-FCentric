package com.dev.backend.i18n;

/** IllegalArgumentException mang câu theo khóa (giữ nguyên kiểu để các khối catch cũ vẫn bắt được). */
public class LoiThamSoException extends IllegalArgumentException implements CoThongDiep {

    private final transient ThongDiep thongDiep;

    public LoiThamSoException(ThongDiep thongDiep) {
        super(thongDiep.tiengViet());
        this.thongDiep = thongDiep;
    }

    public LoiThamSoException(ThongDiep thongDiep, Throwable nguyenNhan) {
        super(thongDiep.tiengViet(), nguyenNhan);
        this.thongDiep = thongDiep;
    }

    @Override
    public ThongDiep getThongDiep() {
        return thongDiep;
    }
}
