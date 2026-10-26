import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getApiErrorMessage } from "@/utils/apiError";

const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");
const ngayVN = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
};

/**
 * "In tem theo phiếu nhập": chọn một phiếu nhập đã hoàn tất (mã, ngày, kho, nhà cung cấp, số SKU, số sản phẩm) rồi
 * Tiếp tục → lấy số lượng thực nhận của phiếu và mở hộp In tem với số tem theo số lượng nhập.
 */
export default function HopChonPhieuNhap({ open, onOpenChange, onTiepTuc }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <NoiDung onHuy={() => onOpenChange(false)} onTiepTuc={onTiepTuc} /> : null}
    </Dialog>
  );
}

function NoiDung({ onHuy, onTiepTuc }) {
  const ds = useTaiDuLieu(() => phieuNhapKhoService.phieuDaHoanTatInTem({ size: 20 }), "phieu-in-tem");
  const [chonId, setChonId] = useState(null);
  const [dangLay, setDangLay] = useState(false);
  const nhomRef = useRef(null);
  // Đóng hộp (Hủy, Esc) trong lúc đang lấy số lượng thì bỏ kết quả về sau, không mở hộp In tem nữa
  const conMoRef = useRef(true);
  useEffect(() => {
    conMoRef.current = true;
    return () => {
      conMoRef.current = false;
    };
  }, []);
  const phieus = ds.data ?? [];
  const chon = phieus.find((p) => p.id === chonId) ?? phieus[0] ?? null;

  const tiepTuc = async () => {
    if (!chon || dangLay) return;
    setDangLay(true);
    try {
      const dong = await phieuNhapKhoService.soLuongInTem(chon.id);
      if (conMoRef.current) onTiepTuc({ maPhieu: chon.soPhieuNhap, dong });
    } catch (error) {
      if (conMoRef.current) toast.error(getApiErrorMessage(error, `Không lấy được số lượng của phiếu ${chon.soPhieuNhap}`));
    } finally {
      if (conMoRef.current) setDangLay(false);
    }
  };

  /** Mũi tên lên/xuống (trái/phải), Home/End chuyển phiếu như nhóm nút radio; chỉ phiếu đang chọn nhận Tab. */
  const diChuyen = (event) => {
    const buoc = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (buoc === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const viTri = Math.max(0, phieus.findIndex((p) => p.id === chon?.id));
    const moi = event.key === "Home" ? 0 : event.key === "End" ? phieus.length - 1 : (viTri + buoc + phieus.length) % phieus.length;
    setChonId(phieus[moi].id);
    nhomRef.current?.querySelectorAll("[role=radio]")[moi]?.focus();
  };

  return (
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(560px,calc(100%-2rem))]">
      <DialogHeader className="shrink-0 border-b border-bo-border px-5 py-4 pr-12 text-left">
        <DialogTitle className="text-[17px] text-bo-foreground">In tem theo phiếu nhập</DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">Số tem lấy bằng số lượng thực nhận của phiếu.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {ds.initialLoading ? (
          <LoadingState label="Đang tải phiếu nhập" className="min-h-48" />
        ) : ds.error ? (
          <ErrorState description="Không tải được danh sách phiếu nhập. Vui lòng thử lại." onRetry={ds.reload} className="min-h-48" />
        ) : !phieus.length ? (
          <EmptyState icon={FileText} title="Chưa có phiếu nhập đã hoàn tất" description="Phiếu nhập kho xác nhận nhập xong sẽ hiện ở đây để in tem." className="min-h-48" />
        ) : (
          <div ref={nhomRef} role="radiogroup" aria-label="Phiếu nhập kho đã hoàn tất" onKeyDown={diChuyen} className="flex flex-col gap-2">
            {phieus.map((p) => {
              const dangChon = chon?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={dangChon}
                  tabIndex={dangChon ? 0 : -1}
                  onClick={() => setChonId(p.id)}
                  onDoubleClick={tiepTuc}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border bg-white px-3.5 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                    dangChon ? "border-bo-primary bg-[#f3f8ff]" : "border-bo-border hover:border-slate-400",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("mt-0.5 size-4 shrink-0 rounded-full", dangChon ? "border-[5px] border-bo-primary" : "border-[1.5px] border-slate-300")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <b className="text-sm font-semibold">{p.soPhieuNhap}</b>
                      <span className="shrink-0 text-[13px] text-bo-muted">{ngayVN(p.ngayNhap)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-bo-muted">
                      {[p.tenKho, p.tenNhaCungCap, `${soVN(p.soSku)} SKU`, `${soVN(p.tongSoLuong)} sản phẩm`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t border-bo-border bg-[#fafbfc] px-5 py-3">
        <Button type="button" variant="outline" onClick={onHuy} className={NUT_PHU}>
          Hủy
        </Button>
        <Button type="button" disabled={!chon || dangLay} onClick={tiepTuc} className={NUT_CHINH}>
          {dangLay ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Tiếp tục
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
