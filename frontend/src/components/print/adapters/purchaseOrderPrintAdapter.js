import { DON_MUA_HANG_STATUS } from "@/constants/donMuaHang";
import { trangThaiLa } from "@/constants/trangThaiChung";
import {
    dash,
    formatPrintDate,
    formatPrintLongDate,
    formatPrintMoney,
    formatPrintNumber,
    textOrNull,
    toNumeric,
} from "./printFormat";
import { docSoTienBangChu } from "./soTienBangChu";

/**
 * Adapter cho ĐƠN MUA HÀNG — dữ liệu từ API
 * `GET /api/v1/don-mua-hang/get-by-id/{id}` (DonMuaHangDto).
 *
 * Lưu ý: DTO không có phí vận chuyển, chiết khấu, thuế GTGT hay điều khoản
 * thanh toán (thanh toán nhà cung cấp nằm ngoài hệ thống) — chỉ in những gì
 * API có, không tự suy ra giá đã gồm hay chưa gồm thuế.
 */
// Trạng thái đơn mua hàng — dùng chung hằng số với PurchaseOrder (danh sách) / PurchaseOrderDetail.
export const PURCHASE_ORDER_STATUS = DON_MUA_HANG_STATUS;

const signer = (person) => ({ name: person ? dash(person.hoTen) : "" });

export function toPurchaseOrderPrintModel(raw) {
    const data = raw || {};
    const details = data.chiTietDonMuaHangs || [];

    const items = details.map((item) => {
        const variant = item?.bienTheSanPham || {};
        return {
            name: dash(variant.tenSanPham || variant.maSku),
            sku: dash(variant.maSku),
            color: textOrNull(variant.mauSac?.tenMau),
            size: textOrNull(variant.size?.maSize),
            material: textOrNull(variant.chatLieu?.tenChatLieu),
            unitPrice: formatPrintMoney(item?.donGia),
            quantity: formatPrintNumber(item?.soLuongDat),
            amount: formatPrintMoney(item?.thanhTien),
        };
    });

    const status = PURCHASE_ORDER_STATUS[data.trangThai] || trangThaiLa(data.trangThai);
    const totalQuantity = details.reduce((sum, item) => sum + (toNumeric(item?.soLuongDat) ?? 0), 0);

    return {
        documentNumber: dash(data.soDonMua || `#${data.id}`),
        documentDate: formatPrintLongDate(data.ngayDatHang),
        // Mã 0 = đơn đã xóa
        watermark: data.trangThai === 0 ? "ĐÃ HỦY" : null,
        expectedDate: formatPrintDate(data.ngayGiaoDuKien),
        purchaseRequest: textOrNull(data.yeuCauMuaHang?.soYeuCauMuaHang),
        status: { label: status.label },
        supplier: {
            name: dash(data.nhaCungCap?.tenNhaCungCap),
            code: dash(data.nhaCungCap?.maNhaCungCap),
            contact: textOrNull(data.nhaCungCap?.nguoiLienHe),
            phone: textOrNull(data.nhaCungCap?.soDienThoai),
            email: textOrNull(data.nhaCungCap?.email),
            address: textOrNull(data.nhaCungCap?.diaChi),
        },
        // Kho nhận hàng — nhà cung cấp cần biết giao đến đâu
        deliverTo: {
            warehouse: data.khoNhap?.maKho
                ? `${dash(data.khoNhap?.tenKho)} (${data.khoNhap.maKho})`
                : dash(data.khoNhap?.tenKho),
            address: textOrNull(data.khoNhap?.diaChi),
        },
        items,
        totalQuantity: formatPrintNumber(totalQuantity),
        totals: { total: formatPrintMoney(data.tongTien) },
        amountInWords: docSoTienBangChu(data.tongTien),
        notes: textOrNull(data.ghiChu),
        signatures: {
            creator: signer(data.nguoiTao),
            approver: signer(data.nguoiDuyet),
            // Đại diện nhà cung cấp ký xác nhận khi nhận đơn
            supplier: { name: "" },
        },
    };
}
