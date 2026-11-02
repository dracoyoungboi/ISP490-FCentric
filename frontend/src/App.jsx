import { BrowserRouter, Routes, Route, Navigate, createRoutesFromChildren, useParams, useSearchParams } from "react-router-dom";
import BackofficeLayout from "@/components/backoffice/BackofficeLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import Login from "./pages/Login";
import DonBanHangInvoice from "./pages/sales-orders/DonBanHangInvoice";
import NotFound404 from "./pages/page-error/NotFound404";
import SettingsLayout from "./pages/settings/SettingsLayout";
import { SETTINGS_ROLES } from "./components/settings/settings.config";
import RequireRole from "./components/auth/RequireRole";
import { VAI_TRO_TAO_YEU_CAU_NHAP } from "./constants/vaiTroTaoYeuCauNhap";
import PosPage from "./pages/pos";
import PosLayout from "./pages/pos/PosLayout";
import KenhHopLe from "./pages/channels/KenhHopLe";
import ManHinhKhachPage from "./pages/pos/ManHinhKhachPage";
import GuiBaoGiaCuRedirect from "./pages/order/GuiBaoGiaCuRedirect.jsx";
import VungTaiTrang, { ThanhTaiTrang } from "@/components/shared/VungTaiTrang";
import { ghiNhanCayDuongDan, taiTrang, taiTruocDuongDan } from "@/lib/taiTrang";

/*
 * Mỗi trang là một tệp mã riêng, chỉ tải khi mở tới (taiTrang). Tải ngay cùng gói đầu: các khung, Đăng nhập, 404,
 * POS, màn hình phụ phía khách và hóa đơn bán hàng (thu ngân mở POS không phải chờ, hóa đơn in từ POS mở tab mới in ngay),
 * trang chuyển hướng cũ (không phải tải thêm một tệp chỉ để chuyển đi).
 */
const UserDetail = taiTrang(() => import("./pages/UserDetail"));
const ForgotPassword = taiTrang(() => import("./pages/ForgotPassword"));
const SetPassword = taiTrang(() => import("./pages/SetPassword"));
const Warehouse = taiTrang(() => import("./pages/warehouse/Warehouse"));
const SupplierList = taiTrang(() => import("./pages/supplier/SupplierList"));
const SupplierDetailView = taiTrang(() => import("./pages/supplier/SupplierDetailView"));
const ProductList = taiTrang(() => import("./pages/product"));
const ViewUserListByAdmin = taiTrang(() => import("./pages/admin/ViewUserListByAdmin"));
const ViewUserDetailByAdmin = taiTrang(() => import("@/pages/admin/ViewUserDetailByAdmin.jsx"));
const EditUserRoleByAdmin = taiTrang(() => import("@/pages/admin/EditUserRoleByAdmin.jsx"));
const PhieuNhapKhoList = taiTrang(() => import("./pages/receipt/PhieuNhapKhoList"));
const PhieuNhapKhoCreate = taiTrang(() => import("./pages/receipt/PhieuNhapKhoCreate"));
const PhieuNhapKhoDetail = taiTrang(() => import("./pages/receipt/PhieuNhapKhoDetail.jsx"));
const KhaiBaoLo = taiTrang(() => import("./pages/receipt/KhaiBaoLo.jsx"));
const KiemDemLo = taiTrang(() => import("./pages/receipt/KiemDemLo.jsx"));
const ViTriKhoPage = taiTrang(() => import("./pages/warehouse/vi-tri-kho/ViTriKhoPage.jsx"));
const MaVachNhaCungCapPage = taiTrang(() => import("./pages/supplier/MaVachNhaCungCapPage.jsx"));
const PhieuXuatKhoList = taiTrang(() => import("./pages/issue/PhieuXuatKhoList.jsx"));
const PurchaseOrderDetail = taiTrang(() => import("./pages/order/PurchaseOrderDetail.jsx"));
const PurchaseOrder = taiTrang(() => import("./pages/order/PurchaseOrder.jsx"));
const GiaBanTemPage = taiTrang(() => import("./pages/product/GiaBanTemPage"));
const PhieuXuatKhoCreate = taiTrang(() => import("./pages/issue/PhieuXuatKhoCreate.jsx"));
const PhieuXuatKhoDetail = taiTrang(() => import("./pages/issue/PhieuXuatKhoDetail.jsx"));
const PhieuXuatKhoView = taiTrang(() => import("./pages/issue/PhieuXuatKhoView.jsx"));
const PickLot = taiTrang(() => import("./pages/issue/PickLot.jsx"));
const SupplierQuotation = taiTrang(() => import("./pages/supplier/pages/Supplierquotation.jsx"));
const SupplierLogin = taiTrang(() => import("./pages/supplier/pages/Supplierlogin.jsx"));
const KhachHangPage = taiTrang(() => import("./pages/customer/KhachHangPage"));
const DanhMucQuanAoTree = taiTrang(() => import("./pages/danh-muc-quan-ao/DanhMucQuanAoTree.jsx"));
const PhieuChuyenKhoList = taiTrang(() => import("./pages/chuyenKhoNoiBo/PhieuChuyenKhoList"));
const KhachHangDetails = taiTrang(() => import("./pages/customer/KhachHangDetails"));
const ProductAttributeHub = taiTrang(() => import("@/pages/attribute/ProductAttributeHub"));
const DonBanHangList = taiTrang(() => import("./pages/sales-orders/DonBanHangList"));
const DonBanHangDetail = taiTrang(() => import("./pages/sales-orders/DonBanHangDetail"));
const DonBanHangCreate = taiTrang(() => import("./pages/sales-orders/DonBanHangCreate"));
const DoiSoatChuyenKhoan = taiTrang(() => import("./pages/pos-transfers/DoiSoatChuyenKhoan"));
const ProductDetail = taiTrang(() => import("./pages/product/components/product/ProductDetail"));
const PhieuChuyenKhoDetail = taiTrang(() => import("./pages/chuyenKhoNoiBo/PhieuChuyenKhoDetail"));
const PhieuChuyenKhoCreate = taiTrang(() => import("./pages/chuyenKhoNoiBo/PhieuChuyenKhoCreate"));
const NhanHangChuyenKho = taiTrang(() => import("./pages/chuyenKhoNoiBo/NhanHangChuyenKho"));
const PhieuDieuChinhChuyenKho = taiTrang(() => import("./pages/chuyenKhoNoiBo/PhieuDieuChinhChuyenKho"));
const InChuyenKho = taiTrang(() => import("./pages/chuyenKhoNoiBo/InChuyenKho"));
const StockTakeList = taiTrang(() => import("./pages/stock-take/StockTakeList"));
const StockTakeCreate = taiTrang(() => import("./pages/stock-take/StockTakeCreate"));
const StockTakeDetail = taiTrang(() => import("./pages/stock-take/StockTakeDetail"));
const BaoCaoDoanhThu = taiTrang(() => import("./pages/bao-cao/BaoCaoDoanhThu"));
const KhachHangReport = taiTrang(() => import("./pages/bao-cao/KhachHangReport"));
const NhatKyNhapXuat = taiTrang(() => import("./pages/bao-cao/NhatKyNhapXuat"));
const PhieuNhapKhoPrint = taiTrang(() => import("./pages/receipt/PhieuNhapKhoPrint"));
const PhieuXuatKhoPrint = taiTrang(() => import("./pages/issue/PhieuXuatKhoPrint"));
const Dashboard = taiTrang(() => import("@/pages/dashboard/Dashboard"));
const TonKhoTongQuan = taiTrang(() => import("./pages/bao-cao/TonKhoTongQuan"));
const LichSuGiaoDichKhoList = taiTrang(() => import("./pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList"));
const QuotationRequestList = taiTrang(() => import("./pages/order/QuotationRequestList"));
const QuotationRequestCreate = taiTrang(() => import("./pages/order/QuotationRequestCreate"));
const PurchaseOrderCreateManual = taiTrang(() => import("./pages/order/PurchaseOrderCreateManual"));
const BaoGiaList = taiTrang(() => import("./pages/sales-orders/Bao-gia/BaoGiaList"));
const BaoGiaCreate = taiTrang(() => import("./pages/sales-orders/Bao-gia/BaoGiaCreate"));
const BaoGiaDetail = taiTrang(() => import("./pages/sales-orders/Bao-gia/BaoGiaDetail"));
const BaoGiaPrint = taiTrang(() => import("./pages/sales-orders/Bao-gia/BaoGiaPrint"));
const PurchaseRequestList = taiTrang(() => import("./pages/order/PurchaseRequestList"));
const CreatePurchaseRequestPage = taiTrang(() => import("./pages/order/CreatePurchaseRequestPage"));
const SendQuotationRequestPage = taiTrang(() => import("./pages/order/SendQuotationRequestPage"));
const PurchaseRequestDetail = taiTrang(() => import("./pages/order/PurchaseRequestDetail"));
const QuotationRequestDetail = taiTrang(() => import("./pages/order/QuotationRequestDetail"));
const QuotationDetail = taiTrang(() => import("./pages/order/QuotationDetail"));
const PurchaseRequestPrint = taiTrang(() => import("./pages/order/PurchaseRequestPrint"));
const QuotationRequestPrint = taiTrang(() => import("./pages/order/QuotationRequestPrint"));
const PurchaseOrderPrint = taiTrang(() => import("./pages/order/PurchaseOrderPrint"));
const PrintTemplateEditorPage = taiTrang(() => import("./pages/settings/PrintTemplateEditorPage"));
const PaymentSettingsPage = taiTrang(() => import("./pages/settings/PaymentSettingsPage"));
const VatSettingsPage = taiTrang(() => import("./pages/settings/VatSettingsPage"));
const OperationsSettingsPage = taiTrang(() => import("./pages/settings/OperationsSettingsPage"));
const StoreSettingsPage = taiTrang(() => import("./pages/settings/StoreSettingsPage"));
const PrintTemplateListPage = taiTrang(() => import("./pages/settings/PrintTemplateListPage"));
const DonChoXuatPage = taiTrang(() => import("./pages/issue/DonChoXuatPage"));
const PickListList = taiTrang(() => import("./pages/issue/PickListList"));
const PickListDetail = taiTrang(() => import("./pages/issue/PickListDetail"));
const DongGoiPage = taiTrang(() => import("./pages/issue/DongGoiPage"));
const ChannelsPage = taiTrang(() => import("./pages/channels/ChannelsPage"));
const ChannelSetupWizard = taiTrang(() => import("./pages/channels/ChannelSetupWizard"));
const ChannelMappingsPage = taiTrang(() => import("./pages/channels/ChannelMappingsPage"));
const ChannelSyncDashboard = taiTrang(() => import("./pages/channels/ChannelSyncDashboard"));
const ChannelOrdersPage = taiTrang(() => import("./pages/channels/ChannelOrdersPage"));
const ChannelSettingsPage = taiTrang(() => import("./pages/channels/ChannelSettingsPage"));
const OAuthCallbackPage = taiTrang(() => import("./pages/channels/OAuthCallbackPage"));

/** Đường dẫn cũ /supplier/view/:id → trang chi tiết /supplier/:id (giống /customers/:id, /users/:id). */
function SupplierViewRedirect() {
  const { id } = useParams();
  return <Navigate to={`/supplier/${id}`} replace />;
}

/** Đường dẫn cũ của trang xem / sửa mẫu in -> trình sửa một màn của loại chứng từ. */
function MauInRedirect() {
  const { documentType } = useParams();
  return <Navigate to={`/settings/print-templates/${documentType}`} replace />;
}

/** Trang Công cụ cũ của gian hàng đã gộp vào trang Sản phẩm của sàn. */
function ChuyenSangSanPham() {
  const { maKenh } = useParams();
  return <Navigate to={`/channels/${maKenh}/products`} replace />;
}

/** Sửa khách hàng nay là popup trên trang chi tiết: đường dẫn cũ /customers/:id/edit mở trang chi tiết kèm popup. */
function SuaKhachHangRedirect() {
  const { id } = useParams();
  return <Navigate to={`/customers/${id}`} replace state={{ moSuaKhach: true }} />;
}

/**
 * Điều hướng thông minh ở Trang chủ (/):
 * - Nếu nhận được query ?code= từ sàn TMĐT (đặc biệt Lazada redirect về domain gốc):
 *   Tự động giữ nguyên query params và chuyển hướng tới /channels/oauth/callback/lazada.
 * - Nếu không có OAuth callback, chuyển về /dashboard (đã đăng nhập) hoặc /login (chưa đăng nhập).
 */
function RootOAuthRedirect() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const token = localStorage.getItem("access_token");

  if (code) {
    const target = `/channels/oauth/callback/lazada${window.location.search}`;
    if (!token) {
      return <Navigate to={`/login?returnUrl=${encodeURIComponent(target)}`} replace />;
    }
    return <Navigate to={target} replace />;
  }

  return <Navigate to={token ? "/dashboard" : "/login"} replace />;
}

/*
 * Cây đường dẫn của app, để ở cấp tệp để ghi một lần vào taiTrang.js: tải trước trang theo đường dẫn (rê chuột vào
 * menu, lúc mở app, lúc rảnh) dùng chung cây này, không phải khai báo đường dẫn lần hai.
 */
const CAY_DUONG_DAN = (
  <>
    {/* ========== PUBLIC ROUTES ========== */}
    <Route path="/" element={<RootOAuthRedirect />} />
    <Route path="/login" element={<Login />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    {/* Liên kết trong email tạo tài khoản / cấp lại mật khẩu: /set-password#t=<mã dùng một lần> */}
    <Route path="/set-password" element={<SetPassword />} />
    <Route path="/supplier/quotation" element={<SupplierQuotation />} />
    {/* Trang cũ sau khi gửi báo giá: nay báo thành công ngay trên trang báo giá; giữ đường dẫn để link cũ không hỏng */}
    <Route path="/quote-success" element={<Navigate to="/supplier/login" replace />} />
    <Route path="/supplier/login" element={<SupplierLogin />} />
    {/* Màn hình phụ quay về phía khách (cửa sổ riêng mở từ menu tài khoản của POS): chỉ hiện nội dung màn bán hàng
        cùng máy, cùng tài khoản gửi sang qua BroadcastChannel; không gọi API, không có thao tác. Để ngoài kiểm tra
        phiên đăng nhập để tải lại lúc phiên hết hạn không hiện màn đăng nhập / báo lỗi trước mặt khách. */}
    <Route path="/pos/customer-display" element={<ManHinhKhachPage />} />

    {/* ========== BACKOFFICE ROUTES (CÓ SIDEBAR + HEADER) ========== */}
    <Route element={<ProtectedRoute />}>
      <Route element={<BackofficeLayout />}>
      {/* Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Hồ sơ cá nhân (mở từ menu tài khoản ở Header) */}
      <Route path="/profile" element={<UserDetail />} />
      {/* Legacy: /user/:id chuyển hướng sang /profile, chặn xem hồ sơ người dùng khác */}
      <Route path="/user/:id" element={<Navigate to="/profile" replace />} />
      <Route path="/user" element={<Navigate to="/profile" replace />} />

      {/* User management */}
      <Route path="/users" element={<ViewUserListByAdmin />} />
      {/* Thêm người dùng là popup trên trang danh sách; giữ đường dẫn cũ để mở sẵn popup */}
      <Route path="/users/add" element={<Navigate to="/users" replace state={{ openCreateUser: true }} />} />
      <Route path="/users/:id" element={<ViewUserDetailByAdmin />} />
      <Route
        path="/users/:id/edit-role"
        element={<EditUserRoleByAdmin />}
      />

      {/* Attributes */}
      <Route path="/attribute" element={<Navigate to="/attributes" replace />} />
      <Route path="/attributes" element={<ProductAttributeHub />} />

      {/* Product */}
      <Route path="/products" element={<ProductList />} />
      {/* Giá bán & tem mã vạch: API danh sách cho quản trị viên và quản lý kho (đổi giá chỉ quản trị viên) */}
      <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho"]} />}>
        <Route path="/products/gia-ban-tem" element={<GiaBanTemPage />} />
      </Route>
      {/* Legacy: màn "Biến thể SKU & giá" cũ */}
      <Route path="/sku-builder" element={<Navigate to="/products/gia-ban-tem" replace />} />
      <Route path="/categories" element={<DanhMucQuanAoTree />} />
      {/* Legacy: URL tiếng Việt cũ chuyển hướng sang URL mới, giữ bookmark không bị hỏng */}
      <Route path="/danh-muc-quan-ao" element={<Navigate to="/categories" replace />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      {/* Warehouse */}
      <Route path="/warehouse" element={<Warehouse />} />
      <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"]} />}>
        <Route path="/warehouse/locations" element={<ViTriKhoPage />} />
      </Route>

      {/* Purchase Order */}
      <Route path="/purchase-requests" element={<PurchaseRequestList />} />
      <Route path="/purchase-orders" element={<PurchaseOrder />} />
      {/* Tạo yêu cầu nhập hàng: đúng 4 vai trò máy chủ cho lập (quản lý kho chỉ duyệt) */}
      <Route element={<RequireRole roles={VAI_TRO_TAO_YEU_CAU_NHAP} />}>
        <Route path="/purchase-requests/create" element={<CreatePurchaseRequestPage />} />
      </Route>
      <Route path="/purchase-requests/:id/send-quotation" element={<SendQuotationRequestPage />} />
      <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
      <Route path="/purchase-requests/:id/gui-bao-gia" element={<GuiBaoGiaCuRedirect />} />
      <Route path="/quotation-requests" element={<QuotationRequestList />} />
      <Route path="/quotation-requests/create" element={<QuotationRequestCreate />} />
      <Route path="/quotation-requests/:id" element={<QuotationRequestDetail />} />
      <Route path="/quotation/:id" element={<QuotationDetail />} />
      <Route path="/purchase-orders/create" element={<PurchaseOrderCreateManual />} />
      <Route path="/purchase-requests/:id" element={<PurchaseRequestDetail />} />


      {/* Supplier — Thêm / Sửa là popup; giữ đường dẫn cũ để link cũ không hỏng */}
      <Route path="/supplier" element={<SupplierList />} />
      <Route path="/supplier/new" element={<Navigate to="/supplier" replace state={{ openCreateSupplier: true }} />} />
      <Route path="/supplier/view/:id" element={<SupplierViewRedirect />} />
      <Route path="/supplier/:id" element={<SupplierDetailView />} />
      <Route
        element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_mua_hang"]} />}
      >
        <Route path="/supplier-barcodes" element={<MaVachNhaCungCapPage />} />
      </Route>

      {/* Customer */}
      <Route path="/customers" element={<KhachHangPage />} />
      <Route path="/customers/:id" element={<KhachHangDetails />} />
      <Route path="/customers/:id/edit" element={<SuaKhachHangRedirect />} />

      {/* Receipt*/}
      <Route path="/goods-receipts/create" element={<PhieuNhapKhoCreate />} />
      <Route path="/goods-receipts" element={<PhieuNhapKhoList />} />
      <Route path="/goods-receipts/:id" element={<PhieuNhapKhoDetail />} />
      <Route path="/goods-receipts/:phieuNhapKhoId/lot-input/:bienTheSanPhamId" element={<KhaiBaoLo />} />
      {/* FO-097/098: kiểm đếm & khóa lô một biến thể của phiếu nhập từ đơn mua */}
      <Route path="/goods-receipts/:phieuNhapKhoId/receive/:bienTheSanPhamId" element={<KiemDemLo />} />

      {/* Issue */}
      <Route path="/goods-issues" element={<PhieuXuatKhoList />} />
      <Route path="/goods-issues/create" element={<PhieuXuatKhoCreate />} />
      <Route path="/goods-issues/:id" element={<PhieuXuatKhoDetail />} />
      <Route path="/goods-issues/:phieuXuatKhoId/pick-lot/:chiTietPhieuXuatKhoId" element={<PickLot />} />
      <Route path="/goods-issues/:id/view" element={<PhieuXuatKhoView />} />

      {/* Sales-orders */}
      <Route path="/sales-orders" element={<DonBanHangList />} />

      <Route path="/sales-orders/:id" element={<DonBanHangDetail />} />
      <Route path="/sales-orders/create" element={<DonBanHangCreate />} />
      <Route path="/sales-quotations" element={<BaoGiaList />} />
      {/* Tạo báo giá: khớp @RequireAuth của POST /don-ban-hang/create (quản trị viên, nhân viên bán hàng) */}
      <Route element={<RequireRole roles={["quan_tri_vien", "nhan_vien_ban_hang"]} />}>
        <Route path="/sales-quotations/create" element={<BaoGiaCreate />} />
      </Route>
      {/* Chi tiết báo giá: quản trị viên, nhân viên bán hàng thao tác; quản lý kho, nhân viên kho chỉ xem
          (khớp @RequireAuth của GET /don-ban-hang/{id}/detail) — nhân viên mua hàng bị chặn ở đây */}
      <Route element={<RequireRole roles={["quan_tri_vien", "nhan_vien_ban_hang", "quan_ly_kho", "nhan_vien_kho"]} />}>
        <Route path="/sales-quotations/:id" element={<BaoGiaDetail />} />
      </Route>

      {/* Chuyen kho noi bo */}
      <Route path="/transfer-tickets" element={<PhieuChuyenKhoList />} />
      <Route path="/transfer-tickets/create" element={<PhieuChuyenKhoCreate />} />
      <Route path="/transfer-tickets/:id" element={<PhieuChuyenKhoDetail />} />
      <Route path="/transfer-tickets/:id/receive" element={<NhanHangChuyenKho />} />
      <Route path="/transfer-tickets/adjustments/:id" element={<PhieuDieuChinhChuyenKho />} />

      {/* Kiểm kê kho hàng*/}
      <Route path="/stock-take" element={<StockTakeList />} />
      <Route path="/stock-take/new" element={<StockTakeCreate />} />
      <Route path="/stock-take/:id" element={<StockTakeDetail />} />

      {/* Báo cáo. Doanh thu, khách hàng, nhập xuất: API chỉ cho quản trị viên và
          quản lý kho (@RequireAuth ở backend), menu cũng chỉ hiện cho hai vai trò này. */}
      <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho"]} />}>
        <Route path="/reports/revenue" element={<BaoCaoDoanhThu />} />
        <Route path="/reports/customers" element={<KhachHangReport />} />
        <Route path="/reports/stock-movements" element={<NhatKyNhapXuat />} />
      </Route>
      <Route path="/reports/inventory" element={<TonKhoTongQuan />} />
      {/* Legacy: URL tiếng Việt cũ chuyển hướng sang URL mới */}
      <Route path="/bao-cao/doanh-thu" element={<Navigate to="/reports/revenue" replace />} />
      <Route path="/bao-cao/khach-hang" element={<Navigate to="/reports/customers" replace />} />
      <Route path="/bao-cao/xuat-nhap" element={<Navigate to="/reports/stock-movements" replace />} />
      <Route path="/bao-cao/ton-kho" element={<Navigate to="/reports/inventory" replace />} />

      {/* Màn "Duyệt yêu cầu tạo đơn" cũ: backend không còn API này; việc duyệt nằm ở Yêu cầu nhập hàng */}
      <Route path="/duyet-don-hang" element={<Navigate to="/purchase-requests" replace />} />

      {/*Lịch sử giao dịch kho */}
      <Route path="/inventory-transactions" element={<LichSuGiaoDichKhoList />} />
      {/* Legacy: URL tiếng Việt cũ chuyển hướng sang URL mới */}
      <Route path="/lich-su-giao-dich-kho" element={<Navigate to="/inventory-transactions" replace />} />

      {/* Trung tâm Cấu hình: menu trái + từng mục (SettingsLayout tự lọc mục theo vai trò, settings.config.js).
          Frontend chặn chỉ là UX — backend @RequireAuth mới là chốt chặn thật. */}
      <Route element={<RequireRole roles={SETTINGS_ROLES} />}>
        <Route path="/settings" element={<SettingsLayout />}>
          <Route path="product" element={<OperationsSettingsPage key="product" part="product" />} />
          <Route path="stock" element={<OperationsSettingsPage key="stock" part="stock" />} />
          <Route path="sync" element={<OperationsSettingsPage key="sync" part="sync" />} />
          <Route path="customer" element={<OperationsSettingsPage key="customer" part="customer" />} />
          <Route path="inbound" element={<OperationsSettingsPage key="inbound" part="inbound" />} />
          <Route path="documents" element={<OperationsSettingsPage key="documents" part="documents" />} />
          <Route path="transfer" element={<OperationsSettingsPage key="transfer" part="transfer" />} />
          <Route path="store" element={<StoreSettingsPage />} />
          <Route path="payment" element={<PaymentSettingsPage />} />
          <Route path="vat" element={<VatSettingsPage />} />
          <Route path="print-templates" element={<PrintTemplateListPage />} />
        </Route>
        {/* Đường dẫn cũ */}
        <Route path="/settings/inventory" element={<Navigate to="/settings/stock" replace />} />
        <Route path="/settings/company-profile" element={<Navigate to="/settings/store" replace />} />
      </Route>

      {/* Trình sửa mẫu in một màn (xem trước + chỉnh sửa): toàn chiều rộng, ngoài khung Cấu hình.
          Đường dẫn cũ (trang xem mẫu, /edit, theo định danh mẫu) chuyển về trình sửa của loại chứng từ. */}
      <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho"]} />}>
        <Route path="/settings/print-templates/:documentType" element={<PrintTemplateEditorPage />} />
        <Route path="/settings/print-templates/:documentType/edit" element={<MauInRedirect />} />
        <Route path="/settings/print-templates/:documentType/:templateId" element={<MauInRedirect />} />
        <Route path="/settings/print-templates/:documentType/:templateId/edit" element={<MauInRedirect />} />
      </Route>

      {/* Xuất kho theo Pick List (FO-045–047) — vai trò kho, khớp @RequireAuth của NhatHangController.
          Đường dẫn tĩnh được ưu tiên hơn /goods-issues/:id nên không đè chi tiết phiếu xuất. */}
      <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"]} />}>
        <Route path="/goods-issues/pending-orders" element={<DonChoXuatPage />} />
        <Route path="/goods-issues/pick-lists" element={<PickListList />} />
        <Route path="/goods-issues/pick-lists/:id" element={<PickListDetail />} />
        <Route path="/goods-issues/packing/:donId" element={<DongGoiPage />} />
      </Route>

      {/* Đối soát chuyển khoản: xử lý giao dịch đã nhận tiền nhưng chưa có đơn — chỉ quản trị viên (khớp @RequireAuth) */}
      <Route element={<RequireRole roles={["quan_tri_vien"]} />}>
        <Route path="/pos-transfers" element={<DoiSoatChuyenKhoan />} />
      </Route>

      {/* Kênh bán hàng (FO-073–077) — chỉ quản trị viên (backend cũng chặn bằng @RequireAuth) */}
      <Route element={<RequireRole roles={["quan_tri_vien"]} />}>
        <Route path="/channels" element={<ChannelsPage />} />
        {/* Mỗi sàn (shopify, lazada, tiktok) cùng bộ trang; sàn chờ cấp API (shopee) chỉ có màn giới thiệu, trang con
            chuyển về đó; mã sàn lạ thì KenhHopLe hiện "Không tìm thấy trang" */}
        <Route element={<KenhHopLe />}>
          {/* Trang quay về sau khi người bán đồng ý trên trang của sàn (redirect_uri của ứng dụng) */}
          <Route path="/channels/oauth/callback/:maKenh" element={<OAuthCallbackPage />} />
          <Route path="/channels/:maKenh" element={<ChannelSyncDashboard />} />
          <Route path="/channels/:maKenh/setup" element={<ChannelSetupWizard />} />
          <Route path="/channels/:maKenh/products" element={<ChannelMappingsPage />} />
          <Route path="/channels/:maKenh/orders" element={<ChannelOrdersPage />} />
          <Route path="/channels/:maKenh/tools" element={<ChuyenSangSanPham />} />
          <Route path="/channels/:maKenh/settings" element={<ChannelSettingsPage />} />
        </Route>
      </Route>
      </Route>

      {/* POS — Bán hàng tại quầy: màn hình toàn màn hình riêng, NGOÀI BackofficeLayout
          (không sidebar/header quản trị). Vẫn dưới ProtectedRoute; chỉ quản trị viên
          + nhân viên bán hàng (khớp sidebar; backend vẫn là chốt chặn thật). */}
      <Route element={<PosLayout />}>
        <Route element={<RequireRole roles={["quan_tri_vien", "nhan_vien_ban_hang"]} />}>
          <Route path="/pos" element={<PosPage />} />
        </Route>
      </Route>

      {/* In phiếu — ngoài BackofficeLayout (không sidebar/header, không bị shell clipping) */}
      <Route path="/purchase-requests/:id/print" element={<PurchaseRequestPrint />} />
      <Route path="/quotation-requests/:id/print" element={<QuotationRequestPrint />} />
      <Route path="/purchase-orders/:id/print" element={<PurchaseOrderPrint />} />
      <Route path="/goods-receipts/:id/print" element={<PhieuNhapKhoPrint />} />
      <Route path="/goods-issues/:id/print" element={<PhieuXuatKhoPrint />} />
      {/* Chuyển kho nội bộ: loai = yeu-cau | lenh-dieu-dong | xknb | bien-ban; phiếu điều chỉnh kho in riêng */}
      <Route path="/transfer-tickets/:id/print/:loai" element={<InChuyenKho />} />
      <Route path="/transfer-tickets/adjustments/:id/print" element={<InChuyenKho dieuChinh />} />
      <Route path="/sales-quotations/:id/print" element={<BaoGiaPrint />} />
      <Route path="/sales-orders/:id/invoice" element={<DonBanHangInvoice />} />
    </Route>

    {/* ========== 404 ========== */}
    <Route
      path="*"
      element={<NotFound404 />}
    />
  </>
);

ghiNhanCayDuongDan(createRoutesFromChildren(CAY_DUONG_DAN));

// Mở app (F5, link trực tiếp) khi đã đăng nhập: tải tệp trang song song với lúc ProtectedRoute hỏi máy chủ /me,
// thay vì chờ /me xong mới bắt đầu tải. Gõ thẳng tên miền ("/") thì RootOAuthRedirect sẽ chuyển về Tổng quan.
try {
  if (localStorage.getItem("access_token")) {
    const { pathname, search } = window.location;
    taiTruocDuongDan(pathname === "/" && !search ? "/dashboard" : pathname + search);
  }
} catch {
  // Trình duyệt chặn lưu trữ: bỏ qua, trang vẫn tải lúc dựng như thường
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Toaster global: dùng chung cho mọi trang (kể cả auth — toast từ ProtectedRoute
          cần sống sót khi chuyển sang /login, nơi BackofficeLayout không còn mount) */}
      <Toaster />
      <ThanhTaiTrang />
      {/* Chờ tải / lỗi của trang ngoài khung quản trị (trang in, đăng nhập, quên mật khẩu...); trong khung thì
          BackofficeLayout, SettingsLayout, PosLayout có vùng riêng để menu vẫn hiện */}
      <VungTaiTrang className="min-h-dvh">
      <Routes>{CAY_DUONG_DAN}</Routes>
      </VungTaiTrang>
    </BrowserRouter>
  );
}
