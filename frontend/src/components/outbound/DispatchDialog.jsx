import { useRef, useState } from "react";
import { Check, Loader2, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";
const labelClass = "mb-1.5 block text-sm font-medium text-bo-foreground";

const CARRIERS = ["GHTK", "GHN", "Viettel Post", "J&T Express", "Ahamove", "Tự giao"];
const EMPTY = { donViVanChuyen: "", maVanDon: "", phiVanChuyenThucTe: "", ghiChu: "" };

/**
 * Xác nhận xuất kho & giao vận (SRS 6.3.2) — POST /api/v1/phieu-xuat-kho/{id}/xac-nhan-xuat-kho.
 * Thông tin vận chuyển không bắt buộc; backend ghi vào ghi chú phiếu xuất. Trang cha chỉ render khi mở.
 */
export default function DispatchDialog({ open, onOpenChange, soPhieuXuat, onConfirm }) {
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const change = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const fee = values.phiVanChuyenThucTe.replace(/[^\d]/g, "");
      await onConfirm({
        donViVanChuyen: values.donViVanChuyen.trim() || null,
        maVanDon: values.maVanDon.trim() || null,
        phiVanChuyenThucTe: fee ? Number(fee) : null,
        ghiChu: values.ghiChu.trim() || null,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const feeDisplay = values.phiVanChuyenThucTe
    ? Number(values.phiVanChuyenThucTe.replace(/[^\d]/g, "") || 0).toLocaleString("vi-VN")
    : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Xác nhận xuất kho</DialogTitle>
          <DialogDescription className="text-slate-600">
            Phiếu {soPhieuXuat} sẽ trừ tồn theo các lô đã chọn và không chỉnh sửa được nữa.
          </DialogDescription>
        </DialogHeader>

        <form id="dispatch-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex items-start gap-2 rounded-lg border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-xs leading-5 text-slate-700">
            <Truck className="mt-0.5 size-4 shrink-0 text-bo-muted" />
            <p>Thông tin giao vận không bắt buộc. Nếu nhập, hệ thống lưu vào ghi chú của phiếu xuất để tra cứu khi giao hàng.</p>
          </div>

          <div>
            <label htmlFor="dispatch-carrier" className={labelClass}>Đơn vị vận chuyển</label>
            <input
              id="dispatch-carrier"
              autoFocus
              disabled={submitting}
              value={values.donViVanChuyen}
              onChange={(event) => change("donViVanChuyen", event.target.value)}
              placeholder="Ví dụ: GHTK"
              maxLength={100}
              className={inputClass}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CARRIERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={submitting}
                  onClick={() => change("donViVanChuyen", name)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                    values.donViVanChuyen === name
                      ? "border-bo-primary bg-bo-primary-soft text-bo-primary"
                      : "border-bo-border bg-white text-slate-600 hover:border-bo-primary/40 hover:text-bo-primary",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dispatch-tracking" className={labelClass}>Mã vận đơn</label>
              <input
                id="dispatch-tracking"
                disabled={submitting}
                value={values.maVanDon}
                onChange={(event) => change("maVanDon", event.target.value)}
                placeholder="Ví dụ: GHTK-HN-8849201"
                maxLength={100}
                spellCheck={false}
                autoComplete="off"
                className={cn(inputClass, "font-mono placeholder:font-sans")}
              />
            </div>
            <div>
              <label htmlFor="dispatch-fee" className={labelClass}>Cước thực tế (đ)</label>
              <input
                id="dispatch-fee"
                inputMode="numeric"
                disabled={submitting}
                value={feeDisplay}
                onChange={(event) => change("phiVanChuyenThucTe", event.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className={cn(inputClass, "text-right")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="dispatch-note" className={labelClass}>Ghi chú bàn giao</label>
            <textarea
              id="dispatch-note"
              rows={3}
              disabled={submitting}
              value={values.ghiChu}
              onChange={(event) => change("ghiChu", event.target.value)}
              placeholder="Ví dụ: Đã bàn giao cho shipper lúc 15:00"
              maxLength={500}
              className="w-full resize-none rounded-lg border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle"
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-lg border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="dispatch-form"
            disabled={submitting}
            className="h-10 min-w-[168px] gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {submitting ? "Đang xuất kho…" : "Xác nhận xuất kho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
