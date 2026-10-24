import { Button } from "@/components/ui/button";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import ChipLo from "@/components/chung-tu/ChipLo";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import OTienDo from "@/components/chung-tu/OTienDo";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
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
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { cn } from "@/lib/utils";

function NutLo({ d, nhan, onMoLo }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onMoLo(d.ct)}
      aria-label={`${nhan} cho ${d.sku || d.tenSanPham}`}
      className="h-7 border-bo-border bg-white px-2.5 text-xs font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
    >
      {nhan}
    </Button>
  );
}

function OLo({ d }) {
  if (!d.trangThaiLo) {
    return (
      <span className="block">
        <span aria-hidden="true" className="block h-[22px] w-28 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <span className="sr-only">Đang tải lô</span>
      </span>
    );
  }
  if (d.trangThaiLo === "loi") return <span className="text-[13px] text-bo-warning">Không tải được lô</span>;
  return (
    <ChipLo
      lo={d.lo}
      cuaDong={d.sku || d.tenSanPham}
      khiTrong={<span className="text-[13px] font-medium text-bo-warning">Chưa chọn lô</span>}
    />
  );
}

/**
 * Bảng "Sản phẩm xuất" của Chi tiết phiếu xuất kho (dòng phẳng theo SKU, giữ thứ tự phiếu): lô đã lấy hiện ngay trên dòng
 * (thẻ lô, "+n lô" mở tại chỗ), cột Đã lấy (OTienDo, số cam khi thiếu lô), nút Sửa lô / Chọn lô khi được sửa (không có nút
 * "Xem lô"). Khối hẹp (< 672px: điện thoại, 768px có thanh bên): cột "Lô đã lấy" và cột nút ẩn, lô và nút Sửa lô / Chọn lô
 * xuống dưới tên sản phẩm — cột Đã lấy và nút luôn nằm trong khung, không phải cuộn ngang.
 * Quá NGUONG_CONG_CU dòng: ô tìm (tên, SKU, mã lô), lọc "Thiếu lô", phân trang theo dòng. DTO không có ảnh biến thể nên
 * không có ô ảnh.
 *
 * `bang`: useBangChungTu(dong, { theo: "dong", boLoc: BO_LOC_DONG_XUAT }) (phieuXuat.js); mỗi dòng
 * `{ id, tenSanPham, sku, can, da, du, lo, trangThaiLo: undefined | "xong" | "loi", ct }`.
 */
export default function BangSanPhamXuat({ bang, moTa, soThieu, suaLo, nhanNutLo, onMoLo }) {
  const coLoc = bang.coCongCu && (soThieu > 0 || bang.locNhanh === "thieuLo");

  return (
    <section aria-labelledby="sp-px" className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id="sp-px" className="text-base font-semibold leading-6 text-bo-foreground">Sản phẩm xuất</h2>
        {moTa ? <span className="text-[13px] leading-5 text-bo-muted">{moTa}</span> : null}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo tên, SKU hoặc mã lô"
          nhanTim="Tìm trong phiếu"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          boLoc={
            coLoc ? (
              <NutPhanDoan
                nhan="Lọc dòng"
                value={bang.locNhanh}
                onChange={bang.datLoc}
                luaChon={[
                  { value: "tatCa", label: "Tất cả" },
                  { value: "thieuLo", label: "Thiếu lô", count: bang.demLoc.thieuLo },
                ]}
              />
            ) : null
          }
        />
      ) : null}

      {bang.dong.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[620px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI)}>Lô đã lấy</th>
                <th
                  scope="col"
                  className={cn(O_TIEU_DE, "w-[132px] text-right @max-2xl/khoi:pr-4 @2xl/khoi:w-[150px]", !suaLo && O_CUOI)}
                >
                  Đã lấy
                </th>
                {suaLo ? (
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[88px]", AN_DIEN_THOAI)}>
                    <span className="sr-only">Thao tác</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {bang.dong.map((d) => (
                <tr key={d.id} className={DONG}>
                  <td className={cn(O, O_DAU, "@2xl/khoi:min-w-[240px]")}>
                    <div className="flex min-w-0 items-center gap-3">
                      <AnhBienThe src={d.anh} />
                      <div className="min-w-0">
                        <div className="line-clamp-2 break-words font-medium text-bo-foreground" title={d.tenSanPham}>
                          {d.tenSanPham || "—"}
                        </div>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs leading-4 text-bo-muted">
                          {d.tenMau || d.kichCo ? (
                            <>
                              <MauKichCo dong={d} className="max-w-full text-slate-700" />
                              <span aria-hidden="true">·</span>
                            </>
                          ) : null}
                          <span className="break-all font-mono">{d.sku || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className={cn("mt-2 grid justify-items-start gap-2", CHI_DIEN_THOAI)}>
                      <OLo d={d} />
                      {suaLo ? <NutLo d={d} nhan={nhanNutLo} onMoLo={onMoLo} /> : null}
                    </div>
                  </td>
                  <td className={cn(O, "min-w-[180px]", AN_DIEN_THOAI)}>
                    <OLo d={d} />
                  </td>
                  <td className={cn(O, "@max-2xl/khoi:pr-4", !suaLo && O_CUOI)}>
                    <OTienDo da={d.da} can={d.can} canhBaoKhiThieu={!d.du} />
                  </td>
                  {suaLo ? (
                    <td className={cn(O, O_CUOI, "text-right", AN_DIEN_THOAI)}>
                      <NutLo d={d} nhan={nhanNutLo} onMoLo={onMoLo} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {bang.khongKetQua && !bang.dangTim ? (
        <KhongKetQua chu="Không còn dòng nào thiếu lô." nhanNut="Xem tất cả" onNut={bang.xoaLoc} />
      ) : (
        <KhongKetQua bang={bang} tenChungTu="phiếu xuất kho" donVi="dòng" />
      )}
      <PhanTrangBang {...bang.phanTrang} />
    </section>
  );
}
