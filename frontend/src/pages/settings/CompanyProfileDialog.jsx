import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { Store, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/shared/LoadingState";
import ConfirmModal from "@/components/ui/confirm-modal";
import { SettingsFieldHint, SettingsGroupLabel } from "@/components/settings/SettingsUI";
import { OUTLINE_BUTTON, PRIMARY_BUTTON, settingsInputClass } from "@/components/settings/settingsStyles";
import { companyProfileService } from "@/services/companyProfileService";
import {
    COMPANY_PROFILE_FIELDS,
    EMAIL_TOI_DA,
    LOGO_ACCEPT,
    TEN_TOI_DA,
    companyProfileForm,
    companyProfilePayload,
    isCompanyProfileChanged,
    kiemTepLogo,
    validateCompanyProfile,
} from "@/validations/companyProfileSchema";
import {
    CHU_THICH_HOP_SUA_NHANH,
    GOI_Y_LOGO_HOP,
    O_HOP_SUA_NHANH,
    THU_TU_PHAP_LY_HOP,
    TOAST_CHUA_LUU,
    TOAST_DA_LUU,
    chiTietLoi,
    goiYKhiSua,
    thongBaoLogoLoi,
} from "./thongTinCuaHang";

const MAX_LENGTH = { name: TEN_TOI_DA, legalName: TEN_TOI_DA, email: EMAIL_TOI_DA };
// Màu gợi ý dưới ô (khớp demo: xám, xanh nhận dạng mã số thuế, cam lệch loại)
const TONE_GOI_Y = { muted: "text-bo-muted", ok: "text-bo-success", warn: "text-bo-warning" };

function Field({ fieldKey, form, error, onChange, onBlur, disabled, autoFocus = false }) {
    const o = O_HOP_SUA_NHANH[fieldKey];
    const id = `ho-so-cua-hang-${fieldKey}`;
    const goiY = goiYKhiSua(fieldKey, form, { noi: "hop" });
    const moTaId = error || goiY.text ? `${id}-goi-y` : undefined;
    return (
        <div className={cn("flex min-w-0 flex-col gap-1.5", o.wide && "sm:col-span-2")}>
            <label htmlFor={id} className="text-sm leading-5 font-medium text-bo-foreground">
                {o.label}
                {o.required ? <span className="text-bo-danger"> *</span> : null}
            </label>
            <Input
                id={id}
                type={o.type}
                autoComplete="off"
                value={form[fieldKey]}
                onChange={(event) => onChange(fieldKey, event.target.value)}
                onBlur={() => onBlur(fieldKey)}
                placeholder={o.placeholder}
                maxLength={MAX_LENGTH[fieldKey]}
                // Form render SAU khi tải xong hồ sơ nên autoFocus trên ô tên cửa hàng mới đưa được
                // focus vào đúng ô đầu tiên (focus ban đầu của Radix rơi vào nút đóng).
                autoFocus={autoFocus}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-required={o.required || undefined}
                aria-describedby={moTaId}
                className={settingsInputClass({ error: Boolean(error) })}
            />
            {/* Như trang Thông tin cửa hàng: lỗi hiện dưới ô sau khi rời ô, thay cho gợi ý */}
            {error ? (
                <SettingsFieldHint id={moTaId} error={error} />
            ) : goiY.text ? (
                <SettingsFieldHint id={moTaId} className={TONE_GOI_Y[goiY.tone]}>
                    {goiY.text}
                </SettingsFieldHint>
            ) : null}
        </div>
    );
}

/**
 * Hộp thoại "Thông tin cửa hàng" — sửa nhanh ngay trong trình sửa mẫu in, cùng quy tắc với trang
 * Cấu hình › Thông tin cửa hàng (/settings/store) qua validations/companyProfileSchema.js.
 *
 * - Hai nhóm "Tên và logo" · "Pháp lý và liên hệ"; hộp lưu cả hai phần nên tên đăng ký kinh doanh và
 *   địa chỉ đăng ký bắt buộc.
 * - Chỉnh sửa giữ cục bộ trong form; bấm "Lưu thông tin" mới ghi server: lưu hồ sơ TRƯỚC rồi mới tải logo
 *   (cửa hàng mới chọn logo ngay lần đầu vẫn lưu được). Logo lỗi thì báo riêng, giữ hộp mở và giữ ảnh để thử lại.
 * - Lưu lỗi -> hộp thoại vẫn mở, dữ liệu nhập (kể cả logo đã chọn) giữ nguyên.
 * - Hủy / đóng khi đang có thay đổi -> hỏi xác nhận bỏ thay đổi.
 * - onSaved(profile) để trang cha cập nhật ngay bản xem (đầu phiếu).
 */
export default function CompanyProfileDialog({ open, onOpenChange, onSaved }) {
    const [loaded, setLoaded] = useState(null);
    const [form, setForm] = useState(null);
    // Ô đã rời (blur) — chỉ hiện lỗi dưới ô sau khi rời ô hoặc bấm Lưu, như trang Thông tin cửa hàng
    const [touched, setTouched] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

    // Logo đang chờ lưu (File + object URL để xem trước) và lỗi chọn tệp
    const [pendingLogoFile, setPendingLogoFile] = useState(null);
    const [pendingLogoUrl, setPendingLogoUrl] = useState(null);
    const [logoError, setLogoError] = useState("");
    const fileInputRef = useRef(null);

    // Mở hộp thoại -> nạp hồ sơ mới nhất từ server, bỏ trạng thái của lần trước
    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(false);
            setLoaded(null);
            setForm(null);
            setTouched({});
            setPendingLogoFile(null);
            setLogoError("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            try {
                const profile = await companyProfileService.get({ force: true });
                if (cancelled) return;
                setLoaded(profile);
                setForm(companyProfileForm(profile));
            } catch (error) {
                console.error("Không tải được thông tin cửa hàng:", error);
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, reloadKey]);

    // Object URL cho logo đang chờ (dọn khi đổi/hủy)
    useEffect(() => {
        if (!pendingLogoFile) {
            setPendingLogoUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(pendingLogoFile);
        setPendingLogoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [pendingLogoFile]);

    const thongTinThayDoi = Boolean(loaded) && Boolean(form) && isCompanyProfileChanged(loaded, form);
    const isDirty = thongTinThayDoi || (Boolean(form) && pendingLogoFile !== null);

    const fieldErrors = form ? validateCompanyProfile(form) : {};
    const hasErrors = Object.keys(fieldErrors).length > 0;
    const doiO = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const roiO = (key) => setTouched((prev) => ({ ...prev, [key]: true }));
    const fieldProps = (key) => ({
        fieldKey: key,
        form,
        error: touched[key] ? fieldErrors[key] : undefined,
        onChange: doiO,
        onBlur: roiO,
        disabled: saving,
    });

    // Cảnh báo đóng tab khi hộp thoại đang mở và có thay đổi chưa lưu
    useEffect(() => {
        if (!open || !isDirty) return undefined;
        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [open, isDirty]);

    // Yêu cầu đóng (Hủy / X / Escape / click nền): đang dirty thì hỏi trước
    const requestClose = () => {
        if (savingRef.current) return;
        if (isDirty) {
            setConfirmDiscardOpen(true);
            return;
        }
        onOpenChange(false);
    };

    const boLogoDaChon = () => {
        setPendingLogoFile(null);
        setLogoError("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Kiểm loại và dung lượng ngay lúc chọn: sai thì báo dưới nút, không giữ tệp
    const chonTepLogo = (file) => {
        if (!file) return;
        const loi = kiemTepLogo(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (loi) {
            setLogoError(loi);
            return;
        }
        setLogoError("");
        setPendingLogoFile(file);
    };

    const handleSave = async (event) => {
        event?.preventDefault();
        if (!form || savingRef.current) return;
        // Còn lỗi (kể cả ô bắt buộc đang trống từ máy chủ ở ô chưa rời) -> đánh dấu mọi ô đã rời để lỗi
        // hiện dưới ô, không gửi
        if (hasErrors) {
            setTouched(Object.fromEntries(COMPANY_PROFILE_FIELDS.map((key) => [key, true])));
            return;
        }
        if (!isDirty) return;
        savingRef.current = true;
        setSaving(true);
        try {
            let hoSo = loaded;
            // 1. Lưu hồ sơ trước (máy chủ chỉ nhận logo khi đã có tên cửa hàng)
            if (thongTinThayDoi) {
                try {
                    hoSo = await companyProfileService.save(companyProfilePayload(form));
                } catch (error) {
                    console.error("Không lưu được thông tin cửa hàng:", error);
                    toast.error(TOAST_CHUA_LUU, { description: chiTietLoi(error) });
                    return;
                }
                setLoaded(hoSo);
                onSaved?.(hoSo);
            }
            // 2. Rồi mới tải logo (Hủy trước đó thì không ghi gì)
            if (pendingLogoFile) {
                try {
                    hoSo = await companyProfileService.uploadLogo(pendingLogoFile);
                } catch (error) {
                    console.error("Không tải được logo:", error);
                    toast.error(thongBaoLogoLoi({ daLuuThongTin: thongTinThayDoi, noi: "hop" }), {
                        description: chiTietLoi(error),
                    });
                    return;
                }
                setLoaded(hoSo);
                onSaved?.(hoSo);
            }
            boLogoDaChon();
            toast.success(TOAST_DA_LUU);
            onOpenChange(false);
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const logoShown = pendingLogoUrl ?? loaded?.logoAsset ?? null;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!nextOpen) requestClose();
        }}>
            {/* 620px trên desktop; responsive dưới sm (max-w calc 100%-2rem);
                giới hạn chiều cao theo viewport và cuộn bên trong khi cần. */}
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white shadow-lg sm:max-w-[620px]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-bo-foreground">
                        Thông tin cửa hàng
                    </DialogTitle>
                    <DialogDescription className="pt-1 text-sm text-bo-muted">
                        {CHU_THICH_HOP_SUA_NHANH}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <LoadingState label="Đang tải thông tin cửa hàng" className="min-h-40" />
                ) : loadError || !form ? (
                    <div className="flex flex-col items-center gap-3 rounded-md border border-bo-border bg-bo-surface-subtle px-4 py-6 text-center">
                        <p className="text-sm text-bo-muted">
                            Không thể tải thông tin cửa hàng từ máy chủ. Vui lòng thử lại.
                        </p>
                        <Button
                            variant="outline"
                            className={OUTLINE_BUTTON}
                            onClick={() => setReloadKey((key) => key + 1)}
                        >
                            Thử lại
                        </Button>
                    </div>
                ) : (
                    <form id="ho-so-cua-hang-form" noValidate onSubmit={handleSave} className="flex flex-col gap-4">
                        <SettingsGroupLabel className="pt-1 pb-0 text-bo-muted">Tên và logo</SettingsGroupLabel>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-bo-border bg-white p-1">
                                {logoShown ? (
                                    <img src={logoShown} alt="Logo cửa hàng" className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <Store className="size-5 text-[#94a3b8]" aria-hidden="true" />
                                )}
                            </span>
                            <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(OUTLINE_BUTTON, "h-8 px-3 text-[13px]")}
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={saving}
                                        aria-describedby="ho-so-cua-hang-logo-goi-y"
                                    >
                                        Chọn ảnh logo
                                    </Button>
                                    {pendingLogoFile ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(OUTLINE_BUTTON, "h-8 px-3 text-[13px]")}
                                            onClick={boLogoDaChon}
                                            disabled={saving}
                                        >
                                            <X className="size-4" aria-hidden="true" />
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
                                    <SettingsFieldHint id="ho-so-cua-hang-logo-goi-y" error={logoError} />
                                ) : (
                                    <SettingsFieldHint id="ho-so-cua-hang-logo-goi-y" className="text-bo-muted">
                                        {GOI_Y_LOGO_HOP}
                                    </SettingsFieldHint>
                                )}
                            </div>
                        </div>
                        <Field {...fieldProps("name")} autoFocus />

                        <SettingsGroupLabel className="pt-1 pb-0 text-bo-muted">Pháp lý và liên hệ</SettingsGroupLabel>
                        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
                            {THU_TU_PHAP_LY_HOP.map((key) => (
                                <Field key={key} {...fieldProps(key)} />
                            ))}
                        </div>
                    </form>
                )}

                <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        className={OUTLINE_BUTTON}
                        onClick={requestClose}
                        disabled={saving}
                    >
                        Hủy
                    </Button>
                    <Button
                        type="submit"
                        form="ho-so-cua-hang-form"
                        className={PRIMARY_BUTTON}
                        disabled={saving || !isDirty || !form}
                    >
                        {saving ? "Đang lưu…" : "Lưu thông tin"}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <ConfirmModal
                isOpen={confirmDiscardOpen}
                onClose={() => setConfirmDiscardOpen(false)}
                onConfirm={() => {
                    setConfirmDiscardOpen(false);
                    onOpenChange(false);
                }}
                variant="warning"
                title="Hủy thay đổi thông tin cửa hàng?"
                description="Các thay đổi chưa lưu (kể cả logo đã chọn) sẽ bị bỏ."
                confirmText="Bỏ thay đổi"
                cancelText="Ở lại"
            />
        </Dialog>
    );
}
