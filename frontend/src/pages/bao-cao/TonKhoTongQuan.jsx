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
import { useNavigate, useSearchParams } from "react-router-dom";
import { getKhoLamViecId } from "@/utils/khoLamViec";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    PackagePlus, Warehouse, ShieldAlert,
    ChevronDown, Check, SearchX,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import SearchInput from "@/components/shared/SearchInput";
import NutXuatExcel from "@/components/shared/NutXuatExcel";
import useCoQuyenXuatBaoCao from "@/hooks/useCoQuyenXuatBaoCao";

import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import apiClient from "@/services/apiClient";
import { thongKeHeThongService } from "@/services/thongKeHeThongService";
import { laKhoAo, laKhoGiaoDich, laKhoHoatDong } from "@/utils/kho";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { VAI_TRO_TAO_YEU_CAU_NHAP } from "@/constants/vaiTroTaoYeuCauNhap";

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

// Chọn riêng Kho Trung Chuyển (hàng đang đi đường khi chuyển kho) để theo dõi tồn: quản trị viên + quản lý kho
const ROLES_XEM_KHO_TRUNG_CHUYEN = [
    ROLE.QUAN_TRI_VIEN,
    ROLE.QUAN_LY_KHO,
];

const ALLOWED_ROLES = Object.values(ROLE);

const DROPDOWN_CONTENT_CLASS =
    "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const DROPDOWN_ITEM_CLASS =
    "cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const TH_CLASS =
    "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap cam-ung:max-lg:whitespace-normal";

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

/** Ngày hôm nay theo giờ máy, dạng yyyy-MM-dd (tên tệp Excel). */
function ngayHomNay() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function canSeeAllKho(roles) {
    return roles.some(r => ROLES_ALL_KHO.includes(r));
}

function canSeeKhoTrungChuyen(roles) {
    return roles.some(r => ROLES_XEM_KHO_TRUNG_CHUYEN.includes(r));
}

// Nút "Nhập kho" mở màn Tạo yêu cầu nhập hàng: cùng danh sách vai trò với màn đó (quản lý kho chỉ duyệt, không lập)
function canNhapKho(roles) {
    return roles.some(r => VAI_TRO_TAO_YEU_CAU_NHAP.includes(r));
}

// Kho Trung Chuyển (hàng đang đi đường) không xét tồn tối thiểu: còn hàng là "Đang vận chuyển", hết thì không có tình trạng
// (null) — nên không vào tab Hết hàng / Sắp hết / Bình thường / Dư hàng và ô Cảnh báo
function trangThaiTon(item, laTrungChuyen = false) {
    const kha = Number(item.tongSoLuongKhaDung ?? item.onHand ?? 0);
    if (laTrungChuyen) return kha > 0 ? "dang_van_chuyen" : null;
    const min = Number(item.mucTonToiThieu ?? 0);
    if (kha <= 0) return "het_hang";
    if (min > 0 && kha <= min) return "thieu_hang";
    if (min > 0 && kha <= min * 1.5) return "binh_thuong";
    return "du_hang";
}

// Tên tình trạng tồn; màu thẻ tra theo tên ở constants/trangThai ("Bình thường": biểu tượng xanh lá + chữ, không khung).
// "Sắp hết hàng" (trước là "Thiếu hàng") để không trùng tên cờ "Thiếu hàng" của đơn kênh (đơn không giao được).
const STATUS_CFG = {
    het_hang: { label: "Hết hàng" },
    thieu_hang: { label: "Sắp hết hàng" },
    binh_thuong: { label: "Bình thường" },
    du_hang: { label: "Dư hàng" },
    dang_van_chuyen: { label: "Đang vận chuyển" },
};

// Tab tình trạng tồn (bố cục A+G) — mã tab trên URL ?tinhTrang=, `key` là kết quả của trangThaiTon()
const TRANG_THAI_FILTERS = [
    { value: "tat-ca", key: "tat_ca", label: "Tất cả" },
    { value: "het-hang", key: "het_hang", label: "Hết hàng" },
    { value: "thieu-hang", key: "thieu_hang", label: "Sắp hết hàng" },
    { value: "binh-thuong", key: "binh_thuong", label: "Bình thường" },
    { value: "du-hang", key: "du_hang", label: "Dư hàng" },
];
const TAB_VALUES = TRANG_THAI_FILTERS.map(t => t.value);
const TAB_MAC_DINH = "tat-ca";

// Dòng thuộc tab nào: cùng một hàm cho bảng và số trên tab (R1)
const khopTab = (item, tab, laTrungChuyen) => {
    const cfg = TRANG_THAI_FILTERS.find(t => t.value === tab);
    return !cfg || cfg.key === "tat_ca" || trangThaiTon(item, laTrungChuyen) === cfg.key;
};

// ─── PAGE COMPONENT ───────────────────────────────────────────────────────────
export default function TonKhoTongQuan() {
    const coQuyenXuat = useCoQuyenXuatBaoCao();
    const navigate = useNavigate();
    // Kho đang xem là BỘ LỌC của báo cáo, tách khỏi nơi làm việc (selected_kho_id, header kho_id):
    // chọn kho ở đây chỉ ghi lên đường dẫn (?kho=<id> hoặc ?kho=tat-ca) để tải lại / chia sẻ vẫn giữ kho đang xem,
    // không đổi nơi làm việc. Vào trang lần đầu: theo ?kho= (vd. bấm từ Tổng quan), không có thì mở ở nơi làm việc.
    const [searchParams, setSearchParams] = useSearchParams();
    const khoTuDuongDan = useRef(searchParams.get("kho"));

    // ── Auth state ──────────────────────────────────────────────────────────
    const [userId, setUserId] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [khoList, setKhoList] = useState([]);
    const [khoAoIds, setKhoAoIds] = useState(() => new Set());
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);

    // ── Filter state ────────────────────────────────────────────────────────
    const [selectedKhoId, setSelectedKhoId] = useState(null);
    const [keyword, setKeyword] = useState("");
    // Từ khóa của dữ liệu đang hiện (ô tìm kiếm chỉ áp dụng khi bấm Enter, như cũ)
    const [tuKhoaDaApDung, setTuKhoaDaApDung] = useState("");
    // Tab tình trạng trên URL (?tinhTrang=); giữ nguyên ?kho= từ Tổng quan
    const [trangThaiFilter, setTrangThaiFilter] = useTabTrenUrl(TAB_VALUES, TAB_MAC_DINH, { ten: "tinhTrang" });

    // ── Data state ──────────────────────────────────────────────────────────
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const requestIdRef = useRef(0);

    // Phân trang tại chỗ (API trả hết các dòng của kho + từ khóa)
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(SO_DONG_MAC_DINH);

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

                const xemMoiKho = canSeeAllKho(roles);
                let khos = [];
                if (xemMoiKho) {
                    const r = await apiClient.get("/api/v1/kho/all");
                    khos = r.data?.data ?? [];
                } else {
                    khos = (nd?.khoPhuTrach ?? [])
                        .filter(p => p.trangThai === 1)
                        .map(p => p.kho)
                        .filter(Boolean);
                }
                // Dòng của Kho Trung Chuyển không tạo yêu cầu nhập được (kho ảo)
                setKhoAoIds(new Set(khos.filter(laKhoAo).map(k => k.id)));
                // Bỏ kho ngừng hoạt động; Kho Trung Chuyển chỉ quản trị viên + quản lý kho chọn được, xếp cuối danh sách
                const xemTrungChuyen = canSeeKhoTrungChuyen(roles);
                khos = [
                    ...khos.filter(laKhoGiaoDich),
                    ...(xemTrungChuyen ? khos.filter(k => laKhoAo(k) && laKhoHoatDong(k)) : []),
                ];
                setKhoList(khos);

                const khoUrl = khoTuDuongDan.current;
                const khoUrlId = Number(khoUrl);
                if (khoUrl === "tat-ca" && xemMoiKho) {
                    setSelectedKhoId(null);
                } else if (khoUrlId && khos.some(k => k.id === khoUrlId)) {
                    setSelectedKhoId(khoUrlId);
                } else if (khos.length === 1) {
                    setSelectedKhoId(khos[0].id);
                } else {
                    const savedId = getKhoLamViecId();
                    if (savedId && khos.some(k => k.id === savedId)) {
                        setSelectedKhoId(savedId);
                    } else if (!xemMoiKho && khos.length > 0) {
                        // Nhân viên kho bắt buộc chọn một kho (API không có "Tất cả kho")
                        setSelectedKhoId(khos[0].id);
                    }
                }
            })
            .catch(() => setAuthError("Không thể tải thông tin tài khoản."))
            .finally(() => setLoadingAuth(false));
    }, [userId]);

    // STEP 2 — gọi API getTonKhoTongQuan
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const loadTonKho = useCallback(async ({ khoId, kw, silent = false } = {}) => {
        // Đổi kho liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const params = {};
            if (khoId) params.khoId = khoId;
            if (kw) params.keyword = kw;

            const res = await thongKeHeThongService.getTonKhoTongQuan(params);
            if (requestId !== requestIdRef.current) return;
            const rows = res.data?.data ?? [];
            setData(rows);
            setTuKhoaDaApDung(kw ?? "");
            setLoadError(null);
            setHasLoaded(true);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw err;
            // Không giữ dòng + tổng của lần tải trước (R9). Giữ lỗi để ô lỗi phân biệt 403 (không có quyền: không
            // "Thử lại", không thông báo nhanh)
            setData([]);
            setLoadError(err);
            if (err?.response?.status !== 403) toast.error(err?.response?.data?.message ?? "Không thể tải dữ liệu tồn kho");
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
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
        setPage(0);
        const khoId = selectedKhoId ?? (khoList.length === 1 ? khoList[0].id : undefined);
        loadTonKho({ khoId, kw: keyword.trim() || undefined });
    };

    // Chọn kho
    const handleSelectKho = (id) => {
        const numId = id ? Number(id) : null;
        setSelectedKhoId(numId);
        // Chỉ là bộ lọc: ghi lên đường dẫn, KHÔNG đổi nơi làm việc (Đơn chờ xuất, Phiếu nhặt hàng, Chuyển kho
        // và các thao tác tạo chứng từ vẫn theo nơi làm việc). API báo cáo nhận kho qua tham số khoId.
        setSearchParams((truoc) => {
            const tiep = new URLSearchParams(truoc);
            tiep.set("kho", numId ? String(numId) : "tat-ca");
            return tiep;
        }, { replace: true });

        setHasLoaded(false);
        setPage(0);
        loadTonKho({ khoId: numId ?? undefined, kw: keyword.trim() || undefined });
    };

    // Nút Thử lại: tải lại đúng kho + từ khóa đang chọn
    const handleRefresh = () => {
        loadTonKho({ khoId: selectedKhoId ?? undefined, kw: keyword.trim() || undefined });
    };

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: tồn đổi theo từng lần bán POS, nhập, xuất.
    // Tải lại đúng kho đang xem + từ khóa đã áp dụng (không lấy chữ đang gõ dở trong ô tìm).
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => loadTonKho({
            khoId: selectedKhoId ?? (khoList.length === 1 ? khoList[0].id : undefined),
            kw: tuKhoaDaApDung || undefined,
            silent: true,
        }),
        bat: !loading && hasLoaded,
    });

    // "Xóa lọc": bỏ từ khóa, giữ kho và tab tình trạng đang chọn
    const handleClearFilters = () => {
        setKeyword("");
        if (tuKhoaDaApDung) {
            setPage(0);
            const khoId = selectedKhoId ?? (khoList.length === 1 ? khoList[0].id : undefined);
            loadTonKho({ khoId });
        }
    };

    // Filter phía client
    const laTrungChuyen = (item) => khoAoIds.has(item.khoId);
    const filteredData = data.filter(item => khopTab(item, trangThaiFilter, laTrungChuyen(item)));

    // Cắt trang tại chỗ; trang đang xem vượt quá số trang (đổi tab qua đường dẫn, tải lại ít dòng hơn) thì về trang cuối
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = filteredData.slice(safePage * pageSize, (safePage + 1) * pageSize);

    // Đổi tab tình trạng: về trang đầu
    const changeTab = (value) => {
        setTrangThaiFilter(value);
        setPage(0);
    };

    // Số trên tab = số dòng thấy khi bấm tab, trên dữ liệu đã lọc kho + từ khóa (R1);
    // đang tải / lỗi / chưa tải thì không hiện số (R9)
    const statusTabs = TRANG_THAI_FILTERS.map(t => ({
        value: t.value,
        label: t.label,
        count: loading || loadError || !hasLoaded ? null : data.filter(item => khopTab(item, t.value, laTrungChuyen(item))).length,
    }));
    const tabLabel = TRANG_THAI_FILTERS.find(t => t.value === trangThaiFilter)?.label;
    const hasFilter = Boolean(keyword.trim() || tuKhoaDaApDung);

    // Computed flags
    const hasAccess = userRoles.some(r => ALLOWED_ROLES.includes(r));
    const showNhapKho = canNhapKho(userRoles);
    const multiKho = khoList.length > 1;
    const activeKhoLabel = selectedKhoId
        ? khoList.find(k => k.id === selectedKhoId)?.tenKho ?? "Chọn kho"
        : "Tất cả kho";

    // Nhân viên kho chỉ xem được kho của mình (R3). Chỉ một kho: không vẽ nhãn phạm vi lẫn ô chọn kho bị khóa — đáy menu
    // đã ghi "Nơi làm việc", cột Kho ghi ở từng dòng (PQ-17). Nhiều kho: ô chọn kho đã liệt kê các kho, không cần nhãn.
    const chonKhoTrongTrang = canSeeAllKho(userRoles) || multiKho;
    const noiLamViec = chonKhoTrongTrang ? null : khoList;

    // RENDER: Loading Auth
    if (loadingAuth) {
        return (
            <PageContainer className="space-y-5">
                <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                    <LoadingState rows={6} label="Đang tải dữ liệu" />
                </section>
            </PageContainer>
        );
    }

    // RENDER: Auth error
    if (authError) {
        return (
            <PageContainer className="space-y-5">
                <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
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
                <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
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
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                noiLamViec={noiLamViec}
                actions={coQuyenXuat ? (
                    // Tệp đúng số đang xem: kho + từ khóa đã áp dụng + tab tình trạng
                    <NutXuatExcel
                        taiTep={() => thongKeHeThongService.xuatExcelTonKho({
                            khoId: selectedKhoId ?? (khoList.length === 1 ? khoList[0].id : undefined),
                            keyword: tuKhoaDaApDung || undefined,
                            tinhTrang: trangThaiFilter === TAB_MAC_DINH ? undefined : trangThaiFilter,
                        })}
                        tenTep={() => `Bao-cao-ton-kho_${ngayHomNay()}.xlsx`}
                        disabled={loading || Boolean(loadError) || !hasLoaded}
                    />
                ) : null}
            />

            {/* ── Bảng dữ liệu: tab tình trạng + kho + tìm kiếm cùng một hàng ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc tồn kho theo tình trạng"
                                tabs={statusTabs}
                                value={trangThaiFilter}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasFilter}
                        onClear={handleClearFilters}
                    >
                        {/* Bộ lọc kho của báo cáo (không đổi nơi làm việc) */}
                        {chonKhoTrongTrang ? (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        aria-label="Chọn kho"
                                        disabled={!multiKho}
                                        className="h-9 w-full justify-between gap-2 border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50 sm:w-[200px]"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <Warehouse className="size-4 shrink-0 text-slate-400" />
                                            <span className="truncate">{activeKhoLabel}</span>
                                        </span>
                                        <ChevronDown className="size-4 shrink-0 opacity-70" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={`${DROPDOWN_CONTENT_CLASS} min-w-[var(--radix-dropdown-menu-trigger-width)]`}>
                                    {multiKho && canSeeAllKho(userRoles) && (
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
                        ) : null}

                        {/* Tìm kiếm: áp dụng khi bấm Enter (gọi lại API với từ khóa), như cũ */}
                        <SearchInput
                            label="Tìm kiếm tồn kho"
                            placeholder="SKU, mã SP, tên sản phẩm..."
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onClear={() => setKeyword("")}
                            onKeyDown={e => e.key === "Enter" && handleFilter()}
                            className="sm:w-[300px]"
                        />
                    </ListToolbar>
                }
                footer={!loading && !loadError && hasLoaded ? (
                    <div className="flex flex-col gap-3">
                        {/* Dòng tổng: cộng mọi dòng của tab đang chọn (không chỉ trang đang xem) */}
                        {filteredData.length > 0 ? (
                            // Điện thoại: mỗi chỉ số một dòng (nhãn trái, số phải), bỏ vạch ngăn — hàng ngang xuống dòng lộn xộn ở 390px
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 max-md:grid max-md:gap-y-1 max-md:[&>span[aria-hidden=true]]:hidden">
                                <SummaryItem
                                    label="Tổng tồn kho"
                                    value={formatNumber(filteredData.reduce((s, i) => s + Number(i.onHand ?? i.tongSoLuongKhaDung ?? 0), 0))}
                                />
                                <Divider />
                                <SummaryItem
                                    label="Đang về"
                                    value={formatNumber(filteredData.reduce((s, i) => s + Number(i.incoming ?? i.tongSoLuongChoNhan ?? 0), 0))}
                                    valueClass="text-bo-primary"
                                />
                                <Divider />
                                <SummaryItem
                                    label="Đang xuất"
                                    value={formatNumber(filteredData.reduce((s, i) => s + Number(i.outgoing ?? i.tongSoLuongChoDuaHang ?? 0), 0))}
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
                                    label="Cảnh báo (hết / sắp hết)"
                                    value={`${filteredData.filter(i => ["het_hang", "thieu_hang"].includes(trangThaiTon(i, laTrungChuyen(i)))).length} SKU`}
                                    valueClass="text-bo-danger"
                                />
                                {/* Hàng đang đi đường (Kho Trung Chuyển) khi xem Tất cả kho; chọn riêng kho này thì đã bằng Tổng tồn kho */}
                                {!selectedKhoId && canSeeKhoTrungChuyen(userRoles) && filteredData.some(laTrungChuyen) && (
                                    <>
                                        <Divider />
                                        <SummaryItem
                                            label="Đang vận chuyển"
                                            value={formatNumber(filteredData.filter(laTrungChuyen).reduce((s, i) => s + Number(i.onHand ?? i.tongSoLuongKhaDung ?? 0), 0))}
                                        />
                                    </>
                                )}
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

                        <TablePagination
                            page={safePage}
                            size={pageSize}
                            total={filteredData.length}
                            onPageChange={setPage}
                            onSizeChange={(size) => { setPageSize(size); setPage(0); }}
                            capNhat={capNhat}
                        />
                    </div>
                ) : null}
            >
                {loading ? (
                    <LoadingState rows={6} label="Đang tải bảng tồn kho" />
                ) : loadError ? (
                    <ErrorState
                        description={loadError?.response?.data?.message ?? "Không thể tải dữ liệu tồn kho"}
                        error={loadError}
                        onRetry={handleRefresh}
                    />
                ) : !hasLoaded ? (
                    <EmptyState
                        icon={Warehouse}
                        title="Chưa có dữ liệu tồn kho"
                        description="Chọn kho hoặc bấm Tải dữ liệu để xem tồn kho."
                        action={
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Tải dữ liệu
                            </Button>
                        }
                    />
                ) : filteredData.length === 0 ? (
                    tuKhoaDaApDung ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy mã hàng phù hợp"
                            description="Thử đổi từ khóa tìm kiếm hoặc chọn kho khác."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={handleClearFilters}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : trangThaiFilter !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Warehouse}
                            title={`Không có mã hàng nào ở tình trạng "${tabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi mã hàng của kho đang chọn."
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
                            icon={Warehouse}
                            title="Chưa có dữ liệu tồn kho"
                            description="Kho đang chọn chưa có mã hàng nào."
                        />
                    )
                ) : (
                    <>
                    {/* Điện thoại: mỗi mã hàng một thẻ — tên + tình trạng, màu / cỡ · SKU (· kho khi xem tất cả kho),
                        bốn số tồn như các cột của bảng, tồn tối thiểu · giá trị tồn, Yêu cầu nhập */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {pageItems.map((item, idx) => {
                            // Kho Trung Chuyển: như bảng — không tồn tối thiểu, hết hàng thì không có tình trạng, không Yêu cầu nhập
                            const trungChuyen = laTrungChuyen(item);
                            const statusKey = trangThaiTon(item, trungChuyen);
                            const statusCfg = statusKey ? STATUS_CFG[statusKey] ?? STATUS_CFG.binh_thuong : null;
                            const coNutNhap = showNhapKho && !trungChuyen;
                            const { onHand, incoming, outgoing, freeToUse, giaTri } = soTon(item);
                            const mauCo = [item.tenMau, item.tenSize ?? item.maSize].filter(Boolean).join(" / ");
                            return (
                                <li key={`${item.bienTheId}-${item.khoId}-${idx}`} className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="line-clamp-2 min-w-0 font-semibold leading-5 text-bo-foreground">{item.tenSanPham}</p>
                                        {statusCfg ? <StatusBadge label={statusCfg.label} /> : null}
                                    </div>
                                    <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-slate-600">
                                        {item.maMauHex && (
                                            <svg className="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
                                                <circle cx="6" cy="6" r="6" fill={item.maMauHex} />
                                            </svg>
                                        )}
                                        {mauCo ? <span className="font-medium">{mauCo}</span> : null}
                                        {mauCo ? <span className="text-slate-300" aria-hidden="true">·</span> : null}
                                        <span className="font-mono text-xs font-semibold text-slate-700">{item.maSku}</span>
                                    </p>
                                    {multiKho && !selectedKhoId ? <p className="mt-0.5 text-[13px] text-bo-muted">{item.tenKho}</p> : null}
                                    <dl className="mt-2.5 grid grid-cols-4 gap-2 rounded-lg bg-bo-surface-subtle px-2 py-2 text-center">
                                        {[
                                            ["On Hand", onHand, "font-semibold text-bo-foreground"],
                                            ["↓ Incoming", incoming],
                                            ["↑ Outgoing", outgoing],
                                            ["Free to Use", freeToUse, "font-semibold text-bo-foreground"],
                                        ].map(([nhan, so, kieu]) => (
                                            <div key={nhan} className="min-w-0">
                                                <dt className="truncate text-[11px] leading-4 text-bo-muted">{nhan}</dt>
                                                <dd className="text-[15px] leading-6 tabular-nums"><SoLuong value={so} className={kieu} /></dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <div className={`mt-2 flex items-center justify-between gap-3 ${coNutNhap ? "min-h-9" : ""}`}>
                                        <span className="min-w-0 text-[13px] text-bo-muted">
                                            Tối thiểu {trungChuyen || item.mucTonToiThieu == null ? "—" : formatNumber(item.mucTonToiThieu)}
                                            {" · "}
                                            <b className="font-semibold tabular-nums text-bo-foreground">{formatCurrency(giaTri)}</b>
                                        </span>
                                        {coNutNhap ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => navigate(`/purchase-requests/create?bienTheId=${item.bienTheId}&khoId=${item.khoId}`)}
                                                className="h-9 shrink-0 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground"
                                            >
                                                <PackagePlus className="size-4" aria-hidden="true" />
                                                Yêu cầu nhập
                                            </Button>
                                        ) : null}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {/* Máy tính bảng dọc (cảm ứng): bỏ cột STT, Mã SP / SKU, Kho, Tồn tối thiểu, Tình trạng, Thao tác — SKU · kho,
                        tình trạng và Yêu cầu nhập xuống dưới tên sản phẩm — để không vuốt ngang */}
                    <table className="w-full min-w-[1280px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10 bg-bo-surface-subtle">
                            <tr className="border-b border-bo-border">
                                <th className={`${TH_CLASS} text-center cam-ung:max-lg:hidden`}>STT</th>
                                <th className={`${TH_CLASS} text-left cam-ung:max-lg:hidden`}>Mã SP / SKU</th>
                                <th className={`${TH_CLASS} min-w-[200px] text-left`}>Sản phẩm &amp; biến thể</th>
                                <th className={`${TH_CLASS} text-left cam-ung:max-lg:hidden`}>Kho</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>On Hand</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>↓ Incoming</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>↑ Outgoing</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>Free to Use</th>
                                <th className={`${TH_CLASS} text-right tabular-nums cam-ung:max-lg:hidden`}>Tồn tối thiểu</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>Giá trị tồn</th>
                                <th className={`${TH_CLASS} text-left cam-ung:max-lg:hidden`}>Tình trạng</th>
                                <th className={`${TH_CLASS} text-center cam-ung:max-lg:hidden`}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {pageItems.map((item, idx) => {
                                const trungChuyen = laTrungChuyen(item);
                                const statusKey = trangThaiTon(item, trungChuyen);
                                const statusCfg = statusKey ? STATUS_CFG[statusKey] ?? STATUS_CFG.binh_thuong : null;

                                const { onHand, incoming, outgoing, freeToUse, giaTri } = soTon(item);

                                return (
                                    <tr
                                        key={`${item.bienTheId}-${item.khoId}-${idx}`}
                                        className="bg-bo-surface transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted cam-ung:max-lg:hidden">{safePage * pageSize + idx + 1}</td>

                                        <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-semibold uppercase text-bo-muted">{item.maSanPham}</span>
                                                <span className="font-mono text-xs font-semibold text-slate-700">{item.maSku}</span>
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
                                                <span className="font-medium">{item.tenSize ?? item.maSize}</span>
                                                <span className="text-slate-300">|</span>
                                                <span>{item.tenChatLieu}</span>
                                            </div>
                                            <p className="mt-1 hidden truncate text-xs text-bo-muted cam-ung:max-lg:block">
                                                <span className="font-mono font-semibold text-slate-700">{item.maSku}</span>
                                                {item.tenKho ? ` · ${item.tenKho}` : ""}
                                            </p>
                                            <div className="mt-1.5 hidden flex-wrap items-center gap-2 cam-ung:max-lg:flex">
                                                {statusCfg ? <StatusBadge label={statusCfg.label} /> : null}
                                                {showNhapKho && !trungChuyen ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => navigate(`/purchase-requests/create?bienTheId=${item.bienTheId}&khoId=${item.khoId}`)}
                                                        className="h-9 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground"
                                                    >
                                                        <PackagePlus className="size-4" aria-hidden="true" />
                                                        Yêu cầu nhập
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                            <span className="whitespace-nowrap text-slate-700">{item.tenKho}</span>
                                        </td>

                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <SoLuong value={onHand} className="font-semibold text-bo-foreground" />
                                        </td>

                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <SoLuong value={incoming} />
                                        </td>

                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <SoLuong value={outgoing} />
                                        </td>

                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <SoLuong value={freeToUse} className="font-semibold text-bo-foreground" />
                                        </td>

                                        <td className="px-3 py-3 text-right text-xs tabular-nums cam-ung:max-lg:hidden">
                                            {trungChuyen || item.mucTonToiThieu == null ? (
                                                <span className="text-bo-muted">—</span>
                                            ) : (
                                                <span className="font-semibold text-slate-600">{formatNumber(item.mucTonToiThieu)}</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-bold tabular-nums text-bo-foreground">{formatCurrency(giaTri)}</td>

                                        <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                            {statusCfg ? (
                                                <StatusBadge label={statusCfg.label} />
                                            ) : (
                                                <span className="text-bo-muted">—</span>
                                            )}
                                        </td>

                                        <td className="px-3 py-3 text-center cam-ung:max-lg:hidden">
                                            {showNhapKho && !trungChuyen && (
                                                <RowActions>
                                                    <RowActionButton
                                                        icon={PackagePlus}
                                                        label="Tạo yêu cầu nhập kho"
                                                        onClick={() => navigate(`/purchase-requests/create?bienTheId=${item.bienTheId}&khoId=${item.khoId}`)}
                                                    />
                                                </RowActions>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </>
                )}
            </TableShell>
        </PageContainer>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
/** Bốn số tồn + giá trị của một dòng (máy chủ cũ trả tên trường khác nên đọc cả hai). */
function soTon(item) {
    const onHand = Number(item.onHand ?? item.tongSoLuongKhaDung ?? 0);
    const incoming = Number(item.incoming ?? item.tongSoLuongChoNhan ?? 0);
    const outgoing = Number(item.outgoing ?? item.tongSoLuongChoDuaHang ?? 0);
    const freeToUse = item.freeToUse != null ? Number(item.freeToUse) : (onHand + incoming - outgoing);
    const giaTri = Number(item.tongGiaTri ?? item.giaTriTonKho ?? 0);
    return { onHand, incoming, outgoing, freeToUse, giaTri };
}

/** Số lượng trong bảng: chữ thường (không ô màu); 0 hiện xám, số âm hiện đỏ để nổi lên. */
function SoLuong({ value, className = "text-slate-700" }) {
    const so = Number(value);
    const mau = so < 0 ? "font-semibold text-bo-danger" : so === 0 ? "text-bo-muted" : className;
    return <span className={mau}>{formatNumber(so)}</span>;
}

function SummaryItem({ label, value, valueClass = "text-bo-foreground" }) {
    return (
        <div className="flex items-baseline gap-2 max-md:justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-bo-muted">{label}:</span>
            <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
        </div>
    );
}

function Divider() {
    return <span className="h-4 w-px bg-bo-border" aria-hidden="true" />;
}
