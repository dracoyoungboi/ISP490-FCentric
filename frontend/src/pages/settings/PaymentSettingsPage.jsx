import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  PlugZap,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { paymentConfigService } from "@/services/paymentConfigService";

const WEBHOOK_PATH = "/api/v1/payos/webhook";
const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/10 disabled:opacity-60";

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

function SecretField({ id, label, savedMasked, value, onChange, placeholder, hint }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-bo-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          autoComplete="off"
          className={`${inputClass} pr-10 font-mono`}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={savedMasked ? `Đã lưu: ${savedMasked} — để trống nếu giữ nguyên` : placeholder}
          spellCheck={false}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "Ẩn" : "Hiện"}
          className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded p-1.5 text-bo-muted hover:text-bo-foreground"
          onClick={() => setVisible((v) => !v)}
          type="button"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-bo-muted">{hint}</p> : null}
    </div>
  );
}

function StatusPill({ config }) {
  if (!config?.daCauHinhDu) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Chưa cấu hình</span>;
  }
  return config.kichHoat ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Đang bật ở POS</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Đã cấu hình — đang tắt</span>
  );
}

/**
 * Cài đặt → Thanh toán: kết nối payOS cho thanh toán chuyển khoản QR tại quầy.
 * Khóa được mã hóa ở backend; trang này chỉ gửi khóa mới, không bao giờ nhận lại khóa thật.
 */
export default function PaymentSettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [checksumKey, setChecksumKey] = useState("");
  const [expiry, setExpiry] = useState(15);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const applyConfig = (data) => {
    setConfig(data);
    setExpiry(data?.thoiGianHetHanPhut ?? 15);
    setWebhookUrl(data?.webhookUrl || data?.webhookUrlGoiY || "");
  };

  useEffect(() => {
    let cancelled = false;
    paymentConfigService
      .getPayos()
      .then((data) => {
        if (cancelled) return;
        applyConfig(data);
        setLoadError(false);
      })
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const saveKeys = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const data = await paymentConfigService.updatePayos({
        clientId: clientId.trim() || null,
        apiKey: apiKey.trim() || null,
        checksumKey: checksumKey.trim() || null,
        thoiGianHetHanPhut: Number(expiry),
      });
      applyConfig(data);
      setClientId("");
      setApiKey("");
      setChecksumKey("");
      toast.success("Đã lưu cấu hình payOS");
    } catch (error) {
      toast.error(errorMessage(error, "Không lưu được cấu hình"));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (checked) => {
    setToggling(true);
    try {
      const data = await paymentConfigService.updatePayos({ kichHoat: checked });
      applyConfig(data);
      toast.success(checked ? "Đã bật thanh toán chuyển khoản ở POS" : "Đã tắt thanh toán chuyển khoản ở POS");
    } catch (error) {
      toast.error(errorMessage(error, "Không đổi được trạng thái"));
    } finally {
      setToggling(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await paymentConfigService.testConnection());
    } catch (error) {
      setTestResult({ ok: false, message: errorMessage(error, "Không kiểm tra được kết nối") });
    } finally {
      setTesting(false);
    }
  };

  const confirmWebhook = async () => {
    setConfirming(true);
    try {
      applyConfig(await paymentConfigService.confirmWebhook(webhookUrl.trim()));
      toast.success("payOS đã xác nhận webhook");
    } catch (error) {
      toast.error(errorMessage(error, "payOS chưa xác nhận webhook"));
    } finally {
      setConfirming(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Đã sao chép webhook URL");
    } catch {
      toast.error("Không sao chép được — hãy bôi đen và sao chép thủ công");
    }
  };

  if (loading) return <LoadingState label="Đang tải cấu hình thanh toán" />;
  if (loadError) {
    return (
      <ErrorState
        description="Không tải được cấu hình thanh toán. Kiểm tra backend và đã chạy Database/payos_v1.sql chưa."
        onRetry={() => {
          setLoading(true);
          setReloadKey((k) => k + 1);
        }}
        title="Lỗi tải cấu hình"
      />
    );
  }

  const hasNewKeys = clientId.trim() || apiKey.trim() || checksumKey.trim();
  const expiryChanged = Number(expiry) !== (config?.thoiGianHetHanPhut ?? 15);

  return (
    <PageContainer>
      <PageHeader
        description="Kết nối payOS để khách thanh toán chuyển khoản bằng mã QR tại quầy. Tiền về sẽ tự xác nhận đơn và trừ kho."
        eyebrow="Cài đặt"
        title="Thanh toán"
      />

      {!config?.mayChuCoKhoaMaHoa ? (
        <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>
            Máy chủ chưa đặt biến môi trường <code className="font-mono">PAYMENT_CONFIG_SECRET</code> nên chưa thể lưu khóa an toàn.
            Liên hệ người quản trị máy chủ.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SurfaceCard
            action={<StatusPill config={config} />}
            description="Cổng thanh toán VietQR của Casso — tiền chuyển thẳng vào tài khoản ngân hàng của cửa hàng."
            title={
              <span className="inline-flex items-center gap-2">
                <QrCode size={18} className="text-bo-primary" /> payOS — Chuyển khoản QR
              </span>
            }
          >
            <div className="flex items-center justify-between gap-4 rounded-lg border border-bo-border p-3">
              <div>
                <p className="text-sm font-medium text-bo-foreground">Cho phép thanh toán chuyển khoản ở POS</p>
                <p className="mt-0.5 text-xs text-bo-muted">
                  Khi bật, màn Bán hàng tại quầy có thêm lựa chọn “Chuyển khoản (QR)”.
                </p>
              </div>
              <Switch
                aria-label="Bật thanh toán chuyển khoản ở POS"
                checked={Boolean(config?.kichHoat)}
                className="data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:bg-white"
                disabled={toggling || !config?.daCauHinhDu}
                onCheckedChange={toggleEnabled}
              />
            </div>
          </SurfaceCard>

          <SurfaceCard
            description="Lấy ở my.payos.vn → Kênh thanh toán → chọn kênh → Thông tin cấu hình."
            title={
              <span className="inline-flex items-center gap-2">
                <KeyRound size={18} className="text-bo-primary" /> Khóa kết nối
              </span>
            }
          >
            <div className="space-y-4">
              <SecretField
                id="payos-client-id"
                label="Client ID"
                onChange={setClientId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                savedMasked={config?.clientIdMasked}
                value={clientId}
              />
              <SecretField
                id="payos-api-key"
                label="API Key"
                onChange={setApiKey}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                savedMasked={config?.apiKeyMasked}
                value={apiKey}
              />
              <SecretField
                hint="Dùng để kiểm tra chữ ký webhook — tuyệt đối không chia sẻ."
                id="payos-checksum-key"
                label="Checksum Key"
                onChange={setChecksumKey}
                placeholder="64 ký tự 0-9, a-f"
                savedMasked={config?.checksumKeyMasked}
                value={checksumKey}
              />
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-bo-foreground" htmlFor="payos-expiry">
                  Mã QR hết hạn sau (phút)
                </label>
                <input
                  className={inputClass}
                  id="payos-expiry"
                  max={60}
                  min={3}
                  onChange={(event) => setExpiry(event.target.value)}
                  type="number"
                  value={expiry}
                />
                <p className="mt-1 text-xs text-bo-muted">Hết hạn mà khách chưa trả, hàng giữ chỗ được trả lại kho.</p>
              </div>

              {testResult ? (
                <div
                  className={`flex gap-2 rounded-lg border p-3 text-sm ${
                    testResult.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {testResult.ok ? <CheckCircle2 className="mt-0.5 shrink-0" size={16} /> : <AlertTriangle className="mt-0.5 shrink-0" size={16} />}
                  <span>{testResult.message}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button disabled={testing || !config?.daCauHinhDu || hasNewKeys} onClick={testConnection} type="button" variant="outline">
                  <PlugZap size={16} /> {testing ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
                </Button>
                <Button disabled={saving || (!hasNewKeys && !expiryChanged)} onClick={saveKeys} type="button">
                  {saving ? "Đang lưu…" : "Lưu cấu hình"}
                </Button>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            description="payOS gọi địa chỉ này mỗi khi có tiền vào để hệ thống tự xác nhận đơn."
            title={
              <span className="inline-flex items-center gap-2">
                <Link2 size={18} className="text-bo-primary" /> Webhook
              </span>
            }
          >
            <label className="block text-sm font-medium text-bo-foreground" htmlFor="payos-webhook">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                className={`${inputClass} font-mono`}
                id="payos-webhook"
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder={`https://<địa-chỉ-backend>${WEBHOOK_PATH}`}
                spellCheck={false}
                value={webhookUrl}
              />
              <Button className="mt-1.5 h-10" disabled={!webhookUrl} onClick={copyWebhook} type="button" variant="outline">
                <Copy size={16} />
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-bo-muted">
              {config?.webhookXacNhanLuc
                ? `payOS đã xác nhận lúc ${new Date(config.webhookXacNhanLuc).toLocaleString("vi-VN")}.`
                : "Chưa đăng ký với payOS."}{" "}
              Máy dev: chạy <code className="font-mono">ngrok http 8080</code> rồi dán link https của ngrok + <code className="font-mono">{WEBHOOK_PATH}</code>.
            </p>
            <div className="mt-3 flex justify-end">
              <Button disabled={confirming || !config?.daCauHinhDu || !webhookUrl.trim()} onClick={confirmWebhook} type="button" variant="outline">
                {confirming ? "Đang đăng ký…" : "Đăng ký webhook với payOS"}
              </Button>
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={18} className="text-bo-primary" /> Cách hoạt động
            </span>
          }
        >
          <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-bo-muted">
            <li>Nhập 3 khóa → <strong className="text-bo-foreground">Lưu</strong> → <strong className="text-bo-foreground">Kiểm tra kết nối</strong>.</li>
            <li>Đăng ký webhook (cần địa chỉ https công khai).</li>
            <li>Bật công tắc để POS hiện lựa chọn “Chuyển khoản (QR)”.</li>
            <li>Khi tạo QR, hàng được <strong className="text-bo-foreground">giữ chỗ</strong> để kênh khác không bán mất.</li>
            <li>Tiền về → hệ thống kiểm chữ ký và số tiền, rồi tạo đơn và trừ kho. Không có webhook thì màn POS tự hỏi payOS mỗi vài giây.</li>
            <li>Hủy hoặc hết hạn → hàng giữ chỗ được trả lại.</li>
          </ol>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-bo-muted">
            Khóa được mã hóa AES-256 trước khi lưu, trang này không bao giờ hiển thị lại khóa đầy đủ.
          </p>
        </SurfaceCard>
      </div>
    </PageContainer>
  );
}
