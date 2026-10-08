import { formatNumber } from "@/utils/formatters";
import { formatPrintDate, formatPrintDateTime } from "./printFormat";

/**
 * Trạng thái yêu cầu nhập hàng — khớp với bản đồ trạng thái
 * đang dùng ở PurchaseRequestList / PurchaseRequestDetail.
 * `tone` khớp với tone của StatusBadge.
 */
export const PURCHASE_REQUEST_STATUS = {
    1: { label: "Chờ duyệt", tone: "warning" },
    2: { label: "Đã duyệt", tone: "success" },
    3: { label: "Đã chuyển thành báo giá", tone: "info" },
    4: { label: "Từ chối", tone: "danger" },
    5: { label: "Đã chuyển thành báo giá", tone: "info" },
};

// Chuẩn hoá giá trị rỗng về "—" để layout bản in không bị vỡ
const dash = (value) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text === "" ? "—" : text;
};

const dashDate = (value) => (value ? formatPrintDate(value) : "—");
const dashDateTime = (value) => (value ? formatPrintDateTime(value) : "—");

/** "Họ tên — email" hoặc chỉ họ tên, "—" khi thiếu. */
const personLine = (person) => {
    if (!person) return "—";
    const name = dash(person.hoTen);
    const email = person.email ? dash(person.email) : null;
    return email && email !== "—" ? `${name} — ${email}` : name;
};

/**
 * Chuyển response thô của API `GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}`
 * thành view model theo contract chung của schema purchase_request.
 */
export function toPurchaseRequestPrintModel(raw) {
    const data = raw || {};

    const details = data.chiTietYeuCauMuaHangs || [];

    const items = details.map((item) => {
        const variant = item?.bienTheSanPham || {};
        return {
            name: dash(variant.tenSanPham || variant.maSku),
            sku: dash(variant.maSku),
            color: dash(variant.mauSac?.tenMau),
            size: dash(variant.size?.maSize),
            material: dash(variant.chatLieu?.tenChatLieu),
            quantity:
                item?.soLuongDat === null || item?.soLuongDat === undefined
                    ? "—"
                    : formatNumber(item.soLuongDat),
        };
    });

    const totalQuantity = details.reduce(
        (sum, item) => sum + (Number(item?.soLuongDat) || 0),
        0
    );

    const status = PURCHASE_REQUEST_STATUS[data.trangThai] || PURCHASE_REQUEST_STATUS[1];

    return {
        documentNumber: dash(data.soYeuCauMuaHang || `#${data.id}`),
        createdAt: dashDateTime(data.ngayTao),
        expectedDate: dashDate(data.ngayGiaoDuKien),
        status: { label: status.label, tone: status.tone },
        warehouse: {
            name: dash(data.khoNhap?.tenKho),
            code: dash(data.khoNhap?.maKho),
            manager: dash(data.khoNhap?.quanLy?.hoTen),
            address: dash(data.khoNhap?.diaChi),
        },
        users: {
            creator: personLine(data.nguoiTao),
            approver: data.nguoiDuyet ? personLine(data.nguoiDuyet) : "—",
        },
        notes: dash(data.ghiChu),
        items,
        totalQuantity: formatNumber(totalQuantity),
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
