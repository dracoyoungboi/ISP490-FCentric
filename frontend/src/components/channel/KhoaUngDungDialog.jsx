import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { CacOKhoaUngDung } from "@/components/channel/KetNoiUyQuyenForm";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { noiDungSan } from "@/components/channel/noiDungSan";
import { coThayDoiKhoaUngDung, kiemTraKhoaUngDung, taoGiaTriKhoaUngDung, taoPayloadKhoaUngDung } from "@/components/channel/ketNoiKenh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";

/**
 * Hộp thoại "Cập nhật khóa ứng dụng" của sàn ủy quyền ở trang Cấu hình (PUT /{maKenh}/ket-noi/khoa, KH mục C.1).
 * Ô App Secret để trống = giữ khóa đã lưu. Trang cha chỉ gắn hộp thoại khi mở, nên mỗi lần mở là form mới.
 */
export default function KhoaUngDungDialog({ open, onOpenChange, san, ketNoi, onSaved }) {
  const coServiceId = Boolean(noiDungSan(san.maKenh)?.coServiceId);
  const [values, setValues] = useState(() => taoGiaTriKhoaUngDung(ketNoi));
  const [errors, setErrors] = useState({});
  const [loi, setLoi] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const dangLuuRef = useRef(false);

  const dong = (mo) => {
    if (dangLuuRef.current) return;
    onOpenChange(mo);
  };

  const doi = (name, value) => {
    setValues((cu) => ({ ...cu, [name]: value }));
    setErrors((cu) => ({ ...cu, [name]: undefined }));
  };

  // Chưa đổi ô nào thì "Lưu khóa" khóa lại (bấm vào mà hộp thoại đóng im lặng thì không biết đã lưu hay chưa)
  const coThayDoi = coThayDoiKhoaUngDung(values, ketNoi);

  const luu = async (event) => {
    event.preventDefault();
    if (dangLuuRef.current || !coThayDoi) return;
    const loiO = kiemTraKhoaUngDung(values, ketNoi, { coServiceId });
    setErrors(loiO);
    if (Object.keys(loiO).length) return;
    dangLuuRef.current = true;
    setDangLuu(true);
    setLoi(null);
    try {
      const dto = await kenhBanHangService.luuKhoaUngDung(san.maKenh, taoPayloadKhoaUngDung(values, { coServiceId }));
      onSaved?.(dto);
    } catch (error) {
      setValues((cu) => ({ ...cu, appSecret: "" }));
      setLoi(getApiErrorMessage(error, "Không lưu được khóa ứng dụng"));
    } finally {
      dangLuuRef.current = false;
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Cập nhật khóa ứng dụng</DialogTitle>
          <DialogDescription className="text-bo-muted">
            Khóa được mã hóa trước khi lưu và không hiển thị lại. Đổi App Key thì cần ủy quyền lại với {san.ten}.
          </DialogDescription>
        </DialogHeader>
        <form id="khoa-ung-dung-form" onSubmit={luu} noValidate className="space-y-3">
          <CacOKhoaUngDung maKenh={san.maKenh} values={values} errors={errors} onChange={doi} ketNoi={ketNoi} disabled={dangLuu} />
          {loi ? (
            <p role="alert">
              <TrangThaiCham label={`Chưa lưu được. ${loi}`} tone="danger" className="whitespace-normal" />
            </p>
          ) : null}
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={dangLuu} onClick={() => dong(false)} className={NUT_PHU}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="khoa-ung-dung-form" disabled={dangLuu || !coThayDoi} className={NUT_CHINH}>
            {dangLuu ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {dangLuu ? "Đang lưu…" : "Lưu khóa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
