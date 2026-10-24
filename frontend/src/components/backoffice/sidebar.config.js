import {
  LayoutDashboard,
  User,
  Package,
  ArrowDownToLine,
  Warehouse,
  ShoppingCart,
  BarChart3,
  Settings,
  Store,
} from "lucide-react";
import { LazadaMenuIcon, ShopifyMenuIcon, TiktokMenuIcon } from "@/components/channel/ChannelLogo";
import { SAN_BAN_HANG } from "@/constants/channel";

const ICON_MENU_SAN = { SHOPIFY: ShopifyMenuIcon, LAZADA: LazadaMenuIcon, TIKTOK: TiktokMenuIcon };
import { SETTINGS_PAGES, SETTINGS_ROLES } from "@/components/settings/settings.config";
import { canKho } from "@/components/nguoi-dung/phanQuyen";

// Nhóm hiển thị trên sidebar — thứ tự khai báo cũng là thứ tự render.
// Label chỉ hiển thị khi sidebar mở rộng; khi thu gọn chỉ còn divider + khoảng cách.
// label = null nghĩa là nhóm không có tiêu đề (vd: Tổng quan đứng độc lập).
// Mục thuộc SIDEBAR_FOOTER_SECTION không nằm trong danh sách nhóm mà được ghim ở đáy sidebar.
export const SIDEBAR_FOOTER_SECTION = "footer";

/**
 * Vai trò làm theo kho mà không có mục Cấu hình (nhân viên kho, bán hàng, mua hàng): đáy sidebar hiện ô
 * "Kho làm việc" thay cho mục Cấu hình, nên các trang không cần vẽ thêm ô chọn kho riêng.
 */
export function hienKhoLamViecODaySidebar(role) {
  return canKho(role) && !SETTINGS_ROLES.includes(role);
}

export const SIDEBAR_SECTIONS = [
  { key: "overview", label: null },
  { key: "management", label: "QUẢN TRỊ" },
  { key: "operations", label: "VẬN HÀNH" },
  { key: "channels", label: "KÊNH BÁN HÀNG" },
  { key: "reports", label: "GIÁM SÁT" },
];

export const SIDEBAR_MENU = [
  // ================= DASHBOARD =================
  {
    label: "Tổng quan",
    icon: LayoutDashboard,
    section: "overview",
    to: "/dashboard",
    roles: [
      "quan_tri_vien",
      "quan_ly_kho",
      "nhan_vien_kho",
      "nhan_vien_mua_hang",
      "nhan_vien_ban_hang",
    ],
  },

  // ================= QUẢN TRỊ HỆ THỐNG =================
  {
    label: "Người dùng",
    icon: User,
    section: "management",
    to: "/users",
    roles: ["quan_tri_vien"],
  },

  // ================= DANH MỤC & SẢN PHẨM =================
  {
    label: "Danh mục & sản phẩm",
    icon: Package,
    section: "management",
    roles: [
      "quan_tri_vien",
      "quan_ly_kho",
      "nhan_vien_kho",
      "nhan_vien_mua_hang",
      "nhan_vien_ban_hang",
    ],
    children: [
      { label: "Danh mục", to: "/categories" },
      { label: "Thuộc tính", to: "/attributes" },
      {
        label: "Sản phẩm",
        to: "/products",
        // /products/gia-ban-tem thuộc mục "Giá bán & tem mã vạch"
        match: (path) => path === "/products" || (path.startsWith("/products/") && !path.startsWith("/products/gia-ban-tem")),
      },
      {
        label: "Giá bán & tem mã vạch",
        to: "/products/gia-ban-tem",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
    ],
  },

  // ================= MUA HÀNG & NHẬP KHO =================
  {
    label: "Mua hàng & nhập kho",
    icon: ArrowDownToLine,
    section: "operations",
    roles: [
      "quan_tri_vien",
      "quan_ly_kho",
      "nhan_vien_mua_hang",
      "nhan_vien_kho",
    ],
    children: [
      {
        label: "Nhà cung cấp",
        to: "/supplier",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_mua_hang"],
      },
      // FO-095: tra mã vạch trên tem NCC ↔ biến thể (liên kết tạo khi kiểm đếm hàng nhập)
      {
        // Nhãn ngắn cho vừa sidebar; tiêu đề trang vẫn ghi đầy đủ "Mã vạch nhà cung cấp"
        label: "Mã vạch NCC",
        to: "/supplier-barcodes",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"],
      },
      {
        label: "Yêu cầu nhập hàng",
        to: "/purchase-requests",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"],
      },
      {
        label: "Yêu cầu báo giá",
        to: "/quotation-requests",
        roles: ["quan_tri_vien", "nhan_vien_mua_hang"],
      },
      {
        label: "Đơn mua hàng",
        to: "/purchase-orders",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_mua_hang", "nhan_vien_kho"],
      },
      {
        label: "Phiếu nhập kho",
        to: "/goods-receipts",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
      },
    ],
  },

  // ================= KHO & XUẤT KHO =================
  {
    label: "Kho & xuất kho",
    icon: Warehouse,
    section: "operations",
    roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
    children: [
      {
        label: "Kho",
        to: "/warehouse",
        // /warehouse/locations thuộc mục "Vị trí kệ"
        match: (path) => path === "/warehouse",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      // FO-094: khu vực, vị trí kệ và mặt bằng kho
      {
        label: "Vị trí kệ",
        to: "/warehouse/locations",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
      },
      // Xuất kho theo Pick List (FO-045–047): Đơn chờ xuất → Pick List → Phiếu xuất kho
      { label: "Đơn chờ xuất", to: "/goods-issues/pending-orders" },
      { label: "Phiếu nhặt hàng", to: "/goods-issues/pick-lists" },
      {
        label: "Phiếu xuất kho",
        to: "/goods-issues",
        match: (path) =>
          path.startsWith("/goods-issues") &&
          !path.startsWith("/goods-issues/pending-orders") &&
          !path.startsWith("/goods-issues/pick-lists"),
      },
      {
        label: "Chuyển kho nội bộ",
        to: "/transfer-tickets",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
      },
      { label: "Kiểm kê", to: "/stock-take" },
    ],
  },

  // ================= BÁN HÀNG & KHÁCH HÀNG =================
  {
    label: "Bán hàng",
    icon: ShoppingCart,
    section: "operations",
    roles: [
      "quan_tri_vien",
      "nhan_vien_ban_hang", "nhan_vien_kho", "quan_ly_kho"
    ],
    children: [
      {
        label: "Khách hàng",
        to: "/customers",
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
      {
        label: "Báo giá",
        to: "/sales-quotations",
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
      {
        label: "Đơn bán hàng",
        to: "/sales-orders",
        roles: ["quan_tri_vien", "nhan_vien_ban_hang", "nhan_vien_kho", "quan_ly_kho"],
      },
      {
        // POS V1: chỉ admin + nhân viên bán hàng (quyết định mở rộng role ở Phase 03+)
        label: "Bán hàng tại quầy",
        to: "/pos",
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
      {
        // Giao dịch chuyển khoản tại quầy; quản trị viên xử lý giao dịch đã nhận tiền nhưng chưa có đơn.
        // badge: số giao dịch cần xử lý (BackofficeSidebar đọc từ components/pos/payosCanXuLy)
        label: "Đối soát chuyển khoản",
        to: "/pos-transfers",
        roles: ["quan_tri_vien"],
        badge: "payosCanXuLy",
      },
    ],
  },

  // ================= KÊNH BÁN HÀNG (omnichannel, FO-073–077) =================
  // Mỗi sàn đã kết nối là một mục riêng có menu con; "Tất cả kênh" để kết nối thêm sàn.
  {
    label: "Tất cả kênh",
    icon: Store,
    section: "channels",
    to: "/channels",
    roles: ["quan_tri_vien"],
    // Trang quay về sau ủy quyền tính vào Tất cả kênh
    match: (path) => path === "/channels" || path.startsWith("/channels/oauth/"),
    // Trang của sàn chưa kết nối (giới thiệu, thiết lập) cũng tính vào Tất cả kênh vì sàn đó chưa có mục riêng;
    // BackofficeSidebar truyền danh sách sàn đã kết nối
    matchKenh: (path, kenhDaKetNoi) =>
      path === "/channels" ||
      path.startsWith("/channels/oauth/") ||
      SAN_BAN_HANG.some((san) => !kenhDaKetNoi.includes(san.maKenh) && (path === san.duongDan || path.startsWith(`${san.duongDan}/`))),
  },
  // Sinh từ SAN_BAN_HANG; `maKenh`: BackofficeSidebar chỉ hiện sàn đã kết nối (danh sách tải ở BackofficeLayout)
  ...SAN_BAN_HANG.filter((san) => san.hoTro).map((san) => ({
    label: san.ten,
    icon: ICON_MENU_SAN[san.maKenh] ?? Store,
    section: "channels",
    roles: ["quan_tri_vien"],
    maKenh: san.maKenh,
    children: [
      {
        label: "Tổng quan",
        to: san.duongDan,
        roles: ["quan_tri_vien"],
        // Chỉ đúng trang Tổng quan. Thiết lập (/channels/<sàn>/setup) không có mục riêng: nhóm sàn vẫn mở,
        // không mục con nào sáng (nhóm đang đóng hoặc menu thu gọn thì cả nhóm được tô như mọi nhóm khác)
        match: (path) => path === san.duongDan,
      },
      { label: "Sản phẩm", to: `${san.duongDan}/products`, roles: ["quan_tri_vien"] },
      { label: "Đơn hàng", to: `${san.duongDan}/orders`, roles: ["quan_tri_vien"] },
      { label: "Cấu hình", to: `${san.duongDan}/settings`, roles: ["quan_tri_vien"] },
    ],
  })),

  // ================= BÁO CÁO & CẢNH BÁO =================
  {
    label: "Báo cáo & cảnh báo",
    icon: BarChart3,
    section: "reports",
    roles: [
      "quan_tri_vien",
      "quan_ly_kho",
      "nhan_vien_kho",
      "nhan_vien_mua_hang",
      "nhan_vien_ban_hang",
    ],
    children: [
      {
        label: "Báo cáo doanh thu",
        to: "/reports/revenue",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      {
        label: "Báo cáo tồn kho",
        to: "/reports/inventory",
        roles: [
          "quan_tri_vien",
          "quan_ly_kho",
          "nhan_vien_kho",
          "nhan_vien_mua_hang",
          "nhan_vien_ban_hang",
        ],
      },
      {
        label: "Báo cáo nhập xuất",
        to: "/reports/stock-movements",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      {
        label: "Báo cáo khách hàng",
        to: "/reports/customers",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      {
        label: "Lịch sử giao dịch kho",
        to: "/inventory-transactions",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
      },
    ],
  },

  // ================= CẤU HÌNH (ghim ở đáy sidebar) =================
  // Mở trung tâm Cấu hình; các trang con (menu trái của SettingsLayout) khai báo ở settings.config.js
  // và được liệt kê ở đây để phân quyền / tìm kiếm toàn hệ thống đếm đủ màn hình.
  {
    label: "Cấu hình",
    icon: Settings,
    section: SIDEBAR_FOOTER_SECTION,
    to: "/settings",
    roles: SETTINGS_ROLES,
    match: (path) => path === "/settings" || path.startsWith("/settings/"),
    children: SETTINGS_PAGES.map(({ label, to, roles }) => ({ label, to, roles })),
  },
];
