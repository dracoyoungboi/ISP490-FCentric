import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import purchaseRequestService from "@/services/purchaseRequestService";
import { getMineKhoList } from "@/services/khoService";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { formatDate } from "@/utils/formatters";
import { getApiErrorMessage } from "@/utils/apiError";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import {
    AN_DIEN_THOAI, BANG, CHI_DIEN_THOAI, DONG, DONG_SANG, DONG_TIEU_DE, KHUNG_CUON, O, O_CUOI, O_DAU, O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { TRANG_THAI_YEU_CAU, VAI_TRO_XEM_DON_MUA } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import { chanGuiBaoGia, maYeuCau, tongSoLuongDat } from "@/components/order/gui-bao-gia/tinhGuiBaoGia";
import { t } from "@/i18n";

/**
 * Vai trò gửi được yêu cầu báo giá: trùng @RequireAuth của POST /nghiep-vu/don-mua-hang/gui-yeu-cau-bao-gia
 * (IRoleType.GUI_YEU_CAU_BAO_GIA) — cùng bộ vai trò xem đơn mua. Nhân viên bán hàng xem được yêu cầu nhưng không gửi được.
 */
const VAI_TRO_GUI = VAI_TRO_XEM_DON_MUA;
const duongGui = (id) => `/purchase-requests/${id}/send-quotation`;

/**
 * Tạo yêu cầu báo giá (/quotation-requests/create) — bước 1: chọn yêu cầu nhập hàng đã duyệt. Bước 2 (chọn nhà cung
 * cấp, kiểm email, kiểm thông tin cửa hàng, chỉ gửi một lần, xử lý lỗi gửi) dùng ĐÚNG màn Gửi yêu cầu báo giá
 * (/purchase-requests/:id/send-quotation) để hai lối vào không lệch quy tắc.
 *
 * Màn cũ ở đây tự dựng lại việc gửi nhưng sai nghiệp vụ: ô "Tiền tố mã báo giá" không được gửi lên máy chủ (mã do máy
 * chủ cấp), ghi chú gửi kèm bị máy chủ bỏ qua, chọn được nhà cung cấp chưa có email, không chặn khi thông tin cửa hàng
 * còn thiếu. Liên kết cũ "?prId=" chuyển thẳng sang bước 2.
 */
export default function QuotationRequestCreate() {
    const [searchParams] = useSearchParams();
    const prId = searchParams.get("prId");
    if (prId) return <Navigate to={duongGui(prId)} replace />;
    return <ChonYeuCauNhapHang />;
}

function ChonYeuCauNhapHang() {
    const navigate = useNavigate();
    const idBang = useId();
    const duocGui = hasAnyRole(VAI_TRO_GUI);
    // Như danh sách Yêu cầu nhập hàng: người chỉ có vai trò kho chỉ thấy yêu cầu của kho mình phụ trách
    const gioiHanKho = !hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG])
        && hasAnyRole([ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]);

    const [dsYeuCau, setDsYeuCau] = useState([]);
    const [dangTai, setDangTai] = useState(true);
    const [loiTai, setLoiTai] = useState("");
    const [chonId, setChonId] = useState(null);

    const taiDanhSach = useCallback(async () => {
        setDangTai(true);
        setLoiTai("");
        try {
            const filters = [{ fieldName: "trangThai", operation: "EQUALS", value: TRANG_THAI_YEU_CAU.DA_DUYET, logicType: "AND" }];
            if (gioiHanKho) {
                const khoIds = (await getMineKhoList()).map((k) => k.id).filter((id) => id != null);
                // Chưa được gán kho nào thì không có yêu cầu nào thuộc phạm vi
                if (!khoIds.length) {
                    setDsYeuCau([]);
                    return;
                }
                filters.push({ fieldName: "khoNhap.id", operation: "IN", value: khoIds, logicType: "AND" });
            }
            const res = await purchaseRequestService.filter({
                filters,
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
                page: 0, size: 1000,
            });
            setDsYeuCau(res.data?.data?.content || res.data?.content || []);
        } catch (e) {
            setLoiTai(getApiErrorMessage(e, t("máy chủ không phản hồi")).trim().replace(/[.。]+$/, ""));
        } finally {
            setDangTai(false);
        }
    }, [gioiHanKho]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    useEffect(() => {
        queueMicrotask(() => taiDanhSach());
    }, [taiDanhSach]);

    // Dòng bảng (phân trang theo dòng, tìm theo mã, kho, người tạo, ghi chú)
    const dong = useMemo(() => dsYeuCau.filter((yc) => yc?.id != null).map((yc) => {
        const coChiTiet = Array.isArray(yc.chiTietYeuCauMuaHangs);
        return {
            id: yc.id,
            tenSanPham: maYeuCau(yc),
            chuTimThem: [yc.khoNhap?.tenKho, yc.nguoiTao?.hoTen, yc.ghiChu].filter(Boolean),
            soBienThe: coChiTiet ? yc.chiTietYeuCauMuaHangs.length : null,
            soLuong: coChiTiet ? tongSoLuongDat(yc) : null,
            // Cùng quy tắc chặn với bước 2 (vd. yêu cầu chưa có dòng sản phẩm)
            chan: chanGuiBaoGia(yc),
            yc,
        };
    }), [dsYeuCau]);
    const bang = useBangChungTu(dong, { theo: "dong", donVi: t("yêu cầu") });

    if (dangTai && !dsYeuCau.length) {
        return (
            <PageContainer>
                <LoadingState label={t("Đang tải yêu cầu nhập hàng đã duyệt")} />
            </PageContainer>
        );
    }

    const chon = dong.find((d) => String(d.id) === String(chonId)) ?? null;
    const yc = chon?.yc ?? null;
    const lyDoKhoa = !duocGui
        ? t("Vai trò của bạn không gửi được yêu cầu báo giá")
        : !chon ? t("Chọn một yêu cầu nhập hàng") : chon.chan?.tieuDe ?? "";
    const diTiep = (d) => {
        if (duocGui && d && !d.chan) navigate(duongGui(d.id));
    };

    const thongBao = [
        <DongThongBao key="mot-lan" tone="info">
            {t("Chỉ hiện yêu cầu nhập hàng")} <b className="font-semibold">{t("đã duyệt và chưa gửi")}</b>
            {gioiHanKho ? <> {t("của nơi làm việc của bạn")}</> : null}.{" "}
            {t("Bước sau chọn nhà cung cấp; mỗi yêu cầu chỉ gửi yêu cầu báo giá một lần, tới nhiều nhà cung cấp cùng lúc.")}
        </DongThongBao>,
        !duocGui ? (
            <DongThongBao key="vai-tro" tone="warn">
                {t("Vai trò của bạn xem được yêu cầu nhập hàng nhưng không gửi được yêu cầu báo giá. Hãy báo nhân viên mua hàng hoặc quản lý kho.")}
            </DongThongBao>
        ) : null,
        loiTai ? (
            <DongThongBao key="loi-tai" tone="bad" actions={<NutChu onClick={taiDanhSach}>{t("Thử lại")}</NutChu>}>
                {t("Không tải được danh sách yêu cầu nhập hàng: {{loiTai}}.", { loiTai })}
            </DongThongBao>
        ) : null,
    ].filter(Boolean);

    const chinh = !dong.length ? (
        <EmptyState
            icon={ClipboardList}
            title={loiTai ? t("Chưa tải được danh sách") : t("Không có yêu cầu nhập hàng nào chờ gửi yêu cầu báo giá")}
            description={loiTai ? t("Bấm Thử lại ở dòng báo lỗi phía trên.") : t("Yêu cầu nhập hàng cần được duyệt trước khi gửi yêu cầu báo giá cho nhà cung cấp.")}
            action={loiTai ? null : (
                <Link to="/purchase-requests" className="text-sm font-semibold text-bo-primary hover:underline">
                    {t("Mở danh sách yêu cầu nhập hàng")}
                </Link>
            )}
            className="min-h-[280px] flex-1"
        />
    ) : (
        <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
            <h2 id={`${idBang}-tieu-de`} className="sr-only">{t("Yêu cầu nhập hàng đã duyệt")}</h2>
            {bang.coCongCu ? (
                <ThanhCongCuBang
                    className="pt-3"
                    tuKhoa={bang.tuKhoa}
                    onDoiTuKhoa={bang.datTuKhoa}
                    onXoaTuKhoa={bang.xoaTuKhoa}
                    goiYTim={t("Tìm theo mã yêu cầu, kho nhập, người tạo")}
                    nhanTim={t("Tìm yêu cầu nhập hàng")}
                    ketQua={bang.chuKetQua}
                    khongKetQua={bang.khongKetQua}
                />
            ) : null}
            {bang.dong.length ? (
                <div className={KHUNG_CUON}>
                    <table className={cn(BANG, "@2xl/khoi:min-w-[640px]")}>
                        <thead>
                            <tr className={DONG_TIEU_DE}>
                                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>{t("Yêu cầu nhập hàng")}</th>
                                <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI)}>{t("Kho nhập")}</th>
                                <th scope="col" className={cn(O_TIEU_DE, "w-36", AN_DIEN_THOAI)}>{t("Giao dự kiến")}</th>
                                <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right")}>{t("Biến thể")}</th>
                                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-28 text-right")}>{t("Tổng số lượng")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bang.dong.map((d) => {
                                const dangChon = String(d.id) === String(chonId);
                                return (
                                    <tr
                                        key={d.id}
                                        onClick={() => setChonId(d.id)}
                                        onDoubleClick={() => diTiep(d)}
                                        className={cn(DONG, "cursor-pointer", dangChon && DONG_SANG)}
                                    >
                                        <td className={cn(O, O_DAU)}>
                                            {/* Màn cảm ứng: nhãn bọc ô chọn cao tối thiểu 44px (bảng ở 1180px ngang chỉ cao 36px) */}
                                            <label className="flex min-w-0 cursor-pointer items-center gap-3 cam-ung:min-h-11">
                                                <input
                                                    type="radio"
                                                    name={`${idBang}-yeu-cau`}
                                                    checked={dangChon}
                                                    onChange={() => setChonId(d.id)}
                                                    className="size-4 shrink-0 accent-bo-primary"
                                                />
                                                <span className="min-w-0">
                                                    <span className="block font-medium tabular-nums text-bo-foreground">{d.tenSanPham}</span>
                                                    <span className="block text-xs text-bo-muted">
                                                        {d.yc.nguoiTao?.hoTen ? `${d.yc.nguoiTao.hoTen} · ` : ""}{t("tạo {{ngayTao}}", { ngayTao: formatDate(d.yc.ngayTao) || "—" })}
                                                    </span>
                                                    <span className={cn("block text-xs text-bo-muted", CHI_DIEN_THOAI)}>
                                                        {d.yc.khoNhap?.tenKho || "—"} · {t("giao {{ngayGiao}}", { ngayGiao: formatDate(d.yc.ngayGiaoDuKien) || "—" })}
                                                    </span>
                                                </span>
                                            </label>
                                        </td>
                                        <td className={cn(O, AN_DIEN_THOAI)}>{d.yc.khoNhap?.tenKho || "—"}</td>
                                        <td className={cn(O, AN_DIEN_THOAI)}>{formatDate(d.yc.ngayGiaoDuKien) || "—"}</td>
                                        <td className={cn(O, "text-right", d.soBienThe === 0 && "text-bo-muted")}>
                                            {d.soBienThe == null ? "—" : d.soBienThe === 0 ? t("Chưa có") : soVN(d.soBienThe)}
                                        </td>
                                        <td className={cn(O, O_CUOI, "text-right font-semibold")}>{d.soLuong == null ? "—" : soVN(d.soLuong)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
            <KhongKetQua bang={bang} tenChungTu={t("Danh sách")} donVi={t("yêu cầu")} />
            {/* Giữ thanh phân trang khi người dùng đã tăng cỡ trang (một trang) để còn đổi lại được */}
            {bang.phanTrang && (bang.soTrang > 1 || bang.tongMuc > Math.min(...(bang.luaChonCoTrang?.length ? bang.luaChonCoTrang : [Infinity])))
                ? <PhanTrangBang {...bang.phanTrang} />
                : null}
        </section>
    );

    const cotPhai = yc ? (
        <CotThuocTinh nhan={t("Yêu cầu nhập hàng đã chọn")}>
            <NhomThuocTinh nhan={t("Yêu cầu đã chọn")}>
                {/* Mã đã hiện ở dòng đang chọn của bảng: ở đây chỉ là lối mở chi tiết */}
                <Link to={`/purchase-requests/${yc.id}`} className="text-sm font-semibold text-bo-primary hover:underline">
                    {t("Mở chi tiết yêu cầu nhập hàng")}
                </Link>
            </NhomThuocTinh>
            <NhomThuocTinh>
                <BangThuocTinh
                    muc={[
                        { nhan: t("Người duyệt"), giaTri: yc.nguoiDuyet?.hoTen },
                        { nhan: t("Ghi chú"), giaTri: yc.ghiChu, an: !yc.ghiChu },
                    ]}
                />
            </NhomThuocTinh>
            <NhomThuocTinh nhan={t("Bước tiếp theo")}>
                <p className="m-0 text-[13px] leading-5 text-slate-700">
                    {chon?.chan
                        ? chon.chan.moTa
                        : t("Chọn nhà cung cấp nhận yêu cầu báo giá. Nhà cung cấp chưa có email hoặc đang ngừng hoạt động không chọn được.")}
                </p>
            </NhomThuocTinh>
        </CotThuocTinh>
    ) : null;

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={t("Tạo yêu cầu báo giá")}
                        dongPhu={[t("Bước 1: chọn yêu cầu nhập hàng đã duyệt"), t("Bước 2: chọn nhà cung cấp và gửi")]}
                        onQuayLai={() => navigate("/quotation-requests")}
                        nhanQuayLai={t("Quay lại danh sách")}
                        nutChinh={{
                            ma: "tiep",
                            nhan: t("Chọn nhà cung cấp"),
                            icon: ArrowRight,
                            onClick: () => diTiep(chon),
                            khoa: Boolean(lyDoKhoa),
                            lyDo: lyDoKhoa || undefined,
                            hienLyDo: true,
                        }}
                    />
                }
                thongBao={thongBao}
                chinh={chinh}
                cotPhai={cotPhai}
            />
        </PageContainer>
    );
}
