import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import DauTrangDonMua from "@/components/order/chi-tiet-don-mua/DauTrangDonMua";
import TienTrinhDonMua from "@/components/order/chi-tiet-don-mua/TienTrinhDonMua";
import BangDotNhan from "@/components/order/chi-tiet-don-mua/BangDotNhan";
import ThuocTinhDonMua from "@/components/order/chi-tiet-don-mua/ThuocTinhDonMua";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { GHI_CHU_HOP, GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import {
    CAU_HET_THOI_HAN,
    LY_DO_CHO_GOC,
    MO_TA_HET_THOI_HAN,
    chayCoThoiHan,
    khiGocKetThuc,
    laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import { locCauMayChuMuaHang } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import {
    LY_DO_KET_THUC_TOI_DA,
    TRANG_THAI_DON_MUA,
    daKetThucSom,
    dungBangDotNhan,
    thaoTacKetThuc,
    tinhBuocDonMua,
    tinhTienDoNhan,
    trangThaiGiao,
} from "@/components/order/chi-tiet-don-mua/tinhNhanHang";
import { dongDonKemPhanGiu, phieuNenMo, tinhPhanGiu } from "@/components/nhap-kho/phanGiuPhieuNhap";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import purchaseOrderService from "@/services/purchaseOrderService";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import useQuayLai from "@/hooks/useQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Ai được tạo phiếu nhập kho từ đơn mua (giữ như trước): quản trị viên, quản lý kho, nhân viên kho.
// Cũng là các vai trò backend cho xem phiếu nhập kho (PhieuNhapKhoController: filter, detail).
const VAI_TRO_TAO_PHIEU_NHAP = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO];
// Ai xem được số đơn mua của nhà cung cấp (vai trò xem mọi kho, quản lý nhà cung cấp).
const VAI_TRO_XEM_SO_DON_NCC = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
// Trạng thái đơn được tạo phiếu nhập — đúng như backend PhieuNhapKhoService.createDraft đang nhận:
// 3 Đang vận chuyển, 5 Đã nhận đủ (dữ liệu cũ, trước gọi "Đã thanh toán"). Đơn đã đóng / đã hủy (6, 7) thì không.
const TRANG_THAI_TAO_PHIEU_NHAP = [TRANG_THAI_DON_MUA.DANG_VAN_CHUYEN, TRANG_THAI_DON_MUA.DA_NHAN_DU];
// Đơn đã chốt (đếm "n đơn mua" của nhà cung cấp): như tab Tất cả của trang Đơn mua hàng
const TRANG_THAI_DON_DA_CHOT = [...TRANG_THAI_TAO_PHIEU_NHAP, TRANG_THAI_DON_MUA.DA_DONG, TRANG_THAI_DON_MUA.DA_HUY];
// Ai đóng / hủy được đơn đã chốt (khớp DonMuaHangController dong-don, huy-don): quản trị viên, nhân viên mua hàng
const VAI_TRO_KET_THUC_DON = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
// Máy chủ từ chối vì đơn đã đổi ở nơi khác (vừa nhận hàng, đã đóng / hủy, còn phiếu nhập chưa nhập kho), không còn quyền
// hoặc không còn đơn: đóng hộp, báo câu máy chủ, tải lại; lỗi khác (lý do sai, mạng) giữ hộp để sửa hoặc bấm lại
const LOI_DA_DOI_NOI_KHAC = [403, 404, 409];

/**
 * Chi tiết đơn mua hàng · bản "một khối" (chốt 16/10/2026): đầu khối, tiến trình 6 bước,
 * bảng sản phẩm theo từng đợt nhận (mỗi phiếu nhập kho là một cột) và cột thông tin bên phải.
 * Bỏ phần thanh toán cho nhà cung cấp: kế toán thanh toán ngoài hệ thống.
 * Đơn đang vận chuyển kết thúc sớm ở menu ⋯ (quản trị viên, nhân viên mua hàng): "Đóng đơn (nhận thiếu)" khi đã nhận
 * ít nhất một đợt, "Hủy đơn" khi chưa nhận gì — hộp xác nhận bắt buộc lý do; đơn đã đóng / hủy hiện lý do dưới tiến trình.
 */
export default function PurchaseOrderDetail() {
    const navigate = useNavigate();
    const { id } = useParams();

    // ── Đơn mua hàng ────────────────────────────────────────────────────────
    const taiDon = useCallback(async () => {
        const res = await purchaseOrderService.getById(id);
        return res?.data ?? null;
    }, [id]);
    const donQ = useTaiDuLieu(taiDon, `don-mua-${id}`, { enabled: Boolean(id) });
    const don = donQ.data && String(donQ.data.id) === String(id) ? donQ.data : null;

    // ── Các phiếu nhập kho của đơn (không chặn trang khi lỗi) ───────────────
    // NV mua hàng xem được đơn nhưng không được gọi API phiếu nhập (backend trả 403): không gọi, bảng chỉ có số của đơn.
    const xemDotNhan = hasAnyRole(VAI_TRO_TAO_PHIEU_NHAP);
    const taiDot = useCallback(() => phieuNhapKhoService.layTheoDonMua(id), [id]);
    const dotQ = useTaiDuLieu(taiDot, `dot-nhan-${id}`, { enabled: Boolean(id) && xemDotNhan });

    // ── Đóng / hủy đơn (hộp nhập lý do) ────────────────────────────────────
    const [hop, setHop] = useState(""); // "" | "dong" | "huy"
    const [lyDo, setLyDo] = useState("");
    const [dangChay, setDangChay] = useState(false);
    const [loiHop, setLoiHop] = useState(null); // câu lỗi hiện trong hộp (lỗi mạng, lý do sai)
    // Hết thời hạn mà máy chủ có thể vẫn đang làm: khóa mục đóng / hủy tới khi lời gọi gốc kết thúc (khiGocKetThuc)
    const [choGoc, setChoGoc] = useState(false);
    const huyChoGocRef = useRef(null);
    // Màn đã gỡ (rời trang trong lúc chờ): nhánh hết thời hạn bỏ qua báo lỗi, khóa, tải lại; gỡ thì hủy chờ
    const daGoRef = useRef(false);
    useEffect(() => {
        daGoRef.current = false;
        return () => {
            daGoRef.current = true;
            huyChoGocRef.current?.();
        };
    }, []);

    // Quay lại tab thì tải lại ngầm đơn + các đợt nhận (kho có thể vừa nhận hàng / nhập kho); không tải khi đang thao tác
    useTaiLaiKhiQuayLai(
        () => {
            donQ.reload();
            if (xemDotNhan) dotQ.reload();
        },
        { bat: Boolean(id) && !donQ.loading && !dangChay, lanCuoi: donQ.capNhatLuc },
    );

    // ── Số đơn mua của nhà cung cấp (chỉ vai trò xem mọi kho) ───────────────
    const nccId = don?.nhaCungCap?.id;
    const xemSoDonNcc = hasAnyRole(VAI_TRO_XEM_SO_DON_NCC);
    const taiSoDonNcc = useCallback(async () => {
        const res = await purchaseOrderService.filter({
            page: 0,
            size: 1,
            filters: [
                { fieldName: "nhaCungCap.id", operation: "EQUALS", value: nccId },
                { fieldName: "trangThai", operation: "IN", value: TRANG_THAI_DON_DA_CHOT },
            ],
            sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
        });
        return res?.data?.totalElements ?? null;
    }, [nccId]);
    const soDonQ = useTaiDuLieu(taiSoDonNcc, `so-don-ncc-${nccId}`, { enabled: Boolean(nccId) && xemSoDonNcc });

    // ── Tính toán ───────────────────────────────────────────────────────────
    const phieus = dotQ.data;
    const tienDo = useMemo(() => tinhTienDoNhan(don?.chiTietDonMuaHangs), [don]);
    const bang = useMemo(() => dungBangDotNhan(don?.chiTietDonMuaHangs, phieus), [don, phieus]);
    const buoc = useMemo(() => tinhBuocDonMua(don, tienDo, bang.cot), [don, tienDo, bang.cot]);
    // Phần các phiếu nhập Nháp đang giữ và số còn tạo phiếu được (máy chủ trừ phần giữ khi tạo phiếu mới). Chỉ lấy phiếu
    // của đúng đơn này: đổi sang đơn khác trong cùng trang thì danh sách phiếu cũ còn giữ tới khi tải xong.
    const phanGiu = useMemo(
        () => tinhPhanGiu((Array.isArray(phieus) ? phieus : []).filter((p) => don && String(p?.donMuaHangId) === String(don.id))),
        [phieus, don],
    );
    const dongGiu = useMemo(() => dongDonKemPhanGiu(don?.chiTietDonMuaHangs, phanGiu.theoBienThe), [don, phanGiu]);
    const conTaoDuoc = dongGiu.reduce((tong, d) => tong + d.conLai, 0);
    // Đơn đã đóng / đã hủy không còn chờ hàng: hạn giao không còn quá hạn / còn n ngày
    const ketThucSom = daKetThucSom(don?.trangThai);
    const giao = trangThaiGiao(don?.ngayGiaoDuKien, tienDo.daDu || ketThucSom);

    useEffect(() => {
        if (bang.lechSo.length) {
            console.warn("[Chi tiết đơn mua] Tổng các đợt đã nhập khác số đã nhận của đơn:", bang.lechSo);
        }
    }, [bang.lechSo]);

    // ── Nút Tạo phiếu nhập kho ──────────────────────────────────────────────
    const laQuanTriVien = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
    const khoNhanId = don?.khoNhap?.id ?? null;
    const khoLamViecId = getKhoLamViecId();
    const saiKho = !laQuanTriVien && khoNhanId != null && khoLamViecId !== khoNhanId;
    // Phần còn lại đã nằm hết ở phiếu nhập Nháp: nút mở phiếu đó (phiếu tạo trước còn giữ hàng đơn chưa nhận đủ),
    // tạo phiếu mới sẽ bị máy chủ từ chối
    const phieuNhapCanMo = !tienDo.daDu && conTaoDuoc === 0 ? phieuNenMo(phanGiu.phieu, dongGiu) : null;
    const taoPhieu = {
        hien: Boolean(don) && hasAnyRole(VAI_TRO_TAO_PHIEU_NHAP) && TRANG_THAI_TAO_PHIEU_NHAP.includes(Number(don?.trangThai)),
        khoa: tienDo.daDu || saiKho,
        lyDo: tienDo.daDu
            ? "Đã nhập đủ số lượng"
            : saiKho
                ? `Đơn nhập vào ${don?.khoNhap?.tenKho || "kho khác"}, không phải nơi làm việc hiện tại của bạn`
                : "",
        nhan: phieuNhapCanMo ? `Mở phiếu nháp ${phieuNhapCanMo.soPhieuNhap}` : undefined,
        moPhieu: Boolean(phieuNhapCanMo),
    };

    // ── Đóng / hủy đơn ──────────────────────────────────────────────────────
    const ketThuc = {
        ...thaoTacKetThuc(don, tienDo, hasAnyRole(VAI_TRO_KET_THUC_DON)),
        khoa: choGoc,
        lyDoKhoa: LY_DO_CHO_GOC,
    };
    const moHop = (loai) => {
        setLyDo("");
        setLoiHop(null);
        setHop(loai);
    };
    // Đóng hộp: giữ câu lỗi tới hết hiệu ứng đóng (mở hộp lại thì xóa), tránh hộp co giật khi đang mờ dần
    const doiMoHop = (mo) => {
        if (mo) return;
        setHop("");
        setLyDo("");
    };
    // Khóa mục đóng / hủy tới khi lời gọi gốc kết thúc (tối đa THOI_HAN_CHO_GOC_MS) rồi tải lại; màn gỡ thì hủy chờ
    const khoaToiKhiGocXong = (loi) => {
        huyChoGocRef.current?.();
        setChoGoc(true);
        huyChoGocRef.current = khiGocKetThuc(loi, () => {
            huyChoGocRef.current = null;
            setChoGoc(false);
            donQ.reload();
        });
    };
    const ketThucDon = async (loai) => {
        const lyDoGui = lyDo.trim();
        if (!don || !lyDoGui || dangChay) return;
        const ma = don.soDonMua || `#${don.id}`;
        setLoiHop(null);
        setDangChay(true);
        try {
            await chayCoThoiHan(() => (loai === "dong"
                ? purchaseOrderService.dongDon(don.id, lyDoGui)
                : purchaseOrderService.huyDon(don.id, lyDoGui)));
            toast.success(loai === "dong" ? `Đã đóng đơn ${ma}.` : `Đã hủy đơn ${ma}.`);
            setHop("");
            setLyDo("");
            // Ở lại trang: đổi trạng thái tại chỗ (mục menu, nút tạo phiếu ẩn ngay) rồi tải lại ngầm lấy người, lúc thao tác
            donQ.setData((cu) => (cu ? {
                ...cu,
                trangThai: loai === "dong" ? TRANG_THAI_DON_MUA.DA_DONG : TRANG_THAI_DON_MUA.DA_HUY,
                lyDoKetThuc: lyDoGui,
            } : cu));
            donQ.reload();
        } catch (error) {
            if (laLoiHetThoiHan(error)) {
                if (daGoRef.current) return;
                // Máy chủ chưa trả lời sau thời hạn: đóng hộp, báo lỗi, tải lại ngầm; máy chủ có thể vẫn đang ghi nhận
                // nên khóa mục đóng / hủy tới khi lời gọi gốc kết thúc rồi tải lại lần nữa
                setHop("");
                setLyDo("");
                toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
                donQ.reload();
                khoaToiKhiGocXong(error);
                return;
            }
            // Câu dự phòng không có dấu chấm: mất mạng thì getApiErrorMessage nối thêm ": không nhận được phản hồi…"
            const cau = getApiErrorMessage(error, "Không thực hiện được thao tác");
            if (LOI_DA_DOI_NOI_KHAC.includes(getApiErrorStatus(error))) {
                setHop("");
                setLyDo("");
                toast.error(cau);
                donQ.reload();
                if (xemDotNhan) dotQ.reload();
            } else {
                setLoiHop(cau);
            }
        } finally {
            setDangChay(false);
        }
    };

    // Có trang trước trong ứng dụng thì lùi lại; mở thẳng bằng đường dẫn thì về danh sách đơn mua
    const quayLai = useQuayLai("/purchase-orders");

    // ── Đang tải / lỗi / không tìm thấy ────────────────────────────────────
    if (!don && (donQ.loading || (!donQ.error && donQ.data === undefined))) {
        return (
            <PageContainer>
                <SurfaceCard>
                    <LoadingState label="Đang tải dữ liệu đơn hàng" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    if (!don) {
        // Cùng khung lỗi với trang Báo giá: không có đơn (404 / 400 "Không tìm thấy…") → "Không tìm thấy"; 403 (kho nhập
        // ngoài phạm vi của quản lý kho / nhân viên kho) → "Bạn không có quyền xem", không có nút Thử lại
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={donQ.error}
                    tenChungTu="đơn mua hàng"
                    locCauMayChu={locCauMayChuMuaHang}
                    onVeDanhSach={() => navigate("/purchase-orders")}
                    onThuLai={donQ.reload}
                />
            </PageContainer>
        );
    }

    const ma = don.soDonMua || `#${don.id}`;
    const laDaDong = Number(don.trangThai) === TRANG_THAI_DON_MUA.DA_DONG;
    // Người và lúc đóng / hủy (máy chủ lấy từ lịch sử thao tác); đơn đổi trạng thái ngoài ứng dụng thì không có
    const phuKetThuc = [don.nguoiKetThuc, don.ngayKetThuc ? formatDateTime(don.ngayKetThuc) : null].filter(Boolean).join(" · ");
    const oLyDo = (idO, viDu) => (
        <div className="grid gap-1.5">
            <label htmlFor={idO} className={NHAN_O}>
                Lý do <span className="text-bo-danger">*</span>
            </label>
            <textarea
                id={idO}
                value={lyDo}
                onChange={(suKien) => {
                    setLyDo(suKien.target.value.slice(0, LY_DO_KET_THUC_TOI_DA));
                    if (loiHop) setLoiHop(null);
                }}
                placeholder={viDu}
                rows={3}
                maxLength={LY_DO_KET_THUC_TOI_DA}
                aria-describedby={`${idO}-goi-y`}
                aria-required="true"
                disabled={dangChay}
                className={O_NHAP_NHIEU_DONG}
            />
            <p id={`${idO}-goi-y`} className={GOI_Y_O}>
                <span>Bắt buộc</span>
                <span>{lyDo.length}/{LY_DO_KET_THUC_TOI_DA}</span>
            </p>
        </div>
    );

    return (
        <PageContainer className="flex min-h-full flex-col">
            <article className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                <DauTrangDonMua
                    don={don}
                    taoPhieu={taoPhieu}
                    ketThuc={ketThuc}
                    onQuayLai={quayLai}
                    onIn={() => navigate(`/purchase-orders/${don.id}/print`)}
                    onTaoPhieu={() => navigate(phieuNhapCanMo ? `/goods-receipts/${phieuNhapCanMo.id}` : `/goods-receipts/create?poId=${don.id}`)}
                    onMoYeuCau={() => navigate(`/purchase-requests/${don.yeuCauMuaHang?.id}`)}
                    onKetThuc={moHop}
                />
                <TienTrinhDonMua buoc={buoc} />
                {ketThucSom ? (
                    <div className="border-t border-bo-border px-4 py-3 sm:px-6 sm:py-4">
                        <DongThongBao>
                            <b className="font-semibold">{laDaDong ? "Lý do đóng đơn:" : "Lý do hủy đơn:"}</b>{" "}
                            <span className="whitespace-pre-wrap break-words">{don.lyDoKetThuc || "—"}</span>
                            <span className="block text-bo-muted">
                                {[phuKetThuc, laDaDong ? "Phần còn thiếu không còn tính là hàng đang về" : "Hàng của đơn không còn tính là hàng đang về"]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                        </DongThongBao>
                    </div>
                ) : null}
                <div className="grid flex-1 border-t border-bo-border xl:grid-cols-[minmax(0,1fr)_340px]">
                    <BangDotNhan
                        bang={bang}
                        tongTien={don.tongTien}
                        xemDot={xemDotNhan}
                        // Tự tải lại ngầm: giữ các đợt nhận đang hiện, không bật chữ đang tải / dòng báo lỗi
                        dangTaiDot={dotQ.initialLoading}
                        loiDot={dotQ.error && !dotQ.loiTaiLai ? getApiErrorMessage(dotQ.error, "") : null}
                        onThuLai={dotQ.reload}
                    />
                    <ThuocTinhDonMua
                        don={don}
                        giao={giao}
                        soDonCuaNcc={xemSoDonNcc && !soDonQ.error ? soDonQ.data ?? null : null}
                    />
                </div>
            </article>

            <HopXacNhanChungTu
                mo={hop === "dong"}
                onDoiMo={doiMoHop}
                tieuDe="Đóng đơn (nhận thiếu)"
                moTa={`${ma} đã nhận ${tienDo.daNhan}/${tienDo.dat}. Đóng đơn thì ${tienDo.conThieu} còn thiếu không còn tính là hàng đang về và không tạo phiếu nhập được nữa. Không hoàn tác được.`}
                nhanXacNhan="Đóng đơn"
                kieu="nguyHiem"
                dangChay={dangChay}
                khoaXacNhan={!lyDo.trim()}
                lyDoKhoa="Nhập lý do đóng đơn"
                loi={loiHop}
                onXacNhan={() => ketThucDon("dong")}
            >
                {oLyDo("ly-do-dong-don", "Ví dụ: Nhà cung cấp hết hàng, không giao phần còn lại")}
                <p className={GHI_CHU_HOP}>Hệ thống không gửi email cho nhà cung cấp. Báo nhà cung cấp theo cách thường dùng.</p>
            </HopXacNhanChungTu>
            <HopXacNhanChungTu
                mo={hop === "huy"}
                onDoiMo={doiMoHop}
                tieuDe="Hủy đơn mua hàng"
                moTa={`${ma} chưa nhận đợt hàng nào. Hủy đơn thì hàng của đơn không còn tính là hàng đang về và không tạo phiếu nhập được nữa. Không hoàn tác được.`}
                nhanXacNhan="Hủy đơn"
                kieu="nguyHiem"
                dangChay={dangChay}
                khoaXacNhan={!lyDo.trim()}
                lyDoKhoa="Nhập lý do hủy đơn"
                loi={loiHop}
                onXacNhan={() => ketThucDon("huy")}
            >
                {oLyDo("ly-do-huy-don", "Ví dụ: Nhà cung cấp báo ngừng sản xuất mẫu này")}
                <p className={GHI_CHU_HOP}>Hệ thống không gửi email cho nhà cung cấp. Báo nhà cung cấp theo cách thường dùng.</p>
            </HopXacNhanChungTu>
        </PageContainer>
    );
}
