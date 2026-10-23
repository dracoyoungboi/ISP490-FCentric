import { useId, useRef, useState } from "react";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { idKho, matHangThieu, nhanKho } from "./chonKho";

const giongId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Danh sách chọn kho theo tồn khả dụng (một lựa chọn), dùng cho "Gửi sang kho" và "Chốt thành đơn":
 * mỗi kho một ô (tên, mã kho, địa chỉ, thẻ "Đủ hàng (5/5)" / "Thiếu hàng (2/5)"), kho hiện tại của đơn có nhãn ghim.
 *
 * - `ds`: các kho đã xếp và lọc (chonKho.xepKho / locKho). `coTim`: hiện ô tìm (chonKho.coTimKho trên tổng số kho).
 * - `chonId` + `onChon(id)`: kho đang chọn.
 * - `khoaKhoThieu = false` (Gửi sang kho): kho thiếu vẫn chọn được, chọn rồi thì hiện các mặt hàng thiếu "cần · còn".
 *   `true` (Chốt thành đơn — máy chủ chặn): kho thiếu không chọn được, bấm vào thì mở / đóng danh sách mặt hàng thiếu.
 * - `khoHienTaiId`: kho hiện tại của đơn (nhãn "Kho hiện tại của đơn"); không có thì bỏ nhãn.
 */
export default function DanhSachChonKho({
  ds,
  coTim = false,
  tuKhoa = "",
  onDoiTuKhoa,
  chonId,
  onChon,
  khoHienTaiId = null,
  khoaKhoThieu = false,
  nhan = "Kho xuất",
  khoa = false,
}) {
  // Kho thiếu đang mở danh sách mặt hàng thiếu (chỉ khi khoaKhoThieu)
  const [moThieu, setMoThieu] = useState({});
  const mang = Array.isArray(ds) ? ds : [];
  const idGoc = useId();
  const nutRef = useRef([]);
  // Một điểm dừng Tab cho cả nhóm (kho đang chọn, chưa chọn thì kho đầu); mũi tên đi qua lại và chọn như nhóm radio
  const viTriChon = mang.findIndex((k) => giongId(idKho(k), chonId));
  const viTriTab = viTriChon >= 0 ? viTriChon : 0;
  const diChuyen = (suKien, i) => {
    const cuoi = mang.length - 1;
    let j = null;
    if (suKien.key === "ArrowDown" || suKien.key === "ArrowRight") j = i === cuoi ? 0 : i + 1;
    else if (suKien.key === "ArrowUp" || suKien.key === "ArrowLeft") j = i === 0 ? cuoi : i - 1;
    else if (suKien.key === "Home") j = 0;
    else if (suKien.key === "End") j = cuoi;
    if (j == null) return;
    suKien.preventDefault();
    nutRef.current[j]?.focus();
    const k = mang[j];
    if (k && !khoa && !(khoaKhoThieu && !k.duHang)) onChon?.(idKho(k));
  };

  return (
    <div className="grid gap-2">
      {coTim ? (
        <SearchInput
          value={tuKhoa}
          onChange={(suKien) => onDoiTuKhoa?.(suKien.target.value)}
          onClear={() => onDoiTuKhoa?.("")}
          placeholder="Tìm theo tên, mã hoặc địa chỉ kho"
          label="Tìm kho"
          className="sm:max-w-none"
        />
      ) : null}
      <div role="radiogroup" aria-label={nhan} className="grid max-h-80 gap-2 overflow-y-auto p-px">
        {mang.map((kho, i) => {
          const id = idKho(kho);
          const thieu = !kho.duHang;
          const tat = khoaKhoThieu && thieu;
          const chon = !tat && giongId(id, chonId);
          const moCt = thieu && (khoaKhoThieu ? Boolean(moThieu[id]) : chon);
          const ct = moCt ? matHangThieu(kho) : null;
          const idCt = `${idGoc}-thieu-${id}`;
          const bam = () => {
            if (khoa) return;
            if (tat) setMoThieu((cu) => ({ ...cu, [id]: !cu[id] }));
            else onChon?.(id);
          };
          return (
            <button
              key={id}
              ref={(el) => {
                nutRef.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={chon}
              aria-disabled={tat || khoa || undefined}
              aria-describedby={ct ? idCt : undefined}
              tabIndex={i === viTriTab ? 0 : -1}
              onClick={bam}
              onKeyDown={(suKien) => diChuyen(suKien, i)}
              className={cn(
                "grid w-full grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-lg border bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 sm:grid-cols-[18px_minmax(0,1fr)_auto]",
                tat
                  ? "cursor-pointer border-bo-border bg-bo-surface-subtle"
                  : chon
                    ? "border-bo-primary bg-bo-primary-soft/40 ring-1 ring-bo-primary"
                    : "border-bo-border hover:border-slate-300 hover:bg-bo-surface-subtle",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-[18px] place-items-center rounded-full border-[1.5px] bg-white",
                  chon ? "border-bo-primary" : tat ? "border-slate-300 bg-slate-100" : "border-slate-400",
                )}
              >
                {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
              </span>
              <span className="min-w-0">
                <span className={cn("text-sm font-semibold leading-5", tat ? "text-bo-muted" : "text-bo-foreground")}>
                  {kho.tenKho || "—"}
                </span>
                {kho.maKho ? <span className="ml-1.5 font-mono text-[11px] font-medium text-bo-muted">{kho.maKho}</span> : null}
                {giongId(id, khoHienTaiId) ? (
                  <span className="ml-1.5 inline-flex h-5 items-center rounded bg-bo-primary-soft px-1.5 align-[1px] text-[11px] font-semibold text-bo-primary">
                    Kho hiện tại của đơn
                  </span>
                ) : null}
              </span>
              <span className="col-start-2 sm:col-start-3 sm:row-start-1">
                <StatusBadge label={nhanKho(kho)} />
              </span>
              <span className="col-start-2 text-[13px] leading-5 text-bo-muted">
                {kho.diaChi || "—"}
                {tat ? " · bấm để xem mặt hàng thiếu" : null}
              </span>
              {ct ? (
                <span id={idCt} className="col-span-full mt-2 grid gap-1 rounded-md bg-bo-surface-subtle px-3 py-2 sm:col-start-2">
                  {ct.hien.map((m) => (
                    <span key={m.khoa} className="flex min-w-0 justify-between gap-3 text-[13px] leading-5">
                      <span className="min-w-0 truncate text-slate-700" title={m.ten}>{m.ten}</span>
                      <span className="shrink-0 font-medium text-bo-danger tabular-nums">{m.so}</span>
                    </span>
                  ))}
                  {ct.conLai > 0 ? (
                    <span className="text-[13px] leading-5 text-bo-muted">Còn {soVN(ct.conLai)} mặt hàng thiếu khác</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
        {mang.length === 0 && tuKhoa.trim() ? (
          <p className="py-6 text-center text-sm text-bo-muted">Không có kho nào khớp “{tuKhoa.trim()}”.</p>
        ) : null}
      </div>
    </div>
  );
}
