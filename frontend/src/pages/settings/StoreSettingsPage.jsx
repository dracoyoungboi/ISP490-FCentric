import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Printer, Store, X } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
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
import { OUTLINE_BUTTON, settingsInputClass } from "@/components/settings/settingsStyles";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { companyProfileService } from "@/services/companyProfileService";
import {
  companyProfileForm,
  companyProfilePayload,
  isCompanyProfileChanged,
  validateCompanyProfile,
} from "@/validations/companyProfileSchema";

const FIELDS = [
  { key: "name", label: "Tên cửa hàng", type: "text", placeholder: "Ví dụ: Thời trang Mộc An", required: true },
  { key: "taxCode", label: "Mã số thuế", type: "text", placeholder: "Ví dụ: 0312345678" },
  { key: "phone", label: "Điện thoại", type: "tel", placeholder: "028 7300 0000" },
  { key: "email", label: "Email", type: "email", placeholder: "lienhe@congty.vn" },
  { key: "address", label: "Địa chỉ", type: "text", placeholder: "Số nhà, đường, phường/xã, tỉnh/thành phố", wide: true },
];

/**
 * Cấu hình › Thông tin cửa hàng: tên, mã số thuế, logo, liên hệ in ở đầu mọi phiếu và hóa đơn (GET/PUT /api/v1/thong-tin-cong-ty).
 * Logo chọn xong chỉ tải lên khi bấm Lưu; Hủy thì không ghi gì.
 */
export default function StoreSettingsPage() {
  const { canEdit } = useSettingsPage();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [touched, setTouched] = useState({});
  // Logo đang chờ lưu: { file, url } (url là object URL để xem trước)
  const [pendingLogo, setPendingLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const pendingUrlRef = useRef(null);
  const editButtonRef = useRef(null);
  const wasEditingRef = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const loaded = await companyProfileService.get();
      setProfile(loaded);
      setStatus("loaded");
    } catch (error) {
      console.error("Không tải được thông tin cửa hàng:", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  // Rời trang khi đang có ảnh chờ lưu: giải phóng object URL
  useEffect(() => () => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
  }, []);

  useEffect(() => {
    if (wasEditingRef.current && !editing) editButtonRef.current?.focus();
    wasEditingRef.current = editing;
  }, [editing]);

  const errors = editing ? validateCompanyProfile(form) : {};
  const hasErrors = Object.keys(errors).length > 0;
  const changed = editing && (isCompanyProfileChanged(profile, form) || pendingLogo !== null);
  useUnsavedChanges(changed);

  const choosePendingLogo = (file) => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    pendingUrlRef.current = file ? URL.createObjectURL(file) : null;
    setPendingLogo(file ? { file, url: pendingUrlRef.current } : null);
    if (!file && fileInputRef.current) fileInputRef.current.value = "";
  };
  const clearLogo = () => choosePendingLogo(null);

  const startEdit = () => {
    setForm(companyProfileForm(profile));
    setTouched({});
    clearLogo();
    setEditing(true);
  };

  const cancelEdit = () => {
    clearLogo();
    setEditing(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (hasErrors) {
      setTouched(Object.fromEntries(FIELDS.map((field) => [field.key, true])));
      return;
    }
    if (!changed || saving) return;
    setSaving(true);
    try {
      if (pendingLogo) await companyProfileService.uploadLogo(pendingLogo.file);
      const updated = await companyProfileService.save(companyProfilePayload(form));
      setProfile(updated);
      clearLogo();
      setEditing(false);
      toast.success("Đã lưu thông tin cửa hàng.");
    } catch (error) {
      // Giữ nguyên dữ liệu đã nhập (kể cả logo đã chọn) để thử lại
      console.error("Không lưu được thông tin cửa hàng:", error);
      toast.error("Chưa lưu được thông tin cửa hàng. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <SettingsCard>
        <LoadingState label="Đang tải thông tin cửa hàng" className="min-h-48" />
      </SettingsCard>
    );
  }

  if (status === "error" || !profile) {
    return (
      <SettingsCard>
        <ErrorState
          title="Không thể tải thông tin cửa hàng"
          description="Không đọc được thông tin cửa hàng từ máy chủ. Vui lòng thử lại."
          onRetry={load}
          className="min-h-48"
        />
      </SettingsCard>
    );
  }

  const logo = pendingLogo?.url ?? profile.logoAsset;

  return (
    <SettingsCard as="form" editing={editing} onSubmit={save} noValidate aria-label="Thông tin cửa hàng">
      <SettingsCardHeader
        title="Thông tin cửa hàng"
        note="Hiện ở đầu mọi phiếu in và hóa đơn bán hàng"
        action={
          canEdit && !editing ? (
            <SettingsEditButton ref={editButtonRef} onClick={startEdit} aria-label="Sửa thông tin cửa hàng" />
          ) : null
        }
      />

      {editing ? (
        <>
          <div className="flex flex-col gap-4 px-5 pt-2.5 pb-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <LogoBox src={logo} dashed />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={OUTLINE_BUTTON}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    <ImagePlus aria-hidden="true" />
                    Chọn ảnh logo
                  </Button>
                  {pendingLogo ? (
                    <Button type="button" variant="outline" size="sm" className={OUTLINE_BUTTON} onClick={clearLogo} disabled={saving}>
                      <X aria-hidden="true" />
                      Bỏ ảnh vừa chọn
                    </Button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => choosePendingLogo(event.target.files?.[0] ?? null)}
                  />
                </div>
                <span className="text-xs leading-4 text-[#7a8594]">
                  {pendingLogo ? "Logo mới được tải lên khi bấm Lưu." : "PNG, JPG hoặc SVG, nền trong suốt cho đẹp khi in"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-5 gap-y-3.5">
              {FIELDS.map((field, index) => {
                const id = `cua-hang-${field.key}`;
                const error = touched[field.key] ? errors[field.key] : "";
                return (
                  <div key={field.key} className={field.wide ? "col-span-full" : undefined}>
                    <label htmlFor={id} className="mb-1.5 block text-sm leading-5 font-medium text-bo-foreground">
                      {field.label}
                      {field.required ? <span className="text-bo-danger"> *</span> : null}
                    </label>
                    <Input
                      id={id}
                      type={field.type}
                      autoComplete="off"
                      autoFocus={index === 0}
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      onBlur={() => setTouched((prev) => ({ ...prev, [field.key]: true }))}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${id}-loi` : undefined}
                      disabled={saving}
                      className={settingsInputClass({ error: Boolean(error) })}
                    />
                    {error ? <SettingsFieldHint id={`${id}-loi`} error={error} className="mt-1" /> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <SettingsFormActions className="mt-4" onCancel={cancelEdit} saving={saving} disabled={!changed} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4 px-5 pt-2.5 pb-[18px]">
            <LogoBox src={logo} />
            <dl className="grid min-w-0 flex-[1_1_380px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-3.5">
              {FIELDS.map((field) => (
                <div key={field.key} className="min-w-0">
                  <dt className="text-[13px] leading-5 text-bo-muted">{field.label}</dt>
                  <dd
                    className={`mt-0.5 text-sm leading-5 break-words ${
                      profile[field.key] ? "text-bo-foreground" : "text-[#94a3b8]"
                    } ${field.key === "name" ? "font-semibold" : ""} ${field.key === "phone" || field.key === "taxCode" ? "tabular-nums" : ""}`}
                  >
                    {profile[field.key] || "Chưa nhập"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <SettingsFooterLink
            to="/settings/print-templates"
            icon={Printer}
            title="Mẫu in"
            description="Chọn thông tin nào hiện trên từng loại phiếu"
          />
        </>
      )}
    </SettingsCard>
  );
}

function LogoBox({ src, dashed = false }) {
  // Ảnh lỗi (đường dẫn hỏng, MinIO tắt): hiện biểu tượng thay vì chữ alt tràn khung
  const [anhLoi, setAnhLoi] = useState(null);
  const hienAnh = src && anhLoi !== src;
  return (
    <div
      className={`flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-bo-surface-subtle p-1.5 ${
        dashed ? "border-dashed border-[#b6c0cc]" : "border-bo-border"
      }`}
    >
      {hienAnh ? (
        <img src={src} alt="Logo cửa hàng" className="max-h-full max-w-full object-contain" onError={() => setAnhLoi(src)} />
      ) : (
        <Store className="size-6 text-[#94a3b8]" aria-hidden="true" />
      )}
    </div>
  );
}
