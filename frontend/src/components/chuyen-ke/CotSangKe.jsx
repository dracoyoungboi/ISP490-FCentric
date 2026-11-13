import { useState } from "react";
import { ArrowLeftRight, Layers, Loader2, MapPin, PackageOpen, Split, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t, tDuLieu } from "@/i18n";
import { conTrongCua } from "./chuyenKe";
import { ChamNhan, ThanhSucChua } from "./KeHienThi";
import { viTriKe } from "./nhanKe";

const NUT_CHINH_NHO = "h-8 gap-1.5 bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover";
const NUT_PHU_NHO = "h-8 gap-1.5 border-bo-border bg-white text-[13px] text-bo-foreground shadow-xs hover:bg-slate-50";
const NHAN = "text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
/** Số kệ gợi ý hiện sẵn; còn lại mở bằng "Xem thêm". */
const GOI_Y_HIEN = 3;

/** Một kệ gợi ý: mã, vị trí (hoặc "đang chứa cùng mã hàng"), số chỗ còn trống. Bấm = chọn kệ đó như khi quét mã. */
function KeGoiY({ k, onChon, ban }) {
  const phu = [
    k.cungMa ? t("Đang chứa cùng mã hàng") : null,
    k.khuVuc ? tDuLieu(k.khuVuc) : null,
    k.dayKe ? t("Dãy {{so}}", { so: k.dayKe }) : null,
    k.tangKe ? t("Tầng {{so}}", { so: k.tangKe }) : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      disabled={ban}
      onClick={() => onChon(k.maViTri)}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:outline-bo-primary disabled:opacity-60"
    >
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", k.cungMa ? "bg-bo-primary-soft text-bo-primary-strong" : "bg-bo-surface-subtle text-bo-muted")}>
        {k.cungMa ? <Layers className="size-4" aria-hidden="true" /> : <MapPin className="size-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-sm font-semibold text-bo-heading">{k.maViTri}</span>
        {phu.length ? <span className={cn("block truncate text-xs", k.cungMa ? "text-bo-primary-strong" : "text-bo-muted")}>{phu.join(" · ")}</span> : null}
      </span>
      <span className={cn("shrink-0 text-right text-sm font-semibold tabular-nums", k.duCho ? "text-bo-success" : "text-bo-warning")}>
        {k.conTrong == null ? t("Không giới hạn") : soVN(k.conTrong)}
      </span>
    </button>
  );
}

/** Một kệ đích đã chọn: mã, nhãn sẽ đầy / vượt, vị trí, mức lấp đầy sau khi cất, số cất thêm, nút bỏ. */
function DongKeDich({ p, i, onBo }) {
  const ke = p.ke;
  const vuot = p.vuot && p.nhan > conTrongCua(ke);
  const day = ke.sucChua && ke.dangChua + p.nhan >= ke.sucChua;
  const viTri = viTriKe(ke);
  return (
    <div className="flex items-center gap-3 border-b border-bo-border px-4 py-2.5 last:border-b-0">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-bo-primary-soft text-xs font-bold text-bo-primary-strong">{i + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-mono text-sm font-semibold text-bo-heading">{ke.maViTri}</span>
          {vuot ? <ChamNhan tone="bad">{t("Vượt sức chứa")}</ChamNhan> : day && p.nhan > 0 ? <ChamNhan tone="warn">{t("Sẽ đầy")}</ChamNhan> : null}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-bo-muted">
          {viTri ? <span className="min-w-0 truncate">{viTri}</span> : null}
          {ke.sucChua ? (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <ThanhSucChua dangChua={ke.dangChua} them={p.nhan} sucChua={ke.sucChua} maKe={ke.maViTri} className="w-14" />
              <span className="min-w-9 text-right tabular-nums">
                {soVN(ke.dangChua + p.nhan)}/{soVN(ke.sucChua)}
              </span>
            </div>
          ) : (
            <span className="ml-auto shrink-0">{t("Không giới hạn sức chứa")}</span>
          )}
        </div>
      </div>
      <span className={cn("min-w-10 text-right font-semibold tabular-nums", p.nhan > 0 ? "text-bo-heading" : "text-slate-400")}>+{soVN(p.nhan)}</span>
      <button
        type="button"
        onClick={() => onBo(ke.id)}
        aria-label={t("Bỏ kệ đích {{ma}}", { ma: ke.maViTri })}
        className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Danh sách kệ gợi ý chia hai nhóm theo số còn phải cất: đủ chỗ / ít chỗ hơn. Hiện {@link GOI_Y_HIEN} kệ đầu. */
function GoiYKeDich({ ds, can, dangTai, ban, onChon, coVienTren }) {
  // "Xem thêm" gắn với đúng danh sách lúc bấm: danh sách đổi (đổi kệ nguồn, hàng, vừa chọn một kệ) thì tự thu gọn
  const khoa = ds.map((k) => k.id).join(",");
  const [moKhoa, setMoKhoa] = useState(null);
  const moHet = moKhoa === khoa;
  const duCho = ds.filter((k) => k.duCho);
  const itCho = ds.filter((k) => !k.duCho);
  const hien = moHet ? ds.length : GOI_Y_HIEN;
  const duHien = duCho.slice(0, hien);
  const itHien = itCho.slice(0, Math.max(0, hien - duHien.length));
  const an = ds.length - duHien.length - itHien.length;
  return (
    <div className={cn("px-1.5 pb-2 pt-1", coVienTren && "border-t border-bo-border")}>
      <p className={cn(NHAN, "flex items-center justify-between gap-2 px-3 pb-1 pt-2")}>
        <span className="flex items-center gap-2">
          {t("Gợi ý kệ đích")}
          {dangTai ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
        </span>
        {ds.length ? <span>{t("Còn trống")}</span> : null}
      </p>
      {ds.length ? (
        <>
          {duHien.length ? (
            <>
              <p className="px-3 pt-1 text-xs font-medium text-bo-success">{t("Đủ chỗ cho {{so}} sản phẩm", { so: soVN(can), count: can })}</p>
              {duHien.map((k) => (
                <KeGoiY key={k.id} k={k} onChon={onChon} ban={ban} />
              ))}
            </>
          ) : null}
          {itHien.length ? (
            <>
              <p className="px-3 pt-2 text-xs font-medium text-bo-muted">{t("Ít chỗ hơn")}</p>
              {itHien.map((k) => (
                <KeGoiY key={k.id} k={k} onChon={onChon} ban={ban} />
              ))}
            </>
          ) : null}
          {an > 0 || moHet ? (
            <button type="button" onClick={() => setMoKhoa(moHet ? null : khoa)} className="ml-3 mt-1 text-[13px] font-medium text-bo-primary-strong hover:underline">
              {moHet ? t("Thu gọn") : t("Xem thêm {{so}} kệ", { so: soVN(an), count: an })}
            </button>
          ) : null}
        </>
      ) : !dangTai ? (
        <p className="px-3 pb-2 text-[13px] text-bo-muted">{t("Không còn kệ nào trống. Quét mã kệ đích để chọn kệ khác.")}</p>
      ) : null}
    </div>
  );
}

/**
 * Nửa "Kệ đích" của khối lượt chuyển: số kệ đã chọn, kệ đích theo thứ tự cất, khối kệ thiếu chỗ (BA A3: tách cất hoặc
 * đổi kệ, quản lý kho được cất vượt) và kệ gợi ý. Tiến độ "đã có kệ đích" nằm ở chân khối, không lặp ở đây.
 * `tong`: số đang chọn; `conLai`: số chưa có chỗ. `coNguon=false`: chỗ giữ chỗ ở màn mở đầu (chưa quét kệ nguồn).
 */
export default function CotSangKe({ coNguon, tong, conLai, phan, goiY, dangTaiGoiY, thieuCho, duocVuot, ban, onChonGoiY, onBoDich, onTach, onDoiKe, onVuot, className }) {
  const dsGoiY = (goiY ?? []).filter((k) => !phan.some((p) => p.ke.id === k.id) && k.id !== thieuCho?.ke?.id);
  // Đếm đúng số dòng kệ đang liệt kê (kể cả kệ "+0" khi vừa giảm số lượng) để số ở đầu khớp số thứ tự các dòng
  const soKe = phan.length;
  const huongDan = !coNguon
    ? t("Kệ đích sẽ hiện ở đây sau khi chọn hàng.")
    : tong <= 0
      ? t("Chọn số lượng ở bảng bên trái trước.")
      : conLai > 0
        ? t("Quét mã kệ hoặc chọn kệ gợi ý")
        : t("Cất theo thứ tự từ trên xuống");
  return (
    <div className={cn("min-w-0", className)} role="group" aria-labelledby="ck-sang-ke">
      <div className="border-b border-bo-border px-4 py-3.5 xl:min-h-[94px]">
        <p id="ck-sang-ke" className={NHAN}>
          {t("Kệ đích")}
        </p>
        <p className={cn("mt-0.5 text-lg font-semibold leading-7", soKe ? "text-bo-heading" : "text-slate-400")}>
          {soKe ? t("{{so}} kệ", { so: soVN(soKe), count: soKe }) : t("Chưa chọn kệ")}
        </p>
        <p className="text-[13px] text-bo-muted">{huongDan}</p>
      </div>

      {!coNguon || tong <= 0 ? (
        <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-bo-surface-subtle text-slate-400">
            <PackageOpen className="size-5" aria-hidden="true" />
          </span>
          <p className="max-w-[260px] text-[13px] text-bo-muted">
            {coNguon ? t("Hệ thống sẽ gợi ý kệ còn chỗ, ưu tiên kệ đang chứa cùng mã hàng.") : t("Quét kệ nguồn để bắt đầu.")}
          </p>
        </div>
      ) : null}

      {phan.length ? (
        <div>
          {phan.map((p, i) => (
            <DongKeDich key={p.ke.id} p={p} i={i} onBo={onBoDich} />
          ))}
        </div>
      ) : null}

      {thieuCho ? (
        <div className="m-3 rounded-lg border border-amber-200 bg-bo-warning-soft p-3.5" role="alert">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-bo-heading">{thieuCho.ke.maViTri}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{t("Thiếu chỗ")}</span>
            <span className="ml-auto text-xs tabular-nums text-bo-muted">
              {soVN(thieuCho.ke.dangChua)}/{soVN(thieuCho.ke.sucChua)}
            </span>
          </div>
          <ThanhSucChua dangChua={thieuCho.ke.dangChua} them={conTrongCua(thieuCho.ke)} sucChua={thieuCho.ke.sucChua} maKe={thieuCho.ke.maViTri} className="mt-2" />
          <p className="mt-2.5 text-[13px] text-amber-900">
            {t("Không đủ sức chứa. Yêu cầu cất: {{can}} · còn trống: {{conTrong}} (thiếu {{thieu}} vị trí).", {
              can: soVN(thieuCho.can),
              conTrong: soVN(conTrongCua(thieuCho.ke)),
              thieu: soVN(thieuCho.can - conTrongCua(thieuCho.ke)),
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {conTrongCua(thieuCho.ke) > 0 ? (
              <Button size="sm" className={NUT_CHINH_NHO} onClick={onTach}>
                <Split className="size-3.5" aria-hidden="true" />
                {t("Cất {{so}}, quét thêm kệ", { so: soVN(conTrongCua(thieuCho.ke)) })}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className={NUT_PHU_NHO} onClick={onDoiKe}>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              {t("Đổi sang kệ khác")}
            </Button>
          </div>
          {duocVuot ? (
            <button type="button" onClick={onVuot} className="mt-2.5 text-xs font-medium text-bo-warning underline underline-offset-2 hover:text-amber-800">
              {t("Cất vượt sức chứa (quản lý kho)")}
            </button>
          ) : null}
        </div>
      ) : null}

      {coNguon && tong > 0 && conLai > 0 ? (
        <GoiYKeDich ds={dsGoiY} can={conLai} dangTai={dangTaiGoiY} ban={ban} onChon={onChonGoiY} coVienTren={Boolean(phan.length || thieuCho)} />
      ) : null}
    </div>
  );
}
