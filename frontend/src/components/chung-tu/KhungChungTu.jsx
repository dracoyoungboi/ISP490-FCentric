import { cn } from "@/lib/utils";

/**
 * Khung "một khối" của màn chi tiết chứng từ (rút từ Chi tiết đơn mua hàng đã chốt): một <article> trắng giãn hết
 * chiều ngang và chiều cao còn lại của PageContainer, thứ tự từ trên xuống:
 * đầu khối (`dau`) · tiến trình (`tienTrinh`) · các dòng thông báo (`thongBao`) · thân 2 cột (`chinh` + `cotPhai`) · `chan`.
 *
 * - Thân: bảng hàng bên trái, cột thuộc tính 340px bên phải từ 1280px; hẹp hơn thì cột phải xuống dưới bảng.
 * - `thongBao`: một hay nhiều DongThongBao, xếp cách nhau 8px trên nền trắng, có vạch ngăn với phần trên.
 * - Khối là container `@container/khoi`: các phần bên trong chia cột theo BỀ RỘNG KHỐI (`@2xl/khoi:` = khối ≥ 672px),
 *   không theo khổ màn hình — ở 768px có thanh bên, khối chỉ còn ~470px nên vẫn xếp như điện thoại.
 * - Màn đặt khung trong `<PageContainer className="flex min-h-full flex-col">` để khối giãn hết chiều cao.
 */
export default function KhungChungTu({ dau, tienTrinh, thongBao, chinh, cotPhai, chan, className, ...props }) {
  return (
    <article
      className={cn(
        "@container/khoi flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm",
        className,
      )}
      {...props}
    >
      {dau}
      {tienTrinh}
      {thongBao ? (
        <div className="flex flex-col gap-2 border-t border-bo-border px-4 py-3 sm:px-6 sm:py-4">{thongBao}</div>
      ) : null}
      <div
        className={cn(
          "grid flex-1 border-t border-bo-border",
          cotPhai ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1",
        )}
      >
        <div className="flex min-w-0 flex-col">{chinh}</div>
        {cotPhai}
      </div>
      {chan}
    </article>
  );
}
