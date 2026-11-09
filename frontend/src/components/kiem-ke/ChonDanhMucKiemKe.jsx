import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { cn } from "@/lib/utils";
import { ngayNgan } from "./phamViKiemKe";
import { t } from "@/i18n";

const chuan = (s) => boDau(String(s ?? "")).toLowerCase();
// Cây nhỏ thì mở hết sẵn; lớn hơn thì chỉ mở nhánh đang chọn
const MO_SAN_TOI_DA = 30;
// Bề rộng một cấp thụt lề (cột đường dóng)
const CAP = 22;
// Cột số liệu ở khối rộng
const COT = "@xl/bangdm:grid-cols-[minmax(0,1fr)_96px_112px_120px]";

/**
 * Danh sách phẳng có độ sâu (phangCay: `{ id, ten, ma, sau, soCon }` theo thứ tự cây) → nút có tổ tiên, cha, con cháu,
 * cờ nút cuối trong nhóm anh em và các cột tổ tiên còn kéo vạch dọc (để vẽ đường dóng ├ └ │).
 */
function dungCay(ds) {
  const chuoi = [];
  const nut = ds.map((x) => {
    chuoi.length = x.sau;
    const n = { ...x, toTien: chuoi.map((c) => c.id), duongDan: chuoi.map((c) => c.ten), chaId: chuoi[x.sau - 1]?.id ?? null };
    chuoi[x.sau] = x;
    return n;
  });
  const conChau = new Map(nut.map((n) => [n.id, []]));
  nut.forEach((n) => n.toTien.forEach((tt) => conChau.get(tt)?.push(n.id)));
  // Duyệt ngược một lượt: nút cuối trong nhóm anh em = chưa gặp anh em cùng cha phía sau
  const daGapCha = new Set();
  for (let i = nut.length - 1; i >= 0; i -= 1) {
    const khoa = `${nut[i].chaId}`;
    nut[i].cuoi = !daGapCha.has(khoa);
    daGapCha.add(khoa);
  }
  const theoId = new Map(nut.map((n) => [n.id, n]));
  // Cột tổ tiên i còn kéo vạch xuống dòng này khi tổ tiên kế dưới (toTien[i+1]) chưa phải nút cuối trong nhóm của nó
  nut.forEach((n) => {
    n.vach = n.toTien.slice(1).map((tt) => !theoId.get(tt).cuoi);
  });
  return { nut, conChau };
}

/** Các cột đường dóng của một dòng (vạch cao hết dòng, kể cả khi số liệu xuống dòng thứ hai trên khối hẹp). */
function DuongDong({ n }) {
  return n.toTien.map((tt, i) => {
    const sat = i === n.toTien.length - 1;
    const keoXuong = sat ? !n.cuoi : n.vach[i] ?? false;
    return (
      <span key={tt} aria-hidden="true" className="relative shrink-0 self-stretch" style={{ width: CAP }}>
        {sat || keoXuong ? (
          <span className={cn("absolute left-[11px] w-px bg-slate-300", sat && !keoXuong ? "top-0 h-5" : "inset-y-0")} />
        ) : null}
        {sat ? <span className="absolute left-[11px] top-5 h-px w-[9px] bg-slate-300" /> : null}
      </span>
    );
  });
}

/**
 * Chọn danh mục cho đợt kiểm kê theo danh mục, dạng bảng cây: mỗi dòng một danh mục (mọi cấp, có đường dóng), số kệ có
 * hàng, số sản phẩm trên sổ kệ (gộp cả cây con — API danh-muc-tren-ke), lần kiểm gần nhất. Chọn một dòng là gồm mọi cấp
 * dưới nó (dòng con tô dấu tích nhạt). Ô tìm lọc theo tên / mã không dấu, hiện kèm các cấp cha (không vẽ đường dóng).
 *
 * - `ds`: danh sách phẳng của phangCay. `chon`: id đang chọn. `onChon(id)`: chọn một (phạm vi luôn cần một danh mục, nên
 *   không có "Bỏ chọn" — bấm dòng khác là đổi). `khoa`: chỉ xem.
 * - `tenChonNgoaiCay`: tên danh mục đang chọn khi nó không còn trong cây (nháp cũ, danh mục đã tắt).
 * - `soLieu`: `Map(id → { soKe, soLuong })` | null; `trangThaiSoLieu`: "dang" | "loi" | "xong"; `onThuLaiSoLieu`.
 * - `lanKiem`: `Map(id → Date)` lần duyệt gần nhất (null: chưa tải được → "—").
 * - `tuKhoa`, `onDoiTuKhoa`: ô tìm (màn giữ giá trị).
 */
export default function ChonDanhMucKiemKe({
  ds,
  chon,
  onChon,
  khoa = false,
  tuKhoa,
  onDoiTuKhoa,
  tenChonNgoaiCay,
  soLieu,
  trangThaiSoLieu = "xong",
  onThuLaiSoLieu,
  lanKiem,
}) {
  const { nut, conChau } = useMemo(() => dungCay(ds), [ds]);
  const coCon = useMemo(() => nut.filter((n) => n.soCon > 0).map((n) => n.id), [nut]);
  const sauNhat = nut.reduce((m, n) => Math.max(m, n.sau + 1), 0);
  const nutChon = nut.find((n) => n.id === chon) ?? null;

  // Mở sẵn: cây nhỏ mở hết; cây lớn mở các tổ tiên của dòng đang chọn
  const [moRong, setMoRong] = useState(() => new Set(nut.length <= MO_SAN_TOI_DA ? coCon : nutChon ? nutChon.toTien : []));
  const daMoHet = coCon.length > 0 && coCon.every((id) => moRong.has(id));
  const doiMo = (id) =>
    setMoRong((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });

  const tu = chuan(tuKhoa.trim());
  const hien = useMemo(() => {
    if (!tu) return nut.filter((n) => n.toTien.every((tt) => moRong.has(tt)));
    // Tìm: dòng khớp + mọi cấp cha của nó (để biết nằm ở đâu)
    const khop = new Set();
    nut.forEach((n) => {
      if (chuan(`${n.ten} ${n.ma ?? ""}`).includes(tu)) {
        khop.add(n.id);
        n.toTien.forEach((tt) => khop.add(tt));
      }
    });
    return nut.filter((n) => khop.has(n.id));
  }, [nut, moRong, tu]);
  const khongKhop = Boolean(tu) && hien.length === 0;

  const oSo = (n, truong) => {
    if (trangThaiSoLieu === "dang") return <span className="text-bo-muted">…</span>;
    if (trangThaiSoLieu === "loi" || !soLieu) return <span className="text-bo-muted">—</span>;
    const x = soLieu.get(n.id);
    return x ? soVN(x[truong]) : <span className="text-slate-400">0</span>;
  };
  const oKiem = (n) => {
    if (!lanKiem) return <span className="text-bo-muted">—</span>;
    const luc = lanKiem.get(n.id);
    if (luc) return <span className="text-slate-600">{t("Kiểm {{luc}}", { luc: ngayNgan(luc) })}</span>;
    // Danh mục không có hàng trên kệ: "Chưa kiểm" chữ xám (không cần nhắc), có hàng thì chữ cam
    const trong = trangThaiSoLieu === "xong" && soLieu && !soLieu.get(n.id)?.soKe;
    return <span className={trong ? "text-bo-muted" : "font-medium text-bo-warning"}>{t("Chưa kiểm")}</span>;
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="relative flex w-full max-w-xs items-center">
          <span className="sr-only">{t("Tìm danh mục")}</span>
          <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
          <input value={tuKhoa} onChange={(e) => onDoiTuKhoa(e.target.value)} placeholder={t("Tìm danh mục")} className={cn(O_NHAP, "pl-8 pr-8")} />
          {tuKhoa ? (
            <button
              type="button"
              aria-label={t("Xóa tìm kiếm")}
              onClick={() => onDoiTuKhoa("")}
              className="absolute right-1.5 grid size-6 place-items-center rounded text-bo-muted hover:bg-slate-100 hover:text-bo-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </label>
        {chon != null ? (
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-[13px] leading-5 text-bo-foreground">
            <span className="text-bo-muted">{t("Đã chọn")}</span>
            <b className="font-semibold">{nutChon ? [...nutChon.duongDan, nutChon.ten].join(" › ") : tenChonNgoaiCay || `#${chon}`}</b>
            <span className={nutChon ? "text-bo-muted" : "font-medium text-bo-warning"}>
              {!nutChon
                ? t("· không còn trong danh mục hàng hóa, chọn lại")
                : conChau.get(nutChon.id)?.length
                  ? t("· gồm {{soCon}} danh mục con", { count: conChau.get(nutChon.id).length, soCon: soVN(conChau.get(nutChon.id).length) })
                  : t("· không có danh mục con")}
            </span>
          </p>
        ) : (
          <p className="min-w-0 flex-1 text-[13px] text-bo-muted">{t("Chọn một danh mục; mọi danh mục con của nó cũng được kiểm.")}</p>
        )}
        {!tu && coCon.length ? (
          // Một nút bật / tắt: đang mở hết thì thu gọn tất cả, còn lại thì mở tất cả
          <button
            type="button"
            onClick={() => setMoRong(daMoHet ? new Set() : new Set(coCon))}
            title={t("Cây {{sauNhat}} cấp", { count: sauNhat, sauNhat: soVN(sauNhat) })}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold text-bo-primary hover:bg-bo-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            {daMoHet ? <ChevronsDownUp className="size-4" aria-hidden="true" /> : <ChevronsUpDown className="size-4" aria-hidden="true" />}
            {daMoHet ? t("Thu gọn tất cả") : t("Mở tất cả")}
          </button>
        ) : null}
      </div>

      <div className="@container/bangdm overflow-hidden rounded-lg border border-bo-border bg-bo-surface">
        <div
          aria-hidden="true"
          className={cn("hidden border-b border-bo-border bg-bo-surface-subtle px-4 py-2.5 text-xs font-medium leading-4 text-bo-muted @xl/bangdm:grid @xl/bangdm:gap-3", COT)}
        >
          <span>{t("Danh mục")}</span>
          <span className="text-right">{t("Kệ có hàng")}</span>
          <span className="text-right">{t("Trên sổ kệ")}</span>
          <span>{t("Kiểm gần nhất")}</span>
        </div>
        {khongKhop ? (
          <p className="px-4 py-4 text-[13px] text-bo-muted">{t("Không có danh mục nào khớp “{{tuKhoa}}”.", { tuKhoa: tuKhoa.trim() })}</p>
        ) : (
          <div role="radiogroup" aria-label={t("Danh mục kiểm kê")} className="divide-y divide-slate-100">
            {hien.map((n) => {
              const chonNay = chon === n.id;
              const daGom = !chonNay && chon != null && n.toTien.includes(chon);
              const mo = tu ? true : moRong.has(n.id);
              const laCha = n.soCon > 0;
              const so = (truong, donVi) => (
                <>
                  {oSo(n, truong)}
                  <span className="@xl/bangdm:hidden"> {donVi}</span>
                </>
              );
              return (
                <div
                  key={n.id}
                  className={cn(
                    "grid items-stretch gap-x-3 px-4",
                    COT,
                    chonNay ? "bg-bo-primary-soft" : daGom ? "bg-bo-primary-soft/40" : "hover:bg-bo-surface-subtle",
                  )}
                >
                  <div className="flex min-w-0 items-stretch">
                    {/* Đường dóng cao hết dòng; đang tìm thì không vẽ (dòng đã lọc, nhánh không liền) */}
                    {tu ? <span className="shrink-0" style={{ width: n.toTien.length * CAP }} aria-hidden="true" /> : <DuongDong n={n} />}
                    <div className="grid min-w-0 flex-1 content-center">
                      <div className="flex min-w-0 items-center">
                        {laCha && !tu ? (
                          <button
                            type="button"
                            onClick={() => doiMo(n.id)}
                            aria-expanded={mo}
                            aria-label={mo ? t("Thu {{ten}}", { ten: n.ten }) : t("Mở {{ten}}", { ten: n.ten })}
                            className="grid size-6 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                          >
                            {mo ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                          </button>
                        ) : (
                          <span className="w-6 shrink-0" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={chonNay}
                          disabled={khoa}
                          onClick={() => onChon(n.id)}
                          title={daGom ? t("Đã gồm trong danh mục đang chọn") : undefined}
                          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded pl-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-[18px] shrink-0 place-items-center rounded-full border-2",
                              chonNay
                                ? "border-bo-primary bg-bo-primary text-white"
                                : daGom
                                  ? "border-bo-primary/40 bg-bo-primary-soft text-bo-primary"
                                  : "border-slate-300 bg-white",
                            )}
                          >
                            {chonNay || daGom ? <Check className="size-3" strokeWidth={3} /> : null}
                          </span>
                          <span
                            className={cn(
                              "min-w-0 truncate",
                              n.sau === 0 && "font-semibold",
                              chonNay ? "font-semibold text-bo-primary-strong" : "text-bo-foreground",
                            )}
                          >
                            {n.ten}
                          </span>
                          {laCha ? <span className="shrink-0 text-xs text-bo-muted tabular-nums">{t("{{soCon}} con", { count: conChau.get(n.id).length, soCon: soVN(conChau.get(n.id).length) })}</span> : null}
                        </button>
                      </div>
                      {/* Khối hẹp: số liệu là dòng thứ hai trong cùng ô (đường dóng vẫn liền), thẳng lề tên */}
                      <span className="flex flex-wrap gap-x-3 pb-2 pl-[54px] text-xs leading-4 tabular-nums text-bo-muted @xl/bangdm:hidden">
                        <span>{so("soKe", t("kệ"))}</span>
                        <span>{so("soLuong", t("sp"))}</span>
                        <span>{oKiem(n)}</span>
                      </span>
                    </div>
                  </div>
                  <span className={cn("hidden self-center text-right text-sm tabular-nums text-bo-foreground @xl/bangdm:block", laCha && "font-semibold")}>
                    {oSo(n, "soKe")}
                  </span>
                  <span className={cn("hidden self-center text-right text-sm tabular-nums text-bo-foreground @xl/bangdm:block", laCha && "font-semibold")}>
                    {oSo(n, "soLuong")}
                    {laCha ? <span className="ml-1 text-[11px] font-normal text-bo-muted">{t("tổng")}</span> : null}
                  </span>
                  <span className="hidden self-center text-[13px] @xl/bangdm:block">{oKiem(n)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {trangThaiSoLieu === "loi" ? (
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-bo-muted">
          {t("Chưa tải được số kệ và sản phẩm theo danh mục; vẫn chọn được, phần Xem trước vẫn tính đúng.")}
          {onThuLaiSoLieu ? (
            <NutChu onClick={onThuLaiSoLieu} className="text-xs">
              {t("Thử lại")}
            </NutChu>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
