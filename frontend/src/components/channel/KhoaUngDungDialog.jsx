import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { CacOKhoaUngDung } from "@/components/channel/KetNoiUyQuyenForm";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { INPUT_CLASS } from "@/components/channel/SettingsCard";
import { noiDungSan } from "@/components/channel/noiDungSan";
import { coThayDoiKhoaUngDung, kiemTraKhoaUngDung, taoGiaTriKhoaUngDung, taoPayloadKhoaUngDung } from "@/components/channel/ketNoiKenh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Hộp thoại "Cập nhật khóa ứng dụng" của sàn ủy quyền ở trang Cấu hình (PUT /{maKenh}/ket-noi/khoa, KH mục C.1).
 * Ô App Secret để trống = giữ khóa đã lưu. Trang cha chỉ gắn hộp thoại khi mở, nên mỗi lần mở là form mới.
 */
export default function KhoaUngDungDialog({ open, onOpenChange, san, ketNoi, onSaved }) {
  const isThirdParty = san.kieuKetNoi === "ben_thu_ba";
  const coServiceId = Boolean(noiDungSan(san.maKenh)?.coServiceId);
  const [values, setValues] = useState(() => ({
    ...taoGiaTriKhoaUngDung(ketNoi),
    appKey: ketNoi?.shopDomain || ketNoi?.clientId || ketNoi?.appKey || "",
    tenGianHang: ketNoi?.tenGianHang || "",
  }));
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
  const coThayDoi = isThirdParty
    ? Boolean(values.appKey?.trim()) && (values.appKey !== (ketNoi?.shopDomain ?? "") || values.tenGianHang !== (ketNoi?.tenGianHang ?? ""))
    : coThayDoiKhoaUngDung(values, ketNoi);

  const luu = async (event) => {
    event.preventDefault();
    if (dangLuuRef.current || !coThayDoi) return;

    if (isThirdParty) {
      let rawId = values.appKey?.trim() || "";
      if (!rawId) {
        setErrors({ appKey: "Nhập Shop ID gian hàng Shopee." });
        return;
      }
      const match = rawId.match(/shopid=(\d+)/i) || rawId.match(/(\d{6,15})/);
      const cleanShopId = match ? match[1] : rawId;

      dangLuuRef.current = true;
      setDangLuu(true);
      setLoi(null);
      try {
        const payload = {
          appKey: cleanShopId,
          clientId: cleanShopId,
          shopDomain: cleanShopId,
          tenGianHang: values.tenGianHang?.trim(),
          trangThai: 1,
        };
        const dto = await kenhBanHangService.luuKhoaUngDung(san.maKenh, payload);
        onSaved?.(dto);
      } catch (error) {
        setLoi(getApiErrorMessage(error, "Không lưu được thông tin kết nối Shopee"));
      } finally {
        dangLuuRef.current = false;
        setDangLuu(false);
      }
      return;
    }

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
      setLoi(getApiErrorMessage(error, t("Không lưu được khóa ứng dụng")));
    } finally {
      dangLuuRef.current = false;
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">
            {isThirdParty ? t("Cập nhật Shop ID gian hàng Shopee") : t("Cập nhật khóa ứng dụng")}
          </DialogTitle>
          <DialogDescription className="text-bo-muted">
            {isThirdParty
              ? t("Kết nối Shopee Production qua Cổng Ký Bên Thứ Ba (MinMinTool Gateway). Chỉ cần nhập Shop ID để liên kết.")
              : t("Khóa được mã hóa trước khi lưu và không hiển thị lại. Đổi App Key thì cần ủy quyền lại với {{ten}}.", { ten: san.ten })}
          </DialogDescription>
        </DialogHeader>
        <form id="khoa-ung-dung-form" onSubmit={luu} noValidate className="space-y-3">
          {isThirdParty ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="shopee-dialog-shop-id" className="mb-1.5 block text-sm font-medium text-bo-foreground">
                  Shop ID (Mã gian hàng Shopee) <span className="text-bo-danger">*</span>
                </label>
                <input
                  id="shopee-dialog-shop-id"
                  value={values.appKey}
                  onChange={(e) => doi("appKey", e.target.value)}
                  placeholder="VD: 88201679 hoặc dán link shop"
                  className={cn(INPUT_CLASS, errors.appKey && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15")}
                />
                <p className={cn("mt-1 text-xs", errors.appKey ? "text-bo-danger" : "text-bo-muted")}>
                  {errors.appKey || "Mã số định danh gian hàng Shopee của bạn."}
                </p>
              </div>
              <div>
                <label htmlFor="shopee-dialog-shop-name" className="mb-1.5 block text-sm font-medium text-bo-foreground">
                  Tên hiển thị gian hàng
                </label>
                <input
                  id="shopee-dialog-shop-name"
                  value={values.tenGianHang}
                  onChange={(e) => doi("tenGianHang", e.target.value)}
                  placeholder="VD: FCentric Fashion Official Store"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          ) : (
            <CacOKhoaUngDung maKenh={san.maKenh} values={values} errors={errors} onChange={doi} ketNoi={ketNoi} disabled={dangLuu} />
          )}
          {loi ? (
            <p role="alert">
              <TrangThaiCham label={t("Chưa lưu được. {{loi}}", { loi })} tone="danger" className="whitespace-normal" />
            </p>
          ) : null}
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={dangLuu} onClick={() => dong(false)} className={NUT_PHU}>
            {t("Hủy bỏ")}
          </Button>
          <Button type="submit" form="khoa-ung-dung-form" disabled={dangLuu || !coThayDoi} className={NUT_CHINH}>
            {dangLuu ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {dangLuu ? t("Đang lưu…") : isThirdParty ? t("Lưu Shop ID") : t("Lưu khóa")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
