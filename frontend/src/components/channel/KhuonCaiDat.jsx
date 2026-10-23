import { useId } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { cn } from "@/lib/utils";

/**
 * Khuôn trang cài đặt của kênh bán (Cấu hình, Thiết lập), theo kiểu trang cài đặt của Shopify / Stripe:
 * một cột hẹp ở giữa, mỗi nhóm một thẻ, mỗi tùy chọn một dòng (tên và tối đa 1 câu bên trái, điều khiển bên phải),
 * tùy chọn nâng cao ẩn sau "Tùy chỉnh", thanh "Có thay đổi chưa lưu" đè lên thanh trên cùng.
 */

/**
 * Vùng chạm của công tắc (Switch 32×18) trên điện thoại (dưới 640 px): lớp ::after trong suốt nới ra 44×44 quanh công tắc,
 * hình và chỗ của công tắc không đổi (cùng cách nút của components/ui/sidebar). Màn rộng giữ nguyên.
 */
export const VUNG_CHAM_CONG_TAC = "max-sm:relative max-sm:after:absolute max-sm:after:-inset-x-1.5 max-sm:after:-inset-y-[13px]";

/**
 * Cột nội dung của Thiết lập và màn giới thiệu: rộng hết vùng nội dung như Sản phẩm, Đơn hàng, Cấu hình,
 * hai mép thẳng với thanh trên cùng ở mọi khổ màn (không chừa khoảng trống một bên).
 */
export function CotCaiDat({ children, className }) {
  return <div className={cn("flex w-full flex-col gap-4", className)}>{children}</div>;
}

/** Một thẻ nhóm. Các con (DongCaiDat) tự kẻ đường ngăn giữa nhau. */
export function TheCaiDat({ title, description, children, className, ...props }) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn("rounded-lg border border-bo-border bg-white shadow-sm", className)}
      {...props}
    >
      {title ? (
        <div className="px-6 pb-1 pt-5">
          <h2 id={id} className="text-[15px] font-semibold leading-6 text-bo-heading">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{description}</p> : null}
        </div>
      ) : null}
      <div className="divide-y divide-[#eef1f5]">{children}</div>
    </section>
  );
}

/**
 * Một dòng tùy chọn: tên (+ một câu) bên trái, điều khiển bên phải.
 * `children`: phần mở rộng bên dưới dòng (vd. các ô của "Tùy chỉnh").
 * `htmlFor`: id của điều khiển để bấm vào tên cũng chọn được.
 * `giaTriChu`: điều khiển chỉ là chữ (dòng khóa–giá trị như "Đơn hủy", "Chu kỳ chạy"): trên điện thoại giá trị luôn
 * nằm dưới tên, để các dòng trong thẻ thẳng nhau dù giá trị dài hay ngắn.
 */
export function DongCaiDat({ title, description, control, htmlFor, children, className, motaId, giaTriChu = false }) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {/* Thiếu chỗ (điện thoại) thì điều khiển xuống hàng dưới tên, không ép tên thành cột hẹp */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-44">
          {htmlFor ? (
            <label htmlFor={htmlFor} className="cursor-pointer text-sm font-medium text-bo-heading">
              {title}
            </label>
          ) : (
            <p className="text-sm font-medium text-bo-heading">{title}</p>
          )}
          {description ? (
            <p id={motaId} className="mt-0.5 text-[13px] leading-5 text-bo-muted">
              {description}
            </p>
          ) : null}
        </div>
        {control ? <div className={cn("flex shrink-0 items-center gap-2", giaTriChu && "max-sm:basis-full")}>{control}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

/** Dòng có công tắc bật/tắt ở bên phải. */
export function DongCongTac({ title, description, checked, onCheckedChange, disabled = false }) {
  const id = useId();
  return (
    <DongCaiDat
      title={title}
      description={description}
      htmlFor={id}
      motaId={description ? `${id}-mo-ta` : undefined}
      control={
        <Switch
          id={id}
          checked={Boolean(checked)}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-describedby={description ? `${id}-mo-ta` : undefined}
          className={cn(SWITCH_CLASS, VUNG_CHAM_CONG_TAC)}
        />
      }
    />
  );
}

const PHIM_DI_CHUYEN = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Nút chọn 2–3 phương án dạng phân đoạn (vd. "Bằng số khả dụng | Tùy chỉnh"), theo mẫu radiogroup: Tab vào nhóm dừng ở
 * lựa chọn đang chọn (roving tabindex), mũi tên trái/phải (hoặc lên/xuống) đổi lựa chọn và chuyển tiêu điểm theo,
 * Home/End về lựa chọn đầu/cuối. Khóa (`disabled`) thì không nhận phím.
 */
export function ChonPhuongAn({ value, options, onChange, label, disabled = false, className }) {
  const viTriChon = options.findIndex((option) => option.value === value);
  const viTriTab = viTriChon >= 0 ? viTriChon : 0;

  const doiBangPhim = (event, viTri) => {
    if (disabled || !options.length) return;
    let moi;
    if (PHIM_DI_CHUYEN[event.key]) moi = (viTri + PHIM_DI_CHUYEN[event.key] + options.length) % options.length;
    else if (event.key === "Home") moi = 0;
    else if (event.key === "End") moi = options.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll('[role="radio"]')[moi]?.focus();
    if (options[moi].value !== value) onChange(options[moi].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn("inline-flex shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5", className)}
    >
      {options.map((option, viTri) => {
        const chon = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={chon}
            tabIndex={viTri === viTriTab ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => doiBangPhim(event, viTri)}
            className={cn(
              "h-7 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed max-sm:h-11",
              chon ? "bg-white text-bo-heading shadow-[0_1px_2px_rgba(15,23,42,0.14)]" : "text-bo-muted hover:text-bo-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Ô số nhỏ có đơn vị, nhãn ở trên (dùng trong khối "Tùy chỉnh"). */
export function OSoNho({ label, unit, value, onChange, error, disabled = false, min, max }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] text-bo-muted">
        {label}
      </label>
      <div
        className={cn(
          "inline-flex h-8 items-center rounded-lg border bg-white focus-within:ring-2 max-sm:h-11",
          error ? "border-bo-danger focus-within:ring-bo-danger/15" : "border-bo-border focus-within:border-bo-primary focus-within:ring-bo-primary/15",
        )}
      >
        <input
          id={id}
          type="number"
          inputMode="numeric"
          step={1}
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-loi` : undefined}
          className="h-full w-16 rounded-l-lg border-0 bg-transparent px-2 text-right text-sm tabular-nums text-bo-foreground outline-none [appearance:textfield] disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit ? <span className="pr-2.5 text-[13px] text-bo-muted">{unit}</span> : null}
      </div>
      {error ? (
        <p id={`${id}-loi`} className="mt-1 max-w-[180px] text-xs text-bo-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Thanh "Có thay đổi chưa lưu" đè lên thanh trên cùng của trang (như Shopify), chỉ hiện khi có thay đổi.
 * Gắn vào #backoffice-header; không tìm thấy thì nằm dính ở đầu vùng nội dung.
 */
export function ThanhLuuTrenCung({ hien, dangLuu = false, khoa = false, onHuy, onLuu, nhanLuu = "Lưu" }) {
  if (!hien) return null;
  const header = typeof document === "undefined" ? null : document.getElementById("backoffice-header");
  const thanh = (
    <div
      role="region"
      aria-label="Thay đổi chưa lưu"
      className={cn(
        "z-50 flex items-center gap-3 bg-bo-sidebar px-3 text-white sm:px-4 lg:px-5",
        header ? "absolute inset-0" : "sticky top-0 -mx-4 -mt-4 mb-4 h-14 sm:-mx-5 sm:-mt-5 lg:-mx-6 lg:-mt-6",
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span className="truncate">Có thay đổi chưa lưu</span>
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={khoa || dangLuu}
          onClick={onHuy}
          className="h-8 rounded-lg border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white max-sm:h-11"
        >
          Hủy bỏ
        </Button>
        <Button
          type="button"
          disabled={khoa || dangLuu}
          onClick={onLuu}
          className="h-8 gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover max-sm:h-11"
        >
          {dangLuu ? <Loader2 className="size-4 animate-spin" /> : null}
          {dangLuu ? "Đang lưu…" : nhanLuu}
        </Button>
      </div>
    </div>
  );
  return header ? createPortal(thanh, header) : thanh;
}
