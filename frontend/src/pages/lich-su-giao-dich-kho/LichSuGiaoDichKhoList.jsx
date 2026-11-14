// src/pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList.jsx
import { createElement, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
    History, ArrowDownToLine, ArrowUpFromLine,
    ArrowLeftRight, SlidersHorizontal, Warehouse, Eye, MoveRight,
    CalendarDays, User2, FileText, Hash, Package, SearchX, X,
    MapPin, ArrowRight, Info, ReceiptText, ChevronRight,
} from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { getLichSuGiaoDichKho, getChiTietLichSu } from "@/services/lichSuGiaoDichKhoService";
import { getMineKhoList } from "@/services/khoService";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatDateTime, formatNumber } from "@/utils/formatters";
import { viTriKe } from "@/components/chuyen-ke/nhanKe";
import { t, tDuLieu } from "@/i18n";

// ── Constants ─────────────────────────────────────────────────────────────
// "chuyen_kho" giữ để hiện nhãn cho dữ liệu cũ (nếu có); backend hiện chỉ ghi 3 loại còn lại.
// Loại giao dịch là phân loại, không phải trạng thái: hiện chữ thường kèm icon xám; chiều nhập / xuất đọc ở dấu +/− của cột Số lượng.
const LOAI_GIAO_DICH_CONFIG = {
    nhap_kho:   { label: t("Nhập kho"),   icon: ArrowDownToLine },
    xuat_kho:   { label: t("Xuất kho"),   icon: ArrowUpFromLine },
    chuyen_kho: { label: t("Chuyển kho"), icon: ArrowLeftRight },
    dieu_chinh: { label: t("Điều chỉnh"), icon: SlidersHorizontal },
    // Chuyển kệ nội bộ (phiếu MV): đổi chỗ trong kho, tồn kho không đổi — số lượng hiện không dấu
    chuyen_ke_noi_bo: { label: t("Chuyển kệ"), icon: MoveRight },
};
const KHONG_DOI_TON = new Set(["chuyen_ke_noi_bo"]);

// Tab theo LOẠI giao dịch (bố cục A+G) — mã tab trên URL ?loai=; `loai` là giá trị loaiGiaoDich
const LOAI_TABS = [
    { value: "tat-ca",     label: t("Tất cả"),                             loai: null         },
    { value: "nhap-kho",   label: LOAI_GIAO_DICH_CONFIG.nhap_kho.label,   loai: "nhap_kho"   },
    { value: "xuat-kho",   label: LOAI_GIAO_DICH_CONFIG.xuat_kho.label,   loai: "xuat_kho"   },
    { value: "dieu-chinh", label: LOAI_GIAO_DICH_CONFIG.dieu_chinh.label, loai: "dieu_chinh" },
    { value: "chuyen-ke",  label: LOAI_GIAO_DICH_CONFIG.chuyen_ke_noi_bo.label, loai: "chuyen_ke_noi_bo" },
];
const LOAI_TAB_VALUES = LOAI_TABS.map((tab) => tab.value);
const TAB_MAC_DINH = "tat-ca";

// Dòng thuộc tab nào: dùng chung cho bảng và số trên tab (R1)
const matchLoai = (item, tab) => {
    const loai = LOAI_TABS.find((x) => x.value === tab)?.loai;
    return !loai || item.loaiGiaoDich === loai;
};

const matchSearch = (item, search) => {
    const q = search.toLowerCase().trim();
    return !q ||
        item.tenSanPham?.toLowerCase().includes(q) ||
        item.maSku?.toLowerCase().includes(q) ||
        item.maLo?.toLowerCase().includes(q) ||
        item.tenKho?.toLowerCase().includes(q) ||
        (item.tenKho && tDuLieu(item.tenKho).toLowerCase().includes(q)) ||
        item.nguoiDungTen?.toLowerCase().includes(q) ||
        // Dòng chuyển kệ: tìm được theo mã kệ nguồn, kệ đích, mã phiếu MV
        item.keNguon?.ma?.toLowerCase().includes(q) ||
        item.keDich?.ma?.toLowerCase().includes(q) ||
        item.maChungTu?.toLowerCase().includes(q);
};

// Bộ lọc kỳ, kho mở từ Báo cáo nhập xuất (?tu=yyyy-MM-dd&den=yyyy-MM-dd&kho=id): ngày theo giờ máy người xem
const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const hai = (n) => String(n).padStart(2, "0");
const ngayCua = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`; };
const ngayVN = (s) => s.split("-").reverse().join("/");

const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Tiêu đề cột của bảng (căn lề theo kiểu dữ liệu: số căn phải, thao tác căn giữa).
// Máy tính bảng dọc (cảm ứng): ẩn STT, Loại, SKU, Lô hàng, Người thực hiện — đưa thành dòng phụ trong ô Ngày / Sản phẩm / Kho
const TABLE_COLUMNS = [
    { label: t("STT"),             className: "w-14 text-left cam-ung:max-lg:hidden" },
    { label: t("Ngày giao dịch"),  className: "text-left" },
    { label: t("Loại"),            className: "text-left cam-ung:max-lg:hidden" },
    { label: t("Sản phẩm"),        className: "text-left" },
    { label: "SKU",             className: "text-left cam-ung:max-lg:hidden" },
    { label: t("Lô hàng"),         className: "text-left cam-ung:max-lg:hidden" },
    { label: t("Kho"),             className: "text-left" },
    { label: t("Số lượng"),        className: "text-right tabular-nums" },
    { label: t("Người thực hiện"), className: "text-left cam-ung:max-lg:hidden" },
    { label: t("Thao tác"),        className: "text-center" },
];

/** Số lượng hiển thị có dấu: xuất kho luôn âm; màu xanh khi tăng, đỏ khi giảm (dùng chung bảng và thẻ điện thoại). */
function soLuongCoDau(item) {
    const soLuong = Number(item.soLuong);
    const isXuatKho = item.loaiGiaoDich === "xuat_kho";
    const displaySoLuong = isXuatKho ? -Math.abs(soLuong) : soLuong;
    if (KHONG_DOI_TON.has(item.loaiGiaoDich)) return { displaySoLuong: Math.abs(soLuong), soLuongColor: "text-slate-700", soLuongPrefix: "" };
    const soLuongColor =
        displaySoLuong > 0 ? "text-bo-success" :
        displaySoLuong < 0 ? "text-bo-danger" :
        "text-slate-700";
    const soLuongPrefix = displaySoLuong > 0 ? "+" : displaySoLuong < 0 ? "-" : "";
    return { displaySoLuong, soLuongColor, soLuongPrefix };
}

// ── Loại giao dịch ────────────────────────────────────────────────────────
function LoaiGiaoDich({ loai }) {
    const cfg = LOAI_GIAO_DICH_CONFIG[loai] ?? { label: loai || "—", icon: null };
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700">
            {Icon ? <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" /> : null}
            {cfg.label}
        </span>
    );
}

/** Dòng chuyển kệ: "kệ nguồn → kệ đích" một dòng chữ đơn sắc như SKU, lô (máy chủ tách từ câu sổ; dòng khác không có). */
function LoTrinhKe({ item, className = "" }) {
    if (!item.keNguon?.ma || !item.keDich?.ma) return null;
    // Trình đọc màn hình đọc câu đủ chiều đi; phần mã kệ nhìn thấy thì ẩn khỏi trình đọc. Mã quá dài thì cắt "…" (thẻ điện thoại không tràn)
    return (
        <span className={`flex w-fit max-w-full min-w-0 items-center gap-1 whitespace-nowrap font-mono text-xs text-slate-600 ${className}`}>
            <span className="sr-only">{t("Từ kệ {{tu}} sang kệ {{den}}", { tu: item.keNguon.ma, den: item.keDich.ma })}</span>
            <MapPin className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 truncate" aria-hidden="true" title={item.keNguon.ma}>{item.keNguon.ma}</span>
            <ArrowRight className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 truncate font-semibold text-slate-700" aria-hidden="true" title={item.keDich.ma}>{item.keDich.ma}</span>
        </span>
    );
}

/** Một kệ trong hộp chi tiết: nhãn, mã kệ, khu · dãy · hàng · tầng. */
function OKe({ nhan, ke, dich = false }) {
    const viTri = viTriKe(ke);
    return (
        <div className={`min-w-0 flex-1 rounded-lg border px-3.5 py-3 ${dich ? "border-bo-primary/30 bg-bo-primary-soft/50" : "border-bo-border bg-white"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-bo-muted">{nhan}</p>
            <p className={`mt-1 break-all font-mono text-lg font-semibold ${dich ? "text-bo-primary-strong" : "text-bo-heading"}`}>{ke.ma}</p>
            {viTri ? <p className="line-clamp-2 break-words text-xs text-bo-muted" title={viTri}>{viTri}</p> : null}
        </div>
    );
}

// ── Field helper ──────────────────────────────────────────────────────────
function LightField({ icon: Icon, label, value, mono = false }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-bo-muted">{label}</span>
            <div className="flex items-center gap-1.5">
                {createElement(Icon, { className: "size-3.5 shrink-0 text-bo-muted" })}
                <span className={`text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>
                    {value || "—"}
                </span>
            </div>
        </div>
    );
}

// ── Detail Modal ──────────────────────────────────────────────────────────
function DetailModal({ open, onClose, item, loading }) {
    const soLuong = Number(item?.soLuong ?? 0);
    const isXuatKho = item?.loaiGiaoDich === "xuat_kho";
    const khongDoiTon = KHONG_DOI_TON.has(item?.loaiGiaoDich);
    // Chuyển kệ: ô giữa ghi số đã đổi kệ (không dấu, màu trung tính) — trước = sau vì tồn kho không đổi
    const displaySoLuong = isXuatKho ? -Math.abs(soLuong) : khongDoiTon ? Math.abs(soLuong) : soLuong;
    const soLuongColor  = khongDoiTon ? "text-slate-700" : displaySoLuong > 0 ? "text-bo-success" : displaySoLuong < 0 ? "text-bo-danger" : "text-slate-600";
    const soLuongBg     = khongDoiTon ? "bg-bo-surface-subtle" : displaySoLuong > 0 ? "bg-bo-success-soft" : displaySoLuong < 0 ? "bg-bo-danger-soft" : "bg-bo-surface-subtle";
    const soLuongPrefix = khongDoiTon ? "" : displaySoLuong > 0 ? "+" : displaySoLuong < 0 ? "-" : "";
    // Dòng chuyển kệ đọc được lộ trình: ô Phiếu chuyển kệ (mở phiếu) thay mã tham chiếu thô, khối Kệ nguồn → Kệ đích
    // thay ba ô Trước / Đổi kệ / Sau, bỏ ghi chú máy tự ghi. Không tách được thì hiện như cũ.
    const laChuyenKe = khongDoiTon && Boolean(item?.keNguon?.ma && item?.keDich?.ma);
    const linkPhieu = laChuyenKe && item.maChungTu
        ? `/warehouse/bin-moves/history?${new URLSearchParams({ ...(item.khoId ? { khoId: String(item.khoId) } : {}), tim: item.maChungTu })}`
        : null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* grid-cols-[minmax(0,1fr)]: DialogContent là lưới cột tự giãn — chữ không xuống dòng (vị trí kệ dài) sẽ đẩy cột
                rộng hơn hộp và bị cắt mép phải; khóa cột bằng bề ngang hộp để chữ dài tự cắt "…" */}
            <DialogContent className="max-w-lg grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-bo-border bg-bo-surface p-0 shadow-lg [&>button]:text-slate-500 [&>button]:hover:text-slate-700">

                {/* ── Header ── (chừa chỗ bên phải cho nút đóng ở mọi cỡ màn, loại giao dịch không đè lên nút) */}
                <div className="flex items-center justify-between gap-3 border-b border-bo-border bg-bo-surface-subtle pb-4 pl-5 pr-14 pt-5">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-bo-primary-soft">
                            <History className="size-4 text-bo-primary" />
                        </span>
                        {t("Chi tiết giao dịch")} {item ? (
                            <span className="font-mono text-bo-primary">#{item.id}</span>
                        ) : ""}
                    </DialogTitle>
                    {item && <LoaiGiaoDich loai={item.loaiGiaoDich} />}
                </div>

                {loading ? (
                    <LoadingState className="min-h-48 bg-bo-surface" label={t("Đang tải chi tiết giao dịch")} />
                ) : item ? (
                    <div className="space-y-4 bg-bo-surface px-5 py-4">

                        {/* Ngày giao dịch */}
                        <div className="flex items-center gap-2 rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-2.5 text-sm text-slate-700">
                            <CalendarDays className="size-4 shrink-0 text-bo-muted" />
                            <span className="font-medium">{formatDateTime(item.ngayGiaoDich)}</span>
                        </div>

                        {/* Grid fields */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-4">
                            <LightField icon={Package}      label={t("Sản phẩm")}        value={item.tenSanPham} />
                            <LightField icon={Hash}         label="SKU"             value={item.maSku} mono />
                            <LightField icon={FileText}     label={t("Lô hàng")}         value={item.maLo} mono />
                            <LightField icon={Warehouse}    label={t("Kho")}             value={item.tenKho ? tDuLieu(item.tenKho) : null} />
                            <LightField icon={User2}        label={t("Người thực hiện")} value={item.nguoiDungTen} />
                            {laChuyenKe ? (
                                <div className="flex min-w-0 flex-col gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-bo-muted">{t("Phiếu chuyển kệ")}</span>
                                    {linkPhieu ? (
                                        <Link
                                            to={linkPhieu}
                                            className="inline-flex w-fit items-center gap-1.5 rounded-sm font-mono text-sm font-semibold text-bo-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                                            title={t("Mở phiếu ở Lịch sử chuyển kệ")}
                                        >
                                            <ReceiptText className="size-3.5 shrink-0" aria-hidden="true" />
                                            {item.maChungTu}
                                            {/* Mở ngay trong thẻ này (không phải thẻ mới) nên dùng mũi tên, không dùng icon "mở ngoài" */}
                                            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                                        </Link>
                                    ) : (
                                        <span className="text-sm font-medium text-slate-800">—</span>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <LightField icon={FileText}     label={t("Loại tham chiếu")} value={item.loaiThamChieu} />
                                    {item.idThamChieu && (
                                        <LightField icon={Hash}     label={t("ID tham chiếu")}   value={`#${item.idThamChieu}`} mono />
                                    )}
                                </>
                            )}
                            {item.tenKhoChuyenDen && (
                                <LightField icon={ArrowLeftRight} label={t("Kho chuyển đến")} value={tDuLieu(item.tenKhoChuyenDen)} />
                            )}
                        </div>

                        {laChuyenKe ? (
                            /* Chuyển kệ: Kệ nguồn → số lượng → Kệ đích, kèm câu tồn lô giữ nguyên */
                            <div>
                                <div className="flex items-stretch gap-2">
                                    <OKe nhan={t("Kệ nguồn")} ke={item.keNguon} />
                                    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-1">
                                        <span className="text-xl font-bold tabular-nums text-slate-700">{formatNumber(Math.abs(displaySoLuong))}</span>
                                        <ArrowRight className="size-5 text-slate-400" aria-hidden="true" />
                                        <span className="text-[11px] text-bo-muted">{t("sản phẩm", { count: Math.abs(soLuong) })}</span>
                                    </div>
                                    <OKe nhan={t("Kệ đích")} ke={item.keDich} dich />
                                </div>
                                <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-5 text-bo-muted">
                                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                    <span>
                                        {t("Chỉ đổi chỗ trong kho. Tồn của lô ở {{kho}} giữ nguyên {{so}}.", {
                                            kho: item.tenKho ? tDuLieu(item.tenKho) : "—",
                                            so: formatNumber(item.soLuongSau ?? 0),
                                        })}
                                    </span>
                                </p>
                            </div>
                        ) : (
                        /* Số lượng 3 ô */
                        <div className="grid grid-cols-3 divide-x divide-bo-border overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                            {[
                                { label: t("TRƯỚC"),    value: item.soLuongTruoc ?? 0, color: "text-slate-700", bg: "bg-white",    prefix: "" },
                                { label: khongDoiTon ? t("ĐỔI KỆ") : t("THAY ĐỔI"), value: Math.abs(displaySoLuong), color: soLuongColor,     bg: soLuongBg,     prefix: soLuongPrefix },
                                { label: t("SAU"),      value: item.soLuongSau ?? 0,   color: "text-slate-700", bg: "bg-white",    prefix: "" },
                            ].map(({ label, value, color, bg, prefix }) => (
                                <div key={label} className={`flex flex-col items-center py-4 ${bg}`}>
                                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-bo-muted">{label}</span>
                                    <span className={`text-xl font-bold ${color}`}>{prefix}{value}</span>
                                </div>
                            ))}
                        </div>
                        )}

                        {/* Ghi chú (dòng chuyển kệ: câu máy tự ghi, đã hiện ở khối kệ và ô phiếu) */}
                        {item.ghiChu && !laChuyenKe && (
                            <div className="rounded-lg border border-bo-warning/20 bg-bo-warning-soft px-4 py-3">
                                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-bo-warning">{t("Ghi chú")}</p>
                                <p className="text-sm text-slate-700">{item.ghiChu}</p>
                            </div>
                        )}

                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function LichSuGiaoDichKhoList() {
    const [data,           setData]           = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [loadError,      setLoadError]      = useState(false);
    const [search,         setSearch]         = useState("");
    const [pageNumber,     setPageNumber]      = useState(0);
    const [pageSize,       setPageSize]       = useState(SO_DONG_MAC_DINH);
    const [selectedId,     setSelectedId]     = useState(null);
    const [chiTiet,        setChiTiet]        = useState(null);
    const [loadingDetail,  setLoadingDetail]  = useState(false);
    // Kho mình có quyền (null = chưa tải): lọc dòng + nhãn "Nơi làm việc" ở đầu trang
    const [khoCuaToi,      setKhoCuaToi]      = useState(null);
    const myWarehouseIds = useMemo(() => (khoCuaToi ?? []).map((k) => k.id), [khoCuaToi]);
    const requestIdRef = useRef(0);

    // Tab loại giao dịch trên URL (?loai=nhap-kho | xuat-kho | dieu-chinh)
    const [filterLoai, setFilterLoai] = useTabTrenUrl(LOAI_TAB_VALUES, TAB_MAC_DINH, { ten: "loai" });

    // Kỳ, kho từ liên kết "Xem từng giao dịch" của Báo cáo nhập xuất
    const [searchParams, setSearchParams] = useSearchParams();
    const locTu = NGAY_RE.test(searchParams.get("tu") ?? "") ? searchParams.get("tu") : "";
    const locDen = NGAY_RE.test(searchParams.get("den") ?? "") ? searchParams.get("den") : "";
    const locKho = /^\d+$/.test(searchParams.get("kho") ?? "") ? Number(searchParams.get("kho")) : null;
    const coLocBaoCao = Boolean(locTu || locDen || locKho);
    const boLocBaoCao = () => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            ["tu", "den", "kho"].forEach((k) => next.delete(k));
            return next;
        }, { replace: true });
        setPageNumber(0);
    };

    // Phân quyền — giống PhieuChuyenKhoDetail
    const role     = localStorage.getItem("role");
    const isAdmin  = role === "quan_tri_vien";

    // ── Fetch ──────────────────────────────────────────────────────────
    // Tải lịch sử + danh sách kho mình có quyền (cùng pattern PhieuChuyenKhoDetail) cùng lúc,
    // để người không phải quản trị viên không thấy bảng rỗng tạm thời khi kho chưa tải xong.
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng và trang đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const [list, listKho] = await Promise.all([
                getLichSuGiaoDichKho(),
                getMineKhoList().catch((err) => {
                    // Quản trị viên xem mọi kho nên không cần danh sách này (giữ như cũ: chỉ ghi log)
                    if (!isAdmin) throw err;
                    console.error("Lỗi khi tải danh sách kho phân quyền:", err);
                    return [];
                }),
            ]);
            if (requestId !== requestIdRef.current) return;
            setData(list ?? []);
            setKhoCuaToi(listKho ?? []);
            setLoadError(false);
            if (!silent) setPageNumber(0);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw error;
            // Không giữ dòng + tổng số của lần tải trước (R9). Giữ lỗi để ô lỗi phân biệt 403 (không có quyền: không
            // "Thử lại", không thông báo nhanh)
            setData([]);
            setLoadError(error);
            if (error?.response?.status !== 403) toast.error(t("Không thể tải lịch sử giao dịch kho"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [isAdmin]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: sổ ghi liên tục từ POS, nhập, xuất, chuyển kho
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => fetchData({ silent: true }),
        bat: !loading,
    });

    // ── Filter ─────────────────────────────────────────────────────────
    // Phân quyền lọc danh sách: admin thấy tất, còn lại chỉ thấy kho mình có quyền
    const visibleData = useMemo(() => {
        const theoQuyen = isAdmin ? data : data.filter((item) => myWarehouseIds.includes(item.khoId));
        if (!coLocBaoCao) return theoQuyen;
        return theoQuyen.filter((item) => {
            const ngay = ngayCua(item.ngayGiaoDich);
            return (!locTu || ngay >= locTu) && (!locDen || ngay <= locDen) && (locKho == null || item.khoId === locKho);
        });
    }, [data, myWarehouseIds, isAdmin, coLocBaoCao, locTu, locDen, locKho]);

    const tenKhoLoc = locKho == null ? null : data.find((item) => item.khoId === locKho)?.tenKho ?? `Kho #${locKho}`;

    // Lọc mọi thứ trừ loại (để đếm số trên tab), rồi lọc loại cho bảng
    const searched = useMemo(
        () => visibleData.filter((item) => matchSearch(item, search)),
        [visibleData, search]
    );
    const filtered = useMemo(
        () => searched.filter((item) => matchLoai(item, filterLoai)),
        [searched, filterLoai]
    );

    // Số trên tab = số dòng thấy khi bấm tab, theo từ khóa đang tìm (R1); đang tải / lỗi thì không hiện (R9)
    const loaiTabs = useMemo(
        () => LOAI_TABS.map((tab) => ({
            value: tab.value,
            label: tab.label,
            count: loading || loadError ? null : searched.filter((item) => matchLoai(item, tab.value)).length,
        })),
        [searched, loading, loadError]
    );

    // ── Pagination ─────────────────────────────────────────────────────
    const totalElements = filtered.length;
    const totalPages    = Math.max(1, Math.ceil(totalElements / pageSize));
    const safePage      = Math.min(pageNumber, totalPages - 1);
    const pageItems     = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const handlePageChange = (p) => { if (p >= 0 && p < totalPages) setPageNumber(p); };

    // Đổi tab / từ khóa: về trang đầu
    const changeTab = (value) => { setFilterLoai(value); setPageNumber(0); };
    const changeSearch = (value) => { setSearch(value); setPageNumber(0); };
    // "Xóa lọc" chỉ xóa từ khóa, giữ tab loại đang chọn
    const handleClearSearch = () => changeSearch("");

    // ── Detail ─────────────────────────────────────────────────────────
    const handleViewDetail = async (item) => {
        // Phân quyền: admin luôn xem được; còn lại phải thuộc kho đó
        const hasPermission = isAdmin || myWarehouseIds.includes(item.khoId);
        if (!hasPermission) {
            toast.error(t("Bạn không có quyền xem chi tiết giao dịch này"));
            return;
        }
        setSelectedId(item.id);
        setChiTiet(null);
        setLoadingDetail(true);
        try {
            const detail = await getChiTietLichSu(item.id);
            setChiTiet(detail);
        } catch {
            toast.error(t("Không thể tải chi tiết"));
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleCloseModal = () => { setSelectedId(null); setChiTiet(null); };

    const currentLoaiLabel = LOAI_TABS.find((x) => x.value === filterLoai)?.label;

    return (
        <PageContainer fill className="space-y-4">

            <DetailModal open={!!selectedId} onClose={handleCloseModal} item={chiTiet} loading={loadingDetail} />

            {/* Phạm vi (R3): mọi vai trò không phải quản trị viên đều lọc theo kho của mình (visibleData) — nhãn "Nơi làm việc" chung */}
            <ListPageHeader noiLamViec={isAdmin ? null : khoCuaToi} />

            {coLocBaoCao ? (
                <p className="-mt-2 flex flex-wrap items-center gap-2 text-sm text-bo-muted">
                    <span className="inline-flex items-center gap-1 rounded-full bg-bo-primary-soft py-0.5 pl-3 pr-1 font-medium text-bo-primary">
                        {[locTu || locDen ? `${locTu ? ngayVN(locTu) : "…"} – ${locDen ? ngayVN(locDen) : "…"}` : null, tenKhoLoc].filter(Boolean).join(" · ")}
                        <button type="button" onClick={boLocBaoCao} aria-label={t("Bỏ lọc kỳ, kho")} className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30">
                            <X className="size-3.5" aria-hidden="true" />
                        </button>
                    </span>
                    {t("Đang lọc theo kỳ, kho của Báo cáo nhập xuất")}
                </p>
            ) : null}

            {/* ── Table: tab loại giao dịch + tìm kiếm cùng một hàng ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label={t("Lọc giao dịch theo loại")}
                                tabs={loaiTabs}
                                value={filterLoai}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={Boolean(search.trim())}
                        onClear={handleClearSearch}
                    >
                        <SearchInput
                            label={t("Tìm kiếm")}
                            placeholder={t("Tìm theo sản phẩm, SKU, lô, kho, kệ, người thực hiện...")}
                            value={search}
                            onChange={(e) => changeSearch(e.target.value)}
                            onClear={handleClearSearch}
                            className="sm:w-[380px]"
                        />
                    </ListToolbar>
                }
                footer={!loading && !loadError ? (
                    <TablePagination
                        page={safePage}
                        size={pageSize}
                        total={totalElements}
                        onPageChange={handlePageChange}
                        onSizeChange={(size) => { setPageSize(size); setPageNumber(0); }}
                        capNhat={capNhat}
                    />
                ) : null}
            >
                {loading ? (
                    <LoadingState rows={6} label={t("Đang tải lịch sử giao dịch kho")} />
                ) : loadError ? (
                    <ErrorState
                        description={t("Không thể tải lịch sử giao dịch kho. Vui lòng thử lại.")}
                        error={loadError}
                        onRetry={() => fetchData()}
                    />
                ) : pageItems.length === 0 ? (
                    search.trim() ? (
                        <EmptyState
                            icon={SearchX}
                            title={t("Không tìm thấy giao dịch phù hợp")}
                            description={t("Thử đổi từ khóa tìm kiếm.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={handleClearSearch}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xóa lọc")}
                                </Button>
                            }
                        />
                    ) : filterLoai !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={History}
                            title={t("Không có giao dịch loại \"{{loai}}\"", { loai: currentLoaiLabel })}
                            description={t("Chọn tab Tất cả để xem mọi giao dịch kho.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xem tất cả")}
                                </Button>
                            }
                        />
                    ) : coLocBaoCao ? (
                        <EmptyState
                            icon={History}
                            title={t("Không có giao dịch trong kỳ, kho đã chọn")}
                            description={t("Bỏ lọc kỳ, kho để xem mọi giao dịch kho.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={boLocBaoCao}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Bỏ lọc")}
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title={t("Chưa có giao dịch kho")}
                            description={t("Các lần nhập kho, xuất kho và điều chỉnh tồn sẽ được ghi lại tại đây.")}
                        />
                    )
                ) : (
                    <>
                    {/* Điện thoại: mỗi giao dịch một thẻ, chạm thẻ mở chi tiết — sản phẩm + số lượng có dấu, loại · kho,
                        SKU · lô, ngày giờ · người thực hiện */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {pageItems.map((item) => {
                            const { displaySoLuong, soLuongColor, soLuongPrefix } = soLuongCoDau(item);
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleViewDetail(item)}
                                        className="flex w-full flex-col gap-1 px-4 py-3 text-left active:bg-bo-surface-subtle"
                                    >
                                        <span className="flex w-full items-start justify-between gap-3">
                                            <span className="line-clamp-2 min-w-0 font-semibold leading-5 text-bo-foreground">{item.tenSanPham || "—"}</span>
                                            <span className={`shrink-0 text-base font-bold leading-5 tabular-nums ${soLuongColor}`}>
                                                {soLuongPrefix}{formatNumber(Math.abs(displaySoLuong))}
                                            </span>
                                        </span>
                                        <span className="flex w-full min-w-0 items-center gap-1.5 text-[13px] text-bo-muted">
                                            <LoaiGiaoDich loai={item.loaiGiaoDich} />
                                            <span className="min-w-0 truncate">· {item.tenKho ? tDuLieu(item.tenKho) : "—"}</span>
                                        </span>
                                        <LoTrinhKe item={item} />
                                        <span className="flex w-full min-w-0 items-baseline gap-2 font-mono text-xs">
                                            <span className="shrink-0 font-semibold text-slate-700">{item.maSku || "—"}</span>
                                            <span className="min-w-0 truncate text-bo-muted">{item.maLo || "—"}</span>
                                        </span>
                                        <span className="w-full truncate text-[13px] tabular-nums text-bo-muted">
                                            {formatDateTime(item.ngayGiaoDich)} · {item.nguoiDungTen || "—"}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <table className="w-full min-w-[1080px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                {TABLE_COLUMNS.map((col) => (
                                    <th key={col.label} className={`${TH_CLASS} ${col.className}`}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {pageItems.map((item, index) => {
                                const { displaySoLuong, soLuongColor, soLuongPrefix } = soLuongCoDau(item);

                                return (
                                    <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">

                                        <td className="px-4 py-3.5 align-middle text-xs text-bo-muted cam-ung:max-lg:hidden">
                                            {safePage * pageSize + index + 1}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                                            <span className="text-xs text-bo-muted">{formatDateTime(item.ngayGiaoDich)}</span>
                                            <div className="mt-1 hidden cam-ung:max-lg:block">
                                                <LoaiGiaoDich loai={item.loaiGiaoDich} />
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle cam-ung:max-lg:hidden">
                                            <LoaiGiaoDich loai={item.loaiGiaoDich} />
                                        </td>

                                        <td className="max-w-[180px] px-4 py-3.5 align-middle cam-ung:max-lg:max-w-[220px]">
                                            <span className="font-semibold leading-snug text-bo-foreground">
                                                {item.tenSanPham || "—"}
                                            </span>
                                            <div className="mt-1 hidden flex-wrap gap-x-2 font-mono text-xs cam-ung:max-lg:flex">
                                                <span className="font-semibold text-slate-700">{item.maSku || "—"}</span>
                                                <span className="text-bo-muted">{item.maLo || "—"}</span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle cam-ung:max-lg:hidden">
                                            <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                                                {item.maSku || "—"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle cam-ung:max-lg:hidden">
                                            <span className="font-mono text-xs text-bo-muted">
                                                {item.maLo || "—"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="font-medium text-bo-foreground">{item.tenKho ? tDuLieu(item.tenKho) : "—"}</span>
                                            {/* PA A: kho và kệ cùng nói hàng nằm ở đâu — lộ trình kệ ngay dưới tên kho */}
                                            <LoTrinhKe item={item} className="mt-1" />
                                            <div className="mt-0.5 hidden text-xs text-bo-muted cam-ung:max-lg:block">{item.nguoiDungTen || "—"}</div>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle tabular-nums">
                                            <span className={`text-base font-bold ${soLuongColor}`}>
                                                {soLuongPrefix}{formatNumber(Math.abs(displaySoLuong))}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle cam-ung:max-lg:hidden">
                                            <span className="font-medium text-bo-foreground">{item.nguoiDungTen || "—"}</span>
                                        </td>

                                        <td className="px-4 py-3.5 text-center align-middle">
                                            {/* Máy tính bảng dọc (cảm ứng): nút xem 44px cho dễ chạm */}
                                            <RowActions>
                                                <RowActionButton
                                                    icon={Eye}
                                                    label={t("Xem chi tiết")}
                                                    onClick={() => handleViewDetail(item)}
                                                />
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
        </PageContainer>
    );
}
