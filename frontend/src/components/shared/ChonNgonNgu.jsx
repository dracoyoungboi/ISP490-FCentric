import { Check, Languages } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
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

/** Hai dòng chọn ngôn ngữ đặt trong menu tài khoản (DropdownMenuContent). */
export function MucChonNgonNgu() {
  const hienTai = ngonNguHienTai();
  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-2 px-2.5 pb-1 pt-1.5 text-xs font-medium text-bo-muted">
        <Languages className="size-3.5" aria-hidden="true" />
        {t("Ngôn ngữ")}
      </DropdownMenuLabel>
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
    </>
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
