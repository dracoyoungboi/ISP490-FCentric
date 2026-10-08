import { formatNumber } from "@/utils/formatters";
import { formatPrintDate } from "./printFormat";

/**
 * Adapter cho PHIẾU XUẤT KHO — dữ liệu từ API
 * `GET /api/v1/phieu-xuat-kho/{id}` ({phieu, chiTiet} — không có envelope),
 * lô đã pick từ `GET /api/v1/phieu-xuat-kho/{id}/picked-lots/{chiTietId}` và
 * tên lô từ `GET /api/v1/phieu-xuat-kho/{id}/available-lots?bienTheSanPhamId=`.
 */
export const GOODS_ISSUE_STATUS = {
    0: { label: "Nháp", tone: "warning" },
    1: { label: "Chờ duyệt", tone: "info" },
    2: { label: "Đã duyệt", tone: "info" },
    3: { label: "Đã xuất", tone: "success" },
    4: { label: "Đã huỷ", tone: "danger" },
    5: { label: "Đã xuất", tone: "success" },
};

// Loại xuất theo giá trị backend: "ban_hang" = xuất bán, "chuyen_kho" = xuất
// chuyển kho nội bộ, "khac" = phiếu yêu cầu chuyển kho (chưa có phiếu xuất)
export const GOODS_ISSUE_TYPE = {
    ban_hang: "Xuất bán hàng",
    chuyen_kho: "Chuyển kho nội bộ",
    khac: "Yêu cầu chuyển kho",
};

const dash = (value) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text === "" ? "—" : text;
};

const dashDate = (value) => (value ? formatPrintDate(value) : "—");
const dashQuantity = (value) =>
    value === null || value === undefined ? "—" : formatNumber(value);

/** Số gốc (chưa định dạng) để tính tổng — null khi thiếu, KHÔNG nhầm với 0. */
const toNumeric = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

/**
 * @param {{phieu: object, chiTiet: Array, lotNameByLotId?: Record<number, string>,
 *          pickedLotsByDetailId?: Record<number, Array>}} payload
 */
export function toGoodsIssuePrintModel(payload) {
    const phieu = payload?.phieu || {};
    const chiTiet = payload?.chiTiet || [];
    const lotNameByLotId = payload?.lotNameByLotId || {};
    const pickedLotsByDetailId = payload?.pickedLotsByDetailId || {};

    const items = chiTiet.flatMap((item) => {
        const base = {
            name: dash(item.tenBienThe),
            sku: dash(item.sku),
            // SL yêu cầu = số lượng cần xuất theo phiếu; SL xuất = thực tế đã
            // pick (theo lô hoặc soLuongDaPick) — hai giá trị riêng.
            requestedQuantity: dashQuantity(item.soLuongCanXuat),
        };
        const makeRow = (rawQuantity, lot) => ({
            ...base,
            lot,
            quantity: dashQuantity(rawQuantity),
            // Giữ SỐ GỐC để tính tổng chính xác — KHÔNG được tính tổng từ
            // chuỗi đã định dạng ("1,5" parse thành 1, lỗi 1.5 + 2.5 = 3).
            _rawQuantity: toNumeric(rawQuantity),
        });
        const picks = pickedLotsByDetailId[item.id] || [];
        if (picks.length > 0) {
            return picks.map((pick) =>
                makeRow(pick.soLuongDaPick, dash(lotNameByLotId[pick.loHangId] ?? `#${pick.loHangId}`))
            );
        }
        return [makeRow(item.soLuongDaPick ?? item.soLuongCanXuat, "—")];
    });

    // Tổng từ GIÁ TRỊ SỐ GỐC; thiếu dữ liệu (null) không cộng nhưng hiển thị
    // "—" ở từng dòng — phân biệt được với số 0 hợp lệ.
    const totalQuantity = items.reduce((sum, row) => sum + (row._rawQuantity ?? 0), 0);

    const status = GOODS_ISSUE_STATUS[phieu.trangThai] || GOODS_ISSUE_STATUS[0];

    const isSale = phieu.loaiXuat === "ban_hang";
    const isTransfer = phieu.loaiXuat === "chuyen_kho" || phieu.loaiXuat === "khac";

    return {
        documentNumber: dash(phieu.soPhieuXuat || `#${phieu.id}`),
        issuedDate: dashDate(phieu.ngayXuat),
        issueType: dash(GOODS_ISSUE_TYPE[phieu.loaiXuat] ?? phieu.loaiXuat),
        // null = không áp dụng (ẩn trên bản in): đơn bán chỉ có ở phiếu xuất
        // bán; kho chuyển đến chỉ có ở phiếu chuyển kho. Dữ liệu cũ thiếu
        // loaiXuat nhưng có đơn bán vẫn in mã đơn.
        salesOrder:
            isSale || (!isTransfer && phieu.donBanHang)
                ? dash(phieu.donBanHang?.soDonHang)
                : null,
        status: { label: status.label, tone: status.tone },
        warehouse: {
            name: dash(phieu.kho?.tenKho),
            code: dash(phieu.kho?.maKho),
            destination: isTransfer ? dash(phieu.khoChuyenDen?.tenKho) : null,
        },
        items,
        totalQuantity: formatNumber(totalQuantity),
        notes: dash(phieu.ghiChu),
        signatures: {
            issuer: { name: dash(phieu.nguoiXuat?.hoTen), email: dash(phieu.nguoiXuat?.email) },
            // Người nhận (khách / shipper / thủ kho nhận) ký tay và ghi rõ họ tên
            receiver: { name: "", email: "" },
        },
    };
}
