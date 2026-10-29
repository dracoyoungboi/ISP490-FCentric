import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, Plus, SearchX, TriangleAlert } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { getKhoList } from "@/services/khoService";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
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
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import {
    LOC_TRANG_THAI_THEO_DUONG_DAN,
    PHIEU_CHUYEN_KHO_STATUS,
    PHIEU_CHUYEN_KHO_TABS,
    TT_CHUYEN,
    getPhieuChuyenKhoStatus,
} from "@/constants/phieuChuyenKho";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { formatDate, formatNumber } from "@/utils/formatters";
import { getApiErrorMessage } from "@/utils/apiError";
import { gioNgayNgan, treBaoLau } from "@/components/chuyen-kho/hienThiChuyenKho";

const TAB_MAS = PHIEU_CHUYEN_KHO_TABS.map((t) => t.ma);
const TAB_MAC_DINH = "tat-ca";
const tabMayChu = (ma) => PHIEU_CHUYEN_KHO_TABS.find((t) => t.ma === ma)?.tab ?? "TAT_CA";

const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const TD = "px-4 py-3 align-top";

const LOC_TRANG_THAI = [
    { value: "", label: "Tất cả trạng thái" },
    ...Object.values(TT_CHUYEN).map((ma) => ({ value: ma, label: PHIEU_CHUYEN_KHO_STATUS[ma].label })),
];

/** Kho làm việc hiện tại (apiClient gửi qua header `kho_id`); đọc lỗi thì coi như chưa chọn. */
function docKhoLamViec() {
    try {
        return window.localStorage.getItem("selected_kho_id") ?? "";
    } catch {
        return "";
    }
}

/**
 * Danh sách phiếu chuyển kho nội bộ (màn B.6 của BA): tab Tất cả · Chờ duyệt · Đang vận chuyển · Trễ hẹn · Chờ xử lý
 * chênh lệch · Thiếu giấy đi đường (số trên tab do máy chủ đếm cùng bộ lọc), lọc theo số phiếu / số lệnh, kho xuất,
 * kho nhận, trạng thái. Quản lý Kho tổng xem toàn mạng lưới; người khác xem phiếu có kho làm việc là một bên.
 * Đường dẫn cũ `?trangThai=cho-xuat-hang` (Tổng quan) mở tab Tất cả lọc sẵn Đã duyệt.
 */
export default function PhieuChuyenKhoList() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);

    const [rows, setRows] = useState([]);
    const [soTheoTab, setSoTheoTab] = useState(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const requestIdRef = useRef(0);
    const [khoLamViec, setKhoLamViec] = useState(docKhoLamViec);
    const [dsKho, setDsKho] = useState([]);

    const [filters, setFilters] = useState(() => ({
        q: "",
        khoXuatId: "",
        khoNhapId: "",
        trangThai: LOC_TRANG_THAI_THEO_DUONG_DAN[searchParams.get("trangThai")] ?? "",
        page: 0,
        size: SO_DONG_MAC_DINH,
    }));
    const [tuKhoaInput, setTuKhoaInput] = useState("");

    useEffect(() => {
        const q = tuKhoaInput.trim();
        const timer = setTimeout(() => setFilters((p) => (p.q === q ? p : { ...p, q, page: 0 })), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [tuKhoaInput]);

    useEffect(() => {
        let conMo = true;
        getKhoList()
            .then((ds) => {
                if (conMo) setDsKho(ds.filter((k) => k.trangThai === 1 && k.maKho !== "KHO_TRANSIT"));
            })
            .catch(() => {});
        return () => {
            conMo = false;
        };
    }, []);

    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const res = await phieuChuyenKhoService.danhSach({
                tab: tabMayChu(tab),
                q: filters.q || undefined,
                khoXuatId: filters.khoXuatId || undefined,
                khoNhapId: filters.khoNhapId || undefined,
                trangThai: filters.trangThai || undefined,
                page: filters.page,
                size: filters.size,
            });
            if (requestId !== requestIdRef.current) return;
            const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
            if (trangCuoi != null) {
                setFilters((p) => ({ ...p, page: trangCuoi }));
                return;
            }
            setRows(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
            setSoTheoTab(res?.soTheoTab ?? null);
            setLoadError(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw error;
            setRows([]);
            setTotal(0);
            setSoTheoTab(null);
            // Câu của máy chủ (vd. "Chọn kho làm việc để xem phiếu chuyển kho") rõ hơn câu chung
            setLoadError(getApiErrorMessage(error, "Không thể tải danh sách phiếu chuyển kho. Vui lòng thử lại."));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
        // khoLamViec: apiClient gửi kho qua header, đổi kho thì tải lại
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, tab, khoLamViec]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    const capNhat = useTaiLaiDanhSach({ duLieu: rows, taiNgam: () => fetchData({ silent: true }), bat: !loading });

    const changeTab = (value) => {
        setTab(value);
        setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
    };

    const doiLoc = (khoa, giaTri) => setFilters((p) => ({ ...p, [khoa]: giaTri, page: 0 }));
    const coLoc = Boolean(tuKhoaInput.trim() || filters.khoXuatId || filters.khoNhapId || filters.trangThai);
    const xoaLoc = () => {
        setTuKhoaInput("");
        setFilters((p) => ({ ...p, q: "", khoXuatId: "", khoNhapId: "", trangThai: "", page: 0 }));
    };

    const luaChonKho = useMemo(() => dsKho.map((k) => ({ value: String(k.id), label: k.tenKho })), [dsKho]);

    const statusTabs = PHIEU_CHUYEN_KHO_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        count: loadError || !soTheoTab ? null : soTheoTab[t.tab] ?? 0,
        tone: t.canhBao ? "warning" : undefined,
    }));
    const tenTab = PHIEU_CHUYEN_KHO_TABS.find((t) => t.ma === tab)?.label;

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={
                    <Link to="/transfer-tickets/create">
                        <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                            <Plus className="size-4" />
                            Tạo yêu cầu chuyển
                        </Button>
                    </Link>
                }
            />

            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={<StatusTabs label="Lọc phiếu chuyển kho" tabs={statusTabs} value={tab} onChange={changeTab} />}
                        hasFilter={coLoc}
                        onClear={xoaLoc}
                    >
                        <KhoLamViecSelect onChange={(id) => setKhoLamViec(String(id))} />
                        <SearchInput
                            placeholder="Số phiếu, số lệnh..."
                            label="Số phiếu hoặc số lệnh điều động"
                            value={tuKhoaInput}
                            onChange={(e) => setTuKhoaInput(e.target.value)}
                            onClear={() => setTuKhoaInput("")}
                            className="sm:w-[240px]"
                        />
                        <FilterSelect
                            label="Kho xuất"
                            value={filters.khoXuatId}
                            options={[{ value: "", label: "Kho xuất: Tất cả" }, ...luaChonKho]}
                            onChange={(v) => doiLoc("khoXuatId", v)}
                            onClear={() => doiLoc("khoXuatId", "")}
                            clearLabel="Bỏ lọc kho xuất"
                            className="sm:w-[190px]"
                        />
                        <FilterSelect
                            label="Kho nhận"
                            value={filters.khoNhapId}
                            options={[{ value: "", label: "Kho nhận: Tất cả" }, ...luaChonKho]}
                            onChange={(v) => doiLoc("khoNhapId", v)}
                            onClear={() => doiLoc("khoNhapId", "")}
                            clearLabel="Bỏ lọc kho nhận"
                            className="sm:w-[190px]"
                        />
                        <FilterSelect
                            label="Trạng thái"
                            value={filters.trangThai}
                            options={LOC_TRANG_THAI}
                            onChange={(v) => doiLoc("trangThai", v)}
                            onClear={() => doiLoc("trangThai", "")}
                            clearLabel="Bỏ lọc trạng thái"
                            className="sm:w-[190px]"
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
                    <ErrorState description={loadError} onRetry={() => fetchData()} />
                ) : rows.length === 0 ? (
                    coLoc ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy phiếu chuyển kho phù hợp"
                            description="Thử đổi số phiếu, kho hoặc trạng thái đang lọc."
                            action={
                                <Button variant="outline" onClick={xoaLoc} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={ClipboardList}
                            title={`Không có phiếu chuyển nào ở mục "${tenTab}"`}
                            description="Chọn tab Tất cả để xem mọi phiếu chuyển đi và chuyển đến."
                            action={
                                <Button variant="outline" onClick={() => changeTab(TAB_MAC_DINH)} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState icon={ClipboardList} title="Chưa có phiếu chuyển kho" description="Kho đang chọn chưa có phiếu chuyển đi hoặc chuyển đến." />
                    )
                ) : (
                    <table className="w-full min-w-[960px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH} text-left`}>Số phiếu</th>
                                <th className={`${TH} text-left`}>Tuyến</th>
                                <th className={`${TH} text-left`}>Lệnh điều động</th>
                                <th className={`${TH} text-left`}>Trạng thái</th>
                                <th className={`${TH} text-left`}>Giấy đi đường</th>
                                <th className={`${TH} text-left`}>Dự kiến đến</th>
                                <th className={`${TH} text-right`}>Số lượng</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {rows.map((p) => (
                                <DongPhieu key={p.id} p={p} onMo={() => navigate(`/transfer-tickets/${p.id}`)} />
                            ))}
                        </tbody>
                    </table>
                )}
            </TableShell>
        </PageContainer>
    );
}

function DongPhieu({ p, onMo }) {
    const st = getPhieuChuyenKhoStatus(p.trangThai, p.coChenhLech);
    const moBangPhim = (e) => {
        if (e.key === "Enter") onMo();
    };
    return (
        <tr onClick={onMo} onKeyDown={moBangPhim} tabIndex={0} className="cursor-pointer transition-colors hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:outline-none">
            <td className={TD}>
                <div className="whitespace-nowrap font-semibold text-bo-primary">{p.soPhieuChuyen}</div>
                <div className="text-xs tabular-nums text-bo-muted">{formatDate(p.ngayTao)}</div>
                {p.soPhieuGoc ? <div className="text-xs text-bo-muted">giao bù cho {p.soPhieuGoc}</div> : null}
            </td>
            <td className={`${TD} text-bo-foreground`}>
                {p.khoXuatTen} <span className="text-bo-muted">→</span> {p.khoNhapTen}
            </td>
            <td className={`${TD} whitespace-nowrap font-mono text-[13px] text-bo-foreground`}>
                {p.soLenhDieuDong ?? <span className="font-sans text-bo-muted">—</span>}
            </td>
            <td className={TD}>
                <StatusBadge quyTrinh="chuyenKho" label={st.label} />
            </td>
            <td className={TD}>
                {p.soPhieuXknb ? (
                    <span className="whitespace-nowrap font-mono text-[13px] text-bo-foreground">
                        {p.kyHieuXknb} · {p.soPhieuXknb}
                    </span>
                ) : p.thieuXknb ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-medium text-bo-tt-chu-y-chu">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        Chưa có số
                    </span>
                ) : (
                    <span className="text-bo-muted">—</span>
                )}
            </td>
            <td className={`${TD} whitespace-nowrap tabular-nums`}>
                {p.trangThai === TT_CHUYEN.HOAN_TAT && p.ngayThucTeDen ? (
                    <span className="text-bo-foreground">{gioNgayNgan(p.ngayThucTeDen)}</span>
                ) : p.ngayDuKienDen ? (
                    p.tre ? (
                        <span className="font-semibold text-bo-tt-chu-y-chu">
                            {gioNgayNgan(p.ngayDuKienDen)} · {treBaoLau(p.ngayDuKienDen)}
                        </span>
                    ) : (
                        <span className="text-bo-foreground">{gioNgayNgan(p.ngayDuKienDen)}</span>
                    )
                ) : (
                    <span className="text-bo-muted">—</span>
                )}
            </td>
            <td className={`${TD} text-right tabular-nums text-bo-foreground`}>{formatNumber(p.tongSoLuong)}</td>
        </tr>
    );
}
