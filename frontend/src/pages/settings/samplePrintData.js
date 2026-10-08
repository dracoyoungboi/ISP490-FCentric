import { toPurchaseRequestPrintModel } from "@/components/print/adapters/purchaseRequestPrintAdapter";
import { toQuotationRequestPrintModel } from "@/components/print/adapters/quotationRequestPrintAdapter";
import { toPurchaseOrderPrintModel } from "@/components/print/adapters/purchaseOrderPrintAdapter";
import { toGoodsReceiptPrintModel } from "@/components/print/adapters/goodsReceiptPrintAdapter";
import { toGoodsIssuePrintModel } from "@/components/print/adapters/goodsIssuePrintAdapter";
import {
    toSalesQuotationPrintModel,
    toSalesInvoicePrintModel,
} from "@/components/print/adapters/donBanHangPrintAdapter";

/**
 * Dữ liệu mẫu CHỈ dùng trong editor / bản xem trước. Trang in thật chỉ dùng
 * dữ liệu API. MỌI loại chứng từ đều giữ nguyên dạng RAW của API và chảy
 * qua ĐÚNG adapter của bản in thật — lỗi mapping sẽ lộ ngay trên preview.
 *
 * Giá trị mẫu thực tế (tên kho, khách hàng, sản phẩm bình thường); số phiếu
 * mang tiền tố "MẪU-" và email dùng example.com để dễ nhận ra dữ liệu ví dụ.
 * Trên màn hình có badge "Dữ liệu mẫu"; bản in thử có watermark "BẢN IN THỬ".
 * Dữ liệu mẫu phải NHẤT QUÁN về nghiệp vụ (vd. đã có người duyệt thì trạng
 * thái là "Đã duyệt") để người cấu hình thấy đúng bố cục phiếu thật.
 */

export const SAMPLE_PURCHASE_REQUEST_RAW = {
    id: 0,
    soYeuCauMuaHang: "MẪU-PR-0001",
    ngayTao: "2026-09-12T08:30:00Z",
    ngayGiaoDuKien: "2026-09-20T00:00:00Z",
    // Đã duyệt — khớp với việc có người duyệt (hiện đủ 2 ô ký)
    trangThai: 2,
    ghiChu: "Ưu tiên nhập trước ngày 20/09 để kịp trưng bày.",
    khoNhap: {
        tenKho: "Kho trung tâm",
        maKho: "KHO-TT",
        diaChi: "123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
        quanLy: { hoTen: "Nguyễn Văn An" },
    },
    nguoiTao: { hoTen: "Trần Thị Bích", email: "bich.tt@example.com" },
    nguoiDuyet: { hoTen: "Lê Văn Cường", email: "cuong.lv@example.com" },
    chiTietYeuCauMuaHangs: [
        {
            id: 1,
            bienTheSanPham: {
                tenSanPham: "Áo thun nam cổ tròn",
                maSku: "ATN-001-WHT-L",
                mauSac: { tenMau: "Trắng" },
                size: { maSize: "L" },
                chatLieu: { tenChatLieu: "Cotton 100%" },
            },
            soLuongDat: 50,
        },
        {
            id: 2,
            bienTheSanPham: {
                tenSanPham: "Áo thun nam cổ tròn",
                maSku: "ATN-001-BLK-M",
                mauSac: { tenMau: "Đen" },
                size: { maSize: "M" },
                chatLieu: { tenChatLieu: "Cotton 100%" },
            },
            soLuongDat: 30,
        },
        {
            id: 3,
            bienTheSanPham: {
                tenSanPham: "Quần kaki nam ống đứng",
                maSku: "QK-002-GRY-XL",
                mauSac: { tenMau: "Xám" },
                size: { maSize: "XL" },
                chatLieu: { tenChatLieu: "Kaki 4 chiều" },
            },
            soLuongDat: 20,
        },
    ],
};

/** Yêu cầu báo giá — cùng shape API yeu-cau-mua-hang + danh sách nhà cung cấp được mời. */
export const SAMPLE_QUOTATION_REQUEST_RAW = {
    id: 0,
    soYeuCauMuaHang: "MẪU-QR-0001",
    ngayTao: "2026-09-12T09:00:00Z",
    ngayGiaoDuKien: "2026-09-19T00:00:00Z",
    trangThai: 3,
    ghiChu: "So sánh giá từ ít nhất 3 nhà cung cấp.",
    khoNhap: {
        tenKho: "Kho trung tâm",
        maKho: "KHO-TT",
        diaChi: "123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
        quanLy: { hoTen: "Nguyễn Văn An" },
    },
    nguoiTao: { hoTen: "Trần Thị Bích", email: "bich.tt@example.com" },
    nguoiDuyet: { hoTen: "Lê Văn Cường", email: "cuong.lv@example.com" },
    donMuaHangs: [
        {
            id: 1,
            trangThai: 1,
            nhaCungCap: {
                tenNhaCungCap: "Công ty TNHH Dệt May Alpha",
                email: "sales@alpha-textile.example.com",
                soDienThoai: "028 7300 1111",
            },
        },
        {
            id: 2,
            trangThai: 1,
            nhaCungCap: {
                tenNhaCungCap: "Công ty CP Vải Sợi Beta",
                email: "contact@beta-fabric.example.com",
                soDienThoai: "028 7300 2222",
            },
        },
        {
            id: 3,
            // Đã nhận báo giá (không dùng trạng thái "Đã xoá" cho dữ liệu mẫu)
            trangThai: 2,
            nhaCungCap: {
                tenNhaCungCap: "Xưởng may Gamma",
                email: "gamma.garment@example.com",
                soDienThoai: "0903 000 333",
            },
        },
    ],
    chiTietYeuCauMuaHangs: [
        {
            id: 1,
            bienTheSanPham: {
                tenSanPham: "Áo thun nam cổ tròn",
                maSku: "ATN-001-WHT-L",
                mauSac: { tenMau: "Trắng" },
                size: { maSize: "L" },
                chatLieu: { tenChatLieu: "Cotton 100%" },
            },
            soLuongDat: 50,
        },
        {
            id: 2,
            bienTheSanPham: {
                tenSanPham: "Quần kaki nam ống đứng",
                maSku: "QK-002-GRY-XL",
                mauSac: { tenMau: "Xám" },
                size: { maSize: "XL" },
                chatLieu: { tenChatLieu: "Kaki 4 chiều" },
            },
            soLuongDat: 20,
        },
    ],
};

/** Đơn mua hàng — shape DonMuaHangDto. */
export const SAMPLE_PURCHASE_ORDER_RAW = {
    id: 0,
    soDonMua: "MẪU-PO-0001",
    ngayDatHang: "2026-09-12T10:00:00Z",
    ngayGiaoDuKien: "2026-09-22T00:00:00Z",
    trangThai: 5,
    tongTien: 13900000,
    ghiChu: "Giao về kho trung tâm, kiểm đếm theo lô.",
    khoNhap: {
        tenKho: "Kho trung tâm",
        maKho: "KHO-TT",
        diaChi: "123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
    },
    nhaCungCap: {
        tenNhaCungCap: "Công ty TNHH Dệt May Alpha",
        maNhaCungCap: "NCC-ALPHA",
        nguoiLienHe: "Ông Hoàng Minh",
        soDienThoai: "0901 234 567",
        email: "sales@alpha-textile.example.com",
        diaChi: "456 Quốc lộ 1A, Quận 12, TP. Hồ Chí Minh",
    },
    nguoiTao: { hoTen: "Trần Thị Bích", email: "bich.tt@example.com" },
    nguoiDuyet: { hoTen: "Lê Văn Cường", email: "cuong.lv@example.com" },
    chiTietDonMuaHangs: [
        {
            id: 1,
            bienTheSanPham: { tenSanPham: "Áo thun nam cổ tròn", maSku: "ATN-001-WHT-L" },
            donGia: 150000,
            soLuongDat: 50,
            thanhTien: 7500000,
        },
        {
            id: 2,
            bienTheSanPham: { tenSanPham: "Quần kaki nam ống đứng", maSku: "QK-002-GRY-XL" },
            donGia: 320000,
            soLuongDat: 20,
            thanhTien: 6400000,
        },
    ],
};

/** Phiếu nhập kho — {detail, lotsByVariantId} như payload của PhieuNhapKhoPrint. */
export const SAMPLE_GOODS_RECEIPT_PAYLOAD = {
    detail: {
        id: 0,
        soPhieuNhap: "MẪU-PNK-0001",
        ngayNhap: "2026-09-15T00:00:00Z",
        trangThai: 3,
        loaiNhap: "Nhập từ đơn mua hàng",
        soDonMua: "MẪU-PO-0001",
        tenKho: "Kho trung tâm",
        tenNhaCungCap: "Công ty TNHH Dệt May Alpha",
        phieuXuatGocId: null,
        tenNguoiNhap: "Nguyễn Văn An",
        items: [
            {
                bienTheSanPhamId: 11,
                tenBienThe: "Áo thun nam cổ tròn / Trắng / L",
                sku: "ATN-001-WHT-L",
                soLuongCanNhap: 50,
                soLuongDaKhaiBao: 50,
            },
            {
                bienTheSanPhamId: 12,
                tenBienThe: "Áo thun nam cổ tròn / Đen / M",
                sku: "ATN-001-BLK-M",
                soLuongCanNhap: 30,
                soLuongDaKhaiBao: 30,
            },
            {
                bienTheSanPhamId: 13,
                tenBienThe: "Quần kaki nam ống đứng / Xám / XL",
                sku: "QK-002-GRY-XL",
                soLuongCanNhap: 20,
                soLuongDaKhaiBao: 20,
            },
        ],
    },
    lotsByVariantId: {
        11: [{ maLo: "LOT-260801", ngaySanXuat: "2026-08-01T00:00:00Z", soLuongNhap: 50 }],
        12: [{ maLo: "LOT-260810", ngaySanXuat: "2026-08-10T00:00:00Z", soLuongNhap: 30 }],
        13: [{ maLo: "LOT-260815", ngaySanXuat: "2026-08-15T00:00:00Z", soLuongNhap: 20 }],
    },
};

/** Phiếu xuất kho — {phieu, chiTiet, pickedLotsByDetailId, lotNameByLotId} như payload của PhieuXuatKhoPrint. */
export const SAMPLE_GOODS_ISSUE_PAYLOAD = {
    phieu: {
        id: 0,
        soPhieuXuat: "MẪU-PXK-0001",
        ngayXuat: "2026-09-16T00:00:00Z",
        trangThai: 3,
        loaiXuat: "ban_hang",
        ghiChu: "Xuất theo đơn bán, pick đủ lô.",
        kho: { tenKho: "Kho trung tâm", maKho: "KHO-TT" },
        donBanHang: { soDonHang: "MẪU-SO-0001" },
        nguoiXuat: { hoTen: "Nguyễn Văn An", email: "an.nv@example.com" },
    },
    chiTiet: [
        {
            id: 101,
            bienTheSanPhamId: 11,
            tenBienThe: "Áo thun nam cổ tròn / Trắng / L",
            sku: "ATN-001-WHT-L",
            soLuongCanXuat: 10,
            soLuongDaPick: 10,
        },
        {
            id: 102,
            bienTheSanPhamId: 13,
            tenBienThe: "Quần kaki nam ống đứng / Xám / XL",
            sku: "QK-002-GRY-XL",
            soLuongCanXuat: 5,
            soLuongDaPick: 5,
        },
    ],
    pickedLotsByDetailId: {
        101: [{ loHangId: 21, soLuongDaPick: 10 }],
        102: [{ loHangId: 23, soLuongDaPick: 5 }],
    },
    lotNameByLotId: {
        21: "LOT-260801",
        23: "LOT-260815",
    },
};

/** Báo giá bán — shape DonBanHangDetailResponse (loaiChungTu báo giá). */
export const SAMPLE_SALES_QUOTATION_RAW = {
    donBanHang: {
        id: 0,
        soDonHang: "MẪU-BG-0001",
        loaiChungTu: "bao_gia",
        khachHang: {
            tenKhachHang: "Shop thời trang Hoa Việt",
            maKhachHang: "KH-0001",
            nguoiLienHe: "Chị Thu Hà",
            soDienThoai: "0908 555 010",
            email: "thuha@hoaviet.example.com",
            diaChi: "789 Lê Văn Sỹ, Quận 3, TP. Hồ Chí Minh",
        },
        ngayDatHang: "2026-09-12T11:00:00Z",
        diaChiGiaoHang: "12 Trần Quang Khải, Quận 1, TP. Hồ Chí Minh",
        trangThai: 0,
        tienHang: 4250000,
        phiVanChuyen: 50000,
        tongCong: 4300000,
        ghiChu: "Báo giá có hiệu lực 30 ngày kể từ ngày lập.",
        nguoiTao: {
            hoTen: "Phạm Quốc Huy",
            email: "huy.pq@example.com",
            soDienThoai: "0909 000 009",
        },
    },
    chiTiet: [
        {
            tenSanPham: "Áo thun nam cổ tròn / Trắng",
            sku: "ATN-001-WHT-L",
            donGia: 200000,
            soLuongDat: 10,
            thanhTien: 2000000,
        },
        {
            tenSanPham: "Quần kaki nam ống đứng / Xám",
            sku: "QK-002-GRY-XL",
            donGia: 450000,
            soLuongDat: 5,
            thanhTien: 2250000,
        },
    ],
};

/** Hóa đơn bán hàng — shape DonBanHangDetailResponse (loaiChungTu hóa đơn). */
export const SAMPLE_SALES_INVOICE_RAW = {
    donBanHang: {
        id: 0,
        soDonHang: "MẪU-HD-0001",
        loaiChungTu: "hoa_don",
        khachHang: {
            tenKhachHang: "Shop thời trang Hoa Việt",
            maKhachHang: "KH-0001",
            nguoiLienHe: "Chị Thu Hà",
            soDienThoai: "0908 555 010",
            email: "thuha@hoaviet.example.com",
            diaChi: "789 Lê Văn Sỹ, Quận 3, TP. Hồ Chí Minh",
        },
        ngayDatHang: "2026-09-16T14:00:00Z",
        diaChiGiaoHang: "12 Trần Quang Khải, Quận 1, TP. Hồ Chí Minh",
        // Hoàn thành + đã thanh toán — hợp cho cả hoá đơn A4 lẫn phiếu POS K80
        trangThai: 5,
        trangThaiThanhToan: "da_thanh_toan",
        tienHang: 4250000,
        phiVanChuyen: 50000,
        tongCong: 4300000,
        ghiChu: "Cảm ơn quý khách đã mua hàng.",
        nguoiTao: {
            hoTen: "Phạm Quốc Huy",
            email: "huy.pq@example.com",
            soDienThoai: "0909 000 009",
        },
    },
    chiTiet: [
        {
            tenSanPham: "Áo thun nam cổ tròn / Trắng",
            sku: "ATN-001-WHT-L",
            donGia: 200000,
            soLuongDat: 10,
            thanhTien: 2000000,
        },
        {
            tenSanPham: "Quần kaki nam ống đứng / Xám",
            sku: "QK-002-GRY-XL",
            donGia: 450000,
            soLuongDat: 5,
            thanhTien: 2250000,
        },
    ],
};

/**
 * Lấy model mẫu cho bản xem trước của một loại chứng từ.
 * MỌI loại đều đi qua đúng adapter của bản in thật — preview không thể
 * che giấu lỗi mapping giữa schema và adapter.
 */
export function getSamplePrintModel(documentType) {
    switch (documentType) {
        case "purchase_request":
            return toPurchaseRequestPrintModel(SAMPLE_PURCHASE_REQUEST_RAW);
        case "quotation_request":
            return toQuotationRequestPrintModel(SAMPLE_QUOTATION_REQUEST_RAW);
        case "purchase_order":
            return toPurchaseOrderPrintModel(SAMPLE_PURCHASE_ORDER_RAW);
        case "goods_receipt":
            return toGoodsReceiptPrintModel(SAMPLE_GOODS_RECEIPT_PAYLOAD);
        case "goods_issue":
            return toGoodsIssuePrintModel(SAMPLE_GOODS_ISSUE_PAYLOAD);
        case "sales_quotation":
            return toSalesQuotationPrintModel(SAMPLE_SALES_QUOTATION_RAW);
        case "sales_invoice":
            return toSalesInvoicePrintModel(SAMPLE_SALES_INVOICE_RAW);
        default:
            return null;
    }
}
