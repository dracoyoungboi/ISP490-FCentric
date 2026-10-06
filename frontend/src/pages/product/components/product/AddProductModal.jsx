import { useState, useEffect, useCallback } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
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
import { Loader2, Upload, X, Plus, Info, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/productService.js";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService.js";
import * as yup from "yup";

import FormSection from "@/components/shared/FormSection";
import BrandSelector from "@/components/brand/BrandSelector";
import { flattenCategoryTree } from "@/utils/danhMucTree";

const addProductSchema = yup.object({
    tenSanPham: yup.string().required("Tên sản phẩm là bắt buộc"),
    maSanPham: yup.string().nullable(),
    maVach: yup.string(),
    danhMucId: yup.number().required("Danh mục là bắt buộc").typeError("Vui lòng chọn danh mục"),
    thuongHieuId: yup.number().nullable(),
    moTa: yup.string(),
    giaVonMacDinh: yup.number().transform(value => (isNaN(value) ? 0 : value)).nullable(),
    giaBanMacDinh: yup.number().transform(value => (isNaN(value) ? 0 : value)).nullable(),
    mucTonToiThieu: yup.number().min(0, "Mức tồn phải >= 0"),
    trangThai: yup.number().required(),
    bienTheSanPhams: yup.array().of(
        yup.object({
            mauSacId: yup.number().required("Màu sắc là bắt buộc").nullable(),
            sizeId: yup.number().required("Size là bắt buộc").nullable(),
            chatLieuId: yup.number().required("Chất liệu là bắt buộc").nullable(),
            maSku: yup.string().nullable(),
            maVachSku: yup.string(),
            giaVon: yup.number().transform(value => (isNaN(value) ? 0 : value)).nullable(),
            giaBan: yup.number().transform(value => (isNaN(value) ? 0 : value)).nullable(),
            trangThai: yup.number().required(),
        })
    ).min(1, "Phải có ít nhất 1 biến thể")
});
const CONTROL_CLASS =
    "border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";
const CONTROL_DISABLED_CLASS =
    "cursor-not-allowed border-bo-border bg-bo-surface-subtle italic text-bo-muted";
const SELECT_CONTENT_CLASS = "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const SELECT_ITEM_CLASS = "rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const STEP_CLASS =
    "flex items-center justify-center gap-2 rounded-md border border-bo-border bg-white px-2 py-1.5 text-center text-[11px] font-semibold text-bo-muted";

export default function AddProductModal({ isOpen, onClose, onSuccess }) {
    const [categories, setCategories] = useState([]);
    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [productImages, setProductImages] = useState([]);
    const [variantImages, setVariantImages] = useState({});

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        // Client-side schema validation truoc khi goi backend create.
        resolver: yupResolver(addProductSchema),
        defaultValues: {
            tenSanPham: "",
            maSanPham: "",
            maVach: "",
            danhMucId: "",
            thuongHieuId: null,
            moTa: "",
            giaVonMacDinh: 0,
            giaBanMacDinh: 0,
            mucTonToiThieu: 0,
            trangThai: 1,
            bienTheSanPhams: [{
                mauSacId: null,
                sizeId: null,
                chatLieuId: null,
                maSku: "",
                maVachSku: "",
                giaVon: 0,
                giaBan: 0,
                trangThai: 1,
            }],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "bienTheSanPhams"
    });

    const handleResetForm = useCallback(() => {
        // Reset ve state ban dau sau khi tao thanh cong hoac khi dong modal.
        reset({
            tenSanPham: "",
            maSanPham: "",
            maVach: "",
            danhMucId: "",
            thuongHieuId: null,
            moTa: "",
            giaVonMacDinh: 0,
            giaBanMacDinh: 0,
            mucTonToiThieu: 0,
            trangThai: 1,
            bienTheSanPhams: [{
                mauSacId: null,
                sizeId: null,
                chatLieuId: null,
                maSku: "",
                maVachSku: "",
                giaVon: 0,
                giaBan: 0,
                trangThai: 1,
            }],
        });
        setProductImages([]);
        setVariantImages({});
    }, [reset]);

    useEffect(() => {
        if (isOpen) {
            // Moi lan mo modal thi reset form de tranh du lieu cu con sot lai.
            // Hoãn qua microtask để tránh setState đồng bộ trong effect
            // (react-hooks/set-state-in-effect).
            queueMicrotask(() => handleResetForm());
        }
    }, [isOpen, handleResetForm]);

    const loadReferenceData = useCallback(async () => {
        try {
            // Tai du lieu tham chieu cho form (mau, size, chat lieu, danh muc).
            // Luong backend: Controller.getAll -> Service.getAll -> Repository.findAll.
            const extractData = (response) => response?.data?.data ?? response?.data ?? [];

            const [colorsResult, sizesResult, materialsResult, categoriesResult] = await Promise.allSettled([
                productService.getColors(),
                productService.getSizes(),
                productService.getMaterials(),
                danhMucQuanAoService.getCayDanhMuc(),
            ]);

            if (colorsResult.status === "fulfilled") setColors(extractData(colorsResult.value));
            if (sizesResult.status === "fulfilled") setSizes(extractData(sizesResult.value));
            if (materialsResult.status === "fulfilled") setMaterials(extractData(materialsResult.value));

            if (categoriesResult.status === "fulfilled") {
                const rawCategoriesTree = extractData(categoriesResult.value);
                // Ép phẳng cây danh mục và tạo lùi lề
                setCategories(flattenCategoryTree(rawCategoriesTree));
            } else {
                toast.error("Không thể tải dữ liệu danh mục");
            }

        } catch {
            toast.error("Lỗi hệ thống khi tải dữ liệu khởi tạo");
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu tham chiếu vẫn được tải khi mở modal.
        queueMicrotask(() => loadReferenceData());
    }, [isOpen, loadReferenceData]);

    const onSubmit = async (data) => {
        // [User nhan Luu trong modal Them san pham]
        // Buoc 1: Validate bo sung o client cho anh san pham va anh bien the.
        if (productImages.length === 0) {
            toast.error("Vui lòng thêm ít nhất một ảnh sản phẩm chính");
            return;
        }

        for (let i = 0; i < data.bienTheSanPhams.length; i++) {
            if (!variantImages[i]) {
                toast.error(`Vui lòng thêm ảnh cho biến thể #${i + 1}`);
                return;
            }
        }

        try {
            // Buoc 2: Map form UI -> payload backend (RequestDTO) trong FormData.
            const formData = new FormData();

            const productData = {
                maVach: data.maVach || "",
                tenSanPham: data.tenSanPham,
                maSanPham: data.maSanPham || "",
                mucTonToiThieu: data.mucTonToiThieu,
                moTa: data.moTa || "",
                danhMucId: Number(data.danhMucId),
                thuongHieuId: data.thuongHieuId ? Number(data.thuongHieuId) : null,
                giaVonMacDinh: Number(data.giaVonMacDinh) || 0,
                giaBanMacDinh: Number(data.giaBanMacDinh) || 0,
                trangThai: Number(data.trangThai),
                bienTheSanPhams: data.bienTheSanPhams.map(variant => ({
                    mauSacId: Number(variant.mauSacId),
                    sizeId: Number(variant.sizeId),
                    chatLieuId: Number(variant.chatLieuId),
                    maSku: variant.maSku || "",
                    maVachSku: variant.maVachSku || "",
                    giaVon: Number(variant.giaVon) || 0,
                    giaBan: Number(variant.giaBan) || 0,
                    trangThai: Number(variant.trangThai),
                })),
            };

            const jsonBlob = new Blob([JSON.stringify(productData)], { type: 'application/json' });
            formData.append('creating', jsonBlob);

            productImages.forEach((file) => {
                formData.append('anhSanPhams', file);
            });

            data.bienTheSanPhams.forEach((_, index) => {
                if (variantImages[index]) {
                    formData.append('anhBienThes', variantImages[index]);
                } else {
                    formData.append('anhBienThes', new File([], "empty.txt"));
                }
            });

            // Buoc 3: Frontend -> ProductController.create(@Valid)
            // -> ProductService.create(@Transactional, validate nghiep vu)
            // -> ProductRepository.save + repository lien quan variant/image.
            const res = await productService.createProduct(formData);

            if (res?.data?.status >= 400) {
                toast.error(res.data.message || 'Có lỗi xảy ra');
                return;
            }

            toast.success("Tạo sản phẩm thành công!");
            // Buoc 4: Reload man Quan ly san pham thong qua callback onSuccess.
            handleResetForm();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Lỗi khi tạo sản phẩm:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Có lỗi xảy ra khi tạo sản phẩm';
            toast.error(errorMessage);
        }
    };

    const handleCancel = () => {
        // Chi cho dong modal khi khong trong trang thai submit.
        if (!isSubmitting) {
            handleResetForm();
            onClose();
        }
    };

    const handleProductImagesChange = (e) => {
        const files = Array.from(e.target.files || []);
        setProductImages(prev => [...prev, ...files]);
    };

    const handleRemoveProductImage = (index) => {
        setProductImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleVariantImageChange = (variantIndex, e) => {
        const file = e.target.files?.[0];
        if (file) {
            setVariantImages(prev => ({
                ...prev,
                [variantIndex]: file
            }));
        }
    };

    const handleRemoveVariantImage = (variantIndex) => {
        setVariantImages(prev => {
            const updated = { ...prev };
            delete updated[variantIndex];
            return updated;
        });
    };

    const handleRemoveVariant = (index) => {
        remove(index);
        setVariantImages(prev => {
            const updated = {};
            Object.keys(prev).forEach(key => {
                const numKey = Number(key);
                if (numKey < index) {
                    updated[numKey] = prev[key];
                } else if (numKey > index) {
                    updated[numKey - 1] = prev[key];
                }
            });
            return updated;
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-bo-border bg-bo-canvas p-0 text-bo-foreground sm:max-w-[1180px]">
                <DialogHeader className="gap-0 border-b border-bo-border bg-white px-4 py-3.5 text-left sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                            <Package className="size-5 text-bo-primary" />
                            Thêm sản phẩm mới
                        </DialogTitle>
                    </div>
                    <DialogDescription className="mt-1 text-sm leading-6 text-bo-muted">
                        Điền thông tin theo từng nhóm để tạo sản phẩm mới đầy đủ và dễ kiểm soát hơn.
                    </DialogDescription>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className={STEP_CLASS}>
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-bo-primary text-[10px] font-bold text-white">1</span>
                            <span className="truncate">Bước 1: Thông tin</span>
                        </div>
                        <div className={STEP_CLASS}>
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-bo-primary text-[10px] font-bold text-white">2</span>
                            <span className="truncate">Bước 2: Ảnh sản phẩm</span>
                        </div>
                        <div className={STEP_CLASS}>
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-bo-primary text-[10px] font-bold text-white">3</span>
                            <span className="truncate">Bước 3: Biến thể</span>
                        </div>
                    </div>

                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        <div className="flex items-start gap-2 rounded-lg border border-bo-border bg-bo-primary-soft p-3">
                            <Sparkles className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                            <p className="text-xs leading-relaxed text-bo-foreground">
                                <b>Tự động sinh mã:</b> Mã sản phẩm và SKU sẽ được hệ thống tạo từ danh mục và thuộc tính biến thể.
                            </p>
                        </div>

                        <div className="flex items-start gap-2 rounded-lg border border-bo-border bg-bo-primary-soft p-3">
                            <Info className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                            <p className="text-xs leading-relaxed text-bo-foreground">
                                <b>Lưu ý giá:</b> Có thể để trống giá khi tạo, hệ thống sẽ cập nhật theo dữ liệu nhập kho thực tế.
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-5 [&_[data-slot=select-trigger]]:bg-white [&_[data-slot=textarea]]:bg-white"
                    >
                        <div className="grid items-start gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                            <div className="space-y-5">
                                <FormSection title="Thông tin cơ bản">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {/* Tên sản phẩm */}
                                        <div className="space-y-2">
                                            <Label htmlFor="tenSanPham">
                                                Tên sản phẩm <span className="text-bo-danger">*</span>
                                            </Label>
                                            <Controller
                                                name="tenSanPham"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} placeholder="VD: Áo sơ mi nam cổ tròn" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                            {errors.tenSanPham && (
                                                <p className="text-xs text-bo-danger">{errors.tenSanPham.message}</p>
                                            )}
                                        </div>

                                        {/* Danh mục sản phẩm - TRẢ LẠI CẤU TRÚC CHA CON */}
                                        <div className="space-y-2">
                                            <Label htmlFor="danhMucId">Danh mục <span className="text-bo-danger">*</span></Label>
                                            <Controller
                                                name="danhMucId"
                                                control={control}
                                                render={({ field }) => (
                                                    <Select
                                                        value={field.value?.toString()}
                                                        onValueChange={(value) => field.onChange(Number(value))}
                                                        disabled={isSubmitting}
                                                    >
                                                        <SelectTrigger className="h-10 w-full border-bo-border text-bo-foreground">
                                                            <SelectValue placeholder="Chọn danh mục" />
                                                        </SelectTrigger>
                                                        <SelectContent
                                                            position="popper"
                                                            side="bottom"
                                                            align="start"
                                                            className={`${SELECT_CONTENT_CLASS} max-h-[300px]`}
                                                        >
                                                            {categories.length === 0 ? (
                                                                <div className="p-2 text-center text-sm text-bo-muted">Không có danh mục nào đang hoạt động</div>
                                                            ) : (
                                                                categories.map((cat) => (
                                                                    <SelectItem
                                                                        key={cat.id}
                                                                        value={cat.id.toString()}
                                                                        className={`${SELECT_ITEM_CLASS} ${cat.level === 0 ? 'font-semibold text-bo-foreground' : ''}`}
                                                                    >
                                                                        {cat.displayTitle}
                                                                    </SelectItem>
                                                                ))
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                            {errors.danhMucId && (
                                                <p className="text-xs text-bo-danger">{errors.danhMucId.message}</p>
                                            )}
                                        </div>

                                        {/* Thương hiệu (không bắt buộc) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="thuongHieuId">Thương hiệu</Label>
                                            <Controller
                                                name="thuongHieuId"
                                                control={control}
                                                render={({ field }) => (
                                                    <BrandSelector
                                                        value={field.value ?? null}
                                                        onChange={(id) => field.onChange(id)}
                                                        disabled={isSubmitting}
                                                    />
                                                )}
                                            />
                                            {errors.thuongHieuId && (
                                                <p className="text-xs text-bo-danger">{errors.thuongHieuId.message}</p>
                                            )}
                                        </div>

                                        {/* Mã sản phẩm (Tự động) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="maSanPham" className="text-bo-muted">Mã sản phẩm (Tự động)</Label>
                                            <Controller
                                                name="maSanPham"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input
                                                        {...field}
                                                        placeholder="Hệ thống tự động sinh mã..."
                                                        disabled
                                                        className={CONTROL_DISABLED_CLASS}
                                                    />
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="maVach">Mã vạch</Label>
                                            <Controller
                                                name="maVach"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} placeholder="Mã vạch (Nếu có)" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="trangThai">Trạng thái mặc định</Label>
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
                                                        <SelectContent position="popper" side="bottom" className={SELECT_CONTENT_CLASS}>
                                                            <SelectItem value="1" className={SELECT_ITEM_CLASS}>Còn hàng</SelectItem>
                                                            <SelectItem value="0" className={SELECT_ITEM_CLASS}>Hết hàng</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="mucTonToiThieu">Mức tồn tối thiểu</Label>
                                            <Controller
                                                name="mucTonToiThieu"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} type="number" min="0" placeholder="0" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="giaVonMacDinh">Giá vốn mặc định</Label>
                                            <Controller
                                                name="giaVonMacDinh"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} type="number" min="0" placeholder="0 (Tự động cập nhật)" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="giaBanMacDinh">Giá bán mặc định</Label>
                                            <Controller
                                                name="giaBanMacDinh"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} type="number" min="0" placeholder="0 (Tự động cập nhật)" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                        </div>

                                        {/* Mô tả */}
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label htmlFor="moTa">Mô tả</Label>
                                            <Controller
                                                name="moTa"
                                                control={control}
                                                render={({ field }) => (
                                                    <Textarea {...field} placeholder="Nhập mô tả chi tiết về sản phẩm..." rows={3} disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                        </div>
                                    </div>
                                </FormSection>

                                {/* Ảnh sản phẩm - Required */}
                                <FormSection
                                    title={
                                        <>
                                            Ảnh sản phẩm chính <span className="text-bo-danger">*</span>
                                        </>
                                    }
                                >
                                    <div className="space-y-2 rounded-lg border-2 border-dashed border-bo-border bg-bo-surface-subtle p-4">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleProductImagesChange}
                                            className="hidden"
                                            id="product-images"
                                            disabled={isSubmitting}
                                        />
                                        <label
                                            htmlFor="product-images"
                                            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-bo-border bg-white p-2 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-primary-soft hover:text-bo-primary"
                                        >
                                            <Upload className="size-4" />
                                            <span>Chọn ảnh sản phẩm</span>
                                        </label>
                                        {productImages.length === 0 && (
                                            <p className="text-center text-xs text-bo-muted">Vui lòng thêm ít nhất 1 ảnh sản phẩm chính</p>
                                        )}
                                        <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                                            {productImages.map((file, index) => (
                                                <div key={index} className="relative">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt="Preview"
                                                        className="h-24 w-full rounded-md border border-bo-border object-cover shadow-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductImage(index)}
                                                        aria-label={`Xóa ảnh ${index + 1}`}
                                                        className="absolute -right-2 -top-2 rounded-full bg-bo-danger p-1 text-white transition-opacity hover:opacity-90"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </FormSection>
                            </div>

                            {/* Biến thể sản phẩm */}
                            <div className="xl:sticky xl:top-0">
                                <FormSection
                                    title={
                                        <>
                                            Danh sách biến thể <span className="text-bo-danger">*</span>
                                        </>
                                    }
                                    description="Cuộn để xem thêm"
                                >
                                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 xl:max-h-[calc(92vh-25rem)]">
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="relative space-y-3 overflow-visible rounded-lg border border-bo-border bg-bo-surface-subtle p-4 shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-bo-foreground">Biến thể #{index + 1}</span>
                                                    {fields.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                                                            onClick={() => handleRemoveVariant(index)}
                                                            disabled={isSubmitting}
                                                        >
                                                            <X className="size-4" /> Xóa
                                                        </Button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 overflow-visible sm:grid-cols-3">
                                                    {/* Màu sắc */}
                                                    <div className="space-y-2">
                                                        <Label>Màu sắc <span className="text-bo-danger">*</span></Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.mauSacId`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Select
                                                                    value={field.value === "" || field.value === null || field.value === undefined ? undefined : field.value.toString()}
                                                                    onValueChange={(value) => field.onChange(Number(value))}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <SelectTrigger className="h-10 w-full border-bo-border text-bo-foreground">
                                                                        <SelectValue placeholder="Chọn màu" />
                                                                    </SelectTrigger>
                                                                    <SelectContent position="popper" side="bottom" align="start" className={`${SELECT_CONTENT_CLASS} max-h-[200px]`}>
                                                                        {colors.length === 0 ? (
                                                                            <div className="p-2 text-sm text-bo-muted">Không có màu sắc</div>
                                                                        ) : (
                                                                            colors.map((color) => (
                                                                                <SelectItem key={`color-${index}-${color.id}`} value={color.id.toString()} className={SELECT_ITEM_CLASS}>{color.tenMau}</SelectItem>
                                                                            ))
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                        {errors.bienTheSanPhams?.[index]?.mauSacId && (
                                                            <p className="text-xs text-bo-danger">{errors.bienTheSanPhams[index].mauSacId.message}</p>
                                                        )}
                                                    </div>

                                                    {/* Size */}
                                                    <div className="space-y-2">
                                                        <Label>Size <span className="text-bo-danger">*</span></Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.sizeId`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Select
                                                                    value={field.value === "" || field.value === null || field.value === undefined ? undefined : field.value.toString()}
                                                                    onValueChange={(value) => field.onChange(Number(value))}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <SelectTrigger className="h-10 w-full border-bo-border text-bo-foreground">
                                                                        <SelectValue placeholder="Chọn size" />
                                                                    </SelectTrigger>
                                                                    <SelectContent position="popper" side="bottom" align="start" className={`${SELECT_CONTENT_CLASS} max-h-[200px]`}>
                                                                        {sizes.length === 0 ? (
                                                                            <div className="p-2 text-sm text-bo-muted">Không có size</div>
                                                                        ) : (
                                                                            sizes.map((size) => (
                                                                                <SelectItem key={`size-${index}-${size.id}`} value={size.id.toString()} className={SELECT_ITEM_CLASS}>{size.tenSize}</SelectItem>
                                                                            ))
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                        {errors.bienTheSanPhams?.[index]?.sizeId && (
                                                            <p className="text-xs text-bo-danger">{errors.bienTheSanPhams[index].sizeId.message}</p>
                                                        )}
                                                    </div>

                                                    {/* Chất liệu */}
                                                    <div className="space-y-2">
                                                        <Label>Chất liệu <span className="text-bo-danger">*</span></Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.chatLieuId`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Select
                                                                    value={field.value === "" || field.value === null || field.value === undefined ? undefined : field.value.toString()}
                                                                    onValueChange={(value) => field.onChange(Number(value))}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <SelectTrigger className="h-10 w-full border-bo-border text-bo-foreground">
                                                                        <SelectValue placeholder="Chọn chất liệu" />
                                                                    </SelectTrigger>
                                                                    <SelectContent position="popper" side="bottom" align="start" className={`${SELECT_CONTENT_CLASS} max-h-[200px]`}>
                                                                        {materials.length === 0 ? (
                                                                            <div className="p-2 text-sm text-bo-muted">Không có chất liệu</div>
                                                                        ) : (
                                                                            materials.map((material) => (
                                                                                <SelectItem key={`material-${index}-${material.id}`} value={material.id.toString()} className={SELECT_ITEM_CLASS}>{material.tenChatLieu}</SelectItem>
                                                                            ))
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                        {errors.bienTheSanPhams?.[index]?.chatLieuId && (
                                                            <p className="text-xs text-bo-danger">{errors.bienTheSanPhams[index].chatLieuId.message}</p>
                                                        )}
                                                    </div>

                                                    {/* Mã SKU */}
                                                    <div className="space-y-2 sm:col-span-2">
                                                        <Label className="text-bo-muted">Mã SKU (Tự động)</Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.maSku`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Input {...field} placeholder="Hệ thống tự động ghép mã..." disabled className={CONTROL_DISABLED_CLASS} />
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Mã vạch SKU</Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.maVachSku`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Input {...field} placeholder="Mã vạch SKU" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Giá vốn</Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.giaVon`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Input {...field} type="number" min="0" placeholder="0 (Tự động)" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Giá bán</Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.giaBan`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Input {...field} type="number" min="0" placeholder="0 (Tự động)" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Trạng thái</Label>
                                                        <Controller
                                                            name={`bienTheSanPhams.${index}.trangThai`}
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
                                                                    <SelectContent position="popper" side="bottom" className={SELECT_CONTENT_CLASS}>
                                                                        <SelectItem value="1" className={SELECT_ITEM_CLASS}>Hoạt động</SelectItem>
                                                                        <SelectItem value="0" className={SELECT_ITEM_CLASS}>Tạm ngừng</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Variant Image */}
                                                <div className="mt-4 space-y-2 border-t border-bo-border pt-4">
                                                    <Label>Ảnh biến thể <span className="text-bo-danger">*</span></Label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 rounded-lg border-2 border-dashed border-bo-border bg-white p-2">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => handleVariantImageChange(index, e)}
                                                                className="hidden"
                                                                id={`variant-image-${index}`}
                                                                disabled={isSubmitting}
                                                            />
                                                            <label
                                                                htmlFor={`variant-image-${index}`}
                                                                className="flex h-full cursor-pointer items-center justify-center gap-2 rounded-md border border-bo-border bg-white p-2 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-primary-soft hover:text-bo-primary"
                                                            >
                                                                <Upload className="size-4" />
                                                                <span>Chọn ảnh biến thể</span>
                                                            </label>
                                                        </div>

                                                        <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bo-border bg-white">
                                                            {!variantImages[index] ? (
                                                                <p className="px-1 text-center text-[10px] text-bo-muted">Chưa có ảnh</p>
                                                            ) : (
                                                                <>
                                                                    <img
                                                                        src={URL.createObjectURL(variantImages[index])}
                                                                        alt="Variant Preview"
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveVariantImage(index)}
                                                                        aria-label={`Xóa ảnh biến thể ${index + 1}`}
                                                                        className="absolute right-1 top-1 rounded-full bg-bo-danger p-0.5 text-white shadow-sm transition-opacity hover:opacity-90"
                                                                    >
                                                                        <X className="size-3" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </FormSection>
                            </div>
                        </div>
                    </form>
                </div>

                <DialogFooter className="border-t border-bo-border bg-white px-4 py-3 sm:px-5">
                    <div className="flex w-full items-center justify-between gap-3">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => append({
                                mauSacId: null,
                                sizeId: null,
                                chatLieuId: null,
                                maSku: "",
                                maVachSku: "",
                                giaVon: 0,
                                giaBan: 0,
                                trangThai: 1,
                            })}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 border-2 border-dashed border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Plus className="size-4" />
                            Thêm biến thể khác
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                                onClick={handleSubmit(onSubmit)}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    "Lưu sản phẩm"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
