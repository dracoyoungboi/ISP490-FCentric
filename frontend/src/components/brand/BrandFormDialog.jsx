import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Tag, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { thuongHieuService } from "@/services/thuongHieuService.js";

const brandSchema = z.object({
    maThuongHieu: z
        .string()
        .min(1, "Mã thương hiệu không được để trống")
        .max(50, "Mã thương hiệu tối đa 50 ký tự"),
    tenThuongHieu: z
        .string()
        .min(1, "Tên thương hiệu không được để trống")
        .max(100, "Tên thương hiệu tối đa 100 ký tự"),
    moTa: z.string().max(2000, "Mô tả thương hiệu tối đa 2000 ký tự").optional(),
    trangThai: z.coerce.number(),
});

const CONTROL_CLASS =
    "border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";

/**
 * Form tạo thương hiệu mới (dùng trong selector sản phẩm và có thể tái sử dụng).
 * Logo upload KHI BẤM LƯU (sau khi lưu JSON thành công) — lỗi upload không
 * làm mất thương hiệu vừa tạo.
 */
export default function BrandFormDialog({ open, onOpenChange, onCreated }) {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(brandSchema),
        defaultValues: {
            maThuongHieu: "",
            tenThuongHieu: "",
            moTa: "",
            trangThai: 1,
        },
    });

    useEffect(() => {
        if (open) {
            queueMicrotask(() => {
                reset({
                    maThuongHieu: "",
                    tenThuongHieu: "",
                    moTa: "",
                    trangThai: 1,
                });
                setLogoFile(null);
                setLogoPreview(null);
            });
        }
    }, [open, reset]);

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
    };

    const onSubmit = async (data) => {
        try {
            const res = await thuongHieuService.create({
                maThuongHieu: data.maThuongHieu,
                tenThuongHieu: data.tenThuongHieu,
                moTa: data.moTa || null,
                trangThai: Number(data.trangThai),
            });
            const brand = res?.data;
            if (!brand?.id) {
                toast.error(res?.message || "Không thể tạo thương hiệu");
                return;
            }

            let savedBrand = brand;
            // Logo chỉ upload khi bấm Lưu; lỗi upload không làm mất thương hiệu vừa tạo
            if (logoFile) {
                try {
                    const logoRes = await thuongHieuService.uploadLogo(brand.id, logoFile);
                    savedBrand = logoRes?.data ?? brand;
                } catch {
                    toast.warning("Đã lưu thương hiệu nhưng logo chưa được tải lên");
                }
            }

            toast.success(`Đã tạo thương hiệu "${savedBrand.tenThuongHieu}"`);
            onCreated?.(savedBrand);
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "Có lỗi xảy ra khi tạo thương hiệu";
            toast.error(errorMessage);
        }
    };

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen && !isSubmitting) {
            onOpenChange?.(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="border-bo-border bg-bo-canvas p-0 text-bo-foreground sm:max-w-md">
                <DialogHeader className="border-b border-bo-border bg-white px-4 py-3.5 text-left sm:px-5">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                        <Tag className="size-5 text-bo-primary" />
                        Tạo thương hiệu mới
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm leading-6 text-bo-muted">
                        Thương hiệu mới sẽ được chọn ngay cho sản phẩm sau khi tạo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 py-4 sm:px-5">
                    <div className="space-y-2">
                        <Label htmlFor="brand-ma">Mã định danh <span className="text-bo-danger">*</span></Label>
                        <Controller
                            name="maThuongHieu"
                            control={control}
                            render={({ field }) => (
                                <Input {...field} placeholder="VD: NIKE, ZARA" disabled={isSubmitting} className={CONTROL_CLASS} />
                            )}
                        />
                        {errors.maThuongHieu && (
                            <p className="text-xs text-bo-danger">{errors.maThuongHieu.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand-ten">Tên hiển thị <span className="text-bo-danger">*</span></Label>
                        <Controller
                            name="tenThuongHieu"
                            control={control}
                            render={({ field }) => (
                                <Input {...field} placeholder="VD: Nike" disabled={isSubmitting} className={CONTROL_CLASS} />
                            )}
                        />
                        {errors.tenThuongHieu && (
                            <p className="text-xs text-bo-danger">{errors.tenThuongHieu.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand-mota">Mô tả</Label>
                        <Controller
                            name="moTa"
                            control={control}
                            render={({ field }) => (
                                <Textarea {...field} placeholder="Mô tả ngắn về thương hiệu..." rows={3} disabled={isSubmitting} className={CONTROL_CLASS} />
                            )}
                        />
                        {errors.moTa && (
                            <p className="text-xs text-bo-danger">{errors.moTa.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand-trangthai">Trạng thái</Label>
                        <Controller
                            name="trangThai"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    value={field.value?.toString()}
                                    onValueChange={(value) => field.onChange(Number(value))}
                                    disabled={isSubmitting}
                                >
                                    <SelectTrigger className="h-10 w-full border-bo-border text-bo-foreground">
                                        <SelectValue placeholder="Chọn trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" side="bottom" className="z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                        <SelectItem value="1" className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">Hoạt động</SelectItem>
                                        <SelectItem value="0" className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">Ngừng hoạt động</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand-logo">Logo (tùy chọn)</Label>
                        <div className="rounded-lg border-2 border-dashed border-bo-border bg-bo-surface-subtle p-3">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="hidden"
                                id="brand-logo"
                                disabled={isSubmitting}
                            />
                            <label
                                htmlFor="brand-logo"
                                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-bo-border bg-white p-2 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-primary-soft hover:text-bo-primary"
                            >
                                <Upload className="size-4" />
                                <span>Chọn ảnh logo</span>
                            </label>
                            {logoPreview ? (
                                <div className="relative mt-3 inline-block">
                                    <img
                                        src={logoPreview}
                                        alt="Xem trước logo"
                                        className="h-16 w-16 rounded-md border border-bo-border object-contain"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        aria-label="Xóa logo đã chọn"
                                        className="absolute -right-2 -top-2 rounded-full bg-bo-danger p-1 text-white transition-opacity hover:opacity-90"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isSubmitting}
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                "Lưu thương hiệu"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
