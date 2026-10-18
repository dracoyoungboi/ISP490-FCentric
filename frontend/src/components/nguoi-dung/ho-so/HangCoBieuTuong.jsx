import { createElement } from "react";

/**
 * Một hàng của Hồ sơ (chốt 18/10/2026): ô biểu tượng xám, tiêu đề mục kèm một câu mô tả, thao tác ở bên phải.
 * Dùng cho mục Mật khẩu và mục Quyền của tôi của quản trị viên. Trên điện thoại thao tác xuống dòng, rộng hết hàng.
 */
export default function HangCoBieuTuong({ icon, tieuDeId, tieuDe, moTa, hanhDong }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
        {createElement(icon, { className: "size-[18px]", "aria-hidden": true })}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <h2 id={tieuDeId} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-[22px] text-bo-foreground">
          {tieuDe}
        </h2>
        {moTa ? <p className="mt-0.5 text-[12.5px] leading-[18px] text-bo-muted">{moTa}</p> : null}
      </div>
      {hanhDong ? <div className="flex shrink-0 max-sm:w-full">{hanhDong}</div> : null}
    </div>
  );
}
