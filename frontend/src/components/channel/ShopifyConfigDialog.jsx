import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KetNoiShopifyForm from "@/components/channel/KetNoiShopifyForm";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { kiemTraGiaTriKetNoi, taoGiaTriKetNoi, taoPayloadKetNoi } from "@/components/channel/ketNoiKenh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";

/** Mã lỗi cho thấy kết nối vừa đổi ở nơi khác (tab khác vừa ngắt / kết nối cửa hàng khác): trang phải đọc lại. */
const MA_DOI_KET_NOI = new Set(["KENH_CHUA_KET_NOI", "GIAN_HANG_KHAC"]);

/**
 * Hộp thoại "Cập nhật khóa truy cập" của trang Cấu hình (PUT /{maKenh}/ket-noi/khoa, máy chủ cũ PUT /shopify).
 * Ô khóa để trống = giữ khóa đã lưu. Trang cha chỉ gắn hộp thoại khi mở, nên mỗi lần mở là form mới.
 * `onDoiKetNoi(error, payload)`: máy chủ báo kết nối vừa đổi ở nơi khác; trang cha đóng hộp thoại và báo lỗi bằng toast
 * (`payload`: dữ liệu vừa gửi, để biết người dùng có tự đổi tên miền không).
 */
export default function ShopifyConfigDialog({ open, onOpenChange, config, onSaved, onDoiKetNoi }) {
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
    const payload = taoPayloadKetNoi(values, config);
    try {
      const dto = await kenhBanHangService.updateShopifyConfig(payload);
      onSaved?.(dto);
    } catch (error) {
      setValues((cu) => ({ ...cu, accessToken: "", apiSecret: "", refreshToken: "" }));
      if (MA_DOI_KET_NOI.has(getApiErrorCode(error)) && onDoiKetNoi) onDoiKetNoi(error, payload);
      else setResult({ ok: false, title: "Chưa lưu được", message: getApiErrorMessage(error, "Không lưu được khóa truy cập") });
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
