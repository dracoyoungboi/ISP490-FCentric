import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback, useMemo, useReducer } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/productService.js";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService.js";
import * as yup from "yup";

import FormSection from "@/components/shared/FormSection";
import { flattenCategoryTree } from "@/utils/danhMucTree";
import TrinhTaoBienThe from "./TrinhTaoBienThe";
import KhuAnhSanPham from "./KhuAnhSanPham";
import HopHoiBoThayDoi from "./HopHoiBoThayDoi";
import {
    TomTatLoi,
    TruongDanhMuc,
    TruongMoTa,
    TruongMucTon,
    TruongTenSanPham,
    TruongThuongHieu,
} from "./TruongThongTin";
import {
    DO_DAI_TEN_TOI_DA,
    LOP_FORM,
    NUT_VIEN_CLASS,
    O_ANH_MAU,
    O_CHON_MAU,
    O_NUT_KICH_CO,
    SELECT_CONTENT_CLASS,
    SELECT_ITEM_CLASS,
    SELECT_TRIGGER_CLASS,
    THOI_GIAN_DONG_HOP_THOAI,
    layDuLieu,
} from "./kieuForm";
import {
    locTepAnhHopLe,
    taoXuLyPhimTat,
    useAnhXemTruoc,
    useChanRoiTrang,
    useChanThaTepNgoaiKhung,
    useCuonToiLoiSauKhiLuu,
    useHoiTruocKhiBo,
} from "./dungChungForm";
import {
    SO_BIEN_THE_TOI_DA,
    bienTheReducer,
    daNhapBienThe,
    kiemTraTepAnh,
    ngayTrongMa,
    sapXepKichCo,
    taoDuLieuGuiBienThe,
    thongKeBienThe,
    tinhNhomBienThe,
    trangThaiBanDau,
    vietTatDanhMuc,
} from "./logicBienThe";

// Biến thể, ảnh và giá được kiểm tra riêng (xem danhSachLoiBienThe); schema chỉ lo thông tin cơ bản.
const addProductSchema = yup.object({
    tenSanPham: yup
        .string()
        .trim()
        .required("Vui lòng nhập tên sản phẩm")
        .max(DO_DAI_TEN_TOI_DA, `Tên sản phẩm tối đa ${DO_DAI_TEN_TOI_DA} ký tự`),
    danhMucId: yup.number().required("Vui lòng chọn danh mục").typeError("Vui lòng chọn danh mục"),
    thuongHieuId: yup.number().nullable(),
    // Chất liệu chọn 1 lần, áp dụng cho tất cả biến thể.
    // Lưu ý: nullable() phải đứng TRƯỚC required() để null vẫn bị required bắt
    // (đã kiểm chứng trên yup 1.7.1 — thứ tự ngược lại sẽ cho null lọt qua).
    chatLieuId: yup.number()
        .nullable()
        .required("Vui lòng chọn chất liệu")
        .typeError("Vui lòng chọn chất liệu")
        .positive("Vui lòng chọn chất liệu hợp lệ"),
    mucTonToiThieu: yup
        .number()
        .transform((value) => (isNaN(value) ? 0 : value))
        .min(0, "Vui lòng nhập mức tồn từ 0 trở lên")
        .integer("Vui lòng nhập số nguyên"),
    moTa: yup.string(),
});

const GIA_TRI_MAC_DINH = {
    tenSanPham: "",
    danhMucId: "",
    thuongHieuId: null,
    chatLieuId: null,
    mucTonToiThieu: 0,
    moTa: "",
};

export default function AddProductModal({ isOpen, onClose, onSuccess }) {
    const [categories, setCategories] = useState([]);
    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [dangTaiThamChieu, setDangTaiThamChieu] = useState(false);
    const [loiTaiThamChieu, setLoiTaiThamChieu] = useState(false);
    const [anhSanPhams, setAnhSanPhams] = useState([]);
    const [bienThe, dispatchBienThe] = useReducer(bienTheReducer, undefined, trangThaiBanDau);
    // Chỉ tô đỏ lỗi ảnh/biến thể sau lần bấm Lưu đầu tiên
    const [hienLoi, setHienLoi] = useState(false);
    const [ngayMa, setNgayMa] = useState(() => ngayTrongMa());

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm({
        resolver: yupResolver(addProductSchema),
        defaultValues: GIA_TRI_MAC_DINH,
    });
    const [danhMucId, chatLieuId] = useWatch({ control, name: ["danhMucId", "chatLieuId"] });

    const coThayDoi = isDirty || anhSanPhams.length > 0 || daNhapBienThe(bienThe);
    const { hoiBoThayDoi, setHoiBoThayDoi, dongForm, handleCancel, nhoNutMoForm, traFocusNutMoForm, traFocusSauKhiHoi } =
        useHoiTruocKhiBo({ coThayDoi, dangLuu: isSubmitting, onClose });

    // Ảnh sản phẩm và ảnh màu có thể dùng chung một URL xem trước.
    const anhDangDung = useMemo(() => [...anhSanPhams, ...Object.values(bienThe.anhMau)], [anhSanPhams, bienThe.anhMau]);
    const taoAnhXemTruoc = useAnhXemTruoc(anhDangDung);
    useChanRoiTrang(isOpen, coThayDoi);
    useChanThaTepNgoaiKhung(isOpen);
    const henCuonToiLoi = useCuonToiLoiSauKhiLuu(isSubmitting);

    // ---------- mở / đặt lại form ----------
    const handleResetForm = useCallback(() => {
        reset(GIA_TRI_MAC_DINH);
        setAnhSanPhams([]);
        dispatchBienThe({ type: "datLai" });
        setHienLoi(false);
        setHoiBoThayDoi(false);
        setNgayMa(ngayTrongMa());
    }, [reset, setHoiBoThayDoi]);

    // Mở form: luôn bắt đầu sạch. Đóng form: chờ hiệu ứng đóng xong mới xóa, để form không trống trơn lúc đang mờ dần.
    useEffect(() => {
        if (isOpen) {
            // Hoãn qua microtask để tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect).
            queueMicrotask(() => handleResetForm());
            return undefined;
        }
        const hen = setTimeout(handleResetForm, THOI_GIAN_DONG_HOP_THOAI);
        return () => clearTimeout(hen);
    }, [isOpen, handleResetForm]);

    const loadReferenceData = useCallback(async () => {
        setDangTaiThamChieu(true);
        setLoiTaiThamChieu(false);
        try {
            const [colorsResult, sizesResult, materialsResult, categoriesResult] = await Promise.allSettled([
                productService.getColors(),
                productService.getSizes(),
                productService.getMaterials(),
                danhMucQuanAoService.getCayDanhMuc(),
            ]);

            if (colorsResult.status === "fulfilled") setColors(layDuLieu(colorsResult.value));
            // Sắp theo thứ tự chuẩn ngay ở form để không phụ thuộc thứ tự backend trả về.
            if (sizesResult.status === "fulfilled") setSizes(sapXepKichCo(layDuLieu(sizesResult.value)));
            if (materialsResult.status === "fulfilled") setMaterials(layDuLieu(materialsResult.value));
            if (categoriesResult.status === "fulfilled") {
                setCategories(flattenCategoryTree(layDuLieu(categoriesResult.value)));
            } else {
                toast.error("Không thể tải dữ liệu danh mục");
            }
            if ([colorsResult, sizesResult, materialsResult].some((r) => r.status === "rejected")) {
                setLoiTaiThamChieu(true);
                toast.error("Không tải được màu sắc, kích cỡ hoặc chất liệu. Vui lòng thử lại.");
            }
        } catch {
            setLoiTaiThamChieu(true);
            toast.error("Lỗi hệ thống khi tải dữ liệu khởi tạo");
        } finally {
            setDangTaiThamChieu(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        queueMicrotask(() => loadReferenceData());
    }, [isOpen, loadReferenceData]);

    // ---------- dữ liệu suy ra ----------
    const danhMucDaChon = categories.find((c) => c.id === Number(danhMucId));
    const chatLieuDaChon = materials.find((m) => m.id === Number(chatLieuId));
    const tienToMaSanPham = danhMucDaChon ? vietTatDanhMuc(danhMucDaChon.tenDanhMuc) + ngayMa : "";

    const nhomBienThe = useMemo(() => tinhNhomBienThe(bienThe, sizes), [bienThe, sizes]);
    const thongKe = useMemo(() => thongKeBienThe(nhomBienThe, bienThe.anhMau), [nhomBienThe, bienThe.anhMau]);

    const soMauDaChon = bienThe.mauDaChon.length;
    const soKichCoDaChon = bienThe.kichCoDaChon.length;
    const danhSachLoiBienThe = useMemo(() => {
        const loi = [];
        // Bấm vào lỗi thì đưa con trỏ tới chỗ còn thiếu: ô chọn màu, hoặc nút kích cỡ khi đã có màu.
        const oChonBienThe = soMauDaChon > 0 && soKichCoDaChon === 0 ? O_NUT_KICH_CO : O_CHON_MAU;
        if (anhSanPhams.length === 0) {
            loi.push({ id: "khu-anh-san-pham", thongBao: "Vui lòng thêm ít nhất 1 ảnh sản phẩm chính." });
        }
        if (thongKe.soTao === 0) {
            loi.push({
                id: "khu-bien-the",
                oFocus: oChonBienThe,
                thongBao: "Vui lòng chọn ít nhất 1 màu sắc và 1 kích cỡ để tạo biến thể.",
            });
        } else if (thongKe.soTao > SO_BIEN_THE_TOI_DA) {
            loi.push({
                id: "khu-bien-the",
                oFocus: oChonBienThe,
                thongBao: `Mỗi sản phẩm có tối đa ${SO_BIEN_THE_TOI_DA} biến thể, hiện đang chọn ${thongKe.soTao}. Vui lòng bỏ bớt màu sắc hoặc kích cỡ.`,
            });
        }
        for (const mauSacId of thongKe.mauThieuAnh) {
            const tenMau = colors.find((c) => c.id === mauSacId)?.tenMau ?? "";
            loi.push({
                id: `nhom-mau-${mauSacId}`,
                oFocus: O_ANH_MAU,
                thongBao: `Màu ${tenMau} chưa có ảnh. Bấm ô ảnh ở dòng màu để thêm.`,
            });
        }
        return loi;
    }, [anhSanPhams.length, thongKe, colors, soMauDaChon, soKichCoDaChon]);

    // ---------- ảnh sản phẩm ----------
    const themAnhSanPham = (files) => {
        const hopLe = locTepAnhHopLe(files);
        if (hopLe.length === 0) return;
        const anhMoi = hopLe.map(taoAnhXemTruoc);
        setAnhSanPhams((prev) => [...prev, ...anhMoi]);
    };

    const xoaAnhSanPham = (anh) => {
        setAnhSanPhams((prev) => prev.filter((a) => a.id !== anh.id));
    };

    const datAnhChinh = (anh) => {
        setAnhSanPhams((prev) => [anh, ...prev.filter((a) => a.id !== anh.id)]);
    };

    // ---------- ảnh theo màu (hàm ổn định để nhóm màu đã memo không vẽ lại) ----------
    const ganAnhMau = useCallback(
        (mauSacId, file) => {
            const thongBao = kiemTraTepAnh(file);
            if (thongBao) {
                toast.error(`${thongBao}. Vui lòng chọn ảnh khác.`);
                return false;
            }
            dispatchBienThe({ type: "ganAnhMau", mauSacId, anh: taoAnhXemTruoc(file) });
            return true;
        },
        [taoAnhXemTruoc],
    );

    // Dùng lại đúng ảnh sản phẩm (cùng tệp, cùng URL), không tạo bản sao.
    const dungAnhSanPhamChoMau = useCallback((mauSacId, anhSp) => {
        dispatchBienThe({ type: "ganAnhMau", mauSacId, anh: anhSp });
    }, []);

    const goAnhMau = useCallback((mauSacId) => {
        dispatchBienThe({ type: "goAnhMau", mauSacId });
    }, []);

    // ---------- lưu ----------
    const onInvalid = () => {
        setHienLoi(true);
        toast.error("Vui lòng điền đủ thông tin bắt buộc.");
    };

    const onSubmit = async (data) => {
        setHienLoi(true);
        if (danhSachLoiBienThe.length > 0) {
            const [loiDau] = danhSachLoiBienThe;
            toast.error(loiDau.thongBao);
            henCuonToiLoi(loiDau);
            return;
        }

        try {
            const { bienTheSanPhams, anhBienThes } = taoDuLieuGuiBienThe(nhomBienThe, bienThe.anhMau, data.chatLieuId);
            const productData = {
                // Không còn ô mã vạch/giá mặc định/trạng thái: backend tự sinh mã và tính giá, trạng thái theo tồn kho.
                maVach: "",
                tenSanPham: data.tenSanPham.trim(),
                maSanPham: "",
                mucTonToiThieu: Number(data.mucTonToiThieu) || 0,
                moTa: data.moTa || "",
                danhMucId: Number(data.danhMucId),
                thuongHieuId: data.thuongHieuId ? Number(data.thuongHieuId) : null,
                giaVonMacDinh: 0,
                giaBanMacDinh: 0,
                trangThai: 1,
                bienTheSanPhams,
            };

            const formData = new FormData();
            formData.append("creating", new Blob([JSON.stringify(productData)], { type: "application/json" }));
            anhSanPhams.forEach((anh) => formData.append("anhSanPhams", anh.file));
            // Mỗi màu một tệp; biến thể trỏ tới tệp bằng viTriAnh.
            anhBienThes.forEach((file) => formData.append("anhBienThes", file));

            const res = await productService.createProduct(formData);
            if (res?.data?.status >= 400) {
                toast.error(res.data.message || "Có lỗi xảy ra");
                return;
            }

            toast.success(`Tạo sản phẩm thành công với ${bienTheSanPhams.length} biến thể.`);
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Lỗi khi tạo sản phẩm:", error);
            toast.error(getApiErrorMessage(error, "Có lỗi xảy ra khi tạo sản phẩm"));
        }
    };

    // Gọi handleSubmit trong lúc xử lý sự kiện (không gọi lúc render).
    const handleLuu = (e) => handleSubmit(onSubmit, onInvalid)(e);
    const handleKeyDown = taoXuLyPhimTat({ duocLuu: !isSubmitting && !hoiBoThayDoi, onLuu: handleLuu });

    // Submit của form trong hộp thoại con (tạo thương hiệu) vẫn nổi lên đây qua React portal: bỏ qua.
    const handleFormSubmit = (e) => {
        if (e.target !== e.currentTarget) return;
        handleLuu(e);
    };

    const loiCoBan = Object.keys(errors).length;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleCancel}>
                <DialogContent
                    onKeyDown={handleKeyDown}
                    onOpenAutoFocus={nhoNutMoForm}
                    onCloseAutoFocus={traFocusNutMoForm}
                    className="flex max-h-[94vh] flex-col gap-0 overflow-hidden border-bo-border bg-bo-canvas p-0 text-bo-foreground sm:max-w-[1180px]"
                >
                    <DialogHeader className="gap-0 border-b border-bo-border bg-white px-4 py-3.5 pr-12 text-left sm:px-5 sm:pr-12">
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                            <Package className="size-5 text-bo-primary" />
                            Thêm sản phẩm mới
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm leading-6 text-bo-muted">
                            Chọn màu sắc và kích cỡ, hệ thống tự tạo đủ biến thể. Mã sản phẩm và mã SKU được tạo khi lưu.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                        <form onSubmit={handleFormSubmit} className={LOP_FORM}>
                            {hienLoi && <TomTatLoi soLoiCoBan={loiCoBan} danhSachLoi={danhSachLoiBienThe} />}

                            <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                                <div id="khu-thong-tin" className="scroll-mt-4">
                                    <FormSection
                                        title={
                                            <span className="flex flex-wrap items-center justify-between gap-2">
                                                Thông tin cơ bản
                                                <span className="rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 py-0.5 text-xs font-medium text-bo-muted">
                                                    Mã sản phẩm:{" "}
                                                    <span className="font-mono text-bo-foreground">
                                                        {tienToMaSanPham ? `${tienToMaSanPham}?` : "tự sinh theo danh mục"}
                                                    </span>
                                                </span>
                                            </span>
                                        }
                                    >
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <TruongTenSanPham control={control} loi={errors.tenSanPham} disabled={isSubmitting} />
                                            <TruongDanhMuc
                                                control={control}
                                                loi={errors.danhMucId}
                                                disabled={isSubmitting}
                                                danhMucs={categories}
                                                dangTai={dangTaiThamChieu}
                                            />
                                            <TruongThuongHieu control={control} disabled={isSubmitting} />

                                            <div className="space-y-2">
                                                <Label htmlFor="chatLieuId">
                                                    Chất liệu <span className="text-bo-danger">*</span>
                                                </Label>
                                                <Controller
                                                    name="chatLieuId"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <Select
                                                            value={field.value == null || field.value === "" ? "" : String(field.value)}
                                                            onValueChange={(value) => field.onChange(Number(value))}
                                                            disabled={isSubmitting}
                                                        >
                                                            <SelectTrigger
                                                                id="chatLieuId"
                                                                aria-invalid={errors.chatLieuId ? true : undefined}
                                                                className={SELECT_TRIGGER_CLASS}
                                                            >
                                                                <SelectValue placeholder="Chọn chất liệu" />
                                                            </SelectTrigger>
                                                            <SelectContent position="popper" side="bottom" align="start" className={`${SELECT_CONTENT_CLASS} max-h-[300px]`}>
                                                                {materials.length === 0 ? (
                                                                    <div className="p-2 text-center text-sm text-bo-muted">
                                                                        {dangTaiThamChieu ? "Đang tải chất liệu…" : "Không có chất liệu nào đang hoạt động"}
                                                                    </div>
                                                                ) : (
                                                                    materials.map((material) => (
                                                                        <SelectItem key={`material-${material.id}`} value={material.id.toString()} className={SELECT_ITEM_CLASS}>
                                                                            {material.tenChatLieu}
                                                                        </SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                                <p className="text-xs text-bo-muted">Áp dụng cho tất cả biến thể</p>
                                                {errors.chatLieuId && <p className="text-xs text-bo-danger">{errors.chatLieuId.message}</p>}
                                            </div>

                                            <TruongMucTon control={control} loi={errors.mucTonToiThieu} disabled={isSubmitting} />
                                            <TruongMoTa control={control} disabled={isSubmitting} />
                                        </div>
                                        <p className="mt-4 text-xs text-bo-muted">
                                            Trạng thái sản phẩm tự tính theo tồn kho: sản phẩm mới là Hết hàng cho tới lần nhập kho đầu tiên.
                                        </p>
                                    </FormSection>
                                </div>

                                <KhuAnhSanPham
                                    id="khu-anh-san-pham"
                                    anhs={anhSanPhams}
                                    thieuAnh={hienLoi && anhSanPhams.length === 0}
                                    disabled={isSubmitting}
                                    onThemTep={themAnhSanPham}
                                    onXoa={xoaAnhSanPham}
                                    onDatChinh={datAnhChinh}
                                />
                            </div>

                            <div id="khu-bien-the" className="scroll-mt-4">
                                <FormSection
                                    title={
                                        <span className="flex items-center justify-between gap-2">
                                            <span>Biến thể <span className="text-bo-danger">*</span></span>
                                            <span className="rounded-full bg-bo-primary-soft px-2.5 py-0.5 text-xs font-semibold text-bo-primary">
                                                {thongKe.soTao} biến thể
                                            </span>
                                        </span>
                                    }
                                >
                                    <TrinhTaoBienThe
                                        state={bienThe}
                                        dispatch={dispatchBienThe}
                                        nhom={nhomBienThe}
                                        thongKe={thongKe}
                                        mauSacs={colors}
                                        kichCos={sizes}
                                        dangTai={dangTaiThamChieu}
                                        loiTai={loiTaiThamChieu && (colors.length === 0 || sizes.length === 0)}
                                        onThuLai={loadReferenceData}
                                        tienToMaSanPham={tienToMaSanPham}
                                        maChatLieu={chatLieuDaChon?.maChatLieu}
                                        anhSanPhams={anhSanPhams}
                                        hienLoi={hienLoi}
                                        disabled={isSubmitting}
                                        onChonAnhMau={ganAnhMau}
                                        onDungAnhSanPham={dungAnhSanPhamChoMau}
                                        onGoAnhMau={goAnhMau}
                                    />
                                </FormSection>
                            </div>
                        </form>
                    </div>

                    <DialogFooter className="border-t border-bo-border bg-white px-4 py-3 sm:px-5">
                        <div className="flex w-full flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-bo-muted" aria-live="polite">
                                {thongKe.soTao > 0 ? (
                                    <>
                                        Sẽ tạo <b className="text-bo-foreground">{thongKe.soTao}</b> biến thể ·{" "}
                                        <b className="text-bo-foreground">{thongKe.soMauCoBienThe}</b> ảnh màu
                                    </>
                                ) : (
                                    "Chưa có biến thể nào"
                                )}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                    disabled={isSubmitting}
                                    className={NUT_VIEN_CLASS}
                                >
                                    Hủy
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isSubmitting}
                                    title="Lưu (Ctrl + S)"
                                    aria-keyshortcuts="Control+S Meta+S"
                                    className="bg-bo-primary text-white hover:bg-bo-primary-hover focus-visible:ring-[3px] focus-visible:ring-bo-primary/30"
                                    onClick={handleLuu}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : thongKe.soTao > 0 ? (
                                        `Lưu sản phẩm (${thongKe.soTao} biến thể)`
                                    ) : (
                                        "Lưu sản phẩm"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <HopHoiBoThayDoi
                open={hoiBoThayDoi}
                onOpenChange={setHoiBoThayDoi}
                onBo={dongForm}
                onCloseAutoFocus={traFocusSauKhiHoi}
                tieuDe="Bỏ sản phẩm đang nhập?"
                moTa="Thông tin, ảnh và biến thể vừa nhập sẽ không được lưu."
            />
        </>
    );
}
