import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Ban, Check, Download, RotateCcw, RotateCw, Truck } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import { GHI_CHU_HOP, GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import {
    HINH_THUC_VAN_CHUYEN,
    KY_HIEU_XKNB_RE,
    LY_DO_DIEU_DONG,
    LY_DO_GIAO_BU,
    PHUONG_AN_CHENH_LECH,
    TT_CHUYEN,
    XKNB_CHE_DO,
} from "@/constants/phieuChuyenKho";
import {
    aiXuLyChenhLechHienThi,
    kiemTraGhiSoXknb,
    kiemTraXacNhanXuat,
    tongCot,
} from "@/components/chuyen-kho/hienThiChuyenKho";
import { VI_DU_BIEN_SO, kiemTraBienSo, loiKhiDangGo } from "@/components/chuyen-kho/bienSoXe";
import { t } from "@/i18n";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;

/** Hàng đã xuất của phiếu đang ở đâu (hộp Ghi số XKNB mở được cả sau khi đã nhận hoặc đã hủy). */
const tinhTrangHangDaXuat = (trangThai) =>
    trangThai === TT_CHUYEN.DANG_VAN_CHUYEN ? t("đang trên đường")
        : trangThai === TT_CHUYEN.DA_HUY ? t("đã xuất rồi phiếu bị hủy")
            : t("đã giao tới kho nhận");
const Sao = () => <span className="text-bo-danger">*</span>;
/** Khung cảnh báo trong hộp: cùng dáng LOI_HOP, tông cảnh báo (chữ bo-warning trên nền bo-warning-soft ≥ 4,5:1). */
const CANH_BAO_HOP = "rounded-lg border border-bo-warning/30 bg-bo-warning-soft px-3 py-2.5 text-[13px] leading-5 text-bo-warning";

function O({ nhan, batBuoc, loi, goiY, children, className }) {
    const id = useId();
    return (
        // content-start: ô đứng cạnh ô có dòng gợi ý / lỗi bị kéo cao bằng, giữ nhãn và ô nhập sát trên để hai cột thẳng hàng
        <div className={cn("grid content-start gap-1.5", className)}>
            <label htmlFor={id} className={NHAN_O}>
                {nhan} {batBuoc ? <Sao /> : null}
            </label>
            {children({ id, "aria-invalid": loi ? true : undefined, "aria-describedby": loi || goiY ? `${id}-mo-ta` : undefined })}
            {loi ? (
                <span id={`${id}-mo-ta`} className="text-xs leading-4 text-bo-danger">{loi}</span>
            ) : goiY ? (
                <span id={`${id}-mo-ta`} className={GOI_Y_O}>{goiY}</span>
            ) : null}
        </div>
    );
}

const lopO = (loi, them) => cn(O_NHAP, loi && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15", them);

/** Nhóm lựa chọn dạng thẻ (radio) cho lý do điều động, phương án xử lý chênh lệch. */
function ChonThe({ nhan, luaChon, value, onChange, loi }) {
    const id = useId();
    return (
        <fieldset className="grid gap-1.5">
            <legend className={cn(NHAN_O, "mb-1.5")}>
                {nhan} <Sao />
            </legend>
            <div className="grid gap-1.5" role="radiogroup" aria-describedby={loi ? `${id}-loi` : undefined}>
                {luaChon.map((lc) => (
                    <label
                        key={lc.ma}
                        className={cn(
                            // Màn cảm ứng: thẻ lựa chọn cao tối thiểu 44px (một dòng chữ chỉ được 42px)
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm leading-5 transition-colors cam-ung:min-h-11",
                            value === lc.ma ? "border-bo-primary bg-bo-primary-soft" : "border-bo-border hover:bg-bo-surface-subtle",
                        )}
                    >
                        <input
                            type="radio"
                            name={id}
                            value={lc.ma}
                            checked={value === lc.ma}
                            onChange={() => onChange(lc.ma)}
                            className="mt-0.5 size-4 accent-[var(--color-bo-primary)]"
                        />
                        <span className="min-w-0">
                            <span className="font-medium text-bo-foreground">{lc.nhan}</span>
                            {lc.moTa ? <span className="block text-[13px] text-bo-muted">{lc.moTa}</span> : null}
                        </span>
                    </label>
                ))}
            </div>
            {loi ? <span id={`${id}-loi`} className="text-xs leading-4 text-bo-danger">{loi}</span> : null}
        </fieldset>
    );
}

/** Duyệt và lập lệnh điều động (B.2). */
export function HopDuyet({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [lyDo, setLyDo] = useState("BO_SUNG");
    const [ghiChu, setGhiChu] = useState("");
    const [daBam, setDaBam] = useState(false);
    // Phiếu giao bù còn chờ duyệt (quản lý kho xuất chọn Giao bù theo Cấu hình): lý do luôn là Giao bù hàng, máy chủ ghi
    // phiếu gốc và biên bản vào ghi chú lệnh như phiếu giao bù tự duyệt
    const laGiaoBu = Boolean(ct.phieuGoc);
    const thieuGhiChu = !laGiaoBu && lyDo === "KHAC" && !ghiChu.trim();
    const tong = tongCot(ct.hang, "soLuongChuyen");
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Duyệt và lập lệnh điều động")}
            moTa={t("Hàng {{so}} sản phẩm được xuất khỏi {{khoXuat}} sang {{khoNhap}} theo lệnh này. Số lệnh do hệ thống cấp sau khi lưu.", { count: tong, so: soVN(tong), khoXuat: ct.khoXuat?.ten, khoNhap: ct.khoNhap?.ten })}
            nhanXacNhan={t("Duyệt và lập lệnh")}
            iconXacNhan={Check}
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => {
                setDaBam(true);
                if (thieuGhiChu) return;
                onXacNhan(laGiaoBu
                    ? { lyDoDieuDong: LY_DO_GIAO_BU.ma }
                    : { lyDoDieuDong: lyDo, ghiChuLenh: ghiChu.trim() || null });
            }}
        >
            {laGiaoBu ? (
                <p className="m-0 text-[13px] leading-5 text-bo-foreground">
                    <span className="text-bo-muted">{t("Lý do điều động:")} </span>
                    <B>{t("{{lyDo}} cho phiếu {{so}}", { lyDo: t(LY_DO_GIAO_BU.nhan), so: ct.phieuGoc.so })}</B> {t("(hệ thống ghi kèm số biên bản của phiếu gốc).")}
                </p>
            ) : (
                <>
                    <ChonThe nhan={t("Lý do điều động")} luaChon={LY_DO_DIEU_DONG.map((x) => ({ ...x, nhan: t(x.nhan) }))} value={lyDo} onChange={setLyDo} />
                    <O nhan={lyDo === "KHAC" ? t("Ghi rõ lý do") : t("Ghi chú")} batBuoc={lyDo === "KHAC"} loi={daBam && thieuGhiChu ? t("Ghi rõ lý do điều động") : null}>
                        {(p) => (
                            <textarea
                                {...p}
                                value={ghiChu}
                                maxLength={500}
                                onChange={(e) => setGhiChu(e.target.value)}
                                placeholder={t("Ví dụ: chuẩn bị hàng cho đợt khuyến mãi cuối tuần")}
                                className={cn(O_NHAP_NHIEU_DONG, daBam && thieuGhiChu && "border-bo-danger")}
                            />
                        )}
                    </O>
                </>
            )}
        </HopXacNhanChungTu>
    );
}

/**
 * Số phiếu XKNB tiếp theo của ký hiệu (đặc tả BA mục 1.3: số nhảy tăng dần theo ký hiệu), lấy từ máy chủ.
 * `datSo(so, buoc)`: buoc = true khi người dùng bấm "Lấy số tiếp theo" (ghi đè cả số đã tự gõ). Chỉ nhận kết quả của lần
 * gọi mới nhất (đổi ký hiệu liên tiếp); lỗi thì bỏ qua, người dùng tự gõ số như cũ.
 */
function useSoXknbTiepTheo(datSo) {
    const [dangLay, setDangLay] = useState(false);
    const lanRef = useRef(0);
    const lay = useCallback(async (kyHieu, buoc = false) => {
        const kh = String(kyHieu ?? "").trim().toUpperCase();
        if (!KY_HIEU_XKNB_RE.test(kh)) return;
        const lan = ++lanRef.current;
        setDangLay(true);
        try {
            const kq = await phieuChuyenKhoService.soXknbTiepTheo(kh);
            if (lan === lanRef.current && kq?.soPhieuXknb) datSo(kq.soPhieuXknb, buoc);
        } catch {
            // Không lấy được số gợi ý: để trống cho người dùng tự gõ
        } finally {
            if (lan === lanRef.current) setDangLay(false);
        }
    }, [datSo]);
    return { dangLay, lay };
}

/**
 * Form giấy đi đường của hai hộp Xác nhận xuất / Ghi số: tự điền số tiếp theo khi mở hộp và khi đổi sang ký hiệu hợp lệ,
 * trừ khi người dùng đã tự gõ số (`daGoSo`). `khiCoSoMoi`: hộp xóa cảnh báo "chưa có số" khi số được điền.
 */
function useFormXknb(khoiTao, khiCoSoMoi) {
    const [form, setForm] = useState(() => ({ ...khoiTao, daGoSo: false }));
    const khiCoSoMoiRef = useRef(khiCoSoMoi);
    useEffect(() => {
        khiCoSoMoiRef.current = khiCoSoMoi;
    });
    const datSo = useCallback((so, buoc) => {
        setForm((f) => (f.daGoSo && !buoc ? f : { ...f, soXknb: so, daGoSo: false }));
        khiCoSoMoiRef.current?.();
    }, []);
    const { dangLay, lay } = useSoXknbTiepTheo(datSo);
    useEffect(() => {
        // Lần mở hộp: ký hiệu điền sẵn từ cấu hình thì lấy luôn số tiếp theo
        queueMicrotask(() => lay(khoiTao.kyHieu));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const doiXknb = (khoa, giaTri) => {
        setForm((f) => ({ ...f, [khoa]: giaTri, ...(khoa === "soXknb" ? { daGoSo: true } : null) }));
        if (khoa === "kyHieu") lay(giaTri);
    };
    return { form, setForm, doiXknb, dangLaySo: dangLay, laySo: () => lay(form.kyHieu, true) };
}

function KhungXknb({ form, doi, loi, chiGhiSo, cheDo, onTaiDuLieu, laySo, dangLaySo }) {
    const [them, setThem] = useState(Boolean(form.ngayLap || form.maTraCuu));
    const kyHieuHopLe = KY_HIEU_XKNB_RE.test(String(form.kyHieu ?? "").trim());
    return (
        <div className="grid gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle px-3.5 py-3">
            <div>
                <div className="text-sm font-semibold text-bo-foreground">
                    {t("Giấy đi đường (phiếu XKNB)")} {cheDo === XKNB_CHE_DO.CHAN || chiGhiSo ? <Sao /> : null}
                </div>
                <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{t("Xe chở hàng phải mang theo bản in phiếu này.")}</p>
            </div>
            {onTaiDuLieu ? (
                <ol className="grid gap-1 text-[13px] leading-5 text-bo-foreground">
                    <li>
                        1.{" "}
                        <button type="button" onClick={onTaiDuLieu} className="inline-flex items-center gap-1 font-medium text-bo-primary hover:underline">
                            <Download className="size-3.5" aria-hidden="true" />
                            {t("Tải dữ liệu chuyến hàng")}
                        </button>{" "}
                        {t("— tệp có sẵn danh sách hàng, kho đi, kho đến, người chở.")}
                    </li>
                    <li>{t("2. Nạp tệp vào phần mềm hóa đơn điện tử của công ty (MISA, VNPT, Viettel…) và phát hành phiếu.")}</li>
                    <li>{t("3. Ghi ký hiệu và số của phiếu vừa phát hành vào hai ô dưới đây.")}</li>
                </ol>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                <O nhan={t("Ký hiệu")} batBuoc={chiGhiSo || cheDo === XKNB_CHE_DO.CHAN} loi={loi.kyHieu} goiY={t("Ví dụ 6K26NAB")}>
                    {(p) => (
                        <input {...p} value={form.kyHieu} maxLength={7} autoComplete="off" onChange={(e) => doi("kyHieu", e.target.value.toUpperCase())} className={lopO(loi.kyHieu, "font-mono uppercase")} />
                    )}
                </O>
                <O
                    nhan={t("Số phiếu")}
                    batBuoc={chiGhiSo || cheDo === XKNB_CHE_DO.CHAN}
                    loi={loi.soXknb}
                    goiY={dangLaySo ? t("Đang lấy số tiếp theo…") : kyHieuHopLe && form.soXknb ? t("Sửa nếu khác số trên phiếu") : t("7 chữ số, ví dụ 0000125")}
                >
                    {(p) => (
                        <input {...p} value={form.soXknb} maxLength={7} inputMode="numeric" autoComplete="off" onChange={(e) => doi("soXknb", e.target.value.replace(/\D/g, ""))} className={lopO(loi.soXknb, "font-mono")} />
                    )}
                </O>
            </div>
            {kyHieuHopLe && laySo ? (
                <button
                    type="button"
                    onClick={laySo}
                    disabled={dangLaySo}
                    className="inline-flex items-center gap-1 justify-self-start text-[13px] font-medium text-bo-primary hover:underline disabled:cursor-wait disabled:opacity-60"
                >
                    <RotateCw className={cn("size-3.5", dangLaySo && "animate-spin")} aria-hidden="true" />
                    {t("Lấy số tiếp theo của {{kyHieu}}", { kyHieu: String(form.kyHieu).trim().toUpperCase() })}
                </button>
            ) : null}
            <button type="button" aria-expanded={them} onClick={() => setThem((x) => !x)} className="justify-self-start text-[13px] font-medium text-bo-primary hover:underline">
                {them ? t("Ẩn thông tin thêm") : t("Thông tin thêm: ngày lập, mã tra cứu")}
            </button>
            {them ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <O nhan={t("Ngày lập")}>
                        {(p) => <input {...p} type="date" value={form.ngayLap} onChange={(e) => doi("ngayLap", e.target.value)} className={O_NHAP} />}
                    </O>
                    <O nhan={t("Mã tra cứu")}>
                        {(p) => <input {...p} value={form.maTraCuu} maxLength={100} autoComplete="off" onChange={(e) => doi("maTraCuu", e.target.value)} className={cn(O_NHAP, "font-mono")} />}
                    </O>
                </div>
            ) : null}
            {!chiGhiSo ? (
                <p className="text-[13px] leading-5 text-bo-muted">
                    {cheDo === XKNB_CHE_DO.CHI_CANH_BAO
                        ? t("Đang bật Chỉ cảnh báo trong Cấu hình › Chứng từ và hóa đơn: được xuất trước, ghi số sau.")
                        : t("Công ty chưa dùng phần mềm hóa đơn điện tử? Quản trị viên đổi sang \"Chỉ cảnh báo\" ở Cấu hình › Chứng từ và hóa đơn để xuất trước, ghi số sau.")}
                </p>
            ) : null}
        </div>
    );
}

const FORM_XUAT_TRONG = {
    hinhThuc: "XE_CONG_TY", nguoi: "", sdt: "", loaiPhuongTien: "", bienSo: "", donVi: "", maVanDon: "", duKienDen: "",
    kyHieu: "", soXknb: "", ngayLap: "", maTraCuu: "",
};

/** Xác nhận xuất (B.3): người vận chuyển, phương tiện, giấy đi đường; chế độ Chặn xuất / Chỉ cảnh báo khi chưa có số. */
export function HopXacNhanXuat({ mo, onDong, ct, dangChay, loi, onXacNhan, onTaiDuLieu }) {
    const idGoiYDuKien = useId();
    const [loiO, setLoiO] = useState({});
    const [chan, setChan] = useState(null);
    // Chỉ cảnh báo: lần bấm đầu báo chưa có số; bấm "Vẫn xuất khi chưa có số" lần nữa mới gửi
    const [hoiThieu, setHoiThieu] = useState(false);
    const boCanhBaoSo = () => {
        setHoiThieu(false);
        setChan(null);
        setLoiO((l) => (l.soXknb ? { ...l, soXknb: undefined } : l));
    };
    const { form, setForm, doiXknb, dangLaySo, laySo } = useFormXknb(
        { ...FORM_XUAT_TRONG, kyHieu: ct.xknbKyHieuMacDinh ?? "" },
        boCanhBaoSo,
    );
    const doi = (khoa, giaTri) => {
        if (khoa === "kyHieu" || khoa === "soXknb") {
            doiXknb(khoa, giaTri);
            boCanhBaoSo();
        } else {
            setForm((f) => ({ ...f, [khoa]: giaTri }));
        }
        setLoiO((l) => (l[khoa] ? { ...l, [khoa]: undefined } : l));
    };
    // Gõ ô Biển số: chắc chắn sai thì báo ngay, đang gõ dở thì chưa báo
    const goBienSo = (giaTri) => {
        doi("bienSo", giaTri);
        const loiGo = loiKhiDangGo(giaTri);
        if (loiGo) setLoiO((l) => ({ ...l, bienSo: loiGo }));
    };
    // Rời ô Biển số: đúng mẫu thì đổi sang cách viết chuẩn, sai thì báo ngay; để trống thì đợi bấm Xác nhận xuất
    const roiOBienSo = () => {
        if (!form.bienSo.trim()) return;
        const kq = kiemTraBienSo(form.bienSo);
        if (kq.hopLe) setForm((f) => ({ ...f, bienSo: kq.giaTri }));
        // Giữ câu cụ thể lúc đang gõ (vd. mã tỉnh sai) thay vì câu chung "Chưa đúng mẫu"
        else setLoiO((l) => ({ ...l, bienSo: loiKhiDangGo(form.bienSo) ?? kq.loi }));
    };
    const ht = form.hinhThuc;
    const canPhuongTien = ht === "XE_CONG_TY" || ht === "THUE_NGOAI";
    const canDonVi = ht === "THUE_NGOAI" || ht === "CHUYEN_PHAT";
    const tong = tongCot(ct.hang, "soLuongChuyen");

    const bam = () => {
        const kq = kiemTraXacNhanXuat(form, ct.xknbCheDo, hoiThieu);
        setLoiO(kq.loi);
        setChan(kq.chan);
        if (kq.canhBaoThieu && !Object.keys(kq.loi).length) {
            setHoiThieu(true);
            return;
        }
        if (kq.yeuCau) onXacNhan(kq.yeuCau);
    };

    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Xác nhận xuất")}
            moTa={t("Trừ {{so}} sản phẩm khỏi {{khoXuat}}. Hàng chuyển sang đang vận chuyển và do người vận chuyển chịu trách nhiệm.", { count: tong, so: soVN(tong), khoXuat: ct.khoXuat?.ten })}
            nhanXacNhan={hoiThieu ? t("Vẫn xuất khi chưa có số") : t("Xác nhận xuất")}
            iconXacNhan={Truck}
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={bam}
        >
            {chan ? <p role="alert" className="rounded-lg border border-bo-danger/25 bg-bo-danger-soft px-3 py-2.5 text-[13px] leading-5 text-bo-danger-strong">{chan}</p> : null}
            {hoiThieu ? (
                <p role="alert" className={CANH_BAO_HOP}>
                    {t("Chưa có ký hiệu và số phiếu XKNB. Đang bật Chỉ cảnh báo nên hàng vẫn xuất được; phiếu sẽ nằm ở mục")} <B>{t("Thiếu giấy đi đường")}</B> {t("cho tới khi ghi số.")}
                </p>
            ) : null}
            <div className="grid gap-1.5">
                <span className={NHAN_O}>
                    {t("Hình thức vận chuyển")} <Sao />
                </span>
                {/* Ba lựa chọn chia đều hết chiều ngang, thẳng mép với hai cột ô nhập bên dưới (không để thừa nền xám);
                    điện thoại quá hẹp thì mỗi ô giữ đủ chữ và thanh cuộn ngang như cũ, không đè chữ */}
                <NutPhanDoan
                    nhan={t("Hình thức vận chuyển")}
                    className="grid w-full grid-cols-[repeat(3,minmax(max-content,1fr))]"
                    value={ht}
                    onChange={(v) => doi("hinhThuc", v)}
                    luaChon={HINH_THUC_VAN_CHUYEN.map((h) => ({ value: h.ma, label: t(h.nhan) }))}
                />
            </div>
            {canDonVi ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <O nhan={ht === "CHUYEN_PHAT" ? t("Đơn vị chuyển phát") : t("Đơn vị vận chuyển")} batBuoc loi={loiO.donVi}>
                        {(p) => <input {...p} value={form.donVi} maxLength={150} onChange={(e) => doi("donVi", e.target.value)} className={lopO(loiO.donVi)} />}
                    </O>
                    <O nhan={ht === "CHUYEN_PHAT" ? t("Mã vận đơn") : t("Số hợp đồng vận chuyển")} batBuoc={ht === "CHUYEN_PHAT"} loi={loiO.maVanDon}>
                        {(p) => <input {...p} value={form.maVanDon} maxLength={50} onChange={(e) => doi("maVanDon", e.target.value)} className={lopO(loiO.maVanDon)} />}
                    </O>
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                <O nhan={t("Người vận chuyển")} batBuoc loi={loiO.nguoi}>
                    {(p) => <input {...p} value={form.nguoi} maxLength={100} autoComplete="off" onChange={(e) => doi("nguoi", e.target.value)} className={lopO(loiO.nguoi)} />}
                </O>
                <O nhan={t("Điện thoại")} batBuoc loi={loiO.sdt}>
                    {(p) => <input {...p} value={form.sdt} maxLength={12} inputMode="tel" autoComplete="off" onChange={(e) => doi("sdt", e.target.value)} className={lopO(loiO.sdt, "tabular-nums")} />}
                </O>
            </div>
            {canPhuongTien ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <O nhan={t("Phương tiện")} batBuoc loi={loiO.loaiPhuongTien}>
                        {(p) => <input {...p} value={form.loaiPhuongTien} maxLength={50} placeholder={t("Ví dụ: xe tải 1,5 tấn")} onChange={(e) => doi("loaiPhuongTien", e.target.value)} className={lopO(loiO.loaiPhuongTien)} />}
                    </O>
                    {/* Ví dụ để ở chữ mờ như ô Phương tiện: hàng hai cột không có dòng gợi ý lệch nhau */}
                    <O nhan={t("Biển số")} batBuoc loi={loiO.bienSo}>
                        {(p) => (
                            <input
                                {...p}
                                value={form.bienSo}
                                maxLength={20}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={VI_DU_BIEN_SO}
                                onChange={(e) => goBienSo(e.target.value.toUpperCase())}
                                onBlur={roiOBienSo}
                                className={lopO(loiO.bienSo, "uppercase placeholder:normal-case")}
                            />
                        )}
                    </O>
                </div>
            ) : null}
            {/* Gợi ý nằm ở nửa phải còn trống, ngang ô ngày giờ: hàng không cao thêm, các hàng cách đều nhau */}
            <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                <O nhan={t("Dự kiến đến")} loi={loiO.duKienDen}>
                    {(p) => (
                        <input
                            {...p}
                            aria-describedby={[p["aria-describedby"], idGoiYDuKien].filter(Boolean).join(" ")}
                            type="datetime-local"
                            value={form.duKienDen}
                            onChange={(e) => doi("duKienDen", e.target.value)}
                            className={lopO(loiO.duKienDen)}
                        />
                    )}
                </O>
                <p id={idGoiYDuKien} className={cn(GOI_Y_O, "items-center sm:mt-[26px] sm:h-9")}>
                    {t("Quá giờ này mà kho nhận chưa nhận, phiếu hiện ở mục Trễ hẹn")}
                </p>
            </div>
            <KhungXknb
                form={form}
                doi={doi}
                loi={loiO}
                cheDo={ct.xknbCheDo}
                onTaiDuLieu={() => onTaiDuLieu(form)}
                laySo={laySo}
                dangLaySo={dangLaySo}
            />
        </HopXacNhanChungTu>
    );
}

/** Ghi số phiếu XKNB sau khi đã xuất ("xuất trước, ghi số sau"). */
export function HopGhiSoXknb({ mo, onDong, ct, dangChay, loi, onXacNhan, onTaiDuLieu }) {
    const [loiO, setLoiO] = useState({});
    const { form, setForm, doiXknb, dangLaySo, laySo } = useFormXknb(
        { kyHieu: ct.xknbKyHieuMacDinh ?? "", soXknb: "", ngayLap: "", maTraCuu: "" },
        () => setLoiO((l) => (l.soXknb ? { ...l, soXknb: undefined } : l)),
    );
    const doi = (khoa, giaTri) => {
        if (khoa === "kyHieu" || khoa === "soXknb") doiXknb(khoa, giaTri);
        else setForm((f) => ({ ...f, [khoa]: giaTri }));
        setLoiO((l) => (l[khoa] ? { ...l, [khoa]: undefined } : l));
    };
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Ghi số phiếu XKNB")}
            moTa={t("Hàng của {{phieu}} {{tinhTrang}} mà chưa có số phiếu XKNB. Ghi số ngay khi phần mềm hóa đơn điện tử phát hành.", { phieu: ct.soPhieuChuyen, tinhTrang: tinhTrangHangDaXuat(ct.trangThai) })}
            nhanXacNhan={t("Lưu số XKNB")}
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => {
                const kq = kiemTraGhiSoXknb(form);
                setLoiO(kq.loi);
                if (kq.yeuCau) onXacNhan(kq.yeuCau);
            }}
        >
            <KhungXknb form={form} doi={doi} loi={loiO} chiGhiSo cheDo={ct.xknbCheDo} onTaiDuLieu={onTaiDuLieu} laySo={laySo} dangLaySo={dangLaySo} />
        </HopXacNhanChungTu>
    );
}

/**
 * Quản lý Kho tổng từ chối phiếu Chờ duyệt (BF-04): lý do bắt buộc. Cùng cách với hộp Từ chối của Yêu cầu nhập hàng:
 * nút xác nhận khóa tới khi có lý do, ô khóa khi đang gửi.
 */
export function HopTuChoi({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [lyDo, setLyDo] = useState("");
    const tong = tongCot(ct.hang, "soLuongChuyen");
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Từ chối yêu cầu chuyển kho")}
            moTa={t("Phiếu chuyển sang Đã hủy, {{so}} sản phẩm đang giữ chỗ được trả về tồn {{khoXuat}}. Người lập phiếu và quản lý hai kho nhận thông báo kèm lý do.", { count: tong, so: soVN(tong), khoXuat: ct.khoXuat?.ten ?? t("kho xuất") })}
            nhanXacNhan={t("Từ chối")}
            kieu="nguyHiem"
            dangChay={dangChay}
            khoaXacNhan={!lyDo.trim()}
            lyDoKhoa={t("Nhập lý do từ chối")}
            loi={loi}
            onXacNhan={() => onXacNhan({ lyDo: lyDo.trim() })}
        >
            <O nhan={t("Lý do từ chối")} batBuoc goiY={t("Bắt buộc · {{dem}}/255", { dem: lyDo.length })}>
                {(p) => (
                    <textarea
                        {...p}
                        aria-required="true"
                        value={lyDo}
                        maxLength={255}
                        disabled={dangChay}
                        onChange={(e) => setLyDo(e.target.value)}
                        placeholder={t("Ví dụ: Kho tổng đang kiểm kê, gửi lại yêu cầu vào tuần sau")}
                        className={O_NHAP_NHIEU_DONG}
                    />
                )}
            </O>
        </HopXacNhanChungTu>
    );
}

/** Hủy phiếu (A5): lý do không bắt buộc. */
export function HopHuy({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [lyDo, setLyDo] = useState("");
    const dangDi = ct.trangThai === "DANG_VAN_CHUYEN";
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Hủy phiếu chuyển kho")}
            moTa={dangDi
                ? t("Hàng đang trên đường. Sau khi hủy, {{khoXuat}} nhập hàng hoàn trả để đưa hàng về kho.", { khoXuat: ct.khoXuat?.ten })
                : t("Phiếu xuất chờ nhặt (nếu có) bị hủy theo và hàng đang giữ chỗ được trả về tồn {{khoXuat}}.", { khoXuat: ct.khoXuat?.ten })}
            nhanXacNhan={t("Hủy phiếu")}
            iconXacNhan={Ban}
            kieu="nguyHiem"
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => onXacNhan({ lyDo: lyDo.trim() || null })}
        >
            <O nhan={t("Lý do hủy")} goiY={t("Không bắt buộc · {{dem}}/255", { dem: lyDo.length })}>
                {(p) => <textarea {...p} value={lyDo} maxLength={255} onChange={(e) => setLyDo(e.target.value)} className={O_NHAP_NHIEU_DONG} />}
            </O>
        </HopXacNhanChungTu>
    );
}

/** Nhập hàng hoàn trả khi phiếu bị hủy lúc hàng đang trên đường. */
export function HopNhapHoanTra({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const con = tongCot(ct.hang, "conTrenDuong");
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Nhập hàng hoàn trả")}
            moTa={t("Lập và hoàn tất phiếu nhập hoàn trả: đưa {{so}} sản phẩm của {{phieu}} từ kho trung chuyển về lại {{khoXuat}}, đúng lô đã xuất.", { count: con, so: soVN(con), phieu: ct.soPhieuChuyen, khoXuat: ct.khoXuat?.ten })}
            nhanXacNhan={t("Nhập hàng hoàn trả")}
            iconXacNhan={RotateCcw}
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => onXacNhan()}
        />
    );
}

/**
 * Bảng dòng lệch của biên bản (thiếu / hỏng theo lô) trong hộp thoại, cùng cách với hộp lập biên bản ở màn nhận hàng:
 * bảng table-fixed, khung KHÔNG đặt overflow — thân hộp là lưới có chiều cao giới hạn, khung có overflow bị bóp tới mức
 * chỉ còn dòng tiêu đề khi nội dung dài hơn màn hình (lỗi Hình 4, 03/11). Tên sản phẩm, màu / cỡ, lô một dòng; lý do
 * dòng riêng dưới số lượng nên hộp 560px không phải cuộn ngang.
 */
function BangDongLech({ dong }) {
    return (
        <div className="rounded-lg border border-bo-border">
            <table className="w-full table-fixed text-[13px]">
                <thead className="text-left text-xs text-bo-muted">
                    <tr>
                        <th className="rounded-tl-lg bg-bo-surface-subtle px-3 py-2 font-medium">{t("Sản phẩm")}</th>
                        <th className="w-11 bg-bo-surface-subtle px-1.5 py-2 text-right font-medium sm:w-14 sm:px-2">{t("Gửi", { context: "so_luong" })}</th>
                        <th className="w-11 bg-bo-surface-subtle px-1.5 py-2 text-right font-medium sm:w-14 sm:px-2">{t("Đạt")}</th>
                        <th className="w-11 bg-bo-surface-subtle px-1.5 py-2 text-right font-medium sm:w-14 sm:px-2">{t("Hỏng")}</th>
                        <th className="w-12 rounded-tr-lg bg-bo-surface-subtle py-2 pl-1.5 pr-3 text-right font-medium sm:w-14">{t("Thiếu")}</th>
                    </tr>
                </thead>
                {dong.map((d) => {
                    const bienThe = [d.tenMau, d.kichCo].filter(Boolean).join(" / ");
                    return (
                        <tbody key={d.id ?? `${d.bienTheId}-${d.loHangId}`} className="border-t border-bo-border tabular-nums">
                            <tr>
                                {/* Hộp hẹp (điện thoại): tên và dòng lô / SKU xuống dòng thay vì cắt mất mã lô */}
                                <td className="px-3 pb-1 pt-2">
                                    <div className="line-clamp-2 font-medium text-bo-foreground [overflow-wrap:anywhere]" title={d.tenSanPham}>{d.tenSanPham}</div>
                                    <div className="text-xs text-bo-muted [overflow-wrap:anywhere]">
                                        {bienThe ? `${bienThe} · ` : ""}{t("lô", { context: "mot" })} <span className="font-mono">{d.maLo}</span> · {d.sku}
                                    </div>
                                </td>
                                <td className="px-1.5 pb-1 pt-2 text-right align-top sm:px-2">{soVN(d.gui)}</td>
                                <td className="px-1.5 pb-1 pt-2 text-right align-top sm:px-2">{soVN(d.nhan)}</td>
                                <td className="px-1.5 pb-1 pt-2 text-right align-top sm:px-2">{soVN(d.hong)}</td>
                                <td className="pb-1 pl-1.5 pr-3 pt-2 text-right align-top">{soVN(d.thieu)}</td>
                            </tr>
                            <tr>
                                <td colSpan={5} className="px-3 pb-2 text-xs leading-5 text-bo-foreground [overflow-wrap:anywhere]">
                                    <span className="text-bo-muted">{t("Lý do:")} </span>
                                    {d.lyDo || "—"}
                                </td>
                            </tr>
                        </tbody>
                    );
                })}
            </table>
        </div>
    );
}

const dongLechCua = (bb) => (bb?.dong ?? []).filter((d) => d.thieu > 0 || d.hong > 0);

/**
 * Đại diện kho gửi xác nhận biên bản giao nhận (BA 03/11): thay chữ ký tay ô "Đại diện kho gửi" trên giấy. Ý kiến
 * không bắt buộc — kho gửi không đồng ý số liệu thì ghi vào đây, người xử lý chênh lệch đọc rồi quyết. Xác nhận xong kho
 * nhận không thêm / xóa ảnh được nữa, và người được xử lý chênh lệch mới thấy nút Xử lý chênh lệch.
 */
export function HopXacNhanBienBan({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [ghiChu, setGhiChu] = useState("");
    const bb = ct.bienBan;
    const anh = bb?.anh ?? [];
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Xác nhận biên bản · {{so}}", { so: bb?.soBienBan ?? "" })}
            moTa={t("{{khoNhap}} nhận {{tongNhan}}/{{tongGui}} sản phẩm {{khoXuat}} gửi, ghi thiếu {{tongThieu}}, hỏng {{tongHong}}. Xác nhận thay chữ ký ở ô Đại diện kho gửi; sau đó {{ai}} chọn cách xử lý phần lệch.", { khoNhap: ct.khoNhap?.ten, tongNhan: soVN(bb?.tongNhan), tongGui: soVN(bb?.tongGui), khoXuat: ct.khoXuat?.ten, tongThieu: soVN(bb?.tongThieu), tongHong: soVN(bb?.tongHong), ai: aiXuLyChenhLechHienThi(ct) })}
            nhanXacNhan={t("Xác nhận biên bản")}
            iconXacNhan={Check}
            rong
            // Đọc bảng lệch trước: không nhảy con trỏ xuống ô ý kiến ở cuối hộp (thân hộp cuộn, bàn phím điện thoại bật)
            tieuDiemONhap={false}
            tieuDiemQuayLai
            dangChay={dangChay}
            loi={loi}
            // anhIds: bộ ảnh đang thấy; ảnh vừa đổi (còn đang tải, kho nhận thêm / xóa) thì máy chủ báo 409, màn tải lại phiếu
            onXacNhan={() => onXacNhan({ ghiChu: ghiChu.trim() || null, anhIds: anh.map((a) => a.id) })}
        >
            <BangDongLech dong={dongLechCua(bb)} />
            {bb?.ketLuan ? (
                <p className="m-0 text-[13px] leading-5 text-bo-foreground [overflow-wrap:anywhere]">
                    <span className="text-bo-muted">{t("Kết luận của kho nhận:")} </span>
                    {bb.ketLuan}
                </p>
            ) : null}
            {anh.length ? (
                <div className="grid gap-1.5">
                    <span className={NHAN_O}>{t("Ảnh chụp ({{so}})", { so: soVN(anh.length) })}</span>
                    <div className="flex flex-wrap gap-2">
                        {anh.map((a) => (
                            <a
                                key={a.id}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                title={a.moTa || t("Mở ảnh ở thẻ mới")}
                                className="block size-14 overflow-hidden rounded-md border border-bo-border bg-bo-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                            >
                                <img src={a.url} alt={a.moTa || t("Ảnh biên bản")} loading="lazy" className="size-full object-cover" />
                            </a>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="m-0 text-[13px] leading-5 text-bo-muted">{t("Kho nhận chưa đính kèm ảnh nào cho biên bản này.")}</p>
            )}
            <O nhan={t("Ý kiến của kho gửi")} goiY={t("Không bắt buộc · {{dem}}/255", { dem: ghiChu.length })}>
                {(p) => (
                    <textarea
                        {...p}
                        value={ghiChu}
                        maxLength={255}
                        disabled={dangChay}
                        onChange={(e) => setGhiChu(e.target.value)}
                        placeholder={t("Ví dụ: hàng đóng nguyên thùng, niêm phong còn nguyên khi xuất")}
                        className={O_NHAP_NHIEU_DONG}
                    />
                )}
            </O>
            <p className={GHI_CHU_HOP}>{t("Xác nhận xong, kho nhận không thêm hay xóa ảnh biên bản được nữa.")}</p>
        </HopXacNhanChungTu>
    );
}

/**
 * Xử lý chênh lệch (bước 5): một phương án cho cả biên bản, lý do bắt buộc, sau khi kho gửi đã xác nhận biên bản. Ai
 * được làm theo Cấu hình › Chuyển kho (máy chủ gửi câu mô tả ở `ct.aiXuLyChenhLech`). Giao bù: Quản lý Kho tổng / quản
 * trị viên xử lý thì phiếu giao bù đã duyệt, có lệnh điều động ngay (`quyen.giaoBuTuDuyet`); quản lý kho xuất xử lý theo
 * Cấu hình thì phiếu giao bù chờ Quản lý Kho tổng duyệt.
 */
export function HopXuLyChenhLech({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [phuongAn, setPhuongAn] = useState("");
    const [lyDo, setLyDo] = useState("");
    const [daBam, setDaBam] = useState(false);
    const bb = ct.bienBan;
    const nLech = (bb?.tongThieu ?? 0) + (bb?.tongHong ?? 0);
    const loiPa = daBam && !phuongAn ? t("Chọn phương án xử lý") : null;
    const loiLy = daBam && !lyDo.trim() ? t("Nhập lý do") : null;
    const khoXuat = ct.khoXuat?.ten ?? t("kho xuất");
    const sauGiaoBu = ct.quyen?.giaoBuTuDuyet
        ? t("phiếu đã duyệt, có lệnh điều động để {{khoXuat}} nhặt hàng ngay", { khoXuat })
        : t("phiếu chờ Quản lý Kho tổng duyệt");
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={t("Xử lý chênh lệch · {{so}}", { so: bb?.soBienBan ?? "" })}
            moTa={t("{{khoNhap}} đã nhận {{tongNhan}}/{{tongGui}}. {{soLech}} sản phẩm lệch đang giữ ở kho trung chuyển. Chọn một phương án cho biên bản; xử lý xong phiếu sang Hoàn tất.", { khoNhap: ct.khoNhap?.ten, tongNhan: soVN(bb?.tongNhan), tongGui: soVN(bb?.tongGui), count: nLech, soLech: soVN(nLech) })}
            nhanXacNhan={t("Duyệt xử lý lệch")}
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => {
                setDaBam(true);
                if (!phuongAn || !lyDo.trim()) return;
                onXacNhan({ phuongAn, lyDo: lyDo.trim() });
            }}
        >
            <BangDongLech dong={dongLechCua(bb)} />
            {bb?.ngayXacNhanGui ? (
                <p className="m-0 text-[13px] leading-5 text-bo-foreground [overflow-wrap:anywhere]">
                    <span className="text-bo-muted">{t("{{khoXuat}} (kho gửi) đã xác nhận:", { khoXuat })} </span>
                    {bb.nguoiXacNhanGui ? <B>{bb.nguoiXacNhanGui}</B> : null}
                    {bb.ghiChuKhoGui ? <> · {t("Ý kiến:")} {bb.ghiChuKhoGui}</> : null}
                </p>
            ) : null}
            <ChonThe
                nhan={t("Phương án xử lý")}
                luaChon={PHUONG_AN_CHENH_LECH.map((pa) => ({
                    ...pa,
                    nhan: t(pa.nhan),
                    moTa: pa.ma === "GIAO_BU_HANG"
                        ? t("Ghi giảm {{so}} sản phẩm lệch bằng phiếu điều chỉnh kho, đóng phiếu này với số đã nhận, rồi tự lập phiếu chuyển giao bù {{so}} sản phẩm từ {{khoXuat}} ({{sauGiaoBu}}).", { count: nLech, so: soVN(nLech), khoXuat, sauGiaoBu })
                        : t("Lập phiếu điều chỉnh kho trừ {{so}} sản phẩm khỏi kho trung chuyển. Phiếu sang Hoàn tất (có chênh lệch).", { count: nLech, so: soVN(nLech) }),
                }))}
                value={phuongAn}
                onChange={setPhuongAn}
                loi={loiPa}
            />
            <O nhan={t("Lý do")} batBuoc loi={loiLy}>
                {(p) => (
                    <textarea
                        {...p}
                        value={lyDo}
                        maxLength={500}
                        onChange={(e) => setLyDo(e.target.value)}
                        placeholder={t("Ví dụ: rách đường may khi vận chuyển, quy trách nhiệm người vận chuyển")}
                        className={cn(O_NHAP_NHIEU_DONG, loiLy && "border-bo-danger")}
                    />
                )}
            </O>
            <p className={GHI_CHU_HOP}>{t("Chỉ {{ai}} thực hiện được (đổi trong Cấu hình › Chuyển kho).", { ai: aiXuLyChenhLechHienThi(ct) })}</p>
        </HopXacNhanChungTu>
    );
}
