import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TheThietBi from "@/components/nguoi-dung/ho-so/TheThietBi";
import { LOC_THIET_BI, locPhien, nhomTheoThoiGian } from "@/components/nguoi-dung/ho-so/thietBiHoSo";
import { cn } from "@/lib/utils";

const NUT_DO_VIEN = "border-red-200 bg-white text-bo-danger shadow-none hover:bg-bo-danger-soft hover:text-bo-danger";

/**
 * Ngăn kéo "Xem tất cả thiết bị" (kiểu trang thiết bị của Google / GitHub): tìm theo trình duyệt, hệ điều hành
 * hoặc IP; lọc Tất cả / Hôm nay / Lâu không dùng; gom theo thời gian. Thao tác đăng xuất hàng loạt ở chân ngăn kéo
 * đổi theo bộ lọc. Trạng thái lọc do cha giữ để mở ngăn kéo từ liên kết "N không dùng hơn 7 ngày" là lọc sẵn.
 */
export default function NganKeoThietBi({
  open,
  onOpenChange,
  ds,
  tomTat,
  loc,
  onLocChange,
  tuKhoa,
  onTuKhoaChange,
  soLauKhongDung,
  coThietBiKhac,
  onDangXuatMot,
  onDangXuatLauKhongDung,
  onDangXuatTatCaKhac,
}) {
  const daLoc = locPhien(ds, { loc, tuKhoa });
  const nhom = nhomTheoThoiGian(daLoc);
  const demTheoLoc = Object.fromEntries(LOC_THIET_BI.map((l) => [l.ma, locPhien(ds, { loc: l.ma }).length]));
  const xoaLoc = () => {
    onLocChange("tat_ca");
    onTuKhoaChange("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-bo-border bg-bo-surface p-0 text-bo-foreground sm:max-w-[520px]">
        <SheetHeader className="gap-0.5 border-b border-slate-100 px-5 py-4 pr-12">
          <SheetTitle className="text-base leading-6 text-bo-foreground">Thiết bị đang đăng nhập</SheetTitle>
          <SheetDescription className="text-[12.5px] leading-[18px] text-bo-muted">{tomTat}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <label htmlFor="tim-thiet-bi" className="sr-only">
              Tìm thiết bị
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              id="tim-thiet-bi"
              value={tuKhoa}
              onChange={(e) => onTuKhoaChange(e.target.value)}
              placeholder="Tìm theo trình duyệt, hệ điều hành hoặc IP"
              autoComplete="off"
              className="h-9 border-bo-border bg-white pl-9 text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
            />
          </div>
          <div role="group" aria-label="Lọc theo lần hoạt động" className="flex gap-1 rounded-lg bg-slate-100 p-[3px]">
            {LOC_THIET_BI.map((l) => {
              const chon = l.ma === loc;
              return (
                <button
                  key={l.ma}
                  type="button"
                  aria-pressed={chon}
                  onClick={() => onLocChange(l.ma)}
                  className={cn(
                    "h-8 flex-1 whitespace-nowrap rounded-md px-2 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bo-primary/40",
                    chon ? "bg-white text-bo-heading shadow-sm" : "text-slate-600 hover:text-bo-foreground",
                  )}
                >
                  {l.ten} <span className="tabular-nums text-slate-400">{demTheoLoc[l.ma]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {nhom.length ? (
            nhom.map((n) => (
              <section key={n.ma} aria-label={`${n.ten}: ${n.ds.length} thiết bị`}>
                <h3 className="mb-0.5 mt-4 text-xs font-semibold uppercase tracking-[0.04em] text-bo-muted">
                  {n.ten} <span className="tabular-nums text-slate-400">· {n.ds.length}</span>
                </h3>
                <ul className="m-0 list-none p-0">
                  {n.ds.map((p) => (
                    <TheThietBi key={p.id} phien={p} kieu="dong" onDangXuat={onDangXuatMot} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div className="py-10 text-center text-[13.5px] text-bo-muted">
              Không có thiết bị nào khớp.
              <div className="mt-2">
                <button type="button" onClick={xoaLoc} className="rounded font-medium text-bo-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40">
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 bg-bo-surface-subtle px-5 py-3">
          <span className="text-[12.5px] text-bo-muted">Thiết bị bị đăng xuất phải đăng nhập lại.</span>
          {loc === "lau_khong_dung" && soLauKhongDung > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onDangXuatLauKhongDung} className={NUT_DO_VIEN}>
              Đăng xuất {soLauKhongDung} thiết bị lâu không dùng
            </Button>
          ) : loc !== "lau_khong_dung" && coThietBiKhac ? (
            <Button type="button" variant="outline" size="sm" onClick={onDangXuatTatCaKhac} className={NUT_DO_VIEN}>
              Đăng xuất tất cả thiết bị khác
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
