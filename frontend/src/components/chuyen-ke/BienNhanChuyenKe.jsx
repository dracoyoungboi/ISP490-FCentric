import { useNavigate } from "react-router-dom";
import { Check, FileText, MapPin, PackageOpen, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { formatDateTime } from "@/utils/dateTime";
import { t } from "@/i18n";
import { hienGhiChu } from "./nhanKe";

const NHAN = "mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

/**
 * Biên nhận lượt vừa chuyển: gom theo kệ đích (lô nào nằm ở kệ nào, số trên kệ trước → sau) và việc tiếp theo (kệ
 * nguồn còn hàng đang mở để chuyển tiếp; kệ bảo trì vừa trống thì nhắc mở lại ở Vị trí kho).
 * `ketQua`: `{ maPhieu, tongSoLuong, tu, lyDo, luc, nhom: [{ keDichId, ma, truoc, suc, tong, dong: [{ loHangId, ten, maLo, soLuong }] }],
 * conLai, baoTriTrong }`.
 */
export default function BienNhanChuyenKe({ ketQua, coViTriKho, onXemPhieu, onDong }) {
  const navigate = useNavigate();
  const coViec = ketQua.conLai > 0 || ketQua.baoTriTrong || ketQua.chuaChuyen > 0;
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm" aria-labelledby="ck-bien-nhan">
      <div className="flex flex-wrap items-start gap-3 border-b border-bo-border bg-bo-success-soft/60 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bo-success text-white">
          <Check className="size-4" aria-hidden="true" />
        </span>
        <div className="mr-auto min-w-0">
          <h2 id="ck-bien-nhan" className="text-sm font-semibold text-bo-heading">
            {t("Đã chuyển {{so}} sản phẩm từ {{tu}}", { so: soVN(ketQua.tongSoLuong), tu: ketQua.tu, count: ketQua.tongSoLuong })}
          </h2>
          <p className="text-[12px] text-bo-muted">
            {t("Phiếu {{ma}}", { ma: ketQua.maPhieu })} · {formatDateTime(ketQua.luc)}
            {ketQua.lyDo ? ` · ${hienGhiChu(ketQua.lyDo)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onXemPhieu} className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-slate-50">
            <FileText className="size-4" aria-hidden="true" />
            {t("Xem phiếu")}
          </Button>
          <button
            type="button"
            onClick={onDong}
            aria-label={t("Đóng biên nhận")}
            className="grid size-9 place-items-center rounded-md text-slate-500 hover:bg-white/70 hover:text-slate-700"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={coViec ? "grid md:grid-cols-2" : undefined}>
        <div className="grid min-w-0 content-start gap-3 px-4 py-3">
          <p className={NHAN}>{t("Đặt lên kệ")}</p>
          {ketQua.nhom.map((g) => (
            <div key={g.keDichId} className="min-w-0">
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-bo-heading">{g.ma}</span>
                {g.suc ? (
                  <span className="text-[12px] tabular-nums text-bo-muted">
                    {t("{{truoc}} → {{sau}}/{{suc}}", { truoc: soVN(g.truoc), sau: soVN(g.truoc + g.tong), suc: soVN(g.suc) })}
                  </span>
                ) : (
                  <span className="text-[12px] tabular-nums text-bo-muted">+{soVN(g.tong)}</span>
                )}
              </p>
              <ul className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-0.5 text-[13px]">
                {g.dong.map((d) => (
                  <li key={`${d.loHangId}`} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {d.ten} <span className="font-mono text-[11px] text-bo-muted">{d.maLo}</span>
                    </span>
                    <b className="shrink-0 font-semibold tabular-nums">{soVN(d.soLuong)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {coViec ? (
          <div className="grid min-w-0 content-start gap-2 border-t border-bo-border px-4 py-3 md:border-l md:border-t-0">
            <p className={NHAN}>{t("Việc tiếp theo")}</p>
            {ketQua.conLai > 0 ? (
              <p className="flex gap-2 text-[13px] text-slate-700">
                <PackageOpen className="mt-0.5 size-4 shrink-0 text-bo-primary" aria-hidden="true" />
                <span>{t("Kệ {{ma}} còn {{so}} sản phẩm lấy được, đang mở bên dưới để chuyển tiếp.", { ma: ketQua.tu, so: soVN(ketQua.conLai), count: ketQua.conLai })}</span>
              </p>
            ) : null}
            {ketQua.chuaChuyen > 0 ? (
              <p className="flex gap-2 text-[13px] text-slate-700">
                <PackageOpen className="mt-0.5 size-4 shrink-0 text-bo-warning" aria-hidden="true" />
                <span>{t("Còn {{so}} sản phẩm chưa chuyển: quét lại kệ {{ma}} để chuyển tiếp.", { ma: ketQua.tu, so: soVN(ketQua.chuaChuyen), count: ketQua.chuaChuyen })}</span>
              </p>
            ) : null}
            {ketQua.baoTriTrong ? (
              <div className="flex gap-2 text-[13px] text-slate-700">
                <Wrench className="mt-0.5 size-4 shrink-0 text-bo-warning" aria-hidden="true" />
                <div>
                  <p>{t("Kệ {{ma}} đã trống. Sửa kệ xong thì mở lại hoạt động ở Vị trí kho.", { ma: ketQua.tu })}</p>
                  {coViTriKho ? (
                    <button type="button" onClick={() => navigate("/warehouse/locations")} className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-bo-primary-strong hover:underline">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {t("Mở Vị trí kho")}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
