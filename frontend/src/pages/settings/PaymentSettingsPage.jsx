import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Link2,
  LoaderCircle,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { paymentConfigService } from "@/services/paymentConfigService";

/**
 * Logo payOS chính thức: đặt file SVG tại src/assets/brands/payos-logo.svg.
 * Dùng import.meta.glob để thiếu file vẫn build được (khi đó hiện chữ "payOS").
 */
const brandLogos = import.meta.glob("/src/assets/brands/payos-logo.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const PAYOS_LOGO_URL = Object.values(brandLogos)[0] || null;

const PAYOS_DASHBOARD_URL = "https://my.payos.vn";
const WEBHOOK_PATH = "/api/v1/payos/webhook";
const EXPIRY_MIN = 3;
const EXPIRY_MAX = 60;
const DEFAULT_EXPIRY = 15;
const EXPIRY_HELP = `Hết thời hạn mà chưa nhận tiền, mã QR bị hủy và hàng giữ chỗ được trả lại kho. Từ ${EXPIRY_MIN} đến ${EXPIRY_MAX} phút.`;

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

// Style riêng của trang (chỉ là class Tailwind, không ảnh hưởng màn khác)
const inputClass =
  "h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";
const readonlyBoxClass =
  "flex h-10 min-w-0 flex-1 items-center rounded-lg border border-bo-border bg-bo-surface-subtle px-3 font-mono text-sm text-bo-foreground";
// Button dùng chung chưa có màu ring nên focus bàn phím không hiện: tự thêm ring bo-* ở đây.
const primaryButtonClass =
  "h-10 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover focus-visible:ring-2 focus-visible:ring-bo-primary/40 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100";
const secondaryButtonClass =
  "h-10 rounded-lg border-bo-border bg-bo-surface px-4 text-bo-foreground shadow-none hover:bg-bo-surface-subtle focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:bg-bo-surface-subtle disabled:text-slate-500 disabled:opacity-100";
// Icon trong nút: cùng cỡ, cùng nét; nút viền thêm màu xám slate-500
const buttonIconProps = { "aria-hidden": true, size: 16, strokeWidth: 1.75 };
const outlineIconClass = "text-slate-500";
const subText = "text-sm leading-6 text-slate-600";
const linkClass = "font-medium text-bo-primary hover:underline";

/**
 * Thông điệp lỗi KHÔNG che nguyên nhân: ưu tiên message của backend; không có thì nêu
 * mã HTTP hoặc loại lỗi mạng để biết request hỏng ở đâu. Không bao giờ in khóa.
 */
const errorMessage = (error, fallback) => {
  const response = error?.response;
  const serverMessage = response?.data?.message;
  if (serverMessage) return serverMessage;
  if (response) {
    const body =
      typeof response.data === "string"
        ? response.data.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
        : "";
    return `${fallback}: máy chủ trả HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${body ? ` — ${body}` : ""}.`;
  }
  if (error?.code === "ECONNABORTED") return `${fallback}: hết thời gian chờ phản hồi từ máy chủ.`;
  if (error?.request) return `${fallback}: không nhận được phản hồi từ máy chủ (backend chưa chạy, sai địa chỉ API hoặc mạng bị chặn).`;
  return `${fallback}${error?.message ? `: ${error.message}` : "."}`;
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

/* ------------------------------------------------------------------ */
/* Thành phần dùng chung trong trang                                   */
/* ------------------------------------------------------------------ */

/**
 * Card: header → body (giãn) → footer.
 * Khi lưới cha đủ rộng để chia 2 cột (container ≥ 56rem), card chiếm 3 hàng của lưới cha
 * và dùng subgrid, nên header/body/footer của các card cùng hàng luôn cao bằng nhau
 * và tăng đồng bộ khi nội dung xuống dòng — không cần margin hay khoảng trắng giả.
 */
function Card({ icon, title, description, aside, children, footer }) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-bo-border bg-bo-surface shadow-sm @4xl:row-span-3 @4xl:grid @4xl:grid-rows-subgrid @4xl:gap-0">
      <header className="flex items-start justify-between gap-4 border-b border-bo-border px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? <span className="mt-0.5 text-slate-500">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-bo-foreground">{title}</h2>
            {description ? <p className={cn("mt-0.5", subText)}>{description}</p> : null}
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-bo-border px-4 py-4 sm:px-6">{footer}</footer>
    </section>
  );
}

/** Nhãn nút lưu khóa; nhãn đang tải ngắn gọn để vừa min-w của nút, không làm nút giãn ra. */
function SaveKeysLabel({ saving }) {
  if (!saving) return "Lưu và kiểm tra";
  return (
    <>
      <LoaderCircle {...buttonIconProps} className="animate-spin" />
      Đang xác minh…
    </>
  );
}

/** Chỉ đường lấy khóa trên payOS — chỉ hiện ở nơi đang nhập khóa (lần đầu, hộp thoại cập nhật). */
function KeySourceHint() {
  return (
    <>
      Lấy tại{" "}
      <a className={linkClass} href={PAYOS_DASHBOARD_URL} rel="noreferrer" target="_blank">
        my.payos.vn
      </a>{" "}
      → Kênh thanh toán → Thông tin cấu hình.
    </>
  );
}

function StatusPill({ tone, children }) {
  const tones = {
    success: "bg-bo-success-soft text-bo-success",
    danger: "bg-bo-danger-soft text-bo-danger",
    neutral: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Ô nhập khóa: kiểu password, nút mắt chỉ hiện/ẩn chữ đang gõ (không bao giờ có khóa thật đã lưu). */
function SecretInput({ id, label, value, onChange, error, disabled, autoFocus, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-bo-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          autoFocus={autoFocus}
          className={cn(
            inputClass,
            "pr-10 font-mono placeholder:font-sans",
            error && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15",
          )}
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
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 outline-none hover:text-bo-foreground focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          onClick={() => setVisible((v) => !v)}
          type="button"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-bo-danger" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Bộ 3 ô khóa — dùng cho lần thiết lập đầu và hộp thoại cập nhật khóa.
 * Ô luôn bắt đầu trống: không bao giờ điền khóa thật hay chuỗi đã che vào input.
 */
function KeyFormFields({ idPrefix, values, errors, onChange, disabled, placeholder }) {
  return (
    <div className="space-y-4">
      {KEY_FIELDS.map((field, index) => (
        <SecretInput
          autoFocus={index === 0}
          disabled={disabled}
          error={errors[field.name]}
          id={`${idPrefix}-${field.name}`}
          key={field.name}
          label={field.label}
          onChange={(v) => onChange(field.name, v)}
          placeholder={placeholder}
          value={values[field.name]}
        />
      ))}
      {errors.form ? (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm text-red-800" role="alert">
          <XCircle className="mt-0.5 shrink-0" size={16} />
          <p className="min-w-0 break-words">{errors.form}</p>
        </div>
      ) : null}
    </div>
  );
}

const KEEP_KEY_PLACEHOLDER = "Giữ nguyên khóa đang lưu";
const CHANNEL_KEYS_REQUIRED = "Khi nhập Client ID, hãy cung cấp đầy đủ bộ khóa của kênh.";

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

/*
 * Phản hồi cho nút trong card (Kiểm tra kết nối, Đăng ký webhook) — cùng một kiểu:
 * - Thành công: một dòng ngắn ngay cạnh nút vừa bấm, tự ẩn sau vài giây.
 * - Thất bại: khung đỏ trong card, giữ lại tới lần thử sau vì người dùng cần đọc lý do để sửa.
 * Thao tác ở thanh trên cùng (thời hạn QR, bật/tắt POS) vẫn dùng toast vì không có card riêng.
 */
const SUCCESS_VISIBLE_MS = 4000;
const COPIED_VISIBLE_MS = 1500;

/** Kết quả thao tác {ok, message, at}; tự xóa khi thành công sau SUCCESS_VISIBLE_MS. */
function useActionResult() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!result?.ok) return undefined;
    const id = window.setTimeout(() => setResult(null), SUCCESS_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [result]);
  return [result, setResult];
}

/** Vùng role="status" luôn có mặt để trình đọc màn hình đọc được khi nội dung xuất hiện. */
function InlineSuccess({ show, children }) {
  return (
    <p className="mr-auto text-sm" role="status">
      {show ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-bo-success animate-in fade-in-0 duration-300 motion-reduce:animate-none">
          <CheckCircle2 size={16} /> {children}
        </span>
      ) : null}
    </p>
  );
}

function InlineError({ result, title }) {
  if (!result || result.ok) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger" role="alert">
      <XCircle className="mt-0.5 shrink-0" size={16} />
      <p className="min-w-0 break-words">
        <strong className="font-semibold">{title}</strong>
        <span className="text-slate-700"> · {formatTime(result.at)}</span>
        {result.message ? <span className="block text-slate-700">{result.message}</span> : null}
      </p>
    </div>
  );
}

function SetupStep({ index, done, children }) {
  return (
    <li className="flex items-center gap-2.5">
      {done ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bo-success text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : (
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-slate-300 bg-bo-surface text-xs font-semibold text-slate-700">
          {index}
        </span>
      )}
      {/* Bước xong: dấu tích xanh + chữ nhạt  */}
      <span className={cn("text-sm", done ? "text-slate-600" : "font-medium text-bo-foreground")}>
        {children}
        {done ? <span className="sr-only"> (đã xong)</span> : null}
      </span>
    </li>
  );
}

/**
 * "Thời hạn QR" trong thanh payOS: chế độ xem (giá trị đã lưu + nút sửa) và chế độ sửa
 * (ô số + "phút" + Lưu/Hủy). Enter để lưu, Esc để hủy; đóng chế độ sửa thì trả focus về nút sửa.
 */
function QrExpiryControl({ savedValue, editing, value, valid, saving, errorId, onChange, onEdit, onCancel, onSave }) {
  const inputRef = useRef(null);
  const editButtonRef = useRef(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) {
      editButtonRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 @max-lg:w-full @max-lg:justify-between">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-bo-foreground" htmlFor={editing ? "payos-expiry" : undefined} id="payos-expiry-label">
          Thời hạn QR
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Giải thích thời hạn QR"
              className="grid size-7 place-items-center rounded-full text-slate-500 outline-none hover:text-bo-foreground focus-visible:ring-2 focus-visible:ring-bo-primary/30"
              type="button"
            >
              <Info size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 bg-bo-foreground text-left leading-5 text-white" sideOffset={6}>
            {EXPIRY_HELP}
          </TooltipContent>
        </Tooltip>
      </div>

      {editing ? (
        <form
          className="flex items-center gap-2"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !saving) {
              event.preventDefault();
              onCancel();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div
            className={cn(
              "flex h-10 w-[6.5rem] items-center rounded-lg border border-bo-border bg-bo-surface focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15",
              !valid && "border-bo-danger focus-within:border-bo-danger focus-within:ring-bo-danger/15",
            )}
          >
            <input
              aria-describedby={!valid ? errorId : undefined}
              aria-invalid={!valid}
              className="h-full min-w-0 flex-1 bg-transparent pl-3 text-sm tabular-nums text-bo-foreground outline-none [appearance:textfield] disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={saving}
              id="payos-expiry"
              inputMode="numeric"
              max={EXPIRY_MAX}
              min={EXPIRY_MIN}
              onChange={(event) => onChange(event.target.value)}
              ref={inputRef}
              type="number"
              value={value}
            />
            <span className="pr-3 text-sm text-slate-600">phút</span>
          </div>
          {/* Đang lưu: chỉ hiện vòng xoay (chữ cho trình đọc màn hình) để nút gọn không đổi cỡ */}
          <Button aria-busy={saving} className={cn(primaryButtonClass, "min-w-14 px-3")} disabled={!valid || saving} type="submit">
            {saving ? (
              <>
                <LoaderCircle {...buttonIconProps} className="animate-spin" />
                <span className="sr-only">Đang lưu…</span>
              </>
            ) : (
              "Lưu"
            )}
          </Button>
          <Button className={cn(secondaryButtonClass, "px-3")} disabled={saving} onClick={onCancel} type="button" variant="outline">
            Hủy
          </Button>
        </form>
      ) : (
        <div className="flex h-10 items-center gap-1 rounded-lg border border-bo-border bg-bo-surface-subtle pl-3 pr-1">
          <span className="text-sm tabular-nums text-bo-foreground">
            {savedValue} phút
          </span>
          <button
            aria-label="Sửa thời hạn QR"
            className="grid size-8 place-items-center rounded-md text-slate-600 outline-none hover:bg-bo-surface hover:text-bo-foreground focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            onClick={onEdit}
            ref={editButtonRef}
            type="button"
          >
            <Pencil {...buttonIconProps} />
          </button>
        </div>
      )}
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
            <li>Dán 3 khóa vào mục <b>Khóa kết nối</b> và lưu. Hệ thống xác minh với payOS trước khi lưu (tạo rồi hủy ngay một link 2.000đ, không thu tiền); khóa sai sẽ không được lưu.</li>
            <li>Bấm <b>Đăng ký webhook</b> để payOS báo về ngay khi khách chuyển tiền.</li>
            <li>Bật <b>Bật tại POS</b>. Màn POS sẽ có thêm lựa chọn “Chuyển khoản (QR)”.</li>
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
          {import.meta.env.DEV ? (
            <p className="rounded-lg bg-bo-surface-subtle px-3 py-2 text-xs leading-5 text-slate-700">
              Máy dev: chạy <code className="font-mono">ngrok http 8080</code>, dùng link https của ngrok +{" "}
              <code className="break-all font-mono">{WEBHOOK_PATH}</code> làm Webhook URL.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Trang                                                               */
/* ------------------------------------------------------------------ */

/**
 * Cài đặt → Thanh toán: kết nối payOS cho thanh toán chuyển khoản QR tại quầy.
 * Khóa được mã hóa ở backend; trang này chỉ gửi khóa mới, không bao giờ nhận lại khóa thật.
 */
export default function PaymentSettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Khóa kết nối
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyValues, setKeyValues] = useState(EMPTY_KEYS);
  const [keyErrors, setKeyErrors] = useState({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useActionResult();

  // Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [editingWebhook, setEditingWebhook] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [webhookResult, setWebhookResult] = useActionResult();
  const [copied, setCopied] = useState(false);
  const [confirmReplaceWebhook, setConfirmReplaceWebhook] = useState(false);

  // Thời hạn mã QR: `expiry` là giá trị đang nhập, chỉ dùng khi đang sửa
  const [expiry, setExpiry] = useState(String(DEFAULT_EXPIRY));
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [savingExpiry, setSavingExpiry] = useState(false);

  // Bật/tắt POS
  const [toggling, setToggling] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const [guideOpen, setGuideOpen] = useState(false);

  const applyConfig = (data) => {
    setConfig(data);
    setWebhookUrl(data?.webhookUrl || data?.webhookUrlGoiY || "");
    setEditingWebhook(false);
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

  /* ---------- Khóa kết nối ---------- */

  const changeKey = (name, value) => {
    setKeyValues((current) => ({ ...current, [name]: value }));
    setKeyErrors((current) => ({ ...current, [name]: undefined, form: undefined }));
  };

  const resetKeyForm = () => {
    setKeyValues(EMPTY_KEYS);
    setKeyErrors({});
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null); // không để kết quả cũ đứng cạnh lần kiểm tra mới
    try {
      const result = await paymentConfigService.testConnection();
      setTestResult(result ? { ...result, at: new Date() } : { ok: false, message: "Máy chủ không trả về kết quả kiểm tra.", at: new Date() });
    } catch (error) {
      setTestResult({ ok: false, message: errorMessage(error, "Không kiểm tra được kết nối"), at: new Date() });
    } finally {
      setTesting(false);
    }
  };

  /** mode "setup" (lần đầu, đủ 3 khóa) hoặc "update" (hộp thoại, chỉ khóa cần đổi). */
  const saveKeys = async (mode) => {
    if (savingKeys) return;
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
      const data = await paymentConfigService.updatePayos(enteredKeys(keyValues));
      applyConfig(data);
      resetKeyForm();
      setKeyDialogOpen(false);
      // Một thông báo là đủ: backend chỉ lưu khi payOS đã xác minh cả 3 khóa
      toast.success("Đã lưu và xác minh khóa kết nối");
    } catch (error) {
      // Chỉ báo trong khung đỏ của form (cạnh ô khóa), không thêm toast trùng nội dung
      const message = errorMessage(error, "Không lưu được khóa");
      setKeyErrors((current) => ({ ...current, form: `${message} Khóa đang dùng không thay đổi.` }));
    } finally {
      setSavingKeys(false);
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
      setWebhookResult({ ok: true, at: new Date() });
    } catch (error) {
      setWebhookResult({ ok: false, message: errorMessage(error, "payOS chưa xác nhận webhook."), at: new Date() });
    } finally {
      setRegistering(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
    } catch {
      toast.error("Không sao chép được, hãy bôi đen và sao chép thủ công");
    }
  };

  /* ---------- Thời hạn QR ---------- */

  const savedExpiry = config?.thoiGianHetHanPhut ?? DEFAULT_EXPIRY;

  const startEditExpiry = () => {
    setExpiry(String(savedExpiry));
    setEditingExpiry(true);
  };

  // Hủy: bỏ giá trị đang nhập, khôi phục giá trị đã lưu
  const cancelEditExpiry = () => {
    setExpiry(String(savedExpiry));
    setEditingExpiry(false);
  };

  const saveExpiry = async () => {
    if (savingExpiry) return;
    const value = Number(expiry);
    if (!(expiry !== "" && Number.isInteger(value) && value >= EXPIRY_MIN && value <= EXPIRY_MAX)) return;
    if (value === savedExpiry) {
      setEditingExpiry(false); // Không đổi gì → đóng chế độ sửa, không gọi API
      return;
    }
    setSavingExpiry(true);
    try {
      applyConfig(await paymentConfigService.updatePayos({ thoiGianHetHanPhut: value }));
      setEditingExpiry(false);
      toast.success("Đã lưu thời hạn mã QR");
    } catch (error) {
      // Lỗi: giữ nguyên chế độ sửa và giá trị đang nhập để người dùng thử lại
      toast.error(errorMessage(error, "Không lưu được thời hạn mã QR"));
    } finally {
      setSavingExpiry(false);
    }
  };

  /* ---------- Bật/tắt POS ---------- */

  const setEnabled = async (checked) => {
    if (toggling) return;
    setToggling(true);
    try {
      applyConfig(await paymentConfigService.updatePayos({ kichHoat: checked }));
      setConfirmDisable(false);
      toast.success(checked ? "Đã bật chuyển khoản QR tại POS" : "Đã tắt chuyển khoản QR tại POS");
    } catch (error) {
      toast.error(errorMessage(error, "Không đổi được trạng thái"));
    } finally {
      setToggling(false);
    }
  };

  const onToggle = (checked) => {
    if (checked) setEnabled(true);
    else setConfirmDisable(true); // Tắt ảnh hưởng thu ngân đang bán → cần xác nhận
  };

  /* ---------- Render ---------- */

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

  const canStoreKeys = Boolean(config?.mayChuCoKhoaMaHoa);
  const hasKeys = Boolean(config?.daCauHinhDu);
  const enabled = hasKeys && Boolean(config?.kichHoat);
  const webhookConfirmed = Boolean(config?.webhookXacNhanLuc);
  const savedWebhookUrl = config?.webhookUrl || "";
  const webhookEditable = !savedWebhookUrl || editingWebhook;
  const webhookChanged = webhookUrl.trim() !== savedWebhookUrl;
  const isReregister = webhookConfirmed && !editingWebhook;
  const hasKeyInput = Object.keys(enteredKeys(keyValues)).length > 0;

  const expiryNumber = Number(expiry);
  const expiryValid = expiry !== "" && Number.isInteger(expiryNumber) && expiryNumber >= EXPIRY_MIN && expiryNumber <= EXPIRY_MAX;
  const showExpiryError = editingExpiry && !expiryValid;

  const setupComplete = hasKeys && webhookConfirmed && enabled;

  const onRegisterClick = () => {
    // Thay URL đã xác nhận bằng URL khác → hỏi lại vì payOS sẽ ngừng gọi URL cũ
    if (webhookConfirmed && webhookChanged) setConfirmReplaceWebhook(true);
    else registerWebhook();
  };

  return (
    <PageContainer>
      <PageHeader title="Thanh toán" />

      {!canStoreKeys ? (
        <div className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-bo-danger-soft p-3 text-sm text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>
            Máy chủ chưa đặt biến môi trường <code className="font-mono">PAYMENT_CONFIG_SECRET</code> nên chưa thể lưu khóa an toàn.
            Liên hệ người quản trị máy chủ.
          </p>
        </div>
      ) : null}

      {/* ===== Thanh payOS: thông tin + thời hạn QR + công tắc POS; dải tiến độ chỉ khi chưa thiết lập xong ===== */}
      <section className="@container overflow-hidden rounded-xl border border-bo-border bg-bo-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-8 shrink-0 items-center border-r border-bo-border pr-4">
              {PAYOS_LOGO_URL ? (
                <img alt="payOS" className="h-7 w-auto max-w-none object-contain" src={PAYOS_LOGO_URL} />
              ) : (
                <span className="text-xl font-bold tracking-tight text-bo-foreground">payOS</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-bo-foreground">Chuyển khoản QR tại quầy</p>
              <p className={subText}>Khi bật, màn POS có thêm lựa chọn “Chuyển khoản (QR)”.</p>
            </div>
          </div>

          {/* Dưới 68rem nhóm điều khiển luôn xuống hàng riêng, ở cả chế độ xem lẫn sửa, nên bấm "Sửa" không làm nhảy bố cục */}
          <div className="flex basis-full flex-wrap items-center gap-x-5 gap-y-3 @[68rem]:basis-auto">
            <QrExpiryControl
              editing={editingExpiry}
              errorId="payos-expiry-error"
              onCancel={cancelEditExpiry}
              onChange={setExpiry}
              onEdit={startEditExpiry}
              onSave={saveExpiry}
              savedValue={savedExpiry}
              saving={savingExpiry}
              valid={expiryValid}
              value={expiry}
            />
            <span aria-hidden="true" className="hidden h-8 w-px bg-bo-border @[68rem]:block" />
            <div className="ml-auto flex items-center gap-3 @max-lg:order-first @max-lg:w-full @max-lg:justify-between @[68rem]:ml-0">
              <label className={cn("text-sm font-medium", hasKeys ? "text-bo-foreground" : "text-slate-500")} htmlFor="payos-enabled">
                Bật tại POS
              </label>
              <Switch
                aria-describedby={!hasKeys ? "payos-enabled-hint" : undefined}
                checked={enabled}
                className="data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:bg-white"
                disabled={toggling || !hasKeys}
                id="payos-enabled"
                onCheckedChange={onToggle}
              />
            </div>
          </div>

          {showExpiryError || !hasKeys ? (
            <div className="flex basis-full flex-col gap-1 text-xs leading-5 @[68rem]:items-end">
              {showExpiryError ? (
                <p className="text-bo-danger" id="payos-expiry-error" role="alert">
                  Thời hạn QR phải là số nguyên từ {EXPIRY_MIN} đến {EXPIRY_MAX} phút.
                </p>
              ) : null}
              {!hasKeys ? (
                <p className="text-slate-600" id="payos-enabled-hint">
                  Cần lưu khóa kết nối trước khi bật tại POS.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {!setupComplete ? (
          <div className="flex flex-col gap-3 border-t border-bo-border bg-bo-surface-subtle px-4 py-3 sm:px-6 @4xl:flex-row @4xl:items-center @4xl:justify-between">
            <ol className="flex flex-col gap-2 @xl:flex-row @xl:flex-wrap @xl:gap-x-6">
              <SetupStep done={hasKeys} index={1}>
                Lưu khóa kết nối
              </SetupStep>
              <SetupStep done={webhookConfirmed} index={2}>
                Đăng ký webhook
              </SetupStep>
              <SetupStep done={enabled} index={3}>
                Bật tại POS
              </SetupStep>
            </ol>
            <button className={cn(linkClass, "inline-flex items-center gap-1.5 self-start text-sm @4xl:self-auto")} onClick={() => setGuideOpen(true)} type="button">
              <BookOpen {...buttonIconProps} /> Xem hướng dẫn
            </button>
          </div>
        ) : null}
      </section>

      {/* ===== Hai card: repeat(2, minmax(0, 1fr)), gap 16px; một cột khi hẹp ===== */}
      <div className="@container mt-4">
        <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2 @4xl:gap-y-0">
          {/* ===== Khóa kết nối ===== */}
          <Card
            aside={
              setupComplete ? (
                <button className={cn(linkClass, "inline-flex items-center gap-1.5 text-sm")} onClick={() => setGuideOpen(true)} type="button">
                  <BookOpen {...buttonIconProps} /> Hướng dẫn
                </button>
              ) : null
            }
            description={hasKeys ? undefined : <KeySourceHint />}
            footer={
              hasKeys ? (
                <>
                  <InlineSuccess show={Boolean(testResult?.ok)}>Kết nối thành công</InlineSuccess>
                  {/* "Kiểm tra kết nối" và "Đang kiểm tra…" rộng gần bằng nhau nên không cần min-w */}
                  <Button
                    aria-busy={testing}
                    className={secondaryButtonClass}
                    disabled={testing}
                    onClick={runTest}
                    type="button"
                    variant="outline"
                  >
                    {testing ? (
                      <LoaderCircle {...buttonIconProps} className={cn("animate-spin", outlineIconClass)} />
                    ) : (
                      <RefreshCw {...buttonIconProps} className={outlineIconClass} />
                    )}
                    {testing ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
                  </Button>
                  <Button
                    className={secondaryButtonClass}
                    disabled={!canStoreKeys}
                    onClick={() => {
                      resetKeyForm();
                      setKeyDialogOpen(true);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <Pencil {...buttonIconProps} className={outlineIconClass} /> Cập nhật khóa
                  </Button>
                </>
              ) : (
                <Button
                  aria-busy={savingKeys}
                  className={cn(primaryButtonClass, "min-w-[168px]")}
                  disabled={!canStoreKeys || savingKeys}
                  onClick={() => saveKeys("setup")}
                  type="button"
                >
                  <SaveKeysLabel saving={savingKeys} />
                </Button>
              )
            }
            icon={<KeyRound size={18} />}
            title="Khóa kết nối"
          >
            {hasKeys ? (
              <dl className="divide-y divide-bo-border">
                {KEY_FIELDS.map((field) => (
                  <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4" key={field.name}>
                    <dt className="text-sm text-slate-600 sm:w-36 sm:shrink-0">{field.label}</dt>
                    <dd className="min-w-0 truncate font-mono text-sm text-bo-foreground">{config?.[field.maskedKey]}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <KeyFormFields disabled={!canStoreKeys} errors={keyErrors} idPrefix="payos-setup" onChange={changeKey} values={keyValues} />
            )}
            <InlineError result={testResult} title="Kết nối thất bại" />
          </Card>

          {/* ===== Webhook ===== */}
          <Card
            aside={webhookConfirmed ? <StatusPill tone="success">Đã đăng ký</StatusPill> : <StatusPill tone="danger">Chưa đăng ký</StatusPill>}
            description={
              webhookConfirmed
                ? undefined
                : "Chưa đăng ký: hệ thống phải tự hỏi payOS định kỳ nên xác nhận tiền về có thể chậm hơn."
            }
            footer={
              <>
                <InlineSuccess show={Boolean(webhookResult?.ok)}>Đã đăng ký webhook</InlineSuccess>
                {savedWebhookUrl && editingWebhook ? (
                  <Button
                    className={secondaryButtonClass}
                    disabled={registering}
                    onClick={() => {
                      setWebhookUrl(savedWebhookUrl);
                      setEditingWebhook(false);
                    }}
                    type="button"
                    variant="outline"
                  >
                    Hủy
                  </Button>
                ) : null}
                {/* Đang đăng ký: giữ nhãn, chỉ đổi icon sang vòng xoay để nút không đổi cỡ */}
                <Button
                  aria-busy={registering}
                  className={isReregister ? secondaryButtonClass : primaryButtonClass}
                  disabled={registering || !hasKeys || !webhookUrl.trim() || (editingWebhook && !webhookChanged)}
                  onClick={onRegisterClick}
                  type="button"
                  variant={isReregister ? "outline" : "default"}
                >
                  {registering ? (
                    <LoaderCircle {...buttonIconProps} className={cn("animate-spin", isReregister && outlineIconClass)} />
                  ) : (
                    <RefreshCw {...buttonIconProps} className={isReregister ? outlineIconClass : undefined} />
                  )}
                  {isReregister ? "Đăng ký lại" : "Đăng ký webhook"}
                </Button>
                {/* Đổi URL ở ngoài cùng, giống "Cập nhật khóa" ở card Khóa kết nối */}
                {savedWebhookUrl && !editingWebhook ? (
                  <Button className={secondaryButtonClass} disabled={!hasKeys} onClick={() => setEditingWebhook(true)} type="button" variant="outline">
                    <Pencil {...buttonIconProps} className={outlineIconClass} /> Đổi URL
                  </Button>
                ) : null}
              </>
            }
            icon={<Link2 size={18} />}
            title="Webhook"
          >
            <label className="mb-1.5 block text-sm font-medium text-bo-foreground" htmlFor={webhookEditable ? "payos-webhook" : undefined}>
              Webhook URL
            </label>
            <div className="flex min-w-0 gap-2">
              {webhookEditable ? (
                <input
                  className={cn(inputClass, "min-w-0 flex-1 font-mono placeholder:font-sans")}
                  disabled={!hasKeys}
                  id="payos-webhook"
                  onChange={(event) => {
                    setWebhookUrl(event.target.value);
                    setWebhookResult(null); // lỗi cũ không còn đúng với URL mới
                  }}
                  placeholder={`https://<địa-chỉ-backend>${WEBHOOK_PATH}`}
                  spellCheck={false}
                  type="url"
                  value={webhookUrl}
                />
              ) : (
                <div className={readonlyBoxClass} title={webhookUrl}>
                  <span className="truncate">{webhookUrl}</span>
                </div>
              )}
              <Button
                aria-label={copied ? "Đã sao chép Webhook URL" : "Sao chép Webhook URL"}
                className={cn(secondaryButtonClass, "w-10 shrink-0 px-0")}
                disabled={!webhookUrl}
                onClick={copyWebhook}
                title={copied ? "Đã sao chép" : "Sao chép"}
                type="button"
                variant="outline"
              >
                {copied ? (
                  <Check {...buttonIconProps} className="text-bo-success" />
                ) : (
                  <Copy {...buttonIconProps} className={outlineIconClass} />
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {!hasKeys
                ? "Lưu khóa kết nối trước khi đăng ký webhook."
                : webhookConfirmed
                  ? `payOS xác nhận lúc ${formatDateTime(config.webhookXacNhanLuc)}.`
                  : "Bấm Đăng ký webhook để payOS xác nhận địa chỉ này."}
            </p>
            <InlineError result={webhookResult} title="Đăng ký webhook thất bại" />
          </Card>
        </div>
      </div>

      {/* ===== Hộp thoại cập nhật khóa ===== */}
      <Dialog
        onOpenChange={(open) => {
          if (savingKeys) return;
          setKeyDialogOpen(open);
          if (!open) resetKeyForm();
        }}
        open={keyDialogOpen}
      >
        <DialogContent className="rounded-xl border-bo-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bo-foreground">Cập nhật khóa kết nối</DialogTitle>
            <DialogDescription className="text-slate-600">
              <KeySourceHint /> Hệ thống xác minh với payOS trước khi lưu, khóa sai sẽ không được lưu.
            </DialogDescription>
          </DialogHeader>
          {enabled ? (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <p>POS đang dùng khóa hiện tại. Nếu đổi sang kênh payOS khác, cần đăng ký lại webhook sau khi lưu.</p>
            </div>
          ) : null}
          <form
            id="payos-key-form"
            onSubmit={(event) => {
              event.preventDefault();
              // Enter khi mọi ô trống: validateKeys báo lỗi, không gửi request
              saveKeys("update");
            }}
          >
            <KeyFormFields
              disabled={savingKeys}
              errors={keyErrors}
              idPrefix="payos-update"
              onChange={changeKey}
              placeholder={KEEP_KEY_PLACEHOLDER}
              values={keyValues}
            />
          </form>
          <DialogFooter>
            <Button className={secondaryButtonClass} disabled={savingKeys} onClick={() => setKeyDialogOpen(false)} type="button" variant="outline">
              Hủy
            </Button>
            <Button
              aria-busy={savingKeys}
              className={cn(primaryButtonClass, "min-w-[168px]")}
              disabled={savingKeys || !hasKeyInput}
              form="payos-key-form"
              type="submit"
            >
              <SaveKeysLabel saving={savingKeys} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        cancelText="Giữ bật"
        confirmText="Tắt"
        description="Thu ngân sẽ không thể tạo mã QR chuyển khoản mới cho đến khi bạn bật lại."
        isLoading={toggling}
        isOpen={confirmDisable}
        onClose={() => !toggling && setConfirmDisable(false)}
        onConfirm={() => setEnabled(false)}
        title="Tắt chuyển khoản QR tại POS?"
        variant="danger"
      />

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
    </PageContainer>
  );
}
