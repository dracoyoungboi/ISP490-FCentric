import { useState, useEffect, useCallback, useRef } from "react";
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
import { Loader2, Upload, X, Package, Info, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/productService.js";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService.js";
import * as yup from "yup";

import FormSection from "@/components/shared/FormSection";
import BrandSelector from "@/components/brand/BrandSelector";
import { flattenCategoryTree } from "@/utils/danhMucTree";
import { formatCurrency } from "@/utils/formatters";

const PRODUCT_STATUS_LABELS = {
    1: "Còn hàng",
    0: "Hết hàng",
    2: "Ngừng hoạt động",
};

const editProductSchema = yup.object({
    tenSanPham: yup.string().required("Tên sản phẩm là bắt buộc"),
    maSanPham: yup.string(),
    maVach: yup.string(),
    danhMucId: yup.number().required("Danh mục là bắt buộc").typeError("Vui lòng chọn danh mục"),
    thuongHieuId: yup.number().nullable(),
    moTa: yup.string(),
    giaVonMacDinh: yup.number().min(0, "Giá vốn phải >= 0").required("Giá vốn là bắt buộc"),
    giaBanMacDinh: yup.number().min(0, "Giá bán phải >= 0").required("Giá bán là bắt buộc"),
    mucTonToiThieu: yup.number().min(0, "Mức tồn phải >= 0"),
    trangThai: yup.number().required(),
    bienTheSanPhams: yup.array().of(
        yup.object({
            // null = biến thể mới thêm trong form Sửa
            id: yup.number().nullable(),
            mauSacId: yup.number().typeError("Màu sắc là bắt buộc").required("Màu sắc là bắt buộc"),
            sizeId: yup.number().typeError("Size là bắt buộc").required("Size là bắt buộc"),
            // Chỉ bắt buộc với biến thể mới của sản phẩm có nhiều chất liệu (không có chất liệu chung để tự gán)
            chatLieuId: yup.number().nullable().when("yeuCauChatLieu", {
                is: true,
                then: (schema) => schema.typeError("Chất liệu là bắt buộc").required("Chất liệu là bắt buộc"),
            }),
            // SRS 2.3.4: giá biến thể là bắt buộc (ô để trống -> báo lỗi tiếng Việt thay vì lỗi mặc định của yup)
            giaVon: yup.number().typeError("Giá vốn là bắt buộc").min(0, "Giá vốn phải >= 0").required("Giá vốn là bắt buộc"),
            giaBan: yup.number().typeError("Giá bán là bắt buộc").min(0, "Giá bán phải >= 0").required("Giá bán là bắt buộc"),
            trangThai: yup.number().required(),
        })
    ).min(1, "Phải có ít nhất 1 biến thể")
        .test("bien-the-hop-le", function (variants) {
            if (!Array.isArray(variants)) return true;
            const khoa = (mauSacId, sizeId, chatLieuId) => `${mauSacId}-${sizeId}-${chatLieuId ?? ""}`;
            // Dòng "đổi thuộc tính" = biến thể mới hoặc biến thể cũ đã đổi màu/size so với lúc mở form
            const daDoi = (v) => v.id == null || v.mauSacId !== v.mauSacIdGoc || v.sizeId !== v.sizeIdGoc;
            const nhieuChatLieu = new Set(variants.map(v => v.chatLieuId ?? null)).size > 1;
            const tenToHop = nhieuChatLieu ? "Màu sắc + Size + Chất liệu" : "Màu sắc + Size";

            // 1. Sau khi lưu, mọi biến thể phải khác nhau (giống form Thêm, UC 2.3).
            const daGap = new Map();
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                // Dòng chưa chọn đủ màu/size đã có lỗi bắt buộc riêng
                if (v.mauSacId == null || v.sizeId == null) continue;
                const key = khoa(v.mauSacId, v.sizeId, v.chatLieuId);
                if (daGap.has(key)) {
                    const k = daGap.get(key);
                    // Gắn lỗi vào dòng vừa bị đổi (dòng bị khóa không sửa được nên không gắn lỗi vào đó)
                    const dongLoi = daDoi(v) ? i : k;
                    const dongKia = dongLoi === i ? k : i;
                    return this.createError({
                        path: `bienTheSanPhams[${dongLoi}].sizeId`,
                        message: `Trùng ${tenToHop} với biến thể #${dongKia + 1}`,
                    });
                }
                daGap.set(key, i);
            }

            // 2. Không đổi chéo trong một lần lưu: màu/size mới không được trùng màu/size ĐANG LƯU của biến thể khác
            //    (DB ràng buộc duy nhất nên backend cũng chặn). Ví dụ đổi #1 sang M trong khi #2 đang là M và cũng đổi.
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                if (v.mauSacId == null || v.sizeId == null || !daDoi(v)) continue;
                const key = khoa(v.mauSacId, v.sizeId, v.chatLieuId);
                const j = variants.findIndex((o, idx) =>
                    idx !== i && o.id != null && khoa(o.mauSacIdGoc, o.sizeIdGoc, o.chatLieuId) === key);
                if (j !== -1) {
                    return this.createError({
                        path: `bienTheSanPhams[${i}].sizeId`,
                        message: `${tenToHop} này đang được lưu cho biến thể #${j + 1}. Hãy lưu thay đổi của biến thể #${j + 1} trước rồi mới chọn lại.`,
                    });
                }
            }
            return true;
        })
});

const CONTROL_CLASS =
    "border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";
// Ô chỉ xem (mã, thuộc tính biến thể, giá tự tính): nền xám, chữ vẫn đọc rõ và bôi đen/copy được
const READONLY_FIELD_CLASS =
    "flex min-h-9 items-center gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-1.5 text-sm text-bo-foreground select-text";

// Hiển thị giá trị chỉ xem; rỗng -> "Chưa có"
function ReadOnlyField({ children, className = "" }) {
    const isEmpty = children === null || children === undefined || children === "";
    return (
        <div className={`${READONLY_FIELD_CLASS} ${className}`} aria-readonly="true">
            {isEmpty ? <span className="text-bo-muted">Chưa có</span> : children}
        </div>
    );
}

function ColorDot({ hex }) {
    if (!hex) return null;
    return (
        <span
            className="size-3.5 shrink-0 rounded-full border border-bo-border"
            style={{ backgroundColor: hex }}
            aria-hidden="true"
        />
    );
}
const SELECT_CONTENT_CLASS = "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const SELECT_ITEM_CLASS = "rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

// Chọn màu sắc / size / chất liệu của biến thể (giá trị là id dạng số).
// selectedContent: nội dung hiển thị khi đã chọn — để ô vẫn hiện đúng khi danh sách còn đang tải.
function AttributeSelect({ id, value, onChange, options, renderOption, selectedContent, placeholder, emptyText, disabled, invalid }) {
    return (
        <Select
            value={value === null || value === undefined || value === "" ? undefined : String(value)}
            // Radix gọi onValueChange("") khi giá trị hiện tại chưa có trong danh sách (danh sách tải sau) -> bỏ qua
            onValueChange={(next) => {
                if (next !== "") onChange(Number(next));
            }}
            disabled={disabled}
        >
            <SelectTrigger id={id} aria-invalid={invalid || undefined} className="h-10 w-full border-bo-border text-bo-foreground">
                <SelectValue placeholder={placeholder}>{selectedContent}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className={`${SELECT_CONTENT_CLASS} max-h-[220px]`}>
                {options.length === 0 ? (
                    <div className="p-2 text-sm text-bo-muted">{emptyText}</div>
                ) : (
                    options.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)} className={SELECT_ITEM_CLASS}>
                            {renderOption(option)}
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
}

// Mã SKU theo đúng công thức backend: [Mã SP]-[Mã chất liệu]-[Mã size]-[Mã màu]
function taoMaSkuXemTruoc(maSanPham, mauSac, size, chatLieu) {
    if (!maSanPham || !mauSac?.maMau || !size?.maSize || !chatLieu?.maChatLieu) return "";
    return `${maSanPham}-${chatLieu.maChatLieu}-${size.maSize}-${mauSac.maMau}`;
}
const STEP_CLASS =
    "flex items-center justify-center gap-2 rounded-md border border-bo-border bg-white px-2 py-1.5 text-center text-[11px] font-semibold text-bo-muted";

export default function EditProductModal({ isOpen, onClose, onSuccess, productId }) {
    // Danh sách màu/size/chất liệu: dùng cho biến thể mới và biến thể chưa phát sinh giao dịch
    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [categories, setCategories] = useState([]);
    const [productImages, setProductImages] = useState([]);
    const [existingProductImages, setExistingProductImages] = useState([]);
    const [variantImages, setVariantImages] = useState({});
    const [existingVariantImages, setExistingVariantImages] = useState({});
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [productImageUpdated, setProductImageUpdated] = useState(false);
    // Thông tin gốc (lúc mở form) của biến thể đã lưu, tra theo id: màu, size, chất liệu, SKU,
    // cờ đã phát sinh giao dịch. Tra theo id nên vẫn đúng khi thêm/xóa dòng biến thể mới.
    const [variantGocById, setVariantGocById] = useState({});
    // Các chất liệu đang dùng của sản phẩm (form Thêm chọn 1 chất liệu chung cho tất cả biến thể)
    const [chatLieuGoc, setChatLieuGoc] = useState([]);
    // Thương hiệu hiện tại của sản phẩm — để ô Thương hiệu hiện đúng ngay khi danh sách thương hiệu còn đang tải
    const [initialBrand, setInitialBrand] = useState(null);
    // Snapshot dữ liệu gốc khi mở modal — dùng để quyết định đường lưu (PATCH basic-info vs PUT đầy đủ)
    const initialRef = useRef(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
        watch
    } = useForm({
        resolver: yupResolver(editProductSchema),
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
            bienTheSanPhams: [],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "bienTheSanPhams"
    });

    // Giá trị hiện tại của các dòng biến thể — để tiêu đề, mã SKU xem trước cập nhật ngay khi đổi màu/size.
    const watchedVariants = watch("bienTheSanPhams") || [];
    const maSanPhamHienTai = watch("maSanPham");

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
                    danhMucId: product.danhMuc?.id ?? "",
                    thuongHieuId: product.thuongHieu?.id ?? null,
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
                            giaVon: variant.giaVon || 0,
                            giaBan: variant.giaBan || 0,
                            trangThai: variant.trangThai ?? 1,
                            // Chỉ dùng để kiểm tra trên form (không gửi lên): màu/size đang lưu
                            mauSacIdGoc: variant.mauSac?.id ?? null,
                            sizeIdGoc: variant.size?.id ?? null,
                            yeuCauChatLieu: false,
                        }))
                        : []
                });

                // Snapshot dữ liệu gốc để quyết định đường lưu khi bấm Cập nhật:
                // chỉ đổi thông tin cơ bản -> PATCH /basic-info; đổi giá/ảnh/biến thể -> PUT /update.
                initialRef.current = {
                    tenSanPham: product.tenSanPham || "",
                    maSanPham: product.maSanPham || "",
                    maVach: product.maVach || "",
                    danhMucId: product.danhMuc?.id ?? null,
                    thuongHieuId: product.thuongHieu?.id ?? null,
                    moTa: product.moTa || "",
                    giaVonMacDinh: product.giaVonMacDinh || 0,
                    giaBanMacDinh: product.giaBanMacDinh || 0,
                    mucTonToiThieu: product.mucTonToiThieu || 0,
                    trangThai: product.trangThai ?? 1,
                    bienTheSanPhams: (product.bienTheSanPhams || []).map(variant => ({
                        id: variant.id,
                        mauSacId: variant.mauSac?.id ?? null,
                        sizeId: variant.size?.id ?? null,
                        giaVon: variant.giaVon || 0,
                        giaBan: variant.giaBan || 0,
                        trangThai: variant.trangThai ?? 1,
                    })),
                };

                const gocTheoId = {};
                const chatLieuTheoId = new Map();
                (product.bienTheSanPhams || []).forEach(variant => {
                    gocTheoId[variant.id] = {
                        mauSac: variant.mauSac ?? null,
                        size: variant.size ?? null,
                        chatLieu: variant.chatLieu ?? null,
                        maSku: variant.maSku || "",
                        // Backend cũ chưa trả cờ này -> undefined -> form coi như đã phát sinh giao dịch (khóa)
                        daPhatSinhGiaoDich: variant.daPhatSinhGiaoDich,
                    };
                    if (variant.chatLieu?.id != null) chatLieuTheoId.set(variant.chatLieu.id, variant.chatLieu);
                });
                setVariantGocById(gocTheoId);
                setChatLieuGoc([...chatLieuTheoId.values()]);
                setInitialBrand(product.thuongHieu ?? null);

                setExistingProductImages(product.anhQuanAos || []);

                // Map variant images by variant ID for easier access
                const variantImageMap = {};
                if (product.bienTheSanPhams) {
                    product.bienTheSanPhams.forEach((variant, index) => {
                        if (variant.anhBienThe) {
                            variantImageMap[index] = variant.anhBienThe;
                        }
                    });
                }
                setExistingVariantImages(variantImageMap);
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
            danhMucId: "",
            thuongHieuId: null,
            moTa: "",
            giaVonMacDinh: 0,
            giaBanMacDinh: 0,
            mucTonToiThieu: 0,
            trangThai: 1,
            bienTheSanPhams: [],
        });
        setProductImages([]);
        setExistingProductImages([]);
        setVariantImages({});
        setExistingVariantImages({});
        setProductImageUpdated(false);
        setVariantGocById({});
        setChatLieuGoc([]);
        setInitialBrand(null);
        initialRef.current = null;
    }, [reset]);

    useEffect(() => {
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải khi mở modal.
        if (isOpen && productId) {
            queueMicrotask(() => fetchProductDetails(productId));
        }
    }, [isOpen, productId, fetchProductDetails]);

    const loadReferenceData = useCallback(async () => {
        try {
            const extractData = (response) => response?.data?.data ?? response?.data ?? [];
            const [colorsResult, sizesResult, materialsResult, categoriesResult] = await Promise.allSettled([
                productService.getColors(),
                productService.getSizes(),
                productService.getMaterials(),
                danhMucQuanAoService.getCayDanhMuc(),
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

            if (categoriesResult.status === "fulfilled") {
                setCategories(flattenCategoryTree(extractData(categoriesResult.value)));
            } else {
                console.error("Lỗi tải danh mục:", categoriesResult.reason);
            }

            if (
                colorsResult.status === "rejected" ||
                sizesResult.status === "rejected" ||
                materialsResult.status === "rejected"
            ) {
                toast.error("Không thể tải dữ liệu màu sắc, size, chất liệu");
            }
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu màu sắc, size, chất liệu:", error);
            toast.error("Không thể tải dữ liệu màu sắc, size, chất liệu");
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu tham chiếu vẫn được tải khi mở modal.
        queueMicrotask(() => loadReferenceData());
    }, [isOpen, loadReferenceData]);

    // Helper function to create an empty file
    const createEmptyFile = () => {
        return new File([], 'empty.txt', { type: 'text/plain' });
    };

    const onSubmit = async (data) => {
        const initial = initialRef.current;

        // Quyết định đường lưu: CHỈ đổi thông tin cơ bản -> PATCH /basic-info (1 request,
        // không tính lại giá/trạng thái, không đụng ảnh/biến thể). Đổi giá/ảnh/biến thể
        // -> giữ nguyên luồng PUT /update multipart (1 request).
        // Mã sản phẩm, giá mặc định và trạng thái sản phẩm hiển thị chỉ xem nên không đổi được;
        // vẫn giữ các phép so sánh dưới đây để an toàn nếu sau này mở lại các ô đó.
        const brandChanged = (data.thuongHieuId ?? null) !== (initial?.thuongHieuId ?? null);
        const maSanPhamChanged = (data.maSanPham || "") !== (initial?.maSanPham || "");
        const productPriceChanged =
            Number(data.giaVonMacDinh) !== Number(initial?.giaVonMacDinh) ||
            Number(data.giaBanMacDinh) !== Number(initial?.giaBanMacDinh);
        const statusChanged = Number(data.trangThai) !== Number(initial?.trangThai);
        const initialVariantById = new Map((initial?.bienTheSanPhams || []).map(variant => [variant.id, variant]));
        const variantChanged = !initial
            ? true
            : data.bienTheSanPhams.some((variant) => {
                // Biến thể mới thêm trong form Sửa
                if (variant.id == null) return true;
                const init = initialVariantById.get(variant.id);
                if (!init) return true;
                return (
                    Number(variant.giaVon) !== Number(init.giaVon) ||
                    Number(variant.giaBan) !== Number(init.giaBan) ||
                    Number(variant.trangThai) !== Number(init.trangThai) ||
                    Number(variant.mauSacId) !== Number(init.mauSacId) ||
                    Number(variant.sizeId) !== Number(init.sizeId)
                );
            });
        const imagesChanged = productImageUpdated || Object.keys(variantImages).length > 0;

        // Biến thể mới bắt buộc có ảnh (giống form Thêm sản phẩm)
        const viTriThieuAnh = data.bienTheSanPhams.findIndex((variant, index) => variant.id == null && !variantImages[index]);
        if (viTriThieuAnh !== -1) {
            toast.error(`Vui lòng thêm ảnh cho biến thể #${viTriThieuAnh + 1}`);
            return;
        }

        const basicOnly =
            !maSanPhamChanged &&
            !productPriceChanged &&
            !statusChanged &&
            !variantChanged &&
            !imagesChanged;

        try {
            if (basicOnly) {
                // Đường 1: chỉ thay đổi thông tin cơ bản -> PATCH JSON, không gửi ảnh/biến thể.
                const res = await productService.updateProductBasicInfo(productId, {
                    tenSanPham: data.tenSanPham,
                    moTa: data.moTa || "",
                    maVach: data.maVach || "",
                    danhMucId: Number(data.danhMucId),
                    mucTonToiThieu: Number(data.mucTonToiThieu) || 0,
                    thuongHieuId: data.thuongHieuId ?? null,
                    capNhatThuongHieu: brandChanged,
                });

                if (res?.data?.status >= 400) {
                    toast.error(res.data.message || 'Có lỗi xảy ra');
                    return;
                }

                toast.success("Cập nhật sản phẩm thành công!");
                handleResetForm();
                onSuccess();
                onClose();
                return;
            }

            // Đường 2: có thay đổi giá/ảnh/biến thể -> giữ nguyên luồng PUT multipart.
            const formData = new FormData();

            const productData = {
                id: productId,
                maVach: data.maVach || "",
                tenSanPham: data.tenSanPham,
                maSanPham: data.maSanPham || "",
                mucTonToiThieu: data.mucTonToiThieu,
                moTa: data.moTa || "",
                danhMucId: Number(data.danhMucId),
                thuongHieuId: data.thuongHieuId ?? null,
                capNhatThuongHieu: brandChanged,
                giaVonMacDinh: Number(data.giaVonMacDinh),
                giaBanMacDinh: Number(data.giaBanMacDinh),
                trangThai: Number(data.trangThai),
                imageUpdated: productImageUpdated,
                bienTheSanPhams: data.bienTheSanPhams.map((variant, index) => {
                    const laBienTheMoi = variant.id == null;
                    return {
                        // id = null -> backend tạo biến thể mới
                        id: laBienTheMoi ? null : variant.id,
                        // Màu/size: backend chỉ đổi khi khác giá trị đang lưu và biến thể chưa phát sinh giao dịch,
                        // khi đó tự sinh lại mã SKU.
                        mauSacId: Number(variant.mauSacId),
                        sizeId: Number(variant.sizeId),
                        // Chất liệu chỉ gửi cho biến thể mới; biến thể đã có giữ nguyên chất liệu
                        ...(laBienTheMoi
                            ? { chatLieuId: variant.chatLieuId != null ? Number(variant.chatLieuId) : null }
                            : {}),
                        giaVon: Number(variant.giaVon),
                        giaBan: Number(variant.giaBan),
                        trangThai: Number(variant.trangThai),
                        imageUpdated: !!variantImages[index], // Check if this variant has a new image
                    };
                }),
            };

            const jsonBlob = new Blob([JSON.stringify(productData)], { type: 'application/json' });
            formData.append('updating', jsonBlob);

            // Append product images if updated
            if (productImageUpdated) {
                // Fetch ảnh cũ còn giữ lại thành File rồi gộp với ảnh mới
                const existingImageFiles = await Promise.all(
                    existingProductImages.map(async (img) => {
                        const url = img.tepTin?.duongDan || img.urlAnh;
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const fileName = url.split('/').pop() || 'existing_image.jpg';
                        return new File([blob], fileName, { type: blob.type });
                    })
                );

                // Gửi ảnh cũ trước, ảnh mới sau
                existingImageFiles.forEach((file) => {
                    formData.append('anhSanPhams', file);
                });
                productImages.forEach((file) => {
                    formData.append('anhSanPhams', file);
                });
            }

            // Append variant images in order - send empty file for variants without updates
            data.bienTheSanPhams.forEach((_, index) => {
                if (variantImages[index]) {
                    // Has new image - append the actual file
                    formData.append('anhBienThes', variantImages[index]);
                } else {
                    // No new image - append empty file to maintain order
                    formData.append('anhBienThes', createEmptyFile());
                }
            });

            const res = await productService.updateProduct(productId, formData);

            if (res?.data?.status >= 400) {
                toast.error(res.data.message || 'Có lỗi xảy ra');
                return;
            }

            toast.success("Cập nhật sản phẩm thành công!");
            handleResetForm();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Lỗi khi cập nhật sản phẩm:', error);
            console.error('Error response:', error.response);
            console.error('Error response data:', error.response?.data);

            const errorMessage = error.response?.data?.message || error.message || 'Có lỗi xảy ra khi cập nhật sản phẩm';
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
        setProductImageUpdated(true);
    };

    const handleRemoveProductImage = (index) => {
        setProductImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveExistingProductImage = (index) => {
        setExistingProductImages(prev => prev.filter((_, i) => i !== index));
        setProductImageUpdated(true);
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

    const handleRemoveExistingVariantImage = (variantIndex) => {
        setExistingVariantImages(prev => {
            const updated = { ...prev };
            delete updated[variantIndex];
            return updated;
        });
    };

    // Chất liệu lưu theo từng biến thể; form Thêm chọn 1 chất liệu áp dụng cho tất cả biến thể.
    const tenChatLieus = chatLieuGoc.map(chatLieu => chatLieu.tenChatLieu).filter(Boolean);
    const coNhieuChatLieu = chatLieuGoc.length > 1;
    // Chất liệu chung -> biến thể mới tự dùng; không có (nhiều chất liệu) -> người dùng chọn cho biến thể mới
    const chatLieuChung = chatLieuGoc.length === 1 ? chatLieuGoc[0] : null;

    const handleAddVariant = () => {
        const viTriMoi = fields.length;
        append({
            id: null,
            mauSacId: null,
            sizeId: null,
            chatLieuId: chatLieuChung?.id ?? null,
            yeuCauChatLieu: !chatLieuChung,
            mauSacIdGoc: null,
            sizeIdGoc: null,
            giaVon: 0,
            giaBan: 0,
            trangThai: 1,
        }, { shouldFocus: false });
        // Cuộn tới thẻ biến thể vừa thêm
        setTimeout(() => {
            document.getElementById(`edit-variant-${viTriMoi}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
    };

    // Chỉ biến thể mới (chưa lưu) mới xóa được; biến thể đã lưu chỉ chuyển Tạm ngừng (xóa mềm theo SRS).
    const handleRemoveNewVariant = (index) => {
        remove(index);
        // Ảnh đang tra theo vị trí dòng -> dồn chỉ số các dòng phía sau lên 1
        const dichChiSo = (prev) => {
            const updated = {};
            Object.keys(prev).forEach(key => {
                const numKey = Number(key);
                if (numKey < index) updated[numKey] = prev[key];
                else if (numKey > index) updated[numKey - 1] = prev[key];
            });
            return updated;
        };
        setVariantImages(dichChiSo);
        setExistingVariantImages(dichChiSo);
    };

    // Tra thông tin hiển thị theo id: ưu tiên danh sách vừa tải, chưa tải xong thì dùng thông tin gốc của biến thể
    const timMauSac = (id, goc) => colors.find(color => color.id === id) ?? (goc?.mauSac?.id === id ? goc.mauSac : null);
    const timSize = (id, goc) => sizes.find(size => size.id === id) ?? (goc?.size?.id === id ? goc.size : null);
    const timChatLieu = (id, goc) => materials.find(material => material.id === id) ?? (goc?.chatLieu?.id === id ? goc.chatLieu : null);

    if (isLoadingProduct) {
        return (
            <Dialog open={isOpen} onOpenChange={handleCancel}>
                <DialogContent className="border-bo-border bg-white sm:max-w-[1180px]">
                    <div className="flex items-center justify-center gap-3 py-12 text-sm text-bo-muted">
                        <Loader2 className="size-8 animate-spin text-bo-primary" />
                        <span>Đang tải thông tin sản phẩm...</span>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-bo-border bg-bo-canvas p-0 text-bo-foreground sm:max-w-[1180px]">
                <DialogHeader className="gap-0 border-b border-bo-border bg-white px-4 py-3.5 text-left sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                            <Package className="size-5 text-bo-primary" />
                            Chỉnh sửa sản phẩm
                        </DialogTitle>
                    </div>
                    <DialogDescription className="mt-1 text-sm leading-6 text-bo-muted">
                        Chỉnh sửa theo từng nhóm thông tin để kiểm tra nhanh sản phẩm, ảnh và biến thể.
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
                            <Lock className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                            <p className="text-xs leading-relaxed text-bo-foreground">
                                <b>Mã và thuộc tính:</b> Mã sản phẩm và chất liệu cố định sau khi tạo. Màu sắc, size chỉ đổi được khi biến thể chưa phát sinh giao dịch (chưa có tồn kho, chứng từ); mã SKU tự sinh lại theo màu, size mới.
                            </p>
                        </div>

                        <div className="flex items-start gap-2 rounded-lg border border-bo-border bg-bo-primary-soft p-3">
                            <Info className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                            <p className="text-xs leading-relaxed text-bo-foreground">
                                <b>Lưu ý giá:</b> Giá mặc định do hệ thống tự tính từ các biến thể còn hàng. Biến thể đang còn tồn kho sẽ được tính lại khi lưu: giá vốn theo lô nhập, giá bán = giá vốn × 1,2.
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
                                    {/* Bố cục theo form Thêm sản phẩm; ô cố định/tự tính hiển thị chỉ xem */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="tenSanPham">
                                                Tên sản phẩm <span className="text-bo-danger">*</span>
                                            </Label>
                                            <Controller
                                                name="tenSanPham"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} id="tenSanPham" placeholder="VD: Áo sơ mi nam cổ tròn" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                            {errors.tenSanPham && (
                                                <p className="text-xs text-bo-danger">{errors.tenSanPham.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="danhMucId">Danh mục <span className="text-bo-danger">*</span></Label>
                                            <Controller
                                                name="danhMucId"
                                                control={control}
                                                render={({ field }) => (
                                                    <Select
                                                        value={field.value?.toString()}
                                                        // Radix Select tự gọi onValueChange("") khi giá trị chưa có trong danh sách
                                                        // (chi tiết sản phẩm tải xong TRƯỚC cây danh mục) -> danhMucId thành 0, lưu bị lỗi.
                                                        // Danh mục là bắt buộc, không có lựa chọn rỗng nên bỏ qua giá trị "".
                                                        onValueChange={(value) => {
                                                            if (value !== "") field.onChange(Number(value));
                                                        }}
                                                        disabled={isSubmitting}
                                                    >
                                                        <SelectTrigger id="danhMucId" className="h-10 w-full border-bo-border text-bo-foreground">
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
                                                        fallbackBrand={initialBrand}
                                                    />
                                                )}
                                            />
                                            {errors.thuongHieuId && (
                                                <p className="text-xs text-bo-danger">{errors.thuongHieuId.message}</p>
                                            )}
                                        </div>

                                        {/* Chất liệu: chỉ xem (lưu theo biến thể, cố định sau khi tạo) */}
                                        <div className="space-y-2">
                                            <Label className="text-bo-muted">Chất liệu</Label>
                                            <ReadOnlyField>{tenChatLieus.join(", ")}</ReadOnlyField>
                                            <p className="text-xs text-bo-muted">
                                                {coNhieuChatLieu ? "Mỗi biến thể có chất liệu riêng" : "Áp dụng cho tất cả biến thể"}
                                            </p>
                                        </div>

                                        {/* Mã sản phẩm: hệ thống sinh khi tạo, đã dùng để ghép mã SKU -> không cho sửa */}
                                        <div className="space-y-2">
                                            <Label className="text-bo-muted">Mã sản phẩm</Label>
                                            <Controller
                                                name="maSanPham"
                                                control={control}
                                                render={({ field }) => (
                                                    <ReadOnlyField>
                                                        {field.value ? <span className="font-mono">{field.value}</span> : null}
                                                    </ReadOnlyField>
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-bo-muted">Trạng thái</Label>
                                            <Controller
                                                name="trangThai"
                                                control={control}
                                                render={({ field }) => (
                                                    <ReadOnlyField>
                                                        <span className="font-medium">{PRODUCT_STATUS_LABELS[field.value] ?? "-"}</span>
                                                    </ReadOnlyField>
                                                )}
                                            />
                                        </div>

                                        {/* Giá mặc định: hệ thống luôn tính lại khi lưu (trung bình các biến thể còn hàng) -> chỉ xem */}
                                        <div className="space-y-2">
                                            <Label className="text-bo-muted">Giá vốn mặc định (Tự động)</Label>
                                            <Controller
                                                name="giaVonMacDinh"
                                                control={control}
                                                render={({ field }) => (
                                                    <ReadOnlyField>{formatCurrency(field.value)}</ReadOnlyField>
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-bo-muted">Giá bán mặc định (Tự động)</Label>
                                            <Controller
                                                name="giaBanMacDinh"
                                                control={control}
                                                render={({ field }) => (
                                                    <ReadOnlyField>{formatCurrency(field.value)}</ReadOnlyField>
                                                )}
                                            />
                                        </div>

                                        <p className="-mt-2 text-xs text-bo-muted sm:col-span-2">
                                            Giá mặc định = trung bình giá các biến thể còn hàng; bằng 0 khi chưa biến thể nào có hàng.
                                        </p>

                                        <div className="space-y-2">
                                            <Label htmlFor="maVach">Mã vạch</Label>
                                            <Controller
                                                name="maVach"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input {...field} id="maVach" placeholder="Mã vạch" disabled={isSubmitting} className={CONTROL_CLASS} />
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="mucTonToiThieu">Mức tồn tối thiểu</Label>
                                            <Controller
                                                name="mucTonToiThieu"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input
                                                        {...field}
                                                        id="mucTonToiThieu"
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        disabled={isSubmitting}
                                                        className={CONTROL_CLASS}
                                                    />
                                                )}
                                            />
                                            {errors.mucTonToiThieu && (
                                                <p className="text-xs text-bo-danger">{errors.mucTonToiThieu.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2 sm:col-span-2">
                                            <Label htmlFor="moTa">Mô tả</Label>
                                            <Controller
                                                name="moTa"
                                                control={control}
                                                render={({ field }) => (
                                                    <Textarea
                                                        {...field}
                                                        id="moTa"
                                                        placeholder="Nhập mô tả chi tiết về sản phẩm..."
                                                        rows={3}
                                                        disabled={isSubmitting}
                                                        className={CONTROL_CLASS}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Ảnh sản phẩm">
                                    <div className="space-y-2 rounded-lg border-2 border-dashed border-bo-border bg-bo-surface-subtle p-4">
                                        {existingProductImages.length > 0 && (
                                            <div className="mb-2">
                                                <p className="mb-2 text-xs text-bo-muted">Ảnh hiện tại:</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {existingProductImages.map((img, index) => (
                                                        <div key={`existing-${index}`} className="relative">
                                                            <img
                                                                src={img.tepTin?.duongDan || img.urlAnh}
                                                                alt="Product"
                                                                className="h-20 w-full rounded-md border border-bo-border object-cover"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveExistingProductImage(index)}
                                                                aria-label={`Xóa ảnh hiện tại ${index + 1}`}
                                                                className="absolute -right-2 -top-2 rounded-full bg-bo-danger p-1 text-white transition-opacity hover:opacity-90"
                                                            >
                                                                <X className="size-3" />
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
                                            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-bo-border bg-white p-2 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-primary-soft hover:text-bo-primary"
                                        >
                                            <Upload className="size-4" />
                                            <span>Thêm ảnh mới</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                                            {productImages.map((file, index) => (
                                                <div key={index} className="relative">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt="Preview"
                                                        className="h-20 w-full rounded-md border border-bo-border object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductImage(index)}
                                                        aria-label={`Xóa ảnh mới ${index + 1}`}
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

                            <div className="xl:sticky xl:top-0">
                                <FormSection
                                    title="Biến thể sản phẩm"
                                    description="Biến thể chưa phát sinh giao dịch đổi được màu sắc, size (mã SKU tự sinh lại). Biến thể đã lưu không xóa được, chỉ chuyển sang Tạm ngừng."
                                >
                                    <div className="space-y-3">
                                        {fields.map((field, index) => {
                                            const row = watchedVariants[index] || {};
                                            const laBienTheMoi = row.id == null;
                                            const goc = laBienTheMoi ? null : variantGocById[row.id];
                                            // Biến thể đã lưu chỉ đổi màu/size khi backend xác nhận CHƯA phát sinh giao dịch
                                            // (thiếu cờ -> khóa cho an toàn, backend cũng kiểm tra lại khi lưu).
                                            const khoaThuocTinh = !laBienTheMoi && goc?.daPhatSinhGiaoDich !== false;
                                            const mauSac = timMauSac(row.mauSacId, goc);
                                            const size = timSize(row.sizeId, goc);
                                            const chatLieu = timChatLieu(row.chatLieuId, goc);
                                            const daDoiThuocTinh = !laBienTheMoi && goc != null
                                                && (row.mauSacId !== goc.mauSac?.id || row.sizeId !== goc.size?.id);
                                            const maSkuHienThi = laBienTheMoi || daDoiThuocTinh
                                                ? taoMaSkuXemTruoc(maSanPhamHienTai, mauSac, size, chatLieu)
                                                : goc?.maSku;
                                            const tomTat = [mauSac?.tenMau, size?.tenSize].filter(Boolean).join(" / ");
                                            const loiDong = errors.bienTheSanPhams?.[index];
                                            const loiKhac = ["giaVon", "giaBan", "trangThai"]
                                                .map(key => loiDong?.[key]?.message)
                                                .filter(Boolean);
                                            return (
                                            <div
                                                key={field.id}
                                                id={`edit-variant-${index}`}
                                                className={`relative space-y-3 overflow-visible rounded-lg border p-4 shadow-sm ${laBienTheMoi ? "border-bo-primary/40 bg-bo-primary-soft/40" : "border-bo-border bg-bo-surface-subtle"}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="shrink-0 text-sm font-semibold text-bo-foreground">Biến thể #{index + 1}</span>
                                                        {laBienTheMoi && (
                                                            <span className="shrink-0 rounded-full bg-bo-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                                Mới
                                                            </span>
                                                        )}
                                                        {tomTat && (
                                                            <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-bo-muted">
                                                                <span aria-hidden="true">·</span>
                                                                <ColorDot hex={mauSac?.maMauHex} />
                                                                <span className="truncate">{tomTat}</span>
                                                                {coNhieuChatLieu && chatLieu?.tenChatLieu && (
                                                                    <span className="truncate">· {chatLieu.tenChatLieu}</span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {laBienTheMoi && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="shrink-0 text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                                                            onClick={() => handleRemoveNewVariant(index)}
                                                            disabled={isSubmitting}
                                                        >
                                                            <X className="size-4" /> Xóa
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Thuộc tính biến thể: cùng vị trí với form Thêm */}
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={khoaThuocTinh ? undefined : `variant-color-${index}`} className={khoaThuocTinh ? "text-bo-muted" : undefined}>
                                                            Màu sắc {!khoaThuocTinh && <span className="text-bo-danger">*</span>}
                                                        </Label>
                                                        {khoaThuocTinh ? (
                                                            <ReadOnlyField>
                                                                {mauSac?.tenMau ? (
                                                                    <>
                                                                        <ColorDot hex={mauSac.maMauHex} />
                                                                        <span className="truncate">{mauSac.tenMau}</span>
                                                                    </>
                                                                ) : null}
                                                            </ReadOnlyField>
                                                        ) : (
                                                            <Controller
                                                                name={`bienTheSanPhams.${index}.mauSacId`}
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <AttributeSelect
                                                                        id={`variant-color-${index}`}
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                        options={colors}
                                                                        renderOption={(color) => (
                                                                            <span className="flex items-center gap-2">
                                                                                <ColorDot hex={color.maMauHex} />
                                                                                {color.tenMau}
                                                                            </span>
                                                                        )}
                                                                        selectedContent={mauSac ? (
                                                                            <span className="flex items-center gap-2">
                                                                                <ColorDot hex={mauSac.maMauHex} />
                                                                                {mauSac.tenMau}
                                                                            </span>
                                                                        ) : undefined}
                                                                        placeholder="Chọn màu"
                                                                        emptyText="Không có màu sắc"
                                                                        disabled={isSubmitting}
                                                                        invalid={!!loiDong?.mauSacId}
                                                                    />
                                                                )}
                                                            />
                                                        )}
                                                        {loiDong?.mauSacId && (
                                                            <p className="text-xs text-bo-danger">{loiDong.mauSacId.message}</p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={khoaThuocTinh ? undefined : `variant-size-${index}`} className={khoaThuocTinh ? "text-bo-muted" : undefined}>
                                                            Size {!khoaThuocTinh && <span className="text-bo-danger">*</span>}
                                                        </Label>
                                                        {khoaThuocTinh ? (
                                                            <ReadOnlyField>{size?.tenSize}</ReadOnlyField>
                                                        ) : (
                                                            <Controller
                                                                name={`bienTheSanPhams.${index}.sizeId`}
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <AttributeSelect
                                                                        id={`variant-size-${index}`}
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                        options={sizes}
                                                                        renderOption={(item) => item.tenSize}
                                                                        selectedContent={size ? size.tenSize : undefined}
                                                                        placeholder="Chọn size"
                                                                        emptyText="Không có size"
                                                                        disabled={isSubmitting}
                                                                        invalid={!!loiDong?.sizeId}
                                                                    />
                                                                )}
                                                            />
                                                        )}
                                                        {loiDong?.sizeId && (
                                                            <p className="text-xs text-bo-danger">{loiDong.sizeId.message}</p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-bo-muted">
                                                            {laBienTheMoi || daDoiThuocTinh ? "Mã SKU (Tự động)" : "Mã SKU"}
                                                        </Label>
                                                        <ReadOnlyField>
                                                            {maSkuHienThi ? (
                                                                <span className="break-all font-mono text-xs">{maSkuHienThi}</span>
                                                            ) : laBienTheMoi ? (
                                                                <span className="text-xs italic text-bo-muted">Chọn màu sắc và size để ghép mã</span>
                                                            ) : null}
                                                        </ReadOnlyField>
                                                        {daDoiThuocTinh && goc?.maSku && (
                                                            <p className="break-all text-xs text-bo-muted">
                                                                Mã cũ: <span className="font-mono">{goc.maSku}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Biến thể mới của sản phẩm nhiều chất liệu: phải chọn chất liệu */}
                                                {laBienTheMoi && row.yeuCauChatLieu && (
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                        <div className="space-y-2">
                                                            <Label htmlFor={`variant-material-${index}`}>
                                                                Chất liệu <span className="text-bo-danger">*</span>
                                                            </Label>
                                                            <Controller
                                                                name={`bienTheSanPhams.${index}.chatLieuId`}
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <AttributeSelect
                                                                        id={`variant-material-${index}`}
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                        options={materials}
                                                                        renderOption={(item) => item.tenChatLieu}
                                                                        selectedContent={chatLieu ? chatLieu.tenChatLieu : undefined}
                                                                        placeholder="Chọn chất liệu"
                                                                        emptyText="Không có chất liệu"
                                                                        disabled={isSubmitting}
                                                                        invalid={!!loiDong?.chatLieuId}
                                                                    />
                                                                )}
                                                            />
                                                            {loiDong?.chatLieuId && (
                                                                <p className="text-xs text-bo-danger">{loiDong.chatLieuId.message}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {khoaThuocTinh && (
                                                    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-bo-muted">
                                                        <Lock className="mt-0.5 size-3.5 shrink-0" />
                                                        <span>
                                                            Đã phát sinh giao dịch (tồn kho, chứng từ) nên không đổi được màu sắc, size.
                                                            Cần màu/size khác: chuyển biến thể này sang Tạm ngừng và thêm biến thể mới.
                                                        </span>
                                                    </p>
                                                )}

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    {/* Giá vốn */}
                                                    <div className="space-y-2">
                                                        <Label>Giá vốn <span className="text-bo-danger">*</span></Label>
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
                                                                    className={CONTROL_CLASS}
                                                                />
                                                            )}
                                                        />
                                                    </div>

                                                    {/* Giá bán */}
                                                    <div className="space-y-2">
                                                        <Label>Giá bán <span className="text-bo-danger">*</span></Label>
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
                                                                    className={CONTROL_CLASS}
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
                                                                    <SelectTrigger className="h-10 w-full border-bo-border text-bo-foreground">
                                                                        <SelectValue placeholder="Chọn trạng thái" />
                                                                    </SelectTrigger>
                                                                    <SelectContent
                                                                        position="popper"
                                                                        side="bottom"
                                                                        align="start"
                                                                        sideOffset={4}
                                                                        className={SELECT_CONTENT_CLASS}
                                                                    >
                                                                        <SelectItem value="1" className={SELECT_ITEM_CLASS}>Hoạt động</SelectItem>
                                                                        <SelectItem value="0" className={SELECT_ITEM_CLASS}>Tạm ngừng</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Variant Image */}
                                                <div className="space-y-2">
                                                    <Label>Ảnh biến thể {laBienTheMoi && <span className="text-bo-danger">*</span>}</Label>
                                                    <div className="space-y-2 rounded-lg border-2 border-dashed border-bo-border bg-bo-surface-subtle p-3">
                                                        {/* Existing variant image */}
                                                        {existingVariantImages[index] && !variantImages[index] && (
                                                            <div className="mb-2">
                                                                <p className="mb-2 text-xs text-bo-muted">Ảnh hiện tại:</p>
                                                                <div className="relative inline-block">
                                                                    <img
                                                                        src={existingVariantImages[index].tepTin?.duongDan || existingVariantImages[index].urlAnh}
                                                                        alt="Variant"
                                                                        className="size-24 rounded-md border border-bo-border object-cover"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveExistingVariantImage(index)}
                                                                        aria-label={`Xóa ảnh biến thể hiện tại ${index + 1}`}
                                                                        className="absolute -right-2 -top-2 rounded-full bg-bo-danger p-1 text-white transition-opacity hover:opacity-90"
                                                                    >
                                                                        <X className="size-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

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
                                                            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-bo-border bg-white p-2 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-primary-soft hover:text-bo-primary"
                                                        >
                                                            <Upload className="size-4" />
                                                            <span>
                                                                {variantImages[index] || existingVariantImages[index] ? "Thay đổi ảnh" : "Thêm ảnh mới"}
                                                            </span>
                                                        </label>

                                                        {variantImages[index] && (
                                                            <div>
                                                                <p className="mb-2 text-xs text-bo-muted">Ảnh mới:</p>
                                                                <div className="relative inline-block">
                                                                    <img
                                                                        src={URL.createObjectURL(variantImages[index])}
                                                                        alt="New Variant"
                                                                        className="size-24 rounded-md border border-bo-border object-cover"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveVariantImage(index)}
                                                                        aria-label={`Xóa ảnh biến thể mới ${index + 1}`}
                                                                        className="absolute -right-2 -top-2 rounded-full bg-bo-danger p-1 text-white transition-opacity hover:opacity-90"
                                                                    >
                                                                        <X className="size-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Lỗi màu/size/chất liệu đã hiện ngay dưới ô tương ứng */}
                                                {loiKhac.length > 0 && (
                                                    <p className="text-xs text-bo-danger">{loiKhac.join(", ")}</p>
                                                )}
                                            </div>
                                            );
                                        })}
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
                            onClick={handleAddVariant}
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
                                        Đang cập nhật...
                                    </>
                                ) : (
                                    "Cập nhật sản phẩm"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
