import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardEmpty, LE } from "./ui";
import {
  docNgay,
  formatSo,
  formatTienNgan,
  gioPhut,
} from "../tong-quan/tongQuanFormat";
import {
  cauNhom,
  cauSuKien,
  duongDanSuKien,
  gopSuKien,
} from "../tong-quan/hoatDong";
import { t } from "@/i18n";

const MAU_CHAM = {
  xanh: "border-[#15803d] bg-[#dcfce7]",
  lam: "border-bo-primary bg-bo-primary-soft",
  do: "border-[#d92d20] bg-[#fdecea]",
  cam: "border-[#e07a1f] bg-[#fff4e8]",
  xam: "border-slate-400 bg-slate-100",
};
const SO_DONG_CON = 6;

function Cau({ c }) {
  return (
    <>
      {c.truoc ? `${c.truoc} ` : ""}
      <b className="font-semibold text-bo-foreground">{c.dam}</b>
      {c.sau ? ` ${c.sau}` : ""}
    </>
  );
}

/**
 * Hoạt động gần đây (đặc tả bản 2, mục 8): sự kiện 2 ngày gần nhất (hôm qua, hôm nay), chia theo ngày, mới nhất trước.
 * Tự gộp bán tại quầy / đơn mới / xuất kho liên tiếp của cùng người (hoặc kênh), cùng kho; bấm nhóm để xem từng đơn.
 * "N hoạt động hôm nay" đếm trước khi gộp. Không đổi theo kỳ; lọc theo kho (chuyển kho hiện ở cả hai kho).
 */
export default function HoatDongGanDay({
  data,
  khoId,
  dsKho,
  loading,
  error,
  onRetry,
  className,
}) {
  const hd = data?.hoatDong;
  const [mo, setMo] = useState({});
  const tatCa = khoId == null;
  const ds = hd ? gopSuKien(hd.ds) : [];
  const homNay = docNgay(data?.thoiDiem);
  const tenNgay = (x) =>
    homNay && docNgay(x.thoiGian)?.toDateString() === homNay.toDateString()
      ? t("Hôm nay")
      : t("Hôm qua");
  const tenKho = tatCa ? null : dsKho.find((x) => x.id === khoId)?.tenKho;

  return (
    <Card
      className={className}
      title={t("Hoạt động gần đây")}
      right={
        hd ? (
          <span className="text-[13px] text-bo-muted">
            {t("{{so}} hoạt động hôm nay", {
              so: formatSo(hd.homNay),
              count: hd.homNay,
            })}
          </span>
        ) : null
      }
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {!hd ? null : ds.length === 0 ? (
        <div className={cn(LE, "flex flex-1 flex-col py-4")}>
          <CardEmpty
            icon={History}
            text={t("Chưa có hoạt động trong 2 ngày gần nhất.")}
          />
        </div>
      ) : (
        // Lưới hai cột: khung cao theo thẻ Tồn kho cùng hàng (ít nhất 180px), cuộn bên trong; một cột thì cao tối đa 420px
        <div className="relative @min-[968px]/tq:min-h-[180px] @min-[968px]/tq:flex-1">
          <div
            className={cn(
              LE,
              "tq-cuon max-h-[420px] overflow-y-auto pb-3 pt-1 @min-[968px]/tq:absolute @min-[968px]/tq:inset-0 @min-[968px]/tq:max-h-none",
            )}
          >
            <ol>
              {ds.map((x, i) => {
                const ngay = tenNgay(x.nhom ? x.ds[0] : x);
                const truoc =
                  i > 0
                    ? tenNgay(ds[i - 1].nhom ? ds[i - 1].ds[0] : ds[i - 1])
                    : null;
                const sau = ds[i + 1];
                const cuoi =
                  !sau || tenNgay(sau.nhom ? sau.ds[0] : sau) !== ngay;
                return (
                  <li key={x.nhom ? x.key : `${x.loai}-${x.id}-${x.thoiGian}`}>
                    {ngay !== truoc ? (
                      <p className="pb-1 pt-2.5 text-xs font-semibold text-bo-muted">
                        {ngay}
                      </p>
                    ) : null}
                    {x.nhom ? (
                      <DongNhom
                        g={x}
                        tatCa={tatCa}
                        cuoi={cuoi}
                        mo={Boolean(mo[x.key])}
                        doiMo={() =>
                          setMo((m) => ({ ...m, [x.key]: !m[x.key] }))
                        }
                      />
                    ) : (
                      <DongSuKien e={x} tatCa={tatCa} cuoi={cuoi} />
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="pt-2 text-center text-xs text-bo-muted">
              {tenKho
                ? t("Hiện hoạt động 2 ngày gần nhất của {{kho}}.", {
                    kho: tenKho,
                  })
                : t("Hiện hoạt động 2 ngày gần nhất.")}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function Cham({ mau, kep }) {
  return (
    <span className="relative z-[1] mt-1 flex size-3 shrink-0 items-center justify-center">
      <span
        className={cn(
          "block size-2.5 rounded-full border-2",
          MAU_CHAM[mau] ?? MAU_CHAM.xam,
          kep &&
            "shadow-[0_0_0_2px_#fff,0_0_0_3px_currentColor] text-slate-300",
        )}
      />
    </span>
  );
}

/** Một dòng trên trục thời gian: chấm màu, câu (mã chứng từ in đậm), dòng phụ, giờ bên phải. */
function Khung({ mau, kep, cuoi, children, gio }) {
  return (
    <div className="relative flex gap-2.5 py-1.5">
      {!cuoi ? (
        <span
          className="absolute left-[5px] top-4 h-full w-px bg-slate-200"
          aria-hidden="true"
        />
      ) : null}
      <Cham mau={mau} kep={kep} />
      <div className="min-w-0 flex-1">{children}</div>
      <span className="shrink-0 pt-px text-xs tabular-nums text-bo-muted">
        {gio}
      </span>
    </div>
  );
}

function DongSuKien({ e, tatCa, cuoi }) {
  const c = cauSuKien(e, tatCa);
  const to = duongDanSuKien(e);
  const noiDung = (
    <>
      <span className="block truncate text-[13px] text-bo-foreground">
        <Cau c={c} />
      </span>
      {c.phu ? (
        <span className="block truncate text-xs text-bo-muted">{c.phu}</span>
      ) : null}
    </>
  );
  return (
    <Khung mau={c.mau} cuoi={cuoi} gio={gioPhut(e.thoiGian)}>
      {to ? (
        <Link
          to={to}
          className="block rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
          {noiDung}
        </Link>
      ) : (
        noiDung
      )}
    </Khung>
  );
}

function DongNhom({ g, tatCa, cuoi, mo, doiMo }) {
  const c = cauNhom(g, tatCa);
  const gio = `${gioPhut(g.ds[g.ds.length - 1].thoiGian)}–${gioPhut(g.ds[0].thoiGian)}`;
  return (
    <Khung mau={c.mau} kep cuoi={cuoi} gio={gio}>
      <button
        type="button"
        onClick={doiMo}
        aria-expanded={mo}
        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded text-left text-[13px] text-bo-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
      >
        <span className="truncate">
          <Cau c={c} />
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-bo-muted transition-transform",
            mo && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <span className="block truncate text-xs text-bo-muted">{c.phu}</span>
      {mo ? (
        <ul className="mt-1.5 rounded-md border border-[#eef1f5] bg-bo-surface-subtle py-1">
          {g.ds.slice(0, SO_DONG_CON).map((e) => {
            const cc = cauSuKien(e, false);
            const to = duongDanSuKien(e);
            return (
              <li key={`${e.loai}-${e.id}`}>
                <Link
                  to={to ?? "#"}
                  className="flex items-baseline justify-between gap-2 px-2.5 py-1 text-xs hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30"
                >
                  <span className="min-w-0 truncate text-bo-muted">
                    <Cau c={cc} />
                    <span>
                      {" "}
                      ·{" "}
                      {[
                        e.soTien != null ? formatTienNgan(e.soTien) : null,
                        e.soLuong != null
                          ? t("{{so}} cái", { so: formatSo(e.soLuong) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-bo-muted">
                    {gioPhut(e.thoiGian)}
                  </span>
                </Link>
              </li>
            );
          })}
          {g.ds.length > SO_DONG_CON ? (
            <li className="px-2.5 py-1 text-xs text-bo-muted">
              {t("… và {{so}} đơn khác", { so: g.ds.length - SO_DONG_CON })}
            </li>
          ) : null}
        </ul>
      ) : null}
    </Khung>
  );
}
