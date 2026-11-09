import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KetNoiLazadaForm from "@/components/channel/KetNoiLazadaForm";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { kiemTraGiaTriKetNoiLazada, taoGiaTriKetNoiLazada, taoPayloadKetNoiLazada } from "@/components/channel/ketNoiLazada";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { t } from "@/i18n";

export default function LazadaConfigDialog({ maKenh = "LAZADA", open, onOpenChange, config, onSaved }) {
  const isSandbox = String(maKenh).toUpperCase() === "LAZADA_SANDBOX";
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
      const dto = await kenhBanHangService.luuKhoaUngDung(maKenh, taoPayloadKetNoiLazada(values, config));
      onSaved?.(dto);
    } catch (error) {
      setValues((cu) => ({ ...cu, appSecret: "", accessToken: "", refreshToken: "" }));
      setResult({ ok: false, title: t("Chưa lưu được"), message: getApiErrorMessage(error, t("Không lưu được thông tin kết nối Lazada")) });
    } finally {
      dangLuuRef.current = false;
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">{isSandbox ? t("Cấu hình kết nối Lazada Sandbox") : t("Cấu hình kết nối Lazada")}</DialogTitle>
          <DialogDescription className="text-bo-muted">
            {t("Thông tin App Secret và Access Token được mã hóa AES-256-GCM trước khi lưu và chỉ hiển thị dạng che.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={luu} className="mt-2 space-y-4">
          <KetNoiLazadaForm
            maKenh={maKenh}
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
              {t("Hủy")}
            </Button>
            <Button type="submit" disabled={dangLuu} className={NUT_CHINH}>
              {dangLuu ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("Lưu thay đổi")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

