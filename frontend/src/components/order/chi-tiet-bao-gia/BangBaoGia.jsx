import { useId } from "react";
import DongNhomSanPham from "@/components/chung-tu/DongNhomSanPham";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { soVN } from "@/components/chung-tu/bangChungTu";
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
import { chuSoBienThe } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { congGia, NHAN_CHO_BAO_GIA } from "./tinhBaoGia";

/** Tổng phụ của một sản phẩm: chưa dòng nào có giá → thẻ "Chờ báo giá"; thiếu dòng → "Thiếu giá n dòng" (không cộng thiếu). */
function TongNhom({ dong }) {
  const g = congGia(dong);
  if (g.chuaCoGia) return <StatusBadge label={NHAN_CHO_BAO_GIA} />;
  if (g.thieu > 0) return <span className="text-[13px] text-amber-700">Thiếu giá {soVN(g.thieu)} dòng</span>;
  return formatCurrency(g.tongTien);
}

/**
 * Bảng "Giá nhà cung cấp báo" của báo giá: biến thể gom theo sản phẩm, Số lượng · Đơn giá · Thành tiền.
 * Dòng chưa có giá: ô đơn giá là thẻ "Chờ báo giá" (giữ như màn cũ; màu theo constants/trangThai.js), thành tiền "—".
 * Tổng cả báo giá nằm ở dòng phụ đầu khối nên bảng không có dòng Tổng cộng.
 * Khối hẹp (< 672px): cột Số lượng ẩn, số lượng xuống dòng phụ dưới mã SKU (Đơn giá, Thành tiền luôn trong khung).
 * `bang`: useBangChungTu của các dòng (tinhBaoGia.dongBaoGia).
 */
export default function BangBaoGia({ bang }) {
  const idBang = useId();
  const coDong = bang.nhom.length > 0;

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">
          Giá nhà cung cấp báo
        </h2>
        {bang.chuGoiYThuGon ? <p className="text-[13px] leading-5 text-bo-muted">{bang.chuGoiYThuGon}</p> : null}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          nhanTim="Tìm trong báo giá"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          moHet={bang.moHet}
          onDoiMoHet={coDong ? bang.doiMoTatCa : undefined}
        />
      ) : null}

      {coDong ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[600px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Biến thể</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right", AN_DIEN_THOAI)}>Số lượng</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[150px] text-right")}>Đơn giá</th>
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[170px] text-right")}>Thành tiền</th>
              </tr>
            </thead>
            {bang.nhom.map((n, i) => {
              const idNhom = `${idBang}-nhom-${i}`;
              return (
                <tbody key={n.khoa} id={idNhom}>
                  <DongNhomSanPham
                    ten={n.tenSanPham}
                    anh={n.anh}
                    colSpan={n.thuGonDuoc ? 1 : 4}
                    colSpanHep={n.thuGonDuoc ? 1 : 3}
                    mo={n.mo}
                    thuGonDuoc={n.thuGonDuoc}
                    onDoi={() => bang.doiNhom(n.khoa)}
                    idVung={idNhom}
                    dongPhu={[n.dong[0]?.chatLieu, chuSoBienThe(n, bang.dangTim)]}
                    tomTat={n.tomTat}
                  >
                    {n.thuGonDuoc ? (
                      <>
                        <td className={cn(O, "text-right font-semibold", AN_DIEN_THOAI)}>{soVN(n.tong.soLuong)}</td>
                        <td className={O} />
                        <td className={cn(O, O_CUOI, "whitespace-nowrap text-right font-semibold")}>
                          <TongNhom dong={n.dong} />
                        </td>
                      </>
                    ) : null}
                  </DongNhomSanPham>
                  {n.mo
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={DONG}>
                        {/* Khối hẹp: bỏ thụt lề dòng con để cột Đơn giá, Thành tiền vừa khung điện thoại */}
                        <td className={cn(O, O_DAU_DONG_CON, "@max-2xl/khoi:pl-4")}>
                          <MauKichCo dong={d} />
                          <span className="mt-0.5 block break-all font-mono text-xs text-bo-muted">{d.sku || "—"}</span>
                          <span className={cn("block text-xs text-bo-muted", CHI_DIEN_THOAI)}>
                            Số lượng <b className="font-semibold text-bo-foreground">{soVN(d.soLuong)}</b>
                          </span>
                        </td>
                        <td className={cn(O, "text-right", AN_DIEN_THOAI)}>{soVN(d.soLuong)}</td>
                        <td className={cn(O, "whitespace-nowrap text-right")}>
                          {d.coGia ? formatCurrency(d.donGia) : <StatusBadge label={NHAN_CHO_BAO_GIA} />}
                        </td>
                        <td className={cn(O, O_CUOI, "whitespace-nowrap text-right", !d.coGia && "text-bo-muted")}>
                          {d.coGia ? formatCurrency(d.thanhTien) : "—"}
                        </td>
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      <KhongKetQua bang={bang} tenChungTu="báo giá" donVi="biến thể" />
      {bang.phanTrang ? <PhanTrangBang {...bang.phanTrang} /> : null}
    </section>
  );
}
