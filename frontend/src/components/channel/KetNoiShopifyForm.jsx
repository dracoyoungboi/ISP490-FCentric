import { useId, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SecretInput from "@/components/shared/SecretInput";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { INPUT_CLASS } from "@/components/channel/SettingsCard";
import { khoaTenMien } from "@/components/channel/ketNoiKenh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { normalizeShopDomain } from "@/constants/channel";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

/**
 * Form khóa kết nối Shopify (điều khiển từ trang cha): tên miền, khóa truy cập và khóa OAuth (không bắt buộc, gập sẵn).
 * Nút "Kiểm tra kết nối" gọi POST /shopify/test-connection; trang cha quyết định khi nào lưu.
 * `result` / `onResult`: kết quả kiểm tra { ok, title, message } hiển thị tại chỗ (trang cha cũng đặt khi lưu lỗi).
 * Đã kết nối thì ô tên miền chỉ đọc: đổi sang cửa hàng khác phải ngắt kết nối rồi kết nối lại (KH mục B.3).
 */
export default function KetNoiShopifyForm({ values, errors = {}, onChange, config, disabled = false, result, onResult }) {
  const id = useId();
  const [dangKiemTra, setDangKiemTra] = useState(false);
  const dangKiemTraRef = useRef(false);
  const daCoKhoa = Boolean(config?.hasAccessToken);
  const giuTenMien = khoaTenMien(config);

  const kiemTra = async () => {
    if (dangKiemTraRef.current) return;
    const domain = normalizeShopDomain(values.shopDomain);
    if (!domain) {
      onResult?.({ ok: false, title: "Chưa có tên miền", message: "Nhập tên miền cửa hàng trước khi kiểm tra." });
      return;
    }
    if (!daCoKhoa && !values.accessToken.trim()) {
      onResult?.({ ok: false, title: "Chưa có khóa truy cập", message: "Nhập khóa truy cập trước khi kiểm tra." });
      return;
    }
    dangKiemTraRef.current = true;
    setDangKiemTra(true);
    onResult?.(null);
    try {
      const res = await kenhBanHangService.testShopifyConnection({
        shopDomain: domain,
        accessToken: values.accessToken.trim() || null,
      });
      onResult?.(
        res?.connected
          ? { ok: true, title: "Kết nối tốt", message: res.shopName || res.myshopifyDomain || domain }
          : { ok: false, title: "Kết nối thất bại", message: res?.message || "Shopify không chấp nhận khóa này." },
      );
    } catch (error) {
      onResult?.({ ok: false, title: "Không kiểm tra được", message: getApiErrorMessage(error, "Không kiểm tra được kết nối Shopify") });
    } finally {
      dangKiemTraRef.current = false;
      setDangKiemTra(false);
    }
  };

  const giuKhoa = (co, che) => (co ? `Đang dùng khóa đã lưu${che ? ` ${che}` : ""}. Để trống nếu không đổi.` : undefined);
  const khoa = disabled || dangKiemTra;

  return (
    // Khung đủ rộng (thẻ ở trang Thiết lập) thì hai ô một hàng; trong hộp thoại hẹp thì xếp dọc
    <div className="@container space-y-4">
      <div className="grid gap-4 @xl:grid-cols-2">
        <div>
          <label htmlFor={`${id}-domain`} className="mb-1.5 block text-sm font-medium text-bo-heading">
            Tên miền cửa hàng
          </label>
          <input
            id={`${id}-domain`}
            value={values.shopDomain}
            disabled={khoa}
            readOnly={giuTenMien}
            onChange={(event) => onChange("shopDomain", event.target.value)}
            onBlur={() => !giuTenMien && values.shopDomain && onChange("shopDomain", normalizeShopDomain(values.shopDomain))}
            placeholder="ten-cua-hang.myshopify.com"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(errors.shopDomain)}
            aria-describedby={`${id}-domain-goi-y`}
            className={cn(
              INPUT_CLASS,
              giuTenMien && "cursor-default bg-bo-surface-subtle text-bo-muted",
              errors.shopDomain && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15",
            )}
          />
          {errors.shopDomain ? (
            <p id={`${id}-domain-goi-y`} className="mt-1 text-xs text-bo-danger">
              {errors.shopDomain}
            </p>
          ) : (
            <p id={`${id}-domain-goi-y`} className="mt-1 text-xs text-bo-muted">
              {giuTenMien
                ? "Muốn đổi sang cửa hàng khác, hãy ngắt kết nối ở trang Cấu hình rồi kết nối lại."
                : "Nhập phần tên cũng được, hệ thống tự thêm .myshopify.com."}
            </p>
          )}
        </div>

        <SecretInput
          id={`${id}-token`}
          label="Khóa truy cập"
          value={values.accessToken}
          onChange={(value) => onChange("accessToken", value)}
          error={errors.accessToken}
          hint={giuKhoa(daCoKhoa, config?.accessTokenMasked) ?? "Lấy trong ứng dụng đã cài vào cửa hàng, thường bắt đầu bằng shpat_."}
          placeholder={daCoKhoa ? "Giữ khóa đã lưu" : "shpat_..."}
          disabled={khoa}
        />
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-md text-sm font-medium text-bo-primary outline-none hover:text-bo-primary-hover focus-visible:ring-2 focus-visible:ring-bo-primary/30">
          Khóa OAuth (không bắt buộc)
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          <p className="text-xs leading-5 text-bo-muted">Chỉ cần khi ứng dụng dùng khóa có hạn và tự làm mới.</p>
          <div className="grid gap-4 @xl:grid-cols-3">
            <div>
              <label htmlFor={`${id}-client`} className="mb-1.5 block text-sm font-medium text-bo-heading">
                Mã ứng dụng
              </label>
              <input
                id={`${id}-client`}
                value={values.clientId}
                disabled={khoa}
                onChange={(event) => onChange("clientId", event.target.value)}
                spellCheck={false}
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </div>
            <SecretInput
              id={`${id}-secret`}
              label="Khóa bí mật của ứng dụng"
              value={values.apiSecret}
              onChange={(value) => onChange("apiSecret", value)}
              hint={giuKhoa(config?.hasApiSecret)}
              disabled={khoa}
            />
            <SecretInput
              id={`${id}-refresh`}
              label="Khóa làm mới"
              value={values.refreshToken}
              onChange={(value) => onChange("refreshToken", value)}
              hint={giuKhoa(config?.hasRefreshToken, config?.refreshTokenMasked)}
              disabled={khoa}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={kiemTra}
          disabled={khoa}
          className="h-9 gap-2 rounded-lg border-bo-border bg-white px-3.5 text-bo-foreground hover:bg-bo-surface-subtle"
        >
          {dangKiemTra ? <Loader2 className="size-4 animate-spin" /> : null}
          Kiểm tra kết nối
        </Button>
        {result ? (
          <span role="status" className="min-w-0">
            <TrangThaiCham
              label={[result.title, result.message].filter(Boolean).join(" · ")}
              tone={result.ok ? "success" : "danger"}
              className="whitespace-normal"
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
