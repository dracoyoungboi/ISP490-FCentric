import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Thân bảng cuộn: ghi chiều cao hàng tiêu đề cột (thead) vào --bo-cuon-dau để đường ray thanh cuộn
 * dọc bắt đầu dưới tiêu đề, và gắn data-da-cuon khi đã cuộn xuống để tiêu đề cột đứng yên có bóng mờ.
 * Bảng đổi (đang tải → có dữ liệu, đổi trang) thì đo lại.
 */
/** Màu nền hàng tiêu đề cột: lấy ở ô th đầu, tr hoặc thead, chỗ nào có nền trước. */
function mauNenTieuDe(thead) {
  if (!thead) return "transparent";
  const tr = thead.rows[0];
  for (const nut of [tr?.cells[0], tr, thead]) {
    if (!nut) continue;
    const nen = getComputedStyle(nut).backgroundColor;
    if (nen && nen !== "transparent" && nen !== "rgba(0, 0, 0, 0)") return nen;
  }
  return "transparent";
}

function useThanCuonBang() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let theadDangDo = null;
    const doTieuDe = new ResizeObserver(() => {
      el.style.setProperty("--bo-cuon-dau", `${theadDangDo?.offsetHeight ?? 0}px`);
      el.style.setProperty("--bo-cuon-nen-dau", mauNenTieuDe(theadDangDo));
    });
    const ganTieuDe = () => {
      const thead = el.querySelector(":scope > table > thead");
      if (thead === theadDangDo) return;
      if (theadDangDo) doTieuDe.unobserve(theadDangDo);
      theadDangDo = thead;
      if (thead) doTieuDe.observe(thead);
      else {
        el.style.removeProperty("--bo-cuon-dau");
        el.style.removeProperty("--bo-cuon-nen-dau");
      }
    };
    const capNhatCuon = () => {
      el.toggleAttribute("data-da-cuon", el.scrollTop > 0);
    };

    ganTieuDe();
    capNhatCuon();
    const theoDoiNoiDung = new MutationObserver(() => {
      ganTieuDe();
      capNhatCuon();
    });
    theoDoiNoiDung.observe(el, { childList: true });
    el.addEventListener("scroll", capNhatCuon, { passive: true });

    return () => {
      el.removeEventListener("scroll", capNhatCuon);
      theoDoiNoiDung.disconnect();
      doTieuDe.disconnect();
    };
  }, []);

  return ref;
}

/**
 * Khung bảng của trang danh sách.
 * - toolbar: hàng tab + tìm kiếm (ListToolbar).
 * - footer: phân trang (TablePagination).
 * - fill: khung giãn hết phần còn lại của màn (dùng cùng `PageContainer fill`). Thân bảng tự cuộn,
 *   tiêu đề cột (thead `sticky top-0`) đứng yên, phân trang luôn ở đáy. Màn hẹp/thấp tự về kiểu cũ.
 *   Bảng bên trong KHÔNG được bọc thêm khung giới hạn chiều cao (`max-h-…`).
 * - Thân bảng dùng thanh cuộn mảnh `.bo-cuon` (index.css).
 */
export default function TableShell({
  title,
  description,
  toolbar,
  children,
  footer,
  fill = false,
  className,
}) {
  const thanRef = useThanCuonBang();

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm",
        fill && "bo-table-fill",
        className,
      )}
    >
      {title || description ? (
        <div className="border-b border-bo-border px-4 py-3.5 sm:px-5">
          {title ? (
            <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-bo-muted sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      {toolbar}
      <div ref={thanRef} className={cn("bo-cuon w-full overflow-x-auto", fill && "bo-table-body")}>{children}</div>
      {footer ? (
        <div className="border-t border-bo-border px-4 py-3">{footer}</div>
      ) : null}
    </section>
  );
}
