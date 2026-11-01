import { useRef } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TheThietBi from "@/components/nguoi-dung/ho-so/TheThietBi";
import { nhomPhien, timPhien } from "@/components/nguoi-dung/ho-so/thietBiHoSo";

const NUT_DO_VIEN = "border-red-200 bg-white text-bo-danger shadow-none hover:bg-bo-danger-soft hover:text-bo-danger";

/**
 * Ngăn kéo "Xem tất cả thiết bị" (kiểu trang thiết bị của Google / GitHub): tìm theo trình duyệt, hệ điều hành
 * hoặc IP; gom "Thiết bị này" / "Thiết bị khác". Không có bộ lọc theo thời gian: phiên chỉ sống 24 giờ nên mọi
 * thiết bị trong danh sách đều mới hoạt động (xem thietBiHoSo.js). Từ khóa do cha giữ để mở lại ngăn kéo là ô tìm trống.
 */
export default function NganKeoThietBi({
  open,
  onOpenChange,
  ds,
  tomTat,
  tuKhoa,
  onTuKhoaChange,
  coThietBiKhac,
  onDangXuatMot,
  onDangXuatTatCaKhac,
}) {
  const nhom = nhomPhien(timPhien(ds, tuKhoa));
  const dangTim = tuKhoa.trim() !== "";
  const oTimRef = useRef(null);
  // Nút "Xóa tìm kiếm" biến mất sau khi bấm: đưa tiêu điểm về ô tìm để người dùng bàn phím không bị rơi về đầu trang
  const xoaTim = () => {
    onTuKhoaChange("");
    oTimRef.current?.focus();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-bo-border bg-bo-surface p-0 text-bo-foreground sm:max-w-[520px]">
        <SheetHeader className="gap-0.5 border-b border-slate-100 px-5 py-4 pr-12">
          <SheetTitle className="text-base leading-6 text-bo-foreground">Thiết bị đang đăng nhập</SheetTitle>
          <SheetDescription className="text-[12.5px] leading-[18px] text-bo-muted">{tomTat}</SheetDescription>
        </SheetHeader>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <label htmlFor="tim-thiet-bi" className="sr-only">
              Tìm thiết bị
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              id="tim-thiet-bi"
              ref={oTimRef}
              value={tuKhoa}
              onChange={(e) => onTuKhoaChange(e.target.value)}
              placeholder="Tìm theo trình duyệt, hệ điều hành hoặc IP"
              autoComplete="off"
              className="h-9 border-bo-border bg-white pl-9 text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {nhom.length ? (
            nhom.map((n) => (
              <section key={n.ma} aria-label={`${n.ten}: ${n.ds.length} thiết bị`}>
                <h3 className="mb-0.5 mt-4 text-xs font-semibold uppercase tracking-[0.04em] text-bo-muted">
                  {n.ten}
                  {/* "Thiết bị này" luôn là 1 nên không kèm số */}
                  {n.ma === "khac" ? <span className="tabular-nums text-slate-400"> · {n.ds.length}</span> : null}
                </h3>
                <ul className="m-0 list-none p-0">
                  {n.ds.map((p) => (
                    <TheThietBi key={p.id} phien={p} kieu="dong" onDangXuat={onDangXuatMot} />
                  ))}
                </ul>
              </section>
            ))
          ) : dangTim ? (
            <div className="py-10 text-center text-[13.5px] text-bo-muted">
              <p role="status" className="break-words">
                Không tìm thấy thiết bị khớp “{tuKhoa.trim()}”.
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={xoaTim}
                  className="rounded font-medium text-bo-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                >
                  Xóa tìm kiếm
                </button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-[13.5px] text-bo-muted">Không có thiết bị nào đang đăng nhập.</div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 bg-bo-surface-subtle px-5 py-3">
          <span className="text-[12.5px] text-bo-muted">Thiết bị bị đăng xuất phải đăng nhập lại.</span>
          {coThietBiKhac ? (
            <Button type="button" variant="outline" size="sm" onClick={onDangXuatTatCaKhac} className={NUT_DO_VIEN}>
              Đăng xuất các thiết bị khác
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
