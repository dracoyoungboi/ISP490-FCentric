import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowLeftRight,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    ImagePlus,
    Lock,
    RefreshCcw,
    Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import ChonMauSac, { ChamMau } from "./ChonMauSac";
import DoiThuocTinhBienThe from "./DoiThuocTinhBienThe";
import { VIEN_FOCUS } from "./kieuForm";
import { SO_BIEN_THE_TOI_DA, demDongApGiaChung, hienTien, viTriSauChuSo, xemTruocSku, xuLyNhapTien } from "./logicBienThe";

const NHAN_NHOM_KICH_CO = { chu: "Chữ", so: "Số", khac: "Khác" };
const KHONG_KHOA = [];
const KHONG_CO_ANH_CU = {};
const GIA_KHOA = "Tính theo lô nhập";
const GIA_BAN_KHOA = "Đổi ở màn Giá bán & tem mã vạch";

// Vòng focus theo màu chung (Button/Checkbox dựng sẵn mặc định lấy màu chữ làm vòng focus, trông đậm và lệch tông).
const CHECKBOX_CLASS =
    "border-bo-border bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/25";
const NUT_PHU_CLASS = `h-7 px-2 text-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary ${VIEN_FOCUS}`;
const NUT_VIEN_CLASS = `border-bo-border bg-white text-bo-foreground hover:bg-bo-primary-soft hover:text-bo-primary ${VIEN_FOCUS}`;
// Nút dạng chữ (Chọn tất cả, Bỏ chọn…): nhẹ, không viền, để hàng thuộc tính gọn.
const NUT_CHU_CLASS =
    "rounded-sm text-[13px] font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:pointer-events-none disabled:opacity-40";
const O_GIA_CLASS =
    "h-8 w-full rounded-md border border-bo-border bg-white px-2 text-right text-sm tabular-nums text-bo-foreground placeholder:text-bo-muted/70 focus-visible:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle disabled:text-bo-muted";

/** Một hàng thuộc tính: nhãn ở cột trái (màn hình hẹp thì nằm trên), nội dung và dòng chú thích/lỗi ở cột phải. */
function DongThuocTinh({ nhan, loi, chuThich, children }) {
    return (
        <div className="grid gap-x-4 gap-y-1.5 md:grid-cols-[110px_minmax(0,1fr)]">
            <p className="text-sm font-medium text-bo-foreground md:pt-2">
                {nhan} <span className="text-bo-danger">*</span>
            </p>
            <div className="min-w-0 space-y-1.5">
                {children}
                {loi ? <p className="text-xs text-bo-danger">{loi}</p> : chuThich}
            </div>
        </div>
    );
}

/** Nút kích cỡ bật/tắt. `khoa`: kích cỡ đang có biến thể (form Chỉnh sửa), luôn bật và không tắt được. */
function NutKichCo({ dangChon, khoa, onClick, disabled, children }) {
    return (
        <button
            type="button"
            aria-pressed={dangChon}
            aria-disabled={khoa || undefined}
            title={khoa ? "Kích cỡ đang có biến thể nên không bỏ chọn được" : undefined}
            onClick={khoa ? undefined : onClick}
            disabled={disabled}
            className={cn(
                "h-9 min-w-[52px] rounded-md border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bo-primary/25 disabled:opacity-50",
                dangChon
                    ? "border-bo-primary bg-bo-primary-soft font-semibold text-bo-primary"
                    : "border-bo-border bg-white font-medium text-bo-foreground hover:border-bo-muted",
                khoa && "cursor-default border-bo-primary/40",
            )}
        >
            {children}
        </button>
    );
}

/**
 * Ô nhập tiền luôn hiện dạng 1.250.000; khi gõ, con trỏ giữ đúng vị trí theo số chữ số đứng trước nó.
 * Không đổi giá trị hiển thị lúc focus, nên chọn hết rồi gõ đè vẫn thay được cả ô.
 * Enter: gọi onEnter nếu có, nếu không thì chuyển xuống ô cùng cột ở dòng dưới (giống bảng tính).
 */
function OTien({ value, onChange, onEnter, cot, className, ...props }) {
    const handleChange = (e) => {
        const o = e.target;
        const { giaTri, soChuSoTruocConTro } = xuLyNhapTien({
            chuoiMoi: o.value,
            conTro: o.selectionStart,
            kieuNhap: e.nativeEvent?.inputType,
            giaTriCu: value,
        });
        onChange(giaTri);
        requestAnimationFrame(() => {
            if (document.activeElement !== o) return;
            const viTri = viTriSauChuSo(hienTien(giaTri), soChuSoTruocConTro);
            o.setSelectionRange(viTri, viTri);
        });
    };
    const handleKeyDown = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (onEnter) {
            onEnter();
            return;
        }
        if (!cot) return;
        const bang = e.currentTarget.closest("table");
        const cacO = [...(bang?.querySelectorAll(`input[data-cot="${cot}"]:not(:disabled)`) ?? [])];
        cacO[cacO.indexOf(e.currentTarget) + 1]?.focus();
    };
    return (
        <input
            {...props}
            data-cot={cot}
            inputMode="numeric"
            autoComplete="off"
            value={hienTien(value)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={cn(O_GIA_CLASS, className)}
        />
    );
}

/**
 * Giá chỉ xem (vẫn chọn và sao chép được): giá vốn biến thể còn tồn do hệ thống tính theo lô nhập; giá bán biến thể đã
 * lưu không sửa ở đây khi còn tồn hoặc người dùng không phải quản trị viên (`ghiChu` nói chỗ đổi).
 */
function GiaKhoa({ value, nhan, ghiChu = GIA_KHOA }) {
    return (
        <div className="relative" title={ghiChu}>
            <Lock className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
            <input
                readOnly
                value={hienTien(value)}
                aria-label={`${nhan} (${ghiChu.toLowerCase()})`}
                className={cn(O_GIA_CLASS, "cursor-default bg-bo-surface-subtle pl-6 text-bo-muted")}
            />
        </div>
    );
}

/** Nút bật/tắt bán của biến thể đã lưu (biến thể đã lưu không xóa được, chỉ tạm ngừng). */
function NutTrangThai({ dangBan, ten, disabled, onClick }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={dangBan}
            aria-label={`Đang bán ${ten}`}
            title={dangBan ? "Bấm để tạm ngừng bán biến thể này" : "Bấm để bán lại biến thể này"}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary disabled:opacity-50",
                dangBan
                    ? "border-bo-success/30 bg-bo-success-soft text-bo-success hover:border-bo-success/60"
                    : "border-bo-border bg-bo-surface-subtle text-bo-muted hover:border-bo-muted",
            )}
        >
            <span className={cn("size-1.5 rounded-full", dangBan ? "bg-bo-success" : "bg-bo-muted")} aria-hidden="true" />
            {dangBan ? "Đang bán" : "Tạm ngừng"}
        </button>
    );
}

/**
 * Ô ảnh của một màu. `anh`: ảnh vừa chọn (tệp); `anhCu`: URL ảnh màu đang lưu (form Chỉnh sửa).
 * Chọn ảnh mới thì thay cho mọi biến thể của màu; "Dùng lại ảnh cũ" bỏ ảnh vừa chọn.
 */
function OAnhMau({ mau, anh, anhCu, thieuAnh, anhSanPhams, disabled, onChonTep, onDungAnhSanPham, onGoAnh }) {
    const [mo, setMo] = useState(false);
    const inputRef = useRef(null);
    const urlHienThi = anh?.url ?? anhCu;
    return (
        <Popover open={mo} onOpenChange={setMo}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-o-anh-mau=""
                    disabled={disabled}
                    aria-label={urlHienThi ? `Đổi ảnh màu ${mau.tenMau}` : `Thêm ảnh màu ${mau.tenMau}`}
                    title={urlHienThi ? "Đổi ảnh cho cả màu" : "Thêm ảnh cho cả màu"}
                    className={cn(
                        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
                        urlHienThi ? "border-bo-border" : "border-dashed border-bo-muted/60",
                        anh && anhCu && "border-bo-primary ring-1 ring-bo-primary",
                        thieuAnh && "border-bo-danger text-bo-danger",
                    )}
                >
                    {urlHienThi ? (
                        <img src={urlHienThi} alt="" className="size-full object-cover" />
                    ) : (
                        <ImagePlus className="size-4" aria-hidden="true" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3 border-bo-border bg-white p-3">
                <p className="text-sm font-medium text-bo-foreground">Ảnh màu {mau.tenMau}</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                        const tep = e.target.files?.[0];
                        e.target.value = "";
                        if (tep && onChonTep(tep)) setMo(false);
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full", NUT_VIEN_CLASS)}
                    onClick={() => inputRef.current?.click()}
                >
                    <Upload className="size-4" aria-hidden="true" />
                    {urlHienThi ? "Tải ảnh khác" : "Tải ảnh lên"}
                </Button>
                {anhSanPhams.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs text-bo-muted">
                            {anhCu ? "Hoặc chọn từ ảnh sản phẩm vừa thêm" : "Hoặc chọn từ ảnh sản phẩm chính"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {anhSanPhams.map((anhSp, i) => (
                                <button
                                    key={anhSp.id}
                                    type="button"
                                    aria-label={`Dùng ảnh sản phẩm ${i + 1}`}
                                    onClick={() => {
                                        onDungAnhSanPham(anhSp);
                                        setMo(false);
                                    }}
                                    className="size-12 overflow-hidden rounded-md border border-bo-border hover:ring-2 hover:ring-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary"
                                >
                                    <img src={anhSp.url} alt="" className="size-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-bo-border pt-2">
                    <p className="text-xs text-bo-muted">Dùng cho mọi kích cỡ của màu này. Ảnh tối đa 10 MB.</p>
                    {anh && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger focus-visible:ring-[3px] focus-visible:ring-bo-danger/15"
                            onClick={() => {
                                onGoAnh();
                                setMo(false);
                            }}
                        >
                            {anhCu ? "Dùng lại ảnh cũ" : "Gỡ ảnh"}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Trình tạo biến thể: chọn nhiều màu sắc + kích cỡ, hệ thống sinh bảng tổ hợp nhóm theo màu.
 * Trạng thái do form cha giữ (useReducer) để form cha dựng dữ liệu gửi đi.
 *
 * cheDo="sua" (form Chỉnh sửa, dùng suaBienTheReducer): bảng gồm biến thể đã lưu và tổ hợp mới còn thiếu.
 * Màu/kích cỡ đang có biến thể bị khóa; biến thể đã lưu có nút Đang bán/Tạm ngừng, đổi màu/kích cỡ khi
 * chưa phát sinh giao dịch; giá của biến thể còn tồn kho chỉ xem vì được tính theo lô nhập.
 */
export default function TrinhTaoBienThe({
    cheDo = "them",
    state,
    dispatch,
    nhom,
    thongKe,
    mauSacs,
    kichCos,
    mauKhoa = KHONG_KHOA,
    kichCoKhoa = KHONG_KHOA,
    anhMauCu = KHONG_CO_ANH_CU,
    dangTai,
    loiTai,
    onThuLai,
    tienToMaSanPham,
    maChatLieu,
    anhSanPhams,
    hienLoi,
    disabled,
    onChonAnhMau,
    onDungAnhSanPham,
    onGoAnhMau,
}) {
    const laSua = cheDo === "sua";
    const [giaVonChung, setGiaVonChung] = useState("");
    const [giaBanChung, setGiaBanChung] = useState("");
    const [thongBaoApDung, setThongBaoApDung] = useState(null);
    // Hộp đổi màu/kích cỡ: lan tăng mỗi lần mở để hộp luôn bắt đầu từ thuộc tính hiện tại.
    const [doi, setDoi] = useState({ id: null, mo: false, lan: 0 });
    const moHopDoi = useCallback((id) => setDoi((d) => ({ id, mo: true, lan: d.lan + 1 })), []);

    const mauTheoId = useMemo(() => new Map(mauSacs.map((m) => [m.id, m])), [mauSacs]);
    const sizeTheoId = useMemo(() => new Map(kichCos.map((s) => [s.id, s])), [kichCos]);
    const tapKichCo = useMemo(() => new Set(state.kichCoDaChon), [state.kichCoDaChon]);
    const tapKichCoKhoa = useMemo(() => new Set(kichCoKhoa), [kichCoKhoa]);
    // Kích cỡ chia nhóm theo loại (chữ, số…), giữ thứ tự chuẩn trong từng nhóm.
    const nhomKichCo = useMemo(() => {
        const theoLoai = new Map();
        for (const size of kichCos) {
            const loai = size.loaiSize || "khac";
            if (!theoLoai.has(loai)) theoLoai.set(loai, []);
            theoLoai.get(loai).push(size);
        }
        return [...theoLoai].map(([loai, ds]) => ({ loai, ds }));
    }, [kichCos]);
    const nhieuNhomKichCo = nhomKichCo.length > 1;

    // Form Chỉnh sửa giới hạn theo tổng số biến thể sau khi lưu (đang có + thêm mới).
    const soBienTheSauLuu = laSua ? thongKe.soSauLuu : thongKe.soTao;
    const vuotGioiHan = soBienTheSauLuu > SO_BIEN_THE_TOI_DA;
    const choKichCo = dangTai && kichCos.length === 0;
    const daThuGonHet = nhom.length > 0 && nhom.every((n) => state.mauThuGon.includes(n.mauSacId));

    const doiGiaChung = (setter) => (giaTri) => {
        setter(giaTri);
        setThongBaoApDung(null);
    };

    const apDungGiaChung = () => {
        if (giaVonChung === "" && giaBanChung === "") {
            setThongBaoApDung({ loi: true, noiDung: "Nhập giá vốn hoặc giá bán trước khi áp dụng." });
            return;
        }
        dispatch({ type: "apDungGiaChung", giaVon: giaVonChung, giaBan: giaBanChung });
        const { soApDung, soKhoaGia } = demDongApGiaChung(nhom);
        const ketQua =
            soApDung > 0
                ? `Đã áp dụng cho ${soApDung} dòng.`
                : soKhoaGia > 0
                  ? "Không có dòng nào đổi giá."
                  : "Chưa có dòng nào đang chọn. Giá sẽ dùng khi bạn tích lại.";
        setThongBaoApDung({
            loi: false,
            noiDung: ketQua + (soKhoaGia > 0 ? ` Giữ nguyên giá ${soKhoaGia} biến thể còn tồn kho.` : ""),
        });
    };

    // Form cha chỉ báo loiTai khi thiếu hẳn danh sách màu sắc hoặc kích cỡ (không tạo được biến thể nào).
    if (loiTai) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-bo-border bg-bo-surface-subtle px-4 py-8 text-center">
                <p className="text-sm text-bo-foreground">Không tải được danh sách màu sắc và kích cỡ.</p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onThuLai}
                    className={NUT_VIEN_CLASS}
                >
                    <RefreshCcw className="size-4" aria-hidden="true" />
                    Thử lại
                </Button>
            </div>
        );
    }

    const soMauBoDuoc = state.mauDaChon.length - mauKhoa.length;

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <DongThuocTinh
                    nhan="Màu sắc"
                    loi={hienLoi && state.mauDaChon.length === 0 ? "Vui lòng chọn ít nhất 1 màu sắc" : null}
                    chuThich={
                        state.mauDaChon.length > 0 && (
                            <div className="flex items-center justify-between gap-3 text-xs text-bo-muted">
                                <span>
                                    Đã chọn {state.mauDaChon.length}/{mauSacs.length} màu
                                    {mauKhoa.length > 0 && ` · ${mauKhoa.length} màu đang có biến thể, không bỏ được`}
                                </span>
                                {soMauBoDuoc > 0 && (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => dispatch({ type: "boChonTatCaMau" })}
                                        className={cn(NUT_CHU_CLASS, "shrink-0 text-xs text-bo-muted hover:text-bo-foreground")}
                                    >
                                        {laSua ? "Bỏ các màu mới" : "Bỏ chọn tất cả"}
                                    </button>
                                )}
                            </div>
                        )
                    }
                >
                    <ChonMauSac
                        mauSacs={mauSacs}
                        daChon={state.mauDaChon}
                        khoa={mauKhoa}
                        dangTai={dangTai}
                        coLoi={hienLoi && state.mauDaChon.length === 0}
                        disabled={disabled}
                        onBatTat={(mauSacId) => dispatch({ type: "batTatMau", mauSacId })}
                        onThem={(mauSacIds) => dispatch({ type: "themMau", mauSacIds })}
                    />
                </DongThuocTinh>

                <DongThuocTinh
                    nhan="Kích cỡ"
                    loi={hienLoi && state.kichCoDaChon.length === 0 ? "Vui lòng chọn ít nhất 1 kích cỡ" : null}
                    chuThich={
                        kichCoKhoa.length > 0 && (
                            <p className="text-xs text-bo-muted">Kích cỡ đang có biến thể luôn được giữ. Chọn thêm kích cỡ để tạo biến thể mới.</p>
                        )
                    }
                >
                    {choKichCo ? (
                        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                            {Array.from({ length: 6 }, (_, i) => (
                                <span key={i} className="h-9 w-[52px] animate-pulse rounded-md bg-bo-border/60" />
                            ))}
                        </div>
                    ) : kichCos.length === 0 ? (
                        <p className="pt-2 text-sm text-bo-muted">Chưa có kích cỡ nào. Vui lòng thêm ở trang Thuộc tính.</p>
                    ) : (
                        <div className="space-y-2">
                            {nhomKichCo.map(({ loai, ds }, i) => {
                                const daChonCaNhom = ds.every((s) => tapKichCo.has(s.id));
                                const caNhomBiKhoa = ds.every((s) => tapKichCoKhoa.has(s.id));
                                const idNhom = ds.map((s) => s.id);
                                return (
                                    <div
                                        key={loai}
                                        role="group"
                                        aria-label={nhieuNhomKichCo ? `Kích cỡ ${NHAN_NHOM_KICH_CO[loai] ?? loai}` : "Kích cỡ"}
                                        className="flex flex-wrap items-center gap-1.5"
                                    >
                                        {nhieuNhomKichCo && (
                                            <span className="w-10 shrink-0 text-xs text-bo-muted">{NHAN_NHOM_KICH_CO[loai] ?? loai}</span>
                                        )}
                                        {ds.map((size) => (
                                            <NutKichCo
                                                key={size.id}
                                                dangChon={tapKichCo.has(size.id)}
                                                khoa={tapKichCoKhoa.has(size.id)}
                                                disabled={disabled}
                                                onClick={() => dispatch({ type: "batTatKichCo", sizeId: size.id })}
                                            >
                                                {size.tenSize || size.maSize}
                                            </NutKichCo>
                                        ))}
                                        {nhieuNhomKichCo && (
                                            <button
                                                type="button"
                                                disabled={disabled || (daChonCaNhom && caNhomBiKhoa)}
                                                onClick={() =>
                                                    dispatch({
                                                        type: "chonKichCo",
                                                        sizeIds: daChonCaNhom
                                                            ? state.kichCoDaChon.filter((id) => !idNhom.includes(id))
                                                            : [...new Set([...state.kichCoDaChon, ...idNhom])],
                                                    })
                                                }
                                                className={cn(
                                                    NUT_CHU_CLASS,
                                                    "ml-1 text-xs",
                                                    daChonCaNhom ? "text-bo-muted hover:text-bo-foreground" : "text-bo-primary",
                                                )}
                                            >
                                                {daChonCaNhom ? "Bỏ cả nhóm" : "Chọn cả nhóm"}
                                            </button>
                                        )}
                                        {i === 0 && (
                                            <span className="ml-auto flex items-center gap-4 pl-2">
                                                <button
                                                    type="button"
                                                    disabled={disabled || state.kichCoDaChon.length === kichCos.length}
                                                    onClick={() => dispatch({ type: "chonKichCo", sizeIds: kichCos.map((s) => s.id) })}
                                                    className={cn(NUT_CHU_CLASS, "text-bo-primary")}
                                                >
                                                    Chọn tất cả
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={disabled || state.kichCoDaChon.length === kichCoKhoa.length}
                                                    onClick={() => dispatch({ type: "chonKichCo", sizeIds: [] })}
                                                    className={cn(NUT_CHU_CLASS, "text-bo-muted hover:text-bo-foreground")}
                                                >
                                                    Bỏ chọn
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DongThuocTinh>
            </div>

            {/* Tóm tắt */}
            <div
                className={cn(
                    "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    vuotGioiHan ? "border-bo-danger/40 bg-bo-danger-soft" : "border-bo-border bg-bo-surface-subtle",
                )}
            >
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                    {thongKe.soToHop === 0 ? (
                        <span className="text-bo-muted">Chọn ít nhất 1 màu sắc và 1 kích cỡ để sinh bảng biến thể.</span>
                    ) : (
                        <>
                            {laSua ? (
                                <>
                                    <span className="text-bo-foreground">
                                        <b>{thongKe.soCu}</b> biến thể đang có
                                    </span>
                                    {thongKe.soTao > 0 ? (
                                        <span className="rounded-full bg-bo-primary-soft px-2.5 py-0.5 text-xs font-semibold text-bo-primary">
                                            Thêm mới {thongKe.soTao} biến thể
                                        </span>
                                    ) : (
                                        <span className="text-xs text-bo-muted">Chọn thêm màu sắc hoặc kích cỡ để tạo biến thể mới.</span>
                                    )}
                                    {thongKe.mauThieuAnh.length > 0 && (
                                        <span className="rounded-full bg-bo-danger-soft px-2.5 py-0.5 text-xs font-semibold text-bo-danger">
                                            {thongKe.mauThieuAnh.length} màu mới chưa có ảnh
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="text-bo-foreground">
                                        <b>{state.mauDaChon.length}</b> màu × <b>{state.kichCoDaChon.length}</b> kích cỡ ={" "}
                                        <b>{thongKe.soToHop}</b> tổ hợp
                                        {thongKe.soBoQua > 0 && `, bỏ ${thongKe.soBoQua}`}
                                    </span>
                                    <span className="rounded-full bg-bo-primary-soft px-2.5 py-0.5 text-xs font-semibold text-bo-primary">
                                        Sẽ tạo {thongKe.soTao} biến thể
                                    </span>
                                    {thongKe.mauThieuAnh.length > 0 ? (
                                        <span className="rounded-full bg-bo-danger-soft px-2.5 py-0.5 text-xs font-semibold text-bo-danger">
                                            {thongKe.mauThieuAnh.length}/{thongKe.soMauCoBienThe} màu chưa có ảnh
                                        </span>
                                    ) : (
                                        thongKe.soMauCoBienThe > 0 && (
                                            <span className="rounded-full bg-bo-success-soft px-2.5 py-0.5 text-xs font-semibold text-bo-success">
                                                Đủ ảnh {thongKe.soMauCoBienThe} màu
                                            </span>
                                        )
                                    )}
                                </>
                            )}
                            {thongKe.soGiaBanThapHon > 0 && (
                                <span className="rounded-full bg-bo-warning-soft px-2.5 py-0.5 text-xs font-semibold text-bo-warning">
                                    {thongKe.soGiaBanThapHon} dòng giá bán thấp hơn giá vốn
                                </span>
                            )}
                            {vuotGioiHan && (
                                <span className="font-medium text-bo-danger">
                                    Tối đa {SO_BIEN_THE_TOI_DA} biến thể mỗi sản phẩm{laSua && `, sau khi lưu sẽ có ${soBienTheSauLuu}`}.
                                </span>
                            )}
                        </>
                    )}
                </div>
                {nhom.length > 1 && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn("ml-auto", NUT_PHU_CLASS)}
                        onClick={() => dispatch({ type: "thuGonTatCa", thuGon: !daThuGonHet })}
                    >
                        {daThuGonHet ? (
                            <ChevronsUpDown className="size-4" aria-hidden="true" />
                        ) : (
                            <ChevronsDownUp className="size-4" aria-hidden="true" />
                        )}
                        {daThuGonHet ? "Mở tất cả" : "Thu gọn tất cả"}
                    </Button>
                )}
            </div>

            {/* Giá chung */}
            <div className="grid grid-cols-2 items-end gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 md:grid-cols-[180px_180px_auto_1fr]">
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-bo-foreground">Giá vốn chung (₫)</span>
                    <OTien value={giaVonChung} onChange={doiGiaChung(setGiaVonChung)} onEnter={apDungGiaChung} placeholder="280.000" disabled={disabled} />
                </label>
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-bo-foreground">Giá bán chung (₫)</span>
                    <OTien value={giaBanChung} onChange={doiGiaChung(setGiaBanChung)} onEnter={apDungGiaChung} placeholder="459.000" disabled={disabled} />
                </label>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || thongKe.soToHop === 0}
                    onClick={apDungGiaChung}
                    className={cn("col-span-2 h-8 md:col-span-1", NUT_VIEN_CLASS)}
                >
                    Áp dụng cho tất cả
                </Button>
                <p
                    role="status"
                    className={cn(
                        "col-span-2 text-xs md:col-span-1",
                        thongBaoApDung ? (thongBaoApDung.loi ? "text-bo-danger" : "font-medium text-bo-success") : "text-bo-muted",
                    )}
                >
                    {thongBaoApDung?.noiDung ??
                        (laSua
                            ? "Biến thể còn tồn kho có giá tính theo lô nhập (ô có khóa) nên không sửa được."
                            : "Giá không bắt buộc. Theo quy tắc hiện tại, giá được tính lại theo lô thực tế khi nhập kho.")}
                </p>
            </div>

            {/* Bảng biến thể */}
            {nhom.length > 0 && <p className="-mb-2 text-xs text-bo-muted md:hidden">Vuốt ngang bảng để xem và nhập giá.</p>}
            {/* relative: giữ cả phần tử absolute (sr-only) bên trong vùng cuộn, không làm tràn hộp thoại */}
            <div className="relative overflow-x-auto rounded-lg border border-bo-border bg-white">
                <table className={cn("w-full border-collapse text-sm", laSua ? "min-w-[800px]" : "min-w-[720px]")}>
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle text-left text-xs font-medium text-bo-muted">
                            <th className="w-10 px-3 py-2"><span className="sr-only">Tạo biến thể</span></th>
                            <th className="w-28 px-3 py-2 font-medium">Kích cỡ</th>
                            <th className="px-3 py-2 font-medium">{laSua ? "Mã SKU" : "Mã SKU (xem trước)"}</th>
                            <th className="w-36 px-3 py-2 text-right font-medium">Giá vốn (₫)</th>
                            <th className="w-36 px-3 py-2 text-right font-medium">Giá bán (₫)</th>
                            <th className={cn("px-3 py-2 font-medium", laSua ? "w-48" : "w-40")}>
                                {laSua ? "Trạng thái" : <span className="sr-only">Ghi chú</span>}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {nhom.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-sm text-bo-muted">
                                    Bảng biến thể hiện ở đây sau khi chọn màu sắc và kích cỡ.
                                </td>
                            </tr>
                        )}
                        {nhom.map(({ mauSacId, dong }) => {
                            const mau = mauTheoId.get(mauSacId);
                            if (!mau) return null;
                            return (
                                <NhomMau
                                    key={mauSacId}
                                    laSua={laSua}
                                    mau={mau}
                                    dong={dong}
                                    anh={state.anhMau[mauSacId]}
                                    anhCu={anhMauCu[mauSacId]}
                                    thieuAnh={hienLoi && thongKe.mauThieuAnh.includes(mauSacId)}
                                    thuGon={state.mauThuGon.includes(mauSacId)}
                                    giaMau={state.giaMau[mauSacId]}
                                    sizeTheoId={sizeTheoId}
                                    tienToMaSanPham={tienToMaSanPham}
                                    maChatLieu={maChatLieu}
                                    anhSanPhams={anhSanPhams}
                                    hienLoi={hienLoi}
                                    disabled={disabled}
                                    dispatch={dispatch}
                                    onChonAnhMau={onChonAnhMau}
                                    onDungAnhSanPham={onDungAnhSanPham}
                                    onGoAnhMau={onGoAnhMau}
                                    onMoDoi={moHopDoi}
                                />
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-bo-muted">
                {laSua ? (
                    "Nhấn Enter trong ô giá để xuống dòng dưới. Biến thể đã lưu không xóa được, chỉ chuyển sang Tạm ngừng."
                ) : (
                    <>
                        Nhấn Enter trong ô giá để xuống dòng dưới. Dấu <span className="font-semibold text-bo-primary">?</span> trong
                        mã là số thứ tự trong ngày, hệ thống cấp khi lưu.
                    </>
                )}
            </p>

            {laSua && doi.id != null && (
                <DoiThuocTinhBienThe
                    key={doi.lan}
                    open={doi.mo}
                    state={state}
                    id={doi.id}
                    mauSacs={mauSacs}
                    kichCos={kichCos}
                    onOpenChange={(mo) => setDoi((d) => ({ ...d, mo }))}
                    onDoi={(id, mauSacId, sizeId) => {
                        dispatch({ type: "doiThuocTinh", id, mauSacId, sizeId });
                        setDoi((d) => ({ ...d, mo: false }));
                    }}
                />
            )}
        </div>
    );
}

const GIA_TRONG = { giaVon: "", giaBan: "" };

const giongDong = (a, b) => {
    const khoa = Object.keys(a);
    return khoa.length === Object.keys(b).length && khoa.every((k) => a[k] === b[k]);
};

/** Một nhóm màu chỉ vẽ lại khi dữ liệu của chính nhóm đó đổi, để gõ giá mượt cả khi có hàng trăm dòng. */
const giongNhom = (a, b) => {
    for (const k of Object.keys(a)) {
        if (k !== "dong" && a[k] !== b[k]) return false;
    }
    return a.dong.length === b.dong.length && a.dong.every((d, i) => giongDong(d, b.dong[i]));
};

const NhomMau = memo(function NhomMau({
    laSua,
    mau,
    dong,
    anh,
    anhCu,
    thieuAnh,
    thuGon,
    giaMau = GIA_TRONG,
    sizeTheoId,
    tienToMaSanPham,
    maChatLieu,
    anhSanPhams,
    hienLoi,
    disabled,
    dispatch,
    onChonAnhMau,
    onDungAnhSanPham,
    onGoAnhMau,
    onMoDoi,
}) {
    const mauSacId = mau.id;
    // Dòng "mới" là tổ hợp chưa có biến thể (form Thêm: mọi dòng); dòng "cũ" là biến thể đã lưu (form Chỉnh sửa).
    const dongMoi = dong.filter((d) => d.loai !== "cu");
    const soCu = dong.length - dongMoi.length;
    const soTao = dongMoi.filter((d) => d.tao).length;
    const chuaCoKichCo = dong.length === 0;
    const trangThaiChon = dongMoi.length === 0 || soTao === 0 ? false : soTao === dongMoi.length ? true : "indeterminate";
    // Form Chỉnh sửa: màu chỉ còn biến thể có giá khóa thì ô giá nhóm không có tác dụng.
    const coGiaSuaDuoc = !laSua || dong.some((d) => !d.khoaGia);
    const nhanSoLuong = !laSua
        ? chuaCoKichCo
            ? "Chưa chọn kích cỡ"
            : `${soTao}/${dong.length} kích cỡ`
        : soCu + soTao === 0
          ? chuaCoKichCo
              ? "Chưa chọn kích cỡ"
              : "Chưa tạo biến thể"
          : `${soCu + soTao} biến thể${soTao > 0 ? ` · ${soTao} mới` : ""}`;
    const coAnh = Boolean(anh || anhCu);
    return (
        <>
            <tr id={`nhom-mau-${mauSacId}`} className={cn("border-b border-bo-border", thieuAnh ? "bg-bo-danger-soft" : "bg-bo-surface-subtle")}>
                <td className="px-3 py-2">
                    {(!laSua || dongMoi.length > 0) && (
                        <Checkbox
                            checked={trangThaiChon}
                            disabled={disabled || chuaCoKichCo}
                            onCheckedChange={(giaTri) => dispatch({ type: "batTatCaMau", mauSacId, tao: giaTri === true })}
                            aria-label={laSua ? `Tạo mọi kích cỡ mới của màu ${mau.tenMau}` : `Tạo mọi kích cỡ của màu ${mau.tenMau}`}
                            className={CHECKBOX_CLASS}
                        />
                    )}
                </td>
                <td colSpan={2} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => dispatch({ type: "batTatThuGon", mauSacId })}
                            aria-expanded={!thuGon}
                            aria-label={`${thuGon ? "Mở" : "Thu gọn"} màu ${mau.tenMau}`}
                            className="flex size-6 items-center justify-center rounded text-bo-muted hover:bg-bo-border focus-visible:outline-2 focus-visible:outline-bo-primary"
                        >
                            {thuGon ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                        <ChamMau hex={mau.maMauHex} className="size-4" />
                        <span className="font-semibold text-bo-foreground">{mau.tenMau}</span>
                        <span className="font-mono text-xs text-bo-muted">{mau.maMau}</span>
                        <span className="rounded-full border border-bo-border bg-white px-2 py-0.5 text-xs text-bo-foreground">
                            {nhanSoLuong}
                        </span>
                        <OAnhMau
                            mau={mau}
                            anh={anh}
                            anhCu={anhCu}
                            thieuAnh={thieuAnh}
                            anhSanPhams={anhSanPhams}
                            disabled={disabled}
                            onChonTep={(tep) => onChonAnhMau(mauSacId, tep)}
                            onDungAnhSanPham={(anhSp) => onDungAnhSanPham(mauSacId, anhSp)}
                            onGoAnh={() => onGoAnhMau(mauSacId)}
                        />
                        {coAnh ? (
                            <span className={cn("text-xs", anh && anhCu ? "font-medium text-bo-primary" : "text-bo-muted")}>
                                {anh && anhCu ? `Ảnh mới cho cả ${soCu + soTao} biến thể` : `${soCu + soTao} biến thể dùng chung ảnh`}
                            </span>
                        ) : (
                            soTao > 0 && (
                                <span className={cn("inline-flex items-center gap-1 text-xs", thieuAnh ? "font-medium text-bo-danger" : "text-bo-muted")}>
                                    {thieuAnh && <AlertTriangle className="size-3.5" aria-hidden="true" />}
                                    {thieuAnh ? "Thiếu ảnh màu" : "Cần 1 ảnh cho màu này"}
                                </span>
                            )
                        )}
                    </div>
                </td>
                <td className="px-3 py-2">
                    <OTien
                        value={giaMau.giaVon}
                        onChange={(giaTri) => dispatch({ type: "suaGiaMau", mauSacId, truong: "giaVon", giaTri })}
                        onEnter={() => dispatch({ type: "apDungGiaMau", mauSacId })}
                        placeholder="Giá nhóm"
                        disabled={disabled || !coGiaSuaDuoc}
                        aria-label={`Giá vốn nhóm màu ${mau.tenMau}`}
                    />
                </td>
                <td className="px-3 py-2">
                    <OTien
                        value={giaMau.giaBan}
                        onChange={(giaTri) => dispatch({ type: "suaGiaMau", mauSacId, truong: "giaBan", giaTri })}
                        onEnter={() => dispatch({ type: "apDungGiaMau", mauSacId })}
                        placeholder="Giá nhóm"
                        disabled={disabled || !coGiaSuaDuoc}
                        aria-label={`Giá bán nhóm màu ${mau.tenMau}`}
                    />
                </td>
                <td className="px-3 py-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={disabled || !coGiaSuaDuoc || (giaMau.giaVon === "" && giaMau.giaBan === "")}
                        onClick={() => dispatch({ type: "apDungGiaMau", mauSacId })}
                        className={cn("h-8 w-full text-xs", NUT_VIEN_CLASS)}
                    >
                        Áp cho màu
                    </Button>
                </td>
            </tr>
            {!thuGon &&
                dong.map((d) => {
                    const laCu = d.loai === "cu";
                    const size = sizeTheoId.get(d.sizeId);
                    const ten = `${mau.tenMau} ${size?.tenSize || size?.maSize || ""}`;
                    const giaBanThap = d.tao && d.giaVon !== "" && d.giaBan !== "" && d.giaBan < d.giaVon;
                    // Biến thể đã lưu phải có giá; data-thieu-gia để khung lỗi đưa con trỏ tới đúng ô.
                    const coTheThieuGia = laCu && !d.khoaGia;
                    const thieuGia = coTheThieuGia && hienLoi;
                    return (
                        <tr key={d.khoa} className={cn("border-b border-bo-border transition-colors last:border-b-0 hover:bg-bo-surface-subtle/60", !d.tao && "opacity-50")}>
                            <td className="px-3 py-1.5">
                                {!laCu && (
                                    <Checkbox
                                        checked={d.tao}
                                        disabled={disabled}
                                        onCheckedChange={() => dispatch({ type: "batTatToHop", khoa: d.khoa })}
                                        aria-label={`Tạo biến thể ${ten}`}
                                        className={CHECKBOX_CLASS}
                                    />
                                )}
                            </td>
                            <td className="px-3 py-1.5 pl-12 text-bo-foreground">
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    {size?.tenSize || size?.maSize}
                                    {d.daDoi && (
                                        <span className="rounded bg-bo-primary-soft px-1.5 py-px text-[10px] font-semibold text-bo-primary">Đã đổi</span>
                                    )}
                                </span>
                            </td>
                            <td className="px-3 py-1.5">
                                <MaSku
                                    laSua={laSua}
                                    dong={d}
                                    mau={mau}
                                    size={size}
                                    tienToMaSanPham={tienToMaSanPham}
                                    maChatLieu={maChatLieu}
                                />
                            </td>
                            <td className="px-3 py-1.5">
                                {d.khoaGia ? (
                                    <GiaKhoa value={d.giaVon} nhan={`Giá vốn ${ten}`} />
                                ) : (
                                    <OTien
                                        cot="giaVon"
                                        value={d.giaVon}
                                        onChange={(giaTri) => dispatch({ type: "suaGia", khoa: d.khoa, truong: "giaVon", giaTri })}
                                        placeholder="0"
                                        disabled={disabled || !d.tao}
                                        aria-label={`Giá vốn ${ten}`}
                                        data-thieu-gia={coTheThieuGia && d.giaVon === "" ? "" : undefined}
                                        aria-invalid={thieuGia && d.giaVon === "" ? true : undefined}
                                        className={thieuGia && d.giaVon === "" ? "border-bo-danger" : undefined}
                                    />
                                )}
                            </td>
                            <td className="px-3 py-1.5">
                                {d.khoaGiaBan ?? d.khoaGia ? (
                                    <GiaKhoa value={d.giaBan} nhan={`Giá bán ${ten}`} ghiChu={GIA_BAN_KHOA} />
                                ) : (
                                    <OTien
                                        cot="giaBan"
                                        value={d.giaBan}
                                        onChange={(giaTri) => dispatch({ type: "suaGia", khoa: d.khoa, truong: "giaBan", giaTri })}
                                        placeholder="0"
                                        disabled={disabled || !d.tao}
                                        aria-label={`Giá bán ${ten}`}
                                        data-thieu-gia={coTheThieuGia && d.giaBan === "" ? "" : undefined}
                                        aria-invalid={thieuGia && d.giaBan === "" ? true : undefined}
                                        className={cn(
                                            giaBanThap && "border-bo-warning bg-bo-warning-soft",
                                            thieuGia && d.giaBan === "" && "border-bo-danger",
                                        )}
                                    />
                                )}
                            </td>
                            <td className="px-3 py-1.5 text-xs">
                                {laCu ? (
                                    <div className="flex items-center gap-1.5">
                                        <NutTrangThai
                                            dangBan={d.trangThai === 1}
                                            ten={ten}
                                            disabled={disabled}
                                            onClick={() => dispatch({ type: "doiTrangThai", id: d.id })}
                                        />
                                        {d.doiDuoc && (
                                            <button
                                                type="button"
                                                data-doi-bien-the={d.id}
                                                disabled={disabled}
                                                onClick={() => onMoDoi(d.id)}
                                                aria-label={`Đổi màu sắc, kích cỡ của ${ten}`}
                                                title="Đổi màu sắc, kích cỡ (biến thể chưa phát sinh giao dịch)"
                                                className="flex size-7 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-bo-primary-soft hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary disabled:opacity-50"
                                            >
                                                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                                            </button>
                                        )}
                                        {giaBanThap && (
                                            <span title="Giá bán thấp hơn giá vốn" className="text-bo-warning">
                                                <AlertTriangle className="size-3.5" aria-hidden="true" />
                                                <span className="sr-only">Giá bán thấp hơn giá vốn</span>
                                            </span>
                                        )}
                                    </div>
                                ) : giaBanThap ? (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-bo-warning">
                                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                                        Bán thấp hơn vốn
                                    </span>
                                ) : !d.tao ? (
                                    <span className="text-bo-muted">Không tạo</span>
                                ) : (
                                    laSua && (
                                        <span className="rounded-full bg-bo-primary-soft px-2 py-0.5 font-semibold text-bo-primary">Mới</span>
                                    )
                                )}
                            </td>
                        </tr>
                    );
                })}
        </>
    );
}, giongNhom);

/** Mã SKU: biến thể đã lưu hiện mã thật; tổ hợp mới hiện mã xem trước (form Thêm có dấu ? là số thứ tự cấp khi lưu). */
function MaSku({ laSua, dong, mau, size, tienToMaSanPham, maChatLieu }) {
    if (dong.loai === "cu") {
        return dong.daDoi ? (
            <span className="text-xs italic text-bo-muted" title={`Mã hiện tại: ${dong.maSku}`}>
                Tạo lại khi lưu
            </span>
        ) : (
            <span className="whitespace-nowrap font-mono text-xs text-bo-foreground">{dong.maSku}</span>
        );
    }
    const sku = xemTruocSku({ tienToMaSanPham, maChatLieu, maSize: size?.maSize ?? "", maMau: mau.maMau });
    return (
        <span className="whitespace-nowrap font-mono text-xs text-bo-muted">
            {sku.maSanPham}
            {!laSua && tienToMaSanPham && <span className="font-semibold text-bo-primary">?</span>}
            {sku.phanSau}
        </span>
    );
}
