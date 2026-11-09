import { useState } from "react";
import { Check, ChevronDown, Store, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { laKhoTong } from "@/utils/kho";
import { t } from "@/i18n";

// Từ bao nhiêu kho thì chia nhóm Kho tổng / Cửa hàng (ít kho chia nhóm chỉ thêm tiêu đề thừa)
const NGUONG_CHIA_NHOM = 6;
const MA_MOI_KHO = "moi-kho";

const tenCuaKho = (k) => k?.tenKho || k?.ten || k?.maKho || (k?.id != null ? t("Kho #{{id}}", { id: k.id }) : "");
const boDau = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const maDong = (id) => (id == null ? MA_MOI_KHO : `kho-${id}`);

/**
 * Biểu tượng kho theo quy tắc chung của hệ thống: kho tổng là nhà kho, còn lại là cửa hàng. Dữ liệu không có loại kho
 * (vd. kho trong danh sách đợt chỉ có id, mã, tên): biểu tượng nhà kho chung, không đoán là cửa hàng.
 */
export function BieuTuongKho({ kho, className }) {
  const Icon = kho?.loaiKho == null || laKhoTong(kho) ? Warehouse : Store;
  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden="true" />;
}

/**
 * Ô chọn kho của các màn kiểm kê (Tạo đợt, lọc Danh sách, Sơ đồ khóa, Hàng chưa có kệ): bấm mở danh sách có ô tìm
 * (gõ không dấu được, chỉ so tên / mã kho), chia nhóm Kho tổng / Cửa hàng khi nhiều kho; mở ra thì dòng đang chọn được tô.
 * - `value`: id kho đang chọn; `null` = "Mọi kho" khi có `nhanMoiKho`.
 * - `onChange(id)`: gọi cả khi chọn lại đúng kho đang chọn (màn tự bỏ qua nếu không cần) — vd. Tạo đợt dùng để thôi hỏi đổi kho.
 * - `thongTin(kho)`: `{ phu, ban }` tùy chọn — dòng phụ (vd. "Kiểm toàn kho 21/10") và nhãn cam (vd. "1 đợt đang chạy").
 * - Chỉ một kho (và không có "Mọi kho"): hiện tên kho, không có gì để chọn.
 */
export default function ChonKhoKiemKe({
  dsKho = [],
  value,
  onChange,
  nhanMoiKho,
  thongTin,
  nhan = t("Kho"),
  disabled = false,
  align = "start",
  className,
}) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState("");
  const [dongTo, setDongTo] = useState("");
  const khoChon = value == null ? null : dsKho.find((k) => Number(k.id) === Number(value)) ?? null;
  const chu = khoChon ? tenCuaKho(khoChon) : nhanMoiKho || t("Chọn kho");

  if (dsKho.length === 1 && !nhanMoiKho && khoChon) {
    return (
      <div
        className={cn(
          "flex h-9 min-w-0 items-center gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 text-sm text-bo-foreground",
          className,
        )}
      >
        <BieuTuongKho kho={khoChon} className="text-bo-muted" />
        <span className="truncate font-medium">{chu}</span>
      </div>
    );
  }

  const doiMo = (m) => {
    setMo(m);
    setTim("");
    // Mở ra: tô sẵn dòng đang chọn (bàn phím / trình đọc màn hình bắt đầu từ đó, không phải dòng đầu)
    if (m) setDongTo(maDong(value == null ? null : Number(value)));
  };
  const chon = (id) => {
    doiMo(false);
    onChange?.(id);
  };

  // Tự lọc (không để cmdk so mờ): khớp tên / mã kho, không dấu
  const tu = boDau(tim);
  const khop = (k) => !tu || boDau(`${tenCuaKho(k)} ${k.maKho ?? k.ma ?? ""}`).includes(tu);
  const dsKhop = dsKho.filter(khop);
  const hienMoiKho = Boolean(nhanMoiKho) && (!tu || boDau(nhanMoiKho).includes(tu));
  const chiaNhom = dsKho.length >= NGUONG_CHIA_NHOM && dsKho.some(laKhoTong) && dsKho.some((k) => !laKhoTong(k));
  const nhom = chiaNhom
    ? [
        { ten: t("Kho tổng"), ds: dsKhop.filter(laKhoTong) },
        { ten: t("Cửa hàng"), ds: dsKhop.filter((k) => !laKhoTong(k)) },
      ]
    : [{ ten: null, ds: dsKhop }];

  const dongMoiKho = hienMoiKho ? (
    <CommandItem
      key={MA_MOI_KHO}
      value={MA_MOI_KHO}
      onSelect={() => chon(null)}
      className="items-start gap-2 py-2 data-[selected=true]:bg-bo-primary-soft data-[selected=true]:text-bo-foreground"
    >
      <Warehouse className={cn("mt-0.5 size-4 shrink-0", value == null ? "text-bo-primary" : "text-bo-muted")} aria-hidden="true" />
      <span className={cn("min-w-0 flex-1 truncate text-sm", value == null ? "font-medium text-bo-foreground" : "text-slate-700")}>
        {nhanMoiKho}
      </span>
      {value == null ? <Check className="mt-0.5 size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : null}
    </CommandItem>
  ) : null;

  const dongKho = (k) => {
    const ten = tenCuaKho(k);
    const tt = thongTin?.(k) ?? {};
    const dangChon = Number(k.id) === Number(value);
    return (
      <CommandItem
        key={k.id}
        value={maDong(Number(k.id))}
        onSelect={() => chon(Number(k.id))}
        className="items-start gap-2 py-2 data-[selected=true]:bg-bo-primary-soft data-[selected=true]:text-bo-foreground"
      >
        <BieuTuongKho kho={k} className={cn("mt-0.5", dangChon ? "text-bo-primary" : "text-bo-muted")} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={cn("truncate text-sm", dangChon ? "font-medium text-bo-foreground" : "text-slate-700")}>{ten}</span>
          {tt.phu ? <span className="truncate text-xs text-bo-muted">{tt.phu}</span> : null}
        </span>
        {tt.ban ? (
          <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2 text-xs font-medium leading-5 text-amber-700">
            {tt.ban}
          </span>
        ) : null}
        {dangChon ? <Check className="mt-0.5 size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : null}
      </CommandItem>
    );
  };

  return (
    <Popover open={mo} onOpenChange={doiMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={mo}
          aria-label={t("{{nhan}}: {{chu}}. Bấm để đổi", { nhan, chu })}
          disabled={disabled}
          className={cn(
            "h-9 min-w-0 justify-between gap-2 border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground shadow-none hover:bg-bo-surface-subtle",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {khoChon ? <BieuTuongKho kho={khoChon} className="text-bo-primary" /> : <Warehouse className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />}
            <span className="truncate font-medium">{chu}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      {/* Không có dòng phụ / nhãn: danh sách rộng đúng bằng ô chọn (tối thiểu 200px) cho thẳng mép.
          Có dòng phụ (Tạo đợt): cần rộng hơn để đủ chỗ. */}
      <PopoverContent
        align={align}
        className={cn(
          "border-bo-border bg-bo-surface p-0",
          thongTin
            ? "w-[min(380px,calc(100vw-32px))]"
            : "w-[max(var(--radix-popover-trigger-width),200px)] max-w-[calc(100vw-32px)]",
        )}
      >
        <Command
          label={t("Tìm {{nhan}}", { nhan: nhan.toLowerCase() })}
          shouldFilter={false}
          value={dongTo}
          onValueChange={setDongTo}
          className="rounded-lg [&_[data-slot=command-input-wrapper]]:border-bo-border"
        >
          <CommandInput value={tim} onValueChange={setTim} placeholder={t("Tìm kho…")} className="text-bo-foreground" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-5 text-center text-sm text-bo-muted">{t("Không có kho nào khớp “{{tuKhoa}}”", { tuKhoa: tim.trim() })}</CommandEmpty>
            {/* Chia nhóm: "Mọi kho" đứng riêng trên các tiêu đề nhóm. Không chia nhóm: chung một nhóm với các kho
                để khoảng cách giữa các dòng đều nhau (hai nhóm liền nhau bị cộng dồn đệm). */}
            {chiaNhom && dongMoiKho ? <CommandGroup>{dongMoiKho}</CommandGroup> : null}
            {nhom.map((g) =>
              g.ds.length || (!chiaNhom && dongMoiKho) ? (
                <CommandGroup key={g.ten ?? "tat-ca"} heading={g.ten ? `${g.ten} · ${g.ds.length}` : undefined}>
                  {!chiaNhom ? dongMoiKho : null}
                  {g.ds.map(dongKho)}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
