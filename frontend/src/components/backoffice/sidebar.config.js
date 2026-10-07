import {
  LayoutDashboard,
  User,
  Package,
  ArrowDownToLine,
  Warehouse,
  ShoppingCart,
  BarChart3,
  Printer,
} from "lucide-react";

// Nhóm hiển thị trên sidebar — thứ tự khai báo cũng là thứ tự render.
// Label chỉ hiển thị khi sidebar mở rộng; khi thu gọn chỉ còn divider + khoảng cách.
// label = null nghĩa là nhóm không có tiêu đề (vd: Tổng quan đứng độc lập).
export const SIDEBAR_SECTIONS = [
  { key: "overview", label: null },
  { key: "management", label: "QUẢN TRỊ" },
  { key: "operations", label: "VẬN HÀNH" },
  { key: "reports", label: "GIÁM SÁT" },
  { key: "settings", label: "HỆ THỐNG" },
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
    label: "Quản lý người dùng",
    icon: User,
    section: "management",
    to: "/users",
    roles: ["quan_tri_vien"],
  },

  // ================= DANH MỤC & SẢN PHẨM =================
  {
    label: "Danh mục & Sản phẩm",
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
      { label: "Danh mục", to: "/danh-muc-quan-ao" },
      { label: "Thuộc tính", to: "/attributes" },
      { label: "Sản phẩm", to: "/products" },
      {
        label: "Biến thể SKU & Giá",
        to: "/sku-builder",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
    ],
  },

  // ================= MUA HÀNG & NHẬP KHO =================
  {
    label: "Mua hàng & Nhập kho",
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
    label: "Kho & Xuất kho",
    icon: Warehouse,
    section: "operations",
    roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
    children: [
      {
        label: "Kho",
        to: "/warehouse",
        roles: ["quan_tri_vien", "quan_ly_kho"],
      },
      { label: "Phiếu xuất kho", to: "/goods-issues" },
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
    ],
  },

  // ================= BÁO CÁO & CẢNH BÁO =================
  {
    label: "Báo cáo & Cảnh báo",
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
        label: "Báo cáo tồn kho",
        to: "/bao-cao/ton-kho",
        roles: [
          "quan_tri_vien",
          "quan_ly_kho",
          "nhan_vien_kho",
          "nhan_vien_mua_hang",
          "nhan_vien_ban_hang",
        ],
      },
      {
        label: "Lịch sử giao dịch kho",
        to: "/lich-su-giao-dich-kho",
        roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
      },
    ],
  },

  // ================= CẤU HÌNH MẪU IN =================
  // Hồ sơ công ty không còn là mục riêng trên sidebar — mở qua hộp thoại
  // "Thông tin công ty" ngay trên trang Cấu hình mẫu in.
  {
    label: "Cấu hình mẫu in",
    icon: Printer,
    section: "settings",
    to: "/settings/print-templates",
    roles: ["quan_tri_vien", "quan_ly_kho"],
  },
];
