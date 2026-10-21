import { createElement, useId, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHAN_HOP,
  DAU_HOP,
  HOP,
  HOP_RONG,
  MO_TA_HOP,
  NUT_CHINH,
  NUT_NGUY_HIEM,
  NUT_QUAY_LAI,
  THAN_HOP,
  TIEU_DE_HOP,
} from "./kieuHopThoai.js";

const O_DAU_TIEN = "textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled])";

/**
 * Hộp xác nhận dùng chung cho 8 màn chi tiết chứng từ (C1, rà soát 21/10/2026): tiêu đề, một câu nói đúng việc máy chủ
 * sẽ làm, phần thêm (ô lý do, khung nhắc GHI_CHU_HOP, biểu mẫu), nút "Quay lại" và nút xác nhận. Không có nút ×;
 * đóng bằng "Quay lại", Esc hoặc bấm ra ngoài — trừ lúc đang chạy (khóa cả hai nút, aria-busy).
 *
 * - `kieu`: "chinh" (xanh) | "nguyHiem" (đỏ: hủy, từ chối). `nhanXacNhan` cùng chữ với nút mở hộp.
 * - `khoaXacNhan` + `lyDoKhoa`: khóa riêng nút xác nhận (vd. chưa nhập lý do bắt buộc), lý do hiện ở chân hộp.
 * - Tiêu điểm khi mở: ô nhập đầu tiên trong phần thêm; không có ô nhập thì nút xác nhận (kiểu chính) hoặc "Quay lại"
 *   (kiểu nguy hiểm, hoặc nút xác nhận đang khóa). Đóng hộp: tiêu điểm về nút đã mở hộp.
 * - `tieuDiemQuayLai`: luôn đặt tiêu điểm vào "Quay lại" — cho màn có máy quét, vì phím Enter máy quét gửi sau mỗi mã
 *   sẽ bấm nút đang có tiêu điểm.
 * - `rong`: 560px cho hộp có biểu mẫu (mặc định 460px).
 */
export default function HopXacNhanChungTu({
  mo,
  onDoiMo,
  tieuDe,
  moTa,
  children,
  nhanXacNhan,
  iconXacNhan,
  kieu = "chinh",
  dangChay = false,
  khoaXacNhan = false,
  lyDoKhoa,
  rong = false,
  tieuDiemQuayLai = false,
  onXacNhan,
}) {
  const id = useId();
  const idLyDo = `${id}-ly-do`;
  const thanRef = useRef(null);
  const quayLaiRef = useRef(null);
  const xacNhanRef = useRef(null);
  const khoaNut = dangChay || khoaXacNhan;
  const hienLyDo = Boolean(khoaXacNhan && !dangChay && lyDoKhoa);

  const doiMo = (moMoi) => {
    if (!dangChay) onDoiMo?.(moMoi);
  };

  const tieuDiemKhiMo = (suKien) => {
    suKien.preventDefault();
    const o = thanRef.current?.querySelector(O_DAU_TIEN);
    const nut = kieu === "nguyHiem" || khoaNut || tieuDiemQuayLai ? quayLaiRef.current : xacNhanRef.current;
    (o ?? nut ?? quayLaiRef.current)?.focus();
  };

  const chanKhiDangChay = (suKien) => {
    if (dangChay) suKien.preventDefault();
  };

  return (
    <Dialog open={Boolean(mo)} onOpenChange={doiMo}>
      <DialogContent
        showCloseButton={false}
        // Không có mô tả: bỏ hẳn aria-describedby để Radix không trỏ tới phần tử không tồn tại
        {...(moTa ? {} : { "aria-describedby": undefined })}
        aria-busy={dangChay || undefined}
        onOpenAutoFocus={tieuDiemKhiMo}
        onEscapeKeyDown={chanKhiDangChay}
        onInteractOutside={chanKhiDangChay}
        className={cn(HOP, rong && HOP_RONG)}
      >
        <DialogHeader className={DAU_HOP}>
          <DialogTitle className={TIEU_DE_HOP}>{tieuDe}</DialogTitle>
          {moTa ? <DialogDescription className={MO_TA_HOP}>{moTa}</DialogDescription> : null}
        </DialogHeader>
        {children ? (
          <div ref={thanRef} className={THAN_HOP}>
            {children}
          </div>
        ) : null}
        <div className={CHAN_HOP}>
          {hienLyDo ? (
            <span id={idLyDo} className="mr-auto text-xs leading-4 text-bo-muted max-sm:w-full">
              {lyDoKhoa}
            </span>
          ) : null}
          <Button
            ref={quayLaiRef}
            type="button"
            variant="outline"
            disabled={dangChay}
            onClick={() => doiMo(false)}
            className={NUT_QUAY_LAI}
          >
            Quay lại
          </Button>
          <Button
            ref={xacNhanRef}
            type="button"
            disabled={khoaNut}
            aria-busy={dangChay || undefined}
            aria-describedby={hienLyDo ? idLyDo : undefined}
            onClick={onXacNhan}
            className={kieu === "nguyHiem" ? NUT_NGUY_HIEM : NUT_CHINH}
          >
            {dangChay ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : iconXacNhan ? (
              createElement(iconXacNhan, { className: "size-4", "aria-hidden": true })
            ) : null}
            {nhanXacNhan}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
