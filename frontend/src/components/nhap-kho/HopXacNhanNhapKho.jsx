import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DaiO } from "@/components/nhap-kho/ThanhBuoc";
import { thongKeHeThongService } from "@/services/thongKeHeThongService";

const so = (n) => Number(n || 0).toLocaleString("vi-VN");

/**
 * Hộp xác nhận nhập kho chính thức (FO-100).
 * - Bảng hàng sẽ nhập (số đạt) và các lô.
 * - Tồn trước → sau (On Hand / Incoming / Free to Use) của các biến thể trong phiếu, tại kho nhận.
 * - "Đẩy tồn mới lên Shopify ngay": chỉ hiện cho vai trò được phép đẩy tồn.
 */
export default function HopXacNhanNhapKho({ open, onOpenChange, phieu, dong, coTheDayTon, dangXuLy, onXacNhan }) {
  const [dayTon, setDayTon] = useState(true);
  const [ton, setTon] = useState(null);

  const khoId = phieu?.khoId;
  const khoaBienThe = (dong ?? []).map((d) => d.bienTheSanPhamId).join(",");

  useEffect(() => {
    if (!open || !khoId) return undefined;
    let huy = false;
    const ids = new Set(khoaBienThe.split(",").map(Number));
    thongKeHeThongService
      .getTonKhoTongQuan({ khoId })
      .then((res) => {
        if (huy) return;
        const rows = (res?.data?.data ?? []).filter((r) => ids.has(Number(r.bienTheId)) && Number(r.khoId) === Number(khoId));
        const cong = (k) => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
        setTon({ onHand: cong("onHand"), incoming: cong("incoming"), freeToUse: cong("freeToUse") });
      })
      .catch(() => {
        if (!huy) setTon(false);
      });
    return () => {
      huy = true;
    };
  }, [open, khoId, khoaBienThe]);

  const tongDat = (dong ?? []).reduce((t, d) => t + d.dat, 0);
  const oTon = (nhan, truoc, sau) => (
    <div key={nhan} className="flex min-w-0 flex-col gap-1 bg-white px-4 py-3">
      <span className="text-xs font-medium text-bo-muted">{nhan}</span>
      <span className="flex items-center gap-2 text-lg font-semibold tabular-nums text-bo-heading">
        <span className="font-medium text-bo-muted">{so(truoc)}</span>
        <ArrowRight className="size-3.5 text-bo-muted" aria-hidden="true" />
        <span>{so(sau)}</span>
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !dangXuLy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-4rem)] gap-0 overflow-y-auto rounded-xl border-bo-border p-0 sm:max-w-[800px]">
        <DialogHeader className="border-b border-bo-border px-6 py-4 text-left">
          <DialogTitle className="text-base text-bo-foreground">Xác nhận nhập kho chính thức</DialogTitle>
          <DialogDescription className="text-[13px] text-bo-muted">
            Tồn kho được cộng ngay và không hoàn tác được.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="overflow-x-auto rounded-lg border border-bo-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Biến thể</th>
                  <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Lô</th>
                  <th className="h-10 w-32 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Nhập (đạt)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {(dong ?? []).map((d) => (
                  <tr key={d.bienTheSanPhamId}>
                    <td className="h-14 px-4 py-2">
                      <div className="font-semibold text-bo-foreground">{d.tenBienThe}</div>
                      <div className="font-mono text-xs text-bo-muted">{d.sku}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">
                      {d.lots?.length ? d.lots.map((l) => l.maLo).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{so(d.dat)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                  <td className="h-12 px-4" colSpan={2}>Tổng nhập vào kho</td>
                  <td className="px-4 text-right tabular-nums">{so(tongDat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {ton === false ? (
            <p className="text-[13px] text-bo-muted">Không tải được tồn kho hiện tại để so sánh.</p>
          ) : (
            <DaiO soO={3}>
              {ton
                ? [
                    oTon("On Hand", ton.onHand, ton.onHand + tongDat),
                    oTon("Incoming", ton.incoming, Math.max(0, ton.incoming - tongDat)),
                    oTon("Free to Use", ton.freeToUse, ton.freeToUse + tongDat),
                  ]
                : ["On Hand", "Incoming", "Free to Use"].map((nhan) => (
                    <div key={nhan} className="flex flex-col gap-1 bg-white px-4 py-3">
                      <span className="text-xs font-medium text-bo-muted">{nhan}</span>
                      <span className="h-7 w-24 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
            </DaiO>
          )}

          {coTheDayTon ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-bo-border px-4 py-3">
              <input
                type="checkbox"
                checked={dayTon}
                onChange={(e) => setDayTon(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-bo-primary)]"
              />
              <span>
                <span className="block text-sm font-medium text-bo-foreground">Đẩy tồn mới lên Shopify ngay</span>
                <span className="block text-xs text-bo-muted">Bỏ chọn thì hệ thống tự đẩy ở chu kỳ đồng bộ tiếp theo.</span>
              </span>
            </label>
          ) : null}
        </div>

        <DialogFooter className="border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
          <Button
            variant="outline"
            disabled={dangXuLy}
            onClick={() => onOpenChange(false)}
            className="min-w-28 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Kiểm tra lại
          </Button>
          <Button
            disabled={dangXuLy}
            onClick={() => onXacNhan({ dayTon: coTheDayTon && dayTon })}
            className="min-w-28 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            {dangXuLy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Xác nhận nhập kho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
