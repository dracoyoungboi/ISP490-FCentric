import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipboardCheck, FileWarning, ScanLine } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { BANG, DONG, DONG_TIEU_DE, KHUNG_CUON, O, O_CUOI, O_DAU, O_TIEU_DE } from "@/components/chung-tu/kieuBang";
import { GHI_CHU_HOP, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { chayCoThoiHan, CAU_HET_THOI_HAN, MO_TA_HET_THOI_HAN, laLoiHetThoiHan } from "@/components/chung-tu/thoiHanThaoTac";
import { TT_CHUYEN } from "@/constants/phieuChuyenKho";
import {
    aiXuLyChenhLech,
    chuanSoDem,
    giaTriONgayGio,
    khoaLo,
    quetMotMa,
    tinhNhanHang,
    yeuCauNhanLech,
} from "@/components/chuyen-kho/hienThiChuyenKho";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { lamViecTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import { cauAnhChuaTai, taiLanLuot } from "@/components/chuyen-kho/anhBienBan";
import useAnhChon from "@/components/chuyen-kho/useAnhChon";
import useQuayLai from "@/hooks/useQuayLai";
import { cn } from "@/lib/utils";
import ChonAnhBienBan from "./ChonAnhBienBan";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;
const O_SO = "h-8 w-[72px] rounded-md border border-bo-input-border bg-bo-surface px-2 text-right text-sm tabular-nums outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15";
const O_SO_LOI = "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15";

/**
 * Nhận hàng chuyển kho (màn B.4 của BA) tại kho nhận: đếm theo lô đã xuất (quét mã vạch cộng 1 vào cột Đạt, hoặc gõ số),
 * nhập số hỏng; Thiếu = Gửi − Đạt − Hỏng. Khớp đủ → "Xác nhận nhận đủ" (phiếu nhập PN-TRF, phiếu Hoàn tất). Có lệch →
 * "Xử lý chênh lệch": lý do bắt buộc ở dòng lệch, lập biên bản giao nhận, nhập ngay phần đạt, phần lệch giữ ở kho trung
 * chuyển chờ người được xử lý chênh lệch (Quản lý Kho tổng theo mặc định, đổi ở Cấu hình › Chuyển kho).
 */
export default function NhanHangChuyenKho() {
    const { id } = useParams();
    return <ManNhanHang key={id} id={id} />;
}

function ManNhanHang({ id }) {
    const navigate = useNavigate();
    const [ct, setCt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [dem, setDem] = useState({});
    const [daKiemLyDo, setDaKiemLyDo] = useState(false);
    const [hop, setHop] = useState(null); // "du" | "bienBan" | null
    const [loiHop, setLoiHop] = useState(null);
    const [dangChay, setDangChay] = useState(false);
    const [maQuet, setMaQuet] = useState("");
    const oQuetRef = useRef(null);
    // Ảnh chụp của biên bản (mockup B.4): giữ ở màn để đóng / mở lại hộp biên bản không mất ảnh đã chọn
    const anhChon = useAnhChon();
    const [tienDoAnh, setTienDoAnh] = useState(null);
    // Hủy lần tải ảnh đang chạy (nút "Bỏ qua, tải ảnh sau"): biên bản đã lập, ảnh chưa tải thì thêm ở chi tiết phiếu
    const boQuaAnhRef = useRef(null);
    const daGoRef = useRef(false);
    // Mở từ chi tiết phiếu chuyển thì lùi về đúng trang đó, không chồng thêm lịch sử (Quay lại ở chi tiết không rơi về
    // đây). Mở từ nơi khác (Tổng quan, đường dẫn) thì thay màn này bằng chi tiết phiếu: nhận xong phải thấy phiếu vừa nhận
    const location = useLocation();
    const tuChiTiet = location.state?.tuChiTiet === true;
    const quayLai = useQuayLai(`/transfer-tickets/${id}`);
    const veChiTiet = () => (tuChiTiet ? quayLai() : navigate(`/transfer-tickets/${id}`, { replace: true }));

    useEffect(() => {
        daGoRef.current = false;
        return () => {
            daGoRef.current = true;
        };
    }, []);

    const tai = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await phieuChuyenKhoService.chiTiet(id);
            setCt(res?.id != null ? res : null);
            if (res?.id == null) setLoadError({ loi: null });
        } catch (e) {
            setCt(null);
            setLoadError({ loi: e });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => tai());
    }, [tai]);

    const kq = useMemo(() => tinhNhanHang(ct?.hangTheoLo, dem), [ct, dem]);
    // Chưa quét, chưa gõ số nào: chưa báo lệch (mọi dòng Đạt = 0 chỉ vì chưa đếm), cũng chưa nút nào là nút chính
    const chuaDem = kq.tong.dat === 0 && kq.tong.hong === 0;

    const doiSo = (d, khoa, giaTri) => setDem((cu) => {
        const r = cu[d.khoa] ?? { dat: 0, hong: 0, lyDo: "" };
        return { ...cu, [d.khoa]: { ...r, [khoa]: chuanSoDem(giaTri) } };
    });
    const doiLyDo = (d, giaTri) => setDem((cu) => ({ ...cu, [d.khoa]: { ...(cu[d.khoa] ?? { dat: 0, hong: 0 }), lyDo: giaTri } }));

    const quet = (e) => {
        e.preventDefault();
        if (!maQuet.trim()) return;
        const ketQua = quetMotMa(ct.hangTheoLo, dem, maQuet);
        if (!ketQua.khop) {
            toast.error(`Mã ${maQuet.trim()} không có trong phiếu chuyển này`);
        } else {
            setDem(ketQua.dem);
            if (ketQua.vuot) toast.warning(`${ketQua.khop.sku}: đã đếm vượt số gửi`);
        }
        setMaQuet("");
        oQuetRef.current?.focus();
    };

    const moBienBan = () => {
        setDaKiemLyDo(true);
        if (kq.dong.some((d) => d.thieuLyDo)) {
            toast.error("Nhập lý do giải trình cho các dòng lệch");
            return;
        }
        setHop("bienBan");
    };

    /**
     * Gửi thao tác nhận hàng. `sauKhiXong(res)` (không bắt buộc): việc làm thêm khi thao tác chính đã thành công (tải ảnh
     * biên bản), trả câu cảnh báo hoặc null; việc này lỗi không đổi kết quả thao tác chính.
     */
    async function chay(thaoTac, cauOk, sauKhiXong) {
        lamViecTaiKho(ct.khoNhap);
        setDangChay(true);
        setLoiHop(null);
        let res;
        try {
            res = await chayCoThoiHan(thaoTac);
        } catch (e) {
            setDangChay(false);
            if (laLoiHetThoiHan(e)) {
                setHop(null);
                toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
                // Chưa biết biên bản đã lập chưa: ảnh đã chọn không gửi; chỉ thêm ảnh được khi biên bản đã có
                if (hop === "bienBan" && anhChon.ds.length) {
                    toast.warning(`${anhChon.ds.length} ảnh chưa tải lên`, {
                        description: "Chưa rõ biên bản đã lập chưa. Mở lại phiếu để kiểm tra; nếu đã lập thì thêm ảnh ở chi tiết phiếu.",
                    });
                }
                // Người dùng đã rời màn trong lúc chờ: không kéo họ khỏi trang đang xem
                if (daGoRef.current) return;
                veChiTiet();
                return;
            }
            setLoiHop(getApiErrorMessage(e, "Không ghi nhận được nhận hàng"));
            // Phiếu vừa đổi ở nơi khác (hủy, đã có người nhận): tải lại để màn hiện đúng trạng thái
            if (getApiErrorStatus(e) === 409) tai();
            return;
        }
        const canhBao = sauKhiXong ? await sauKhiXong(res) : null;
        toast.success(cauOk(res));
        if (canhBao) toast.warning(canhBao);
        if (daGoRef.current) return;
        setDangChay(false);
        setHop(null);
        veChiTiet();
    }

    /**
     * Sau khi lập biên bản: tải lần lượt ảnh đã chọn; ảnh lỗi chỉ báo, biên bản vẫn thành công. Mạng chậm (mỗi ảnh chờ
     * tới 60 giây) thì người dùng bấm "Bỏ qua, tải ảnh sau": dừng tải, ảnh chưa tải báo như ảnh lỗi, đi tiếp bình thường.
     */
    async function taiAnhBienBan() {
        if (!anhChon.ds.length) return null;
        setTienDoAnh({ xong: 0, tong: anhChon.ds.length });
        const dieuKhien = new AbortController();
        boQuaAnhRef.current = dieuKhien;
        const { loi } = await taiLanLuot(
            anhChon.ds,
            (a) => phieuChuyenKhoService.themAnhBienBan(id, a.file, a.moTa, { signal: dieuKhien.signal }),
            (xong, tong) => !daGoRef.current && setTienDoAnh({ xong, tong }),
            dieuKhien.signal,
        );
        boQuaAnhRef.current = null;
        if (!daGoRef.current) setTienDoAnh(null);
        return loi.length ? cauAnhChuaTai(loi.length) : null;
    }

    if (!ct) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                {loading || !loadError ? (
                    <KhungDangTai nhan="Đang tải phiếu chuyển kho" />
                ) : (
                    <KhungLoiChungTu loi={loadError.loi} tenChungTu="phiếu chuyển kho" onVeDanhSach={() => navigate("/transfer-tickets")} onThuLai={tai} />
                )}
            </PageContainer>
        );
    }

    const khoXuat = ct.khoXuat?.ten ?? "kho xuất";
    const khoNhap = ct.khoNhap?.ten ?? "kho nhận";
    const duocNhan = ct.trangThai === TT_CHUYEN.DANG_VAN_CHUYEN && ct.quyen?.nhan;
    const dau = (
        <DauChungTu
            ma={`Nhận hàng · ${ct.soPhieuChuyen}`}
            dongPhu={[
                `Từ ${khoXuat}`,
                ct.nguoiVanChuyen ? `người giao ${ct.nguoiVanChuyen}` : null,
                <span key="xknb">giấy đi đường <span className="font-mono">{ct.soPhieuXknb ? `${ct.kyHieuXknb} · ${ct.soPhieuXknb}` : "chưa có số"}</span></span>,
            ].filter(Boolean)}
            onQuayLai={veChiTiet}
            nhanQuayLai="Về phiếu chuyển"
            nutChinh={duocNhan ? [
                {
                    nhan: "Xử lý chênh lệch",
                    icon: FileWarning,
                    kieu: kq.khop || chuaDem ? "vien" : "chinh",
                    onClick: moBienBan,
                    khoa: kq.khop || kq.vuot || kq.dong.length === 0,
                    lyDo: kq.vuot ? "Có dòng vượt số gửi, đếm lại trước" : kq.khop ? "Hàng khớp đủ, dùng Xác nhận nhận đủ" : undefined,
                },
                {
                    nhan: "Xác nhận nhận đủ",
                    icon: ClipboardCheck,
                    kieu: kq.khop ? "chinh" : "vien",
                    onClick: () => setHop("du"),
                    khoa: !kq.khop,
                    lyDo: !kq.khop ? "Số đếm chưa khớp số gửi" : undefined,
                },
            ] : []}
        />
    );

    if (!duocNhan) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungChungTu
                    dau={dau}
                    thongBao={[
                        <DongThongBao key="khong" tone="warn">
                            {ct.trangThai !== TT_CHUYEN.DANG_VAN_CHUYEN
                                ? "Phiếu không còn ở bước nhận hàng."
                                : `Chỉ ${khoNhap} (quản lý, nhân viên kho được phân công) nhận hàng của phiếu này.`}{" "}
                            Mở lại phiếu chuyển để xem trạng thái hiện tại.
                        </DongThongBao>,
                    ]}
                    chinh={<div className="p-6" />}
                />
            </PageContainer>
        );
    }

    const thongBao = kq.vuot ? (
        <DongThongBao tone="bad">Có dòng Đạt + Hỏng vượt số gửi. Đếm lại dòng đó; hàng dư ngoài phiếu không nhập theo phiếu này.</DongThongBao>
    ) : chuaDem ? (
        <DongThongBao tone="info">
            Quét mã vạch (mỗi lần cộng 1 vào cột Đạt) hoặc gõ số Đạt, Hỏng cho từng lô. Khớp đủ thì bấm <B>Xác nhận nhận đủ</B>; có
            thiếu hoặc hỏng thì bấm <B>Xử lý chênh lệch</B> để lập biên bản giao nhận.
        </DongThongBao>
    ) : kq.khop ? (
        <DongThongBao tone="ok">
            Khớp đủ {soVN(kq.tong.dat)}/{soVN(kq.tong.gui)} sản phẩm, hàng nguyên vẹn. Bấm <B>Xác nhận nhận đủ</B> để phát hành phiếu nhập và hoàn tất phiếu.
        </DongThongBao>
    ) : (
        <DongThongBao tone="warn">
            Có <B>{kq.soDongLech} dòng</B> không khớp số gửi (thiếu {soVN(kq.tong.thieu)}, hỏng {soVN(kq.tong.hong)}). Bấm <B>Xử lý chênh lệch</B> để nhập ngay phần đạt
            và lập <B>biên bản giao nhận</B> cho ba bên ký. Phần thiếu và hỏng chưa vào kho, chờ {aiXuLyChenhLech(ct)} xử lý.
        </DongThongBao>
    );

    const bang = (
        <section className="flex min-w-0 flex-1 flex-col">
            <form onSubmit={quet} className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
                <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Quét mã vạch hoặc gõ SKU</span>
                    <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                    <input
                        ref={oQuetRef}
                        value={maQuet}
                        onChange={(e) => setMaQuet(e.target.value)}
                        autoFocus
                        autoComplete="off"
                        placeholder="Quét mã vạch sản phẩm — mỗi lần quét cộng 1 vào cột Đạt (gõ SKU rồi Enter)"
                        className={cn(O_NHAP, "pl-8")}
                    />
                </label>
                <span className="text-[13px] tabular-nums text-bo-muted">
                    Đã đếm {soVN(kq.tong.dat + kq.tong.hong)}/{soVN(kq.tong.gui)}
                </span>
            </form>
            <p className="px-4 pb-2 text-xs leading-4 text-bo-muted sm:px-6">
                <B>Gửi</B>: số {khoXuat} xuất · <B>Đạt</B>: số đếm được, bán được · <B>Hỏng</B>: tới nơi nhưng không bán được · <B>Thiếu</B> = Gửi − Đạt − Hỏng
            </p>
            <div className={KHUNG_CUON}>
                <table className={cn(BANG, "min-w-[880px]")}>
                    <thead>
                        <tr className={DONG_TIEU_DE}>
                            <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                            <th scope="col" className={O_TIEU_DE}>Lô</th>
                            <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Gửi</th>
                            <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Đạt</th>
                            <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Hỏng</th>
                            <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Thiếu</th>
                            <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "min-w-[220px]")}>Lý do lệch</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kq.dong.map((d) => (
                            <DongDem
                                key={d.khoa}
                                d={d}
                                loiLyDo={daKiemLyDo && d.thieuLyDo}
                                onDoiSo={doiSo}
                                onDoiLyDo={doiLyDo}
                            />
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-bo-border font-semibold tabular-nums text-bo-foreground">
                            <td className={cn(O, O_DAU)}>Tổng</td>
                            <td className={O} />
                            <td className={cn(O, "text-right")}>{soVN(kq.tong.gui)}</td>
                            <td className={cn(O, "text-right")}>{soVN(kq.tong.dat)}</td>
                            <td className={cn(O, "text-right")}>{soVN(kq.tong.hong)}</td>
                            <td className={cn(O, "text-right")}>{soVN(kq.tong.thieu)}</td>
                            <td className={cn(O, O_CUOI)} />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu dau={dau} thongBao={thongBao} chinh={bang} />

            {hop === "du" ? (
                <HopXacNhanChungTu
                    mo
                    onDoiMo={(m) => !m && (setHop(null), setLoiHop(null))}
                    tieuDe="Xác nhận nhận đủ"
                    moTa={`${khoNhap} nhận đủ ${soVN(kq.tong.gui)}/${soVN(kq.tong.gui)} sản phẩm, hàng nguyên vẹn. Hệ thống phát hành phiếu nhập, ghi tăng tồn ${khoNhap}, đưa hàng đang chuyển của phiếu về 0 và hoàn tất phiếu.`}
                    nhanXacNhan="Xác nhận nhận đủ"
                    iconXacNhan={ClipboardCheck}
                    dangChay={dangChay}
                    loi={loiHop}
                    tieuDiemQuayLai
                    traTieuDiemVe={oQuetRef}
                    onXacNhan={() => chay(() => phieuChuyenKhoService.nhanDu(id), (res) => `Đã nhận đủ. Phiếu nhập ${res?.soPhieuNhap ?? ""} đã ghi tăng tồn ${khoNhap}; phiếu hoàn tất.`)}
                />
            ) : null}
            {hop === "bienBan" ? (
                <HopBienBan
                    ct={ct}
                    khoNhap={khoNhap}
                    kq={kq}
                    anhChon={anhChon}
                    tienDoAnh={tienDoAnh}
                    onBoQuaAnh={() => boQuaAnhRef.current?.abort()}
                    dangChay={dangChay}
                    loi={loiHop}
                    onDong={() => {
                        setHop(null);
                        setLoiHop(null);
                    }}
                    onXacNhan={(thongTin) => chay(
                        () => phieuChuyenKhoService.nhanLech(id, yeuCauNhanLech(kq, thongTin)),
                        (res) => `Đã nhận phần đạt và lập biên bản ${res?.soBienBan ?? ""}. Phần lệch chờ ${aiXuLyChenhLech(ct)} xử lý.`,
                        taiAnhBienBan,
                    )}
                />
            ) : null}
        </PageContainer>
    );
}

function DongDem({ d, loiLyDo, onDoiSo, onDoiLyDo }) {
    const idLy = useId();
    return (
        <tr className={DONG}>
            <td className={cn(O, O_DAU)}>
                <div className="flex min-w-0 items-center gap-3">
                    <AnhBienThe src={d.anh} bienThe={d} co="sm" />
                    <div className="min-w-0">
                        <div className="truncate font-medium text-bo-foreground" title={d.tenSanPham}>{d.tenSanPham}</div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-bo-muted">
                            <MauKichCo dong={d} />
                            <span className="font-mono">{d.sku}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td className={cn(O, "whitespace-nowrap font-mono text-xs")}>
                {d.maLo} × {soVN(d.gui)}
            </td>
            <td className={cn(O, "text-right")}>{soVN(d.gui)}</td>
            <td className={cn(O, "text-right")}>
                <input
                    value={d.dat}
                    inputMode="numeric"
                    aria-label={`Đạt ${d.sku} lô ${d.maLo}`}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => onDoiSo(d, "dat", e.target.value)}
                    className={cn(O_SO, d.vuot && O_SO_LOI)}
                />
            </td>
            <td className={cn(O, "text-right")}>
                <input
                    value={d.hong}
                    inputMode="numeric"
                    aria-label={`Hỏng ${d.sku} lô ${d.maLo}`}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => onDoiSo(d, "hong", e.target.value)}
                    className={cn(O_SO, d.vuot && O_SO_LOI)}
                />
            </td>
            <td className={cn(O, "text-right")}>
                {d.vuot ? (
                    <span className="rounded-md bg-bo-danger-soft px-2 py-0.5 text-xs font-medium text-bo-danger-strong">Vượt số gửi</span>
                ) : !d.lech ? (
                    <span className="rounded-md bg-bo-tt-xong px-2 py-0.5 text-xs font-medium text-bo-tt-xong-chu">Khớp</span>
                ) : d.thieu === 0 ? (
                    <span className="rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-medium text-bo-tt-chu-y-chu">Hỏng {soVN(d.hong)}</span>
                ) : (
                    <span className="rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-semibold tabular-nums text-bo-tt-chu-y-chu">{soVN(d.thieu)}</span>
                )}
            </td>
            <td className={cn(O, O_CUOI)}>
                {d.lech ? (
                    <>
                        <input
                            value={d.lyDo}
                            maxLength={255}
                            aria-label={`Lý do lệch ${d.sku} lô ${d.maLo}`}
                            aria-invalid={loiLyDo || undefined}
                            aria-describedby={loiLyDo ? idLy : undefined}
                            placeholder="Ví dụ: thiếu 1 cái, 1 cái rách đường may"
                            onChange={(e) => onDoiLyDo(d, e.target.value)}
                            className={cn(O_NHAP, "h-8", loiLyDo && O_SO_LOI)}
                        />
                        {loiLyDo ? <span id={idLy} className="mt-1 block text-xs text-bo-danger">Nhập lý do giải trình</span> : null}
                    </>
                ) : (
                    <span className="text-bo-muted">—</span>
                )}
            </td>
        </tr>
    );
}

/**
 * Lập biên bản giao nhận (A4): người giao, thời điểm, bảng dòng lệch, kết luận, ảnh chụp (không bắt buộc, tải sau khi
 * biên bản đã lập; đang tải thì có nút "Bỏ qua, tải ảnh sau" → `onBoQuaAnh`).
 */
function HopBienBan({ ct, khoNhap, kq, anhChon, tienDoAnh, dangChay, loi, onDong, onXacNhan, onBoQuaAnh }) {
    const [nguoi, setNguoi] = useState(ct.nguoiVanChuyen ?? "");
    const [thoiDiem, setThoiDiem] = useState(() => giaTriONgayGio(new Date()));
    const [ketLuan, setKetLuan] = useState(`Hai bên xác nhận thiếu ${kq.tong.thieu}, hỏng ${kq.tong.hong} như bảng trên. Phần lệch chờ ${aiXuLyChenhLech(ct)} xử lý.`);
    const [daBam, setDaBam] = useState(false);
    const idNguoi = useId();
    const idThoiDiem = useId();
    const idKetLuan = useId();
    const loiNguoi = daBam && !nguoi.trim();
    const loiThoiDiem = daBam && !thoiDiem;
    const dongLech = kq.dong.filter((d) => d.lech);
    return (
        <HopXacNhanChungTu
            mo
            onDoiMo={(m) => !m && onDong()}
            tieuDe="Lập biên bản giao nhận"
            moTa={`${khoNhap} nhận ${soVN(kq.tong.dat)}/${soVN(kq.tong.gui)} sản phẩm đạt. Hệ thống phát hành phiếu nhập cho phần đạt và biên bản cho phần lệch; số biên bản do hệ thống cấp.`}
            nhanXacNhan="Lập biên bản và nhận hàng"
            iconXacNhan={FileWarning}
            rong
            dangChay={dangChay}
            khoaXacNhan={anhChon.dangXuLy}
            lyDoKhoa="Đang xử lý ảnh"
            loi={loi}
            onXacNhan={() => {
                setDaBam(true);
                if (!nguoi.trim() || !thoiDiem) return;
                onXacNhan({ nguoiVanChuyen: nguoi, thoiDiem, ketLuan });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <label htmlFor={idNguoi} className={NHAN_O}>Người giao <span className="text-bo-danger">*</span></label>
                    <input id={idNguoi} value={nguoi} maxLength={100} onChange={(e) => setNguoi(e.target.value)} aria-invalid={loiNguoi || undefined} aria-describedby={loiNguoi ? `${idNguoi}-loi` : undefined} className={cn(O_NHAP, loiNguoi && O_SO_LOI)} />
                    {loiNguoi ? <span id={`${idNguoi}-loi`} className="text-xs text-bo-danger">Nhập tên người giao</span> : null}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor={idThoiDiem} className={NHAN_O}>Thời điểm <span className="text-bo-danger">*</span></label>
                    <input id={idThoiDiem} type="datetime-local" value={thoiDiem} onChange={(e) => setThoiDiem(e.target.value)} aria-invalid={loiThoiDiem || undefined} aria-describedby={loiThoiDiem ? `${idThoiDiem}-loi` : undefined} className={cn(O_NHAP, loiThoiDiem && O_SO_LOI)} />
                    {loiThoiDiem ? <span id={`${idThoiDiem}-loi`} className="text-xs text-bo-danger">Chọn thời điểm giao nhận</span> : null}
                </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-bo-border">
                <table className="w-full min-w-[520px] text-[13px]">
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
                            <tr key={khoaLo(d)}>
                                <td className="px-3 py-2">{d.tenSanPham}<span className="block font-mono text-xs text-bo-muted">{d.sku}</span></td>
                                <td className="px-3 py-2 font-mono text-xs">{d.maLo}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.gui)}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.dat)}</td>
                                <td className="px-3 py-2 text-right">{soVN(d.hong)}</td>
                                <td className="px-3 py-2 text-right">{soVN(Math.max(0, d.thieu))}</td>
                                <td className="px-3 py-2">{d.lyDo}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="grid gap-1.5">
                <label htmlFor={idKetLuan} className={NHAN_O}>Kết luận</label>
                <textarea id={idKetLuan} value={ketLuan} maxLength={500} onChange={(e) => setKetLuan(e.target.value)} className={O_NHAP_NHIEU_DONG} />
            </div>
            <ChonAnhBienBan anh={anhChon} khoa={dangChay} />
            {/* Vùng đọc tiến độ luôn có sẵn (chỉ thay chữ) để trình đọc màn hình đọc được ngay lần đầu */}
            <div className={tienDoAnh ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5" : "sr-only"}>
                <p aria-live="polite" className="m-0 text-[13px] tabular-nums text-bo-muted">
                    {tienDoAnh ? `Đã lập biên bản, đang tải ảnh ${tienDoAnh.xong}/${tienDoAnh.tong}…` : ""}
                </p>
                {tienDoAnh ? (
                    <button
                        type="button"
                        onClick={onBoQuaAnh}
                        className="inline-flex h-8 items-center rounded-md border border-bo-border bg-bo-surface px-2.5 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                    >
                        Bỏ qua, tải ảnh sau
                    </button>
                ) : null}
            </div>
            <p className={GHI_CHU_HOP}>In biên bản để 3 bên ký xác nhận tại chỗ: <B>Kho nhận – Người vận chuyển – Kho gửi</B>.</p>
        </HopXacNhanChungTu>
    );
}
