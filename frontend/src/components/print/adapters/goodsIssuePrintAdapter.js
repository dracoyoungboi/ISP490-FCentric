import { PHIEU_XUAT_KHO_STATUS } from "@/constants/phieuXuatKho";
import { PHIEU_CHUYEN_KHO_STATUS } from "@/constants/phieuChuyenKho";
import { trangThaiLa } from "@/constants/trangThaiChung";
import { dash, formatPrintLongDate, formatPrintNumber, joinParts, textOrNull, toNumeric } from "./printFormat";

/**
 * Adapter cho PHIẾU XUẤT KHO — dữ liệu từ API
 * `GET /api/v1/phieu-xuat-kho/{id}` ({phieu, chiTiet} — không có envelope),
 * lô đã chọn từ `GET /api/v1/phieu-xuat-kho/{id}/picked-lots/{chiTietId}` và
 * tên lô từ `GET /api/v1/phieu-xuat-kho/{id}/available-lots?bienTheSanPhamId=`.
 * Trạng thái dùng chung tên với danh sách và chi tiết phiếu xuất (constants/phieuXuatKho).
 *
 * MỖI DÒNG HÀNG MỘT DÒNG IN, các lô liệt kê trong ô "Lô" (không lặp "SL yêu
 * cầu" theo từng lô). "Thực xuất" chỉ lấy số đã lấy theo lô / soLuongDaPick;
 * chưa lấy hàng thì để TRỐNG cho thủ kho ghi tay — không điền số yêu cầu.
 */
export const GOODS_ISSUE_STATUS = PHIEU_XUAT_KHO_STATUS;

// Loại xuất theo giá trị backend: "ban_hang" = xuất bán, "chuyen_kho" = xuất
// chuyển kho nội bộ, "khac" = phiếu yêu cầu chuyển kho (chưa có phiếu xuất)
export const GOODS_ISSUE_TYPE = {
    ban_hang: "Xuất bán hàng",
    chuyen_kho: "Chuyển kho nội bộ",
    khac: "Yêu cầu chuyển kho",
};

// Phiếu đã xuất (3, 5): dữ liệu cũ không có số đã lấy thì coi như xuất đủ số trên phiếu
const DA_XUAT = new Set([3, 5]);

/** Lưu ý in ở cuối phiếu chuyển kho — phiếu này là chứng từ kho, không phải chứng từ đi đường. */
export const TRANSFER_LEGAL_NOTE =
    "Phiếu xuất kho nội bộ. Hàng vận chuyển giữa các kho phải kèm phiếu xuất kho kiêm vận chuyển nội bộ điện tử (mẫu số 6) lập trên phần mềm hóa đơn điện tử.";

const sumOrNull = (values) => {
    const known = values.filter((value) => value !== null);
    return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
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
    const issued = DA_XUAT.has(phieu.trangThai);

    const rows = chiTiet.map((item) => {
        const picks = pickedLotsByDetailId[item.id] || [];
        const picked = toNumeric(item.soLuongDaPick);
        const requested = toNumeric(item.soLuongCanXuat);
        const actual =
            picks.length > 0
                ? sumOrNull(picks.map((pick) => toNumeric(pick.soLuongDaPick)))
                : picked !== null && picked > 0
                  ? picked
                  : issued
                    ? picked ?? requested
                    : null;
        return {
            name: dash(item.tenBienThe),
            sku: dash(item.sku),
            lots: picks.map((pick) => ({
                code: dash(lotNameByLotId[pick.loHangId] ?? `#${pick.loHangId}`),
                note: null,
                quantity: formatPrintNumber(pick.soLuongDaPick),
            })),
            requestedQuantity: requested === null ? "—" : formatPrintNumber(requested),
            quantity: actual === null ? "" : formatPrintNumber(actual),
            _actual: actual,
            _requested: requested,
        };
    });

    // Còn dòng chưa có số thực tế (để trống ghi tay) thì tổng cũng để trống —
    // in tổng của riêng các dòng đã có số sẽ bị đọc nhầm là tổng cả phiếu
    const totalActual = rows.some((row) => row._actual === null)
        ? null
        : sumOrNull(rows.map((row) => row._actual));

    // Phiếu chuyển kho nội bộ (loại `khac`) dùng bảng tên của Chuyển kho (mã 2 = Chờ xuất hàng);
    // mã lạ hiện rõ mã, không mượn tên của mã 0
    const bangTen = phieu.loaiXuat === "khac" ? PHIEU_CHUYEN_KHO_STATUS : GOODS_ISSUE_STATUS;
    const status = bangTen[phieu.trangThai] || trangThaiLa(phieu.trangThai);

    const isSale = phieu.loaiXuat === "ban_hang";
    const isTransfer = phieu.loaiXuat === "chuyen_kho" || phieu.loaiXuat === "khac";
    // Dữ liệu cũ thiếu loaiXuat nhưng có đơn bán vẫn in thông tin đơn bán
    const saleOrder = isSale || (!isTransfer && phieu.donBanHang) ? phieu.donBanHang || {} : null;
    const customer = saleOrder?.khachHang || {};
    const destination = isTransfer ? phieu.khoChuyenDen || {} : null;

    return {
        documentNumber: dash(phieu.soPhieuXuat || `#${phieu.id}`),
        // Chưa xuất thì chưa có ngày xuất — in ngày lập phiếu
        documentDate: formatPrintLongDate(phieu.ngayXuat || phieu.ngayTao),
        watermark: phieu.trangThai === 0 ? "BẢN NHÁP" : phieu.trangThai === 4 ? "ĐÃ HỦY" : null,
        issueType: dash(GOODS_ISSUE_TYPE[phieu.loaiXuat] ?? phieu.loaiXuat),
        // null = không áp dụng (ẩn trên bản in)
        salesOrder: saleOrder ? dash(saleOrder.soDonHang) : null,
        transferRef: isTransfer ? textOrNull(phieu.soPhieuChuyenKhoGoc) : null,
        status: { label: status.label },
        warehouse: {
            name: dash(phieu.kho?.tenKho),
            code: dash(phieu.kho?.maKho),
            address: textOrNull(phieu.kho?.diaChi),
        },
        recipient: {
            warehouse: destination
                ? joinParts([destination.tenKho, destination.maKho ? `(${destination.maKho})` : null], " ")
                : null,
            customer: saleOrder ? textOrNull(customer.tenKhachHang) : null,
            phone: saleOrder ? textOrNull(customer.soDienThoai) : null,
            address: destination
                ? textOrNull(destination.diaChi)
                : saleOrder
                  ? textOrNull(saleOrder.diaChiGiaoHang) ?? textOrNull(customer.diaChi)
                  : null,
        },
        items: rows,
        totalRequested: formatPrintNumber(sumOrNull(rows.map((row) => row._requested)) ?? 0),
        totalQuantity: totalActual === null ? "" : formatPrintNumber(totalActual),
        notes: textOrNull(phieu.ghiChu),
        legalNote: isTransfer ? TRANSFER_LEGAL_NOTE : null,
        signatures: {
            issuer: { name: textOrNull(phieu.nguoiXuat?.hoTen) ?? "" },
            // Người nhận (khách / shipper / thủ kho nhận) ký tay và ghi rõ họ tên
            receiver: { name: "" },
            approver: { name: textOrNull(phieu.nguoiDuyet?.hoTen) ?? "" },
            accountant: { name: "" },
        },
    };
}
