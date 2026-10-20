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
 * Ngày chỉ có phần ngày (ngày giao dự kiến, ngày sản xuất) dùng dạng "YYYY-MM-DD"
 * như API LocalDate; mốc thời gian dùng ISO có múi giờ như API Instant.
 * Dữ liệu mẫu phải NHẤT QUÁN về nghiệp vụ (vd. đã có người duyệt thì trạng
 * thái là "Đã duyệt") để người cấu hình thấy đúng bố cục phiếu thật.
 */

export const SAMPLE_PURCHASE_REQUEST_RAW = {
    id: 0,
    soYeuCauMuaHang: "MẪU-PR-0001",
    ngayTao: "2026-09-12T08:30:00Z",
    ngayGiaoDuKien: "2026-09-20",
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
    ngayGiaoDuKien: "2026-09-19",
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
    ngayGiaoDuKien: "2026-09-22",
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
    yeuCauMuaHang: { id: 0, soYeuCauMuaHang: "MẪU-PR-0001" },
    nguoiTao: { hoTen: "Trần Thị Bích", email: "bich.tt@example.com" },
    nguoiDuyet: { hoTen: "Lê Văn Cường", email: "cuong.lv@example.com" },
    chiTietDonMuaHangs: [
        {
            id: 1,
            bienTheSanPham: {
                tenSanPham: "Áo thun nam cổ tròn",
                maSku: "ATN-001-WHT-L",
                mauSac: { tenMau: "Trắng" },
                size: { maSize: "L" },
            },
            donGia: 150000,
            soLuongDat: 50,
            thanhTien: 7500000,
        },
        {
            id: 2,
            bienTheSanPham: {
                tenSanPham: "Quần kaki nam ống đứng",
                maSku: "QK-002-GRY-XL",
                mauSac: { tenMau: "Xám" },
                size: { maSize: "XL" },
            },
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
        tenNguoiDuyet: "Lê Văn Cường",
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
        // Một dòng hàng nhận làm hai lô — bản in gom về một dòng, liệt kê từng lô
        11: [
            { maLo: "LOT-260801", ngaySanXuat: "2026-08-01", soLuongNhap: 30, soLuongLoi: 0 },
            { maLo: "LOT-260805", ngaySanXuat: "2026-08-05", soLuongNhap: 20, soLuongLoi: 0 },
        ],
        12: [{ maLo: "LOT-260810", ngaySanXuat: "2026-08-10", soLuongNhap: 30, soLuongLoi: 0 }],
        13: [{ maLo: "LOT-260815", ngaySanXuat: "2026-08-15", soLuongNhap: 20, soLuongLoi: 0 }],
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
        ghiChu: "Xuất theo đơn bán, lấy đủ lô.",
        ngayTao: "2026-09-16T01:00:00Z",
        kho: {
            tenKho: "Kho trung tâm",
            maKho: "KHO-TT",
            diaChi: "123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
        },
        donBanHang: {
            soDonHang: "MẪU-SO-0001",
            diaChiGiaoHang: "12 Trần Quang Khải, Quận 1, TP. Hồ Chí Minh",
            khachHang: { tenKhachHang: "Shop thời trang Hoa Việt", soDienThoai: "0908 555 010" },
        },
        nguoiXuat: { hoTen: "Nguyễn Văn An", email: "an.nv@example.com" },
        nguoiDuyet: { hoTen: "Lê Văn Cường", email: "cuong.lv@example.com" },
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
            // API đơn bán che số điện thoại khách (MaskingUtils, SRS 8.1.1) — bản in thật cũng vậy
            soDienThoai: "09***010",
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
            tenSanPham: "Áo thun nam cổ tròn / Trắng / L",
            sku: "ATN-001-WHT-L",
            donGia: 200000,
            soLuongDat: 10,
            thanhTien: 2000000,
        },
        {
            tenSanPham: "Quần kaki nam ống đứng / Xám / XL",
            sku: "QK-002-GRY-XL",
            donGia: 450000,
            soLuongDat: 5,
            thanhTien: 2250000,
        },
    ],
};

/**
 * Hóa đơn bán hàng khổ tờ (A4/A5) — shape DonBanHangDetailResponse (loaiChungTu "don_ban_hang").
 * CÙNG đơn với phiếu xuất kho mẫu MẪU-PXK-0001 (khách, hàng, địa chỉ giao, kho): đơn bán
 * thường giao tận nơi, đã xuất kho, khách đã chuyển khoản trước.
 */
export const SAMPLE_SALES_INVOICE_RAW = {
    donBanHang: {
        id: 0,
        soDonHang: "MẪU-SO-0001",
        loaiChungTu: "don_ban_hang",
        khachHang: {
            tenKhachHang: "Shop thời trang Hoa Việt",
            maKhachHang: "KH-0001",
            maSoThue: "0318765432",
            nguoiLienHe: "Chị Thu Hà",
            // API đơn bán che số điện thoại khách (MaskingUtils, SRS 8.1.1) — bản in thật cũng vậy
            soDienThoai: "09***010",
            email: "thuha@hoaviet.example.com",
            diaChi: "789 Lê Văn Sỹ, Quận 3, TP. Hồ Chí Minh",
            loaiKhachHang: "si",
        },
        khoXuat: { tenKho: "Kho trung tâm", maKho: "KHO-TT" },
        // Đặt 15/09 lúc 09:30 (giờ VN), xuất kho 16/09 — trước ngày của phiếu xuất mẫu
        ngayDatHang: "2026-09-15T02:30:00Z",
        diaChiGiaoHang: "12 Trần Quang Khải, Quận 1, TP. Hồ Chí Minh",
        trangThai: 3,
        trangThaiThanhToan: "da_thanh_toan",
        tienHang: 4250000,
        phiVanChuyen: 50000,
        tongCong: 4300000,
        ghiChu: "Giao giờ hành chính, gọi chị Thu Hà trước khi giao.",
        nguoiTao: {
            hoTen: "Phạm Quốc Huy",
            email: "huy.pq@example.com",
            soDienThoai: "0909 000 009",
        },
        // Đơn bán thường (không qua sàn, không bán tại quầy) — không in dòng Kênh bán
        kenhBanHang: null,
        maDonHangKenh: null,
    },
    chiTiet: [
        {
            tenSanPham: "Áo thun nam cổ tròn / Trắng / L",
            sku: "ATN-001-WHT-L",
            donViTinh: "Cái",
            donGia: 200000,
            soLuongDat: 10,
            thanhTien: 2000000,
            ghiChu: "Đóng túi riêng từng chiếc",
        },
        {
            tenSanPham: "Quần kaki nam ống đứng / Xám / XL",
            sku: "QK-002-GRY-XL",
            donViTinh: "Cái",
            donGia: 450000,
            soLuongDat: 5,
            thanhTien: 2250000,
        },
    ],
    // Không bán tại quầy -> không có sổ thu POS
    thanhToanTaiQuay: null,
};

/**
 * Hóa đơn bán hàng tại quầy (K80 / K57) — đơn bán tại quầy: khách mua mang về, trả tiền mặt,
 * có tiền khách đưa và tiền thừa (sổ thu POS); không phí vận chuyển, không địa chỉ giao.
 */
export const SAMPLE_POS_INVOICE_RAW = {
    donBanHang: {
        id: 0,
        soDonHang: "MẪU-SO-0002",
        loaiChungTu: "don_ban_hang",
        khachHang: {
            tenKhachHang: "Nguyễn Minh Anh",
            maKhachHang: "KH-0102",
            soDienThoai: "09***789",
            loaiKhachHang: "le",
        },
        khoXuat: { tenKho: "Cửa hàng Quận 1", maKho: "CH-Q1" },
        // Bán lúc 14:42 ngày 16/09 (giờ VN)
        ngayDatHang: "2026-09-16T07:42:00Z",
        diaChiGiaoHang: null,
        trangThai: 5,
        trangThaiThanhToan: "da_thanh_toan",
        tienHang: 850000,
        phiVanChuyen: 0,
        tongCong: 850000,
        ghiChu: null,
        nguoiTao: { hoTen: "Trần Thị Mai", email: "mai.tt@example.com" },
        kenhBanHang: { id: 1, maKenh: "POS", tenKenh: "POS" },
        maDonHangKenh: null,
    },
    chiTiet: [
        {
            tenSanPham: "Áo thun nam cổ tròn / Đen / M",
            sku: "ATN-001-BLK-M",
            donViTinh: "Cái",
            donGia: 200000,
            soLuongDat: 2,
            thanhTien: 400000,
        },
        {
            tenSanPham: "Quần kaki nam ống đứng / Xám / XL",
            sku: "QK-002-GRY-XL",
            donViTinh: "Cái",
            donGia: 450000,
            soLuongDat: 1,
            thanhTien: 450000,
        },
    ],
    thanhToanTaiQuay: {
        phuongThuc: "CASH",
        soTienThu: 1000000,
        soTienThua: 150000,
        ngayThu: "2026-09-16T07:43:10Z",
    },
};

/**
 * Lấy model mẫu cho bản xem trước của một loại chứng từ: hóa đơn in từ đơn bán
 * dùng đơn giao hàng, hóa đơn tại quầy dùng đơn bán tại quầy (cùng adapter thật).
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
        case "pos_invoice":
            return toSalesInvoicePrintModel(SAMPLE_POS_INVOICE_RAW);
        default:
            return null;
    }
}
