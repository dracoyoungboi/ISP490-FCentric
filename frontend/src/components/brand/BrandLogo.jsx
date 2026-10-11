import { cn } from '@/lib/utils';

/**
 * BrandLogo — logo dùng chung cho toàn hệ thống FCentric.
 *
 * variants:
 *  - sidebar            : icon + "FCentric" + "Quản lý kho thời trang" (nền sidebar tối)
 *  - sidebar-collapsed  : icon đơn, căn giữa (frame 40×40)
 *  - header             : lockup đầy đủ, cỡ nhỏ cho header (nền sáng)
 *  - auth               : lockup đầy đủ cho trang xác thực (nền sáng; `chip` bọc nền trắng khi đặt trên ảnh)
 *  - compact            : lockup đầy đủ, cỡ nhỏ cho storefront / supplier
 */
const ASSETS = {
  full: '/branding/f-centric-logo.svg',
  icon: '/branding/f-centric-icon.svg',
};

const ALT = 'FCentric – Quản lý kho thời trang';

export default function BrandLogo({ variant = 'auth', chip = false, className = '' }) {
  if (variant === 'sidebar') {
    return (
      <span className={cn('flex min-w-0 items-center gap-3', className)}>
        <img
          src={ASSETS.icon}
          alt=""
          className="size-10 shrink-0 object-contain"
          draggable={false}
        />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-bold tracking-wide text-white">
            FCentric
          </span>
          <span className="block truncate text-[10px] font-medium text-bo-sidebar-muted">
            Quản lý kho thời trang
          </span>
        </span>
      </span>
    );
  }

  if (variant === 'sidebar-collapsed') {
    return (
      <span className={cn('flex items-center justify-center', className)}>
        <img
          src={ASSETS.icon}
          alt={ALT}
          className="size-10 shrink-0 object-contain"
          draggable={false}
        />
      </span>
    );
  }

  const img = (
    <img
      src={ASSETS.full}
      alt={ALT}
      draggable={false}
      className={cn(
        'w-auto max-w-full shrink-0 object-contain object-left',
        variant === 'header' && 'h-7.5 max-w-[170px]',
        variant === 'auth' && 'h-12 max-w-[240px] max-sm:max-w-[210px]',
        variant === 'compact' && 'h-9 max-w-[180px]',
        className,
      )}
    />
  );

  if (chip) {
    return (
      <span className="inline-flex shrink-0 rounded-xl bg-white px-4 py-2.5">{img}</span>
    );
  }
  return img;
}
