import { useRef, useState } from "react";
import { Truck } from "lucide-react";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { GHI_CHU_HOP, GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { cn } from "@/lib/utils";

const CARRIERS = ["GHTK", "GHN", "Viettel Post", "J&T Express", "Ahamove", "Tự giao"];
const EMPTY = { donViVanChuyen: "", maVanDon: "", phiVanChuyenThucTe: "", ghiChu: "" };
const GHI_CHU_TOI_DA = 500;

/**
 * Xác nhận xuất kho & giao vận (SRS 6.3.2) — POST /api/v1/phieu-xuat-kho/{id}/xac-nhan-xuat-kho.
 * Thông tin vận chuyển không bắt buộc; backend ghi vào ghi chú phiếu xuất. Trang cha chỉ render khi mở.
 * Payload giữ nguyên: `{ donViVanChuyen, maVanDon, phiVanChuyenThucTe, ghiChu }`, chuỗi đã bỏ khoảng trắng hoặc null,
 * cước là số hoặc null. Khung, nút và tiêu điểm theo hộp dùng chung HopXacNhanChungTu (rộng 560px vì có biểu mẫu).
 * `tongSoLuong` (tùy chọn): tổng số lượng của cả phiếu, hiện trong câu mô tả.
 */
export default function DispatchDialog({ open, onOpenChange, soPhieuXuat, tongSoLuong, onConfirm }) {
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const change = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async () => {
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
  const tongSl = tongSoLuong != null ? ` (tổng số lượng ${Number(tongSoLuong).toLocaleString("vi-VN")})` : "";

  return (
    <HopXacNhanChungTu
      mo={open}
      onDoiMo={onOpenChange}
      tieuDe="Xác nhận xuất kho"
      moTa={`Phiếu ${soPhieuXuat}${tongSl} trừ tồn theo các lô đã chọn và không sửa được nữa.`}
      nhanXacNhan="Xác nhận xuất kho"
      iconXacNhan={Truck}
      dangChay={submitting}
      rong
      onXacNhan={submit}
    >
      <div className={cn(GHI_CHU_HOP, "flex items-start gap-2.5")}>
        <Truck className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
        <p>Thông tin giao vận không bắt buộc. Nếu nhập, hệ thống lưu vào ghi chú của phiếu xuất để tra cứu khi giao hàng.</p>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="dispatch-carrier" className={NHAN_O}>Đơn vị vận chuyển</label>
        <input
          id="dispatch-carrier"
          disabled={submitting}
          value={values.donViVanChuyen}
          onChange={(event) => change("donViVanChuyen", event.target.value)}
          placeholder="Ví dụ: GHTK"
          maxLength={100}
          className={O_NHAP}
        />
      </div>
      <div role="group" aria-label="Chọn nhanh đơn vị vận chuyển" className="flex flex-wrap gap-1.5">
        {CARRIERS.map((name) => {
          const dangChon = values.donViVanChuyen === name;
          return (
            <button
              key={name}
              type="button"
              disabled={submitting}
              aria-pressed={dangChon}
              onClick={() => change("donViVanChuyen", name)}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
                dangChon
                  ? "border-bo-primary bg-bo-primary-soft font-semibold text-[#0b4fb3]"
                  : "border-bo-border bg-white text-slate-700 hover:border-bo-primary/40 hover:text-bo-primary",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="dispatch-tracking" className={NHAN_O}>Mã vận đơn</label>
          <input
            id="dispatch-tracking"
            disabled={submitting}
            value={values.maVanDon}
            onChange={(event) => change("maVanDon", event.target.value)}
            placeholder="Ví dụ: GHTK-HN-8849201"
            maxLength={100}
            spellCheck={false}
            autoComplete="off"
            className={cn(O_NHAP, "font-mono placeholder:font-sans")}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="dispatch-fee" className={NHAN_O}>Cước thực tế (₫)</label>
          <input
            id="dispatch-fee"
            inputMode="numeric"
            disabled={submitting}
            value={feeDisplay}
            onChange={(event) => change("phiVanChuyenThucTe", event.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className={cn(O_NHAP, "text-right tabular-nums")}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="dispatch-note" className={NHAN_O}>Ghi chú bàn giao</label>
        <textarea
          id="dispatch-note"
          rows={3}
          disabled={submitting}
          value={values.ghiChu}
          onChange={(event) => change("ghiChu", event.target.value)}
          placeholder="Ví dụ: Đã bàn giao cho đơn vị vận chuyển lúc 15:00"
          maxLength={GHI_CHU_TOI_DA}
          aria-describedby="dispatch-note-dem"
          className={O_NHAP_NHIEU_DONG}
        />
        <span id="dispatch-note-dem" className={GOI_Y_O}>
          <span>Không bắt buộc</span>
          <span>{values.ghiChu.length}/{GHI_CHU_TOI_DA}</span>
        </span>
      </div>
    </HopXacNhanChungTu>
  );
}
