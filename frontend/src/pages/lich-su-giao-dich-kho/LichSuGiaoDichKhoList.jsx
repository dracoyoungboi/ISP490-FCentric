// src/pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import {
    History, ArrowDownToLine, ArrowUpFromLine,
    ArrowLeftRight, SlidersHorizontal, Eye, MoveRight,
    Package, SearchX, X,
    MapPin, ArrowRight, ChevronRight,
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
import { formatDate, formatDateTime, formatNumber } from "@/utils/formatters";
import { viTriKe } from "@/components/chuyen-ke/nhanKe";
import { lamViecTaiKho, moDuocTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import { VAI_TRO_DON_BAN } from "@/components/backoffice/sidebar.config";
import { hasAnyRole } from "@/utils/roles";
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

/** Một kệ trong khối chuyển kệ: nhãn, mã kệ, khu · dãy · hàng · tầng. Kệ đích tô xanh. */
function OKe({ nhan, ke, dich = false }) {
    const viTri = viTriKe(ke);
    return (
        <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 ${dich ? "border-bo-primary/30 bg-bo-primary-soft" : "border-bo-border bg-bo-surface"}`}>
            <p className={`text-xs ${dich ? "text-bo-primary-strong" : "text-bo-muted"}`}>{nhan}</p>
            <p className={`mt-0.5 break-all font-mono text-base font-semibold ${dich ? "text-bo-primary-strong" : "text-bo-heading"}`}>{ke.ma}</p>
            {viTri ? <p className="mt-0.5 line-clamp-2 break-words text-xs text-slate-600" title={viTri}>{viTri}</p> : null}
        </div>
    );
}

// ── Hộp chi tiết ──────────────────────────────────────────────────────────

/** Việc làm ra dòng sổ (máy chủ trả mã nghiepVu): câu ngắn dưới chứng từ. Mã lạ thì không hiện. */
const NGHIEP_VU = {
    nhap_ncc: t("Nhập hàng từ nhà cung cấp"),
    nhap_tra_ve: t("Nhập hàng trả về kho"),
    khach_tra_tai_quay: t("Khách trả hàng tại quầy"),
    nhan_chuyen_kho: t("Nhận hàng chuyển đến"),
    nhan_chuyen_kho_chenh_lech: t("Nhận phần hàng đạt, phiếu chuyển có chênh lệch"),
    hoan_tra_chuyen_kho: t("Hàng về lại kho gửi vì phiếu chuyển bị hủy khi đang đi đường"),
    roi_trung_chuyen: t("Hàng rời kho trung chuyển để nhập vào kho nhận"),
    hang_di_duong: t("Hàng chuyển kho đang đi đường"),
    xuat_chuyen_kho: t("Xuất hàng chuyển sang kho khác"),
    ban_tai_quay: t("Bán tại quầy"),
    xuat_don_ban: t("Xuất hàng giao đơn bán"),
    kiem_ke: t("Điều chỉnh theo số đếm kiểm kê"),
    chenh_lech_chuyen_kho: t("Ghi giảm hàng thiếu, hỏng khi nhận chuyển kho"),
};

/** Tên chứng từ chính kèm mã. */
const TEN_CHUNG_TU = {
    phieu_nhap: (ma) => t("Phiếu nhập {{ma}}", { ma }),
    phieu_xuat: (ma) => t("Phiếu xuất {{ma}}", { ma }),
    phieu_dieu_chinh: (ma) => t("Phiếu điều chỉnh {{ma}}", { ma }),
    phieu_chuyen_ke: (ma) => t("Phiếu chuyển kệ {{ma}}", { ma }),
};

/** Nhãn ô số lượng theo loại giao dịch. */
const NHAN_SO_LUONG = {
    nhap_kho: t("Số lượng nhập kho"),
    xuat_kho: t("Số lượng xuất kho"),
    dieu_chinh: t("Số lượng điều chỉnh"),
    chuyen_ke_noi_bo: t("Số lượng đổi kệ"),
};

const khoTheoId = (id) => (id ? { id } : null);

/**
 * Trang mở chứng từ, và kho làm việc cần đứng trước khi mở (trang phiếu nhập, xuất, đợt kiểm kê kiểm theo kho làm việc).
 * Null = hiện chữ: phiếu đã mất (không id), không có trang riêng (phiếu điều chỉnh của kiểm kê — mở qua đợt kiểm kê),
 * hoặc người xem không được phân kho của phiếu.
 */
function duongMo(ct, item) {
    if (!ct?.id) return null;
    const oKhoPhieu = moDuocTaiKho(khoTheoId(ct.khoId));
    const oKhoNhan = moDuocTaiKho(khoTheoId(ct.khoNhanId));
    switch (ct.loai) {
        case "phieu_nhap":
            return oKhoPhieu ? { to: `/goods-receipts/${ct.id}`, khoId: ct.khoId } : null;
        case "phieu_xuat":
            // PX chuyển kho xem được từ kho gửi lẫn kho nhận
            return oKhoPhieu || oKhoNhan ? { to: `/goods-issues/${ct.id}`, khoId: oKhoPhieu ? ct.khoId : ct.khoNhanId } : null;
        case "phieu_chuyen_kho":
            return oKhoPhieu || oKhoNhan ? { to: `/transfer-tickets/${ct.id}` } : null;
        case "phieu_dieu_chinh":
            return item.phieuChuyenKho && (oKhoPhieu || moDuocTaiKho(khoTheoId(item.phieuChuyenKho.khoId)) || moDuocTaiKho(khoTheoId(item.phieuChuyenKho.khoNhanId)))
                ? { to: `/transfer-tickets/adjustments/${ct.id}` } : null;
        case "dot_kiem_ke":
            return oKhoPhieu ? { to: `/stock-take/${ct.id}`, khoId: ct.khoId } : null;
        case "phieu_chuyen_ke": {
            const q = new URLSearchParams({ ...(item.khoId ? { khoId: String(item.khoId) } : {}), tim: ct.ma });
            return { to: `/warehouse/bin-moves/history?${q}` };
        }
        case "don_ban":
            return hasAnyRole(VAI_TRO_DON_BAN) ? { to: `/sales-orders/${ct.id}` } : null;
        default:
            return null;
    }
}

/** Mã chứng từ: mở được thì là liên kết (đứng sang đúng kho trước khi mở), không thì chữ thường. */
function ChungTu({ ct, item, chu }) {
    const duong = duongMo(ct, item);
    const noiDung = chu ?? ct.ma;
    if (!duong) return <span className="font-medium text-bo-foreground">{noiDung}</span>;
    return (
        <Link
            to={duong.to}
            onClick={duong.khoId ? () => lamViecTaiKho(khoTheoId(duong.khoId)) : undefined}
            className="inline-flex max-w-full items-start gap-1 rounded-sm font-semibold text-bo-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
            <span className="min-w-0 break-words">{noiDung}</span>
            {/* Mở ngay trong thẻ này nên dùng mũi tên, không dùng icon "mở ngoài" */}
            <ChevronRight className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
        </Link>
    );
}

/** Một dòng nhãn trái – giá trị phải. */
function Dong({ nhan, children }) {
    return (
        <>
            <dt className="text-bo-muted">{nhan}</dt>
            <dd className="min-w-0 break-words text-bo-foreground">{children}</dd>
        </>
    );
}

const MONO = "font-mono text-[13px]";
const hai2 = (n) => String(n).padStart(2, "0");

function DetailModal({ open, onClose, item, loading }) {
    const cfg = item ? LOAI_GIAO_DICH_CONFIG[item.loaiGiaoDich] : null;
    const IconLoai = cfg?.icon ?? History;
    const ngay = item?.ngayGiaoDich ? new Date(item.ngayGiaoDich) : null;
    const coNgay = ngay && !Number.isNaN(ngay.getTime());
    const { displaySoLuong, soLuongColor, soLuongPrefix } = item ? soLuongCoDau(item) : {};
    const khongDoiTon = KHONG_DOI_TON.has(item?.loaiGiaoDich);
    const laChuyenKe = khongDoiTon && Boolean(item?.keNguon?.ma && item?.keDich?.ma);
    const tenKho = item?.tenKho ? tDuLieu(item.tenKho) : "—";
    const coSo = (v) => v !== null && v !== undefined;
    const ct = item?.chungTu;
    const nghiepVu = item?.nghiepVu ? NGHIEP_VU[item.nghiepVu] : null;
    // Ghi chú chỉ hiện khi câu chưa được tách thành các dòng riêng (dữ liệu cũ, câu lạ). Máy chủ cũ không gửi cờ:
    // dòng chuyển kệ đã tách được thì vẫn ẩn như trước.
    const hienGhiChu = Boolean(item?.ghiChu) && !(item.ghiChuDaTach ?? laChuyenKe);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* grid-cols-[minmax(0,1fr)]: DialogContent là lưới cột tự giãn — chữ không xuống dòng sẽ đẩy cột rộng hơn hộp và bị
                cắt mép phải. max-h + cuộn: nhiều dòng trên màn thấp (điện thoại xoay ngang) vẫn đọc hết. */}
            <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto rounded-lg border border-bo-border bg-bo-surface p-0 shadow-lg [&>button]:top-3.5 [&>button]:right-3.5 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:text-slate-500 [&>button]:hover:text-slate-700 max-sm:[&>button]:top-2.5 max-sm:[&>button]:right-2 max-sm:[&>button]:size-10">

                {/* Đầu hộp: loại giao dịch + số giao dịch, thời gian (chừa chỗ bên phải cho nút đóng) */}
                <div className="flex items-center gap-3 pb-4 pl-4 pr-14 pt-4 sm:pl-5 sm:pt-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary" aria-hidden="true">
                        <IconLoai className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-base font-semibold leading-[22px] text-bo-heading">
                            {cfg ? cfg.label : item ? item.loaiGiaoDich || t("Chi tiết giao dịch") : t("Chi tiết giao dịch")}
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-[13px] leading-[18px] text-bo-muted">
                            {item
                                ? (coNgay
                                    ? t("Giao dịch #{{id}} · {{ngay}} lúc {{gio}}", { id: item.id, ngay: formatDate(ngay), gio: `${hai2(ngay.getHours())}:${hai2(ngay.getMinutes())}` })
                                    : t("Giao dịch #{{id}}", { id: item.id }))
                                : t("Đang tải chi tiết giao dịch")}
                        </DialogDescription>
                    </div>
                </div>

                {loading ? (
                    <LoadingState className="min-h-48 bg-bo-surface" label={t("Đang tải chi tiết giao dịch")} />
                ) : item ? (
                    <div className="flex flex-col gap-4 px-4 pb-4 sm:gap-5 sm:px-5 sm:pb-5">

                        {/* Khối số: số lượng (to, có dấu) | tồn của lô ở kho trước → sau. Chuyển kệ: tồn giữ nguyên + Từ kệ → Sang kệ */}
                        <div className="overflow-hidden rounded-[10px] border border-bo-border bg-bo-surface-subtle">
                            <div className="grid grid-cols-2">
                                <div className="min-w-0 px-3.5 py-3 sm:px-4">
                                    <p className="text-xs text-bo-muted">{NHAN_SO_LUONG[item.loaiGiaoDich] ?? t("Số lượng")}</p>
                                    <p className={`mt-1 text-[28px] font-bold leading-[34px] tabular-nums ${khongDoiTon ? "text-bo-heading" : soLuongColor}`}>
                                        {soLuongPrefix === "-" ? "−" : soLuongPrefix}{formatNumber(Math.abs(displaySoLuong))}
                                    </p>
                                </div>
                                <div className="min-w-0 border-l border-bo-border px-3.5 py-3 sm:px-4">
                                    <p className="text-xs text-bo-muted">{t("Tồn của lô ở kho")}</p>
                                    {khongDoiTon ? (
                                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 leading-[34px]">
                                            <span className="text-xl font-bold tabular-nums text-bo-heading">{coSo(item.soLuongSau) ? formatNumber(item.soLuongSau) : "—"}</span>
                                            <span className="text-[13px] font-medium text-bo-muted">{t("giữ nguyên")}</span>
                                        </p>
                                    ) : (
                                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-lg leading-[34px] tabular-nums sm:text-xl">
                                            <span className="sr-only">{t("Từ {{truoc}} thành {{sau}}", { truoc: coSo(item.soLuongTruoc) ? formatNumber(item.soLuongTruoc) : "—", sau: coSo(item.soLuongSau) ? formatNumber(item.soLuongSau) : "—" })}</span>
                                            <span className="font-medium text-bo-muted" aria-hidden="true">{coSo(item.soLuongTruoc) ? formatNumber(item.soLuongTruoc) : "—"}</span>
                                            <ArrowRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                                            <span className="font-bold text-bo-heading" aria-hidden="true">{coSo(item.soLuongSau) ? formatNumber(item.soLuongSau) : "—"}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            {laChuyenKe ? (
                                <div className="flex items-stretch gap-2 border-t border-bo-border p-3">
                                    <OKe nhan={t("Kệ nguồn")} ke={item.keNguon} />
                                    <span className="flex shrink-0 items-center text-slate-400" aria-hidden="true">
                                        <ArrowRight className="size-[18px]" />
                                    </span>
                                    <OKe nhan={t("Kệ đích")} ke={item.keDich} dich />
                                </div>
                            ) : null}
                        </div>

                        {/* Sản phẩm */}
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-bo-muted" aria-hidden="true">
                                <Package className="size-[18px]" />
                            </span>
                            <div className="min-w-0">
                                <p className="break-words text-[15px] font-semibold leading-5 text-bo-heading">{item.tenSanPham || "—"}</p>
                                {item.maSku ? <p className="mt-0.5 break-all font-mono text-xs text-slate-600">{item.maSku}</p> : null}
                            </div>
                        </div>

                        {/* Thông tin: nhãn trái, giá trị phải */}
                        <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-3 border-t border-bo-border pt-4 text-sm leading-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-4">
                            <Dong nhan={t("Lô hàng")}><span className={`break-all ${MONO}`}>{item.maLo || "—"}</span></Dong>
                            <Dong nhan={t("Kho")}><span className="font-medium">{tenKho}</span></Dong>
                            {!laChuyenKe && (item.ke?.ma || item.chuaCoKe) ? (
                                <Dong nhan={t("Kệ")}>
                                    {item.ke?.ma ? (
                                        <>
                                            <span className={`break-all ${MONO}`}>{item.ke.ma}</span>
                                            {viTriKe(item.ke) ? <span className="block text-xs text-bo-muted">{viTriKe(item.ke)}</span> : null}
                                        </>
                                    ) : (
                                        <span className="text-bo-muted">{t("Chưa xếp kệ")}</span>
                                    )}
                                </Dong>
                            ) : null}
                            {ct?.ma ? (
                                <Dong nhan={t("Chứng từ")}>
                                    <ChungTu ct={ct} item={item} chu={TEN_CHUNG_TU[ct.loai]?.(ct.ma)} />
                                    {nghiepVu ? <span className="block text-xs text-bo-muted">{nghiepVu}</span> : null}
                                </Dong>
                            ) : nghiepVu ? (
                                <Dong nhan={t("Nghiệp vụ")}>{nghiepVu}</Dong>
                            ) : null}
                            {item.phieuChuyenKho?.ma ? (
                                <Dong nhan={t("Phiếu chuyển kho")}><ChungTu ct={item.phieuChuyenKho} item={item} /></Dong>
                            ) : null}
                            {item.dotKiemKe?.ma ? (
                                <Dong nhan={t("Đợt kiểm kê")}><ChungTu ct={item.dotKiemKe} item={item} /></Dong>
                            ) : null}
                            {item.donBanHang?.ma ? (
                                <Dong nhan={t("Đơn bán hàng")}><ChungTu ct={item.donBanHang} item={item} /></Dong>
                            ) : null}
                            {item.phieuTraHang ? (
                                <Dong nhan={t("Phiếu trả hàng")}><span className="font-medium">{item.phieuTraHang}</span></Dong>
                            ) : null}
                            {item.maVanDon ? (
                                <Dong nhan={t("Mã vận đơn")}><span className={`break-all ${MONO}`}>{item.maVanDon}</span></Dong>
                            ) : null}
                            {item.tenKhoChuyenDen ? (
                                <Dong nhan={t("Kho chuyển đến")}><span className="font-medium">{tDuLieu(item.tenKhoChuyenDen)}</span></Dong>
                            ) : null}
                            <Dong nhan={t("Người thực hiện")}><span className="font-medium">{item.nguoiDungTen || "—"}</span></Dong>
                            {hienGhiChu ? (
                                // Câu sổ cũ / lạ chưa tách được: hiện nguyên văn (dữ liệu, không dịch)
                                <Dong nhan={t("Ghi chú")}><span className="whitespace-pre-line">{tDuLieu(item.ghiChu)}</span></Dong>
                            ) : null}
                        </dl>
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
    const dangMoRef = useRef(0);
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
        // Mỗi lần mở một số mới: kết quả của lần mở cũ (dòng khác, hoặc cùng dòng đã đóng rồi mở lại) bị bỏ
        const lan = ++dangMoRef.current;
        try {
            const detail = await getChiTietLichSu(item.id);
            if (dangMoRef.current === lan) setChiTiet(detail);
        } catch {
            if (dangMoRef.current !== lan) return;
            toast.error(t("Không thể tải chi tiết"));
            // Không để hộp trống chỉ còn tiêu đề
            setSelectedId(null);
        } finally {
            if (dangMoRef.current === lan) setLoadingDetail(false);
        }
    };

    const handleCloseModal = () => { dangMoRef.current += 1; setSelectedId(null); setChiTiet(null); setLoadingDetail(false); };

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
                            // Gợi ý ngắn, ô rộng 300px như các trang danh sách khác (228px chữ); vẫn tìm được theo kho, người thực hiện, mã phiếu chuyển kệ (matchSearch)
                            placeholder={t("Tìm sản phẩm, SKU, lô, kệ…")}
                            value={search}
                            onChange={(e) => changeSearch(e.target.value)}
                            onClear={handleClearSearch}
                            className="sm:w-[300px]"
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
