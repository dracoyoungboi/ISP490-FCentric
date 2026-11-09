import { Monitor, Smartphone, Tablet } from "lucide-react";

import { cn } from "@/lib/utils";
import { dongPhuPhien } from "@/components/nguoi-dung/ho-so/thietBiHoSo";
import { ngayGio } from "@/components/nguoi-dung/phanQuyen";
import { t } from "@/i18n";

const ICON_LOAI = { "dien-thoai": Smartphone, "may-tinh-bang": Tablet, "may-tinh": Monitor };

/**
 * Đánh dấu thiết bị đang dùng (chốt C1, 31/10/2026): chỉ chữ "Thiết bị này" đậm màu xanh ở đầu dòng phụ, cùng biểu tượng
 * nền xanh nhạt; thẻ vẫn trắng viền xám như mọi thẻ khác (không tô nền, không nhãn) để không chồng nhiều lớp xanh.
 */
function ChuThietBiNay() {
  return (
    <>
      <span className="font-semibold text-blue-700">{t("Thiết bị này")}</span>
      {" · "}
    </>
  );
}

/**
 * Thẻ đầy đủ khi tài khoản chỉ đăng nhập trên đúng thiết bị đang dùng (mẫu B, 31/10/2026): trải hết chiều ngang,
 * thêm "Đăng nhập lúc", "Địa chỉ IP" (và "Vị trí" nếu có) để mục không bị hở nửa phải. Khung hẹp thì xếp dọc.
 */
export function TheThietBiDayDu({ phien }) {
  const Icon = ICON_LOAI[phien.loai] || Monitor;
  const ttin = [
    [t("Đăng nhập lúc"), phien.taoLuc ? ngayGio(phien.taoLuc) : "—", "tabular-nums"],
    [t("Địa chỉ IP"), phien.diaChiIp || "—", "font-mono text-[13px]"],
    ...(phien.viTri ? [[t("Vị trí"), phien.viTri, ""]] : []),
  ];
  return (
    <div className="@container">
      <div className="flex flex-col gap-3 rounded-lg border border-bo-border bg-bo-surface px-4 py-3.5 @xl:flex-row @xl:items-center @xl:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-bo-primary-soft text-bo-primary">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-5 text-bo-foreground">{phien.ten}</div>
            <p className="mt-0.5 text-[12.5px] leading-[18px] text-bo-muted">
              <ChuThietBiNay />
              {t("Đang hoạt động · Không có thiết bị nào khác")}
            </p>
          </div>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-3 @xl:flex-nowrap @xl:gap-x-6 @xl:border-l @xl:border-t-0 @xl:pl-5 @xl:pt-0">
          {ttin.map(([nhan, giaTri, cls]) => (
            <div key={nhan} className="min-w-0">
              <dt className="text-xs leading-4 text-bo-muted">{nhan}</dt>
              <dd className={cn("m-0 mt-0.5 whitespace-nowrap text-[13.5px] leading-5 text-bo-foreground", cls)}>{giaTri}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * Một thiết bị đang đăng nhập. Nút Đăng xuất chỉ hiện khi rê chuột / Tab tới thiết bị (máy cảm ứng luôn hiện) để
 * không lặp lại cả cột chữ "Đăng xuất" (chốt 01/11/2026: ngăn kéo làm giống thẻ trên trang).
 * - `kieu="the"`: thẻ có khung trong lưới trên trang.
 * - `kieu="dong"`: dòng trong ngăn kéo "Xem tất cả thiết bị"; rê chuột thì tô nền nhạt cả dòng cho thấy bấm được
 *   (thiết bị này không có nút nên không tô).
 */
export default function TheThietBi({ phien, kieu = "the", onDangXuat, className }) {
  const Icon = ICON_LOAI[phien.loai] || Monitor;
  const laThe = kieu === "the";
  const nay = Boolean(phien.thietBiNay);
  const coNut = !nay && Boolean(onDangXuat);

  const noiDung = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[9px]",
          nay ? "bg-bo-primary-soft text-bo-primary" : "bg-slate-100 text-slate-600",
        )}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      {/* Điện thoại: tên và dòng phụ xuống tối đa hai dòng — một dòng 390px cắt mất IP, nơi đăng nhập ("Samsung Internet · A…") */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-5 text-bo-foreground max-md:line-clamp-2 max-md:whitespace-normal">{phien.ten}</div>
        <p className="mt-0.5 truncate text-[12.5px] leading-[18px] text-bo-muted max-md:line-clamp-2 max-md:whitespace-normal">
          {nay ? <ChuThietBiNay /> : null}
          {dongPhuPhien(phien) || "—"}
        </p>
        {!laThe && phien.taoLuc ? (
          <p className="truncate text-[12px] leading-[17px] text-slate-400">{t("Đăng nhập {{luc}}", { luc: ngayGio(phien.taoLuc) })}</p>
        ) : null}
      </div>
      {coNut ? (
        <button
          type="button"
          onClick={() => onDangXuat(phien)}
          aria-label={t("Đăng xuất {{ten}}, {{chiTiet}}", { ten: phien.ten, chiTiet: dongPhuPhien(phien) })}
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13px] font-medium text-bo-muted outline-none transition-[opacity,background-color,color]",
            "hover:bg-bo-danger-soft hover:text-bo-danger focus-visible:ring-2 focus-visible:ring-bo-primary/40",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        >
          {t("Đăng xuất")}
        </button>
      ) : null}
    </>
  );

  if (laThe) {
    return (
      <li className={cn("group flex min-w-0 items-center gap-3 rounded-lg border border-bo-border bg-bo-surface p-3", className)}>{noiDung}</li>
    );
  }
  // Dòng: nền tô nằm trong, cách đường kẻ 4px trên/dưới; tổng khoảng đệm dọc vẫn 10px như trước
  return (
    <li className="border-b border-slate-100 py-1 last:border-b-0">
      <div
        className={cn(
          "group -mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5",
          coNut && "transition-colors hover:bg-bo-surface-subtle focus-within:bg-bo-surface-subtle",
        )}
      >
        {noiDung}
      </div>
    </li>
  );
}
