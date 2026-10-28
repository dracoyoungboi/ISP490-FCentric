import { useRef, useState } from "react";
import { ImagePlus, Star, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormSection from "@/components/shared/FormSection";
import { cn } from "@/lib/utils";
import { NUT_VIEN_CLASS } from "./kieuForm";

/**
 * Khu ảnh sản phẩm chính dùng chung cho form Thêm và form Chỉnh sửa: kéo thả hoặc chọn ảnh từ máy,
 * đặt ảnh chính (ảnh đầu tiên), gỡ ảnh. `anhs` gồm ảnh đang có (URL trên máy chủ) và ảnh mới (tệp).
 */
export default function KhuAnhSanPham({ id, anhs, thieuAnh, disabled, onThemTep, onXoa, onDatChinh }) {
    const [dangKeo, setDangKeo] = useState(false);
    const inputRef = useRef(null);

    const keoTha = {
        onDragEnter: (e) => {
            e.preventDefault();
            if (!disabled) setDangKeo(true);
        },
        onDragOver: (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = disabled ? "none" : "copy";
        },
        onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDangKeo(false);
        },
        onDrop: (e) => {
            e.preventDefault();
            setDangKeo(false);
            if (!disabled) onThemTep(Array.from(e.dataTransfer.files || []));
        },
    };

    return (
        <div id={id} className="scroll-mt-4">
            <FormSection
                title={
                    <span className="flex items-center justify-between gap-2">
                        <span>Ảnh sản phẩm chính <span className="text-bo-danger">*</span></span>
                        <span className="text-xs font-normal text-bo-muted">{anhs.length} ảnh</span>
                    </span>
                }
            >
                <div
                    {...keoTha}
                    className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
                        dangKeo
                            ? "border-bo-primary bg-bo-primary-soft"
                            : thieuAnh
                              ? "border-bo-danger/60 bg-bo-danger-soft"
                              : "border-bo-border bg-bo-surface-subtle",
                    )}
                >
                    <ImagePlus
                        className={cn("size-7", dangKeo ? "text-bo-primary" : thieuAnh ? "text-bo-danger" : "text-bo-muted")}
                        aria-hidden="true"
                    />
                    {/* Màn hình cảm ứng không kéo thả được nên chỉ để nút chọn ảnh */}
                    <p className="text-sm text-bo-foreground pointer-coarse:hidden">
                        {dangKeo ? "Thả ảnh vào đây" : "Kéo thả ảnh vào đây hoặc"}
                    </p>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = "";
                            onThemTep(files);
                        }}
                        className="hidden"
                        id="product-images"
                        tabIndex={-1}
                        aria-hidden="true"
                        disabled={disabled}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                        className={cn(NUT_VIEN_CLASS, "hover:bg-bo-primary-soft hover:text-bo-primary")}
                    >
                        <Upload className="size-4" aria-hidden="true" />
                        Chọn ảnh từ máy
                    </Button>
                    <p className={cn("text-xs", thieuAnh ? "text-bo-danger" : "text-bo-muted")}>
                        {thieuAnh
                            ? "Vui lòng thêm ít nhất 1 ảnh sản phẩm chính"
                            : "JPG, PNG, WEBP, tối đa 10 MB mỗi ảnh. Ảnh đầu tiên là ảnh chính."}
                    </p>
                </div>
                {anhs.length > 0 && (
                    <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Ảnh sản phẩm đã chọn">
                        {anhs.map((anh, index) => (
                            <li key={anh.id} className="group relative">
                                <img
                                    src={anh.url}
                                    alt={`Ảnh sản phẩm ${index + 1}`}
                                    className={cn(
                                        "aspect-square w-full rounded-md border object-cover shadow-sm",
                                        index === 0 ? "border-bo-primary ring-1 ring-bo-primary" : "border-bo-border",
                                    )}
                                />
                                {index === 0 ? (
                                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-bo-primary px-1.5 py-0.5 text-[10px] font-medium text-white">
                                        <Star className="size-2.5 fill-current" aria-hidden="true" />
                                        Ảnh chính
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onDatChinh(anh)}
                                        disabled={disabled}
                                        aria-label={`Đặt ảnh ${index + 1} làm ảnh chính`}
                                        className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-bo-surface/95 px-1.5 py-0.5 text-[10px] font-medium text-bo-foreground opacity-0 shadow-sm transition-opacity hover:text-bo-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-bo-primary group-hover:opacity-100 pointer-coarse:opacity-100"
                                    >
                                        <Star className="size-2.5" aria-hidden="true" />
                                        Đặt làm ảnh chính
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onXoa(anh)}
                                    disabled={disabled}
                                    aria-label={`Xóa ảnh ${index + 1}`}
                                    className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-bo-danger text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-danger"
                                >
                                    <X className="size-3.5" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </FormSection>
        </div>
    );
}
