import { createElement, useState } from "react";
import { CircleCheck, CirclePause, Ellipsis, FolderInput, Pencil, Plus, ScanSearch } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SheetDay from "@/components/shared/SheetDay";
import { cn } from "@/lib/utils";

// Máy tính bảng dọc (cảm ứng): mục menu cao ~44px
const MUC = "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-100 cam-ung:max-lg:py-3";

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
        className="z-50 w-[272px] rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
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

/**
 * Bảng trượt từ dưới lên của bản điện thoại: dùng SheetDay (cùng khung với sheet ⋯ của Sản phẩm, Thuộc tính: tay nắm,
 * nút đóng 44px, chừa khoảng an toàn đáy máy). Mỗi thao tác một hàng cao 52px; dòng phụ dưới tiêu đề là đường dẫn cha.
 */
function BangTruot({ thaoTac, phu, onThemCon, onSua, onChuyen, onDoiTrangThai }) {
  const [mo, setMo] = useState(false);

  // Đóng bảng trượt trước rồi mới mở hộp thoại kế tiếp, tránh hai lớp phủ tranh nhau giữ tiêu điểm
  const chon = (viec) => () => {
    setMo(false);
    setTimeout(() => viec?.(), 0);
  };

  return (
    <SheetDay
      mo={mo}
      onDoiMo={setMo}
      tieuDe={thaoTac.ten}
      moTa={`Thao tác với danh mục ${thaoTac.ten}`}
      kichHoat={
        <button
          type="button"
          aria-label={`Thao tác cho ${thaoTac.ten}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </button>
      }
    >
      <p className="-mt-1 mb-1 truncate text-xs text-bo-muted">{phu || "Danh mục gốc"}</p>
      <div className="-mx-1 flex flex-col">
        {thaoTac.themCon ? (
          <MucTruot icon={Plus} nhan="Thêm danh mục con" phu={thaoTac.themCon.khoa ? thaoTac.themCon.lyDo : ""} khoa={thaoTac.themCon.khoa} onClick={chon(onThemCon)} />
        ) : null}
        {thaoTac.sua ? (
          <MucTruot icon={Pencil} nhan="Sửa" phu={thaoTac.sua.khoa ? thaoTac.sua.lyDo : ""} khoa={thaoTac.sua.khoa} onClick={chon(onSua)} />
        ) : null}
        {thaoTac.chuyen ? <MucTruot icon={FolderInput} nhan="Chuyển đến…" onClick={chon(onChuyen)} /> : null}
        {thaoTac.trangThai ? (
          <>
            <span aria-hidden="true" className="mx-1 my-1 h-px bg-slate-100" />
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
    </SheetDay>
  );
}

function MucTruot({ icon, mauIcon, nhan, phu, khoa = false, onClick }) {
  return (
    <button
      type="button"
      disabled={khoa}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-md px-1 py-2 text-left text-[15px] hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed"
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
