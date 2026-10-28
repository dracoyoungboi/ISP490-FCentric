import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/thongBaoNhanh";
import { AlertTriangle, Check, Copy, Eye, EyeOff, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsFieldHint,
  SettingsPill,
  SettingsTextButton,
} from "@/components/settings/SettingsUI";
import { OUTLINE_BUTTON, PRIMARY_BUTTON, settingsInputClass } from "@/components/settings/settingsStyles";
import { useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import { paymentConfigService } from "@/services/paymentConfigService";

const PAYOS_DASHBOARD_URL = "https://my.payos.vn";
const WEBHOOK_PATH = "/api/v1/payos/webhook";
const EXPIRY_MIN = 3;
const EXPIRY_MAX = 60;
const DEFAULT_EXPIRY = 15;

// Định dạng khớp với kiểm tra ở backend (PaymentConfigService)
const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const HEX64_PATTERN = /^[0-9a-fA-F]{64}$/;
const UUID_HINT = "dạng xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

const KEY_FIELDS = [
  { name: "clientId", label: "Client ID", maskedKey: "clientIdMasked", pattern: UUID_PATTERN, formatHint: UUID_HINT },
  { name: "apiKey", label: "API Key", maskedKey: "apiKeyMasked", pattern: UUID_PATTERN, formatHint: UUID_HINT },
  {
    name: "checksumKey",
    label: "Checksum Key",
    maskedKey: "checksumKeyMasked",
    pattern: HEX64_PATTERN,
    formatHint: "gồm 64 ký tự 0-9, a-f",
  },
];
const EMPTY_KEYS = { clientId: "", apiKey: "", checksumKey: "" };
const CHANNEL_KEYS_REQUIRED = "Khi nhập Client ID, hãy cung cấp đầy đủ bộ khóa của kênh.";

const SUCCESS_VISIBLE_MS = 4000;
const COPIED_VISIBLE_MS = 1500;

const linkClass = "font-medium text-bo-primary hover:underline";
const rowLabelClass = "flex-[0_0_128px] text-[13px] leading-5 text-[#5b6676]";
const rowClass = "flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3";

/**
 * Thông điệp lỗi KHÔNG che nguyên nhân: ưu tiên message của backend; không có thì nêu
 * mã HTTP hoặc loại lỗi mạng để biết request hỏng ở đâu. Không bao giờ in khóa.
 */
const errorMessage = (error, fallback) => {
  const response = error?.response;
  const serverMessage = response?.data?.message;
  if (serverMessage) return serverMessage;
  if (response) return `${fallback}: máy chủ trả về mã lỗi ${response.status}.`;
  if (error?.code === "ECONNABORTED") return `${fallback}: hết thời gian chờ phản hồi từ máy chủ.`;
  if (error?.request) return `${fallback}: không nhận được phản hồi từ máy chủ (máy chủ chưa chạy, sai địa chỉ API hoặc mạng bị chặn).`;
  return `${fallback}.`;
};

const pad = (n) => String(n).padStart(2, "0");
/** "08/10/2026 · 01:33" theo giờ máy người dùng. */
const formatDateTime = (value) => {
  const d = new Date(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatTime = (value) => {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Chuỗi khóa đã che từ máy chủ → "•••• 3f9a" cho gọn; đủ chuỗi nằm ở title. */
const shortMasked = (masked) => (masked ? `•••• ${masked.slice(-4)}` : "—");

/** Các khóa có nhập (đã trim). Ô trống không có mặt = giữ khóa đang lưu. */
const enteredKeys = (values) =>
  Object.fromEntries(KEY_FIELDS.map((field) => [field.name, values[field.name].trim()]).filter(([, value]) => value));

/**
 * mode "setup": lần đầu, bắt buộc đủ 3 khóa.
 * mode "update": chỉ kiểm định dạng ô có nhập, cần ít nhất một ô; nhập Client ID
 * (có thể là kênh khác) thì phải đủ cả bộ — không so với chuỗi đã che, backend tự so với khóa đang lưu.
 */
const validateKeys = (values, mode) => {
  const errors = {};
  const entered = enteredKeys(values);
  if (mode === "update" && !Object.keys(entered).length) {
    return { form: "Nhập ít nhất một khóa cần thay đổi." };
  }
  const requireAll = mode === "setup" || Boolean(entered.clientId);
  KEY_FIELDS.forEach((field) => {
    const value = entered[field.name];
    if (!value) {
      if (requireAll) errors[field.name] = mode === "setup" ? `Nhập ${field.label}.` : CHANNEL_KEYS_REQUIRED;
    } else if (!field.pattern.test(value)) {
      errors[field.name] = `${field.label} không đúng định dạng (${field.formatHint}).`;
    }
  });
  return errors;
};

/** Kết quả thao tác {ok, message, at}; thành công thì tự ẩn sau SUCCESS_VISIBLE_MS, thất bại giữ tới lần thử sau. */
function useActionResult() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!result?.ok) return undefined;
    const id = window.setTimeout(() => setResult(null), SUCCESS_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [result]);
  return [result, setResult];
}

/** Ô nhập khóa: kiểu password, nút mắt chỉ hiện/ẩn chữ đang gõ (không bao giờ có khóa thật đã lưu). */
function SecretInput({ id, label, value, onChange, error, disabled, autoFocus, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[13px] leading-5 font-medium text-bo-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Input
          aria-describedby={error ? `${id}-loi` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          autoFocus={autoFocus}
          className={settingsInputClass({ error: Boolean(error), className: "pr-10 font-mono text-[13px] placeholder:font-sans" })}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? `Ẩn ${label}` : `Hiện ${label}`}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1.5 text-slate-500 outline-none hover:text-bo-foreground focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          onClick={() => setVisible((v) => !v)}
          type="button"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? <SettingsFieldHint className="mt-1" error={error} id={`${id}-loi`} /> : null}
    </div>
  );
}

function InlineError({ result, title }) {
  if (!result || result.ok) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md bg-bo-danger-soft px-3 py-2.5 text-[13px] leading-5 text-bo-danger" role="alert">
      <XCircle className="mt-0.5 shrink-0" size={16} />
      <p className="min-w-0 break-words">
        <strong className="font-semibold">{title}</strong>
        <span className="text-slate-700"> · {formatTime(result.at)}</span>
        {result.message ? <span className="block text-slate-700">{result.message}</span> : null}
      </p>
    </div>
  );
}

function GuideDialog({ open, onOpenChange }) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="rounded-xl border-bo-border sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Hướng dẫn kết nối payOS</DialogTitle>
          <DialogDescription className="text-slate-600">Thực hiện một lần cho mỗi tài khoản payOS.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm leading-6 text-slate-700">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Đăng nhập{" "}
              <a className={linkClass} href={PAYOS_DASHBOARD_URL} rel="noreferrer" target="_blank">
                my.payos.vn
              </a>{" "}
              → <b>Kênh thanh toán</b> → <b>Thông tin cấu hình</b>, sao chép Client ID, API Key và Checksum Key.
            </li>
            <li>
              Dán 3 khóa vào dòng <b>Khóa kết nối</b> và bấm <b>Lưu và kiểm tra</b>. Hệ thống xác minh với payOS trước khi lưu (tạo
              rồi hủy ngay một mã thanh toán thử 2.000 ₫, không thu tiền); khóa sai sẽ không được lưu.
            </li>
            <li>Bấm <b>Đăng ký</b> ở dòng Webhook để payOS báo về ngay khi khách chuyển tiền.</li>
            <li>Bật công tắc <b>Chuyển khoản QR qua payOS</b>. Màn POS sẽ có thêm lựa chọn “Chuyển khoản (QR)”.</li>
          </ol>
          <div>
            <p className="mb-1.5 font-semibold text-bo-foreground">Cách hệ thống xử lý</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Khi tạo mã QR, hàng trong giỏ được giữ chỗ để kênh khác không bán mất.</li>
              <li>Khi tiền về, hệ thống kiểm tra chữ ký và số tiền rồi tạo đơn, trừ kho.</li>
              <li>Nếu chưa có webhook, màn POS tự hỏi payOS mỗi vài giây.</li>
              <li>Mã QR bị hủy hoặc hết hạn thì hàng giữ chỗ được trả lại kho.</li>
              <li>Khóa được mã hóa AES-256 trước khi lưu và không bao giờ hiển thị lại đầy đủ.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cấu hình › Thanh toán: một thẻ "Thanh toán tại quầy" — Tiền mặt (mặc định) và Chuyển khoản QR qua payOS
 * (công tắc bật tại POS + ô cài đặt: thời hạn mã QR, khóa kết nối, webhook; mỗi dòng sửa tại chỗ).
 * Khóa được mã hóa ở backend; trang này chỉ gửi khóa mới, không bao giờ nhận lại khóa thật.
 */
export default function PaymentSettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Dòng đang sửa trong ô cài đặt: null | "expiry" | "keys" | "webhook" (mỗi lúc một dòng)
  const [editingRow, setEditingRow] = useState(null);

  const [expiry, setExpiry] = useState(String(DEFAULT_EXPIRY));
  const [savingExpiry, setSavingExpiry] = useState(false);

  const [keyValues, setKeyValues] = useState(EMPTY_KEYS);
  const [keyErrors, setKeyErrors] = useState({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useActionResult();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [registering, setRegistering] = useState(false);
  const [webhookResult, setWebhookResult] = useActionResult();
  const [copied, setCopied] = useState(false);
  const [confirmReplaceWebhook, setConfirmReplaceWebhook] = useState(false);

  const [toggling, setToggling] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const expiryInputRef = useRef(null);

  const applyConfig = (data) => {
    setConfig(data);
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

  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(false), COPIED_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (editingRow === "expiry") expiryInputRef.current?.select();
  }, [editingRow]);

  const canStoreKeys = Boolean(config?.mayChuCoKhoaMaHoa);
  const hasKeys = Boolean(config?.daCauHinhDu);
  const enabled = hasKeys && Boolean(config?.kichHoat);
  const webhookConfirmed = Boolean(config?.webhookXacNhanLuc);
  const savedWebhookUrl = config?.webhookUrl || "";
  const savedExpiry = config?.thoiGianHetHanPhut ?? DEFAULT_EXPIRY;

  // Chưa có khóa thì dòng Khóa kết nối luôn ở dạng nhập lần đầu; chưa lưu URL thì dòng Webhook luôn cho nhập
  const keysEditing = !hasKeys || editingRow === "keys";
  const webhookEditing = !savedWebhookUrl || editingRow === "webhook";
  const webhookChanged = webhookUrl.trim() !== savedWebhookUrl;
  const hasKeyInput = Object.keys(enteredKeys(keyValues)).length > 0;

  const expiryNumber = Number(expiry);
  const expiryValid = /^\d+$/.test(expiry) && expiryNumber >= EXPIRY_MIN && expiryNumber <= EXPIRY_MAX;

  useUnsavedChanges(
    (editingRow === "expiry" && expiryNumber !== savedExpiry) ||
      hasKeyInput ||
      (editingRow === "webhook" && webhookChanged),
  );

  /** Mở sửa một dòng: bỏ dữ liệu đang nhập dở ở dòng khác. */
  const startEdit = (row) => {
    setExpiry(String(savedExpiry));
    setKeyValues(EMPTY_KEYS);
    setKeyErrors({});
    setWebhookUrl(savedWebhookUrl || config?.webhookUrlGoiY || "");
    setEditingRow(row);
  };
  const cancelEdit = () => startEdit(null);

  /* ---------- Thời hạn QR ---------- */

  const saveExpiry = async (event) => {
    event.preventDefault();
    if (savingExpiry || !expiryValid) return;
    if (expiryNumber === savedExpiry) {
      setEditingRow(null); // Không đổi gì → đóng chế độ sửa, không gọi API
      return;
    }
    setSavingExpiry(true);
    try {
      applyConfig(await paymentConfigService.updatePayos({ thoiGianHetHanPhut: expiryNumber }));
      setEditingRow(null);
      toast.success("Đã lưu thời hạn mã QR.");
    } catch (error) {
      // Lỗi: giữ nguyên chế độ sửa và giá trị đang nhập để thử lại
      toast.error(errorMessage(error, "Không lưu được thời hạn mã QR"));
    } finally {
      setSavingExpiry(false);
    }
  };

  /* ---------- Khóa kết nối ---------- */

  const changeKey = (name, value) => {
    setKeyValues((current) => ({ ...current, [name]: value }));
    setKeyErrors((current) => ({ ...current, [name]: undefined, form: undefined }));
  };

  const saveKeys = async (event) => {
    event.preventDefault();
    if (savingKeys) return;
    const mode = hasKeys ? "update" : "setup";
    const errors = validateKeys(keyValues, mode);
    if (Object.keys(errors).length) {
      setKeyErrors(errors);
      return;
    }
    setSavingKeys(true);
    setTestResult(null);
    try {
      // Chỉ gửi khóa có nhập; trường vắng mặt = backend giữ khóa đang lưu, ghép lại rồi
      // xác minh cả bộ với payOS trước khi lưu; khóa sai -> lỗi, không lưu.
      applyConfig(await paymentConfigService.updatePayos(enteredKeys(keyValues)));
      setKeyValues(EMPTY_KEYS);
      setKeyErrors({});
      setEditingRow(null);
      toast.success("Đã lưu và xác minh khóa kết nối.");
    } catch (error) {
      const message = errorMessage(error, "Không lưu được khóa");
      setKeyErrors((current) => ({ ...current, form: `${message} Khóa đang dùng không thay đổi.` }));
    } finally {
      setSavingKeys(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await paymentConfigService.testConnection();
      setTestResult(result ? { ...result, at: new Date() } : { ok: false, message: "Máy chủ không trả về kết quả kiểm tra.", at: new Date() });
    } catch (error) {
      setTestResult({ ok: false, message: errorMessage(error, "Không kiểm tra được kết nối"), at: new Date() });
    } finally {
      setTesting(false);
    }
  };

  /* ---------- Webhook ---------- */

  const registerWebhook = async () => {
    if (registering) return;
    setConfirmReplaceWebhook(false);
    setRegistering(true);
    setWebhookResult(null);
    try {
      applyConfig(await paymentConfigService.confirmWebhook(webhookUrl.trim()));
      setEditingRow(null);
      setWebhookResult({ ok: true, at: new Date() });
    } catch (error) {
      setWebhookResult({ ok: false, message: errorMessage(error, "payOS chưa xác nhận webhook."), at: new Date() });
    } finally {
      setRegistering(false);
    }
  };

  const onRegister = (event) => {
    event?.preventDefault();
    if (!hasKeys || !webhookUrl.trim() || registering) return;
    // Thay URL đã xác nhận bằng URL khác → hỏi lại vì payOS sẽ ngừng gọi URL cũ
    if (webhookConfirmed && webhookChanged) setConfirmReplaceWebhook(true);
    else registerWebhook();
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
    } catch {
      toast.error("Không sao chép được, hãy bôi đen và sao chép thủ công.");
    }
  };

  /* ---------- Bật/tắt tại POS ---------- */

  const setEnabled = async (checked) => {
    if (toggling) return;
    setToggling(true);
    try {
      applyConfig(await paymentConfigService.updatePayos({ kichHoat: checked }));
      setConfirmDisable(false);
      toast.success(checked ? "Đã bật chuyển khoản QR tại POS." : "Đã tắt chuyển khoản QR tại POS.");
    } catch (error) {
      toast.error(errorMessage(error, "Không đổi được trạng thái"));
    } finally {
      setToggling(false);
    }
  };

  // Tắt ảnh hưởng thu ngân đang bán → hỏi lại ngay trong dòng
  const onToggle = (checked) => (checked ? setEnabled(true) : setConfirmDisable(true));

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <SettingsCard>
        <LoadingState className="min-h-48" label="Đang tải cấu hình thanh toán" />
      </SettingsCard>
    );
  }
  if (loadError) {
    return (
      <SettingsCard>
        <ErrorState
          className="min-h-48"
          description="Không tải được cấu hình thanh toán. Vui lòng thử lại hoặc liên hệ bộ phận kỹ thuật."
          onRetry={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
          title="Lỗi tải cấu hình"
        />
      </SettingsCard>
    );
  }

  const qrDescription = !hasKeys
    ? "Lưu khóa kết nối bên dưới để bật chuyển khoản QR tại POS."
    : enabled
      ? "Đang bật: màn POS có lựa chọn “Chuyển khoản (QR)”."
      : "Đang tắt: thu ngân chỉ nhận tiền mặt.";

  return (
    <div className="flex flex-col gap-4">
      {!canStoreKeys ? (
        <div className="flex gap-3 rounded-lg bg-bo-danger-soft p-3 text-sm text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>
            Máy chủ chưa đặt biến môi trường <code className="font-mono">PAYMENT_CONFIG_SECRET</code> nên chưa thể lưu khóa an
            toàn. Liên hệ người quản trị máy chủ.
          </p>
        </div>
      ) : null}

      <SettingsCard aria-labelledby="thanh-toan-tieu-de">
        <SettingsCardHeader title="Thanh toán tại quầy" titleId="thanh-toan-tieu-de" />

        <div className="px-5">
          {/* ----- Tiền mặt ----- */}
          <div className="flex items-center gap-x-6 gap-y-3 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-medium text-bo-foreground">Tiền mặt</p>
              <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">Luôn dùng được tại POS.</p>
            </div>
            <SettingsPill>Mặc định</SettingsPill>
          </div>

          {/* ----- Chuyển khoản QR qua payOS ----- */}
          <div className="border-t border-[#eef1f5] pt-3.5 pb-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-0 flex-[1_1_300px]">
                <p className="flex flex-wrap items-center gap-2 text-sm leading-5 font-medium text-bo-foreground">
                  <span id="payos-bat-tai-pos">Chuyển khoản QR qua payOS</span>
                  <StatusBadge label={hasKeys ? "Đã kết nối" : "Chưa kết nối"} />
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">{qrDescription}</p>
              </div>
              {!confirmDisable ? (
                <Switch
                  aria-labelledby="payos-bat-tai-pos"
                  checked={enabled}
                  className="h-6 w-10 data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:size-[18px] [&>span]:bg-bo-surface [&>span]:data-[state=checked]:translate-x-[18px] [&>span]:data-[state=unchecked]:translate-x-0.5"
                  disabled={toggling || !hasKeys}
                  onCheckedChange={onToggle}
                />
              ) : null}
            </div>

            {confirmDisable ? (
              <div
                aria-label="Xác nhận tắt chuyển khoản QR"
                className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md bg-bo-warning-soft px-3 py-2.5"
                role="alertdialog"
              >
                <span className="text-[13px] leading-5 text-orange-900">
                  Tắt chuyển khoản QR? Thu ngân sẽ không tạo được mã QR mới cho đến khi bật lại.
                </span>
                <div className="flex gap-2">
                  <Button
                    autoFocus
                    className={OUTLINE_BUTTON}
                    disabled={toggling}
                    onClick={() => setConfirmDisable(false)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Giữ bật
                  </Button>
                  <Button
                    className="border border-red-200 bg-bo-surface text-bo-danger-strong shadow-none hover:bg-bo-danger-soft"
                    disabled={toggling}
                    onClick={() => setEnabled(false)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {toggling ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                    Tắt
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Ô cài đặt payOS: mỗi dòng sửa tại chỗ */}
            <div className="mt-3 rounded-md border border-[#eef1f5] bg-bo-surface-subtle px-3.5">
              {/* Thời hạn mã QR */}
              <form
                className={rowClass}
                noValidate
                onKeyDown={(event) => {
                  if (event.key === "Escape" && editingRow === "expiry" && !savingExpiry) {
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
                onSubmit={saveExpiry}
              >
                <div className={rowLabelClass}>
                  {editingRow === "expiry" ? <label htmlFor="payos-thoi-han">Thời hạn mã QR</label> : "Thời hạn mã QR"}
                </div>
                {editingRow === "expiry" ? (
                  <div className="flex min-w-0 flex-[1_1_360px] flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="relative w-[120px]">
                      <Input
                        aria-describedby="payos-thoi-han-pham-vi"
                        aria-invalid={!expiryValid}
                        autoComplete="off"
                        autoFocus
                        className={settingsInputClass({ error: !expiryValid, className: "pr-11 text-right font-medium tabular-nums" })}
                        disabled={savingExpiry}
                        id="payos-thoi-han"
                        inputMode="numeric"
                        maxLength={3}
                        onChange={(event) => setExpiry(event.target.value)}
                        ref={expiryInputRef}
                        type="text"
                        value={expiry}
                      />
                      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-bo-muted">
                        phút
                      </span>
                    </div>
                    <SettingsFieldHint error={expiryValid ? "" : `Nhập từ ${EXPIRY_MIN} đến ${EXPIRY_MAX}`} id="payos-thoi-han-pham-vi">
                      {EXPIRY_MIN}–{EXPIRY_MAX} phút
                    </SettingsFieldHint>
                    <span className="ml-auto flex gap-2">
                      <Button className={OUTLINE_BUTTON} disabled={savingExpiry} onClick={cancelEdit} size="sm" type="button" variant="outline">
                        Hủy
                      </Button>
                      <Button className={PRIMARY_BUTTON} disabled={!expiryValid || savingExpiry} size="sm" type="submit">
                        {savingExpiry ? "Đang lưu…" : "Lưu"}
                      </Button>
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="min-w-0 flex-[1_1_260px] text-sm leading-5">
                      <span className="font-semibold text-bo-foreground tabular-nums">{savedExpiry} phút</span>
                      <span className="text-[#5b6676]"> · quá hạn chưa nhận tiền thì mã bị hủy, hàng giữ chỗ trả lại kho</span>
                    </p>
                    <SettingsTextButton aria-label="Sửa thời hạn mã QR" onClick={() => startEdit("expiry")}>
                      Sửa
                    </SettingsTextButton>
                  </>
                )}
              </form>

              {/* Khóa kết nối */}
              <form className={cn(rowClass, "border-t border-[#e8ecf1]")} noValidate onSubmit={saveKeys}>
                <div className={rowLabelClass}>Khóa kết nối</div>
                {keysEditing ? (
                  <>
                    <div className="grid min-w-0 flex-[1_1_100%] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-3 gap-y-2.5">
                      {KEY_FIELDS.map((field, index) => (
                        <SecretInput
                          autoFocus={hasKeys && index === 0}
                          disabled={!canStoreKeys || savingKeys}
                          error={keyErrors[field.name]}
                          id={`payos-${field.name}`}
                          key={field.name}
                          label={field.label}
                          onChange={(value) => changeKey(field.name, value)}
                          placeholder={hasKeys ? "Trống = giữ khóa cũ" : undefined}
                          value={keyValues[field.name]}
                        />
                      ))}
                    </div>
                    {keyErrors.form ? (
                      <p className="flex-[1_1_100%] rounded-md bg-bo-danger-soft px-3 py-2 text-[13px] leading-5 text-red-800" role="alert">
                        {keyErrors.form}
                      </p>
                    ) : null}
                    <div className="flex flex-[1_1_100%] flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <span className="text-xs leading-4 text-bo-muted">
                        Lấy tại{" "}
                        <a className={linkClass} href={PAYOS_DASHBOARD_URL} rel="noreferrer" target="_blank">
                          my.payos.vn
                        </a>{" "}
                        → Kênh thanh toán → Thông tin cấu hình. Hệ thống thử kết nối trước khi lưu; khóa sai sẽ không được lưu.
                      </span>
                      <span className="ml-auto flex gap-2">
                        {hasKeys ? (
                          <Button className={OUTLINE_BUTTON} disabled={savingKeys} onClick={cancelEdit} size="sm" type="button" variant="outline">
                            Hủy
                          </Button>
                        ) : null}
                        <Button
                          aria-busy={savingKeys}
                          className={PRIMARY_BUTTON}
                          disabled={!canStoreKeys || savingKeys || !hasKeyInput}
                          size="sm"
                          type="submit"
                        >
                          {savingKeys ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                          {savingKeys ? "Đang xác minh…" : "Lưu và kiểm tra"}
                        </Button>
                      </span>
                    </div>
                    {enabled && hasKeys ? (
                      <p className="flex-[1_1_100%] text-xs leading-4 text-orange-800">
                        POS đang dùng khóa hiện tại. Nếu đổi sang kênh payOS khác, cần đăng ký lại webhook sau khi lưu.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <dl className="flex min-w-0 flex-[1_1_260px] flex-wrap items-baseline gap-x-7 gap-y-1">
                      {KEY_FIELDS.map((field) => (
                        <div className="inline-flex items-baseline gap-2" key={field.name}>
                          <dt className="text-[13px] leading-5 text-[#5b6676]">{field.label}</dt>
                          <dd className="font-mono text-[13px] leading-5 font-medium tracking-[0.02em] text-bo-foreground" title={config?.[field.maskedKey]}>
                            {shortMasked(config?.[field.maskedKey])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <SettingsTextButton disabled={!canStoreKeys} onClick={() => startEdit("keys")}>
                      Cập nhật
                    </SettingsTextButton>
                  </>
                )}
              </form>

              {/* Webhook */}
              <form className={cn(rowClass, "border-t border-[#e8ecf1]")} noValidate onSubmit={onRegister}>
                <div className={rowLabelClass}>
                  {webhookEditing ? <label htmlFor="payos-webhook">Webhook</label> : "Webhook"}
                </div>
                <div className="flex min-w-0 flex-[1_1_260px] flex-wrap items-center gap-x-2 gap-y-1">
                  {webhookEditing ? (
                    <Input
                      className={settingsInputClass({ className: "min-w-0 flex-1 font-mono text-[13px] placeholder:font-sans" })}
                      disabled={!hasKeys || registering}
                      id="payos-webhook"
                      onChange={(event) => {
                        setWebhookUrl(event.target.value);
                        setWebhookResult(null); // lỗi cũ không còn đúng với URL mới
                      }}
                      placeholder={`https://<địa-chỉ-máy-chủ>${WEBHOOK_PATH}`}
                      spellCheck={false}
                      type="url"
                      value={webhookUrl}
                    />
                  ) : (
                    <span className="min-w-0 font-mono text-[13px] leading-5 break-all text-slate-700">{webhookUrl}</span>
                  )}
                  <button
                    aria-label={copied ? "Đã sao chép Webhook URL" : "Sao chép Webhook URL"}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[#5b6676] hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary disabled:opacity-50"
                    disabled={!webhookUrl}
                    onClick={copyWebhook}
                    title={copied ? "Đã sao chép" : "Sao chép"}
                    type="button"
                  >
                    {copied ? <Check className="text-bo-success" size={15} /> : <Copy size={15} />}
                  </button>
                  {!webhookEditing ? (
                    <StatusBadge label={webhookConfirmed ? "Đã đăng ký" : "Chưa đăng ký"} />
                  ) : null}
                </div>
                <span className="flex items-center gap-1">
                  {webhookEditing && savedWebhookUrl ? (
                    <Button className={OUTLINE_BUTTON} disabled={registering} onClick={cancelEdit} size="sm" type="button" variant="outline">
                      Hủy
                    </Button>
                  ) : null}
                  {webhookEditing ? (
                    <Button
                      aria-busy={registering}
                      className={PRIMARY_BUTTON}
                      disabled={registering || !hasKeys || !webhookUrl.trim() || (Boolean(savedWebhookUrl) && !webhookChanged)}
                      size="sm"
                      type="submit"
                    >
                      {registering ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                      Đăng ký
                    </Button>
                  ) : (
                    <>
                      <SettingsTextButton className="mr-0" disabled={!hasKeys} onClick={() => startEdit("webhook")}>
                        Đổi URL
                      </SettingsTextButton>
                      <SettingsTextButton aria-busy={registering} disabled={registering || !hasKeys} type="submit">
                        {registering ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                        {webhookConfirmed ? "Đăng ký lại" : "Đăng ký"}
                      </SettingsTextButton>
                    </>
                  )}
                </span>
                <p className="flex-[1_1_100%] text-xs leading-4 text-bo-muted" role="status">
                  {!hasKeys
                    ? "Lưu khóa kết nối trước khi đăng ký webhook."
                    : webhookResult?.ok
                      ? "Đã đăng ký webhook với payOS."
                      : webhookConfirmed
                        ? `payOS xác nhận lúc ${formatDateTime(config.webhookXacNhanLuc)}.`
                        : "Chưa đăng ký: hệ thống phải tự hỏi payOS định kỳ nên xác nhận tiền về có thể chậm hơn."}
                </p>
              </form>
            </div>
            <div className="mt-3 empty:hidden">
              <InlineError result={webhookResult} title="Đăng ký webhook thất bại" />
              <InlineError result={testResult} title="Kết nối thất bại" />
            </div>
          </div>
        </div>

        {/* Chân thẻ: kết quả kiểm tra gần nhất + hướng dẫn + kiểm tra kết nối */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#eef1f5] px-5 py-3">
          <p className="text-[13px] leading-5 text-bo-muted" role="status">
            {testResult?.ok ? <span className="font-medium text-bo-success">Kết nối thành công lúc {formatTime(testResult.at)} · </span> : null}
            <button className={linkClass} onClick={() => setGuideOpen(true)} type="button">
              Hướng dẫn kết nối payOS
            </button>
          </p>
          {hasKeys ? (
            <Button aria-busy={testing} className={OUTLINE_BUTTON} disabled={testing} onClick={runTest} size="sm" type="button" variant="outline">
              {testing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
              {testing ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
            </Button>
          ) : null}
        </div>
      </SettingsCard>

      <ConfirmModal
        confirmText="Đăng ký URL mới"
        description="payOS sẽ gửi thông báo thanh toán tới URL mới và ngừng gọi URL đang dùng."
        isLoading={registering}
        isOpen={confirmReplaceWebhook}
        onClose={() => !registering && setConfirmReplaceWebhook(false)}
        onConfirm={registerWebhook}
        title="Thay Webhook URL?"
        variant="danger"
      />

      <GuideDialog onOpenChange={setGuideOpen} open={guideOpen} />
    </div>
  );
}
