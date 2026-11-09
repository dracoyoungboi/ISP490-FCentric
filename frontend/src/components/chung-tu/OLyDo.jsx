import { useId } from "react";
import { GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "./kieuHopThoai.js";
import { t } from "@/i18n";

/** Lý do hủy chứng từ: bắt buộc, tối đa 500 ký tự; máy chủ nối "Lý do hủy: …" vào ghi chú của chính phiếu / đơn. */
export const LY_DO_HUY_TOI_DA = 500;

/**
 * Ô lý do bắt buộc trong hộp xác nhận (HopXacNhanChungTu): nhãn có *, ô nhiều dòng, dòng phụ "Bắt buộc · n/500".
 * Nơi gọi khóa nút xác nhận khi `!giaTri.trim()` (khoaXacNhan + lyDoKhoa) và gửi `giaTri.trim()` lên máy chủ.
 */
export default function OLyDo({
  giaTri,
  onDoi,
  nhan = t("Lý do hủy"),
  goiY = t("Ví dụ: Khách đổi ý, không lấy hàng nữa"),
  toiDa = LY_DO_HUY_TOI_DA,
  disabled = false,
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-ly-do`} className={NHAN_O}>
        {nhan} <span className="text-bo-danger">*</span>
      </label>
      <textarea
        id={`${id}-ly-do`}
        value={giaTri}
        onChange={(suKien) => onDoi(suKien.target.value.slice(0, toiDa))}
        placeholder={goiY}
        rows={3}
        maxLength={toiDa}
        aria-describedby={`${id}-goi-y`}
        aria-required="true"
        disabled={disabled}
        className={O_NHAP_NHIEU_DONG}
      />
      <p id={`${id}-goi-y`} className={GOI_Y_O}>
        <span>{t("Bắt buộc · lưu vào ghi chú của phiếu")}</span>
        <span>
          {giaTri.length}/{toiDa}
        </span>
      </p>
    </div>
  );
}
