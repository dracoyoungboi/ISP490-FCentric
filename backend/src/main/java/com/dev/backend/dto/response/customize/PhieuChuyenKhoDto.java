package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Dữ liệu trả về của màn chuyển kho nội bộ: danh sách (B.6), chi tiết (B.1), nhận hàng (B.4), phiếu điều chỉnh. */
public final class PhieuChuyenKhoDto {

    private PhieuChuyenKhoDto() {
    }

    /** Một dòng ở danh sách phiếu chuyển (B.6). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongDanhSach {
        Integer id;
        String soPhieuChuyen;
        Instant ngayTao;
        Integer khoXuatId;
        String khoXuatTen;
        Integer khoNhapId;
        String khoNhapTen;
        String trangThai;
        /** Đã hủy do Quản lý Kho tổng từ chối (nhãn "Đã từ chối", SRS UC 7.2); trạng thái lưu vẫn DA_HUY. */
        boolean tuChoi;
        /** Hoàn tất bằng ghi giảm chênh lệch (nhãn "Hoàn tất (có chênh lệch)"). */
        boolean coChenhLech;
        /** Chờ xử lý chênh lệch mà kho gửi chưa xác nhận biên bản giao nhận. */
        boolean choKhoGuiXacNhan;
        String soLenhDieuDong;
        String kyHieuXknb;
        String soPhieuXknb;
        Instant ngayDuKienDen;
        Instant ngayThucTeDen;
        Integer tongSoLuong;
        /** Đang vận chuyển, quá giờ dự kiến đến. */
        boolean tre;
        /** Đang vận chuyển mà chưa ghi số phiếu XKNB. */
        boolean thieuXknb;
        Integer phieuGocId;
        String soPhieuGoc;
        /**
         * Hàng của phiếu đã vào kho mà chưa có kệ (nhận chuyển kho ở kho nhận, hàng hoàn trả về kho xuất), chỉ tính ở kho
         * đang chọn (Quản lý Kho tổng: mọi kho đã khai báo kệ); 0 khi không có.
         */
        int chuaXepKe;
    }

    /**
     * Danh sách một trang và số phiếu ở từng tab (TAT_CA, CHO_DUYET, DANG_VAN_CHUYEN, TRE_HEN, CHO_XU_LY_LECH, THIEU_XKNB,
     * CHO_XEP_KE).
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DanhSach {
        List<DongDanhSach> content;
        long totalElements;
        int totalPages;
        int page;
        int size;
        Map<String, Long> soTheoTab;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class KhoTomTat {
        Integer id;
        String ten;
        String diaChi;
        String loaiKho;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ChungTu {
        Integer id;
        String so;
        /** Trạng thái của chứng từ đó: số (phiếu xuất, phiếu nhập) hoặc chữ (phiếu chuyển). */
        String trangThai;
        Instant ngay;
        String nguoi;
        /** Phiếu nhập: true khi là phiếu nhập hoàn trả về kho nguồn. */
        Boolean laHoanTra;
        /** Phiếu chuyển: true khi Đã hủy do bị từ chối (nhãn "Đã từ chối"); chứng từ khác để null. */
        Boolean tuChoi;
    }

    /** Hàng theo biến thể ở bảng "Hàng chuyển" (B.1). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongHang {
        Integer bienTheId;
        Integer sanPhamId;
        String sku;
        String tenSanPham;
        String tenMau;
        String maMauHex;
        String kichCo;
        String anh;
        /** Đơn vị tính của sản phẩm (bản in 03/XKNB, tệp dữ liệu chuyến hàng). */
        String donViTinh;
        Integer soLuongChuyen;
        BigDecimal daNhat;
        BigDecimal daXuat;
        BigDecimal daNhan;
        BigDecimal hong;
        /** Phần còn ở kho trung chuyển của phiếu này: đã xuất − đã nhận − đã ghi giảm − đã nhập hoàn trả. */
        BigDecimal conTrenDuong;
    }

    /** Hàng đã xuất theo lô, dùng cho màn Nhận hàng (B.4). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongLo {
        Integer bienTheId;
        String sku;
        String tenSanPham;
        String tenMau;
        String maMauHex;
        String kichCo;
        String anh;
        String maVach;
        Integer loHangId;
        String maLo;
        BigDecimal soLuong;
        BigDecimal giaVon;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongBienBan {
        Integer id;
        Integer bienTheId;
        String sku;
        String tenSanPham;
        String tenMau;
        String maMauHex;
        String kichCo;
        Integer loHangId;
        String maLo;
        Integer gui;
        Integer nhan;
        Integer thieu;
        Integer hong;
        String lyDo;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class BienBan {
        Integer id;
        String soBienBan;
        Instant ngayLap;
        String nguoiLap;
        String nguoiVanChuyen;
        Integer tongGui;
        Integer tongNhan;
        Integer tongThieu;
        Integer tongHong;
        String ketLuan;
        /** Đại diện kho gửi đã xác nhận biên bản trên F Centric (null = chưa xác nhận). */
        String nguoiXacNhanGui;
        Instant ngayXacNhanGui;
        /** Ý kiến của kho gửi khi xác nhận (không bắt buộc). */
        String ghiChuKhoGui;
        String phuongAn;
        String nguoiDuyet;
        Instant ngayDuyet;
        List<DongBienBan> dong;
        /** Ảnh chụp đính kèm (mockup B.4), theo thứ tự thêm; tối đa AnhBienBanGiaoNhanService.SO_ANH_TOI_DA. */
        List<AnhBienBan> anh;
    }

    /** Một ảnh chụp của biên bản giao nhận. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class AnhBienBan {
        Integer id;
        /** Đường dẫn công khai (HTTPS) của ảnh trên MinIO. */
        String url;
        String moTa;
        String nguoiChup;
        Instant ngayChup;
        /** Người đang xem xóa được ảnh này (cùng điều kiện máy chủ kiểm khi bấm xóa). */
        boolean duocXoa;
    }

    /** Thao tác người đang xem được làm (cùng điều kiện với máy chủ kiểm khi bấm). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Quyen {
        boolean duyet;
        /** Từ chối phiếu Chờ duyệt (Quản lý Kho tổng không lập phiếu); khi có thì không có {@code huy}. */
        boolean tuChoi;
        boolean huy;
        boolean nhat;
        boolean xuat;
        boolean ghiSoXknb;
        boolean nhan;
        /** Đại diện kho gửi xác nhận biên bản giao nhận (quản lý kho xuất, quản trị viên; không phải người lập biên bản). */
        boolean xacNhanBienBan;
        /** Xử lý chênh lệch: chỉ khi kho gửi đã xác nhận biên bản. */
        boolean xuLyChenhLech;
        /**
         * Chọn Giao bù thì phiếu giao bù được duyệt và có lệnh điều động ngay (người xử lý là Quản lý Kho tổng / quản trị
         * viên, BR-TRF-01); quản lý kho xuất xử lý theo Cấu hình thì phiếu giao bù chờ Quản lý Kho tổng duyệt.
         */
        boolean giaoBuTuDuyet;
        boolean nhapHoanTra;
        /** Thêm ảnh vào biên bản giao nhận: người thuộc kho nhận, biên bản còn chờ xử lý (chưa tính số ảnh đã có). */
        boolean themAnhBienBan;
    }

    /** Chi tiết phiếu chuyển (B.1). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ChiTiet {
        Integer id;
        String soPhieuChuyen;
        String trangThai;
        boolean coChenhLech;
        Instant ngayTao;
        KhoTomTat khoXuat;
        KhoTomTat khoNhap;
        String nguoiTao;
        String ghiChu;
        // Lệnh điều động
        String soLenhDieuDong;
        Instant ngayLenhDieuDong;
        String nguoiRaLenh;
        String lyDoDieuDong;
        String ghiChuLenh;
        // Vận chuyển
        String hinhThucVanChuyen;
        String nguoiVanChuyen;
        String soDienThoaiVanChuyen;
        String loaiPhuongTien;
        String bienSoXe;
        String donViVanChuyen;
        String maVanDonHopDong;
        Instant ngayDuKienDen;
        Instant ngayThucTeDen;
        boolean tre;
        // Giấy đi đường
        String kyHieuXknb;
        String soPhieuXknb;
        LocalDate ngayLapXknb;
        String maTraCuuXknb;
        // Hủy
        String nguoiHuy;
        String lyDoHuy;
        Instant ngayHuy;
        /** Đã hủy vì Quản lý Kho tổng từ chối lúc Chờ duyệt: nguoiHuy, lyDoHuy, ngayHuy là người, lý do, giờ từ chối. */
        boolean tuChoi;
        /** Hủy khi hàng đã rời kho nguồn: phải nhập hoàn trả. */
        boolean huyKhiDangChuyen;
        boolean daNhapHoanTra;
        // Chứng từ liên quan
        ChungTu phieuGoc;
        List<ChungTu> phieuGiaoBu;
        ChungTu phieuXuat;
        /**
         * Phiếu nhặt của PX-CK (đặc tả bước 8–9): id, so = mã PL, trangThai = cho_nhat / dang_nhat / da_nhat / da_huy,
         * ngay = lúc hoàn tất (chưa hoàn tất: lúc tạo), nguoi = người nhặt. Null khi chưa có (phiếu cũ chưa mở phiếu nhặt,
         * hoặc đã chọn lô tay).
         */
        ChungTu phieuNhat;
        /** Được xác nhận xuất: phiếu nhặt đã hoàn tất, hoặc phiếu cũ (không có phiếu nhặt) đã chọn đủ lô tay. */
        boolean daNhatXong;
        /** Phiếu cũ đã chọn lô tay trên PX-CK, không có phiếu nhặt: giữ đường chọn lô tay ở màn phiếu xuất. */
        boolean chonLoTay;
        List<ChungTu> phieuNhap;
        BienBan bienBan;
        ChungTu phieuDieuChinh;
        // Hàng
        List<DongHang> hang;
        List<DongLo> hangTheoLo;
        // Cấu hình giấy đi đường cho hộp Xác nhận xuất
        String xknbKyHieuMacDinh;
        String xknbCheDo;
        /** Ai được xử lý chênh lệch theo Cấu hình › Chuyển kho, VD "Quản trị viên hoặc Quản lý Kho tổng" (câu nhắc ở giao diện). */
        String aiXuLyChenhLech;
        /** Câu tiếng Việt gốc của aiXuLyChenhLech (giấy biên bản in luôn tiếng Việt; giao diện tự dịch). */
        String aiXuLyChenhLechGoc;
        Quyen quyen;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongDieuChinh {
        Integer bienTheId;
        String sku;
        String tenSanPham;
        String tenMau;
        String maMauHex;
        String kichCo;
        String donViTinh;
        String maLo;
        BigDecimal soLuong;
        BigDecimal giaVon;
        BigDecimal thanhTien;
        Integer thieu;
        Integer hong;
        String lyDo;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongSoKho {
        String kho;
        String sku;
        String maLo;
        String loai;
        BigDecimal soLuong;
        BigDecimal truoc;
        BigDecimal sau;
        Instant ngay;
    }

    /** Phiếu điều chỉnh kho (ghi giảm chênh lệch chuyển kho). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PhieuDieuChinh {
        Integer id;
        String soPhieu;
        String nguon;
        String kho;
        String loaiDieuChinh;
        Instant ngayDieuChinh;
        Integer trangThai;
        BigDecimal tongGiaTriGiam;
        String lyDo;
        String nguoiLap;
        String nguoiDuyet;
        Instant ngayDuyet;
        ChungTu phieuChuyen;
        String khoXuatTen;
        String khoNhapTen;
        String soLenhDieuDong;
        ChungTu bienBan;
        String phuongAn;
        ChungTu phieuGiaoBu;
        List<DongDieuChinh> dong;
        List<DongSoKho> soKho;
    }
}
