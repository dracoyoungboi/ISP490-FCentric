import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Printer } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { nhanTrangThaiBaoGia } from "@/components/order/chi-tiet-bao-gia/tinhBaoGia";
import BangSoSanhGia from "@/components/order/chi-tiet-yeu-cau/BangSoSanhGia";
import ThuocTinhYeuCau from "@/components/order/chi-tiet-yeu-cau/ThuocTinhYeuCau";
import { demGuiGia, dungSoSanhGia, soSanhTong } from "@/components/order/chi-tiet-yeu-cau/soSanhGia";
import {
    TRANG_THAI_YEU_CAU,
    VAI_TRO_XEM_DON_MUA,
    baoGiaDaChot,
    chuDemBaoGia,
    locCauMayChuMuaHang,
    tomTatBaoGia,
} from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import { getBaoGiaNccStatus, getDonMuaHangStatus } from "@/constants/donMuaHang";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import purchaseRequestService from "@/services/purchaseRequestService";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Ai chấp nhận / không chấp nhận báo giá ở Chi tiết báo giá (giữ như màn đó): quản trị viên, nhân viên mua hàng
const VAI_TRO_CHOT_BAO_GIA = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];

/**
 * Chi tiết yêu cầu báo giá · màn "So sánh báo giá" (21/10/2026, artboard YeuCauBaoGia.dc.html). Cùng bản ghi và cùng API
 * với Chi tiết yêu cầu nhập hàng (GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}); phần duyệt, người tạo, tiến trình nằm ở màn đó.
 * Màn này chỉ để so giá: nhà cung cấp × biến thể từ `donMuaHangs[].chiTietDonMuaHangs[].donGia`, giá thấp nhất tô xanh,
 * tổng tiền cả yêu cầu. Chấp nhận / không chấp nhận làm ở Chi tiết báo giá (bấm tên nhà cung cấp).
 * Dòng phụ đầu khối đếm đã gửi / đã báo giá / đã chốt / không chấp nhận; cột phải có nhóm "Báo giá" (giá trị đã chốt, lúc gửi yêu cầu);
 * đầu cột mỗi nhà cung cấp có ngày gửi và người chốt. Không có cột "Hạn chót" theo nhà cung cấp: backend chép ngày giao
 * dự kiến của yêu cầu sang mọi báo giá nên trùng "Giao dự kiến" ở cột phải.
 * Bỏ cột thanh toán (thanh toán nhà cung cấp đã bỏ khỏi luồng 16/10) và lời gọi lấy vai trò không dùng.
 */
export default function QuotationRequestDetail() {
    const { id } = useParams();
    // Đổi sang yêu cầu khác thì dựng lại màn: từ khóa, trang, cách xem của yêu cầu cũ không mang sang
    return <SoSanhBaoGia key={id} id={id} />;
}

function SoSanhBaoGia({ id }) {
    const navigate = useNavigate();

    const taiYeuCau = useCallback(async () => {
        const res = await purchaseRequestService.getById(id);
        return res?.data?.data ?? null;
    }, [id]);
    const q = useTaiDuLieu(taiYeuCau, `yeu-cau-bao-gia-${id}`, { enabled: Boolean(id) });
    const yc = q.data && String(q.data.id) === String(id) ? q.data : null;

    // Quay lại tab thì tải lại ngầm (nhà cung cấp có thể vừa gửi giá qua cổng báo giá)
    useTaiLaiKhiQuayLai(() => q.reload(), { bat: Boolean(id) && !q.loading, lanCuoi: q.capNhatLuc });

    const [xem, setXem] = useState("donGia");
    const soSanh = useMemo(() => dungSoSanhGia(yc), [yc]);
    const bang = useBangChungTu(soSanh.dong);
    const tongCaYeuCau = useMemo(() => soSanhTong(soSanh.dong, soSanh.ncc.length), [soSanh]);
    const quayLai = useQuayLai("/quotation-requests");

    if (!yc && (q.loading || (!q.error && q.data === undefined))) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungDangTai nhan="Đang tải yêu cầu báo giá" coTienTrinh={false} />
            </PageContainer>
        );
    }

    if (!yc) {
        // Máy chủ trả 400 "Không tìm thấy yêu cầu mua hàng id: …" khi mã không tồn tại → "Không tìm thấy"
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={q.error}
                    tenChungTu="yêu cầu báo giá"
                    locCauMayChu={locCauMayChuMuaHang}
                    onVeDanhSach={() => navigate("/quotation-requests")}
                    onThuLai={q.reload}
                />
            </PageContainer>
        );
    }

    const tt = Number(yc.trangThai);
    const ma = yc.soYeuCauMuaHang || `#${yc.id}`;
    const ncc = soSanh.ncc.map((n) => ({
        ...n,
        nhan: nhanTrangThaiBaoGia(n.don, getBaoGiaNccStatus(n.trangThai).label),
    }));
    const soNcc = ncc.length;
    const dem = demGuiGia(soSanh.dong, soNcc);
    const tomTatGui = soNcc
        ? [
            `${soVN(dem.daGui)} nhà cung cấp đã gửi giá`,
            dem.thieuDong ? `${soVN(dem.thieuDong)} nhà cung cấp còn thiếu giá` : "",
        ].filter(Boolean).join(" · ")
        : "";
    // Đã gửi / đã báo giá / đã chốt / không chấp nhận (dòng phụ đầu khối), giá trị đã chốt và lúc gửi yêu cầu (nhóm "Báo giá" cột phải)
    const tongQuan = tomTatBaoGia(yc);
    const duocChot = hasAnyRole(VAI_TRO_CHOT_BAO_GIA);
    // Còn báo giá chờ (chưa chốt, chưa không chấp nhận) mới mời "chấp nhận"; hết rồi thì chỉ mời xem chi tiết
    const moiChapNhan = duocChot && tongQuan.conCho > 0;
    // Nhân viên bán hàng xem được yêu cầu nhưng máy chủ chặn (403) báo giá, đơn mua: hiện chữ thường, không link
    const xemDonMua = hasAnyRole(VAI_TRO_XEM_DON_MUA);

    const lienQuan = [
        { khoa: "yeu-cau-nhap", loai: "Yêu cầu nhập hàng", ma: "Xem phần duyệt yêu cầu", to: `/purchase-requests/${yc.id}` },
        ...baoGiaDaChot(yc).map((don) => ({
            khoa: `don-mua-${don.id}`,
            loai: "Đơn mua hàng",
            ma: don.soDonMua,
            to: xemDonMua ? `/purchase-orders/${don.id}` : undefined,
            trangThai: getDonMuaHangStatus(don.trangThai).label,
            quyTrinh: "donMua",
        })),
    ];

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={ma}
                        trangThai={{ label: getYeuCauNhapHangStatus(yc.trangThai).label, quyTrinh: "yeuCauNhap" }}
                        dongPhu={[
                            "Yêu cầu báo giá",
                            bang.rong
                                ? "chưa có sản phẩm"
                                : <b key="sp" className="font-semibold text-bo-foreground">{`${soVN(bang.tong.soSanPham)} sản phẩm, ${soVN(bang.tong.soDong)} biến thể`}</b>,
                            bang.rong ? null : <span key="sl">tổng số lượng <b className="font-semibold text-bo-foreground">{soVN(bang.tong.soLuong)}</b></span>,
                            ...chuDemBaoGia(tongQuan),
                        ]}
                        onQuayLai={quayLai}
                        nhanQuayLai="Về danh sách yêu cầu báo giá"
                        nutPhu={{ nhan: "In yêu cầu báo giá", icon: Printer, onClick: () => navigate(`/quotation-requests/${id}/print`) }}
                        saoChepMa={{ giaTri: yc.soYeuCauMuaHang, nhan: "Sao chép mã yêu cầu" }}
                        menu={[{
                            ma: "yeu-cau-nhap",
                            nhan: "Mở yêu cầu nhập hàng",
                            moTa: "Người tạo, duyệt và tiến trình",
                            icon: FileText,
                            onSelect: () => navigate(`/purchase-requests/${yc.id}`),
                        }]}
                    />
                }
                thongBao={
                    soNcc ? null : (
                        <DongThongBao>Yêu cầu chưa gửi cho nhà cung cấp nào nên chưa có giá để so sánh.</DongThongBao>
                    )
                }
                chinh={
                    <BangSoSanhGia
                        bang={bang}
                        ncc={ncc}
                        tongCaYeuCau={tongCaYeuCau}
                        xem={xem}
                        onDoiXem={setXem}
                        tomTatGui={tomTatGui}
                        xemBaoGia={xemDonMua}
                        chuThich={
                            soNcc
                                ? moiChapNhan
                                    ? "Giá do nhà cung cấp nhập qua cổng báo giá. Bấm tên nhà cung cấp để xem chi tiết và chấp nhận báo giá."
                                    : xemDonMua
                                        ? "Giá do nhà cung cấp nhập qua cổng báo giá. Bấm tên nhà cung cấp để xem chi tiết báo giá."
                                        : "Giá do nhà cung cấp nhập qua cổng báo giá."
                                : ""
                        }
                    />
                }
                cotPhai={
                    <ThuocTinhYeuCau
                        yc={yc}
                        nhan="Thông tin yêu cầu báo giá"
                        conHieuLuc={tt === TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA}
                        baoGia={tongQuan}
                        lienQuan={lienQuan}
                    />
                }
            />
        </PageContainer>
    );
}
