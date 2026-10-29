import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ClipboardList, Link2, List, Package, Tags } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEditButton,
  SettingsFieldHint,
  SettingsFooterLink,
  SettingsFormActions,
} from "@/components/settings/SettingsUI";
import { settingsInputClass } from "@/components/settings/settingsStyles";
import { parseRoles } from "@/components/settings/settings.config";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { cn } from "@/lib/utils";
import { getInventorySettings, bulkUpdateInventorySettings } from "@/services/inventorySettingsService";
import {
  INVENTORY_SETTINGS,
  duocDeTrong,
  getInventoryChanges,
  moTaTacDong,
  phamViCauHinh,
  readCompleteInventorySettings,
  selectInventorySettings,
  validateInventoryField,
  validateInventorySetting,
} from "@/validations/inventorySettingsSchema";

/**
 * Các mục Vận hành của trung tâm Cấu hình (Sản phẩm, Tồn kho, Đồng bộ kênh bán, Khách hàng, Nhập kho, Chuyển kho, Chứng
 * từ và hóa đơn) — cùng nguồn
 * GET/PUT /api/v1/dieu-hanh-he-thong/cau-hinh; mỗi mục một thẻ, sửa và lưu riêng phần của mình.
 * `footer.roles`: chỉ hiện liên kết khi vai trò mở được trang đích.
 */
const PARTS = {
  product: {
    cardTitle: "Mã vạch sản phẩm",
    scope: "biến thể mới để trống mã vạch",
    footer: {
      to: "/products/gia-ban-tem",
      icon: Tags,
      title: "Giá bán & tem mã vạch",
      description: "Mã đã cấp giữ nguyên khi đổi tiền tố; in tem theo mã của từng SKU",
      roles: ["quan_tri_vien", "quan_ly_kho"],
    },
  },
  stock: {
    cardTitle: "Cảnh báo tồn kho",
    scope: "sản phẩm chưa đặt ngưỡng riêng",
    footer: {
      to: "/products",
      icon: Package,
      title: "Danh sách sản phẩm",
      description: "Sản phẩm có ngưỡng riêng sẽ không dùng ngưỡng mặc định",
    },
  },
  sync: {
    cardTitle: "Nhịp đồng bộ",
    scope: "kênh bật tự động đồng bộ · đẩy tồn ngay hiện áp dụng cho Shopify",
    footer: {
      to: "/channels",
      icon: Link2,
      title: "Kết nối gian hàng",
      description: "Bật/tắt tự động lấy đơn, đẩy tồn và kho nguồn của từng kênh",
      roles: ["quan_tri_vien"],
    },
  },
  customer: {
    cardTitle: "Mã khách hàng",
    scope: "khách hàng mới để trống ô mã",
    footer: {
      to: "/customers",
      icon: List,
      title: "Danh sách khách hàng",
      description: "Mã đã cấp giữ nguyên khi đổi tiền tố",
      roles: ["quan_tri_vien", "nhan_vien_ban_hang"],
    },
  },
  inbound: {
    cardTitle: "Kiểm đếm hàng nhập",
    scope: "màn Kiểm đếm & khóa lô của mọi kho",
    footer: {
      to: "/goods-receipts",
      icon: ClipboardList,
      title: "Phiếu nhập kho",
      description: "Mở phiếu nhập từ đơn mua để kiểm đếm và khóa lô",
    },
  },
  // Ai được xử lý chênh lệch khi nhận hàng chuyển kho (đặc tả BA, B.5)
  transfer: {
    cardTitle: "Xử lý chênh lệch khi nhận hàng",
    scope: "phiếu chuyển kho chờ xử lý chênh lệch",
    footer: {
      to: "/transfer-tickets",
      icon: ArrowLeftRight,
      title: "Chuyển kho nội bộ",
      description: "Phiếu nhận thiếu, hỏng nằm ở trạng thái Chờ xử lý chênh lệch",
      roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
    },
  },
  // Giấy đi đường của phiếu chuyển kho (đặc tả BA, B.3)
  documents: {
    cardTitle: "Phiếu xuất kho kiêm vận chuyển nội bộ (XKNB)",
    scope: "hộp Xác nhận xuất của phiếu chuyển kho",
    footer: {
      to: "/transfer-tickets",
      icon: ArrowLeftRight,
      title: "Chuyển kho nội bộ",
      description: "Phiếu xuất khi chưa có số XKNB nằm ở mục Thiếu giấy đi đường tới khi ghi số",
      roles: ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"],
    },
  },
};

const valuesOf = (settings) => Object.fromEntries(settings.map((item) => [item.maCauHinh, item.giaTri]));

// Chế độ xem: số nguyên có phân cách hàng nghìn; khóa chữ (vd. tiền tố mã vạch "05") giữ nguyên
const hienGiaTri = (value, laChu) => (!laChu && /^[+-]?\d+$/.test(value) ? Number(value).toLocaleString("vi-VN") : value);

export default function OperationsSettingsPage({ part }) {
  const config = PARTS[part];
  const fields = INVENTORY_SETTINGS.filter((field) => field.group === part);
  const { canEdit } = useSettingsPage();
  const vaiTro = parseRoles(localStorage.getItem("role"));
  const showFooter = !config.footer.roles || config.footer.roles.some((role) => vaiTro.includes(role));

  const [loaded, setLoaded] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const requestRef = useRef(null);
  const mountedRef = useRef(false);
  const editButtonRef = useRef(null);
  const wasEditingRef = useRef(false);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setEditing(false);
    try {
      const settings = readCompleteInventorySettings(await getInventorySettings({ signal: controller.signal }), part);
      if (controller.signal.aborted) return;
      setLoaded(settings);
      setStatus("loaded");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, [part]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, [load]);

  // Thoát chế độ sửa (Hủy / Lưu xong): trả focus về nút Sửa thay vì rơi về đầu trang
  useEffect(() => {
    if (wasEditingRef.current && !editing) editButtonRef.current?.focus();
    wasEditingRef.current = editing;
  }, [editing]);

  const partSettings = (loaded ?? []).filter((item) => fields.some((field) => field.code === item.maCauHinh));
  const saved = valuesOf(partSettings);
  const changes = editing ? getInventoryChanges(partSettings, draft) : [];
  const errors = {};
  if (editing) {
    for (const setting of partSettings) {
      const error = validateInventoryField(setting.maCauHinh, draft[setting.maCauHinh], setting.kieuDuLieu);
      if (error) errors[setting.maCauHinh] = error;
    }
  }
  const hasErrors = Object.keys(errors).length > 0;
  useUnsavedChanges(changes.length > 0);

  const startEdit = () => {
    setDraft(saved);
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setSaveError("");
    setEditing(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!changes.length || hasErrors || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = selectInventorySettings((await bulkUpdateInventorySettings(changes)).data);
      if (changes.some((change) => !updated.some((item) => item.maCauHinh === change.maCauHinh))) {
        throw new Error("Phản hồi lưu thiếu cấu hình đã gửi.");
      }
      const merged = readCompleteInventorySettings(
        loaded.map((item) => updated.find((result) => result.maCauHinh === item.maCauHinh) ?? item),
        part,
      );
      if (merged.some((item) => !(item.giaTri === "" && duocDeTrong(item.maCauHinh))
        && validateInventorySetting(item.giaTri, item.kieuDuLieu))) {
        throw new Error("Phản hồi lưu có giá trị cấu hình không hợp lệ.");
      }
      if (!mountedRef.current) return;
      setLoaded(merged);
      setEditing(false);
      toast.success(`Đã lưu ${config.cardTitle.toLowerCase()}.`);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error?.response?.status === 400 ? error?.response?.data?.message : null;
      setSaveError(message || "Chưa lưu được. Vui lòng thử lại, các giá trị bạn nhập vẫn được giữ.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <SettingsCard>
        <LoadingState label="Đang tải cấu hình" className="min-h-48" />
      </SettingsCard>
    );
  }

  if (status === "error") {
    return (
      <SettingsCard>
        <ErrorState
          title="Không thể tải cấu hình"
          description="Không đọc được cấu hình từ máy chủ. Vui lòng thử lại."
          onRetry={load}
          className="min-h-48"
        />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard as="form" editing={editing} onSubmit={save} noValidate aria-label={config.cardTitle}>
      <SettingsCardHeader
        title={config.cardTitle}
        note={`Áp dụng cho ${config.scope}`}
        action={
          canEdit && !editing ? (
            <SettingsEditButton
              ref={editButtonRef}
              onClick={startEdit}
              aria-label={`Sửa ${config.cardTitle.toLowerCase()}`}
            />
          ) : null
        }
      />

      <div className="px-5">
        {fields.map((field, index) => {
          const id = `cau-hinh-${field.code}`;
          const hintId = `${id}-pham-vi`;
          const value = editing ? draft[field.code] ?? "" : saved[field.code] ?? "";
          const error = errors[field.code];
          const [truoc, dam, sau] = error ? ["Nhập giá trị hợp lệ để xem tác động.", "", ""] : moTaTacDong(field.code, value);
          const laChu = field.type === "STRING";
          if (field.options) {
            const dangChon = field.options.find((o) => o.value === value);
            return (
              <div key={field.code} className={`flex flex-col gap-3 py-3.5 ${index ? "border-t border-[#eef1f5]" : ""}`}>
                <div className="min-w-0">
                  <p id={`${id}-nhan`} className="text-sm leading-5 font-medium text-bo-foreground">{field.label}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">
                    {truoc}
                    {dam ? <strong className="font-semibold text-bo-foreground">{dam}</strong> : null}
                    {sau}
                  </p>
                </div>
                {editing ? (
                  <div
                    role="radiogroup"
                    aria-labelledby={`${id}-nhan`}
                    className={cn("grid grid-cols-1 gap-2", field.options.length === 2 && "md:grid-cols-2")}
                  >
                    {field.options.map((o, i) => {
                      const chon = value === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={chon}
                          autoFocus={index === 0 && (chon || (!dangChon && i === 0))}
                          disabled={saving}
                          onClick={() => setDraft((prev) => ({ ...prev, [field.code]: o.value }))}
                          className={cn(
                            "grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md border bg-bo-surface p-3 text-left disabled:opacity-60",
                            chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                          )}
                        >
                          <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                            {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                          </span>
                          <span className="text-sm font-medium text-bo-foreground">{o.label}</span>
                          <span className="col-start-2 text-xs leading-5 text-bo-muted">{o.moTa}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-base font-semibold text-bo-foreground">{dangChon?.label ?? value}</p>
                )}
                {editing && error ? <SettingsFieldHint id={hintId} error={error} /> : null}
              </div>
            );
          }
          return (
            <div
              key={field.code}
              className={`flex flex-wrap items-start gap-x-8 gap-y-2 py-3.5 ${index ? "border-t border-[#eef1f5]" : ""}`}
            >
              <div className="min-w-0 flex-[1_1_320px]">
                {editing ? (
                  <label htmlFor={id} className="block text-sm leading-5 font-medium text-bo-foreground">
                    {field.label}
                  </label>
                ) : (
                  <p className="text-sm leading-5 font-medium text-bo-foreground">{field.label}</p>
                )}
                <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">
                  {truoc}
                  {dam ? <strong className="font-semibold text-bo-foreground">{dam}</strong> : null}
                  {sau}
                </p>
              </div>

              <div className="flex basis-full flex-col items-start gap-1 sm:flex-[0_0_180px] sm:items-end">
                {editing ? (
                  <>
                    <div className={`relative ${laChu ? "w-[140px]" : "w-[160px]"}`}>
                      <Input
                        id={id}
                        type="text"
                        inputMode={field.inputMode ?? (laChu ? "text" : "numeric")}
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={field.maxLength ?? 7}
                        autoFocus={index === 0}
                        value={value}
                        onChange={(event) => {
                          const next = laChu ? event.target.value.toUpperCase() : event.target.value;
                          setDraft((prev) => ({ ...prev, [field.code]: next }));
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={hintId}
                        disabled={saving}
                        className={settingsInputClass({
                          error: Boolean(error),
                          className: laChu
                            ? "font-mono tracking-[0.04em] uppercase"
                            : "pr-11 text-right font-medium tabular-nums",
                        })}
                      />
                      {field.unit ? (
                        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-bo-muted">
                          {field.unit}
                        </span>
                      ) : null}
                    </div>
                    <SettingsFieldHint id={hintId} error={error} className="sm:text-right">
                      {phamViCauHinh(field.code)}
                    </SettingsFieldHint>
                  </>
                ) : value === "" && field.choPhepTrong ? (
                  <p className="flex h-9 items-center text-sm text-bo-muted">Chưa đặt</p>
                ) : (
                  <p className="flex h-9 items-center gap-1.5">
                    <span
                      className={
                        laChu
                          ? "font-mono text-lg font-semibold tracking-[0.04em] text-bo-foreground"
                          : "text-xl font-semibold tracking-[-0.01em] text-bo-foreground tabular-nums"
                      }
                    >
                      {hienGiaTri(value, laChu)}
                    </span>
                    {field.unit ? <span className="text-sm text-bo-muted">{field.unit}</span> : null}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing ? (
        <>
          {saveError ? (
            <p role="alert" className="mx-5 mb-3 rounded-md bg-bo-danger-soft px-3 py-2 text-[13px] leading-5 text-red-800">
              {saveError}
            </p>
          ) : null}
          <SettingsFormActions onCancel={cancelEdit} saving={saving} disabled={!changes.length || hasErrors} />
        </>
      ) : showFooter ? (
        <SettingsFooterLink
          to={config.footer.to}
          icon={config.footer.icon}
          title={config.footer.title}
          description={config.footer.description}
        />
      ) : (
        <div className="h-1.5" />
      )}
    </SettingsCard>
  );
}
