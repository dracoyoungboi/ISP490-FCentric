import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import apiClient from "@/services/apiClient";
import { CircleCheck, CirclePause, Eye, Pencil, Plus, Mail, Phone, Users, SearchX } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import KhachHangFormDialog from "@/components/khach-hang/KhachHangFormDialog";
import TrangThaiKhachHangDialog from "@/components/khach-hang/chi-tiet/TrangThaiKhachHangDialog";
import { laHoatDong } from "@/components/khach-hang/chi-tiet/tinhKhachHang";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import useTuKhoaTuUrl, { docTuKhoaUrl } from "@/hooks/useTuKhoaTuUrl";
import { toast } from "@/lib/thongBaoNhanh";
import { WALKIN_CUSTOMER_CODE } from "@/services/posService";
import { hasAnyRole } from "@/utils/roles";
import { t } from "@/i18n";
import { VAI_TRO_KHACH_HANG } from "@/constants/vaiTroTheoNghiepVu";

// Khớp quyền ở backend (KhachHangController): thêm, sửa, đổi trạng thái khách hàng (SRS 4.4 "Customer").
const QUYEN_SUA_KHACH = VAI_TRO_KHACH_HANG;
// Dòng khách vừa thêm được tô nền vài giây rồi trở lại bình thường.
const TO_DONG_MOI_MS = 4000;

// Gõ ô tìm kiếm: chờ người dùng ngừng gõ một chút rồi mới gọi API
const SEARCH_DEBOUNCE_MS = 300;

// Trạng thái vẫn là ô chọn (SRS 1.5.1); một tên "Ngừng hoạt động" cho cả bộ lọc, bảng và hộp thoại đổi trạng thái
const TRANG_THAI_FILTER_OPTIONS = [
    { value: "all", label: t("Tất cả trạng thái") },
    { value: "1", label: t("Hoạt động") },
    { value: "0", label: t("Ngừng hoạt động") }
];

// Điều kiện lọc của danh sách
function buildKhachHangFilters({ keyword, trangThai }) {
    // Khách lẻ mặc định (KHLE) là khách của hệ thống cho bán tại quầy, không phải một khách hàng:
    // không hiện trong danh sách (như KiotViet, Sapo).
    const filters = [
        { fieldName: "maKhachHang", operation: "NOT_IN", value: [WALKIN_CUSTOMER_CODE], logicType: "AND" }
    ];

    // Tìm theo tên, mã, email, số điện thoại (bỏ khoảng trắng, dấu chấm, "+84" như ô tìm kiếm toàn hệ thống):
    // trường lọc ảo của backend dùng chung với ô tìm ở thanh trên cùng
    if (keyword) {
        filters.push({
            fieldName: "tuKhoa",
            operation: "LIKE",
            value: keyword,
            logicType: "AND"
        });
    }

    // Trạng thái filter
    if (trangThai !== "all") {
        filters.push({
            fieldName: "trangThai",
            operation: "EQUALS",
            value: parseInt(trangThai),
            logicType: "AND"
        });
    }

    return filters;
}

// Service xử lý API calls
const khachHangService = {
    filter: async (filterRequest) => {
        const response = await apiClient.post("/api/v1/khach-hang/filter", filterRequest);
        return response.data.data;
    },

};

// Component chính
export default function KhachHangPage() {
    const [khachHangs, setKhachHangs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(SO_DONG_MAC_DINH);
    const [totalItems, setTotalItems] = useState(0);
    const navigate = useNavigate();
    const coTheSua = hasAnyRole(QUYEN_SUA_KHACH);
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
            const filters = buildKhachHangFilters({ keyword: debouncedSearch, trangThai });

            const filterRequest = {
                filters,
                sorts: [
                    {
                        fieldName: "ngayTao",
                        direction: "DESC"
                    }
                ],
                page: currentPage,
                size: pageSize
            };

            const data = await khachHangService.filter(filterRequest);
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

    // Quay lại tab thì tải lại ngầm danh sách (khách mới có thể được tạo ở quầy POS)
    useTaiLaiKhiQuayLai(() => loadKhachHangs({ silent: true }), { bat: !loading });

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

    const handleSaved = (saved, { laSua }) => {
        if (laSua) {
            setKhachHangs((prev) => prev.map((item) => (item.id === saved?.id ? { ...item, ...saved } : item)));
            toast.success(t("Đã lưu thông tin khách hàng \"{{ten}}\"", { ten: saved?.tenKhachHang ?? "" }));
            return;
        }
        if (!saved?.id) {
            // Máy chủ cũ chưa trả khách vừa tạo: tải lại danh sách.
            toast.success(t("Đã thêm khách hàng"));
            setCurrentPage(0);
            loadKhachHangs();
            return;
        }
        // Danh sách xếp mới nhất lên đầu: thêm vào đầu, về trang 1 và tô nền dòng mới.
        setKhachHangs((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)].slice(0, pageSize));
        setTotalItems((n) => n + 1);
        setLoadError(null);
        setHighlightId(saved.id);
        setCurrentPage(0);
        toast.success(t("Đã thêm khách hàng {{maKhachHang}}", { maKhachHang: saved.maKhachHang }), {
            action: { label: "Xem", onClick: () => navigate(`/customers/${saved.id}`) },
        });
    };

    const handleTrangThaiDoi = (moi) => {
        setKhachHangs((prev) => prev.map((item) => (item.id === moi.id ? { ...item, ...moi } : item)));
        toast.success(laHoatDong(moi) ? t("Đã cho phép khách hàng hoạt động lại") : t("Đã ngừng hoạt động khách hàng"));
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

    // Bộ lọc đang bật (nút "Xóa lọc" xóa các bộ lọc này)
    const hasActiveFilters = Boolean(searchQuery.trim() || debouncedSearch || trangThai !== "all");

    return (
        <PageContainer fill className="space-y-4">
            {/* ── Hàng tiêu đề: tên trang + nút chính ── */}
            <ListPageHeader
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
                    <ListToolbar hasFilter={hasActiveFilters} onClear={handleResetFilters}>
                        <SearchInput
                            label={t("Tìm khách hàng")}
                            placeholder={t("Tìm theo tên, mã, SĐT, email...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClear={handleClearSearch}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="sm:w-[300px]"
                        />
                        <FilterSelect
                            label={t("Lọc theo trạng thái")}
                            value={trangThai}
                            options={TRANG_THAI_FILTER_OPTIONS}
                            onChange={handleTrangThaiChange}
                            className="sm:w-[180px]"
                            align="end"
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
                    hasActiveFilters ? (
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
                    {/* Điện thoại: mỗi khách một thẻ, chạm thẻ mở chi tiết — tên + trạng thái, mã;
                        chân thẻ: SĐT · email và nút Gọi. Sửa / đổi trạng thái nằm ở trang chi tiết (nút "…") */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {khachHangs.map((khachHang) => {
                            const lienHe = [khachHang.soDienThoai, khachHang.email].filter(Boolean).join(" · ");
                            const LienHeIcon = khachHang.soDienThoai ? Phone : Mail;
                            return (
                                <li key={khachHang.id} className={khachHang.id === highlightId ? "bg-bo-primary-soft" : undefined}>
                                    <Link
                                        to={`/customers/${khachHang.id}`}
                                        className={`block px-4 pt-3 active:bg-bo-surface-subtle ${lienHe ? "pb-1" : "pb-3"}`}
                                    >
                                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                            <span className="min-w-0 truncate text-[15px] font-semibold text-bo-foreground">{khachHang.tenKhachHang}</span>
                                            {/* i18n-giu-nguyen: StatusBadge tự dịch */}
                                            <StatusBadge doiTuong="nguoi" label={khachHang.trangThai === 1 ? "Hoạt động" : "Ngừng hoạt động"} />
                                        </span>
                                        <span className="mt-0.5 block text-[13px] font-semibold tracking-wide text-bo-primary">
                                            {khachHang.maKhachHang}
                                        </span>
                                    </Link>
                                    {lienHe ? (
                                        <div className={`flex items-center justify-between gap-3 px-4 pb-2.5 ${khachHang.soDienThoai ? "min-h-9" : ""}`}>
                                            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-bo-muted">
                                                <LienHeIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                                <span className="min-w-0 truncate">{lienHe}</span>
                                            </span>
                                            {khachHang.soDienThoai ? (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="h-9 shrink-0 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground"
                                                >
                                                    <a href={`tel:${khachHang.soDienThoai.replace(/\s/g, "")}`} aria-label={t("Gọi {{ten}}", { ten: khachHang.tenKhachHang })}>
                                                        <Phone className="size-4" aria-hidden="true" />
                                                        {t("Gọi")}
                                                    </a>
                                                </Button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                    {/* Máy tính bảng dọc (cảm ứng): bỏ cột STT, Thao tác để bảng vừa khung, không vuốt ngang
                        (Xem chi tiết = chạm dòng, Sửa / đổi trạng thái ở trang chi tiết) */}
                    <table className="w-full min-w-[800px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">
                                    {t("STT")}
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Mã KH")}
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Khách hàng")}
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Liên hệ")}
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Trạng thái")}
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">
                                    {t("Thao tác")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {khachHangs.map((khachHang, index) => (
                                <tr
                                    key={khachHang.id}
                                    onClick={() => handleRowClick(khachHang)}
                                    className={`cursor-pointer transition-colors hover:bg-bo-surface-subtle ${khachHang.id === highlightId ? "bg-bo-primary-soft" : ""}`}
                                >
                                    <td className="px-3 py-3 text-center text-xs text-bo-muted cam-ung:max-lg:hidden">
                                        {currentPage * pageSize + index + 1}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="font-semibold tracking-wide text-bo-primary">
                                            {khachHang.maKhachHang}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 font-semibold text-bo-foreground">
                                        {khachHang.tenKhachHang}
                                    </td>
                                    <td className="px-3 py-3">
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
                                    <td className="px-3 py-3">
                                        {/* i18n-giu-nguyen: StatusBadge tự dịch */}
                                        <StatusBadge doiTuong="nguoi" label={khachHang.trangThai === 1 ? "Hoạt động" : "Ngừng hoạt động"} />
                                    </td>
                                    <td className="px-3 py-3 cam-ung:max-lg:hidden">
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
                                                        icon={laHoatDong(khachHang) ? CirclePause : CircleCheck}
                                                        label={laHoatDong(khachHang) ? t("Ngừng hoạt động") : t("Cho phép hoạt động")}
                                                        onClick={() => setTrangThaiDialog({ open: true, khachHang })}
                                                    />
                                                </>
                                            ) : null}
                                        </RowActions>
                                    </td>
                                </tr>
                            ))}
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
