import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KetNoiShopifyForm from "@/components/channel/KetNoiShopifyForm";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { kiemTraGiaTriKetNoi, taoGiaTriKetNoi, taoPayloadKetNoi } from "@/components/channel/ketNoiShopify";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";

/**
 * Hộp thoại "Cập nhật khóa truy cập" của trang Cấu hình (PUT /shopify).
 * Ô khóa để trống = giữ khóa đã lưu. Trang cha chỉ gắn hộp thoại khi mở, nên mỗi lần mở là form mới.
 */
export default function ShopifyConfigDialog({ open, onOpenChange, config, onSaved }) {
  const [values, setValues] = useState(() => taoGiaTriKetNoi(config));
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
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

  const luu = async (event) => {
    event.preventDefault();
    if (dangLuuRef.current) return;
    const loi = kiemTraGiaTriKetNoi(values, config);
    setErrors(loi);
    if (Object.keys(loi).length) return;
    dangLuuRef.current = true;
    setDangLuu(true);
    setResult(null);
    try {
      const dto = await kenhBanHangService.updateShopifyConfig(taoPayloadKetNoi(values, config));
      onSaved?.(dto);
    } catch (error) {
      setValues((cu) => ({ ...cu, accessToken: "", apiSecret: "", refreshToken: "" }));
      setResult({ ok: false, title: "Chưa lưu được", message: getApiErrorMessage(error, "Không lưu được khóa truy cập") });
    } finally {
      dangLuuRef.current = false;
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Cập nhật khóa truy cập</DialogTitle>
          <DialogDescription className="text-bo-muted">
            Khóa được mã hóa trước khi lưu và chỉ hiển thị dạng che. Nên kiểm tra kết nối trước khi lưu.
          </DialogDescription>
        </DialogHeader>
        <form id="shopify-khoa-form" onSubmit={luu} noValidate>
          <KetNoiShopifyForm
            values={values}
            errors={errors}
            onChange={doi}
            config={config}
            disabled={dangLuu}
            result={result}
            onResult={setResult}
          />
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={dangLuu} onClick={() => dong(false)} className={NUT_PHU}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="shopify-khoa-form" disabled={dangLuu} className={NUT_CHINH}>
            {dangLuu ? <Loader2 className="size-4 animate-spin" /> : null}
            {dangLuu ? "Đang lưu…" : "Lưu khóa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
