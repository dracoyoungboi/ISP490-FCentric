// src/pages/stock-take/StockTakeLockMap.jsx
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Lock, LockOpen, MapPin, PackageSearch, Search, Warehouse, Wrench, X } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { cn } from "@/lib/utils";
import { laySoDo } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";

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
const TRONG_THEO_LOC = {
  khoa: { title: "Không có kệ nào đang khóa", description: "Mọi kệ của kho đang nhập xuất bình thường." },
  baoTri: { title: "Không có kệ nào đang bảo trì", description: "Mọi kệ của kho đang vận hành." },
};

const hopLoc = (k, loc) => (loc === "khoa" ? Boolean(k.khoa) : loc === "baoTri" ? k.trangThai === "BAO_TRI" : true);
/** Đuôi mã đợt ghi trên ô kệ: một đợt "…002", nhiều đợt "2 đợt". */
const nhanDot = (dot) => (!dot?.length ? null : dot.length > 1 ? `${dot.length} đợt` : `…${String(dot[0].ma ?? "").slice(-3)}`);

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
 * kệ tô vàng, kệ có lô bị giữ (khóa mịn theo danh mục) tô xanh, kệ bảo trì gạch chéo. Dải tổng quan đầu trang: bao nhiêu
 * kệ đang khóa và đợt nào giữ; bấm một đợt để làm nổi kệ của đợt đó. Chạm một kệ để xem đợt đang giữ khóa và các lô trên
 * kệ (lô nào không xuất được lúc này).
 */
export default function StockTakeLockMap() {
  const navigate = useNavigate();
  const kho = useKhoKiemKe();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const tai = useCallback(() => laySoDo(kho.khoId), [kho.khoId]);
  const q = useTaiDuLieu(tai, `kk-so-do-${kho.khoId}`, { enabled: kho.khoId != null });
  useTaiLaiKhiQuayLai(() => q.reload(), { bat: !q.loading, lanCuoi: q.capNhatLuc });
  const [loc, setLoc] = useState("tatCa");
  const [tim, setTim] = useState("");
  const [keChon, setKeChon] = useState(null);
  const [dotChon, setDotChon] = useState(null);
  const chiTietRef = useRef(null);
  // Màn hẹp: phần chi tiết kệ nằm dưới lưới — chạm một kệ thì cuộn tới để thấy ngay
  const chonKe = (id) => {
    setKeChon(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setTimeout(() => chiTietRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  };

  // Đổi kho: dữ liệu kho cũ còn giữ trong lúc tải — coi như đang tải, không vẽ sơ đồ kho cũ dưới tên kho mới
  const soDo = q.dungKhoa ? q.data : undefined;
  const tatCaKe = useMemo(() => (soDo?.khuVuc ?? []).flatMap((kv) => kv.ke ?? []), [soDo]);
  const soKhoa = tatCaKe.filter((k) => k.khoa).length;
  // Đợt đang giữ khóa: gom từ các kệ, đếm số kệ mỗi đợt
  const dsDot = useMemo(() => {
    const theoId = new Map();
    for (const k of tatCaKe) {
      for (const d of k.dot ?? []) {
        const cu = theoId.get(d.id);
        if (cu) cu.soKe += 1;
        else theoId.set(d.id, { ...d, soKe: 1 });
      }
    }
    return [...theoId.values()].sort((a, b) => b.soKe - a.soKe || String(a.ma).localeCompare(String(b.ma)));
  }, [tatCaKe]);
  // Đợt vừa xong / kho vừa đổi thì đợt đang chọn không còn: tự thôi làm nổi
  const dotNoi = dsDot.some((d) => d.id === dotChon) ? dotChon : null;

  const tu = boDau(tim.trim()).toLowerCase();
  const khuVuc = useMemo(
    () =>
      (soDo?.khuVuc ?? [])
        .map((kv) => ({ ...kv, ke: (kv.ke ?? []).filter((k) => hopLoc(k, loc) && (!tu || boDau(k.ma).toLowerCase().includes(tu))) }))
        .filter((kv) => kv.ke.length),
    [soDo, loc, tu],
  );
  const ke = keChon == null ? null : tatCaKe.find((k) => k.id === keChon) ?? null;

  // Lưới trống: nói đúng lý do theo bộ lọc / ô tìm
  const trong = (() => {
    if (!tatCaKe.length) return { title: "Kho chưa có kệ", description: "Thêm khu vực và kệ ở Vị trí kệ để xem sơ đồ khóa." };
    if (loc !== "tatCa" && !tatCaKe.some((k) => hopLoc(k, loc))) return TRONG_THEO_LOC[loc];
    return {
      title: `Không có kệ nào khớp “${tim.trim()}”`,
      description: loc === "tatCa" ? "Thử mã kệ khác." : `Đang lọc “${LOC.find((x) => x.ma === loc)?.nhan}”. Thử mã kệ khác hoặc chọn Tất cả.`,
      action: (
        <Button variant="outline" onClick={() => setTim("")} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
          Xóa tìm kiếm
        </Button>
      ),
    };
  })();

  const khongCoKho = !kho.dangTai && !kho.loi && !kho.dsKho.length;
  const dangTaiSoDo = kho.dangTai || (q.loading && !q.dungKhoa);

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

      {kho.loi ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <ErrorState
            title="Không tải được danh sách kho"
            description={`${getApiErrorMessage(kho.loi, "Lỗi kết nối")}. Thử lại sau giây lát.`}
            onRetry={kho.taiLai}
          />
        </div>
      ) : khongCoKho ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <EmptyState
            icon={Warehouse}
            title={laQtv ? "Chưa có kho giao dịch nào" : "Bạn chưa được phân kho nào"}
            description={laQtv ? "Tạo kho trước rồi quay lại để xem sơ đồ khóa." : "Nhờ quản trị viên phân kho để xem sơ đồ khóa kiểm kê."}
          />
        </div>
      ) : (
        <>
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
              <ChuGiai kieu="trong" />
            </div>
          </div>

          {/* Dải tổng quan: bao nhiêu kệ đang khóa, của đợt nào; bấm đợt để chỉ làm nổi kệ của đợt đó */}
          {soDo && tatCaKe.length ? (
            soKhoa || dsDot.length ? (
              <section
                aria-label="Kệ đang khóa"
                className="grid items-center gap-x-6 gap-y-3 rounded-lg border border-bo-border bg-bo-surface px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)]"
              >
                <div>
                  <span className="text-[28px] font-semibold leading-8 tabular-nums text-bo-heading">{soVN(soKhoa)}</span>
                  <span className="text-sm tabular-nums text-bo-muted">/{soVN(tatCaKe.length)} kệ đang khóa</span>
                  <span className="mt-1.5 block h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      // data-viz: tỷ lệ kệ đang khóa
                      style={{ width: `${Math.round((soKhoa / tatCaKe.length) * 100)}%` }}
                    />
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {dsDot.map((d) => {
                    const dangChon = dotNoi === d.id;
                    return (
                      <div
                        key={d.id}
                        className={cn(
                          "flex max-w-full items-stretch overflow-hidden rounded-lg border bg-bo-surface",
                          dangChon ? "border-bo-primary ring-1 ring-bo-primary" : "border-bo-border",
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={dangChon}
                          title={dangChon ? "Bỏ làm nổi kệ của đợt này" : "Chỉ làm nổi kệ của đợt này"}
                          onClick={() => setDotChon(dangChon ? null : d.id)}
                          className={cn(
                            "flex min-w-0 items-center gap-2.5 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/40",
                            dangChon ? "bg-bo-primary-soft/60" : "hover:bg-bo-surface-subtle",
                          )}
                        >
                          {d.ten ? <StatusBadge quyTrinh="kiemKe" label={d.ten} /> : null}
                          <span className={cn("min-w-0", d.ten && "border-l border-bo-border pl-2.5")}>
                            <span className="block truncate font-mono text-[13px] font-semibold text-bo-primary">{d.ma}</span>
                            <span className="block text-xs tabular-nums text-bo-muted">{soVN(d.soKe)} kệ</span>
                          </span>
                        </button>
                        <Link
                          to={`/stock-take/${d.id}`}
                          aria-label={`Mở đợt ${d.ma}`}
                          title={`Mở đợt ${d.ma}`}
                          className="grid w-9 shrink-0 place-items-center border-l border-bo-border text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/40"
                        >
                          <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                      </div>
                    );
                  })}
                  {dotNoi != null ? (
                    <NutChu onClick={() => setDotChon(null)} className="ml-1">
                      Bỏ lọc
                    </NutChu>
                  ) : null}
                </div>
              </section>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-bo-border bg-bo-surface px-4 py-3 text-[13px] text-bo-muted">
                <LockOpen className="size-4 shrink-0 text-bo-success" aria-hidden="true" />
                <span>
                  <b className="font-semibold text-bo-foreground">Không có kệ nào đang khóa.</b> {soVN(tatCaKe.length)} kệ nhập xuất bình thường.
                </span>
              </p>
            )
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-w-0 content-start gap-4">
              {dangTaiSoDo ? (
                <div className="rounded-lg border border-bo-border bg-bo-surface">
                  <LoadingState rows={5} label="Đang tải sơ đồ kệ" />
                </div>
              ) : q.error && !soDo ? (
                <div className="rounded-lg border border-bo-border bg-bo-surface">
                  <ErrorState description={`Không tải được sơ đồ kệ: ${getApiErrorMessage(q.error, "lỗi kết nối")}.`} onRetry={q.reload} />
                </div>
              ) : !khuVuc.length ? (
                <div className="rounded-lg border border-bo-border bg-bo-surface">
                  <EmptyState icon={trong === TRONG_THEO_LOC.khoa ? LockOpen : MapPin} title={trong.title} description={trong.description} action={trong.action} />
                </div>
              ) : (
                khuVuc.map((kv) => {
                  const khoaTrongKhu = kv.ke.filter((k) => k.khoa).length;
                  return (
                    <section key={kv.id ?? "khac"} className="rounded-lg border border-bo-border bg-bo-surface p-4" aria-label={`Khu ${kv.ten || kv.ma}`}>
                      <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-bo-heading">
                        {kv.ten || kv.ma || "Chưa có khu vực"}
                        <span className="text-xs font-normal text-bo-muted tabular-nums">
                          {soVN(kv.ke.length)} kệ{khoaTrongKhu && loc !== "khoa" ? ` · ${soVN(khoaTrongKhu)} đang khóa` : ""}
                        </span>
                      </h2>
                      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 p-0">
                        {kv.ke.map((k) => {
                          const kieu = kieuKe(k);
                          const day = k.sucChua ? Math.min(100, Math.round((k.dangChua / k.sucChua) * 100)) : null;
                          const mo = dotNoi != null && !(k.dot ?? []).some((d) => d.id === dotNoi);
                          const duoiDot = nhanDot(k.dot);
                          return (
                            <li key={k.id}>
                              <button
                                type="button"
                                aria-pressed={keChon === k.id}
                                onClick={() => chonKe(k.id)}
                                className={cn(
                                  "grid w-full gap-1 rounded-md border px-2.5 py-2 text-left transition-[box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40",
                                  MAU[kieu],
                                  keChon === k.id && "ring-2 ring-bo-primary",
                                  mo && "opacity-35 hover:opacity-70",
                                )}
                              >
                                <span className="flex items-center gap-1">
                                  <span className="min-w-0 truncate font-mono text-[13px] font-semibold">{k.ma}</span>
                                  {kieu === "toan" || kieu === "min" ? <Lock className="ml-auto size-3.5 shrink-0" aria-label={CHU[kieu]} /> : null}
                                  {kieu === "baoTri" ? <Wrench className="ml-auto size-3.5 shrink-0" aria-label="Bảo trì" /> : null}
                                </span>
                                <span className="truncate text-[11px] leading-4 tabular-nums opacity-80">
                                  {soVN(k.dangChua)}
                                  {k.sucChua ? `/${soVN(k.sucChua)}` : ""} sp
                                  {duoiDot ? (
                                    <span title={(k.dot ?? []).map((d) => d.ma).join(", ")}>
                                      {" · "}
                                      <span className="font-mono">{duoiDot}</span>
                                    </span>
                                  ) : null}
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
                  );
                })
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
                          <span className="truncate font-mono font-semibold text-bo-primary">{d.ma}</span>
                          {d.ten ? <StatusBadge quyTrinh="kiemKe" label={d.ten} /> : null}
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
                            {l.maSku ? <span className="block truncate font-mono text-xs text-bo-muted">{l.maSku}</span> : null}
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
        </>
      )}
    </PageContainer>
  );
}
