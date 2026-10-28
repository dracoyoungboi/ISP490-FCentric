import { useId, useRef, useState } from "react";
import { ChevronDown, ExternalLink, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SecretInput from "@/components/shared/SecretInput";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { INPUT_CLASS } from "@/components/channel/SettingsCard";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

export default function KetNoiLazadaForm({ values, errors = {}, onChange, config, disabled = false, result, onResult, onRefreshSuccess }) {
  const id = useId();
  const [dangKiemTra, setDangKiemTra] = useState(false);
  const [dangLayAuthUrl, setDangLayAuthUrl] = useState(false);
  const [dangLamMoiToken, setDangLamMoiToken] = useState(false);
  const [maThuCong, setMaThuCong] = useState("");
  const [dangKetNoiMa, setDangKetNoiMa] = useState(false);
  const dangKiemTraRef = useRef(false);

  const daCoSecret = Boolean(config?.hasAppSecret);
  const daCoToken = Boolean(config?.hasAccessToken);
  const daCoRefreshToken = Boolean(config?.hasRefreshToken);

  const ketNoiBangMaThuCong = async () => {
    if (!maThuCong.trim()) {
      toast.error("Vui lòng dán mã ủy quyền trước khi kết nối.");
      return;
    }
    setDangKetNoiMa(true);
    try {
      const res = await kenhBanHangService.hoanTatUyQuyen("LAZADA", {
        code: maThuCong.trim(),
        state: null,
      });
      toast.success(res?.tenGianHang ? `Đã kết nối gian hàng ${res.tenGianHang}` : "Ủy quyền Lazada thành công!");
      setMaThuCong("");
      onRefreshSuccess?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi khi kết nối bằng mã ủy quyền"));
    } finally {
      setDangKetNoiMa(false);
    }
  };

  const kiemTra = async () => {
    if (dangKiemTraRef.current) return;
    const appKey = values.appKey?.trim() || config?.appKey;
    if (!appKey) {
      onResult?.({ ok: false, title: "Chưa có App Key", message: "Nhập App Key của ứng dụng Lazada trước khi kiểm tra." });
      return;
    }
    dangKiemTraRef.current = true;
    setDangKiemTra(true);
    onResult?.(null);
    try {
      const res = await kenhBanHangService.testLazadaConnection({
        appKey,
        appSecret: values.appSecret?.trim() || null,
        accessToken: values.accessToken?.trim() || null,
      });
      onResult?.(
        res?.connected
          ? { ok: true, title: "Kết nối thành công", message: res.shopName ? `${res.shopName} (Mã người bán: ${res.sellerId || "—"})` : (res.message || "Lazada đã xác thực thành công.") }
          : { ok: false, title: "Kết nối thất bại", message: res?.message || "Lazada không chấp nhận thông tin xác thực này." },
      );
    } catch (error) {
      onResult?.({ ok: false, title: "Không kiểm tra được", message: getApiErrorMessage(error, "Không thể kết nối máy chủ Lazada") });
    } finally {
      dangKiemTraRef.current = false;
      setDangKiemTra(false);
    }
  };

  const batDauOAuth = async () => {
    setDangLayAuthUrl(true);
    try {
      const redirectUri = window.location.href.split("?")[0];
      const res = await kenhBanHangService.getLazadaAuthUrl(redirectUri);
      const url = res?.authUrl || (typeof res === "string" ? res : null);
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Không tạo được liên kết ủy quyền OAuth Lazada.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi khi tạo liên kết ủy quyền Lazada"));
    } finally {
      setDangLayAuthUrl(false);
    }
  };

  const lamMoiToken = async () => {
    setDangLamMoiToken(true);
    try {
      const res = await kenhBanHangService.refreshLazadaToken();
      if (res?.success) {
        toast.success(res.message || "Làm mới Access Token Lazada thành công!");
        onRefreshSuccess?.();
      } else {
        toast.error(res?.message || "Làm mới Access Token không thành công.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi khi làm mới Access Token Lazada"));
    } finally {
      setDangLamMoiToken(false);
    }
  };

  const giuKhoa = (co, che) => (co ? `Đang dùng khóa đã lưu${che ? ` ${che}` : ""}. Để trống nếu không đổi.` : undefined);
  const khoa = disabled || dangKiemTra;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-app-key`} className="text-sm font-medium text-bo-foreground">
            App Key <span className="text-bo-danger">*</span>
          </label>
          <input
            id={`${id}-app-key`}
            type="text"
            value={values.appKey}
            onChange={(e) => onChange("appKey", e.target.value)}
            disabled={khoa}
            placeholder="Ví dụ: 104829"
            className={cn(INPUT_CLASS, errors.appKey && "border-bo-danger focus-visible:ring-bo-danger/30")}
          />
          {errors.appKey ? (
            <p className="text-xs text-bo-danger">{errors.appKey}</p>
          ) : (
            <p className="text-xs text-bo-muted">Lấy từ App Console trên Lazada Open Platform (open.lazada.com)</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-app-secret`} className="text-sm font-medium text-bo-foreground">
            App Secret <span className="text-bo-danger">*</span>
          </label>
          <SecretInput
            id={`${id}-app-secret`}
            value={values.appSecret}
            onChange={(e) => onChange("appSecret", e.target.value)}
            disabled={khoa}
            placeholder={giuKhoa(daCoSecret, config?.appSecretMasked) ?? "Nhập App Secret"}
            error={Boolean(errors.appSecret)}
          />
          {errors.appSecret ? (
            <p className="text-xs text-bo-danger">{errors.appSecret}</p>
          ) : (
            <p className="text-xs text-bo-muted">Mã bí mật dùng để tạo chữ ký HMAC-SHA256, được mã hóa AES-256-GCM khi lưu</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={`${id}-access-token`} className="text-sm font-medium text-bo-foreground">
            Access Token (Tùy chọn nhập tay hoặc Ủy quyền OAuth)
          </label>
          {daCoRefreshToken ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={khoa || dangLamMoiToken}
              onClick={lamMoiToken}
              className="h-7 gap-1 px-2 text-xs text-bo-primary hover:text-bo-primary-hover"
            >
              {dangLamMoiToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Làm mới Token (Refresh)
            </Button>
          ) : null}
        </div>
        <SecretInput
          id={`${id}-access-token`}
          value={values.accessToken}
          onChange={(e) => onChange("accessToken", e.target.value)}
          disabled={khoa}
          placeholder={giuKhoa(daCoToken, config?.accessTokenMasked) ?? "Nhập Access Token dài hạn hoặc ủy quyền OAuth bên dưới"}
        />
        {config?.tokenExpiresAt ? (
          <p className="text-xs text-bo-muted">
            Token hết hạn vào: {new Date(config.tokenExpiresAt).toLocaleDateString("vi-VN")} {new Date(config.tokenExpiresAt).toLocaleTimeString("vi-VN")}
          </p>
        ) : null}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="inline-flex items-center gap-1 text-[13px] font-medium text-bo-primary hover:text-bo-primary-hover">
          Nhập mã ủy quyền thủ công (Authorization Code)
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
          <label htmlFor={`${id}-ma-thu-cong`} className="text-xs font-medium text-bo-foreground">
            Mã authorization code (lấy từ query ?code=... khi Lazada chuyển hướng)
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-ma-thu-cong`}
              type="text"
              value={maThuCong}
              onChange={(e) => setMaThuCong(e.target.value)}
              disabled={khoa || dangKetNoiMa}
              placeholder="Dán mã code (ví dụ: 0_47s...)"
              className={cn(INPUT_CLASS, "font-mono text-xs")}
            />
            <Button
              type="button"
              variant="outline"
              disabled={khoa || dangKetNoiMa || !maThuCong.trim()}
              onClick={ketNoiBangMaThuCong}
              className="shrink-0 h-9 px-3 text-xs"
            >
              {dangKetNoiMa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Xác nhận mã
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {result ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-sm",
            result.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-bo-danger-soft text-red-900",
          )}
        >
          <TrangThaiCham mau={result.ok ? "xanh_la" : "do"} className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{result.title}</p>
            {result.message ? <p className="mt-0.5 text-xs opacity-90">{result.message}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={kiemTra}
          disabled={khoa}
          className="h-9 gap-2 rounded-lg border-bo-border bg-bo-surface px-4 text-sm text-bo-foreground hover:bg-bo-surface-subtle"
        >
          {dangKiemTra ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Kiểm tra kết nối
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={batDauOAuth}
          disabled={khoa || dangLayAuthUrl}
          className="h-9 gap-2 rounded-lg border-blue-200 bg-blue-50 px-4 text-sm text-blue-700 hover:bg-blue-100"
        >
          {dangLayAuthUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Ủy quyền qua Lazada (OAuth 2.0)
        </Button>
      </div>
    </div>
  );
}

