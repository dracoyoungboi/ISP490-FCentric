import { formatNumber } from "@/utils/formatters";
import { formatPrintDate, formatPrintDateTime } from "./printFormat";

/**
 * Adapter cho ĐƠN MUA HÀNG — dữ liệu từ API
 * `GET /api/v1/don-mua-hang/get-by-id/{id}` (DonMuaHangDto).
 *
 * Lưu ý: DTO không trả về nguồn yêu cầu nhập hàng, phí vận chuyển,
 * phương thức/điều khoản thanh toán hay thuế — chỉ in những gì API có.
 */
export const PURCHASE_ORDER_STATUS = {
    0: { label: "Đã xoá", tone: "danger" },
    1: { label: "Đã gửi", tone: "info" },
    2: { label: "Đã báo giá", tone: "info" },
    3: { label: "Đang vận chuyển", tone: "warning" },
    4: { label: "Không chấp nhận báo giá", tone: "danger" },
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
const dashMoney = (value) =>
    value === null || value === undefined
        ? "—"
        : `${formatNumber(value)} đ`;

export function toPurchaseOrderPrintModel(raw) {
    const data = raw || {};

    const items = (data.chiTietDonMuaHangs || []).map((item) => {
        const variant = item?.bienTheSanPham || {};
        return {
            name: dash(variant.tenSanPham || variant.maSku),
            sku: dash(variant.maSku),
            unitPrice: dashMoney(item?.donGia),
            quantity: dashQuantity(item?.soLuongDat),
            amount: dashMoney(item?.thanhTien),
        };
    });

    const status = PURCHASE_ORDER_STATUS[data.trangThai] || PURCHASE_ORDER_STATUS[1];
    const total = dashMoney(data.tongTien);

    return {
        documentNumber: dash(data.soDonMua || `#${data.id}`),
        orderDate: dashDateTime(data.ngayDatHang),
        expectedDate: dashDate(data.ngayGiaoDuKien),
        status: { label: status.label, tone: status.tone },
        supplier: {
            name: dash(data.nhaCungCap?.tenNhaCungCap),
            code: dash(data.nhaCungCap?.maNhaCungCap),
            contact: dash(data.nhaCungCap?.nguoiLienHe),
            phone: dash(data.nhaCungCap?.soDienThoai),
            email: dash(data.nhaCungCap?.email),
            address: dash(data.nhaCungCap?.diaChi),
        },
        // Kho nhận hàng — nhà cung cấp cần biết giao đến đâu
        deliverTo: {
            name: dash(data.khoNhap?.tenKho),
            code: dash(data.khoNhap?.maKho),
            address: dash(data.khoNhap?.diaChi),
        },
        items,
        totalAmount: total,
        totals: { total },
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
