import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, Check, FileText } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import BangBaoGia from "@/components/order/chi-tiet-bao-gia/BangBaoGia";
import ThuocTinhBaoGia from "@/components/order/chi-tiet-bao-gia/ThuocTinhBaoGia";
import {
    LY_DO_TU_CHOI_MAC_DINH,
    TRANG_THAI_BAO_GIA,
    cauCanhBaoChapNhan,
    congGia,
    dongBaoGia,
    laDaChot,
    lyDoKhoaChapNhan,
    nhanTrangThaiBaoGia,
    tinhBuocBaoGia,
} from "@/components/order/chi-tiet-bao-gia/tinhBaoGia";
import { locCauMayChuMuaHang } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import { getBaoGiaNccStatus, getDonMuaHangStatus } from "@/constants/donMuaHang";
import { YEU_CAU_NHAP_HANG_STATUS } from "@/constants/yeuCauNhapHang";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import purchaseOrderService from "@/services/purchaseOrderService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Chỉ quản trị viên và nhân viên mua hàng chốt báo giá (giữ như màn cũ; backend còn cho quản lý kho)
const VAI_TRO_CHOT_BAO_GIA = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];

/**
 * Chi tiết báo giá · bản "một khối" (21/10/2026, artboard BaoGia.dc.html): đầu khối (mã, trạng thái, tổng tiền),
 * tiến trình 4 bước, bảng giá gom theo sản phẩm, cột phải (nhà cung cấp, kho nhận, chứng từ liên quan).
 * - Backend tạo báo giá ở trạng thái 2 với giá 0: chưa dòng nào có giá thì hiện "Chờ báo giá"; "Chấp nhận báo giá"
 *   khóa tới khi mọi dòng có giá ("Còn n dòng chưa có giá").
 * - Không chấp nhận: không có ô lý do vì máy chủ luôn gửi email với lý do mặc định. Nút đầu khối, nút trong hộp và
 *   thông báo cùng một chữ "Không chấp nhận" (cùng việc cùng chữ, rà soát N10).
 * - Bỏ "Thanh toán ngay" (thanh toán nhà cung cấp đã bỏ khỏi luồng 16/10) và nút in trang bằng trình duyệt;
 *   báo giá đã chấp nhận mở Chi tiết đơn mua hàng (cùng mã, có bản in).
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
    const [dangChay, setDangChay] = useState(false);

    // Quay lại tab thì tải lại ngầm (nhà cung cấp có thể vừa gửi giá); không tải khi đang thao tác
    useTaiLaiKhiQuayLai(() => q.reload(), { bat: Boolean(id) && !q.loading && !dangChay, lanCuoi: q.capNhatLuc });

    const tomTat = useMemo(() => congGia(don?.chiTietDonMuaHangs), [don]);
    const dong = useMemo(() => dongBaoGia(don?.chiTietDonMuaHangs), [don]);
    const bang = useBangChungTu(dong);
    const ycId = don?.yeuCauMuaHang?.id ?? null;
    const quayLai = useQuayLai(ycId != null ? `/quotation-requests/${ycId}` : "/quotation-requests");

    const tongMayChu = docSo(don?.tongTien);
    useEffect(() => {
        if (don && tomTat.coMotPhan && Math.abs(tongMayChu - tomTat.tongTien) > 0.5) {
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
        // nhân viên bán hàng nhận 403 → "Không tải được" kèm câu máy chủ. Báo giá không có danh sách riêng: về Yêu cầu báo giá
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={q.error}
                    tenChungTu="báo giá"
                    locCauMayChu={locCauMayChuMuaHang}
                    onVeDanhSach={() => navigate("/quotation-requests")}
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

    // ── Quyền và nút ────────────────────────────────────────────────────────
    const hienChot = tt === TRANG_THAI_BAO_GIA.CHO_CHOT && hasAnyRole(VAI_TRO_CHOT_BAO_GIA);
    const lyDoKhoa = lyDoKhoaChapNhan(tomTat);
    const nutChinh = hienChot
        ? [
            { ma: "tuChoi", nhan: "Không chấp nhận", kieu: "vien", onClick: () => setHop("tuChoi") },
            { ma: "chapNhan", nhan: "Chấp nhận báo giá", icon: Check, onClick: () => setHop("chapNhan"), khoa: Boolean(lyDoKhoa), lyDo: lyDoKhoa },
        ]
        : daChot
            ? { ma: "donMua", nhan: "Mở đơn mua hàng", icon: FileText, kieu: "vien", onClick: () => navigate(`/purchase-orders/${don.id}`) }
            : null;

    const thucHien = async (trangThai) => {
        setDangChay(true);
        try {
            await purchaseOrderService.duyetDon(id, trangThai);
            if (trangThai === TRANG_THAI_BAO_GIA.DA_CHOT) toast.success(`Đã chấp nhận báo giá ${ma}`);
            else toast.success("Đã gửi email báo không chấp nhận cho nhà cung cấp", { description: tenNcc });
            setHop("");
            // Ở lại trang: đổi trạng thái tại chỗ (nút chốt ẩn ngay) rồi tải lại ngầm
            q.setData((cu) => (cu ? { ...cu, trangThai } : cu));
            q.reload();
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thể thực hiện thao tác. Vui lòng thử lại."));
        } finally {
            setDangChay(false);
        }
    };

    // ── Dòng thông báo ──────────────────────────────────────────────────────
    let thongBao = null;
    if (hienChot && lyDoKhoa) thongBao = <DongThongBao tone="warn">{cauCanhBaoChapNhan(tomTat)}</DongThongBao>;
    else if (daChot) {
        thongBao = (
            <DongThongBao tone="ok">
                Báo giá đã chấp nhận và trở thành đơn mua hàng cùng mã. Theo dõi nhận hàng ở đơn mua hàng.
            </DongThongBao>
        );
    } else if (tt === TRANG_THAI_BAO_GIA.TU_CHOI) {
        thongBao = (
            <DongThongBao>
                Đã gửi email báo nhà cung cấp không chấp nhận báo giá (lý do mặc định: {LY_DO_TU_CHOI_MAC_DINH}).
            </DongThongBao>
        );
    } else if (tt === TRANG_THAI_BAO_GIA.DA_XOA) {
        thongBao = <DongThongBao>Báo giá này đã bị xóa khỏi hệ thống.</DongThongBao>;
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
                thongBao={thongBao}
                chinh={<BangBaoGia bang={bang} />}
                cotPhai={<ThuocTinhBaoGia don={don} lienQuan={lienQuan} />}
            />

            <HopXacNhanChungTu
                mo={hop === "chapNhan"}
                onDoiMo={(mo) => !mo && setHop("")}
                tieuDe="Chấp nhận báo giá"
                moTa={`Chốt giá ${tongChu} với ${tenNcc}. Báo giá trở thành đơn mua hàng và yêu cầu ${yeuCau?.soYeuCauMuaHang || "gốc"} chuyển sang ${YEU_CAU_NHAP_HANG_STATUS[5].label}.`}
                nhanXacNhan="Chấp nhận báo giá"
                iconXacNhan={Check}
                dangChay={dangChay}
                onXacNhan={() => thucHien(TRANG_THAI_BAO_GIA.DA_CHOT)}
            >
                <p className={GHI_CHU_HOP}>Các báo giá khác của yêu cầu này không tự đóng.</p>
            </HopXacNhanChungTu>
            <HopXacNhanChungTu
                mo={hop === "tuChoi"}
                onDoiMo={(mo) => !mo && setHop("")}
                tieuDe="Không chấp nhận báo giá"
                moTa={`Hệ thống gửi email báo nhà cung cấp với lý do mặc định: ${LY_DO_TU_CHOI_MAC_DINH}. Không hoàn tác được.`}
                nhanXacNhan="Không chấp nhận"
                kieu="nguyHiem"
                dangChay={dangChay}
                onXacNhan={() => thucHien(TRANG_THAI_BAO_GIA.TU_CHOI)}
            />
        </PageContainer>
    );
}
