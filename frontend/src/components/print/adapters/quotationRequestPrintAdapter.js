import { BAO_GIA_NCC_STATUS } from "@/constants/donMuaHang";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import {
    dash,
    formatPrintDate,
    formatPrintLongDate,
    formatPrintNumber,
    textOrNull,
    toNumeric,
} from "./printFormat";

/**
 * Adapter cho YÊU CẦU BÁO GIÁ — dữ liệu từ API
 * `GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}` (cùng endpoint với
 * yêu cầu nhập hàng; nhà cung cấp được mời nằm trong `donMuaHangs`).
 *
 * Tên trạng thái dùng chung với màn hình: yêu cầu lấy từ constants/yeuCauNhapHang,
 * báo giá từng nhà cung cấp (donMuaHangs) lấy từ BAO_GIA_NCC_STATUS ở constants/donMuaHang.
 */
const signer = (person) => ({ name: person ? dash(person.hoTen) : "" });

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

    const details = data.chiTietYeuCauMuaHangs || [];
    const products = details.map((item) => {
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

    const status = getYeuCauNhapHangStatus(data.trangThai);

    return {
        documentNumber: dash(data.soYeuCauMuaHang || `#${data.id}`),
        documentDate: formatPrintLongDate(data.ngayTao),
        watermark: data.trangThai === 0 ? "BẢN NHÁP" : null,
        // Ngày giao dự kiến của yêu cầu (ngayGiaoDuKien) — KHÔNG phải hạn
        // nhà cung cấp phải gửi báo giá
        expectedDate: formatPrintDate(data.ngayGiaoDuKien),
        status: { label: status.label },
        warehouse: {
            name: dash(data.khoNhap?.tenKho),
            manager: dash(data.khoNhap?.quanLy?.hoTen),
            address: textOrNull(data.khoNhap?.diaChi),
        },
        suppliers,
        products,
        totalQuantity: formatPrintNumber(totalQuantity),
        notes: textOrNull(data.ghiChu),
        signatures: {
            creator: signer(data.nguoiTao),
            approver: signer(data.nguoiDuyet),
        },
    };
}
