package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Thân yêu cầu của các thao tác trên phiếu chuyển kho (đặc tả BA, UC-7.1). Tạo phiếu dùng PhieuChuyenKhoCreating. */
public final class PhieuChuyenKhoYeuCau {

    private PhieuChuyenKhoYeuCau() {
    }

    /** Duyệt và lập lệnh điều động (B.2): lý do BO_SUNG | CAN_BANG | TRA_VE | KHAC; KHAC bắt buộc ghi chú. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Duyet {
        String lyDoDieuDong;
        String ghiChuLenh;
    }

    /** Hủy phiếu (A5): lý do không bắt buộc. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Huy {
        String lyDo;
    }

    /**
     * Xác nhận xuất (B.3, BR-TRF-02): người vận chuyển, phương tiện, giấy đi đường. {@code vanXuatKhiChuaCoSo} = true khi
     * người dùng đã đồng ý xuất lúc chưa có số phiếu XKNB (chỉ được ở chế độ Chỉ cảnh báo).
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class XacNhanXuat {
        String hinhThucVanChuyen;
        String nguoiVanChuyen;
        String soDienThoaiVanChuyen;
        String loaiPhuongTien;
        String bienSoXe;
        String donViVanChuyen;
        String maVanDonHopDong;
        Instant ngayDuKienDen;
        String kyHieuXknb;
        String soPhieuXknb;
        LocalDate ngayLapXknb;
        String maTraCuuXknb;
        Boolean vanXuatKhiChuaCoSo;
    }

    /** Ghi số phiếu XKNB sau khi đã xuất ("xuất trước, ghi số sau"). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class GhiSoXknb {
        String kyHieuXknb;
        String soPhieuXknb;
        LocalDate ngayLapXknb;
        String maTraCuuXknb;
    }

    /** Nhận hàng có chênh lệch (A4): số đạt, hỏng theo từng lô; lý do bắt buộc ở dòng lệch; thông tin biên bản. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class NhanLech {
        List<DongNhan> dong;
        String nguoiVanChuyen;
        Instant thoiDiem;
        String ketLuan;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongNhan {
        Integer bienTheSanPhamId;
        Integer loHangId;
        Integer soLuongDat;
        Integer soLuongHong;
        String lyDo;
    }

    /** Duyệt xử lý chênh lệch (bước 5): GHI_GIAM_HAO_HUT | GIAO_BU_HANG cho cả biên bản, lý do bắt buộc. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class XuLyChenhLech {
        String phuongAn;
        String lyDo;
    }
}
