import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BackofficeLayout from "@/components/backoffice/BackofficeLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import Login from "./pages/Login";
import UserDetail from "./pages/UserDetail";
import ForgotPassword from "./pages/ForgotPassword";
import Warehouse from "./pages/warehouse/Warehouse";
import ChatLieuList from "./pages/attribute/ChatLieuList";
import ChatLieuDetail from "./pages/attribute/ChatLieuDetail";
import ChatLieuDetailView from "./pages/attribute/ChatLieuDetailView";
import SupplierList from "./pages/supplier/SupplierList";
import SupplierDetail from "./pages/supplier/SupplierDetail";
import SupplierDetailView from "./pages/supplier/SupplierDetailView";
import ProductList from "./pages/product";
import AddUserByAdmin from "@/pages/admin/AddUserByAdmin.jsx";
import ViewUserListByAdmin from "./pages/admin/ViewUserListByAdmin";
import ViewUserDetailByAdmin from "@/pages/admin/ViewUserDetailByAdmin.jsx";
import EditUserRoleByAdmin from "@/pages/admin/EditUserRoleByAdmin.jsx";
import DashboardByAdmin from "@/pages/admin/DashboardByAdmin.jsx";
import ColorSizeManagement from "@/pages/attribute/ColorSizeManagement.jsx";
import PhieuNhapKhoList from "./pages/receipt/PhieuNhapKhoList";
import PhieuNhapKhoCreate from "./pages/receipt/PhieuNhapKhoCreate";
import PhieuNhapKhoDetail from "./pages/receipt/PhieuNhapKhoDetail.jsx";
import KhaiBaoLo from "./pages/receipt/KhaiBaoLo.jsx";
import PhieuXuatKhoList from "./pages/issue/PhieuXuatKhoList.jsx";
import PurchaseOrderDetail from "./pages/order/PurchaseOrderDetail.jsx";
import PurchaseOrder from "./pages/order/PurchaseOrder.jsx";
import PurchaseOrderCreate from "./pages/order/PurchaseOrderCreate.jsx";
import PurchaseOrderPayment from "./pages/order/PurchaseOrderPayment.jsx";
import SendQuotationRequest from "./pages/order/SendQuotationRequest.jsx";
import SkuBuilder from "./pages/product/SkuBuilder";
import PhieuXuatKhoCreate from "./pages/issue/PhieuXuatKhoCreate.jsx";
import PhieuXuatKhoDetail from "./pages/issue/PhieuXuatKhoDetail.jsx";
import PhieuXuatKhoView from "./pages/issue/PhieuXuatKhoView.jsx";
import PickLot from "./pages/issue/PickLot.jsx";
import QuoteSuccess from "./pages/supplier/pages/Quotesuccess.jsx";
import SupplierQuotation from "./pages/supplier/pages/Supplierquotation.jsx";
import SupplierLogin from "./pages/supplier/pages/Supplierlogin.jsx";
import KhachHangPage from "./pages/customer/KhachHangPage";
import DanhMucQuanAoTree from "./pages/danh-muc-quan-ao/DanhMucQuanAoTree.jsx";
import PhieuChuyenKhoList from "./pages/chuyenKhoNoiBo/PhieuChuyenKhoList";
import KhachHangDetails from "./pages/customer/KhachHangDetails";
import KhachHangEdit from "./pages/customer/KhachHangEdit";
import ProductAttributeHub from "@/pages/attribute/ProductAttributeHub";
import DonBanHangList from "./pages/sales-orders/DonBanHangList";
import DonBanHangDetail from "./pages/sales-orders/DonBanHangDetail";
import DonBanHangInvoice from "./pages/sales-orders/DonBanHangInvoice";
import DonBanHangCreate from "./pages/sales-orders/DonBanHangCreate";
import ProductDetail from "./pages/product/components/product/ProductDetail";
import PhieuChuyenKhoDetail from "./pages/chuyenKhoNoiBo/PhieuChuyenKhoDetail";
import PhieuChuyenKhoCreate from "./pages/chuyenKhoNoiBo/PhieuChuyenKhoCreate";
import StockTakeList from "./pages/stock-take/StockTakeList";
import StockTakeCreate from "./pages/stock-take/StockTakeCreate";
import BaoCaoDoanhThu from "./pages/bao-cao/BaoCaoDoanhThu";
import KhachHangReport from "./pages/bao-cao/KhachHangReport";
import NhatKyNhapXuat from "./pages/bao-cao/NhatKyNhapXuat";
import PhieuNhapKhoPrint from "./pages/receipt/PhieuNhapKhoPrint";
import PhieuXuatKhoPrint from "./pages/issue/PhieuXuatKhoPrint";
import Dashboard from "@/pages/dashboard/Dashboard";
import NotFound404 from "./pages/page-error/NotFound404";
import TonKhoTongQuan from "./pages/bao-cao/TonKhoTongQuan";
import ApplicationRequestManagement from "./pages/purchase-oder-create-req/ApplicationRequestManagement";
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
import PrintTemplatesPage from "./pages/settings/PrintTemplatesPage";
import PrintTemplateDetailPage from "./pages/settings/PrintTemplateDetailPage";
import PrintTemplateEditorPage from "./pages/settings/PrintTemplateEditorPage";
import InventorySystemSettingsPage from "./pages/settings/InventorySystemSettingsPage";
import PaymentSettingsPage from "./pages/settings/PaymentSettingsPage";
import RequireRole from "./components/auth/RequireRole";
import PosPage from "./pages/pos";
import PosLayout from "./pages/pos/PosLayout";
import DonChoXuatPage from "./pages/issue/DonChoXuatPage";
import PickListList from "./pages/issue/PickListList";
import PickListDetail from "./pages/issue/PickListDetail";
import ChannelsPage from "./pages/channels/ChannelsPage";
import ChannelSetupWizard from "./pages/channels/ChannelSetupWizard";
import ChannelMappingsPage from "./pages/channels/ChannelMappingsPage";
import ChannelSyncDashboard from "./pages/channels/ChannelSyncDashboard";

export default function App() {
  return (
    <BrowserRouter>
      {/* Toaster global: dùng chung cho mọi trang (kể cả auth — toast từ ProtectedRoute
          cần sống sót khi chuyển sang /login, nơi BackofficeLayout không còn mount) */}
      <Toaster position="top-center" richColors />
      <Routes>
        {/* ========== PUBLIC ROUTES ========== */}
        <Route path="/" element={<Navigate to={localStorage.getItem("access_token") ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/supplier/quotation" element={<SupplierQuotation />} />
        <Route path="/quote-success" element={<QuoteSuccess />} />
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
          <Route path="/users/add" element={<AddUserByAdmin />} />
          <Route path="/users/:id" element={<ViewUserDetailByAdmin />} />
          <Route
            path="/users/:id/edit-role"
            element={<EditUserRoleByAdmin />}
          />

          {/* Attributes */}
          <Route path="/attribute" element={<ColorSizeManagement />} />
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

          {/* Material */}
          {/* <Route path="/material" element={<ChatLieuList />} /> */}
          {/* <Route path="/material/new" element={<ChatLieuDetail />} />
          <Route path="/material/view/:id" element={<ChatLieuDetailView />} />
          <Route path="/material/:id" element={<ChatLieuDetail />} /> */}

          {/* Purchase Order */}
          <Route path="/purchase-requests" element={<PurchaseRequestList />} />
          <Route path="/purchase-orders" element={<PurchaseOrder />} />
          <Route path="/purchase-requests/create" element={<CreatePurchaseRequestPage />} />
          <Route path="/purchase-requests/:id/send-quotation" element={<SendQuotationRequestPage />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
          <Route path="/purchase-orders/:id/payment" element={<PurchaseOrderPayment />} />
          <Route path="/purchase-requests/:id/gui-bao-gia" element={<SendQuotationRequest />} />
          <Route path="/quotation-requests" element={<QuotationRequestList />} />
          <Route path="/quotation-requests/create" element={<QuotationRequestCreate />} />
          <Route path="/quotation-requests/:id" element={<QuotationRequestDetail />} />
          <Route path="/quotation/:id" element={<QuotationDetail />} />
          <Route path="/purchase-orders/create" element={<PurchaseOrderCreateManual />} />
          <Route path="/purchase-requests/:id" element={<PurchaseRequestDetail />} />
          

          {/* Supplier */}
          <Route path="/supplier" element={<SupplierList />} />
          <Route path="/supplier/new" element={<SupplierDetail />} />
          <Route path="/supplier/view/:id" element={<SupplierDetailView />} />
          <Route path="/supplier/:id" element={<SupplierDetail />} />

          {/* Customer */}
          <Route path="/customers" element={<KhachHangPage />} />
          <Route path="/customers/:id" element={<KhachHangDetails />} />
          <Route path="/customers/:id/edit" element={<KhachHangEdit />} />

          {/* Receipt*/}
          <Route path="/goods-receipts/create" element={<PhieuNhapKhoCreate />} />
          <Route path="/goods-receipts" element={<PhieuNhapKhoList />} />
          <Route path="/goods-receipts/:id" element={<PhieuNhapKhoDetail />} />
          <Route path="/goods-receipts/:phieuNhapKhoId/lot-input/:bienTheSanPhamId" element={<KhaiBaoLo />} />

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
          <Route path="/sales-quotations/create" element={<BaoGiaCreate />} />
          <Route path="/sales-quotations/:id" element={<BaoGiaDetail />} />

          {/* Chuyen kho noi bo */}
          <Route path="/transfer-tickets" element={<PhieuChuyenKhoList />} />
          <Route path="/transfer-tickets/create" element={<PhieuChuyenKhoCreate />} />
          <Route path="/transfer-tickets/:id" element={<PhieuChuyenKhoDetail />} />

          {/* Kiểm kê kho hàng*/}
          <Route path="/stock-take" element={<StockTakeList />} />
          <Route path="/stock-take/new" element={<StockTakeCreate />} />
          <Route path="/stock-take/:id" element={<StockTakeCreate />} /> {/* Để hoàn thành kiểm kê */}

          {/* Báo cáo */}
          <Route path="/reports/revenue" element={<BaoCaoDoanhThu />} />
          <Route path="/reports/customers" element={<KhachHangReport />} />
          <Route path="/reports/stock-movements" element={<NhatKyNhapXuat />} />
          <Route path="/reports/inventory" element={<TonKhoTongQuan />} />
          {/* Legacy: URL tiếng Việt cũ chuyển hướng sang URL mới */}
          <Route path="/bao-cao/doanh-thu" element={<Navigate to="/reports/revenue" replace />} />
          <Route path="/bao-cao/khach-hang" element={<Navigate to="/reports/customers" replace />} />
          <Route path="/bao-cao/xuat-nhap" element={<Navigate to="/reports/stock-movements" replace />} />
          <Route path="/bao-cao/ton-kho" element={<Navigate to="/reports/inventory" replace />} />

          <Route path="/duyet-don-hang" element={<ApplicationRequestManagement />} />

          {/*Lịch sử giao dịch kho */}
          <Route path="/inventory-transactions" element={<LichSuGiaoDichKhoList />} />
          {/* Legacy: URL tiếng Việt cũ chuyển hướng sang URL mới */}
          <Route path="/lich-su-giao-dich-kho" element={<Navigate to="/inventory-transactions" replace />} />

          {/* Cấu hình mẫu in — mỗi loại chứng từ có schema + mẫu riêng.
              Chỉ quan_tri_vien / quan_ly_kho được cấu hình (frontend guard là UX,
              backend @RequireAuth là chốt chặn thật). Trang chính nhúng preview;
              route /:documentType/:templateId giữ trang xem trước cũ cho deep-link. */}
          {/* Cài đặt thanh toán payOS — chỉ quản trị viên (backend cũng chặn bằng @RequireAuth) */}
          <Route element={<RequireRole roles={["quan_tri_vien"]} />}>
            <Route path="/settings/payment" element={<PaymentSettingsPage />} />
          </Route>
          <Route
            element={
              <RequireRole roles={["quan_tri_vien", "quan_ly_kho"]} />
            }
          >
            <Route path="/settings/print-templates" element={<PrintTemplatesPage />} />
            {/* Deep-link cũ của trang hồ sơ công ty — chuyển hướng về trang
                cấu hình mẫu in và mở hộp thoại "Thông tin công ty" */}
            <Route
              path="/settings/company-profile"
              element={<Navigate to="/settings/print-templates?action=company" replace />}
            />
            <Route path="/settings/print-templates/:documentType" element={<PrintTemplatesPage />} />
            <Route path="/settings/print-templates/:documentType/:templateId" element={<PrintTemplateDetailPage />} />
            <Route path="/settings/print-templates/:documentType/edit" element={<PrintTemplateEditorPage />} />
            <Route path="/settings/print-templates/:documentType/:templateId/edit" element={<PrintTemplateEditorPage />} />
          </Route>

          <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"]} />}>
            <Route path="/settings/inventory" element={<InventorySystemSettingsPage />} />
          </Route>

          {/* Xuất kho theo Pick List (FO-045–047) — vai trò kho, khớp @RequireAuth của NhatHangController.
              Đường dẫn tĩnh được ưu tiên hơn /goods-issues/:id nên không đè chi tiết phiếu xuất. */}
          <Route element={<RequireRole roles={["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"]} />}>
            <Route path="/goods-issues/pending-orders" element={<DonChoXuatPage />} />
            <Route path="/goods-issues/pick-lists" element={<PickListList />} />
            <Route path="/goods-issues/pick-lists/:id" element={<PickListDetail />} />
          </Route>

          {/* Kênh bán hàng (FO-073–077) — chỉ quản trị viên (backend cũng chặn bằng @RequireAuth) */}
          <Route element={<RequireRole roles={["quan_tri_vien"]} />}>
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/channels/sync" element={<ChannelSyncDashboard />} />
            <Route path="/channels/:id/setup" element={<ChannelSetupWizard />} />
            <Route path="/channels/:id/mappings" element={<ChannelMappingsPage />} />
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