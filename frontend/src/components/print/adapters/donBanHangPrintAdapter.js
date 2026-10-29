import { BAO_GIA_STATUS } from "@/constants/baoGia";
import { DON_BAN_HANG_STATUS, DON_BAN_HANG_THANH_TOAN } from "@/constants/donBanHang";
import { trangThaiLa } from "@/constants/trangThaiChung";
import {
    dash,
    formatPrintLongDate,
    formatPrintMoney,
    formatPrintNumber,
    joinParts,
    textOrNull,
    toNumeric,
} from "./printFormat";
import { docSoTienBangChu } from "./soTienBangChu";

/**
 * Adapter cho BÁO GIÁ BÁN và HÓA ĐƠN BÁN HÀNG — cùng một thực thể backend
 * `don_ban_hang` (phân biệt bằng `loaiChungTu`), dữ liệu từ API
 * `GET /api/v1/don-ban-hang/{id}/detail` (DonBanHangDetailResponse).
 * Số hóa đơn = số đơn hàng (SO…); hóa đơn in từ trang đơn bán và từ màn bán tại quầy.
 *
 * Lưu ý: API không có chiết khấu, thuế GTGT, số tiền còn nợ hay hạn hiệu lực
 * báo giá — chỉ in những gì API thật sự trả về. Tiền khách đưa / tiền thừa chỉ
 * có với đơn bán tại quầy (sổ thu POS, `thanhToanTaiQuay`).
 * Thông tin cửa hàng (đơn vị bán) đã ở đầu phiếu; người lập chỉ in ở ô ký.
 */
// Trạng thái dùng chung hằng số với danh sách + trang chi tiết (một tên cho mỗi trạng thái).
export const SALES_QUOTATION_STATUS = BAO_GIA_STATUS;

export const SALES_ORDER_STATUS = DON_BAN_HANG_STATUS;

export const PAYMENT_STATUS = DON_BAN_HANG_THANH_TOAN;

/** Hình thức thu tiền (pos_payment.phuong_thuc tại quầy; TIEN_MAT / CHUYEN_KHOAN: phiếu thu đơn bán thường). */
export const PAYMENT_METHOD = {
    CASH: "Tiền mặt",
    TIEN_MAT: "Tiền mặt",
    PAYOS: "Chuyển khoản",
    CHUYEN_KHOAN: "Chuyển khoản",
};

/** Mã kênh của màn bán tại quầy — in "Bán tại quầy" thay cho tên kênh kỹ thuật "POS". */
const MA_KENH_TAI_QUAY = "POS";

const pad2 = (number) => String(number).padStart(2, "0");

/** "14:42" theo giờ máy in; không có giờ hợp lệ -> null. */
function formatPrintTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Kênh bán in trên chứng từ: tại quầy -> "Bán tại quầy"; sàn -> "Shopify · #1016" (như trang đơn bán); đơn thường -> null. */
function channelLabel(don) {
    const kenh = don.kenhBanHang;
    if (!kenh) return null;
    if (kenh.maKenh === MA_KENH_TAI_QUAY) return "Bán tại quầy";
    const maSan = textOrNull(don.maDonHangKenh);
    return joinParts([kenh.tenKenh, maSan ? `#${maSan.replace(/^#/, "")}` : null]);
}

/** Phần chung của cả hai loại chứng từ bán hàng. */
function toDonBanHangPrintModel(raw, { statusMap }) {
    const don = raw?.donBanHang || {};
    const kh = don.khachHang || {};
    const seller = don.nguoiTao || {};
    const details = raw?.chiTiet || [];

    const items = details.map((item) => {
        const note = textOrNull(item.ghiChu);
        return {
            name: dash(item.tenSanPham),
            sku: dash(item.sku),
            // Đơn vị tính của sản phẩm; API cũ chưa trả thì cột ĐVT tự ẩn
            unit: textOrNull(item.donViTinh),
            unitPrice: formatPrintMoney(item.donGia),
            quantity: formatPrintNumber(item.soLuongDat),
            amount: formatPrintMoney(item.thanhTien),
            note: note ? `Ghi chú: ${note}` : null,
        };
    });

    // Mã lạ hiện rõ mã — không mượn tên trạng thái "Nháp"
    const status = statusMap[don.trangThai] || trangThaiLa(don.trangThai);
    const totalQuantity = details.reduce((sum, item) => sum + (toNumeric(item.soLuongDat) ?? 0), 0);
    const shipping = toNumeric(don.phiVanChuyen);

    return {
        documentNumber: dash(don.soDonHang || `#${don.id}`),
        documentDate: formatPrintLongDate(don.ngayDatHang),
        status: { label: status.label },
        creator: {
            name: dash(seller.hoTen),
            email: textOrNull(seller.email),
            phone: textOrNull(seller.soDienThoai),
        },
        buyer: {
            name: dash(kh.tenKhachHang),
            code: textOrNull(kh.maKhachHang),
            taxCode: textOrNull(kh.maSoThue),
            contact: textOrNull(kh.nguoiLienHe),
            phone: textOrNull(kh.soDienThoai),
            address: textOrNull(kh.diaChi),
            // Địa chỉ giao của RIÊNG đơn này (có thể khác địa chỉ khách hàng);
            // null = không giao hàng (vd. bán tại quầy) -> ẩn trên bản in
            deliveryAddress: textOrNull(don.diaChiGiaoHang),
        },
        channel: channelLabel(don),
        warehouse: textOrNull(don.khoXuat?.tenKho),
        items,
        totalQuantity: formatPrintNumber(totalQuantity),
        totals: {
            items: formatPrintMoney(don.tienHang),
            // Số gốc để ẩn dòng phí vận chuyển khi bằng 0 (giá trị in dùng shipping)
            shippingRaw: shipping,
            shipping: formatPrintMoney(shipping ?? 0),
            grandTotal: formatPrintMoney(don.tongCong),
        },
        amountInWords: docSoTienBangChu(don.tongCong),
        notes: textOrNull(don.ghiChu),
        signatures: {
            creator: { name: dash(seller.hoTen) },
            // Người ký là NGƯỜI đại diện bên mua (khách có thể là cửa hàng/công ty)
            // — để trống ký và ghi rõ họ tên, không in sẵn tên khách hàng.
            buyer: { name: "" },
        },
    };
}

export function toSalesQuotationPrintModel(raw) {
    const model = toDonBanHangPrintModel(raw, { statusMap: SALES_QUOTATION_STATUS });
    return { ...model, watermark: null };
}

/**
 * Thuế GTGT của đơn (chụp lúc chốt, giá đã gồm thuế): tiền trước thuế, thuế suất, tiền thuế — phần "trong đó" của Tổng
 * thanh toán. Đơn không mang thuế (tắt thuế, đơn sàn, đơn cũ): null, cả nhóm dòng thuế tự ẩn.
 */
export function thueGtgt(don) {
    const rate = toNumeric(don?.thueSuatGtgt);
    const amount = toNumeric(don?.tienThueGtgt);
    const total = toNumeric(don?.tongCong);
    if (rate == null || amount == null || total == null) return null;
    return {
        // Dòng chú thích "Giá đã gồm thuế GTGT, trong đó:" không có số — chỉ cần biết đơn mang thuế
        included: true,
        preTax: formatPrintMoney(total - amount),
        rate: `${rate.toLocaleString("vi-VN")}%`,
        amount: formatPrintMoney(amount),
    };
}

export function toSalesInvoicePrintModel(raw) {
    const model = toDonBanHangPrintModel(raw, { statusMap: SALES_ORDER_STATUS });
    const don = raw?.donBanHang || {};
    // Đơn bán thường: trạng thái tính từ phiếu (null = đơn cũ chưa theo dõi thanh toán, không in tình trạng)
    const tt = raw?.thanhToan;
    const donThuong = Boolean(tt?.donThuong) && !raw?.thanhToanTaiQuay;
    const trangThaiTT = donThuong ? tt.trangThai : don.trangThaiThanhToan;
    const status = trangThaiTT ? PAYMENT_STATUS[trangThaiTT] || { label: dash(trangThaiTT) } : { label: null };

    // Sổ thu tại quầy: hình thức, tiền khách đưa, tiền thừa (đơn khác không có -> null, dòng tự ẩn)
    const thu = raw?.thanhToanTaiQuay || null;
    // Trả kết hợp tại quầy: tiền mặt khách trả trước, QR phần còn lại — đầu hóa đơn chỉ ghi "Tiền mặt + Chuyển khoản",
    // số tiền từng phần in ở khối tổng ngay dưới Tổng thanh toán
    const tienMatTruoc = toNumeric(thu?.tienMatTruoc);
    const ketHop = tienMatTruoc > 0;
    const tienChuyenKhoan = ketHop ? Math.max((toNumeric(thu.soTienThu) ?? 0) - tienMatTruoc, 0) : null;
    // Đơn bán thường (thu theo phiếu ghi nhận: đặt cọc, thu nhiều lần): cách trả đã dùng, số đã thu và còn phải thu
    const phieuThu = donThuong ? (tt.phieu ?? []).filter((p) => p.loai === "THU" && p.trangThai === "HIEU_LUC") : [];
    const cachTraThuong = [...new Set(phieuThu.map((p) => PAYMENT_METHOD[p.phuongThuc] ?? p.phuongThuc))].join(" + ") || null;
    const daThu = donThuong ? toNumeric(tt.daThu) : null;
    const conLai = donThuong ? toNumeric(tt.conLai) : null;
    const method = ketHop
        ? `${PAYMENT_METHOD.CASH} + ${PAYMENT_METHOD.PAYOS}`
        : thu?.phuongThuc ? PAYMENT_METHOD[thu.phuongThuc] ?? thu.phuongThuc
            : donThuong ? cachTraThuong : null;
    const isCash = thu?.phuongThuc === "CASH";
    const change = isCash ? toNumeric(thu.soTienThua) : null;

    // 0 Nháp, 4 Đã hủy, 6 Bị hoàn trả: in kèm chữ chìm để không dùng như hóa đơn đã bán xong
    const watermark =
        don.trangThai === 0 ? "BẢN NHÁP" : don.trangThai === 4 ? "ĐÃ HỦY" : don.trangThai === 6 ? "ĐÃ HOÀN TRẢ" : null;
    return {
        ...model,
        watermark,
        // Giờ bán — chỉ in trên khổ nhiệt (hóa đơn tại quầy), sau ngày ở đầu phiếu
        documentTime: formatPrintTime(don.ngayDatHang),
        // "Đã thanh toán · Tiền mặt": tình trạng và hình thức trên một dòng
        paymentStatus: { label: joinParts([status.label, method]) },
        vat: thueGtgt(don),
        payment: {
            cashPart: ketHop ? formatPrintMoney(tienMatTruoc) : null,
            transferPart: ketHop ? formatPrintMoney(tienChuyenKhoan) : null,
            received: isCash ? formatPrintMoney(thu.soTienThu) : null,
            changeRaw: change,
            change: isCash ? formatPrintMoney(change ?? 0) : null,
            // Đơn bán thường đã thu một phần trở lên: in Đã thanh toán; còn thiếu thì in Còn phải thu
            paid: daThu > 0 ? formatPrintMoney(daThu) : null,
            due: daThu > 0 && conLai > 0 ? formatPrintMoney(conLai) : null,
        },
    };
}
