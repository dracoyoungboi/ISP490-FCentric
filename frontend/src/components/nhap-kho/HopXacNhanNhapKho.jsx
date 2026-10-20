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
import { laDoiHang } from "@/constants/nhapKho";
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

  const tongDat = (dong ?? []).reduce((t, d) => t + Number(d.dat || 0), 0);
  const tongLoi = (dong ?? []).reduce((t, d) => t + Number(d.loi || 0), 0);
  // Incoming = phần đơn mua chưa nhận. Nhập kho cộng "đã nhận" của đơn: chỉ hàng đạt khi phương án là Đổi hàng
  // (nhà cung cấp giao bù phần lỗi), cả đạt và lỗi với Trừ công nợ / Trả tài xế.
  // Free to Use = On Hand + Incoming − Outgoing, nên chỉ giảm phần lỗi không được giao bù.
  const giamIncoming = tongDat + (laDoiHang(phieu?.phuongAnBienBan) ? 0 : tongLoi);
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
      {/* Đầu và chân hộp cố định, chỉ phần giữa cuộn: nút Xác nhận luôn thấy, điện thoại không tràn ngang */}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(800px,calc(100%-2rem))]">
        <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-base text-bo-foreground">Xác nhận nhập kho chính thức</DialogTitle>
          <DialogDescription className="text-[13px] text-bo-muted">
            Tồn kho được cộng ngay và không hoàn tác được.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 *:shrink-0 sm:px-6">
          <div className="min-w-0 overflow-hidden rounded-lg border border-bo-border">
            {/* Bảng co theo khung: trên điện thoại mã lô xuống dòng dưới tên biến thể, không cuộn ngang */}
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted sm:px-4">Biến thể</th>
                  <th className="hidden h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted sm:table-cell">Lô</th>
                  <th className="h-10 w-24 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted sm:w-32 sm:px-4">Nhập (đạt)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {(dong ?? []).map((d) => {
                  const lo = d.lots?.length ? d.lots.map((l) => l.maLo).join(", ") : "—";
                  return (
                    <tr key={d.bienTheSanPhamId}>
                      <td className="h-14 px-3 py-2 sm:px-4">
                        <div className="break-words font-semibold text-bo-foreground">{d.tenBienThe}</div>
                        {/* Hai biến thể cùng tên sản phẩm: màu · kích cỡ để phân biệt */}
                        <div className="break-words text-xs text-bo-muted">
                          {[d.mauSac, d.kichCo].filter(Boolean).join(" · ")}
                          {d.mauSac || d.kichCo ? " · " : ""}
                          <span className="font-mono">{d.sku}</span>
                        </div>
                        <div className="mt-0.5 break-all font-mono text-xs text-slate-600 sm:hidden">Lô {lo}</div>
                      </td>
                      <td className="hidden break-all px-4 py-2 font-mono text-xs text-slate-600 sm:table-cell">{lo}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums sm:px-4">{so(d.dat)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                  <td className="h-12 px-3 sm:px-4 sm:hidden">Tổng nhập vào kho</td>
                  <td className="hidden h-12 px-4 sm:table-cell" colSpan={2}>Tổng nhập vào kho</td>
                  <td className="px-3 text-right tabular-nums sm:px-4">{so(tongDat)}</td>
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
                    oTon("Incoming", ton.incoming, Math.max(0, ton.incoming - giamIncoming)),
                    oTon("Free to Use", ton.freeToUse, ton.freeToUse + tongDat - Math.min(ton.incoming, giamIncoming)),
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

        <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
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
