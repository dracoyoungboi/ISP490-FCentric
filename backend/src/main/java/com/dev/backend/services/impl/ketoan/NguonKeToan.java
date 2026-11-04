package com.dev.backend.services.impl.ketoan;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Dữ liệu nguồn đọc từ CSDL để dựng chứng từ kế toán (KeToanNguonRepository). Chỉ là dữ liệu, không có quy tắc kế toán;
 * quy tắc nằm ở DungChungTuAmis.
 */
public final class NguonKeToan {

    private NguonKeToan() {
    }

    /**
     * Đơn bán đã ghi nhận doanh thu (trạng thái 3, 5). phuongThucPos: CASH / PAYOS / KET_HOP (tiền mặt + QR payOS) với
     * đơn tại quầy đã thu đủ, null với đơn khác. laShopify: đơn kéo từ Shopify (kênh SHOPIFY, có mã đơn kênh). soPhieuXuat: các phiếu xuất
     * đã xuất của đơn, theo thứ tự xuất. tienMatDaThu / nganHangDaThu: tiền thu theo phương thức của đơn tại quầy (để
     * báo kế toán cách tách đơn trả kết hợp). thueSuatHoaDon: thuế suất in trên hóa đơn bán hàng (mức chung chụp lúc chốt
     * đơn khi bật in thuế, chụp lại theo ngày giao khi xuất đủ hàng), null = hóa đơn không in thuế.
     */
    public record DonBan(int id, String soDon, Instant ngayGiaoHang, String maKhachHang, String tenKhachHang,
                         String diaChiKhachHang, String maSoThueKhachHang, String maKho, BigDecimal tienHang,
                         BigDecimal phiVanChuyen, BigDecimal tongCong, String phuongThucPos, boolean laShopify,
                         String maDonKenh, String tenKenh, String soPhieuXuat, BigDecimal tienMatDaThu,
                         BigDecimal nganHangDaThu, BigDecimal thueSuatHoaDon) {

        public DonBan(int id, String soDon, Instant ngayGiaoHang, String maKhachHang, String tenKhachHang,
                      String diaChiKhachHang, String maSoThueKhachHang, String maKho, BigDecimal tienHang,
                      BigDecimal phiVanChuyen, BigDecimal tongCong, String phuongThucPos, boolean laShopify,
                      String maDonKenh, String tenKenh, String soPhieuXuat) {
            this(id, soDon, ngayGiaoHang, maKhachHang, tenKhachHang, diaChiKhachHang, maSoThueKhachHang, maKho, tienHang,
                    phiVanChuyen, tongCong, phuongThucPos, laShopify, maDonKenh, tenKenh, soPhieuXuat, null, null, null);
        }
    }

    /** Dòng hàng của đơn bán. thanhTien = soLuong × donGia (gồm thuế, trước giảm giá); tienGiamGia gồm thuế. */
    public record DongBan(int donId, String maSku, String tenHang, String donViTinh, Integer danhMucId,
                          BigDecimal soLuong, BigDecimal donGia, BigDecimal thanhTien, BigDecimal tienGiamGia) {
    }

    /** Phiếu nhập mua hàng đã hoàn tất. coHoaDon null = chưa nhập hóa đơn nhà cung cấp. */
    public record PhieuMua(int id, String soPhieu, Instant ngayNhap, String soDonMua, String maNhaCungCap,
                           String tenNhaCungCap, String diaChiNhaCungCap, String maSoThueNhaCungCap, String maKho,
                           Boolean coHoaDon, String mauSo, String kyHieu, String soHoaDon, LocalDate ngayHoaDon,
                           BigDecimal thueSuat) {
    }

    /** Dòng nhập (cộng các lô cùng mã hàng, cùng đơn giá): số lượng đạt kiểm tra, đơn giá đơn mua (gồm thuế). */
    public record DongMua(int phieuId, String maSku, String tenHang, String donViTinh, Integer danhMucId,
                          BigDecimal soLuong, BigDecimal donGia) {
    }

    /**
     * Một bước chuyển kho. loai = chuyen_kho_xuat (phiếu xuất chuyển kho PX-CK: kho nguồn → kho Hàng đang chuyển) hoặc
     * chuyen_kho_nhan (phiếu nhập PN-TRF / PN-RET của phiếu chuyển: kho Hàng đang chuyển → kho nhận).
     * soLenh: số lệnh điều động LDD-…, phiếu cũ không có lệnh thì số phiếu chuyển PX-TRF-…; laHoanVe: phiếu PN-RET
     * nhập lại kho xuất khi hủy giữa đường.
     */
    public record PhieuChuyen(String loai, int id, String soChungTu, Instant ngay, String soLenh, Instant ngayLenh,
                              String maKhoXuat, String tenKhoXuat, String maKhoNhap, String tenKhoNhap,
                              boolean laHoanVe) {
    }

    /** Dòng chuyển kho (cộng các lô cùng mã hàng). */
    public record DongChuyen(String loai, int phieuId, String maSku, String tenHang, String donViTinh,
                             BigDecimal soLuong) {
    }

    /** Tồn một lô ở một kho tại đầu ngày mốc (tồn hiện tại trừ ngược mọi giao dịch từ ngày mốc). */
    public record TonLo(String maKho, String maSku, String donViTinh, int loHangId, BigDecimal soLuong,
                        BigDecimal giaVon) {
    }

    public record HangHoa(String maSku, String tenHang, String donViTinh, Integer danhMucId, BigDecimal giaBan) {
    }

    /** loai: le / si / doanh_nghiep (null với khách tạo từ Shopify). */
    public record KhachHangKt(String ma, String ten, String diaChi, String maSoThue, String soDienThoai, String email,
                              String nguoiLienHe, String loai) {
    }

    public record NhaCungCapKt(String ma, String ten, String diaChi, String maSoThue, String soDienThoai, String email,
                               String nguoiLienHe) {
    }

    public record KhoKt(String ma, String ten, String diaChi) {
    }

    /** Đơn đã giao kế toán (còn khóa) nhưng sau đó bị hoàn trả. */
    public record SauXuat(int donId, String soDon, String soLo) {
    }

    /**
     * Biến động kho không có chứng từ kế toán tương ứng, gộp theo chứng từ gốc và kho. nhom: kiem_ke / xuat_khac /
     * nhap_lai_ban_truoc_moc / nhap_hang_hoan / nhap_khac / ghi_giam_chuyen_kho / xuat_ban_khong_doanh_thu / khac. tang, giam: tổng số lượng tăng, giảm (đều không âm).
     * ghiChu: ghi chú phiếu nhập (phiếu hàng hoàn ghi phiếu xuất và đơn gốc), null với loại khác.
     */
    public record BienDongKho(String nhom, String loaiThamChieu, Integer idThamChieu, String soChungTu, String maKho,
                              int soDong, BigDecimal tang, BigDecimal giam, Instant ngay, String ghiChu) {
    }
}
