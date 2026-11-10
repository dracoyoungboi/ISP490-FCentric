import { Check, ChevronDown, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { xinRoiTrang } from "@/lib/chanRoiTrang";
import { cn } from "@/lib/utils";
import { doiNgonNgu, NGON_NGU, ngonNguHienTai, t } from "@/i18n";

/** Tên ngôn ngữ ghi bằng chính ngôn ngữ đó, để người không đọc được ngôn ngữ đang hiện vẫn tìm ra. */
const CAC_NGON_NGU = [
  { ma: NGON_NGU.vi, ten: "Tiếng Việt" }, // i18n-giu-nguyen: tên ngôn ngữ ghi bằng chính ngôn ngữ đó
  { ma: NGON_NGU.en, ten: "English" },
];

/** Đổi ngôn ngữ phải tải lại trang: đi qua lớp chặn rời trang để không mất dữ liệu đang nhập. */
function chon(ma) {
  if (ma === ngonNguHienTai()) return;
  xinRoiTrang(() => doiNgonNgu(ma));
}

/**
 * Dải ngôn ngữ ở đáy menu tài khoản (thanh trên trang quản trị và POS), cùng ý với chân trang trang Đăng nhập:
 * "🌐 Tiếng Việt · English" chữ nhỏ xám, cùng một tông với menu (không tô nền); ngôn ngữ đang dùng đậm hơn,
 * bấm ngôn ngữ kia là đổi. Đặt làm phần tử CUỐI của DropdownMenuContent (có p-1): lề âm cho đường kẻ chạm mép menu.
 * px-3.5 bù lề âm để quả địa cầu cùng mép trái 14px với icon các dòng trên (p-1 + px-2.5); quả địa cầu nằm giữa ô 16px
 * cho tâm thẳng với icon size-4.
 */
export function DaiNgonNguChanMenu() {
  const hienTai = ngonNguHienTai();
  return (
    <div
      role="group"
      aria-label={t("Ngôn ngữ")}
      className="-mx-1 mt-1 flex items-center gap-1 border-t border-bo-border px-3.5 pb-0.5 pt-1.5 text-xs text-slate-400"
    >
      <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
        <Globe className="size-3.5" />
      </span>
      {CAC_NGON_NGU.map(({ ma, ten }, i) => (
        <span key={ma} className="contents">
          {i > 0 ? <span aria-hidden="true" className="text-slate-300">·</span> : null}
          {ma === hienTai ? (
            <span lang={ma} aria-current="true" className="select-none px-1.5 py-1 font-semibold text-slate-700">
              {ten}
            </span>
          ) : (
            <DropdownMenuItem
              lang={ma}
              onSelect={() => chon(ma)}
              className="cursor-pointer select-none rounded px-1.5 py-1 text-xs text-slate-400 focus:bg-slate-100 focus:text-slate-900"
            >
              {ten}
            </DropdownMenuItem>
          )}
        </span>
      ))}
    </div>
  );
}

/** Các dòng ngôn ngữ trong menu: tên đầy đủ, dòng đang dùng tô nền xám + dấu ✓ màu chính. */
function CacMucNgonNgu({ hienTai }) {
  return CAC_NGON_NGU.map(({ ma, ten }) => (
    <DropdownMenuItem
      key={ma}
      lang={ma}
      onSelect={() => chon(ma)}
      aria-current={ma === hienTai ? "true" : undefined}
      className={cn(
        "cursor-pointer select-none rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-950",
        ma === hienTai && "bg-slate-100 font-medium text-slate-950",
      )}
    >
      <span className="flex-1">{ten}</span>
      {ma === hienTai ? <Check className="size-4 text-bo-primary" aria-hidden="true" /> : null}
    </DropdownMenuItem>
  ));
}

/**
 * Chọn ngôn ngữ ở chân trang các trang chưa đăng nhập (Đăng nhập, Quên mật khẩu), kiểu Google:
 * chữ trơn "🌐 Tiếng Việt ▾" cùng màu chữ phụ của chân trang, bấm mở danh sách xổ lên trên.
 */
export function NutChonNgonNgu({ className }) {
  const hienTai = ngonNguHienTai();
  const tenHienTai = CAC_NGON_NGU.find((n) => n.ma === hienTai)?.ten ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("Ngôn ngữ")}: ${tenHienTai}`}
          className={cn(
            "group inline-flex select-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-bo-muted transition-colors",
            "hover:bg-slate-100 hover:text-bo-foreground data-[state=open]:bg-slate-100 data-[state=open]:text-bo-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            className,
          )}
        >
          <Globe className="size-3.5 shrink-0" aria-hidden="true" />
          <span lang={hienTai}>{tenHienTai}</span>
          <ChevronDown
            className="size-3 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="center"
        sideOffset={6}
        className="z-50 w-44 rounded-lg border border-bo-border bg-bo-surface p-1 text-bo-foreground shadow-lg"
      >
        <CacMucNgonNgu hienTai={hienTai} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
