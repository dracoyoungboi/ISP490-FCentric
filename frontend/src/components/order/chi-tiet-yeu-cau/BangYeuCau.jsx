import { useId } from "react";
import DongNhomSanPham from "@/components/chung-tu/DongNhomSanPham";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { luoiMauKichCo, soVN } from "@/components/chung-tu/bangChungTu";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_DAU_DONG_CON,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { cn } from "@/lib/utils";
import { chuSoBienThe } from "./tinhYeuCau";

const MA_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CACH_XEM = [
  { value: "danhSach", label: "Danh sách" },
  { value: "luoi", label: "Lưới màu × kích cỡ" },
];

/** Lưới một sản phẩm: một hàng mỗi màu, một cột mỗi kích cỡ, ô là số lượng (rê chuột thấy SKU), cột Cộng. */
function LuoiSanPham({ ten, dong }) {
  const luoi = luoiMauKichCo(dong);
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-max border-collapse text-[13px] tabular-nums">
        <caption className="sr-only">Lưới màu và kích cỡ của {ten}</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-bo-surface-subtle text-xs text-bo-muted">
            <th scope="col" className="px-3 py-2 text-left font-medium">Màu \ Kích cỡ</th>
            {luoi.cotKichCo.map((k) => (
              <th key={k} scope="col" className="min-w-12 px-3 py-2 text-right font-medium">{k}</th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">Cộng</th>
          </tr>
        </thead>
        <tbody>
          {luoi.hang.map((h) => (
            <tr key={h.tenMau} className="border-b border-slate-100 last:border-b-0">
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
                <td
                  key={o.kichCo}
                  title={o.giaTri == null ? "Không có biến thể này" : o.dong?.sku || undefined}
                  className={cn("px-3 py-2 text-right", o.giaTri == null ? "text-bo-muted" : "text-bo-foreground")}
                >
                  {o.giaTri == null ? "—" : soVN(o.giaTri)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold text-bo-foreground">{soVN(h.cong)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Bảng "Sản phẩm cần nhập" của yêu cầu nhập hàng: gom biến thể theo sản phẩm (dòng nhóm có chất liệu, số biến thể,
 * tổng phụ). Quá NGUONG_CONG_CU dòng: ô tìm, "Mở tất cả / Thu gọn tất cả", phân trang theo sản phẩm và cách xem
 * "Lưới màu × kích cỡ" (một hàng mỗi màu). Quá NGUONG_THU_GON biến thể: mặc định thu gọn.
 * Khối hẹp (< 672px: điện thoại, 768px có thanh bên): cột Mã SKU ẩn, mã SKU xuống dòng phụ dưới màu / kích cỡ.
 * `bang`: kết quả useBangChungTu của các dòng (tinhYeuCau.dongYeuCau).
 */
export default function BangYeuCau({ bang }) {
  const idBang = useId();
  const luoi = bang.coCongCu && bang.cheDoXem === "luoi";
  const coDong = bang.nhom.length > 0;

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">
          Sản phẩm cần nhập
        </h2>
        {bang.chuGoiYThuGon ? <p className="text-[13px] leading-5 text-bo-muted">{bang.chuGoiYThuGon}</p> : null}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          nhanTim="Tìm trong yêu cầu"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          moHet={bang.moHet}
          onDoiMoHet={coDong ? bang.doiMoTatCa : undefined}
          nutXem={
            <NutPhanDoan nhan="Cách xem biến thể" value={bang.cheDoXem} onChange={bang.datCheDoXem} luaChon={CACH_XEM} />
          }
        />
      ) : null}

      {coDong ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[520px]")}>
            {luoi ? null : (
              <thead>
                <tr className={DONG_TIEU_DE}>
                  <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Biến thể</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI)}>Mã SKU</th>
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "text-right")}>Số lượng</th>
                </tr>
              </thead>
            )}
            {bang.nhom.map((n, i) => {
              const idNhom = `${idBang}-nhom-${i}`;
              const oLuoi = (soCot, lop) => (
                <td colSpan={soCot} className={cn("pb-3 pr-4 pt-1 sm:pr-6", lop)}>
                  <div className={O_DAU_DONG_CON}>
                    <LuoiSanPham ten={n.tenSanPham} dong={n.dong} />
                  </div>
                </td>
              );
              return (
                <tbody key={n.khoa} id={idNhom}>
                  <DongNhomSanPham
                    ten={n.tenSanPham}
                    anh={n.anh}
                    colSpan={n.thuGonDuoc ? 2 : 3}
                    colSpanHep={n.thuGonDuoc ? 1 : 2}
                    mo={n.mo}
                    thuGonDuoc={n.thuGonDuoc}
                    onDoi={() => bang.doiNhom(n.khoa)}
                    idVung={idNhom}
                    dongPhu={[n.dong[0]?.chatLieu, chuSoBienThe(n, bang.dangTim)]}
                    tomTat={n.tomTat}
                  >
                    {n.thuGonDuoc ? (
                      <td className={cn(O, O_CUOI, "text-right font-semibold")}>{soVN(n.tong.soLuong)}</td>
                    ) : null}
                  </DongNhomSanPham>
                  {n.mo && luoi ? (
                    // Khối hẹp ẩn cột Mã SKU: ô lưới chiếm 2 cột thay vì 3 để không sinh cột trống
                    <tr className="border-b border-slate-100">
                      {oLuoi(3, AN_DIEN_THOAI)}
                      {oLuoi(2, CHI_DIEN_THOAI)}
                    </tr>
                  ) : null}
                  {n.mo && !luoi
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={DONG}>
                        <td className={cn(O, O_DAU_DONG_CON)}>
                          <MauKichCo dong={d} />
                          <span className={cn("mt-0.5 block break-all font-mono text-xs text-bo-muted", CHI_DIEN_THOAI)}>
                            {d.sku || "—"}
                          </span>
                        </td>
                        <td className={cn(O, "break-all font-mono text-xs text-slate-600", AN_DIEN_THOAI)}>
                          {d.sku || "—"}
                        </td>
                        <td className={cn(O, O_CUOI, "text-right")}>{soVN(d.soLuong)}</td>
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      <KhongKetQua bang={bang} tenChungTu="yêu cầu nhập hàng" donVi="biến thể" />
      {bang.phanTrang ? <PhanTrangBang {...bang.phanTrang} /> : null}
    </section>
  );
}
