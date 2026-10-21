import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import apiClient from "@/services/apiClient";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import KhoLamViecSelect from "@/components/shared/KhoLamViecSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, SearchX } from "lucide-react";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { PHIEU_CHUYEN_KHO_TABS, getPhieuChuyenKhoStatus } from "@/constants/phieuChuyenKho";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { formatDate } from "@/utils/formatters";

//Constants & Helpers
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
    NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

function parseJwt(token) {
    try {
        const b64 = token.split(".")[1];
        return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

/** Kho làm việc hiện tại (apiClient gửi qua header `kho_id`); đọc lỗi thì coi như chưa chọn. */
function docKhoLamViec() {
    try {
        return window.localStorage.getItem("selected_kho_id") ?? "";
    } catch {
        return "";
    }
}

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = PHIEU_CHUYEN_KHO_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const trangThaiCuaTab = (ma) => PHIEU_CHUYEN_KHO_TABS.find((tab) => tab.ma === ma)?.trangThai ?? null;

const SEARCH_DEBOUNCE_MS = 350;
const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Điều kiện lọc dùng chung cho danh sách và số trên tab. API chỉ nhận MỘT trạng thái mỗi lần gọi.
function buildFilterPayload({ keyword, tenKhoNhap, trangThai, page, size }) {
    const filterList = [];
    if (keyword?.trim()) {
        filterList.push({ fieldName: "soPhieuXuat", operation: "LIKE", value: keyword.trim() });
    }
    if (tenKhoNhap?.trim()) {
        filterList.push({ fieldName: "khoChuyenDen.tenKho", operation: "LIKE", value: tenKhoNhap.trim() });
    }
    if (trangThai != null) {
        filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai });
    }
    return { page, size, filters: filterList, sorts: [{ fieldName: "ngayTao", direction: "DESC" }] };
}

export default function PhieuChuyenKhoList() {
    const navigate = useNavigate();
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    const tabTrangThai = trangThaiCuaTab(tab);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [total, setTotal] = useState(0);
    const [userRoles, setUserRoles] = useState([]);
    const requestIdRef = useRef(0);
    // Danh sách xem phiếu đi và đến của kho làm việc: đổi kho thì tải lại danh sách và số trên tab
    const [khoLamViec, setKhoLamViec] = useState(docKhoLamViec);

    const [filters, setFilters] = useState({
        keyword: "",
        tenKhoNhap: "",
        page: 0,
        size: SO_DONG_MAC_DINH,
    });
    // Ô chữ đổi ngay khi gõ; filters chỉ đổi khi ngừng gõ (mỗi lần đổi gọi danh sách + đếm từng tab)
    const [keywordInput, setKeywordInput] = useState("");
    const [tenKhoNhapInput, setTenKhoNhapInput] = useState("");

    useEffect(() => {
        const keyword = keywordInput.trim();
        const tenKhoNhap = tenKhoNhapInput.trim();
        const timer = setTimeout(() => {
            setFilters((p) => (p.keyword === keyword && p.tenKhoNhap === tenKhoNhap ? p : { ...p, keyword, tenKhoNhap, page: 0 }));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [keywordInput, tenKhoNhapInput]);

    // Kiểm tra quyền (chỉ nhân viên kho)
    const isNhanVienKho = userRoles.includes(ROLE.NHAN_VIEN_KHO);

    // Fetch roles
    const fetchUserInfo = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            const payload = parseJwt(token);
            if (!payload || !payload.id) return;

            const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
            const userData = userResponse.data?.data;
            if (userData && userData.vaiTro) {
                setUserRoles(parseRoles(userData.vaiTro));
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin user:', error);
        }
    }, []);

    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        // Đổi tab / bộ lọc / kho liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const res = await phieuChuyenKhoService.filter(buildFilterPayload({ ...filters, trangThai: tabTrangThai }));
            if (requestId !== requestIdRef.current) return;
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
            if (trangCuoi != null) {
                setFilters((p) => ({ ...p, page: trangCuoi }));
                return;
            }
            setData(res?.content || []);
            setTotal(res?.totalElements || 0);
            setLoadError(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error("Lỗi lấy danh sách:", error);
            if (silent) throw error;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setData([]);
            setTotal(0);
            setLoadError(true);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [filters, tabTrangThai]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải lại mỗi khi bộ lọc / tab / kho đổi.
    useEffect(() => {
        queueMicrotask(() => fetchUserInfo());
    }, [fetchUserInfo]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // ── Số trên tab: cùng kho làm việc + từ khóa + kho nhận đang lọc, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        async (ma) => {
            const res = await phieuChuyenKhoService.filter(buildFilterPayload({
                keyword: filters.keyword,
                tenKhoNhap: filters.tenKhoNhap,
                trangThai: trangThaiCuaTab(ma),
                page: 0,
                size: 1,
            }));
            return res?.totalElements ?? 0;
        },
        `${khoLamViec}|${filters.keyword}|${filters.tenKhoNhap}`
    );

    const changeTab = (value) => {
        setTab(value);
        setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
    };

    // Đổi kho làm việc: kho không nằm trong payload (apiClient gửi header kho_id từ localStorage) nên
    // luôn tạo filters mới để danh sách tải lại; khoLamViec nằm trong khóa đếm nên số trên tab cũng đếm lại
    const handleDoiKho = (id) => {
        setKhoLamViec(String(id));
        setFilters((p) => ({ ...p, page: 0 }));
    };

    // Bộ lọc ngoài tab trạng thái ("Xóa lọc" chỉ xóa các bộ lọc này, giữ tab và kho làm việc)
    const hasActiveFilters = Boolean(keywordInput.trim() || tenKhoNhapInput.trim());

    const clearFilters = () => {
        setKeywordInput("");
        setTenKhoNhapInput("");
        setFilters((p) => ({ ...p, keyword: "", tenKhoNhap: "", page: 0 }));
    };

    const handleRetry = () => {
        fetchData();
        tabCounts.reload();
    };

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: kho gửi và kho nhận là hai người ở hai nơi
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => {
            tabCounts.reload();
            return fetchData({ silent: true });
        },
        bat: !loading,
    });

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = PHIEU_CHUYEN_KHO_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        count: loadError ? null : tabCounts.counts[t.ma],
    }));

    const emptyTabLabel = PHIEU_CHUYEN_KHO_TABS.find((t) => t.ma === tab)?.label;

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={
                    !isNhanVienKho ? (
                        <Link to="/transfer-tickets/create">
                            <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                                <Plus className="size-4" />
                                Tạo phiếu chuyển kho
                            </Button>
                        </Link>
                    ) : null
                }
            />

            {/* ══ BẢNG: tab trạng thái + kho làm việc + tìm kiếm cùng một hàng ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc phiếu chuyển kho theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        {/* API lấy phiếu đi và đến của kho làm việc (header kho_id) */}
                        <KhoLamViecSelect onChange={handleDoiKho} />
                        <SearchInput
                            placeholder="Nhập số phiếu..."
                            label="Số phiếu"
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
                            placeholder="Tên kho nhận hàng"
                            aria-label="Kho nhập (đích)"
                            value={tenKhoNhapInput}
                            onChange={(e) => setTenKhoNhapInput(e.target.value)}
                            className="h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 sm:w-[200px]"
                        />
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
                            onSizeChange={(size) => setFilters((p) => ({ ...p, size, page: 0 }))}
                            capNhat={capNhat}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState rows={6} label="Đang tải danh sách phiếu chuyển kho" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách phiếu chuyển kho. Vui lòng thử lại."
                        onRetry={handleRetry}
                    />
                ) : data.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy phiếu chuyển kho phù hợp"
                            description="Thử đổi số phiếu hoặc tên kho nhận hàng."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={ClipboardList}
                            title={`Không có phiếu chuyển kho nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi phiếu chuyển đi và chuyển đến của kho đang chọn."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ClipboardList}
                            title="Chưa có phiếu chuyển kho"
                            description="Kho đang chọn chưa có phiếu chuyển đi hoặc chuyển đến."
                        />
                    )
                ) : (
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} w-14 text-center`}>STT</th>
                                <th className={`${TH_CLASS} text-left`}>Số phiếu</th>
                                <th className={`${TH_CLASS} text-left`}>Kho xuất</th>
                                <th className={`${TH_CLASS} text-left`}>Kho nhập</th>
                                <th className={`${TH_CLASS} text-left`}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-left`}>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((item, index) => {
                                const status = getPhieuChuyenKhoStatus(item.trangThai);
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/transfer-tickets/${item.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="w-14 px-4 py-3.5 text-center align-middle text-xs text-bo-muted">
                                            {filters.page * filters.size + index + 1}
                                        </td>
                                        <td className="px-4 py-3.5 align-middle font-semibold text-bo-primary">{item.soPhieuXuat}</td>
                                        <td className="px-4 py-3.5 align-middle text-bo-foreground">{item.kho?.tenKho}</td>
                                        <td className="px-4 py-3.5 align-middle text-bo-foreground">{item.khoChuyenDen?.tenKho}</td>
                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="whitespace-nowrap text-xs text-bo-muted">{formatDate(item.ngayTao)}</span>
                                        </td>
                                        <td className="px-4 py-3.5 align-middle">
                                            {status ? (
                                                <StatusBadge quyTrinh="chuyenKho" label={status.label} />
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
