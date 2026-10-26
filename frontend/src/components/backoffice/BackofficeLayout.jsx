import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import BackofficeSidebar from "./BackofficeSidebar";
import BackofficeHeader from "./BackofficeHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { PageTitleContext } from "./pageTitle";
import { SETTINGS_PAGES } from "@/components/settings/settings.config";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { taiLaiSoChuyenKhoanCanXuLy } from "@/components/pos/payosCanXuLy";
import { SAN_BAN_HANG } from "@/constants/channel";
import "@/styles/print.css";

const DEFAULT_DOCUMENT_TITLE =
    "FCentric · Quản lý kho & bán lẻ thời trang đa kênh";

/**
 * - metaCoDinh: tiêu đề cố định cho trang không đi theo đường dẫn (trang 404 trong khung quản trị).
 *   Có giá trị thì dùng luôn, không dò PAGE_META_CONFIG theo đường dẫn.
 */
export default function BackofficeLayout({ metaCoDinh = null }) {
    const { pathname } = useLocation();
    const { mustChangePassword, setMustChangePassword } = useOutletContext();
    const handlePasswordChangeSuccess = () => setMustChangePassword(false);

    const PAGE_META_CONFIG = [
        {
            key: "DASHBOARD",
            // Tổng quan không hiện tiêu đề nhìn thấy (hàng lọc kho/kỳ đứng đầu trang); h1 ẩn nằm trong TongQuanHeader
            ownTitle: true,
            match: (path) => path === "/dashboard",
            title: "Tổng quan",
        },
        {
            key: "EDIT_USER_ROLE",
            ownTitle: true,
            match: (path) => path.endsWith("/edit-role"),
            title: "Chỉnh sửa quyền người dùng",
        },
        {
            key: "USER_PROFILE",
            ownTitle: true,
            // giữ legacy regex để tránh flash meta khi /user/:id redirect sang /profile
            match: (path) => path === "/profile" || /^\/user\/\d+$/.test(path),
            title: "Hồ sơ cá nhân",
        },
        {
            key: "USER_DETAIL",
            match: (path) =>
                /^\/admin\/users\/\d+$/.test(path),
            title: "Chi tiết người dùng",
        },
        {
            key: "USER_LIST",
            match: (path) => path === "/users",
            title: "Người dùng",
        },
        {
            key: "ATTRIBUTES",
            match: (path) => path === "/attributes",
            title: "Thuộc tính",
        },
        {
            key: "MATERIALS",
            match: (path) => path === "/material",
            title: "Chất liệu",
        },
        {
            key: "PRODUCTS",
            match: (path) => path === "/products",
            title: "Sản phẩm",
        },
        {
            key: "GIA_BAN_TEM",
            match: (path) => path === "/products/gia-ban-tem",
            title: "Giá bán & tem mã vạch",
        },
        {
            key: "SUPPLIERS",
            match: (path) => path === "/supplier",
            title: "Nhà cung cấp",
        },
        {
            key: "WAREHOUSE",
            match: (path) => path === "/warehouse",
            title: "Danh sách kho",
        },
        {
            key: "WAREHOUSE_LOCATIONS",
            match: (path) => path === "/warehouse/locations",
            title: "Vị trí kệ",
        },
        {
            key: "SUPPLIER_BARCODES",
            match: (path) => path === "/supplier-barcodes",
            title: "Mã vạch nhà cung cấp",
        },
        {
            key: "LICH_SU_GIAO_DICH_KHO",
            match: (path) => path === "/inventory-transactions",
            title: "Lịch sử giao dịch kho",
        },
        {
            key: "GOODS_RECEIPTS",
            match: (path) => path === "/goods-receipts",
            title: "Phiếu nhập kho",
        },
        {
            key: "GOODS_RECEIPTS_CREATE",
            match: (path) => path === "/goods-receipts/create",
            title: "Tạo phiếu nhập kho",
        },
        {
            key: "GOODS_RECEIPTS_DETAIL",
            match: (path) => /^\/goods-receipts\/\d+$/.test(path),
            title: "Chi tiết phiếu nhập kho",
        },
        {
            key: "LOT_INPUT",
            match: (path) => /^\/goods-receipts\/\d+\/lot-input\/\d+$/.test(path),
            title: "Khai báo lô",
        },
        {
            key: "RECEIVE_COUNT",
            match: (path) => /^\/goods-receipts\/\d+\/receive\/\d+$/.test(path),
            title: "Kiểm đếm & khóa lô",
        },
        {
            key: "GOODS_ISSUES",
            match: (path) => path === "/goods-issues",
            title: "Phiếu xuất kho",
        },
        {
            key: "GOODS_ISSUES_CREATE",
            match: (path) => path === "/goods-issues/create",
            title: "Tạo phiếu xuất kho",
        },
        {
            key: "GOODS_ISSUES_DETAIL",
            match: (path) => /^\/goods-issues\/\d+$/.test(path),
            title: "Chi tiết phiếu xuất kho",
        },
        {
            key: "PURCHASE_REQUESTS",
            match: (path) => path === "/purchase-requests",
            title: "Yêu cầu nhập hàng",
        },
        {
            key: "PURCHASE_ORDERS",
            match: (path) => path === "/purchase-orders",
            title: "Đơn mua hàng",
        },
        {
            key: "TRANSFER_TICKETS",
            match: (path) => path === "/transfer-tickets",
            title: "Chuyển kho nội bộ",
        },
        {
            key: "PICK_LOT",
            match: (path) => /^\/goods-issues\/\d+\/pick-lot\/\d+$/.test(path),
            title: "Chọn lô hàng",
        },
        {
            key: "STOCK_TAKE_LIST",
            match: (path) => path === "/stock-take",
            title: "Kiểm kê",
        },
        {
            key: "STOCK_TAKE_CREATE",
            match: (path) => path === "/stock-take/new",
            title: "Tạo đợt kiểm kê",
        },
        {
            key: "STOCK_TAKE_DETAIL",
            match: (path) => /^\/stock-take\/\d+$/.test(path),
            title: "Chi tiết đợt kiểm kê",
        },
        {
            key: "DANH_MUC_QUAN_AO",
            match: (path) => path === "/categories",
            title: "Danh mục",
        },
        {
            key: "CHI_TIET_SAN_PHAM",
            ownTitle: true,
            match: (path) => /^\/products\/\d+$/.test(path),
            title: "Chi tiết sản phẩm",
        },
        {
            key: "CREATE_TRANSFER_TICKET",
            match: (path) => path === "/transfer-tickets/create",
            title: "Tạo phiếu chuyển kho nội bộ",
        },
        {
            key: "TRANSFER_TICKET_DETAIL",
            match: (path) => /^\/transfer-tickets\/\d+$/.test(path),
            title: "Chi tiết phiếu chuyển kho nội bộ",
        },
        {
            key: "SALES_ORDERS",
            match: (path) => path === "/sales-orders",
            title: "Đơn bán hàng",
        },
        {
            key: "POS_TRANSFERS",
            match: (path) => path === "/pos-transfers",
            title: "Đối soát chuyển khoản",
        },
        {
            key: "SALES_ORDER_DETAIL",
            match: (path) => /^\/sales-orders\/\d+$/.test(path),
            title: "Chi tiết đơn bán hàng",
        },
        {
            key: "CREATE_SALES_ORDER",
            match: (path) => path === "/sales-orders/create",
            title: "Tạo đơn bán hàng",
        },
        {
            key: "BAO_CAO_DOANH_THU",
            match: (path) => path === "/reports/revenue",
            title: "Báo cáo doanh thu",
        },
        {
            key: "BAO_CAO_KHACH_HANG",
            match: (path) => path === "/reports/customers",
            title: "Báo cáo khách hàng",
        },
        {
            key: "BAO_CAO_NHAP_XUAT",
            match: (path) => path === "/reports/stock-movements",
            title: "Báo cáo nhập xuất",
        },
        {
            key: "PHIEU_NHAP_KHO_PRINT",
            match: (path) => /^\/goods-receipts\/\d+\/print$/.test(path),
            title: "In phiếu nhập kho",
        },
        {
            key: "PHIEU_XUAT_KHO_PRINT",
            match: (path) => /^\/goods-issues\/\d+\/print$/.test(path),
            title: "In phiếu xuất kho",
        },
        {
            key: "CUSTOMERS",
            match: (path) => path === "/customers",
            title: "Khách hàng",
        },
        {
            key: "CUSTOMER_DETAIL",
            ownTitle: true,
            match: (path) => /^\/customers\/\d+$/.test(path),
            title: "Chi tiết khách hàng",
        },
        {
            key: "CUSTOMER_EDIT",
            match: (path) => /^\/customers\/\d+\/edit$/.test(path),
            title: "Chỉnh sửa khách hàng",
        },
        {
            // Thêm / sửa nhà cung cấp là popup trên danh sách và trang chi tiết (không còn trang riêng).
            key: "SUPPLIER_DETAIL",
            match: (path) => /^\/supplier\/\d+$/.test(path),
            title: "Chi tiết nhà cung cấp",
        },
        {
            key: "INVENTORY_REPORT",
            match: (path) => path === "/reports/inventory",
            title: "Báo cáo tồn kho",
        },
        {
            key: "SALES_INVOICE_PRINT",
            match: (path) => /^\/sales-orders\/\d+\/invoice$/.test(path),
            title: "In hóa đơn bán hàng",
        },
        {
            key: "USER_DETAIL",
            ownTitle: true,
            match: (path) => /^\/users\/\d+$/.test(path),
            title: "Thông tin chi tiết người dùng",
        },
        {
            key: "PURCHASE_REQUEST_QUOTATION",
            match: (path) => /^\/purchase-requests\/\d+\/send-quotation$/.test(path),
            title: "Gửi yêu cầu báo giá",
        },
        {
            key: "QUOTATION_REQUEST",
            match: (path) => path === "/quotation-requests",
            title: "Yêu cầu báo giá",
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
            title: "Báo giá",
        },
        {
            key: "SALE_QUOTATION_CREATE",
            match: (path) => path === "/sales-quotations/create",
            title: "Tạo báo giá",
        },
        {
            key: "SALE_QUOTATION_DETAIL",
            ownTitle: true,
            match: (path) => /^\/sales-quotations\/\d+$/.test(path),
            title: "Chi tiết báo giá",
        },
        // Trung tâm Cấu hình: SettingsLayout tự vẽ tiêu đề mục; đây chỉ đặt tên tab trình duyệt
        ...SETTINGS_PAGES.map((page) => ({
            key: `SETTINGS_${page.key.toUpperCase()}`,
            match: (path) => path === page.to,
            title: `${page.label} · Cấu hình`,
        })),
        {
            // Trình sửa mẫu in một màn (đường dẫn cũ /…/edit, /…/:templateId chuyển về đây)
            key: "PRINT_TEMPLATE_EDITOR",
            ownTitle: true,
            match: (path) => /^\/settings\/print-templates\/[^/]+$/.test(path),
            title: "Sửa mẫu in",
        },
        {
            key: "PENDING_ORDERS",
            match: (path) => path === "/goods-issues/pending-orders",
            title: "Đơn chờ xuất",
        },
        {
            key: "PICK_LISTS",
            match: (path) => path === "/goods-issues/pick-lists",
            title: "Phiếu nhặt hàng",
        },
        {
            key: "PICK_LIST_DETAIL",
            match: (path) => /^\/goods-issues\/pick-lists\/\d+$/.test(path),
            title: "Thực hiện nhặt hàng",
        },
        {
            key: "PACKING",
            match: (path) => /^\/goods-issues\/packing\/\d+$/.test(path),
            title: "Đóng gói đơn hàng",
        },
        {
            key: "CHANNELS",
            match: (path) => path === "/channels",
            title: "Kênh bán hàng",
        },
        // Trang của từng sàn (Shopify, Lazada, TikTok Shop) và trang quay về sau ủy quyền
        ...SAN_BAN_HANG.filter((san) => san.hoTro).flatMap((san) => [
            { key: `CHANNEL_${san.maKenh}`, match: (path) => path === san.duongDan, title: `Tổng quan ${san.ten}` },
            {
                key: `CHANNEL_${san.maKenh}_SETUP`,
                match: (path) => path === `${san.duongDan}/setup`,
                title: `Thiết lập gian hàng ${san.ten}`,
            },
            {
                key: `CHANNEL_${san.maKenh}_PRODUCTS`,
                match: (path) => path === `${san.duongDan}/products`,
                title: `Sản phẩm ${san.ten}`,
            },
            {
                key: `CHANNEL_${san.maKenh}_ORDERS`,
                match: (path) => path === `${san.duongDan}/orders`,
                title: `Đơn hàng ${san.ten}`,
            },
            {
                key: `CHANNEL_${san.maKenh}_SETTINGS`,
                match: (path) => path === `${san.duongDan}/settings`,
                title: `Cấu hình ${san.ten}`,
            },
            {
                key: `CHANNEL_${san.maKenh}_OAUTH`,
                // Trang tự vẽ tiêu đề ẩn (thẻ kết quả ở giữa trang)
                ownTitle: true,
                // Chỉ sàn ủy quyền có trang quay về; Shopify (dán khóa) rơi xuống "Không tìm thấy trang"
                match: (path) => san.kieuKetNoi === "uy_quyen" && path === `/channels/oauth/callback/${san.duongDan.split("/").pop()}`,
                title: `Ủy quyền ${san.ten}`,
            },
        ]),
        {
            // Mã sàn gõ tay không có (/channels/abc/...): route của sàn hiện khối "Không tìm thấy trang" trong khung
            key: "CHANNEL_KHONG_TIM_THAY",
            ownTitle: true,
            match: (path) => /^\/channels\/[^/]+(\/.*)?$/.test(path),
            title: "Không tìm thấy trang",
        },
        // Mã gõ tay không phải số (/quotation/abc): các mục chi tiết ở trên chỉ nhận mã số nên trang mất tiêu đề và tên tab,
        // trong khi màn chi tiết chứng từ vẫn vẽ khung "Không tìm thấy …". Đặt cùng tiêu đề như mã số. Để cuối danh sách:
        // trang cố định cùng nhánh (create, pending-orders, pick-lists) đã khớp mục riêng ở trên trước.
        {
            key: "GOODS_RECEIPTS_DETAIL_MA_SAI",
            match: (path) => /^\/goods-receipts\/[^/]+$/.test(path),
            title: "Chi tiết phiếu nhập kho",
        },
        {
            key: "GOODS_ISSUES_DETAIL_MA_SAI",
            match: (path) => /^\/goods-issues\/[^/]+$/.test(path),
            title: "Chi tiết phiếu xuất kho",
        },
        {
            key: "PICK_LOT_MA_SAI",
            match: (path) => /^\/goods-issues\/[^/]+\/pick-lot\/[^/]+$/.test(path),
            title: "Chọn lô hàng",
        },
        {
            key: "PICK_LIST_DETAIL_MA_SAI",
            // Trừ "view": /goods-issues/pick-lists/view là route /goods-issues/:id/view (khai báo trước), không phải phiếu nhặt
            match: (path) => /^\/goods-issues\/pick-lists\/(?!view$)[^/]+$/.test(path),
            title: "Thực hiện nhặt hàng",
        },
        {
            key: "TRANSFER_TICKET_DETAIL_MA_SAI",
            match: (path) => /^\/transfer-tickets\/[^/]+$/.test(path),
            title: "Chi tiết phiếu chuyển kho nội bộ",
        },
        {
            key: "PURCHASE_REQUEST_DETAIL_MA_SAI",
            match: (path) => /^\/purchase-requests\/[^/]+$/.test(path),
            title: "Chi tiết yêu cầu nhập hàng",
        },
        {
            key: "QUOTATION_REQUEST_DETAIL_MA_SAI",
            match: (path) => /^\/quotation-requests\/[^/]+$/.test(path),
            title: "Chi tiết yêu cầu báo giá",
        },
        {
            key: "QUOTATION_DETAIL_MA_SAI",
            match: (path) => /^\/quotation\/[^/]+$/.test(path),
            title: "Chi tiết báo giá",
        },
    ];

    const pageMeta = metaCoDinh ?? PAGE_META_CONFIG.find((item) =>
        item.match(pathname)
    );

    // Tên tab trình duyệt = tiêu đề trang + " · FCentric"
    useEffect(() => {
        document.title = pageMeta?.title
            ? `${pageMeta.title} · FCentric`
            : DEFAULT_DOCUMENT_TITLE;
    }, [pageMeta?.title]);

    // Số hàng tiêu đề trang đang tự vẽ (ListPageHeader / PageHeader). Bằng 0 thì PageContainer vẽ tiêu đề dự phòng.
    const [soTieuDeRieng, setSoTieuDeRieng] = useState(0);
    const claimPageTitle = useCallback(() => {
        setSoTieuDeRieng((n) => n + 1);
        return () => setSoTieuDeRieng((n) => n - 1);
    }, []);
    const pageTitleValue = useMemo(
        () => ({
            title: pageMeta?.title ?? null,
            showFallback: Boolean(pageMeta?.title) && !pageMeta?.ownTitle && soTieuDeRieng === 0,
            claim: claimPageTitle,
        }),
        [pageMeta?.title, pageMeta?.ownTitle, soTieuDeRieng, claimPageTitle],
    );

    useEffect(() => {
        return () => {
            document.title = DEFAULT_DOCUMENT_TITLE;
        };
    }, []);

    // Mục sàn trên menu bên trái chỉ hiện gian hàng đã kết nối; chỉ quản trị viên thấy và gọi được API kênh
    useEffect(() => {
        if (localStorage.getItem("role") === "quan_tri_vien") taiLaiKenhDaKetNoi();
    }, []);

    // Số giao dịch chuyển khoản tại quầy cần xử lý (số đếm trên menu): khi vào khung quản trị và mỗi 2 phút
    useEffect(() => {
        if (localStorage.getItem("role") !== "quan_tri_vien") return undefined;
        taiLaiSoChuyenKhoanCanXuLy();
        const id = window.setInterval(taiLaiSoChuyenKhoanCanXuLy, 120000);
        return () => window.clearInterval(id);
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
                    <BackofficeHeader />

                    <main
                        id="backoffice-main-content"
                        tabIndex="-1"
                        className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bo-canvas"
                    >
                        <PageTitleContext.Provider value={pageTitleValue}>
                            <Outlet />
                        </PageTitleContext.Provider>
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