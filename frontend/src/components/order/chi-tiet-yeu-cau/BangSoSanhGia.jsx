import { useId } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import DongNhomSanPham from "@/components/chung-tu/DongNhomSanPham";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { BANG, COT_DINH, DONG, DONG_TIEU_DE, KHUNG_CUON, O, O_CUOI, O_DAU, O_DAU_DONG_CON, O_TIEU_DE } from "@/components/chung-tu/kieuBang";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { soSanhDong, soSanhTong } from "./soSanhGia";
import { chuSoBienThe } from "./tinhYeuCau";

const CACH_XEM_GIA = [
  { value: "donGia", label: "Đơn giá" },
  { value: "thanhTien", label: "Thành tiền" },
];
// Bề rộng (px) các cột: biến thể (cột dính trái; 180px khi khối hẹp), số lượng, mỗi nhà cung cấp. 3 nhà cung cấp vừa khối
// ở 1440px có thanh bên (~810px); nhiều hơn thì bảng cuộn ngang trong khung, cột biến thể đứng yên.
const RONG_COT = { bienThe: 280, soLuong: 88, ncc: 144 };
const NEN_CHOT = "bg-bo-primary-soft";

/** Ô tiền của một nhà cung cấp: giá / tổng, "thấp nhất" (xanh), "Thiếu giá n dòng" (cam), chưa có ("—" xám). */
function OGia({ chu, kieu, thapNhat, chot }) {
  return (
    <td className={cn(O, "border-l border-slate-100 text-right align-middle", chot && NEN_CHOT)}>
      <span
        className={cn(
          "block whitespace-nowrap tabular-nums",
          kieu === "chua" && "text-bo-muted",
          kieu === "thieu" && "text-[13px] font-semibold text-bo-warning",
          thapNhat && "font-semibold text-bo-success",
        )}
      >
        {chu}
      </span>
      {thapNhat ? <span className="block text-[11px] font-semibold leading-[14px] text-bo-success">thấp nhất</span> : null}
    </td>
  );
}

/** Đổi tổng theo nhà cung cấp (soSanhTong) sang ô: thiếu dòng nào thì báo thiếu thay vì cộng thiếu. */
function oTong(x, chuKhiChuaCo) {
  if (x.khongCo) return { chu: chuKhiChuaCo, kieu: "chua", thapNhat: false };
  if (x.thieu > 0) return { chu: `Thiếu giá ${soVN(x.thieu)} dòng`, kieu: "thieu", thapNhat: false };
  return { chu: formatCurrency(x.tong), kieu: "", thapNhat: x.thapNhat };
}

/**
 * Bảng "So sánh báo giá" của yêu cầu báo giá: hàng là biến thể (gom theo sản phẩm), cột là nhà cung cấp được gửi yêu cầu.
 * Cột biến thể dính trái, cột nhà cung cấp cuộn ngang trong khung; cột của báo giá đã chấp nhận tô xanh nhạt.
 * Dòng nhóm có tổng tiền theo sản phẩm của từng nhà cung cấp; dòng cuối "Tổng tiền cả yêu cầu" tính MỌI dòng (không theo trang).
 *
 * - `bang`: useBangChungTu của các dòng (soSanhGia.dungSoSanhGia → dong, mỗi dòng có `gia[i]`)
 * - `ncc`: các báo giá còn hiệu lực `{ id, soDonMua, nhaCungCap, chot, nhan }` (`nhan`: nhãn trạng thái đã suy diễn)
 * - `tongCaYeuCau`: soSanhTong của mọi dòng · `xem` / `onDoiXem`: "donGia" | "thanhTien"
 * - `tomTatGui`: chữ "n nhà cung cấp đã gửi giá · …" · `chuThich`: câu cuối khối
 * - `xemBaoGia`: người đang xem mở được Chi tiết báo giá (tinhYeuCau.VAI_TRO_XEM_DON_MUA); không thì tên nhà cung cấp
 *   là chữ thường, không phải link (máy chủ trả 403)
 */
export default function BangSoSanhGia({ bang, ncc, tongCaYeuCau, xem, onDoiXem, tomTatGui, chuThich, xemBaoGia = true }) {
  const idBang = useId();
  const soNcc = ncc.length;
  const coDong = bang.nhom.length > 0;
  const xemTien = xem === "thanhTien";
  const rongNcc = RONG_COT.ncc;
  const soCot = 2 + soNcc;

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">
          So sánh báo giá
        </h2>
        {soNcc ? (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            {tomTatGui ? <span className="text-[13px] leading-5 text-bo-muted">{tomTatGui}</span> : null}
            <NutPhanDoan nhan="Cách xem giá" value={xem} onChange={onDoiXem} luaChon={CACH_XEM_GIA} />
          </div>
        ) : null}
      </div>

      {bang.coCongCu ? (
        <>
          <ThanhCongCuBang
            tuKhoa={bang.tuKhoa}
            onDoiTuKhoa={bang.datTuKhoa}
            onXoaTuKhoa={bang.xoaTuKhoa}
            nhanTim="Tìm trong yêu cầu"
            ketQua={bang.chuKetQua}
            khongKetQua={bang.khongKetQua}
            moHet={bang.moHet}
            onDoiMoHet={coDong ? bang.doiMoTatCa : undefined}
          />
          {bang.chuGoiYThuGon ? (
            <p className="px-4 pb-3 text-[13px] leading-5 text-bo-muted sm:px-6">{bang.chuGoiYThuGon}</p>
          ) : null}
        </>
      ) : null}

      {coDong ? (
        <div className={KHUNG_CUON}>
          {/* Bề rộng cột cố định (colgroup): tên sản phẩm dài không chiếm hết khung nhìn trên điện thoại */}
          <table className={cn(BANG, "table-fixed")} style={{ minWidth: RONG_COT.bienThe + RONG_COT.soLuong + soNcc * rongNcc }}>
            <colgroup>
              <col className="w-[180px] @2xl/khoi:w-[280px]" />
              <col style={{ width: RONG_COT.soLuong }} />
              {ncc.map((n) => (
                <col key={n.id} style={{ width: rongNcc }} />
              ))}
            </colgroup>
            <thead>
              <tr className={cn(DONG_TIEU_DE, "whitespace-normal")}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU, COT_DINH, "bg-bo-surface-subtle align-bottom")}>
                  Biến thể
                </th>
                <th scope="col" className={cn(O_TIEU_DE, "whitespace-nowrap text-right align-bottom", soNcc ? "" : O_CUOI)}>
                  Số lượng
                </th>
                {ncc.map((n, i) => (
                  <th
                    key={n.id}
                    scope="col"
                    className={cn(O_TIEU_DE, "border-l border-slate-100 text-right align-bottom", i === soNcc - 1 && O_CUOI, n.chot && NEN_CHOT)}
                  >
                    <span className="flex flex-col items-end gap-1">
                      {xemBaoGia ? (
                        <Link
                          to={`/quotation/${n.id}`}
                          className="text-sm font-semibold leading-5 text-bo-primary hover:text-bo-primary-hover hover:underline"
                        >
                          {n.nhaCungCap?.tenNhaCungCap || n.nhaCungCap?.maNhaCungCap || n.soDonMua || "—"}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold leading-5 text-bo-foreground">
                          {n.nhaCungCap?.tenNhaCungCap || n.nhaCungCap?.maNhaCungCap || n.soDonMua || "—"}
                        </span>
                      )}
                      {n.soDonMua ? <span className="font-mono text-xs font-normal text-bo-muted">{n.soDonMua}</span> : null}
                      {/* Cột hẹp: nhãn dài ("Đã chuyển thành đơn mua hàng") xuống dòng trong cột thay vì tràn sang cột bên */}
                      <StatusBadge label={n.nhan} quyTrinh="yeuCauBaoGia" className="max-w-full whitespace-normal text-left" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            {bang.nhom.map((n, i) => {
              const idNhom = `${idBang}-nhom-${i}`;
              const tongNhom = n.thuGonDuoc ? soSanhTong(n.dong, soNcc) : [];
              return (
                <tbody key={n.khoa} id={idNhom}>
                  <DongNhomSanPham
                    ten={n.tenSanPham}
                    anh={n.anh}
                    dinhTrai
                    mo={n.mo}
                    thuGonDuoc={n.thuGonDuoc}
                    onDoi={() => bang.doiNhom(n.khoa)}
                    idVung={idNhom}
                    // Cột dính trái hẹp: bỏ chất liệu (đã có ở màn yêu cầu nhập hàng) cho dòng nhóm khỏi cao
                    dongPhu={chuSoBienThe(n, bang.dangTim)}
                    tomTat={n.tomTat}
                  >
                    {n.thuGonDuoc ? (
                      <>
                        <td className={cn(O, "text-right font-semibold", soNcc ? "" : O_CUOI)}>{soVN(n.tong.soLuong)}</td>
                        {tongNhom.map((x, j) => (
                          <OGia key={ncc[j].id} {...oTong(x, "—")} chot={ncc[j].chot} />
                        ))}
                      </>
                    ) : (
                      <td colSpan={soCot - 1} />
                    )}
                  </DongNhomSanPham>
                  {n.mo
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={DONG}>
                        <td className={cn(O, O_DAU_DONG_CON, COT_DINH, "bg-white group-hover:bg-bo-surface-subtle")}>
                          <MauKichCo dong={d} />
                          <span className="mt-0.5 block max-w-[260px] truncate font-mono text-xs text-bo-muted" title={d.sku}>
                            {d.sku || "—"}
                          </span>
                        </td>
                        <td className={cn(O, "text-right", soNcc ? "" : O_CUOI)}>{soVN(d.soLuong)}</td>
                        {soSanhDong(d.gia).map((o, j) => (
                          <OGia
                            key={ncc[j].id}
                            chu={o.co ? formatCurrency(xemTien ? o.thanhTien : o.donGia) : "—"}
                            kieu={o.co ? "" : "chua"}
                            thapNhat={o.thapNhat}
                            chot={ncc[j].chot}
                          />
                        ))}
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
            {soNcc ? (
              <tfoot>
                <tr className="border-t border-bo-border font-semibold">
                  <th scope="row" className={cn(O, O_DAU, COT_DINH, "bg-white text-left font-semibold text-bo-foreground")}>
                    Tổng tiền cả yêu cầu
                  </th>
                  <td className={O} />
                  {tongCaYeuCau.map((x, j) => {
                    const o = oTong(x, "Chưa báo giá");
                    return <OGia key={ncc[j].id} {...o} chu={<span className={o.kieu ? "" : "text-[15px]"}>{o.chu}</span>} chot={ncc[j].chot} />;
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      <KhongKetQua bang={bang} tenChungTu="yêu cầu báo giá" donVi="biến thể" />
      {bang.phanTrang ? <PhanTrangBang {...bang.phanTrang} /> : null}

      {chuThich ? (
        <p className="mt-auto flex items-start gap-1.5 border-t border-slate-100 px-4 py-3 text-xs leading-5 text-bo-muted sm:px-6">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{chuThich}</span>
        </p>
      ) : null}
    </section>
  );
}
