import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { companyProfileService } from "@/services/companyProfileService";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;

function Field({ label, value, onChange, placeholder, type = "text", autoFocus = false }) {
    return (
        <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-bo-muted">
                {label}
            </span>
            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                // Form render SAU khi tải xong profile nên autoFocus trên ô
                // tên công ty mới đưa được focus vào đúng ô đầu tiên (focus
                // ban đầu của Radix rơi vào nút đóng).
                autoFocus={autoFocus}
                className="border-bo-border bg-white text-bo-foreground"
            />
        </div>
    );
}

/**
 * Hộp thoại "Thông tin công ty" — hồ sơ DÙNG CHUNG cho mọi mẫu in, mở
 * ngay tại trang đang đứng (không còn trang riêng /settings/company-profile;
 * route đó chuyển hướng về trang cấu hình mẫu in và mở hộp thoại này).
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
            setPendingLogoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            try {
                const profile = await companyProfileService.get();
                if (cancelled) return;
                setLoaded(profile);
                setForm({
                    name: profile?.name ?? "",
                    email: profile?.email ?? "",
                    phone: profile?.phone ?? "",
                    address: profile?.address ?? "",
                });
            } catch (error) {
                console.error("Error loading company profile:", error);
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

    const normalize = (value) => (value ?? "").trim();

    const isDirty =
        Boolean(loaded) &&
        Boolean(form) &&
        (normalize(form.name) !== normalize(loaded.name) ||
            normalize(form.email) !== normalize(loaded.email) ||
            normalize(form.phone) !== normalize(loaded.phone) ||
            normalize(form.address) !== normalize(loaded.address) ||
            pendingLogoFile !== null);

    const collectIssues = () => {
        const errors = [];
        if (!normalize(form?.name)) errors.push("Tên công ty không được để trống");
        if (form?.email?.trim() && !EMAIL_RE.test(normalize(form.email))) {
            errors.push("Email công ty không hợp lệ");
        }
        if (form?.phone?.trim() && !PHONE_RE.test(normalize(form.phone))) {
            errors.push("Số điện thoại công ty không hợp lệ");
        }
        return errors;
    };

    const issues = form ? collectIssues() : [];

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
        const errors = collectIssues();
        for (const error of errors) toast.error(error);
        if (errors.length > 0) return;
        setSaving(true);
        try {
            // Logo đợi đến khi lưu mới tải lên (MinIO) — Hủy trước đó thì không ghi gì
            if (pendingLogoFile) {
                await companyProfileService.uploadLogo(pendingLogoFile);
            }
            const updated = await companyProfileService.save(form);
            setLoaded(updated);
            setPendingLogoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            toast.success("Đã lưu thông tin công ty");
            onSaved?.(updated);
            onOpenChange(false);
        } catch (error) {
            // Lỗi -> giữ nguyên hộp thoại và dữ liệu đã nhập để người dùng thử lại
            console.error("Error saving company profile:", error);
            toast.error("Không thể lưu thông tin công ty");
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
                        Thông tin công ty
                    </DialogTitle>
                    <DialogDescription className="pt-1 text-sm text-bo-muted">
                        Thông tin này dùng chung cho tất cả mẫu in.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <LoadingState label="Đang tải thông tin công ty" className="min-h-40" />
                ) : loadError || !form ? (
                    <div className="flex flex-col items-center gap-3 rounded-md border border-bo-border bg-bo-surface-subtle px-4 py-6 text-center">
                        <p className="text-sm text-bo-muted">
                            Không thể tải thông tin công ty từ máy chủ. Vui lòng thử lại.
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
                                Logo công ty
                            </span>
                            <div className="flex items-center gap-3">
                                {logoShown ? (
                                    <img
                                        src={logoShown}
                                        alt="Logo công ty"
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
                            label="Tên công ty"
                            value={form.name}
                            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                            placeholder="Ví dụ: Công ty TNHH F Centric"
                            autoFocus
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="Email"
                                value={form.email}
                                onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                                placeholder="lienhe@congty.vn"
                            />
                            <Field
                                label="Điện thoại"
                                value={form.phone}
                                onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                                placeholder="028 7300 0000"
                            />
                        </div>
                        <Field
                            label="Địa chỉ"
                            value={form.address}
                            onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
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
                        disabled={saving || !isDirty || issues.length > 0}
                        title={issues.length > 0 ? issues[0] : undefined}
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
                title="Hủy thay đổi thông tin công ty?"
                description="Các thay đổi chưa lưu (kể cả logo đã chọn) sẽ bị bỏ."
                confirmText="Bỏ thay đổi"
                cancelText="Ở lại"
            />
        </Dialog>
    );
}
