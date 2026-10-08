import { formatNumber } from "@/utils/formatters";
import { formatPrintDate } from "./printFormat";

/**
 * Adapter cho BÁO GIÁ BÁN và HÓA ĐƠN BÁN HÀNG — cùng một thực thể backend
 * `don_ban_hang` (phân biệt bằng `loaiChungTu`), dữ liệu từ API
 * `GET /api/v1/don-ban-hang/{id}/detail` (DonBanHangDetailResponse).
 *
 * Lưu ý: API không có chiết khấu, thuế, số tiền đã trả/còn nợ hay hạn
 * hiệu lực — chỉ in những gì API thật sự trả về.
 */
export const SALES_QUOTATION_STATUS = {
    0: { label: "Đang chờ phản hồi", tone: "warning" },
    2: { label: "Đã chốt đơn", tone: "success" },
    4: { label: "Bị từ chối", tone: "danger" },
};

export const SALES_ORDER_STATUS = {
    0: { label: "Nháp", tone: "warning" },
    1: { label: "Chờ xuất kho", tone: "info" },
    2: { label: "Đã xuất kho 1 phần", tone: "info" },
    3: { label: "Đã xuất kho", tone: "warning" },
    4: { label: "Đã hủy", tone: "danger" },
    5: { label: "Hoàn thành", tone: "success" },
    6: { label: "Bị hoàn trả", tone: "danger" },
};

export const PAYMENT_STATUS = {
    chua_thanh_toan: { label: "Chưa thanh toán", tone: "warning" },
    da_thanh_toan: { label: "Đã thanh toán", tone: "success" },
};

const dash = (value) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text === "" ? "—" : text;
};

const dashDate = (value) => (value ? formatPrintDate(value) : "—");
const dashQuantity = (value) =>
    value === null || value === undefined ? "—" : formatNumber(value);
const dashMoney = (value) =>
    value === null || value === undefined
        ? "—"
        : `${formatNumber(value)} đ`;

/** Phần chung của cả hai loại chứng từ bán hàng. */
function toDonBanHangPrintModel(raw, { statusMap }) {
    const don = raw?.donBanHang || {};
    const kh = don.khachHang || {};
    const seller = don.nguoiTao || {};

    const items = (raw?.chiTiet || []).map((item) => ({
        name: dash(item.tenSanPham),
        sku: dash(item.sku),
        unitPrice: dashMoney(item.donGia),
        quantity: dashQuantity(item.soLuongDat),
        amount: dashMoney(item.thanhTien),
    }));

    const status = statusMap[don.trangThai] || statusMap[0];

    return {
        documentNumber: dash(don.soDonHang || `#${don.id}`),
        issuedDate: dashDate(don.ngayDatHang),
        status: { label: status.label, tone: status.tone },
        // "Người lập" = nhân viên tạo chứng từ (nguoiTao) — phân biệt với
        // "Đơn vị bán" là hồ sơ công ty dùng chung (schema đọc company.*).
        creator: {
            name: dash(seller.hoTen),
            email: dash(seller.email),
            phone: dash(seller.soDienThoai),
        },
        buyer: {
            name: dash(kh.tenKhachHang),
            code: dash(kh.maKhachHang),
            contact: dash(kh.nguoiLienHe),
            phone: dash(kh.soDienThoai),
            address: dash(kh.diaChi),
        },
        items,
        totals: {
            items: dashMoney(don.tienHang),
            shipping: dashMoney(don.phiVanChuyen),
            grandTotal: dashMoney(don.tongCong),
        },
        notes: dash(don.ghiChu),
        signatures: {
            creator: { name: dash(seller.hoTen), email: dash(seller.email) },
            buyer: { name: dash(kh.tenKhachHang), email: dash(kh.email) },
        },
    };
}

export function toSalesQuotationPrintModel(raw) {
    const model = toDonBanHangPrintModel(raw, { statusMap: SALES_QUOTATION_STATUS });
    return {
        ...model,
        createdAt: model.issuedDate,
    };
}

export function toSalesInvoicePrintModel(raw) {
    const model = toDonBanHangPrintModel(raw, { statusMap: SALES_ORDER_STATUS });
    const don = raw?.donBanHang || {};
    const payment = PAYMENT_STATUS[don.trangThaiThanhToan] || {
        label: dash(don.trangThaiThanhToan),
        tone: "neutral",
    };
    return {
        ...model,
        paymentStatus: { label: payment.label, tone: payment.tone },
    };
}
