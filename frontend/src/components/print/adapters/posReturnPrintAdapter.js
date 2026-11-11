import { dash, formatPrintLongDate, formatPrintMoney, formatPrintNumber, joinParts, textOrNull, toDate, toNumeric } from "./printFormat";
import { docSoTienBangChu } from "./soTienBangChu";

/**
 * Adapter BIÊN BẢN TRẢ HÀNG (loại mẫu in "pos_return") — dữ liệu từ `GET /api/v1/pos/returns/{id}`
 * (TraHangDto.PhieuChiTiet). Bản in giữ tiếng Việt như mọi mẫu in chứng từ.
 */
const LY_DO = {
    mac_chat: "Khách mặc chật",
    mac_rong: "Khách mặc rộng",
    khong_ung_mau_kieu: "Không ưng màu/kiểu",
    loi_san_xuat: "Lỗi kỹ thuật sản xuất",
    doi_y: "Khách đổi ý",
    khac: "Khác",
};

const NHOM_LOI = {
    rach_vai: "Rách vải",
    hong_khoa: "Hỏng khóa",
    o_ban: "Ố bẩn",
    bung_chi: "Bung chỉ, đường may",
    khac: "Lỗi khác",
};

/** "06/11/2026 13:49" */
function gioNgay(value) {
    const d = toDate(value);
    if (!d) return null;
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Không cho ngắt dòng giữa cụm (khoảng trắng / gạch nối không ngắt): mã kệ "A-01-01" không bị bẻ đôi trong cột hẹp. */
const lienKhoi = (text) => text.replace(/ /g, " ").replace(/-/g, "‑");

/** Hiện trạng một dòng: "Đạt · A-01-01", "Đạt · chưa có kệ", "Lỗi · Rách vải". */
function hienTrang(dong) {
    if (dong.tinhTrang === "dat") return lienKhoi(joinParts(["Đạt", dong.ke ?? "chưa có kệ"]));
    return lienKhoi(joinParts(["Lỗi", NHOM_LOI[dong.nhomLoi] ?? dong.nhomLoi ?? "để riêng"]));
}

export function toPosReturnPrintModel(phieu) {
    const p = phieu || {};
    const chuyenKhoan = p.phuongThucHoan === "chuyen_khoan";
    const items = (p.dong || []).map((dong) => ({
        name: dash(dong.tenSanPham),
        sku: dash(dong.maSku),
        color: textOrNull(dong.mauSac),
        size: textOrNull(dong.kichCo),
        condition: hienTrang(dong),
        reason: LY_DO[dong.lyDo] ?? dash(dong.lyDo),
        quantity: formatPrintNumber(dong.soLuong),
        unitPrice: formatPrintMoney(dong.donGiaHoan),
        amount: formatPrintMoney(dong.thanhTienHoan),
    }));
    const soLuong = toNumeric(p.tongSoLuong) ?? 0;
    const dat = toNumeric(p.soLuongDat) ?? 0;
    const loi = toNumeric(p.soLuongLoi) ?? 0;

    return {
        documentNumber: dash(p.soPhieu),
        documentDate: formatPrintLongDate(p.ngayTao),
        documentTime: gioNgay(p.ngayTao)?.slice(11) ?? null,
        copy: null,
        originalOrder: joinParts([p.soDonHang, gioNgay(p.thanhToanLuc)]) ?? "—",
        soldAt: p.traCheo ? `${dash(p.khoBan)} (trả chéo)` : dash(p.khoBan),
        receivedAt: dash(p.khoNhan),
        goodsReceipt: textOrNull(p.soPhieuNhap),
        approval: p.quaHan ? joinParts([p.nguoiDuyet, p.lyDoDuyet], " — ") : null,
        customer: joinParts([p.khachHang, p.soDienThoai]) ?? "—",
        refund: {
            method: chuyenKhoan ? "Chuyển khoản" : "Tiền mặt tại quầy",
            // "Vietcombank · •••• 4567 · LE VAN MINH"
            account: chuyenKhoan ? joinParts([p.nganHang, p.soTaiKhoan ? lienKhoi(p.soTaiKhoan) : null, p.tenChuTaiKhoan]) : null,
            reference: chuyenKhoan ? textOrNull(p.maGiaoDich) : null,
        },
        items,
        totalQuantity: loi > 0 ? `${formatPrintNumber(soLuong)} (${formatPrintNumber(dat)} đạt · ${formatPrintNumber(loi)} lỗi)` : formatPrintNumber(soLuong),
        totals: { refund: formatPrintMoney(p.tongTienHoan) },
        amountInWords: docSoTienBangChu(p.tongTienHoan),
        notes: textOrNull(p.ghiChu),
        signatures: {
            customer: { name: "" },
            cashier: { name: textOrNull(p.nguoiLap) ?? "" },
            approver: { name: textOrNull(p.nguoiDuyet) ?? "" },
        },
    };
}
