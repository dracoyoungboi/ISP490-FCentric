import { formatDate, formatNumber } from "@/utils/formatters";

/**
 * Adapter cho PHIẾU NHẬP KHO — dữ liệu từ API
 * `GET /api/v1/phieu-nhap-kho/{id}/detail` (ChiTietPhieuNhapKhoDto — KHÔNG có
 * envelope) + danh sách lô từ `GET /api/v1/phieu-nhap-kho/{id}/bien-the/{variantId}/lo-hang`.
 *
 * Mỗi lô khai báo mở rộng thành một dòng in riêng; chưa khai báo lô thì in
 * lô/ngày sản xuất là "—" và số lượng dự kiến.
 */
export const GOODS_RECEIPT_STATUS = {
    0: { label: "Đang xử lý", tone: "warning" },
    1: { label: "Đang xử lý", tone: "warning" },
    2: { label: "Chờ nhận hàng", tone: "info" },
    3: { label: "Đã nhập kho", tone: "success" },
    4: { label: "Đã huỷ", tone: "danger" },
};

const dash = (value) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text === "" ? "—" : text;
};

const dashDate = (value) => (value ? formatDate(value) : "—");
const dashQuantity = (value) =>
    value === null || value === undefined ? "—" : formatNumber(value);

/** Số gốc (chưa định dạng) để tính tổng — null khi thiếu, KHÔNG nhầm với 0. */
const toNumeric = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

/**
 * @param {{detail: object, lotsByVariantId?: Record<number, Array>}} payload
 */
export function toGoodsReceiptPrintModel(payload) {
    const data = payload?.detail || {};
    const lotsByVariantId = payload?.lotsByVariantId || {};

    const isTransfer = Boolean(data.phieuXuatGocId);
    const partner = isTransfer
        ? dash(data.tenKhoChuyenTu)
        : dash(data.tenNhaCungCap);

    const items = (data.items || []).flatMap((item) => {
        const base = {
            name: dash(item.tenBienThe),
            sku: dash(item.sku),
            // SL yêu cầu = số lượng cần nhập theo phiếu; SL nhận = thực tế đã
            // khai báo (theo lô hoặc soLuongDaKhaiBao) — hai giá trị riêng.
            requestedQuantity: dashQuantity(item.soLuongCanNhap),
        };
        const makeRow = (rawQuantity, lot, productionDate) => ({
            ...base,
            lot,
            productionDate,
            quantity: dashQuantity(rawQuantity),
            // Giữ SỐ GỐC để tính tổng chính xác — KHÔNG được tính tổng từ
            // chuỗi đã định dạng ("1,5" parse thành 1, lỗi 1.5 + 2.5 = 3).
            _rawQuantity: toNumeric(rawQuantity),
        });
        const lots = lotsByVariantId[item.bienTheSanPhamId] || [];
        if (lots.length > 0) {
            return lots.map((lot) =>
                makeRow(lot.soLuongNhap, dash(lot.maLo), dashDate(lot.ngaySanXuat))
            );
        }
        return [
            makeRow(item.soLuongDaKhaiBao ?? item.soLuongCanNhap, "—", "—"),
        ];
    });

    // Tổng từ GIÁ TRỊ SỐ GỐC; thiếu dữ liệu (null) không cộng nhưng hiển thị
    // "—" ở từng dòng — phân biệt được với số 0 hợp lệ.
    const totalQuantity = items.reduce((sum, row) => sum + (row._rawQuantity ?? 0), 0);

    const status = GOODS_RECEIPT_STATUS[data.trangThai] || GOODS_RECEIPT_STATUS[0];

    return {
        documentNumber: dash(data.soPhieuNhap || `#${data.id}`),
        receivedDate: dashDate(data.ngayNhap),
        partner,
        status: { label: status.label, tone: status.tone },
        warehouse: { name: dash(data.tenKho) },
        items,
        totalQuantity: formatNumber(totalQuantity),
        signatures: {
            receiver: { name: dash(data.tenNguoiNhap), email: "" },
            deliverer: { name: partner, email: "" },
        },
    };
}
