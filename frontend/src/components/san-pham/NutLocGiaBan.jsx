import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

// Giá trị lọc là chuỗi chữ số ("" = không giới hạn); ô hiển thị kiểu Việt Nam 1.500.000
const SO_CHU_SO_TOI_DA = 12;
const chiChuSo = (v) => String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, SO_CHU_SO_TOI_DA);
const hienSo = (v) => (v === "" ? "" : formatNumber(Number(v)));

/** Nhãn nút: chưa lọc "Giá bán"; đang lọc thì hiện khoảng đã áp. */
function nhanNut(tu, den) {
  if (tu && den) return `${hienSo(tu)} – ${hienSo(den)} ₫`;
  if (tu) return t("Từ {{gia}} ₫", { gia: hienSo(tu) });
  if (den) return t("Đến {{gia}} ₫", { gia: hienSo(den) });
  return t("Giá bán");
}

function OTien({ id, nhan, value, onChange, onEnter, coLoi, moTaLoi }) {
  return (
    <label htmlFor={id} className="grid min-w-0 gap-1 text-xs text-bo-muted">
      {nhan}
      <span className="relative">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={hienSo(value)}
          onChange={(e) => onChange(chiChuSo(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={coLoi || undefined}
          aria-describedby={coLoi ? moTaLoi : undefined}
          className={cn(
            "h-9 w-full rounded-md border border-bo-border bg-bo-surface pr-6 pl-2.5 text-right text-sm tabular-nums text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15",
            coLoi && "border-red-500 focus:border-red-500 focus:ring-red-500/15",
          )}
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-bo-muted">
          ₫
        </span>
      </span>
    </label>
  );
}

/**
 * Lọc khoảng giá bán trên trang Sản phẩm (máy tính): một nút cùng kiểu nút Thương hiệu, bấm mở hộp Từ – Đến.
 * Chỉ áp khi bấm Áp dụng / Enter; nhập một đầu cũng được. Điện thoại vẫn dùng hai ô trong sheet Bộ lọc.
 */
export default function NutLocGiaBan({ giaTu, giaDen, onApDung }) {
  const id = useId();
  const [mo, setMo] = useState(false);
  const [tu, setTu] = useState("");
  const [den, setDen] = useState("");
  const dangLoc = Boolean(giaTu || giaDen);
  const sai = tu !== "" && den !== "" && Number(den) < Number(tu);

  const doiMo = (moMoi) => {
    // Mở lại thì ô hiện đúng khoảng đang áp (bỏ phần đã gõ mà chưa áp)
    if (moMoi) {
      setTu(chiChuSo(giaTu));
      setDen(chiChuSo(giaDen));
    }
    setMo(moMoi);
  };
  const apDung = () => {
    if (sai) return;
    onApDung(tu, den);
    setMo(false);
  };
  const xoa = () => {
    onApDung("", "");
    setMo(false);
  };

  return (
    <Popover open={mo} onOpenChange={doiMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={dangLoc ? t("Lọc giá bán: {{khoang}}", { khoang: nhanNut(giaTu, giaDen) }) : t("Lọc theo giá bán")}
          className={cn(
            "h-9 shrink-0 justify-between gap-2 border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground tabular-nums hover:bg-bo-surface-subtle",
            dangLoc && "border-bo-primary bg-bo-primary-soft text-bo-primary-strong hover:bg-bo-primary-soft",
          )}
        >
          {nhanNut(giaTu, giaDen)}
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="grid w-72 gap-3 border-bo-border bg-bo-surface p-3.5 text-bo-foreground shadow-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(`${id}-tu`)?.focus();
        }}
      >
        <p className="text-sm font-semibold">{t("Giá bán")}</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          {/* Không chữ gợi ý: ô hẹp, nhãn Từ / Đến đã đủ; để trống = không giới hạn đầu đó */}
          <OTien id={`${id}-tu`} nhan={t("Từ")} value={tu} onChange={setTu} onEnter={apDung} />
          <span aria-hidden="true" className="pb-2 text-bo-muted">–</span>
          <OTien
            id={`${id}-den`}
            nhan={t("Đến")}
            value={den}
            onChange={setDen}
            onEnter={apDung}
            coLoi={sai}
            moTaLoi={`${id}-loi`}
          />
        </div>
        {sai ? (
          <p id={`${id}-loi`} className="text-xs text-red-600">
            {t("Giá đến phải lớn hơn hoặc bằng giá từ.")}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={xoa} className="h-8 px-2 text-sm font-normal text-bo-muted hover:text-bo-foreground">
            {t("Xóa")}
          </Button>
          <Button
            type="button"
            onClick={apDung}
            disabled={sai}
            className="h-8 bg-bo-primary px-4 text-sm font-semibold text-white hover:bg-bo-primary-hover"
          >
            {t("Áp dụng")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
