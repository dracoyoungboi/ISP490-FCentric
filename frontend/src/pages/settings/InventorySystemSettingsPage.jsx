import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Boxes, Info, Loader2, LockKeyhole, Pencil, RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInventorySettings, bulkUpdateInventorySettings } from "@/services/inventorySettingsService";
import { INVENTORY_SETTINGS, createEmptyInventoryValues, readCompleteInventorySettings, selectInventorySettings, validateInventorySetting, validateInventoryField, getInventoryChanges } from "@/validations/inventorySettingsSchema";
import "./InventorySystemSettingsPage.css";

function valuesFromSettings(settings) {
  return Object.fromEntries(settings.map((item) => [item.maCauHinh, item.giaTri]));
}

// Chế độ chỉ xem: số nguyên hiện có phân cách hàng nghìn, chưa có giá trị thì hiện "—".
function formatReadOnlyValue(value) {
  if (!value) return "—";
  return /^[+-]?\d+$/.test(value) ? Number(value).toLocaleString("vi-VN") : value;
}

// Mô tả trung tính để dùng chung cho cả chế độ sửa và chỉ xem.
const SETTING_GROUPS = [
  { key: "stock", title: "Cảnh báo tồn kho", description: "Ngưỡng cảnh báo mặc định cho hàng trong kho.", Icon: Boxes },
  { key: "sync", title: "Đồng bộ đơn hàng", description: "Chu kỳ đồng bộ định kỳ và ngưỡng chuyển sang đồng bộ tức thời.", Icon: RefreshCcw },
];

export default function InventorySystemSettingsPage() {
  // GET cho quản trị viên và quản lý kho (chỉ xem); PUT chỉ quản trị viên.
  const vaiTro = (localStorage.getItem("role") || "").split(/\s+/);
  const hasPermission = vaiTro.includes("quan_tri_vien");
  const canView = hasPermission || vaiTro.includes("quan_ly_kho");
  const [loaded, setLoaded] = useState(null);
  const [values, setValues] = useState(createEmptyInventoryValues);
  const [status, setStatus] = useState(canView ? "loading" : "idle");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Mặc định ai cũng ở chế độ xem; quản trị viên bấm "Chỉnh sửa" mới hiện ô nhập và Hủy / Lưu.
  const [editing, setEditing] = useState(false);
  const isEditing = hasPermission && editing;
  const [stockTooltipOpen, setStockTooltipOpen] = useState(false);
  const requestRef = useRef(null);
  const saveLockRef = useRef(false);
  const mountedRef = useRef(false);
  const editButtonRef = useRef(null);
  const wasEditingRef = useRef(false);

  const loadSettings = useCallback(async () => {
    if (!canView) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setLoaded(null);
    setValues(createEmptyInventoryValues());
    setSaveError("");
    setEditing(false);
    try {
      const settings = readCompleteInventorySettings(await getInventorySettings({ signal: controller.signal }));
      if (controller.signal.aborted) return;
      setLoaded(settings);
      setValues(valuesFromSettings(settings));
      setStatus("loaded");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, [canView]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    queueMicrotask(() => { if (active) loadSettings(); });
    return () => {
      active = false;
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, [loadSettings]);

  // dirty: có giá trị thật sự khác (đã chuẩn hóa, "0100" = "100") → hiện "Có thay đổi chưa lưu" và cho bật Lưu.
  const changes = loaded ? getInventoryChanges(loaded, values) : [];
  const dirty = changes.length > 0;
  const errors = {};
  for (const setting of loaded || []) {
    const error = validateInventoryField(setting.maCauHinh, values[setting.maCauHinh], setting.kieuDuLieu);
    if (error) errors[setting.maCauHinh] = error;
  }
  const canSave = isEditing && status === "loaded" && Boolean(loaded) && dirty && !saving && !Object.keys(errors).length;
  const inputsDisabled = status !== "loaded" || saving;

  // Thoát chế độ sửa (Hủy / Lưu xong): trả focus về nút "Chỉnh sửa" thay vì rơi về đầu trang.
  useEffect(() => {
    if (wasEditingRef.current && !isEditing) editButtonRef.current?.focus();
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  const saveSettings = async (event) => {
    event.preventDefault();
    if (!canSave || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = await bulkUpdateInventorySettings(changes);
      const updated = selectInventorySettings(response.data);
      if (changes.some((change) => !updated.some((item) => item.maCauHinh === change.maCauHinh))) {
        throw new Error("Phản hồi lưu thiếu cấu hình đã gửi.");
      }
      const merged = readCompleteInventorySettings(loaded.map((item) => updated.find((result) => result.maCauHinh === item.maCauHinh) || item));
      if (merged.some((item) => validateInventorySetting(item.giaTri, item.kieuDuLieu))) {
        throw new Error("Phản hồi lưu có giá trị cấu hình không hợp lệ.");
      }
      if (!mountedRef.current) return;
      setLoaded(merged);
      setValues(valuesFromSettings(merged));
      setEditing(false);
      toast.success("Đã lưu cài đặt.");
    } catch (error) {
      if (!mountedRef.current) return;
      const statusCode = error?.response?.status;
      const message = statusCode === 400 ? error?.response?.data?.message : null;
      setSaveError(message || "Vui lòng thử lại. Các thay đổi của bạn vẫn được giữ.");
    } finally {
      saveLockRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  // Hủy: bỏ mọi giá trị đang nhập và quay về chế độ xem.
  const cancelEditing = () => {
    setValues(valuesFromSettings(loaded));
    setSaveError("");
    setEditing(false);
  };

  const renderField = (field) => (
    <div key={field.code} className={field.group === "stock"
      ? "grid min-w-0 items-start gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:gap-6"
      : "grid min-w-0 content-start gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4"}>
      <div className={`flex min-w-0 items-center gap-1.5 ${field.group === "stock" ? "lg:min-h-11" : ""}`}>
        <Label htmlFor={field.code} className="text-sm font-semibold leading-5 text-bo-foreground">{field.label}</Label>
        {field.code === "DEFAULT_MIN_STOCK_ALERT" && <Tooltip open={stockTooltipOpen} onOpenChange={setStockTooltipOpen}>
          <TooltipTrigger asChild>
            <button type="button" aria-label="Thông tin ngưỡng cảnh báo tồn kho" onClick={(event) => { event.preventDefault(); setStockTooltipOpen(true); }} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"><Info className="size-3.5" /></button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" sideOffset={8} collisionPadding={16} className="max-w-[min(18rem,calc(100vw-2rem))] bg-bo-foreground py-2 leading-5 text-white shadow-md [&>svg]:bg-bo-foreground [&>svg]:fill-bo-foreground">Áp dụng khi sản phẩm chưa có ngưỡng riêng.</TooltipContent>
        </Tooltip>}
      </div>
      {/* Chế độ xem (quản lý kho, hoặc quản trị viên chưa bấm "Chỉnh sửa"): giá trị dạng chữ. */}
      {!isEditing ? <output id={field.code} className={`flex h-11 min-w-0 items-center gap-3 ${field.group === "stock" ? "lg:justify-end" : ""}`}>
        {status === "loading"
          ? <Skeleton className="h-6 w-16 bg-slate-100" aria-hidden="true" />
          : <span className="text-lg font-semibold tabular-nums text-bo-foreground">{formatReadOnlyValue(values[field.code])}</span>}
        <span className="border-l border-bo-border pl-3 text-xs text-bo-muted">{field.unit}</span>
      </output> : <div className="min-w-0 space-y-1.5">
        <div className="relative">
          <Input id={field.code} type="number" inputMode="numeric" step="1" min={field.min} max={field.max} value={values[field.code]} disabled={inputsDisabled}
            autoFocus={field.code === INVENTORY_SETTINGS[0].code}
            onFocus={() => setStockTooltipOpen(false)} placeholder={status === "loading" ? "Đang tải..." : "Chưa có giá trị"}
            aria-invalid={Boolean(errors[field.code])} aria-describedby={errors[field.code] ? `${field.code}-error` : undefined}
            className="h-11 border-bo-border bg-white pr-24 font-semibold tabular-nums text-bo-foreground md:text-base focus-visible:border-bo-primary focus-visible:ring-bo-primary/15 aria-invalid:border-bo-danger aria-invalid:ring-bo-danger/20 disabled:bg-bo-surface-subtle"
            onChange={(event) => { setValues((current) => ({ ...current, [field.code]: event.target.value })); setSaveError(""); }} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l border-bo-border pl-3 text-xs text-bo-muted">{field.unit}</span>
        </div>
        {errors[field.code] && <p id={`${field.code}-error`} role="alert" className="text-xs leading-5 text-bo-danger">{errors[field.code]}</p>}
      </div>}
    </div>
  );

  return (
    <PageContainer className="max-w-none space-y-5">
      <PageHeader  title="Cấu hình hệ thống kho" description="Thiết lập cảnh báo tồn kho và các thông số đồng bộ đơn hàng."
        actions={hasPermission ? (isEditing ? <>
          {dirty && <span role="status" className="text-sm text-bo-muted">Có thay đổi chưa lưu</span>}
          <Button type="button" variant="outline" disabled={saving} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15" onClick={cancelEditing}>Hủy</Button>
          <Button type="submit" form="inventory-settings-form" disabled={!canSave} className="bg-bo-primary text-white hover:bg-bo-primary-hover focus-visible:border-bo-primary focus-visible:ring-bo-primary/15">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Đang lưu…" : "Lưu thay đổi"}</Button>
        </> : <Button ref={editButtonRef} type="button" disabled={status !== "loaded"} onClick={() => setEditing(true)} className="bg-bo-primary text-white hover:bg-bo-primary-hover focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"><Pencil className="size-4" />Chỉnh sửa</Button>) : canView && <span className="inline-flex items-center gap-1.5 rounded-full border border-bo-border bg-white px-2.5 py-1 text-xs font-medium text-bo-foreground"><LockKeyhole aria-hidden="true" className="size-3.5" />Chỉ xem</span>} />
      {/* Khung xám trong từng ô đã báo đang tải; dòng này chỉ cho trình đọc màn hình, không đẩy thẻ xuống. */}
      <p role="status" className="sr-only">{status === "loading" ? "Đang tải cài đặt..." : ""}</p>
      {status === "error" && <Alert className="border-bo-danger/20 bg-bo-danger-soft text-bo-danger">
        <AlertCircle /><AlertTitle>Không thể tải cài đặt.</AlertTitle>
        <AlertDescription className="text-bo-danger"><p>Thử lại để lấy cài đặt mới nhất.</p><Button type="button" variant="outline" onClick={loadSettings} className="mt-2 border-bo-danger/20 bg-white text-bo-danger hover:bg-bo-danger-soft"><RefreshCcw className="size-4" />Thử lại</Button></AlertDescription>
      </Alert>}
      {!canView && <Alert className="border-bo-border bg-bo-surface-subtle text-bo-muted"><LockKeyhole /><AlertTitle>Bạn không có quyền truy cập cài đặt này.</AlertTitle><AlertDescription>Vui lòng liên hệ Quản trị viên để được hỗ trợ.</AlertDescription></Alert>}
      <form id="inventory-settings-form" noValidate onSubmit={saveSettings} aria-busy={status === "loading" || saving} className="space-y-5">
        <SurfaceCard contentClassName="inventory-settings-layout p-0 sm:p-0">
          <div className="inventory-settings-rail bg-bo-sidebar text-white">
            <p className="text-xs font-semibold tracking-widest">THÔNG SỐ VẬN HÀNH</p>
          </div>
          {SETTING_GROUPS.map(({ key, title, description, Icon }) => (
            <section key={key} aria-labelledby={`inventory-${key}-title`} className={`inventory-settings-group inventory-settings-group--${key} min-w-0 px-4 py-5 sm:px-6 lg:px-8`}>
              <div className="mb-5 flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">{createElement(Icon, { "aria-hidden": true, className: "size-5" })}</span>
                <div className="min-w-0">
                  <h2 id={`inventory-${key}-title`} className="text-base font-bold leading-6 text-bo-foreground">{title}</h2>
                  <p className="mt-0.5 text-sm leading-5 text-bo-muted">{description}</p>
                </div>
              </div>
              <div className={key === "sync" ? "grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5" : "min-w-0"}>
                {INVENTORY_SETTINGS.filter((field) => field.group === key).map(renderField)}
              </div>
            </section>
          ))}
        </SurfaceCard>
        {canView && !hasPermission && <p className="text-sm text-bo-muted">Cần thay đổi thông số? Liên hệ Quản trị viên.</p>}
        {saveError && <Alert className="border-bo-danger/20 bg-bo-danger-soft text-bo-danger"><AlertCircle /><AlertTitle>Không thể lưu cài đặt.</AlertTitle><AlertDescription className="text-bo-danger">{saveError}</AlertDescription></Alert>}
      </form>
    </PageContainer>
  );
}
