package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Biên bản trả hàng nhà cung cấp. Hai việc cho TỪNG DÒNG sản phẩm lỗi: hàng lỗi đi đâu và nhà cung cấp bù gì (ở
 * {@code items}); các trường đầu biên bản ({@code phuongAn}, {@code trangThaiHang}, {@code hangLoiNcc}) là tổng của các
 * dòng. Nhà cung cấp chọn trên Cổng nhà cung cấp; kho làm theo.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BienBanTraHangDto {
    Integer id;
    String soBienBan;
    Integer phieuNhapKhoId;
    String soPhieuNhap;
    /** Phiếu nhập đã hoàn tất (số lỗi đã khóa, chốt / giao trả được). */
    Boolean phieuDaNhap;
    Instant ngayNhapKho;
    String nguoiNhapKho;
    Integer donMuaHangId;
    String soDonMua;
    /** Trạng thái đơn mua (3 đang vận chuyển, 5 nhận đủ, 6 đã đóng, 7 đã hủy). */
    Integer trangThaiDonMua;
    Integer khoId;
    String tenKho;
    Integer nhaCungCapId;
    String maNhaCungCap;
    String tenNhaCungCap;
    String nguoiLienHeNcc;
    String dienThoaiNcc;
    String emailNcc;
    /** Lúc gửi được email biên bản (lần lập cuối) cho nhà cung cấp; null: chưa gửi được / nhà cung cấp chưa có email. */
    Instant emailGuiLuc;
    /** Lúc lập / lập lại (có đổi hàng lỗi) gần nhất; null: biên bản lập trước khi có nhật ký. */
    Instant lapCuoiLuc;
    /**
     * Cách bù của cả biên bản (tổng các dòng): CHO_CHOT (còn dòng chưa chọn) | DOI_HANG (giao bù) | TRU_CONG_NO (trừ tiền)
     * | HON_HOP (dòng giao bù, dòng trừ tiền). Lựa chọn từng dòng ở {@code items}.
     */
    String phuongAn;
    /** Có dòng giao bù và mọi dòng giao bù đã nhận đủ hàng bù (dòng đơn cùng biến thể hết thiếu) hoặc đơn đã đóng / hủy. */
    Boolean buXong;
    /** Số lỗi theo cách bù / hàng lỗi của các dòng (khung tóm tắt). */
    Integer soLuongGiaoBu;
    Integer soLuongChoChonCachBu;
    Integer soLuongNhanLai;
    Integer soLuongTieuHuy;
    /** Giá trị các dòng trừ tiền theo đơn giá đơn mua (số trừ dự kiến khi phiếu chưa nhập kho). */
    BigDecimal giaTriTruTien;
    /** Số lỗi của các dòng giao bù mà đơn mua còn chờ nhà cung cấp giao (theo còn thiếu của dòng đơn cùng biến thể). */
    Integer soLuongChoHangBu;
    /**
     * Cách bù đến từ đâu: CONG_NCC (nhà cung cấp chọn trên cổng) | DONG_DON (mua hàng đóng đơn nhận thiếu) | TU_DONG
     * (quá hạn trả lời) | DU_LIEU_CU (biên bản lập trước khi có nhật ký).
     */
    String nguonChot;
    /** Người bên nhà cung cấp xác nhận cách bù trên cổng. */
    String nguoiXacNhanNcc;
    String ghiChuChot;
    /** Người đóng đơn (nguồn DONG_DON); nhà cung cấp / hệ thống: null. */
    String nguoiChot;
    Instant thoiDiemChot;
    /**
     * Nhà cung cấp chọn cho hàng lỗi: NHAN_LAI | TIEU_HUY khi mọi dòng đã chọn cùng một cách, HON_HOP khi khác nhau theo
     * dòng, null khi chưa dòng nào chọn.
     */
    String hangLoiNcc;
    String nguoiChonHangLoi;
    Instant thoiDiemChonHangLoi;
    String ghiChuChonHangLoi;
    /** Nhà cung cấp còn phải chọn cách bù / hàng lỗi. */
    Boolean choNccChonCachBu;
    Boolean choNccChonHangLoi;
    /** Hạn trả lời (hết ngày thứ 7 kể từ lần gửi email đầu); null: chưa gửi được email biên bản. */
    Instant hanTraLoi;
    /** Đã gửi email nhắc hạn. */
    Boolean daNhacHan;
    /**
     * Lựa chọn nhà cung cấp còn chọn hoặc đổi được trên cổng (chỉ có ở màn chi tiết; rỗng: việc đó đã chốt).
     * cachBuMo ⊂ {DOI_HANG, TRU_CONG_NO}; hangLoiMo ⊂ {NHAN_LAI, TIEU_HUY}.
     */
    List<String> cachBuMo;
    List<String> hangLoiMo;
    /** Số lỗi đã trừ tiền (đóng đơn có thể trừ ít hơn tổng lỗi). */
    Integer soLuongTruTien;
    String ghiChu;
    Instant ngayLap;
    String nguoiLap;
    Integer tongSoLuongLoi;
    /** Giá trị hàng lỗi theo đơn giá đơn mua. */
    BigDecimal giaTriLoi;
    /** Tiền đã trừ theo đơn giá đơn mua. */
    BigDecimal tienTruTien;
    /** CHO_TRA_HANG (còn hiệu lực) | DA_HUY. */
    String trangThai;
    /** CHO_KY (chờ ghi người giao hàng đã ký, chưa gửi nhà cung cấp) | MOI_LAP | CHO_CHOT (chờ nhà cung cấp) | CHO_GIAO_TRA | CHO_TIEU_HUY | CHO_HANG_BU | HOAN_TAT | DA_HUY. */
    String trangThaiHienThi;

    // ── Việc 1: hàng lỗi ──
    /** GIU_KHO | TRA_NGAY. */
    String cachXuLyHang;
    /** O_KHO (còn dòng ở kho) | DA_TRA | DA_TIEU_HUY | DA_XU_LY (đã rời kho hết, dòng trả dòng tiêu hủy). */
    String trangThaiHang;
    /** Người nhận hàng lỗi (người giao hàng khi trả ngay, người đến lấy / đơn vị vận chuyển) hoặc người đồng ý tiêu hủy. */
    String nguoiNhanHang;
    /**
     * Ai ký biên bản bên giao hàng: DAI_DIEN_NCC | VAN_CHUYEN; null với biên bản lập trước khi có bước ký. Dữ liệu cũ có
     * thể còn KHONG_AI (lựa chọn đã bỏ 23/11/2026): đọc như biên bản không có bước ký.
     */
    String benKy;
    /** Họ tên người giao hàng ký biên bản giấy (null: biên bản cũ). */
    String nguoiGiao;
    /** Biển số xe của người giao hàng. */
    String bienSoXe;
    /** Đơn vị vận chuyển của người giao hàng (khi VAN_CHUYEN). */
    String donViVanChuyen;
    /** Việc ký biên bản giấy: CHO_KY | DA_KY; null với biên bản lập trước khi có bước ký. */
    String kyBienBan;
    /** Lúc kho ghi người giao hàng đã ký, người ghi. */
    Instant thoiDiemKy;
    String nguoiGhiKy;
    /** TAI_XE | NCC_LAY | VAN_CHUYEN. */
    String cachGiao;
    String maVanDon;
    Instant thoiDiemTra;
    String nguoiGhiTra;
    String ghiChuTra;
    Boolean duLieuCu;

    /** Hàng lỗi gộp theo biến thể (để chốt, in, hiển thị), số lỗi lấy từ lô của phiếu. */
    List<TheoBienTheDto> theoBienThe;

    List<ChiTietItemDto> items;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ChiTietItemDto {
        Integer id;
        Integer bienTheSanPhamId;
        String sku;
        String tenBienThe;
        String mauSac;
        String kichCo;
        String maLo;
        String lyDo;
        Integer soLuong;
        String anhBangChungUrl;
        String ghiChu;
        // ── Lựa chọn của nhà cung cấp cho riêng dòng này ──
        /** Đơn giá dòng đơn mua cùng biến thể; giá trị = số lỗi × đơn giá (số tiền trừ nếu dòng trừ tiền). */
        BigDecimal donGia;
        BigDecimal giaTri;
        /**
         * Dòng trừ tiền: số lỗi trừ tiền và số tiền trừ (cả dòng, hoặc một phần khi đơn chỉ còn chờ một phần lúc quá
         * hạn / đóng đơn — phần kia đã giao ở đợt khác, coi như đã giao bù). Dòng khác: 0.
         */
        Integer soLuongTru;
        BigDecimal tienTru;
        /** CHO_CHOT | DOI_HANG | TRU_CONG_NO. */
        String cachBu;
        /** CONG_NCC | DONG_DON | TU_DONG | NHAP_KHO (trừ tiền không áp được, về chờ chọn) | DU_LIEU_CU; null: chưa chọn. */
        String nguonCachBu;
        String nguoiXacNhanCachBu;
        Instant thoiDiemCachBu;
        /** Giao bù đã nhận đủ (dòng đơn mua cùng biến thể hết thiếu, hoặc đơn đã đóng / hủy). */
        Boolean buXong;
        /** Nhà cung cấp chọn cho hàng lỗi của dòng: NHAN_LAI | TIEU_HUY | null (chưa chọn). */
        String hangLoiNcc;
        String nguoiChonHangLoi;
        Instant thoiDiemChonHangLoi;
        /** O_KHO | DA_TRA | DA_TIEU_HUY. */
        String trangThaiHang;
        /** Lần hàng lỗi của dòng rời kho: lúc, người nhận / người đồng ý tiêu hủy, cách giao, mã vận đơn. */
        Instant thoiDiemRoiKho;
        String nguoiNhanHang;
        String cachGiao;
        String maVanDon;
        /** Lựa chọn nhà cung cấp còn chọn / đổi được cho dòng (chỉ ở màn chi tiết; rỗng: đã chốt). */
        List<String> cachBuMo;
        List<String> hangLoiMo;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TheoBienTheDto {
        Integer bienTheSanPhamId;
        String sku;
        String tenBienThe;
        String mauSac;
        String kichCo;
        Integer soLuongLoi;
        BigDecimal donGia;
        /** Còn thiếu của dòng đơn mua cùng biến thể (đặt − đã nhận − trừ tiền). */
        BigDecimal conThieuDongDon;
        /** Số lỗi của biến thể ở các dòng nhà cung cấp chọn giao bù / còn chờ chọn cách bù (theo dòng biên bản). */
        Integer soLuongGiaoBu;
        Integer soLuongChoChon;
    }
}
