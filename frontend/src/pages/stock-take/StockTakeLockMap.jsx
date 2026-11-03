// src/pages/stock-take/StockTakeLockMap.jsx
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, MapPin, PackageSearch, Search, Wrench, X } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { cn } from "@/lib/utils";
import { laySoDo } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";

/** Kiểu ô kệ theo khóa / trạng thái vận hành. */
function kieuKe(k) {
  if (k.khoa === "toan_ke") return "toan";
  if (k.khoa === "theo_lo") return "min";
  if (k.trangThai === "BAO_TRI") return "baoTri";
  return k.dangChua > 0 ? "coHang" : "trong";
}
const MAU = {
  toan: "border-bo-warning/50 bg-bo-warning-soft text-bo-foreground",
  min: "border-bo-primary/40 bg-bo-primary-soft text-bo-foreground",
  baoTri: "border-dashed border-slate-300 bg-[repeating-linear-gradient(135deg,#f8fafc_0_6px,#eef2f7_6px_12px)] text-slate-500",
  coHang: "border-bo-border bg-white text-bo-foreground",
  trong: "border-bo-border bg-bo-surface-subtle text-slate-500",
};
const CHU = {
  toan: "Khóa toàn kệ",
  min: "Khóa mịn (theo lô)",
  baoTri: "Bảo trì",
  coHang: "Đang vận hành",
  trong: "Kệ trống",
};
const LOC = [
  { ma: "tatCa", nhan: "Tất cả" },
  { ma: "khoa", nhan: "Đang khóa" },
  { ma: "baoTri", nhan: "Bảo trì" },
];

function ChuGiai({ kieu, so }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
      <span aria-hidden="true" className={cn("inline-block size-3.5 rounded border", MAU[kieu])} />
      {CHU[kieu]}
      {so != null ? <b className="font-semibold tabular-nums text-bo-foreground">{soVN(so)}</b> : null}
    </span>
  );
}

/**
 * Sơ đồ khóa kiểm kê (/stock-take/lock-map?khoId=) — Đ12: thẻ riêng trong Kiểm kê, lưới kệ theo khu vực. Kệ khóa toàn
 * kệ tô vàng, kệ có lô bị giữ (khóa mịn theo danh mục) tô xanh, kệ bảo trì gạch chéo. Chạm một kệ để xem đợt đang giữ khóa
 * và các lô trên kệ (lô nào không xuất được lúc này).
 */
export default function StockTakeLockMap() {
  const navigate = useNavigate();
  const kho = useKhoKiemKe();
  const tai = useCallback(() => laySoDo(kho.khoId), [kho.khoId]);
  const q = useTaiDuLieu(tai, `kk-so-do-${kho.khoId}`, { enabled: kho.khoId != null });
  useTaiLaiKhiQuayLai(() => q.reload(), { bat: !q.loading, lanCuoi: q.capNhatLuc });
  const [loc, setLoc] = useState("tatCa");
  const [tim, setTim] = useState("");
  const [keChon, setKeChon] = useState(null);
  const chiTietRef = useRef(null);
  // Màn hẹp: phần chi tiết kệ nằm dưới lưới — chạm một kệ thì cuộn tới để thấy ngay
  const chonKe = (id) => {
    setKeChon(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setTimeout(() => chiTietRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  };

  const soDo = q.data;
  const khuVuc = useMemo(() => {
    const tu = boDau(tim.trim()).toLowerCase();
    return (soDo?.khuVuc ?? [])
      .map((kv) => ({
        ...kv,
        ke: (kv.ke ?? []).filter((k) => {
          if (tu && !boDau(k.ma).toLowerCase().includes(tu)) return false;
          if (loc === "khoa") return Boolean(k.khoa);
          if (loc === "baoTri") return k.trangThai === "BAO_TRI";
          return true;
        }),
      }))
      .filter((kv) => kv.ke.length);
  }, [soDo, loc, tim]);
  const ke = keChon == null ? null : (soDo?.khuVuc ?? []).flatMap((kv) => kv.ke ?? []).find((k) => k.id === keChon) ?? null;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title="Sơ đồ khóa kiểm kê"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate("/stock-take")}
            className="h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <ArrowLeft className="size-4" />
            Đợt kiểm kê
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bo-border bg-bo-surface px-4 py-3">
        {kho.dsKho.length > 1 ? (
          <label className="flex items-center gap-2 text-[13px] font-medium text-bo-foreground">
            Kho
            <select value={kho.khoId ?? ""} onChange={(e) => kho.doiKho(e.target.value)} className={cn(O_NHAP, "h-9 w-auto min-w-[180px]")}>
              {kho.dsKho.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.tenKho}
                </option>
              ))}
            </select>
          </label>
        ) : kho.dsKho[0] ? (
          <span className="text-[13px] font-semibold text-bo-foreground">{kho.dsKho[0].tenKho}</span>
        ) : null}
        <div role="radiogroup" aria-label="Lọc kệ" className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {LOC.map((x) => (
            <button
              key={x.ma}
              type="button"
              role="radio"
              aria-checked={loc === x.ma}
              onClick={() => setLoc(x.ma)}
              className={cn(
                "h-8 rounded-md px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                loc === x.ma ? "bg-bo-surface font-semibold text-bo-heading shadow-[0_1px_2px_rgba(15,23,42,0.14)]" : "font-medium text-slate-600 hover:text-bo-foreground",
              )}
            >
              {x.nhan}
            </button>
          ))}
        </div>
        <label className="relative flex min-w-[180px] max-w-xs flex-1 items-center">
          <span className="sr-only">Tìm kệ</span>
          <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm mã kệ" className={cn(O_NHAP, "pl-8")} />
        </label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 lg:ml-auto">
          <ChuGiai kieu="toan" so={soDo?.keKhoaToan} />
          <ChuGiai kieu="min" so={soDo?.keKhoaMin} />
          <ChuGiai kieu="baoTri" so={soDo?.keBaoTri} />
          <ChuGiai kieu="coHang" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-4">
          {kho.dangTai || (q.loading && !soDo) ? (
            <div className="rounded-lg border border-bo-border bg-bo-surface">
              <LoadingState rows={5} label="Đang tải sơ đồ kệ" />
            </div>
          ) : kho.loi || (q.error && !soDo) ? (
            <div className="rounded-lg border border-bo-border bg-bo-surface">
              <ErrorState
                description={`Không tải được sơ đồ kệ: ${getApiErrorMessage(q.error ?? kho.loi, "lỗi kết nối")}.`}
                onRetry={() => (kho.loi ? kho.taiLai() : q.reload())}
              />
            </div>
          ) : !khuVuc.length ? (
            <div className="rounded-lg border border-bo-border bg-bo-surface">
              <EmptyState
                icon={MapPin}
                title={loc === "khoa" ? "Không có kệ nào đang khóa" : tim.trim() ? "Không có kệ nào khớp" : "Kho chưa có kệ"}
                description={loc === "khoa" ? "Mọi kệ của kho đang nhập xuất bình thường." : undefined}
              />
            </div>
          ) : (
            khuVuc.map((kv) => (
              <section key={kv.id ?? "khac"} className="rounded-lg border border-bo-border bg-bo-surface p-4" aria-label={`Khu ${kv.ten || kv.ma}`}>
                <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-bo-heading">
                  {kv.ten || kv.ma || "Chưa có khu vực"}
                  <span className="text-xs font-normal text-bo-muted tabular-nums">{soVN(kv.ke.length)} kệ</span>
                </h2>
                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 p-0">
                  {kv.ke.map((k) => {
                    const kieu = kieuKe(k);
                    const day = k.sucChua ? Math.min(100, Math.round((k.dangChua / k.sucChua) * 100)) : null;
                    return (
                      <li key={k.id}>
                        <button
                          type="button"
                          aria-pressed={keChon === k.id}
                          onClick={() => chonKe(k.id)}
                          className={cn(
                            "grid w-full gap-1 rounded-md border px-2.5 py-2 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40",
                            MAU[kieu],
                            keChon === k.id && "ring-2 ring-bo-primary",
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <span className="min-w-0 truncate font-mono text-[13px] font-semibold">{k.ma}</span>
                            {kieu === "toan" || kieu === "min" ? <Lock className="ml-auto size-3.5 shrink-0" aria-label={CHU[kieu]} /> : null}
                            {kieu === "baoTri" ? <Wrench className="ml-auto size-3.5 shrink-0" aria-label="Bảo trì" /> : null}
                          </span>
                          <span className="text-[11px] leading-4 tabular-nums opacity-80">
                            {soVN(k.dangChua)}
                            {k.sucChua ? `/${soVN(k.sucChua)}` : ""} sp
                          </span>
                          {day != null ? (
                            <span className="block h-1 overflow-hidden rounded-full bg-slate-900/10" aria-hidden="true">
                              <span
                                className={cn("block h-full rounded-full", day >= 90 ? "bg-bo-danger" : "bg-slate-500/70")}
                                // data-viz: mức đầy của kệ
                                style={{ width: `${day}%` }}
                              />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <aside ref={chiTietRef} aria-label="Chi tiết kệ" className="min-w-0 rounded-lg border border-bo-border bg-bo-surface lg:sticky lg:top-4 lg:self-start">
          {ke ? (
            <div className="grid gap-3 p-4">
              <div className="flex items-start gap-2">
                <span className="min-w-0">
                  <span className="block font-mono text-lg font-semibold text-bo-heading">Kệ {ke.ma}</span>
                  <span className="text-[13px] text-bo-muted">{CHU[kieuKe(ke)]}</span>
                </span>
                <button
                  type="button"
                  aria-label="Đóng chi tiết kệ"
                  onClick={() => setKeChon(null)}
                  className="ml-auto grid size-8 place-items-center rounded-md text-bo-muted hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              {ke.dot?.length ? (
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-bo-muted">Đợt đang giữ khóa</span>
                  {ke.dot.map((d) => (
                    <Link
                      key={d.id}
                      to={`/stock-take/${d.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-bo-border px-2.5 py-2 text-[13px] hover:bg-bo-surface-subtle"
                    >
                      <span className="font-mono font-semibold text-bo-primary">{d.ma}</span>
                      <span className="truncate text-bo-muted">{d.ten}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-bo-muted">Lô trên kệ ({soVN(ke.lo?.length ?? 0)})</span>
                {ke.lo?.length ? (
                  <ul className="m-0 grid max-h-[420px] list-none gap-1.5 overflow-y-auto p-0">
                    {ke.lo.map((l) => (
                      <li key={l.loHangId} className="rounded-md border border-bo-border px-2.5 py-2 text-[13px] leading-5">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">{l.maLo}</span>
                          <span className="ml-auto font-semibold tabular-nums text-bo-foreground">{soVN(l.soLuong)}</span>
                        </span>
                        <span className="block truncate text-xs text-bo-muted">{l.tenSanPham}</span>
                        {l.dangKiemKe ? (
                          <span className="mt-1 inline-flex h-5 items-center gap-1 rounded bg-bo-warning-soft px-1.5 text-[11px] font-semibold text-bo-warning">
                            <Lock className="size-3" aria-hidden="true" />
                            Đang kiểm kê, chưa xuất được
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-bo-muted">Kệ trống.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid justify-items-center gap-2 px-4 py-10 text-center">
              <PackageSearch className="size-8 text-slate-300" aria-hidden="true" />
              <p className="text-[13px] text-bo-muted">Chọn một kệ để xem đợt đang giữ khóa và các lô trên kệ.</p>
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
