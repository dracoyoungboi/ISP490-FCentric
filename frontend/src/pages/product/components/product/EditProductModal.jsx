import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/productService.js";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService.js";
import * as yup from "yup";

import FormSection from "@/components/shared/FormSection";
import { flattenCategoryTree } from "@/utils/danhMucTree";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
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
    CONTROL_CLASS,
    DO_DAI_TEN_TOI_DA,
    LOP_FORM,
    NUT_VIEN_CLASS,
    O_ANH_MAU,
    O_CHON_MAU,
    O_THIEU_GIA,
    SELECT_CONTENT_CLASS,
    SELECT_ITEM_CLASS,
    SELECT_TRIGGER_CLASS,
    THOI_GIAN_DONG_HOP_THOAI,
    gopTheoId,
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
import { SO_BIEN_THE_TOI_DA, kiemTraTepAnh, sapXepKichCo } from "./logicBienThe";
import {
    coThayDoiBienThe,
    kichCoBiKhoa,
    khoiTaoSuaBienThe,
    mauBiKhoa,
    suaBienTheReducer,
    taoDuLieuGuiSua,
    thongKeSua,
    tinhNhomSua,
} from "./logicSuaBienThe";

const DO_DAI_MA_VACH_TOI_DA = 100; // cột ma_vach là varchar(100)

// Biến thể, ảnh và giá được kiểm tra riêng (xem danhSachLoi); schema chỉ lo thông tin cơ bản.
const editProductSchema = yup.object({
    tenSanPham: yup
        .string()
        .trim()
        .required("Vui lòng nhập tên sản phẩm")
        .max(DO_DAI_TEN_TOI_DA, `Tên sản phẩm tối đa ${DO_DAI_TEN_TOI_DA} ký tự`),
    danhMucId: yup.number().required("Vui lòng chọn danh mục").typeError("Vui lòng chọn danh mục"),
    thuongHieuId: yup.number().nullable(),
    maVach: yup.string().trim().max(DO_DAI_MA_VACH_TOI_DA, `Mã vạch tối đa ${DO_DAI_MA_VACH_TOI_DA} ký tự`),
    mucTonToiThieu: yup
        .number()
        .transform((value) => (isNaN(value) ? 0 : value))
        .min(0, "Vui lòng nhập mức tồn từ 0 trở lên")
        .integer("Vui lòng nhập số nguyên"),
    moTa: yup.string(),
});

const GIA_TRI_TRONG = {
    tenSanPham: "",
    danhMucId: "",
    thuongHieuId: null,
    maVach: "",
    mucTonToiThieu: 0,
    moTa: "",
};

const TRANG_THAI_SAN_PHAM = {
    1: { nhan: "Còn hàng", lop: "bg-bo-success-soft text-bo-success" },
    0: { nhan: "Hết hàng", lop: "bg-bo-warning-soft text-bo-warning" },
    2: { nhan: "Ngừng hoạt động", lop: "bg-bo-surface-subtle text-bo-muted" },
};

/** Ảnh đang lưu trên máy chủ; id dạng "cu-…" để không trùng ảnh mới ("moi-…"). */
const anhTuMayChu = (anh) => ({ id: `cu-${anh.id}`, anhId: anh.id, url: anh.tepTin?.duongDan || anh.urlAnh });
const chuKyAnh = (anhs) => anhs.map((anh) => anh.id).join(",");

export default function EditProductModal({ isOpen, onClose, onSuccess, productId }) {
    const [categories, setCategories] = useState([]);
    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [dangTaiThamChieu, setDangTaiThamChieu] = useState(false);
    const [loiTaiThamChieu, setLoiTaiThamChieu] = useState(false);
    // Chi tiết sản phẩm lúc mở form: mốc để biết đã đổi gì và để hiện các thông tin chỉ xem.
    const [sanPham, setSanPham] = useState(null);
    const [anhSanPhams, setAnhSanPhams] = useState([]);
    const [chuKyAnhGoc, setChuKyAnhGoc] = useState("");
    const [bienThe, dispatchBienThe] = useReducer(suaBienTheReducer, undefined, () => khoiTaoSuaBienThe([]));
    // Chỉ dùng khi sản phẩm có nhiều chất liệu (không có chất liệu chung cho biến thể mới)
    const [chatLieuMoiId, setChatLieuMoiId] = useState(null);
    // Chỉ tô đỏ lỗi ảnh/biến thể sau lần bấm Lưu đầu tiên
    const [hienLoi, setHienLoi] = useState(false);
    // Bỏ kết quả của lần tải cũ (đóng form hoặc mở sản phẩm khác khi chưa tải xong)
    const lanTaiRef = useRef(0);
    // Trang danh sách truyền onClose dạng hàm mới mỗi lần vẽ: giữ qua ref để không tải lại sản phẩm khi đang sửa.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm({
        resolver: yupResolver(editProductSchema),
        defaultValues: GIA_TRI_TRONG,
    });

    // ---------- dữ liệu suy ra ----------
    const bienTheGoc = useMemo(() => sanPham?.bienTheSanPhams ?? [], [sanPham]);
    // Màu/kích cỡ/chất liệu đang dùng có thể đã ngừng hoạt động (không có trong danh sách): vẫn phải hiện.
    const mauSacs = useMemo(() => gopTheoId(colors, bienTheGoc.map((bt) => bt.mauSac)), [colors, bienTheGoc]);
    const kichCos = useMemo(() => sapXepKichCo(gopTheoId(sizes, bienTheGoc.map((bt) => bt.size))), [sizes, bienTheGoc]);
    const chatLieuDangDung = useMemo(() => gopTheoId([], bienTheGoc.map((bt) => bt.chatLieu)), [bienTheGoc]);
    const danhMucs = useMemo(() => {
        const danhMuc = sanPham?.danhMuc;
        if (!danhMuc || categories.length === 0 || categories.some((c) => c.id === danhMuc.id)) return categories;
        return [...categories, { id: danhMuc.id, displayTitle: `${danhMuc.tenDanhMuc} (ngừng hoạt động)`, level: 1 }];
    }, [categories, sanPham]);

    const { bienTheCu, thuTuCu } = bienThe;
    const mauKhoa = useMemo(() => mauBiKhoa({ bienTheCu, thuTuCu }), [bienTheCu, thuTuCu]);
    const kichCoKhoa = useMemo(() => kichCoBiKhoa({ bienTheCu, thuTuCu }), [bienTheCu, thuTuCu]);
    const nhomBienThe = useMemo(() => tinhNhomSua(bienThe, kichCos), [bienThe, kichCos]);
    const thongKe = useMemo(() => thongKeSua(nhomBienThe, bienThe), [nhomBienThe, bienThe]);

    const chatLieuChung = chatLieuDangDung.length === 1 ? chatLieuDangDung[0] : null;
    const canChonChatLieu = !chatLieuChung && thongKe.soTao > 0;
    const chatLieuMoi = chatLieuChung ?? materials.find((m) => m.id === chatLieuMoiId) ?? null;

    // Màu chỉ chọn lại được ảnh sản phẩm vừa thêm (ảnh đang lưu không gửi lại dạng tệp).
    const anhSanPhamMoi = useMemo(() => anhSanPhams.filter((anh) => anh.file), [anhSanPhams]);
    const anhDangDung = useMemo(() => [...anhSanPhams, ...Object.values(bienThe.anhMau)], [anhSanPhams, bienThe.anhMau]);
    const taoAnhXemTruoc = useAnhXemTruoc(anhDangDung);

    const anhDaDoi = sanPham != null && chuKyAnh(anhSanPhams) !== chuKyAnhGoc;
    const bienTheDaDoi = coThayDoiBienThe(bienThe, thongKe);
    const coThayDoi = sanPham != null && (isDirty || anhDaDoi || bienTheDaDoi);

    const { hoiBoThayDoi, setHoiBoThayDoi, dongForm, handleCancel, nhoNutMoForm, traFocusNutMoForm, traFocusSauKhiHoi } =
        useHoiTruocKhiBo({ coThayDoi, dangLuu: isSubmitting, onClose });
    useChanRoiTrang(isOpen, coThayDoi);
    useChanThaTepNgoaiKhung(isOpen);
    const henCuonToiLoi = useCuonToiLoiSauKhiLuu(isSubmitting);

    // ---------- mở / đóng form ----------
    const datLaiForm = useCallback(() => {
        lanTaiRef.current += 1;
        reset(GIA_TRI_TRONG);
        setSanPham(null);
        setAnhSanPhams([]);
        setChuKyAnhGoc("");
        dispatchBienThe({ type: "datLai" });
        setChatLieuMoiId(null);
        setHienLoi(false);
        setHoiBoThayDoi(false);
    }, [reset, setHoiBoThayDoi]);

    const taiSanPham = useCallback(
        async (id) => {
            const lan = ++lanTaiRef.current;
            try {
                const res = await productService.getProductById(id);
                if (lan !== lanTaiRef.current) return;
                const sp = res?.data?.data;
                if (res?.data?.status !== 200 || !sp) {
                    throw new Error(res?.data?.message || "Không thể tải thông tin sản phẩm");
                }
                reset({
                    tenSanPham: sp.tenSanPham || "",
                    danhMucId: sp.danhMuc?.id ?? "",
                    thuongHieuId: sp.thuongHieu?.id ?? null,
                    maVach: sp.maVach || "",
                    mucTonToiThieu: sp.mucTonToiThieu ?? 0,
                    moTa: sp.moTa || "",
                });
                // Ảnh chính lên đầu, các ảnh khác giữ nguyên thứ tự
                const anhs = [...(sp.anhQuanAos || [])]
                    .sort((a, b) => (b.anhChinh === 1 ? 1 : 0) - (a.anhChinh === 1 ? 1 : 0))
                    .map(anhTuMayChu);
                setAnhSanPhams(anhs);
                setChuKyAnhGoc(chuKyAnh(anhs));
                dispatchBienThe({ type: "khoiTaoSua", dsBienThe: sp.bienTheSanPhams || [] });
                setSanPham(sp);
            } catch (error) {
                if (lan !== lanTaiRef.current) return;
                console.error("Lỗi khi tải chi tiết sản phẩm:", error);
                toast.error(getApiErrorMessage(error, error?.message || "Không thể tải thông tin sản phẩm"));
                onCloseRef.current();
            }
        },
        [reset],
    );

    // Mở form: bắt đầu sạch rồi tải sản phẩm. Đóng form: chờ hiệu ứng đóng xong mới xóa dữ liệu.
    useEffect(() => {
        if (isOpen) {
            if (!productId) return undefined;
            // Hoãn qua microtask để tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect).
            queueMicrotask(() => {
                datLaiForm();
                taiSanPham(productId);
            });
            return undefined;
        }
        const hen = setTimeout(datLaiForm, THOI_GIAN_DONG_HOP_THOAI);
        return () => clearTimeout(hen);
    }, [isOpen, productId, datLaiForm, taiSanPham]);

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

    // ---------- lỗi trước khi lưu ----------
    const danhSachLoi = useMemo(() => {
        const loi = [];
        if (anhSanPhams.length === 0) {
            loi.push({ id: "khu-anh-san-pham", thongBao: "Vui lòng giữ ít nhất 1 ảnh sản phẩm chính." });
        }
        if (canChonChatLieu && !chatLieuMoi) {
            loi.push({ id: "khu-thong-tin", oFocus: "#chatLieuMoiId", thongBao: "Vui lòng chọn chất liệu cho biến thể mới." });
        }
        if (thongKe.soSauLuu > SO_BIEN_THE_TOI_DA) {
            loi.push({
                id: "khu-bien-the",
                oFocus: O_CHON_MAU,
                thongBao: `Mỗi sản phẩm có tối đa ${SO_BIEN_THE_TOI_DA} biến thể, sau khi lưu sẽ có ${thongKe.soSauLuu}. Vui lòng bỏ bớt màu sắc hoặc kích cỡ mới.`,
            });
        }
        if (thongKe.soGiaTrong > 0) {
            loi.push({
                id: "khu-bien-the",
                oFocus: O_THIEU_GIA,
                thongBao: `Còn ${thongKe.soGiaTrong} biến thể đang có chưa có giá. Vui lòng nhập giá vốn và giá bán.`,
            });
        }
        for (const mauSacId of thongKe.mauThieuAnh) {
            const tenMau = mauSacs.find((m) => m.id === mauSacId)?.tenMau ?? "";
            loi.push({
                id: `nhom-mau-${mauSacId}`,
                oFocus: O_ANH_MAU,
                thongBao: `Màu ${tenMau} chưa có ảnh. Bấm ô ảnh ở dòng màu để thêm.`,
            });
        }
        return loi;
    }, [anhSanPhams.length, canChonChatLieu, chatLieuMoi, thongKe, mauSacs]);

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
        if (danhSachLoi.length > 0) {
            const [loiDau] = danhSachLoi;
            toast.error(loiDau.thongBao);
            henCuonToiLoi(loiDau);
            return;
        }
        if (!coThayDoi) {
            toast.info("Chưa có thay đổi nào để lưu.");
            return;
        }

        const thongTin = {
            tenSanPham: data.tenSanPham.trim(),
            danhMucId: Number(data.danhMucId),
            thuongHieuId: data.thuongHieuId ?? null,
            // Chỉ gửi cờ đổi thương hiệu khi thật sự đổi, để không gỡ nhầm liên kết đang có.
            capNhatThuongHieu: (data.thuongHieuId ?? null) !== (sanPham.thuongHieu?.id ?? null),
            moTa: data.moTa || "",
            maVach: data.maVach?.trim() || "",
            mucTonToiThieu: Number(data.mucTonToiThieu) || 0,
        };

        try {
            let res;
            if (!anhDaDoi && !bienTheDaDoi) {
                // Chỉ đổi thông tin cơ bản: PATCH gọn, không tính lại giá, không đụng ảnh và biến thể.
                res = await productService.updateProductBasicInfo(productId, thongTin);
            } else {
                // Sản phẩm 1 chất liệu: để trống, backend tự dùng chất liệu đang có cho biến thể mới.
                const { bienTheSanPhams, anhBienThes } = taoDuLieuGuiSua(
                    bienThe,
                    nhomBienThe,
                    chatLieuChung ? null : chatLieuMoiId,
                );
                const anhMoi = anhSanPhams.filter((anh) => anh.file);
                const updating = {
                    id: productId,
                    maSanPham: sanPham.maSanPham,
                    ...thongTin,
                    // Giá mặc định và trạng thái sản phẩm do hệ thống tự tính lại khi lưu: gửi lại giá trị đang có.
                    giaVonMacDinh: sanPham.giaVonMacDinh ?? 0,
                    giaBanMacDinh: sanPham.giaBanMacDinh ?? 0,
                    trangThai: sanPham.trangThai ?? 1,
                    imageUpdated: anhDaDoi,
                    // Thứ tự ảnh sau khi sửa (ô đầu là ảnh chính): ảnh giữ lại gửi id, ảnh mới gửi vị trí tệp.
                    anhSanPhamSapXep: anhDaDoi
                        ? anhSanPhams.map((anh) => (anh.file ? { viTriTep: anhMoi.indexOf(anh) } : { id: anh.anhId }))
                        : null,
                    bienTheSanPhams,
                };

                const formData = new FormData();
                formData.append("updating", new Blob([JSON.stringify(updating)], { type: "application/json" }));
                anhMoi.forEach((anh) => formData.append("anhSanPhams", anh.file));
                // Mỗi màu đổi ảnh một tệp; biến thể trỏ tới tệp bằng viTriAnh.
                anhBienThes.forEach((file) => formData.append("anhBienThes", file));
                res = await productService.updateProduct(productId, formData);
            }

            if (res?.data?.status >= 400) {
                toast.error(res.data.message || "Có lỗi xảy ra");
                return;
            }
            toast.success(
                thongKe.soTao > 0
                    ? `Cập nhật sản phẩm thành công, thêm ${thongKe.soTao} biến thể mới.`
                    : "Cập nhật sản phẩm thành công.",
            );
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Lỗi khi cập nhật sản phẩm:", error);
            toast.error(getApiErrorMessage(error, "Có lỗi xảy ra khi cập nhật sản phẩm"));
        }
    };

    // Gọi handleSubmit trong lúc xử lý sự kiện (không gọi lúc render).
    const handleLuu = (e) => handleSubmit(onSubmit, onInvalid)(e);
    const duocLuu = sanPham != null && coThayDoi && !isSubmitting;
    const handleKeyDown = taoXuLyPhimTat({ duocLuu: duocLuu && !hoiBoThayDoi, onLuu: handleLuu });

    // Submit của form trong hộp thoại con (tạo thương hiệu) vẫn nổi lên đây qua React portal: bỏ qua.
    const handleFormSubmit = (e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (duocLuu) handleLuu(e);
    };

    const loiCoBan = Object.keys(errors).length;
    const trangThai = TRANG_THAI_SAN_PHAM[sanPham?.trangThai];

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
                            Chỉnh sửa sản phẩm
                        </DialogTitle>
                        <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 text-bo-muted">
                            {sanPham ? (
                                <>
                                    <span className="inline-flex items-center gap-1.5">
                                        Trạng thái:
                                        <span className={cn("rounded-full px-2 py-px text-xs font-semibold", trangThai?.lop)}>
                                            {trangThai?.nhan ?? "Không rõ"}
                                        </span>
                                    </span>
                                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                                    <span>
                                        Giá mặc định: vốn <b className="font-medium text-bo-foreground">{formatCurrency(sanPham.giaVonMacDinh)}</b>,
                                        bán <b className="font-medium text-bo-foreground">{formatCurrency(sanPham.giaBanMacDinh)}</b>
                                    </span>
                                    <span aria-hidden="true" className="hidden md:inline">·</span>
                                    <span className="hidden md:inline">Hệ thống tự tính theo tồn kho</span>
                                </>
                            ) : (
                                "Đang tải thông tin sản phẩm…"
                            )}
                    </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                        {!sanPham ? (
                            <div className="flex items-center justify-center gap-3 py-16 text-sm text-bo-muted" role="status">
                                <Loader2 className="size-6 animate-spin text-bo-primary" aria-hidden="true" />
                                Đang tải thông tin sản phẩm…
                            </div>
                        ) : (
                            <form onSubmit={handleFormSubmit} className={LOP_FORM}>
                                {hienLoi && <TomTatLoi soLoiCoBan={loiCoBan} danhSachLoi={danhSachLoi} />}

                                <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                                    <div id="khu-thong-tin" className="scroll-mt-4">
                                        <FormSection
                                            title={
                                                <span className="flex flex-wrap items-center justify-between gap-2">
                                                    Thông tin cơ bản
                                                    <span className="rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 py-0.5 text-xs font-medium text-bo-muted">
                                                        Mã sản phẩm:{" "}
                                                        <span className="select-all font-mono text-bo-foreground">{sanPham.maSanPham}</span>
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
                                                    danhMucs={danhMucs}
                                                    dangTai={dangTaiThamChieu}
                                                />
                                                <TruongThuongHieu
                                                    control={control}
                                                    disabled={isSubmitting}
                                                    thuongHieuHienTai={sanPham.thuongHieu ?? null}
                                                />
                                                <TruongMucTon control={control} loi={errors.mucTonToiThieu} disabled={isSubmitting} />

                                                <div className="space-y-2">
                                                    <Label htmlFor="maVach">Mã vạch</Label>
                                                    <Controller
                                                        name="maVach"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Input
                                                                {...field}
                                                                id="maVach"
                                                                placeholder="VD: 8935049501234"
                                                                maxLength={DO_DAI_MA_VACH_TOI_DA}
                                                                autoComplete="off"
                                                                disabled={isSubmitting}
                                                                aria-invalid={errors.maVach ? true : undefined}
                                                                className={CONTROL_CLASS}
                                                            />
                                                        )}
                                                    />
                                                    {errors.maVach && <p className="text-xs text-bo-danger">{errors.maVach.message}</p>}
                                                </div>

                                                {canChonChatLieu && (
                                                    <div className="space-y-2">
                                                        <Label htmlFor="chatLieuMoiId">
                                                            Chất liệu cho biến thể mới <span className="text-bo-danger">*</span>
                                                        </Label>
                                                        <Select
                                                            value={chatLieuMoiId == null ? "" : String(chatLieuMoiId)}
                                                            onValueChange={(value) => value !== "" && setChatLieuMoiId(Number(value))}
                                                            disabled={isSubmitting}
                                                        >
                                                            <SelectTrigger
                                                                id="chatLieuMoiId"
                                                                aria-invalid={hienLoi && !chatLieuMoi ? true : undefined}
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
                                                                        <SelectItem key={material.id} value={String(material.id)} className={SELECT_ITEM_CLASS}>
                                                                            {material.tenChatLieu}
                                                                        </SelectItem>
                                                                    ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                <TruongMoTa control={control} disabled={isSubmitting} />
                                            </div>
                                            <p className="mt-4 text-xs text-bo-muted">
                                                Chất liệu:{" "}
                                                <span className="font-medium text-bo-foreground">
                                                    {chatLieuDangDung.map((cl) => cl.tenChatLieu).join(", ") || "Chưa có"}
                                                </span>
                                                {chatLieuDangDung.length > 1
                                                    ? " (mỗi biến thể một chất liệu)"
                                                    : ", cố định sau khi tạo và áp dụng cho mọi biến thể."}
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
                                                    {thongKe.soSauLuu} biến thể
                                                </span>
                                            </span>
                                        }
                                    >
                                        <TrinhTaoBienThe
                                            cheDo="sua"
                                            state={bienThe}
                                            dispatch={dispatchBienThe}
                                            nhom={nhomBienThe}
                                            thongKe={thongKe}
                                            mauSacs={mauSacs}
                                            kichCos={kichCos}
                                            mauKhoa={mauKhoa}
                                            kichCoKhoa={kichCoKhoa}
                                            anhMauCu={bienThe.anhMauCu}
                                            dangTai={dangTaiThamChieu}
                                            loiTai={loiTaiThamChieu && (mauSacs.length === 0 || kichCos.length === 0)}
                                            onThuLai={loadReferenceData}
                                            tienToMaSanPham={sanPham.maSanPham}
                                            maChatLieu={chatLieuMoi?.maChatLieu}
                                            anhSanPhams={anhSanPhamMoi}
                                            hienLoi={hienLoi}
                                            disabled={isSubmitting}
                                            onChonAnhMau={ganAnhMau}
                                            onDungAnhSanPham={dungAnhSanPhamChoMau}
                                            onGoAnhMau={goAnhMau}
                                        />
                                    </FormSection>
                                </div>
                            </form>
                        )}
                    </div>

                    <DialogFooter className="border-t border-bo-border bg-white px-4 py-3 sm:px-5">
                        <div className="flex w-full flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-bo-muted" aria-live="polite">
                                {!sanPham ? null : !coThayDoi ? (
                                    "Chưa có thay đổi"
                                ) : thongKe.soTao > 0 ? (
                                    <>
                                        Sẽ thêm <b className="text-bo-foreground">{thongKe.soTao}</b> biến thể mới, tổng{" "}
                                        <b className="text-bo-foreground">{thongKe.soSauLuu}</b> biến thể
                                    </>
                                ) : (
                                    "Có thay đổi chưa lưu"
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
                                    disabled={!duocLuu}
                                    title={sanPham && !coThayDoi ? "Chưa có thay đổi để lưu" : "Lưu (Ctrl + S)"}
                                    aria-keyshortcuts="Control+S Meta+S"
                                    className="bg-bo-primary text-white hover:bg-bo-primary-hover focus-visible:ring-[3px] focus-visible:ring-bo-primary/30"
                                    onClick={handleLuu}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        "Lưu thay đổi"
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
                tieuDe="Bỏ các thay đổi chưa lưu?"
                moTa="Thay đổi về thông tin, ảnh và biến thể của sản phẩm sẽ không được lưu."
            />
        </>
    );
}
