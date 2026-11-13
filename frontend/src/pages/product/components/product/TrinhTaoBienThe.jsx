import { memo, useCallback, useId, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowLeftRight,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    ImagePlus,
    Lightbulb,
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
import {
    SO_BIEN_THE_TOI_DA,
    demDongApGiaChung,
    demDongCanNang,
    demTheoMuc,
    giaBanGoiY,
    giaDaChot,
    goiYMau,
    hienTien,
    mucCuaDong,
    mucGiaBan,
    mucNangNhat,
    phanTramLai,
    viTriSauChuSo,
    xemTruocSku,
    xuLyNhapTien,
} from "./logicBienThe";
import { t } from "@/i18n";

const NHAN_NHOM_KICH_CO = { chu: t("Chữ"), so: t("Số"), khac: t("Khác") };
const KHONG_KHOA = [];
const KHONG_CO_ANH_CU = {};
const GIA_KHOA = t("Tính theo lô nhập");
const GIA_BAN_KHOA = t("Chỉ quản trị viên đổi được giá bán");
const CACH_TINH_GOI_Y_MAU = t("Giá vốn cao nhất trong màu × 1,2, làm tròn lên nghìn. Chỉ nâng cỡ đang trống hoặc thấp hơn, không hạ giá.");

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
            title={khoa ? t("Kích cỡ đang có biến thể nên không bỏ chọn được") : undefined}
            onClick={khoa ? undefined : onClick}
            disabled={disabled}
            className={cn(
                "h-9 min-w-[52px] rounded-md border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bo-primary/25 disabled:opacity-50",
                dangChon
                    ? "border-bo-primary bg-bo-primary-soft font-semibold text-bo-primary"
                    : "border-bo-border bg-bo-surface font-medium text-bo-foreground hover:border-bo-muted",
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
 * lưu không sửa được khi người dùng không phải quản trị viên (`ghiChu` nói lý do).
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

/** Màu bóng đèn và màu ô theo mức giá (mucGiaBan). Đạt: xám nhạt, chỉ để người dùng biết có chỗ xem lãi. */
const KIEU_MUC = {
    lo: { den: "text-bo-danger", o: "border-bo-danger/60 bg-bo-danger-soft" },
    thap: { den: "text-bo-warning", o: "border-bo-warning/60 bg-bo-warning-soft" },
    cao: { den: "text-bo-warning", o: "border-bo-warning/60 bg-bo-warning-soft" },
    trong: { den: "text-bo-primary", o: "" },
    chuaVon: { den: "text-bo-muted/70", o: "" },
    dat: { den: "text-bo-muted/40", o: "" },
};

/** Câu ngắn cho chú thích bóng đèn và trình đọc màn hình. */
const MO_TA_MUC = {
    lo: t("Giá bán thấp hơn giá vốn"),
    thap: t("Lãi dưới 20% so với giá vốn"),
    cao: t("Giá bán từ 5 lần giá vốn trở lên, kiểm tra lại số 0"),
    trong: t("Chưa có giá bán"),
    chuaVon: t("Chưa có giá vốn"),
    dat: t("Lãi từ 20% trở lên"),
};
const MO_TA_MUC_MAU = {
    lo: t("Có cỡ đang bán dưới giá vốn"),
    thap: t("Có cỡ lãi dưới 20%"),
    cao: t("Có cỡ giá bán từ 5 lần giá vốn trở lên"),
    trong: t("Có cỡ chưa có giá bán"),
    chuaVon: t("Có cỡ chưa có giá vốn"),
    dat: t("Mọi cỡ đều lãi từ 20% trở lên"),
};

/**
 * Ô giá bán kèm bóng đèn ở mép trái (cùng chỗ ổ khóa của ô giá vốn). Ô nào sửa được giá bán cũng có bóng đèn (`muc`
 * khác null), màu theo mức giá đã chốt nên không đổi theo từng phím gõ, và ô không thụt lề lúc có lúc không.
 * Bấm bóng đèn, hoặc đứng trong ô bấm Alt + ↓, mở ô nổi `noiDung(xong)`; gọi `xong()` sau khi dùng một nút để đóng ô
 * nổi và đưa con trỏ về ô giá. Bóng đèn không nằm trong thứ tự Tab để bảng nhiều biến thể không phải Tab gấp đôi.
 * `onChot`: Enter ở dòng cuối (con trỏ không xuống dòng dưới) thì chốt giá đang gõ.
 * `toMauO`: tô viền/nền ô theo mức. Ô "Giá nhóm" của hàng màu để false: chỉ bóng đèn đổi màu, không trông như ô nhóm lỗi.
 */
function OGiaCoGoiY({ muc, moTa, nhanMo, noiDung, onChot, toMauO = true, disabled, className, ...otienProps }) {
    const [mo, setMo] = useState(false);
    const vungRef = useRef(null);
    // Đóng ô nổi xong thì đưa con trỏ về ô giá (mở bằng bàn phím, hoặc vừa bấm nút trong ô nổi).
    const [veO, setVeO] = useState(false);
    const moTaId = useId();
    const coDen = muc != null;
    const kieu = coDen ? KIEU_MUC[muc] : null;
    const oGia = () => vungRef.current?.querySelector("input");
    const xong = () => {
        setVeO(true);
        setMo(false);
    };
    return (
        <div
            ref={vungRef}
            className="relative"
            onKeyDown={(e) => {
                if (!coDen || disabled) return;
                if (e.altKey && e.key === "ArrowDown") {
                    e.preventDefault();
                    setVeO(true);
                    setMo(true);
                } else if (e.key === "Enter" && document.activeElement === oGia()) {
                    onChot?.();
                }
            }}
        >
            {coDen && (
                <Popover open={mo} onOpenChange={setMo}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            tabIndex={-1}
                            disabled={disabled}
                            aria-label={nhanMo}
                            title={moTa}
                            onClick={() => setVeO(false)}
                            className={cn(
                                "absolute left-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-bo-primary-soft hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary disabled:opacity-50",
                                kieu.den,
                            )}
                        >
                            <Lightbulb className="size-3.5" aria-hidden="true" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-72 border-bo-border bg-bo-surface p-3 text-[13px]"
                        onCloseAutoFocus={(e) => {
                            if (!veO) return;
                            setVeO(false);
                            e.preventDefault();
                            oGia()?.focus();
                        }}
                    >
                        {noiDung(xong)}
                    </PopoverContent>
                </Popover>
            )}
            {coDen && (
                <span id={moTaId} className="sr-only">
                    {moTa}. {t("Bấm Alt và mũi tên xuống để xem lãi và giá sàn.")}
                </span>
            )}
            <OTien
                {...otienProps}
                disabled={disabled}
                aria-describedby={coDen ? moTaId : undefined}
                className={cn(coDen && "pl-8", toMauO && kieu?.o, className)}
            />
        </div>
    );
}

/** Một dòng nhãn – số tiền trong ô nổi bóng đèn. */
function DongSoTien({ nhan, giaTri }) {
    return (
        <>
            <dt className="text-bo-muted">{nhan}</dt>
            <dd className="text-right tabular-nums text-bo-foreground">{hienTien(giaTri)} ₫</dd>
        </>
    );
}

const NUT_O_NOI_CHINH =
    "h-8 flex-1 bg-bo-primary px-2 text-xs text-white hover:bg-bo-primary-hover focus-visible:ring-[3px] focus-visible:ring-bo-primary/30";
const NUT_O_NOI_PHU = `h-8 flex-1 px-2 text-xs ${NUT_VIEN_CLASS}`;

/**
 * Ô nổi của một dòng: lãi so với giá vốn, giá sàn, giá đang lưu. Nút "Dùng giá sàn" chỉ có khi giá đang lỗ, lãi dưới
 * 20% hoặc trống (không bao giờ mời hạ giá); "Trả lại giá cũ" khi biến thể đã lưu đang bị đổi giá bán.
 */
function NoiDungGoiYDong({ dong: d, onDatGia, xong }) {
    const muc = mucGiaBan(d.giaVon, d.giaBan);
    const giaSan = giaBanGoiY(d.giaVon);
    const coGiaBan = d.giaBan !== "" && Number(d.giaBan) > 0;
    // Giá vốn bình quân theo lô có phần lẻ (30.909,09): tiền lãi/lỗ làm tròn về đồng cho dễ đọc.
    const lai = coGiaBan ? Math.round(Number(d.giaBan) - Number(d.giaVon)) : 0;
    const phanTram = phanTramLai(d.giaVon, d.giaBan);
    const coGiaGoc = d.loai === "cu" && d.giaBanGoc !== "" && d.giaBanGoc != null && Number(d.giaBanGoc) > 0;
    const daDoiGia = coGiaGoc && Number(d.giaBanGoc) !== Number(d.giaBan || 0);
    const datGia = (gia) => {
        onDatGia(gia);
        xong();
    };
    const tieuDe = {
        lo: <p className="font-semibold text-bo-danger">{t("Lỗ {{tien}} ₫ mỗi chiếc", { tien: hienTien(-lai) })}</p>,
        thap: <p className="font-semibold text-bo-warning">{t("Lãi {{phanTram}}%, dưới mức tối thiểu 20%", { phanTram })}</p>,
        cao: (
            <p className="font-semibold text-bo-warning">
                {t("Gấp {{soLan}} lần giá vốn. Kiểm tra lại số 0 thừa.", { soLan: Math.floor(Number(d.giaBan) / Number(d.giaVon)) })}
            </p>
        ),
        trong: (
            <>
                <p className="font-semibold text-bo-primary">{t("Chưa có giá bán")}</p>
                <p className="mt-1 text-xs text-bo-muted">
                    {d.loai === "cu"
                        ? t("Biến thể đã lưu cần có giá bán.")
                        : t("Để trống thì khi nhập kho lần đầu, hệ thống tự đặt giá bằng giá vốn lô × 1,2, làm tròn lên nghìn.")}
                </p>
            </>
        ),
        chuaVon: (
            <>
                <p className="font-semibold text-bo-foreground">{t("Chưa có giá vốn")}</p>
                <p className="mt-1 text-xs text-bo-muted">{t("Nhập giá vốn để xem lãi và giá sàn.")}</p>
            </>
        ),
        dat: (
            <p className="font-semibold text-bo-success">
                {t("Lãi {{tien}} ₫ · +{{phanTram}}% trên giá vốn", { tien: hienTien(lai), phanTram })}
            </p>
        ),
    }[muc];
    const coNutSan = giaSan != null && (muc === "lo" || muc === "thap" || muc === "trong");
    return (
        <div>
            {tieuDe}
            {(giaSan != null || daDoiGia) && (
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    {giaSan != null && (
                        <DongSoTien nhan={d.khoaGia ? t("Giá vốn (bình quân lô còn tồn)") : t("Giá vốn")} giaTri={d.giaVon} />
                    )}
                    {giaSan != null && <DongSoTien nhan={t("Giá sàn (lãi 20%)")} giaTri={giaSan} />}
                    {daDoiGia && <DongSoTien nhan={t("Giá đang lưu")} giaTri={d.giaBanGoc} />}
                </dl>
            )}
            {(coNutSan || daDoiGia) && (
                <div className="mt-3 flex gap-2">
                    {coNutSan && (
                        <Button type="button" size="sm" className={NUT_O_NOI_CHINH} onClick={() => datGia(giaSan)}>
                            {t("Dùng {{gia}} ₫", { gia: hienTien(giaSan) })}
                        </Button>
                    )}
                    {daDoiGia && (
                        <Button type="button" size="sm" variant="outline" className={NUT_O_NOI_PHU} onClick={() => datGia(d.giaBanGoc)}>
                            {t("Trả lại {{gia}} ₫", { gia: hienTien(d.giaBanGoc) })}
                        </Button>
                    )}
                </div>
            )}
            {giaSan != null && <p className="mt-2 text-[11px] text-bo-muted">{t("Giá sàn = giá vốn × 1,2, làm tròn lên nghìn.")}</p>}
        </div>
    );
}

/** Ô nổi của hàng màu: đếm cỡ theo mức, giá sàn của màu và nút nâng các cỡ trống hoặc thấp hơn (không hạ cỡ nào). */
function NoiDungGoiYMau({ dong, giaSanMau, soCanNang, onNang, xong }) {
    const dem = demTheoMuc(dong, null);
    const dongDem = [
        ["lo", "text-bo-danger", t("{{count}} cỡ đang bán dưới giá vốn", { count: dem.lo })],
        ["thap", "text-bo-warning", t("{{count}} cỡ lãi dưới 20%", { count: dem.thap })],
        ["cao", "text-bo-warning", t("{{count}} cỡ giá từ 5 lần giá vốn trở lên", { count: dem.cao })],
        ["trong", "text-bo-primary", t("{{count}} cỡ chưa có giá bán", { count: dem.trong })],
        ["chuaVon", "text-bo-foreground", t("{{count}} cỡ chưa có giá vốn", { count: dem.chuaVon })],
    ].filter(([muc]) => dem[muc] > 0);
    return (
        <div>
            {dongDem.length > 0 ? (
                <ul className="space-y-0.5">
                    {dongDem.map(([muc, mau, cau]) => (
                        <li key={muc} className={cn("font-semibold", mau)}>{cau}</li>
                    ))}
                </ul>
            ) : (
                <p className="font-semibold text-bo-success">{t("Mọi cỡ đều lãi từ 20% trở lên.")}</p>
            )}
            {giaSanMau != null && (
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <DongSoTien nhan={t("Giá sàn của màu")} giaTri={giaSanMau} />
                </dl>
            )}
            {soCanNang > 0 && (
                <Button
                    type="button"
                    size="sm"
                    className={cn("mt-3 w-full", NUT_O_NOI_CHINH)}
                    onClick={() => {
                        onNang();
                        xong();
                    }}
                >
                    {t("Nâng {{count}} cỡ lên {{gia}} ₫", { count: soCanNang, gia: hienTien(giaSanMau) })}
                </Button>
            )}
            {giaSanMau != null && <p className="mt-2 text-[11px] text-bo-muted">{CACH_TINH_GOI_Y_MAU}</p>}
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
            aria-label={t("Đang bán {{ten}}", { ten })}
            title={dangBan ? t("Bấm để tạm ngừng bán biến thể này") : t("Bấm để bán lại biến thể này")}
            disabled={disabled}
            onClick={onClick}
            className="inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-md px-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:opacity-50"
        >
            <span
                aria-hidden="true"
                className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none",
                    dangBan ? "bg-bo-success-track" : "bg-bo-input-border",
                )}
            >
                <span
                    className={cn(
                        "absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
                        dangBan && "translate-x-4",
                    )}
                />
            </span>
            <span className={dangBan ? "text-bo-success" : "text-bo-muted"}>
                {dangBan ? t("Đang bán") : t("Tạm ngừng")}
            </span>
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
                    aria-label={urlHienThi ? t("Đổi ảnh màu {{tenMau}}", { tenMau: mau.tenMau }) : t("Thêm ảnh màu {{tenMau}}", { tenMau: mau.tenMau })}
                    title={urlHienThi ? t("Đổi ảnh cho cả màu") : t("Thêm ảnh cho cả màu")}
                    className={cn(
                        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-bo-surface text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
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
            <PopoverContent align="start" className="w-80 space-y-3 border-bo-border bg-bo-surface p-3">
                <p className="text-sm font-medium text-bo-foreground">{t("Ảnh màu {{tenMau}}", { tenMau: mau.tenMau })}</p>
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
                    {urlHienThi ? t("Tải ảnh khác") : t("Tải ảnh lên")}
                </Button>
                {anhSanPhams.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs text-bo-muted">
                            {anhCu ? t("Hoặc chọn từ ảnh sản phẩm vừa thêm") : t("Hoặc chọn từ ảnh sản phẩm chính")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {anhSanPhams.map((anhSp, i) => (
                                <button
                                    key={anhSp.id}
                                    type="button"
                                    aria-label={t("Dùng ảnh sản phẩm {{so}}", { so: i + 1 })}
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
                    <p className="text-xs text-bo-muted">{t("Dùng cho mọi kích cỡ của màu này. Ảnh tối đa 10 MB.")}</p>
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
                            {anhCu ? t("Dùng lại ảnh cũ") : t("Gỡ ảnh")}
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
 * chưa phát sinh giao dịch; giá vốn của biến thể còn tồn kho chỉ xem vì được tính theo lô nhập.
 * Ô giá bán có bóng đèn gợi ý (giá vốn × 1,2 làm tròn lên nghìn) khi giá trống hoặc thấp hơn; ở hàng màu theo giá vốn
 * cao nhất trong màu và chỉ nâng, không hạ giá.
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
    // Nút Nâng giá lên giá sàn chung: mỗi màu một giá (giá sàn của hàng màu), để giá trong một màu đồng nhất.
    // Tính theo giá đã chốt (dòng đang gõ dùng giá lúc bắt đầu gõ) để nút không hiện/ẩn theo từng phím.
    const dangGo = state.dangGo ?? null;
    const goiYTheoMau = useMemo(() => {
        const giaTheoMau = {};
        let soDong = 0;
        let soDongCoMuc = 0;
        let soDongDuLai = 0;
        for (const { mauSacId, dong } of nhom) {
            const dongChot = dong.map((d) => giaDaChot(d, dangGo));
            for (const d of dongChot) {
                const muc = mucCuaDong(d, null);
                if (muc == null) continue;
                soDongCoMuc += 1;
                if (muc === "dat" || muc === "cao") soDongDuLai += 1;
            }
            const gia = goiYMau(dongChot, state.giaMau[mauSacId]?.giaVon);
            if (gia == null) continue;
            giaTheoMau[mauSacId] = gia;
            soDong += demDongCanNang(dongChot, gia);
        }
        return { giaTheoMau, soDong, moiGiaDuLai: soDongCoMuc > 0 && soDongDuLai === soDongCoMuc };
    }, [nhom, state.giaMau, dangGo]);
    const soDongGoiY = goiYTheoMau.soDong;

    const doiGiaChung = (setter) => (giaTri) => {
        setter(giaTri);
        setThongBaoApDung(null);
    };

    const apDungGiaChung = () => {
        if (giaVonChung === "" && giaBanChung === "") {
            setThongBaoApDung({ loi: true, noiDung: t("Nhập giá vốn hoặc giá bán trước khi áp dụng.") });
            return;
        }
        dispatch({ type: "apDungGiaChung", giaVon: giaVonChung, giaBan: giaBanChung });
        const { soApDung, soKhoaGia } = demDongApGiaChung(nhom, { giaVon: giaVonChung, giaBan: giaBanChung });
        const ketQua =
            soApDung > 0
                ? t("Đã áp dụng cho {{count}} dòng.", { count: soApDung })
                : soKhoaGia > 0
                  ? t("Không có dòng nào đổi giá.")
                  : t("Chưa có dòng nào đang chọn. Giá sẽ dùng khi bạn tích lại.");
        setThongBaoApDung({
            loi: false,
            noiDung: ketQua + (soKhoaGia > 0 ? t(" Giữ nguyên giá vốn {{count}} biến thể còn tồn kho.", { count: soKhoaGia }) : ""),
        });
    };

    const apGiaGoiY = () => {
        dispatch({ type: "nangGiaBanTheoMau", giaTheoMau: goiYTheoMau.giaTheoMau });
        setThongBaoApDung({ loi: false, noiDung: t("Đã nâng {{count}} dòng lên giá sàn.", { count: soDongGoiY }) });
    };

    // Form cha chỉ báo loiTai khi thiếu hẳn danh sách màu sắc hoặc kích cỡ (không tạo được biến thể nào).
    if (loiTai) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-bo-border bg-bo-surface-subtle px-4 py-8 text-center">
                <p className="text-sm text-bo-foreground">{t("Không tải được danh sách màu sắc và kích cỡ.")}</p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onThuLai}
                    className={NUT_VIEN_CLASS}
                >
                    <RefreshCcw className="size-4" aria-hidden="true" />
                    {t("Thử lại")}
                </Button>
            </div>
        );
    }

    const soMauBoDuoc = state.mauDaChon.length - mauKhoa.length;

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <DongThuocTinh
                    nhan={t("Màu sắc")}
                    loi={hienLoi && state.mauDaChon.length === 0 ? t("Vui lòng chọn ít nhất 1 màu sắc") : null}
                    chuThich={
                        state.mauDaChon.length > 0 && (
                            <div className="flex items-center justify-between gap-3 text-xs text-bo-muted">
                                <span>
                                    {t("Đã chọn {{daChon}}/{{tong}} màu", { count: mauSacs.length, daChon: state.mauDaChon.length, tong: mauSacs.length })}
                                    {mauKhoa.length > 0 && t(" · {{count}} màu đang có biến thể, không bỏ được", { count: mauKhoa.length })}
                                </span>
                                {soMauBoDuoc > 0 && (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => dispatch({ type: "boChonTatCaMau" })}
                                        className={cn(NUT_CHU_CLASS, "shrink-0 text-xs text-bo-muted hover:text-bo-foreground")}
                                    >
                                        {laSua ? t("Bỏ các màu mới") : t("Bỏ chọn tất cả")}
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
                    nhan={t("Kích cỡ")}
                    loi={hienLoi && state.kichCoDaChon.length === 0 ? t("Vui lòng chọn ít nhất 1 kích cỡ") : null}
                    chuThich={
                        kichCoKhoa.length > 0 && (
                            <p className="text-xs text-bo-muted">{t("Kích cỡ đang có biến thể luôn được giữ. Chọn thêm kích cỡ để tạo biến thể mới.")}</p>
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
                        <p className="pt-2 text-sm text-bo-muted">{t("Chưa có kích cỡ nào. Vui lòng thêm ở trang Thuộc tính.")}</p>
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
                                        aria-label={nhieuNhomKichCo ? t("Kích cỡ {{nhom}}", { nhom: NHAN_NHOM_KICH_CO[loai] ?? loai }) : t("Kích cỡ")}
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
                                                {daChonCaNhom ? t("Bỏ cả nhóm") : t("Chọn cả nhóm")}
                                            </button>
                                        )}
                                        {i === 0 && (
                                            // Điện thoại: hai nút chung xuống một hàng riêng, không chen giữa các nút kích cỡ
                                            <span className="ml-auto flex items-center gap-4 pl-2 max-md:basis-full max-md:pl-0">
                                                <button
                                                    type="button"
                                                    disabled={disabled || state.kichCoDaChon.length === kichCos.length}
                                                    onClick={() => dispatch({ type: "chonKichCo", sizeIds: kichCos.map((s) => s.id) })}
                                                    className={cn(NUT_CHU_CLASS, "text-bo-primary")}
                                                >
                                                    {t("Chọn tất cả")}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={disabled || state.kichCoDaChon.length === kichCoKhoa.length}
                                                    onClick={() => dispatch({ type: "chonKichCo", sizeIds: [] })}
                                                    className={cn(NUT_CHU_CLASS, "text-bo-muted hover:text-bo-foreground")}
                                                >
                                                    {t("Bỏ chọn")}
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
                        <span className="text-bo-muted">{t("Chọn ít nhất 1 màu sắc và 1 kích cỡ để sinh bảng biến thể.")}</span>
                    ) : (
                        <>
                            {laSua ? (
                                <>
                                    <span className="text-bo-foreground">
                                        <b>{thongKe.soCu}</b> {t("biến thể đang có")}
                                    </span>
                                    {thongKe.soTao > 0 ? (
                                        <span className="rounded-full bg-bo-primary-soft px-2.5 py-0.5 text-xs font-semibold text-bo-primary">
                                            {t("Thêm mới {{count}} biến thể", { count: thongKe.soTao })}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-bo-muted">{t("Chọn thêm màu sắc hoặc kích cỡ để tạo biến thể mới.")}</span>
                                    )}
                                    {thongKe.mauThieuAnh.length > 0 && (
                                        <span className="rounded-full bg-bo-danger-soft px-2.5 py-0.5 text-xs font-semibold text-bo-danger">
                                            {t("{{count}} màu mới chưa có ảnh", { count: thongKe.mauThieuAnh.length })}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="text-bo-foreground">
                                        <b>{state.mauDaChon.length}</b> {t("màu ×")} <b>{state.kichCoDaChon.length}</b> {t("kích cỡ =")}{" "}
                                        <b>{thongKe.soToHop}</b> {t("tổ hợp")}
                                        {thongKe.soBoQua > 0 && t(", bỏ {{soBoQua}}", { soBoQua: thongKe.soBoQua })}
                                    </span>
                                    <span className="rounded-full bg-bo-primary-soft px-2.5 py-0.5 text-xs font-semibold text-bo-primary">
                                        {t("Sẽ tạo {{count}} biến thể", { count: thongKe.soTao })}
                                    </span>
                                    {thongKe.mauThieuAnh.length > 0 ? (
                                        <span className="rounded-full bg-bo-danger-soft px-2.5 py-0.5 text-xs font-semibold text-bo-danger">
                                            {t("{{thieu}}/{{tong}} màu chưa có ảnh", { count: thongKe.soMauCoBienThe, thieu: thongKe.mauThieuAnh.length, tong: thongKe.soMauCoBienThe })}
                                        </span>
                                    ) : (
                                        thongKe.soMauCoBienThe > 0 && (
                                            <span className="rounded-full bg-bo-success-soft px-2.5 py-0.5 text-xs font-semibold text-bo-success">
                                                {t("Đủ ảnh {{count}} màu", { count: thongKe.soMauCoBienThe })}
                                            </span>
                                        )
                                    )}
                                </>
                            )}
                            {thongKe.soGiaBanThapHon > 0 && (
                                <span className="rounded-full bg-bo-warning-soft px-2.5 py-0.5 text-xs font-semibold text-bo-warning">
                                    {t("{{count}} dòng giá bán thấp hơn giá vốn", { count: thongKe.soGiaBanThapHon })}
                                </span>
                            )}
                            {vuotGioiHan && (
                                <span className="font-medium text-bo-danger">
                                    {t("Tối đa {{toiDa}} biến thể mỗi sản phẩm", { toiDa: SO_BIEN_THE_TOI_DA })}{laSua && t(", sau khi lưu sẽ có {{soBienTheSauLuu}}", { soBienTheSauLuu })}.
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
                        {daThuGonHet ? t("Mở tất cả") : t("Thu gọn tất cả")}
                    </Button>
                )}
            </div>

            {/* Giá chung */}
            {/* md: hai nút chung một cột, tự xuống dòng khi hẹp; câu trạng thái nằm dòng riêng. lg: câu nằm cạnh nút. */}
            <div className="grid grid-cols-2 items-end gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 md:grid-cols-[180px_180px_minmax(0,1fr)] lg:grid-cols-[180px_180px_auto_minmax(0,1fr)]">
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-bo-foreground">{t("Giá vốn chung (₫)")}</span>
                    <OTien value={giaVonChung} onChange={doiGiaChung(setGiaVonChung)} onEnter={apDungGiaChung} disabled={disabled} />
                </label>
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-bo-foreground">{t("Giá bán chung (₫)")}</span>
                    <OTien value={giaBanChung} onChange={doiGiaChung(setGiaBanChung)} onEnter={apDungGiaChung} disabled={disabled} />
                </label>
                <div className="col-span-2 flex flex-wrap gap-2 md:col-span-1">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || thongKe.soToHop === 0}
                        onClick={apDungGiaChung}
                        className={cn("h-8 max-sm:flex-1", NUT_VIEN_CLASS)}
                    >
                        {t("Áp dụng cho tất cả")}
                    </Button>
                    {/* Chỉ hiện khi có giá cần nâng; số dòng ghi ngay trên nút. Không còn dòng nào thì báo bằng chữ mờ. */}
                    {soDongGoiY > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={apGiaGoiY}
                            title={t("Nâng giá bán đang trống hoặc thấp hơn lên giá sàn của màu. Không hạ giá nào.")}
                            className={cn("h-8 max-sm:flex-1", NUT_VIEN_CLASS)}
                        >
                            <Lightbulb className="size-4 text-bo-warning" aria-hidden="true" />
                            {t("Nâng {{count}} giá lên giá sàn", { count: soDongGoiY })}
                        </Button>
                    ) : (
                        goiYTheoMau.moiGiaDuLai && (
                            <span className="inline-flex h-8 items-center gap-1.5 text-xs text-bo-muted">
                                <Lightbulb className="size-3.5" aria-hidden="true" />
                                {t("Mọi giá bán đều lãi từ 20%")}
                            </span>
                        )
                    )}
                </div>
                <p
                    role="status"
                    className={cn(
                        "col-span-2 text-xs md:col-span-3 lg:col-span-1",
                        thongBaoApDung ? (thongBaoApDung.loi ? "text-bo-danger" : "font-medium text-bo-success") : "text-bo-muted",
                    )}
                >
                    {thongBaoApDung?.noiDung ??
                        (laSua
                            ? t("Giá vốn của biến thể còn tồn kho tính theo lô nhập (ô có khóa) nên không sửa được.")
                            : t("Giá không bắt buộc. Theo quy tắc hiện tại, giá được tính lại theo lô thực tế khi nhập kho."))}
                </p>
            </div>

            {/* Bảng biến thể */}
            {nhom.length > 0 && <p className="-mb-2 text-xs text-bo-muted md:hidden">{t("Vuốt ngang bảng để xem và nhập giá.")}</p>}
            {/* Điện thoại: bảng trống chỉ có tiêu đề cột, câu hướng dẫn bị cắt vì phải vuốt ngang → thay bằng một khung chữ */}
            {nhom.length === 0 && (
                <p className="rounded-lg border border-dashed border-bo-border bg-bo-surface px-3 py-8 text-center text-sm text-bo-muted md:hidden">
                    {t("Bảng biến thể hiện ở đây sau khi chọn màu sắc và kích cỡ.")}
                </p>
            )}
            {/* relative: giữ cả phần tử absolute (sr-only) bên trong vùng cuộn, không làm tràn hộp thoại */}
            <div className={cn("relative overflow-x-auto rounded-lg border border-bo-border bg-bo-surface", nhom.length === 0 && "max-md:hidden")}>
                <table className={cn("w-full border-collapse text-sm", laSua ? "min-w-[800px]" : "min-w-[720px]")}>
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle text-left text-xs font-medium text-bo-muted">
                            <th className="w-10 px-3 py-2"><span className="sr-only">{t("Tạo biến thể")}</span></th>
                            <th className="w-28 px-3 py-2 font-medium">{t("Kích cỡ")}</th>
                            <th className="px-3 py-2 font-medium">{laSua ? t("Mã SKU") : t("Mã SKU (xem trước)")}</th>
                            <th className="w-36 px-3 py-2 text-right font-medium">{t("Giá vốn (₫)")}</th>
                            <th className="w-36 px-3 py-2 text-right font-medium">{t("Giá bán (₫)")}</th>
                            <th className={cn("px-3 py-2 font-medium", laSua ? "w-48" : "w-40")}>
                                {laSua ? t("Trạng thái") : <span className="sr-only">{t("Ghi chú")}</span>}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {nhom.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-sm text-bo-muted">
                                    {t("Bảng biến thể hiện ở đây sau khi chọn màu sắc và kích cỡ.")}
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
                                    dangGo={dangGo && dong.some((d) => d.khoa === dangGo.khoa) ? dangGo : null}
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
                    t("Nhấn Enter trong ô giá để xuống dòng dưới. Biến thể đã lưu không xóa được, chỉ chuyển sang Tạm ngừng.")
                ) : (
                    <>
                        {t("Nhấn Enter trong ô giá để xuống dòng dưới. Dấu")} <span className="font-semibold text-bo-primary">?</span> {t("trong mã là số thứ tự trong ngày, hệ thống cấp khi lưu.")}
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
    dangGo = null,
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
    // Form Chỉnh sửa: màu chỉ còn biến thể có giá khóa thì ô giá nhóm tương ứng không có tác dụng.
    const coGiaVonSuaDuoc = !laSua || dong.some((d) => !d.khoaGia);
    const coGiaBanSuaDuoc = !laSua || dong.some((d) => !d.khoaGiaBan);
    const coGiaSuaDuoc = coGiaVonSuaDuoc || coGiaBanSuaDuoc;
    // Bóng đèn hàng màu: mức nặng nhất trong các cỡ (theo giá đã chốt), để màu đã thu gọn vẫn thấy có cỡ lỗ.
    const mucMau = mucNangNhat(dong, dangGo);
    const giaSanMau = goiYMau(dong, giaMau.giaVon);
    const soCanNangMau = demDongCanNang(dong, giaSanMau);
    const batDauGo = (d) => dispatch({ type: "batDauGo", khoa: d.khoa, giaVon: d.giaVon, giaBan: d.giaBan });
    const ketThucGo = () => dispatch({ type: "ketThucGo" });
    const nhanSoLuong = !laSua
        ? chuaCoKichCo
            ? t("Chưa chọn kích cỡ")
            : t("{{soTao}}/{{tong}} kích cỡ", { count: dong.length, soTao, tong: dong.length })
        : soCu + soTao === 0
          ? chuaCoKichCo
              ? t("Chưa chọn kích cỡ")
              : t("Chưa tạo biến thể")
          : t("{{count}} biến thể", { count: soCu + soTao }) + (soTao > 0 ? t(" · {{soTao}} mới", { soTao }) : "");
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
                            aria-label={laSua ? t("Tạo mọi kích cỡ mới của màu {{tenMau}}", { tenMau: mau.tenMau }) : t("Tạo mọi kích cỡ của màu {{tenMau}}", { tenMau: mau.tenMau })}
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
                            aria-label={thuGon ? t("Mở màu {{tenMau}}", { tenMau: mau.tenMau }) : t("Thu gọn màu {{tenMau}}", { tenMau: mau.tenMau })}
                            className="flex size-6 items-center justify-center rounded text-bo-muted hover:bg-bo-border focus-visible:outline-2 focus-visible:outline-bo-primary"
                        >
                            {thuGon ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                        <ChamMau hex={mau.maMauHex} className="size-4" />
                        <span className="font-semibold text-bo-foreground">{mau.tenMau}</span>
                        <span className="font-mono text-xs text-bo-muted">{mau.maMau}</span>
                        <span className="rounded-full border border-bo-border bg-bo-surface px-2 py-0.5 text-xs text-bo-foreground">
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
                                {anh && anhCu ? t("Ảnh mới cho cả {{count}} biến thể", { count: soCu + soTao }) : t("{{count}} biến thể dùng chung ảnh", { count: soCu + soTao })}
                            </span>
                        ) : (
                            soTao > 0 && (
                                <span className={cn("inline-flex items-center gap-1 text-xs", thieuAnh ? "font-medium text-bo-danger" : "text-bo-muted")}>
                                    {thieuAnh && <AlertTriangle className="size-3.5" aria-hidden="true" />}
                                    {thieuAnh ? t("Thiếu ảnh màu") : t("Cần 1 ảnh cho màu này")}
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
                        placeholder={t("Giá nhóm")}
                        disabled={disabled || !coGiaVonSuaDuoc}
                        aria-label={t("Giá vốn nhóm màu {{tenMau}}", { tenMau: mau.tenMau })}
                    />
                </td>
                <td className="px-3 py-2">
                    {/* Bóng đèn nâng thẳng các cỡ đang trống hoặc thấp hơn; không điền vào ô giá nhóm vì Áp cho màu
                        đặt mọi cỡ về một giá, sẽ hạ cả cỡ đang bán cao hơn. */}
                    <OGiaCoGoiY
                        muc={mucMau}
                        toMauO={false}
                        moTa={mucMau ? MO_TA_MUC_MAU[mucMau] : undefined}
                        nhanMo={t("Xem lãi các cỡ màu {{tenMau}}", { tenMau: mau.tenMau })}
                        noiDung={(xong) => (
                            <NoiDungGoiYMau
                                dong={dong}
                                giaSanMau={giaSanMau}
                                soCanNang={soCanNangMau}
                                onNang={() => dispatch({ type: "nangGiaBanTheoMau", giaTheoMau: { [mauSacId]: giaSanMau } })}
                                xong={xong}
                            />
                        )}
                        value={giaMau.giaBan}
                        onChange={(giaTri) => dispatch({ type: "suaGiaMau", mauSacId, truong: "giaBan", giaTri })}
                        onEnter={() => dispatch({ type: "apDungGiaMau", mauSacId })}
                        placeholder={t("Giá nhóm")}
                        disabled={disabled || !coGiaBanSuaDuoc}
                        aria-label={t("Giá bán nhóm màu {{tenMau}}", { tenMau: mau.tenMau })}
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
                        {t("Áp cho màu")}
                    </Button>
                </td>
            </tr>
            {!thuGon &&
                dong.map((d) => {
                    const laCu = d.loai === "cu";
                    const size = sizeTheoId.get(d.sizeId);
                    const ten = `${mau.tenMau} ${size?.tenSize || size?.maSize || ""}`;
                    // Biến thể đã lưu phải có giá; data-thieu-gia để khung lỗi đưa con trỏ tới đúng ô.
                    const coTheThieuGiaVon = laCu && !d.khoaGia;
                    const coTheThieuGiaBan = laCu && !d.khoaGiaBan;
                    const thieuGiaVon = coTheThieuGiaVon && hienLoi && d.giaVon === "";
                    const thieuGiaBan = coTheThieuGiaBan && hienLoi && d.giaBan === "";
                    // Mức theo giá đã chốt: đang gõ thì giữ màu lúc bắt đầu gõ, rời ô (hoặc Enter) mới tính lại.
                    const muc = mucCuaDong(d, dangGo);
                    return (
                        <tr key={d.khoa} className={cn("border-b border-bo-border transition-colors last:border-b-0 hover:bg-bo-surface-subtle/60", !d.tao && "opacity-50")}>
                            <td className="px-3 py-1.5">
                                {!laCu && (
                                    <Checkbox
                                        checked={d.tao}
                                        disabled={disabled}
                                        onCheckedChange={() => dispatch({ type: "batTatToHop", khoa: d.khoa })}
                                        aria-label={t("Tạo biến thể {{ten}}", { ten })}
                                        className={CHECKBOX_CLASS}
                                    />
                                )}
                            </td>
                            <td className="px-3 py-1.5 pl-12 text-bo-foreground">
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    {size?.tenSize || size?.maSize}
                                    {d.daDoi && (
                                        <span className="rounded bg-bo-primary-soft px-1.5 py-px text-[10px] font-semibold text-bo-primary">{t("Đã đổi")}</span>
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
                                    <GiaKhoa value={d.giaVon} nhan={t("Giá vốn {{ten}}", { ten })} />
                                ) : (
                                    <OTien
                                        cot="giaVon"
                                        value={d.giaVon}
                                        onChange={(giaTri) => dispatch({ type: "suaGia", khoa: d.khoa, truong: "giaVon", giaTri })}
                                        onFocus={() => batDauGo(d)}
                                        onBlur={ketThucGo}
                                        placeholder="0"
                                        disabled={disabled || !d.tao}
                                        aria-label={t("Giá vốn {{ten}}", { ten })}
                                        data-thieu-gia={coTheThieuGiaVon && d.giaVon === "" ? "" : undefined}
                                        aria-invalid={thieuGiaVon || undefined}
                                        className={thieuGiaVon ? "border-bo-danger" : undefined}
                                    />
                                )}
                            </td>
                            <td className="px-3 py-1.5">
                                {d.khoaGiaBan ? (
                                    <GiaKhoa value={d.giaBan} nhan={t("Giá bán {{ten}}", { ten })} ghiChu={GIA_BAN_KHOA} />
                                ) : (
                                    <OGiaCoGoiY
                                        muc={muc}
                                        moTa={muc ? MO_TA_MUC[muc] : undefined}
                                        nhanMo={t("Xem lãi và giá sàn của {{ten}}", { ten })}
                                        noiDung={(xong) => (
                                            <NoiDungGoiYDong
                                                dong={d}
                                                onDatGia={(giaTri) => dispatch({ type: "suaGia", khoa: d.khoa, truong: "giaBan", giaTri })}
                                                xong={xong}
                                            />
                                        )}
                                        onChot={() => batDauGo(d)}
                                        onFocus={() => batDauGo(d)}
                                        onBlur={ketThucGo}
                                        cot="giaBan"
                                        value={d.giaBan}
                                        onChange={(giaTri) => dispatch({ type: "suaGia", khoa: d.khoa, truong: "giaBan", giaTri })}
                                        placeholder="0"
                                        disabled={disabled || !d.tao}
                                        aria-label={t("Giá bán {{ten}}", { ten })}
                                        data-thieu-gia={coTheThieuGiaBan && d.giaBan === "" ? "" : undefined}
                                        aria-invalid={thieuGiaBan || undefined}
                                        className={thieuGiaBan ? "border-bo-danger" : undefined}
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
                                                aria-label={t("Đổi màu sắc, kích cỡ của {{ten}}", { ten })}
                                                title={t("Đổi màu sắc, kích cỡ (biến thể chưa phát sinh giao dịch)")}
                                                className="flex size-7 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-bo-primary-soft hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary disabled:opacity-50"
                                            >
                                                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ) : !d.tao ? (
                                    <span className="text-bo-muted">{t("Không tạo")}</span>
                                ) : (
                                    laSua && (
                                        <span className="rounded-full bg-bo-primary-soft px-2 py-0.5 font-semibold text-bo-primary">{t("Mới")}</span>
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
            <span className="text-xs italic text-bo-muted" title={t("Mã hiện tại: {{maSku}}", { maSku: dong.maSku })}>
                {t("Tạo lại khi lưu")}
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
