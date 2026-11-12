import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { CircleCheck, Info, List, ScanBarcode, Search, TriangleAlert, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { locGoiYKe } from "./chuyenKe";
import DanhSachGoiYKe from "./DanhSachGoiYKe";

const BUOC = [t("Kệ nguồn"), t("Chọn hàng"), t("Kệ đích"), t("Xác nhận")];

const KIEU = {
  ok: { icon: CircleCheck, mau: "text-bo-success" },
  canhBao: { icon: TriangleAlert, mau: "text-bo-warning" },
  loi: { icon: TriangleAlert, mau: "text-bo-danger" },
  thongTin: { icon: Info, mau: "text-bo-muted" },
};

// Máy quét gõ cả mã trong vài chục mili giây rồi Enter: chỉ mở danh sách khi ngừng gõ quá mốc này, để Enter của máy quét
// luôn tra đúng mã vừa quét chứ không bấm nhầm dòng gợi ý
const TRE_MO_KHI_GO = 120;
const TRE_MO_KHI_BAM = 80;

const laManCamUng = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-cam-ung");

/** Bảng chọn kệ từ đáy màn (màn cảm ứng): ô tìm riêng, danh sách cao dễ chạm. */
function BangChonKe({ mo, onDoiMo, vaiTro, goiYTham, onChon }) {
  const [tim, setTim] = useState("");
  // Kệ đích: liệt kê sẵn theo 3 nhóm khi chưa gõ; kệ nguồn: kệ gần đây + đang có hàng
  const kq = useMemo(() => locGoiYKe(goiYTham.ds, { ...goiYTham, q: tim, vaiTro, tatCa: vaiTro === "dich" }), [goiYTham, tim, vaiTro]);
  const dong = (m) => {
    onDoiMo(m);
    if (!m) setTim("");
  };
  return (
    <Sheet open={mo} onOpenChange={dong}>
      <SheetContent side="bottom" className="max-h-[80dvh] gap-0 rounded-t-2xl bg-bo-surface p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="border-b border-bo-border px-4 pb-3 pt-4 text-left">
          <SheetTitle className="text-base font-semibold text-bo-heading">{vaiTro === "dich" ? t("Chọn kệ đích") : t("Chọn kệ nguồn")}</SheetTitle>
          <SheetDescription className="sr-only">{t("Tìm theo mã kệ rồi chạm để chọn.")}</SheetDescription>
          <label className="relative mt-2 flex items-center">
            <span className="sr-only">{t("Tìm mã kệ")}</span>
            <Search className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden="true" />
            <input
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              placeholder={t("Tìm mã kệ")}
              className="h-10 w-full rounded-md border border-bo-input-border bg-white pl-9 pr-3 text-sm outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
            />
          </label>
        </SheetHeader>
        <div className="overflow-y-auto px-1.5 pb-6 pt-1" role="listbox" aria-label={t("Danh sách kệ")}>
          <DanhSachGoiYKe
            kq={kq}
            q={tim}
            vaiTro={vaiTro}
            can={goiYTham.can}
            cao
            khongThay={Boolean(tim.trim())}
            idDong={(k) => `ck-sheet-ke-${k.id}`}
            onChon={(k) => {
              dong(false);
              onChon(k.maViTri);
            }}
          />
          {!kq.nhom.length && !tim.trim() ? <p className="px-4 py-6 text-center text-[13px] text-bo-muted">{t("Gõ mã kệ để tìm.")}</p> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Ô quét duy nhất của màn Chuyển kệ: mã kệ nguồn, mã hàng / lô, mã kệ đích đều quét vào đây, màn tự hiểu theo bước
 * (`onQuet(ma)`). Gõ tay thì hiện danh sách gợi ý mã kệ thả ngay dưới ô (thay datalist của trình duyệt): theo bước
 * (`vaiTro` "nguon" | "dich"), có trạng thái, sức chứa, kệ khóa ghi lý do; ↑↓ chọn, Enter mở, Esc đóng. Màn cảm ứng
 * không bật danh sách (tránh che màn cùng bàn phím) mà có nút "Chọn kệ" mở bảng từ đáy.
 * - `buoc` 0–3 (4 = xong); `phanHoi` `{ kieu, chu }` câu ngay dưới ô; `lan` đổi mỗi lần quét để câu hiện lại.
 * - `ban`: đang tra mã (chỉ đọc, giữ tiêu điểm); Enter lúc này gọi `onQuetKhiBan` để báo mã bị bỏ.
 * - `dsKe`: kệ của kho; `ganDay`: mã kệ dùng gần đây; `keNguonId`, `can`: cho gợi ý kệ đích.
 */
const ThanhQuet = forwardRef(function ThanhQuet(
  { giaTri, onDoi, onQuet, onQuetKhiBan, goiY, buoc, phanHoi, lan = 0, ban = false, khoa = false, dsKe, ganDay, vaiTro = "nguon", keNguonId, can = 0 },
  ref,
) {
  const id = useId();
  const idDs = `${id}-goi-y`;
  const [mo, setMo] = useState(false);
  const [troId, setTroId] = useState(null);
  const [moBang, setMoBang] = useState(false);
  const hen = useRef(null);
  const huyHen = () => {
    if (hen.current) clearTimeout(hen.current);
    hen.current = null;
  };
  const henMo = (ms) => {
    huyHen();
    if (laManCamUng()) return;
    hen.current = setTimeout(() => setMo(true), ms);
  };
  useEffect(() => huyHen, []);

  const goiYTham = useMemo(() => ({ ds: dsKe ?? [], keNguonId, can, ganDay: ganDay ?? [] }), [dsKe, keNguonId, can, ganDay]);
  const kq = useMemo(() => locGoiYKe(goiYTham.ds, { ...goiYTham, q: giaTri, vaiTro }), [goiYTham, giaTri, vaiTro]);
  const dangGo = Boolean(String(giaTri ?? "").trim());
  // "Không có kệ khớp" chỉ ở bước kệ nguồn: bước sau ô còn nhận mã hàng, gõ SKU không phải lỗi
  const khongThay = buoc === 0 && String(giaTri ?? "").trim().length >= 2;
  // Bước chọn hàng: ô chủ yếu nhận mã hàng, chỉ gợi ý kệ (đổi kệ nguồn) khi đang gõ
  const hien = mo && !ban && !khoa && (buoc === 0 || dangGo) && (kq.nhom.length > 0 || (khongThay && kq.tong === 0));
  const dangChon = kq.chonDuoc.some((k) => k.id === troId) ? troId : dangGo ? kq.chonDuoc[0]?.id ?? null : null;
  const idDong = (k) => `${id}-ke-${k.id}`;
  const daHien = kq.nhom.reduce((s, n) => s + n.ds.length, 0);

  // ↑↓: cuộn khung theo dòng đang sáng
  useEffect(() => {
    if (!hien || dangChon == null) return;
    document.getElementById(`${id}-ke-${dangChon}`)?.scrollIntoView({ block: "nearest" });
  }, [hien, dangChon, id]);

  const k = phanHoi ? KIEU[phanHoi.kieu] ?? KIEU.thongTin : null;
  const Icon = k?.icon;
  const loi = phanHoi?.kieu === "loi";

  const quet = (ma) => {
    huyHen();
    setMo(false);
    setTroId(null);
    onQuet(ma);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!kq.chonDuoc.length) return;
      e.preventDefault();
      if (!hien) {
        huyHen();
        setMo(true);
      }
      const i = kq.chonDuoc.findIndex((x) => x.id === dangChon);
      const buocDi = e.key === "ArrowDown" ? 1 : -1;
      const moi = i < 0 ? (buocDi > 0 ? 0 : kq.chonDuoc.length - 1) : (i + buocDi + kq.chonDuoc.length) % kq.chonDuoc.length;
      setTroId(kq.chonDuoc[moi].id);
      return;
    }
    if (e.key === "Escape") {
      if (hien) {
        e.preventDefault();
        setMo(false);
      }
      huyHen();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (ban) {
      onQuetKhiBan?.();
      return;
    }
    // Danh sách đang hiện (người dùng gõ tay rồi dừng) và có dòng đang sáng: mở kệ đó; còn lại tra đúng chữ trong ô
    const dong = hien ? kq.chonDuoc.find((x) => x.id === dangChon) : null;
    quet(dong ? dong.maViTri : giaTri);
  };

  return (
    <div className="relative z-20 rounded-lg border border-bo-border bg-bo-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-[240px] flex-1">
          <div className="flex gap-2">
            <label className="relative flex min-w-0 flex-1 items-center">
              <span className="sr-only">{t("Ô quét mã kệ hoặc mã hàng")}</span>
              <ScanBarcode className="pointer-events-none absolute left-3 size-5 text-bo-primary" aria-hidden="true" />
              <input
                ref={ref}
                type="text"
                autoComplete="off"
                enterKeyHint="go"
                spellCheck={false}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={hien}
                aria-controls={hien ? idDs : undefined}
                aria-activedescendant={hien && dangChon != null ? `${id}-ke-${dangChon}` : undefined}
                disabled={khoa}
                readOnly={ban}
                aria-busy={ban || undefined}
                aria-invalid={loi || undefined}
                value={giaTri}
                onChange={(e) => {
                  onDoi(e.target.value);
                  setTroId(null);
                  setMo(false);
                  henMo(TRE_MO_KHI_GO);
                }}
                // Chỉ mở khi người dùng bấm vào ô (không mở khi màn tự đưa tiêu điểm về ô sau mỗi thao tác)
                onClick={() => {
                  if (!hien) henMo(TRE_MO_KHI_BAM);
                }}
                onBlur={() => {
                  huyHen();
                  setMo(false);
                }}
                onKeyDown={onKeyDown}
                placeholder={goiY}
                className={cn(
                  "h-11 w-full rounded-lg border bg-white pl-11 pr-9 font-mono text-[15px] font-semibold text-bo-heading outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-slate-500 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle",
                  loi ? "border-bo-danger ring-[3px] ring-bo-danger/10" : "border-bo-input-border focus:border-bo-primary focus:ring-[3px] focus:ring-bo-primary/15",
                )}
              />
              {giaTri && !ban ? (
                <button
                  type="button"
                  aria-label={t("Xóa chữ trong ô quét")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onDoi("");
                    setTroId(null);
                    henMo(0);
                  }}
                  className="absolute right-2 grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
            {/* Màn cảm ứng: chọn kệ bằng bảng từ đáy thay vì danh sách thả */}
            {dsKe?.length ? (
              <button
                type="button"
                disabled={khoa || ban}
                onClick={() => setMoBang(true)}
                className="hidden h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#d5dce5] bg-white px-3 text-sm font-medium text-bo-foreground shadow-xs hover:bg-slate-50 disabled:opacity-50 cam-ung:inline-flex"
              >
                <List className="size-4" aria-hidden="true" />
                {t("Chọn kệ")}
              </button>
            ) : null}
          </div>
          {hien ? (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-bo-border bg-white shadow-[0_12px_32px_-12px_rgba(15,30,60,.35)]">
              {vaiTro === "dich" && can > 0 ? (
                <div className="border-b border-bo-border px-3 py-2 text-xs text-bo-muted">{t("Kệ đích cho {{so}} sản phẩm", { so: can.toLocaleString("vi-VN"), count: can })}</div>
              ) : null}
              <div id={idDs} role="listbox" aria-label={t("Gợi ý mã kệ")} className="max-h-[min(400px,55vh)] overflow-y-auto p-1.5">
                <DanhSachGoiYKe
                  kq={kq}
                  q={giaTri}
                  vaiTro={vaiTro}
                  can={can}
                  dangChon={dangChon}
                  idDong={idDong}
                  khongThay={khongThay}
                  onChon={(x) => quet(x.maViTri)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-bo-border bg-bo-surface-subtle px-3 py-2 text-[11px] text-bo-muted">
                <span>
                  <kbd className="rounded border border-bo-border bg-white px-1 font-sans">↑</kbd> <kbd className="rounded border border-bo-border bg-white px-1 font-sans">↓</kbd> {t("chọn")}
                </span>
                <span>
                  <kbd className="rounded border border-bo-border bg-white px-1 font-sans">Enter</kbd> {vaiTro === "dich" ? t("chọn kệ") : t("mở kệ")}
                </span>
                <span>
                  <kbd className="rounded border border-bo-border bg-white px-1 font-sans">Esc</kbd> {t("đóng")}
                </span>
                {kq.tong > daHien ? <span className="ml-auto">{t("Còn {{so}} kệ khác, gõ thêm để lọc.", { so: kq.tong - daHien })}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
        <p className="text-[13px] text-bo-muted sm:hidden">{t("Bước {{so}}/4 · {{ten}}", { so: Math.min(buoc + 1, 4), ten: BUOC[Math.min(buoc, 3)] })}</p>
        <ol className="hidden flex-wrap items-center gap-1 text-[13px] sm:flex" aria-label={t("Các bước chuyển kệ")}>
          {BUOC.map((b, i) => (
            <li key={b} className="flex items-center gap-1" aria-current={i === buoc ? "step" : undefined}>
              {i ? <span className="h-px w-4 bg-bo-input-border" aria-hidden="true" /> : null}
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-1",
                  i < buoc ? "text-bo-success" : i === buoc ? "bg-bo-primary-soft font-semibold text-bo-primary-strong" : "text-slate-400",
                )}
              >
                {i < buoc ? (
                  <CircleCheck className="size-4" aria-hidden="true" />
                ) : (
                  <span className={cn("grid size-4 place-items-center rounded-full border text-[10px] font-bold", i === buoc ? "border-bo-primary-strong" : "border-slate-300")}>
                    {i + 1}
                  </span>
                )}
                {b}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div role="status" aria-live="polite">
        {phanHoi ? (
          <p key={lan} className={cn("mt-2 flex items-start gap-2 text-[13px] font-medium motion-safe:animate-in motion-safe:fade-in", k.mau)}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{phanHoi.chu}</span>
          </p>
        ) : null}
      </div>
      {dsKe?.length ? <BangChonKe mo={moBang} onDoiMo={setMoBang} vaiTro={vaiTro} goiYTham={goiYTham} onChon={(ma) => quet(ma)} /> : null}
    </div>
  );
});

export default ThanhQuet;
