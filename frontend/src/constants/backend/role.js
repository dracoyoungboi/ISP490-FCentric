/**
 * Vai trò nhân sự: những vai trò duy nhất của người dùng hệ thống (bảng nguoi_dung). Cùng danh sách với
 * ENUM nguoi_dung.vai_tro và IRoleType.NOI_BO ở backend; mọi màn chọn, lọc hay hiển thị vai trò đều lấy từ đây.
 * Khách hàng không phải người dùng hệ thống (quản lý ở module Khách hàng, bảng khach_hang), nên không có ở đây.
 *
 * Thứ tự cũng là thứ tự hiện trên màn hình: vai trò hay dùng trước, Quản trị viên để cuối để khó chọn nhầm
 * vai trò có toàn quyền.
 */
export const ROLES = [
  {
    value: "nhan_vien_kho",
    label: "Nhân viên kho",
    moTa: "Nhập, xuất, chuyển và kiểm hàng tại kho được phân.",
  },
  {
    value: "quan_ly_kho",
    label: "Quản lý kho",
    moTa: "Phụ trách một kho: duyệt phiếu, phân việc, xem báo cáo kho.",
  },
  {
    value: "nhan_vien_ban_hang",
    label: "Nhân viên bán hàng",
    moTa: "Bán tại quầy, báo giá và đơn bán cho khách.",
  },
  {
    value: "nhan_vien_mua_hang",
    label: "Nhân viên mua hàng",
    moTa: "Yêu cầu báo giá, đặt hàng và theo dõi nhà cung cấp.",
  },
  {
    value: "quan_tri_vien",
    label: "Quản trị viên",
    moTa: "Chủ cửa hàng, người quản lý hệ thống. Toàn quyền ở mọi kho.",
  },
];
