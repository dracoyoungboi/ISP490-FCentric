import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, FileText, Printer, Send } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { cauChungTuRong, soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import BangYeuCau from "@/components/order/chi-tiet-yeu-cau/BangYeuCau";
import ThuocTinhYeuCau from "@/components/order/chi-tiet-yeu-cau/ThuocTinhYeuCau";
import {
    LY_DO_TU_CHOI_TOI_DA,
    TRANG_THAI_YEU_CAU,
    VAI_TRO_XEM_DON_MUA,
    baoGiaDaChot,
    baoGiaHieuLuc,
    dongYeuCau,
    locCauMayChuMuaHang,
    quyenDuyetYeuCau,
    tinhBuocYeuCau,
} from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import { getDonMuaHangStatus } from "@/constants/donMuaHang";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import purchaseRequestService from "@/services/purchaseRequestService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { khoTrongToken } from "@/utils/khoLamViec";
import { ROLES, getCurrentUserId, hasAnyRole } from "@/utils/roles";

// Gửi yêu cầu báo giá: quản trị viên và nhân viên mua hàng (giữ như màn cũ; backend còn cho quản lý kho, nhân viên kho)
const VAI_TRO_GUI_BAO_GIA = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
const TEN_CHUNG_TU = "yêu cầu nhập hàng";
const LY_DO_RONG = cauChungTuRong(TEN_CHUNG_TU, { dauCham: false });
// Máy chủ từ chối vì yêu cầu đã đổi ở nơi khác (vd. 400 "Chỉ duyệt hoặc từ chối được yêu cầu đang ở trạng thái Chờ
// duyệt" khi người khác vừa duyệt) hoặc không còn quyền: đóng hộp, báo lỗi, tải lại; lỗi khác giữ hộp để bấm lại
const LOI_DA_DOI_NOI_KHAC = [400, 403, 409];

/**
 * Chi tiết yêu cầu nhập hàng · bản "một khối" (21/10/2026, artboard Main.dc.html): đầu khối (mã, trạng thái, tổng),
 * tiến trình 5 bước, lý do từ chối, bảng sản phẩm gom theo sản phẩm (nhiều dòng: tìm, phân trang, lưới màu × kích cỡ)
 * và cột thông tin bên phải (kho nhận, người, ghi chú, chứng từ liên quan).
 * Phê duyệt / Từ chối chỉ quản trị viên và quản lý ĐÚNG kho nhận (khớp backend); quản lý kho khác thấy câu giải thích.
 */
export default function PurchaseRequestDetail() {
    const { id } = useParams();
    // Đổi sang yêu cầu khác thì dựng lại màn: từ khóa, trang, hộp thoại của yêu cầu cũ không mang sang
    return <ChiTietYeuCauNhapHang key={id} id={id} />;
}

function ChiTietYeuCauNhapHang({ id }) {
    const navigate = useNavigate();

    // ── Yêu cầu ──────────────────────────────────────────────────────────────
    const taiYeuCau = useCallback(async () => {
        const res = await purchaseRequestService.getById(id);
        return res?.data?.data ?? null;
    }, [id]);
    const q = useTaiDuLieu(taiYeuCau, `yeu-cau-nhap-${id}`, { enabled: Boolean(id) });
    const yc = q.data && String(q.data.id) === String(id) ? q.data : null;

    const [hop, setHop] = useState(""); // "" | "duyet" | "tuChoi"
    const [lyDo, setLyDo] = useState("");
    const [dangChay, setDangChay] = useState(false);
    const [loiHop, setLoiHop] = useState(null); // câu lỗi hiện trong hộp (lỗi mạng, lỗi máy chủ)

    // Quay lại tab thì tải lại ngầm (yêu cầu có thể vừa được duyệt / gửi báo giá); không tải khi đang thao tác
    useTaiLaiKhiQuayLai(() => q.reload(), { bat: Boolean(id) && !q.loading && !dangChay, lanCuoi: q.capNhatLuc });

    // ── Tính toán ───────────────────────────────────────────────────────────
    const dong = useMemo(() => dongYeuCau(yc), [yc]);
    const bang = useBangChungTu(dong);
    const buoc = useMemo(() => tinhBuocYeuCau(yc), [yc]);
    const quayLai = useQuayLai("/purchase-requests");

    // ── Đang tải / lỗi / không tìm thấy ────────────────────────────────────
    if (!yc && (q.loading || (!q.error && q.data === undefined))) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungDangTai nhan="Đang tải yêu cầu nhập hàng" />
            </PageContainer>
        );
    }

    if (!yc) {
        // Máy chủ trả 400 "Không tìm thấy yêu cầu mua hàng id: …" khi mã không tồn tại → "Không tìm thấy"
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={q.error}
                    tenChungTu={TEN_CHUNG_TU}
                    locCauMayChu={locCauMayChuMuaHang}
                    onVeDanhSach={() => navigate("/purchase-requests")}
                    onThuLai={q.reload}
                />
            </PageContainer>
        );
    }

    const tt = Number(yc.trangThai);
    const ma = yc.soYeuCauMuaHang || `#${yc.id}`;
    const kho = yc.khoNhap;
    const tenKho = kho?.tenKho || "kho nhận";

    // ── Quyền ───────────────────────────────────────────────────────────────
    const quyen = quyenDuyetYeuCau({
        laQuanTriVien: hasAnyRole([ROLES.QUAN_TRI_VIEN]),
        laQuanLyKho: hasAnyRole([ROLES.QUAN_LY_KHO]),
        nguoiDungId: getCurrentUserId(),
        khoNhap: kho,
        // Mọi kho được phân quyền còn hiệu lực trong token (kể cả kho ngừng hoạt động): đúng danh sách backend dùng
        // (authInfo.phanQuyenNguoiDungKhos trong coQuyenDuyetKho)
        khoPhuTrachIds: khoTrongToken().map((k) => k.id),
    });
    const choDuyet = tt === TRANG_THAI_YEU_CAU.CHO_DUYET;
    const hienDuyet = choDuyet && quyen.duocDuyet;
    const hienGui = tt === TRANG_THAI_YEU_CAU.DA_DUYET && hasAnyRole(VAI_TRO_GUI_BAO_GIA);

    // ── Chứng từ liên quan ──────────────────────────────────────────────────
    const baoGia = baoGiaHieuLuc(yc);
    const coYeuCauBaoGia = baoGia.length > 0
        || tt === TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA
        || tt === TRANG_THAI_YEU_CAU.DA_CHUYEN_DON_MUA;
    // Nhân viên bán hàng xem được yêu cầu nhưng máy chủ chặn (403) đơn mua: hiện chữ thường, không link
    const xemDonMua = hasAnyRole(VAI_TRO_XEM_DON_MUA);
    const lienQuan = [
        coYeuCauBaoGia
            ? {
                khoa: "yeu-cau-bao-gia",
                loai: "Yêu cầu báo giá",
                ma: baoGia.length ? `Gửi ${soVN(baoGia.length)} nhà cung cấp` : ma,
                to: `/quotation-requests/${yc.id}`,
            }
            : null,
        ...baoGiaDaChot(yc).map((don) => ({
            khoa: `don-mua-${don.id}`,
            loai: "Đơn mua hàng",
            ma: don.soDonMua,
            to: xemDonMua ? `/purchase-orders/${don.id}` : undefined,
            trangThai: getDonMuaHangStatus(don.trangThai).label,
            quyTrinh: "donMua",
        })),
    ];

    // ── Thao tác ────────────────────────────────────────────────────────────
    const moHop = (loai) => {
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

    const thucHien = async (trangThai) => {
        const lyDoGui = lyDo.trim();
        if (trangThai === TRANG_THAI_YEU_CAU.TU_CHOI && !lyDoGui) {
            toast.error("Vui lòng nhập lý do từ chối");
            return;
        }
        setLoiHop(null);
        setDangChay(true);
        try {
            await purchaseRequestService.approve(id, trangThai, lyDoGui);
            toast.success(trangThai === TRANG_THAI_YEU_CAU.DA_DUYET ? `Đã phê duyệt yêu cầu ${ma}.` : `Đã từ chối yêu cầu ${ma}.`);
            setHop("");
            setLyDo("");
            // Ở lại trang: đổi trạng thái tại chỗ (nút duyệt ẩn ngay) rồi tải lại ngầm lấy người duyệt, ngày duyệt
            q.setData((cu) => (cu ? { ...cu, trangThai, ...(trangThai === TRANG_THAI_YEU_CAU.TU_CHOI ? { lyDoTuChoi: lyDoGui } : {}) } : cu));
            q.reload();
        } catch (error) {
            // Câu dự phòng không có dấu chấm: mất mạng thì getApiErrorMessage nối thêm ": không nhận được phản hồi…"
            const cau = getApiErrorMessage(error, "Không thực hiện được thao tác");
            if (LOI_DA_DOI_NOI_KHAC.includes(getApiErrorStatus(error))) {
                setHop("");
                setLyDo("");
                toast.error(cau);
                q.reload();
            } else {
                setLoiHop(cau);
            }
        } finally {
            setDangChay(false);
        }
    };

    const demSp = `${soVN(bang.tong.soSanPham)} sản phẩm, ${soVN(bang.tong.soDong)} biến thể`;
    const tongSl = soVN(bang.tong.soLuong);
    const nutChinh = hienDuyet
        ? [
            { ma: "tuChoi", nhan: "Từ chối", kieu: "vien", onClick: () => moHop("tuChoi") },
            { ma: "duyet", nhan: "Phê duyệt", icon: Check, onClick: () => moHop("duyet"), khoa: bang.rong, lyDo: LY_DO_RONG },
        ]
        : hienGui
            ? {
                ma: "gui",
                nhan: "Gửi yêu cầu báo giá",
                icon: Send,
                onClick: () => navigate(`/purchase-requests/${id}/send-quotation`),
                khoa: bang.rong,
                lyDo: LY_DO_RONG,
            }
            : null;

    const thongBao = [
        tt === TRANG_THAI_YEU_CAU.TU_CHOI && yc.lyDoTuChoi ? (
            <DongThongBao key="ly-do" tone="bad">
                <b className="font-semibold">Lý do từ chối:</b>{" "}
                <span className="whitespace-pre-wrap">{yc.lyDoTuChoi}</span>
            </DongThongBao>
        ) : null,
        choDuyet && quyen.khacKho ? (
            <DongThongBao key="khac-kho">
                Yêu cầu nhập vào <b className="font-semibold">{tenKho}</b>. Chỉ quản lý {tenKho} hoặc quản trị viên duyệt được.
            </DongThongBao>
        ) : null,
    ].filter(Boolean);

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={ma}
                        trangThai={{ label: getYeuCauNhapHangStatus(yc.trangThai).label, quyTrinh: "yeuCauNhap" }}
                        dongPhu={[
                            "Yêu cầu nhập hàng",
                            bang.rong ? "chưa có sản phẩm" : <b key="sp" className="font-semibold text-bo-foreground">{demSp}</b>,
                            bang.rong ? null : <span key="sl">tổng số lượng <b className="font-semibold text-bo-foreground">{tongSl}</b></span>,
                        ]}
                        onQuayLai={quayLai}
                        nhanQuayLai="Về danh sách yêu cầu nhập hàng"
                        nutPhu={{ nhan: "In yêu cầu", icon: Printer, onClick: () => navigate(`/purchase-requests/${id}/print`) }}
                        saoChepMa={{ giaTri: yc.soYeuCauMuaHang, nhan: "Sao chép mã yêu cầu" }}
                        menu={
                            coYeuCauBaoGia
                                ? [{
                                    ma: "yeu-cau-bao-gia",
                                    nhan: "Mở yêu cầu báo giá",
                                    moTa: "So sánh giá các nhà cung cấp",
                                    icon: FileText,
                                    onSelect: () => navigate(`/quotation-requests/${yc.id}`),
                                }]
                                : []
                        }
                        nutChinh={nutChinh}
                    />
                }
                tienTrinh={<TienTrinhChungTu buoc={buoc} nhan="Tiến trình yêu cầu nhập hàng" />}
                thongBao={thongBao.length ? thongBao : null}
                chinh={<BangYeuCau bang={bang} />}
                cotPhai={
                    <ThuocTinhYeuCau
                        yc={yc}
                        nhan="Thông tin yêu cầu nhập hàng"
                        conHieuLuc={[TRANG_THAI_YEU_CAU.NHAP, TRANG_THAI_YEU_CAU.CHO_DUYET, TRANG_THAI_YEU_CAU.DA_DUYET, TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA].includes(tt)}
                        coNguoiDuyet
                        lienQuan={lienQuan}
                    />
                }
            />

            <HopXacNhanChungTu
                mo={hop === "duyet"}
                onDoiMo={doiMoHop}
                tieuDe="Phê duyệt yêu cầu nhập hàng"
                moTa={`${ma} · ${demSp}, tổng số lượng ${tongSl} nhập về ${tenKho}. Sau khi duyệt, nhân viên mua hàng gửi được yêu cầu báo giá cho nhà cung cấp.`}
                nhanXacNhan="Phê duyệt"
                iconXacNhan={Check}
                dangChay={dangChay}
                loi={loiHop}
                onXacNhan={() => thucHien(TRANG_THAI_YEU_CAU.DA_DUYET)}
            />
            <HopXacNhanChungTu
                mo={hop === "tuChoi"}
                onDoiMo={doiMoHop}
                tieuDe="Từ chối yêu cầu nhập hàng"
                moTa="Người tạo yêu cầu sẽ thấy lý do này. Từ chối rồi thì không duyệt lại được."
                nhanXacNhan="Từ chối"
                kieu="nguyHiem"
                dangChay={dangChay}
                khoaXacNhan={!lyDo.trim()}
                lyDoKhoa="Nhập lý do từ chối"
                loi={loiHop}
                onXacNhan={() => thucHien(TRANG_THAI_YEU_CAU.TU_CHOI)}
            >
                <div className="grid gap-1.5">
                    <label htmlFor="ly-do-tu-choi" className={NHAN_O}>
                        Lý do từ chối <span className="text-bo-danger">*</span>
                    </label>
                    <textarea
                        id="ly-do-tu-choi"
                        value={lyDo}
                        onChange={(suKien) => setLyDo(suKien.target.value.slice(0, LY_DO_TU_CHOI_TOI_DA))}
                        placeholder="Ví dụ: Tồn kho hiện tại còn đủ cho 2 tuần tới"
                        rows={3}
                        maxLength={LY_DO_TU_CHOI_TOI_DA}
                        aria-describedby="ly-do-tu-choi-goi-y"
                        aria-required="true"
                        disabled={dangChay}
                        className={O_NHAP_NHIEU_DONG}
                    />
                    <p id="ly-do-tu-choi-goi-y" className={GOI_Y_O}>
                        <span>Bắt buộc</span>
                        <span>{lyDo.length}/{LY_DO_TU_CHOI_TOI_DA}</span>
                    </p>
                </div>
            </HopXacNhanChungTu>
        </PageContainer>
    );
}
