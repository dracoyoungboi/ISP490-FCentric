import { createElement } from "react";
import { Ellipsis } from "lucide-react";
import SheetDay from "@/components/shared/SheetDay";
import { cn } from "@/lib/utils";

/**
 * Nút ⋯ 44px của thẻ (điện thoại) / dòng bảng (máy tính bảng dọc, cảm ứng): thay cho các nút thao tác 32px chỉ có icon.
 * `nhan`: tên đối tượng để đọc màn hình ("Thao tác cho Áo thun …"). `vien`: có viền như nút trong bảng.
 */
export function NutThaoTac({ nhan, onClick, vien = false, className }) {
  return (
    <button
      type="button"
      aria-label={`Thao tác cho ${nhan}`}
      onClick={(event) => {
        // Dòng bảng có onClick riêng (mở sửa): bấm ⋯ không bấm theo cả dòng
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-foreground",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary",
        vien && "border border-bo-border",
        className,
      )}
    >
      <Ellipsis className="size-5" aria-hidden="true" />
    </button>
  );
}

/**
 * Sheet thao tác của một dòng danh sách (mở từ NutThaoTac): mỗi thao tác một hàng cao 52px.
 * Chọn thao tác thì đóng sheet trước rồi mới chạy, tránh hai lớp phủ (sheet + hộp thoại sửa / xác nhận) tranh nhau giữ tiêu điểm.
 * `thaoTac`: [{ khoa, icon, nhan, nguyHiem?, onChon }].
 */
export default function SheetThaoTac({ mo, onDoiMo, tieuDe, moTa, thaoTac }) {
  const chon = (viec) => () => {
    onDoiMo(false);
    setTimeout(viec, 0);
  };
  return (
    <SheetDay mo={mo} onDoiMo={onDoiMo} tieuDe={tieuDe} moTa={moTa}>
      <div className="-mx-1 flex flex-col">
        {thaoTac.map((t) => (
          <button
            key={t.khoa}
            type="button"
            onClick={chon(t.onChon)}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-md px-1 text-left text-[15px] font-medium hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
          >
            {createElement(t.icon, { className: cn("size-[18px] shrink-0", t.nguyHiem ? "text-bo-danger" : "text-slate-500"), "aria-hidden": true })}
            <span className={t.nguyHiem ? "text-bo-danger" : "text-bo-foreground"}>{t.nhan}</span>
          </button>
        ))}
      </div>
    </SheetDay>
  );
}
