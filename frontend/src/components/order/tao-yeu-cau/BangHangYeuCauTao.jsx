import { useId, useMemo, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DongNhomSanPham from "@/components/chung-tu/DongNhomSanPham";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { locDong, soVN } from "@/components/chung-tu/bangChungTu";
import {
  AN_DIEN_THOAI, BANG, CHI_DIEN_THOAI, DONG, DONG_SANG, DONG_TIEU_DE, KHUNG_CUON, O, O_CUOI, O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { NHAN_CANH_BAO, NHAN_DU, NHAN_TRUNG, O_CHON } from "./kieuTaoYeuCau";
import { BO_LOC_BANG, canChuY, SO_LUONG_TOI_DA } from "./tinhTaoYeuCau";

// Khối hẹp (điện thoại, 768px có thanh bên): cột chọn / số lượng / bỏ và độ thụt dòng biến thể nhỏ lại để bảng vừa khung
const O_CHON_TD = "w-10 py-0 pl-3 pr-0 align-middle @2xl/khoi:w-14 @2xl/khoi:pl-6";
const O_SO_LUONG = "w-24 @2xl/khoi:w-32";
const O_BO = "w-10 pl-0 @2xl/khoi:w-14 @2xl/khoi:pl-3";
const O_DONG_CON = "pl-4 @2xl/khoi:pl-[72px]";
const trangThai = (ids, chon) => {
  const so = ids.filter((id) => chon.has(String(id))).length;
  return so === 0 ? false : so === ids.length ? true : "indeterminate";
};
const chuBienThe = (n) => (n.soBienThe !== n.soBienTheCaNhom
  ? `${soVN(n.soBienThe)}/${soVN(n.soBienTheCaNhom)} biến thể`
  : `${soVN(n.soBienThe)} biến thể`);

/** Ô "Đề xuất" của một dòng: số đề xuất, "—" khi chưa cần nhập, "Chưa nhập" khi chưa từng nhập về Kho tổng. */
function ODeXuat({ d }) {
  if (d.khongConBan) return <span className="text-bo-muted">—</span>;
  if (!d.daTungNhap) {
    return <span className="text-xs text-bo-muted" title="Mã chưa nhập về Kho tổng lần nào nên chưa có số đề xuất">Chưa nhập</span>;
  }
  return d.deXuat > 0 ? soVN(d.deXuat) : <span className="text-bo-muted" title="Kho tổng chưa dưới ngưỡng">—</span>;
}

/**
 * Bảng "Hàng cần nhập" của màn Tạo yêu cầu nhập hàng: cùng kiểu bảng chứng từ (BangHangTaoPhieu: gom theo sản phẩm, quá
 * NGUONG_CONG_CU dòng thì có ô tìm, lọc nhanh, mở / thu gọn tất cả, phân trang theo sản phẩm), thêm:
 * - cột chọn (từng dòng, cả sản phẩm, mọi dòng đang lọc) và thanh thao tác hàng loạt thay thanh công cụ khi đang chọn:
 *   đặt cùng số lượng, đưa về số đề xuất, bỏ khỏi yêu cầu;
 * - cột Khả dụng / Đang về / Đề xuất ở Kho tổng (khối hẹp: ghi dưới SKU), nhãn "Đang trong PR…" và "Kho tổng còn dư".
 *
 * `bang`: useBangChungTu(dongBang, { boLoc: BO_LOC_BANG, ... }); `dongTatCa`: mọi dòng (để chọn hết dòng đang lọc);
 * `nutXem`: nút đổi Danh sách / Lưới; `chon` (Set id chuỗi) + `onDoiChon(ids, co)`. `soLieuCu`: số Kho tổng đang hiện là của
 * kho trước (vừa đổi kho, chưa tải xong hoặc tải lỗi) → khóa "Theo số đề xuất".
 */
export default function BangHangYeuCauTao({
  bang,
  dongTatCa,
  chon,
  onDoiChon,
  onDoiSoLuong,
  onRoiSoLuong,
  onBo,
  onDatSoLuong,
  onTheoDeXuat,
  onBoNhieu,
  dongSang,
  khoa = false,
  soLieuCu = false,
  nutXem,
}) {
  const idBang = useId();
  const [slChung, setSlChung] = useState("");

  const idsLoc = useMemo(
    () => locDong(dongTatCa, { tuKhoa: bang.tuKhoa, loc: BO_LOC_BANG[bang.locNhanh] ?? null }).map((d) => String(d.id)),
    [dongTatCa, bang.tuKhoa, bang.locNhanh],
  );
  const idsChon = (dongTatCa ?? []).map((d) => String(d.id)).filter((id) => chon.has(id));
  const soChon = idsChon.length;
  const coDeXuat = (dongTatCa ?? []).some((d) => chon.has(String(d.id)) && d.deXuat > 0);
  const ttTatCa = idsLoc.length ? trangThai(idsLoc, chon) : false;
  const soChuY = bang.demLoc?.chuY ?? 0;
  const slChungSo = Math.floor(Number(slChung));

  const datSlChung = () => {
    if (!(slChungSo >= 1)) return;
    onDatSoLuong?.(idsChon, Math.min(SO_LUONG_TOI_DA, slChungSo));
  };

  const boLoc = soChuY > 0 && bang.coCongCu ? (
    <NutPhanDoan
      nhan="Lọc dòng"
      value={bang.locNhanh}
      onChange={bang.datLoc}
      luaChon={[
        { value: "tatCa", label: `Tất cả (${soVN(bang.tong.soDong)})` },
        { value: "chuY", label: `Cần chú ý (${soVN(soChuY)})` },
      ]}
    />
  ) : null;

  return (
    <section aria-label="Hàng cần nhập" className="flex min-w-0 flex-1 flex-col">
      {soChon > 0 && !khoa ? (
        <div
          role="region"
          aria-label="Thao tác với các dòng đã chọn"
          className="mx-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-blue-200 bg-bo-primary-soft py-1.5 pl-3 pr-2 text-[13px] sm:mx-6"
        >
          <span className="tabular-nums"><b className="font-semibold">{soVN(soChon)}</b> biến thể đã chọn</span>
          <button type="button" onClick={() => onDoiChon(idsChon, false)} className="font-semibold text-bo-primary hover:underline">
            Bỏ chọn
          </button>
          <span className="hidden h-5 w-px bg-blue-200 sm:block" aria-hidden="true" />
          <label className="inline-flex items-center gap-1.5 text-slate-700">
            Số lượng
            <input
              type="text"
              inputMode="numeric"
              value={slChung}
              onChange={(e) => setSlChung(e.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); datSlChung(); } }}
              aria-label="Số lượng đặt cho các dòng đã chọn"
              className={cn(O_NHAP, "h-8 w-20 text-right font-semibold tabular-nums")}
            />
          </label>
          <Button type="button" variant="outline" size="sm" disabled={!(slChungSo >= 1)} onClick={datSlChung}
            className="h-8 border-bo-border bg-bo-surface text-[13px] shadow-none hover:bg-bo-surface-subtle">
            Đặt cho {soVN(soChon)} dòng
          </Button>
          <span className="flex flex-wrap gap-2 sm:ml-auto">
            <Button type="button" variant="outline" size="sm" disabled={!coDeXuat || soLieuCu} onClick={() => onTheoDeXuat?.(idsChon)}
              title={soLieuCu ? "Đang tải số liệu của kho vừa chọn" : coDeXuat ? undefined : "Các dòng đã chọn chưa có số đề xuất"}
              className="h-8 border-bo-border bg-bo-surface text-[13px] shadow-none hover:bg-bo-surface-subtle">
              Theo số đề xuất
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onBoNhieu?.(idsChon)}
              className="h-8 border-bo-border bg-bo-surface text-[13px] text-bo-danger shadow-none hover:bg-bo-danger-soft">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Bỏ khỏi yêu cầu
            </Button>
          </span>
        </div>
      ) : bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm trong yêu cầu: tên, SKU, màu, cỡ"
          nhanTim="Tìm trong yêu cầu"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          boLoc={boLoc}
          nutXem={nutXem}
          moHet={bang.moHet}
          onDoiMoHet={bang.doiMoTatCa}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 sm:px-6">
          {nutXem}
          <span className="text-xs leading-4 text-bo-muted">Sửa số lượng ngay trong bảng</span>
        </div>
      )}
      {bang.chuGoiYThuGon ? (
        <p className="px-4 pb-2 text-[13px] leading-5 text-bo-muted sm:px-6">{bang.chuGoiYThuGon}</p>
      ) : null}

      {bang.nhom.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[760px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_CHON_TD)}>
                  <Checkbox
                    checked={ttTatCa}
                    disabled={khoa || !idsLoc.length}
                    onCheckedChange={() => onDoiChon(idsLoc, ttTatCa !== true)}
                    aria-label={bang.dangTim || bang.dangLoc
                      ? `Chọn tất cả ${soVN(idsLoc.length)} biến thể đang lọc`
                      : `Chọn tất cả ${soVN(idsLoc.length)} biến thể`}
                    className={O_CHON}
                  />
                </th>
                <th scope="col" className={O_TIEU_DE}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right", AN_DIEN_THOAI)} title="Khả dụng ở Kho tổng">Khả dụng</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-20 text-right", AN_DIEN_THOAI)} title="Phần chưa nhận của đơn mua đã chốt về Kho tổng">Đang về</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right", AN_DIEN_THOAI)} title="Đưa khả dụng + đang về lên gấp đôi ngưỡng">Đề xuất</th>
                <th scope="col" className={cn(O_TIEU_DE, O_SO_LUONG, "text-right")}>Số lượng nhập</th>
                <th scope="col" className={cn(O_TIEU_DE, O_BO, O_CUOI)}><span className="sr-only">Bỏ dòng</span></th>
              </tr>
            </thead>
            {bang.nhom.map((n, iNhom) => {
              const idVung = `${idBang}-nhom-${iNhom}`;
              const ids = n.dong.map((d) => String(d.id));
              const tt = trangThai(ids, chon);
              const soChuYNhom = n.dong.filter((d) => canChuY(d)).length;
              return (
                <tbody key={n.khoa} id={idVung}>
                  <DongNhomSanPham
                    ten={n.tenSanPham}
                    anh={n.anh}
                    mo={n.mo}
                    thuGonDuoc={n.thuGonDuoc}
                    onDoi={() => bang.doiNhom(n.khoa)}
                    idVung={idVung}
                    dongPhu={[
                      chuBienThe(n),
                      soChuYNhom ? <span key="cy" className="font-medium text-bo-warning">{soVN(soChuYNhom)} cần chú ý</span> : null,
                    ]}
                    tomTat={n.tomTat}
                    oDau={(
                      <td className={O_CHON_TD}>
                        <Checkbox
                          checked={tt}
                          disabled={khoa}
                          onCheckedChange={() => onDoiChon(ids, tt !== true)}
                          aria-label={`Chọn các biến thể của ${n.tenSanPham}`}
                          className={O_CHON}
                        />
                      </td>
                    )}
                  >
                    <td className={cn(O, "text-right font-semibold", AN_DIEN_THOAI)}>{soVN(n.tong.khaDung)}</td>
                    <td className={cn(O, "text-right font-semibold", AN_DIEN_THOAI)}>{soVN(n.tong.dangVe)}</td>
                    <td className={cn(O, "text-right font-semibold", AN_DIEN_THOAI)}>{n.tong.deXuat ? soVN(n.tong.deXuat) : "—"}</td>
                    <td className={cn(O, "text-right font-semibold")}>{soVN(n.tong.soLuong)}</td>
                    <td className={cn(O, O_BO, O_CUOI, "text-right")}>
                      {khoa ? null : (
                        <button
                          type="button"
                          onClick={() => onBoNhieu?.(ids)}
                          aria-label={`Bỏ ${n.tenSanPham} (${chuBienThe(n)})`}
                          title="Bỏ các biến thể này"
                          className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-bo-danger-soft hover:text-bo-danger"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </DongNhomSanPham>
                  {n.mo ? n.dong.map((d) => {
                    const daChon = chon.has(String(d.id));
                    const nhanDong = `${d.tenSanPham} ${d.tenMau || ""} ${d.kichCo || ""}`.trim();
                    return (
                      <tr
                        key={d.id}
                        className={cn(DONG, daChon && "bg-blue-50/60", dongSang != null && String(dongSang) === String(d.id) && DONG_SANG)}
                      >
                        <td className={O_CHON_TD}>
                          <Checkbox
                            checked={daChon}
                            disabled={khoa}
                            onCheckedChange={() => onDoiChon([String(d.id)], !daChon)}
                            aria-label={`Chọn ${nhanDong}`}
                            className={O_CHON}
                          />
                        </td>
                        <td className={cn(O, O_DONG_CON)}>
                          <MauKichCo dong={d} className="max-w-full" />
                          <div className="mt-0.5 break-all font-mono text-xs text-bo-muted">{d.sku || "—"}</div>
                          {d.khongConBan ? (
                            <div className="mt-1 text-xs font-medium text-bo-danger">Mã đã ngừng kinh doanh, bỏ dòng này trước khi gửi</div>
                          ) : null}
                          {d.yeuCauMo ? (
                            <span
                              className={cn(NHAN_CANH_BAO, NHAN_TRUNG, "max-w-full")}
                              title={`Mã này đang nằm trong yêu cầu nhập hàng ${d.yeuCauMo.ma} chưa xong`}
                            >
                              <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">
                                Đang trong {d.yeuCauMo.ma}{d.yeuCauMo.soYeuCau > 1 ? ` và ${soVN(d.yeuCauMo.soYeuCau - 1)} yêu cầu khác` : ""}
                              </span>
                            </span>
                          ) : d.du ? (
                            <span className={cn(NHAN_CANH_BAO, NHAN_DU)} title="Khả dụng + đang về đã vượt ngưỡng × hệ số dư">
                              Kho tổng còn dư hàng
                            </span>
                          ) : null}
                          <div className={cn("mt-0.5 text-xs text-bo-muted", CHI_DIEN_THOAI)}>
                            Khả dụng {soVN(d.khaDung)} · Đang về {soVN(d.dangVe)} · Đề xuất {d.deXuat > 0 ? soVN(d.deXuat) : "—"}
                          </div>
                        </td>
                        <td className={cn(O, "text-right", AN_DIEN_THOAI)}>{soVN(d.khaDung)}</td>
                        <td className={cn(O, "text-right", AN_DIEN_THOAI)}>{soVN(d.dangVe)}</td>
                        <td className={cn(O, "text-right", AN_DIEN_THOAI)}><ODeXuat d={d} /></td>
                        <td className={cn(O, "text-right")}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={d.oNhap}
                            disabled={khoa}
                            onChange={(e) => onDoiSoLuong?.(d.id, e.target.value)}
                            onBlur={() => onRoiSoLuong?.(d.id)}
                            aria-label={`Số lượng nhập: ${nhanDong}`}
                            aria-invalid={d.oNhap === "" ? true : undefined}
                            className={cn(O_NHAP, "ml-auto h-8 w-20 text-right font-semibold tabular-nums @2xl/khoi:w-24", d.oNhap === "" && "border-bo-danger")}
                          />
                        </td>
                        <td className={cn(O, O_BO, O_CUOI, "text-right")}>
                          {khoa ? null : (
                            <button
                              type="button"
                              onClick={() => onBo?.(d.id)}
                              aria-label={`Bỏ ${nhanDong}`}
                              title="Bỏ dòng"
                              className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-bo-danger-soft hover:text-bo-danger"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }) : null}
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
