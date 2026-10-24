import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import BackofficeLayout from "@/components/backoffice/BackofficeLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import Login from "./pages/Login";
import UserDetail from "./pages/UserDetail";
import ForgotPassword from "./pages/ForgotPassword";
import Warehouse from "./pages/warehouse/Warehouse";
import SupplierList from "./pages/supplier/SupplierList";
import SupplierDetailView from "./pages/supplier/SupplierDetailView";
import ProductList from "./pages/product";
import ViewUserListByAdmin from "./pages/admin/ViewUserListByAdmin";
import ViewUserDetailByAdmin from "@/pages/admin/ViewUserDetailByAdmin.jsx";
import EditUserRoleByAdmin from "@/pages/admin/EditUserRoleByAdmin.jsx";
import PhieuNhapKhoList from "./pages/receipt/PhieuNhapKhoList";
import PhieuNhapKhoCreate from "./pages/receipt/PhieuNhapKhoCreate";
import PhieuNhapKhoDetail from "./pages/receipt/PhieuNhapKhoDetail.jsx";
import KhaiBaoLo from "./pages/receipt/KhaiBaoLo.jsx";
import KiemDemLo from "./pages/receipt/KiemDemLo.jsx";
import ViTriKhoPage from "./pages/warehouse/vi-tri-kho/ViTriKhoPage.jsx";
import MaVachNhaCungCapPage from "./pages/supplier/MaVachNhaCungCapPage.jsx";
import PhieuXuatKhoList from "./pages/issue/PhieuXuatKhoList.jsx";
import PurchaseOrderDetail from "./pages/order/PurchaseOrderDetail.jsx";
import PurchaseOrder from "./pages/order/PurchaseOrder.jsx";
import GuiBaoGiaCuRedirect from "./pages/order/GuiBaoGiaCuRedirect.jsx";
import SkuBuilder from "./pages/product/SkuBuilder";
import PhieuXuatKhoCreate from "./pages/issue/PhieuXuatKhoCreate.jsx";
import PhieuXuatKhoDetail from "./pages/issue/PhieuXuatKhoDetail.jsx";
import PhieuXuatKhoView from "./pages/issue/PhieuXuatKhoView.jsx";
import PickLot from "./pages/issue/PickLot.jsx";
import SupplierQuotation from "./pages/supplier/pages/Supplierquotation.jsx";
import SupplierLogin from "./pages/supplier/pages/Supplierlogin.jsx";
import KhachHangPage from "./pages/customer/KhachHangPage";
import DanhMucQuanAoTree from "./pages/danh-muc-quan-ao/DanhMucQuanAoTree.jsx";
import PhieuChuyenKhoList from "./pages/chuyenKhoNoiBo/PhieuChuyenKhoList";
import KhachHangDetails from "./pages/customer/KhachHangDetails";
import ProductAttributeHub from "@/pages/attribute/ProductAttributeHub";
import DonBanHangList from "./pages/sales-orders/DonBanHangList";
import DonBanHangDetail from "./pages/sales-orders/DonBanHangDetail";
import DonBanHangInvoice from "./pages/sales-orders/DonBanHangInvoice";
import DonBanHangCreate from "./pages/sales-orders/DonBanHangCreate";
import DoiSoatChuyenKhoan from "./pages/pos-transfers/DoiSoatChuyenKhoan";
import ProductDetail from "./pages/product/components/product/ProductDetail";
import PhieuChuyenKhoDetail from "./pages/chuyenKhoNoiBo/PhieuChuyenKhoDetail";
import PhieuChuyenKhoCreate from "./pages/chuyenKhoNoiBo/PhieuChuyenKhoCreate";
import StockTakeList from "./pages/stock-take/StockTakeList";
import StockTakeCreate from "./pages/stock-take/StockTakeCreate";
import StockTakeDetail from "./pages/stock-take/StockTakeDetail";
import BaoCaoDoanhThu from "./pages/bao-cao/BaoCaoDoanhThu";
import KhachHangReport from "./pages/bao-cao/KhachHangReport";
import NhatKyNhapXuat from "./pages/bao-cao/NhatKyNhapXuat";
import PhieuNhapKhoPrint from "./pages/receipt/PhieuNhapKhoPrint";
import PhieuXuatKhoPrint from "./pages/issue/PhieuXuatKhoPrint";
import Dashboard from "@/pages/dashboard/Dashboard";
import NotFound404 from "./pages/page-error/NotFound404";
import TonKhoTongQuan from "./pages/bao-cao/TonKhoTongQuan";
import LichSuGiaoDichKhoList from "./pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList";
import QuotationRequestList from "./pages/order/QuotationRequestList";
import QuotationRequestCreate from "./pages/order/QuotationRequestCreate";
import PurchaseOrderCreateManual from "./pages/order/PurchaseOrderCreateManual";
import BaoGiaList from "./pages/sales-orders/Bao-gia/BaoGiaList";
import BaoGiaCreate from "./pages/sales-orders/Bao-gia/BaoGiaCreate";
import BaoGiaDetail from "./pages/sales-orders/Bao-gia/BaoGiaDetail";
import BaoGiaPrint from "./pages/sales-orders/Bao-gia/BaoGiaPrint";
import PurchaseRequestList from "./pages/order/PurchaseRequestList";
import CreatePurchaseRequestPage from "./pages/order/CreatePurchaseRequestPage";
import SendQuotationRequestPage from "./pages/order/SendQuotationRequestPage";
import PurchaseRequestDetail from "./pages/order/PurchaseRequestDetail";
import QuotationRequestDetail from "./pages/order/QuotationRequestDetail";
import QuotationDetail from "./pages/order/QuotationDetail";
import PurchaseRequestPrint from "./pages/order/PurchaseRequestPrint";
import QuotationRequestPrint from "./pages/order/QuotationRequestPrint";
import PurchaseOrderPrint from "./pages/order/PurchaseOrderPrint";
import PrintTemplateEditorPage from "./pages/settings/PrintTemplateEditorPage";
import PaymentSettingsPage from "./pages/settings/PaymentSettingsPage";
import SettingsLayout from "./pages/settings/SettingsLayout";
import OperationsSettingsPage from "./pages/settings/OperationsSettingsPage";
import StoreSettingsPage from "./pages/settings/StoreSettingsPage";
import PrintTemplateListPage from "./pages/settings/PrintTemplateListPage";
import { SETTINGS_ROLES } from "./components/settings/settings.config";
import RequireRole from "./components/auth/RequireRole";
import PosPage from "./pages/pos";
import PosLayout from "./pages/pos/PosLayout";
import DonChoXuatPage from "./pages/issue/DonChoXuatPage";
import PickListList from "./pages/issue/PickListList";
import PickListDetail from "./pages/issue/PickListDetail";
import DongGoiPage from "./pages/issue/DongGoiPage";
import ChannelsPage from "./pages/channels/ChannelsPage";
import ChannelSetupWizard from "./pages/channels/ChannelSetupWizard";
import ChannelMappingsPage from "./pages/channels/ChannelMappingsPage";
import ChannelSyncDashboard from "./pages/channels/ChannelSyncDashboard";
import ChannelOrdersPage from "./pages/channels/ChannelOrdersPage";
import ChannelSettingsPage from "./pages/channels/ChannelSettingsPage";
import OAuthCallbackPage from "./pages/channels/OAuthCallbackPage";
import KenhHopLe from "./pages/channels/KenhHopLe";

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

export default function App() {
  return (
    <BrowserRouter>
      {/* Toaster global: dùng chung cho mọi trang (kể cả auth — toast từ ProtectedRoute
          cần sống sót khi chuyển sang /login, nơi BackofficeLayout không còn mount) */}
      <Toaster />
      <Routes>
        {/* ========== PUBLIC ROUTES ========== */}
        <Route path="/" element={<Navigate to={localStorage.getItem("access_token") ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/supplier/quotation" element={<SupplierQuotation />} />
        {/* Trang cũ sau khi gửi báo giá: nay báo thành công ngay trên trang báo giá; giữ đường dẫn để link cũ không hỏng */}
        <Route path="/quote-success" element={<Navigate to="/supplier/login" replace />} />
        <Route path="/supplier/login" element={<SupplierLogin />} />

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
          <Route path="/sku-builder" element={<SkuBuilder />} />
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
          <Route path="/purchase-requests/create" element={<CreatePurchaseRequestPage />} />
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
              <Route path="stock" element={<OperationsSettingsPage key="stock" part="stock" />} />
              <Route path="sync" element={<OperationsSettingsPage key="sync" part="sync" />} />
              <Route path="customer" element={<OperationsSettingsPage key="customer" part="customer" />} />
              <Route path="inbound" element={<OperationsSettingsPage key="inbound" part="inbound" />} />
              <Route path="store" element={<StoreSettingsPage />} />
              <Route path="payment" element={<PaymentSettingsPage />} />
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
            {/* Mỗi sàn (shopify, lazada, tiktok) cùng bộ trang; mã sàn lạ thì KenhHopLe hiện "Không tìm thấy trang" */}
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
          <Route path="/sales-quotations/:id/print" element={<BaoGiaPrint />} />
          <Route path="/sales-orders/:id/invoice" element={<DonBanHangInvoice />} />
        </Route>

        {/* ========== 404 ========== */}
        <Route
          path="*"
          element={<NotFound404 />}
        />
      </Routes>
    </BrowserRouter>
  );
}
