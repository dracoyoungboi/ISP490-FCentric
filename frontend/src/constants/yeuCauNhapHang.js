import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái YÊU CẦU NHẬP HÀNG (bảng yeu_cau_mua_hang) — nguồn tên duy nhất cho danh sách,
 * chi tiết và bản in, để một trạng thái chỉ có một tên trên toàn hệ thống
 * (báo cáo review bố cục danh sách 13/10, mục 5 và việc chốt C1).
 *
 * 3 và 5 trước đây cùng hiện "Đã chuyển thành báo giá"; nay dùng đúng tên của trang Yêu cầu báo giá.
 * Màu thẻ tra theo tên ở constants/trangThai.js.
 */
export const YEU_CAU_NHAP_HANG_STATUS = {
    0: { label: "Nháp" },
    1: { label: "Chờ duyệt" },
    2: { label: "Đã duyệt" },
    3: { label: "Đã gửi yêu cầu báo giá" },
    4: { label: "Từ chối" },
    5: { label: "Đã chuyển thành đơn mua hàng" },
};

/**
 * Tab của trang danh sách (C1: gộp 3 và 5 thành một tab như SRS 4.3.1; nhãn từng dòng vẫn tách).
 * `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const YEU_CAU_NHAP_HANG_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "cho-duyet", label: "Chờ duyệt", trangThai: [1] },
    { ma: "da-duyet", label: "Đã duyệt", trangThai: [2] },
    { ma: "da-chuyen-bao-gia", label: "Đã chuyển báo giá", trangThai: [3, 5] },
    { ma: "tu-choi", label: "Từ chối", trangThai: [4] },
];

export function getYeuCauNhapHangStatus(trangThai) {
    return YEU_CAU_NHAP_HANG_STATUS[trangThai] ?? trangThaiLa(trangThai);
}

/**
 * Tab của trang Yêu cầu báo giá (cùng bảng yeu_cau_mua_hang, chỉ trạng thái 3 và 5):
 * "Tất cả" vẫn chỉ gồm 3 và 5 như trang đang lọc. `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const YEU_CAU_BAO_GIA_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: [3, 5] },
    { ma: "da-gui-yeu-cau-bao-gia", label: YEU_CAU_NHAP_HANG_STATUS[3].label, trangThai: [3] },
    { ma: "da-chuyen-don-mua-hang", label: YEU_CAU_NHAP_HANG_STATUS[5].label, trangThai: [5] },
];
