import { useRef, useState } from "react";
import { Activity, BookOpen, ChevronDown, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SecretInput from "@/components/shared/SecretInput";
import InlineResult from "@/components/shared/InlineResult";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";
import { normalizeShopDomain } from "@/constants/channel";

const inputClass =
  "h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";
const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const emptyValues = (config) => ({
  shopDomain: config?.shopDomain ?? "",
  accessToken: "",
  apiSecret: "",
  clientId: config?.clientId ?? "",
  refreshToken: "",
});

function validate(values, config) {
  const errors = {};
  const domain = normalizeShopDomain(values.shopDomain);
  if (!domain) errors.shopDomain = "Nhập tên miền cửa hàng.";
  else if (!DOMAIN_PATTERN.test(domain)) errors.shopDomain = "Tên miền phải có dạng ten-cua-hang.myshopify.com.";
  if (!config?.hasAccessToken && !values.accessToken.trim()) errors.accessToken = "Nhập Admin API access token.";
  return errors;
}

/**
 * Cấu hình kênh Shopify — PUT /api/v1/kenh-ban-hang/shopify, kiểm tra bằng POST /shopify/test-connection
 * (KenhBanHangController). Ô khóa để trống = giữ khóa đã lưu. Trang cha chỉ render khi `open`.
 */
export default function ShopifyConfigDialog({ open, onOpenChange, config, onSaved }) {
  const [values, setValues] = useState(() => emptyValues(config));
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null); // "test" | "save"
  const busyRef = useRef(false);
  const configured = Boolean(config?.hasAccessToken);

  // Trang cha chỉ gắn hộp thoại khi mở, nên mỗi lần mở là một state mới (khóa cũ không còn trong bộ nhớ).
  const close = (next) => {
    if (busyRef.current) return;
    if (!next) setValues(emptyValues(null));
    onOpenChange(next);
  };

  const change = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const run = async (type, action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(type);
    setResult(null);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleTest = () => {
    const domain = normalizeShopDomain(values.shopDomain);
    if (!domain || !DOMAIN_PATTERN.test(domain)) {
      setErrors((prev) => ({ ...prev, shopDomain: "Tên miền phải có dạng ten-cua-hang.myshopify.com." }));
      return;
    }
    if (!configured && !values.accessToken.trim()) {
      setErrors((prev) => ({ ...prev, accessToken: "Nhập Admin API access token để kiểm tra." }));
      return;
    }
    run("test", async () => {
      try {
        const res = await kenhBanHangService.testShopifyConnection({
          shopDomain: domain,
          accessToken: values.accessToken.trim() || null,
        });
        setResult(
          res?.connected
            ? {
                ok: true,
                title: "Kết nối thành công",
                message: [res.shopName, res.myshopifyDomain || domain].filter(Boolean).join(" · "),
              }
            : { ok: false, title: "Kết nối thất bại", message: res?.message },
        );
      } catch (error) {
        setResult({ ok: false, title: "Kiểm tra thất bại", message: getApiErrorMessage(error, "Không kiểm tra được kết nối Shopify") });
      }
    });
  };

  const handleSave = (event) => {
    event.preventDefault();
    const nextErrors = validate(values, config);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    run("save", async () => {
      try {
        const dto = await kenhBanHangService.updateShopifyConfig({
          shopDomain: normalizeShopDomain(values.shopDomain),
          accessToken: values.accessToken.trim() || null,
          apiSecret: values.apiSecret.trim() || null,
          clientId: values.clientId.trim(),
          refreshToken: values.refreshToken.trim() || null,
          // Lần đầu cấu hình thì bật kênh; các lần sau giữ trạng thái hiện tại
          trangThai: configured ? config?.trangThai ?? 1 : 1,
        });
        setValues(emptyValues(null));
        onSaved?.(dto);
      } catch (error) {
        setValues((prev) => ({ ...prev, accessToken: "", apiSecret: "", refreshToken: "" }));
        setResult({ ok: false, title: "Lưu cấu hình thất bại", message: getApiErrorMessage(error, "Không lưu được cấu hình Shopify") });
      }
    });
  };

  const keepHint = (has, masked) => (has ? `Để trống để giữ khóa đã lưu${masked ? ` (${masked})` : ""}.` : undefined);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-xl border-bo-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">{configured ? "Cập nhật cấu hình Shopify" : "Kết nối cửa hàng Shopify"}</DialogTitle>
          <DialogDescription className="text-slate-600">
            Token được mã hóa trước khi lưu và chỉ hiển thị dạng che. Nên bấm Kiểm tra kết nối trước khi lưu.
          </DialogDescription>
        </DialogHeader>

        <Collapsible className="rounded-lg border border-bo-border bg-bo-surface-subtle">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-bo-foreground">
            <span className="inline-flex items-center gap-2">
              <BookOpen className="size-4 text-bo-muted" />
              Cần chuẩn bị gì?
            </span>
            <ChevronDown className="size-4 text-bo-muted transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-sm leading-6 text-slate-700">
              <li>Một app Shopify đã cài vào cửa hàng, có quyền đọc sản phẩm, tồn kho và đơn hàng, ghi tồn kho.</li>
              <li>Admin API access token của app (thường bắt đầu bằng <code className="font-mono text-xs">shpat_</code>).</li>
              <li>API secret, Client ID và Refresh token chỉ cần khi app dùng OAuth có token hết hạn.</li>
            </ol>
          </CollapsibleContent>
        </Collapsible>

        <form id="shopify-config-form" onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label htmlFor="shopify-domain" className="mb-1.5 block text-sm font-medium text-bo-foreground">Tên miền cửa hàng</label>
            <input
              id="shopify-domain"
              autoFocus
              disabled={Boolean(busy)}
              value={values.shopDomain}
              onChange={(event) => change("shopDomain", event.target.value)}
              onBlur={() => values.shopDomain && change("shopDomain", normalizeShopDomain(values.shopDomain))}
              placeholder="ten-cua-hang.myshopify.com"
              spellCheck={false}
              autoComplete="off"
              className={cn(inputClass, "font-mono placeholder:font-sans", errors.shopDomain && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15")}
            />
            {errors.shopDomain ? (
              <p className="mt-1 text-xs text-bo-danger">{errors.shopDomain}</p>
            ) : (
              <p className="mt-1 text-xs text-bo-muted">Chỉ nhập phần tên cũng được, hệ thống tự thêm .myshopify.com.</p>
            )}
          </div>
          <SecretInput
            id="shopify-access-token"
            label="Admin API access token"
            value={values.accessToken}
            onChange={(value) => change("accessToken", value)}
            error={errors.accessToken}
            hint={keepHint(config?.hasAccessToken, config?.accessTokenMasked)}
            placeholder={configured ? "Giữ token đã lưu" : "shpat_..."}
            disabled={Boolean(busy)}
          />

          <Collapsible className="rounded-lg border border-bo-border">
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-bo-foreground">
              Khóa OAuth (không bắt buộc)
              <ChevronDown className="size-4 text-bo-muted transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t border-bo-border px-3 py-3">
              <div>
                <label htmlFor="shopify-client-id" className="mb-1.5 block text-sm font-medium text-bo-foreground">Client ID</label>
                <input
                  id="shopify-client-id"
                  disabled={Boolean(busy)}
                  value={values.clientId}
                  onChange={(event) => change("clientId", event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  className={cn(inputClass, "font-mono")}
                />
              </div>
              <SecretInput
                id="shopify-api-secret"
                label="API secret"
                value={values.apiSecret}
                onChange={(value) => change("apiSecret", value)}
                hint={keepHint(config?.hasApiSecret)}
                disabled={Boolean(busy)}
              />
              <SecretInput
                id="shopify-refresh-token"
                label="Refresh token"
                value={values.refreshToken}
                onChange={(value) => change("refreshToken", value)}
                hint={keepHint(config?.hasRefreshToken, config?.refreshTokenMasked)}
                disabled={Boolean(busy)}
              />
            </CollapsibleContent>
          </Collapsible>

          <InlineResult result={result} />
        </form>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={handleTest}
            className="h-10 gap-2 rounded-lg border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle"
          >
            {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
            Kiểm tra kết nối
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => close(false)}
              className="h-10 rounded-lg border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="shopify-config-form"
              disabled={Boolean(busy)}
              className="h-10 min-w-[140px] gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100"
            >
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {busy === "save" ? "Đang lưu…" : "Lưu cấu hình"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
