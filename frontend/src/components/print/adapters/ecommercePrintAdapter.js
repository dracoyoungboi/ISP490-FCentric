import { PHIEU_XUAT_KHO_STATUS } from "@/constants/phieuXuatKho";
import { trangThaiLa } from "@/constants/trangThaiChung";
import { dash, formatPrintLongDate, formatPrintNumber, textOrNull, toNumeric } from "./printFormat";

/**
 * Adapter cho PHIẾU ĐÓNG GÓI ĐƠN SÀN TMĐT (Lazada, Shopee, TikTok Shop).
 * Chuyển đổi dữ liệu phiếu xuất kho và đơn hàng sàn sang PrintModel chuẩn
 * để hiển thị trên mẫu in A6 / A5 / A4 / K80 trong trình sửa mẫu in của Khang.
 */
export function toEcommercePrintModel(payload) {
    const phieu = payload?.phieu || {};
    const chiTiet = payload?.chiTiet || [];
    const don = phieu.donBanHang || payload?.donBanHang || {};
    const khach = don.khachHang || {};
    const kenh = don.kenhBanHang || {};

    const rows = chiTiet.map((item) => {
        const qty = toNumeric(item.soLuongXuat ?? item.soLuongCanXuat ?? item.soLuongDaPick ?? 1);
        const skuCode = item.maSku || item.sku || "";
        const color = item.mauSac || item.color || "";
        const size = item.kichCo || item.size || "";
        const variantText = [color, size].filter(Boolean).join(" - ");

        return {
            name: dash(item.tenBienThe || item.tenSanPham || item.name),
            sku: dash(skuCode),
            barcode: skuCode,
            variant: variantText || "Tiêu chuẩn",
            quantity: formatPrintNumber(qty),
            _quantity: qty,
            note: textOrNull(item.ghiChu),
        };
    });

    const totalQty = rows.reduce((sum, r) => sum + (r._quantity || 0), 0);
    const status = PHIEU_XUAT_KHO_STATUS[phieu.trangThai] || trangThaiLa(phieu.trangThai);

    // Kênh bán & Mã đơn sàn
    const channelName = kenh.tenKenh || (don.maDonHangKenh ? "Lazada" : "Sàn TMĐT");
    const channelOrderCode = don.maDonHangKenh || don.soDonHang || "";
    const trackingCode = phieu.maVanDon || don.maVanDon || payload?.trackingCode || "";
    const carrierName = phieu.donViVanChuyen || don.donViVanChuyen || payload?.carrierName || "";
    const packageId = payload?.packageId || "";

    return {
        documentNumber: dash(phieu.soPhieuXuat || `#${phieu.id || don.id}`),
        documentDate: formatPrintLongDate(phieu.ngayXuat || phieu.ngayTao || don.ngayDatHang || new Date()),
        channelOrderInfo: {
            channelName: dash(channelName),
            orderCode: dash(channelOrderCode),
            trackingCode: textOrNull(trackingCode) || "Chờ cập nhật",
            carrierName: textOrNull(carrierName) || "Đơn vị vận chuyển sàn",
            packageId: textOrNull(packageId) || "—",
        },
        recipient: {
            customer: dash(khach.tenKhachHang || "Khách hàng sàn"),
            phone: textOrNull(khach.soDienThoai) || "—",
            address: textOrNull(don.diaChiGiaoHang) || textOrNull(khach.diaChi) || "Theo bưu kiện sàn",
        },
        warehouse: {
            name: dash(phieu.kho?.tenKho || "Kho Tổng"),
            code: dash(phieu.kho?.maKho || "KT-01"),
        },
        status: { label: status?.label || "Đang đóng gói" },
        items: rows,
        totalQuantity: formatPrintNumber(totalQty),
        notes: textOrNull(phieu.ghiChu) || textOrNull(don.ghiChu),
        signatures: {
            packer: { name: textOrNull(phieu.nguoiXuat?.hoTen) ?? "" },
            checker: { name: "" },
        },
    };
}

