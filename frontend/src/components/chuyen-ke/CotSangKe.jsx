import { ArrowLeftRight, Layers, Loader2, MapPin, PackageOpen, Split, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t, tDuLieu } from "@/i18n";
import { conTrongCua } from "./chuyenKe";
import { ChamNhan, ThanhSucChua } from "./KeHienThi";
import { viTriKe } from "./nhanKe";

const NUT_CHINH_NHO = "h-8 gap-1.5 bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover";
const NUT_PHU_NHO = "h-8 gap-1.5 border-bo-border bg-white text-[13px] text-bo-foreground shadow-xs hover:bg-slate-50";

/** Một kệ gợi ý: mã, lý do (cùng mã hàng / cùng khu), chỗ trống. Bấm = chọn kệ đó như khi quét mã. */
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
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:outline-bo-primary disabled:opacity-60"
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", k.cungMa ? "bg-bo-primary-soft text-bo-primary-strong" : "bg-bo-surface-subtle text-bo-muted")}>
        {k.cungMa ? <Layers className="size-4" aria-hidden="true" /> : <MapPin className="size-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-sm font-semibold text-bo-heading">{k.maViTri}</span>
        <span className={cn("line-clamp-2 block text-xs", k.cungMa ? "text-bo-primary-strong" : "text-bo-muted")}>{phu.join(" · ")}</span>
      </span>
      <span className="shrink-0 text-right text-xs text-bo-muted">
        {k.conTrong == null ? (
          <span className="block text-sm font-semibold text-bo-success">{t("Không giới hạn")}</span>
        ) : (
          <>
            <span className={cn("block text-sm font-semibold tabular-nums", k.duCho ? "text-bo-success" : "text-bo-warning")}>{soVN(k.conTrong)}</span>
            {t("còn trống")}
          </>
        )}
      </span>
    </button>
  );
}

/** Một kệ đích đã chọn: số cất vào, thanh lấp đầy sau khi cất, nút bỏ. */
function DongKeDich({ p, i, onBo }) {
  const ke = p.ke;
  const vuot = p.vuot && p.nhan > conTrongCua(ke);
  const day = ke.sucChua && ke.dangChua + p.nhan >= ke.sucChua;
  return (
    <div className="flex items-center gap-3 border-b border-bo-border px-4 py-3 last:border-b-0">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-bo-primary-soft text-xs font-bold text-bo-primary-strong">{i + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-mono text-sm font-semibold text-bo-heading">{ke.maViTri}</span>
          {viTriKe(ke) ? <span className="text-xs text-bo-muted">{viTriKe(ke)}</span> : null}
          {vuot ? <ChamNhan tone="bad">{t("Vượt sức chứa")}</ChamNhan> : day && p.nhan > 0 ? <ChamNhan tone="warn">{t("Sẽ đầy")}</ChamNhan> : null}
        </p>
        {ke.sucChua ? (
          <div className="mt-1.5 flex items-center gap-2">
            <ThanhSucChua dangChua={ke.dangChua} them={p.nhan} sucChua={ke.sucChua} maKe={ke.maViTri} className="flex-1" />
            <span className="text-xs tabular-nums text-bo-muted">
              {soVN(ke.dangChua + p.nhan)}/{soVN(ke.sucChua)}
            </span>
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-bo-muted">{t("Không giới hạn sức chứa")}</p>
        )}
      </div>
      <span className={cn("text-lg font-semibold tabular-nums", p.nhan > 0 ? "text-bo-heading" : "text-slate-400")}>{soVN(p.nhan)}</span>
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

/**
 * Cột "Kệ đích" (bước 3): kệ đích đã chọn theo thứ tự cất, khối kệ thiếu chỗ (BA A3: tách cất hoặc đổi kệ, quản lý kho
 * được cất vượt) và kệ gợi ý. `tong`: số đang chọn; `conLai`: số chưa có chỗ.
 */
export default function CotSangKe({ coNguon, tong, conLai, phan, goiY, dangTaiGoiY, thieuCho, duocVuot, ban, onChonGoiY, onBoDich, onTach, onDoiKe, onVuot }) {
  const dsGoiY = (goiY ?? []).filter((k) => !phan.some((p) => p.ke.id === k.id) && k.id !== thieuCho?.ke?.id);
  const phu = !coNguon
    ? t("Kệ đích sẽ hiện ở đây sau khi chọn hàng.")
    : tong <= 0
      ? t("Chọn số lượng ở bảng bên trái, rồi quét mã kệ đích.")
      : conLai > 0
        ? phan.length
          ? t("Còn {{so}} sản phẩm chưa có chỗ. Quét thêm kệ hoặc chọn kệ gợi ý.", { so: soVN(conLai), count: conLai })
          : t("Quét mã kệ đích hoặc chọn kệ gợi ý cho {{so}} sản phẩm.", { so: soVN(tong), count: tong })
        : `${t("{{so}} kệ", { so: soVN(phan.filter((p) => p.nhan > 0).length), count: phan.filter((p) => p.nhan > 0).length })} · ${
          phan.some((p) => p.vuot && p.nhan > conTrongCua(p.ke))
            ? t("có kệ cất vượt sức chứa")
            : t("đủ chỗ cho {{so}} sản phẩm", { so: soVN(tong), count: tong })
        }`;
  return (
    <section className={cn("min-w-0 rounded-lg border border-bo-border bg-bo-surface shadow-sm", coNguon ? "self-start" : "self-stretch")} aria-labelledby="ck-sang-ke">
      <div className="border-b border-bo-border px-4 py-3.5">
        <p id="ck-sang-ke" className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
          {t("Kệ đích")}
        </p>
        <p className="mt-0.5 text-[13px] text-bo-muted">{phu}</p>
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
        <div className="m-3 rounded-lg border border-amber-200 bg-bo-warning-soft p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-bo-heading">{thieuCho.ke.maViTri}</span>
            <span className="text-xs tabular-nums text-bo-muted">
              {t("Đang chứa {{dang}}/{{sucChua}} · cất thêm {{them}} là đầy", { dang: soVN(thieuCho.ke.dangChua), sucChua: soVN(thieuCho.ke.sucChua), them: soVN(conTrongCua(thieuCho.ke)) })}
            </span>
          </div>
          <ThanhSucChua dangChua={thieuCho.ke.dangChua} them={conTrongCua(thieuCho.ke)} sucChua={thieuCho.ke.sucChua} className="mt-2" />
          <p className="mt-2.5 flex gap-2 text-[13px] text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bo-warning" aria-hidden="true" />
            <span>
              {t("Kệ đích {{ma}} không đủ sức chứa. Yêu cầu cất: {{can}} · còn trống: {{conTrong}} (thiếu {{thieu}} vị trí).", {
                ma: thieuCho.ke.maViTri,
                can: soVN(thieuCho.can),
                conTrong: soVN(conTrongCua(thieuCho.ke)),
                thieu: soVN(thieuCho.can - conTrongCua(thieuCho.ke)),
              })}
            </span>
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
        <div className={cn("p-1.5", (phan.length || thieuCho) && "border-t border-bo-border")}>
          <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
            {t("Gợi ý kệ đích")}
            {dangTaiGoiY ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
          </p>
          {dsGoiY.length ? (
            dsGoiY.map((k) => <KeGoiY key={k.id} k={k} onChon={onChonGoiY} ban={ban} />)
          ) : !dangTaiGoiY ? (
            <p className="px-3 pb-3 text-[13px] text-bo-muted">{t("Không còn kệ nào trống. Quét mã kệ đích để chọn kệ khác.")}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
