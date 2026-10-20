import { useState } from "react";
import { AlertCircle, FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { PHUONG_AN_MAC_DINH, PHUONG_AN_TRA_HANG, chuanHoaPhuongAn } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/formatters";

/**
 * Lập / xem / lập lại biên bản trả hàng nhà cung cấp (FO-099).
 * - dongLoi: hàng không đạt hiện tại theo lô đã khóa (máy chủ lưu) [{ tenBienThe, mauSac, kichCo, sku, maLo, lyDo, soLuong }].
 *   Máy chủ tự lấy đúng các dòng này khi phát hành, trình duyệt không gửi danh sách.
 * - bienBan: biên bản đã phát hành hoặc null. Có biên bản mà không `lapLai` thì chỉ xem dòng của biên bản.
 * - lapLai: biên bản lệch số lỗi hiện tại (xóa / khóa thêm lô lỗi sau khi lập): lập lại theo số mới, giữ số biên bản.
 * - dangTaiBienBan / loiTaiBienBan: phiếu có biên bản nhưng chưa đọc được. Hộp chờ (hoặc báo lỗi), KHÔNG mở chế độ Lập
 *   với phương án mặc định — bấm Phát hành lúc đó sẽ ghi đè phương án và ghi chú của biên bản đã lập.
 * - dangTaiLo / loiTaiLo: hàng lỗi theo lô của một số biến thể chưa đọc được, hoặc chưa khớp số lỗi của biến thể (đang
 *   tải lại sau khi máy khác khóa / xóa lô lỗi), nên `dongLoi` thiếu / thừa dòng. Chế độ Lập / lập lại báo đang tải (hoặc
 *   lỗi) và khóa nút Phát hành, không hiện bảng lệch như số kiểm đếm thật.
 */
export default function HopBienBanTraHang({
  open,
  onOpenChange,
  phieu,
  dongLoi,
  bienBan,
  dangTaiBienBan = false,
  loiTaiBienBan = false,
  dangTaiLo = false,
  loiTaiLo = false,
  lapLai = false,
  dangXuLy,
  onPhatHanh,
}) {
  let noiDung = null;
  if (open && (dangTaiBienBan || loiTaiBienBan)) {
    noiDung = <DangTai loi={loiTaiBienBan} onDong={() => onOpenChange(false)} />;
  } else if (open) {
    noiDung = (
      <NoiDung
        // Biên bản đọc xong (hoặc đổi biên bản) là nội dung mới: phương án / ghi chú lấy lại từ biên bản
        key={`${bienBan?.id ?? "moi"}:${lapLai ? "lap-lai" : "xem"}`}
        phieu={phieu}
        dongLoi={dongLoi}
        bienBan={bienBan}
        dangTaiLo={dangTaiLo}
        loiTaiLo={loiTaiLo}
        lapLai={lapLai}
        dangXuLy={dangXuLy}
        onDong={() => onOpenChange(false)}
        onPhatHanh={onPhatHanh}
      />
    );
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !dangXuLy && onOpenChange(next)}>
      {noiDung}
    </Dialog>
  );
}

const KHUNG_HOP = "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(800px,calc(100%-2rem))]";

function DangTai({ loi, onDong }) {
  return (
    <DialogContent className={KHUNG_HOP}>
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
        <DialogTitle className="text-base text-bo-foreground">Biên bản trả hàng</DialogTitle>
        <DialogDescription className="sr-only">Đang đọc biên bản trả hàng của phiếu nhập</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 px-6 py-8 text-sm text-bo-muted">
        {loi ? (
          <>
            <AlertCircle className="size-4 shrink-0 text-bo-danger" /> Không đọc được biên bản. Đóng hộp, tải lại trang rồi mở lại.
          </>
        ) : (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" /> Đang tải biên bản…
          </>
        )}
      </div>
      <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" onClick={onDong} className="min-w-28 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
          Đóng
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NoiDung({ phieu, dongLoi, bienBan, dangTaiLo, loiTaiLo, lapLai, dangXuLy, onDong, onPhatHanh }) {
  const [phuongAn, setPhuongAn] = useState(chuanHoaPhuongAn(bienBan?.phuongAn) ?? PHUONG_AN_MAC_DINH);
  const [ghiChu, setGhiChu] = useState(bienBan?.ghiChu ?? "");
  const daPhatHanh = Boolean(bienBan) && !lapLai;
  const dong = daPhatHanh ? bienBan.items ?? [] : dongLoi ?? [];
  const tong = dong.reduce((t, d) => t + Number(d.soLuong || 0), 0);
  // Lập / lập lại mà hàng lỗi theo lô chưa đọc đủ: bảng thiếu dòng, không so số và không phát hành theo bảng đó
  const thieuDong = !daPhatHanh && (dangTaiLo || loiTaiLo);

  return (
    // Đầu và chân hộp cố định, chỉ phần giữa cuộn: nút Phát hành / Đóng luôn thấy; bảng rộng chỉ cuộn ngang trong khung bảng
    <DialogContent className={KHUNG_HOP}>
      {/* pr-12: chừa chỗ nút đóng (X), tiêu đề dài không bị đè trên điện thoại */}
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
        <DialogTitle className="text-base text-bo-foreground">
          {daPhatHanh
            ? `Biên bản trả hàng ${bienBan.soBienBan}`
            : lapLai && bienBan
              ? `Lập lại biên bản trả hàng ${bienBan.soBienBan}`
              : "Lập biên bản trả hàng nhà cung cấp"}
        </DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          Phiếu nhập {phieu?.soPhieuNhap} · {phieu?.tenNhaCungCap || "—"} · {phieu?.soDonMua || "—"}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 *:shrink-0 sm:px-6">
        <div className="min-w-0 overflow-x-auto rounded-lg border border-bo-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                {["Sản phẩm", "Lô phát hiện", "Lý do lỗi"].map((t) => (
                  <th key={t} className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t}</th>
                ))}
                <th className="h-10 w-24 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {dong.map((d, i) => (
                <tr key={`${d.sku}-${d.maLo}-${d.lyDo}-${i}`}>
                  <td className="h-14 px-4 py-2">
                    <div className="font-semibold text-bo-foreground">{d.tenBienThe}</div>
                    <div className="text-xs text-bo-muted">
                      {[d.mauSac, d.kichCo].filter(Boolean).join(" · ")}
                      {d.mauSac || d.kichCo ? " · " : ""}
                      <span className="font-mono">{d.sku}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{d.maLo || "—"}</td>
                  <td className="px-4 py-2">{d.lyDo}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-bo-danger">{d.soLuong}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                <td className="h-12 px-4" colSpan={3}>Tổng cộng</td>
                <td className="px-4 text-right tabular-nums text-bo-danger">{tong}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-bo-foreground">Phương án xử lý</p>
          <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PHUONG_AN_TRA_HANG.map((pa) => {
              const chon = phuongAn === pa.ma;
              return (
                <button
                  key={pa.ma}
                  type="button"
                  role="radio"
                  aria-checked={chon}
                  disabled={daPhatHanh}
                  onClick={() => setPhuongAn(pa.ma)}
                  className={cn(
                    "grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md border bg-white p-3 text-left disabled:cursor-default",
                    chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                  )}
                >
                  <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                    {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                  </span>
                  <span className="text-sm font-medium text-bo-foreground">{pa.ten}</span>
                  <span className="col-start-2 text-xs text-bo-muted">{pa.moTa}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bien-ban-ghi-chu" className="text-sm font-medium text-bo-foreground">Ghi chú gửi nhà cung cấp</label>
          <textarea
            id="bien-ban-ghi-chu"
            rows={2}
            disabled={daPhatHanh}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="VD: Đề nghị giao bù trong đợt hàng tới"
            className="w-full resize-y rounded-md border border-bo-border bg-white px-3 py-2 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle"
          />
        </div>

        {thieuDong ? (
          <DongThongBao tone={loiTaiLo ? "bad" : "neutral"}>
            {loiTaiLo
              ? "Hàng lỗi theo lô của một số biến thể chưa đọc được hoặc vừa đổi ở máy khác nên bảng trên chưa khớp số kiểm đếm. Đóng hộp, tải lại trang rồi mở lại."
              : "Đang tải hàng lỗi theo lô…"}
          </DongThongBao>
        ) : lapLai && bienBan ? (
          <DongThongBao tone="warn">
            {Number(bienBan.tongSoLuongLoi) !== tong
              ? `Biên bản đang ghi ${bienBan.tongSoLuongLoi} sản phẩm lỗi, kiểm đếm hiện có ${tong}.`
              : "Biên bản không còn khớp các lô có hàng lỗi (có lô đã xóa hoặc khóa lại)."}{" "}
            Lập lại sẽ thay toàn bộ dòng của biên bản bằng các dòng ở trên, giữ số biên bản {bienBan.soBienBan}.
          </DongThongBao>
        ) : daPhatHanh ? (
          <DongThongBao>
            Đã phát hành{bienBan.ngayLap ? ` ngày ${formatDate(bienBan.ngayLap)}` : ""}. Hàng lỗi để ở khu cách ly chờ xử lý theo phương án trên, không cộng vào tồn kho.
          </DongThongBao>
        ) : (
          <DongThongBao>
            Phát hành xong, hàng lỗi chuyển sang khu cách ly, không cộng vào tồn kho và nút “Xác nhận nhập kho” được mở.
          </DongThongBao>
        )}
      </div>

      <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" disabled={dangXuLy} onClick={onDong} className="min-w-28 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
          {daPhatHanh ? "Đóng" : "Hủy"}
        </Button>
        {daPhatHanh ? null : (
          <Button
            disabled={dangXuLy || tong === 0 || thieuDong}
            onClick={() => onPhatHanh({ phuongAn, ghiChu: ghiChu.trim() })}
            className="min-w-28 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            {dangXuLy ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
            {lapLai && bienBan ? "Lập lại biên bản" : "Phát hành biên bản"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
