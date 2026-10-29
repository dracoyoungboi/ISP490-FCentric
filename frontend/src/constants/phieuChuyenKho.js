// Đường dẫn tương đối để logic thuần của màn chuyển kho chạy được bằng `node --test`
import { trangThaiLa } from "./trangThaiChung.js";

/**
 * Trạng thái PHIẾU CHUYỂN KHO NỘI BỘ (bảng phieu_chuyen_kho, đặc tả BA UC-7.1) — nguồn tên duy nhất cho danh sách và
 * chi tiết. Tên theo màn mẫu của BA; màu thẻ tra theo tên ở constants/trangThai.js (quy trình `chuyenKho`).
 *
 * Luồng: Chờ duyệt → Đã duyệt (có lệnh điều động, chờ xuất) → Đang vận chuyển → Hoàn tất, hoặc → Chờ xử lý chênh lệch
 * (nhận thiếu / hỏng) → Hoàn tất (có chênh lệch); Đã hủy ở mọi bước trước khi nhận.
 */
export const TT_CHUYEN = Object.freeze({
    CHO_DUYET: "CHO_DUYET",
    DA_DUYET: "DA_DUYET",
    DANG_VAN_CHUYEN: "DANG_VAN_CHUYEN",
    CHO_XU_LY_LECH: "CHO_XU_LY_LECH",
    HOAN_TAT: "HOAN_TAT",
    DA_HUY: "DA_HUY",
});

export const PHIEU_CHUYEN_KHO_STATUS = {
    CHO_DUYET: { label: "Chờ duyệt" },
    DA_DUYET: { label: "Đã duyệt" },
    DANG_VAN_CHUYEN: { label: "Đang vận chuyển" },
    CHO_XU_LY_LECH: { label: "Chờ xử lý chênh lệch" },
    HOAN_TAT: { label: "Hoàn tất" },
    HOAN_TAT_CHENH_LECH: { label: "Hoàn tất (có chênh lệch)" },
    DA_HUY: { label: "Đã hủy" },
};

/** Thẻ trạng thái: phiếu hoàn tất bằng ghi giảm / giao bù chênh lệch (`coChenhLech`) có nhãn riêng. */
export function getPhieuChuyenKhoStatus(trangThai, coChenhLech = false) {
    if (trangThai === TT_CHUYEN.HOAN_TAT && coChenhLech) return PHIEU_CHUYEN_KHO_STATUS.HOAN_TAT_CHENH_LECH;
    return PHIEU_CHUYEN_KHO_STATUS[trangThai] ?? trangThaiLa(trangThai);
}

/**
 * Tab của danh sách (B.6), cùng mã với máy chủ (`tab`). `ma` là giá trị trên đường dẫn `?trangThai=`;
 * `canhBao`: tab việc cần xử lý, số > 0 thì tô màu.
 */
export const PHIEU_CHUYEN_KHO_TABS = [
    { ma: "tat-ca", tab: "TAT_CA", label: "Tất cả" },
    { ma: "cho-duyet", tab: "CHO_DUYET", label: "Chờ duyệt" },
    { ma: "dang-van-chuyen", tab: "DANG_VAN_CHUYEN", label: "Đang vận chuyển" },
    { ma: "tre-hen", tab: "TRE_HEN", label: "Trễ hẹn", canhBao: true },
    { ma: "cho-xu-ly-chenh-lech", tab: "CHO_XU_LY_LECH", label: "Chờ xử lý chênh lệch", canhBao: true },
    { ma: "thieu-giay-di-duong", tab: "THIEU_XKNB", label: "Thiếu giấy đi đường", canhBao: true },
];

/** Đường dẫn cũ `?trangThai=cho-xuat-hang` (Tổng quan) → lọc trạng thái Đã duyệt ở tab Tất cả. */
export const LOC_TRANG_THAI_THEO_DUONG_DAN = { "cho-xuat-hang": TT_CHUYEN.DA_DUYET, "da-duyet": TT_CHUYEN.DA_DUYET };

/** Lý do điều động (B.2). "Khác" bắt buộc ghi chú. */
export const LY_DO_DIEU_DONG = [
    { ma: "BO_SUNG", nhan: "Bổ sung hàng bán" },
    { ma: "CAN_BANG", nhan: "Cân bằng tồn giữa các kho" },
    { ma: "TRA_VE", nhan: "Trả về Kho tổng" },
    { ma: "KHAC", nhan: "Khác" },
];

/** Hình thức vận chuyển (B.3). */
export const HINH_THUC_VAN_CHUYEN = [
    { ma: "XE_CONG_TY", nhan: "Xe của công ty" },
    { ma: "THUE_NGOAI", nhan: "Thuê ngoài" },
    { ma: "CHUYEN_PHAT", nhan: "Chuyển phát" },
];

/** Phương án xử lý chênh lệch (bước 5). */
export const PHUONG_AN_CHENH_LECH = [
    { ma: "GHI_GIAM_HAO_HUT", nhan: "Ghi giảm hao hụt", moTa: "Lập phiếu điều chỉnh kho trừ phần thiếu, hỏng khỏi kho trung chuyển. Phiếu đóng với số đã nhận." },
    { ma: "GIAO_BU_HANG", nhan: "Giao bù hàng", moTa: "Ghi giảm phần thiếu, hỏng như trên rồi lập phiếu chuyển mới cho đúng phần đó (Chờ duyệt)." },
];

/** Chế độ khi xác nhận xuất mà chưa có số phiếu XKNB (Cấu hình > Chứng từ). */
export const XKNB_CHE_DO = Object.freeze({ CHAN: "CHAN", CHI_CANH_BAO: "CHI_CANH_BAO" });

export const tenTheoMa = (ds, ma) => ds.find((x) => x.ma === ma)?.nhan ?? ma ?? "";

/** Ký hiệu XKNB: 6 + C/K + 2 số năm + N + 2 ký tự; số: 7 chữ số; SĐT di động Việt Nam. */
export const KY_HIEU_XKNB_RE = /^6[CK][0-9]{2}N[A-Z0-9]{2}$/;
export const SO_XKNB_RE = /^[0-9]{7}$/;
export const SDT_RE = /^0[35789][0-9]{8}$/;
