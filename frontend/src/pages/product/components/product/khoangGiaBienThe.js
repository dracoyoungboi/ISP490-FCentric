/**
 * Giá hiển thị của một sản phẩm tính theo các biến thể ĐANG BÁN (danh sách + trang chi tiết sản phẩm).
 *
 * Không dùng `giaBanMacDinh` / `giaVonMacDinh` của sản phẩm: backend chỉ tính hai trường này trên biến thể
 * còn hàng, nên sản phẩm hết hàng ra 0 dù biến thể vẫn có giá.
 */
import { formatCurrency } from "@/utils/formatters";

/** Mã trạng thái "đang bán" của biến thể (bien_the_san_pham.trang_thai). */
const TRANG_THAI_BIEN_THE_DANG_BAN = 1;

/**
 * Giá thấp nhất / cao nhất của các biến thể đang bán có giá > 0.
 * `truong`: "giaBan" hoặc "giaVon". Không có biến thể nào thỏa → null.
 */
export function khoangGiaBienThe(bienThes, truong = "giaBan") {
    const danhSachGia = (bienThes ?? [])
        .filter((bienThe) => Number(bienThe?.trangThai) === TRANG_THAI_BIEN_THE_DANG_BAN)
        .map((bienThe) => Number(bienThe?.[truong]))
        .filter((gia) => Number.isFinite(gia) && gia > 0);
    if (danhSachGia.length === 0) return null;
    return { thapNhat: Math.min(...danhSachGia), caoNhat: Math.max(...danhSachGia) };
}

/** Một giá: "980.000 ₫"; khác giá: "450.000 ₫ – 980.000 ₫"; không có giá: null (nơi gọi tự hiện "—"). */
export function dinhDangKhoangGia(bienThes, truong = "giaBan") {
    const khoang = khoangGiaBienThe(bienThes, truong);
    if (!khoang) return null;
    if (khoang.thapNhat === khoang.caoNhat) return formatCurrency(khoang.thapNhat);
    return `${formatCurrency(khoang.thapNhat)} – ${formatCurrency(khoang.caoNhat)}`;
}
