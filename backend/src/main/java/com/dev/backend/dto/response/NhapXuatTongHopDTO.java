package com.dev.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Báo cáo nhập xuất của một kỳ (màn /reports/stock-movements và tệp Excel): Tồn đầu kỳ + Nhập − Xuất = Tồn cuối kỳ.
 * Số lượng, giá trị theo giá vốn; không tính Kho Trung Chuyển.
 *
 * @param loai          ngay | tuan | thang | nam
 * @param denNgay       ngày cuối đã qua của kỳ (kỳ đang chạy cắt tới hôm nay)
 * @param nhom          nhóm đang lọc (null: không lọc). Khi lọc, nhập / xuất của theoKy, theoKho, theoSanPham chỉ còn
 *                      nhóm đó; tồn đầu, tồn cuối và dải tổng (dauKy, nhap, xuat, cuoiKy, theoLoai) vẫn đủ mọi nhóm
 * @param theoKhoPhuTrach không chọn kho và người xem không phải quản trị viên: chỉ tính các kho mình phụ trách
 * @param cungKy        nhập, xuất cùng kỳ năm trước; null khi xem theo năm
 */
public record NhapXuatTongHopDTO(String loai, LocalDate tuNgay, LocalDate denNgay, String nhom, boolean theoKhoPhuTrach,
                                 So dauKy, PhatSinh nhap, PhatSinh xuat, So cuoiKy,
                                 CungKy cungKy, LocalDate tuNgayCungKy, LocalDate denNgayCungKy,
                                 List<Loai> theoLoai, List<Ky> theoKy, List<Dong> theoKho, List<Dong> theoSanPham) {

    public record So(BigDecimal soLuong, BigDecimal giaTri) {
    }

    public record PhatSinh(BigDecimal soLuong, BigDecimal giaTri, long soPhieu) {
    }

    public record CungKy(BigDecimal nhap, BigDecimal xuat) {
    }

    /** Một nhóm nhập (chieu = "nhap") hoặc xuất (chieu = "xuat"): mua hàng, nhận chuyển kho, bán tại quầy... */
    public record Loai(String ma, String chieu, String ten, BigDecimal soLuong, BigDecimal giaTri, long soPhieu) {
    }

    /** Một kỳ (ngày, tuần, tháng, năm). chuaToi: kỳ chưa tới, mọi số là 0. */
    public record Ky(String nhan, String nhanDay, LocalDate tuNgay, LocalDate denNgay, boolean chuaToi,
                     BigDecimal dauSl, BigDecimal dauGt, BigDecimal nhapSl, BigDecimal nhapGt,
                     BigDecimal xuatSl, BigDecimal xuatGt, BigDecimal cuoiSl, BigDecimal cuoiGt,
                     long phieuNhap, long phieuXuat) {
    }

    /** Một dòng theo kho (id = kho) hoặc theo sản phẩm (id = sản phẩm, kèm mã, danh mục, ảnh, số mã SKU). */
    public record Dong(int id, String ten, String ma, String danhMuc, String anh, Integer soSku,
                       BigDecimal dauSl, BigDecimal dauGt, BigDecimal nhapSl, BigDecimal nhapGt,
                       BigDecimal xuatSl, BigDecimal xuatGt, BigDecimal cuoiSl, BigDecimal cuoiGt) {
    }
}
