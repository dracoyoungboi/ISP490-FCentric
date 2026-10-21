import { cn } from "@/lib/utils";
import { cauChungTuRong, cauKhongKhop, cauLocRong } from "./bangChungTu.js";

/**
 * Dòng báo dưới bảng khi không có dòng để hiện — một mẫu chữ cho cả 8 màn (rà soát 21/10/2026, N13):
 * - tìm không thấy: "Không có biến thể nào khớp “abc”." + nút "Xóa tìm kiếm";
 * - lọc nhanh không còn dòng: "Không có SKU nào ở bộ lọc này." + nút "Xem tất cả";
 * - chứng từ chưa có dòng: "<Tên đầy đủ> chưa có sản phẩm nào." (không nút).
 *
 * Cách dùng gọn: `<KhongKetQua bang={bang} tenChungTu="phiếu nhặt hàng" donVi="SKU" />` — tự chọn câu theo
 * `bang.rong` / `bang.khongKetQua` / `bang.tuKhoa`, nút gọi `bang.xoaTuKhoa` / `bang.xoaLoc`; không có gì để báo thì không vẽ.
 * Hoặc truyền từng phần: `tuKhoa` + `onXoaTuKhoa`, `onXemTatCa`, `tenChungTu`. `chu` (+ `nhanNut`, `onNut`): câu riêng của màn
 * (vd. "Không còn biến thể nào thiếu lô.").
 */
export default function KhongKetQua({
  bang,
  tuKhoa: tuKhoaTruyen,
  donVi = "dòng",
  onXoaTuKhoa,
  onXemTatCa,
  tenChungTu,
  chu,
  nhanNut,
  onNut,
  className,
}) {
  if (bang && !bang.rong && !bang.khongKetQua) return null;
  const tuKhoa = String((bang ? bang.tuKhoa : tuKhoaTruyen) ?? "").trim();
  const xoaTuKhoa = onXoaTuKhoa ?? bang?.xoaTuKhoa;
  const xemTatCa = onXemTatCa ?? bang?.xoaLoc;

  let cau = null;
  let nut = null;
  if (chu) {
    cau = chu;
    if (nhanNut && onNut) nut = { nhan: nhanNut, bam: onNut };
  } else if (bang?.rong || (!bang && !tuKhoa && !xemTatCa && tenChungTu)) {
    cau = cauChungTuRong(tenChungTu);
  } else if (tuKhoa) {
    cau = cauKhongKhop(donVi, tuKhoa);
    if (xoaTuKhoa) nut = { nhan: "Xóa tìm kiếm", bam: xoaTuKhoa };
  } else if (xemTatCa) {
    cau = cauLocRong(donVi);
    nut = { nhan: "Xem tất cả", bam: xemTatCa };
  }
  if (!cau) return null;

  return (
    <div
      role="status"
      className={cn("border-t border-slate-100 px-4 py-8 text-center text-sm leading-6 text-bo-muted sm:px-6", className)}
    >
      {cau}
      {nut ? (
        <>
          {" "}
          <button
            type="button"
            onClick={nut.bam}
            className="whitespace-nowrap rounded font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            {nut.nhan}
          </button>
        </>
      ) : null}
    </div>
  );
}
