import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, Ban, Check, RotateCcw, Send, Truck } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getMineKhoList } from "@/services/khoService";
import apiClient from "@/services/apiClient";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import CotThuocTinh, { BangThuocTinh, ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import TuyenChuyen from "@/components/chung-tu/TuyenChuyen";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import BangHangChuyen from "@/components/chuyen-kho/BangHangChuyen";
import {
    TT_CHUYEN,
    TT_PHIEU_XUAT,
    boLocHangChuyen,
    canTaiLaiChungTu,
    daDuyetXuat,
    daXuatHang,
    dongChuyenKho,
    laPhieuNhapHoanTra,
    soDaLayTheoBienThe,
    timPhieuNhap,
    timPhieuXuatCon,
    tinhBuocChuyenKho,
    tinhNut,
    tinhQuyen,
    tinhThongBao,
} from "@/components/chuyen-kho/tinhChuyenKho";
import { getPhieuChuyenKhoStatus } from "@/constants/phieuChuyenKho";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import useQuayLai from "@/hooks/useQuayLai";
import { getApiErrorMessage } from "@/utils/apiError";
import { getCurrentUserId, getStoredRoles } from "@/utils/roles";

const KHONG_CO_PHIEU_NHAP = Object.freeze({ tatCa: [], hieuLuc: null });
const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;
// Mã chứng từ trong câu thông báo: bấm để mở (đặt trong câu cho gọn trên điện thoại)
const LienKetPhieu = ({ to, children }) => (
    <Link to={to} className="rounded font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30">
        {children}
    </Link>
);

/**
 * Chi tiết phiếu chuyển kho nội bộ · bản "một khối" (chốt 21/10/2026, artboard ChuyenKho): đầu khối với mã phiếu,
 * tiến trình 4 bước ghi rõ kho nguồn / kho đích làm bước nào, dòng thông báo khi phiếu hủy dở, bảng hàng gom theo sản
 * phẩm (cột "Đã lấy" khi đang chọn lô), cột phải: tuyến chuyển, người duyệt, ghi chú, phiếu xuất / phiếu nhập liên quan.
 * API giữ như màn cũ; thêm GET phiếu xuất con khi đang chọn lô để có số đã lấy (xem tinhChuyenKho.js).
 * Đổi phiếu trên cùng đường dẫn (lùi / tiến lịch sử) thì dựng lại màn từ đầu (`key`): không giữ từ khóa, bộ lọc,
 * hộp đang mở hay chứng từ liên quan của phiếu trước.
 */
export default function PhieuChuyenKhoDetail() {
    const { id } = useParams();
    return <ManPhieuChuyenKho key={id} id={id} />;
}

function ManPhieuChuyenKho({ id }) {
    const navigate = useNavigate();
    const quayLai = useQuayLai("/transfer-tickets");

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    // null: không lỗi; { loi }: lần tải gần nhất không có phiếu (loi = lỗi axios, hoặc null khi máy chủ trả rỗng)
    const [loadError, setLoadError] = useState(null);
    // Mốc tải được phiếu gần nhất: vừa tải (sau thao tác) thì quay lại tab chưa tải lại ngay
    const [capNhatLuc, setCapNhatLuc] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    // Hộp thoại đang mở: "guiDuyet" | "pheDuyet" | "huy" | null
    const [hop, setHop] = useState(null);
    const [myWarehouseIds, setMyWarehouseIds] = useState([]);
    // Vai trò lấy từ máy chủ như màn cũ; trước khi có thì dùng vai trò lưu lúc đăng nhập (không nháy nút Hủy)
    const [userRoles, setUserRoles] = useState(getStoredRoles);
    const [relatedIssue, setRelatedIssue] = useState(null);
    const [receipts, setReceipts] = useState(KHONG_CO_PHIEU_NHAP);

    // Chỉ nhận kết quả của lần tải mới nhất: lần tải ngầm về chậm không đè dữ liệu tải sau một thao tác
    const requestIdRef = useRef(0);
    // silent: tải lại ngầm (quay lại tab, sau thao tác) — giữ màn đang xem, chỉ thay khi tải được dữ liệu mới; lỗi thì
    // im lặng giữ dữ liệu (như useTaiDuLieu). baoLoi: tải ngầm ngay sau thao tác thì báo lỗi bằng thông báo nhanh.
    // Trả về phiếu vừa tải (không có khi lỗi).
    const fetchDetail = useCallback(async ({ silent = false, baoLoi = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const res = await phieuChuyenKhoService.getDetail(id);
            if (requestId !== requestIdRef.current) return;
            const payload = res?.data || res;
            if (payload?.id != null) {
                setData(payload);
                setLoadError(null);
                setCapNhatLuc(new Date());
                return payload;
            }
            if (!silent) {
                // Máy chủ trả về rỗng: coi như không có phiếu này
                setData(null);
                setLoadError({ loi: null });
            }
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            if (silent) {
                if (baoLoi) toast.error(getApiErrorMessage(e, "Không tải lại được phiếu chuyển kho"));
                return;
            }
            setData(null);
            // Máy chủ trả 400 "Không tìm thấy phiếu chuyển kho id: …" cho mã không tồn tại: KhungLoiChungTu tự phân loại
            setLoadError({ loi: e });
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [id]);

    const fetchMyWarehouses = useCallback(async () => {
        try {
            const listKho = await getMineKhoList();
            setMyWarehouseIds(listKho.map((kho) => kho.id));
        } catch (error) {
            console.error("Lỗi khi tải danh sách kho phân quyền:", error);
        }
    }, []);

    const fetchUserInfo = useCallback(async () => {
        try {
            const userId = getCurrentUserId();
            if (!userId) return;
            const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${userId}`);
            const userData = userResponse.data?.data;
            if (userData && userData.vaiTro) {
                setUserRoles(userData.vaiTro.includes(" ") ? userData.vaiTro.split(" ") : [userData.vaiTro]);
            }
        } catch (error) {
            console.error("Lỗi khi lấy thông tin người dùng:", error);
        }
    }, []);

    // Phiếu xuất con / phiếu nhập của phiếu chuyển, so khớp ở tinhChuyenKho.js. Không còn trong danh sách (vd. phiếu xuất
    // vừa bị hủy) thì bỏ khỏi màn. Phiếu xuất: API lọc không nhận điều kiện phiếu gốc nên vẫn lấy danh sách mới nhất như màn
    // cũ. Phiếu nhập: lọc đúng phiếu gốc ở máy chủ, vì danh sách không sắp xếp, lấy 2000 phiếu đầu sẽ sót phiếu mới.
    const fetchRelatedDocs = useCallback(({ phieuXuat = true, phieuNhap = true } = {}) => {
        if (!id) return;
        if (phieuXuat) {
            phieuXuatKhoService.filter({ page: 0, size: 2000 }).then((res) => {
                const issues = res.content || res.data?.content || [];
                setRelatedIssue(timPhieuXuatCon(issues, id));
            }).catch(() => {});
        }
        if (phieuNhap) {
            phieuNhapKhoService.filter({
                page: 0,
                size: 100,
                filters: [{ fieldName: "phieuChuyenKhoGoc.id", operation: "EQUALS", value: Number(id) }],
            }).then((res) => {
                const list = res.content || res.data?.content || [];
                setReceipts(timPhieuNhap(list, id));
            }).catch(() => {});
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => {
            fetchDetail();
            fetchMyWarehouses();
            fetchRelatedDocs();
        });
    }, [fetchDetail, fetchMyWarehouses, fetchRelatedDocs]);

    useEffect(() => {
        queueMicrotask(() => fetchUserInfo());
    }, [fetchUserInfo]);

    // Phiếu xuất con đang chọn lô: số đã lấy của từng biến thể đọc từ chính phiếu xuất đó
    // (items[].soLuongDaPick của GET /phieu-chuyen-kho luôn 0: backend cộng lô theo id phiếu chuyển, còn lô chọn trên phiếu xuất con)
    const dangChonLo = relatedIssue?.trangThai === TT_PHIEU_XUAT.NHAP;
    const idPhieuXuatCon = relatedIssue?.id ?? null;
    const taiDongXuat = useCallback(async () => {
        const res = await phieuXuatKhoService.getDetail(idPhieuXuatCon);
        return soDaLayTheoBienThe((res?.data || res)?.chiTiet);
    }, [idPhieuXuatCon]);
    const dongXuatQ = useTaiDuLieu(taiDongXuat, `phieu-xuat-con-${idPhieuXuatCon}`, { enabled: dangChonLo });

    // Quay lại tab thì tải lại ngầm phiếu (kho nguồn / kho đích là hai người khác nhau). Hai danh sách chứng từ liên quan
    // lớn nên chỉ tải lại khi phiếu xuất / phiếu nhập có thể vừa đổi (canTaiLaiChungTu).
    useTaiLaiKhiQuayLai(async () => {
        const phieu = (await fetchDetail({ silent: true })) ?? data;
        if (!phieu) return;
        const can = canTaiLaiChungTu({ phieu, phieuXuat: relatedIssue, phieuNhap: receipts.hieuLuc, coPhieuNhap: receipts.tatCa.length > 0 });
        if (can.phieuXuat || can.phieuNhap) fetchRelatedDocs(can);
        if (dangChonLo) dongXuatQ.reload();
    }, { bat: Boolean(data) && !loading && !isProcessing, lanCuoi: capNhatLuc });

    // ── Bảng hàng (hook gọi trước mọi lần return sớm) ──────────────────────
    // Có phiếu nhập nào (kể cả đã hủy) là hàng đã xuất: người ở kho đích không thấy phiếu xuất con của kho nguồn
    const coPhieuNhap = receipts.tatCa.length > 0;
    const daXuat = daXuatHang(data, relatedIssue, coPhieuNhap);
    const soDaLay = daXuat ? "theoYeuCau" : dangChonLo && dongXuatQ.data ? dongXuatQ.data : null;
    const cot = daXuat ? "daXuat" : soDaLay ? "daLay" : null;
    const dong = useMemo(() => dongChuyenKho(data?.items, soDaLay), [data?.items, soDaLay]);
    const bang = useBangChungTu(dong, {
        theo: "nhom",
        boLoc: boLocHangChuyen(cot === "daLay"),
        tongTheo: { soLuong: "soLuong", daLay: "daLay" },
    });

    async function chayThaoTac(thaoTac, cauThanhCong, cauLoi) {
        setIsProcessing(true);
        try {
            await thaoTac(id);
            toast.success(cauThanhCong);
            setHop(null);
            fetchDetail({ silent: true, baoLoi: true });
        } catch (e) {
            // Lỗi thì giữ hộp thoại mở, câu của máy chủ hiện nguyên văn
            toast.error(getApiErrorMessage(e, cauLoi));
        } finally {
            setIsProcessing(false);
        }
    }

    // ── Đang tải / không tìm thấy / lỗi tải ─────────────────────────────────
    if (!data) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                {loading || !loadError ? (
                    <KhungDangTai nhan="Đang tải phiếu chuyển kho" />
                ) : (
                    <KhungLoiChungTu
                        loi={loadError.loi}
                        tenChungTu="phiếu chuyển kho"
                        onVeDanhSach={() => navigate("/transfer-tickets")}
                        onThuLai={() => fetchDetail()}
                    />
                )}
            </PageContainer>
        );
    }

    const st = getPhieuChuyenKhoStatus(data.trangThai);
    const khoNguon = data.khoXuatTen || "kho nguồn";
    const khoDich = data.khoNhapTen || "kho đích";
    const phieuNhap = receipts.hieuLuc;
    const quyen = tinhQuyen(userRoles, myWarehouseIds, data);
    const nut = tinhNut({ phieu: data, quyen, phieuXuat: relatedIssue, phieuNhap, coPhieuNhap, rong: bang.rong });
    const thongBao = tinhThongBao({ phieu: data, phieuXuat: relatedIssue, phieuNhap, coPhieuNhap });
    const daLay = cot === "daLay" ? { da: bang.tong.daLay, can: bang.tong.soLuong } : null;
    const buoc = tinhBuocChuyenKho({ phieu: data, phieuXuat: relatedIssue, phieuNhap, coPhieuNhap, daLay });
    const duyet = daDuyetXuat(data, relatedIssue);

    const chuSanPham = `${soVN(bang.tong.soSanPham)} sản phẩm, ${soVN(bang.tong.soDong)} biến thể`;
    const tomTatHang = `${chuSanPham} (tổng số lượng ${soVN(bang.tong.soLuong)})`;

    // Mỗi trạng thái nhiều nhất một nút chính (tinhNut)
    const nutChinh = [];
    if (nut.guiDuyet) {
        nutChinh.push({ ma: "guiDuyet", nhan: "Gửi duyệt", icon: Send, onClick: () => setHop("guiDuyet"), khoa: nut.guiDuyet.khoa, lyDo: nut.guiDuyet.lyDo, hienLyDo: true });
    }
    if (nut.pheDuyet) nutChinh.push({ ma: "pheDuyet", nhan: "Duyệt xuất hàng", icon: Check, onClick: () => setHop("pheDuyet") });
    if (nut.taoPhieuXuat) {
        nutChinh.push({ ma: "taoPhieuXuat", nhan: "Tạo phiếu xuất kho", icon: Truck, onClick: () => navigate(`/goods-issues/create?transferId=${id}`) });
    }
    if (nut.moPhieuXuat) nutChinh.push({ ma: "moPhieuXuat", nhan: "Mở phiếu xuất", kieu: "vien", onClick: () => navigate(`/goods-issues/${nut.moPhieuXuat.id}`) });
    if (nut.nhapKho) {
        nutChinh.push({ ma: "nhapKho", nhan: "Nhập kho", icon: ArrowDownToLine, onClick: () => navigate(`/goods-receipts/create?transferId=${id}`) });
    }
    if (nut.nhapHoanTra) {
        nutChinh.push({
            ma: "nhapHoanTra",
            nhan: "Nhập kho hoàn trả",
            icon: RotateCcw,
            onClick: () => navigate(`/goods-receipts/create?transferId=${id}`),
            khoa: nut.nhapHoanTra.khoa,
            lyDo: nut.nhapHoanTra.lyDo,
        });
    }
    if (nut.moPhieuNhap) nutChinh.push({ ma: "moPhieuNhap", nhan: "Mở phiếu nhập", kieu: "vien", onClick: () => navigate(`/goods-receipts/${nut.moPhieuNhap.id}`) });

    const dongThongBao = [
        thongBao.dangDuong ? (
            <DongThongBao key="dangDuong" tone="warn">
                Phiếu đã hủy khi hàng đang trên đường. <B>{khoNguon}</B> cần lập phiếu nhập hoàn trả để đưa hàng về kho.
            </DongThongBao>
        ) : null,
        thongBao.phieuXuatNhap ? (
            <DongThongBao key="phieuXuatNhap" tone="warn">
                Phiếu xuất <LienKetPhieu to={`/goods-issues/${thongBao.phieuXuatNhap.id}`}>{thongBao.phieuXuatNhap.soPhieuXuat}</LienKetPhieu>{" "}
                {daLay && daLay.da > 0
                    ? `vẫn ở Nháp và đang giữ ${soVN(daLay.da)} sản phẩm đã chọn lô tại ${khoNguon}. Hủy phiếu xuất đó để trả hàng về tồn.`
                    : "vẫn ở Nháp và vẫn xuất được. Hủy phiếu xuất đó để không xuất hàng cho phiếu đã hủy."}
            </DongThongBao>
        ) : null,
        thongBao.phieuNhapCho ? (
            <DongThongBao key="phieuNhapCho" tone="warn">
                Phiếu nhập <LienKetPhieu to={`/goods-receipts/${thongBao.phieuNhapCho.id}`}>{thongBao.phieuNhapCho.soPhieuNhap}</LienKetPhieu> tại {khoDich} vẫn chờ nhận. Hủy phiếu nhập đó rồi {khoNguon} mới
                lập được phiếu nhập hoàn trả.
            </DongThongBao>
        ) : null,
    ].filter(Boolean);

    const lienQuan = [
        relatedIssue ? {
            khoa: `px-${relatedIssue.id}`,
            loai: "Phiếu xuất kho",
            ma: relatedIssue.soPhieuXuat,
            to: `/goods-issues/${relatedIssue.id}`,
            trangThai: getPhieuXuatKhoStatus(relatedIssue.trangThai).label,
            quyTrinh: "phieuXuat",
        } : null,
        // Phiếu nhập còn hiệu lực trước, phiếu đã hủy sau
        ...[...receipts.tatCa].sort((a, b) => (a === phieuNhap ? -1 : b === phieuNhap ? 1 : 0)).map((pn) => ({
            khoa: `pn-${pn.id}`,
            loai: laPhieuNhapHoanTra(pn, data) ? "Phiếu nhập hoàn trả" : "Phiếu nhập kho",
            ma: pn.soPhieuNhap,
            to: `/goods-receipts/${pn.id}`,
            trangThai: getGoodsReceiptStatus(pn.trangThai).label,
            quyTrinh: "phieuNhap",
        })),
    ];

    const nguoiDuyet = data.nguoiDuyetTen && data.nguoiDuyetTen !== "Chưa duyệt" ? data.nguoiDuyetTen : null;

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={data.soPhieuXuat}
                        trangThai={{ label: st.label, quyTrinh: "chuyenKho" }}
                        dongPhu={[
                            "Chuyển kho nội bộ",
                            <B key="sp">{chuSanPham}</B>,
                            <span key="sl">tổng số lượng <B>{soVN(bang.tong.soLuong)}</B></span>,
                        ]}
                        onQuayLai={quayLai}
                        nhanQuayLai="Về danh sách phiếu chuyển kho"
                        saoChepMa={{ giaTri: data.soPhieuXuat, nhan: "Sao chép mã phiếu" }}
                        menu={nut.huy ? [{
                            ma: "huy",
                            nhan: "Hủy phiếu",
                            icon: Ban,
                            nguyHiem: true,
                            moTa: "Phiếu xuất, phiếu nhập đã tạo không tự hủy theo",
                            khoa: isProcessing,
                            onSelect: () => setHop("huy"),
                        }] : []}
                        nutChinh={nutChinh}
                    />
                }
                tienTrinh={<TienTrinhChungTu nhan="Tiến trình phiếu chuyển kho" buoc={buoc} />}
                thongBao={dongThongBao.length ? dongThongBao : null}
                chinh={<BangHangChuyen bang={bang} cot={cot} coLoc={cot === "daLay"} />}
                cotPhai={
                    <CotThuocTinh nhan="Thông tin phiếu chuyển kho">
                        <NhomThuocTinh nhan="Tuyến chuyển">
                            <TuyenChuyen khoNguon={data.khoXuatTen} khoDich={data.khoNhapTen} />
                        </NhomThuocTinh>
                        <NhomThuocTinh>
                            <BangThuocTinh
                                muc={[
                                    { ma: "duyet", nhan: "Người duyệt", giaTri: nguoiDuyet, an: !duyet },
                                    { ma: "ghiChu", nhan: "Ghi chú", giaTri: data.ghiChu },
                                ]}
                            />
                        </NhomThuocTinh>
                        <ChungTuLienQuan ds={lienQuan} />
                    </CotThuocTinh>
                }
            />

            <HopXacNhanChungTu
                mo={hop === "guiDuyet"}
                onDoiMo={(mo) => !mo && setHop(null)}
                tieuDe={`Gửi yêu cầu cho ${khoNguon} duyệt`}
                moTa={`Quản lý ${khoNguon} sẽ duyệt cho xuất ${tomTatHang} sang ${khoDich}.`}
                nhanXacNhan="Gửi duyệt"
                iconXacNhan={Send}
                dangChay={isProcessing}
                onXacNhan={() => chayThaoTac(phieuChuyenKhoService.submit, `Đã gửi yêu cầu cho ${khoNguon} duyệt`, "Thao tác thất bại")}
            />
            <HopXacNhanChungTu
                mo={hop === "pheDuyet"}
                onDoiMo={(mo) => !mo && setHop(null)}
                tieuDe="Duyệt xuất hàng"
                moTa={`Cho phép ${khoNguon} xuất ${tomTatHang} sang ${khoDich}. Sau khi duyệt, kho nguồn tạo phiếu xuất và chọn lô.`}
                nhanXacNhan="Duyệt xuất hàng"
                iconXacNhan={Check}
                dangChay={isProcessing}
                onXacNhan={() => chayThaoTac(phieuChuyenKhoService.approve, "Đã duyệt xuất hàng", "Thao tác thất bại")}
            />
            <HopXacNhanChungTu
                mo={hop === "huy"}
                onDoiMo={(mo) => !mo && setHop(null)}
                tieuDe="Hủy phiếu chuyển kho"
                moTa="Phiếu chuyển sang Đã hủy. Phiếu xuất và phiếu nhập đã tạo không tự hủy theo."
                nhanXacNhan="Hủy phiếu"
                iconXacNhan={Ban}
                kieu="nguyHiem"
                dangChay={isProcessing}
                onXacNhan={() => chayThaoTac(phieuChuyenKhoService.cancel, "Đã hủy phiếu chuyển kho", "Không thể hủy phiếu")}
            >
                {data.trangThai === TT_CHUYEN.DANG_CHUYEN ? (
                    <p className={GHI_CHU_HOP}>
                        Hàng đang trên đường: sau khi hủy, {khoNguon} lập phiếu nhập hoàn trả để đưa hàng về kho.
                    </p>
                ) : null}
            </HopXacNhanChungTu>
        </PageContainer>
    );
}
