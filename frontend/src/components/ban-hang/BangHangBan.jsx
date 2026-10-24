import { useId } from "react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
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
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

/** Đơn giá chung của nhóm khi mọi biến thể cùng giá; khác giá thì để trống. */
function donGiaNhom(dong) {
  const gia = [...new Set(dong.map((d) => d.donGia))];
  return gia.length === 1 ? formatCurrency(gia[0]) : "";
}

/** Biến thể (Màu / Cỡ, hoặc "Không có màu, kích cỡ") và SKU của một dòng; khối hẹp thêm đơn giá (cột Đơn giá ẩn). */
function DongPhuBienThe({ d }) {
  return (
    <>
      <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
        <MauKichCo dong={d} className="max-w-full align-bottom text-slate-700" />
        {" · "}
        <span className="break-all font-mono">{d.sku || "—"}</span>
      </span>
      <span className={cn("block text-xs leading-4 text-bo-muted", CHI_DIEN_THOAI)}>
        Đơn giá <b className="font-semibold text-bo-foreground">{formatCurrency(d.donGia)}</b>
      </span>
    </>
  );
}

/**
 * Bảng hàng của đơn bán và báo giá bán (dùng chung hai màn): tên dòng của máy chủ "Tên / Màu / Cỡ" đã tách thành sản
 * phẩm + biến thể (tinhDonBan.dongHangBan), gom theo sản phẩm. Cột: Sản phẩm · Đơn giá · SL · Thành tiền.
 * - Sản phẩm một biến thể: một dòng (tên, biến thể · SKU).
 * - Nhiều biến thể: dòng nhóm (đơn giá chung nếu cùng giá, tổng SL, tổng tiền) + từng biến thể.
 * - Quá NGUONG_CONG_CU dòng: ô tìm, "Mở tất cả / Thu gọn tất cả", phân trang theo sản phẩm; quá NGUONG_THU_GON: thu gọn.
 * - Khối hẹp (< 672px): ẩn cột Đơn giá, đơn giá xuống dòng phụ.
 * Chấm màu và ảnh khi máy chủ trả mã màu / ảnh (máy chủ cũ không có: chấm xám, ảnh mặc định).
 * `bang`: useBangChungTu của các dòng. `tenChungTu`: "đơn bán hàng" | "báo giá" (câu khi chưa có dòng, ô tìm).
 * `children`: phần dưới bảng (tổng tiền).
 */
export default function BangHangBan({ bang, tenChungTu = "đơn bán hàng", nhanTim = "Tìm trong đơn", children }) {
  const idBang = useId();
  const coDong = bang.nhom.length > 0;

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">
          Sản phẩm
        </h2>
        {bang.rong ? null : (
          <p className="text-[13px] leading-5 text-bo-muted tabular-nums">{soVN(bang.tong.soSanPham)} sản phẩm</p>
        )}
      </div>
      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo tên, màu, kích cỡ hoặc SKU"
          nhanTim={nhanTim}
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          moHet={bang.moHet}
          onDoiMoHet={coDong ? bang.doiMoTatCa : undefined}
        />
      ) : null}
      {/* Như bản demo: câu gợi ý thu gọn nằm ngay dưới thanh công cụ */}
      {bang.chuGoiYThuGon ? (
        <p className="-mt-1 px-4 pb-3 text-[13px] leading-5 text-bo-muted sm:px-6">{bang.chuGoiYThuGon}</p>
      ) : null}

      {coDong ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[600px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[132px] text-right", AN_DIEN_THOAI)}>Đơn giá</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-16 text-right")}>SL</th>
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[148px] text-right")}>Thành tiền</th>
              </tr>
            </thead>
            {bang.nhom.map((n, i) => {
              const idNhom = `${idBang}-nhom-${i}`;
              // Sản phẩm chỉ có một biến thể (cả chứng từ, không chỉ trong kết quả tìm): một dòng
              if (n.soBienTheCaNhom === 1 && n.dong.length === 1) {
                const d = n.dong[0];
                return (
                  <tbody key={n.khoa} id={idNhom}>
                    <tr className={DONG}>
                      <td className={cn(O, O_DAU, "@2xl/khoi:min-w-[200px]")}>
                        <span className="flex min-w-0 items-center gap-3">
                          <AnhBienThe src={d.anh} />
                          <span className="block min-w-0">
                            <span className="line-clamp-2 font-medium leading-5 text-bo-foreground" title={d.tenSanPham}>
                              {d.tenSanPham || "—"}
                            </span>
                            <DongPhuBienThe d={d} />
                          </span>
                        </span>
                      </td>
                      <td className={cn(O, "whitespace-nowrap text-right", AN_DIEN_THOAI)}>{formatCurrency(d.donGia)}</td>
                      <td className={cn(O, "text-right")}>{soVN(d.soLuong)}</td>
                      <td className={cn(O, O_CUOI, "whitespace-nowrap text-right font-semibold")}>{formatCurrency(d.thanhTien)}</td>
                    </tr>
                  </tbody>
                );
              }
              return (
                <tbody key={n.khoa} id={idNhom}>
                  <DongNhomSanPham
                    ten={n.tenSanPham}
                    anh={n.anh}
                    mo={n.mo}
                    thuGonDuoc={n.thuGonDuoc}
                    onDoi={() => bang.doiNhom(n.khoa)}
                    idVung={idNhom}
                    dongPhu={chuSoBienThe(n, bang.dangTim)}
                    tomTat={n.tomTat}
                  >
                    <td className={cn(O, "whitespace-nowrap text-right text-bo-muted", AN_DIEN_THOAI)}>{donGiaNhom(n.dong)}</td>
                    <td className={cn(O, "text-right font-semibold")}>{soVN(n.tong.soLuong)}</td>
                    <td className={cn(O, O_CUOI, "whitespace-nowrap text-right font-semibold")}>{formatCurrency(n.tong.thanhTien)}</td>
                  </DongNhomSanPham>
                  {n.mo
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={DONG}>
                        {/* Khối hẹp: bỏ thụt lề dòng con để các cột số vừa khung điện thoại */}
                        <td className={cn(O, O_DAU_DONG_CON, "@max-2xl/khoi:pl-4")}>
                          <MauKichCo dong={d} className="max-w-full text-[13px] leading-5 text-slate-700" />
                          <span className="block break-all font-mono text-xs leading-4 text-bo-muted">{d.sku || "—"}</span>
                          <span className={cn("block text-xs leading-4 text-bo-muted", CHI_DIEN_THOAI)}>
                            Đơn giá <b className="font-semibold text-bo-foreground">{formatCurrency(d.donGia)}</b>
                          </span>
                        </td>
                        <td className={cn(O, "whitespace-nowrap text-right", AN_DIEN_THOAI)}>{formatCurrency(d.donGia)}</td>
                        <td className={cn(O, "text-right")}>{soVN(d.soLuong)}</td>
                        <td className={cn(O, O_CUOI, "whitespace-nowrap text-right")}>{formatCurrency(d.thanhTien)}</td>
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      <KhongKetQua bang={bang} tenChungTu={tenChungTu} donVi="sản phẩm" />
      {bang.phanTrang ? <PhanTrangBang {...bang.phanTrang} /> : null}
      {children}
    </section>
  );
}
