import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái PHIẾU CHUYỂN KHO NỘI BỘ (phiếu xuất loại `khac`) — nguồn tên duy nhất cho danh sách
 * và chi tiết, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Luồng: 0 Nháp → 1 Chờ duyệt → 2 Chờ xuất hàng → 3 Đang vận chuyển → 5 Hoàn tất; 4 Đã hủy.
 * `tone` khớp tone của StatusBadge (giữ như đang dùng ở danh sách).
 */
export const PHIEU_CHUYEN_KHO_STATUS = {
    0: { label: "Nháp", tone: "warning" },
    1: { label: "Chờ duyệt", tone: "info" },
    2: {
        label: "Chờ xuất hàng",
        tone: "info",
        className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    },
    3: {
        label: "Đang vận chuyển",
        tone: "info",
        className: "border-purple-200 bg-purple-50 text-purple-700",
    },
    4: { label: "Đã hủy", tone: "danger" },
    5: { label: "Hoàn tất", tone: "success" },
};

/** Tab của trang danh sách theo luồng nghiệp vụ, Đã hủy cuối. `ma` là giá trị trên đường dẫn `?trangThai=`. */
export const PHIEU_CHUYEN_KHO_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "nhap", label: "Nháp", trangThai: 0 },
    { ma: "cho-duyet", label: "Chờ duyệt", trangThai: 1 },
    { ma: "cho-xuat-hang", label: "Chờ xuất hàng", trangThai: 2 },
    { ma: "dang-van-chuyen", label: "Đang vận chuyển", trangThai: 3 },
    { ma: "hoan-tat", label: "Hoàn tất", trangThai: 5 },
    { ma: "da-huy", label: "Đã hủy", trangThai: 4 },
];

export function getPhieuChuyenKhoStatus(trangThai) {
    return PHIEU_CHUYEN_KHO_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
