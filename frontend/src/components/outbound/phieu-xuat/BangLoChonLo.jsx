import { useMemo } from "react";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_MO,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { CO_TRANG_LO, NGUONG_CONG_CU_LO } from "@/config/bangChungTu";
import { formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { laLoHet, tinhTrangLo } from "./chonLo.js";

// Chỉ xem: mặc định chỉ hiện lô dòng này đã lấy
const BO_LOC_XEM = Object.freeze({ daLay: (d) => d.daLuu > 0, tatCa: null });
// Chữ "Không dùng" / "Hết hàng có thể lấy" là thông tin: slate-500 (tương phản 4,76:1), không mờ hơn
const MAU_TINH_TRANG = { mo: "text-slate-500", ok: "text-bo-success", warn: "text-bo-warning", bad: "text-bo-danger" };

function OMaLo({ maLo, dau }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-xs text-bo-foreground">
        {maLo}
      </span>
      {dau ? (
        <span className="whitespace-nowrap rounded-[3px] bg-bo-primary-soft px-1.5 text-[11px] font-medium leading-4 text-bo-primary-strong">
          Nhập sớm nhất
        </span>
      ) : null}
    </span>
  );
}

/**
 * Bảng "Lô trong kho" của màn Chọn lô hàng (lô sắp nhập trước lấy trước, lô hết hàng có thể lấy xếp cuối và mờ).
 * - Sửa: Mã lô · Ngày nhập gần nhất · Còn lấy được · ô Số lượng xuất · Tình trạng.
 * - Chỉ xem: Mã lô · Ngày nhập gần nhất · Số lượng xuất; lọc "Lô đã lấy" (mặc định) / "Tất cả lô".
 * Khối hẹp (< 672px): cột Ngày nhập và Tình trạng ẩn, hiện thành dòng phụ dưới mã lô — ô Số lượng xuất luôn trong khung.
 * Quá NGUONG_CONG_CU_LO lô: ô tìm mã lô + phân trang CO_TRANG_LO. Màn đặt `key` theo chế độ để bộ lọc mặc định đúng.
 *
 * `lots`: lô đã sắp; `chon` / `daLuu`: `{ [loHangId]: "số" }`; `onDoi(loHangId, chuoi)`; `dauFifo`: loHangId gắn "Nhập sớm nhất".
 */
export default function BangLoChonLo({ lots, chon, daLuu, chiXem, dang, dauFifo, onDoi }) {
  const dongLo = useMemo(
    () =>
      lots.map((l) => ({
        id: l.loHangId,
        maLo: l.maLo,
        lot: l,
        kd: docSo(l.soLuongKhaDung),
        daLuu: Number(daLuu[l.loHangId]) || 0,
        het: laLoHet(l, daLuu),
      })),
    [lots, daLuu],
  );
  const bang = useBangChungTu(dongLo, {
    theo: "dong",
    donVi: "lô",
    nguongCongCu: NGUONG_CONG_CU_LO,
    luaChonCoTrang: CO_TRANG_LO,
    boLoc: chiXem ? BO_LOC_XEM : undefined,
  });

  return (
    <section aria-labelledby="cl-lo" className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="cl-lo" className="text-base font-semibold leading-6 text-bo-foreground">Lô trong kho</h2>
          <p className="text-[13px] leading-5 text-bo-muted">Nhập trước lấy trước: lô nhập sớm ở trên</p>
        </div>
        {chiXem && lots.length ? (
          <NutPhanDoan
            nhan="Lọc lô"
            value={bang.locNhanh}
            onChange={bang.datLoc}
            luaChon={[
              { value: "daLay", label: "Lô đã lấy", count: bang.demLoc.daLay },
              { value: "tatCa", label: "Tất cả lô", count: bang.demLoc.tatCa },
            ]}
          />
        ) : null}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo mã lô"
          nhanTim="Tìm lô"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          propsTim={{ spellCheck: false, autoComplete: "off" }}
        />
      ) : null}

      {bang.dong.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[560px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Mã lô</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[160px]", AN_DIEN_THOAI)}>Ngày nhập gần nhất</th>
                {chiXem ? (
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[140px] text-right")}>Số lượng xuất</th>
                ) : (
                  <>
                    <th scope="col" className={cn(O_TIEU_DE, "w-[100px] text-right @2xl/khoi:w-[120px]")}>Còn lấy được</th>
                    <th scope="col" className={cn(O_TIEU_DE, "w-[112px] text-right @max-2xl/khoi:pr-4 @2xl/khoi:w-[128px]")}>
                      Số lượng xuất
                    </th>
                    <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[150px]", AN_DIEN_THOAI)}>Tình trạng</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {bang.dong.map((d) => {
                const ngay = d.lot.ngayNhapGanNhat ? formatDate(d.lot.ngayNhapGanNhat) : "—";
                if (chiXem) {
                  return (
                    <tr key={d.id} className={cn(DONG, d.daLuu > 0 ? null : DONG_MO)}>
                      <td className={cn(O, O_DAU)}>
                        <OMaLo maLo={d.maLo} dau={d.id === dauFifo} />
                        <div className={cn("mt-1 text-xs leading-4 text-bo-muted", CHI_DIEN_THOAI)}>Nhập {ngay}</div>
                      </td>
                      <td className={cn(O, AN_DIEN_THOAI)}>{ngay}</td>
                      <td className={cn(O, O_CUOI, "text-right font-semibold")}>{d.daLuu > 0 ? soVN(d.daLuu) : "—"}</td>
                    </tr>
                  );
                }
                const giaTri = chon[d.id] ?? "";
                const sl = Number(giaTri) || 0;
                const tinhTrang = tinhTrangLo(giaTri, d.kd);
                const vuot = sl > d.kd;
                const khoaO = dang || (d.het && sl === 0);
                return (
                  <tr key={d.id} className={cn(DONG, d.het && sl === 0 ? DONG_MO : null)}>
                    <td className={cn(O, O_DAU)}>
                      <OMaLo maLo={d.maLo} dau={d.id === dauFifo} />
                      <div className={cn("mt-1 text-xs leading-4 text-bo-muted", CHI_DIEN_THOAI)}>
                        Nhập {ngay} · <span className={MAU_TINH_TRANG[tinhTrang.tone]}>{tinhTrang.chu}</span>
                      </div>
                    </td>
                    <td className={cn(O, AN_DIEN_THOAI)}>{ngay}</td>
                    <td className={cn(O, "text-right")}>{soVN(d.kd)}</td>
                    <td className={cn(O, "text-right @max-2xl/khoi:pr-4")}>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={giaTri}
                        placeholder="0"
                        disabled={khoaO}
                        aria-label={`Số lượng lấy từ lô ${d.maLo}`}
                        aria-invalid={vuot || undefined}
                        onChange={(e) => onDoi(d.id, e.target.value)}
                        className={cn(
                          "h-[34px] w-20 rounded-md border bg-bo-surface px-2.5 text-right text-sm font-semibold tabular-nums text-bo-foreground outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle disabled:text-bo-muted @2xl/khoi:w-24",
                          vuot
                            ? "border-bo-danger ring-2 ring-bo-danger/15 focus:ring-bo-danger/25"
                            : "border-[#cfd8e3] focus:border-bo-primary focus:ring-bo-primary/15",
                        )}
                      />
                    </td>
                    <td className={cn(O, O_CUOI, "text-[13px]", AN_DIEN_THOAI, MAU_TINH_TRANG[tinhTrang.tone])}>{tinhTrang.chu}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {bang.rong ? (
        <KhongKetQua chu={chiXem ? "Dòng này chưa lấy lô nào." : "Sản phẩm này hiện không có lô hàng nào khả dụng."} />
      ) : bang.khongKetQua && !bang.dangTim ? (
        <KhongKetQua chu="Dòng này chưa lấy lô nào." />
      ) : (
        <KhongKetQua bang={bang} donVi="lô" />
      )}
      <PhanTrangBang {...bang.phanTrang} />
    </section>
  );
}
