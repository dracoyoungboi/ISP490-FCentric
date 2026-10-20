import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/thongBaoNhanh";
import { Building2, ImagePlus, X } from "lucide-react";
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
import { SettingsFieldHint } from "@/components/settings/SettingsUI";
import { companyProfileService } from "@/services/companyProfileService";
import {
    COMPANY_PROFILE_FIELDS,
    companyProfileForm,
    companyProfilePayload,
    isCompanyProfileChanged,
    validateCompanyProfile,
} from "@/validations/companyProfileSchema";

function Field({ id, label, value, onChange, onBlur, error, placeholder, type = "text", autoFocus = false }) {
    return (
        <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-bo-muted">
                {label}
            </span>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                // Form render SAU khi tải xong profile nên autoFocus trên ô
                // tên công ty mới đưa được focus vào đúng ô đầu tiên (focus
                // ban đầu của Radix rơi vào nút đóng).
                autoFocus={autoFocus}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-loi` : undefined}
                className="border-bo-border bg-white text-bo-foreground"
            />
            {/* Như trang Thông tin cửa hàng: lỗi hiện dưới ô sau khi rời ô */}
            {error ? <SettingsFieldHint id={`${id}-loi`} error={error} /> : null}
        </div>
    );
}

/**
 * Hộp thoại "Thông tin cửa hàng" — sửa nhanh ngay trong trình chỉnh sửa mẫu in.
 * Trang đầy đủ: Cấu hình › Thông tin cửa hàng (/settings/store); kiểm tra dữ liệu dùng chung
 * validations/companyProfileSchema.js.
 *
 * - Chỉnh sửa giữ cục bộ trong form; bấm "Lưu thông tin" mới ghi server
 *   (logo đợi đến lúc lưu mới tải lên MinIO).
 * - Lưu lỗi -> hộp thoại vẫn mở, dữ liệu nhập (kể cả logo đã chọn) giữ nguyên.
 * - Hủy / đóng khi đang có thay đổi -> hỏi xác nhận bỏ thay đổi.
 * - onSaved(profile) để trang cha cập nhật ngay bản xem (preview/tiêu đề).
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
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

    // Logo đang chờ lưu (File + object URL để xem trước)
    const [pendingLogoFile, setPendingLogoFile] = useState(null);
    const [pendingLogoUrl, setPendingLogoUrl] = useState(null);
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
            if (fileInputRef.current) fileInputRef.current.value = "";
            try {
                const profile = await companyProfileService.get();
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

    const isDirty =
        Boolean(loaded) &&
        Boolean(form) &&
        (isCompanyProfileChanged(loaded, form) || pendingLogoFile !== null);

    const fieldErrors = form ? validateCompanyProfile(form) : {};
    const hasErrors = Object.keys(fieldErrors).length > 0;
    // Props chung của một ô: giá trị, đổi giá trị, rời ô, lỗi (sau khi rời ô / bấm Lưu)
    const fieldProps = (key) => ({
        id: `ho-so-cua-hang-${key}`,
        value: form[key],
        onChange: (value) => setForm((prev) => ({ ...prev, [key]: value })),
        onBlur: () => setTouched((prev) => ({ ...prev, [key]: true })),
        error: touched[key] ? fieldErrors[key] : undefined,
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
        if (saving) return;
        if (isDirty) {
            setConfirmDiscardOpen(true);
            return;
        }
        onOpenChange(false);
    };

    const handleSave = async () => {
        // Như trang Thông tin cửa hàng: còn lỗi (kể cả giá trị sai có sẵn từ máy chủ ở ô chưa rời)
        // -> đánh dấu mọi ô đã rời để lỗi hiện dưới ô, không gửi
        if (hasErrors) {
            setTouched(Object.fromEntries(COMPANY_PROFILE_FIELDS.map((key) => [key, true])));
            return;
        }
        setSaving(true);
        try {
            // Logo đợi đến khi lưu mới tải lên (MinIO) — Hủy trước đó thì không ghi gì
            if (pendingLogoFile) {
                await companyProfileService.uploadLogo(pendingLogoFile);
            }
            const updated = await companyProfileService.save(companyProfilePayload(form));
            setLoaded(updated);
            setPendingLogoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            toast.success("Đã lưu thông tin cửa hàng.");
            onSaved?.(updated);
            onOpenChange(false);
        } catch (error) {
            // Lỗi -> giữ nguyên hộp thoại và dữ liệu đã nhập để người dùng thử lại
            console.error("Không lưu được thông tin cửa hàng:", error);
            toast.error("Chưa lưu được thông tin cửa hàng. Vui lòng thử lại.");
        } finally {
            setSaving(false);
        }
    };

    const logoShown = pendingLogoUrl ?? loaded?.logoAsset ?? null;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!nextOpen) requestClose();
        }}>
            {/* 600-640px trên desktop; responsive dưới sm (max-w calc 100%-2rem);
                giới hạn chiều cao theo viewport và cuộn bên trong khi cần. */}
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white shadow-lg sm:max-w-[620px]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-bo-foreground">
                        Thông tin cửa hàng
                    </DialogTitle>
                    <DialogDescription className="pt-1 text-sm text-bo-muted">
                        Hiện ở đầu mọi phiếu in và hóa đơn bán hàng.
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
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            onClick={() => setReloadKey((key) => key + 1)}
                        >
                            Thử lại
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                Logo cửa hàng
                            </span>
                            <div className="flex items-center gap-3">
                                {logoShown ? (
                                    <img
                                        src={logoShown}
                                        alt="Logo cửa hàng"
                                        className="h-12 w-12 rounded-md border border-bo-border bg-white object-contain p-1"
                                    />
                                ) : (
                                    <span className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-bo-border bg-bo-surface-subtle text-bo-muted">
                                        <Building2 className="size-5" />
                                    </span>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="cursor-pointer rounded-md border border-bo-border bg-white px-3 py-1.5 text-sm text-bo-foreground hover:bg-bo-surface-subtle focus-within:outline-none focus-within:ring-2 focus-within:ring-bo-primary">
                                        <ImagePlus className="mr-1.5 inline size-4" />
                                        Chọn ảnh logo
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] ?? null;
                                                setPendingLogoFile(file);
                                            }}
                                        />
                                    </label>
                                    {pendingLogoFile ? (
                                        <Button
                                            variant="outline"
                                            className="border-bo-border bg-white text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
                                            onClick={() => {
                                                setPendingLogoFile(null);
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = "";
                                                }
                                            }}
                                        >
                                            <X className="size-4" />
                                            Bỏ logo đã chọn
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                            {pendingLogoFile ? (
                                <p className="text-xs text-bo-muted">
                                    Logo mới chỉ được tải lên khi bạn bấm “Lưu thông tin”.
                                </p>
                            ) : null}
                        </div>

                        <Field
                            {...fieldProps("name")}
                            label="Tên cửa hàng"
                            placeholder="Ví dụ: Thời trang Mộc An"
                            autoFocus
                        />
                        <Field
                            {...fieldProps("taxCode")}
                            label="Mã số thuế"
                            placeholder="Ví dụ: 0312345678"
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                {...fieldProps("email")}
                                label="Email"
                                placeholder="lienhe@congty.vn"
                            />
                            <Field
                                {...fieldProps("phone")}
                                label="Điện thoại"
                                placeholder="028 7300 0000"
                            />
                        </div>
                        <Field
                            {...fieldProps("address")}
                            label="Địa chỉ"
                            placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
                        />
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={requestClose}
                        disabled={saving}
                    >
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        onClick={handleSave}
                        disabled={saving || !isDirty}
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
