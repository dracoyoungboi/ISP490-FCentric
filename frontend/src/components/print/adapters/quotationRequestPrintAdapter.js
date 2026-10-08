import { formatNumber } from "@/utils/formatters";
import { formatPrintDate, formatPrintDateTime } from "./printFormat";

/**
 * Adapter cho YÊU CẦU BÁO GIÁ — dữ liệu từ API
 * `GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}` (cùng endpoint với
 * yêu cầu nhập hàng; nhà cung cấp được mời nằm trong `donMuaHangs`).
 */

// Trạng thái yêu cầu (entity YeuCauMuaHang: 0 Nháp, 1 Đã gửi, 2 Đã duyệt,
// 3 Đã tạo đơn yêu cầu báo giá, 4 Từ chối, 5 Đã vận chuyển)
export const QUOTATION_REQUEST_STATUS = {
    0: { label: "Nháp", tone: "neutral" },
    1: { label: "Đã gửi", tone: "info" },
    2: { label: "Đã duyệt", tone: "success" },
    3: { label: "Đã gửi yêu cầu báo giá", tone: "info" },
    4: { label: "Từ chối", tone: "danger" },
    5: { label: "Đã chuyển thành đơn mua hàng", tone: "success" },
};

// Trạng thái đơn báo giá gửi từng nhà cung cấp (donMuaHangs)
export const SUPPLIER_QUOTE_STATUS = {
    0: { label: "Đã xoá", tone: "danger" },
    1: { label: "Đã gửi YC báo giá", tone: "neutral" },
    2: { label: "Đã nhận báo giá", tone: "info" },
    3: { label: "Đã chuyển thành đơn mua hàng", tone: "warning" },
    4: { label: "Từ chối báo giá", tone: "danger" },
    5: { label: "Đã thanh toán", tone: "success" },
};

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

    const suppliers = (data.donMuaHangs || []).map((po) => {
        const status = SUPPLIER_QUOTE_STATUS[po.trangThai] || SUPPLIER_QUOTE_STATUS[1];
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

    const status = QUOTATION_REQUEST_STATUS[data.trangThai] || QUOTATION_REQUEST_STATUS[0];

    return {
        documentNumber: dash(data.soYeuCauMuaHang || `#${data.id}`),
        createdAt: dashDateTime(data.ngayTao),
        deadline: dashDate(data.ngayGiaoDuKien),
        status: { label: status.label, tone: status.tone },
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
