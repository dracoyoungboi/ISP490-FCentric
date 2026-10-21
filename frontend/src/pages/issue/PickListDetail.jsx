import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCheck, FileText, UserPlus } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import MockModeNotice from "@/components/shared/MockModeNotice";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import AssignPickerDialog from "@/components/outbound/AssignPickerDialog";
import LotAllocationDialog from "@/components/outbound/LotAllocationDialog";
import PackingProofModal from "@/components/outbound/PackingProofModal";
import VungQuet from "@/components/outbound/phieu-nhat/VungQuet";
import BangDongNhat from "@/components/outbound/phieu-nhat/BangDongNhat";
import CotPhieuNhat from "@/components/outbound/phieu-nhat/CotPhieuNhat";
import {
    CanhBaoHuy,
    DongChuaGiao,
    DongDaHuy,
    DongDaNhat,
    DongGiaoKhac,
    KetQuaBoQua,
} from "@/components/outbound/phieu-nhat/ThongBaoPhieuNhat";
import useSuKienPhieuNhat from "@/components/outbound/phieu-nhat/useSuKienPhieuNhat";
import {
    BO_LOC_DONG,
    DON_VI_DONG,
    TEN_CHUNG_TU,
    capNhatSauQuet,
    cauMayChuKhongThay,
    cauMayChuPhieuNhat,
    cauQuetThanhCong,
    demDon,
    dongBangNhat,
    dsDonTrongPhieu,
    hangTraKe,
    idDongDaQuet,
    ketQuaHoanTatNhat,
    lyDoKhoaHoanTat,
    tinhBuoc,
    tinhQuyen,
    tinhTienDo,
} from "@/components/outbound/phieu-nhat/tinhPhieuNhat";
import useScanQueue from "@/hooks/useScanQueue";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import { formatQuantity, getPickListStatus } from "@/constants/outbound";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { playScanBeep } from "@/utils/scanBeep";
import { getCurrentUserId, hasAnyRole, ROLES } from "@/utils/roles";

const DS_PHIEU_NHAT = "/goods-issues/pick-lists";
const MO_TA_KHONG_THAY = "Phiếu nhặt hàng không tồn tại hoặc thuộc kho khác với nơi làm việc đang chọn.";

/** Câu lỗi của máy chủ (đã lọc chữ "Pick List"…), không có thì câu dự phòng. */
const cauLoi = (error, duPhong) => cauMayChuPhieuNhat(getApiErrorMessage(error, duPhong));
// Tải lại ngầm mà dữ liệu trên màn vừa đổi (quét, phân công, phân bổ lô) thì tải lại tối đa ngần này lần
const SO_LAN_TAI_LAI_KHI_DOI = 3;

/**
 * Thực hiện nhặt hàng (`/goods-issues/pick-lists/:id`) · bản "một khối" (21/10/2026, artboard PhieuNhat):
 * đầu khối (mã phiếu, trạng thái, Hoàn tất nhặt), tiến trình 5 bước, vùng quét hoặc dòng "chưa phân công" / "đang
 * giao người khác" / "đã nhặt xong", bảng dòng nhặt (thứ tự cố định, tô dòng vừa quét, tự chuyển trang tới dòng đó)
 * và cột phải (kho, người nhặt, ghi chú, đơn trong phiếu).
 *
 * Giữ nguyên: API `/api/v1/nhat-hang/...`, hàng đợi quét tuần tự (useScanQueue), âm "rè" khi mã không cộng được,
 * WebSocket `/ws-outbound?pickListId=` (ping 30 giây), hộp Phân công / Phân bổ lô / Bằng chứng, chế độ dữ liệu mẫu.
 */
export default function PickListDetail() {
    const { id } = useParams();
    // Đổi phiếu (cùng route) thì dựng lại màn: không mang dòng tô sáng, cảnh báo, kết quả quét của phiếu trước
    return <ManNhatHang key={id} id={id} />;
}

function ManNhatHang({ id }) {
    const navigate = useNavigate();
    const scanBarRef = useRef(null);

    const [phieu, setPhieu] = useState(null);
    const [dangTai, setDangTai] = useState(true);
    const [loiTai, setLoiTai] = useState(null);
    const [capNhatLuc, setCapNhatLuc] = useState(null);
    const [ketQuaQuet, setKetQuaQuet] = useState(null);
    const [dongSang, setDongSang] = useState(null);
    const [canDen, setCanDen] = useState(null);
    const [moPhanCong, setMoPhanCong] = useState(false);
    const [moHoanTat, setMoHoanTat] = useState(false);
    const [dangHoanTat, setDangHoanTat] = useState(false);
    const [dangNhanViec, setDangNhanViec] = useState(false);
    const [ketQuaHoanTat, setKetQuaHoanTat] = useState(null);
    const [canhBaoHuy, setCanhBaoHuy] = useState(null);
    const [donBangChung, setDonBangChung] = useState(null);
    const [dongPhanBo, setDongPhanBo] = useState(null);

    const banRef = useRef(false);
    // Chống đua: chỉ lần tải mới nhất được ghi; dữ liệu trên màn đổi trong lúc tải (lanSua tăng) thì tải lại
    const lanTaiRef = useRef(0);
    const lanSuaRef = useRef(0);
    const phieuRef = useRef(null);

    useEffect(() => {
        phieuRef.current = phieu;
    });

    const taiPhieu = useCallback(async ({ ngam = false } = {}) => {
        lanTaiRef.current += 1;
        const lan = lanTaiRef.current;
        try {
            for (let lanThu = 0; lanThu < SO_LAN_TAI_LAI_KHI_DOI; lanThu += 1) {
                const suaTruoc = lanSuaRef.current;
                const res = await nhatHangService.getPickList(id);
                if (lan !== lanTaiRef.current) return;
                if (suaTruoc === lanSuaRef.current) {
                    setPhieu(res ?? null);
                    setLoiTai(null);
                    setCapNhatLuc(new Date());
                    return;
                }
            }
        } catch (error) {
            if (lan !== lanTaiRef.current) return;
            if (ngam) toast.error(cauLoi(error, "Không tải lại được phiếu nhặt hàng"));
            else setLoiTai(error);
        } finally {
            if (lan === lanTaiRef.current) setDangTai(false);
        }
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => taiPhieu());
    }, [taiPhieu]);

    // ── Sự kiện tức thời: đơn bị hủy (đang nhặt / sau khi nhặt xong), hủy cả phiếu ──
    // Mỗi sự kiện chỉ báo ở MỘT chỗ: dòng cảnh báo dưới tiến trình (không thêm thông báo nhanh trùng ý).
    useSuKienPhieuNhat(id, (loai, data) => {
        if (loai === "ORDER_CANCELLED_IN_PICK_LIST") {
            setCanhBaoHuy({ loai: "donNhat", soDonHang: data.soDonHangBiHuy, hangCanTraKe: data.hangCanTraKe || [] });
            playScanBeep(false); // cảnh báo đơn bị hủy: máy quét không báo được việc này
        } else if (loai === "ORDER_CANCELLED_IN_PACKING") {
            setCanhBaoHuy({ loai: "donDongGoi", soDonHang: data.soDonHangBiHuy });
        } else if (loai === "PICK_LIST_CANCELLED") {
            setCanhBaoHuy({ loai: "caPhieu", message: cauMayChuPhieuNhat(data.message) });
            playScanBeep(false);
        } else {
            return;
        }
        taiPhieu({ ngam: true });
    });

    // ── Quét: gửi từng mã một (backend khóa phiếu khi quét) ──
    const xuLyQuet = useCallback(async ({ barcode, soLuong }) => {
        try {
            const kq = await nhatHangService.quetBarcode(id, { barcode, soLuong });
            lanSuaRef.current += 1;
            const idDong = idDongDaQuet(phieuRef.current, kq);
            setPhieu((truoc) => capNhatSauQuet(truoc, kq));
            setDongSang(idDong);
            if (idDong != null) setCanDen({ id: idDong });
            setKetQuaQuet({ ok: true, message: cauQuetThanhCong(kq, barcode, soLuong) });
        } catch (error) {
            setKetQuaQuet({ ok: false, message: cauLoi(error, `Không quét được mã ${barcode}`) });
            // Chỉ kêu khi KHÔNG cộng được: máy quét đã tự kêu "bíp" khi đọc được mã, nhưng không biết mã có
            // thuộc phiếu nhặt này / còn cần nhặt hay không.
            playScanBeep(false);
            if (getApiErrorStatus(error) === 409) taiPhieu({ ngam: true });
        }
    }, [id, taiPhieu]);

    const { enqueue, pending } = useScanQueue(xuLyQuet);

    // ── Bảng dòng nhặt ──
    const chiTiet = phieu?.chiTietNhatHangs;
    const dong = useMemo(() => dongBangNhat(chiTiet), [chiTiet]);
    const bang = useBangChungTu(dong, { theo: "dong", donVi: DON_VI_DONG, boLoc: BO_LOC_DONG });

    // Quét xong: sau khi bảng đã có số mới thì chuyển tới trang / bộ lọc chứa dòng vừa quét
    const denDongRef = useRef(bang.denDong);
    useEffect(() => {
        denDongRef.current = bang.denDong;
    });
    useEffect(() => {
        if (canDen) denDongRef.current(canDen.id);
    }, [canDen]);

    // Quay lại tab thì tải lại ngầm (người khác có thể vừa phân công lại, đơn vừa đóng gói / xuất kho)
    useTaiLaiKhiQuayLai(() => taiPhieu({ ngam: true }), {
        bat: Boolean(phieu) && pending === 0 && !dangHoanTat && !dangNhanViec,
        lanCuoi: capNhatLuc,
    });

    // ── Đang tải / không tìm thấy / lỗi ──
    if (!phieu) {
        if (dangTai) {
            return (
                <PageContainer className="flex min-h-full flex-col">
                    <KhungDangTai nhan="Đang tải phiếu nhặt hàng" />
                </PageContainer>
            );
        }
        // Backend trả 400 cho cả "không tìm thấy" và "thuộc kho khác": phanLoaiLoiTai (KhungLoiChungTu) nhận theo câu
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={loiTai}
                    tenChungTu={TEN_CHUNG_TU}
                    moTaKhongThay={MO_TA_KHONG_THAY}
                    locCauMayChu={cauMayChuKhongThay}
                    onVeDanhSach={() => navigate(DS_PHIEU_NHAT)}
                    onThuLai={() => {
                        setDangTai(true);
                        setLoiTai(null);
                        taiPhieu();
                    }}
                />
            </PageContainer>
        );
    }

    // ── Quyền và số liệu (khớp NhatHangServiceImpl, spec §A.4) ──
    const laQuanLy = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
    const idToi = getCurrentUserId();
    const quyen = tinhQuyen(phieu, { laQuanLy, idToi });
    const tienDo = tinhTienDo(phieu.tongSoLuongDaQuet, phieu.tongSoLuongCanNhat, phieu.phanTramHoanThanh);
    const dsDon = dsDonTrongPhieu(phieu, {
        huySo: canhBaoHuy?.loai === "caPhieu" ? null : canhBaoHuy?.soDonHang ?? null,
        huyHet: canhBaoHuy?.loai === "caPhieu",
    });
    const buoc = tinhBuoc(phieu, { quyen, dsDon, tienDo });
    const soDon = phieu.tongDonHang ?? (phieu.danhSachMaDonHang ?? []).length;
    const soSku = phieu.tongSku ?? dong.length;
    const lyDoKhoa = lyDoKhoaHoanTat({
        coTheHoanTat: phieu.coTheHoanTat,
        conLai: tienDo.conLai,
        dangGui: pending,
        rong: bang.rong,
    });

    const coPhieuMoi = (res, thay = false) => {
        if (!res) return;
        lanSuaRef.current += 1;
        setPhieu((truoc) => (thay ? res : { ...truoc, ...res }));
    };

    // Nhận việc một chạm: cùng PUT phan-cong với id của chính mình (như "Nhận việc cho tôi" trong hộp phân công)
    const nhanViec = async () => {
        if (banRef.current || idToi == null) return;
        banRef.current = true;
        setDangNhanViec(true);
        try {
            const res = await nhatHangService.phanCong(phieu.id, { nguoiNhatId: idToi });
            toast.success(`Đã phân công ${phieu.maPickList} cho ${res?.tenNguoiNhat || "nhân viên"}`);
            coPhieuMoi(res);
        } catch (error) {
            toast.error(cauLoi(error, "Không thể phân công người nhặt"));
            if (getApiErrorStatus(error) === 409) taiPhieu({ ngam: true });
        } finally {
            banRef.current = false;
            setDangNhanViec(false);
        }
    };

    const hoanTat = async () => {
        if (banRef.current) return;
        banRef.current = true;
        setDangHoanTat(true);
        try {
            const res = await nhatHangService.hoanTat(id);
            const kq = ketQuaHoanTatNhat(res, phieu);
            coPhieuMoi(res, true);
            setKetQuaHoanTat(kq.boQua.length ? kq : null);
            setKetQuaQuet(null);
            setDongSang(null);
            if (canhBaoHuy?.loai === "donNhat") setCanhBaoHuy(null);
            toast.success(
                `Đã hoàn tất nhặt ${res?.maPickList ?? ""}`.trim(),
                kq.daTao.length ? { description: `Đã tạo phiếu xuất kho nháp cho ${kq.daTao.length} đơn` } : undefined,
            );
        } catch (error) {
            toast.error(cauLoi(error, "Không thể hoàn tất nhặt hàng"));
            if (getApiErrorStatus(error) === 409) taiPhieu({ ngam: true });
        } finally {
            banRef.current = false;
            setDangHoanTat(false);
            setMoHoanTat(false);
        }
    };

    // ── Dòng thông báo (dưới tiến trình) ──
    const daNhat = phieu.trangThai === "da_nhat";
    const { tong: soDonHopLe, soXuat } = demDon(dsDon);
    const thongBao = [
        isPickListMock ? <MockModeNotice key="mau" show /> : null,
        canhBaoHuy ? (
            <CanhBaoHuy
                key="huy"
                canhBao={canhBaoHuy}
                traKe={hangTraKe(canhBaoHuy.hangCanTraKe, chiTiet)}
                onDaHieu={() => setCanhBaoHuy(null)}
            />
        ) : null,
        ketQuaHoanTat ? <KetQuaBoQua key="boQua" ketQua={ketQuaHoanTat} onDaHieu={() => setKetQuaHoanTat(null)} /> : null,
        quyen.duocQuet ? (
            <VungQuet
                key="quet"
                scanRef={scanBarRef}
                onQuet={(barcode, soLuong) => enqueue({ barcode, soLuong })}
                dangGui={pending}
                ketQua={ketQuaQuet}
                tienDo={tienDo}
            />
        ) : null,
        quyen.dangMo && !quyen.daPhanCong ? (
            <DongChuaGiao
                key="chuaGiao"
                laQuanLy={quyen.laQuanLy}
                dangNhan={dangNhanViec}
                khoaNhan={!quyen.duocNhanViec}
                onNhanViec={nhanViec}
                onPhanCong={() => setMoPhanCong(true)}
            />
        ) : null,
        quyen.dangMo && quyen.daPhanCong && !quyen.laNguoiNhat ? (
            <DongGiaoKhac key="giaoKhac" laQuanLy={quyen.laQuanLy} onPhanCong={() => setMoPhanCong(true)} />
        ) : null,
        quyen.daXongNhat ? (
            <DongDaNhat
                key="daNhat"
                dataCu={!daNhat}
                xongHet={soDonHopLe > 0 && soXuat >= soDonHopLe}
                donHuy={daNhat && !ketQuaHoanTat ? dsDon.filter((d) => d.huy).map((d) => d.so) : []}
                coLienKet={daNhat}
                onMoDsXuat={() => navigate("/goods-issues")}
            />
        ) : null,
        quyen.daHuy && canhBaoHuy?.loai !== "caPhieu" ? <DongDaHuy key="daHuy" /> : null,
    ].filter(Boolean);

    const menu = [
        quyen.dangMo && quyen.laQuanLy && quyen.daPhanCong
            ? { ma: "phanCong", nhan: "Phân công lại", icon: UserPlus, moTa: "Đổi người nhặt phiếu này", onSelect: () => setMoPhanCong(true) }
            : null,
        daNhat ? { ma: "dsXuat", nhan: "Mở danh sách phiếu xuất", icon: FileText, onSelect: () => navigate("/goods-issues") } : null,
    ];

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={phieu.maPickList}
                        trangThai={{ label: getPickListStatus(phieu.trangThai).label, quyTrinh: "phieuNhat" }}
                        dongPhu={[
                            "Phiếu nhặt hàng",
                            <b key="don" className="font-semibold text-bo-foreground">{formatQuantity(soDon)} đơn</b>,
                            <b key="dong" className="font-semibold text-bo-foreground">{formatQuantity(soSku)} {DON_VI_DONG}</b>,
                        ]}
                        onQuayLai={() => navigate(DS_PHIEU_NHAT)}
                        nhanQuayLai="Về danh sách phiếu nhặt hàng"
                        saoChepMa={{ giaTri: phieu.maPickList, nhan: "Sao chép mã phiếu" }}
                        menu={menu}
                        nutChinh={
                            quyen.duocHoanTat
                                ? {
                                    ma: "hoanTat",
                                    nhan: "Hoàn tất nhặt",
                                    icon: CheckCheck,
                                    onClick: () => setMoHoanTat(true),
                                    khoa: !phieu.coTheHoanTat || pending > 0,
                                    lyDo: lyDoKhoa,
                                    hienLyDo: true,
                                    dangChay: dangHoanTat,
                                }
                                : null
                        }
                    />
                }
                tienTrinh={<TienTrinhChungTu buoc={buoc} nhan="Tiến trình phiếu nhặt hàng" />}
                thongBao={thongBao.length ? thongBao : null}
                chinh={
                    <BangDongNhat
                        bang={bang}
                        duocPhanBoLo={quyen.duocPhanBoLo}
                        dongSang={quyen.dangMo ? dongSang : null}
                        onPhanBoLo={setDongPhanBo}
                    />
                }
                cotPhai={
                    <CotPhieuNhat
                        phieu={phieu}
                        dsDon={dsDon}
                        onMoBangChung={setDonBangChung}
                        onDongGoi={(don) => navigate(`/goods-issues/packing/${don.id}`)}
                    />
                }
            />

            <AssignPickerDialog
                open={moPhanCong}
                onOpenChange={setMoPhanCong}
                pickList={phieu}
                onAssigned={(res) => coPhieuMoi(res)}
            />

            <LotAllocationDialog
                open={Boolean(dongPhanBo)}
                onOpenChange={(mo) => !mo && setDongPhanBo(null)}
                pickListId={phieu.id}
                line={dongPhanBo}
                onSaved={(res) => coPhieuMoi(res, true)}
            />

            <HopXacNhanChungTu
                mo={moHoanTat}
                onDoiMo={setMoHoanTat}
                tieuDe="Hoàn tất nhặt hàng"
                moTa={`Phiếu nhặt hàng ${phieu.maPickList} sẽ chuyển sang Đã nhặt và khóa phân bổ lô. Hệ thống tạo phiếu xuất kho nháp có sẵn lô cho từng đơn (đơn đặt sớm nhận lô cũ trước), các đơn chuyển sang Chờ đóng gói.`}
                nhanXacNhan="Hoàn tất nhặt"
                iconXacNhan={CheckCheck}
                tieuDiemQuayLai
                dangChay={dangHoanTat}
                onXacNhan={hoanTat}
            />

            {/* Xem / tải lên bằng chứng đóng gói nhanh từ màn nhặt hàng */}
            <PackingProofModal
                isOpen={Boolean(donBangChung)}
                onClose={() => setDonBangChung(null)}
                donId={donBangChung?.id}
                soDonHang={donBangChung?.soDonHang}
                tongTienDonHang={donBangChung?.tongCong}
                onProofChanged={() => taiPhieu({ ngam: true })}
            />
        </PageContainer>
    );
}
