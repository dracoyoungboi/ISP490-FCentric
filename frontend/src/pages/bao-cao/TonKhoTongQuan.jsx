/**
 * TonKhoTongQuan — Router Page (không phải component)
 *
 * Tự xử lý:
 * - Đọc JWT → lấy userId
 * - Gọi /api/v1/nguoi-dung/get-by-id/{id} → lấy vaiTro + khoPhuTrach
 * - Nếu vai trò đặc quyền (admin/quan_ly_kho/...) → gọi /api/v1/kho/all
 * - Gọi thongKeHeThongService.getTonKhoTongQuan({ khoId?, keyword? })
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    PackagePlus, Filter, Warehouse, RefreshCw, ShieldAlert,
    ChevronDown, Check,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import SearchInput from "@/components/shared/SearchInput";

import apiClient from "@/services/apiClient";
import { thongKeHeThongService } from "@/services/thongKeHeThongService";
import { getKhoLamViecId, laKhoLamViecHopLe, setKhoLamViecId } from "@/utils/khoLamViec";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
    NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

const ROLES_ALL_KHO = [
    ROLE.QUAN_TRI_VIEN,
    ROLE.QUAN_LY_KHO,
    ROLE.NHAN_VIEN_MUA_HANG,
    ROLE.NHAN_VIEN_BAN_HANG,
];

const ALLOWED_ROLES = Object.values(ROLE);

const DROPDOWN_CONTENT_CLASS =
    "backoffice-user-menu z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const DROPDOWN_ITEM_CLASS =
    "cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const TH_CLASS =
    "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function canSeeAllKho(roles) {
    return roles.some(r => ROLES_ALL_KHO.includes(r));
}

function canNhapKho(roles) {
    return roles.some(r => [
        ROLE.QUAN_TRI_VIEN, ROLE.QUAN_LY_KHO,
        ROLE.NHAN_VIEN_KHO, ROLE.NHAN_VIEN_MUA_HANG,
    ].includes(r));
}

const formatCurrency = (value) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value ?? 0);

const fmt = (n) =>
    n != null ? Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) : "—";

function trangThaiTon(item) {
    const kha = Number(item.tongSoLuongKhaDung ?? item.onHand ?? 0);
    const min = Number(item.mucTonToiThieu ?? 0);
    if (kha <= 0) return "het_hang";
    if (min > 0 && kha <= min) return "thieu_hang";
    if (min > 0 && kha <= min * 1.5) return "binh_thuong";
    return "du_hang";
}

const STATUS_CFG = {
    het_hang: { label: "Hết hàng", tone: "danger" },
    thieu_hang: { label: "Thiếu hàng", tone: "warning" },
    binh_thuong: { label: "Bình thường", tone: "success" },
    du_hang: { label: "Dư hàng", tone: "info" },
};

const TRANG_THAI_FILTERS = [
    { key: "tat_ca", label: "Tất cả" },
    { key: "het_hang", label: "Hết hàng" },
    { key: "thieu_hang", label: "Thiếu" },
    { key: "binh_thuong", label: "Bình thường" },
    { key: "du_hang", label: "Dư hàng" },
];

// ─── PAGE COMPONENT ───────────────────────────────────────────────────────────
export default function TonKhoTongQuan() {
    const navigate = useNavigate();

    // ── Auth state ──────────────────────────────────────────────────────────
    const [userId, setUserId] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [khoList, setKhoList] = useState([]);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);

    // ── Filter state ────────────────────────────────────────────────────────
    const [selectedKhoId, setSelectedKhoId] = useState(null);
    const [keyword, setKeyword] = useState("");
    const [trangThaiFilter, setTrangThaiFilter] = useState("tat_ca");

    // ── Data state ──────────────────────────────────────────────────────────
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const initDone = useRef(false);

    // STEP 0 — đọc userId từ JWT
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) { setAuthError("Chưa đăng nhập."); setLoadingAuth(false); return; }
        const claims = parseJwt(token);
        if (claims?.id) setUserId(claims.id);
        else { setAuthError("Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại."); setLoadingAuth(false); }
    }, []);

    // STEP 1 — lấy thông tin user + danh sách kho
    useEffect(() => {
        if (!userId || initDone.current) return;
        initDone.current = true;

        setLoadingAuth(true);
        apiClient.get(`/api/v1/nguoi-dung/get-by-id/${userId}`)
            .then(async (res) => {
                const nd = res.data?.data;
                const roles = parseRoles(nd?.vaiTro);
                setUserRoles(roles);

                let khos = [];
                if (canSeeAllKho(roles)) {
                    const r = await apiClient.get("/api/v1/kho/all");
                    khos = r.data?.data ?? [];
                } else {
                    khos = (nd?.khoPhuTrach ?? [])
                        .filter(p => p.trangThai === 1)
                        .map(p => p.kho)
                        .filter(Boolean);
                }
                setKhoList(khos);

                if (khos.length === 1) {
                    setSelectedKhoId(khos[0].id);
                    if (laKhoLamViecHopLe(khos[0])) setKhoLamViecId(khos[0].id);
                } else {
                    const savedId = getKhoLamViecId();
                    if (savedId) setSelectedKhoId(savedId);
                }
            })
            .catch(() => setAuthError("Không thể tải thông tin tài khoản."))
            .finally(() => setLoadingAuth(false));
    }, [userId]);

    // STEP 2 — gọi API getTonKhoTongQuan
    const loadTonKho = useCallback(async ({ khoId, kw } = {}) => {
        setLoading(true);
        try {
            const params = {};
            if (khoId) params.khoId = khoId;
            if (kw) params.keyword = kw;

            const res = await thongKeHeThongService.getTonKhoTongQuan(params);
            const rows = res.data?.data ?? [];
            setData(rows);
            setHasLoaded(true);
        } catch (err) {
            toast.error(err?.response?.data?.message ?? "Không thể tải dữ liệu tồn kho");
        } finally {
            setLoading(false);
        }
    }, []);

    const autoLoaded = useRef(false);

    // Auto-load khi auth xong — chỉ chạy một lần duy nhất như hành vi cũ
    // (đổi kho ở dropdown đã tự gọi loadTonKho).
    useEffect(() => {
        if (loadingAuth || authError || autoLoaded.current) return;
        autoLoaded.current = true;
        const khoId = selectedKhoId ?? (khoList.length === 1 ? khoList[0].id : undefined);
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay sau khi xác thực.
        queueMicrotask(() => loadTonKho({ khoId }));
    }, [loadingAuth, authError, selectedKhoId, khoList, loadTonKho]);

    // Bấm nút Lọc
    const handleFilter = () => {
        const khoId = selectedKhoId ?? (khoList.length === 1 ? khoList[0].id : undefined);
        loadTonKho({ khoId, kw: keyword.trim() || undefined });
    };

    // Chọn kho
    const handleSelectKho = (id) => {
        const numId = id ? Number(id) : null;
        setSelectedKhoId(numId);
        // Bộ lọc báo cáo chỉ đổi kho làm việc chung khi đó là kho người dùng làm việc được.
        // "Tất cả kho" hay kho không được phân công thì giữ nguyên kho làm việc — xóa/ghi sai ở đây
        // làm Đơn chờ xuất, Phiếu nhặt hàng, phiếu nhập/xuất báo thiếu ngữ cảnh kho.
        const khoChon = numId ? khoList.find((kho) => kho.id === numId) : null;
        if (khoChon && laKhoLamViecHopLe(khoChon)) setKhoLamViecId(numId);

        setHasLoaded(false);
        loadTonKho({ khoId: numId ?? undefined, kw: keyword.trim() || undefined });
    };

    // Filter phía client
    const filteredData = data.filter(item =>
        trangThaiFilter === "tat_ca" ? true : trangThaiTon(item) === trangThaiFilter
    );

    // Computed flags
    const hasAccess = userRoles.some(r => ALLOWED_ROLES.includes(r));
    const showNhapKho = canNhapKho(userRoles);
    const multiKho = khoList.length > 1;
    const activeKhoLabel = selectedKhoId
        ? khoList.find(k => k.id === selectedKhoId)?.tenKho ?? "Chọn kho"
        : "Tất cả kho";

    // RENDER: Loading Auth
    if (loadingAuth) {
        return (
            <PageContainer className="space-y-5">
                <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={6} label="Đang tải dữ liệu" />
                </section>
            </PageContainer>
        );
    }

    // RENDER: Auth error
    if (authError) {
        return (
            <PageContainer className="space-y-5">
                <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <ErrorState
                        title={authError}
                        description="Vui lòng tải lại trang hoặc đăng nhập lại để tiếp tục."
                        onRetry={() => window.location.reload()}
                    />
                </section>
            </PageContainer>
        );
    }

    // RENDER: No access
    if (!hasAccess) {
        return (
            <PageContainer className="space-y-5">
                <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={ShieldAlert}
                        title="Không có quyền truy cập"
                        description="Bạn không có quyền truy cập trang này."
                    />
                </section>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="space-y-5">

            {/* ── Bộ lọc ── */}
            <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bo-border px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                        <Filter className="size-4 text-bo-primary" />
                        <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
                            Bộ lọc tồn kho
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-bo-muted">
                            {hasLoaded ? (
                                <>
                                    {"Hiển thị "}
                                    <span className="font-semibold text-bo-primary">{filteredData.length}</span>
                                    {" / "}
                                    <span className="font-semibold text-bo-foreground">{data.length}</span>
                                    {" bản ghi"}
                                </>
                            ) : (
                                "Theo dõi và quản lý hàng hóa theo biến thể"
                            )}
                        </p>
                        <Button
                            variant="outline"
                            disabled={loading}
                            onClick={() => loadTonKho({ khoId: selectedKhoId ?? undefined, kw: keyword.trim() || undefined })}
                            className="h-9 shrink-0 gap-2 border-bo-border bg-white text-sm font-medium text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                        >
                            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-end gap-5 p-4 sm:p-5 lg:grid-cols-3">
                    {/* Trạng thái */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Trạng thái tồn kho
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {TRANG_THAI_FILTERS.map(({ key, label }) => {
                                const isSelected = trangThaiFilter === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setTrangThaiFilter(key)}
                                        className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${isSelected
                                            ? "border-bo-primary bg-bo-primary text-white"
                                            : "border-bo-border bg-white text-slate-600 hover:bg-bo-surface-subtle"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chọn kho bằng Shadcn DropdownMenu */}
                    <div className="flex flex-col gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            <Warehouse className="size-3.5" /> Kho hàng
                        </span>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={!multiKho}
                                    className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    <span className="truncate">{activeKhoLabel}</span>
                                    <ChevronDown className="size-4 shrink-0 opacity-70" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className={`${DROPDOWN_CONTENT_CLASS} w-56`}>
                                {multiKho && (
                                    <DropdownMenuItem
                                        onClick={() => handleSelectKho(null)}
                                        className={`${DROPDOWN_ITEM_CLASS} flex items-center justify-between gap-2`}
                                    >
                                        Tất cả kho
                                        {!selectedKhoId && <Check className="size-4 shrink-0 text-bo-primary" />}
                                    </DropdownMenuItem>
                                )}
                                {khoList.map(kho => (
                                    <DropdownMenuItem
                                        key={kho.id}
                                        onClick={() => handleSelectKho(kho.id)}
                                        className={`${DROPDOWN_ITEM_CLASS} flex items-center justify-between gap-2`}
                                    >
                                        <span className="truncate">{kho.tenKho}</span>
                                        {selectedKhoId === kho.id && (
                                            <Check className="size-4 shrink-0 text-bo-primary" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Tìm kiếm */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Tìm kiếm
                        </span>
                        <SearchInput
                            label="Tìm kiếm tồn kho"
                            placeholder="SKU, mã SP, tên sản phẩm..."
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onClear={() => setKeyword("")}
                            onKeyDown={e => e.key === "Enter" && handleFilter()}
                            className="sm:max-w-none"
                        />
                    </div>
                </div>
            </section>

            {/* ── Bảng dữ liệu ── */}
            <TableShell
                title="Tồn kho theo biến thể"
                description="Số lượng tồn, hàng đang về và hàng đang xuất theo từng kho"
                footer={hasLoaded && filteredData.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <SummaryItem
                            label="Tổng tồn kho"
                            value={fmt(filteredData.reduce((s, i) => s + Number(i.onHand ?? i.tongSoLuongKhaDung ?? 0), 0))}
                        />
                        <Divider />
                        <SummaryItem
                            label="Đang về"
                            value={fmt(filteredData.reduce((s, i) => s + Number(i.incoming ?? i.tongSoLuongChoNhan ?? 0), 0))}
                            valueClass="text-bo-primary"
                        />
                        <Divider />
                        <SummaryItem
                            label="Đang xuất"
                            value={fmt(filteredData.reduce((s, i) => s + Number(i.outgoing ?? i.tongSoLuongChoDuaHang ?? 0), 0))}
                            valueClass="text-bo-warning"
                        />
                        <Divider />
                        <SummaryItem
                            label="Tổng giá trị tồn"
                            value={formatCurrency(filteredData.reduce((s, i) => s + Number(i.tongGiaTri ?? i.giaTriTonKho ?? 0), 0))}
                            valueClass="text-bo-success"
                        />
                        <Divider />
                        <SummaryItem
                            label="Cảnh báo (hết/thiếu)"
                            value={`${filteredData.filter(i => ["het_hang", "thieu_hang"].includes(trangThaiTon(i))).length} SKU`}
                            valueClass="text-bo-danger"
                        />
                        {multiKho && (
                            <>
                                <Divider />
                                <SummaryItem
                                    label="Số lượng kho"
                                    value={`${new Set(filteredData.map(i => i.khoId)).size} kho`}
                                />
                            </>
                        )}
                    </div>
                ) : null}
            >
                {loading ? (
                    <LoadingState rows={6} label="Đang tải bảng tồn kho" />
                ) : !hasLoaded ? (
                    <EmptyState
                        icon={Warehouse}
                        title="Chưa có dữ liệu tồn kho"
                        description='Nhấn "Lọc" để xem dữ liệu.'
                    />
                ) : filteredData.length === 0 ? (
                    <EmptyState
                        icon={Warehouse}
                        title="Không tìm thấy dữ liệu phù hợp"
                        description="Hãy thay đổi trạng thái hoặc từ khóa tìm kiếm."
                    />
                ) : (
                    <div className="max-h-[600px] overflow-y-auto">
                        <table className="w-full min-w-[1280px] text-sm">
                            <thead className="sticky top-0 z-10 bg-bo-surface-subtle">
                                <tr className="border-b border-bo-border">
                                    <th className={`${TH_CLASS} text-center`}>STT</th>
                                    <th className={`${TH_CLASS} text-left`}>Mã SP / SKU</th>
                                    <th className={`${TH_CLASS} min-w-[200px] text-left`}>Sản phẩm &amp; biến thể</th>
                                    <th className={`${TH_CLASS} text-left`}>Kho</th>
                                    <th className={`${TH_CLASS} text-center`}>On Hand</th>
                                    <th className={`${TH_CLASS} text-center`}>↓ Incoming</th>
                                    <th className={`${TH_CLASS} text-center`}>↑ Outgoing</th>
                                    <th className={`${TH_CLASS} text-center`}>Free to Use</th>
                                    <th className={`${TH_CLASS} text-right`}>Tồn tối thiểu</th>
                                    <th className={`${TH_CLASS} text-right`}>Giá trị tồn</th>
                                    <th className={`${TH_CLASS} text-center`}>Tình trạng</th>
                                    <th className={`${TH_CLASS} text-center`}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {filteredData.map((item, idx) => {
                                    const statusKey = trangThaiTon(item);
                                    const statusCfg = STATUS_CFG[statusKey] ?? STATUS_CFG.binh_thuong;
                                    const isLow = statusKey === "het_hang" || statusKey === "thieu_hang";

                                    const onHand = Number(item.onHand ?? item.tongSoLuongKhaDung ?? 0);
                                    const incoming = Number(item.incoming ?? item.tongSoLuongChoNhan ?? 0);
                                    const outgoing = Number(item.outgoing ?? item.tongSoLuongChoDuaHang ?? 0);
                                    const freeToUse = item.freeToUse != null ? Number(item.freeToUse) : (onHand + incoming - outgoing);
                                    const giaTri = Number(item.tongGiaTri ?? item.giaTriTonKho ?? 0);

                                    return (
                                        <tr
                                            key={`${item.bienTheId}-${item.khoId}-${idx}`}
                                            className={`transition-colors ${isLow ? "bg-bo-warning-soft" : "bg-white hover:bg-bo-surface-subtle"}`}
                                        >
                                            <td className="px-3 py-3 text-center text-xs text-bo-muted">{idx + 1}</td>

                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-semibold uppercase text-bo-muted">{item.maSanPham}</span>
                                                    <span className="w-fit rounded border border-bo-primary/20 bg-bo-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-bo-primary">
                                                        {item.maSku}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="max-w-[250px] px-3 py-3">
                                                <p className="mb-1 truncate font-semibold text-bo-foreground">{item.tenSanPham}</p>
                                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                                                    {item.maMauHex && (
                                                        <svg className="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
                                                            <circle cx="6" cy="6" r="6" fill={item.maMauHex} />
                                                        </svg>
                                                    )}
                                                    <span className="font-medium">{item.tenMau}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="rounded border border-bo-border bg-bo-surface-subtle px-1.5 py-0 font-mono text-[10px] font-semibold text-slate-600">
                                                        {item.tenSize ?? item.maSize}
                                                    </span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{item.tenChatLieu}</span>
                                                </div>
                                            </td>

                                            <td className="px-3 py-3">
                                                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-bo-border bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                                                    <Warehouse className="size-3" /> {item.tenKho}
                                                </span>
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                <NumBadge value={onHand} colorClass={isLow ? "bg-bo-danger text-white" : "bg-bo-success text-white"} />
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                <NumBadge value={incoming} colorClass={incoming > 0 ? "bg-bo-primary text-white" : "border border-bo-border bg-white text-slate-400"} />
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                <NumBadge value={outgoing} colorClass={outgoing > 0 ? "bg-bo-warning text-white" : "border border-bo-border bg-white text-slate-400"} />
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                <NumBadge value={freeToUse} colorClass={freeToUse < 0 ? "bg-bo-danger text-white" : freeToUse === 0 ? "border border-bo-border bg-white text-slate-400" : "bg-slate-700 text-white"} />
                                            </td>

                                            <td className="px-3 py-3 text-right text-xs font-semibold text-slate-600">{fmt(item.mucTonToiThieu)}</td>
                                            <td className="px-3 py-3 text-right text-xs font-bold text-bo-foreground">{formatCurrency(giaTri)}</td>

                                            <td className="px-3 py-3 text-center">
                                                <StatusBadge label={statusCfg.label} tone={statusCfg.tone} />
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                {showNhapKho && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => navigate(`/purchase-requests/create?bienTheId=${item.bienTheId}&khoId=${item.khoId}`)}
                                                        className="h-8 gap-1.5 border-bo-primary/20 bg-bo-primary-soft px-3 text-[11px] font-medium text-bo-primary hover:bg-bo-primary hover:text-white"
                                                        title="Tạo yêu cầu nhập kho"
                                                    >
                                                        <PackagePlus className="size-3.5" /> Nhập
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </TableShell>
        </PageContainer>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function NumBadge({ value, colorClass }) {
    return (
        <span className={`inline-flex min-w-[36px] items-center justify-center rounded px-1.5 py-0.5 font-mono text-xs font-bold ${colorClass}`}>
            {Number(value).toLocaleString("vi-VN")}
        </span>
    );
}

function SummaryItem({ label, value, valueClass = "text-bo-foreground" }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-bo-muted">{label}:</span>
            <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
        </div>
    );
}

function Divider() {
    return <span className="h-4 w-px bg-bo-border" aria-hidden="true" />;
}
