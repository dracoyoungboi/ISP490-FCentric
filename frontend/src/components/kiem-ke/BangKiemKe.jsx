import { useId, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { phanTrang, soVN } from "@/components/chung-tu/bangChungTu";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_SANG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CO_TRANG_DONG, NGUONG_CONG_CU, SO_DEM_KIEM_KE_TOI_DA } from "@/config/bangChungTu";
import { cn } from "@/lib/utils";
import { TEN_LOC, chuKetQuaTim, docSoDem, dongHienThi, timLo } from "./tinhKiemKe";

// Màu chữ đủ tương phản trên nền trắng (≥ 4,5:1)
const MAU_CHENH = {
  thua: "text-bo-primary-strong",
  thieu: "text-bo-danger",
  khop: "text-bo-success",
  xen: "text-bo-warning",
  mo: "font-medium text-slate-500",
};

// Ký tự không phải chữ số trong ô đếm: máy quét đã gõ mã lô vào nhầm ô (quên Enter trước khi quét tem kế tiếp)
const MAU_KHONG_PHAI_SO = /[^\d\s]/;
// Các phím cách nhau dưới ngần này (ms) là máy quét gõ (người gõ chậm hơn nhiều): phân biệt số người đếm với mã quét
const KHOANG_PHIM_MAY_QUET_MS = 50;

/**
 * Chữ cột cuối của một dòng: Chưa đếm / Không đếm / Đếm lại / Đã đếm (đếm mù) / Khớp / Thừa n / Thiếu n. `chiXem`: người
 * không đếm đợt này không thấy số đếm (nằm trên máy người đếm) → "—" thay cho "Chưa đếm".
 */
function ChenhLech({ d, mu, chiXem = false }) {
  if (d.xen) return <span className={cn("whitespace-nowrap font-semibold", MAU_CHENH.xen)}>Đếm lại</span>;
  if (d.loai === "chua" && chiXem) return <span className={MAU_CHENH.mo}>—</span>;
  if (d.loai === "chua") return <span className={cn("whitespace-nowrap", MAU_CHENH.mo)}>Chưa đếm</span>;
  if (d.loai === "khongDem") return <span className={cn("whitespace-nowrap", MAU_CHENH.mo)}>Không đếm</span>;
  if (mu) return <span className="whitespace-nowrap font-medium text-bo-foreground">Đã đếm</span>;
  const chu = d.loai === "khop" ? "Khớp" : d.loai === "thua" ? `Thừa ${soVN(d.lech)}` : `Thiếu ${soVN(-d.lech)}`;
  return <span className={cn("whitespace-nowrap font-semibold tabular-nums", MAU_CHENH[d.loai])}>{chu}</span>;
}

// Nút − / + của ô đếm: khối hẹp (điện thoại) to hơn để dễ chạm; tiêu điểm bàn phím tô nền (viền ngoài bị khung cắt)
const NUT_DEM =
  "grid w-8 place-items-center bg-slate-50 text-slate-600 outline-none hover:bg-slate-100 hover:text-bo-foreground focus-visible:bg-bo-primary-soft focus-visible:text-bo-primary-strong disabled:cursor-not-allowed disabled:opacity-40 @max-2xl/khoi:w-11";

/**
 * Ô đếm − / số / +: gõ số nguyên (trống = chưa đếm); nhận tiêu điểm thì chọn sẵn số cũ (gõ số mới thay hẳn, không nối vào);
 * Enter về ô quét để quét lô tiếp — dòng "Đếm lại" thì Enter cũng ghi lại giờ đếm (đếm lại ra đúng số cũ vẫn hết cờ).
 * Lỡ quét mã lô vào ô này (có chữ cái, dấu "-"): chuyển phần vừa quét sang ô tìm (`onQuetNham`). Cả chuỗi gõ liền một
 * mạch (máy quét) → là mã quét, trả lại số lúc vào ô; người gõ số rồi máy quét gõ tiếp → giữ phần số làm số đếm.
 */
function ODem({ d, onDoiSo, onXong, onQuetNham, idO }) {
  const doi = (so) => onDoiSo(d.id, so);
  // Số trong ô lúc nhận tiêu điểm (trả lại khi máy quét gõ nhầm mã lô vào đây) và giờ các phím đã gõ từ lúc đó
  const soKhiVaoRef = useRef(d.so);
  const gioPhimRef = useRef([]);
  return (
    <span
      className={cn(
        "inline-flex h-9 items-stretch overflow-hidden rounded-md border bg-white focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 @max-2xl/khoi:h-11",
        d.so == null ? "border-bo-input-border" : "border-bo-primary/40",
      )}
    >
      <button
        type="button"
        aria-label={`Bớt 1 ở lô ${d.maLo}`}
        disabled={d.so == null || d.so <= 0}
        onClick={() => doi(Math.max(0, (d.so ?? 0) - 1))}
        className={NUT_DEM}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <input
        id={idO}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`Số thực tế lô ${d.maLo}`}
        placeholder="Đếm"
        value={d.so == null ? "" : String(d.so)}
        onFocus={(e) => {
          soKhiVaoRef.current = d.so;
          gioPhimRef.current = [];
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const chu = e.target.value;
          if (MAU_KHONG_PHAI_SO.test(chu) && onQuetNham) {
            const cu = soKhiVaoRef.current;
            const gio = gioPhimRef.current;
            const quetLienMach = gio.length >= 2 && gio.every((t, i) => i === 0 || t - gio[i - 1] < KHOANG_PHIM_MAY_QUET_MS);
            const viTri = chu.search(MAU_KHONG_PHAI_SO);
            if (quetLienMach) {
              // Cả chuỗi là mã quét (kể cả mã bắt đầu bằng số): trả số lúc vào ô
              const tienTo = cu == null ? "" : String(cu);
              doi(cu ?? null);
              onQuetNham(chu.startsWith(tienTo) ? chu.slice(tienTo.length) : chu);
            } else {
              // Người đã gõ số đếm rồi máy quét gõ tiếp mã lô kế tiếp: giữ phần số, mã sang ô tìm
              const phanSo = chu.slice(0, viTri);
              doi(phanSo.trim() ? docSoDem(phanSo, SO_DEM_KIEM_KE_TOI_DA) : cu ?? null);
              onQuetNham(chu.slice(viTri));
            }
            return;
          }
          doi(docSoDem(chu, SO_DEM_KIEM_KE_TOI_DA));
        }}
        onKeyDown={(e) => {
          if (e.key.length === 1) gioPhimRef.current.push(e.timeStamp);
          if (e.key === "Enter") {
            e.preventDefault();
            if (d.xen && d.so != null) doi(d.so);
            onXong?.();
          }
        }}
        className="w-16 border-x border-slate-200 bg-white text-center text-sm tabular-nums text-bo-foreground outline-none placeholder:text-slate-500"
      />
      <button
        type="button"
        aria-label={`Thêm 1 ở lô ${d.maLo}`}
        disabled={(d.so ?? 0) >= SO_DEM_KIEM_KE_TOI_DA}
        onClick={() => doi((d.so ?? 0) + 1)}
        className={NUT_DEM}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Bảng "Lô trong kho" của màn Chi tiết đợt kiểm kê. Màn giữ trạng thái (từ khóa, lọc, dòng giữ lại, trang) vì thông báo và
 * hộp Hoàn thành cũng đổi lọc; bảng chỉ vẽ.
 *
 * - `rows`: tinhKiemKe.tinhDong. `luaChon`: tinhKiemKe.luaChonLoc. `suaDuoc`: đang kiểm kê và người này được đếm (có ô
 *   − / +). `mu`: đếm mù (ẩn cột Hệ thống và Chênh lệch; cột cuối là trạng thái).
 * - Ô tìm: ưu tiên trùng mã lô (dòng tô xanh, Enter đưa tiêu điểm vào ô đếm của dòng đó); có từ khóa thì tìm trên mọi lô.
 *   `oTimRef`: ref của ô tìm (sau khi nhập số, Enter đưa tiêu điểm về đây và chọn sẵn chữ để quét lô tiếp).
 * - `nutMu`: { bat, onDoi } → công tắc Đếm mù trên thanh công cụ (chỉ khi đang đếm).
 * - `lyDoKhoa` + `idLyDo`: lý do khóa Hoàn thành, hiện thành chữ ngay trên bảng (nút ở đầu khối có chú thích riêng).
 * - `chiXem`: đợt đang kiểm kê của kho không được phân — số đếm nằm trên máy người đếm nên cột cuối ghi "—".
 * - Khối hẹp (< 672px): mã lô và tồn hệ thống xuống dưới tên; chênh lệch xuống dưới ô đếm.
 */
export default function BangKiemKe({
  rows,
  luaChon,
  loc,
  onDoiLoc,
  tuKhoa,
  onDoiTuKhoa,
  giuLai,
  trang,
  coTrang,
  onDoiTrang,
  onDoiCoTrang,
  suaDuoc = false,
  mu = false,
  chiXem = false,
  onDoiSo,
  oTimRef,
  nutMu,
  lyDoKhoa = "",
  idLyDo,
}) {
  const idBang = useId();
  const kq = timLo(rows, tuKhoa);
  const ds = dongHienThi(rows, { tuKhoa, loc, giuLai });
  const coPhanTrang = rows.length > NGUONG_CONG_CU && ds.length > 0;
  const cat = phanTrang(ds, trang, coPhanTrang ? coTrang : Infinity);
  const dongSang = kq?.kieu === "lo" && kq.ds.length === 1 ? kq.ds[0].id : null;
  const hienHeThong = !mu;
  const idO = (id) => `${idBang}-dem-${id}`;
  const veOTim = () => {
    const o = oTimRef?.current;
    if (!o) return;
    o.focus();
    o.select?.();
  };

  const doiTuKhoa = (chu) => {
    onDoiTuKhoa(chu);
    onDoiTrang(0);
  };
  // Máy quét gõ nhầm mã lô vào ô đếm: đưa phần vừa quét sang ô tìm, tiêu điểm về ô tìm để máy quét gõ nốt
  const quetNham = (chu) => {
    doiTuKhoa(String(chu ?? "").trimStart());
    oTimRef?.current?.focus();
  };

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-5 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">Lô trong kho</h2>
      </div>
      {lyDoKhoa ? (
        <p id={idLyDo} className="-mt-1 px-4 pb-3 text-xs leading-4 text-bo-muted sm:px-6">Chưa hoàn thành được: {lyDoKhoa}.</p>
      ) : null}

      <ThanhCongCuBang
        tuKhoa={tuKhoa}
        onDoiTuKhoa={doiTuKhoa}
        onXoaTuKhoa={() => doiTuKhoa("")}
        goiYTim="Quét mã lô trên tem, hoặc gõ SKU, tên để tìm"
        nhanTim="Tìm lô"
        ketQua={chuKetQuaTim(kq)}
        khongKetQua={Boolean(kq) && !kq.ds.length}
        propsTim={{
          ref: oTimRef,
          autoComplete: "off",
          // Máy quét gửi Enter sau mã: trùng đúng một lô thì sang ô đếm của lô đó
          onKeyDown: (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (suaDuoc && dongSang != null) document.getElementById(idO(dongSang))?.focus(); // ô đếm tự chọn sẵn số cũ
          },
        }}
        boLoc={
          <NutPhanDoan
            nhan="Lọc lô"
            value={loc}
            onChange={onDoiLoc}
            luaChon={luaChon}
          />
        }
        nutXem={
          nutMu ? (
            <span className="flex h-8 items-center gap-2 rounded-md border border-bo-border bg-white px-2.5">
              <Switch
                id={`${idBang}-mu`}
                checked={nutMu.bat}
                onCheckedChange={nutMu.onDoi}
                aria-describedby={`${idBang}-mu-mo-ta`}
                // Enter của máy quét không bật / tắt đếm mù khi tiêu điểm lỡ nằm ở đây (Space vẫn đổi được)
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
              <Label htmlFor={`${idBang}-mu`} className="cursor-pointer text-[13px] font-medium text-bo-foreground" title="Ẩn tồn hệ thống và chênh lệch khi đếm">
                Đếm mù
              </Label>
              <span id={`${idBang}-mu-mo-ta`} className="sr-only">Ẩn tồn hệ thống và chênh lệch khi đếm</span>
            </span>
          ) : null
        }
      />

      {cat.muc.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[640px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[150px]", AN_DIEN_THOAI)}>Lô</th>
                {hienHeThong ? (
                  <th scope="col" className={cn(O_TIEU_DE, "w-[96px] text-right", AN_DIEN_THOAI)}>Hệ thống</th>
                ) : null}
                <th scope="col" className={cn(O_TIEU_DE, suaDuoc ? "w-[150px]" : "w-[96px] text-right")}>Thực tế</th>
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[110px] text-right", AN_DIEN_THOAI)}>
                  {mu ? "Trạng thái" : "Chênh lệch"}
                </th>
              </tr>
            </thead>
            <tbody>
              {cat.muc.map((d) => (
                <tr key={d.id} className={cn(DONG, dongSang === d.id && DONG_SANG)}>
                  <td className={cn(O, O_DAU)}>
                    <span className="flex min-w-0 items-center gap-3">
                      <AnhBienThe />
                      <span className="block min-w-0">
                        <span className="line-clamp-2 font-medium leading-5 text-bo-foreground" title={d.tenSanPham}>{d.tenSanPham || "—"}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
                          <span className="break-all font-mono">{d.sku || "—"}</span>
                          <span className={CHI_DIEN_THOAI}>
                            {" · lô "}
                            <span className="break-all font-mono text-slate-700">{d.maLo || "—"}</span>
                            {hienHeThong ? <> · hệ thống <b className="font-semibold text-slate-700">{soVN(d.heThong)}</b></> : null}
                          </span>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={cn(O, AN_DIEN_THOAI)}>
                    <span className="break-all font-mono text-[13px] text-slate-700">{d.maLo || "—"}</span>
                  </td>
                  {hienHeThong ? (
                    <td className={cn(O, "text-right font-medium text-bo-foreground", AN_DIEN_THOAI)}>{soVN(d.heThong)}</td>
                  ) : null}
                  {/* Khối hẹp: cột Thực tế là cột cuối → lề phải như O_CUOI */}
                  <td className={cn(O, !suaDuoc && "text-right", "@max-2xl/khoi:pr-4")}>
                    {suaDuoc ? (
                      <ODem d={d} onDoiSo={onDoiSo} onXong={veOTim} onQuetNham={quetNham} idO={idO(d.id)} />
                    ) : (
                      <span className="font-medium text-bo-foreground">{d.so == null ? <span className="text-bo-muted">—</span> : soVN(d.so)}</span>
                    )}
                    <span className={cn("mt-1 block text-xs", !suaDuoc && "text-right", CHI_DIEN_THOAI)}>
                      <ChenhLech d={d} mu={mu} chiXem={chiXem} />
                    </span>
                  </td>
                  <td className={cn(O, O_CUOI, "text-right", AN_DIEN_THOAI)}>
                    <ChenhLech d={d} mu={mu} chiXem={chiXem} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!rows.length ? (
        <KhongKetQua chu="Đợt kiểm kê không có lô nào." />
      ) : kq && !kq.ds.length ? (
        <KhongKetQua tuKhoa={tuKhoa} donVi="lô" onXoaTuKhoa={() => doiTuKhoa("")} />
      ) : !kq && !ds.length ? (
        <KhongKetQua
          chu={`Không có lô ${TEN_LOC[loc] ?? ""}.`}
          nhanNut="Xem tất cả lô"
          onNut={() => onDoiLoc("tatCa")}
        />
      ) : null}
      {coPhanTrang ? (
        <PhanTrangBang
          page={cat.trang}
          size={coTrang}
          total={ds.length}
          onPageChange={onDoiTrang}
          onSizeChange={onDoiCoTrang}
          sizeOptions={CO_TRANG_DONG}
          sizeLabel="lô"
          totalLabel="lô"
        />
      ) : null}
    </section>
  );
}
