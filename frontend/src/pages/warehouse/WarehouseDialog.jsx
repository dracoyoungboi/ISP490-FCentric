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
    MapPin,
    User,
    Package,
    TrendingUp,
    Calendar,
    AlertCircle,
    ChevronDown,
    Check
} from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import StatusBadge from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { LOAI_KHO_OPTIONS, laKhoAo, nhanLoaiKho } from './loaiKho';

const FIELD_LABEL_CLASS =
    "text-xs font-semibold uppercase tracking-wide text-bo-muted";
const INPUT_CLASS =
    "h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15";
const DROPDOWN_CONTENT_CLASS =
    "backoffice-user-menu z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
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

export default function WarehouseDialog({
    showDialog,
    setShowDialog,
    dialogMode,
    selectedWarehouse,
    formData,
    setFormData,
    errors,
    managers,
    isLoadingManagers,
    onSubmit,
    onClose
}) {
    const managerLabel = formData.quanLyId
        ? managers.find(m => m.id.toString() === formData.quanLyId)?.name
        : 'Chọn người quản lý';

    return (
        <Dialog
            open={showDialog}
            onOpenChange={(open) => {
                if (!open) onClose();
                else setShowDialog(true);
            }}
        >
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl gap-0 overflow-y-auto rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg outline-none">
                {/* Header */}
                <div className="border-b border-bo-border px-5 pb-4 pt-5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-base font-semibold text-bo-foreground">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft">
                                <Warehouse className="size-4 text-bo-primary" />
                            </span>
                            {dialogMode === 'create' && 'Thêm kho mới'}
                            {dialogMode === 'edit' && 'Chỉnh sửa thông tin kho'}
                            {dialogMode === 'view' && 'Thông tin chi tiết kho'}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                    {dialogMode === 'view' ? (
                        /* ── View Mode ── */
                        <div className="space-y-5">
                            {/* Mã kho và Trạng thái */}
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className={FIELD_LABEL_CLASS}>Mã kho</Label>
                                    <p className="font-mono text-base font-semibold text-bo-primary">
                                        {selectedWarehouse?.maKho || '—'}
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={FIELD_LABEL_CLASS}>Trạng thái</Label>
                                    <div>
                                        <StatusBadge
                                            label={selectedWarehouse?.trangThai === 1 ? 'Hoạt động' : 'Không hoạt động'}
                                            tone={selectedWarehouse?.trangThai === 1 ? 'success' : 'neutral'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Loại kho */}
                            <div className="space-y-1.5">
                                <Label className={FIELD_LABEL_CLASS}>Loại kho</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge label={nhanLoaiKho(selectedWarehouse).label} tone={nhanLoaiKho(selectedWarehouse).tone} dot={false} />
                                    <span className="text-xs text-bo-muted">{nhanLoaiKho(selectedWarehouse).moTa}</span>
                                </div>
                            </div>

                            {/* Tên kho */}
                            <div className="space-y-1.5">
                                <Label className={FIELD_LABEL_CLASS}>Tên kho</Label>
                                <p className="text-base font-semibold text-bo-foreground">
                                    {selectedWarehouse?.tenKho || '—'}
                                </p>
                            </div>

                            {/* Địa chỉ */}
                            <div className="space-y-1.5">
                                <Label className={`${FIELD_LABEL_CLASS} flex items-center gap-1.5`}>
                                    <MapPin className="size-3.5" /> Địa chỉ
                                </Label>
                                <p className="text-sm text-bo-foreground">
                                    {selectedWarehouse?.diaChi || '—'}
                                </p>
                            </div>

                            {/* Người quản lý */}
                            <div className="space-y-1.5">
                                <Label className={`${FIELD_LABEL_CLASS} flex items-center gap-1.5`}>
                                    <User className="size-3.5" /> Người quản lý
                                </Label>
                                <p className="text-sm font-semibold text-bo-foreground">
                                    {selectedWarehouse?.quanLy?.hoTen || '—'}
                                </p>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className={`${FIELD_LABEL_CLASS} flex items-center gap-1.5`}>
                                        <Package className="size-3.5" /> Số lượng tồn kho
                                    </Label>
                                    <div className="rounded-lg border border-bo-border bg-bo-primary-soft p-4">
                                        <p className="text-2xl font-bold text-bo-primary">
                                            {formatNumber(selectedWarehouse?.soLuongTon)}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={`${FIELD_LABEL_CLASS} flex items-center gap-1.5`}>
                                        <TrendingUp className="size-3.5" /> Giá trị tồn kho
                                    </Label>
                                    <div className="rounded-lg border border-bo-border bg-bo-success-soft p-4">
                                        <p className="text-2xl font-bold text-bo-success">
                                            {formatCurrency(selectedWarehouse?.giaTriTon)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Ngày tạo */}
                            <div className="space-y-1.5">
                                <Label className={`${FIELD_LABEL_CLASS} flex items-center gap-1.5`}>
                                    <Calendar className="size-3.5" /> Ngày tạo
                                </Label>
                                <p className="text-sm text-bo-foreground">
                                    {formatDate(selectedWarehouse?.ngayTao)}
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* ── Create / Edit Mode ── */
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {/* Mã kho */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="maKho" className={FIELD_LABEL_CLASS}>
                                        Mã kho *
                                    </Label>
                                    <Input
                                        id="maKho"
                                        placeholder="VD: KHO-D"
                                        value={formData.maKho}
                                        onChange={(e) =>
                                            setFormData({ ...formData, maKho: e.target.value.toUpperCase() })
                                        }
                                        disabled={dialogMode === "edit"}
                                        className={`${INPUT_CLASS} disabled:bg-bo-surface-subtle disabled:opacity-70`}
                                    />
                                    <FieldError message={errors.maKho} />
                                </div>

                                {/* Trạng thái */}
                                <div className="space-y-1.5">
                                    <Label className={FIELD_LABEL_CLASS}>Trạng thái *</Label>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-bo-border bg-white px-3 text-left text-sm text-bo-foreground transition-colors hover:bg-bo-surface-subtle"
                                            >
                                                <span>{formData.trangThai === 1 ? 'Hoạt động' : 'Không hoạt động'}</span>
                                                <ChevronDown className="size-4 shrink-0 text-bo-muted" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className={`${DROPDOWN_CONTENT_CLASS} w-[--radix-dropdown-menu-trigger-width]`}
                                        >
                                            <DropdownMenuItem
                                                onClick={() => setFormData({ ...formData, trangThai: 1 })}
                                                className={`${DROPDOWN_ITEM_CLASS} flex items-center justify-between`}
                                            >
                                                Hoạt động
                                                {Number(formData.trangThai) === 1 && (
                                                    <Check className="size-4 text-bo-primary" />
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setFormData({ ...formData, trangThai: 0 })}
                                                className={`${DROPDOWN_ITEM_CLASS} flex items-center justify-between`}
                                            >
                                                Không hoạt động
                                                {Number(formData.trangThai) === 0 && (
                                                    <Check className="size-4 text-bo-primary" />
                                                )}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Tên kho */}
                            <div className="space-y-1.5">
                                <Label htmlFor="tenKho" className={FIELD_LABEL_CLASS}>
                                    Tên kho *
                                </Label>
                                <Input
                                    id="tenKho"
                                    placeholder="VD: Kho D - Cần Thơ"
                                    value={formData.tenKho}
                                    onChange={(e) => setFormData({ ...formData, tenKho: e.target.value })}
                                    className={INPUT_CLASS}
                                />
                                <FieldError message={errors.tenKho} />
                            </div>

                            {/* Loại kho */}
                            <div className="space-y-1.5">
                                <Label id="loaiKho-label" className={FIELD_LABEL_CLASS}>Loại kho *</Label>
                                {laKhoAo(formData) ? (
                                    <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm text-bo-muted">
                                        Kho ảo chứa hàng đang chuyển giữa các kho, không đổi loại được.
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
                                                        chon ? "border-bo-primary bg-bo-primary-soft" : "border-bo-border bg-white hover:bg-bo-surface-subtle",
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                                            chon ? "border-bo-primary bg-bo-primary text-white" : "border-slate-300 bg-white",
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
                                    Địa chỉ *
                                </Label>
                                <Textarea
                                    id="diaChi"
                                    placeholder="Nhập địa chỉ đầy đủ của kho"
                                    rows={3}
                                    value={formData.diaChi}
                                    onChange={(e) => setFormData({ ...formData, diaChi: e.target.value })}
                                    className="resize-none border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                                />
                                <FieldError message={errors.diaChi} />
                            </div>

                            {/* Người quản lý */}
                            <div className="space-y-1.5">
                                <Label className={FIELD_LABEL_CLASS}>Người quản lý *</Label>
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={isLoadingManagers}
                                            className={`flex h-10 w-full items-center justify-between rounded-md border border-bo-border bg-white px-3 text-left text-sm transition-colors hover:bg-bo-surface-subtle disabled:opacity-60 ${
                                                formData.quanLyId ? "text-bo-foreground" : "text-bo-muted"
                                            }`}
                                        >
                                            <span>{isLoadingManagers ? "Đang tải..." : managerLabel}</span>
                                            <ChevronDown className="size-4 shrink-0 text-bo-muted" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className={`${DROPDOWN_CONTENT_CLASS} max-h-60 w-[--radix-dropdown-menu-trigger-width] overflow-auto`}
                                    >
                                        {managers.length === 0 ? (
                                            <div className="p-3 text-center text-sm text-bo-muted">
                                                Không có người quản lý
                                            </div>
                                        ) : (
                                            managers.map((m) => (
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
                                            ))
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <FieldError message={errors.quanLyId} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="gap-2 border-t border-bo-border px-5 py-4 sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={onClose}
                    >
                        {dialogMode === 'view' ? 'Đóng' : 'Hủy'}
                    </Button>
                    {dialogMode !== 'view' && (
                        <Button
                            type="button"
                            className="h-9 bg-bo-primary px-5 text-white hover:bg-bo-primary-hover"
                            onClick={onSubmit}
                        >
                            {dialogMode === 'create' ? 'Thêm kho' : 'Cập nhật'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
