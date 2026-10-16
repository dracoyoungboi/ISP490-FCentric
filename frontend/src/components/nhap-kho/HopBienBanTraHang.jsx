import { useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { PHUONG_AN_TRA_HANG } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";

/**
 * Lập / xem biên bản trả hàng nhà cung cấp (FO-099).
 * - dongLoi: [{ tenBienThe, sku, maLo, lyDo, soLuong }]
 * - bienBan: biên bản đã phát hành (chỉ xem) hoặc null.
 */
export default function HopBienBanTraHang({ open, onOpenChange, phieu, dongLoi, bienBan, dangXuLy, onPhatHanh }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !dangXuLy && onOpenChange(next)}>
      {open ? (
        <NoiDung
          phieu={phieu}
          dongLoi={dongLoi}
          bienBan={bienBan}
          dangXuLy={dangXuLy}
          onDong={() => onOpenChange(false)}
          onPhatHanh={onPhatHanh}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ phieu, dongLoi, bienBan, dangXuLy, onDong, onPhatHanh }) {
  const [phuongAn, setPhuongAn] = useState(bienBan?.phuongAn ?? PHUONG_AN_TRA_HANG[0].ma);
  const [ghiChu, setGhiChu] = useState(bienBan?.ghiChu ?? "");
  const daPhatHanh = Boolean(bienBan);
  const tong = (dongLoi ?? []).reduce((t, d) => t + Number(d.soLuong || 0), 0);

  return (
    <DialogContent className="max-h-[calc(100vh-4rem)] gap-0 overflow-y-auto rounded-xl border-bo-border p-0 sm:max-w-[800px]">
      <DialogHeader className="border-b border-bo-border px-6 py-4 text-left">
        <DialogTitle className="text-base text-bo-foreground">
          {daPhatHanh ? `Biên bản trả hàng ${bienBan.soBienBan}` : "Lập biên bản trả hàng nhà cung cấp"}
        </DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          Phiếu nhập {phieu?.soPhieuNhap} · {phieu?.tenNhaCungCap || "—"} · {phieu?.soDonMua || "—"}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="overflow-x-auto rounded-lg border border-bo-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                {["Sản phẩm", "Lô phát hiện", "Lý do lỗi"].map((t) => (
                  <th key={t} className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t}</th>
                ))}
                <th className="h-10 w-24 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {(dongLoi ?? []).map((d, i) => (
                <tr key={`${d.sku}-${d.maLo}-${d.lyDo}-${i}`}>
                  <td className="h-14 px-4 py-2">
                    <div className="font-semibold text-bo-foreground">{d.tenBienThe}</div>
                    <div className="font-mono text-xs text-bo-muted">{d.sku}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{d.maLo || "—"}</td>
                  <td className="px-4 py-2">{d.lyDo}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-bo-danger">{d.soLuong}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                <td className="h-12 px-4" colSpan={3}>Tổng cộng</td>
                <td className="px-4 text-right tabular-nums text-bo-danger">{tong}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-bo-foreground">Phương án xử lý</p>
          <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PHUONG_AN_TRA_HANG.map((pa) => {
              const chon = phuongAn === pa.ma;
              return (
                <button
                  key={pa.ma}
                  type="button"
                  role="radio"
                  aria-checked={chon}
                  disabled={daPhatHanh}
                  onClick={() => setPhuongAn(pa.ma)}
                  className={cn(
                    "grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md border bg-white p-3 text-left disabled:cursor-default",
                    chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                  )}
                >
                  <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                    {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                  </span>
                  <span className="text-sm font-medium text-bo-foreground">{pa.ten}</span>
                  <span className="col-start-2 text-xs text-bo-muted">{pa.moTa}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bien-ban-ghi-chu" className="text-sm font-medium text-bo-foreground">Ghi chú gửi nhà cung cấp</label>
          <textarea
            id="bien-ban-ghi-chu"
            rows={2}
            disabled={daPhatHanh}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="VD: Đề nghị giao bù trong đợt hàng tới"
            className="w-full resize-y rounded-md border border-bo-border bg-white px-3 py-2 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle"
          />
        </div>

        <DongThongBao>
          Phát hành xong, hàng lỗi chuyển sang khu cách ly, không cộng vào tồn kho và nút “Xác nhận nhập kho” được mở.
        </DongThongBao>
      </div>

      <DialogFooter className="border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" disabled={dangXuLy} onClick={onDong} className="min-w-28 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
          {daPhatHanh ? "Đóng" : "Hủy"}
        </Button>
        {daPhatHanh ? null : (
          <Button
            disabled={dangXuLy || tong === 0}
            onClick={() => onPhatHanh({ phuongAn, ghiChu: ghiChu.trim() })}
            className="min-w-28 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            {dangXuLy ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
            Phát hành biên bản
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
