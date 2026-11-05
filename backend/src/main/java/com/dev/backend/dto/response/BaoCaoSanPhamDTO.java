package com.dev.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Báo cáo sản phẩm (màn /reports/products và tệp Excel dùng chung). Số bán tính như Báo cáo doanh thu: đơn bán đã xuất
 * toàn bộ / hoàn thành, theo ngày giao hàng; doanh thu hàng = thành tiền dòng − giảm giá dòng (gồm thuế GTGT, không gồm
 * phí vận chuyển); giá vốn theo lô đã xuất. Hoàn = số lượng trên đơn bị hoàn trả có ngày giao trong kỳ. Khả dụng và đang
 * về là số hiện tại, không theo kỳ. Kỳ trước = khoảng ngày liền trước, cùng số ngày.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BaoCaoSanPhamDTO {
    private LocalDate tuNgay;
    private LocalDate denNgay;
    private LocalDate tuNgayTruoc;
    private LocalDate denNgayTruoc;
    /** Số ngày đã qua của kỳ (cắt tới hôm nay), dùng tính bán bình quân một ngày. */
    private int soNgay;
    /** Quản lý kho xem "Tất cả kho": chỉ tính các cửa hàng mình phụ trách. */
    private boolean theoKhoPhuTrach;
    /**
     * Người xem được giá vốn, lợi nhuận gộp, giá trị tồn (quản trị viên, quản lý kho). Nhân viên bán hàng: false, các trường
     * đó là null.
     */
    private boolean coGiaVon;
    private Tong tong;
    /** Kênh có thể lọc: POS, TRUC_TIEP và id các kênh bán đã khai báo. */
    private List<Kenh> dsKenh;
    /** Sản phẩm đang kinh doanh và sản phẩm có phát sinh bán / hoàn trong hai kỳ, xếp theo số lượng bán giảm dần. */
    private List<SanPham> sanPham;
    /** Cả cửa hàng (trong phạm vi) theo từng ngày của kỳ: số lượng bán và doanh thu hàng. */
    private List<Ngay> theoNgay;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Ngay {
        private LocalDate ngay;
        private BigDecimal soLuong;
        private BigDecimal doanhThu;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Tong {
        private BigDecimal soLuong;
        private BigDecimal soLuongTruoc;
        private BigDecimal doanhThu;
        private BigDecimal doanhThuTruoc;
        private BigDecimal giaVon;
        private BigDecimal giaVonTruoc;
        private BigDecimal loiNhuan;
        private BigDecimal loiNhuanTruoc;
        private BigDecimal soLuongHoan;
        private BigDecimal soLuongHoanTruoc;
        private long soDon;
        private long soDonTruoc;
        private int soSanPhamCoBan;
        private int soSanPhamCoBanTruoc;
        private int soSanPhamDangKinhDoanh;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Kenh {
        private String ma;
        private String ten;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SanPham {
        private Integer id;
        private String maSanPham;
        private String tenSanPham;
        private String anh;
        private String danhMuc;
        private String thuongHieu;
        private String donViTinh;
        /** 0 hết hàng, 1 còn hàng, 2 ngừng hoạt động (như bảng sản phẩm). */
        private Integer trangThai;
        /** Hạng theo số lượng bán kỳ này (null khi không bán) và kỳ trước. */
        private Integer hang;
        private Integer hangTruoc;
        /** A, B, C theo doanh thu cộng dồn (null khi không có doanh thu). */
        private String nhomAbc;
        private BigDecimal soLuong;
        private BigDecimal soLuongTruoc;
        private BigDecimal doanhThu;
        private BigDecimal doanhThuTruoc;
        private BigDecimal giaVon;
        private BigDecimal loiNhuan;
        private BigDecimal soLuongHoan;
        private long soDon;
        private BigDecimal khaDung;
        private BigDecimal dangVe;
        /** Giá trị tồn: tồn thực × giá vốn của từng lô (như Báo cáo tồn kho). */
        private BigDecimal giaTriTon;
        /** Khả dụng chia số bán bình quân một ngày của mọi kênh (null khi không bán). */
        private BigDecimal duBanNgay;
        /** HET_HANG (khả dụng 0), BAN_CHAY_SAP_HET, DU_HANG, KHONG_BAN, BINH_THUONG. */
        private String tinhTrang;
        private LocalDate ngayBanCuoi;
        private LocalDate ngayNhapDau;
        /** Số lượng bán từng ngày của kỳ (đủ soNgay phần tử); rỗng khi không bán. */
        private List<BigDecimal> theoNgay;
        private List<TyTrong> theoKenh;
        private List<BienThe> bienThe;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TyTrong {
        private String ten;
        private BigDecimal soLuong;
        private BigDecimal doanhThu;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BienThe {
        private Integer id;
        private String maSku;
        private String mau;
        private String maMauHex;
        private String size;
        private Integer thuTuSize;
        private BigDecimal giaBan;
        private BigDecimal soLuong;
        private BigDecimal doanhThu;
        private BigDecimal giaVon;
        private BigDecimal soLuongHoan;
        private BigDecimal khaDung;
        private BigDecimal dangVe;
    }
}
