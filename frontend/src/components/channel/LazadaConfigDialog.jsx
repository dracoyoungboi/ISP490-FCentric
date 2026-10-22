import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KetNoiLazadaForm from "@/components/channel/KetNoiLazadaForm";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { kiemTraGiaTriKetNoiLazada, taoGiaTriKetNoiLazada, taoPayloadKetNoiLazada } from "@/components/channel/ketNoiLazada";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";

export default function LazadaConfigDialog({ open, onOpenChange, config, onSaved }) {
  const [values, setValues] = useState(() => taoGiaTriKetNoiLazada(config));
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
    const loi = kiemTraGiaTriKetNoiLazada(values, config);
    setErrors(loi);
    if (Object.keys(loi).length) return;
    dangLuuRef.current = true;
    setDangLuu(true);
    setResult(null);
    try {
      const dto = await kenhBanHangService.updateLazadaConfig(taoPayloadKetNoiLazada(values, config));
      onSaved?.(dto);
    } catch (error) {
      setValues((cu) => ({ ...cu, appSecret: "", accessToken: "", refreshToken: "" }));
      setResult({ ok: false, title: "Chưa lưu được", message: getApiErrorMessage(error, "Không lưu được thông tin kết nối Lazada") });
    } finally {
      dangLuuRef.current = false;
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Cấu hình kết nối Lazada</DialogTitle>
          <DialogDescription className="text-bo-muted">
            Thông tin App Secret và Access Token được mã hóa AES-256-GCM trước khi lưu và chỉ hiển thị dạng che.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={luu} className="mt-2 space-y-4">
          <KetNoiLazadaForm
            values={values}
            errors={errors}
            onChange={doi}
            config={config}
            disabled={dangLuu}
            result={result}
            onResult={setResult}
            onRefreshSuccess={() => onSaved?.(config)}
          />

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={dangLuu}
              onClick={() => dong(false)}
              className={NUT_PHU}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={dangLuu} className={NUT_CHINH}>
              {dangLuu ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
