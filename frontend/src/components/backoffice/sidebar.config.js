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
import {
  LazadaMenuIcon,
  LazadaSandboxMenuIcon,
  ShopeeMenuIcon,
  ShopifyMenuIcon,
  TaiQuayMenuIcon,
  TiktokMenuIcon,
} from "@/components/channel/ChannelLogo";
import { SAN_BAN_HANG } from "@/constants/channel";

const ICON_MENU_SAN = {
  SHOPIFY: ShopifyMenuIcon,
  LAZADA: LazadaMenuIcon,
  LAZADA_SANDBOX: LazadaSandboxMenuIcon,
  TIKTOK: TiktokMenuIcon,
  SHOPEE: ShopeeMenuIcon,
  SHOPEE_OFFICIAL: ShopeeMenuIcon,
  SHOPEE_SANDBOX: ShopeeMenuIcon,
};
import { SETTINGS_PAGES, SETTINGS_ROLES } from "@/components/settings/settings.config";
import { canKho } from "@/components/nguoi-dung/phanQuyen";
import { t } from "@/i18n";

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
  { key: "channels", label: t("KÊNH BÁN HÀNG"), anTieuDeKhiMotMuc: true },
];

/**
 * Nhóm mở sẵn khi vào Tổng quan (chưa đứng ở trang nào thuộc nhóm), theo nhãn nhóm: mỗi vai trò thấy ngay việc chính
 * của mình. Đứng ở một trang thì nhóm chứa trang đó mở như cũ.
 */
export const NHOM_MO_SAN_THEO_VAI_TRO = {
  quan_ly_kho: t("Kho hàng"),
  nhan_vien_kho: t("Kho hàng"),
  nhan_vien_mua_hang: t("Mua hàng"),
  nhan_vien_ban_hang: t("Bán hàng"),
};

const TAT_CA_VAI_TRO = [
  "quan_tri_vien",
  "quan_ly_kho",
  "nhan_vien_kho",
  "nhan_vien_mua_hang",
  "nhan_vien_ban_hang",
];

/*
 * Vai trò của các mục menu mà App.jsx cũng dùng để chặn đường dẫn (RequireRole): menu và đường dẫn chung một danh sách
 * nên không lệch nhau. Mỗi danh sách khớp @RequireAuth của API chính trang đó gọi.
 */
// Người dùng: AdminController
export const VAI_TRO_NGUOI_DUNG = ["quan_tri_vien"];
// Phiếu nhập, xuất, chuyển kho, vị trí kệ, lịch sử giao dịch kho
export const VAI_TRO_KHO = ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"];
// Chuyển kệ nội bộ (UC-7.4): BA cho cả nhân viên bán hàng kiêm kho cửa hàng (ChuyenKeNoiBoController)
export const VAI_TRO_CHUYEN_KE = [...VAI_TRO_KHO, "nhan_vien_ban_hang"];
// Đơn mua hàng (GET /don-mua-hang/get-by-id, /filter); cũng là vai trò xem được giá mua ở yêu cầu báo giá, báo giá
export const VAI_TRO_DON_MUA = ["quan_tri_vien", "quan_ly_kho", "nhan_vien_mua_hang", "nhan_vien_kho"];
// Danh sách kho: GET /kho/{id}/tom-tat
export const VAI_TRO_DANH_SACH_KHO = ["quan_tri_vien", "quan_ly_kho"];
// Đơn bán hàng: POST /don-ban-hang/filter, GET /don-ban-hang/{id}/detail
export const VAI_TRO_DON_BAN = ["quan_tri_vien", "nhan_vien_ban_hang", "nhan_vien_kho", "quan_ly_kho"];

// Mục con khai báo `nhom` ("chung-tu" | "du-lieu"): BackofficeSidebar kẻ một đường mảnh giữa chứng từ và dữ liệu gốc
// (nhà cung cấp, khách hàng, kho, vị trí kệ). Mỗi nhóm tối đa một đường kẻ.
const CHUNG_TU = "chung-tu";
const DU_LIEU = "du-lieu";

export const SIDEBAR_MENU = [
  // ================= TỔNG QUAN =================
  {
    label: t("Tổng quan"),
    icon: LayoutDashboard,
    section: "overview",
    to: "/dashboard",
    roles: TAT_CA_VAI_TRO,
  },

  // ================= NGƯỜI DÙNG (chỉ quản trị viên, ngay dưới Tổng quan) =================
  {
    label: t("Người dùng"),
    icon: User,
    section: "overview",
    to: "/users",
    roles: VAI_TRO_NGUOI_DUNG,
  },

  // ================= SẢN PHẨM =================
  {
    label: t("Sản phẩm"),
    icon: Package,
    section: "main",
    roles: TAT_CA_VAI_TRO,
    children: [
      {
        // Khác tên nhóm "Sản phẩm"; tiêu đề trang vẫn là "Sản phẩm"
        label: t("Danh sách sản phẩm"),
        to: "/products",
        // /products/gia-ban-tem thuộc mục "Giá bán & tem mã vạch"
        match: (path) => path === "/products" || (path.startsWith("/products/") && !path.startsWith("/products/gia-ban-tem")),
      },
      {
        label: t("Giá bán & tem mã vạch"),
        to: "/products/gia-ban-tem",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      { label: t("Danh mục"), to: "/categories" },
      { label: t("Thuộc tính"), to: "/attributes" },
    ],
  },

  // ================= MUA HÀNG =================
  {
    label: t("Mua hàng"),
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
        label: t("Yêu cầu nhập hàng"),
        to: "/purchase-requests",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"],
      },
      {
        label: t("Yêu cầu báo giá"),
        to: "/quotation-requests",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "nhan_vien_mua_hang"],
      },
      {
        label: t("Đơn mua hàng"),
        to: "/purchase-orders",
        nhom: CHUNG_TU,
        roles: VAI_TRO_DON_MUA,
      },
      {
        label: t("Nhà cung cấp"),
        to: "/supplier",
        nhom: DU_LIEU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_mua_hang"],
      },
      // FO-095: tra mã vạch trên tem NCC ↔ biến thể (liên kết tạo khi kiểm đếm hàng nhập)
      {
        // Nhãn ngắn cho vừa sidebar; tiêu đề trang vẫn ghi đầy đủ "Mã vạch nhà cung cấp"
        label: t("Mã vạch NCC"),
        to: "/supplier-barcodes",
        nhom: DU_LIEU,
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"],
      },
    ],
  },

  // ================= KHO HÀNG (nhập, xuất, nội bộ, thiết lập kho) =================
  {
    label: t("Kho hàng"),
    icon: Warehouse,
    section: "main",
    // Nhân viên bán hàng chỉ thấy mục Chuyển kệ nội bộ: các mục khác ghi rõ VAI_TRO_KHO
    roles: VAI_TRO_CHUYEN_KE,
    children: [
      { label: t("Phiếu nhập kho"), to: "/goods-receipts", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      // Xuất kho theo Pick List (FO-045–047): Đơn chờ xuất → Pick List → Phiếu xuất kho
      { label: t("Đơn chờ xuất"), to: "/goods-issues/pending-orders", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      { label: t("Phiếu nhặt hàng"), to: "/goods-issues/pick-lists", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      {
        label: t("Phiếu xuất kho"),
        to: "/goods-issues",
        nhom: CHUNG_TU,
        roles: VAI_TRO_KHO,
        match: (path) =>
          path.startsWith("/goods-issues") &&
          !path.startsWith("/goods-issues/pending-orders") &&
          !path.startsWith("/goods-issues/pick-lists"),
      },
      { label: t("Chuyển kho nội bộ"), to: "/transfer-tickets", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      { label: t("Kiểm kê"), to: "/stock-take", nhom: CHUNG_TU, roles: VAI_TRO_KHO },
      // UC-7.4 Scan-to-Move; /warehouse/bin-moves/history (Lịch sử chuyển kệ) thuộc mục này
      {
        label: t("Chuyển kệ nội bộ"),
        to: "/warehouse/bin-moves",
        nhom: CHUNG_TU,
        roles: VAI_TRO_CHUYEN_KE,
        match: (path) => path.startsWith("/warehouse/bin-moves"),
      },
      {
        label: t("Danh sách kho"),
        to: "/warehouse",
        nhom: DU_LIEU,
        // /warehouse/locations thuộc mục "Vị trí kệ"
        match: (path) => path === "/warehouse",
        roles: VAI_TRO_DANH_SACH_KHO,
      },
      // FO-094: khu vực, vị trí kệ và mặt bằng kho
      { label: t("Vị trí kệ"), to: "/warehouse/locations", nhom: DU_LIEU, roles: VAI_TRO_KHO },
      // Lô đã vào kho mà chưa ghi ở kệ nào (nhận chuyển kho, khách trả…); badge: số lô ở kho làm việc
      // (BackofficeSidebar đọc từ components/kiem-ke/soHangChuaCoKe)
      { label: t("Hàng chưa có kệ"), to: "/warehouse/unshelved", nhom: DU_LIEU, roles: VAI_TRO_KHO, badge: "hangChuaCoKe" },
    ],
  },

  // ================= BÁN HÀNG =================
  {
    label: t("Bán hàng"),
    icon: ShoppingCart,
    section: "main",
    roles: [
      "quan_tri_vien",
      "nhan_vien_ban_hang", "nhan_vien_kho", "quan_ly_kho"
    ],
    children: [
      {
        label: t("Báo giá"),
        to: "/sales-quotations",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
      {
        label: t("Đơn bán hàng"),
        to: "/sales-orders",
        nhom: CHUNG_TU,
        roles: VAI_TRO_DON_BAN,
      },
      {
        // Giao dịch chuyển khoản tại quầy; quản trị viên xử lý giao dịch đã nhận tiền nhưng chưa có đơn.
        // badge: số giao dịch cần xử lý (BackofficeSidebar đọc từ components/pos/payosCanXuLy)
        label: t("Đối soát chuyển khoản"),
        to: "/pos-transfers",
        nhom: CHUNG_TU,
        roles: ["quan_tri_vien"],
        badge: "payosCanXuLy",
      },
      {
        label: t("Khách hàng"),
        to: "/customers",
        nhom: DU_LIEU,
        roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
      },
    ],
  },

  // ================= BÁO CÁO =================
  {
    label: t("Báo cáo"),
    icon: BarChart3,
    section: "main",
    roles: TAT_CA_VAI_TRO,
    children: [
      {
        // Nhân viên bán hàng: cửa hàng mình làm, không có giá vốn / lợi nhuận (FO-090)
        label: t("Báo cáo doanh thu"),
        to: "/reports/revenue",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_ban_hang"],
      },
      {
        // Bán chạy, sắp hết, dư hàng, không bán theo sản phẩm: API cùng quyền với Báo cáo doanh thu
        label: t("Báo cáo sản phẩm"),
        to: "/reports/products",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_ban_hang"],
      },
      {
        label: t("Báo cáo tồn kho"),
        to: "/reports/inventory",
        roles: TAT_CA_VAI_TRO,
      },
      {
        label: t("Báo cáo nhập xuất"),
        to: "/reports/stock-movements",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      {
        label: t("Báo cáo khách hàng"),
        to: "/reports/customers",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      {
        // Xuất sang AMIS Kế toán doanh nghiệp: KeToanController chỉ cho quản trị viên
        label: t("Xuất dữ liệu kế toán"),
        to: "/reports/accounting-export",
        roles: ["quan_tri_vien"],
      },
      {
        label: t("Lịch sử giao dịch kho"),
        to: "/inventory-transactions",
        roles: VAI_TRO_KHO,
      },
    ],
  },

  // ================= KÊNH BÁN HÀNG (omnichannel, FO-073–077) =================
  // "Tất cả kênh" không vẽ thành dòng menu mà thành nút "+" cạnh tiêu đề KÊNH BÁN HÀNG (`hienThi: "nut-them"`).
  // Mục vẫn khai báo ở đây để phân quyền, "Quyền của tôi" và tìm kiếm toàn hệ thống đếm đủ màn hình.
  {
    label: t("Tất cả kênh"),
    icon: Store,
    section: "channels",
    hienThi: "nut-them",
    nhanNut: t("Kết nối kênh bán hàng"),
    to: "/channels",
    roles: ["quan_tri_vien"],
    // Trang quay về sau ủy quyền tính vào Tất cả kênh
    match: (path) => path === "/channels" || path.startsWith("/channels/oauth/"),
    // Trang của sàn chưa kết nối (giới thiệu, thiết lập) cũng tính vào Tất cả kênh vì sàn đó chưa có mục riêng
    // (trừ sàn chờ cấp API có `hienMenu`: đã có mục riêng ở dưới); BackofficeSidebar truyền danh sách sàn đã kết nối
    matchKenh: (path, kenhDaKetNoi) =>
      path === "/channels" ||
      path.startsWith("/channels/oauth/") ||
      SAN_BAN_HANG.some(
        (san) =>
          (san.anTam || ((san.hoTro || !san.hienMenu) && !kenhDaKetNoi.includes(san.maKenh))) &&
          (path === san.duongDan || path.startsWith(`${san.duongDan}/`)),
      ),
  },
  // Bán tại quầy là một kênh bán (như các sàn), luôn có sẵn nên đứng đầu; link thẳng mở màn POS toàn màn hình.
  // POS V1: chỉ admin + nhân viên bán hàng (quyết định mở rộng role ở Phase 03+)
  {
    label: t("Bán hàng tại quầy"),
    icon: TaiQuayMenuIcon,
    section: "channels",
    to: "/pos",
    roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
  },
  // Sinh từ SAN_BAN_HANG; `maKenh`: BackofficeSidebar chỉ hiện sàn đã kết nối (danh sách tải ở BackofficeLayout)
  ...SAN_BAN_HANG.filter((san) => san.hoTro && !san.anTam).map((san) => ({
    label: san.ten,
    icon: ICON_MENU_SAN[san.maKenh] ?? Store,
    section: "channels",
    roles: ["quan_tri_vien"],
    maKenh: san.maKenh,
    children: [
      {
        label: t("Tổng quan"),
        to: san.duongDan,
        roles: ["quan_tri_vien"],
        // Chỉ đúng trang Tổng quan. Thiết lập (/channels/<sàn>/setup) không có mục riêng: nhóm sàn vẫn mở,
        // không mục con nào sáng (nhóm đang đóng hoặc menu thu gọn thì cả nhóm được tô như mọi nhóm khác)
        match: (path) => path === san.duongDan,
      },
      { label: t("Sản phẩm"), to: `${san.duongDan}/products`, roles: ["quan_tri_vien"] },
      { label: t("Đơn hàng"), to: `${san.duongDan}/orders`, roles: ["quan_tri_vien"] },
      { label: t("Cấu hình"), to: `${san.duongDan}/settings`, roles: ["quan_tri_vien"] },
    ],
  })),
  // Sàn chờ cấp API bật `hienMenu` (Shopee): một mục mở màn giới thiệu, không có mục con vì trang con chuyển về đó;
  // không khai báo `maKenh` nên hiện cả khi chưa kết nối
  ...SAN_BAN_HANG.filter((san) => !san.hoTro && san.hienMenu && !san.anTam).map((san) => ({
    label: san.ten,
    icon: ICON_MENU_SAN[san.maKenh] ?? Store,
    section: "channels",
    to: san.duongDan,
    roles: ["quan_tri_vien"],
  })),

  // ================= CẤU HÌNH (ghim ở đáy sidebar) =================
  // Mở trung tâm Cấu hình; các trang con (menu trái của SettingsLayout) khai báo ở settings.config.js
  // và được liệt kê ở đây để phân quyền / tìm kiếm toàn hệ thống đếm đủ màn hình.
  {
    label: t("Cài đặt"),
    icon: Settings,
    section: SIDEBAR_FOOTER_SECTION,
    to: "/settings",
    roles: SETTINGS_ROLES,
    match: (path) => path === "/settings" || path.startsWith("/settings/"),
    children: SETTINGS_PAGES.map(({ label, to, roles }) => ({ label, to, roles })),
  },
];

/**
 * Đường dẫn các mục menu mà vai trò `role` thấy, theo thứ tự từ trên xuống: BackofficeLayout tải trước các trang này lúc
 * rảnh. Bỏ mục của từng sàn (chỉ hiện khi gian hàng đã kết nối).
 */
export function duongDanMenuCuaVaiTro(role) {
  const thay = (muc) => !muc.roles || muc.roles.includes(role);
  const dsDuongDan = SIDEBAR_MENU.filter((muc) => thay(muc) && !muc.maKenh).flatMap((muc) => [
    muc.to,
    ...(muc.children ?? []).filter(thay).map((con) => con.to),
  ]);
  return [...new Set(dsDuongDan.filter(Boolean))];
}
