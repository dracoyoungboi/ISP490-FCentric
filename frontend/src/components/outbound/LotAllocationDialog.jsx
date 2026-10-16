import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, PackageX, RotateCcw } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { nhatHangService } from "@/services/nhatHangService";
import { formatQuantity, toNumber } from "@/constants/outbound";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";

/**
 * Phân bổ lô cho một dòng phiếu nhặt (Log 2). Hệ thống gợi ý FIFO (lô nhập kho sớm lấy trước); người nhặt lấy ở lô
 * khác thì sửa tay. Tổng phải đúng bằng số cần nhặt, mỗi lô không vượt phần còn lại (đã trừ phiếu khác đang giữ).
 */
export default function LotAllocationDialog({ open, onOpenChange, pickListId, line, onSaved }) {
  const [lots, setLots] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const canNhat = toNumber(line?.soLuongCanNhat);

  useEffect(() => {
    if (!open || !line) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setLoadError("");
      setLots([]);
      setValues({});
    });
    nhatHangService
      .getLoKhaDung(pickListId, line.id)
      .then((list) => {
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        setLots(rows);
        const init = {};
        rows.forEach((lot) => {
          if (toNumber(lot.daPhanBo) > 0) init[lot.loHangId] = String(toNumber(lot.daPhanBo));
        });
        setValues(init);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, "Không tải được danh sách lô"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, line, pickListId]);

  const tong = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + toNumber(v), 0),
    [values],
  );
  const loVuot = lots.find((lot) => toNumber(values[lot.loHangId]) > toNumber(lot.conLai));
  const hopLe = !loVuot && tong === canNhat && canNhat > 0;

  const handleChange = (loHangId, raw) => {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setValues((prev) => ({ ...prev, [loHangId]: raw }));
  };

  // Lấy lần lượt từ lô nhập kho sớm nhất (danh sách đã sắp FIFO) cho tới đủ số cần nhặt
  const datLaiFifo = () => {
    let conThieu = canNhat;
    const next = {};
    lots.forEach((lot) => {
      const lay = Math.min(Math.max(toNumber(lot.conLai), 0), conThieu);
      if (lay > 0) {
        next[lot.loHangId] = String(lay);
        conThieu -= lay;
      }
    });
    setValues(next);
  };

  const save = async () => {
    if (!hopLe || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const phanBo = lots
        .filter((lot) => toNumber(values[lot.loHangId]) > 0)
        .map((lot) => ({ loHangId: lot.loHangId, soLuong: toNumber(values[lot.loHangId]) }));
      const dto = await nhatHangService.luuPhanBoLo(pickListId, line.id, { phanBo });
      toast.success(`Đã lưu phân bổ lô cho ${line.maSku}`);
      onSaved?.(dto);
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được phân bổ lô"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  let trangThai;
  if (loVuot) {
    trangThai = { tone: "danger", text: `Lô ${loVuot.maLo} chỉ còn ${formatQuantity(loVuot.conLai)} có thể lấy` };
  } else if (tong === canNhat) {
    trangThai = { tone: "success", text: "Khớp số cần nhặt" };
  } else if (tong < canNhat) {
    trangThai = { tone: "warning", text: `Còn thiếu ${formatQuantity(canNhat - tong)}` };
  } else {
    trangThai = { tone: "danger", text: `Vượt ${formatQuantity(tong - canNhat)} so với số cần nhặt` };
  }

  const variantName = [line?.tenMau, line?.tenSize].filter(Boolean).join(" / ");

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="rounded-xl border-bo-border sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Phân bổ lô</DialogTitle>
          <DialogDescription className="text-slate-600">
            {line ? `${line.tenSanPham}${variantName ? ` · ${variantName}` : ""} (${line.maSku}) · cần nhặt ${formatQuantity(canNhat)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p>Hệ thống gợi ý theo FIFO (lô nhập kho sớm lấy trước). Lấy ở lô khác thì nhập lại số lượng từng lô.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || lots.length === 0 || saving}
            onClick={datLaiFifo}
            className="shrink-0 gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface"
          >
            <RotateCcw className="size-3.5" />
            Đặt lại theo FIFO
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-bo-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-bo-muted">
              <Loader2 className="size-4 animate-spin" /> Đang tải danh sách lô
            </div>
          ) : loadError ? (
            <p className="px-3 py-6 text-center text-sm text-bo-danger">{loadError}</p>
          ) : lots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-bo-muted">
              <PackageX className="size-5" />
              Sản phẩm không còn lô nào có tồn tại kho này. Báo quản lý kho kiểm kê.
            </div>
          ) : (
            <ul className="divide-y divide-bo-border">
              {lots.map((lot, index) => {
                const value = values[lot.loHangId] ?? "";
                const vuot = toNumber(value) > toNumber(lot.conLai);
                return (
                  <li key={lot.loHangId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-semibold text-bo-foreground">{lot.maLo}</span>
                        {index === 0 ? (
                          <span className="rounded bg-bo-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-bo-success">
                            Nhập sớm nhất
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-bo-muted">
                        Nhập kho {lot.ngayNhapGanNhat ? formatDate(lot.ngayNhapGanNhat) : "—"} · Còn lấy được{" "}
                        <span className="font-semibold text-slate-700">{formatQuantity(lot.conLai)}</span>
                      </p>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Số lượng lấy từ lô ${lot.maLo}`}
                      value={value}
                      placeholder="0"
                      disabled={saving}
                      onChange={(event) => handleChange(lot.loHangId, event.target.value)}
                      className={cn(
                        "h-9 w-20 shrink-0 rounded-md border bg-white text-center font-semibold text-bo-foreground focus:outline-none focus:ring-2",
                        vuot
                          ? "border-bo-danger focus:ring-bo-danger/20"
                          : "border-bo-border focus:border-bo-primary focus:ring-bo-primary/15",
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
            trangThai.tone === "success" && "border-bo-success/30 bg-bo-success-soft text-bo-success",
            trangThai.tone === "warning" && "border-bo-warning/30 bg-bo-warning-soft text-bo-warning",
            trangThai.tone === "danger" && "border-bo-danger/30 bg-bo-danger-soft text-bo-danger",
          )}
        >
          <span className="text-slate-700">
            Đã phân bổ <span className="font-semibold">{formatQuantity(tong)}</span> / {formatQuantity(canNhat)}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            {trangThai.tone === "success" ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
            {trangThai.text}
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={!hopLe || saving || loading}
            onClick={save}
            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Lưu phân bổ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
