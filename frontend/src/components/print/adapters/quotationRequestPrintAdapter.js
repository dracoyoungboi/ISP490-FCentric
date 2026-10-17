import { formatNumber } from "@/utils/formatters";
import { BAO_GIA_NCC_STATUS } from "@/constants/donMuaHang";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import { formatPrintDate, formatPrintDateTime } from "./printFormat";

/**
 * Adapter cho YÊU CẦU BÁO GIÁ — dữ liệu từ API
 * `GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}` (cùng endpoint với
 * yêu cầu nhập hàng; nhà cung cấp được mời nằm trong `donMuaHangs`).
 */

// Tên trạng thái dùng chung với màn hình: yêu cầu lấy từ constants/yeuCauNhapHang,
// báo giá từng nhà cung cấp (donMuaHangs) lấy từ BAO_GIA_NCC_STATUS ở constants/donMuaHang.

const dash = (value) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text === "" ? "—" : text;
};

const dashDate = (value) => (value ? formatPrintDate(value) : "—");
const dashDateTime = (value) => (value ? formatPrintDateTime(value) : "—");
const dashQuantity = (value) =>
    value === null || value === undefined ? "—" : formatNumber(value);

export function toQuotationRequestPrintModel(raw) {
    const data = raw || {};

    // Bỏ nhà cung cấp đã bị xoá khỏi yêu cầu (trạng thái 0) — bản in chỉ
    // liệt kê các nhà cung cấp còn được mời báo giá
    const suppliers = (data.donMuaHangs || [])
        .filter((po) => po?.trangThai !== 0)
        .map((po) => {
            const status = BAO_GIA_NCC_STATUS[po.trangThai] || BAO_GIA_NCC_STATUS[1];
            return {
                name: dash(po.nhaCungCap?.tenNhaCungCap),
                email: dash(po.nhaCungCap?.email),
                phone: dash(po.nhaCungCap?.soDienThoai),
                sentStatus: status.label,
            };
        });

    const products = (data.chiTietYeuCauMuaHangs || []).map((item) => {
        const variant = item?.bienTheSanPham || {};
        return {
            name: dash(variant.tenSanPham || variant.maSku),
            sku: dash(variant.maSku),
            color: dash(variant.mauSac?.tenMau),
            size: dash(variant.size?.maSize),
            material: dash(variant.chatLieu?.tenChatLieu),
            quantity: dashQuantity(item?.soLuongDat),
        };
    });

    const totalQuantity = (data.chiTietYeuCauMuaHangs || []).reduce(
        (sum, item) => sum + (Number(item?.soLuongDat) || 0),
        0
    );

    const status = getYeuCauNhapHangStatus(data.trangThai);

    return {
        documentNumber: dash(data.soYeuCauMuaHang || `#${data.id}`),
        createdAt: dashDateTime(data.ngayTao),
        // Ngày giao dự kiến của yêu cầu (ngayGiaoDuKien) — KHÔNG phải hạn
        // nhà cung cấp phải gửi báo giá
        expectedDate: dashDate(data.ngayGiaoDuKien),
        status: { label: status.label },
        warehouse: {
            name: dash(data.khoNhap?.tenKho),
            manager: dash(data.khoNhap?.quanLy?.hoTen),
            address: dash(data.khoNhap?.diaChi),
        },
        suppliers,
        products,
        totalQuantity: formatNumber(totalQuantity),
        notes: dash(data.ghiChu),
        signatures: {
            creator: data.nguoiTao
                ? { name: dash(data.nguoiTao.hoTen), email: dash(data.nguoiTao.email) }
                : null,
            approver: data.nguoiDuyet
                ? { name: dash(data.nguoiDuyet.hoTen), email: dash(data.nguoiDuyet.email) }
                : null,
        },
    };
}
