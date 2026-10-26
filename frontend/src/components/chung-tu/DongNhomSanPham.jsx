import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import AnhBienThe from "./AnhBienThe";
import { AN_DIEN_THOAI, CHI_DIEN_THOAI, COT_DINH } from "./kieuBang";

const coNoiDung = (x) => x != null && x !== false && x !== "";
const NEN = "bg-bo-row-group";
const NEN_RE = "group-hover/nhom:bg-bo-row-group-hover";

/**
 * Dòng nhóm sản phẩm trong bảng chứng từ (một <tr>): mũi tên, ảnh, tên sản phẩm 2 dòng rồi "…" (rê chuột thấy đủ),
 * dòng phụ; khi thu gọn thì nối thêm `tomTat` (màu · kích cỡ). Bấm cả dòng để thu gọn / mở (nút thật có aria-expanded).
 *
 * - `colSpan`: số cột ô sản phẩm chiếm; `children`: các ô <td> bên phải tùy màn (tổng phụ, số lượng…).
 * - `colSpanHep`: số cột ô sản phẩm chiếm khi khối hẹp, nếu trong vùng `colSpan` có cột ẩn bằng AN_DIEN_THOAI
 *   (vd. bảng [Biến thể][Mã SKU ẩn khi hẹp][Số lượng] → `colSpan={2} colSpanHep={1}`) để hàng nhóm luôn khớp số cột.
 * - `thuGonDuoc = false` (chứng từ ít dòng): dòng nhóm cố định, không mũi tên, không bấm được.
 * - `dongPhu`: nội dung dòng phụ; mảng thì bỏ phần trống và nối bằng " · ".
 * - `idVung`: id phần tử chứa các dòng biến thể (vd. <tbody> của nhóm) cho aria-controls.
 * - `dinhTrai`: ô sản phẩm dính trái khi bảng cuộn ngang (dùng với `colSpan={1}`).
 * - `oDau`: ô <td> đứng TRƯỚC ô sản phẩm (vd. ô chọn của màn Tạo yêu cầu nhập hàng); không truyền thì như cũ.
 */
export default function DongNhomSanPham({
  ten,
  anh,
  bienThe,
  dongPhu,
  tomTat,
  mo = true,
  onDoi,
  thuGonDuoc = true,
  colSpan = 1,
  colSpanHep,
  dinhTrai = false,
  idVung,
  oDau,
  children,
  className,
}) {
  const phan = (Array.isArray(dongPhu) ? dongPhu : [dongPhu]).filter(coNoiDung);
  if (!mo && coNoiDung(tomTat)) phan.push(tomTat);
  const tenHien = coNoiDung(ten) ? ten : "—";

  const noiDung = (
    <>
      <AnhBienThe src={anh} bienThe={bienThe} />
      <span className="block min-w-0">
        <span
          className="line-clamp-2 font-medium leading-5 text-bo-foreground"
          title={typeof tenHien === "string" ? tenHien : undefined}
        >
          {tenHien}
        </span>
        {phan.length ? (
          <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
            {phan.map((p, i) => (
              <Fragment key={i}>
                {i > 0 ? " · " : null}
                {p}
              </Fragment>
            ))}
          </span>
        ) : null}
      </span>
    </>
  );

  const bamDong = (suKien) => {
    // Bấm vào ô bên phải cũng thu gọn / mở; bấm trúng nút, liên kết, ô nhập trong dòng thì để chúng tự xử lý
    if (suKien.target.closest("button, a, input, select, textarea, label")) return;
    onDoi?.();
  };

  const oSanPham = (span, lopThem) => (
    <td
      colSpan={span}
      // Bề rộng tối thiểu chỉ khi khối rộng: khối hẹp (điện thoại) để ô co lại, các cột số không bị đẩy ra ngoài khung
      className={cn("p-0 @2xl/khoi:min-w-[220px]", dinhTrai && cn(COT_DINH, NEN, thuGonDuoc && NEN_RE), lopThem)}
    >
      {thuGonDuoc ? (
        <button
          type="button"
          aria-expanded={mo}
          aria-controls={idVung}
          onClick={onDoi}
          className="flex w-full min-w-0 items-center gap-3 py-2.5 pl-4 pr-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary sm:pl-6"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none",
              !mo && "-rotate-90",
            )}
            aria-hidden="true"
          />
          {noiDung}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-3 py-2.5 pl-4 pr-3 sm:pl-6">{noiDung}</div>
      )}
    </td>
  );
  // Khác số cột khi hẹp: vẽ hai ô, mỗi lúc chỉ một ô hiện (ô ẩn là display: none nên không vào cây trợ năng)
  const haiCo = colSpanHep != null && colSpanHep !== colSpan;

  return (
    <tr
      onClick={thuGonDuoc ? bamDong : undefined}
      className={cn(
        "group/nhom border-b border-slate-100 tabular-nums",
        NEN,
        thuGonDuoc && "cursor-pointer hover:bg-bo-row-group-hover",
        className,
      )}
    >
      {oDau}
      {haiCo ? (
        <>
          {oSanPham(colSpan, AN_DIEN_THOAI)}
          {oSanPham(colSpanHep, CHI_DIEN_THOAI)}
        </>
      ) : (
        oSanPham(colSpan)
      )}
      {children}
    </tr>
  );
}
