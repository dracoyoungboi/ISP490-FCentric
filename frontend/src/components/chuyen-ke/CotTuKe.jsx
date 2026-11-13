import { ArrowLeftRight, Minus, Plus } from "lucide-react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t, tDuLieu } from "@/i18n";
import { soNguyen } from "./chuyenKe";
import { ChamNhan, ThanhSucChua, TrangThaiKe } from "./KeHienThi";
import { chuSucChua, viTriKe } from "./nhanKe";

// Tiêu đề cột hẹp được xuống 2 dòng (bản tiếng Anh dài hơn) thay vì chồng chữ sang cột bên
const TH = "flex min-h-10 items-center py-1.5 text-[11px] font-semibold uppercase leading-3.5 tracking-wide text-bo-muted [&.text-right]:justify-end [&.text-right]:text-right";
const NUT_BUOC = "grid h-full w-7 place-items-center text-slate-500 hover:text-bo-foreground disabled:cursor-not-allowed disabled:opacity-40";

/** Ô số lượng chuyển của một lô: − / ô số / +, viền xanh khi đã chọn, đỏ khi vừa nhập quá khả dụng. */
function OSoLuong({ dong, giaTri, onDoi, onXong, loi }) {
  const so = soNguyen(giaTri);
  const id = `ck-so-${dong.loHangId}`;
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-md border bg-white",
        loi ? "border-bo-danger ring-2 ring-bo-danger/10" : so ? "border-bo-primary ring-2 ring-bo-primary/15" : "border-bo-input-border",
      )}
    >
      <button type="button" className={NUT_BUOC} disabled={so <= 0} onClick={() => {
          onDoi(so - 1);
          onXong?.();
        }} aria-label={t("Bớt 1")}>
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <label htmlFor={id} className="sr-only">
        {t("Số lượng chuyển lô {{ma}}", { ma: dong.maLo })}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={giaTri ?? ""}
        placeholder="0"
        onChange={(e) => onDoi(e.target.value.replace(/[^\d]/g, ""))}
        onFocus={(e) => e.target.select()}
        aria-invalid={loi ? true : undefined}
        aria-describedby={loi ? `${id}-loi` : undefined}
        className="h-full w-11 border-x border-bo-border text-center text-sm font-semibold tabular-nums text-bo-heading outline-none"
      />
      <button type="button" className={NUT_BUOC} disabled={so >= dong.khaDung} onClick={() => {
          onDoi(so + 1);
          onXong?.();
        }} aria-label={t("Thêm 1")}>
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Nửa "Kệ nguồn" của khối lượt chuyển: đầu kệ (mã, trạng thái, vị trí, mức đang chứa, nút Đổi kệ), dòng "đã chọn / khả
 * dụng" và bảng lô trên kệ, lô nhập trước xếp trên. Khả dụng = tồn ở kệ − chờ nhặt (BR-BIN-02): bảng chỉ hiện một cột
 * Khả dụng, số chờ nhặt ghi phụ bên dưới khi có. Lô đang kiểm kê ở kệ này không chuyển được.
 */
export default function CotTuKe({ ke, chon, loiDong, noiBat, onDatSo, onXong, onChonTatCa, onBoChon, onDoiKe }) {
  const coChon = Object.values(chon).some((v) => soNguyen(v) > 0);
  const chonDuoc = ke.dong.some((d) => d.khaDung > 0 && !d.khoaKiemKe);
  const daChon = ke.dong.reduce((s, d) => s + soNguyen(chon[d.loHangId]), 0);
  const khaDung = ke.dong.reduce((s, d) => s + (d.khoaKiemKe ? 0 : Math.max(0, d.khaDung)), 0);
  return (
    <div className="min-w-0" role="group" aria-labelledby="ck-tu-ke">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-bo-border px-4 py-3.5 xl:min-h-[94px]">
        <div className="min-w-0 flex-1">
          <p id="ck-tu-ke" className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
            {t("Kệ nguồn")}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-lg font-semibold leading-7 text-bo-heading">{ke.maViTri}</span>
            <TrangThaiKe trangThai={ke.trangThai} />
            {ke.trangThai === "BAO_TRI" ? <span className="text-xs text-bo-muted">{t("Chỉ chuyển hàng đi, không nhận hàng")}</span> : null}
          </p>
          {viTriKe(ke) ? <p className="truncate text-[13px] text-bo-muted">{viTriKe(ke)}</p> : null}
        </div>
        <div className="flex items-start gap-3">
          <div className="w-36 pt-5 max-sm:hidden">
            <div className="mb-1 flex justify-between gap-2 whitespace-nowrap text-xs tabular-nums text-bo-muted">
              <span>{t("Đang chứa")}</span>
              <span>{chuSucChua(ke.dangChua, ke.sucChua)}</span>
            </div>
            <ThanhSucChua dangChua={ke.dangChua} sucChua={ke.sucChua} maKe={ke.maViTri} />
          </div>
          <button
            type="button"
            onClick={onDoiKe}
            title={t("Bỏ kệ này, quét kệ nguồn khác")}
            className="mt-3 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-bo-primary-strong hover:bg-bo-primary-soft focus-visible:outline-2 focus-visible:outline-bo-primary"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            {t("Đổi kệ")}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-bo-border bg-bo-surface-subtle px-4 py-2 text-[13px] text-bo-muted">
        <span>
          {t("Đã chọn")} <b className="font-semibold tabular-nums text-bo-heading">{soVN(daChon)}</b>
          {" / "}
          {t("{{so}} khả dụng · {{soLo}} lô, lô nhập trước xếp trên", { so: soVN(khaDung), soLo: soVN(ke.dong.length), count: ke.dong.length })}
        </span>
        <span className="flex items-center gap-3">
          {coChon ? <NutChu onClick={onBoChon}>{t("Bỏ chọn")}</NutChu> : null}
          {chonDuoc ? <NutChu onClick={onChonTatCa}>{t("Chọn toàn bộ kệ")}</NutChu> : null}
        </span>
      </div>
      {/* Danh sách lô: máy tính 3 cột (sản phẩm · khả dụng · chuyển); điện thoại xếp số và ô chuyển xuống dưới tên
          hàng — không cuộn ngang, ô số lượng luôn trong màn */}
      <div role="table" aria-label={t("Hàng trên kệ nguồn")}>
        <div role="row" className="hidden grid-cols-[minmax(0,1fr)_76px_118px] items-center gap-3 border-b border-bo-border px-4 sm:grid">
          <span role="columnheader" className={TH}>{t("Sản phẩm · lô")}</span>
          <span role="columnheader" className={`${TH} text-right`}>{t("Khả dụng")}</span>
          <span role="columnheader" className={`${TH} text-right`}>{t("Chuyển")}</span>
        </div>
        {ke.dong.map((d) => {
          const so = soNguyen(chon[d.loHangId]);
          const loi = loiDong[d.loHangId];
          const khoa = d.khoaKiemKe;
          const oChuyen = khoa ? (
            <ChamNhan tone="bad">{t("Đang kiểm kê")}</ChamNhan>
          ) : d.khaDung <= 0 ? (
            <span className="text-xs text-bo-muted">{t("Chờ nhặt hết")}</span>
          ) : (
            <OSoLuong dong={d} giaTri={chon[d.loHangId] ?? ""} onDoi={(v) => onDatSo(d, v)} onXong={onXong} loi={Boolean(loi)} />
          );
          return (
            <div
              key={d.loHangId}
              role="row"
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-bo-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_76px_118px]",
                so > 0 ? "bg-[#f3f7fe]" : "hover:bg-bo-surface-subtle",
                khoa && "text-slate-400",
                noiBat === d.loHangId && "outline-2 -outline-offset-2 outline-bo-primary/30",
              )}
            >
              <div role="cell" className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                <AnhBienThe src={d.anh} />
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium", !khoa && "text-bo-heading")}>{d.tenSanPham ? tDuLieu(d.tenSanPham) : d.maSku}</p>
                  <MauKichCo tenMau={d.mau} maMauHex={d.maMauHex} kichCo={d.kichCo} className="flex text-xs" />
                  <p className="truncate text-xs text-bo-muted">
                    <span className="font-mono">{d.maSku}</span> · {t("Lô")} <span className="font-mono text-bo-foreground">{d.maLo}</span>
                    {d.ngayNhap ? <> · {t("nhập {{ngay}}", { ngay: new Date(d.ngayNhap).toLocaleDateString("vi-VN") })}</> : null}
                  </p>
                </div>
              </div>
              {/* Điện thoại: số khả dụng (kèm chờ nhặt nếu có) bên trái, ô chuyển bên phải */}
              <p role="cell" className="text-xs text-bo-muted sm:hidden">
                <b className={cn("font-semibold", !khoa && "text-bo-heading")}>{t("khả dụng {{so}}", { so: khoa ? "—" : soVN(d.khaDung) })}</b>
                {d.dangGiuNhat ? <span className="text-bo-warning"> · {t("{{so}} chờ nhặt", { so: soVN(d.dangGiuNhat) })}</span> : null}
              </p>
              <span role="cell" className="hidden text-right tabular-nums sm:block">
                {/* Lô đang kiểm kê: không tính vào khả dụng (khớp dòng "đã chọn / khả dụng" phía trên) */}
                <span className={cn("block text-sm font-semibold", !khoa && "text-bo-heading")}>{khoa ? "—" : soVN(d.khaDung)}</span>
                {d.dangGiuNhat ? (
                  <span className="block whitespace-nowrap text-xs text-bo-warning" title={t("Tồn ở kệ {{so}}", { so: soVN(d.tonTaiKe) })}>
                    {t("{{so}} chờ nhặt", { so: soVN(d.dangGiuNhat) })}
                  </span>
                ) : null}
              </span>
              <span role="cell" className="justify-self-end">{oChuyen}</span>
              {loi ? (
                <p id={`ck-so-${d.loHangId}-loi`} className="col-span-2 text-[13px] text-bo-danger sm:col-span-3 sm:pl-12">
                  {loi}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
