import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Warehouse,
    AlertCircle,
    ChevronDown,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOAI_KHO_OPTIONS, laKhoAo } from './loaiKho';
import { t } from "@/i18n";

const FIELD_LABEL_CLASS =
    "text-xs font-semibold uppercase tracking-wide text-bo-muted";
const INPUT_CLASS =
    "h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15";
const DROPDOWN_CONTENT_CLASS =
    "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const DROPDOWN_ITEM_CLASS =
    "cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

function FieldError({ message }) {
    if (!message) return null;
    return (
        <Alert
            variant="destructive"
            className="border-bo-danger/30 bg-bo-danger-soft py-2 text-bo-danger"
        >
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs text-bo-danger">{message}</AlertDescription>
        </Alert>
    );
}

/**
 * Hộp Thêm / Sửa kho. Xem chi tiết dùng ChiTietKhoDialog (PA2).
 * Trạng thái không còn là ô trong form: kho mới luôn hoạt động; ngừng / cho phép hoạt động là thao tác riêng
 * trong menu ⋯ của Chi tiết kho (có hộp xác nhận nêu tồn kho và hệ quả), như màn Nhà cung cấp.
 */
export default function WarehouseDialog({
    showDialog,
    setShowDialog,
    dialogMode,
    formData,
    setFormData,
    errors,
    managers,
    isLoadingManagers,
    loiManagers,
    onTaiLaiManagers,
    onSubmit,
    onClose
}) {
    // Người đang chọn có thể không còn trong danh sách (danh sách kho đã cũ): dùng tên lúc mở form
    const tenDangChon = managers.find(m => m.id.toString() === formData.quanLyId)?.name
        ?? (formData.quanLyId && formData.quanLyId === formData.quanLyIdBanDau ? formData.quanLyTenBanDau : '');
    const managerLabel = formData.quanLyId ? tenDangChon || "—" : t("Chọn người đứng tên");
    const khoAo = laKhoAo(formData);
    const chuaCoAiLamViec = !isLoadingManagers && !loiManagers && managers.length === 0 && !formData.quanLyIdBanDau;
    // Chỉ cho chọn khi kho có từ 2 quản lý kho; 1 người thì người đó đứng tên, hiện chữ chỉ đọc
    const tenChiDoc = tenDangChon || managers[0]?.name || "—";
    const seDungTenKhiLuu = managers.length === 1 && !formData.quanLyIdBanDau;

    return (
        <Dialog
            open={showDialog}
            onOpenChange={(open) => {
                if (!open) onClose();
                else setShowDialog(true);
            }}
        >
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl gap-0 overflow-y-auto rounded-lg border border-bo-border bg-bo-surface p-0 text-bo-foreground shadow-lg outline-none">
                {/* Header */}
                <div className="border-b border-bo-border px-5 pb-4 pt-5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-base font-semibold text-bo-foreground">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft">
                                <Warehouse className="size-4 text-bo-primary" />
                            </span>
                            {dialogMode === 'create' ? t("Thêm kho mới") : t("Chỉnh sửa thông tin kho")}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* Mã kho */}
                            <div className="space-y-1.5">
                                <Label htmlFor="maKho" className={FIELD_LABEL_CLASS}>
                                    {t("Mã kho *")}
                                </Label>
                                <Input
                                    id="maKho"
                                    placeholder={t("VD: {{viDu}}", { viDu: "KHO-D" })}
                                    value={formData.maKho}
                                    onChange={(e) =>
                                        setFormData({ ...formData, maKho: e.target.value.toUpperCase() })
                                    }
                                    disabled={dialogMode === "edit"}
                                    className={`${INPUT_CLASS} disabled:bg-bo-surface-subtle disabled:opacity-70`}
                                />
                                <FieldError message={errors.maKho} />
                            </div>

                            {/* Tên kho */}
                            <div className="space-y-1.5">
                                <Label htmlFor="tenKho" className={FIELD_LABEL_CLASS}>
                                    {t("Tên kho *")}
                                </Label>
                                <Input
                                    id="tenKho"
                                    placeholder={t("VD: Kho D - Cần Thơ")}
                                    value={formData.tenKho}
                                    onChange={(e) => setFormData({ ...formData, tenKho: e.target.value })}
                                    className={INPUT_CLASS}
                                />
                                <FieldError message={errors.tenKho} />
                            </div>
                        </div>

                        {/* Loại kho */}
                        <div className="space-y-1.5">
                            <Label id="loaiKho-label" className={FIELD_LABEL_CLASS}>{t("Loại kho *")}</Label>
                            {laKhoAo(formData) ? (
                                <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm text-bo-muted">
                                    {t("Kho ảo chứa hàng đang chuyển giữa các kho, không đổi loại được.")}
                                </p>
                            ) : (
                                <div role="radiogroup" aria-labelledby="loaiKho-label" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {LOAI_KHO_OPTIONS.map((o) => {
                                        const chon = formData.loaiKho === o.value;
                                        return (
                                            <button
                                                key={o.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={chon}
                                                aria-labelledby={`loaiKho-${o.value}-ten`}
                                                aria-describedby={`loaiKho-${o.value}-mota`}
                                                onClick={() => setFormData({ ...formData, loaiKho: o.value })}
                                                className={cn(
                                                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                                                    chon ? "border-bo-primary bg-bo-primary-soft" : "border-bo-border bg-bo-surface hover:bg-bo-surface-subtle",
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                                        chon ? "border-bo-primary bg-bo-primary text-white" : "border-slate-300 bg-bo-surface",
                                                    )}
                                                    aria-hidden="true"
                                                >
                                                    {chon ? <Check className="size-3" strokeWidth={3} /> : null}
                                                </span>
                                                <span className="min-w-0">
                                                    <span id={`loaiKho-${o.value}-ten`} className="block text-sm font-semibold text-bo-foreground">{o.label}</span>
                                                    <span id={`loaiKho-${o.value}-mota`} className="mt-0.5 block text-xs leading-5 text-bo-muted">{o.moTa}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <FieldError message={errors.loaiKho} />
                        </div>

                        {/* Địa chỉ */}
                        <div className="space-y-1.5">
                            <Label htmlFor="diaChi" className={FIELD_LABEL_CLASS}>
                                {t("Địa chỉ *")}
                            </Label>
                            <Textarea
                                id="diaChi"
                                placeholder={t("Nhập địa chỉ đầy đủ của kho")}
                                rows={3}
                                value={formData.diaChi}
                                onChange={(e) => setFormData({ ...formData, diaChi: e.target.value })}
                                className="resize-none border-bo-border bg-bo-surface text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                            />
                            <FieldError message={errors.diaChi} />
                        </div>

                        {/* Người quản lý: chỉ quản lý kho đang làm việc tại chính kho này (phân quyền ở màn Người dùng) */}
                        <div className="space-y-1.5">
                            {/* Từ 2 quản lý kho (đúng lúc hiện ô chọn) thì nói rõ là chọn người quản lý chính */}
                            <Label className={FIELD_LABEL_CLASS}>
                                {dialogMode !== "create" && !khoAo && managers.length >= 2 ? t("Người quản lý chính") : t("Người quản lý")}
                            </Label>
                            {dialogMode === 'create' || khoAo ? (
                                <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm text-bo-muted">
                                    {khoAo
                                        ? t("Kho hệ thống, không có người quản lý.")
                                        : t("Tạo kho xong, phân quyền cho quản lý kho tại kho này ở màn Người dùng. Người đầu tiên được phân sẽ đứng tên người quản lý.")}
                                </p>
                            ) : loiManagers ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2 text-sm text-bo-muted">
                                    <span>{t("Không tải được danh sách quản lý kho của kho này.")}</span>
                                    <Button type="button" variant="outline" size="sm" className="h-8 border-bo-border bg-bo-surface" onClick={onTaiLaiManagers}>
                                        {t("Thử lại")}
                                    </Button>
                                </div>
                            ) : chuaCoAiLamViec ? (
                                <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm text-bo-muted">
                                    {t("Chưa có quản lý kho nào làm việc tại kho này. Phân quyền cho quản lý kho tại kho này ở màn Người dùng.")}
                                </p>
                            ) : isLoadingManagers ? (
                                <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm text-bo-muted">
                                    {t("Đang tải...")}
                                </p>
                            ) : managers.length < 2 ? (
                                <>
                                    <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm text-bo-foreground">
                                        {tenChiDoc}
                                    </p>
                                    {seDungTenKhiLuu ? (
                                        <p className="text-xs text-bo-muted">
                                            {t("Quản lý kho duy nhất tại kho này, sẽ đứng tên người quản lý sau khi lưu.")}
                                        </p>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className={`flex h-10 w-full items-center justify-between rounded-md border border-bo-border bg-bo-surface px-3 text-left text-sm transition-colors hover:bg-bo-surface-subtle ${
                                                    formData.quanLyId ? "text-bo-foreground" : "text-bo-muted"
                                                }`}
                                            >
                                                <span>{managerLabel}</span>
                                                <ChevronDown className="size-4 shrink-0 text-bo-muted" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className={`${DROPDOWN_CONTENT_CLASS} max-h-60 w-(--radix-dropdown-menu-trigger-width) overflow-auto`}
                                        >
                                            {managers.map((m) => (
                                                <DropdownMenuItem
                                                    key={m.id}
                                                    onClick={() => setFormData({ ...formData, quanLyId: m.id.toString() })}
                                                    className={`${DROPDOWN_ITEM_CLASS} flex items-center justify-between`}
                                                >
                                                    {m.name}
                                                    {formData.quanLyId === m.id.toString() && (
                                                        <Check className="size-4 text-bo-primary" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <p className="text-xs leading-5 text-bo-muted">
                                        {t("Kho có nhiều quản lý kho, mọi người có cùng quyền. Người được chọn hiện ở danh sách kho và là người liên hệ của kho.")}
                                    </p>
                                </>
                            )}
                            <FieldError message={errors.quanLyId} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="gap-2 border-t border-bo-border px-5 py-4 sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={onClose}
                    >
                        {t("Hủy")}
                    </Button>
                    <Button
                        type="button"
                        className="h-9 bg-bo-primary px-5 text-white hover:bg-bo-primary-hover"
                        onClick={onSubmit}
                    >
                        {dialogMode === 'create' ? t("Thêm kho") : t("Cập nhật")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
