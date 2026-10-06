import { useEffect } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import BackofficeSidebar from "./BackofficeSidebar";
import BackofficeHeader from "./BackofficeHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import "@/styles/print.css";

const DEFAULT_DOCUMENT_TITLE =
    "FCentric |  Quản lý kho & bán lẻ thời trang đa kênh";

export default function BackofficeLayout() {
    const { pathname } = useLocation();
    const { mustChangePassword, setMustChangePassword } = useOutletContext();
    const handlePasswordChangeSuccess = () => setMustChangePassword(false);

    const PAGE_META_CONFIG = [
        {
            key: "DASHBOARD",
            match: (path) => path === "/dashboard",
            title: "Tổng quan Admin",
            subtitle: "Tổng quan hoạt động quản trị",
        },
        {
            key: "EDIT_USER_ROLE",
            match: (path) => path.endsWith("/edit-role"),
            title: "Chỉnh Sửa Quyền Người Dùng",
            subtitle: "Cập nhật quyền hạn cho người dùng dựa trên chức vụ",
        },
        {
            key: "ADD_USER",
            match: (path) => path === "/users/add",
            title: "Thêm người dùng",
            subtitle: "Thêm người dùng mới",
        },
        {
            key: "USER_PROFILE",
            // giữ legacy regex để tránh flash meta khi /user/:id redirect sang /profile
            match: (path) => path === "/profile" || /^\/user\/\d+$/.test(path),
            title: "Hồ sơ cá nhân",
            subtitle: "Thông tin tài khoản của bạn",
        },
        {
            key: "USER_DETAIL",
            match: (path) =>
                /^\/admin\/users\/\d+$/.test(path),
            title: "Chi tiết người dùng",
            subtitle: "Thông tin chi tiết",
        },
        {
            key: "USER_LIST",
            match: (path) => path === "/users",
            title: "Danh sách người dùng",
        },
        {
            key: "ATTRIBUTES",
            match: (path) => path === "/attributes",
            title: "Quản lý thuộc tính",
            subtitle: "Màu sắc/ Kích cỡ/ Chất liệu",
        },
        {
            key: "MATERIALS",
            match: (path) => path === "/material",
            title: "Quản lý chất liệu",
            subtitle: "Chất liệu sản phẩm",
        },
        {
            key: "PRODUCTS",
            match: (path) => path === "/products",
            title: "Quản lý sản phẩm",
            subtitle: "Danh sách sản phẩm",
        },
        {
            key: "SKU_BUILDER",
            match: (path) => path === "/sku-builder",
            title: "Danh sách Biến thể và Giá",
            subtitle: "Quản lý biến thể SKU và giá sản phẩm",
        },
        {
            key: "SUPPLIERS",
            match: (path) => path === "/supplier",
            title: "Quản lý nhà cung cấp",
            subtitle: "Danh sách nhà cung cấp",
        },
        {
            key: "WAREHOUSE",
            match: (path) => path === "/warehouse",
            title: "FCentric · INVENTORY",
            subtitle: "Quản lý kho hàng",
        },
        {
            key: "LICH_SU_GIAO_DICH_KHO",
            match: (path) => path === "/lich-su-giao-dich-kho",
            title: "Lịch sử giao dịch kho",
            subtitle: "Xem lịch sử các giao dịch nhập xuất trong kho",
        },
        {
            key: "GOODS_RECEIPTS",
            match: (path) => path === "/goods-receipts",
            title: "Quản lý phiếu nhập kho",
            subtitle: "Danh sách phiếu nhập kho",
        },
        {
            key: "GOODS_RECEIPTS_CREATE",
            match: (path) => path === "/goods-receipts/create",
            title: "Tạo phiếu nhập kho",
            subtitle: "Tạo mới phiếu nhập kho từ đơn mua hàng",
        },
        {
            key: "GOODS_RECEIPTS_DETAIL",
            match: (path) => /^\/goods-receipts\/\d+$/.test(path),
            title: "Chi tiết phiếu nhập kho",
            subtitle: "",
        },
        {
            key: "LOT_INPUT",
            match: (path) => /^\/goods-receipts\/\d+\/lot-input\/\d+$/.test(path),
            title: "Khai báo lô",
            subtitle: "Khai báo thông tin lô cho sản phẩm nhập kho",
        },
        {
            key: "GOODS_ISSUES",
            match: (path) => path === "/goods-issues",
            title: "Quản lý phiếu xuất kho",
            subtitle: "Danh sách phiếu xuất kho",
        },
        {
            key: "GOODS_ISSUES_CREATE",
            match: (path) => path === "/goods-issues/create",
            title: "Tạo phiếu xuất kho",
            subtitle: "Tạo mới phiếu xuất kho từ đơn bán hàng",
        },
        {
            key: "GOODS_ISSUES_DETAIL",
            match: (path) => /^\/goods-issues\/\d+$/.test(path),
            title: "Chi tiết phiếu xuất kho",
            subtitle: "Xem chi tiết phiếu xuất kho",
        },
        {
            key: "PURCHASE_REQUESTS",
            match: (path) => path === "/purchase-requests",
            title: "Yêu cầu nhập hàng",
            subtitle: "Quản lý các yêu cầu nhập hàng từ nhà cung cấp",
        },
        {
            key: "PURCHASE_ORDERS",
            match: (path) => path === "/purchase-orders",
            title: "Đơn mua hàng",
            subtitle: "Danh sách các đơn hàng nhập đã được xác nhận",
        },
        {
            key: "TRANSFER_TICKETS",
            match: (path) => path === "/transfer-tickets",
            title: "Quản lý phiếu chuyển kho nội bộ",
            subtitle: "Danh sách phiếu chuyển kho nội bộ",
        },
        {
            key: "PICK_LOT",
            match: (path) => /^\/goods-issues\/\d+\/pick-lot\/\d+$/.test(path),
            title: "Chọn lô hàng",
            subtitle: "Chọn lô hàng để xuất kho",
        },
        {
            key: "STOCK_TAKE_LIST",
            match: (path) => path === "/stock-take",
            title: "Kiểm kê kho hàng",
            subtitle: "Quản lý và theo dõi các đợt kiểm kê kho",
        },
        {
            key: "STOCK_TAKE_CREATE",
            match: (path) => path === "/stock-take/new",
            title: "Tạo đợt kiểm kê",
            subtitle: "Chọn kho và điền thông tin để bắt đầu kiểm kê",
        },
        {
            key: "STOCK_TAKE_DETAIL",
            match: (path) => /^\/stock-take\/\d+$/.test(path),
            title: "Chi tiết đợt kiểm kê",
            subtitle: "Thông tin chi tiết đợt kiểm kê đã hoàn thành",
        },
        {
            key: "DANH_MUC_QUAN_AO",
            match: (path) => path === "/danh-muc-quan-ao",
            title: "Quản lý danh mục",
            subtitle: "Xem và quản lý cấu trúc danh mục quần áo",
        },
        {
            key: "CHI_TIET_SAN_PHAM",
            match: (path) => /^\/products\/\d+$/.test(path),
            title: "Chi tiết sản phẩm",
            subtitle: "Xem thông tin chi tiết về sản phẩm",
        },
        {
            key: "CREATE_TRANSFER_TICKET",
            match: (path) => path === "/transfer-tickets/create",
            title: "Tạo phiếu chuyển kho nội bộ",
            subtitle: "Tạo mới phiếu chuyển kho nội bộ",
        },
        {
            key: "TRANSFER_TICKET_DETAIL",
            match: (path) => /^\/transfer-tickets\/\d+$/.test(path),
            title: "Chi tiết phiếu chuyển kho nội bộ",
            subtitle: "Xem chi tiết phiếu chuyển kho nội bộ",
        },
        {
            key: "SALES_ORDERS",
            match: (path) => path === "/sales-orders",
            title: "Quản lý đơn bán hàng",
            subtitle: "Danh sách đơn bán hàng",
        },
        {
            key: "POS",
            match: (path) => path === "/pos",
            title: "Bán hàng tại quầy",
            subtitle: "Bán lẻ trực tiếp tại cửa hàng",
        },
        {
            key: "SALES_ORDER_DETAIL",
            match: (path) => /^\/sales-orders\/\d+$/.test(path),
            title: "Chi tiết đơn bán hàng",
            subtitle: "Xem chi tiết đơn hàng",
        },
        {
            key: "CREATE_SALES_ORDER",
            match: (path) => path === "/sales-orders/create",
            title: "Tạo đơn bán hàng",
            subtitle: "Tạo mới đơn bán hàng",
        },
        {
            key: "BAO_CAO_DOANH_THU",
            match: (path) => path === "/bao-cao/doanh-thu",
            title: "Báo cáo doanh thu",
            subtitle: "Xem báo cáo doanh thu theo thời gian",
        },
        {
            key: "BAO_CAO_KHACH_HANG",
            match: (path) => path === "/bao-cao/khach-hang",
            title: "Báo cáo khách hàng",
            subtitle: "Xem báo cáo về khách hàng theo thời gian",
        },
        {
            key: "BAO_CAO_NHAP_XUAT",
            match: (path) => path === "/bao-cao/xuat-nhap",
            title: "Báo cáo nhập xuất",
            subtitle: "Xem báo cáo về nhập xuất hàng hóa theo thời gian",
        },
        {
            key: "PHIEU_NHAP_KHO_PRINT",
            match: (path) => /^\/goods-receipts\/\d+\/print$/.test(path),
            title: "In phiếu nhập kho",
            subtitle: "Xem bản in phiếu nhập kho",
        },
        {
            key: "PHIEU_XUAT_KHO_PRINT",
            match: (path) => /^\/goods-issues\/\d+\/print$/.test(path),
            title: "In phiếu xuất kho",
            subtitle: "Xem bản in phiếu xuất kho",
        },
        {
            key: "STOCK_TAKE",
            match: (path) => path === "/stock-take",
            title: "Quản lý kiểm kê",
            subtitle: "Xem và quản lý các lần kiểm kê tồn kho",
        },
        {
            key: "CUSTOMERS",
            match: (path) => path === "/customers",
            title: "Quản lý khách hàng",
            subtitle: "Danh sách và thông tin khách hàng",
        },
        {
            key: "CUSTOMER_DETAIL",
            match: (path) => /^\/customers\/\d+$/.test(path),
            title: "Chi tiết khách hàng",
            subtitle: "Xem và quản lý thông tin chi tiết của khách hàng trong hệ thống",
        },
        {
            key: "CUSTOMER_EDIT",
            match: (path) => /^\/customers\/\d+\/edit$/.test(path),
            title: "Chỉnh sửa khách hàng",
            subtitle: "Cập nhật thông tin khách hàng",
        },
        {
            key: "SUPPLIER_EDIT",
            match: (path) => /^\/supplier\/\d+$/.test(path),
            title: "Chỉnh sửa nhà cung cấp",
            subtitle: "Cập nhật thông tin nhà cung cấp",
        },
        {
            key: "SUPPLIER_DETAIL",
            match: (path) => /^\/supplier\/view\/\d+$/.test(path),
            title: "Chi tiết nhà cung cấp",
            subtitle: "",
        },
        {
            key: "SUPPLIER_CREATE",
            match: (path) => path === "/supplier/new",
            title: "Thêm nhà cung cấp mới",
            subtitle: "Nhập thông tin để tạo nhà cung cấp mới",
        },
        {
            key: "INVENTORY_REPORT",
            match: (path) => path === "/bao-cao/ton-kho",
            title: "Báo cáo tồn kho",
        },
        {
            key: "SALES_INVOICE_PRINT",
            match: (path) => /^\/sales-orders\/\d+\/invoice$/.test(path),
            title: "In hóa đơn bán hàng",
        },
        {
            key: "USER_DETAIL",
            match: (path) => /^\/users\/\d+$/.test(path),
            title: "Thông tin chi tiết người dùng",
        },
        {
            key: "PURCHASE_REQUEST_QUOTATION",
            match: (path) => /^\/purchase-requests\/\d+\/send-quotation$/.test(path),
            title: "Tạo yêu cầu báo giá",
            subtitle: "Gửi yêu cầu báo giá đến nhà cung cấp dựa trên phiếu yêu cầu",
        },
        {
            key: "QUOTATION_REQUEST",
            match: (path) => path === "/quotation-requests",
            title: "Danh sách yêu cầu báo giá",
        },
        {
            key: "QUOTATION_REQUEST_CREATE",
            match: (path) => path === "/quotation-requests/create",
            title: "Tạo yêu cầu báo giá",
        },
        {
            key: "PURCHASE_REQUEST_CREATE",
            match: (path) => path === "/purchase-requests/create",
            title: "Tạo yêu cầu nhập hàng",
        },
        {
            key: "PURCHASE_ORDER_CREATE",
            match: (path) => path === "/purchase-orders/create",
            title: "Tạo đơn mua hàng",
        },
        {
            key: "PURCHASE_REQUEST_DETAIL",
            match: (path) => /^\/purchase-requests\/\d+$/.test(path),
            title: "Chi tiết yêu cầu nhập hàng",
        },
        {
            key: "QUOTATION_REQUEST_DETAIL",
            match: (path) => /^\/quotation-requests\/\d+$/.test(path),
            title: "Chi tiết yêu cầu báo giá",
        },
        {
            key: "QUOTATION_DETAIL",
            match: (path) => /^\/quotation\/\d+$/.test(path),
            title: "Chi tiết báo giá",
        },
        {
            key: "PURCHASE_ORDER_DETAIL",
            match: (path) => /^\/purchase-orders\/\d+$/.test(path),
            title: "Chi tiết đơn mua hàng",
        },
        {
            key: "SALE_QUOTATION",
            match: (path) => path === "/sales-quotations",
            title: "Danh sách báo giá bán hàng",
        },
        {
            key: "SALE_QUOTATION_CREATE",
            match: (path) => path === "/sales-quotations/create",
            title: "Tạo báo giá bán hàng",
        },
        {
            key: "SALE_QUOTATION_DETAIL",
            match: (path) => /^\/sales-quotations\/\d+$/.test(path),
            title: "Chi tiết báo giá bán hàng",
        },
        {
            key: "PRINT_TEMPLATES",
            match: (path) =>
                path === "/settings/print-templates" ||
                /^\/settings\/print-templates\/[^/]+$/.test(path),
            title: "Cấu hình mẫu in",
            subtitle: "Xem các mẫu in có sẵn theo loại chứng từ",
        },
        {
            key: "PRINT_TEMPLATE_EDIT",
            match: (path) => /^\/settings\/print-templates\/[^/]+\/([^/]+\/)?edit$/.test(path),
            title: "Chỉnh sửa mẫu in",
            subtitle: "Tùy chỉnh hiển thị của mẫu in",
        },
        {
            key: "PRINT_TEMPLATE_DETAIL",
            match: (path) => /^\/settings\/print-templates\/[^/]+\/[^/]+$/.test(path),
            title: "Mẫu in",
            subtitle: "Xem trước mẫu in",
        },
    ];

    const pageMeta = PAGE_META_CONFIG.find((item) =>
        item.match(pathname)
    );

    useEffect(() => {
        const pageTitle =
            pageMeta?.key === "WAREHOUSE"
                ? "Quản lý kho hàng"
                : pageMeta?.title;

        document.title = pageTitle
            ? `FCentric | ${pageTitle}`
            : DEFAULT_DOCUMENT_TITLE;
    }, [pageMeta?.key, pageMeta?.title]);

    useEffect(() => {
        return () => {
            document.title = DEFAULT_DOCUMENT_TITLE;
        };
    }, []);

    return (
        <>
        <SidebarProvider defaultOpen>
            <div
                data-backoffice-shell
                className="flex h-dvh min-h-0 w-full overflow-hidden bg-bo-canvas font-backoffice text-bo-foreground"
            >
                <a
                    href="#backoffice-main-content"
                    className="no-print fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-bo-primary px-3 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
                >
                    Bỏ qua menu
                </a>
                {/* SIDEBAR */}
                <BackofficeSidebar />

                {/* MAIN CONTENT */}
                <SidebarInset className="flex min-w-0 flex-col bg-bo-canvas">
                    <BackofficeHeader
                        title={pageMeta?.title}
                        subtitle={pageMeta?.subtitle}
                        routeKey={pageMeta?.key}
                    />

                    <main
                        id="backoffice-main-content"
                        tabIndex="-1"
                        className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bo-canvas"
                    >
                        <Outlet />
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
        <ChangePasswordModal
            open={mustChangePassword}
            forceChange={true}
            onOpenChange={() => {}}
            onSuccess={handlePasswordChangeSuccess}
        />
        </>
    );
}