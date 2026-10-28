import { useId, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MoneyInput from "@/components/shared/MoneyInput";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { cn } from "@/lib/utils";
import ChipLyDo from "./ChipLyDo";
import { GIA_BAN_TOI_DA, dinhDangPhanTram, mucDoiGia, tinhLaiGop } from "./nhomGiaBan";
import { formatNumber } from "@/utils/formatters";

const COT = "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px] items-center";

/**
 * Đổi giá bán nhiều SKU đã chọn (chỉ quản trị viên): một ô giá cho mọi SKU, bảng SKU | Giá vốn | Giá hiện tại | Giá mới |
 * Lãi gộp, cảnh báo đỏ khi có SKU sẽ bán dưới giá vốn, chip lý do. SKU ngừng hoạt động tự bỏ qua và ghi rõ ở dòng phụ.
 */
export default function HopDoiGiaNhieu({ open, onOpenChange, dsDong, lyDoMacDinh, dangLuu, onLuu }) {
  return (
    <Dialog open={open} onOpenChange={(mo) => !dangLuu && onOpenChange(mo)}>
      {open ? <NoiDung dsDong={dsDong} lyDoMacDinh={lyDoMacDinh} dangLuu={dangLuu} onHuy={() => onOpenChange(false)} onLuu={onLuu} /> : null}
    </Dialog>
  );
}

function NoiDung({ dsDong, lyDoMacDinh, dangLuu, onHuy, onLuu }) {
  const id = useId();
  const [gia, setGia] = useState("");
  const [lyDo, setLyDo] = useState(lyDoMacDinh);
  const muc = mucDoiGia(dsDong);
  const soGia = gia === "" ? 0 : Number(gia);
  const soDuoiVon = soGia > 0 ? muc.muc.filter((d) => tinhLaiGop(soGia, d.giaVon)?.lo).length : 0;
  const quaLon = soGia > GIA_BAN_TOI_DA;
  // Mọi SKU đã đúng giá này thì không có gì để lưu (ghi rõ dưới ô giá)
  const khongDoi = soGia > 0 && muc.muc.length > 0 && muc.khongDoi(soGia);
  const hopLe = soGia > 0 && !quaLon && Boolean(lyDo) && muc.muc.length > 0 && !khongDoi;

  return (
    <DialogContent
      showCloseButton={!dangLuu}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(720px,calc(100%-2rem))]"
    >
      <DialogHeader className="shrink-0 border-b border-bo-border px-5 py-4 pr-12 text-left">
        <DialogTitle className="text-[17px] text-bo-foreground">Đổi giá bán</DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          {formatNumber(muc.muc.length)} SKU đang hoạt động
          {muc.boQua ? ` · bỏ qua ${formatNumber(muc.boQua)} SKU ngừng hoạt động` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-[18px] *:shrink-0">
        <label className="flex w-full flex-col gap-1.5 text-[13px] font-medium text-slate-700 sm:w-[260px]">
          Giá bán mới cho các SKU (₫)
          <MoneyInput
            autoFocus
            value={gia}
            onChange={setGia}
            disabled={dangLuu}
            placeholder="Nhập giá bán"
            className="h-10 px-3 text-[15px] font-semibold"
          />
          {khongDoi ? <span className="text-xs font-normal text-bo-muted">Các SKU đã có giá này.</span> : null}
        </label>

        <div className="overflow-x-auto rounded-lg border border-bo-border">
          <div className="min-w-[560px]">
            <div className={cn(COT, "border-b border-[#eef1f5] bg-bo-surface-subtle text-[11px] font-semibold uppercase tracking-wide text-bo-muted *:px-2.5 *:py-2")}>
              <div>SKU</div>
              <div className="text-right">Giá vốn</div>
              <div className="text-right">Giá hiện tại</div>
              <div className="text-right">Giá mới</div>
              <div className="text-right">Lãi gộp</div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {muc.muc.map((d) => {
                const lai = tinhLaiGop(soGia, d.giaVon);
                return (
                  <div key={d.id} className={cn(COT, "border-b border-[#eef1f5] text-[13px] last:border-b-0 *:min-w-0 *:px-2.5 *:py-2")}>
                    <div>
                      <p className="truncate font-medium">{d.tenSanPham} · {[d.tenMau, d.kichCo].filter(Boolean).join(" - ")}</p>
                      <p className="mt-0.5 truncate text-xs text-bo-muted">{d.maSku}</p>
                    </div>
                    <div className="text-right tabular-nums text-bo-muted">{d.giaVon == null ? "—" : formatNumber(d.giaVon)}</div>
                    <div className="text-right tabular-nums text-bo-muted">{Number(d.giaBan) > 0 ? formatNumber(d.giaBan) : "Chưa có giá"}</div>
                    <div className="text-right font-semibold tabular-nums">{soGia > 0 ? formatNumber(soGia) : "—"}</div>
                    <div className={cn("text-right tabular-nums", !lai ? "text-slate-400" : lai.lo ? "font-semibold text-bo-danger-strong" : "text-bo-success")}>
                      {lai ? dinhDangPhanTram(lai.phanTram) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {quaLon ? (
          <p role="alert" className="rounded-lg bg-bo-danger-soft px-3 py-2.5 text-[13px] font-medium text-red-800">Giá bán vượt giới hạn cho phép.</p>
        ) : null}
        {soDuoiVon ? (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-[13px] text-red-800">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            {formatNumber(soDuoiVon)} SKU sẽ bán thấp hơn giá vốn.
          </div>
        ) : null}

        <ChipLyDo value={lyDo} onChange={setLyDo} disabled={dangLuu} nhanId={`${id}-ly-do`} />
      </div>

      <DialogFooter className="shrink-0 flex-row flex-wrap items-center gap-2 border-t border-bo-border bg-[#fafbfc] px-5 py-3 sm:justify-end">
        <span className="mr-auto text-[12.5px] text-bo-muted">Giá mới áp dụng ngay khi bán tại quầy.</span>
        <Button type="button" variant="outline" onClick={onHuy} disabled={dangLuu} className={NUT_PHU}>
          Hủy
        </Button>
        <Button
          type="button"
          disabled={!hopLe || dangLuu}
          onClick={() => onLuu({ ids: muc.muc.map((d) => d.id), gia: soGia, lyDo })}
          className={NUT_CHINH}
        >
          {dangLuu ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {dangLuu ? "Đang lưu…" : "Lưu giá bán"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
