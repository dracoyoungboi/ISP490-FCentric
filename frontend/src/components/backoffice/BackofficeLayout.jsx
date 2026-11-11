import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BackofficeSidebar from "./BackofficeSidebar";
import BackofficeHeader from "./BackofficeHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import VungTaiTrang from "@/components/shared/VungTaiTrang";
import { PageTitleContext } from "./pageTitle";
import { duongDanMenuCuaVaiTro } from "./sidebar.config";
import { taiDanLucRanh } from "@/lib/taiTrang";
import { SETTINGS_PAGES } from "@/components/settings/settings.config";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { taiLaiSoChuyenKhoanCanXuLy } from "@/components/pos/payosCanXuLy";
import { VAI_TRO_XEP_KE, taiLaiSoHangChuaCoKe } from "@/components/kiem-ke/soHangChuaCoKe";
import { KHO_LAM_VIEC_EVENT } from "@/utils/khoLamViec";
import { SAN_BAN_HANG } from "@/constants/channel";
import ThanhDieuHuongDay from "./ThanhDieuHuongDay";
import { laTrangCapDau } from "./thanhDay";
import { useIsMobile } from "@/hooks/use-mobile";
import { tinhCoMan } from "@/hooks/useCoMan";
import { cn } from "@/lib/utils";
import "@/styles/print.css";
import { t } from "@/i18n";

const DEFAULT_DOCUMENT_TITLE =
    t("FCentric · Quản lý kho & bán lẻ thời trang đa kênh");

/**
 * - metaCoDinh: tiêu đề cố định cho trang không đi theo đường dẫn (trang 404 trong khung quản trị).
 *   Có giá trị thì dùng luôn, không dò PAGE_META_CONFIG theo đường dẫn.
 */
export default function BackofficeLayout({ metaCoDinh = null }) {
    const { pathname } = useLocation();

    const PAGE_META_CONFIG = [
        {
            key: "DASHBOARD",
            // Tổng quan không hiện tiêu đề nhìn thấy (hàng lọc kho/kỳ đứng đầu trang); h1 ẩn nằm trong TongQuanHeader
            ownTitle: true,
            match: (path) => path === "/dashboard",
            title: t("Tổng quan"),
        },
        {
            key: "EDIT_USER_ROLE",
            ownTitle: true,
            match: (path) => path.endsWith("/edit-role"),
            title: t("Chỉnh sửa quyền người dùng"),
        },
        {
            key: "USER_PROFILE",
            ownTitle: true,
            // giữ legacy regex để tránh flash meta khi /user/:id redirect sang /profile
            match: (path) => path === "/profile" || /^\/user\/\d+$/.test(path),
            title: t("Hồ sơ cá nhân"),
        },
        {
            key: "USER_DETAIL",
            match: (path) =>
                /^\/admin\/users\/\d+$/.test(path),
            title: t("Chi tiết người dùng"),
        },
        {
            key: "USER_LIST",
            match: (path) => path === "/users",
            title: t("Người dùng"),
        },
        {
            key: "ATTRIBUTES",
            match: (path) => path === "/attributes",
            title: t("Thuộc tính"),
        },
        {
            key: "MATERIALS",
            match: (path) => path === "/material",
            title: t("Chất liệu"),
        },
        {
            key: "PRODUCTS",
            match: (path) => path === "/products",
            title: t("Sản phẩm"),
        },
        {
            key: "GIA_BAN_TEM",
            match: (path) => path === "/products/gia-ban-tem",
            title: t("Giá bán & tem mã vạch"),
        },
        {
            key: "SUPPLIERS",
            match: (path) => path === "/supplier",
            title: t("Nhà cung cấp"),
        },
        {
            key: "WAREHOUSE",
            match: (path) => path === "/warehouse",
            title: t("Danh sách kho"),
        },
        {
            key: "WAREHOUSE_LOCATIONS",
            match: (path) => path === "/warehouse/locations",
            title: t("Vị trí kệ"),
        },
        {
            key: "SUPPLIER_BARCODES",
            match: (path) => path === "/supplier-barcodes",
            title: t("Mã vạch nhà cung cấp"),
        },
        {
            key: "LICH_SU_GIAO_DICH_KHO",
            match: (path) => path === "/inventory-transactions",
            title: t("Lịch sử giao dịch kho"),
        },
        {
            key: "GOODS_RECEIPTS",
            match: (path) => path === "/goods-receipts",
            title: t("Phiếu nhập kho"),
        },
        {
            key: "GOODS_RECEIPTS_CREATE",
            match: (path) => path === "/goods-receipts/create",
            title: t("Tạo phiếu nhập kho"),
        },
        {
            key: "GOODS_RECEIPTS_DETAIL",
            match: (path) => /^\/goods-receipts\/\d+$/.test(path),
            title: t("Chi tiết phiếu nhập kho"),
        },
        {
            key: "LOT_INPUT",
            match: (path) => /^\/goods-receipts\/\d+\/lot-input\/\d+$/.test(path),
            title: t("Khai báo lô"),
        },
        {
            key: "RECEIVE_COUNT",
            match: (path) => /^\/goods-receipts\/\d+\/receive\/\d+$/.test(path),
            title: t("Kiểm đếm & khóa lô"),
        },
        {
            key: "GOODS_ISSUES",
            match: (path) => path === "/goods-issues",
            title: t("Phiếu xuất kho"),
        },
        {
            key: "GOODS_ISSUES_DETAIL",
            match: (path) => /^\/goods-issues\/\d+$/.test(path),
            title: t("Chi tiết phiếu xuất kho"),
        },
        {
            key: "PURCHASE_REQUESTS",
            match: (path) => path === "/purchase-requests",
            title: t("Yêu cầu nhập hàng"),
        },
        {
            key: "PURCHASE_ORDERS",
            match: (path) => path === "/purchase-orders",
            title: t("Đơn mua hàng"),
        },
        {
            key: "TRANSFER_TICKETS",
            match: (path) => path === "/transfer-tickets",
            title: t("Chuyển kho nội bộ"),
        },
        {
            key: "PICK_LOT",
            match: (path) => /^\/goods-issues\/\d+\/pick-lot\/\d+$/.test(path),
            title: t("Chọn lô hàng"),
        },
        {
            key: "STOCK_TAKE_LIST",
            match: (path) => path === "/stock-take",
            title: t("Kiểm kê"),
        },
        {
            key: "STOCK_TAKE_CREATE",
            match: (path) => path === "/stock-take/new",
            title: t("Tạo đợt kiểm kê"),
        },
        {
            key: "STOCK_TAKE_DETAIL",
            match: (path) => /^\/stock-take\/\d+$/.test(path),
            title: t("Chi tiết đợt kiểm kê"),
        },
        {
            key: "STOCK_TAKE_EDIT",
            match: (path) => /^\/stock-take\/\d+\/edit$/.test(path),
            title: t("Sửa đợt kiểm kê"),
        },
        {
            key: "STOCK_TAKE_LOCK_MAP",
            match: (path) => path === "/stock-take/lock-map",
            title: t("Sơ đồ khóa kiểm kê"),
        },
        {
            key: "WAREHOUSE_UNSHELVED",
            match: (path) => path === "/warehouse/unshelved",
            title: t("Hàng chưa có kệ"),
        },
        {
            key: "WAREHOUSE_BIN_MOVES_HISTORY",
            match: (path) => path === "/warehouse/bin-moves/history",
            title: t("Lịch sử chuyển kệ"),
        },
        {
            key: "WAREHOUSE_BIN_MOVES",
            match: (path) => path === "/warehouse/bin-moves",
            title: t("Chuyển kệ nội bộ"),
        },
        {
            key: "DANH_MUC_QUAN_AO",
            match: (path) => path === "/categories",
            title: t("Danh mục"),
        },
        {
            key: "CHI_TIET_SAN_PHAM",
            ownTitle: true,
            match: (path) => /^\/products\/\d+$/.test(path),
            title: t("Chi tiết sản phẩm"),
        },
        {
            key: "CREATE_TRANSFER_TICKET",
            match: (path) => path === "/transfer-tickets/create",
            title: t("Tạo phiếu chuyển kho nội bộ"),
        },
        {
            key: "TRANSFER_TICKET_DETAIL",
            match: (path) => /^\/transfer-tickets\/\d+$/.test(path),
            title: t("Chi tiết phiếu chuyển kho nội bộ"),
        },
        {
            key: "TRANSFER_TICKET_RECEIVE",
            match: (path) => /^\/transfer-tickets\/\d+\/receive$/.test(path),
            title: t("Nhận hàng chuyển kho"),
        },
        {
            key: "TRANSFER_ADJUSTMENT_DETAIL",
            match: (path) => /^\/transfer-tickets\/adjustments\/\d+$/.test(path),
            title: t("Phiếu điều chỉnh kho"),
        },
        {
            key: "SALES_ORDERS",
            match: (path) => path === "/sales-orders",
            title: t("Đơn bán hàng"),
        },
        {
            key: "POS_TRANSFERS",
            match: (path) => path === "/pos-transfers",
            title: t("Đối soát chuyển khoản"),
        },
        {
            key: "SALES_ORDER_DETAIL",
            match: (path) => /^\/sales-orders\/\d+$/.test(path),
            title: t("Chi tiết đơn bán hàng"),
        },
        {
            key: "CREATE_SALES_ORDER",
            match: (path) => path === "/sales-orders/create",
            title: t("Tạo đơn bán hàng"),
        },
        {
            key: "BAO_CAO_DOANH_THU",
            match: (path) => path === "/reports/revenue",
            title: t("Báo cáo doanh thu"),
        },
        {
            key: "BAO_CAO_SAN_PHAM",
            match: (path) => path === "/reports/products",
            title: t("Báo cáo sản phẩm"),
        },
        {
            key: "BAO_CAO_KHACH_HANG",
            match: (path) => path === "/reports/customers",
            title: t("Báo cáo khách hàng"),
        },
        {
            key: "BAO_CAO_NHAP_XUAT",
            match: (path) => path === "/reports/stock-movements",
            title: t("Báo cáo nhập xuất"),
        },
        {
            key: "XUAT_DU_LIEU_KE_TOAN",
            match: (path) => path === "/reports/accounting-export",
            title: t("Xuất dữ liệu kế toán"),
        },
        {
            key: "PHIEU_NHAP_KHO_PRINT",
            match: (path) => /^\/goods-receipts\/\d+\/print$/.test(path),
            title: t("In phiếu nhập kho"),
        },
        {
            key: "PHIEU_XUAT_KHO_PRINT",
            match: (path) => /^\/goods-issues\/\d+\/print$/.test(path),
            title: t("In phiếu xuất kho"),
        },
        {
            key: "CUSTOMERS",
            match: (path) => path === "/customers",
            title: t("Khách hàng"),
        },
        {
            key: "CUSTOMER_DETAIL",
            ownTitle: true,
            match: (path) => /^\/customers\/\d+$/.test(path),
            title: t("Chi tiết khách hàng"),
        },
        {
            key: "CUSTOMER_EDIT",
            match: (path) => /^\/customers\/\d+\/edit$/.test(path),
            title: t("Chỉnh sửa khách hàng"),
        },
        {
            // Thêm / sửa nhà cung cấp là popup trên danh sách và trang chi tiết (không còn trang riêng).
            key: "SUPPLIER_DETAIL",
            match: (path) => /^\/supplier\/\d+$/.test(path),
            title: t("Chi tiết nhà cung cấp"),
        },
        {
            key: "INVENTORY_REPORT",
            match: (path) => path === "/reports/inventory",
            title: t("Báo cáo tồn kho"),
        },
        {
            key: "SALES_INVOICE_PRINT",
            match: (path) => /^\/sales-orders\/\d+\/invoice$/.test(path),
            title: t("In hóa đơn bán hàng"),
        },
        {
            key: "USER_DETAIL",
            ownTitle: true,
            match: (path) => /^\/users\/\d+$/.test(path),
            title: t("Thông tin chi tiết người dùng"),
        },
        {
            key: "PURCHASE_REQUEST_QUOTATION",
            match: (path) => /^\/purchase-requests\/\d+\/send-quotation$/.test(path),
            title: t("Gửi yêu cầu báo giá"),
        },
        {
            key: "QUOTATION_REQUEST",
            match: (path) => path === "/quotation-requests",
            title: t("Yêu cầu báo giá"),
        },
        {
            key: "QUOTATION_REQUEST_CREATE",
            match: (path) => path === "/quotation-requests/create",
            title: t("Tạo yêu cầu báo giá"),
        },
        {
            key: "PURCHASE_REQUEST_CREATE",
            match: (path) => path === "/purchase-requests/create",
            title: t("Tạo yêu cầu nhập hàng"),
        },
        {
            key: "PURCHASE_ORDER_CREATE",
            match: (path) => path === "/purchase-orders/create",
            title: t("Tạo đơn mua hàng"),
        },
        {
            key: "PURCHASE_REQUEST_DETAIL",
            match: (path) => /^\/purchase-requests\/\d+$/.test(path),
            title: t("Chi tiết yêu cầu nhập hàng"),
        },
        {
            key: "QUOTATION_REQUEST_DETAIL",
            match: (path) => /^\/quotation-requests\/\d+$/.test(path),
            title: t("Chi tiết yêu cầu báo giá"),
        },
        {
            key: "QUOTATION_DETAIL",
            match: (path) => /^\/quotation\/\d+$/.test(path),
            title: t("Chi tiết báo giá"),
        },
        {
            key: "PURCHASE_ORDER_DETAIL",
            match: (path) => /^\/purchase-orders\/\d+$/.test(path),
            title: t("Chi tiết đơn mua hàng"),
        },
        {
            key: "SALE_QUOTATION",
            match: (path) => path === "/sales-quotations",
            title: t("Báo giá"),
        },
        {
            key: "SALE_QUOTATION_CREATE",
            match: (path) => path === "/sales-quotations/create",
            title: t("Tạo báo giá"),
        },
        {
            key: "SALE_QUOTATION_DETAIL",
            ownTitle: true,
            match: (path) => /^\/sales-quotations\/\d+$/.test(path),
            title: t("Chi tiết báo giá"),
        },
        // Trung tâm Cấu hình: SettingsLayout tự vẽ tiêu đề mục; đây chỉ đặt tên tab trình duyệt
        ...SETTINGS_PAGES.map((page) => ({
            key: `SETTINGS_${page.key.toUpperCase()}`,
            match: (path) => path === page.to,
            title: t("{{trang}} · Cài đặt",{ trang: page.label }),
        })),
        {
            // Trình sửa mẫu in một màn (đường dẫn cũ /…/edit, /…/:templateId chuyển về đây)
            key: "PRINT_TEMPLATE_EDITOR",
            ownTitle: true,
            match: (path) => /^\/settings\/print-templates\/[^/]+$/.test(path),
            title: t("Sửa mẫu in"),
        },
        {
            key: "PENDING_ORDERS",
            match: (path) => path === "/goods-issues/pending-orders",
            title: t("Đơn chờ xuất"),
        },
        {
            key: "PICK_LISTS",
            match: (path) => path === "/goods-issues/pick-lists",
            title: t("Phiếu nhặt hàng"),
        },
        {
            key: "PICK_LIST_DETAIL",
            match: (path) => /^\/goods-issues\/pick-lists\/\d+$/.test(path),
            title: t("Thực hiện nhặt hàng"),
        },
        {
            key: "PACKING",
            match: (path) => /^\/goods-issues\/packing\/\d+$/.test(path),
            title: t("Đóng gói đơn hàng"),
        },
        {
            key: "CHANNELS",
            match: (path) => path === "/channels",
            title: t("Kênh bán hàng"),
        },
        // Trang của từng sàn (Shopify, Lazada, TikTok Shop) và trang quay về sau ủy quyền. Sàn chờ cấp API (Shopee) chỉ dùng
        // tiêu đề Tổng quan: trang con của sàn đó chuyển ngay về màn giới thiệu (KenhHopLe)
        ...SAN_BAN_HANG.flatMap((san) => [
            { key: `CHANNEL_${san.maKenh}`, match: (path) => path === san.duongDan, title: t("Tổng quan {{ten}}", { ten: san.ten }) },
            {
                key: `CHANNEL_${san.maKenh}_SETUP`,
                match: (path) => path === `${san.duongDan}/setup`,
                title: t("Thiết lập gian hàng {{ten}}", { ten: san.ten }),
            },
            {
                key: `CHANNEL_${san.maKenh}_PRODUCTS`,
                match: (path) => path === `${san.duongDan}/products`,
                title: t("Sản phẩm {{ten}}", { ten: san.ten }),
            },
            {
                key: `CHANNEL_${san.maKenh}_ORDERS`,
                match: (path) => path === `${san.duongDan}/orders`,
                title: t("Đơn hàng {{ten}}", { ten: san.ten }),
            },
            {
                key: `CHANNEL_${san.maKenh}_SETTINGS`,
                match: (path) => path === `${san.duongDan}/settings`,
                title: t("Cấu hình {{ten}}", { ten: san.ten }),
            },
            {
                key: `CHANNEL_${san.maKenh}_OAUTH`,
                // Trang tự vẽ tiêu đề ẩn (thẻ kết quả ở giữa trang)
                ownTitle: true,
                // Chỉ sàn ủy quyền có trang quay về; Shopify (dán khóa) rơi xuống "Không tìm thấy trang"
                match: (path) => san.kieuKetNoi === "uy_quyen" && path === `/channels/oauth/callback/${san.duongDan.split("/").pop()}`,
                title: t("Ủy quyền {{ten}}", { ten: san.ten }),
            },
        ]),
        {
            // Mã sàn gõ tay không có (/channels/abc/...): route của sàn hiện khối "Không tìm thấy trang" trong khung
            key: "CHANNEL_KHONG_TIM_THAY",
            ownTitle: true,
            match: (path) => /^\/channels\/[^/]+(\/.*)?$/.test(path),
            title: t("Không tìm thấy trang"),
        },
        // Mã gõ tay không phải số (/quotation/abc): các mục chi tiết ở trên chỉ nhận mã số nên trang mất tiêu đề và tên tab,
        // trong khi màn chi tiết chứng từ vẫn vẽ khung "Không tìm thấy …". Đặt cùng tiêu đề như mã số. Để cuối danh sách:
        // trang cố định cùng nhánh (create, pending-orders, pick-lists) đã khớp mục riêng ở trên trước.
        {
            key: "GOODS_RECEIPTS_DETAIL_MA_SAI",
            match: (path) => /^\/goods-receipts\/[^/]+$/.test(path),
            title: t("Chi tiết phiếu nhập kho"),
        },
        {
            key: "GOODS_ISSUES_DETAIL_MA_SAI",
            match: (path) => /^\/goods-issues\/[^/]+$/.test(path),
            title: t("Chi tiết phiếu xuất kho"),
        },
        {
            key: "PICK_LOT_MA_SAI",
            match: (path) => /^\/goods-issues\/[^/]+\/pick-lot\/[^/]+$/.test(path),
            title: t("Chọn lô hàng"),
        },
        {
            key: "PICK_LIST_DETAIL_MA_SAI",
            // Trừ "view": /goods-issues/pick-lists/view là route /goods-issues/:id/view (khai báo trước), không phải phiếu nhặt
            match: (path) => /^\/goods-issues\/pick-lists\/(?!view$)[^/]+$/.test(path),
            title: t("Thực hiện nhặt hàng"),
        },
        {
            key: "TRANSFER_TICKET_DETAIL_MA_SAI",
            match: (path) => /^\/transfer-tickets\/[^/]+$/.test(path),
            title: t("Chi tiết phiếu chuyển kho nội bộ"),
        },
        {
            key: "PURCHASE_REQUEST_DETAIL_MA_SAI",
            match: (path) => /^\/purchase-requests\/[^/]+$/.test(path),
            title: t("Chi tiết yêu cầu nhập hàng"),
        },
        {
            key: "QUOTATION_REQUEST_DETAIL_MA_SAI",
            match: (path) => /^\/quotation-requests\/[^/]+$/.test(path),
            title: t("Chi tiết yêu cầu báo giá"),
        },
        {
            key: "QUOTATION_DETAIL_MA_SAI",
            match: (path) => /^\/quotation\/[^/]+$/.test(path),
            title: t("Chi tiết báo giá"),
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

    // Số lô chưa có kệ ở kho làm việc (số đếm trên menu, vai trò kho): khi vào, mỗi 2 phút và khi đổi kho làm việc
    useEffect(() => {
        if (!VAI_TRO_XEP_KE.includes(localStorage.getItem("role"))) return undefined;
        taiLaiSoHangChuaCoKe();
        const id = window.setInterval(taiLaiSoHangChuaCoKe, 120000);
        window.addEventListener(KHO_LAM_VIEC_EVENT, taiLaiSoHangChuaCoKe);
        return () => {
            window.clearInterval(id);
            window.removeEventListener(KHO_LAM_VIEC_EVENT, taiLaiSoHangChuaCoKe);
        };
    }, []);

    // Vào khung quản trị xong, lúc rảnh tải dần các trang trong menu của vai trò: bấm tới là trang hiện ngay
    useEffect(() => taiDanLucRanh(duongDanMenuCuaVaiTro(localStorage.getItem("role"))), []);

    // Điện thoại: thanh điều hướng đáy ở trang cấp đầu; máy tính bảng dọc (cảm ứng): sidebar mở sẵn dạng rail thu gọn
    const isMobile = useIsMobile();
    const coThanhDay = isMobile && laTrangCapDau(pathname);
    const [moSanSidebar] = useState(() => tinhCoMan() !== "mtbDoc");

    return (
        <>
        <SidebarProvider defaultOpen={moSanSidebar}>
            <div
                data-backoffice-shell
                className="flex h-dvh min-h-0 w-full overflow-hidden bg-bo-canvas font-backoffice text-bo-foreground"
            >
                <a
                    href="#backoffice-main-content"
                    className="no-print fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-bo-primary px-3 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0 cam-ung:inline-flex cam-ung:min-h-11 cam-ung:items-center"
                >
                    {t("Bỏ qua menu")}
                </a>
                {/* SIDEBAR */}
                <BackofficeSidebar />

                {/* MAIN CONTENT */}
                <SidebarInset className="flex min-w-0 flex-col bg-bo-canvas">
                    <BackofficeHeader />

                    <main
                        id="backoffice-main-content"
                        tabIndex="-1"
                        className={cn(
                            "min-h-0 min-w-0 flex-1 overflow-y-auto bg-bo-canvas",
                            coThanhDay && "pb-[calc(56px+env(safe-area-inset-bottom))]",
                        )}
                    >
                        <PageTitleContext.Provider value={pageTitleValue}>
                            <VungTaiTrang>
                                <Outlet />
                            </VungTaiTrang>
                        </PageTitleContext.Provider>
                    </main>
                </SidebarInset>
                {coThanhDay ? <ThanhDieuHuongDay /> : null}
            </div>
        </SidebarProvider>
        </>
    );
}