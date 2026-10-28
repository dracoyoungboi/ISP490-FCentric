import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, ClipboardList, Plus, SearchX } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { PHIEU_XUAT_KHO_TABS, getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import apiClient from "@/services/apiClient";
import { getMineKhoList } from "@/services/khoService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { formatDate } from "@/utils/formatters";
import { getCurrentUserId } from "@/utils/roles";

const SEARCH_DEBOUNCE_MS = 350;

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = PHIEU_XUAT_KHO_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
// Phiếu xuất bán hàng đã đóng gói, chờ xác nhận xuất kho (mã 6)
const TAB_CHO_XUAT = "cho-xuat-kho";
const TONE_TAB = { [TAB_CHO_XUAT]: "warning" };
// Vai trò xử lý phiếu chờ xuất kho (thấy dòng chú ý)
const VAI_TRO_XUAT_KHO = ["quan_ly_kho", "nhan_vien_kho"];

const trangThaiCuaTab = (ma) => PHIEU_XUAT_KHO_TABS.find((tab) => tab.ma === ma)?.trangThai ?? null;

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

// Điều kiện lọc dùng chung cho danh sách, số trên tab và dòng chú ý.
// API chỉ nhận MỘT trạng thái và chưa lọc được theo loại xuất / ngày.
function buildFilterPayload({ keyword, tenKho, trangThai, page, size }) {
    const filterList = [];
    if (keyword?.trim()) {
        const searchKeyword = keyword.trim();
        ["soPhieuXuat", "donBanHang.soDonHang"].forEach((field) => {
            filterList.push({ fieldName: field, operation: "LIKE", value: searchKeyword, logicType: "OR" });
        });
    }
    if (trangThai != null) {
        filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai });
    }
    if (tenKho?.trim()) {
        filterList.push({ fieldName: "kho.tenKho", operation: "LIKE", value: tenKho.trim() });
    }
    return { page, size, filters: filterList, sorts: [{ fieldName: "ngayTao", direction: "DESC" }] };
}

async function demPhieu(dieuKien) {
    const res = await phieuXuatKhoService.filter(buildFilterPayload({ ...dieuKien, page: 0, size: 1 }));
    return res?.totalElements ?? 0;
}

export default function PhieuXuatKhoList() {
    const navigate = useNavigate();
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    const tabTrangThai = trangThaiCuaTab(tab);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [total, setTotal] = useState(0);
    const requestIdRef = useRef(0);

    // Vai trò (null = đang tải) và kho phụ trách: dòng chú ý + ghi chú phạm vi (R3)
    const [roles, setRoles] = useState(null);
    const [khoPhuTrach, setKhoPhuTrach] = useState(null);

    const [filters, setFilters] = useState({
        keyword: "",
        tenKho: "",
        ngayXuat: "",
        page: 0,
        size: SO_DONG_MAC_DINH,
    });
    // Ô chữ đổi ngay khi gõ; filters chỉ đổi khi ngừng gõ (mỗi lần đổi gọi danh sách + đếm từng tab)
    const [keywordInput, setKeywordInput] = useState("");
    const [tenKhoInput, setTenKhoInput] = useState("");

    useEffect(() => {
        const keyword = keywordInput.trim();
        const tenKho = tenKhoInput.trim();
        const timer = setTimeout(() => {
            setFilters((p) => (p.keyword === keyword && p.tenKho === tenKho ? p : { ...p, keyword, tenKho, page: 0 }));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [keywordInput, tenKhoInput]);

    // ── Vai trò + kho phụ trách ──
    const loadPhamVi = useCallback(async () => {
        try {
            const userId = getCurrentUserId();
            if (userId == null) {
                setRoles([]);
                return;
            }
            const res = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${userId}`);
            const dsVaiTro = parseRoles(res.data?.data?.vaiTro);
            setRoles(dsVaiTro);
            // Không phải quản trị viên: backend chỉ trả phiếu của kho được phân công (cùng nguồn với /kho/mine)
            if (!dsVaiTro.includes("quan_tri_vien")) setKhoPhuTrach(await getMineKhoList());
        } catch (error) {
            console.error("Lỗi khi tải thông tin phân quyền:", error);
            setRoles((prev) => prev ?? []);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => loadPhamVi());
    }, [loadPhamVi]);

    // ── Danh sách ──
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const res = await phieuXuatKhoService.filter(buildFilterPayload({ ...filters, trangThai: tabTrangThai }));
            if (requestId !== requestIdRef.current) return;
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
            if (trangCuoi != null) {
                setFilters((p) => ({ ...p, page: trangCuoi }));
                return;
            }
            let finalData = res?.content || [];

            // Lọc ngày xuất phía client (ngayXuat, fallback ngayTao) — API chưa nhận điều kiện ngày
            if (filters.ngayXuat) {
                finalData = finalData.filter((item) => {
                    const dateValue = item.ngayXuat || item.ngayTao;
                    if (!dateValue) return false;
                    const date = new Date(dateValue);
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}` === filters.ngayXuat;
                });
            }

            setData(finalData);
            setTotal(res?.totalElements || 0); // Tổng của máy chủ (chưa tính lọc ngày tại chỗ)
            setLoadError(false);
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            console.error("Fetch list error:", e);
            if (silent) throw e;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setData([]);
            setTotal(0);
            setLoadError(true);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [filters, tabTrangThai]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch lại ngay mỗi khi bộ lọc / tab đổi.
    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // ── Số trên tab: cùng từ khóa + tên kho đang lọc, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => demPhieu({ keyword: filters.keyword, tenKho: filters.tenKho, trangThai: trangThaiCuaTab(ma) }),
        `${filters.keyword}|${filters.tenKho}`
    );

    // ── Dòng chú ý: phiếu đã đóng gói, chờ xuất kho trong phạm vi danh sách, bỏ qua các bộ lọc khác (R4).
    //    Chỉ phiếu bán hàng có trạng thái này (phiếu chuyển kho xuất thẳng từ Nháp), khớp tab Chờ xuất. ──
    const coQuyenXuatKho = roles?.some((role) => VAI_TRO_XUAT_KHO.includes(role)) ?? false;
    const choXuat = useDemTheoTrangThai(
        [TAB_CHO_XUAT],
        () => demPhieu({ keyword: "", tenKho: "", trangThai: trangThaiCuaTab(TAB_CHO_XUAT) }),
        TAB_CHO_XUAT,
        { enabled: coQuyenXuatKho }
    );

    const changeTab = (value) => {
        setTab(value);
        setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
    };

    // Bộ lọc ngoài tab trạng thái ("Xóa lọc" chỉ xóa các bộ lọc này, giữ tab đang chọn)
    const hasActiveFilters = Boolean(keywordInput.trim() || tenKhoInput.trim() || filters.ngayXuat);

    const clearFilters = () => {
        setKeywordInput("");
        setTenKhoInput("");
        setFilters((p) => ({ ...p, keyword: "", tenKho: "", ngayXuat: "", page: 0 }));
    };

    // Nút của dòng chú ý: mở tab Chờ xuất, bỏ các bộ lọc khác để số dòng khớp số trên dòng chú ý
    const showPending = () => {
        clearFilters();
        setTab(TAB_CHO_XUAT);
    };

    const handleRetry = () => {
        fetchData();
        tabCounts.reload();
        choXuat.reload();
    };

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: trạng thái phiếu do kho cập nhật
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => {
            tabCounts.reload();
            choXuat.reload();
            return fetchData({ silent: true });
        },
        bat: !loading,
    });

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs.
    // Lọc ngày chỉ áp dụng trong trang đang xem (API chưa nhận ngày) nên khi đang lọc ngày tab không hiện số.
    const statusTabs = PHIEU_XUAT_KHO_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        tone: TONE_TAB[t.ma],
        count: loadError || filters.ngayXuat ? null : tabCounts.counts[t.ma],
    }));

    // Ghi chú phạm vi cho người chỉ xem kho mình phụ trách (R3)
    const scopeNote = !roles || roles.includes("quan_tri_vien") || !khoPhuTrach
        ? null
        : khoPhuTrach.length > 0
            ? `Kho bạn phụ trách: ${khoPhuTrach.map((kho) => kho.tenKho).join(", ")}`
            : "Bạn chưa được phân công kho nào nên danh sách đang trống.";

    const pendingCount = coQuyenXuatKho && tab !== TAB_CHO_XUAT ? choXuat.counts[TAB_CHO_XUAT] : null;
    const emptyTabLabel = PHIEU_XUAT_KHO_TABS.find((t) => t.ma === tab)?.label;

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                scope={scopeNote}
                actions={
                    <Link to="/goods-issues/create">
                        <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                            <Plus className="size-4" />
                            Tạo phiếu xuất kho
                        </Button>
                    </Link>
                }
            />

            <AttentionBar
                count={pendingCount}
                actionLabel="Xem phiếu chờ xuất kho"
                onAction={showPending}
            >
                <strong className="font-semibold">{pendingCount?.toLocaleString("vi-VN")} phiếu</strong> đã đóng gói, đang chờ xuất kho.
            </AttentionBar>

            {/* ══ BẢNG: tab trạng thái + tìm kiếm + bộ lọc cùng một hàng ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc phiếu xuất kho theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            label="Tìm theo số phiếu hoặc mã tham chiếu"
                            placeholder="Số phiếu xuất hoặc số đơn bán..."
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onClear={() => {
                                setKeywordInput("");
                                setFilters((p) => (p.keyword === "" ? p : { ...p, keyword: "", page: 0 }));
                            }}
                            className="sm:w-[300px]"
                        />

                        <input
                            type="text"
                            placeholder="Nhập tên kho"
                            aria-label="Kho xuất"
                            value={tenKhoInput}
                            onChange={(e) => setTenKhoInput(e.target.value)}
                            className="h-9 w-full rounded-md border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 sm:w-[190px]"
                        />

                        {/* Ngày xuất: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
                        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-bo-surface pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto">
                            <Calendar className="size-4 shrink-0 text-bo-muted" />
                            <span className="shrink-0 text-xs text-bo-muted">Ngày xuất</span>
                            <Input
                                type="date"
                                aria-label="Ngày xuất"
                                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0"
                                value={filters.ngayXuat}
                                onChange={(e) => setFilters((p) => ({ ...p, ngayXuat: e.target.value, page: 0 }))}
                            />
                        </label>
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError ? (
                        // Lọc ngày chạy tại chỗ trên trang vừa tải (API chưa nhận điều kiện ngày), nên vẫn giữ phân trang
                        // theo máy chủ để xem tiếp các trang sau; trang đang xem không có phiếu ngày đó thì bảng trống.
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
                            onSizeChange={(size) => setFilters((p) => ({ ...p, size, page: 0 }))}
                            capNhat={capNhat}
                            extra={
                                filters.ngayXuat ? (
                                    <span className="text-xs text-bo-muted">
                                        Lọc ngày chỉ áp dụng cho trang đang xem
                                    </span>
                                ) : null
                            }
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState rows={6} label="Đang tải danh sách phiếu xuất kho" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách phiếu xuất kho. Vui lòng thử lại."
                        onRetry={handleRetry}
                    />
                ) : data.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy phiếu xuất kho phù hợp"
                            description={
                                filters.ngayXuat && total > 0
                                    ? "Trang này không có phiếu của ngày đã chọn. Chuyển trang ở dưới để xem tiếp, hoặc đổi điều kiện lọc."
                                    : "Thử đổi từ khóa, tên kho hoặc ngày xuất."
                            }
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={ClipboardList}
                            title={`Không có phiếu xuất kho nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi phiếu xuất kho."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ClipboardList}
                            title="Chưa có phiếu xuất kho"
                            description="Phiếu xuất bán hàng và phiếu xuất chuyển kho sẽ hiện ở đây khi được tạo."
                        />
                    )
                ) : (
                    <table className="w-full min-w-[980px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Số phiếu xuất
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tham chiếu gốc
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Kho xuất
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Ngày tạo
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Ngày xuất
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Trạng thái
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((item, index) => {
                                // XÁC ĐỊNH MÃ THAM CHIẾU ĐỂ HIỂN THỊ
                                const isChuyenKho = item.loaiXuat === "chuyen_kho" || item.loaiXuat === "CHUYEN_KHO";

                                const maThamChieu = isChuyenKho
                                    ? (item.phieuChuyenKhoGoc?.soPhieuXuat || item.soPhieuChuyenKhoGoc || `PCK ID: ${item.phieuChuyenKhoGocId || item.parentId}`)
                                    : (item.donBanHang?.soDonHang || "-");

                                const status = getPhieuXuatKhoStatus(item.trangThai);

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/goods-issues/${item.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                            {filters.page * filters.size + index + 1}
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-bo-primary">
                                            {item.soPhieuXuat}
                                        </td>
                                        {/* Mã tham chiếu là chữ thường: không bấm được nên không tô màu liên kết */}
                                        <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                            {maThamChieu}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-bo-foreground">
                                            {item.kho?.tenKho || "-"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                                            {formatDate(item.ngayTao)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                                            {item.ngayXuat ? formatDate(item.ngayXuat) : "Chưa xuất kho"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {status ? (
                                                <StatusBadge quyTrinh="phieuXuat" label={status.label} />
                                            ) : (
                                                <span className="text-xs text-bo-muted">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>
        </PageContainer>
    );
}
