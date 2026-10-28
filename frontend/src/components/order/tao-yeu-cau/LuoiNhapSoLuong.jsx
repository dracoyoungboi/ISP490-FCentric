import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { luoiNhap } from "./tinhTaoYeuCau";

const MA_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Cách nhập "Lưới màu × kích cỡ": mỗi sản phẩm một lưới gồm MỌI biến thể đang bán (kể cả chưa có trong yêu cầu), một
 * hàng mỗi màu, một cột mỗi kích cỡ, hàng / cột Cộng. Gõ số vào ô là thêm / đổi số lượng; xóa trống hoặc 0 là bỏ mã đó
 * (sản phẩm vẫn ở lại lưới). Dưới ô là khả dụng ở Kho tổng (chữ cam: đang có số đề xuất); rê chuột thấy SKU và đề xuất.
 *
 * - `sanPham`: các sản phẩm của trang `[{ khoa, bienThe: [...] }]` (biến thể đã xếp theo màu, cỡ — taoChiMuc).
 * - `dong`: dòng yêu cầu; `onDoiO(bienTheId, chu)`; `onBoSanPham(khoa)`; `phanTrang`: props PhanTrangBang hoặc null.
 */
export default function LuoiNhapSoLuong({ sanPham, dong, onDoiO, onBoSanPham, phanTrang, khoa = false }) {
  return (
    <section aria-label="Nhập số lượng theo lưới màu và kích cỡ" className="flex min-w-0 flex-1 flex-col border-t border-slate-100">
      {sanPham.map(({ khoa: khoaSp, bienThe }) => {
        const dau = bienThe[0];
        const luoi = luoiNhap(bienThe, dong);
        const soCo = luoi.hang.reduce((s, h) => s + h.o.filter((o) => Number(o.soLuong) > 0).length, 0);
        return (
          <div key={khoaSp} className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3 bg-bo-row-group px-4 py-2.5 sm:px-6">
              <AnhBienThe src={dau?.anh} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-medium leading-5 text-bo-foreground" title={dau?.tenSanPham}>{dau?.tenSanPham}</span>
                <span className="block text-xs leading-4 text-bo-muted">
                  {[dau?.maSanPham, `${soVN(soCo)}/${soVN(bienThe.length)} biến thể có số lượng`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="whitespace-nowrap text-[13px] text-bo-muted">
                Cộng <b className="font-semibold tabular-nums text-bo-foreground">{soVN(luoi.cong)}</b>
              </span>
              {khoa ? null : (
                <button
                  type="button"
                  onClick={() => onBoSanPham?.(khoaSp)}
                  aria-label={`Bỏ ${dau?.tenSanPham} khỏi yêu cầu`}
                  title="Bỏ cả sản phẩm"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-bo-danger-soft hover:text-bo-danger"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mx-4 mt-3 overflow-x-auto rounded-md border border-slate-200 bg-bo-surface sm:ml-[72px] sm:mr-6">
              <table className="w-full min-w-max border-collapse text-[13px] tabular-nums">
                <caption className="sr-only">Lưới màu và kích cỡ của {dau?.tenSanPham}</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-bo-surface-subtle text-xs text-bo-muted">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Màu \ Kích cỡ</th>
                    {luoi.cotKichCo.map((k) => <th key={k} scope="col" className="min-w-[84px] px-2.5 py-2 text-right font-medium">{k}</th>)}
                    <th scope="col" className="px-3 py-2 text-right font-medium">Cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {luoi.hang.map((h) => (
                    <tr key={h.tenMau} className="border-b border-slate-100">
                      <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal text-bo-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {h.tenMau !== "—" ? (
                            <span
                              aria-hidden="true"
                              className="inline-block size-2.5 shrink-0 rounded-full border border-slate-900/20 bg-slate-200"
                              // data-viz: màu động theo maMauHex
                              style={MA_HEX.test(h.maMauHex) ? { backgroundColor: h.maMauHex } : undefined}
                            />
                          ) : null}
                          {h.tenMau}
                        </span>
                      </th>
                      {h.o.map((o) => (
                        <td key={o.kichCo} className="px-2.5 py-1.5 text-right align-top">
                          {o.bienThe ? (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={o.soLuong}
                                disabled={khoa}
                                onChange={(e) => onDoiO?.(o.bienThe.bienTheId, e.target.value)}
                                aria-label={`Số lượng nhập ${dau?.tenSanPham}, màu ${h.tenMau}, cỡ ${o.kichCo}`}
                                title={[o.bienThe.maSku, o.bienThe.soLuongDeXuat > 0 ? `đề xuất ${soVN(o.bienThe.soLuongDeXuat)}` : ""].filter(Boolean).join(" · ")}
                                className={cn(O_NHAP, "ml-auto block h-8 w-16 px-2 text-right tabular-nums", o.soLuong === "" ? "bg-bo-surface-subtle/60" : "font-semibold")}
                              />
                              <span className={cn("mt-0.5 block text-[11px] leading-[14px]", o.bienThe.soLuongDeXuat > 0 ? "font-medium text-bo-warning" : "text-bo-muted")}>
                                khả dụng {soVN(o.bienThe.khaDung)}
                              </span>
                            </>
                          ) : (
                            <span className="block py-1.5 text-slate-400" title="Sản phẩm không có màu, cỡ này">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold text-bo-foreground">{h.cong ? soVN(h.cong) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="bg-bo-surface-subtle font-semibold">
                    <th scope="row" className="px-3 py-2 text-left">Cộng</th>
                    {luoi.congCot.map((c, i) => <td key={luoi.cotKichCo[i]} className="px-2.5 py-2 text-right">{c ? soVN(c) : "—"}</td>)}
                    <td className="px-3 py-2 text-right">{soVN(luoi.cong)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="px-4 py-3 text-xs leading-4 text-bo-muted sm:px-6">
        Gõ số lượng vào ô, để trống hoặc 0 là không nhập biến thể đó. Chữ cam dưới ô: Kho tổng đang dưới ngưỡng. Ô “—”: sản
        phẩm không có màu, cỡ này.
      </p>
      {phanTrang ? <PhanTrangBang {...phanTrang} /> : null}
    </section>
  );
}
