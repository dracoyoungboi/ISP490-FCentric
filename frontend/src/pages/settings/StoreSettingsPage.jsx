import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, RotateCcw, Store, Trash2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
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
import { settingsInputClass } from "@/components/settings/settingsStyles";
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
  CHU_DUOI_LOGO,
  CHU_DUOI_LOGO_SE_XOA,
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
import { t } from "@/i18n";

const THE = {
  A: { keys: KHOA_TEN_VA_LOGO, validate: validateTenVaLogo, payload: payloadTenVaLogo },
  B: { keys: KHOA_PHAP_LY_LIEN_HE, validate: validatePhapLyLienHe, payload: payloadPhapLyLienHe },
};

const MAX_LENGTH = { name: TEN_TOI_DA, legalName: TEN_TOI_DA, email: EMAIL_TOI_DA };

// Một hàng của thẻ Pháp lý, dùng chung lúc xem và lúc sửa để bấm Sửa cột nhãn không xê dịch ngang
const HANG_PHAP_LY =
  "grid grid-cols-1 gap-1 border-t border-[#eef1f5] px-5 py-2.5 first:border-t-0 sm:grid-cols-[196px_minmax(0,1fr)] sm:gap-4";
// Lúc xem trên màn rộng: các hàng chia đều phần cao thẻ đã giãn theo menu, chữ giữa hàng, thấp nhất 44px.
// Nền 44px thay cho min-h để hàng nhiều dòng (địa chỉ dài, dòng cảnh báo) vẫn cao theo nội dung, không bị ép đè đường kẻ
const HANG_PHAP_LY_XEM = cn(HANG_PHAP_LY, "lg:flex-[1_1_2.75rem] lg:content-center");

// Màu gợi ý dưới ô (khớp demo: xám #64748b, xanh #15803d, cam #b45309)
const TONE_GOI_Y = { muted: "text-bo-muted", ok: "text-bo-success", warn: "text-bo-warning" };

/**
 * Cấu hình › Thông tin cửa hàng (GET/PUT /api/v1/thong-tin-cong-ty), hai thẻ sửa và lưu riêng:
 * - "Tên và logo": tên cửa hàng (PUT chỉ gửi name) rồi mới tải hoặc gỡ logo — logo lỗi thì báo riêng, giữ lựa chọn
 *   để thử lại;
 * - "Pháp lý và liên hệ": tên đăng ký kinh doanh *, mã số thuế, địa chỉ đăng ký *, điện thoại, email.
 * Đang sửa thẻ này thì nút Sửa thẻ kia khóa. Logo chọn xong (hoặc bấm Xóa logo) chỉ ghi khi bấm Lưu; Hủy thì không
 * ghi gì.
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
  // Đã bấm Xóa logo: gỡ logo đang dùng khi bấm Lưu
  const [xoaLogo, setXoaLogo] = useState(false);
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
  const changed = the
    ? isCompanyProfileChanged(profile, form, the.keys) || (dangSua === "A" && (pendingLogo !== null || xoaLogo))
    : false;
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
  // Thoát chế độ sửa hoặc bắt đầu sửa: bỏ cả ảnh đang chờ lẫn lựa chọn xóa logo
  const resetLogo = () => {
    clearLogo();
    setXoaLogo(false);
  };
  const chonXoaLogo = () => {
    clearLogo();
    setXoaLogo(true);
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
    setXoaLogo(false);
    choosePendingLogo(file);
  };

  const startEdit = (key) => {
    setForm(companyProfileForm(profile));
    setTouched({});
    resetLogo();
    setDangSua(key);
  };

  const cancelEdit = () => {
    if (savingRef.current) return;
    resetLogo();
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
    } else if (xoaLogo) {
      try {
        hoSo = await companyProfileService.removeLogo();
      } catch (error) {
        console.error("Không xóa được logo:", error);
        if (!mountedRef.current) return;
        setProfile(hoSo);
        toast.error(thongBaoLogoLoi({ daLuuThongTin: tenThayDoi, xoa: true }), { description: chiTietLoi(error) });
        return;
      }
    }
    if (!mountedRef.current) return;
    setProfile(hoSo);
    resetLogo();
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
        <LoadingState label={t("Đang tải thông tin cửa hàng")} className="min-h-48" />
      </SettingsCard>
    );
  }

  if (status === "error" || !profile) {
    return (
      <SettingsCard>
        <ErrorState
          title={t("Không thể tải thông tin cửa hàng")}
          description={t("Không đọc được thông tin cửa hàng từ máy chủ. Vui lòng thử lại.")}
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

  // hang: một hàng của thẻ Pháp lý — nhãn cột trái đúng chỗ lúc xem, ô nhập cột phải (màn hẹp: nhãn trên ô)
  const oNhap = (key, { autoFocus = false, hang = false } = {}) => {
    const o = O_TRANG[key];
    const id = `tt-${key}`;
    const error = touched[key] ? errors[key] : "";
    const goiY = goiYKhiSua(key, form);
    const nhan = (
      <label
        htmlFor={id}
        className={hang ? "text-[13px] leading-5 text-bo-muted sm:pt-2" : "text-sm leading-5 font-medium text-bo-foreground"}
      >
        {o.label}
        {o.required ? <span className="text-bo-danger"> *</span> : null}
      </label>
    );
    const oVaGoiY = (
      <>
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
      </>
    );
    if (hang) {
      return (
        <div key={key} className={HANG_PHAP_LY}>
          {nhan}
          <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-[480px]">{oVaGoiY}</div>
        </div>
      );
    }
    return (
      <div key={key} className={cn("flex min-w-0 flex-col gap-1.5", o.wide && "md:col-span-2")}>
        {nhan}
        {oVaGoiY}
      </div>
    );
  };

  const ten = xemTenCuaHang(profile);
  const logoXem = dangSua === "A" ? pendingLogo?.url ?? (xoaLogo ? null : profile.logoAsset) : profile.logoAsset;

  return (
    <>
      <SettingsCard as="form" editing={dangSua === "A"} onSubmit={save} noValidate aria-label={t("Tên và logo")}>
        <SettingsCardHeader
          title={t("Tên và logo")}
          note={CHU_THICH_THE_TEN_VA_LOGO}
          action={nutSua("A", t("Sửa tên và logo"))}
        />
        {dangSua === "A" ? (
          <>
            {/* Giữ bố cục như lúc xem: logo bên trái (nút đổi, xóa ở góc khung), ô tên bên phải */}
            <div className="flex flex-col gap-3 px-5 pt-2.5 pb-[18px]">
              <div className="flex flex-col gap-x-5 gap-y-4 sm:flex-row sm:items-start">
                <div className="flex w-16 shrink-0 flex-col items-center gap-2.5">
                  <LogoBox
                    src={logoXem}
                    onPick={() => fileInputRef.current?.click()}
                    onDropFile={chonTepLogo}
                    onRemove={pendingLogo ? clearLogo : chonXoaLogo}
                    coAnhMoi={Boolean(pendingLogo)}
                    describedBy={logoError ? "tt-logo-goi-y tt-logo-loi" : "tt-logo-goi-y"}
                    disabled={saving}
                  />
                  <p id="tt-logo-goi-y" title={GOI_Y_LOGO_TRANG} className="text-center text-[11px] leading-[14px] whitespace-pre-line text-bo-muted">
                    {xoaLogo ? CHU_DUOI_LOGO_SE_XOA : CHU_DUOI_LOGO}
                  </p>
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
                <div className="flex min-w-0 flex-1 flex-col sm:max-w-[480px]">{oNhap("name", { autoFocus: true })}</div>
              </div>
              {logoError ? <SettingsFieldHint id="tt-logo-loi" error={`Logo: ${logoError}`} /> : null}
            </div>
            <SettingsFormActions onCancel={cancelEdit} saving={saving} disabled={!changed} />
          </>
        ) : (
          <div className="px-5 pt-2.5 pb-[18px]">
            <div className="flex items-center gap-4">
              <LogoBox src={logoXem} emptyText={t("Chưa có logo")} />
              <dl className="min-w-0">
                <dt className="text-[13px] leading-5 text-bo-muted">{t("Tên cửa hàng")}</dt>
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

      {/* Thẻ cuối giãn để đáy thẳng với menu Cấu hình bên trái (màn rộng); lúc xem các hàng chia đều phần giãn */}
      <SettingsCard
        as="form"
        editing={dangSua === "B"}
        onSubmit={save}
        noValidate
        aria-label={t("Pháp lý và liên hệ")}
        className="lg:flex lg:flex-1 lg:flex-col"
      >
        <SettingsCardHeader
          title={t("Pháp lý và liên hệ")}
          note={CHU_THICH_THE_PHAP_LY}
          action={nutSua("B", t("Sửa pháp lý và liên hệ"))}
        />
        {dangSua === "B" ? (
          <>
            <div className="pt-0.5 pb-1.5">
              {KHOA_PHAP_LY_LIEN_HE.map((key, index) => oNhap(key, { autoFocus: index === 0, hang: true }))}
            </div>
            <SettingsFormActions onCancel={cancelEdit} saving={saving} disabled={!changed} />
          </>
        ) : (
          // Danh sách hàng: nhãn cột trái, giá trị cột phải, kẻ mảnh giữa các hàng (màn hẹp: nhãn nằm trên giá trị)
          <dl className="pt-0.5 pb-1.5 lg:flex lg:flex-1 lg:flex-col">
            {xemPhapLyLienHe(profile).map((dong) => (
              <div key={dong.key} className={HANG_PHAP_LY_XEM}>
                <dt className="text-[13px] leading-5 text-bo-muted">{dong.label}</dt>
                <dd className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm leading-5 break-words",
                      dong.canhBao ? "font-medium text-bo-warning" : dong.trong ? "text-bo-muted" : "text-bo-foreground",
                      dong.so && "tabular-nums",
                    )}
                  >
                    {dong.text}
                    {dong.tag ? <span className="font-normal text-bo-muted"> · {dong.tag}</span> : null}
                  </span>
                  {dong.phu ? <span className="mt-0.5 block text-xs leading-4 text-bo-warning">{dong.phu}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </SettingsCard>
    </>
  );
}

// Nút tròn 24px ở góc khung logo; ::before trong suốt mở vùng chạm lên 40px mà không to nút
const NUT_GOC =
  "absolute grid size-6 place-items-center rounded-full border border-bo-border bg-white text-slate-700 shadow-[0_1px_3px_rgba(16,24,40,0.18)] " +
  "before:absolute before:-inset-2 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary " +
  "disabled:opacity-60 enabled:hover:border-[#bcd3f5] enabled:hover:text-bo-primary [&_svg]:size-3.5";

/**
 * Khung logo. Có onPick (đang sửa): viền nét đứt, bấm để chọn ảnh hoặc kéo ảnh thả vào.
 * Đang có ảnh: góc dưới nút bút chì (đổi ảnh), góc trên nút thùng rác (xóa logo) — vừa chọn ảnh mới thì thành nút
 * quay lại (bỏ ảnh vừa chọn). Bàn phím dùng hai nút góc; khung trống thì chính khung nhận Tab.
 */
function LogoBox({ src, emptyText = "", onPick, onDropFile, onRemove, coAnhMoi = false, describedBy, disabled = false }) {
  // Ảnh lỗi (đường dẫn hỏng, MinIO tắt): hiện biểu tượng thay vì chữ alt tràn khung
  const [anhLoi, setAnhLoi] = useState(null);
  const [dangKeo, setDangKeo] = useState(false);
  const hienAnh = src && anhLoi !== src;
  const chonDuoc = Boolean(onPick) && !disabled;
  const noiDung = hienAnh ? (
    <img src={src} alt={t("Logo cửa hàng")} className="max-h-full max-w-full object-contain" onError={() => setAnhLoi(src)} />
  ) : !src && emptyText ? (
    <span className="text-center text-[11px] leading-[14px] text-[#94a3b8]">{emptyText}</span>
  ) : onPick && !src ? (
    <ImagePlus className="size-6" aria-hidden="true" />
  ) : (
    <Store className="size-6 text-[#94a3b8]" aria-hidden="true" />
  );
  const khung = "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-bo-surface-subtle p-1.5";

  if (!onPick) return <div className={cn(khung, "border-bo-border")}>{noiDung}</div>;

  return (
    <div className="relative">
      <button
        type="button"
        // Có ảnh: hai nút góc lo bàn phím, khung chỉ để bấm chuột / thả ảnh
        tabIndex={src ? -1 : undefined}
        aria-hidden={src ? "true" : undefined}
        aria-label={src ? undefined : t("Chọn ảnh logo")}
        aria-describedby={src ? undefined : describedBy}
        title={t("Bấm hoặc kéo ảnh thả vào để chọn logo")}
        disabled={disabled}
        onClick={onPick}
        onDragOver={(event) => {
          if (!chonDuoc) return;
          event.preventDefault();
          setDangKeo(true);
        }}
        onDragLeave={() => setDangKeo(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDangKeo(false);
          if (chonDuoc) onDropFile?.(event.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          khung,
          "border-dashed border-[#b6c0cc] transition-colors enabled:cursor-pointer enabled:hover:border-bo-primary disabled:opacity-60",
          !src && "text-[#94a3b8] enabled:hover:bg-bo-primary-soft enabled:hover:text-bo-primary",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary",
          dangKeo && "border-bo-primary bg-bo-primary-soft",
        )}
      >
        {noiDung}
      </button>
      {src ? (
        <>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={coAnhMoi ? t("Bỏ ảnh vừa chọn") : t("Xóa logo")}
            title={coAnhMoi ? t("Bỏ ảnh vừa chọn") : t("Xóa logo")}
            className={cn(NUT_GOC, "-top-2 -right-2", !coAnhMoi && "enabled:hover:border-[#f3c4c4] enabled:hover:text-bo-danger")}
          >
            {coAnhMoi ? <RotateCcw aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            aria-label={t("Đổi logo")}
            aria-describedby={describedBy}
            title={t("Đổi logo")}
            className={cn(NUT_GOC, "-right-2 -bottom-2")}
          >
            <Pencil aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  );
}
