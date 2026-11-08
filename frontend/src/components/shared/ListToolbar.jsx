import { Children, Fragment, useLayoutEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FilterSelect from "@/components/shared/FilterSelect";
import SearchInput from "@/components/shared/SearchInput";
import SheetDay from "@/components/shared/SheetDay";
import { LocTrongSheetContext } from "@/components/shared/locTrongSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Điện thoại (< 768px): tab trạng thái giữ nguyên; ô tìm kiếm + nút "Bộ lọc" chung một hàng; các ô lọc còn lại vào
 * sheet đáy (FilterSelect thành danh sách chọn một, chạm 48px); lọc đang áp hiện thành chip có × dưới ô tìm.
 * Lọc vẫn áp ngay khi chọn như trên máy tính (không thêm bước "Áp dụng").
 */
/** Trải Fragment lồng nhau: trang có thể truyền con trong <>…</> hoặc mảng / điều kiện. */
function traiCon(children) {
  return Children.toArray(children).flatMap((c) => (c?.type === Fragment ? traiCon(c.props.children) : c ? [c] : []));
}

/** Ô vào sheet "Bộ lọc": ô chọn lọc, ô nhập lọc và ô ngày (label bọc input). Nút thao tác, chip riêng của trang… ở lại trên hàng. */
const laOLoc = (c) => c.type === FilterSelect || c.type === Input || c.type === "label";

const ngayVN = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v);

/** Ô lọc đang áp → các chip { khoa, nhan, moTa, boLoc }; ô đang để trống / "Tất cả" → không chip nào. */
function chipLoc(c, i) {
  if (c.type === FilterSelect) {
    const { label, value, options, onChange, onClear } = c.props;
    if (!options?.length || value === options[0].value) return [];
    const chon = options.find((o) => o.value === value);
    return [{
      khoa: c.key ?? i,
      nhan: chon?.label,
      moTa: `Bỏ lọc ${label ?? ""}: ${chon?.label ?? ""}`,
      boLoc: () => (onClear ? onClear() : onChange(options[0].value)),
    }];
  }
  // Ô nhập: trực tiếp hoặc nằm trong label (ô ngày; một label có thể bọc hai ô "Từ … đến", mỗi ô một chip);
  // onChange của trang nhận sự kiện nên giả một sự kiện rỗng
  const dsO = c.type === Input ? [c] : traiCon(c.props.children).filter((x) => x.type === Input || x.type === "input");
  return dsO.flatMap((o, j) => {
    const giaTri = o.props.value;
    if (giaTri == null || giaTri === "") return [];
    // Ô chữ: lấy chữ gợi ý ("Tên nhà cung cấp…") cho chip ngắn; ô ngày không có gợi ý nên lấy aria-label ("Ngày đặt")
    const goiY = o.props.placeholder?.replace(/(\.+|…)$/, "");
    const ten = (o.props.type !== "date" && goiY) || o.props["aria-label"] || "";
    return [{
      khoa: `${c.key ?? i}-${j}`,
      nhan: o.props.type === "date" ? `${ten} ${ngayVN(giaTri)}` : `${ten}: ${giaTri}`,
      moTa: `Bỏ lọc ${ten}`,
      boLoc: () => o.props.onChange?.({ target: { value: "" }, currentTarget: { value: "" } }),
    }];
  });
}

function ListToolbarDienThoai({ tabs, children, hasFilter, onClear, className }) {
  const ds = traiCon(children);
  const oTim = ds.find((c) => c.type === SearchInput) ?? null;
  const oLoc = ds.filter(laOLoc);
  // Kho làm việc và các nút / chip riêng của trang giữ trên hàng (ô kho phải luôn gắn để nghe sự kiện đổi kho; ô kho
  // không vẽ gì khi nhân viên chỉ có một kho — hàng trống thì ẩn, khỏi để một dải trống)
  const khac = ds.filter((c) => c !== oTim && !laOLoc(c));
  const dangLoc = oLoc.flatMap(chipLoc);

  return (
    <div className={cn("border-b border-bo-border", className)}>
      {tabs ? <div className="relative z-[1] border-b border-bo-border px-3">{tabs}</div> : null}
      {khac.length ? (
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5 empty:hidden [&>*]:max-w-full">{khac}</div>
      ) : null}
      {/* Không có ô tìm lẫn ô lọc (vd. tab Cần xử lý của Đối soát chuyển khoản): ẩn hàng, khỏi để một dải trống 20px */}
      <div className={cn("flex items-center gap-2 px-3 py-2.5", !oTim && !oLoc.length && "hidden")}>
        <div className="min-w-0 flex-1 [&>label]:max-w-none [&_input]:h-9">{oTim}</div>
        {oLoc.length ? (
          <SheetDay
            tieuDe="Bộ lọc"
            kichHoat={
              <Button
                type="button"
                variant="outline"
                aria-label={dangLoc.length ? `Bộ lọc, đang lọc ${dangLoc.length}` : "Bộ lọc"}
                className={cn(
                  "h-9 shrink-0 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground",
                  dangLoc.length > 0 && "border-bo-primary bg-bo-primary-soft text-bo-primary-strong",
                )}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Bộ lọc
                {dangLoc.length ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bo-primary px-1 text-xs font-semibold text-white">
                    {dangLoc.length}
                  </span>
                ) : null}
              </Button>
            }
            chan={(dong) => (
              <>
                {hasFilter && onClear ? (
                  <Button type="button" variant="outline" onClick={onClear} className="h-10 flex-1 border-bo-input-border text-sm">
                    Xóa lọc
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={dong}
                  className="h-10 flex-[2] bg-bo-primary text-sm font-semibold text-white hover:bg-bo-primary-hover"
                >
                  Xong
                </Button>
              </>
            )}
          >
            <LocTrongSheetContext.Provider value>
              <div className="grid gap-5 [&>input]:h-10 [&>input]:w-full [&>label]:h-10 [&>label]:w-full">{oLoc}</div>
            </LocTrongSheetContext.Provider>
          </SheetDay>
        ) : null}
      </div>
      {dangLoc.length ? (
        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
          {dangLoc.map((chip) => (
            <button
              key={chip.khoa}
              type="button"
              onClick={chip.boLoc}
              aria-label={chip.moTa}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-bo-primary-soft pl-3 pr-2 text-[13px] font-medium text-bo-primary-strong"
            >
              {chip.nhan}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          {onClear ? (
            <button type="button" onClick={onClear} className="h-9 shrink-0 px-1.5 text-sm font-medium text-bo-primary">
              Xóa lọc
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hàng đầu khung bảng của trang danh sách (bố cục A+G): tab trạng thái bên trái,
 * tìm kiếm và bộ lọc bên phải, chung một hàng khi đủ chỗ.
 * Không đủ chỗ thì tách hai tầng: tab ở tầng trên, bộ lọc xuống tầng dưới trải hết chiều ngang
 * (ô tìm kiếm giãn ra lấp chỗ trống), giữa hai tầng có đường kẻ, gạch chân tab nằm trên đường kẻ đó.
 * Truyền vào `toolbar` của TableShell.
 * - onClear: hiện nút "Xóa lọc" khi `hasFilter` (chỉ khi đang lọc).
 */
export default function ListToolbar({ tabs, children, hasFilter = false, onClear, className }) {
  const isMobile = useIsMobile();
  const khungRef = useRef(null);
  const tabsRef = useRef(null);
  const locRef = useRef(null);
  const [haiTang, setHaiTang] = useState(false);
  const coTab = Boolean(tabs);

  // Đo sau khi trình duyệt tự xuống dòng: khối lọc nằm dưới hàng tab thì bật kiểu hai tầng.
  // Kiểu hai tầng chỉ đổi độ giãn và đường kẻ, không đổi độ rộng gốc của các khối,
  // nên không làm trình duyệt đổi lại cách xuống dòng (không nhấp nháy qua lại).
  useLayoutEffect(() => {
    const khung = khungRef.current;
    if (!coTab || !khung) return undefined;
    const kiemTra = () => {
      const tab = tabsRef.current?.getBoundingClientRect();
      const loc = locRef.current?.getBoundingClientRect();
      if (!tab || !loc) return;
      setHaiTang(loc.top >= tab.bottom - 2);
    };
    kiemTra();
    // Đổi giữa một hàng và hai tầng luôn làm đổi chiều cao khung, nên chỉ cần theo dõi khung
    const quanSat = new ResizeObserver(kiemTra);
    quanSat.observe(khung);
    return () => quanSat.disconnect();
    // isMobile: xoay / đổi cỡ từ điện thoại lên máy tính thì khung mới gắn, phải đo lại
  }, [coTab, isMobile]);
  // Không có tab thì không có gì để tách tầng (bỏ qua giá trị đo cũ nếu trang vừa ẩn tab)
  const dangHaiTang = coTab && haiTang;

  if (isMobile) {
    return (
      <ListToolbarDienThoai tabs={tabs} hasFilter={hasFilter} onClear={onClear} className={className}>
        {children}
      </ListToolbarDienThoai>
    );
  }

  return (
    <div
      ref={khungRef}
      data-hai-tang={dangHaiTang || undefined}
      className={cn("flex flex-wrap items-center gap-x-3 border-b border-bo-border px-3 sm:px-4", className)}
    >
      {coTab ? (
        // relative z-[1]: gạch chân tab đang chọn vẽ đè lên đường kẻ giữa hai tầng
        <div ref={tabsRef} className="relative z-[1] min-w-0 max-w-full">
          {tabs}
        </div>
      ) : null}
      <div
        ref={locRef}
        className={cn(
          "ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto",
          dangHaiTang && [
            "relative grow justify-start",
            // Đường kẻ giữa hai tầng, tràn hết bề ngang khung (bù phần đệm px-3 / sm:px-4)
            "before:absolute before:inset-x-[-0.75rem] before:top-0 before:h-px before:bg-bo-border sm:before:inset-x-[-1rem]",
            // Ô tìm kiếm giãn ra lấp chỗ trống của tầng dưới
            "[&>label:has(>input[type=search])]:grow [&>label:has(>input[type=search])]:max-w-none",
          ],
        )}
      >
        {children}
        {hasFilter && onClear ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-9 gap-1.5 px-2.5 text-sm font-normal text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
          >
            <X className="size-4" />
            Xóa lọc
          </Button>
        ) : null}
      </div>
    </div>
  );
}
