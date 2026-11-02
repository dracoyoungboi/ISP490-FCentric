import { formatCurrency, formatDateTime, formatNumber } from "@/utils/formatters";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    AlertTriangle, Loader2, PackageCheck, SearchX, ShoppingBag, Truck, X,
} from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import FilterSelect from "@/components/shared/FilterSelect";
import KhoLamViecSelect from "@/components/shared/KhoLamViecSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import BieuTuongKenhDon from "@/components/channel/BieuTuongKenhDon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import { MARKETPLACE_FILTER_OPTIONS } from "@/constants/channel";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatQuantity, toNumber } from "@/constants/outbound";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { useBanPhimAoMo } from "@/hooks/useBanPhimAo";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
// Màn cảm ứng: ô chọn giữ 16px, vùng chạm 44px quanh ô do lớp cảm ứng dùng chung (index.css, data-slot="checkbox") lo
const CHECKBOX_CLASS = "border-slate-300 data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=checked]:text-white";
const DEFAULT_FILTERS = { keyword: "", kenh: "", page: 0, size: SO_DONG_MAC_DINH };

/** Kho làm việc hiện tại (KhoLamViecSelect ghi vào localStorage, apiClient gửi kèm header kho_id). */
const docKhoLamViec = () => Number(window.localStorage.getItem("selected_kho_id")) || undefined;

/**
 * Đơn đang chọn có trong trang vừa tải thì thay bằng bản mới (tồn, số lượng có thể đã đổi).
 * Đơn chọn ở trang khác giữ nguyên; đơn không còn chờ xuất do backend chặn khi tạo phiếu (409).
 */
const capNhatDonDaChon = (daChon, dsMoi) => {
    const trongTrang = dsMoi.filter((row) => daChon.has(row.id));
    if (trongTrang.length === 0) return daChon;
    const next = new Map(daChon);
    trongTrang.forEach((row) => next.set(row.id, row));
    return next;
};

export default function DonChoXuatPage() {
    const navigate = useNavigate();
    // Điện thoại: bàn phím ảo đang mở (gõ ô tìm) thì giấu thanh "Đã chọn n đơn" cố định ở đáy, kẻo thanh trôi lên che ô nhập
    const banPhimMo = useBanPhimAoMo();
    const [khoId, setKhoId] = useState(docKhoLamViec);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const requestIdRef = useRef(0);
    // Giữ lựa chọn qua nhiều trang: id -> dòng
    const [selected, setSelected] = useState(() => new Map());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [ghiChu, setGhiChu] = useState("");
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);

    // Chờ người dùng ngừng gõ 300 ms rồi mới lọc
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((prev) => (prev.keyword === searchText ? prev : { ...prev, keyword: searchText, page: 0 }));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchText]);

    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng và các đơn đang chọn; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        // Đổi kho / từ khóa / kênh liên tiếp: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoadError(false);
        }
        try {
            const kenhOption = MARKETPLACE_FILTER_OPTIONS.find((option) => option.value === filters.kenh);
            const res = await nhatHangService.getDonChoXuat({
                searchText: filters.keyword.trim() || undefined,
                kenhBanId: kenhOption?.id,
                khoId,
                page: filters.page,
                size: filters.size,
            });
            if (requestId !== requestIdRef.current) return;
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
            if (trangCuoi != null) {
                setFilters((p) => ({ ...p, page: trangCuoi }));
                return;
            }
            const dsMoi = res?.content ?? [];
            setData(dsMoi);
            setTotal(res?.totalElements ?? 0);
            setLoadError(false);
            setSelected((prev) => capNhatDonDaChon(prev, dsMoi));
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw error;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setData([]);
            setTotal(0);
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được danh sách đơn chờ xuất"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [khoId, filters]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: đơn mới gửi kho, nhân viên khác vừa gom đơn
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => fetchData({ silent: true }),
        bat: !loading,
    });

    const selectedRows = useMemo(() => [...selected.values()], [selected]);
    const selectedSummary = useMemo(() => ({
        donHang: selectedRows.length,
        sanPham: selectedRows.reduce((sum, row) => sum + toNumber(row.tongSoLuong), 0),
        thieuHang: selectedRows.filter((row) => row.duHang === false).length,
    }), [selectedRows]);

    const pageAllSelected = data.length > 0 && data.every((row) => selected.has(row.id));

    const toggleRow = (row) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.set(row.id, row);
            return next;
        });
    };

    const togglePage = () => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (pageAllSelected) data.forEach((row) => next.delete(row.id));
            else data.forEach((row) => next.set(row.id, row));
            return next;
        });
    };

    // "Xóa lọc": bỏ từ khóa + kênh bán, giữ kho làm việc và số dòng mỗi trang
    const clearFilters = () => {
        setSearchText("");
        setFilters((prev) => ({ ...prev, keyword: "", kenh: "", page: 0 }));
    };

    const handleCreate = async () => {
        if (creatingRef.current || selectedRows.length === 0) return;
        creatingRef.current = true;
        setCreating(true);
        try {
            const dto = await nhatHangService.taoPickList({
                donBanHangIds: selectedRows.map((row) => row.id),
                ghiChu: ghiChu.trim() || undefined,
            });
            toast.success(`Đã tạo ${dto?.maPickList || "phiếu nhặt hàng"} cho ${selectedRows.length} đơn`);
            setSelected(new Map());
            setDialogOpen(false);
            setGhiChu("");
            if (dto?.id) navigate(`/goods-issues/pick-lists/${dto.id}`);
            else fetchData();
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thể tạo phiếu nhặt hàng"));
            if (getApiErrorStatus(error) === 409) {
                setDialogOpen(false);
                setSelected(new Map());
                fetchData();
            }
        } finally {
            creatingRef.current = false;
            setCreating(false);
        }
    };

    const hasFilter = Boolean(searchText.trim() || filters.keyword.trim() || filters.kenh);
    const dangLoc = Boolean(filters.keyword.trim() || filters.kenh);

    // Đổi kho làm việc: đơn đã chọn thuộc kho cũ nên bỏ chọn, tải lại từ trang đầu
    const handleDoiKho = (id) => {
        setSelected(new Map());
        setKhoId(id || undefined);
        setFilters((prev) => ({ ...prev, page: 0 }));
    };

    // Tổng số đơn của danh sách (totalElements, theo kho làm việc + bộ lọc đang chọn); đang tải / lỗi thì không hiện (R9)
    const tongDon = loading || loadError ? null : total;

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={
                    <Link to="/goods-issues/pick-lists">
                        <Button
                            variant="outline"
                            className="h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Truck className="size-4" />
                            Danh sách phiếu nhặt hàng
                        </Button>
                    </Link>
                }
            />

            <MockModeNotice show={isPickListMock} />

            {/* ══ BẢNG ══ */}
            {/* Điện thoại, đang chọn đơn: chừa chỗ dưới khung bảng cho thanh "Tạo phiếu nhặt hàng" cố định ở đáy */}
            <TableShell
                fill
                className={selectedSummary.donHang > 0 ? "max-md:mb-[84px]" : undefined}
                toolbar={
                    <>
                        {/* Không có tab trạng thái: mọi đơn ở đây đều đang chờ xuất. Bên trái ghi tổng số đơn. */}
                        <ListToolbar
                            tabs={
                                tongDon != null ? (
                                    <p className="whitespace-nowrap py-3.5 text-sm leading-5 text-bo-muted">
                                        <strong className="font-semibold text-bo-foreground">
                                            {tongDon.toLocaleString("vi-VN")} đơn
                                        </strong>{" "}
                                        chờ gom nhặt
                                    </p>
                                ) : null
                            }
                            hasFilter={hasFilter}
                            onClear={clearFilters}
                        >
                            <KhoLamViecSelect onChange={handleDoiKho} />
                            <SearchInput
                                placeholder="Nhập số đơn hoặc tên khách hàng..."
                                label="Tìm đơn chờ xuất"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                onClear={() => setSearchText("")}
                                className="sm:w-[300px]"
                            />
                            <FilterSelect
                                label="Kênh bán"
                                value={filters.kenh}
                                options={MARKETPLACE_FILTER_OPTIONS}
                                onChange={(kenh) => setFilters((prev) => ({ ...prev, kenh, page: 0 }))}
                                align="end"
                            />
                        </ListToolbar>

                        {/* Thanh thao tác: chỉ hiện khi đã chọn đơn (điện thoại: ẩn, dùng thanh cố định ở đáy ngay dưới) */}
                        {selectedSummary.donHang > 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bo-border bg-bo-primary-soft px-4 py-2.5 sm:px-5 max-md:hidden">
                                <p className="text-sm text-blue-800">
                                    Đã chọn <span className="font-semibold">{selectedSummary.donHang}</span> đơn ·{" "}
                                    <span className="font-semibold">{formatQuantity(selectedSummary.sanPham)}</span> sản phẩm
                                    {selectedSummary.thieuHang > 0 ? ` · ${selectedSummary.thieuHang} đơn thiếu hàng` : ""}
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelected(new Map())}
                                        className="inline-flex items-center gap-1 text-sm font-medium text-bo-primary hover:text-bo-primary-hover"
                                    >
                                        <X className="size-4" />
                                        Bỏ chọn
                                    </button>
                                    <Button
                                        onClick={() => setDialogOpen(true)}
                                        disabled={selectedSummary.donHang === 0}
                                        className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                                    >
                                        <PackageCheck className="size-4" />
                                        Tạo phiếu nhặt hàng ({selectedSummary.donHang})
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {/* Điện thoại, đang chọn đơn: thanh cố định ngay trên thanh điều hướng đáy (thanh trong khung bảng bị cuộn mất);
                            vẫn hiện khi danh sách đang tải / trống vì lựa chọn được giữ qua các trang; ẩn lúc bàn phím ảo đang mở */}
                        {selectedSummary.donHang > 0 && !banPhimMo ? (
                            <div className="no-print fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t border-bo-border bg-bo-surface px-4 py-2.5 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] md:hidden">
                                <p className="min-w-0 flex-1 text-[13px] leading-[18px] text-bo-muted">
                                    <span className="block truncate text-sm font-semibold text-bo-foreground">Đã chọn {selectedSummary.donHang} đơn</span>
                                    <span className="block truncate">
                                        {formatQuantity(selectedSummary.sanPham)} SP
                                        {selectedSummary.thieuHang > 0 ? (
                                            <span className="font-medium text-bo-danger"> · {selectedSummary.thieuHang} thiếu hàng</span>
                                        ) : null}
                                    </span>
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelected(new Map())}
                                    aria-label="Bỏ chọn tất cả đơn"
                                    className="size-10 shrink-0 border-bo-input-border bg-bo-surface p-0 text-bo-foreground"
                                >
                                    <X className="size-5" aria-hidden="true" />
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => setDialogOpen(true)}
                                    className="h-10 shrink-0 gap-2 bg-bo-primary px-4 text-sm font-semibold text-white hover:bg-bo-primary-hover"
                                >
                                    <PackageCheck className="size-[18px]" aria-hidden="true" />
                                    Tạo phiếu nhặt
                                </Button>
                            </div>
                        ) : null}
                    </>
                }
                footer={
                    !loading && !loadError ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                            onSizeChange={(size) => setFilters((prev) => ({ ...prev, size, page: 0 }))}
                            capNhat={capNhat}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState className="min-h-64" label="Đang tải đơn chờ xuất" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách đơn chờ xuất. Vui lòng thử lại."
                        onRetry={() => fetchData()}
                    />
                ) : data.length === 0 ? (
                    dangLoc ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy đơn chờ xuất phù hợp"
                            description="Thử đổi từ khóa hoặc kênh bán."
                            action={
                                <Button variant="outline" onClick={clearFilters} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ShoppingBag}
                            title="Chưa có đơn chờ xuất"
                            description="Đơn bán đã gửi sang kho sẽ hiện ở đây để gom thành phiếu nhặt hàng."
                            action={
                                <Link to="/sales-orders" className="text-sm font-medium text-bo-primary hover:underline">
                                    Xem đơn bán hàng
                                </Link>
                            }
                        />
                    )
                ) : (
                    <>
                    {/* Điện thoại: hàng "Chọn tất cả" (cả hàng là vùng chạm) thay ô chọn ở tiêu đề bảng */}
                    <label className="flex min-h-11 cursor-pointer items-center gap-1 border-b border-bo-border bg-bo-surface-subtle pl-1.5 pr-4 md:hidden">
                        <span className="flex size-11 shrink-0 items-center justify-center">
                            <Checkbox
                                aria-label="Chọn tất cả đơn trong trang"
                                checked={pageAllSelected}
                                onCheckedChange={togglePage}
                                className={CHECKBOX_CLASS}
                            />
                        </span>
                        <span className="text-[13px] font-medium text-bo-muted">Chọn tất cả {data.length} đơn trong trang</span>
                    </label>
                    {/* Điện thoại: mỗi đơn một thẻ — chạm thẻ để chọn / bỏ chọn như dòng của bảng (ô chọn có vùng chạm 44px);
                        logo kênh + số đơn + tồn kho, khách, ngày tạo · số SP + tổng tiền; chạm số đơn mở đơn bán */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {data.map((row) => {
                            const isSelected = selected.has(row.id);
                            return (
                                <li
                                    key={row.id}
                                    onClick={() => toggleRow(row)}
                                    className={`flex cursor-pointer items-start gap-1 pl-1.5 pr-4 ${isSelected ? "bg-bo-primary-soft/60" : "active:bg-bo-surface-subtle"}`}
                                >
                                    <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center" onClick={(event) => event.stopPropagation()}>
                                        <Checkbox
                                            aria-label={`Chọn đơn ${row.soDonHang}`}
                                            checked={isSelected}
                                            onCheckedChange={() => toggleRow(row)}
                                            className={CHECKBOX_CLASS}
                                        />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-1 py-3">
                                        <span className="flex items-center justify-between gap-3">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <BieuTuongKenhDon maKenh={row.maKenhBan} tenKenh={row.tenKenhBan} />
                                                <Link
                                                    to={`/sales-orders/${row.id}`}
                                                    onClick={(event) => event.stopPropagation()}
                                                    className="-my-2 min-w-0 truncate py-2 text-[15px] font-semibold uppercase tracking-wide text-bo-primary"
                                                >
                                                    {row.soDonHang}
                                                </Link>
                                            </span>
                                            <StatusBadge
                                                nhom={row.duHang ? "xong" : "loi"}
                                                label={row.khaDung || (row.duHang ? "Đủ hàng" : "Thiếu hàng")}
                                            />
                                        </span>
                                        <span className="min-w-0 truncate text-sm font-semibold text-bo-foreground">{row.tenKhachHang || "Khách lẻ"}</span>
                                        <span className="flex items-baseline justify-between gap-3 text-[13px] text-bo-muted">
                                            <span className="min-w-0 truncate">
                                                {formatDateTime(row.ngayTao)} · {formatQuantity(row.tongSoLuong)} SP
                                            </span>
                                            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-bo-foreground">
                                                {formatCurrency(toNumber(row.tongCong))}
                                            </span>
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    {/* Kênh là logo đứng trước số đơn (như danh sách Đơn bán), không còn cột Kênh riêng.
                        Máy tính bảng dọc (cảm ứng): bỏ cột Kho xuất, Ngày tạo, SKU — ngày tạo xuống dưới số đơn,
                        kho xuống dưới khách hàng, số SKU dưới số lượng — để bảng vừa khung, không vuốt ngang */}
                    <table className="w-full min-w-[1040px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} w-12 text-center`}>
                                    <Checkbox
                                        aria-label="Chọn tất cả đơn trong trang"
                                        checked={pageAllSelected}
                                        onCheckedChange={togglePage}
                                        className={CHECKBOX_CLASS}
                                    />
                                </th>
                                <th className={`${TH_CLASS} text-left`}>Số đơn</th>
                                <th className={`${TH_CLASS} text-left`}>Khách hàng</th>
                                <th className={`${TH_CLASS} text-left cam-ung:max-lg:hidden`}>Kho xuất</th>
                                <th className={`${TH_CLASS} text-left cam-ung:max-lg:hidden`}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-right tabular-nums cam-ung:max-lg:hidden`}>SKU</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>Số lượng</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>Tổng tiền</th>
                                <th className={`${TH_CLASS} text-left`}>Tồn kho</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((row) => {
                                const isSelected = selected.has(row.id);
                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => toggleRow(row)}
                                        className={`cursor-pointer transition-colors ${isSelected ? "bg-bo-primary-soft/60" : "hover:bg-bo-surface-subtle"}`}
                                    >
                                        <td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                aria-label={`Chọn đơn ${row.soDonHang}`}
                                                checked={isSelected}
                                                onCheckedChange={() => toggleRow(row)}
                                                className={CHECKBOX_CLASS}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-start gap-2">
                                                <BieuTuongKenhDon maKenh={row.maKenhBan} tenKenh={row.tenKenhBan} className="mt-0.5" />
                                                <div className="min-w-0">
                                                    <Link
                                                        to={`/sales-orders/${row.id}`}
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="font-semibold uppercase tracking-wide text-bo-primary hover:underline"
                                                    >
                                                        {row.soDonHang}
                                                    </Link>
                                                    <div className="mt-0.5 hidden whitespace-nowrap text-xs text-bo-muted cam-ung:max-lg:block">{formatDateTime(row.ngayTao)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-bo-foreground">
                                            {row.tenKhachHang || "Khách lẻ"}
                                            <div className="mt-0.5 hidden text-xs font-normal text-bo-muted cam-ung:max-lg:block">{row.tenKhoXuat}</div>
                                        </td>
                                        <td className="px-3 py-3 text-bo-muted cam-ung:max-lg:hidden">{row.tenKhoXuat || "—"}</td>
                                        <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted cam-ung:max-lg:hidden">
                                            {formatDateTime(row.ngayTao)}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums cam-ung:max-lg:hidden">
                                            {row.soLuongSku == null ? (
                                                <span className="text-bo-muted">—</span>
                                            ) : (
                                                <span className="font-semibold text-bo-foreground">{formatNumber(row.soLuongSku)}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-md bg-bo-surface-subtle px-2 text-xs font-bold text-bo-foreground">
                                                {formatNumber(toNumber(row.tongSoLuong))}
                                            </span>
                                            {row.soLuongSku == null ? null : (
                                                <div className="mt-0.5 hidden whitespace-nowrap text-xs text-bo-muted cam-ung:max-lg:block">{formatNumber(row.soLuongSku)} SKU</div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-bo-foreground">
                                            {formatCurrency(toNumber(row.tongCong))}
                                        </td>
                                        <td className="px-3 py-3">
                                            {/* Thiếu hàng là đơn chưa nhặt được: Đỏ như cờ "Thiếu hàng" của đơn kênh */}
                                            <StatusBadge
                                                nhom={row.duHang ? "xong" : "loi"}
                                                label={row.khaDung || (row.duHang ? "Đủ hàng" : "Thiếu hàng")}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </>
                )}
            </TableShell>

            {/* ══ XÁC NHẬN TẠO PICK LIST ══ */}
            <Dialog open={dialogOpen} onOpenChange={(open) => !creating && setDialogOpen(open)}>
                <DialogContent className="rounded-xl border-bo-border sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-bo-foreground">Tạo phiếu nhặt hàng</DialogTitle>
                        <DialogDescription className="text-slate-600">
                            Gom {selectedSummary.donHang} đơn thành một đợt nhặt hàng. Các đơn giữ trạng thái{" "}
                            <strong className="font-semibold text-bo-foreground">Chờ nhặt hàng</strong> tới khi nhặt xong,
                            sau đó chuyển sang <strong className="font-semibold text-bo-foreground">Chờ đóng gói</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-bo-border">
                            <ul className="divide-y divide-bo-border">
                                {selectedRows.map((row) => (
                                    <li key={row.id} className="flex items-start gap-2 px-3 py-2">
                                        <BieuTuongKenhDon maKenh={row.maKenhBan} tenKenh={row.tenKenhBan} className="mt-0.5" />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-bo-foreground">{row.soDonHang}</span>
                                            <span className="block truncate text-xs text-bo-muted">
                                                {row.tenKhachHang || "Khách lẻ"} · {formatQuantity(row.tongSoLuong)} sản phẩm
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {selectedSummary.thieuHang > 0 ? (
                            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <p>
                                    Có {selectedSummary.thieuHang} đơn đang báo thiếu hàng. Hệ thống sẽ kiểm tra lại khi tạo phiếu nhặt hàng.
                                </p>
                            </div>
                        ) : null}

                        <div className="space-y-1.5">
                            <label htmlFor="pick-list-note" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                Ghi chú (không bắt buộc)
                            </label>
                            <Textarea
                                id="pick-list-note"
                                rows={2}
                                value={ghiChu}
                                maxLength={500}
                                onChange={(event) => setGhiChu(event.target.value)}
                                placeholder="Ví dụ: Ưu tiên đơn sàn, ca sáng"
                                className="resize-none border-bo-border bg-bo-surface text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={creating}
                            onClick={() => setDialogOpen(false)}
                            className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            disabled={creating || selectedSummary.donHang === 0}
                            onClick={handleCreate}
                            className="min-w-[150px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {creating ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
                            {creating ? "Đang tạo..." : "Tạo phiếu nhặt hàng"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
