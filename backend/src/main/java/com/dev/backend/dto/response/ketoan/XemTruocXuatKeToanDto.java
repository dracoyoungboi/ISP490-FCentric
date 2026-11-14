package com.dev.backend.dto.response.ketoan;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Kết quả bước "Kiểm tra" trước khi tạo lô: số chứng từ và tiền theo loại, lỗi chặn (chứng từ để lại lô sau), cảnh
 * báo (vẫn xuất), phát sinh sau khi xuất (đơn đã xuất rồi bị hoàn trả) và đối chiếu doanh thu với Báo cáo doanh thu.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class XemTruocXuatKeToanDto {
    private LocalDate ngayMoc;
    private LocalDate denNgay;
    /** Ngày hạch toán sớm nhất trong lô (null khi lô chỉ có danh mục / rỗng). */
    private LocalDate tuNgay;
    private boolean coTonDauKy;
    private List<TongHopLoai> tongHop;
    private List<VanDe> loiChan;
    private List<VanDe> canhBao;
    private List<VanDe> phatSinhSauXuat;
    private DoiChieu doiChieu;
    /** Có ít nhất một chứng từ (hoặc tồn đầu kỳ) để tạo lô. */
    private boolean coTheTaoLo;
    /** Lý do không tạo được lô (chưa đặt ngày mốc, ngày "xuất đến hết" sai, không có gì mới) — null khi tạo được. */
    private String lyDoKhongTheTao;
    /**
     * Dấu vết nội dung lô lúc kiểm tra (chứng từ, tiền, số dòng). Gửi lại khi tạo lô: dữ liệu đổi giữa lúc xem và lúc
     * bấm tạo thì máy chủ từ chối, để lô tạo ra đúng như người dùng đã xem.
     */
    private String dauVet;
    /** Biến động kho từ sau lô trước không có chứng từ kế toán tương ứng (kiểm kê, xuất khác…): kế toán lập tay. */
    private List<VanDe> bienDongKho;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TongHopLoai {
        private String loai;
        private String ten;
        private int soChungTu;
        private int soDong;
        private BigDecimal truocThue;
        private BigDecimal thue;
        /** Thuế của phiếu mua chưa có hóa đơn, kế toán ghi khi Nhận hóa đơn trên AMIS. */
        private BigDecimal thueChoHoaDon;
        private BigDecimal tongCong;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class VanDe {
        private String loai;
        private Integer idNguon;
        private String soChungTu;
        private String noiDung;
    }

    /**
     * Doanh thu (tổng tiền khách trả của đơn trạng thái 3, 5) từ ngày mốc đến ngày chốt theo Báo cáo doanh thu, so với
     * phần đã giao kế toán ở các lô trước + phần trong lô này + phần bị chặn. chenhLech khác 0 khi có đơn đã xuất rồi
     * bị hoàn trả (báo cáo bỏ đơn đó, kế toán vẫn có), xem phatSinhSauXuat.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DoiChieu {
        private BigDecimal doanhThuBaoCao;
        private BigDecimal doanhThuLoTruoc;
        private BigDecimal doanhThuTrongLo;
        private BigDecimal doanhThuBiChan;
        private BigDecimal chenhLech;
    }
}
