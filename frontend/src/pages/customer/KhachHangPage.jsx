import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import apiClient from "@/services/apiClient";
import { CircleCheck, CirclePause, Eye, Info, Pencil, Plus, Mail, Phone, Users, SearchX } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import KhachHangFormDialog from "@/components/khach-hang/KhachHangFormDialog";
import TrangThaiKhachHangDialog from "@/components/khach-hang/chi-tiet/TrangThaiKhachHangDialog";
import { ghiChuPhamVi, laHoatDong } from "@/components/khach-hang/chi-tiet/tinhKhachHang";
import { lanMuaHang, soDeGoi, tenHienThi } from "@/components/khach-hang/hienThiKhachHang";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import NutGiaiThich from "@/components/shared/NutGiaiThich";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import useTuKhoaTuUrl, { docTuKhoaUrl } from "@/hooks/useTuKhoaTuUrl";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/thongBaoNhanh";
import { formatDate } from "@/utils/formatters";
import { WALKIN_CUSTOMER_CODE } from "@/services/posService";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { t } from "@/i18n";
import { VAI_TRO_KHACH_HANG } from "@/constants/vaiTroTheoNghiepVu";

// Khớp quyền ở backend (KhachHangController): thêm, sửa, đổi trạng thái khách hàng (SRS 4.4 "Customer").
const QUYEN_SUA_KHACH = VAI_TRO_KHACH_HANG;
// Dòng khách vừa thêm được tô nền vài giây rồi trở lại bình thường.
const TO_DONG_MOI_MS = 4000;

// Gõ ô tìm kiếm: chờ người dùng ngừng gõ một chút rồi mới gọi API
const SEARCH_DEBOUNCE_MS = 300;

// Tab trạng thái (thay ô chọn trạng thái, như trang Người dùng); một tên "Ngừng hoạt động" cho tab, nhãn và hộp thoại.
const TAB_TRANG_THAI = [
    { value: "all", label: t("Tất cả") },
    { value: "1", label: t("Hoạt động") },
    { value: "0", label: t("Ngừng hoạt động") }
];
const GIA_TRI_TAB = TAB_TRANG_THAI.map((tab) => tab.value);

// Lớp chung của tiêu đề cột
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
// Máy tính bảng dọc (cảm ứng, dưới 1024px): ẩn cột phụ để bảng vừa khung, không vuốt ngang
const AN_TREN_TABLET = "cam-ung:max-lg:hidden";

// Điều kiện lọc của danh sách. Máy chủ tự giữ chỉ khách cửa hàng (chốt 20/11): khách do đồng bộ đơn sàn tạo vẫn lưu,
// vẫn mở được từ đơn bán và báo cáo, nhưng không nằm ở đây.
function buildKhachHangFilters({ keyword, trangThai }) {
    // Khách lẻ mặc định (KHLE) là khách của hệ thống cho bán tại quầy, không phải một khách hàng:
    // không hiện trong danh sách (như KiotViet, Sapo).
    const filters = [
        { fieldName: "maKhachHang", operation: "NOT_IN", value: [WALKIN_CUSTOMER_CODE], logicType: "AND" }
    ];

    // Tìm theo tên, mã, email, số điện thoại (bỏ khoảng trắng, dấu chấm, "+84" như ô tìm kiếm toàn hệ thống):
    // trường lọc ảo của backend dùng chung với ô tìm ở thanh trên cùng
    if (keyword) {
        filters.push({ fieldName: "tuKhoa", operation: "LIKE", value: keyword, logicType: "AND" });
    }

    if (trangThai !== "all") {
        filters.push({ fieldName: "trangThai", operation: "EQUALS", value: parseInt(trangThai), logicType: "AND" });
    }

    return filters;
}

const khachHangService = {
    // Mỗi dòng kèm lần mua gần nhất trong phạm vi vai trò của người xem
    danhSach: async (filterRequest) => {
        const response = await apiClient.post("/api/v1/khach-hang/danh-sach", filterRequest);
        return response.data.data;
    },
    // Đếm số trên tab: /filter không kèm số mua hàng nên nhẹ hơn
    dem: async (filters) => {
        const response = await apiClient.post("/api/v1/khach-hang/filter", { filters, sorts: [], page: 0, size: 1 });
        return response.data.data?.totalElements ?? 0;
    },
};

/** Tên khách; trống thì lấy mã. */
function TenKhach({ khachHang, className }) {
    return <span className={cn("min-w-0 truncate font-semibold text-bo-foreground", className)}>{tenHienThi(khachHang)}</span>;
}

/**
 * Khách ngừng hoạt động (PA A, chốt 20/11): khi trộn với khách đang hoạt động (tab Tất cả) thì tên, mã xám và chip
 * "Ngừng" cạnh tên; ở tab Ngừng hoạt động tên tab đã nói rõ nên không đánh dấu gì.
 */
const danhDauNgung = (khachHang, trangThaiTab) => !laHoatDong(khachHang) && trangThaiTab !== "0";

function ChipNgung() {
    return (
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-semibold leading-4 text-slate-500">
            {t("Ngừng")}
        </span>
    );
}

/**
 * Nút "i" cạnh tiêu đề (PA C, chốt 22/11): danh sách chỉ có khách cửa hàng (máy chủ lọc, xem buildKhachHangFilters),
 * nên nói rõ khách đặt qua sàn không nằm ở đây (vẫn mở được hồ sơ từ đơn bán).
 */
function GiaiThichKhachCuaHang() {
    return (
        <NutGiaiThich label={t("Danh sách này gồm những khách nào")} tieuDe={t("Danh sách khách cửa hàng")}>
            <p className="text-bo-muted">
                {t("Gồm khách mua tại cửa hàng và khách được thêm ở màn này.")}{" "}
                {t("Khách đặt qua Shopee, TikTok Shop, Lazada, Shopify không hiện ở đây.")}
            </p>
        </NutGiaiThich>
    );
}

// Component chính
export default function KhachHangPage() {
    const [khachHangs, setKhachHangs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(SO_DONG_MAC_DINH);
    const [totalItems, setTotalItems] = useState(0);
    const navigate = useNavigate();
    const coTheSua = hasAnyRole(QUYEN_SUA_KHACH);
    // Số mua hàng theo phạm vi vai trò (khớp DonBanHangService.dieuKienPhamViTheoVaiTro, cùng câu với trang chi tiết):
    // quản trị viên thấy hết; vai trò kho chỉ đơn của kho phụ trách; nhân viên bán hàng chỉ đơn mình tạo.
    const cauPhamVi = ghiChuPhamVi({
        laQuanTriVien: hasAnyRole([ROLES.QUAN_TRI_VIEN]),
        laVaiTroKho: hasAnyRole([ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]),
        laBanHang: hasAnyRole([ROLES.NHAN_VIEN_BAN_HANG]),
    });
    const chiPhamViMinh = Boolean(cauPhamVi);
    // Filter states
    // ?q= từ "Xem tất cả" của ô tìm kiếm toàn hệ thống: vào thẳng ô tìm của trang
    const [searchQuery, setSearchQuery] = useState(() => docTuKhoaUrl(window.location.search));
    useTuKhoaTuUrl(setSearchQuery);
    // Từ khóa thực sự gửi lên server (trễ SEARCH_DEBOUNCE_MS sau lần gõ cuối, hoặc ngay khi Enter)
    const [debouncedSearch, setDebouncedSearch] = useState(() => docTuKhoaUrl(window.location.search).trim());
    const [trangThai, setTrangThai] = useState("all");
    const [loadError, setLoadError] = useState(null);
    // Đánh số mỗi lần tải danh sách: phản hồi về muộn của lần tải cũ bị bỏ qua
    const requestSeq = useRef(0);

    // Popup Thêm / Sửa khách hàng: giữ khách đang sửa sau khi đóng để nội dung không đổi giữa chừng
    // khi hiệu ứng đóng còn chạy. Đường dẫn cũ /customers/:id/edit đã chuyển sang trang chi tiết.
    const [formDialog, setFormDialog] = useState({ open: false, khachHang: null });
    const moForm = (khachHang = null) => setFormDialog({ open: true, khachHang });
    const [trangThaiDialog, setTrangThaiDialog] = useState({ open: false, khachHang: null });
    const [highlightId, setHighlightId] = useState(null);

    // Load data
    // silent: tải lại ngầm khi quay lại tab — giữ bảng đang xem, lỗi chỉ ghi log
    const loadKhachHangs = useCallback(async ({ silent = false } = {}) => {
        const seq = ++requestSeq.current;
        if (!silent) setLoading(true);
        try {
            const filterRequest = {
                filters: buildKhachHangFilters({ keyword: debouncedSearch, trangThai }),
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
                page: currentPage,
                size: pageSize
            };

            const data = await khachHangService.danhSach(filterRequest);
            if (seq !== requestSeq.current) return;

            const content = data.content || [];
            // Trang hiện tại không còn dòng nào (vừa xóa dòng cuối của trang cuối...) -> lùi một trang.
            // Server trả trang rỗng kèm totalElements = 0 nên không dựa vào tổng để tính trang cuối.
            if (!content.length && currentPage > 0) {
                setCurrentPage(page => Math.max(0, page - 1));
                return;
            }
            setKhachHangs(content);
            setTotalItems(data.totalElements || 0);
            setLoadError(null);
        } catch (error) {
            if (seq !== requestSeq.current) return;
            if (silent) {
                console.error(error);
                return;
            }
            // Không giữ dòng + tổng số của lần tải trước (R9); bảng hiện thẻ lỗi kèm nút Thử lại (403: ổ khóa, không Thử lại)
            console.error(getApiErrorMessage(error, "Không tải được danh sách khách hàng"));
            setLoadError(error);
            setKhachHangs([]);
            setTotalItems(0);
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, trangThai]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => loadKhachHangs());
    }, [loadKhachHangs]);

    // ── Số trên từng tab: cùng từ khóa đang tìm, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        GIA_TRI_TAB,
        (tab) => khachHangService.dem(buildKhachHangFilters({ keyword: debouncedSearch, trangThai: tab })),
        debouncedSearch
    );

    // Quay lại tab thì tải lại ngầm danh sách + số trên tab (khách mới có thể được tạo ở quầy POS)
    useTaiLaiKhiQuayLai(() => {
        loadKhachHangs({ silent: true });
        tabCounts.reload();
    }, { bat: !loading });

    // Áp dụng từ khóa tìm kiếm và quay về trang đầu (chỉ khi từ khóa thực sự đổi)
    const applySearch = useCallback((term) => {
        if (term === debouncedSearch) return;
        setDebouncedSearch(term);
        setCurrentPage(0);
    }, [debouncedSearch]);

    useEffect(() => {
        const term = searchQuery.trim();
        if (term === debouncedSearch) return undefined;
        const timer = setTimeout(() => applySearch(term), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchQuery, debouncedSearch, applySearch]);

    // Handlers
    // Enter: tìm ngay, không chờ hết thời gian trễ (bộ hẹn giờ đang chờ tự hủy khi từ khóa đổi)
    const handleSearch = () => {
        applySearch(searchQuery.trim());
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        applySearch("");
    };

    const handleTrangThaiChange = (value) => {
        setTrangThai(value);
        setCurrentPage(0);
    };

    // "Xóa lọc": bỏ từ khóa + trạng thái
    const handleResetFilters = () => {
        setSearchQuery("");
        setDebouncedSearch("");
        setTrangThai("all");
        setCurrentPage(0);
    };

    const handleRetry = () => loadKhachHangs();

    // Nhấn vào dòng -> xem chi tiết; bỏ qua khi người dùng đang bôi đen chữ (vd. copy SĐT, email)
    const handleRowClick = (khachHang) => {
        if (window.getSelection()?.toString()) return;
        navigate(`/customers/${khachHang.id}`);
    };

    // Bỏ tô nền dòng vừa thêm sau vài giây.
    useEffect(() => {
        if (highlightId == null) return undefined;
        const timer = setTimeout(() => setHighlightId(null), TO_DONG_MOI_MS);
        return () => clearTimeout(timer);
    }, [highlightId]);

    // Bộ lọc đang bật (nút "Xóa lọc" xóa các bộ lọc này). Tab trạng thái không tính: tab có lối quay về "Tất cả".
    const hasActiveFilters = Boolean(searchQuery.trim() || debouncedSearch);
    const dangLoc = hasActiveFilters || trangThai !== "all";

    const handleSaved = (saved, { laSua }) => {
        if (laSua) {
            // Phản hồi sửa chỉ có hồ sơ (không có lần mua gần nhất): gộp vào dòng đang có để giữ ngày đó
            setKhachHangs((prev) => prev.map((item) => (item.id === saved?.id ? { ...item, ...saved } : item)));
            toast.success(t("Đã lưu thông tin khách hàng \"{{ten}}\"", { ten: tenHienThi(saved) }));
            return;
        }
        tabCounts.reload();
        if (!saved?.id) {
            // Máy chủ cũ chưa trả khách vừa tạo: tải lại danh sách.
            toast.success(t("Đã thêm khách hàng"));
            setCurrentPage(0);
            loadKhachHangs();
            return;
        }
        // Đang lọc (từ khóa, trạng thái): khách mới có thể không thuộc bộ lọc, nên tải lại từ máy chủ
        // thay vì chèn vào đầu (dòng vẫn được tô nền nếu có trong kết quả).
        if (dangLoc) {
            setHighlightId(saved.id);
            if (currentPage === 0) loadKhachHangs();
            else setCurrentPage(0);
            toast.success(t("Đã thêm khách hàng {{maKhachHang}}", { maKhachHang: saved.maKhachHang }), {
                action: { label: t("Xem"), onClick: () => navigate(`/customers/${saved.id}`) },
            });
            return;
        }
        // Danh sách xếp mới nhất lên đầu: thêm vào đầu, về trang 1 và tô nền dòng mới.
        // Khách mới chưa có đơn: lần mua gần nhất để trống ("Chưa mua").
        setKhachHangs((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)].slice(0, pageSize));
        setTotalItems((n) => n + 1);
        setLoadError(null);
        setHighlightId(saved.id);
        setCurrentPage(0);
        toast.success(t("Đã thêm khách hàng {{maKhachHang}}", { maKhachHang: saved.maKhachHang }), {
            action: { label: t("Xem"), onClick: () => navigate(`/customers/${saved.id}`) },
        });
    };

    const handleTrangThaiDoi = (moi) => {
        setKhachHangs((prev) => prev.map((item) => (item.id === moi.id ? { ...item, ...moi } : item)));
        toast.success(laHoatDong(moi) ? t("Đã cho phép khách hàng hoạt động lại") : t("Đã ngừng hoạt động khách hàng"));
        tabCounts.reload();
        // Đang lọc theo trạng thái thì dòng vừa đổi không còn thuộc bộ lọc: tải lại ngầm.
        if (trangThai !== "all") loadKhachHangs({ silent: true });
    };

    const totalPages = Math.ceil(totalItems / pageSize);

    const handlePageChange = (newPage) => {
        if (newPage >= 0 && newPage < totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(0);
    };

    // Số chỉ hiện khi đã đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs.
    const tabs = TAB_TRANG_THAI.map((tab) => ({ ...tab, count: loadError ? null : tabCounts.counts[tab.value] }));

    // Người không phải quản trị viên: một dòng nói rõ số mua hàng chỉ tính đơn trong phạm vi của họ
    const dongPhamVi = chiPhamViMinh ? (
        <p className="flex items-center gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2 text-xs leading-5 text-sky-800">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            {cauPhamVi}
        </p>
    ) : null;

    return (
        <PageContainer fill className="space-y-4">
            {/* ── Hàng tiêu đề: tên trang + nút chính ── */}
            <ListPageHeader
                giaiThich={<GiaiThichKhachCuaHang />}
                actions={
                    coTheSua ? (
                        <Button
                            onClick={() => moForm()}
                            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <Plus className="size-4" />
                            {t("Thêm khách hàng")}
                        </Button>
                    ) : null
                }
            />

            {/* ── Table ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label={t("Lọc khách hàng theo trạng thái")}
                                tabs={tabs}
                                value={trangThai}
                                onChange={handleTrangThaiChange}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={handleResetFilters}
                    >
                        <SearchInput
                            label={t("Tìm khách hàng")}
                            placeholder={t("Tên, mã, SĐT, email")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClear={handleClearSearch}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="sm:w-[300px]"
                        />
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError && totalItems > 0 ? (
                        <TablePagination
                            page={currentPage}
                            size={pageSize}
                            total={totalItems}
                            onPageChange={handlePageChange}
                            onSizeChange={handlePageSizeChange}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState rows={6} label={t("Đang tải danh sách khách hàng")} />
                ) : loadError ? (
                    <ErrorState
                        description={t("Không tải được danh sách khách hàng. Vui lòng thử lại.")}
                        error={loadError}
                        onRetry={handleRetry}
                    />
                ) : khachHangs.length === 0 ? (
                    dangLoc ? (
                        <EmptyState
                            icon={SearchX}
                            title={t("Không tìm thấy khách hàng phù hợp")}
                            description={t("Thử đổi từ khóa hoặc trạng thái.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={handleResetFilters}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xóa lọc")}
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Users}
                            title={t("Chưa có khách hàng")}
                            description={t("Thêm khách hàng để theo dõi lịch sử mua.")}
                            action={
                                coTheSua ? (
                                    <Button
                                        onClick={() => moForm()}
                                        className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                    >
                                        <Plus className="size-4" />
                                        {t("Thêm khách hàng")}
                                    </Button>
                                ) : null
                            }
                        />
                    )
                ) : (
                    <>
                    {dongPhamVi}
                    {/* Điện thoại: mỗi khách một thẻ, chạm thẻ mở chi tiết — tên (+ nhãn ngừng); mã và lần mua gần nhất;
                        chân thẻ: liên hệ và nút Gọi. Tổng chi tiêu, số đơn ở trang chi tiết. Sửa / đổi trạng thái nằm ở trang
                        chi tiết (nút "…") */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {khachHangs.map((khachHang) => {
                            const mua = lanMuaHang(khachHang, { chiPhamViMinh });
                            const soGoi = soDeGoi(khachHang.soDienThoai);
                            const chuLienHe = [khachHang.soDienThoai, khachHang.email].filter(Boolean).join(" · ");
                            const LienHeIcon = khachHang.soDienThoai ? Phone : Mail;
                            const ngung = danhDauNgung(khachHang, trangThai);
                            return (
                                <li key={khachHang.id} className={khachHang.id === highlightId ? "bg-bo-primary-soft" : undefined}>
                                    <Link
                                        to={`/customers/${khachHang.id}`}
                                        className="block px-4 pb-1 pt-3 active:bg-bo-surface-subtle"
                                    >
                                        <span className="flex items-center justify-between gap-3">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <TenKhach khachHang={khachHang} className={cn("text-[15px]", ngung && "text-bo-muted")} />
                                                {ngung ? <ChipNgung /> : null}
                                            </span>
                                        </span>
                                        <span className="mt-0.5 flex items-center justify-between gap-3">
                                            <span className={cn("min-w-0 truncate text-[13px] font-semibold tracking-wide text-bo-primary", ngung && "text-bo-primary/60")}>
                                                {khachHang.maKhachHang}
                                            </span>
                                            <span className="shrink-0 text-xs text-bo-muted" title={mua.khongRo ? cauPhamVi : undefined}>
                                                {mua.ngay
                                                    ? t("Mua {{khi}}", { khi: mua.khi })
                                                    : mua.chuaMua ? t("Chưa mua") : "—"}
                                            </span>
                                        </span>
                                    </Link>
                                    <div className={`flex items-center justify-between gap-3 px-4 pb-2.5 ${soGoi ? "min-h-9" : "pt-0.5"}`}>
                                        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-bo-muted">
                                            {chuLienHe ? (
                                                <>
                                                    <LienHeIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                                    <span className="min-w-0 truncate">{chuLienHe}</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">{t("Chưa có liên hệ")}</span>
                                            )}
                                        </span>
                                        {soGoi ? (
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="h-9 shrink-0 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground"
                                            >
                                                <a href={`tel:${soGoi}`} aria-label={t("Gọi {{ten}}", { ten: tenHienThi(khachHang) })}>
                                                    <Phone className="size-4" aria-hidden="true" />
                                                    {t("Gọi")}
                                                </a>
                                            </Button>
                                        ) : null}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {/* Máy tính bảng dọc (cảm ứng): bỏ STT, Thao tác để bảng vừa khung, không vuốt ngang (Xem chi tiết = chạm
                        dòng, Sửa / đổi trạng thái ở trang chi tiết). Tổng chi tiêu, số đơn chỉ ở trang chi tiết (chốt 19/11) */}
                    {/* Bề rộng cột cố định (table-fixed) để các cột cách đều, không phụ thuộc độ dài chữ: STT và Thao tác
                        theo px, Liên hệ / Ngày thêm / Lần mua gần nhất theo %, Khách hàng (tên + mã dài) lấy phần còn lại.
                        Ngày thêm đặt cạnh Lần mua gần nhất để thấy ngay khách mới chưa quay lại */}
                    <table className="w-full min-w-[880px] table-fixed text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH} w-14 text-center ${AN_TREN_TABLET}`}>{t("STT")}</th>
                                <th className={`${TH} text-left`}>{t("Khách hàng")}</th>
                                <th className={`${TH} w-[26%] text-left`}>{t("Liên hệ")}</th>
                                <th className={`${TH} w-[15%] text-left`}>{t("Ngày thêm")}</th>
                                <th className={`${TH} w-[17%] text-left`}>{t("Lần mua gần nhất")}</th>
                                <th className={`${TH} w-36 text-center ${AN_TREN_TABLET}`}>{t("Thao tác")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {khachHangs.map((khachHang, index) => {
                                const mua = lanMuaHang(khachHang, { chiPhamViMinh });
                                const dangHoatDong = laHoatDong(khachHang);
                                const ngung = danhDauNgung(khachHang, trangThai);
                                return (
                                    <tr
                                        key={khachHang.id}
                                        onClick={() => handleRowClick(khachHang)}
                                        className={`cursor-pointer transition-colors hover:bg-bo-surface-subtle ${khachHang.id === highlightId ? "bg-bo-primary-soft" : ""}`}
                                    >
                                        <td className={`px-3 py-2.5 text-center text-xs text-bo-muted ${AN_TREN_TABLET}`}>
                                            {currentPage * pageSize + index + 1}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex min-w-0 flex-col gap-0.5">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <TenKhach khachHang={khachHang} className={ngung ? "text-bo-muted" : undefined} />
                                                    {ngung ? <ChipNgung /> : null}
                                                </div>
                                                <span className={cn("truncate text-xs font-semibold tracking-wide text-bo-primary", ngung && "text-bo-primary/60")}>
                                                    {khachHang.maKhachHang}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {/* Chỉ hiện thông tin khách có (không xếp hai dấu "—"); số điện thoại hay dùng nhất nên chữ đậm hơn */}
                                            <div className="flex min-w-0 flex-col gap-1 text-xs text-bo-muted">
                                                {khachHang.soDienThoai ? (
                                                    <div className="flex items-center gap-1.5 tabular-nums text-bo-foreground">
                                                        <Phone className="size-3 shrink-0 text-bo-muted" aria-hidden="true" /> {khachHang.soDienThoai}
                                                    </div>
                                                ) : null}
                                                {khachHang.email ? (
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <Mail className="size-3 shrink-0" aria-hidden="true" />
                                                        <span className="min-w-0 truncate">{khachHang.email}</span>
                                                    </div>
                                                ) : null}
                                                {!khachHang.soDienThoai && !khachHang.email ? (
                                                    <span className="text-slate-400">{t("Chưa có liên hệ")}</span>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-[13px] tabular-nums text-bo-foreground">
                                            {khachHang.ngayTao ? formatDate(khachHang.ngayTao) : "—"}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {mua.ngay ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[13px] tabular-nums text-bo-foreground">{mua.ngay}</span>
                                                    <span className="text-xs text-bo-muted">{mua.ngayPhu}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[13px] text-slate-400" title={mua.khongRo ? cauPhamVi : undefined}>
                                                    {mua.chuaMua ? t("Chưa mua") : "—"}
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-3 py-2.5 ${AN_TREN_TABLET}`}>
                                            <RowActions>
                                                <RowActionButton
                                                    icon={Eye}
                                                    label={t("Xem chi tiết")}
                                                    onClick={() => navigate(`/customers/${khachHang.id}`)}
                                                />
                                                {coTheSua ? (
                                                    <>
                                                        <RowActionButton
                                                            icon={Pencil}
                                                            label={t("Chỉnh sửa")}
                                                            onClick={() => moForm(khachHang)}
                                                        />
                                                        <RowActionButton
                                                            icon={dangHoatDong ? CirclePause : CircleCheck}
                                                            label={dangHoatDong ? t("Ngừng hoạt động") : t("Cho phép hoạt động")}
                                                            onClick={() => setTrangThaiDialog({ open: true, khachHang })}
                                                        />
                                                    </>
                                                ) : null}
                                            </RowActions>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </>
                )}
            </TableShell>

            {/* ── Thêm / Sửa khách hàng (popup dùng chung với trang chi tiết) ── */}
            {coTheSua ? (
                <>
                    <KhachHangFormDialog
                        open={formDialog.open}
                        onOpenChange={(open) => setFormDialog((prev) => ({ ...prev, open }))}
                        khachHang={formDialog.khachHang}
                        onSaved={handleSaved}
                    />
                    <TrangThaiKhachHangDialog
                        khachHang={trangThaiDialog.khachHang}
                        open={trangThaiDialog.open}
                        onOpenChange={(open) => setTrangThaiDialog((prev) => ({ ...prev, open }))}
                        onChanged={handleTrangThaiDoi}
                    />
                </>
            ) : null}
        </PageContainer>
    );
}
