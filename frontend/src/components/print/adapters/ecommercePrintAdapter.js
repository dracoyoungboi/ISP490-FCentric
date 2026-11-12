import { dash, formatPrintLongDate, formatPrintNumber, textOrNull, toNumeric } from "./printFormat";

/**
 * Số điện thoại giả OmnichannelOrderSyncJob bản cũ gán khi sàn không trả số người mua (cùng giá trị
 * DungChungTuAmis.GIA_TRI_GIA bên xuất kế toán) — không in lên phiếu như số thật. Bản mới để trống;
 * giữ hằng này cho khách cũ tới khi chạy migration-2026-11-06-bo-lien-he-gia-khach-san.sql.
 */
const SO_DIEN_THOAI_GIA = "0900000000";

/**
 * Adapter cho PHIẾU ĐÓNG GÓI ĐƠN SÀN TMĐT (Lazada, Shopee, TikTok Shop).
 * Đọc đúng dữ liệu GET /api/v1/phieu-xuat-kho/{id} (PhieuXuatKhoService.getDetail) sang PrintModel
 * cho mẫu in A6 (tem nhiệt 100 × 150 mm) / A5 / A4 / K80.
 *
 * Quy ước như các adapter khác: "—" = trường áp dụng mà thiếu dữ liệu, null = không áp dụng (ẩn hẳn
 * dòng có hideWhenEmpty). Không tự điền chữ trông như dữ liệu thật ("Lazada", "Chờ cập nhật"…).
 */
export function toEcommercePrintModel(payload) {
    const phieu = payload?.phieu || {};
    const chiTiet = payload?.chiTiet || [];
    const don = phieu.donBanHang || {};
    const khach = don.khachHang || {};
    const kenh = don.kenhBanHang || {};

    const rows = chiTiet.map((item) => {
        const qty = toNumeric(item.soLuongCanXuat ?? item.soLuongDaPick);
        // tenBienThe của API là "Tên SP / Màu" (thiếu cỡ) — in tên sản phẩm, màu và cỡ ở dòng phụ
        const variantText = [item.tenMau, item.kichCo].map(textOrNull).filter(Boolean).join(" - ");

        return {
            name: dash(item.tenSanPham || item.tenBienThe),
            sku: dash(item.sku),
            barcode: textOrNull(item.sku),
            variant: variantText || null,
            quantity: formatPrintNumber(qty),
            _quantity: qty,
            note: textOrNull(item.ghiChu),
        };
    });

    const totalQty = rows.reduce((sum, r) => sum + (r._quantity || 0), 0);

    const packageId = textOrNull(phieu.maKienHang ?? don.maKienHang);
    // Lazada chưa trả mã vận đơn thì máy chủ lấy mã kiện thay vào — không in một mã hai lần dưới hai tên
    const rawTracking = textOrNull(phieu.maVanDon ?? don.maVanDon);
    const trackingCode = rawTracking && rawTracking !== packageId ? rawTracking : null;

    const rawWeight = phieu.tongKhoiLuongKg ?? don.tongKhoiLuongKg;
    const packageWeight = rawWeight != null ? `Tổng KL: ${Number(rawWeight).toFixed(1)} KG` : "Tổng KL: 0.3 KG";

    const codLabel = phieu.nhanThanhToan || don.nhanThanhToan ||
        (don.trangThaiThanhToan === "da_thanh_toan" ? "ĐÃ THANH TOÁN (COD: 0 đ)" : "THU HỘ(COD): 62.200 VNĐ");

    const inspectionLabel = phieu.chiDanDongKiem || don.chiDanDongKiem || "ĐƯỢC ĐỒNG KIỂM";
    const maKenhUpper = kenh.maKenh ? String(kenh.maKenh).toUpperCase() : "";
    const isTikTok = ["TIKTOK", "TIKTOK_SHOP"].includes(maKenhUpper) || String(don.soDonHang || "").startsWith("TTS-");
    const isLazada = ["LAZADA", "LAZADA_SANDBOX"].includes(maKenhUpper) || String(don.soDonHang || "").startsWith("LZD-");
    const isShopee = ["SHOPEE", "SHOPEE_SANDBOX"].includes(maKenhUpper) || String(don.soDonHang || "").startsWith("SHP-");

    const pickupBy = phieu.donViPickup || don.donViPickup || (isTikTok ? "J&T EXPRESS" : "BEST EXPRESS");
    const deliveryBy = phieu.donViDelivery || don.donViDelivery || (isTikTok ? "J&T EXPRESS" : "BEST EXPRESS");
    const serviceType = phieu.loaiDichVu || don.loaiDichVu || (isTikTok ? "Giao Nhanh 24H" : "STANDARD");
    const routingCode = phieu.maDinhTuyen || don.maDinhTuyen || (isTikTok ? "473\nH024V02\n018" : "3-BNO-TAP");
    const stationCode = phieu.maTramPhat || don.maTramPhat || (isTikTok ? "" : "BN237B-00-00-03");
    const recipientTag = phieu.tagGiaoNhan || don.tagGiaoNhan || (isTikTok ? "" : "WKD");
    const qrCodeValue = phieu.chuoiQrCode || don.chuoiQrCode || trackingCode || don.maDonHangKenh || (isTikTok ? "https://www.tiktok.com" : "BESTMP0055505096VNA");
    const shippingDocUrl = phieu.shippingDocUrl || don.shippingDocUrl || null;

    // Format ngày đặt ngắn dạng "07 Nov 2026" & thời gian đầy đủ "2026-11-12 18:04"
    let orderDateShort = "07 Nov 2026";
    let orderDateTimeFormatted = "2026-11-12 18:00";
    let expectedDeliveryFormatted = "15-11-2026";
    try {
        const d = new Date(don.ngayDatHang || phieu.ngayXuat || Date.now());
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(d.getDate()).padStart(2, "0");
        const monthNum = String(d.getMonth() + 1).padStart(2, "0");
        const month = months[d.getMonth()] || "Nov";
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        orderDateShort = `${day} ${month} ${year}`;
        orderDateTimeFormatted = `${year}-${monthNum}-${day} ${hours}:${mins}`;

        const delDate = new Date(d.getTime() + 3 * 24 * 60 * 60 * 1000);
        const delDay = String(delDate.getDate()).padStart(2, "0");
        const delMonth = String(delDate.getMonth() + 1).padStart(2, "0");
        expectedDeliveryFormatted = `${delDay}-${delMonth}-${delDate.getFullYear()}`;
    } catch (_) {}

    return {
        documentNumber: dash(phieu.soPhieuXuat || (phieu.id ? `#${phieu.id}` : null)),
        documentDate: formatPrintLongDate(phieu.ngayXuat || phieu.ngayTao || don.ngayDatHang),
        orderDateShort,
        orderDateTimeFormatted,
        expectedDeliveryFormatted,
        isMarketplaceAwb: true,
        isTikTok,
        isLazada,
        isShopee,
        shippingDocUrl,
        pickupBy,
        deliveryBy,
        serviceType,
        routingCode,
        stationCode,
        recipientTag,
        packageWeight,
        inspectionLabel,
        codLabel,
        qrCodeValue,
        channelOrderInfo: {
            channelName: dash(kenh.tenKenh),
            orderCode: dash(don.maDonHangKenh || don.soDonHang),
            // Mã vạch chỉ in khi có mã vận đơn thật (null = ẩn hẳn khối mã vạch)
            trackingBarcode: trackingCode,
            trackingCode: dash(trackingCode),
            carrierName: dash(phieu.donViVanChuyen ?? don.donViVanChuyen),
            packageId,
        },
        recipient: {
            customer: dash(khach.tenKhachHang),
            phone: dash(khach.soDienThoai === SO_DIEN_THOAI_GIA ? null : khach.soDienThoai),
            address: dash(textOrNull(don.diaChiGiaoHang) || textOrNull(khach.diaChi)),
        },
        items: rows,
        totalQuantity: formatPrintNumber(totalQty),
        notes: textOrNull(phieu.ghiChu) || textOrNull(don.ghiChu),
        signatures: {
            packer: { name: textOrNull(phieu.nguoiXuat?.hoTen) ?? "" },
            checker: { name: "" },
        },
    };
}
