import { getApiErrorMessage } from "@/utils/apiError";
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
import { Loader2, Upload, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/productService.js";
import { productSchema } from "@/validations/productSchema";

export default function ProductModal({ isOpen, onClose, onSuccess, productId = null }) {
    const isEditMode = !!productId;

    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [productImages, setProductImages] = useState([]);
    const [variantImages, setVariantImages] = useState([]);
    const [existingProductImages, setExistingProductImages] = useState([]);
    const [existingVariantImages, setExistingVariantImages] = useState([]);
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: yupResolver(productSchema),
        defaultValues: {
            tenSanPham: "",
            maSanPham: "",
            maVach: "",
            danhMucId: 1,
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

    const fetchProductDetails = useCallback(async (id) => {
        try {
            setIsLoadingProduct(true);
            const res = await productService.getProductById(id);

            if (res.data?.status === 200) {
                const product = res.data.data;
                reset({
                    tenSanPham: product.tenSanPham || "",
                    maSanPham: product.maSanPham || "",
                    maVach: product.maVach || "",
                    danhMucId: product.danhMuc?.id || 1,
                    moTa: product.moTa || "",
                    giaVonMacDinh: product.giaVonMacDinh || 0,
                    giaBanMacDinh: product.giaBanMacDinh || 0,
                    mucTonToiThieu: product.mucTonToiThieu || 0,
                    trangThai: product.trangThai ?? 1,
                    bienTheSanPhams: product.bienTheSanPhams?.length > 0
                        ? product.bienTheSanPhams.map(variant => ({
                            id: variant.id,
                            mauSacId: variant.mauSac?.id ?? null,
                            sizeId: variant.size?.id ?? null,
                            chatLieuId: variant.chatLieu?.id ?? null,
                            maSku: variant.maSku || "",
                            maVachSku: variant.maVachSku || "",
                            giaVon: variant.giaVon || 0,
                            giaBan: variant.giaBan || 0,
                            trangThai: variant.trangThai ?? 1,
                        }))
                        : [{
                            mauSacId: null,
                            sizeId: null,
                            chatLieuId: null,
                            maSku: "",
                            maVachSku: "",
                            giaVon: 0,
                            giaBan: 0,
                            trangThai: 1,
                        }]
                });

                setExistingProductImages(product.anhQuanAos || []);
                setExistingVariantImages(product.anhBienThes || []);
            }
        } catch (error) {
            console.error("Lỗi khi tải chi tiết sản phẩm:", error);
            toast.error(error.response?.data?.message || "Không thể tải thông tin sản phẩm");
            onClose();
        } finally {
            setIsLoadingProduct(false);
        }
    }, [reset, onClose]);

    const handleResetForm = useCallback(() => {
        reset({
            tenSanPham: "",
            maSanPham: "",
            maVach: "",
            danhMucId: 1,
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
        setVariantImages([]);
        setExistingProductImages([]);
        setExistingVariantImages([]);
    }, [reset]);

    useEffect(() => {
        if (isOpen && isEditMode && productId) {
            fetchProductDetails(productId);
        }
    }, [isOpen, isEditMode, productId, fetchProductDetails]);

    useEffect(() => {
        if (isOpen && !isEditMode) {
            handleResetForm();
        }
    }, [isOpen, isEditMode, handleResetForm]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            try {
                const extractData = (response) => response?.data?.data ?? response?.data ?? [];
                const [colorsResult, sizesResult, materialsResult] = await Promise.allSettled([
                    productService.getColors(),
                    productService.getSizes(),
                    productService.getMaterials(),
                ]);

                if (colorsResult.status === "fulfilled") {
                    setColors(extractData(colorsResult.value));
                } else {
                    console.error("Lỗi tải màu sắc:", colorsResult.reason);
                }

                if (sizesResult.status === "fulfilled") {
                    const sizeData = extractData(sizesResult.value);
                    setSizes(sizeData);
                } else {
                    console.error("Lỗi tải size:", sizesResult.reason);
                }

                if (materialsResult.status === "fulfilled") {
                    setMaterials(extractData(materialsResult.value));
                } else {
                    console.error("Lỗi tải chất liệu:", materialsResult.reason);
                }

                if (
                    colorsResult.status === "rejected" ||
                    sizesResult.status === "rejected" ||
                    materialsResult.status === "rejected"
                ) {
                    toast.error("Không thể tải dữ liệu màu sắc, kích cỡ, chất liệu");
                }
            } catch (error) {
                console.error("Lỗi khi tải dữ liệu màu sắc, kích cỡ, chất liệu:", error);
                toast.error("Không thể tải dữ liệu màu sắc, kích cỡ, chất liệu");
            }
        };

        fetchData();
    }, [isOpen]);

    const onSubmit = async (data) => {
        try {
            const formData = new FormData();

            const productData = {
                maVach: data.maVach || "",
                tenSanPham: data.tenSanPham,
                maSanPham: data.maSanPham || "",
                mucTonToiThieu: data.mucTonToiThieu,
                moTa: data.moTa || "",
                danhMucId: Number(data.danhMucId),
                giaVonMacDinh: Number(data.giaVonMacDinh),
                giaBanMacDinh: Number(data.giaBanMacDinh),
                trangThai: Number(data.trangThai),
                bienTheSanPhams: data.bienTheSanPhams.map(variant => ({
                    ...(variant.id && { id: variant.id }),
                    mauSacId: Number(variant.mauSacId),
                    sizeId: Number(variant.sizeId),
                    chatLieuId: Number(variant.chatLieuId),
                    maSku: variant.maSku,
                    maVachSku: variant.maVachSku || "",
                    giaVon: Number(variant.giaVon),
                    giaBan: Number(variant.giaBan),
                    trangThai: Number(variant.trangThai),
                })),
            };

            const dataKey = isEditMode ? 'updating' : 'creating';
            const jsonBlob = new Blob([JSON.stringify(productData)], { type: 'application/json' });
            formData.append(dataKey, jsonBlob);

            // Append image files
            productImages.forEach((file) => {
                formData.append('anhSanPhams', file);
            });

            variantImages.forEach((file) => {
                formData.append('anhBienThes', file);
            });

            let res;
            if (isEditMode) {
                res = await productService.updateProduct(productId, formData);
            } else {
                res = await productService.createProduct(formData);
            }

            if (res?.data?.status >= 400) {
                toast.error(res.data.message || 'Có lỗi xảy ra');
                return;
            }

            // Success
            toast.success(isEditMode ? "Cập nhật sản phẩm thành công." : "Tạo sản phẩm thành công.");
            handleResetForm();
            onSuccess();
            onClose();
        } catch (error) {
            console.error(`Lỗi khi ${isEditMode ? 'cập nhật' : 'tạo'} sản phẩm:`, error);
            console.error('Error response:', error.response);
            console.error('Error response data:', error.response?.data);

            const errorMessage = getApiErrorMessage(error, `Có lỗi xảy ra khi ${isEditMode ? 'cập nhật' : 'tạo'} sản phẩm`);
            toast.error(errorMessage);
        }
    };


    const handleCancel = () => {
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

    const handleRemoveExistingProductImage = (index) => {
        setExistingProductImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleVariantImagesChange = (e) => {
        const files = Array.from(e.target.files || []);
        setVariantImages(prev => [...prev, ...files]);
    };

    const handleRemoveVariantImage = (index) => {
        setVariantImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveExistingVariantImage = (index) => {
        setExistingVariantImages(prev => prev.filter((_, i) => i !== index));
    };

    if (isLoadingProduct) {
        return (
            <Dialog open={isOpen} onOpenChange={handleCancel}>
                <DialogContent className="sm:max-w-[900px] bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        <span className="ml-3 text-gray-600">Đang tải thông tin sản phẩm...</span>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="sm:max-w-[900px]
    max-h-[90vh]
    bg-white text-gray-900
    border border-gray-200
    rounded-xl shadow-sm
    dark:bg-white dark:text-gray-900">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-purple-700">
                        {isEditMode ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? "Cập nhật thông tin sản phẩm và biến thể. Nhấn lưu khi hoàn tất."
                            : "Nhập đầy đủ thông tin sản phẩm và biến thể. Nhấn lưu khi hoàn tất."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[calc(90vh-12rem)] overflow-y-auto overflow-x-visible px-1">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Thông tin cơ bản</h3>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Tên sản phẩm */}
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="tenSanPham">
                                        Tên sản phẩm <span className="text-red-500">*</span>
                                    </Label>
                                    <Controller
                                        name="tenSanPham"
                                        control={control}
                                        render={({ field }) => (
                                            <Input {...field} placeholder="VD: Áo sơ mi nam cổ tròn" disabled={isSubmitting} />
                                        )}
                                    />
                                    {errors.tenSanPham && (
                                        <p className="text-xs text-red-500">{errors.tenSanPham.message}</p>
                                    )}
                                </div>

                                {/* Mã sản phẩm & Mã vạch */}
                                <div className="space-y-2">
                                    <Label htmlFor="maSanPham">Mã sản phẩm</Label>
                                    <Controller
                                        name="maSanPham"
                                        control={control}
                                        render={({ field }) => (
                                            <Input {...field} placeholder="Mã sản phẩm" disabled={isSubmitting} />
                                        )}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="maVach">Mã vạch</Label>
                                    <Controller
                                        name="maVach"
                                        control={control}
                                        render={({ field }) => (
                                            <Input {...field} placeholder="Mã vạch" disabled={isSubmitting} />
                                        )}
                                    />
                                </div>

                                {/* Hidden field for danhMucId - always set to 1 */}
                                <Controller
                                    name="danhMucId"
                                    control={control}
                                    render={({ field }) => (
                                        <input type="hidden" {...field} value={1} />
                                    )}
                                />

                                <div className="space-y-2">
                                    <Label htmlFor="trangThai">Trạng thái</Label>
                                    <Controller
                                        name="trangThai"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value?.toString()}
                                                onValueChange={(value) => field.onChange(Number(value))}
                                                disabled={isSubmitting}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">Còn hàng</SelectItem>
                                                    <SelectItem value="0">Hết hàng</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                {/* Giá mặc định */}
                                <div className="space-y-2">
                                    <Label htmlFor="giaVonMacDinh">Giá vốn mặc định</Label>
                                    <Controller
                                        name="giaVonMacDinh"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                disabled={isSubmitting}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="giaBanMacDinh">
                                        Giá bán mặc định <span className="text-red-500">*</span>
                                    </Label>
                                    <Controller
                                        name="giaBanMacDinh"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                disabled={isSubmitting}
                                            />
                                        )}
                                    />
                                    {errors.giaBanMacDinh && (
                                        <p className="text-xs text-red-500">{errors.giaBanMacDinh.message}</p>
                                    )}
                                </div>

                                {/* Mức tồn tối thiểu */}
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="mucTonToiThieu">Mức tồn tối thiểu</Label>
                                    <Controller
                                        name="mucTonToiThieu"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                disabled={isSubmitting}
                                            />
                                        )}
                                    />
                                </div>

                                {/* Mô tả */}
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="moTa">Mô tả</Label>
                                    <Controller
                                        name="moTa"
                                        control={control}
                                        render={({ field }) => (
                                            <Textarea
                                                {...field}
                                                placeholder="Nhập mô tả chi tiết về sản phẩm..."
                                                rows={3}
                                                disabled={isSubmitting}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Biến thể sản phẩm */}
                        <div className="space-y-4 overflow-visible">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-semibold text-sm text-gray-700">
                                    Biến thể sản phẩm <span className="text-red-500">*</span>
                                </h3>
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
                                    className="flex items-center gap-1"
                                >
                                    <Plus className="h-4 w-4" />
                                    Thêm biến thể
                                </Button>
                            </div>

                            {fields.map((field, index) => (
                                <div key={field.id} className="p-4 border rounded-lg space-y-3 bg-gray-50 relative overflow-visible">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Biến thể #{index + 1}</span>
                                        {fields.length > 1 && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => remove(index)}
                                                disabled={isSubmitting}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 overflow-visible">
                                        {/* Màu sắc */}
                                        <div className="space-y-2">
                                            <Label>Màu sắc <span className="text-red-500">*</span></Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.mauSacId`}
                                                control={control}
                                                render={({ field }) => {
                                                    return (
                                                        <Select
                                                            value={field.value === "" || field.value === null || field.value === undefined ? undefined : field.value.toString()}
                                                            onValueChange={(value) => {
                                                                field.onChange(Number(value));
                                                            }}
                                                            disabled={isSubmitting}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Chọn màu" />
                                                            </SelectTrigger>
                                                            <SelectContent
                                                                position="popper"
                                                                side="bottom"
                                                                align="start"
                                                                sideOffset={4}
                                                                className="z-110 bg-white"
                                                            >
                                                                {colors.length === 0 ? (
                                                                    <div className="p-2 text-sm text-gray-500">Không có màu sắc</div>
                                                                ) : (
                                                                    colors.map((color) => (
                                                                        <SelectItem
                                                                            key={`color-${index}-${color.id}`}
                                                                            value={color.id.toString()}
                                                                        >
                                                                            {color.tenMau}
                                                                        </SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    );
                                                }}
                                            />
                                        </div>

                                        {/* Size */}
                                        <div className="space-y-2">
                                            <Label>Kích cỡ <span className="text-red-500">*</span></Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.sizeId`}
                                                control={control}
                                                render={({ field }) => {
                                                    return (
                                                        <Select
                                                            value={field.value === "" || field.value === null || field.value === undefined ? undefined : field.value.toString()}
                                                            onValueChange={(value) => {
                                                                field.onChange(Number(value));
                                                            }}
                                                            disabled={isSubmitting}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Chọn kích cỡ" />
                                                            </SelectTrigger>
                                                            <SelectContent
                                                                position="popper"
                                                                side="bottom"
                                                                align="start"
                                                                sideOffset={4}
                                                                className="z-110 bg-white"
                                                            >
                                                                {sizes.length === 0 ? (
                                                                    <div className="p-2 text-sm text-gray-500">Không có kích cỡ</div>
                                                                ) : (
                                                                    sizes.map((size) => (
                                                                        <SelectItem
                                                                            key={`size-${index}-${size.id}`}
                                                                            value={size.id.toString()}
                                                                        >
                                                                            {size.tenSize}
                                                                        </SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    );
                                                }}
                                            />
                                        </div>

                                        {/* Chất liệu */}
                                        <div className="space-y-2">
                                            <Label>Chất liệu <span className="text-red-500">*</span></Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.chatLieuId`}
                                                control={control}
                                                render={({ field }) => {
                                                    return (
                                                        <Select
                                                            value={field.value === "" || field.value === null || field.value === undefined ? undefined : field.value.toString()}
                                                            onValueChange={(value) => {
                                                                field.onChange(Number(value));
                                                            }}
                                                            disabled={isSubmitting}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Chọn chất liệu" />
                                                            </SelectTrigger>
                                                            <SelectContent
                                                                position="popper"
                                                                side="bottom"
                                                                align="start"
                                                                sideOffset={4}
                                                                className="z-110 bg-white"
                                                            >
                                                                {materials.length === 0 ? (
                                                                    <div className="p-2 text-sm text-gray-500">Không có chất liệu</div>
                                                                ) : (
                                                                    materials.map((material) => (
                                                                        <SelectItem
                                                                            key={`material-${index}-${material.id}`}
                                                                            value={material.id.toString()}
                                                                        >
                                                                            {material.tenChatLieu}
                                                                        </SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    );
                                                }}
                                            />
                                        </div>

                                        {/* Mã SKU */}
                                        <div className="col-span-2 space-y-2">
                                            <Label>Mã SKU <span className="text-red-500">*</span></Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.maSku`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} placeholder="Mã SKU" disabled={isSubmitting} />
                                                )}
                                            />
                                        </div>

                                        {/* Mã vạch SKU */}
                                        <div className="space-y-2">
                                            <Label>Mã vạch SKU</Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.maVachSku`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} placeholder="Mã vạch SKU" disabled={isSubmitting} />
                                                )}
                                            />
                                        </div>

                                        {/* Giá vốn */}
                                        <div className="space-y-2">
                                            <Label>Giá vốn <span className="text-red-500">*</span></Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.giaVon`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Input
                                                        {...field}
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        disabled={isSubmitting}
                                                    />
                                                )}
                                            />
                                        </div>

                                        {/* Giá bán */}
                                        <div className="space-y-2">
                                            <Label>Giá bán <span className="text-red-500">*</span></Label>
                                            <Controller
                                                name={`bienTheSanPhams.${index}.giaBan`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Input
                                                        {...field}
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        disabled={isSubmitting}
                                                    />
                                                )}
                                            />
                                        </div>

                                        {/* Trạng thái */}
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
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">Hoạt động</SelectItem>
                                                            <SelectItem value="0">Tạm ngừng</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {errors.bienTheSanPhams?.[index] && (
                                        <p className="text-xs text-red-500">
                                            {Object.values(errors.bienTheSanPhams[index]).map(err => err.message).join(', ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Upload ảnh */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Ảnh sản phẩm */}
                            <div className="space-y-2">
                                <Label>Ảnh sản phẩm</Label>
                                <div className="border-2 border-dashed rounded-lg p-4 space-y-2">
                                    {/* Existing images - only show in edit mode */}
                                    {isEditMode && existingProductImages.length > 0 && (
                                        <div className="mb-2">
                                            <p className="text-xs text-gray-500 mb-2">Ảnh hiện tại:</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {existingProductImages.map((img, index) => (
                                                    <div key={`existing-${index}`} className="relative">
                                                        <img
                                                            src={img?.tepTin?.duongDan}
                                                            alt="Ảnh sản phẩm"
                                                            className="w-full h-20 object-cover rounded"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveExistingProductImage(index)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
                                        className="flex items-center justify-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                                    >
                                        <Upload className="h-4 w-4" />
                                        <span className="text-sm">{isEditMode ? "Thêm ảnh mới" : "Chọn ảnh"}</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {productImages.map((file, index) => (
                                            <div key={index} className="relative">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt="Xem trước ảnh"
                                                    className="w-full h-20 object-cover rounded"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveProductImage(index)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Ảnh biến thể */}
                            <div className="space-y-2">
                                <Label>Ảnh biến thể</Label>
                                <div className="border-2 border-dashed rounded-lg p-4 space-y-2">
                                    {/* Existing images - only show in edit mode */}
                                    {isEditMode && existingVariantImages.length > 0 && (
                                        <div className="mb-2">
                                            <p className="text-xs text-gray-500 mb-2">Ảnh hiện tại:</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {existingVariantImages.map((img, index) => (
                                                    <div key={`existing-${index}`} className="relative">
                                                        <img
                                                            src={img?.tepTin?.duongDan}
                                                            alt="Ảnh biến thể"
                                                            className="w-full h-20 object-cover rounded"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveExistingVariantImage(index)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleVariantImagesChange}
                                        className="hidden"
                                        id="variant-images"
                                        disabled={isSubmitting}
                                    />
                                    <label
                                        htmlFor="variant-images"
                                        className="flex items-center justify-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                                    >
                                        <Upload className="h-4 w-4" />
                                        <span className="text-sm">{isEditMode ? "Thêm ảnh mới" : "Chọn ảnh"}</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {variantImages.map((file, index) => (
                                            <div key={index} className="relative">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt="Xem trước ảnh"
                                                    className="w-full h-20 object-cover rounded"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveVariantImage(index)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                    >
                        Hủy
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={handleSubmit(onSubmit)}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isEditMode ? "Đang cập nhật..." : "Đang lưu..."}
                            </>
                        ) : (
                            isEditMode ? "Cập nhật sản phẩm" : "Lưu sản phẩm"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
