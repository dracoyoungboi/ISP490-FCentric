import { getGoodsReceiptStatus, getGoodsReceiptTypeLabel } from "@/constants/goodsReceipt";
import {
    dash,
    formatPrintDate,
    formatPrintLongDate,
    formatPrintNumber,
    textOrNull,
    toNumeric,
} from "./printFormat";

/**
 * Adapter cho PHIẾU NHẬP KHO — dữ liệu từ API
 * `GET /api/v1/phieu-nhap-kho/{id}/detail` (ChiTietPhieuNhapKhoDto — KHÔNG có
 * envelope) + danh sách lô từ `GET /api/v1/phieu-nhap-kho/{id}/bien-the/{variantId}/lo-hang`.
 *
 * MỖI DÒNG HÀNG MỘT DÒNG IN, các lô liệt kê trong ô "Lô" của dòng đó:
 * trước đây mỗi lô thành một dòng riêng và lặp lại "SL theo chứng từ" — 50
 * cái chia 2 lô in thành 50 + 50, đọc như yêu cầu 100.
 *
 * "Thực nhập" chỉ lấy số ĐÃ khai báo (tổng lô hoặc soLuongDaKhaiBao). Chưa
 * khai báo thì để TRỐNG cho thủ kho ghi tay — không lấy số kế hoạch điền vào
 * như thể đã nhận đủ.
 *
 * DTO chưa có đơn giá / thành tiền và ghi chú nên phiếu chưa in phần giá trị.
 * Trạng thái + loại nhập dùng CHUNG với danh sách/chi tiết phiếu nhập.
 */
const STATUS_DA_NHAP = 3;
const STATUS_DA_HUY = 4;

const sumOrNull = (values) => {
    const known = values.filter((value) => value !== null);
    return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
};

/** Số in trong ô: null -> "" (ô trống để ghi tay). */
const qtyCell = (value) => (value === null ? "" : formatPrintNumber(value));

/**
 * @param {{detail: object, lotsByVariantId?: Record<number, Array>}} payload
 */
export function toGoodsReceiptPrintModel(payload) {
    const data = payload?.detail || {};
    const lotsByVariantId = payload?.lotsByVariantId || {};
    const confirmed = data.trangThai === STATUS_DA_NHAP;

    const isTransfer = Boolean(data.phieuXuatGocId);

    const rows = (data.items || []).map((item) => {
        const lots = lotsByVariantId[item.bienTheSanPhamId] || [];
        const declared = toNumeric(item.soLuongDaKhaiBao);
        const actual =
            lots.length > 0
                ? sumOrNull(lots.map((lot) => toNumeric(lot.soLuongNhap)))
                : declared !== null && (declared > 0 || confirmed)
                  ? declared
                  : null;
        const defect =
            lots.length > 0
                ? sumOrNull(lots.map((lot) => toNumeric(lot.soLuongLoi)))
                : toNumeric(item.soLuongLoiQc);
        const requested = toNumeric(item.soLuongCanNhap);
        return {
            name: dash(item.tenBienThe),
            sku: dash(item.sku),
            lots: lots.map((lot) => ({
                code: dash(lot.maLo),
                note: lot.ngaySanXuat ? `SX ${formatPrintDate(lot.ngaySanXuat)}` : null,
                quantity: formatPrintNumber(lot.soLuongNhap),
            })),
            requestedQuantity: requested === null ? "—" : formatPrintNumber(requested),
            quantity: qtyCell(actual),
            // 0 lỗi in trống cho gọn; cột tự ẩn khi cả phiếu không có hàng lỗi
            defectQuantity: defect ? formatPrintNumber(defect) : "",
            _actual: actual,
            _requested: requested,
            _defect: defect,
        };
    });

    // Còn dòng chưa có số thực tế (để trống ghi tay) thì tổng cũng để trống —
    // in tổng của riêng các dòng đã có số sẽ bị đọc nhầm là tổng cả phiếu
    const totalActual = rows.some((row) => row._actual === null)
        ? null
        : sumOrNull(rows.map((row) => row._actual));
    const totalDefect = sumOrNull(rows.map((row) => row._defect));
    const status = getGoodsReceiptStatus(data.trangThai);

    return {
        documentNumber: dash(data.soPhieuNhap || `#${data.id}`),
        documentDate: formatPrintLongDate(data.ngayNhap),
        watermark: data.trangThai === STATUS_DA_HUY ? "ĐÃ HỦY" : null,
        receiptType: getGoodsReceiptTypeLabel(data),
        // Chỉ phiếu nhập từ đơn mua mới có mã đơn — phiếu khác ẩn trường này
        purchaseOrder: textOrNull(data.soDonMua),
        partner: isTransfer ? textOrNull(data.tenKhoChuyenTu) : textOrNull(data.tenNhaCungCap),
        partnerLabel: isTransfer ? "Kho chuyển đi" : "Nhà cung cấp",
        status: { label: status.label },
        warehouse: { name: dash(data.tenKho) },
        items: rows,
        totalRequested: formatPrintNumber(sumOrNull(rows.map((row) => row._requested)) ?? 0),
        totalQuantity: totalActual === null ? "" : formatPrintNumber(totalActual),
        totalDefect: totalDefect ? formatPrintNumber(totalDefect) : "",
        signatures: {
            // Người giao là NGƯỜI (tài xế / nhân viên NCC / thủ kho chuyển),
            // không phải tên công ty — để ô trống ký và ghi rõ họ tên khi giao.
            deliverer: { name: "" },
            receiver: { name: textOrNull(data.tenNguoiNhap) ?? "" },
            approver: { name: textOrNull(data.tenNguoiDuyet) ?? "" },
            accountant: { name: "" },
        },
    };
}
