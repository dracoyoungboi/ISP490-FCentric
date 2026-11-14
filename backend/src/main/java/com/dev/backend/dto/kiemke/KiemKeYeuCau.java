package com.dev.backend.dto.kiemke;

import java.time.Instant;
import java.util.List;

/** Thân yêu cầu của API kiểm kê khoanh vùng (/api/v1/kiem-ke). */
public final class KiemKeYeuCau {

    private KiemKeYeuCau() {
    }

    /**
     * Tạo / sửa nháp, xem trước phạm vi, tạo và bắt đầu. {@code loaiKiemKe}: toan_bo · theo_khu_vuc · theo_ke ·
     * theo_danh_muc. {@code phienBan}: chỉ khi sửa nháp (expectedVersion).
     */
    public record Dot(String tenDotKiemKe, Integer khoId, Integer nguoiChuTriId, String lyDo, Instant ngayDuKienBatDau,
                      String loaiKiemKe, List<Integer> khuVucIds, List<Integer> viTriIds, Integer danhMucId,
                      String ghiChu, Long phienBan) {
    }

    /** expectedVersion của Bắt đầu, Trình duyệt, Phê duyệt. */
    public record PhienBan(Long phienBan) {
    }

    /**
     * Lưu số đếm một dòng. {@code soLuongThucTe} null = chưa đếm (khác số 0). Lý do và biện pháp ghi đúng như gửi (trống
     * thì xóa). {@code phienBan}: phiên bản của dòng lúc tải.
     */
    public record DemDong(Integer soLuongThucTe, String lyDoChenhLech, String bienPhapXuLy, Long phienBan) {
    }

    /** Lô phát sinh: lô đã có trong danh mục hàng hóa, tìm thấy ở kệ trong phạm vi mà số chốt bằng 0. */
    public record PhatSinh(Integer viTriKhoId, Integer loHangId, Integer soLuongThucTe, String lyDoChenhLech) {
    }

    public record DemLai(List<Integer> dongIds, String lyDo, Long phienBan) {
    }

    public record Huy(String lyDo, Long phienBan) {
    }

    /** Xếp hàng chưa có kệ lên kệ (cùng kho). */
    public record XepKe(Integer loHangId, Integer viTriKhoId, Integer soLuong) {
    }

    /** Xếp nhiều phần lên kệ một lượt; một lô chia nhiều kệ là nhiều phần cùng loHangId. */
    public record XepNhieu(List<XepKe> ds) {
    }
}
