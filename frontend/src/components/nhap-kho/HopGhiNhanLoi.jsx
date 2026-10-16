import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LY_DO_LOI } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";

/**
 * Ghi nhận hàng lỗi cho thùng đang kiểm (FO-098): số lượng + một lý do + mô tả thêm.
 * Lý do chọn bằng nút radio màu xanh chính (không tô nền đỏ).
 */
export default function HopGhiNhanLoi({ open, onOpenChange, moTa, soLuongBanDau = 1, toiDa, onXacNhan }) {
  // Hộp mở lại thì dựng lại nội dung để về giá trị ban đầu
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoiDung
          moTa={moTa}
          soLuongBanDau={soLuongBanDau}
          toiDa={toiDa}
          onHuy={() => onOpenChange(false)}
          onXacNhan={onXacNhan}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ moTa, soLuongBanDau, toiDa, onHuy, onXacNhan }) {
  const [soLuong, setSoLuong] = useState(String(soLuongBanDau));
  const [lyDo, setLyDo] = useState(null);
  const [ghiChu, setGhiChu] = useState("");
  const so = Math.floor(Number(soLuong));
  const hopLe = Number.isInteger(so) && so >= 1 && (toiDa == null || so <= toiDa);
  const doi = (delta) => {
    const moi = Math.max(1, (Number.isInteger(so) ? so : 1) + delta);
    setSoLuong(String(toiDa != null ? Math.min(toiDa, moi) : moi));
  };

  return (
    <DialogContent className="gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[560px]">
      <DialogHeader className="border-b border-bo-border px-6 py-4 text-left">
        <DialogTitle className="text-base text-bo-foreground">Ghi nhận hàng lỗi</DialogTitle>
        {moTa ? <DialogDescription className="text-[13px] text-bo-muted">{moTa}</DialogDescription> : null}
      </DialogHeader>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="loi-so-luong" className="text-sm font-medium text-bo-foreground">Số lượng lỗi</label>
          <div className="inline-grid h-9 grid-cols-[36px_64px_36px] overflow-hidden rounded-md border border-bo-border">
            <button type="button" aria-label="Giảm" onClick={() => doi(-1)} className="grid place-items-center bg-bo-surface-subtle text-slate-600 hover:bg-slate-100">
              <Minus className="size-4" />
            </button>
            <input
              id="loi-so-luong"
              inputMode="numeric"
              value={soLuong}
              onChange={(e) => setSoLuong(e.target.value.replace(/\D/g, ""))}
              className="w-full border-x border-bo-border text-center text-[15px] font-semibold tabular-nums text-bo-foreground focus:outline-none"
            />
            <button type="button" aria-label="Tăng" onClick={() => doi(1)} className="grid place-items-center bg-bo-surface-subtle text-slate-600 hover:bg-slate-100">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {toiDa != null && so > toiDa ? (
          <p className="-mt-2 text-right text-xs text-bo-danger">Tối đa {toiDa} sản phẩm còn lại theo đơn mua.</p>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-bo-foreground">Lý do lỗi</legend>
          <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LY_DO_LOI.map((ld) => {
              const chon = lyDo === ld;
              return (
                <button
                  key={ld}
                  type="button"
                  role="radio"
                  aria-checked={chon}
                  onClick={() => setLyDo(ld)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-md border bg-white px-3 text-left text-sm text-bo-foreground transition-colors",
                    chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                  )}
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                    {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                  </span>
                  {ld}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="loi-ghi-chu" className="text-sm font-medium text-bo-foreground">Mô tả thêm</label>
          <input
            id="loi-ghi-chu"
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="Không bắt buộc. VD: hỏng khóa kéo, sai tem mác"
            className="h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
          />
        </div>
      </div>

      <DialogFooter className="border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" onClick={onHuy} className="min-w-28 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
          Hủy
        </Button>
        <Button
          disabled={!lyDo || !hopLe}
          onClick={() => onXacNhan({ soLuong: so, lyDo, ghiChu: ghiChu.trim() })}
          className="min-w-28 bg-bo-primary text-white hover:bg-bo-primary-hover"
        >
          Ghi nhận {hopLe ? so : ""} lỗi
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
