import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, Check, ClipboardCheck, PackageSearch, PenLine, Printer, RotateCcw, Scale, Truck } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import CotThuocTinh, { BangThuocTinh, ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import TuyenChuyen from "@/components/chung-tu/TuyenChuyen";
import { soVN } from "@/components/chung-tu/bangChungTu";
import {
    CAU_HET_THOI_HAN,
    LY_DO_CHO_GOC,
    MO_TA_HET_THOI_HAN,
    chayCoThoiHan,
    khiGocKetThuc,
    khoaKhiChoGoc,
    laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import {
    HINH_THUC_VAN_CHUYEN,
    LY_DO_DIEU_DONG_HIEN_THI,
    LY_DO_GIAO_BU,
    PHUONG_AN_CHENH_LECH,
    TT_CHUYEN,
    getPhieuChuyenKhoStatus,
    tenTheoMa,
} from "@/constants/phieuChuyenKho";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { getPickListStatus } from "@/constants/outbound";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import {
    buocChuyenKho,
    cauChoXuLyLech,
    cheGiua,
    choKhoGuiXacNhan,
    gioNgayNgan,
    ngayGioDu,
    nhanPhieuXuatLienQuan,
    noiDungDuLieuChuyenHang,
    phieuXuatDaXuat,
    tinhNhatChuyenKho,
    tongCot,
    treBaoLau,
} from "@/components/chuyen-kho/hienThiChuyenKho";
import useHangChuaCoKeCuaChungTu from "@/components/kiem-ke/useHangChuaCoKeCuaChungTu";
import HopXepKeChungTu from "@/components/kiem-ke/HopXepKeChungTu";
import { coHenXepKe, xoaHenXepKe } from "@/components/kiem-ke/henXepKe";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import useQuayLai from "@/hooks/useQuayLai";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { laQuanLyKhoTong, lamViecTaiKho, moDuocTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import AnhBienBanGiaoNhan from "./AnhBienBanGiaoNhan";
import BangHangPhieuChuyen from "./BangHangPhieuChuyen";
import {
    HopDuyet,
    HopGhiSoXknb,
    HopHuy,
    HopNhapHoanTra,
    HopTuChoi,
    HopXacNhanBienBan,
    HopXacNhanXuat,
    HopXuLyChenhLech,
} from "./HopThoaiChuyenKho";
import { t } from "@/i18n";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;
const LienKet = ({ to, onClick, children }) => (
    <Link to={to} onClick={onClick} className="rounded font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30">
        {children}
    </Link>
);

/**
 * Chi tiết phiếu chuyển kho nội bộ (màn B.1 của BA): đầu khối (số phiếu, thẻ trạng thái, nút theo bước), tiến trình 5
 * bước, thông báo theo trạng thái, bảng hàng (Gửi · Đã nhặt · Nhận · Hỏng · Còn trên đường), cột phải: tuyến, lệnh
 * điều động, vận chuyển, giấy đi đường, biên bản, người thực hiện, chứng từ. Nút chỉ hiện khi máy chủ báo người đang
 * xem được làm (`quyen`). Đổi phiếu trên cùng đường dẫn thì dựng lại màn (`key`).
 */
export default function PhieuChuyenKhoDetail() {
    const { id } = useParams();
    return <ManPhieuChuyenKho key={id} id={id} />;
}

function ManPhieuChuyenKho({ id }) {
    const navigate = useNavigate();
    const quayLai = useQuayLai("/transfer-tickets");
    const [ct, setCt] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [capNhatLuc, setCapNhatLuc] = useState(null);
    const [dangChay, setDangChay] = useState(false);
    const [choGoc, setChoGoc] = useState(false);
    // Hộp đang mở: duyet | tuChoi | xuat | ghiSo | huy | xacNhanBb | xuLy | hoanTra | null; loiHop: câu lỗi máy chủ trong hộp
    const [hop, setHop] = useState(null);
    const [loiHop, setLoiHop] = useState(null);
    const huyChoGocRef = useRef(null);
    const daGoRef = useRef(false);
    const requestIdRef = useRef(0);

    useEffect(() => {
        daGoRef.current = false;
        return () => {
            daGoRef.current = true;
            huyChoGocRef.current?.();
        };
    }, []);

    const taiPhieu = useCallback(async ({ silent = false, baoLoi = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const res = await phieuChuyenKhoService.chiTiet(id);
            if (requestId !== requestIdRef.current) return undefined;
            if (res?.id != null) {
                setCt(res);
                setLoadError(null);
                setCapNhatLuc(new Date());
                return res;
            }
            if (!silent) {
                setCt(null);
                setLoadError({ loi: null });
            }
        } catch (e) {
            if (requestId !== requestIdRef.current) return undefined;
            if (silent) {
                if (baoLoi) toast.error(getApiErrorMessage(e, t("Không tải lại được phiếu chuyển kho")));
                return undefined;
            }
            setCt(null);
            setLoadError({ loi: e });
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
        return undefined;
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => taiPhieu());
    }, [taiPhieu]);

    // Hàng đã nhận của phiếu còn chưa có kệ ở kho nhận (dòng nhắc "Xếp kệ"): chỉ khi phiếu đã có phiếu nhập
    const chuaKe = useHangChuaCoKeCuaChungTu({
        kho: ct?.khoNhap,
        phieuChuyenId: ct?.id ?? null,
        bat: (ct?.phieuNhap ?? []).some((pn) => !pn.laHoanTra),
        phienBan: (ct?.phieuNhap ?? []).length,
    });
    // Hàng về lại kho xuất (phiếu hủy khi đang vận chuyển, phiếu nhập hoàn trả) còn chưa có kệ ở kho xuất
    const chuaKeHoanTra = useHangChuaCoKeCuaChungTu({
        kho: ct?.khoXuat,
        phieuChuyenId: ct?.id ?? null,
        bat: (ct?.phieuNhap ?? []).some((pn) => pn.laHoanTra),
        phienBan: (ct?.phieuNhap ?? []).length,
    });

    // Hộp "Xếp kệ hàng vừa nhận / vừa về": `loai` nhan (kho nhận) | hoanTra (kho xuất); `phien` đổi mỗi lần mở (hộp dựng
    // lại), giữ khi đóng để Radix trả tiêu điểm. Tự mở một lần khi vừa nhận hàng (màn nhận hẹn qua sessionStorage) hoặc
    // vừa nhập hoàn trả, nếu số đếm cho thấy còn hàng chưa có kệ (kho không quản lý kệ / người không xếp kệ: số 0, không mở)
    const [hopXepKe, setHopXepKe] = useState({ phien: 0, mo: false, loai: "nhan", tuMo: false });
    const [henMo, setHenMo] = useState(() => (coHenXepKe(id) ? "nhan" : null));
    useEffect(() => {
        xoaHenXepKe(id);
    }, [id]);
    const demHen = henMo === "hoanTra" ? chuaKeHoanTra : chuaKe;
    // Hẹn chỉ có hiệu lực ngay sau thao tác: đếm lỗi / chưa đếm được (không có quyền, chưa có phiếu nhập) thì bỏ sau 30 giây,
    // không để hộp bật lên bất ngờ khi trang đếm lại lúc người dùng quay lại thẻ
    useEffect(() => {
        if (!henMo) return undefined;
        const t = setTimeout(() => setHenMo(null), 30_000);
        return () => clearTimeout(t);
    }, [henMo]);
    useEffect(() => {
        if (!henMo || !demHen.daTai) return;
        const loai = henMo;
        const coHang = demHen.soLo > 0;
        queueMicrotask(() => {
            setHenMo(null);
            if (coHang) setHopXepKe((cu) => ({ phien: cu.phien + 1, mo: true, loai, tuMo: true }));
        });
    }, [henMo, demHen.daTai, demHen.soLo]);
    const moXepKe = (loai) => setHopXepKe((cu) => ({ phien: cu.phien + 1, mo: true, loai, tuMo: false }));
    const dongXepKe = () => {
        setHopXepKe((cu) => ({ ...cu, mo: false }));
        chuaKe.taiLai();
        chuaKeHoanTra.taiLai();
    };

    // Kho xuất, kho nhận, Kho tổng là những người khác nhau: quay lại tab thì tải lại ngầm
    useTaiLaiKhiQuayLai(() => taiPhieu({ silent: true }), { bat: Boolean(ct) && !loading && !dangChay && !hop && !hopXepKe.mo, lanCuoi: capNhatLuc });

    const dongHop = () => {
        setHop(null);
        setLoiHop(null);
    };

    function khoaToiKhiGocXong(loi) {
        huyChoGocRef.current?.();
        setChoGoc(true);
        huyChoGocRef.current = khiGocKetThuc(loi, () => {
            huyChoGocRef.current = null;
            setChoGoc(false);
            taiPhieu({ silent: true, baoLoi: true });
        });
    }

    /**
     * Chạy một thao tác tại kho `kho` (kho xuất / kho nhận của bước): thành công → đóng hộp, báo, tải lại; lỗi → câu của
     * máy chủ hiện trong hộp đang mở; 409 (phiếu vừa đổi ở nơi khác) thì tải lại ngầm để màn đúng trạng thái mới.
     */
    async function chay(thaoTac, cauThanhCong, cauLoi, kho) {
        lamViecTaiKho(kho);
        setDangChay(true);
        setLoiHop(null);
        try {
            const kq = await chayCoThoiHan(thaoTac);
            toast.success(typeof cauThanhCong === "function" ? cauThanhCong(kq) : cauThanhCong);
            setHop(null);
            taiPhieu({ silent: true, baoLoi: true });
            return kq;
        } catch (e) {
            if (laLoiHetThoiHan(e)) {
                if (daGoRef.current) return undefined;
                setHop(null);
                toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
                taiPhieu({ silent: true, baoLoi: true });
                khoaToiKhiGocXong(e);
                return undefined;
            }
            const cau = getApiErrorMessage(e, cauLoi);
            if (hop) setLoiHop(cau);
            else toast.error(cau);
            if (getApiErrorStatus(e) === 409) taiPhieu({ silent: true });
            return undefined;
        } finally {
            setDangChay(false);
        }
    }

    /**
     * Duyệt phiếu thì PX-CK đã vào danh sách chờ nhặt (đặc tả bước 8): mở phiếu nhặt của nó. Phiếu duyệt từ trước bản
     * phiếu nhặt: máy chủ lập phiếu nhặt (và PX-CK nếu thiếu) rồi mở; phiếu cũ đã chọn lô tay trên PX-CK thì mở phiếu xuất
     * để chọn lô như trước.
     */
    async function moPhieuNhat() {
        lamViecTaiKho(ct.khoXuat);
        const nhat = tinhNhatChuyenKho(ct);
        if (nhat.phieuNhat) {
            navigate(`/goods-issues/pick-lists/${nhat.phieuNhat.id}`);
            return;
        }
        if (nhat.chonLoTay && ct.phieuXuat) {
            navigate(`/goods-issues/${ct.phieuXuat.id}`);
            return;
        }
        setDangChay(true);
        try {
            const kq = await chayCoThoiHan(() => phieuChuyenKhoService.phieuXuat(id));
            // Đã rời trang trong lúc chờ: không kéo người dùng về phiếu nhặt
            if (daGoRef.current) return;
            if (kq?.phieuNhatId != null) navigate(`/goods-issues/pick-lists/${kq.phieuNhatId}`);
            else if (kq?.id != null) navigate(`/goods-issues/${kq.id}`);
            else {
                toast.error(t("Không mở được phiếu nhặt hàng"), { description: t("Máy chủ không trả về phiếu nào. Tải lại trang rồi thử lại.") });
                taiPhieu({ silent: true });
            }
        } catch (e) {
            if (daGoRef.current) return;
            if (laLoiHetThoiHan(e)) {
                // Máy chủ có thể vẫn đang lập phiếu nhặt: khóa nút tới khi lời gọi gốc kết thúc rồi tải lại
                toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
                taiPhieu({ silent: true, baoLoi: true });
                khoaToiKhiGocXong(e);
                return;
            }
            toast.error(getApiErrorMessage(e, t("Không mở được phiếu nhặt hàng")));
        } finally {
            if (!daGoRef.current) setDangChay(false);
        }
    }

    function taiDuLieuChuyenHang(form) {
        const blob = new Blob([noiDungDuLieuChuyenHang(ct, form)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `du-lieu-chuyen-hang-${ct.soPhieuChuyen}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    if (!ct) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                {loading || !loadError ? (
                    <KhungDangTai nhan={t("Đang tải phiếu chuyển kho")} />
                ) : (
                    <KhungLoiChungTu loi={loadError.loi} tenChungTu={t("phiếu chuyển kho")} onVeDanhSach={() => navigate("/transfer-tickets")} onThuLai={() => taiPhieu()} />
                )}
            </PageContainer>
        );
    }

    const tt = ct.trangThai;
    const q = ct.quyen ?? {};
    const st = getPhieuChuyenKhoStatus(tt, ct.coChenhLech, ct.tuChoi);
    const khoXuat = ct.khoXuat?.ten ?? t("kho xuất");
    const khoNhap = ct.khoNhap?.ten ?? t("kho nhận");
    // Chứng từ con (phiếu nhặt, PX, PN) kiểm theo kho của chứng từ: đổi sang đúng kho làm việc trước khi mở; người không
    // được phân kho đó thì hiện dạng chữ
    const moTaiKhoXuat = moDuocTaiKho(ct.khoXuat);
    const moTaiKhoNhap = moDuocTaiKho(ct.khoNhap);
    const denKhoXuat = () => lamViecTaiKho(ct.khoXuat);
    const denKhoNhap = () => lamViecTaiKho(ct.khoNhap);
    const phieuNhat = (pnhat) => (moTaiKhoXuat
        ? <LienKet to={`/goods-issues/pick-lists/${pnhat.id}`} onClick={denKhoXuat}>{pnhat.so}</LienKet>
        : <B>{pnhat.so}</B>);
    const tong = tongCot(ct.hang, "soLuongChuyen");
    // Nhặt hàng của phiếu Đã duyệt: phiếu nhặt (PX-CK vào danh sách chờ nhặt khi duyệt) hoặc chọn lô tay của phiếu cũ
    const nhat = tinhNhatChuyenKho(ct);
    const pn = nhat.phieuNhat;
    // Hàng đã đi mà chưa có số XKNB: máy chủ cho ghi số cả sau khi đã nhận / đã hủy (q.ghiSoXknb)
    const daDi = Boolean(ct.hinhThucVanChuyen);
    const thieuXknb = daDi && !ct.soPhieuXknb;
    const nguoiChiu = ct.nguoiVanChuyen ? <>{t("Người chịu trách nhiệm:")} <B>{ct.nguoiVanChuyen}</B></> : null;
    const bb = ct.bienBan;
    const phieuNhapDich = (ct.phieuNhap ?? []).filter((pn) => !pn.laHoanTra);
    const phieuNhapHoanTra = (ct.phieuNhap ?? []).filter((pn) => pn.laHoanTra);
    const inTai = (loai) => () => navigate(`/transfer-tickets/${id}/print/${loai}`);

    // ── Nút theo trạng thái (mỗi trạng thái nhiều nhất một nút chính) ──
    const nutPhu = [];
    const nutChinh = [];
    // Quản lý Kho tổng: Từ chối (có lý do) ngay trước Duyệt, như Yêu cầu nhập hàng; phiếu này không còn mục Hủy phiếu
    // (q.huy = false)
    if (tt === TT_CHUYEN.CHO_DUYET && q.tuChoi) {
        nutChinh.push({ nhan: t("Từ chối"), kieu: "vien", onClick: () => setHop("tuChoi") });
    }
    if (tt === TT_CHUYEN.CHO_DUYET && q.duyet) {
        nutChinh.push({ nhan: t("Duyệt và lập lệnh điều động"), icon: Check, onClick: () => setHop("duyet") });
    }
    if (tt === TT_CHUYEN.DA_DUYET) {
        // buocTiep: điện thoại đặt nút này lên thanh thao tác đáy cạnh "Xác nhận xuất" đang khóa (DauChungTu)
        if (q.nhat) nutPhu.push({ nhan: nhat.nhanNut, icon: PackageSearch, onClick: moPhieuNhat, dangChay: dangChay && !hop, buocTiep: true });
        if (q.xuat) {
            // Chỉ xuất khi phiếu nhặt đã hoàn tất (lô đã ghi vào PX-CK), phiếu cũ thì khi đã chọn đủ lô tay
            nutChinh.push({
                nhan: t("Xác nhận xuất"),
                icon: Truck,
                onClick: () => setHop("xuat"),
                khoa: !nhat.duocXuat,
                lyDo: nhat.lyDoKhoaXuat,
                hienLyDo: true,
            });
        }
    }
    if (q.ghiSoXknb) nutPhu.push({ nhan: t("Ghi số XKNB"), icon: PenLine, onClick: () => setHop("ghiSo") });
    if (tt === TT_CHUYEN.DANG_VAN_CHUYEN && q.nhan) {
        nutChinh.push({
            nhan: t("Nhận hàng", { context: "nut" }),
            icon: ClipboardCheck,
            onClick: () => {
                lamViecTaiKho(ct.khoNhap);
                navigate(`/transfer-tickets/${id}/receive`, { state: { tuChiTiet: true } });
            },
        });
    }
    // Chờ xử lý chênh lệch qua hai bước (BA 03/11): kho gửi xác nhận biên bản, rồi người được xử lý mới thấy nút Xử lý
    if (tt === TT_CHUYEN.CHO_XU_LY_LECH && q.xacNhanBienBan) {
        nutChinh.push({ nhan: t("Xác nhận biên bản"), icon: ClipboardCheck, onClick: () => setHop("xacNhanBb") });
    }
    if (tt === TT_CHUYEN.CHO_XU_LY_LECH && q.xuLyChenhLech) {
        nutChinh.push({ nhan: t("Xử lý chênh lệch"), icon: Scale, onClick: () => setHop("xuLy") });
    }
    if (tt === TT_CHUYEN.DA_HUY && q.nhapHoanTra) {
        nutChinh.push({ nhan: t("Nhập hàng hoàn trả"), icon: RotateCcw, onClick: () => setHop("hoanTra") });
    }

    // ⋯: bản in + hủy phiếu
    const menu = [];
    if (!ct.soLenhDieuDong) menu.push({ nhan: t("In yêu cầu chuyển kho"), icon: Printer, moTa: ct.soPhieuChuyen, onSelect: inTai("yeu-cau") });
    if (ct.soLenhDieuDong) menu.push({ nhan: t("In lệnh điều động"), icon: Printer, moTa: ct.soLenhDieuDong, onSelect: inTai("lenh-dieu-dong") });
    // Bản in XKNB đối chiếu chỉ có sau khi xuất (đủ lô, người chở, phương tiện)
    if (daDi) {
        menu.push({
            nhan: t("In phiếu XKNB (Mẫu 03/XKNB)"),
            icon: Printer,
            moTa: ct.soPhieuXknb ? `${ct.kyHieuXknb} · ${ct.soPhieuXknb}` : t("Chưa có số XKNB"),
            onSelect: inTai("xknb"),
        });
    }
    if (bb) menu.push({ nhan: t("In biên bản giao nhận"), icon: Printer, moTa: bb.soBienBan, onSelect: inTai("bien-ban") });
    if (q.huy) {
        menu.push({
            nhan: t("Hủy phiếu"),
            icon: Ban,
            nguyHiem: true,
            moTa: choGoc ? LY_DO_CHO_GOC : tt === TT_CHUYEN.DANG_VAN_CHUYEN
                ? t("Hàng đang đi: sau khi hủy phải nhập hoàn trả về kho xuất")
                : t("Nhả số lượng đang giữ chỗ tại {{khoXuat}}", { khoXuat }),
            khoa: dangChay || choGoc,
            onSelect: () => setHop("huy"),
        });
    }

    // ── Thông báo (B.1) ──
    const thongBao = [];
    if (ct.phieuGoc) {
        const goc = <LienKet to={`/transfer-tickets/${ct.phieuGoc.id}`}>{ct.phieuGoc.so}</LienKet>;
        // Câu sau theo bước: còn chờ duyệt (quản lý kho xuất chọn Giao bù theo Cấu hình) thì đi lại từ bước duyệt; đã có
        // lệnh (tự duyệt khi Quản lý Kho tổng xử lý chênh lệch, BA 03/11) thì nhặt, xuất như phiếu thường
        thongBao.push(
            <DongThongBao key="giaoBu" tone="info">
                {t("Phiếu giao bù cho")} {goc}
                {tt === TT_CHUYEN.CHO_DUYET ? t(". Đi lại từ bước duyệt như phiếu thường.")
                    : tt === TT_CHUYEN.DA_DUYET && ct.soLenhDieuDong ? <>{t(", đã có lệnh điều động")} <B>{ct.soLenhDieuDong}</B>{t(". Nhặt, xuất, nhận hàng như phiếu thường.")}</>
                        : "."}
            </DongThongBao>,
        );
    }
    if (tt === TT_CHUYEN.CHO_DUYET) {
        thongBao.push(
            <DongThongBao key="choDuyet" tone="neutral">
                {t("Đang giữ chỗ")} <B>{soVN(tong)}</B> {t("sản phẩm tại", { count: tong })} <B>{khoXuat}</B>{t(". Quản lý Kho tổng duyệt và lập lệnh điều động thì kho xuất mới nhặt hàng.")}
            </DongThongBao>,
        );
    }
    if (tt === TT_CHUYEN.DA_DUYET) {
        let cauNhat;
        if (pn?.trangThai === "da_nhat") {
            cauNhat = <>{t("Đã nhặt xong theo phiếu nhặt")} {phieuNhat(pn)}{pn.nguoi ? <> ({pn.nguoi})</> : null}{t(", lô đã giữ cho phiếu xuất")} <B>{ct.phieuXuat?.so}</B>{t(". Bấm")} </>;
        } else if (pn) {
            cauNhat = <>{t("Phiếu nhặt")} {phieuNhat(pn)} {nhat.tenTrangThai.toLowerCase()}{pn.nguoi ? <> · <B>{pn.nguoi}</B></> : ` · ${t("chưa phân công")}`}{t(". Nhặt đủ, hoàn tất nhặt rồi bấm")} </>;
        } else if (nhat.chonLoTay) {
            cauNhat = <>{t("Phiếu xuất")} <B>{ct.phieuXuat?.so}</B> {t("chọn lô tay (phiếu duyệt trước khi có phiếu nhặt); chọn đủ lô rồi bấm")} </>;
        } else {
            cauNhat = <>{t("Bấm")} <B>{t("Mở phiếu nhặt")}</B> {t("để nhặt hàng; nhặt xong rồi bấm")} </>;
        }
        thongBao.push(
            <DongThongBao key="daDuyet" tone="info">
                {t("Phiếu đã có lệnh điều động. Hàng rời")} <B>{khoXuat}</B> {t("cùng")} <B>{t("giấy đi đường (phiếu XKNB)")}</B>
                {ct.xknbCheDo === "CHI_CANH_BAO" ? ` (${t("đang bật Chỉ cảnh báo: được xuất trước, ghi số sau")})` : ""}.{" "}
                {cauNhat}<B>{t("Xác nhận xuất")}</B> {t("để ghi người chở hàng và số phiếu.")}
            </DongThongBao>,
        );
    }
    if (tt === TT_CHUYEN.DANG_VAN_CHUYEN) {
        const duKien = ct.ngayDuKienDen ? <>{nguoiChiu ? `, ${t("dự kiến đến")}` : t("Dự kiến đến")} <B>{gioNgayNgan(ct.ngayDuKienDen)}</B></> : null;
        thongBao.push(!ct.soPhieuXknb ? (
            <DongThongBao key="dangDi" tone="warn" actions={q.ghiSoXknb ? <NutChu onClick={() => setHop("ghiSo")}>{t("Ghi số XKNB")}</NutChu> : null}>
                {t("Hàng đang đi mà chưa ghi số phiếu XKNB (xuất trước, ghi số sau).")} {nguoiChiu}{duKien}{nguoiChiu || duKien ? "." : null}
            </DongThongBao>
        ) : (
            <DongThongBao key="dangDi" tone="info">
                {t("Hàng đang trên đường cùng giấy đi đường")} <B>{ct.kyHieuXknb} · {ct.soPhieuXknb}</B>. {nguoiChiu}{duKien}{nguoiChiu || duKien ? "." : null}
            </DongThongBao>
        ));
        if (ct.tre) {
            thongBao.push(
                <DongThongBao key="tre" tone="warn">
                    {t("Quá giờ dự kiến đến ({{tre}}) mà {{khoNhap}} chưa nhận hàng.", { tre: treBaoLau(ct.ngayDuKienDen), khoNhap })}
                </DongThongBao>,
            );
        }
    }
    if (tt !== TT_CHUYEN.DANG_VAN_CHUYEN && thieuXknb && q.ghiSoXknb) {
        thongBao.push(
            <DongThongBao key="thieuSo" tone="warn" actions={<NutChu onClick={() => setHop("ghiSo")}>{t("Ghi số XKNB")}</NutChu>}>
                {t("Hàng đã đi mà chưa ghi số phiếu XKNB. Ghi số ngay khi phần mềm hóa đơn điện tử phát hành để chứng từ của chuyến hàng đủ.")}
            </DongThongBao>,
        );
    }
    if (tt === TT_CHUYEN.CHO_XU_LY_LECH && bb) {
        // Ý kiến kho gửi bỏ dấu chấm cuối (câu tự thêm dấu chấm)
        const yKien = (bb.ghiChuKhoGui ?? "").replace(/[.\s]+$/, "");
        thongBao.push(
            <DongThongBao key="lech" tone="warn">
                {t("{{khoNhap}} nhận", { khoNhap })} <B>{soVN(bb.tongNhan)}/{soVN(bb.tongGui)}</B>{t(". Biên bản")} <B>{bb.soBienBan}</B>{" "}
                {t("ghi thiếu {{thieu}}, hỏng {{hong}}; phần lệch giữ ở kho trung chuyển, chờ {{cho}}.", { thieu: soVN(bb.tongThieu), hong: soVN(bb.tongHong), cho: cauChoXuLyLech(ct) })}
                {bb.ngayXacNhanGui ? (
                    <>
                        {" "}{t("{{khoXuat}} đã xác nhận biên bản", { khoXuat })}{bb.nguoiXacNhanGui ? <> ({bb.nguoiXacNhanGui}, {gioNgayNgan(bb.ngayXacNhanGui)})</> : null}
                        {yKien ? <>{t(". Ý kiến kho gửi: {{yKien}}", { yKien })}</> : null}.
                    </>
                ) : q.xacNhanBienBan ? ` ${t("Xem bảng hàng lệch, ảnh rồi bấm Xác nhận biên bản.")}` : null}
            </DongThongBao>,
        );
    }
    if (tt === TT_CHUYEN.HOAN_TAT && bb?.phuongAn && bb.phuongAn !== "CHUA_XU_LY") {
        const giaoBu = ct.phieuGiaoBu?.[0];
        thongBao.push(
            <DongThongBao key="daXuLy" tone="ok">
                {t("Đã xử lý chênh lệch: ghi giảm {{so}} sản phẩm theo phiếu điều chỉnh kho", { count: (bb.tongThieu ?? 0) + (bb.tongHong ?? 0), so: soVN((bb.tongThieu ?? 0) + (bb.tongHong ?? 0)) })}{" "}
                {ct.phieuDieuChinh ? <LienKet to={`/transfer-tickets/adjustments/${ct.phieuDieuChinh.id}`}>{ct.phieuDieuChinh.so}</LienKet> : null}
                {bb.phuongAn === "GIAO_BU_HANG" && giaoBu ? (
                    <>{t(", rồi giao bù bằng phiếu")} <LienKet to={`/transfer-tickets/${giaoBu.id}`}>{giaoBu.so}</LienKet>{t(". Phiếu này đóng với số đã nhận {{nhan}}/{{gui}}.", { nhan: soVN(bb.tongNhan), gui: soVN(bb.tongGui) })}</>
                ) : "."}
            </DongThongBao>,
        );
    }
    if (tt === TT_CHUYEN.DA_HUY) {
        // Lý do bỏ dấu chấm cuối (câu tự thêm dấu chấm); chỉ còn dấu chấm thì coi như không ghi
        const lyDoTuChoi = (ct.lyDoHuy ?? "").replace(/[.\s]+$/, "");
        thongBao.push(ct.huyKhiDangChuyen && !ct.daNhapHoanTra ? (
            <DongThongBao key="huy" tone="warn">
                {t("Phiếu đã hủy khi hàng đang trên đường.")} <B>{khoXuat}</B> {t("cần nhập hàng hoàn trả để đưa hàng về kho.")}
            </DongThongBao>
        ) : ct.tuChoi ? (
            <DongThongBao key="huy" tone="bad">
                {t("Yêu cầu bị từ chối")} {ct.ngayHuy ? gioNgayNgan(ct.ngayHuy) : ""}{ct.nguoiHuy ? ` ${t("bởi {{ten}}", { ten: ct.nguoiHuy })}` : ""}{lyDoTuChoi ? `. ${t("Lý do: {{lyDo}}", { lyDo: lyDoTuChoi })}` : ""}.
                {` ${t("Hàng giữ chỗ đã trả về tồn {{khoXuat}}.", { khoXuat })}`}
            </DongThongBao>
        ) : (
            <DongThongBao key="huy" tone="neutral">
                {t("Phiếu đã hủy")} {ct.ngayHuy ? gioNgayNgan(ct.ngayHuy) : ""}{ct.nguoiHuy ? ` ${t("bởi {{ten}}", { ten: ct.nguoiHuy })}` : ""}{ct.lyDoHuy ? `. ${t("Lý do: {{lyDo}}", { lyDo: ct.lyDoHuy })}` : ""}.
                {phieuNhapHoanTra[0] ? ` ${t("Hàng đã về {{khoXuat}} theo phiếu nhập hoàn trả {{so}}.", { khoXuat, so: phieuNhapHoanTra[0].so })}` : ""}
            </DongThongBao>
        ));
    }
    if (chuaKe.soLo > 0) {
        thongBao.push(
            <DongThongBao key="chuaKe" tone="warn" actions={<NutChu onClick={() => moXepKe("nhan")}>Xếp kệ</NutChu>}>
                <B>{soVN(chuaKe.soLuong)} sản phẩm</B> ({soVN(chuaKe.soLo)} lô) đã nhận vào {khoNhap} chưa có kệ: người nhặt hàng chưa
                thấy chỗ lấy cho tới khi xếp.
            </DongThongBao>,
        );
    }
    if (chuaKeHoanTra.soLo > 0) {
        thongBao.push(
            <DongThongBao key="chuaKeHoanTra" tone="warn" actions={<NutChu onClick={() => moXepKe("hoanTra")}>Xếp kệ</NutChu>}>
                <B>{soVN(chuaKeHoanTra.soLuong)} sản phẩm</B> ({soVN(chuaKeHoanTra.soLo)} lô) đã về lại {khoXuat} chưa có kệ: người nhặt
                hàng chưa thấy chỗ lấy cho tới khi xếp.
            </DongThongBao>,
        );
    }

    // ── Cột phải ──
    const hinhThuc = ct.hinhThucVanChuyen;
    const phuongTien = hinhThuc === "CHUYEN_PHAT"
        ? [ct.donViVanChuyen, ct.maVanDonHopDong ? t("vận đơn {{ma}}", { ma: ct.maVanDonHopDong }) : null].filter(Boolean).join(" · ")
        : [ct.loaiPhuongTien, ct.bienSoXe].filter(Boolean).join(" · ");
    const nguoiNhan = phieuNhapDich.find((pn) => String(pn.trangThai) === "3")?.nguoi;

    const lienQuan = [
        ct.phieuGoc ? { khoa: "goc", loai: t("Phiếu chuyển gốc"), ma: ct.phieuGoc.so, to: `/transfer-tickets/${ct.phieuGoc.id}`, trangThai: getPhieuChuyenKhoStatus(ct.phieuGoc.trangThai, false, ct.phieuGoc.tuChoi).label, quyTrinh: "chuyenKho" } : null,
        !ct.soLenhDieuDong ? { khoa: "yc", loai: t("Yêu cầu chuyển kho · In"), ma: ct.soPhieuChuyen, onClick: inTai("yeu-cau") } : null,
        ct.soLenhDieuDong ? { khoa: "ldd", loai: t("Lệnh điều động · In"), ma: ct.soLenhDieuDong, onClick: inTai("lenh-dieu-dong") } : null,
        hinhThuc ? { khoa: "xknb", loai: t("Giấy đi đường (phiếu XKNB) · In"), ma: ct.soPhieuXknb ? `${ct.kyHieuXknb} · ${ct.soPhieuXknb}` : t("Chưa có số"), onClick: inTai("xknb") } : null,
        ct.phieuNhat ? {
            khoa: "pl",
            loai: t("Phiếu nhặt hàng"),
            ma: ct.phieuNhat.so,
            to: moTaiKhoXuat ? `/goods-issues/pick-lists/${ct.phieuNhat.id}` : undefined,
            onClick: moTaiKhoXuat ? denKhoXuat : undefined,
            trangThai: getPickListStatus(ct.phieuNhat.trangThai).label,
            quyTrinh: "phieuNhat",
        } : null,
        ct.phieuXuat ? {
            khoa: "px",
            loai: nhanPhieuXuatLienQuan(ct),
            ma: ct.phieuXuat.so,
            // PX-CK xem được từ cả kho xuất lẫn kho nhận (kiemTraXemMotTrong); đổi sang kho xuất nếu có quyền ở đó
            to: moTaiKhoXuat || moTaiKhoNhap ? `/goods-issues/${ct.phieuXuat.id}` : undefined,
            onClick: moTaiKhoXuat || moTaiKhoNhap ? denKhoXuat : undefined,
            trangThai: getPhieuXuatKhoStatus(Number(ct.phieuXuat.trangThai)).label,
            quyTrinh: "phieuXuat",
        } : null,
        ...phieuNhapDich.map((pn) => ({ khoa: `pn-${pn.id}`, loai: t("Phiếu nhập kho"), ma: pn.so, to: moTaiKhoNhap ? `/goods-receipts/${pn.id}` : undefined, onClick: moTaiKhoNhap ? denKhoNhap : undefined, trangThai: getGoodsReceiptStatus(Number(pn.trangThai)).label, quyTrinh: "phieuNhap" })),
        bb ? { khoa: "bb", loai: t("Biên bản giao nhận · In"), ma: bb.soBienBan, onClick: inTai("bien-ban") } : null,
        ct.phieuDieuChinh ? { khoa: "dck", loai: t("Phiếu điều chỉnh kho (giảm)"), ma: ct.phieuDieuChinh.so, to: `/transfer-tickets/adjustments/${ct.phieuDieuChinh.id}` } : null,
        ...(ct.phieuGiaoBu ?? []).map((p) => ({ khoa: `gb-${p.id}`, loai: t("Phiếu chuyển giao bù"), ma: p.so, to: `/transfer-tickets/${p.id}`, trangThai: getPhieuChuyenKhoStatus(p.trangThai, false, p.tuChoi).label, quyTrinh: "chuyenKho" })),
        ...phieuNhapHoanTra.map((pn) => ({ khoa: `pnr-${pn.id}`, loai: t("Phiếu nhập hoàn trả"), ma: pn.so, to: moTaiKhoXuat ? `/goods-receipts/${pn.id}` : undefined, onClick: moTaiKhoXuat ? denKhoXuat : undefined, trangThai: getGoodsReceiptStatus(Number(pn.trangThai)).label, quyTrinh: "phieuNhap" })),
    ].filter(Boolean);

    const cotPhai = (
        <CotThuocTinh nhan={t("Thông tin phiếu chuyển kho")}>
            <NhomThuocTinh nhan={t("Tuyến chuyển")}>
                <TuyenChuyen khoNguon={khoXuat} khoDich={khoNhap} />
            </NhomThuocTinh>
            <NhomThuocTinh nhan={t("Lệnh điều động")}>
                {ct.soLenhDieuDong ? (
                    <BangThuocTinh
                        muc={[
                            { ma: "so", nhan: t("Số lệnh"), giaTri: ct.soLenhDieuDong },
                            { ma: "ngay", nhan: t("Ngày"), giaTri: ngayGioDu(ct.ngayLenhDieuDong) },
                            { ma: "nguoi", nhan: t("Người ra lệnh"), giaTri: ct.nguoiRaLenh },
                            // Lệnh tự lập cho phiếu giao bù: ghi chú lệnh là câu lý do đầy đủ ("Giao bù hàng cho phiếu …")
                            {
                                ma: "lyDo",
                                nhan: t("Lý do"),
                                giaTri: ct.lyDoDieuDong === LY_DO_GIAO_BU.ma
                                    ? ct.ghiChuLenh || t(LY_DO_GIAO_BU.nhan)
                                    : t(tenTheoMa(LY_DO_DIEU_DONG_HIEN_THI, ct.lyDoDieuDong)),
                            },
                            { ma: "ghiChu", nhan: t("Ghi chú"), giaTri: ct.ghiChuLenh, an: !ct.ghiChuLenh || ct.lyDoDieuDong === LY_DO_GIAO_BU.ma },
                        ]}
                    />
                ) : (
                    <p className="text-[13px] leading-5 text-bo-muted">
                        {ct.tuChoi ? t("Yêu cầu bị từ chối, không lập lệnh.") : tt === TT_CHUYEN.DA_HUY ? t("Phiếu hủy trước khi có lệnh.") : t("Hệ thống cấp số lệnh khi phiếu được duyệt.")}
                    </p>
                )}
            </NhomThuocTinh>
            {hinhThuc ? (
                <NhomThuocTinh nhan={t("Vận chuyển")}>
                    <BangThuocTinh
                        muc={[
                            { ma: "ht", nhan: t("Hình thức"), giaTri: t(tenTheoMa(HINH_THUC_VAN_CHUYEN, hinhThuc)) },
                            { ma: "dv", nhan: t("Đơn vị"), giaTri: [ct.donViVanChuyen, ct.maVanDonHopDong].filter(Boolean).join(" · "), an: hinhThuc !== "THUE_NGOAI" },
                            { ma: "nguoi", nhan: t("Người vận chuyển"), giaTri: ct.nguoiVanChuyen },
                            { ma: "dt", nhan: t("Điện thoại"), giaTri: cheGiua(ct.soDienThoaiVanChuyen) },
                            { ma: "pt", nhan: t("Phương tiện"), giaTri: phuongTien },
                            {
                                ma: "den",
                                nhan: t("Dự kiến đến"),
                                giaTri: ct.ngayDuKienDen ? (
                                    <span className={ct.tre ? "font-semibold text-bo-tt-chu-y-chu" : undefined}>
                                        {ngayGioDu(ct.ngayDuKienDen)}{ct.tre ? ` · ${treBaoLau(ct.ngayDuKienDen)}` : ""}
                                    </span>
                                ) : null,
                            },
                            { ma: "thucTe", nhan: t("Thực tế đến"), giaTri: ct.ngayThucTeDen ? ngayGioDu(ct.ngayThucTeDen) : null, an: !ct.ngayThucTeDen },
                        ]}
                    />
                </NhomThuocTinh>
            ) : null}
            {hinhThuc ? (
                <NhomThuocTinh nhan={t("Giấy đi đường (phiếu XKNB)")}>
                    {ct.soPhieuXknb ? (
                        <BangThuocTinh
                            muc={[
                                { ma: "so", nhan: t("Ký hiệu · số"), giaTri: <span className="font-mono">{ct.kyHieuXknb} · {ct.soPhieuXknb}</span> },
                                { ma: "ngay", nhan: t("Ngày lập"), giaTri: ct.ngayLapXknb ? formatDate(ct.ngayLapXknb) : null },
                                { ma: "tc", nhan: t("Mã tra cứu"), giaTri: ct.maTraCuuXknb ? <span className="font-mono">{cheGiua(ct.maTraCuuXknb, 4, 4)}</span> : null },
                            ]}
                        />
                    ) : (
                        <span className="inline-flex rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-medium text-bo-tt-chu-y-chu">{t("Chưa có số")}</span>
                    )}
                </NhomThuocTinh>
            ) : null}
            {bb ? (
                <NhomThuocTinh nhan={t("Biên bản giao nhận")}>
                    <BangThuocTinh
                        muc={[
                            { ma: "so", nhan: t("Số biên bản"), giaTri: bb.soBienBan },
                            { ma: "ngay", nhan: t("Lập lúc"), giaTri: ngayGioDu(bb.ngayLap) },
                            { ma: "lap", nhan: t("Người lập"), giaTri: bb.nguoiLap },
                            { ma: "giao", nhan: t("Người giao"), giaTri: bb.nguoiVanChuyen },
                            { ma: "lech", nhan: t("Chênh lệch"), giaTri: t("Thiếu {{thieu}} · hỏng {{hong}}", { thieu: soVN(bb.tongThieu), hong: soVN(bb.tongHong) }) },
                            // Kho gửi xác nhận trên F Centric (BA 03/11); biên bản xử lý từ trước khi có bước này thì ẩn dòng
                            {
                                ma: "khoGui",
                                nhan: t("Kho gửi xác nhận"),
                                giaTri: bb.ngayXacNhanGui
                                    ? `${bb.nguoiXacNhanGui ?? ""} · ${gioNgayNgan(bb.ngayXacNhanGui)}`
                                    : <span className="inline-flex rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-medium text-bo-tt-chu-y-chu">{t("Chờ xác nhận")}</span>,
                                an: !bb.ngayXacNhanGui && !choKhoGuiXacNhan(ct),
                            },
                            { ma: "yKien", nhan: t("Ý kiến kho gửi"), giaTri: bb.ghiChuKhoGui, an: !bb.ghiChuKhoGui },
                            {
                                ma: "pa",
                                nhan: t("Phương án"),
                                giaTri: bb.phuongAn && bb.phuongAn !== "CHUA_XU_LY"
                                    ? t(tenTheoMa(PHUONG_AN_CHENH_LECH, bb.phuongAn))
                                    : <span className="inline-flex rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-medium text-bo-tt-chu-y-chu">{t("Chờ xử lý")}</span>,
                            },
                            { ma: "duyet", nhan: t("Người duyệt"), giaTri: bb.nguoiDuyet ? `${bb.nguoiDuyet} · ${gioNgayNgan(bb.ngayDuyet)}` : null, an: !bb.nguoiDuyet },
                        ]}
                    />
                    <AnhBienBanGiaoNhan ct={ct} onDaDoi={() => taiPhieu({ silent: true, baoLoi: true })} />
                </NhomThuocTinh>
            ) : null}
            <NhomThuocTinh nhan={t("Người thực hiện")}>
                <BangThuocTinh
                    muc={[
                        { ma: "tao", nhan: t("Người tạo"), giaTri: ct.nguoiTao },
                        { ma: "duyet", nhan: t("Người duyệt"), giaTri: ct.nguoiRaLenh, an: !ct.nguoiRaLenh },
                        { ma: "nhat", nhan: t("Người nhặt"), giaTri: ct.phieuNhat?.nguoi, an: !ct.phieuNhat?.nguoi },
                        { ma: "xuat", nhan: t("Người xuất"), giaTri: phieuXuatDaXuat(ct) ? ct.phieuXuat?.nguoi : null, an: !phieuXuatDaXuat(ct) },
                        { ma: "nhan", nhan: t("Người nhận"), giaTri: nguoiNhan, an: !nguoiNhan },
                        { ma: "huy", nhan: ct.tuChoi ? t("Người từ chối") : t("Người hủy"), giaTri: ct.nguoiHuy, an: !ct.nguoiHuy },
                        { ma: "ghiChu", nhan: t("Ghi chú"), giaTri: ct.ghiChu },
                        { ma: "lyDoHuy", nhan: ct.tuChoi ? t("Lý do từ chối") : t("Lý do hủy"), giaTri: ct.lyDoHuy, an: !ct.lyDoHuy },
                    ]}
                />
            </NhomThuocTinh>
            <ChungTuLienQuan ds={lienQuan} nhan={t("Chứng từ")} />
        </CotThuocTinh>
    );

    const props = (ten) => ({
        mo: hop === ten,
        onDong: dongHop,
        ct,
        dangChay,
        loi: hop === ten ? loiHop : null,
    });

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={ct.soPhieuChuyen}
                        trangThai={{ label: st.label, quyTrinh: "chuyenKho" }}
                        dongPhu={[
                            `${khoXuat} → ${khoNhap}`,
                            `${t("tạo {{ngay}}", { ngay: ngayGioDu(ct.ngayTao) })}${ct.nguoiTao ? ` ${t("bởi {{ten}}", { ten: ct.nguoiTao })}` : ""}`,
                            <B key="sl">{t("{{so}} biến thể", { count: ct.hang?.length ?? 0, so: soVN(ct.hang?.length ?? 0) })}, {t("{{so}} sản phẩm", { count: tong, so: soVN(tong) })}</B>,
                        ]}
                        onQuayLai={quayLai}
                        nhanQuayLai={t("Về danh sách phiếu chuyển kho")}
                        saoChepMa={{ giaTri: ct.soPhieuChuyen, nhan: t("Sao chép mã phiếu") }}
                        menu={menu}
                        nutPhu={khoaKhiChoGoc(nutPhu, choGoc)}
                        nutChinh={khoaKhiChoGoc(nutChinh, choGoc)}
                    />
                }
                tienTrinh={<TienTrinhChungTu nhan={t("Tiến trình phiếu chuyển kho")} buoc={buocChuyenKho(ct)} />}
                thongBao={thongBao.length ? thongBao : null}
                chinh={<BangHangPhieuChuyen ct={ct} />}
                cotPhai={cotPhai}
            />

            {hop === "duyet" ? (
                <HopDuyet
                    {...props("duyet")}
                    onXacNhan={(body) => chay(() => phieuChuyenKhoService.duyet(id, body), (kq) => t("Đã duyệt và lập lệnh điều động {{so}}", { so: kq?.soLenhDieuDong ?? "" }).trim(), t("Không duyệt được phiếu"))}
                />
            ) : null}
            {hop === "tuChoi" ? (
                <HopTuChoi {...props("tuChoi")} onXacNhan={(body) => chay(() => phieuChuyenKhoService.tuChoi(id, body), t("Đã từ chối yêu cầu chuyển kho"), t("Không từ chối được phiếu"))} />
            ) : null}
            {hop === "xuat" ? (
                <HopXacNhanXuat
                    {...props("xuat")}
                    onTaiDuLieu={taiDuLieuChuyenHang}
                    onXacNhan={(body) => chay(
                        () => phieuChuyenKhoService.xacNhanXuat(id, body),
                        body.vanXuatKhiChuaCoSo ? t("Đã xuất khi chưa có số XKNB. Phiếu nằm ở mục Thiếu giấy đi đường.") : t("Đã xác nhận xuất. Hàng đang trên đường cùng giấy đi đường {{kyHieu}} · {{so}}.", { kyHieu: body.kyHieuXknb, so: body.soPhieuXknb }),
                        t("Không xác nhận xuất được"),
                        ct.khoXuat,
                    )}
                />
            ) : null}
            {hop === "ghiSo" ? (
                <HopGhiSoXknb
                    {...props("ghiSo")}
                    onTaiDuLieu={() => taiDuLieuChuyenHang({
                        hinhThuc: ct.hinhThucVanChuyen,
                        nguoi: ct.nguoiVanChuyen,
                        loaiPhuongTien: ct.loaiPhuongTien,
                        bienSo: ct.bienSoXe,
                        donVi: ct.donViVanChuyen,
                    })}
                    onXacNhan={(body) => chay(() => phieuChuyenKhoService.ghiSoXknb(id, body), t("Đã ghi số XKNB {{kyHieu}} · {{so}}", { kyHieu: body.kyHieuXknb, so: body.soPhieuXknb }), t("Không ghi được số XKNB"), ct.khoXuat)}
                />
            ) : null}
            {hop === "huy" ? (
                <HopHuy {...props("huy")} onXacNhan={(body) => chay(() => phieuChuyenKhoService.huy(id, body), t("Đã hủy phiếu chuyển kho"), t("Không hủy được phiếu"))} />
            ) : null}
            {hop === "xacNhanBb" ? (
                <HopXacNhanBienBan
                    {...props("xacNhanBb")}
                    onXacNhan={(body) => chay(
                        () => phieuChuyenKhoService.xacNhanBienBan(id, body),
                        (kq) => t("Đã xác nhận biên bản {{so}}", { so: kq?.soBienBan ?? "" }).trim(),
                        t("Không xác nhận được biên bản"),
                        // Kho gửi xác nhận tại kho xuất (máy chủ kiểm kho đang chọn như các bước ghi khác của kho xuất)
                        ct.khoXuat,
                    )}
                />
            ) : null}
            {hop === "xuLy" ? (
                <HopXuLyChenhLech
                    {...props("xuLy")}
                    onXacNhan={(body) => chay(
                        () => phieuChuyenKhoService.xuLyChenhLech(id, body),
                        (kq) => t("Đã xử lý chênh lệch, phiếu điều chỉnh {{so}}", { so: kq?.soPhieuDieuChinh ?? "" }).trim(),
                        t("Không xử lý được chênh lệch"),
                        // Quản lý kho xuất được xử lý (Cấu hình › Chuyển kho) thì máy chủ kiểm kho đang chọn là kho xuất;
                        // Quản lý Kho tổng xử lý ở kho nào cũng được, giữ nguyên kho làm việc
                        laQuanLyKhoTong() ? undefined : ct.khoXuat,
                    )}
                />
            ) : null}
            {hop === "hoanTra" ? (
                <HopNhapHoanTra
                    {...props("hoanTra")}
                    onXacNhan={async () => {
                        const kq = await chay(() => phieuChuyenKhoService.nhapHoanTra(id), (r) => `Đã nhập hàng hoàn trả, phiếu nhập ${r?.soPhieuNhap ?? ""}`.trim(), "Không nhập hoàn trả được", ct.khoXuat);
                        // Hàng vừa về kho xuất: mở hộp xếp kệ khi số đếm (tải lại theo số phiếu nhập) thấy còn hàng chưa có kệ
                        if (kq?.phieuNhapId != null && !daGoRef.current) setHenMo("hoanTra");
                    }}
                />
            ) : null}
            {hopXepKe.phien > 0 ? (
                <HopXepKeChungTu
                    key={hopXepKe.phien}
                    mo={hopXepKe.mo}
                    kho={hopXepKe.loai === "hoanTra" ? ct.khoXuat : ct.khoNhap}
                    phieuChuyenId={ct.id}
                    tieuDe={!hopXepKe.tuMo ? "Xếp kệ hàng của phiếu" : hopXepKe.loai === "hoanTra" ? "Xếp kệ hàng vừa về" : "Xếp kệ hàng vừa nhận"}
                    tuMo={hopXepKe.tuMo}
                    soChungTu={hopXepKe.loai === "hoanTra" ? (phieuNhapHoanTra[0]?.so ?? ct.soPhieuChuyen) : ct.soPhieuChuyen}
                    onDong={dongXepKe}
                />
            ) : null}
        </PageContainer>
    );
}
