import { createElement, useRef, useState } from "react";
import { CircleCheck, CirclePause, Ellipsis, FolderInput, Pencil, Plus, ScanSearch } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MUC = "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-100";

/**
 * Menu ⋯ của một dòng.
 * - `kieu="dong"` (máy tính): ô vuông 32px cạnh các nút trên dòng, mở menu thả xuống.
 * - `kieu="dien-thoai"`: nút 44px, mở bảng trượt từ dưới lên, có thêm Thêm danh mục con và Sửa.
 *   `phu`: dòng phụ dưới tên ở đầu bảng (đường dẫn danh mục cha).
 */
export default function MenuDanhMuc({ thaoTac, kieu = "dong", phu, onThemCon, onSua, onChuyen, onXemNhanh, onDoiTrangThai }) {
  const dienThoai = kieu === "dien-thoai";
  const muc = [];
  if (dienThoai && thaoTac.themCon) muc.push("themCon");
  if (dienThoai && thaoTac.sua) muc.push("sua");
  if (thaoTac.chuyen) muc.push("chuyen");
  if (thaoTac.xemNhanh) muc.push("xemNhanh");
  if (!muc.length && !thaoTac.trangThai) return null;
  if (dienThoai) return <BangTruot thaoTac={thaoTac} phu={phu} onThemCon={onThemCon} onSua={onSua} onChuyen={onChuyen} onDoiTrangThai={onDoiTrangThai} />;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Thao tác khác cho ${thaoTac.ten}`}
          title="Thao tác khác"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors",
            "hover:border-bo-primary hover:text-bo-primary data-[state=open]:border-bo-primary data-[state=open]:text-bo-primary",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
          )}
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
        className="z-50 w-[272px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
      >
        {thaoTac.chuyen ? <MucMenu icon={FolderInput} nhan="Chuyển đến…" onSelect={onChuyen} /> : null}
        {thaoTac.xemNhanh ? <MucMenu icon={ScanSearch} nhan="Xem riêng nhánh này" onSelect={onXemNhanh} /> : null}
        {thaoTac.trangThai ? (
          <>
            {muc.length ? <DropdownMenuSeparator className="my-1 bg-bo-border" /> : null}
            <MucMenu
              icon={thaoTac.trangThai.loai === "ngung" ? CirclePause : CircleCheck}
              mauIcon={mauIconTrangThai(thaoTac.trangThai)}
              nhan={thaoTac.trangThai.nhan}
              phu={thaoTac.trangThai.phu}
              khoa={thaoTac.trangThai.khoa}
              onSelect={onDoiTrangThai}
            />
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function mauIconTrangThai(trangThai) {
  if (trangThai.khoa) return "text-slate-300";
  return trangThai.loai === "ngung" ? "text-bo-warning" : "text-bo-success";
}

/** Bảng trượt từ dưới lên của bản điện thoại: mỗi thao tác một hàng cao 52px. */
function BangTruot({ thaoTac, phu, onThemCon, onSua, onChuyen, onDoiTrangThai }) {
  const [mo, setMo] = useState(false);
  const daChon = useRef(false);

  const chon = (viec) => () => {
    daChon.current = true;
    setMo(false);
    // Mở hộp thoại tiếp theo sau khi bảng trượt đóng hẳn lớp phủ, tránh hai hộp tranh nhau giữ focus
    setTimeout(() => viec?.(), 0);
  };

  return (
    <Sheet open={mo} onOpenChange={setMo}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Thao tác cho ${thaoTac.ten}`}
          onClick={(event) => {
            event.stopPropagation();
            daChon.current = false;
          }}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={(event) => { if (daChon.current) event.preventDefault(); }}
        className="gap-0 rounded-t-xl border-bo-border bg-white px-0 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-bo-foreground"
      >
        <span aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
        <SheetHeader className="gap-0.5 border-b border-slate-100 px-5 pt-1 pb-3 pr-12 text-left">
          <SheetTitle className="truncate text-base font-semibold text-bo-foreground">{thaoTac.ten}</SheetTitle>
          <SheetDescription className="truncate text-xs text-bo-muted">{phu || "Danh mục gốc"}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col py-1">
          {thaoTac.themCon ? (
            <MucTruot icon={Plus} nhan="Thêm danh mục con" phu={thaoTac.themCon.khoa ? thaoTac.themCon.lyDo : ""} khoa={thaoTac.themCon.khoa} onClick={chon(onThemCon)} />
          ) : null}
          {thaoTac.sua ? (
            <MucTruot icon={Pencil} nhan="Sửa" phu={thaoTac.sua.khoa ? thaoTac.sua.lyDo : ""} khoa={thaoTac.sua.khoa} onClick={chon(onSua)} />
          ) : null}
          {thaoTac.chuyen ? <MucTruot icon={FolderInput} nhan="Chuyển đến…" onClick={chon(onChuyen)} /> : null}
          {thaoTac.trangThai ? (
            <>
              <span aria-hidden="true" className="mx-5 my-1 h-px bg-slate-100" />
              <MucTruot
                icon={thaoTac.trangThai.loai === "ngung" ? CirclePause : CircleCheck}
                mauIcon={mauIconTrangThai(thaoTac.trangThai)}
                nhan={thaoTac.trangThai.nhan}
                phu={thaoTac.trangThai.phu}
                khoa={thaoTac.trangThai.khoa}
                onClick={chon(onDoiTrangThai)}
              />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MucTruot({ icon, mauIcon, nhan, phu, khoa = false, onClick }) {
  return (
    <button
      type="button"
      disabled={khoa}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 px-5 py-2 text-left text-[15px] hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed"
    >
      {createElement(icon, { className: cn("size-[18px] shrink-0", mauIcon ?? (khoa ? "text-slate-300" : "text-slate-500")), "aria-hidden": true })}
      <span className="flex min-w-0 flex-col">
        <span className={cn("font-medium", khoa ? "text-slate-400" : "text-bo-foreground")}>{nhan}</span>
        {phu ? <span className="text-xs leading-4 text-bo-muted">{phu}</span> : null}
      </span>
    </button>
  );
}

function MucMenu({ icon, mauIcon, nhan, phu, khoa = false, onSelect }) {
  return (
    <DropdownMenuItem disabled={khoa} onSelect={onSelect} className={MUC}>
      {createElement(icon, { className: cn("mt-0.5 size-4 shrink-0", mauIcon ?? (khoa ? "text-slate-300" : "text-slate-400")), "aria-hidden": true })}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("font-medium", khoa ? "text-slate-400" : "text-bo-foreground")}>{nhan}</span>
        {phu ? <span className="text-xs leading-4 text-bo-muted">{phu}</span> : null}
      </span>
    </DropdownMenuItem>
  );
}
