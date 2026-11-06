import { useCallback, useMemo, useRef, useState } from "react";
import { Layers, Lock, MapPin, PackageCheck, Plus, Search, Wrench, X } from "lucide-react";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP, NHAN_O, O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { docSoDem } from "@/components/kiem-ke/kiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { laySoDo } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { LY_DO_KE, conChoKe, dongMoSan, kiemChiaKe, lyDoKhongChonKe, soXepDuoc } from "./hangChuaCoKe";

/** Một lô chia tối đa ngần này kệ trong một lần xếp. */
const SO_KE_TOI_DA = 4;
const so = (v) => Number(v) || 0;

/** Thanh sức chứa của kệ: xám, gần đầy (> 90%) chuyển cam. */
function ThanhSucChua({ ke }) {
  const suc = so(ke.sucChua);
  if (suc <= 0) return <span className="text-xs text-bo-muted">Không giới hạn</span>;
  const con = conChoKe(ke);
  const tiLe = Math.min(1, so(ke.dangChua) / suc);
  return (
    <span className="grid w-[112px] gap-1 text-right">
      <span className={cn("text-xs tabular-nums", con === 0 ? "font-medium text-bo-danger" : "text-bo-muted")}>
        {con === 0 ? "Đầy" : `còn chỗ ${soVN(con)}`}
      </span>
      <span className="block h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <span className={cn("block h-full rounded-full", tiLe > 0.9 ? "bg-amber-500" : "bg-slate-400")} style={{ width: `${Math.round(tiLe * 100)}%` }} />
      </span>
    </span>
  );
}

/** Một kệ trong danh sách chọn. */
function DongKe({ ke, the, chan, dangLa, daChonDongKhac, vaoTab, onChon }) {
  const tat = Boolean(chan) || daChonDongKhac;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dangLa}
      disabled={tat}
      tabIndex={vaoTab ? 0 : -1}
      data-ke-id={ke.id}
      onClick={() => onChon(ke.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
        dangLa ? "bg-bo-primary-soft ring-1 ring-blue-200" : "hover:bg-bo-surface-subtle",
        tat && "cursor-not-allowed opacity-55 hover:bg-transparent",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]", dangLa ? "border-bo-primary" : "border-slate-300")}
      >
        {dangLa ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
      </span>
      <span className="w-[76px] shrink-0 font-mono text-[13px] font-semibold text-bo-foreground">{ke.ma}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {the ? (
          <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-[11px] font-semibold", the.chinh ? "bg-bo-primary-soft text-bo-primary-strong" : "bg-slate-100 text-slate-600")}>
            {the.nhan}
          </span>
        ) : null}
        {chan ? (
          <span className="inline-flex h-5 items-center gap-1 rounded bg-bo-warning-soft px-1.5 text-[11px] font-semibold text-bo-warning">
            {chan === "Bảo trì" ? <Wrench className="size-3" aria-hidden="true" /> : <Lock className="size-3" aria-hidden="true" />}
            {chan}
          </span>
        ) : null}
        {daChonDongKhac ? <span className="text-xs text-bo-muted">đã chọn ở dòng khác</span> : null}
        {!the && !chan && !daChonDongKhac ? <span className="truncate text-xs text-bo-muted">{ke.khu}</span> : null}
      </span>
      <ThanhSucChua ke={ke} />
    </button>
  );
}

/** Thẻ kệ đã chọn ở một dòng chia kệ. */
const ChipKe = ({ ma }) => (
  <span className="inline-flex h-6 items-center gap-1 rounded-md border border-blue-200 bg-bo-primary-soft px-1.5 font-mono text-xs font-medium text-bo-primary-strong">
    <MapPin className="size-3" aria-hidden="true" />
    {ma}
  </span>
);

/**
 * Hộp xếp hàng chưa có kệ lên kệ. Một lô: chia được tối đa 4 kệ, mở sẵn kệ gợi ý (thiếu chỗ thì mở sẵn dòng chia thêm).
 * Nhiều lô: một kệ nhận hết phần chưa có kệ của các lô. Danh sách kệ lấy từ sơ đồ kệ của kho (sức chứa, bảo trì, khóa
 * kiểm kê), có ô tìm; kệ liên quan tới lô đứng đầu kèm lý do. Chỉ kiểm và gom phần xếp; nơi gọi gửi
 * (`onXep(phan, maKeTheoId)` với `phan = [{ loHangId, viTriKhoId, soLuong }]`, `maKeTheoId`: Map id → mã kệ) và đóng hộp.
 *
 * Số tính trên phần xếp được của lô (chưa có kệ trừ phần phiếu nhặt đang giữ). Danh sách kệ là nhóm radio: Tab vào kệ
 * đang chọn, mũi tên lên / xuống đổi kệ. `onSua()`: người dùng vừa sửa (nơi gọi xóa `loi`). `lanTaiKe`: tăng để tải lại
 * sơ đồ kệ (sau lần xếp bị từ chối, sức chứa có thể đã đổi).
 *
 * Nơi gọi đổi `key` mỗi lần mở để hộp dựng lại từ đầu với lô mới (giữ `key` khi đóng để Radix trả tiêu điểm).
 */
export default function HopXepKe({ mo, dsLo, khoId, dangChay, loi, lanTaiKe = 0, onDoiMo, onSua, onXep }) {
  const motLo = dsLo.length === 1 ? dsLo[0] : null;
  const toiDaMotLo = soXepDuoc(motLo);
  const taiSoDo = useCallback(() => laySoDo(khoId), [khoId]);
  const q = useTaiDuLieu(taiSoDo, `xep-ke-so-do-${khoId}-${lanTaiKe}`, { enabled: mo && khoId != null });
  const dsKeRef = useRef(null);
  const [dong, setDong] = useState(() => (motLo ? dongMoSan(motLo) : [{ keId: null, soLuong: null }]));
  const [dangSua, setDangSua] = useState(() => (motLo && dongMoSan(motLo).length > 1 ? 1 : 0));
  const [tim, setTim] = useState("");

  const dsKe = useMemo(
    () =>
      ((q.dungKhoa ? q.data : undefined)?.khuVuc ?? [])
        .flatMap((kv) => (kv.ke ?? []).map((k) => ({ ...k, khu: kv.ten || kv.ma || "Khác" })))
        .sort((a, b) => String(a.ma).localeCompare(String(b.ma), "vi", { numeric: true })),
    [q.data, q.dungKhoa],
  );
  const keTheoId = useMemo(() => new Map(dsKe.map((k) => [k.id, k])), [dsKe]);
  const dangTaiKe = q.loading && !q.dungKhoa;
  const loiTaiKe = !q.loading && q.error && !q.dungKhoa ? q.error : null;

  // Kệ liên quan tới lô (một lô): đứng đầu danh sách theo thứ tự gợi ý của máy chủ
  const lienQuan = useMemo(() => new Map((motLo?.keLienQuan ?? []).map((k, i) => [k.id, { ...k, thu: i }])), [motLo]);
  const tu = boDau(tim.trim()).toLowerCase();
  const khop = (k) => !tu || boDau(`${k.ma} ${k.khu}`).toLowerCase().includes(tu);
  const keGoiY = dsKe.filter((k) => lienQuan.has(k.id) && khop(k)).sort((a, b) => lienQuan.get(a.id).thu - lienQuan.get(b.id).thu);
  const keKhac = dsKe.filter((k) => !lienQuan.has(k.id) && khop(k));
  const nhomKhu = [...new Set(keKhac.map((k) => k.khu))];

  const keDangChon = new Set(dong.map((d) => d.keId).filter((id) => id != null));
  const sua = (doi) => {
    setDong(doi);
    onSua?.();
  };
  const chonKe = (id) => sua((cu) => cu.map((d, i) => (i === dangSua ? { ...d, keId: id } : d)));
  const doiSo = (i, chu) => sua((cu) => cu.map((d, j) => (j === i ? { ...d, soLuong: docSoDem(chu, 1_000_000) || null } : d)));
  const themDong = () => {
    sua((cu) => [...cu, { keId: null, soLuong: Math.max(0, toiDaMotLo - cu.reduce((s, d) => s + so(d.soLuong), 0)) || null }]);
    setDangSua(dong.length);
  };
  const boDong = (i) => {
    sua((cu) => cu.filter((_, j) => j !== i));
    setDangSua((cu) => Math.max(0, cu >= i ? cu - 1 : cu));
  };
  // Mũi tên trong nhóm radio: sang kệ chọn được kế tiếp / trước và chọn luôn (như radio của trình duyệt)
  const diChuyenKe = (suKien) => {
    const buoc = suKien.key === "ArrowDown" || suKien.key === "ArrowRight" ? 1 : suKien.key === "ArrowUp" || suKien.key === "ArrowLeft" ? -1 : 0;
    if (!buoc) return;
    const nut = [...(dsKeRef.current?.querySelectorAll('[role="radio"]:not(:disabled)') ?? [])];
    if (!nut.length) return;
    suKien.preventDefault();
    const hienTai = nut.indexOf(document.activeElement);
    const toi = nut[(hienTai + buoc + nut.length) % nut.length];
    toi.focus();
    chonKe(Number(toi.dataset.keId));
  };

  // Kiểm: một lô theo từng dòng; nhiều lô thì kệ phải đủ chỗ cho tổng
  const tongNhieuLo = dsLo.reduce((s, h) => s + soXepDuoc(h), 0);
  const kiem = motLo ? kiemChiaKe(dong, toiDaMotLo, keTheoId) : null;
  const keNhieuLo = keTheoId.get(dong[0]?.keId);
  const conChoNhieuLo = conChoKe(keNhieuLo);
  const lyDoKhoa = dangTaiKe
    ? "Đang tải danh sách kệ"
    : loiTaiKe
    ? "Chưa tải được danh sách kệ"
    : motLo
      ? kiem.loi
      : !keNhieuLo
        ? "Chọn kệ"
        : conChoNhieuLo != null && conChoNhieuLo < tongNhieuLo
          ? `Kệ ${keNhieuLo.ma} chỉ còn chỗ ${soVN(conChoNhieuLo)}`
          : null;

  const xep = () => {
    const phan = motLo
      ? dong.map((d) => ({ loHangId: motLo.loHangId, viTriKhoId: d.keId, soLuong: so(d.soLuong) }))
      : dsLo.map((h) => ({ loHangId: h.loHangId, viTriKhoId: dong[0].keId, soLuong: soXepDuoc(h) }));
    onXep(phan, new Map(dsKe.map((k) => [k.id, k.ma])));
  };

  // Kệ nhận Tab: kệ đang chọn của dòng đang sửa nếu đang hiện, không thì kệ chọn được đầu tiên
  const keDangSua = dong[dangSua]?.keId;
  const keHien = [...keGoiY, ...keKhac];
  const keVaoTab = (keHien.some((k) => k.id === keDangSua && !lyDoKhongChonKe(k, dsLo)) ? keDangSua : null)
    ?? keHien.find((k) => !lyDoKhongChonKe(k, dsLo) && !(keDangChon.has(k.id) && keDangSua !== k.id))?.id;
  const dongKe = (k) => {
    const lq = lienQuan.get(k.id);
    const chanKe = lyDoKhongChonKe(k, dsLo);
    return (
      <DongKe
        key={k.id}
        ke={k}
        the={lq ? { nhan: LY_DO_KE[lq.lyDo] ?? "Liên quan", chinh: lq.lyDo === "KE_CUA_LO" || lq.lyDo === "DANG_CHUA_LO" } : null}
        chan={chanKe}
        dangLa={keDangSua === k.id}
        daChonDongKhac={keDangChon.has(k.id) && keDangSua !== k.id}
        vaoTab={k.id === keVaoTab}
        onChon={chonKe}
      />
    );
  };

  return (
    <HopXacNhanChungTu
      mo={mo}
      onDoiMo={onDoiMo}
      rong
      tieuDe={motLo ? `Xếp lô ${motLo.maLo} lên kệ` : `Xếp ${soVN(dsLo.length)} lô lên một kệ`}
      moTa={
        motLo
          ? `${motLo.sanPham?.tenSanPham ?? ""} · xếp được ${soVN(toiDaMotLo)}/${soVN(motLo.chuaCoKe)} sản phẩm chưa có kệ${
              Number(motLo.dangGiuNhat) > 0 ? ` (${soVN(motLo.dangGiuNhat)} đang chờ nhặt)` : ""
            }. Chỉ ghi sổ kệ, tồn kho không đổi.`
          : `${soVN(tongNhieuLo)} sản phẩm, xếp hết phần chưa có kệ của từng lô. Chỉ ghi sổ kệ, tồn kho không đổi.`
      }
      nhanXacNhan="Xếp lên kệ"
      iconXacNhan={PackageCheck}
      dangChay={dangChay}
      khoaXacNhan={Boolean(lyDoKhoa)}
      lyDoKhoa={lyDoKhoa ?? undefined}
      loi={loi}
      tieuDiemONhap={false}
      onXacNhan={xep}
    >
      {motLo ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <AnhBienThe src={motLo.sanPham?.anh} />
            <span className="min-w-0 text-xs text-bo-muted">
              <MauKichCo dong={motLo.sanPham} className="align-bottom" /> · <span className="font-mono">{motLo.sanPham?.maSku}</span>
            </span>
          </div>
          {dong.map((d, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2",
                i === dangSua ? "border-bo-primary ring-2 ring-bo-primary/15" : "border-bo-border",
              )}
            >
              <button
                type="button"
                onClick={() => setDangSua(i)}
                aria-label={`Dòng ${i + 1}: ${d.keId != null ? `kệ ${keTheoId.get(d.keId)?.ma ?? ""}` : "chưa chọn kệ"}. Bấm để chọn kệ cho dòng này`}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {d.keId != null ? (
                  <ChipKe ma={keTheoId.get(d.keId)?.ma ?? motLo.keLienQuan?.find((k) => k.id === d.keId)?.ma ?? "…"} />
                ) : (
                  <span className="text-[13px] text-bo-muted">Chọn kệ ở danh sách dưới</span>
                )}
                {d.keId != null && kiem.loiDong[i] ? <span className="text-xs font-medium text-bo-danger">{kiem.loiDong[i]}</span> : null}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-bo-muted">
                Số lượng
                <input
                  type="text"
                  inputMode="numeric"
                  value={d.soLuong == null ? "" : String(d.soLuong)}
                  onChange={(e) => doiSo(i, e.target.value)}
                  onFocus={() => setDangSua(i)}
                  className={cn(O_NHAP, "h-8 w-[84px] text-right tabular-nums")}
                />
              </label>
              {dong.length > 1 ? (
                <button
                  type="button"
                  onClick={() => boDong(i)}
                  aria-label={`Bỏ dòng ${i + 1}`}
                  className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-bo-danger"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <NutChu onClick={themDong} disabled={kiem.conLai <= 0 || dong.length >= SO_KE_TOI_DA}>
              <span className="inline-flex items-center gap-1">
                <Plus className="size-3.5" aria-hidden="true" />
                Chia thêm kệ
              </span>
            </NutChu>
            <span className={cn("tabular-nums", kiem.conLai < 0 ? "font-medium text-bo-danger" : "text-bo-muted")}>
              {kiem.conLai > 0
                ? `Còn ${soVN(kiem.conLai)} sản phẩm để lại ở hàng chưa có kệ`
                : kiem.conLai === 0
                  ? "Xếp hết phần chưa có kệ"
                  : `Vượt ${soVN(-kiem.conLai)} so với phần chưa có kệ`}
            </span>
          </div>
        </div>
      ) : (
        <div className={cn(GHI_CHU_HOP, "grid gap-1.5")}>
          {dsLo.slice(0, 4).map((h) => (
            <div key={h.loHangId} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                {h.sanPham?.tenSanPham} · <span className="font-mono text-xs">{h.maLo}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{soVN(soXepDuoc(h))}</span>
            </div>
          ))}
          {dsLo.length > 4 ? <div className="text-xs text-bo-muted">và {soVN(dsLo.length - 4)} lô khác</div> : null}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-bo-border pt-2">
            <span className="flex items-center gap-1.5 text-bo-muted">
              <Layers className="size-3.5" aria-hidden="true" />
              Kệ nhận
            </span>
            {keNhieuLo ? <ChipKe ma={keNhieuLo.ma} /> : <span className="text-bo-muted">Chọn ở danh sách dưới</span>}
          </div>
        </div>
      )}

      <div className="grid gap-2 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span id="xep-ke-nhan" className={NHAN_O}>
            {motLo && dong.length > 1 ? `Kệ cho dòng ${dangSua + 1}` : "Kệ"} <span className="text-bo-danger">*</span>
          </span>
          <span className="text-xs text-bo-muted">Kệ bảo trì, đang kiểm kê hoặc đã đầy không chọn được</span>
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Tìm kệ</span>
          <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm mã kệ hoặc khu, ví dụ A-02" className={cn(O_NHAP, "pl-8")} />
        </label>
        <div
          ref={dsKeRef}
          role="radiogroup"
          aria-labelledby="xep-ke-nhan"
          onKeyDown={diChuyenKe}
          className="max-h-[300px] overflow-y-auto rounded-md border border-bo-border p-1"
        >
          {dangTaiKe ? (
            <p className="px-3 py-6 text-center text-[13px] text-bo-muted">Đang tải danh sách kệ…</p>
          ) : loiTaiKe ? (
            <p role="alert" className="px-3 py-6 text-center text-[13px] text-bo-danger">
              Không tải được danh sách kệ: {getApiErrorMessage(loiTaiKe, "lỗi kết nối")}. <NutChu onClick={q.reload}>Thử lại</NutChu>
            </p>
          ) : !dsKe.length ? (
            <p className="px-3 py-6 text-center text-[13px] text-bo-muted">Kho chưa có kệ nào. Thêm kệ ở Vị trí kệ rồi quay lại.</p>
          ) : !keGoiY.length && !keKhac.length ? (
            <p className="px-3 py-6 text-center text-[13px] text-bo-muted">Không có kệ khớp “{tim.trim()}”</p>
          ) : (
            <>
              {keGoiY.length ? (
                <>
                  <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Gợi ý cho lô này</div>
                  {keGoiY.map(dongKe)}
                </>
              ) : null}
              {nhomKhu.map((khu) => (
                <div key={khu}>
                  <div className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{khu}</div>
                  {keKhac.filter((k) => k.khu === khu).map(dongKe)}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </HopXacNhanChungTu>
  );
}
