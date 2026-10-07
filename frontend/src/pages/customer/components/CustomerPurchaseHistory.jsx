import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCcw, Search, ShoppingBag, X } from "lucide-react";
import { getKhachHangPurchaseHistory } from "@/services/khachHangService";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const moneyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});
const filterDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
});
const controlClass = "border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";

function purchaseTimestamp(value) {
  return value ? new Date(value).getTime() : NaN;
}

function purchaseDay(value) {
  const timestamp = purchaseTimestamp(value);
  if (!Number.isFinite(timestamp)) return "";
  const parts = filterDateFormatter.formatToParts(timestamp);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatMoney(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  return moneyFormatter.format(Number(value));
}

function getPurchaseHistoryError(failure) {
  const status = failure.response?.status ?? failure.status;
  switch (status) {
    case 404: return "Không tìm thấy tài nguyên lịch sử mua hàng (HTTP 404).";
    case 401: return "Bạn cần đăng nhập lại để xem lịch sử mua hàng (HTTP 401).";
    case 403: return "Bạn không có quyền xem lịch sử mua hàng (HTTP 403).";
    case 500: return "Máy chủ gặp lỗi khi tải lịch sử mua hàng (HTTP 500). Vui lòng thử lại sau.";
    default:
      if (status) return `Không thể tải lịch sử mua hàng (HTTP ${status}). Vui lòng thử lại sau.`;
      if (failure.request) return "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.";
      return failure.message || "Vui lòng thử lại sau.";
  }
}

export default function CustomerPurchaseHistory({ customerId }) {
  const [history, setHistory] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const requestRef = useRef(null);

  const loadHistory = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setHistory([]);
    setTotalOrders(0);
    setError("");
    try {
      const data = await getKhachHangPurchaseHistory(customerId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setHistory([...data.history].sort((a, b) => (
        (purchaseTimestamp(b.ngay) || 0) - (purchaseTimestamp(a.ngay) || 0)
      )));
      setTotalOrders(data.totalOrders);
      setStatus("loaded");
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure.code === "PURCHASE_HISTORY_UNAVAILABLE") {
        setError(failure.message);
        setStatus("unavailable");
      } else {
        setError(getPurchaseHistoryError(failure));
        setStatus("error");
      }
    }
  }, [customerId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) loadHistory(); });
    return () => {
      active = false;
      requestRef.current?.abort();
    };
  }, [loadHistory]);

  // Chỉ lọc khi response thực sự chứa danh sách lịch sử.
  const channels = [...new Set(history.map((item) => item.kenh).filter(Boolean))].sort();
  const term = query.trim().toLocaleLowerCase("vi-VN");
  const results = history.filter((item) => {
    const day = purchaseDay(item.ngay);
    return (!term || String(item.maDonHang ?? "").toLocaleLowerCase("vi-VN").includes(term))
      && (!channel || item.kenh === channel)
      && (!fromDate || (day && day >= fromDate))
      && (!toDate || (day && day <= toDate));
  });
  const filtered = Boolean(query || channel || fromDate || toDate);
  const clearFilters = () => { setQuery(""); setChannel(""); setFromDate(""); setToDate(""); };
  const noOrders = status === "loaded" && history.length === 0 && totalOrders === 0;

  return (
    <TableShell
      className="min-w-0"
      title="Lịch sử mua hàng"
      description={noOrders ? null : status === "loaded"
        ? `Tổng số đơn: ${totalOrders.toLocaleString("vi-VN")} đơn hàng`
        : "Tra cứu lịch sử mua hàng của khách hàng."}
      toolbar={status === "loaded" && history.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 border-b border-bo-border bg-bo-surface-subtle px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="customer-history-search" className="static text-xs font-semibold leading-5 text-bo-foreground">Mã đơn hàng</Label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
              <Input id="customer-history-search" type="search" placeholder="Tìm theo mã đơn hàng…" value={query}
                disabled={status !== "loaded" || history.length === 0} onChange={(event) => setQuery(event.target.value)}
                className={`h-10 pl-9 ${controlClass}`} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="customer-history-channel" className="static text-xs font-semibold leading-5 text-bo-foreground">Kênh bán</Label>
            <select id="customer-history-channel" value={channel} onChange={(event) => setChannel(event.target.value)}
              disabled={status !== "loaded" || history.length === 0}
              className={`h-10 w-full min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50 ${controlClass}`}>
              <option value="">Tất cả kênh</option>
              {channels.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="customer-history-from" className="static text-xs font-semibold leading-5 text-bo-foreground">Từ ngày mua</Label>
            <Input id="customer-history-from" type="date" value={fromDate} max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)} className={`h-10 min-w-0 ${controlClass}`} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="customer-history-to" className="static text-xs font-semibold leading-5 text-bo-foreground">Đến ngày mua</Label>
            <Input id="customer-history-to" type="date" value={toDate} min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)} className={`h-10 min-w-0 ${controlClass}`} />
          </div>
          {filtered && <div className="sm:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={clearFilters} className={`h-9 hover:bg-bo-surface-subtle ${controlClass}`}><X className="size-4" />Xóa bộ lọc</Button></div>}
        </div>
      ) : null}
      footer={status === "loaded" && history.length > 0 ? (
        <p role="status" aria-live="polite" className="text-xs text-bo-muted">Hiển thị <span className="font-semibold text-bo-foreground">{results.length.toLocaleString("vi-VN")}</span> / {totalOrders.toLocaleString("vi-VN")} đơn hàng</p>
      ) : null}
    >
      {status === "loading" ? (
        <LoadingState className="min-h-48" label="Đang tải lịch sử mua hàng" />
      ) : status === "unavailable" ? (
        <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
          <ShoppingBag aria-hidden="true" className="size-6 text-bo-muted" />
          <div>
            <h3 className="text-sm font-semibold text-bo-foreground">Chưa có dữ liệu lịch sử từ API</h3>
            <p className="mt-1 text-sm text-bo-muted">{error}</p>
          </div>
        </div>
      ) : status === "error" ? (
        <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
          <AlertCircle aria-hidden="true" className="size-6 text-bo-danger" />
          <div>
            <h3 className="text-sm font-semibold text-bo-foreground">Không thể tải lịch sử mua hàng</h3>
            <p className="mt-1 text-sm text-bo-muted">{error}</p>
          </div>
          <Button type="button" variant="outline" onClick={loadHistory} className={`hover:bg-bo-surface-subtle ${controlClass}`}><RefreshCcw className="size-4" />Thử lại</Button>
        </div>
      ) : noOrders ? (
        <EmptyState icon={ShoppingBag} className="min-h-48" title="Chưa có lịch sử mua hàng" description={null} />
      ) : results.length === 0 ? (
        <EmptyState icon={Search} className="min-h-48" title="Không tìm thấy đơn hàng phù hợp" description={null}
          action={<Button type="button" variant="outline" onClick={clearFilters} className={controlClass}>Xóa bộ lọc</Button>} />
      ) : (
        <table className="w-full min-w-[620px] text-sm">
          <caption className="sr-only">Lịch sử mua hàng của khách hàng, mới nhất trước</caption>
          <thead>
            <tr className="border-b border-bo-border bg-bo-surface-subtle">
              <th scope="col" className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted sm:px-5">Mã đơn</th>
              <th scope="col" className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày mua</th>
              <th scope="col" className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kênh bán</th>
              <th scope="col" className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted sm:px-5">Giá trị</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bo-border">
            {results.map((item, index) => (
              <tr key={`${item.maDonHang}-${item.ngay}-${index}`} className="transition-colors hover:bg-bo-surface-subtle">
                <td className="px-4 py-3.5 font-semibold text-bo-primary sm:px-5">{item.maDonHang || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-bo-muted">{formatDate(item.ngay)}</td>
                <td className="px-4 py-3.5 text-bo-foreground">{item.kenh || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-bo-foreground sm:px-5">{formatMoney(item.giaTri)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TableShell>
  );
}
