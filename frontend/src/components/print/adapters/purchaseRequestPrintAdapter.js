import { YEU_CAU_NHAP_HANG_STATUS } from "@/constants/yeuCauNhapHang";
import { trangThaiLa } from "@/constants/trangThaiChung";
import {
    dash,
    formatPrintDate,
    formatPrintLongDate,
    formatPrintNumber,
    textOrNull,
    toNumeric,
} from "./printFormat";

/**
 * Trạng thái yêu cầu nhập hàng — dùng chung hằng số với PurchaseRequestList / PurchaseRequestDetail.
 */
export const PURCHASE_REQUEST_STATUS = YEU_CAU_NHAP_HANG_STATUS;

/** Người ký: chỉ họ tên (email không in trên chứng từ giấy). */
const signer = (person, label = null) =>
    person ? { label, name: dash(person.hoTen) } : { label, name: "" };

/**
 * Chuyển response thô của API `GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}`
 * thành view model theo contract chung của schema purchase_request.
 *
 * Người lập / người duyệt chỉ in ở ô ký (không lặp lại thành mục riêng).
 */
export function toPurchaseRequestPrintModel(raw) {
    const data = raw || {};
    const details = data.chiTietYeuCauMuaHangs || [];

    const items = details.map((item) => {
        const variant = item?.bienTheSanPham || {};
        return {
            name: dash(variant.tenSanPham || variant.maSku),
            sku: dash(variant.maSku),
            color: textOrNull(variant.mauSac?.tenMau),
            size: textOrNull(variant.size?.maSize),
            material: textOrNull(variant.chatLieu?.tenChatLieu),
            quantity: formatPrintNumber(item?.soLuongDat),
        };
    });

    const totalQuantity = details.reduce((sum, item) => sum + (toNumeric(item?.soLuongDat) ?? 0), 0);

    const status = PURCHASE_REQUEST_STATUS[data.trangThai] || trangThaiLa(data.trangThai);

    // Phiếu bị từ chối: người xử lý (nguoiDuyet) là NGƯỜI TỪ CHỐI — đổi nhãn
    // để giấy in không ghi "Người duyệt" cho một phiếu không được duyệt, và
    // in kèm lý do. Phiếu khác: rejectionReason = null -> trường bị ẩn.
    const isRejected = data.trangThai === 4;
    const approverLabel = isRejected ? "Người từ chối" : null;

    return {
        documentNumber: dash(data.soYeuCauMuaHang || `#${data.id}`),
        documentDate: formatPrintLongDate(data.ngayTao),
        // Bản nháp / bị từ chối in kèm chữ chìm để không bị dùng như phiếu đã duyệt
        watermark: data.trangThai === 0 ? "BẢN NHÁP" : isRejected ? "ĐÃ TỪ CHỐI" : null,
        expectedDate: formatPrintDate(data.ngayGiaoDuKien),
        status: { label: status.label },
        rejectionReason: isRejected ? dash(data.lyDoTuChoi) : null,
        warehouse: {
            name: dash(data.khoNhap?.tenKho),
            code: dash(data.khoNhap?.maKho),
            manager: dash(data.khoNhap?.quanLy?.hoTen),
            address: textOrNull(data.khoNhap?.diaChi),
        },
        notes: textOrNull(data.ghiChu),
        items,
        totalQuantity: formatPrintNumber(totalQuantity),
        signatures: {
            creator: signer(data.nguoiTao),
            approver: signer(data.nguoiDuyet, approverLabel),
        },
    };
}
