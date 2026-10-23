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
  LOI_HOP,
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
 *   (kiểu nguy hiểm, hoặc nút xác nhận đang khóa). Đóng hộp: tiêu điểm về phần tử đã mở hộp; mở từ mục menu ⋯ (mục bị
 *   gỡ khi menu đóng) thì về nút ⋯.
 * - `tieuDiemQuayLai`: luôn đặt tiêu điểm vào "Quay lại" — cho màn có máy quét, vì phím Enter máy quét gửi sau mỗi mã
 *   sẽ bấm nút đang có tiêu điểm.
 * - `traTieuDiemVe` (ref): đóng hộp thì đưa tiêu điểm về phần tử này thay cho phần tử đã mở hộp (vd. ô quét mã, để mã
 *   quét tiếp không rơi vào nút vừa mở hộp).
 * - `rong`: 560px cho hộp có biểu mẫu (mặc định 460px).
 * - `loi` (chuỗi | null | undefined): câu lỗi của lần xác nhận vừa rồi (vd. máy chủ từ chối), vẽ NGAY TRONG hộp, ngay
 *   trên chân hộp, trong vùng role="alert" để trình đọc màn hình đọc (toast ngoài hộp bị Radix ẩn khỏi cây trợ năng).
 *   Không có thì hộp như cũ. Nơi gọi tự xóa `loi` khi người dùng sửa / bấm xác nhận lại / đóng hộp.
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
  traTieuDiemVe,
  loi,
  onXacNhan,
}) {
  const id = useId();
  const idLyDo = `${id}-ly-do`;
  const thanRef = useRef(null);
  const quayLaiRef = useRef(null);
  const xacNhanRef = useRef(null);
  // Phần tử có tiêu điểm lúc mở hộp và nút mở menu chứa nó (nếu mở từ mục menu ⋯): để trả tiêu điểm khi đóng hộp
  const moTuRef = useRef(null);
  const nutMenuRef = useRef(null);
  const khoaNut = dangChay || khoaXacNhan;
  const hienLyDo = Boolean(khoaXacNhan && !dangChay && lyDoKhoa);

  const doiMo = (moMoi) => {
    if (!dangChay) onDoiMo?.(moMoi);
  };

  const tieuDiemKhiMo = (suKien) => {
    suKien.preventDefault();
    const truoc = document.activeElement;
    moTuRef.current = truoc && truoc !== document.body ? truoc : null;
    // Mục menu Radix nằm trong [role=menu] có aria-labelledby = id nút mở menu (nút ⋯ của DauChungTu)
    const idNutMenu = truoc?.closest?.('[role="menu"]')?.getAttribute("aria-labelledby");
    nutMenuRef.current = idNutMenu ? document.getElementById(idNutMenu) : null;
    const o = thanRef.current?.querySelector(O_DAU_TIEN);
    const nut = kieu === "nguyHiem" || khoaNut || tieuDiemQuayLai ? quayLaiRef.current : xacNhanRef.current;
    (o ?? nut ?? quayLaiRef.current)?.focus();
  };

  // Hộp mở bằng state (không có DialogTrigger) nên Radix không tự trả tiêu điểm khi đóng (rơi về body): trả về phần tử
  // đã mở hộp nếu còn trong trang và bấm được; mở từ mục menu ⋯ (mục đã bị gỡ khi menu đóng) thì về nút ⋯.
  const tieuDiemKhiDong = (suKien) => {
    suKien.preventDefault();
    // Hộp vẫn mở và khung hộp còn trong trang (StrictMode khi phát triển gắn → gỡ → gắn lại FocusScope, lần gỡ giả cũng
    // bắn sự kiện này): bỏ qua, giữ phần tử đã nhớ cho lần đóng thật. Hộp bị gỡ hẳn khi `mo` vẫn true (nơi gọi chỉ vẽ hộp
    // lúc mở, vd. DispatchDialog) thì khung đã rời trang trước khi sự kiện tới (Radix bắn trong setTimeout) → vẫn trả tiêu điểm.
    if (mo && suKien.target?.isConnected) return;
    const dich = [traTieuDiemVe?.current, moTuRef.current, nutMenuRef.current].find((el) => el?.isConnected && !el.disabled);
    moTuRef.current = null;
    nutMenuRef.current = null;
    dich?.focus();
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
        onCloseAutoFocus={tieuDiemKhiDong}
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
        {/* Vùng báo lỗi luôn có trong hộp (rỗng thì không chiếm chỗ) để câu lỗi mới được đọc ngay khi hiện */}
        <div role="alert" className={loi ? LOI_HOP : undefined}>
          {loi || null}
        </div>
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
