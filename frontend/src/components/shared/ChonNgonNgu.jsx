import { Check, Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
 * Nút ngôn ngữ trên thanh trên cùng (cạnh chuông thông báo): biểu tượng 文A + mã "VI"/"EN",
 * bấm mở danh sách ngôn ngữ. Màn hẹp chỉ còn biểu tượng.
 * `className` là kiểu của nút để khớp các nút bên cạnh; `lopMenu` dùng khi menu cần z-index riêng (POS).
 */
export function NutChonNgonNguThanhTren({ className, lopMenu }) {
  const hienTai = ngonNguHienTai();
  const tenHienTai = CAC_NGON_NGU.find((n) => n.ma === hienTai)?.ten ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t("Ngôn ngữ")}
          aria-label={`${t("Ngôn ngữ")}: ${tenHienTai}`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            "data-[state=open]:bg-bo-primary-soft data-[state=open]:text-bo-primary data-[state=open]:hover:bg-bo-primary-soft data-[state=open]:hover:text-bo-primary",
            className,
          )}
        >
          <Languages className="size-5 shrink-0" aria-hidden="true" />
          <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline" aria-hidden="true">
            {hienTai}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn("z-50 w-44 rounded-lg border border-bo-border bg-bo-surface p-1 text-bo-foreground shadow-lg", lopMenu)}
      >
        {CAC_NGON_NGU.map(({ ma, ten }) => (
          <DropdownMenuItem
            key={ma}
            lang={ma}
            onSelect={() => chon(ma)}
            aria-current={ma === hienTai ? "true" : undefined}
            className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-950"
          >
            <span className="flex-1">{ten}</span>
            {ma === hienTai ? <Check className="size-4 text-bo-primary" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Nút gọn hai lựa chọn "VI | EN" cho trang chưa đăng nhập (Đăng nhập, Quên mật khẩu). */
export function NutChonNgonNgu({ className }) {
  const hienTai = ngonNguHienTai();
  return (
    <div role="group" aria-label={t("Ngôn ngữ")} className={cn("inline-flex rounded-md border border-bo-border bg-bo-surface p-0.5 text-xs font-medium", className)}>
      {CAC_NGON_NGU.map(({ ma, ten }) => (
        <button
          key={ma}
          type="button"
          lang={ma}
          title={ten}
          aria-pressed={ma === hienTai}
          onClick={() => chon(ma)}
          className={cn(
            "min-w-9 rounded px-2 py-1 uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            ma === hienTai ? "bg-bo-primary text-white" : "text-bo-muted hover:text-bo-foreground",
          )}
        >
          {ma}
        </button>
      ))}
    </div>
  );
}
