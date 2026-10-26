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
import { LazadaMenuIcon, ShopifyMenuIcon, TaiQuayMenuIcon, TiktokMenuIcon } from "@/components/channel/ChannelLogo";
import { SAN_BAN_HANG } from "@/constants/channel";

const ICON_MENU_SAN = { SHOPIFY: ShopifyMenuIcon, LAZADA: LazadaMenuIcon, TIKTOK: TiktokMenuIcon };
import { SETTINGS_PAGES, SETTINGS_ROLES } from "@/components/settings/settings.config";
import { canKho } from "@/components/nguoi-dung/phanQuyen";

// Nhóm hiển thị trên sidebar — thứ tự khai báo cũng là thứ tự render.
// Label chỉ hiển thị khi sidebar mở rộng; khi thu gọn chỉ còn divider + khoảng cách.
// label = null nghĩa là nhóm không có tiêu đề: các nhóm nghiệp vụ một chữ (Sản phẩm, Mua hàng…) tự giải thích nên
// không cần tiêu đề; chỉ khu kênh bán hàng có tiêu đề.
// Mục thuộc SIDEBAR_FOOTER_SECTION không nằm trong danh sách nhóm mà được ghim ở đáy sidebar.
export const SIDEBAR_FOOTER_SECTION = "footer";

/**
 * Vai trò làm theo kho mà không có mục Cấu hình (nhân viên kho, bán hàng, mua hàng): đáy sidebar hiện ô
 * "Kho làm việc" thay cho mục Cấu hình, nên các trang không cần vẽ thêm ô chọn kho riêng.
 */
export function hienKhoLamViecODaySidebar(role) {
  return canKho(role) && !SETTINGS_ROLES.includes(role);
}

/**
 * `anTieuDeKhiMotMuc`: vai trò chỉ thấy đúng một mục trong nhóm (vd. nhân viên bán hàng chỉ có "Bán hàng tại quầy")
 * thì ẩn tiêu đề nhóm, chỉ giữ đường kẻ — một tiêu đề cho một dòng là thừa.
 */
export const SIDEBAR_SECTIONS = [
  { key: "overview", label: null },
  { key: "main", label: null },
  { key: "channels", label: "KÊNH BÁN HÀNG", anTieuDeKhiMotMuc: true },
];

/**
 * Nhóm mở sẵn khi vào Tổng quan (chưa đứng ở trang nào thuộc nhóm), theo nhãn nhóm: mỗi vai trò thấy ngay việc chính
 * của mình. Đứng ở một trang thì nhóm chứa trang đó mở như cũ.
 */
export const NHOM_MO_SAN_THEO_VAI_TRO = {
  quan_ly_kho: "Kho hàng",
  nhan_vien_kho: "Kho hàng",
  nhan_vien_mua_hang: "Mua hàng",
  nhan_vien_ban_hang: "Bán hàng",
};

const TAT_CA_VAI_TRO = [
  "quan_tri_vien",
  "quan_ly_kho",
  "nhan_vien_kho",
  "nhan_vien_mua_hang",
  "nhan_vien_ban_hang",
];
const VAI_TRO_KHO = ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"];

// Mục con khai báo `nhom` ("chung-tu" | "du-lieu"): BackofficeSidebar kẻ một đường mảnh giữa chứng từ và dữ liệu gốc
// (nhà cung cấp, khách hàng, kho, vị trí kệ). Mỗi nhóm tối đa một đường kẻ.
const CHUNG_TU = "chung-tu";
const DU_LIEU = "du-lieu";

export const SIDEBAR_MENU = [
  // ================= TỔNG QUAN =================
  {
    label: "Tổng quan",
    icon: LayoutDashboard,
    section: "overview",
    to: "/dashboard",
    roles: TAT_CA_VAI_TRO,
  },

  // ================= NGƯỜI DÙNG (chỉ quản trị viên, ngay dưới Tổng quan) =================
  {
    label: "Người dùng",
    icon: User,
    section: "overview",
    to: "/users",
    roles: ["quan_tri_vien"],
  },

  // ================= SẢN PHẨM =================
  {
    label: "Sản phẩm",
    icon: Package,
    section: "main",
    roles: TAT_CA_VAI_TRO,
    children: [
      {
        // Khác tên nhóm "Sản phẩm"; tiêu đề trang vẫn là "Sản phẩm"
        label: "Danh sách sản phẩm",
        to: "/products",
        // /products/gia-ban-tem thuộc mục "Giá bán & tem mã vạch"
        match: (path) => path === "/products" || (path.startsWith("/products/") && !path.startsWith("/products/gia-ban-tem")),
      },
      {
        label: "Giá bán & tem mã vạch",
        to: "/products/gia-ban-tem",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      { label: "Danh mục", to: "/categories" },
      { label: "Thuộc tính", to: "/attributes" },
    ],
  },

  // ================= MUA HÀNG =================
  {
    label: "Mua hàng",
    icon: ArrowDownToLine,
    section: "main",
    roles: [
      "quan_tri_vien",
      "quan_ly_kho",
      "nhan_vien_mua_hang",
      "nhan_vien_kho",
    ],
    children: [
      {
        label: "Yêu cầu nhập hàng",
        to: "/purchase-requests",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"],
      },
      {
        label: "Yêu cầu báo giá",
        to: "/quotation-requests",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "nhan_vien_mua_hang"],
      },
      {
        label: "Đơn mua hàng",
        to: "/purchase-orders",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_mua_hang", "nhan_vien_kho"],
      },
      {
        label: "Nhà cung cấp",
        to: "/supplier",
        nhom: DU_LIEU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_mua_hang"],
      },
      // FO-095: tra mã vạch trên tem NCC ↔ biến thể (liên kết tạo khi kiểm đếm hàng nhập)
      {
        // Nhãn ngắn cho vừa sidebar; tiêu đề trang vẫn ghi đầy đủ "Mã vạch nhà cung cấp"
        label: "Mã vạch NCC",
        to: "/supplier-barcodes",
        nhom: DU_LIEU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"],
      },
    ],
  },

  // ================= KHO HÀNG (nhập, xuất, nội bộ, thiết lập kho) =================
  {
    label: "Kho hàng",
    icon: Warehouse,
    section: "main",
    roles: VAI_TRO_KHO,
    children: [
      { label: "Phiếu nhập kho", to: "/goods-receipts", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      // Xuất kho theo Pick List (FO-045–047): Đơn chờ xuất → Pick List → Phiếu xuất kho
      { label: "Đơn chờ xuất", to: "/goods-issues/pending-orders", nhom: CHUNG_TU },
      { label: "Phiếu nhặt hàng", to: "/goods-issues/pick-lists", nhom: CHUNG_TU },
      {
        label: "Phiếu xuất kho",
        to: "/goods-issues",
        nhom: CHUNG_TU,
        match: (path) =>
          path.startsWith("/goods-issues") &&
          !path.startsWith("/goods-issues/pending-orders") &&
          !path.startsWith("/goods-issues/pick-lists"),
      },
      { label: "Chuyển kho nội bộ", to: "/transfer-tickets", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      { label: "Kiểm kê", to: "/stock-take", nhom: CHUNG_TU },
      {
        label: "Danh sách kho",
        to: "/warehouse",
        nhom: DU_LIEU,
        // /warehouse/locations thuộc mục "Vị trí kệ"
        match: (path) => path === "/warehouse",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      // FO-094: khu vực, vị trí kệ và mặt bằng kho
      { label: "Vị trí kệ", to: "/warehouse/locations", nhom: DU_LIEU, roles: VAI_TRO_KHO },
    ],
  },

  // ================= BÁN HÀNG =================
  {
    label: "Bán hàng",
    icon: ShoppingCart,
    section: "main",
    roles: [
      "quan_tri_vien",
      "nhan_vien_ban_hang", "nhan_vien_kho", "quan_ly_kho"
    ],
    children: [
      {
        label: "Báo giá",
        to: "/sales-quotations",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
      {
        label: "Đơn bán hàng",
        to: "/sales-orders",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "nhan_vien_ban_hang", "nhan_vien_kho", "quan_ly_kho"],
      },
      {
        // Giao dịch chuyển khoản tại quầy; quản trị viên xử lý giao dịch đã nhận tiền nhưng chưa có đơn.
        // badge: số giao dịch cần xử lý (BackofficeSidebar đọc từ components/pos/payosCanXuLy)
        label: "Đối soát chuyển khoản",
        to: "/pos-transfers",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien"],
        badge: "payosCanXuLy",
      },
      {
        label: "Khách hàng",
        to: "/customers",
        nhom: DU_LIEU,
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
    ],
  },

  // ================= BÁO CÁO =================
  {
    label: "Báo cáo",
    icon: BarChart3,
    section: "main",
    roles: TAT_CA_VAI_TRO,
    children: [
      {
        label: "Báo cáo doanh thu",
        to: "/reports/revenue",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      {
        label: "Báo cáo tồn kho",
        to: "/reports/inventory",
        roles: TAT_CA_VAI_TRO,
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
        roles: VAI_TRO_KHO,
      },
    ],
  },

  // ================= KÊNH BÁN HÀNG (omnichannel, FO-073–077) =================
  // "Tất cả kênh" không vẽ thành dòng menu mà thành nút "+" cạnh tiêu đề KÊNH BÁN HÀNG (`hienThi: "nut-them"`).
  // Mục vẫn khai báo ở đây để phân quyền, "Quyền của tôi" và tìm kiếm toàn hệ thống đếm đủ màn hình.
  {
    label: "Tất cả kênh",
    icon: Store,
    section: "channels",
    hienThi: "nut-them",
    nhanNut: "Kết nối kênh bán hàng",
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
  // Bán tại quầy là một kênh bán (như các sàn), luôn có sẵn nên đứng đầu; link thẳng mở màn POS toàn màn hình.
  // POS V1: chỉ admin + nhân viên bán hàng (quyết định mở rộng role ở Phase 03+)
  {
    label: "Bán hàng tại quầy",
    icon: TaiQuayMenuIcon,
    section: "channels",
    to: "/pos",
    roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
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
