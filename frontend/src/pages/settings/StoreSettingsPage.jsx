import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Store, X } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEditButton,
  SettingsFieldHint,
  SettingsFormActions,
} from "@/components/settings/SettingsUI";
import { OUTLINE_BUTTON, settingsInputClass } from "@/components/settings/settingsStyles";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { companyProfileService } from "@/services/companyProfileService";
import {
  EMAIL_TOI_DA,
  KHOA_PHAP_LY_LIEN_HE,
  KHOA_TEN_VA_LOGO,
  LOGO_ACCEPT,
  TEN_TOI_DA,
  companyProfileForm,
  isCompanyProfileChanged,
  kiemTepLogo,
  payloadPhapLyLienHe,
  payloadTenVaLogo,
  validatePhapLyLienHe,
  validateTenVaLogo,
} from "@/validations/companyProfileSchema";
import {
  CHU_THICH_THE_PHAP_LY,
  CHU_THICH_THE_TEN_VA_LOGO,
  GOI_Y_LOGO_TRANG,
  O_TRANG,
  TOAST_CHUA_LUU,
  TOAST_DA_LUU,
  chiTietLoi,
  goiYKhiSua,
  nutSuaThe,
  thongBaoLogoLoi,
  xemPhapLyLienHe,
  xemTenCuaHang,
} from "./thongTinCuaHang";

const THE = {
  A: { keys: KHOA_TEN_VA_LOGO, validate: validateTenVaLogo, payload: payloadTenVaLogo },
  B: { keys: KHOA_PHAP_LY_LIEN_HE, validate: validatePhapLyLienHe, payload: payloadPhapLyLienHe },
};

const MAX_LENGTH = { name: TEN_TOI_DA, legalName: TEN_TOI_DA, email: EMAIL_TOI_DA };

// Màu gợi ý dưới ô (khớp demo: xám #64748b, xanh #15803d, cam #b45309)
const TONE_GOI_Y = { muted: "text-bo-muted", ok: "text-bo-success", warn: "text-bo-warning" };

/**
 * Cấu hình › Thông tin cửa hàng (GET/PUT /api/v1/thong-tin-cong-ty), hai thẻ sửa và lưu riêng:
 * - "Tên và logo": tên cửa hàng (PUT chỉ gửi name) rồi mới tải logo — logo lỗi thì báo riêng, giữ ảnh để thử lại;
 * - "Pháp lý và liên hệ": tên đăng ký kinh doanh *, mã số thuế, địa chỉ đăng ký *, điện thoại, email.
 * Đang sửa thẻ này thì nút Sửa thẻ kia khóa. Logo chọn xong chỉ tải lên khi bấm Lưu; Hủy thì không ghi gì.
 */
export default function StoreSettingsPage() {
  const { canEdit } = useSettingsPage();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  // null | "A" (Tên và logo) | "B" (Pháp lý và liên hệ)
  const [dangSua, setDangSua] = useState(null);
  const [form, setForm] = useState(null);
  const [touched, setTouched] = useState({});
  // Logo đang chờ lưu: { file, url } (url là object URL để xem trước)
  const [pendingLogo, setPendingLogo] = useState(null);
  const [logoError, setLogoError] = useState("");
  const [saving, setSaving] = useState(false);
  // Chặn bấm Lưu / Enter liên tiếp trước khi React kịp khóa nút
  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  const fileInputRef = useRef(null);
  const pendingUrlRef = useRef(null);
  const editRefA = useRef(null);
  const editRefB = useRef(null);
  const lastEditedRef = useRef(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      // Đọc lại máy chủ: người khác có thể vừa sửa
      const loaded = await companyProfileService.get({ force: true });
      if (!mountedRef.current) return;
      setProfile(loaded);
      setStatus("loaded");
    } catch (error) {
      console.error("Không tải được thông tin cửa hàng:", error);
      if (mountedRef.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [load]);

  // Rời trang khi đang có ảnh chờ lưu: giải phóng object URL
  useEffect(() => () => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
  }, []);

  // Thoát chế độ sửa (Hủy / Lưu xong): trả tiêu điểm về đúng nút Sửa của thẻ vừa sửa
  useEffect(() => {
    if (dangSua) {
      lastEditedRef.current = dangSua;
      return;
    }
    if (lastEditedRef.current) {
      (lastEditedRef.current === "A" ? editRefA : editRefB).current?.focus();
      lastEditedRef.current = null;
    }
  }, [dangSua]);

  const the = dangSua ? THE[dangSua] : null;
  const errors = the ? the.validate(form) : {};
  const hasErrors = Object.keys(errors).length > 0;
  const tenThayDoi = dangSua === "A" && isCompanyProfileChanged(profile, form, KHOA_TEN_VA_LOGO);
  const changed = the ? isCompanyProfileChanged(profile, form, the.keys) || (dangSua === "A" && pendingLogo !== null) : false;
  useUnsavedChanges(changed);

  const choosePendingLogo = (file) => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    pendingUrlRef.current = file ? URL.createObjectURL(file) : null;
    setPendingLogo(file ? { file, url: pendingUrlRef.current } : null);
    if (!file && fileInputRef.current) fileInputRef.current.value = "";
  };
  const clearLogo = () => {
    setLogoError("");
    choosePendingLogo(null);
  };

  // Kiểm loại và dung lượng ngay lúc chọn: sai thì báo dưới nút, không giữ tệp
  const chonTepLogo = (file) => {
    if (!file) return;
    const loi = kiemTepLogo(file);
    if (loi) {
      setLogoError(loi);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setLogoError("");
    choosePendingLogo(file);
  };

  const startEdit = (key) => {
    setForm(companyProfileForm(profile));
    setTouched({});
    clearLogo();
    setDangSua(key);
  };

  const cancelEdit = () => {
    if (savingRef.current) return;
    clearLogo();
    setDangSua(null);
  };

  const ketThucLuu = () => {
    savingRef.current = false;
    if (mountedRef.current) setSaving(false);
  };

  const saveTenVaLogo = async () => {
    let hoSo = profile;
    if (tenThayDoi) {
      try {
        hoSo = await companyProfileService.save(payloadTenVaLogo(form));
      } catch (error) {
        console.error("Không lưu được tên cửa hàng:", error);
        toast.error(TOAST_CHUA_LUU, { description: chiTietLoi(error) });
        return;
      }
    }
    if (pendingLogo) {
      try {
        hoSo = await companyProfileService.uploadLogo(pendingLogo.file);
      } catch (error) {
        console.error("Không tải được logo:", error);
        if (!mountedRef.current) return;
        // Tên (nếu đổi) đã lưu: cập nhật bản đã lưu, giữ chế độ sửa và ảnh đã chọn để thử lại
        setProfile(hoSo);
        toast.error(thongBaoLogoLoi({ daLuuThongTin: tenThayDoi }), { description: chiTietLoi(error) });
        return;
      }
    }
    if (!mountedRef.current) return;
    setProfile(hoSo);
    clearLogo();
    setDangSua(null);
    toast.success(TOAST_DA_LUU);
  };

  const savePhapLy = async () => {
    try {
      const hoSo = await companyProfileService.save(payloadPhapLyLienHe(form));
      if (!mountedRef.current) return;
      setProfile(hoSo);
      setDangSua(null);
      toast.success(TOAST_DA_LUU);
    } catch (error) {
      // Giữ nguyên dữ liệu đã nhập để thử lại
      console.error("Không lưu được thông tin cửa hàng:", error);
      toast.error(TOAST_CHUA_LUU, { description: chiTietLoi(error) });
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!the || savingRef.current) return;
    if (hasErrors) {
      setTouched(Object.fromEntries(the.keys.map((key) => [key, true])));
      return;
    }
    if (!changed) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (dangSua === "A") await saveTenVaLogo();
      else await savePhapLy();
    } finally {
      ketThucLuu();
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

  const coTen = Boolean(profile.name?.trim());
  const nutSua = (key, ariaLabel) => {
    const nut = nutSuaThe(key, { dangSua, coTen, canEdit });
    if (!nut.hien) return null;
    // Nút bị khóa không nhận chuột nên chú thích đặt ở lớp bọc
    return (
      <span title={nut.chuThich || undefined} className="shrink-0">
        <SettingsEditButton
          ref={key === "A" ? editRefA : editRefB}
          onClick={() => startEdit(key)}
          disabled={nut.khoa}
          aria-label={ariaLabel}
        />
      </span>
    );
  };

  const oNhap = (key, { autoFocus = false } = {}) => {
    const o = O_TRANG[key];
    const id = `tt-${key}`;
    const error = touched[key] ? errors[key] : "";
    const goiY = goiYKhiSua(key, form);
    return (
      <div key={key} className={cn("flex min-w-0 flex-col gap-1.5", o.wide && "md:col-span-2")}>
        <label htmlFor={id} className="text-sm leading-5 font-medium text-bo-foreground">
          {o.label}
          {o.required ? <span className="text-bo-danger"> *</span> : null}
        </label>
        <Input
          id={id}
          type={o.type}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={o.placeholder}
          value={form[key]}
          maxLength={MAX_LENGTH[key]}
          onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
          onBlur={() => setTouched((prev) => ({ ...prev, [key]: true }))}
          aria-invalid={Boolean(error)}
          aria-required={o.required || undefined}
          aria-describedby={error || goiY.text ? `${id}-goi-y` : undefined}
          disabled={saving}
          className={settingsInputClass({ error: Boolean(error) })}
        />
        {error ? (
          <SettingsFieldHint id={`${id}-goi-y`} error={error} />
        ) : goiY.text ? (
          <SettingsFieldHint id={`${id}-goi-y`} className={TONE_GOI_Y[goiY.tone]}>
            {goiY.text}
          </SettingsFieldHint>
        ) : null}
      </div>
    );
  };

  const ten = xemTenCuaHang(profile);
  const logoXem = dangSua === "A" ? pendingLogo?.url ?? profile.logoAsset : profile.logoAsset;

  return (
    <>
      <SettingsCard as="form" editing={dangSua === "A"} onSubmit={save} noValidate aria-label="Tên và logo">
        <SettingsCardHeader
          title="Tên và logo"
          note={CHU_THICH_THE_TEN_VA_LOGO}
          action={nutSua("A", "Sửa tên và logo")}
        />
        {dangSua === "A" ? (
          <>
            <div className="px-5 pt-2.5 pb-[18px]">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                <LogoBox src={logoXem} dashed />
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={OUTLINE_BUTTON}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                      aria-describedby="tt-logo-goi-y"
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
                      accept={LOGO_ACCEPT}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(event) => chonTepLogo(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  {logoError ? (
                    <SettingsFieldHint id="tt-logo-goi-y" error={logoError} />
                  ) : (
                    <SettingsFieldHint id="tt-logo-goi-y" className="text-bo-muted">
                      {GOI_Y_LOGO_TRANG}
                    </SettingsFieldHint>
                  )}
                </div>
              </div>
              {oNhap("name", { autoFocus: true })}
            </div>
            <SettingsFormActions onCancel={cancelEdit} saving={saving} disabled={!changed} />
          </>
        ) : (
          <div className="px-5 pt-2.5 pb-[18px]">
            <div className="flex items-center gap-4">
              <LogoBox src={logoXem} emptyText="Chưa có logo" />
              <dl className="min-w-0">
                <dt className="text-[13px] leading-5 text-bo-muted">Tên cửa hàng</dt>
                <dd
                  className={cn(
                    "mt-0.5 break-words",
                    ten.canhBao ? "text-sm leading-5 font-medium text-bo-warning" : "text-base leading-6 font-semibold text-bo-foreground",
                  )}
                >
                  {ten.text}
                </dd>
                {ten.phu ? <dd className="mt-0.5 text-xs leading-4 text-bo-warning">{ten.phu}</dd> : null}
              </dl>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard as="form" editing={dangSua === "B"} onSubmit={save} noValidate aria-label="Pháp lý và liên hệ">
        <SettingsCardHeader
          title="Pháp lý và liên hệ"
          note={CHU_THICH_THE_PHAP_LY}
          action={nutSua("B", "Sửa pháp lý và liên hệ")}
        />
        {dangSua === "B" ? (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 px-5 pt-2.5 pb-[18px] md:grid-cols-2">
              {KHOA_PHAP_LY_LIEN_HE.map((key, index) => oNhap(key, { autoFocus: index === 0 }))}
            </div>
            <SettingsFormActions onCancel={cancelEdit} saving={saving} disabled={!changed} />
          </>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 px-5 pt-2.5 pb-[18px] md:grid-cols-2">
            {xemPhapLyLienHe(profile).map((dong) => (
              <div key={dong.key} className={cn("min-w-0", dong.wide && "md:col-span-2")}>
                <dt className="text-[13px] leading-5 text-bo-muted">{dong.label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-sm leading-5 break-words",
                    dong.canhBao ? "font-medium text-bo-warning" : dong.trong ? "text-bo-muted" : "text-bo-foreground",
                    dong.so && "tabular-nums",
                  )}
                >
                  {dong.text}
                  {dong.tag ? <span className="font-normal text-bo-muted"> · {dong.tag}</span> : null}
                </dd>
                {dong.phu ? <dd className="mt-0.5 text-xs leading-4 text-bo-warning">{dong.phu}</dd> : null}
              </div>
            ))}
          </dl>
        )}
      </SettingsCard>
    </>
  );
}

function LogoBox({ src, dashed = false, emptyText = "" }) {
  // Ảnh lỗi (đường dẫn hỏng, MinIO tắt): hiện biểu tượng thay vì chữ alt tràn khung
  const [anhLoi, setAnhLoi] = useState(null);
  const hienAnh = src && anhLoi !== src;
  return (
    <div
      className={cn(
        "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-bo-surface-subtle p-1.5",
        dashed ? "border-dashed border-[#b6c0cc]" : "border-bo-border",
      )}
    >
      {hienAnh ? (
        <img src={src} alt="Logo cửa hàng" className="max-h-full max-w-full object-contain" onError={() => setAnhLoi(src)} />
      ) : !src && emptyText ? (
        <span className="text-center text-[11px] leading-[14px] text-[#94a3b8]">{emptyText}</span>
      ) : (
        <Store className="size-6 text-[#94a3b8]" aria-hidden="true" />
      )}
    </div>
  );
}
