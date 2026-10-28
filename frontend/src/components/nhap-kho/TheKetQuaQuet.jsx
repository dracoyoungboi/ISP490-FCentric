import { AlertCircle, Check, HelpCircle, Minus, Plus, ScanLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHE_DO_XAC_NHAN } from "@/pages/receipt/kiemDem";

// Bấm nút trên thẻ không lấy con trỏ khỏi ô quét: lần quét sau vẫn rơi đúng vào ô quét.
const giuConTro = (e) => e.preventDefault();

const NUT = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-bo-border bg-white px-3 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50";

function BuocSo({ nhan, giaTri, onGiam, onTang, khoaGiam, khoaTang, disabled }) {
  return (
    <span className="inline-grid h-[34px] shrink-0 grid-cols-[34px_48px_34px] overflow-hidden rounded-md border border-slate-300">
      <button type="button" aria-label={`Bớt 1 ${nhan}`} onMouseDown={giuConTro} onClick={onGiam} disabled={disabled || khoaGiam}
        className="grid place-items-center bg-bo-surface-subtle text-slate-600 hover:bg-slate-100 disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <output className="grid place-items-center border-x border-slate-300 text-[15px] font-semibold tabular-nums" aria-label={nhan}>{giaTri}</output>
      <button type="button" aria-label={`Thêm 1 ${nhan}`} onMouseDown={giuConTro} onClick={onTang} disabled={disabled || khoaTang}
        className="grid place-items-center bg-bo-surface-subtle text-slate-600 hover:bg-slate-100 disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </span>
  );
}

/**
 * Thẻ kết quả ở đáy vùng nội dung sau mỗi lần quét đúng biến thể. Không làm tối nền, không chặn, không lấy con trỏ:
 * quét sản phẩm kế tiếp là lượt này giữ Đạt. Sản phẩm lỗi: quét thẻ KHÔNG ĐẠT rồi mã lý do (hoặc bấm trên thẻ).
 *
 * Thẻ "dính" ở đáy màn (sticky) nhưng vẫn nằm trong luồng trang, căn giữa vùng nội dung (không bị sidebar che);
 * cuộn hết trang thì thẻ nằm dưới cùng nên không che mất nội dung nào. Màn thấp (máy quét cầm tay): thẻ không cao quá
 * phần màn dưới ô quét (phần thừa cuộn trong thẻ), nút lý do thấp hơn — ô quét luôn thấy được phía trên thẻ.
 * `thongBao` (lỗi / cảnh báo của lần quét vừa rồi) hiện ngay trên thẻ: thẻ nằm đúng chỗ mắt người kiểm đang nhìn,
 * và không để thẻ của lượt cũ làm người kiểm tưởng mã vừa quét đã được tính.
 */
export default function TheKetQuaQuet({
  ref,
  luot,
  thongBao,
  cheDo,
  conLai,
  lyDoDs,
  khoa,
  onDat,
  onKhongDat,
  onLyDo,
  onSoLuong,
  onSoLoi,
  onHoanTac,
  onAn,
}) {
  if (!luot) return null;
  const laLoi = luot.kq === "loi";
  const laCho = luot.kq === "cho";
  const tieuDe = laCho
    ? `Chọn kết quả · ${luot.sl} cái`
    : laLoi
      ? `Không đạt ${luot.loi}${luot.lyDo ? ` · ${luot.lyDo}` : ""}${luot.sl > luot.loi ? ` · Đạt ${luot.sl - luot.loi}` : ""}`
      : `Đạt +${luot.sl}`;
  const huongDan = laCho
    ? "Quét thẻ ĐẠT hoặc KHÔNG ĐẠT trên bàn kiểm. Chọn xong mới quét tiếp được."
    : laLoi
      ? luot.lyDo
        ? "Quét sản phẩm tiếp theo để tiếp tục."
        : `Quét mã lý do (1–${lyDoDs.length}) trên thẻ lệnh hoặc bấm chọn. Chọn xong mới quét tiếp được.`
      : cheDo === CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI
        ? "Quét sản phẩm tiếp theo."
        : "Quét sản phẩm tiếp theo: lượt này giữ Đạt. Sản phẩm lỗi thì quét thẻ KHÔNG ĐẠT.";
  const mau = laLoi ? "loi" : laCho ? "cho" : "dat";

  const laThongBaoLoi = thongBao?.tone === "bad";

  return (
    <section
      ref={ref}
      aria-label="Kết quả lượt quét"
      onMouseDown={giuConTro}
      className={cn(
        "sticky bottom-3 z-30 mx-auto mt-auto max-h-[calc(100dvh-9rem)] w-full max-w-[600px] overflow-y-auto rounded-[10px] border border-t-4 border-bo-border bg-bo-surface shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35),0_2px_6px_rgba(15,23,42,0.08)] sm:bottom-5",
        mau === "loi" ? "border-t-red-600" : mau === "cho" ? "border-t-amber-600" : "border-t-green-700",
      )}
    >
      {thongBao ? (
        <p
          role="alert"
          className={cn(
            "flex items-start gap-2 border-b px-4 py-2 text-[13px] font-medium leading-5",
            laThongBaoLoi ? "border-red-100 bg-bo-danger-soft text-red-800" : "border-amber-100 bg-amber-50 text-amber-900",
          )}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{thongBao.chu}</span>
        </p>
      ) : null}
      <div className="flex items-start gap-3 px-4 pb-2.5 pt-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-white sm:size-10", mau === "loi" ? "bg-red-600" : mau === "cho" ? "bg-amber-600" : "bg-green-700")}>
          {mau === "loi" ? <X className="size-5" /> : mau === "cho" ? <HelpCircle className="size-5" /> : <Check className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className={cn("text-lg font-bold leading-7 tracking-[-0.01em] sm:text-xl", mau === "loi" ? "text-bo-danger-strong" : mau === "cho" ? "text-orange-800" : "text-green-700")}>{tieuDe}</p>
          <p className="truncate text-[12.5px] leading-[18px] text-bo-muted">
            <span className="font-mono">{luot.ma}</span> · {luot.nguon} · {luot.gio}
          </p>
        </div>
        <button type="button" aria-label="Ẩn thẻ kết quả" onMouseDown={giuConTro} onClick={onAn} className="grid size-8 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-slate-100">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-3">
        {laCho ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onMouseDown={giuConTro} onClick={onDat} disabled={khoa}
              className="flex h-14 items-center justify-center gap-2 rounded-lg border-[1.5px] border-green-700 bg-green-700 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-50">
              <Check className="size-5" /> Đạt
            </button>
            <button type="button" onMouseDown={giuConTro} onClick={onKhongDat} disabled={khoa}
              className="flex h-14 items-center justify-center gap-2 rounded-lg border-[1.5px] border-red-300 bg-bo-surface text-base font-semibold text-bo-danger-strong hover:bg-bo-danger-soft disabled:opacity-50">
              <X className="size-5" /> Không đạt
            </button>
          </div>
        ) : null}

        {laLoi ? (
          <div role="radiogroup" aria-label="Lý do không đạt" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {lyDoDs.map((ten, i) => {
              const chon = luot.lyDo === ten;
              return (
                <button key={ten} type="button" role="radio" aria-checked={chon} onMouseDown={giuConTro} onClick={() => onLyDo(ten)} disabled={khoa}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-md border bg-bo-surface px-2.5 py-1 text-left text-[13.5px] leading-[18px] text-bo-heading disabled:opacity-50 sm:min-h-10 sm:py-1.5 [@media(max-height:700px)]:min-h-8 [@media(max-height:700px)]:py-0.5",
                    chon ? "border-bo-primary bg-[#f5f9ff] shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                  )}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded text-xs font-semibold", chon ? "bg-bo-primary text-white" : "bg-slate-100 text-slate-600")}>{i + 1}</span>
                  {ten}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="text-xs font-medium text-bo-muted">Số lượng</span>
            <BuocSo nhan="số lượng" giaTri={luot.sl} disabled={khoa} khoaGiam={luot.sl <= 1} khoaTang={conLai <= 0}
              onGiam={() => onSoLuong(-1)} onTang={() => onSoLuong(+1)} />
          </span>
          {laLoi && luot.sl > 1 ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs font-medium text-bo-muted">Trong đó không đạt</span>
              <BuocSo nhan="không đạt" giaTri={luot.loi} disabled={khoa} khoaGiam={luot.loi <= 1} khoaTang={luot.loi >= luot.sl}
                onGiam={() => onSoLoi(-1)} onTang={() => onSoLoi(+1)} />
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-1.5">
            {luot.kq === "dat" ? (
              <button type="button" className={NUT} onMouseDown={giuConTro} onClick={onKhongDat} disabled={khoa}>Đổi thành Không đạt</button>
            ) : null}
            {laLoi ? (
              <button type="button" className={NUT} onMouseDown={giuConTro} onClick={onDat} disabled={khoa}>Đổi lại Đạt</button>
            ) : null}
            <button type="button" className={NUT} onMouseDown={giuConTro} onClick={onHoanTac} disabled={khoa}>Hoàn tác</button>
          </div>
        </div>
      </div>

      {/* Màn hẹp (máy quét cầm tay): lượt Đạt không cần hướng dẫn, bớt chiều cao để thẻ không che ô quét.
          Đang có câu báo ở đầu thẻ thì không lặp hướng dẫn (câu báo đã nói phải làm gì). */}
      <div className={cn("items-start gap-2 rounded-b-[10px] border-t border-slate-100 bg-bo-surface-subtle px-4 py-2.5 text-[13px] leading-5 text-slate-700", thongBao ? "hidden" : mau === "dat" ? "hidden sm:flex" : "flex")}>
        <ScanLine className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
        <span>{huongDan}</span>
      </div>
    </section>
  );
}
