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
    PHUONG_AN_CHENH_LECH,
    TT_CHUYEN,
    XKNB_CHE_DO,
} from "@/constants/phieuChuyenKho";
import {
    aiXuLyChenhLech,
    kiemTraGhiSoXknb,
    kiemTraXacNhanXuat,
    tongCot,
} from "@/components/chuyen-kho/hienThiChuyenKho";
import { GOI_Y_BIEN_SO, kiemTraBienSo } from "@/components/chuyen-kho/bienSoXe";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;

/** Hàng đã xuất của phiếu đang ở đâu (hộp Ghi số XKNB mở được cả sau khi đã nhận hoặc đã hủy). */
const tinhTrangHangDaXuat = (trangThai) =>
    trangThai === TT_CHUYEN.DANG_VAN_CHUYEN ? "đang trên đường"
        : trangThai === TT_CHUYEN.DA_HUY ? "đã xuất rồi phiếu bị hủy"
            : "đã giao tới kho nhận";
const Sao = () => <span className="text-bo-danger">*</span>;
/** Khung cảnh báo trong hộp: cùng dáng LOI_HOP, tông cảnh báo (chữ bo-warning trên nền bo-warning-soft ≥ 4,5:1). */
const CANH_BAO_HOP = "rounded-lg border border-bo-warning/30 bg-bo-warning-soft px-3 py-2.5 text-[13px] leading-5 text-bo-warning";

function O({ nhan, batBuoc, loi, goiY, children, className }) {
    const id = useId();
    return (
        <div className={cn("grid gap-1.5", className)}>
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
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm leading-5 transition-colors",
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
    const thieuGhiChu = lyDo === "KHAC" && !ghiChu.trim();
    const tong = tongCot(ct.hang, "soLuongChuyen");
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe="Duyệt và lập lệnh điều động"
            moTa={`Hàng ${soVN(tong)} sản phẩm được xuất khỏi ${ct.khoXuat?.ten} sang ${ct.khoNhap?.ten} theo lệnh này. Số lệnh do hệ thống cấp sau khi lưu.`}
            nhanXacNhan="Duyệt và lập lệnh"
            iconXacNhan={Check}
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => {
                setDaBam(true);
                if (thieuGhiChu) return;
                onXacNhan({ lyDoDieuDong: lyDo, ghiChuLenh: ghiChu.trim() || null });
            }}
        >
            <ChonThe nhan="Lý do điều động" luaChon={LY_DO_DIEU_DONG} value={lyDo} onChange={setLyDo} />
            <O nhan={lyDo === "KHAC" ? "Ghi rõ lý do" : "Ghi chú"} batBuoc={lyDo === "KHAC"} loi={daBam && thieuGhiChu ? "Ghi rõ lý do điều động" : null}>
                {(p) => (
                    <textarea
                        {...p}
                        value={ghiChu}
                        maxLength={500}
                        onChange={(e) => setGhiChu(e.target.value)}
                        placeholder="Ví dụ: chuẩn bị hàng cho đợt khuyến mãi cuối tuần"
                        className={cn(O_NHAP_NHIEU_DONG, daBam && thieuGhiChu && "border-bo-danger")}
                    />
                )}
            </O>
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
                    Giấy đi đường (phiếu XKNB) {cheDo === XKNB_CHE_DO.CHAN || chiGhiSo ? <Sao /> : null}
                </div>
                <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">Xe chở hàng phải mang theo bản in phiếu này.</p>
            </div>
            {onTaiDuLieu ? (
                <ol className="grid gap-1 text-[13px] leading-5 text-bo-foreground">
                    <li>
                        1.{" "}
                        <button type="button" onClick={onTaiDuLieu} className="inline-flex items-center gap-1 font-medium text-bo-primary hover:underline">
                            <Download className="size-3.5" aria-hidden="true" />
                            Tải dữ liệu chuyến hàng
                        </button>{" "}
                        — tệp có sẵn danh sách hàng, kho đi, kho đến, người chở.
                    </li>
                    <li>2. Nạp tệp vào phần mềm hóa đơn điện tử của công ty (MISA, VNPT, Viettel…) và phát hành phiếu.</li>
                    <li>3. Ghi ký hiệu và số của phiếu vừa phát hành vào hai ô dưới đây.</li>
                </ol>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                <O nhan="Ký hiệu" batBuoc={chiGhiSo || cheDo === XKNB_CHE_DO.CHAN} loi={loi.kyHieu} goiY="Ví dụ 6K26NAB">
                    {(p) => (
                        <input {...p} value={form.kyHieu} maxLength={7} autoComplete="off" onChange={(e) => doi("kyHieu", e.target.value.toUpperCase())} className={lopO(loi.kyHieu, "font-mono uppercase")} />
                    )}
                </O>
                <O
                    nhan="Số phiếu"
                    batBuoc={chiGhiSo || cheDo === XKNB_CHE_DO.CHAN}
                    loi={loi.soXknb}
                    goiY={dangLaySo ? "Đang lấy số tiếp theo…" : kyHieuHopLe ? "Hệ thống điền số tiếp theo của ký hiệu; sửa nếu khác số trên phiếu" : "7 chữ số, ví dụ 0000125"}
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
                    Lấy số tiếp theo của {String(form.kyHieu).trim().toUpperCase()}
                </button>
            ) : null}
            <button type="button" aria-expanded={them} onClick={() => setThem((x) => !x)} className="justify-self-start text-[13px] font-medium text-bo-primary hover:underline">
                {them ? "Ẩn thông tin thêm" : "Thông tin thêm: ngày lập, mã tra cứu"}
            </button>
            {them ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <O nhan="Ngày lập">
                        {(p) => <input {...p} type="date" value={form.ngayLap} onChange={(e) => doi("ngayLap", e.target.value)} className={O_NHAP} />}
                    </O>
                    <O nhan="Mã tra cứu">
                        {(p) => <input {...p} value={form.maTraCuu} maxLength={100} autoComplete="off" onChange={(e) => doi("maTraCuu", e.target.value)} className={cn(O_NHAP, "font-mono")} />}
                    </O>
                </div>
            ) : null}
            {!chiGhiSo ? (
                <p className="text-[13px] leading-5 text-bo-muted">
                    {cheDo === XKNB_CHE_DO.CHI_CANH_BAO
                        ? "Đang bật Chỉ cảnh báo trong Cấu hình › Chứng từ và hóa đơn: được xuất trước, ghi số sau."
                        : "Công ty chưa dùng phần mềm hóa đơn điện tử? Quản trị viên đổi sang \"Chỉ cảnh báo\" ở Cấu hình › Chứng từ và hóa đơn để xuất trước, ghi số sau."}
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
    // Rời ô Biển số: đúng mẫu thì đổi sang cách viết chuẩn, sai thì báo ngay; để trống thì đợi bấm Xác nhận xuất
    const roiOBienSo = () => {
        if (!form.bienSo.trim()) return;
        const kq = kiemTraBienSo(form.bienSo);
        if (kq.hopLe) setForm((f) => ({ ...f, bienSo: kq.giaTri }));
        else setLoiO((l) => ({ ...l, bienSo: kq.loi }));
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
            tieuDe="Xác nhận xuất"
            moTa={`Trừ ${soVN(tong)} sản phẩm khỏi ${ct.khoXuat?.ten}. Hàng chuyển sang đang vận chuyển và do người vận chuyển chịu trách nhiệm.`}
            nhanXacNhan={hoiThieu ? "Vẫn xuất khi chưa có số" : "Xác nhận xuất"}
            iconXacNhan={Truck}
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={bam}
        >
            {chan ? <p role="alert" className="rounded-lg border border-bo-danger/25 bg-bo-danger-soft px-3 py-2.5 text-[13px] leading-5 text-bo-danger-strong">{chan}</p> : null}
            {hoiThieu ? (
                <p role="alert" className={CANH_BAO_HOP}>
                    Chưa có ký hiệu và số phiếu XKNB. Đang bật Chỉ cảnh báo nên hàng vẫn xuất được; phiếu sẽ nằm ở mục <B>Thiếu giấy đi đường</B> cho tới khi ghi số.
                </p>
            ) : null}
            <div className="grid gap-1.5">
                <span className={NHAN_O}>
                    Hình thức vận chuyển <Sao />
                </span>
                <NutPhanDoan
                    nhan="Hình thức vận chuyển"
                    value={ht}
                    onChange={(v) => doi("hinhThuc", v)}
                    luaChon={HINH_THUC_VAN_CHUYEN.map((h) => ({ value: h.ma, label: h.nhan }))}
                />
            </div>
            {canDonVi ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <O nhan={ht === "CHUYEN_PHAT" ? "Đơn vị chuyển phát" : "Đơn vị vận chuyển"} batBuoc loi={loiO.donVi}>
                        {(p) => <input {...p} value={form.donVi} maxLength={150} onChange={(e) => doi("donVi", e.target.value)} className={lopO(loiO.donVi)} />}
                    </O>
                    <O nhan={ht === "CHUYEN_PHAT" ? "Mã vận đơn" : "Số hợp đồng vận chuyển"} batBuoc={ht === "CHUYEN_PHAT"} loi={loiO.maVanDon}>
                        {(p) => <input {...p} value={form.maVanDon} maxLength={50} onChange={(e) => doi("maVanDon", e.target.value)} className={lopO(loiO.maVanDon)} />}
                    </O>
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                <O nhan="Người vận chuyển" batBuoc loi={loiO.nguoi}>
                    {(p) => <input {...p} value={form.nguoi} maxLength={100} autoComplete="off" onChange={(e) => doi("nguoi", e.target.value)} className={lopO(loiO.nguoi)} />}
                </O>
                <O nhan="Điện thoại" batBuoc loi={loiO.sdt}>
                    {(p) => <input {...p} value={form.sdt} maxLength={12} inputMode="tel" autoComplete="off" onChange={(e) => doi("sdt", e.target.value)} className={lopO(loiO.sdt, "tabular-nums")} />}
                </O>
            </div>
            {canPhuongTien ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <O nhan="Phương tiện" batBuoc loi={loiO.loaiPhuongTien}>
                        {(p) => <input {...p} value={form.loaiPhuongTien} maxLength={50} placeholder="Ví dụ: xe tải 1,5 tấn" onChange={(e) => doi("loaiPhuongTien", e.target.value)} className={lopO(loiO.loaiPhuongTien)} />}
                    </O>
                    <O nhan="Biển số" batBuoc loi={loiO.bienSo} goiY={GOI_Y_BIEN_SO}>
                        {(p) => (
                            <input
                                {...p}
                                value={form.bienSo}
                                maxLength={20}
                                autoComplete="off"
                                spellCheck={false}
                                onChange={(e) => doi("bienSo", e.target.value.toUpperCase())}
                                onBlur={roiOBienSo}
                                className={lopO(loiO.bienSo, "uppercase")}
                            />
                        )}
                    </O>
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                <O nhan="Dự kiến đến" loi={loiO.duKienDen} goiY="Quá giờ này mà kho nhận chưa nhận, phiếu hiện ở mục Trễ hẹn">
                    {(p) => <input {...p} type="datetime-local" value={form.duKienDen} onChange={(e) => doi("duKienDen", e.target.value)} className={lopO(loiO.duKienDen)} />}
                </O>
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
            tieuDe="Ghi số phiếu XKNB"
            moTa={`Hàng của ${ct.soPhieuChuyen} ${tinhTrangHangDaXuat(ct.trangThai)} mà chưa có số phiếu XKNB. Ghi số ngay khi phần mềm hóa đơn điện tử phát hành.`}
            nhanXacNhan="Lưu số XKNB"
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

/** Hủy phiếu (A5): lý do không bắt buộc. */
export function HopHuy({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [lyDo, setLyDo] = useState("");
    const dangDi = ct.trangThai === "DANG_VAN_CHUYEN";
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe="Hủy phiếu chuyển kho"
            moTa={dangDi
                ? `Hàng đang trên đường. Sau khi hủy, ${ct.khoXuat?.ten} nhập hàng hoàn trả để đưa hàng về kho.`
                : `Phiếu xuất chờ nhặt (nếu có) bị hủy theo và hàng đang giữ chỗ được trả về tồn ${ct.khoXuat?.ten}.`}
            nhanXacNhan="Hủy phiếu"
            iconXacNhan={Ban}
            kieu="nguyHiem"
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => onXacNhan({ lyDo: lyDo.trim() || null })}
        >
            <O nhan="Lý do hủy" goiY={`Không bắt buộc · ${lyDo.length}/255`}>
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
            tieuDe="Nhập hàng hoàn trả"
            moTa={`Lập và hoàn tất phiếu nhập hoàn trả: đưa ${soVN(con)} sản phẩm của ${ct.soPhieuChuyen} từ kho trung chuyển về lại ${ct.khoXuat?.ten}, đúng lô đã xuất.`}
            nhanXacNhan="Nhập hàng hoàn trả"
            iconXacNhan={RotateCcw}
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => onXacNhan()}
        />
    );
}

/**
 * Xử lý chênh lệch (bước 5): một phương án cho cả biên bản, lý do bắt buộc. Ai được làm theo Cấu hình › Chuyển kho
 * (máy chủ gửi câu mô tả ở `ct.aiXuLyChenhLech`).
 */
export function HopXuLyChenhLech({ mo, onDong, ct, dangChay, loi, onXacNhan }) {
    const [phuongAn, setPhuongAn] = useState("");
    const [lyDo, setLyDo] = useState("");
    const [daBam, setDaBam] = useState(false);
    const bb = ct.bienBan;
    const dongLech = (bb?.dong ?? []).filter((d) => d.thieu > 0 || d.hong > 0);
    const nLech = (bb?.tongThieu ?? 0) + (bb?.tongHong ?? 0);
    const loiPa = daBam && !phuongAn ? "Chọn phương án xử lý" : null;
    const loiLy = daBam && !lyDo.trim() ? "Nhập lý do" : null;
    return (
        <HopXacNhanChungTu
            mo={mo}
            onDoiMo={(m) => !m && onDong()}
            tieuDe={`Xử lý chênh lệch · ${bb?.soBienBan ?? ""}`}
            moTa={`${ct.khoNhap?.ten} đã nhận ${soVN(bb?.tongNhan)}/${soVN(bb?.tongGui)}. ${soVN(nLech)} sản phẩm lệch đang giữ ở kho trung chuyển. Chọn một phương án cho biên bản; xử lý xong phiếu sang Hoàn tất.`}
            nhanXacNhan="Duyệt xử lý lệch"
            rong
            dangChay={dangChay}
            loi={loi}
            onXacNhan={() => {
                setDaBam(true);
                if (!phuongAn || !lyDo.trim()) return;
                onXacNhan({ phuongAn, lyDo: lyDo.trim() });
            }}
        >
            <div className="overflow-x-auto rounded-lg border border-bo-border">
                <table className="w-full min-w-[480px] text-[13px]">
                    <thead className="bg-bo-surface-subtle text-left text-xs text-bo-muted">
                        <tr>
                            <th className="px-3 py-2 font-medium">Sản phẩm</th>
                            <th className="px-3 py-2 font-medium">Lô</th>
                            <th className="px-3 py-2 text-right font-medium">Gửi</th>
                            <th className="px-3 py-2 text-right font-medium">Đạt</th>
                            <th className="px-3 py-2 text-right font-medium">Hỏng</th>
                            <th className="px-3 py-2 text-right font-medium">Thiếu</th>
                            <th className="px-3 py-2 font-medium">Lý do</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border tabular-nums">
                        {dongLech.map((d) => (
                            <tr key={d.id}>
                                <td className="px-3 py-2">
                                    {d.tenSanPham}
                                    <span className="block font-mono text-xs text-bo-muted">{d.sku}</span>
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">{d.maLo}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.gui)}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.nhan)}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.hong)}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.thieu)}</td>
                                <td className="px-3 py-2">{d.lyDo || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ChonThe
                nhan="Phương án xử lý"
                luaChon={PHUONG_AN_CHENH_LECH.map((pa) => ({
                    ...pa,
                    moTa: pa.ma === "GIAO_BU_HANG"
                        ? `Ghi giảm ${soVN(nLech)} sản phẩm lệch bằng phiếu điều chỉnh kho, đóng phiếu này với số đã nhận, rồi tự lập phiếu chuyển giao bù ${soVN(nLech)} sản phẩm từ ${ct.khoXuat?.ten} (đi lại từ bước duyệt).`
                        : `Lập phiếu điều chỉnh kho trừ ${soVN(nLech)} sản phẩm khỏi kho trung chuyển. Phiếu sang Hoàn tất (có chênh lệch).`,
                }))}
                value={phuongAn}
                onChange={setPhuongAn}
                loi={loiPa}
            />
            <O nhan="Lý do" batBuoc loi={loiLy}>
                {(p) => (
                    <textarea
                        {...p}
                        value={lyDo}
                        maxLength={500}
                        onChange={(e) => setLyDo(e.target.value)}
                        placeholder="Ví dụ: rách đường may khi vận chuyển, quy trách nhiệm người vận chuyển"
                        className={cn(O_NHAP_NHIEU_DONG, loiLy && "border-bo-danger")}
                    />
                )}
            </O>
            <p className={GHI_CHU_HOP}>Chỉ {aiXuLyChenhLech(ct)} thực hiện được (đổi trong Cấu hình › Chuyển kho).</p>
        </HopXacNhanChungTu>
    );
}
