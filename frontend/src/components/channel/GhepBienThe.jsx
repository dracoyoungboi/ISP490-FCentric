import { useEffect, useId, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { cn } from "@/lib/utils";

/**
 * Ô tìm và chọn biến thể FCentric để ghép với một dòng của sàn, mở ngay tại dòng (đặt trong PopoverContent).
 * Tìm ở máy chủ (GET /bien-the/tim-kiem) sau 250 ms kể từ lúc ngừng gõ.
 */
export default function GhepBienThe({ dong, tenSan, dangGhep = false, onHuy, onGhep }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [ketQua, setKetQua] = useState({ q: null, list: [] });
  const [chon, setChon] = useState(null);

  useEffect(() => {
    let boQua = false;
    const timer = window.setTimeout(() => {
      kenhBanHangService
        .timBienThe(q.trim(), 8)
        .then((list) => (Array.isArray(list) ? list : []))
        .catch(() => [])
        .then((list) => {
          if (!boQua) setKetQua({ q, list });
        });
    }, 250);
    return () => {
      boQua = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  const dangTim = ketQua.q !== q;

  return (
    <div className="w-[380px] max-w-[92vw]">
      <p className="px-3.5 pb-1 pt-3 text-[13px] text-bo-muted">
        Ghép <span className="font-semibold tabular-nums text-bo-heading">{dong.skuSan || "—"}</span> trên {tenSan} với
      </p>
      <label className="mx-3 my-2 flex h-9 items-center gap-2 rounded-lg border border-bo-border px-2.5 focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 max-sm:h-11">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          autoFocus
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Tìm SKU hoặc tên biến thể FCentric"
          aria-label="Tìm biến thể FCentric"
          aria-controls={`${id}-ds`}
          className="min-w-0 flex-1 bg-transparent text-sm text-bo-foreground outline-none placeholder:text-slate-400"
        />
        {dangTim ? <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" aria-hidden="true" /> : null}
      </label>
      <ul id={`${id}-ds`} role="listbox" aria-label="Biến thể FCentric" className="max-h-60 overflow-y-auto px-1.5 pb-1.5">
        {!dangTim && ketQua.list.length === 0 ? (
          <li className="px-2.5 py-3 text-sm text-bo-muted">Không có biến thể phù hợp.</li>
        ) : (
          ketQua.list.map((bt) => {
            const daChon = chon?.id === bt.id;
            const dangGhepVoi = bt.id === dong.bienTheSanPhamId;
            return (
              <li key={bt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={daChon}
                  onClick={() => setChon(bt)}
                  className={cn(
                    "flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                    daChon ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle",
                  )}
                >
                  <span className="text-[13.5px] text-bo-heading">
                    {bt.maSku}
                    {dangGhepVoi ? <span className="text-bo-muted"> · đang ghép</span> : null}
                  </span>
                  <span className="truncate text-[12.5px] text-bo-muted">{[bt.tenSanPham, bt.tenBienThe].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="flex justify-end gap-2 border-t border-bo-border px-3 py-2.5">
        <Button
          type="button"
          variant="outline"
          disabled={dangGhep}
          onClick={onHuy}
          className="h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11"
        >
          Hủy bỏ
        </Button>
        <Button
          type="button"
          disabled={!chon || dangGhep || chon.id === dong.bienTheSanPhamId}
          onClick={() => chon && onGhep(chon)}
          className="h-8 gap-2 rounded-lg bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover max-sm:h-11"
        >
          {dangGhep ? <Loader2 className="size-4 animate-spin" /> : null}
          Ghép
        </Button>
      </div>
    </div>
  );
}
