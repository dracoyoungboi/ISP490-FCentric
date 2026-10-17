import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái PHIẾU CHUYỂN KHO NỘI BỘ (phiếu xuất loại `khac`) — nguồn tên duy nhất cho danh sách
 * và chi tiết, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Luồng: 0 Nháp → 1 Chờ duyệt → 2 Chờ xuất hàng → 3 Đang vận chuyển → 5 Hoàn thành; 4 Đã hủy.
 * Mã 5 dùng "Hoàn thành" như Đơn bán, Kiểm kê (trước là "Hoàn tất"). Màu thẻ tra theo tên ở constants/trangThai.js.
 */
export const PHIEU_CHUYEN_KHO_STATUS = {
    0: { label: "Nháp" },
    1: { label: "Chờ duyệt" },
    2: { label: "Chờ xuất hàng" },
    3: { label: "Đang vận chuyển" },
    4: { label: "Đã hủy" },
    5: { label: "Hoàn thành" },
};

/** Tab của trang danh sách theo luồng nghiệp vụ, Đã hủy cuối. `ma` là giá trị trên đường dẫn `?trangThai=`. */
export const PHIEU_CHUYEN_KHO_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "nhap", label: "Nháp", trangThai: 0 },
    { ma: "cho-duyet", label: "Chờ duyệt", trangThai: 1 },
    { ma: "cho-xuat-hang", label: "Chờ xuất hàng", trangThai: 2 },
    { ma: "dang-van-chuyen", label: "Đang vận chuyển", trangThai: 3 },
    { ma: "hoan-tat", label: "Hoàn thành", trangThai: 5 },
    { ma: "da-huy", label: "Đã hủy", trangThai: 4 },
];

export function getPhieuChuyenKhoStatus(trangThai) {
    return PHIEU_CHUYEN_KHO_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
