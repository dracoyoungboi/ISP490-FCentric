import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import InfoItem from "@/components/shared/InfoItem";
import ErrorState from "@/components/shared/ErrorState";
import ChannelBadge from "@/components/channel/ChannelBadge";
import SyncStatusBadge from "@/components/channel/SyncStatusBadge";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { LOG_SOURCE, LOG_TYPE, getErrorHint } from "@/constants/channel";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/dateTime";


function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Chi tiết một dòng nhật ký đồng bộ: dữ liệu tóm tắt và payload (đã che token, SĐT, địa chỉ ở backend). */
const formatDateTimeLocal = (value) => formatDateTime(value, { withSeconds: true });

export default function SyncLogDetailSheet({ logId, open, onOpenChange, onRetried }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const retryingRef = useRef(false);

  useEffect(() => {
    if (!open || !logId) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setFailed(false);
    });
    kenhBanHangService
      .getNhatKy(logId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, logId, reloadKey]);

  const retry = async () => {
    if (!detail || retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    try {
      await kenhBanHangService.thuLai(detail.id);
      toast.success("Đã đưa vào hàng đợi thử lại");
      onRetried?.(detail.id);
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thử lại được"));
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  };

  const hint = getErrorHint(detail?.maLoi);
  const summary = detail?.duLieuTomTat && typeof detail.duLieuTomTat === "object" ? Object.entries(detail.duLieuTomTat) : [];
  const shown = detail && detail.id === logId ? detail : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-bo-border bg-white p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-bo-border px-5 py-4">
          <SheetTitle className="text-bo-foreground">Chi tiết sự kiện đồng bộ</SheetTitle>
          <SheetDescription className="text-slate-600">
            Dữ liệu đã được che token, số điện thoại và địa chỉ trước khi lưu nhật ký.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading && !shown ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-bo-muted">
              <Loader2 className="size-4 animate-spin" /> Đang tải chi tiết
            </div>
          ) : failed && !shown ? (
            <ErrorState onRetry={() => setReloadKey((key) => key + 1)} />
          ) : shown ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <ChannelBadge maKenh={shown.maKenh} />
                <span className="text-sm font-semibold text-bo-foreground">{shown.tenHienThi}</span>
                <SyncStatusBadge trangThai={shown.trangThai} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Loại" value={LOG_TYPE[shown.loai] ?? shown.loai} />
                <InfoItem label="Nguồn" value={LOG_SOURCE[shown.nguon] ?? shown.nguon} />
                <InfoItem label="Tham chiếu" value={<span className="font-mono text-xs">{shown.maThamChieu}</span>} />
                <InfoItem label="Thời gian" value={formatDateTimeLocal(shown.ngayTao)} />
                {shown.maLoi ? <InfoItem label="Mã lỗi" value={<span className="font-mono text-xs text-bo-danger">{shown.maLoi}</span>} /> : null}
                {shown.suKienVaoId ? <InfoItem label="Sự kiện vào" value={`#${shown.suKienVaoId}`} /> : null}
              </div>

              <div className="rounded-md border border-bo-border bg-bo-surface-subtle p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Thông điệp</p>
                <p className="mt-1 text-sm text-bo-foreground">{shown.thongDiep || "—"}</p>
                {hint ? <p className="mt-1.5 text-xs text-bo-muted">Gợi ý: {hint}</p> : null}
              </div>

              {summary.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">Dữ liệu tóm tắt</p>
                  <dl className="divide-y divide-bo-border overflow-hidden rounded-md border border-bo-border">
                    {summary.map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2 text-sm">
                        <dt className="truncate font-mono text-xs text-bo-muted">{key}</dt>
                        <dd className="break-words text-bo-foreground">{formatValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {shown.payload ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">Payload (đã che)</p>
                  <pre className="max-h-72 overflow-auto rounded-md border border-bo-border bg-bo-surface-subtle p-3 font-mono text-xs leading-5 text-slate-700">
                    {JSON.stringify(shown.payload, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {shown?.coTheThuLai ? (
          <div className="flex justify-end border-t border-bo-border px-5 py-4">
            <Button
              onClick={retry}
              disabled={retrying}
              className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
            >
              {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Thử lại
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
