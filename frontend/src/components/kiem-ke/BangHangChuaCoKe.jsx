import { Fragment } from "react";
import { Link } from "react-router-dom";
import { CircleDashed, History, Loader2, MapPin, MapPinCheck, PackageOpen, Truck, Undo2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/formatters";
import { LY_DO_KE, cauKhongGoiY, coTheXep, nhomTheoNguon, soXepDuoc, tieuDeNguon, xepNgayDuoc } from "./hangChuaCoKe";

const TH = "h-10 pr-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const NUT_VIEN = "h-8 gap-1.5 border-bo-border bg-bo-surface text-[13px] hover:bg-bo-surface-subtle";
const O_CHON =
  "border-slate-300 bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=checked]:text-white data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white";
const ICON_NGUON = { CHUYEN_KHO: Truck, KHACH_TRA: Undo2, NHA_CUNG_CAP: PackagePlus };

/** Trạng thái ô chọn của một nhóm id: true · false · "indeterminate". */
const trangThaiChon = (ids, chon) => {
  const so = ids.filter((id) => chon.has(id)).length;
  return so === 0 ? false : so === ids.length ? true : "indeterminate";
};

/** Kệ gợi ý của lô: thẻ kệ + lý do + chỗ còn trống; không có thì câu vì sao. */
function OGoiY({ h }) {
  const g = h.keGoiY;
  if (!g?.id || !coTheXep(h)) {
    return (
      <span className="flex items-start gap-1.5 text-[13px] leading-5 text-bo-muted">
        <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        {cauKhongGoiY(h)}
      </span>
    );
  }
  const du = xepNgayDuoc(h);
  return (
    <span className="grid gap-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex h-6 items-center gap-1 rounded-md border border-blue-200 bg-bo-primary-soft px-1.5 font-mono text-xs font-medium text-bo-primary-strong">
          <MapPin className="size-3" aria-hidden="true" />
          {g.ma}
        </span>
        <span className="text-xs text-bo-muted">{LY_DO_KE[g.lyDo] ?? ""}</span>
      </span>
      {g.conCho != null ? (
        <span className={cn("text-xs tabular-nums", du ? "text-bo-muted" : "font-medium text-bo-warning")}>
          {du ? `Còn chỗ ${soVN(g.conCho)}` : `Chỉ còn chỗ ${soVN(g.conCho)}, cần chia thêm kệ`}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Nút của một lô: gợi ý đủ chỗ thì "Kệ khác" + xếp một chạm; không thì "Chọn kệ"; lô chưa xếp được (đang kiểm kê, phiếu
 * nhặt giữ hết) thì chỉ ghi trạng thái.
 */
function ThaoTac({ h, dangXep, khoa, onXepNgay, onMoHop }) {
  if (!coTheXep(h)) {
    return <span className="text-xs font-medium text-bo-muted">{h.dangKiemKe ? "Đang kiểm kê" : "Chờ nhặt"}</span>;
  }
  if (!xepNgayDuoc(h)) {
    return (
      <Button size="sm" variant="outline" onClick={() => onMoHop([h])} disabled={khoa} className={NUT_VIEN}>
        <PackageOpen className="size-3.5" />
        Chọn kệ
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-3">
      <NutChu onClick={() => onMoHop([h])} disabled={khoa}>
        Kệ khác
      </NutChu>
      <Button
        size="sm"
        onClick={() => onXepNgay([h])}
        disabled={khoa}
        aria-busy={dangXep || undefined}
        title={`Xếp ${soVN(soXepDuoc(h))} sản phẩm vào kệ ${h.keGoiY.ma}`}
        className="h-8 gap-1.5 text-[13px]"
      >
        {dangXep ? <Loader2 className="size-3.5 animate-spin" /> : <MapPinCheck className="size-3.5" />}
        {dangXep ? "Đang xếp…" : `Xếp vào ${h.keGoiY.ma}`}
      </Button>
    </span>
  );
}

/** Chứng từ của nhóm: phiếu nhập (liên kết) + dòng phụ ngày, người nhận, phiếu chuyển. */
function ChungTu({ nguon }) {
  const Icon = (nguon && ICON_NGUON[nguon.loai]) || History;
  const phu = nguon
    ? [
        formatDateTime(nguon.ngay),
        nguon.nguoiNhap ? `người nhận ${nguon.nguoiNhap}` : null,
        nguon.soPhieuChuyen ? `phiếu chuyển ${nguon.soPhieuChuyen}` : null,
      ].filter(Boolean)
    : ["Hàng có từ trước khi sổ kệ được ghi đúng"];
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md",
          nguon ? "bg-bo-surface text-slate-600 ring-1 ring-bo-border" : "bg-slate-200/70 text-slate-500",
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-bo-foreground">
          {tieuDeNguon(nguon)}
          {nguon?.phieuNhapId ? (
            <Link to={`/goods-receipts/${nguon.phieuNhapId}`} className="font-mono text-xs font-medium text-bo-primary hover:underline">
              {nguon.soPhieuNhap}
            </Link>
          ) : null}
        </span>
        <span className="block truncate text-xs text-bo-muted">{phu.join(" · ")}</span>
      </span>
    </span>
  );
}

/** Nút xếp cả nhóm theo gợi ý (chỉ các lô xếp ngay được). */
function NutXepNhom({ ds, khoa, onXepNgay }) {
  const ngay = ds.filter(xepNgayDuoc);
  if (!ngay.length) return <span className="text-xs text-bo-muted">Cần chọn kệ từng lô</span>;
  return (
    <NutChu onClick={() => onXepNgay(ngay)} disabled={khoa}>
      {ngay.length === ds.length ? "Xếp cả nhóm theo gợi ý" : `Xếp ${soVN(ngay.length)} lô theo gợi ý`}
    </NutChu>
  );
}

const tongSo = (ds) => ds.reduce((s, h) => s + (Number(h.chuaCoKe) || 0), 0);
/** Id các lô chọn được (xếp được lúc này) trong một nhóm. */
const idChonDuoc = (ds) => ds.filter(coTheXep).map((h) => h.loHangId);

/** Dòng phụ dưới số chưa có kệ: phần phiếu nhặt đang giữ, hoặc tồn lô khi lô đã lên kệ một phần. */
function PhuSoChuaCoKe({ h }) {
  if (Number(h.dangGiuNhat) > 0) return <span className="block text-xs text-bo-muted">{soVN(h.dangGiuNhat)} chờ nhặt</span>;
  if (Number(h.trenKe) > 0) return <span className="block text-xs text-bo-muted">/ tồn {soVN(h.tonLo)}</span>;
  return null;
}

/** Ô chọn của một nhóm id (bỏ qua lô chưa xếp được); không còn lô chọn được thì tắt. */
function OChonNhom({ ids, chon, onDoiChon, nhan }) {
  return (
    <Checkbox
      checked={ids.length ? trangThaiChon(ids, chon) : false}
      disabled={!ids.length}
      onCheckedChange={(v) => onDoiChon(ids, v === true)}
      aria-label={nhan}
      className={O_CHON}
    />
  );
}

/**
 * Bảng hàng chưa có kệ. `nhom` "phieu": gom theo chứng từ nhập (dòng đầu nhóm có ô chọn cả nhóm và nút xếp cả nhóm);
 * "lo": danh sách phẳng, cột Lô ghi thêm số phiếu nhập. Máy tính có ô chọn từng lô (thanh "Đã chọn" do trang vẽ);
 * điện thoại mỗi lô một thẻ, nút xếp nằm trong thẻ.
 */
export default function BangHangChuaCoKe({ ds, nhom, chon, onDoiChon, dangXep, khoa, onXepNgay, onMoHop }) {
  const nhomDs = nhom === "phieu" ? nhomTheoNguon(ds) : [{ khoa: "tat-ca", nguon: undefined, ds }];
  const tatCa = idChonDuoc(ds);

  const dongLo = (h) => (
    <tr key={h.loHangId} className={cn("border-b border-bo-border last:border-b-0 hover:bg-bo-surface-subtle", chon.has(h.loHangId) && "bg-[#f3f7fe]")}>
      <td className="w-11 pl-4">
        <Checkbox
          checked={chon.has(h.loHangId)}
          disabled={!coTheXep(h)}
          onCheckedChange={(v) => onDoiChon([h.loHangId], v === true)}
          aria-label={`Chọn lô ${h.maLo}`}
          className={O_CHON}
        />
      </td>
      <td className="py-3 pr-4">
        <span className="flex min-w-0 items-center gap-3">
          <AnhBienThe src={h.sanPham?.anh} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-bo-foreground">{h.sanPham?.tenSanPham || "—"}</span>
            <span className="block text-xs text-bo-muted">
              <MauKichCo dong={h.sanPham} className="align-bottom" /> · <span className="font-mono">{h.sanPham?.maSku}</span>
            </span>
          </span>
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-xs text-bo-foreground">
          {h.maLo}
        </span>
        {nhom === "lo" ? (
          <span className="mt-1 block text-xs text-bo-muted">{h.nguon?.soPhieuNhap ? <span className="font-mono">{h.nguon.soPhieuNhap}</span> : "Không rõ chứng từ"}</span>
        ) : null}
      </td>
      <td className="py-3 pr-4">
        <OGoiY h={h} />
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">
        <span className="block font-semibold text-bo-foreground">{soVN(h.chuaCoKe)}</span>
        <PhuSoChuaCoKe h={h} />
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-right">
        <ThaoTac h={h} dangXep={dangXep.has(h.loHangId)} khoa={khoa} onXepNgay={onXepNgay} onMoHop={onMoHop} />
      </td>
    </tr>
  );

  return (
    <>
      {/* Điện thoại: mỗi lô một thẻ, nhóm theo chứng từ như máy tính */}
      <div className="md:hidden">
        {nhomDs.map((n) => (
          <section key={n.khoa} aria-label={n.nguon === undefined ? undefined : tieuDeNguon(n.nguon)}>
            {n.nguon !== undefined ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bo-border bg-[#f6f8fb] px-4 py-2.5">
                <ChungTu nguon={n.nguon} />
                <NutXepNhom ds={n.ds} khoa={khoa} onXepNgay={onXepNgay} />
              </div>
            ) : null}
            <ul className="divide-y divide-bo-border border-b border-bo-border last:border-b-0">
              {n.ds.map((h) => (
                <li key={h.loHangId} className="grid gap-2.5 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <AnhBienThe src={h.sanPham?.anh} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-bo-foreground">{h.sanPham?.tenSanPham || "—"}</span>
                      <span className="block truncate text-xs text-bo-muted">
                        <MauKichCo dong={h.sanPham} className="align-bottom" /> · lô <span className="font-mono">{h.maLo}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-base font-semibold leading-6 text-bo-foreground">{soVN(h.chuaCoKe)}</span>
                      {Number(h.dangGiuNhat) > 0 ? (
                        <span className="block text-[11px] text-bo-muted">{soVN(h.dangGiuNhat)} chờ nhặt</span>
                      ) : (
                        <span className="block text-[11px] text-bo-muted">chưa có kệ</span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <span className="min-w-0 flex-1">
                      <OGoiY h={h} />
                    </span>
                    <span className="ml-auto shrink-0">
                      <ThaoTac h={h} dangXep={dangXep.has(h.loHangId)} khoa={khoa} onXepNgay={onXepNgay} onMoHop={onMoHop} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <table className="w-full min-w-[920px] text-sm max-md:hidden">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-bo-border bg-bo-surface-subtle">
            <th className="w-11 pl-4 text-left">
              <OChonNhom ids={tatCa} chon={chon} onDoiChon={onDoiChon} nhan="Chọn tất cả lô đang hiện" />
            </th>
            <th className={`${TH} text-left`}>Sản phẩm</th>
            <th className={`${TH} text-left`}>{nhom === "lo" ? "Lô · phiếu nhập" : "Lô"}</th>
            <th className={`${TH} text-left`}>Kệ gợi ý</th>
            <th className={`${TH} text-right`}>Chưa có kệ</th>
            <th className={`${TH} text-right`}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {nhomDs.map((n) => {
            const ids = idChonDuoc(n.ds);
            return (
              <Fragment key={n.khoa}>
                {n.nguon !== undefined ? (
                  <tr className="border-b border-bo-border bg-[#f6f8fb]">
                    <td className="w-11 pl-4">
                      <OChonNhom
                        ids={ids}
                        chon={chon}
                        onDoiChon={onDoiChon}
                        nhan={`Chọn cả nhóm ${tieuDeNguon(n.nguon)}${n.nguon?.soPhieuNhap ? ` ${n.nguon.soPhieuNhap}` : ""}`}
                      />
                    </td>
                    <td colSpan={3} className="py-2.5 pr-4">
                      <ChungTu nguon={n.nguon} />
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right text-xs tabular-nums text-bo-muted">
                      {soVN(n.ds.length)} lô · <b className="font-semibold text-bo-foreground">{soVN(tongSo(n.ds))}</b> sp
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right">
                      <NutXepNhom ds={n.ds} khoa={khoa} onXepNgay={onXepNgay} />
                    </td>
                  </tr>
                ) : null}
                {n.ds.map(dongLo)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
