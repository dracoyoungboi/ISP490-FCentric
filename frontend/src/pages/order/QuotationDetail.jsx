import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, Check, FileText } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP, GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import {
    CAU_HET_THOI_HAN,
    MO_TA_HET_THOI_HAN,
    chayCoThoiHan,
    khiGocKetThuc,
    khoaKhiChoGoc,
    laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import BangBaoGia from "@/components/order/chi-tiet-bao-gia/BangBaoGia";
import ThuocTinhBaoGia from "@/components/order/chi-tiet-bao-gia/ThuocTinhBaoGia";
import {
    LY_DO_KHONG_CHAP_NHAN_TOI_DA,
    TRANG_THAI_BAO_GIA,
    cachXuLyLoiXetBaoGia,
    cauCanhBaoChapNhan,
    congGia,
    coTheXetBaoGia,
    dongBaoGia,
    ghiChuNhaCungCap,
    laConChoGia,
    laDaChot,
    lyDoKhoaChapNhan,
    nhanTrangThaiBaoGia,
    taoBodyXetBaoGia,
    tinhBuocBaoGia,
    trangThaiGuiLaiYeuCau,
} from "@/components/order/chi-tiet-bao-gia/tinhBaoGia";
import { locCauMayChuMuaHang } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import { getBaoGiaNccStatus, getDonMuaHangStatus } from "@/constants/donMuaHang";
import { VAI_TRO_GUI_YEU_CAU_BAO_GIA } from "@/constants/vaiTroGuiYeuCauBaoGia";
import { YEU_CAU_NHAP_HANG_STATUS } from "@/constants/yeuCauNhapHang";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import purchaseOrderService from "@/services/purchaseOrderService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Chỉ quản trị viên và nhân viên mua hàng chốt báo giá (giữ như màn cũ; backend còn cho quản lý kho)
const VAI_TRO_CHOT_BAO_GIA = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
// Lỗi máy chủ khi xét báo giá: xem tinhBaoGia.cachXuLyLoiXetBaoGia (409, 404 đóng hộp và tải lại; còn lại giữ hộp)
const ID_LY_DO = "ly-do-khong-chap-nhan";

/**
 * Chi tiết báo giá · bản "một khối" (21/10/2026, artboard BaoGia.dc.html): đầu khối (mã, trạng thái, tổng tiền),
 * tiến trình 4 bước, các dòng thông báo, bảng giá gom theo sản phẩm, cột phải (nhà cung cấp, kho nhận, chứng từ liên quan).
 * - "Đã báo giá" ⇔ `ngayBaoGia` (HOP-DONG 2.3). Nút Chấp nhận / Không chấp nhận chỉ hiện khi nhà cung cấp đã gửi báo giá
 *   và yêu cầu gốc đang ở 3; cả hai gửi `ngayBaoGiaDaXem` = `ngayBaoGia` lúc mở hộp (nhà cung cấp gửi lại giá trong lúc
 *   hộp mở thì máy chủ trả 409, màn hiện câu máy chủ rồi tải lại).
 * - Không chấp nhận: ô Lý do không bắt buộc (≤ 500 ký tự), nhà cung cấp thấy trong email kết quả.
 * - Ghi chú nhà cung cấp gửi kèm báo giá hiện một lần ở dòng thông báo (chấp nhận báo giá là chấp nhận cả ghi chú).
 * - K11: email yêu cầu báo giá chưa gửi được (cờ `chuaGuiDuocYeuCau`) thì báo, vai trò gửi được thấy nút Gửi lại.
 * - Báo giá đã chấp nhận mở Chi tiết đơn mua hàng (cùng mã, có bản in).
 */
export default function QuotationDetail() {
    const { id } = useParams();
    // Đổi sang báo giá khác thì dựng lại màn: từ khóa, trang, hộp thoại của báo giá cũ không mang sang
    return <ChiTietBaoGia key={id} id={id} />;
}

function ChiTietBaoGia({ id }) {
    const navigate = useNavigate();

    const taiBaoGia = useCallback(async () => {
        const res = await purchaseOrderService.getById(id);
        return res?.data ?? null;
    }, [id]);
    const q = useTaiDuLieu(taiBaoGia, `bao-gia-${id}`, { enabled: Boolean(id) });
    const don = q.data && String(q.data.id) === String(id) ? q.data : null;

    const [hop, setHop] = useState(""); // "" | "chapNhan" | "tuChoi"
    const [lyDo, setLyDo] = useState("");
    const [dangChay, setDangChay] = useState(false);
    const [loiHop, setLoiHop] = useState(null); // câu lỗi hiện trong hộp (lỗi mạng, lỗi máy chủ)
    // ngayBaoGia đúng như máy chủ trả, chụp lúc mở hộp: gửi kèm để máy chủ chặn khi nhà cung cấp vừa gửi lại giá
    const ngayBaoGiaDaXemRef = useRef(null);
    // Chặn bấm xác nhận 2 lần trước khi nút kịp khóa
    const dangGoiRef = useRef(false);
    // Hết thời hạn mà máy chủ có thể vẫn đang làm: khóa nút thao tác tới khi lời gọi gốc kết thúc (khiGocKetThuc),
    // tránh bấm lại gửi hai email
    const [choGoc, setChoGoc] = useState(false);
    const huyChoGocRef = useRef(null);
    // K11: đang gửi lại / đã gửi lại email yêu cầu báo giá trong phiên màn này (không hiện lại nút tới khi dựng lại màn)
    const [dangGuiLai, setDangGuiLai] = useState(false);
    const [daGuiLai, setDaGuiLai] = useState(false);
    const dangGuiLaiRef = useRef(false);
    // Màn đã gỡ (rời trang trong lúc chờ): nhánh hết thời hạn bỏ qua báo lỗi, khóa nút, tải lại; gỡ thì hủy chờ
    const daGoRef = useRef(false);
    useEffect(() => {
        daGoRef.current = false;
        return () => {
            daGoRef.current = true;
            huyChoGocRef.current?.();
        };
    }, []);

    // Quay lại tab thì tải lại ngầm (nhà cung cấp có thể vừa gửi giá); không tải khi đang thao tác hay đang mở hộp
    // (giá trên màn phải đúng là giá người dùng đang xét)
    useTaiLaiKhiQuayLai(() => q.reload(), { bat: Boolean(id) && !q.loading && !dangChay && !hop, lanCuoi: q.capNhatLuc });

    const tomTat = useMemo(() => congGia(don?.chiTietDonMuaHangs), [don]);
    const dong = useMemo(() => dongBaoGia(don?.chiTietDonMuaHangs), [don]);
    const bang = useBangChungTu(dong);
    const ycId = don?.yeuCauMuaHang?.id ?? null;
    const quayLai = useQuayLai(ycId != null ? `/quotation-requests/${ycId}` : "/quotation-requests");

    const tongMayChu = docSo(don?.tongTien);
    // Chỉ để gỡ lỗi khi phát triển: bản chạy thật không ghi console mỗi lần tải ngầm
    useEffect(() => {
        if (import.meta.env.DEV && don && tomTat.coMotPhan && Math.abs(tongMayChu - tomTat.tongTien) > 0.5) {
            console.warn("[Chi tiết báo giá] Tổng tiền của máy chủ khác tổng các dòng:", { tongTien: tongMayChu, tongCacDong: tomTat.tongTien });
        }
    }, [don, tongMayChu, tomTat]);

    if (!don && (q.loading || (!q.error && q.data === undefined))) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungDangTai nhan="Đang tải báo giá" />
            </PageContainer>
        );
    }

    if (!don) {
        // Máy chủ trả 400 "Không tìm thấy đơn mua hàng id: …" khi mã không tồn tại → "Không tìm thấy";
        // nhân viên bán hàng nhận 403 → khung "Bạn không có quyền xem báo giá" kèm nút về danh sách (không "Thử lại").
        // Báo giá không có danh sách riêng: về Yêu cầu báo giá
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={q.error}
                    tenChungTu="báo giá"
                    locCauMayChu={locCauMayChuMuaHang}
                    onVeDanhSach={() => navigate("/quotation-requests")}
                    nhanVeDanhSach="Về danh sách yêu cầu báo giá"
                    onThuLai={q.reload}
                />
            </PageContainer>
        );
    }

    const tt = Number(don.trangThai);
    const ma = don.soDonMua || `#${don.id}`;
    const daChot = laDaChot(tt);
    const tenNcc = don.nhaCungCap?.tenNhaCungCap || don.nhaCungCap?.maNhaCungCap || "nhà cung cấp";
    const yeuCau = don.yeuCauMuaHang;
    const tongChu = formatCurrency(tomTat.tongTien);
    const buoc = tinhBuocBaoGia(don, tomTat, { nhanDonMua: daChot ? getDonMuaHangStatus(tt).label : "" });
    const ghiChuNcc = ghiChuNhaCungCap(don);
    // Số báo giá khác cùng yêu cầu còn chờ: chấp nhận báo giá này thì chúng tự đóng và nhận email kết quả (K1)
    const soBaoGiaDangCho = docSo(yeuCau?.soBaoGiaDangCho);

    // ── Quyền và nút ────────────────────────────────────────────────────────
    const hienChot = coTheXetBaoGia(don) && hasAnyRole(VAI_TRO_CHOT_BAO_GIA);
    const lyDoKhoa = lyDoKhoaChapNhan(tomTat, don);
    const moHop = (loai) => {
        ngayBaoGiaDaXemRef.current = don.ngayBaoGia ?? null;
        setLyDo("");
        setLoiHop(null);
        setHop(loai);
    };
    // Đóng hộp: giữ câu lỗi tới hết hiệu ứng đóng (mở hộp và bấm lại đã xóa), tránh hộp co giật khi đang mờ dần
    const doiMoHop = (mo) => {
        if (mo) return;
        setHop("");
        setLyDo("");
    };
    const nutChinh = khoaKhiChoGoc(hienChot
        ? [
            { ma: "tuChoi", nhan: "Không chấp nhận", kieu: "vien", onClick: () => moHop("tuChoi") },
            { ma: "chapNhan", nhan: "Chấp nhận báo giá", icon: Check, onClick: () => moHop("chapNhan"), khoa: Boolean(lyDoKhoa), lyDo: lyDoKhoa },
        ]
        : daChot
            ? { ma: "donMua", nhan: "Mở đơn mua hàng", icon: FileText, kieu: "vien", dieuHuong: true, onClick: () => navigate(`/purchase-orders/${don.id}`) }
            : null, choGoc);

    // Khóa nút thao tác tới khi lời gọi gốc kết thúc (tối đa THOI_HAN_CHO_GOC_MS) rồi tải lại; màn gỡ thì hủy chờ
    const khoaToiKhiGocXong = (loi) => {
        huyChoGocRef.current?.();
        setChoGoc(true);
        huyChoGocRef.current = khiGocKetThuc(loi, () => {
            huyChoGocRef.current = null;
            setChoGoc(false);
            q.reload();
        });
    };

    const thucHien = async (trangThai) => {
        if (dangGoiRef.current) return;
        dangGoiRef.current = true;
        const khongChapNhan = trangThai === TRANG_THAI_BAO_GIA.TU_CHOI;
        const body = taoBodyXetBaoGia({ lyDo: khongChapNhan ? lyDo : null, ngayBaoGiaDaXem: ngayBaoGiaDaXemRef.current });
        setLoiHop(null);
        setDangChay(true);
        try {
            await chayCoThoiHan(() => purchaseOrderService.duyetDon(id, trangThai, body));
            if (khongChapNhan) toast.success(`Đã không chấp nhận báo giá ${ma}`, { description: `Email kết quả sẽ gửi tới ${tenNcc}.` });
            else toast.success(`Đã chấp nhận báo giá ${ma}`);
            setHop("");
            setLyDo("");
            // Ở lại trang: đổi trạng thái tại chỗ (nút chốt ẩn ngay) rồi tải lại ngầm lấy người chốt, đơn tự đóng (K1)
            q.setData((cu) => (cu ? { ...cu, trangThai, ...(khongChapNhan ? { lyDoTuChoi: body.lyDo } : {}) } : cu));
            q.reload();
        } catch (error) {
            if (laLoiHetThoiHan(error)) {
                if (daGoRef.current) return;
                // Máy chủ chưa trả lời sau thời hạn: đóng hộp, báo lỗi, tải lại ngầm; máy chủ có thể vẫn đang làm
                // nên khóa nút tới khi lời gọi gốc kết thúc rồi tải lại lần nữa
                setHop("");
                setLyDo("");
                toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
                q.reload();
                khoaToiKhiGocXong(error);
                return;
            }
            // Câu dự phòng không có dấu chấm: mất mạng thì getApiErrorMessage nối thêm ": không nhận được phản hồi…"
            const cau = getApiErrorMessage(error, "Không thực hiện được thao tác");
            if (cachXuLyLoiXetBaoGia(getApiErrorStatus(error)) === "dongVaTaiLai") {
                // 409, 404: báo giá đã đổi ở nơi khác (đã có kết quả, nhà cung cấp vừa gửi lại giá, yêu cầu không còn mở,
                // đang có thao tác khác, đơn không còn) -> hiện câu máy chủ rồi tải lại đơn (đặc tả 6.3)
                setHop("");
                setLyDo("");
                toast.error(cau);
                q.reload();
            } else {
                // 400, 403, mạng, 500: giữ hộp và lý do vừa gõ, hiện câu lỗi để sửa hoặc bấm lại
                setLoiHop(cau);
            }
        } finally {
            dangGoiRef.current = false;
            setDangChay(false);
        }
    };

    // ── K11 · Gửi lại email yêu cầu báo giá ────────────────────────────────
    const guiLai = trangThaiGuiLaiYeuCau(don, { duocGui: hasAnyRole(VAI_TRO_GUI_YEU_CAU_BAO_GIA), daGuiLai });
    const guiLaiYeuCau = async () => {
        if (dangGuiLaiRef.current) return;
        dangGuiLaiRef.current = true;
        setDangGuiLai(true);
        try {
            await purchaseOrderService.guiLaiYeuCau(don.id);
            if (daGoRef.current) return;
            setDaGuiLai(true);
            toast.success("Email yêu cầu báo giá đang được gửi.", { description: tenNcc });
            q.reload();
        } catch (error) {
            if (daGoRef.current) return;
            toast.error(getApiErrorMessage(error, "Chưa gửi lại được email yêu cầu báo giá"));
            if (getApiErrorStatus(error) === 409) q.reload();
        } finally {
            dangGuiLaiRef.current = false;
            setDangGuiLai(false);
        }
    };

    // ── Dòng thông báo (mỗi thông tin một lần) ─────────────────────────────
    const thongBao = [];
    if (guiLai) {
        thongBao.push(
            <DongThongBao
                key="gui-lai"
                tone="warn"
                actions={guiLai.coNut ? (
                    <NutChu onClick={guiLaiYeuCau} disabled={dangGuiLai} aria-busy={dangGuiLai || undefined}>
                        {dangGuiLai ? "Đang gửi lại…" : "Gửi lại email yêu cầu báo giá"}
                    </NutChu>
                ) : null}
            >
                Chưa gửi được email yêu cầu báo giá cho nhà cung cấp này.
            </DongThongBao>,
        );
    }
    if (hienChot && lyDoKhoa) thongBao.push(<DongThongBao key="khoa" tone="warn">{cauCanhBaoChapNhan(tomTat, don)}</DongThongBao>);
    if (ghiChuNcc) {
        thongBao.push(
            <DongThongBao key="ghi-chu">
                <b className="font-semibold">Ghi chú của nhà cung cấp:</b>{" "}
                <span className="whitespace-pre-line break-words">{ghiChuNcc}</span>
            </DongThongBao>,
        );
    }
    if (daChot) {
        thongBao.push(
            <DongThongBao key="ket-qua" tone="ok">
                Báo giá đã chấp nhận và trở thành đơn mua hàng cùng mã. Theo dõi nhận hàng ở đơn mua hàng.
            </DongThongBao>,
        );
    } else if (tt === TRANG_THAI_BAO_GIA.TU_CHOI && String(don.lyDoTuChoi ?? "").trim()) {
        thongBao.push(
            <DongThongBao key="ket-qua">
                <b className="font-semibold">Lý do không chấp nhận:</b>{" "}
                <span className="whitespace-pre-line break-words">{String(don.lyDoTuChoi).trim()}</span>
            </DongThongBao>,
        );
    } else if (tt === TRANG_THAI_BAO_GIA.DA_XOA) {
        thongBao.push(<DongThongBao key="ket-qua">Báo giá này đã bị xóa khỏi hệ thống.</DongThongBao>);
    }

    const lienQuan = ycId != null
        ? [
            { khoa: "yeu-cau-nhap", loai: "Yêu cầu nhập hàng", ma: yeuCau.soYeuCauMuaHang || `#${ycId}`, to: `/purchase-requests/${ycId}` },
            { khoa: "so-sanh", loai: "So sánh báo giá", ma: "Các nhà cung cấp cùng yêu cầu", to: `/quotation-requests/${ycId}` },
        ]
        : [];

    const tongPhu = tomTat.coGia
        ? <b key="tong" className="font-semibold text-bo-foreground">{tongChu}</b>
        : tomTat.coMotPhan
            ? <span key="tong"><b className="font-semibold text-bo-foreground">{tongChu}</b> (thiếu giá {soVN(tomTat.thieu)} dòng)</span>
            : "chưa có giá";

    const moTaChapNhan = [
        `Chốt giá ${tongChu}. Email Xác nhận đặt hàng sẽ gửi tới ${tenNcc}.`,
        soBaoGiaDangCho > 0 ? "Các nhà cung cấp còn lại nhận email kết quả." : "",
    ].filter(Boolean).join(" ");

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={ma}
                        trangThai={{ label: nhanTrangThaiBaoGia(don, getBaoGiaNccStatus(tt).label), quyTrinh: "yeuCauBaoGia" }}
                        dongPhu={[
                            "Báo giá",
                            tongPhu,
                            bang.rong ? null : <b key="sp" className="font-semibold text-bo-foreground">{`${soVN(bang.tong.soSanPham)} sản phẩm, ${soVN(bang.tong.soDong)} biến thể`}</b>,
                            bang.rong ? null : <span key="sl">tổng số lượng <b className="font-semibold text-bo-foreground">{soVN(bang.tong.soLuong)}</b></span>,
                        ]}
                        onQuayLai={quayLai}
                        nhanQuayLai="Về so sánh báo giá"
                        saoChepMa={{ giaTri: don.soDonMua, nhan: "Sao chép mã báo giá" }}
                        menu={
                            ycId != null
                                ? [{
                                    ma: "so-sanh",
                                    nhan: "Mở so sánh báo giá",
                                    moTa: "Giá của các nhà cung cấp cùng yêu cầu",
                                    icon: BarChart3,
                                    onSelect: () => navigate(`/quotation-requests/${ycId}`),
                                }]
                                : []
                        }
                        nutChinh={nutChinh}
                    />
                }
                tienTrinh={<TienTrinhChungTu buoc={buoc} nhan="Tiến trình báo giá" />}
                thongBao={thongBao.length ? thongBao : null}
                chinh={<BangBaoGia bang={bang} choGia={laConChoGia(tt)} />}
                cotPhai={<ThuocTinhBaoGia don={don} lienQuan={lienQuan} />}
            />

            <HopXacNhanChungTu
                mo={hop === "chapNhan"}
                onDoiMo={doiMoHop}
                tieuDe="Chấp nhận báo giá"
                moTa={moTaChapNhan}
                nhanXacNhan="Chấp nhận báo giá"
                iconXacNhan={Check}
                dangChay={dangChay}
                loi={loiHop}
                onXacNhan={() => thucHien(TRANG_THAI_BAO_GIA.DA_CHOT)}
            >
                <p className={GHI_CHU_HOP}>
                    Báo giá trở thành đơn mua hàng, yêu cầu {yeuCau?.soYeuCauMuaHang || "gốc"} chuyển sang {YEU_CAU_NHAP_HANG_STATUS[5].label}.
                </p>
            </HopXacNhanChungTu>
            <HopXacNhanChungTu
                mo={hop === "tuChoi"}
                onDoiMo={doiMoHop}
                tieuDe="Không chấp nhận báo giá"
                moTa={`Hệ thống gửi email kết quả cho ${tenNcc}. Không hoàn tác được.`}
                nhanXacNhan="Không chấp nhận"
                kieu="nguyHiem"
                dangChay={dangChay}
                loi={loiHop}
                onXacNhan={() => thucHien(TRANG_THAI_BAO_GIA.TU_CHOI)}
            >
                <div className="grid gap-1.5">
                    <label htmlFor={ID_LY_DO} className={NHAN_O}>
                        Lý do
                    </label>
                    <textarea
                        id={ID_LY_DO}
                        value={lyDo}
                        onChange={(suKien) => setLyDo(suKien.target.value.slice(0, LY_DO_KHONG_CHAP_NHAN_TOI_DA))}
                        placeholder="Ví dụ: Đơn giá cao hơn báo giá khác"
                        rows={3}
                        maxLength={LY_DO_KHONG_CHAP_NHAN_TOI_DA}
                        aria-describedby={`${ID_LY_DO}-goi-y`}
                        disabled={dangChay}
                        className={O_NHAP_NHIEU_DONG}
                    />
                    <p id={`${ID_LY_DO}-goi-y`} className={GOI_Y_O}>
                        <span>Không bắt buộc. Nhà cung cấp thấy lý do này trong email.</span>
                        <span>{lyDo.length}/{LY_DO_KHONG_CHAP_NHAN_TOI_DA}</span>
                    </p>
                </div>
            </HopXacNhanChungTu>
        </PageContainer>
    );
}
