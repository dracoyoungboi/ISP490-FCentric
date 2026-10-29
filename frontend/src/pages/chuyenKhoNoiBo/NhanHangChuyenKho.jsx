import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ClipboardCheck, FileWarning, Minus, Plus, Printer, ScanLine } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { maVachNhaCungCapService } from "@/services/maVachNhaCungCapService";
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
import HopInTheLenh from "@/components/nhap-kho/HopInTheLenh";
import TheKetQuaQuet from "@/components/nhap-kho/TheKetQuaQuet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LY_DO_LOI } from "@/constants/nhapKho";
import { TT_CHUYEN } from "@/constants/phieuChuyenKho";
import { aiXuLyChenhLech, giaTriONgayGio, khoaLo, yeuCauNhanLech } from "@/components/chuyen-kho/hienThiChuyenKho";
import {
    GHI_CHU_TOI_DA,
    LY_DO_KHAC,
    chonLyDo,
    chuanHoaPhienNhan,
    conDemDuoc,
    datTay,
    docPhienNhan,
    doiGhiChu,
    doiHongTay,
    doiSoHong,
    doiSoLuong,
    ghiPhienNhan,
    guiCuaBienThe,
    hoanTacLuot,
    loCuaBienThe,
    loDangChoLyDo,
    luotChoLyDo,
    luotDeHoanTac,
    luotHienTai,
    nhanLuotNhan,
    phienCoSo,
    phienNhanMoi,
    thanhDat,
    thanhHong,
    themLuot,
    timBienTheTheoMa,
    tinhNhan,
} from "@/components/chuyen-kho/demNhanHang";
import { CHE_DO_XAC_NHAN, docTheLenh } from "@/pages/receipt/kiemDem";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { kyTuHopLe, tachSoLuong } from "@/utils/maVach";
import { taoBoNhanQuetNhanh } from "@/utils/quetNhanh";
import { bipKiemDem } from "@/utils/scanBeep";
import useScanQueue from "@/hooks/useScanQueue";
import { lamViecTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import { cauAnhChuaTai, taiLanLuot } from "@/components/chuyen-kho/anhBienBan";
import useAnhChon from "@/components/chuyen-kho/useAnhChon";
import useQuayLai from "@/hooks/useQuayLai";
import { cn } from "@/lib/utils";
import ChonAnhBienBan from "./ChonAnhBienBan";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;
const O_SO = "h-8 w-[72px] rounded-md border border-bo-input-border bg-bo-surface px-2 text-right text-sm tabular-nums outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15";
const O_SO_LOI = "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15";
const gio = () => new Date().toLocaleTimeString("vi-VN", { hour12: false });
/**
 * Có hộp thoại đang mở: không kéo con trỏ về ô quét. Ô nổi Hỏng (popover, không chặn màn) không tính: máy quét bắn khi
 * ô nổi đang mở thì phím về ô quét, ô nổi tự đóng.
 */
const coHopDangMo = () => Boolean(document.querySelector('[role="dialog"]:not([data-slot="popover-content"]), [role="alertdialog"]'));
/** "thiếu 3, hỏng 1" — bỏ phần bằng 0 ("hỏng 1", không ghi "thiếu 0, hỏng 1"). */
const cauLech = ({ thieu, hong }) => [thieu > 0 ? `thiếu ${soVN(thieu)}` : null, hong > 0 ? `hỏng ${soVN(hong)}` : null].filter(Boolean).join(", ");
/** Thời gian dùng lại kết quả tra mã vạch NCC với máy chủ (mã bị gỡ / liên kết lại ở máy khác vẫn được phát hiện). */
const KIEM_LAI_MA_NCC_MS = 60_000;

/**
 * Nhận hàng chuyển kho (màn B.4 của BA) tại kho nhận, kiểm đếm theo cách màn nhập hàng NCC (PA A, chốt 30/10/2026):
 * - Quét sản phẩm (SKU, mã vạch FCentric, mã vạch NCC đã liên kết; gõ 12* trước mã cho cả thùng): mỗi lượt cộng vào lô
 *   đầu tiên còn thiếu, thẻ kết quả nổi ở đáy màn, mặc định Đạt. Cái hỏng: quét thẻ KHÔNG ĐẠT rồi mã lý do (hoặc bấm
 *   trên thẻ). Quét HOÀN TÁC lùi lượt; đủ số gửi thì không cộng thêm.
 * - Đếm tay vẫn được ở ô Đạt (máy quét bắn nhầm vào ô thì ô về số cũ, mã tính như quét ở ô quét); ô Hỏng chỉnh theo lý
 *   do. Lô có cái hỏng đang chờ chọn lý do thì chưa sửa tay được.
 * - Thiếu = Gửi − Đạt − Hỏng. Khớp đủ → "Xác nhận nhận đủ" (phiếu nhập PN-TRF, phiếu Hoàn tất). Có lệch → "Xử lý chênh
 *   lệch": hỏng ghi theo lý do, phần thiếu (và lý do Khác) phải ghi chú; lập biên bản giao nhận, nhập ngay phần đạt, phần
 *   lệch giữ ở kho trung chuyển chờ người được xử lý chênh lệch (Quản lý Kho tổng theo mặc định, đổi ở Cấu hình › Chuyển kho).
 * - Số đếm và lượt quét giữ trong thẻ trình duyệt (tải lại trang không mất), rời trang khi chưa nhận thì trình duyệt hỏi lại.
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
    const [phien, setPhienState] = useState(null);
    const [daKiemLyDo, setDaKiemLyDo] = useState(false);
    const [hop, setHop] = useState(null); // "du" | "bienBan" | null
    const [loiHop, setLoiHop] = useState(null);
    const [dangChay, setDangChay] = useState(false);
    const [maQuet, setMaQuet] = useState("");
    const [baoQuet, setBaoQuet] = useState(null); // { tone, chu } của lần quét vừa rồi
    const [anThe, setAnThe] = useState(false);
    const [tab, setTab] = useState("bang");
    const [moInThe, setMoInThe] = useState(false);
    const oQuetRef = useRef(null);
    const theRef = useRef(null);
    // Dữ liệu mới nhất cho hàng đợi quét (đọc trong xử lý sự kiện, không đọc lúc vẽ)
    const ctRef = useRef(null);
    const phienRef = useRef(null);
    // Nhận ra máy quét bắn nhầm vào ô của bảng (ô Đạt, ô ghi chú) như hộp Khóa lô của màn nhập NCC
    const boNhanRef = useRef(null);
    // Ô Đạt đang có con trỏ: số lúc vào ô, đã có chữ lọt vào chưa (dự phòng khi bộ nhận lần quét không nhận ra)
    const oDatRef = useRef(null);
    // Hộp đang mở (hàng đợi quét đọc): mã quét xong sau khi hộp đã mở thì không tính
    const hopRef = useRef(null);
    // Mã vạch NCC đã tra được với máy chủ: mã → { bienTheId, luc }
    const maNccRef = useRef(new Map());
    // Đã gửi nhận hàng thành công: không giữ số, không hỏi khi rời trang
    const daGuiRef = useRef(false);
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
    useEffect(() => {
        hopRef.current = hop;
    }, [hop]);

    const setPhien = useCallback(
        (moi) => {
            phienRef.current = moi;
            setPhienState(moi);
            if (!daGuiRef.current) ghiPhienNhan(id, moi, ctRef.current?.hangTheoLo);
        },
        [id],
    );

    const tai = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await phieuChuyenKhoService.chiTiet(id);
            const co = res?.id != null ? res : null;
            ctRef.current = co;
            setCt(co);
            if (!co) {
                setLoadError({ loi: null });
            } else if (co.trangThai !== TT_CHUYEN.DANG_VAN_CHUYEN) {
                // Phiếu đã nhận / đã hủy ở nơi khác: bỏ số đang đếm dở của phiếu này
                ghiPhienNhan(id, null);
            } else if (!phienRef.current) {
                const p = chuanHoaPhienNhan(docPhienNhan(id), co.hangTheoLo);
                phienRef.current = p;
                setPhienState(p);
                if (phienCoSo(p)) setBaoQuet({ tone: "info", chu: "Đã mở lại số đếm dở của phiếu này (giữ trong thẻ trình duyệt). Quét tiếp để đếm nốt." });
            }
        } catch (e) {
            ctRef.current = null;
            setCt(null);
            setLoadError({ loi: e });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => tai());
    }, [tai]);

    const p = phien ?? phienNhanMoi();
    const dsLo = useMemo(() => ct?.hangTheoLo ?? [], [ct]);
    const kq = useMemo(() => tinhNhan(dsLo, p.dem), [dsLo, p.dem]);
    // Chưa quét, chưa gõ số nào: chưa báo lệch (mọi dòng Đạt = 0 chỉ vì chưa đếm), cũng chưa nút nào là nút chính
    const chuaDem = kq.tong.dat === 0 && kq.tong.hong === 0;
    // Còn dòng chưa đếm cái nào (thường là chưa quét tới): đang đếm dở, chưa báo lệch, chưa đẩy nút Xử lý chênh lệch lên
    const soDongChuaDem = kq.dong.filter((d) => d.gui > 0 && d.dat === 0 && d.hong === 0).length;
    const dangDem = !chuaDem && !kq.khop && !kq.vuot && soDongChuaDem > 0;
    const duocNhan = ct?.trangThai === TT_CHUYEN.DANG_VAN_CHUYEN && ct?.quyen?.nhan;

    const focusQuet = useCallback(() => {
        setTimeout(() => {
            if (!coHopDangMo()) oQuetRef.current?.focus();
        }, 30);
    }, []);

    const bao = useCallback(
        (tone, chu, bip = tone === "bad" || tone === "warn" ? "sai" : null) => {
            setBaoQuet({ tone, chu });
            if (bip) bipKiemDem(bip);
            focusQuet();
        },
        [focusQuet],
    );

    // ── Lượt quét ──
    const suaLuotNay = (bienDoi, bip) => {
        if (dangChay || !luotHienTai(phienRef.current)) return;
        setPhien(bienDoi(phienRef.current, ctRef.current?.hangTheoLo ?? []));
        setAnThe(false);
        setBaoQuet(null);
        if (bip) bipKiemDem(bip);
        focusQuet();
    };

    const hoanTac = (luotId) => {
        if (dangChay) return;
        const ketQua = hoanTacLuot(phienRef.current, luotId);
        if (!ketQua.luot) return;
        setPhien(ketQua.phien);
        setBaoQuet({ tone: "neutral", chu: `Đã hoàn tác lượt quét ${ketQua.luot.ma} (${soVN(ketQua.luot.sl)} cái).` });
        bipKiemDem("loi");
        focusQuet();
    };

    const xuLyLenh = (lenh, hoa) => {
        const c = luotHienTai(phienRef.current);
        switch (lenh.loai) {
            case "KHONG_DAT":
                if (!c) return bao("bad", "Quét sản phẩm trước rồi mới quét thẻ KHÔNG ĐẠT.");
                return suaLuotNay(thanhHong, "loi");
            case "DAT":
                if (!c) return bao("info", "Chưa có lượt quét nào để xác nhận.");
                return suaLuotNay(thanhDat, "ok");
            case "LY_DO":
                if (!c || c.kq !== "hong") return bao("bad", "Thẻ lý do chỉ dùng sau thẻ KHÔNG ĐẠT.");
                return suaLuotNay((ph, ds) => chonLyDo(ph, ds, LY_DO_LOI[lenh.soLyDo - 1]), "ok");
            case "HOAN_TAC": {
                const dich = luotDeHoanTac(phienRef.current);
                if (!dich) return bao("info", "Không còn lượt quét nào để hoàn tác.");
                return hoanTac(dich.id);
            }
            case "KHOA_LO":
                return bao("info", "Nhận hàng chuyển kho không khóa lô: lô có sẵn từ kho xuất. Đếm xong bấm Xác nhận nhận đủ hoặc Xử lý chênh lệch.", null);
            default:
                return bao("bad", `Thẻ lệnh ${hoa} không có trong hệ thống.`);
        }
    };

    // Một lần quét ở ô quét (hàng đợi chạy lần lượt: tra mã vạch NCC phải chờ máy chủ)
    const xuLyMa = async ({ raw }) => {
        const c = ctRef.current;
        if (!c || daGuiRef.current || c.trangThai !== TT_CHUYEN.DANG_VAN_CHUYEN || !c.quyen?.nhan) return;
        const cauDangMoHop = () => `Đang mở hộp xác nhận: mã ${String(raw).trim()} chưa được tính. Đóng hộp rồi quét lại.`;
        if (hopRef.current) return bao("warn", cauDangMoHop());
        const ds = c.hangTheoLo ?? [];
        const tach = tachSoLuong(raw);
        if (tach.loi) return bao("bad", tach.loi);
        const ma = tach.ma;
        if (!ma) return bao("bad", "Chưa có mã. Quét hoặc nhập mã rồi nhấn Enter.");
        const hoa = ma.toUpperCase();
        const lenh = docTheLenh(hoa, LY_DO_LOI.length);
        if (lenh) return xuLyLenh(lenh, hoa);
        if (!kyTuHopLe(ma)) {
            return bao("bad", `Mã “${ma}” có ký tự không có trên tem mã vạch (chữ có dấu hoặc khoảng trắng). Nếu gõ tay, hãy kiểm tra lại mã.`);
        }
        const cho = luotChoLyDo(phienRef.current);
        if (cho) {
            setAnThe(false);
            return bao("bad", `Chọn lý do hỏng cho ${cho.sku} trước: quét thẻ lý do hoặc bấm chọn trên thẻ kết quả.`);
        }
        const cauNgoaiPhieu = (ten) =>
            `Mã ${ma}${ten ? ` là của ${ten}` : ""} không có trong phiếu chuyển này. Để riêng sản phẩm; hàng giao nhầm thì ghi vào kết luận biên bản.`;
        let tim = timBienTheTheoMa(ds, ma);
        const daNho = maNccRef.current.get(hoa);
        if (!tim && daNho && Date.now() - daNho.luc < KIEM_LAI_MA_NCC_MS) tim = { bienTheId: daNho.bienTheId, nguon: "mã vạch NCC" };
        if (!tim) {
            // Mã vạch nhà cung cấp đã liên kết với một biến thể của phiếu (tem NCC còn trên hàng)
            let tra = null;
            let loiTra = null;
            try {
                lamViecTaiKho(c.khoNhap);
                tra = await maVachNhaCungCapService.tra(ma);
            } catch (e) {
                loiTra = e;
            }
            // Trong lúc chờ máy chủ: phiếu đã nhận xong / đã tải lại, hoặc người dùng đã mở hộp xác nhận
            if (daGuiRef.current || ctRef.current !== c) return;
            if (hopRef.current) return bao("warn", cauDangMoHop());
            // Mất kết nối, hết giờ chờ, lỗi máy chủ: chưa biết mã có thuộc phiếu không, không báo nhầm là hàng ngoài phiếu
            const trangThaiLoi = loiTra ? getApiErrorStatus(loiTra) : null;
            if (loiTra && (trangThaiLoi == null || trangThaiLoi >= 500)) {
                return bao("bad", `Không tra được mã ${ma} với máy chủ, hàng chưa được tính. Kiểm tra kết nối rồi quét lại.`);
            }
            if (tra?.timThay && ds.some((l) => l.bienTheId === tra.bienTheSanPhamId)) {
                tim = { bienTheId: tra.bienTheSanPhamId, nguon: tra.loaiMa === "NCC" ? "mã vạch NCC" : "mã FCentric" };
                maNccRef.current.set(hoa, { bienTheId: tra.bienTheSanPhamId, luc: Date.now() });
            } else if (tra?.timThay) {
                const ten = [tra.tenBienThe, tra.mauSac, tra.kichCo].filter(Boolean).join(" · ");
                return bao("bad", cauNgoaiPhieu(`${ten}${tra.sku ? ` (${tra.sku})` : ""}`));
            }
        }
        if (!tim) return bao("bad", cauNgoaiPhieu(""));
        const them = themLuot(phienRef.current, ds, { ...tim, ma: tim.nguon === "quét SKU" ? loCuaBienThe(ds, tim.bienTheId)[0].sku : ma, soLuong: tach.soLuong, gio: gio() });
        // Chờ tra máy chủ xong mà lượt hiện tại vẫn chờ lý do: chặn như trên
        if (them.choLyDo) {
            setAnThe(false);
            return bao("bad", `Chọn lý do hỏng cho ${them.choLyDo.sku} trước: quét thẻ lý do hoặc bấm chọn trên thẻ kết quả.`);
        }
        if (!them.luot) {
            const gui = guiCuaBienThe(ds, tim.bienTheId);
            const sku = loCuaBienThe(ds, tim.bienTheId)[0]?.sku ?? ma;
            return bao("warn", `${sku} đã đếm đủ ${soVN(gui)}/${soVN(gui)}. Hàng thừa để riêng, không nhập theo phiếu này.`);
        }
        setPhien(them.phien);
        setAnThe(false);
        setBaoQuet(
            them.tinh < tach.soLuong
                ? { tone: "warn", chu: `Chỉ tính ${soVN(them.tinh)}/${soVN(tach.soLuong)} vì ${them.luot.sku} chỉ còn thiếu ${soVN(them.tinh)}. Phần thừa để riêng.` }
                : null,
        );
        bipKiemDem("ok");
        focusQuet();
    };
    const { enqueue } = useScanQueue(xuLyMa);

    const nhanMa = (e) => {
        e.preventDefault();
        if (!maQuet.trim()) return;
        enqueue({ raw: maQuet });
        setMaQuet("");
        oQuetRef.current?.focus();
    };

    // ── Ô Đạt (đếm tay) và ô Hỏng (theo lý do) ──
    /** Lô có cái hỏng đang chờ chọn lý do: báo chọn lý do trước (gõ đè làm số "chưa chọn lý do" kẹt lại). */
    const chanKhiChoLyDo = (d) => {
        if (!loDangChoLyDo(phienRef.current, d.khoa)) return false;
        setAnThe(false);
        bao("bad", `Chọn lý do hỏng cho ${luotChoLyDo(phienRef.current).sku} trước, rồi mới sửa số của lô ${d.maLo}.`);
        return true;
    };
    const vaoODat = (d) => {
        oDatRef.current = { khoa: d.khoa, truoc: d.dat, coChu: false };
    };
    const goODat = (d, giaTri) => {
        const v = String(giaTri).trim();
        // Ô số không nhận chữ (chữ lọt vào thường là máy quét; bộ nhận lần quét bên dưới trả ô về số cũ khi gặp Enter)
        if (/\D/.test(v)) {
            if (oDatRef.current?.khoa === d.khoa) oDatRef.current.coChu = true;
            return;
        }
        if (chanKhiChoLyDo(d)) return;
        setPhien(datTay(phienRef.current, d.khoa, v === "" ? 0 : parseInt(v, 10)));
    };
    /**
     * Rời ô Đạt / Enter sau khi gõ (bộ nhận lần quét không nhận ra: máy quét không gửi Enter hoặc gõ chậm): ô đã lọt chữ
     * hoặc số dài hơn số gửi + 1 chữ số thì trả về số lúc vào ô và báo quét lại ở ô quét.
     */
    const roiODat = (d) => {
        const o = oDatRef.current;
        oDatRef.current = null;
        if (!o || o.khoa !== d.khoa) return;
        const nay = phienRef.current?.dem?.[d.khoa]?.dat ?? 0;
        const quaDai = String(nay).length > String(d.gui).length + 1;
        if (!o.coChu && !quaDai) return;
        setPhien(datTay(phienRef.current, d.khoa, o.truoc));
        bao("warn", `Ô Đạt của ${d.sku} lô ${d.maLo} vừa nhận ${o.coChu ? "chữ" : "một số quá dài"}, giống máy quét bắn nhầm vào ô: đã trả về ${soVN(o.truoc)}. Quét lại ở ô quét.`);
    };
    /**
     * Phím trong bảng (bắt trước ô): máy quét bắn vào ô Đạt / ô ghi chú (nhịp phím nhanh + Enter) thì trả đúng ô đó về
     * giá trị lúc phím đầu tới và xử lý mã như quét ở ô quét. Gõ tay thì để ô xử lý bình thường.
     */
    const nhanPhimTrongBang = (e) => {
        if (!boNhanRef.current) {
            boNhanRef.current = taoBoNhanQuetNhanh({
                // Ảnh chụp ô đang có con trỏ (ô Đạt / ô ghi chú của một lô, đánh dấu bằng data-khoa-o, data-loai-o)
                layAnhChup: () => {
                    const o = document.activeElement;
                    const khoa = o?.dataset?.khoaO;
                    if (!khoa) return null;
                    const r = phienRef.current?.dem?.[khoa];
                    return o.dataset.loaiO === "ghiChu" ? { khoa, ghiChu: r?.ghiChu ?? "" } : { khoa, dat: r?.dat ?? 0 };
                },
                khoiPhuc: (anh) => {
                    if (!anh) return;
                    setPhien(anh.ghiChu != null ? doiGhiChu(phienRef.current, anh.khoa, anh.ghiChu) : datTay(phienRef.current, anh.khoa, anh.dat));
                },
                onMa: (ma) => {
                    // Ô đã được trả về số cũ ở trên: rời ô không kiểm lại
                    oDatRef.current = null;
                    oQuetRef.current?.focus();
                    enqueue({ raw: ma });
                },
            });
        }
        boNhanRef.current(e);
    };
    const doiHong = (d, lyDo, delta) => {
        if (chanKhiChoLyDo(d)) return;
        setPhien(doiHongTay(phienRef.current, d, lyDo, delta));
    };
    const doiGhiChuDong = (d, chu) => setPhien(doiGhiChu(phienRef.current, d.khoa, chu));

    // Con trỏ rơi khỏi ô quét (bấm vào chỗ trống, đóng hộp…) mà máy quét bắn mã: đưa phím về ô quét thay vì để mã mất
    // lặng lẽ. Không đụng khi đang gõ ở ô nhập khác hoặc đang mở hộp thoại / ô nổi.
    useEffect(() => {
        if (!duocNhan) return undefined;
        const khiGoPhim = (e) => {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1 || e.key === " ") return;
            const o = oQuetRef.current;
            const dich = e.target;
            if (!o || dich === o) return;
            if (dich instanceof HTMLElement && (dich.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(dich.tagName))) return;
            if (coHopDangMo()) return;
            e.preventDefault();
            o.focus();
            setMaQuet((v) => v + e.key);
        };
        document.addEventListener("keydown", khiGoPhim);
        return () => document.removeEventListener("keydown", khiGoPhim);
    }, [duocNhan]);

    // Số đếm dở chỉ nằm trong thẻ trình duyệt này: đóng thẻ / tải trang thì hỏi lại
    const coSoChuaGui = duocNhan && phienCoSo(phien) && !dangChay;
    useEffect(() => {
        if (!coSoChuaGui) return undefined;
        const khiRoiTrang = (e) => {
            if (daGuiRef.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", khiRoiTrang);
        return () => window.removeEventListener("beforeunload", khiRoiTrang);
    }, [coSoChuaGui]);

    // Thẻ kết quả của lượt hiện tại: cất khi xem danh sách lượt, khi mở hộp xác nhận / in thẻ lệnh
    const cur = luotHienTai(p);
    const theHien = Boolean(cur) && !anThe && !hop && !moInThe;
    // Màn thấp (máy quét cầm tay): thẻ kết quả dính đáy màn có thể che ô quét; ô quét bị che thì cuộn ô lên đầu màn
    const luotHienTaiId = cur?.id ?? null;
    useEffect(() => {
        const the = theRef.current;
        if (!the) return undefined;
        let raf = 0;
        const kiem = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const o = oQuetRef.current;
                if (!o || !theRef.current) return;
                if (o.getBoundingClientRect().bottom > theRef.current.getBoundingClientRect().top - 8) {
                    o.scrollIntoView({ block: "start", behavior: "smooth" });
                }
            });
        };
        kiem();
        const theoDoi = typeof ResizeObserver === "function" ? new ResizeObserver(kiem) : null;
        theoDoi?.observe(the);
        return () => {
            cancelAnimationFrame(raf);
            theoDoi?.disconnect();
        };
    }, [luotHienTaiId, baoQuet, theHien]);

    const moBienBan = () => {
        setDaKiemLyDo(true);
        if (kq.dong.some((d) => d.chuaLyDo > 0)) {
            setAnThe(false);
            bao("bad", "Còn cái hỏng chưa chọn lý do: chọn trên thẻ kết quả, hoặc hoàn tác lượt đó.");
            return;
        }
        const dongThieu = kq.dong.find((d) => d.thieuLyDo);
        if (dongThieu) {
            // Cất thẻ kết quả: thẻ che các dòng cần ghi chú, câu báo hiện dưới ô quét thay vì trên thẻ
            setAnThe(true);
            setBaoQuet({ tone: "bad", chu: "Ghi chú phần thiếu (hoặc lý do Khác) cho các dòng lệch." });
            bipKiemDem("sai");
            // Con trỏ vào ô ghi chú đầu tiên còn trống (ô vừa hiện ra sau lần bấm này), không về ô quét
            setTimeout(() => document.querySelector(`input[data-loai-o="ghiChu"][data-khoa-o="${dongThieu.khoa}"]`)?.focus(), 30);
            return;
        }
        // Câu báo của lần bấm trước (thiếu ghi chú) đã được giải quyết: không để lại sau hộp biên bản
        setBaoQuet(null);
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
        // Đã nhận: bỏ số đếm giữ trong thẻ trình duyệt, không hỏi khi rời trang
        daGuiRef.current = true;
        ghiPhienNhan(id, null);
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
                    kieu: kq.khop || chuaDem || dangDem ? "vien" : "chinh",
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
            Quét sản phẩm: mỗi lượt tự tính Đạt; cái hỏng thì quét tiếp thẻ <B>KHÔNG ĐẠT</B> rồi mã lý do (hoặc bấm trên thẻ kết quả). Gõ
            12* trước mã để tính cả thùng. Khớp đủ thì bấm <B>Xác nhận nhận đủ</B>; có thiếu hoặc hỏng thì bấm <B>Xử lý chênh lệch</B> để
            lập biên bản giao nhận.
        </DongThongBao>
    ) : dangDem ? (
        <DongThongBao tone="info">
            Đang đếm {soVN(kq.tong.dat + kq.tong.hong)}/{soVN(kq.tong.gui)}, còn {soVN(soDongChuaDem)} dòng chưa đếm cái nào. Quét tiếp; đếm xong mà
            còn thiếu hoặc có hỏng thì bấm <B>Xử lý chênh lệch</B> để lập biên bản giao nhận.
        </DongThongBao>
    ) : kq.khop ? (
        <DongThongBao tone="ok">
            Khớp đủ {soVN(kq.tong.dat)}/{soVN(kq.tong.gui)} sản phẩm, hàng nguyên vẹn. Bấm <B>Xác nhận nhận đủ</B> để phát hành phiếu nhập và hoàn tất phiếu.
        </DongThongBao>
    ) : (
        <DongThongBao tone="warn">
            Có <B>{kq.soDongLech} dòng</B> không khớp số gửi ({cauLech(kq.tong)}). Bấm <B>Xử lý chênh lệch</B> để nhập ngay phần đạt
            và lập <B>biên bản giao nhận</B> cho ba bên ký. Phần thiếu và hỏng chưa vào kho, chờ {aiXuLyChenhLech(ct)} xử lý.
        </DongThongBao>
    );

    // Lỗi / cảnh báo khi thẻ kết quả đang hiện thì nằm trên thẻ (mắt người kiểm đang ở đó), không lặp dưới ô quét
    const baoTrenThe = theHien && baoQuet && (baoQuet.tone === "bad" || baoQuet.tone === "warn") ? baoQuet : null;
    const baoDuoiO = baoTrenThe ? null : baoQuet;
    const loCur = cur ? loCuaBienThe(dsLo, cur.bienTheId) : [];
    const conThemCur = loCur.reduce((s, l) => s + conDemDuoc(l, p.dem), 0);
    const maLoTheoKhoa = Object.fromEntries(dsLo.map((l) => [khoaLo(l), l.maLo]));
    const soLuot = p.log.filter((e) => !e.huy).length;
    const dsTab = [["bang", "Bảng đếm", null], ["luot", "Lượt quét", soLuot]];
    const chonTab = (ma) => {
        setTab(ma);
        // Thẻ kết quả nói về lượt đang kiểm: xem danh sách lượt thì cất thẻ để không che danh sách; quét tiếp thẻ hiện lại
        setAnThe(ma === "luot");
    };

    const bang = (
        <section className="flex min-w-0 flex-1 flex-col">
            <form onSubmit={nhanMa} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
                {/* Ô quét rộng ít nhất 16rem: màn hẹp (máy quét cầm tay) thì bộ đếm và In thẻ lệnh xuống dòng thay vì bóp ô */}
                <label className="relative min-w-0 flex-[1_1_16rem]">
                    <span className="sr-only">Quét mã vạch hoặc gõ SKU</span>
                    <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                    <input
                        ref={oQuetRef}
                        value={maQuet}
                        onChange={(e) => setMaQuet(e.target.value)}
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        enterKeyHint="done"
                        placeholder="Quét sản phẩm hoặc thẻ lệnh · gõ 12* trước mã để tính cả thùng (gõ SKU rồi Enter)"
                        className={cn(O_NHAP, "pl-8")}
                    />
                </label>
                <span className="text-[13px] tabular-nums text-bo-muted">
                    Đã đếm {soVN(kq.tong.dat + kq.tong.hong)}/{soVN(kq.tong.gui)}
                </span>
                <button
                    type="button"
                    onClick={() => setMoInThe(true)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bo-primary hover:text-bo-primary-hover"
                >
                    <Printer className="size-4" aria-hidden="true" /> In thẻ lệnh
                </button>
            </form>
            {baoDuoiO ? (
                <div className="px-4 pb-2 sm:px-6">
                    <DongThongBao tone={baoDuoiO.tone}>{baoDuoiO.chu}</DongThongBao>
                </div>
            ) : null}
            <p className="px-4 pb-2 text-xs leading-4 text-bo-muted sm:px-6">
                <B>Gửi</B>: số {khoXuat} xuất · <B>Đạt</B>: số đếm được, bán được · <B>Hỏng</B>: tới nơi nhưng không bán được · <B>Thiếu</B> = Gửi − Đạt − Hỏng
            </p>
            <div role="tablist" aria-label="Bảng đếm và lượt quét" className="flex gap-1 border-t border-bo-border px-3">
                {dsTab.map(([ma, nhan, dem], i) => {
                    const dangMo = tab === ma;
                    return (
                        <button
                            key={ma}
                            id={`tab-nhan-${ma}`}
                            type="button"
                            role="tab"
                            aria-selected={dangMo}
                            aria-controls="khung-nhan-hang"
                            tabIndex={dangMo ? 0 : -1}
                            onClick={() => chonTab(ma)}
                            onKeyDown={(e) => {
                                // Bàn phím: mũi tên trái / phải chuyển tab (một điểm dừng Tab cho cả nhóm)
                                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                                e.preventDefault();
                                const ke = dsTab[(i + 1) % dsTab.length][0];
                                chonTab(ke);
                                document.getElementById(`tab-nhan-${ke}`)?.focus();
                            }}
                            className={cn(
                                "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-2.5 text-sm",
                                dangMo ? "border-bo-primary font-semibold text-bo-foreground" : "border-transparent font-medium text-bo-muted hover:text-bo-foreground",
                            )}
                        >
                            {nhan}
                            {dem != null ? (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">{dem}</span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
            <div id="khung-nhan-hang" role="tabpanel" aria-labelledby={`tab-nhan-${tab}`} className="flex min-w-0 flex-1 flex-col">
                {tab === "bang" ? (
                    <div className={KHUNG_CUON} onKeyDownCapture={nhanPhimTrongBang}>
                        <table className={cn(BANG, "min-w-[960px]")}>
                            <thead>
                                <tr className={DONG_TIEU_DE}>
                                    <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                                    <th scope="col" className={O_TIEU_DE}>Lô</th>
                                    <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Gửi</th>
                                    <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Đạt</th>
                                    <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Hỏng</th>
                                    <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Thiếu</th>
                                    <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "min-w-[260px]")}>Lý do lệch</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kq.dong.map((d) => (
                                    <DongDem
                                        key={d.khoa}
                                        d={d}
                                        moi={Boolean(cur?.phan.some((x) => x.khoa === d.khoa))}
                                        hienLoi={daKiemLyDo}
                                        chuaDemDong={!daKiemLyDo && d.gui > 0 && d.dat === 0 && d.hong === 0}
                                        dangDemDo={!daKiemLyDo && (chuaDem || dangDem)}
                                        conHong={conDemDuoc(d, p.dem)}
                                        onVaoODat={() => vaoODat(d)}
                                        onGoODat={(v) => goODat(d, v)}
                                        onRoiODat={() => roiODat(d)}
                                        onEnterODat={() => oQuetRef.current?.focus()}
                                        onDoiHong={(lyDo, delta) => doiHong(d, lyDo, delta)}
                                        onDoiGhiChu={(chu) => doiGhiChuDong(d, chu)}
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
                ) : p.log.length ? (
                    <ul className="border-t border-slate-100">
                        {p.log.map((e) => (
                            <li
                                key={e.id}
                                className={cn(
                                    "grid min-h-12 grid-cols-[64px_minmax(0,1fr)_88px] items-center gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-1.5 text-[13px] last:border-b-0 sm:px-6 lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,2fr)_112px]",
                                    e.huy && "text-slate-400",
                                )}
                            >
                                <span className="tabular-nums text-bo-muted">{e.gio}</span>
                                <span className="truncate font-mono text-xs text-slate-600">{e.ma}</span>
                                <span className={cn("col-span-2 col-start-2 row-start-2 flex min-w-0 items-center gap-2 lg:col-span-1 lg:col-start-auto lg:row-start-auto", e.huy && "line-through")}>
                                    <span className={cn("size-2 shrink-0 rounded-full", e.huy ? "bg-slate-300" : e.kq === "hong" ? (e.sl > e.hong ? "bg-amber-700" : "bg-red-600") : "bg-green-700")} />
                                    <span className="truncate">{nhanLuotNhan(e)}</span>
                                    <span className="hidden truncate text-xs text-bo-muted lg:inline">
                                        · {e.sku} · lô {e.phan.map((x) => `${maLoTheoKhoa[x.khoa] ?? "?"}${e.phan.length > 1 ? ` ×${x.sl}` : ""}`).join(", ")} · {e.nguon}
                                    </span>
                                </span>
                                <span className="col-start-3 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
                                    {e.huy ? (
                                        <span className="text-xs text-bo-muted">Đã hoàn tác</span>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={dangChay}
                                            onMouseDown={(ev) => ev.preventDefault()}
                                            onClick={() => hoanTac(e.id)}
                                            className="text-[13px] font-semibold text-bo-primary hover:underline disabled:opacity-50"
                                        >
                                            Hoàn tác
                                        </button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="border-t border-slate-100 px-6 py-10 text-center text-sm text-bo-muted">Chưa có lượt quét nào. Số gõ tay ở bảng đếm không hiện ở đây.</p>
                )}
            </div>
            {/* Chỗ trống cuối khối: cuộn hết trang thì dòng cuối nằm trên thẻ kết quả (thẻ nổi, không chiếm chỗ) */}
            <div aria-hidden="true" className="h-72 shrink-0" />
        </section>
    );

    const l0 = loCur[0];
    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu dau={dau} thongBao={thongBao} chinh={bang} />

            {/* Thẻ kết quả nổi trong khung cao 0 dính đáy màn, luôn có mặt: thẻ hiện / ẩn / đổi cỡ (Đạt ↔ Hỏng) không đổi chiều
                cao trang, nên nội dung không trượt dưới con trỏ (bấm "Đổi lại Đạt" xong không rơi trúng "Đổi thành Hỏng") */}
            <div className="pointer-events-none sticky bottom-3 z-30 h-0 sm:bottom-5">
                {theHien ? (
                    <div className="pointer-events-auto absolute inset-x-0 bottom-0">
                        <TheKetQuaQuet
                            ref={theRef}
                            luot={{ ...cur, kq: cur.kq === "hong" ? "loi" : "dat", loi: cur.hong }}
                            thongBao={baoTrenThe}
                            cheDo={CHE_DO_XAC_NHAN.QUET_TIEP_LA_DAT}
                            conLai={conThemCur}
                            lyDoDs={LY_DO_LOI}
                            khoa={dangChay}
                            nhanLoi="Hỏng"
                            dongPhu={l0 ? [l0.tenSanPham, l0.tenMau, l0.kichCo, `lô ${cur.phan.map((x) => maLoTheoKhoa[x.khoa]).join(", ")}`].filter(Boolean).join(" · ") : null}
                            onDat={() => suaLuotNay(thanhDat, "ok")}
                            onKhongDat={() => suaLuotNay(thanhHong, "loi")}
                            onLyDo={(ten) => suaLuotNay((ph, ds) => chonLyDo(ph, ds, ten), "ok")}
                            onSoLuong={(delta) => suaLuotNay((ph, ds) => doiSoLuong(ph, ds, delta))}
                            onSoLoi={(delta) => suaLuotNay((ph, ds) => doiSoHong(ph, ds, delta))}
                            onHoanTac={() => hoanTac(cur.id)}
                            onAn={() => {
                                setAnThe(true);
                                focusQuet();
                            }}
                        />
                    </div>
                ) : null}
            </div>

            <HopInTheLenh
                open={moInThe}
                onOpenChange={(mo) => {
                    setMoInThe(mo);
                    if (!mo) focusQuet();
                }}
                onQuet={(ma) => enqueue({ raw: ma })}
                boKhoaLo
            />

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
                    traTieuDiemVe={oQuetRef}
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

/**
 * Một dòng lô của bảng đếm: ô Đạt gõ tay, ô Hỏng mở ô nổi chỉnh theo lý do, cột lý do (chip theo lý do + ghi chú).
 * `chuaDemDong`: lô chưa đếm cái nào (thường là chưa quét tới) và người dùng chưa bấm Xử lý chênh lệch: số thiếu để
 * chữ xám, chưa hiện ô ghi chú bắt buộc. `dangDemDo`: phiếu còn lô chưa đếm (đếm dở) và chưa bấm Xử lý chênh lệch: phần
 * thiếu có thể chỉ là chưa đếm tới nên cũng để chữ xám, ô ghi chú chỉ hiện khi có lý do Khác hoặc đã có ghi chú.
 */
function DongDem({ d, moi, hienLoi, chuaDemDong, dangDemDo, conHong, onVaoODat, onGoODat, onRoiODat, onEnterODat, onDoiHong, onDoiGhiChu }) {
    const idGhiChu = useId();
    const loiGhiChu = hienLoi && d.lech && d.thieuGhiChu;
    const coKhac = d.lyDos.some(([k]) => k === LY_DO_KHAC);
    const hienGhiChu = d.canGhiChu && (!dangDemDo || coKhac || Boolean(String(d.ghiChu ?? "").trim()));
    return (
        <tr className={cn(DONG, moi && "bg-bo-primary/[0.04]")}>
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
                    autoComplete="off"
                    data-khoa-o={d.khoa}
                    data-loai-o="dat"
                    aria-label={`Đạt ${d.sku} lô ${d.maLo}`}
                    onFocus={(e) => {
                        onVaoODat();
                        e.target.select();
                    }}
                    onChange={(e) => onGoODat(e.target.value)}
                    onBlur={onRoiODat}
                    onKeyDown={(e) => {
                        // Enter sau khi gõ tay xong: về ô quét (Enter của máy quét đã được bộ nhận lần quét của bảng xử lý)
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        onEnterODat();
                    }}
                    className={cn(O_SO, d.vuot && O_SO_LOI)}
                />
            </td>
            <td className={cn(O, "text-right")}>
                <OHong d={d} conHong={conHong} onDoiHong={onDoiHong} />
            </td>
            <td className={cn(O, "text-right")}>
                {d.vuot ? (
                    <span className="rounded-md bg-bo-danger-soft px-2 py-0.5 text-xs font-medium text-bo-danger-strong">Vượt số gửi</span>
                ) : chuaDemDong ? (
                    <span className="px-2 tabular-nums text-bo-muted" title="Chưa đếm">{soVN(d.thieu)}</span>
                ) : !d.lech ? (
                    <span className="rounded-md bg-bo-tt-xong px-2 py-0.5 text-xs font-medium text-bo-tt-xong-chu">Khớp</span>
                ) : d.thieu === 0 ? (
                    <span className="rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-medium text-bo-tt-chu-y-chu">Hỏng {soVN(d.hong)}</span>
                ) : dangDemDo ? (
                    <span className="px-2 tabular-nums text-bo-muted" title="Đang đếm">{soVN(d.thieu)}</span>
                ) : (
                    <span className="rounded-md bg-bo-tt-chu-y px-2 py-0.5 text-xs font-semibold tabular-nums text-bo-tt-chu-y-chu">{soVN(d.thieu)}</span>
                )}
            </td>
            <td className={cn(O, O_CUOI)}>
                {chuaDemDong ? (
                    <span className="text-bo-muted">Chưa đếm</span>
                ) : d.lech && !d.lyDos.length && !d.chuaLyDo && !hienGhiChu ? (
                    <span className="text-bo-muted">{dangDemDo ? "Đang đếm" : "—"}</span>
                ) : d.lech ? (
                    <div className="flex flex-col gap-1.5">
                        {d.lyDos.length || d.chuaLyDo ? (
                            <div className="flex flex-wrap gap-1">
                                {d.lyDos.map(([ten, n]) => (
                                    <span key={ten} className="rounded-full border border-bo-border bg-bo-surface-subtle px-2 py-px text-xs text-bo-foreground">
                                        {ten} {soVN(n)}
                                    </span>
                                ))}
                                {d.chuaLyDo ? (
                                    <span className="rounded-full bg-bo-danger-soft px-2 py-px text-xs font-medium text-bo-danger-strong">{soVN(d.chuaLyDo)} chưa chọn lý do</span>
                                ) : null}
                            </div>
                        ) : null}
                        {hienGhiChu ? (
                            <>
                                <input
                                    value={d.ghiChu}
                                    maxLength={GHI_CHU_TOI_DA}
                                    data-khoa-o={d.khoa}
                                    data-loai-o="ghiChu"
                                    aria-label={`Ghi chú lý do lệch ${d.sku} lô ${d.maLo}`}
                                    aria-invalid={loiGhiChu || undefined}
                                    aria-describedby={loiGhiChu ? idGhiChu : undefined}
                                    placeholder={
                                        d.thieu > 0 && coKhac
                                            ? `Ghi chú phần thiếu ${soVN(d.thieu)} cái và lý do Khác`
                                            : d.thieu > 0
                                              ? `Ghi chú phần thiếu ${soVN(d.thieu)} cái`
                                              : "Ghi rõ lý do Khác"
                                    }
                                    onChange={(e) => onDoiGhiChu(e.target.value)}
                                    className={cn(O_NHAP, "h-8", loiGhiChu && O_SO_LOI)}
                                />
                                {/* Sau lần bấm Xử lý chênh lệch, dòng báo lỗi luôn giữ chỗ (ẩn khi đã điền): điền dần từng ô
                                    thì các dòng dưới không trượt lên dưới con trỏ */}
                                {hienLoi ? (
                                    <span id={idGhiChu} aria-hidden={!loiGhiChu || undefined} className={cn("block text-xs", loiGhiChu ? "text-bo-danger" : "invisible")}>
                                        {d.thieu > 0 && coKhac ? "Ghi chú phần thiếu và lý do Khác" : d.thieu > 0 ? "Ghi chú phần thiếu" : "Ghi rõ lý do Khác"}
                                    </span>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-bo-muted">—</span>
                )}
            </td>
        </tr>
    );
}

/** Ô Hỏng: số hỏng của lô, bấm mở ô nổi chỉnh số theo từng lý do (cộng Đạt + Hỏng không vượt số gửi). */
function OHong({ d, conHong, onDoiHong }) {
    const theoLyDo = Object.fromEntries(d.lyDos);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`Hỏng ${d.sku} lô ${d.maLo}: ${d.hong}. Chỉnh theo lý do`}
                    className={cn(
                        "inline-flex h-8 min-w-[72px] items-center justify-end gap-1.5 rounded-md border border-bo-input-border bg-bo-surface px-2 text-sm tabular-nums hover:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                        d.vuot && O_SO_LOI,
                    )}
                >
                    {soVN(d.hong)}
                    <ChevronDown className="size-3.5 text-bo-muted" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 border-bo-border bg-bo-surface p-3 text-bo-foreground">
                <p className="text-sm font-semibold text-bo-heading">Hỏng theo lý do</p>
                <p className="mt-0.5 text-xs text-bo-muted">
                    {d.sku} · lô {d.maLo} · gửi {soVN(d.gui)}, đạt {soVN(d.dat)}.{" "}
                    {conHong > 0 ? `Còn thêm được ${soVN(conHong)} cái hỏng.` : "Đã đủ số gửi: bớt ô Đạt trước rồi mới thêm hỏng."}
                </p>
                <ul className="mt-2 divide-y divide-bo-border">
                    {LY_DO_LOI.map((ten) => {
                        const n = theoLyDo[ten] ?? 0;
                        return (
                            <li key={ten} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                <span>{ten}</span>
                                <span className="inline-grid h-8 grid-cols-[30px_40px_30px] overflow-hidden rounded-md border border-bo-input-border">
                                    <button type="button" aria-label={`Bớt 1 ${ten}`} disabled={n <= 0} onClick={() => onDoiHong(ten, -1)} className="grid place-items-center bg-bo-surface-subtle text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                                        <Minus className="size-3.5" />
                                    </button>
                                    <output className="grid place-items-center border-x border-bo-input-border font-semibold tabular-nums" aria-label={`Hỏng ${ten}`}>{n}</output>
                                    <button type="button" aria-label={`Thêm 1 ${ten}`} disabled={conHong <= 0} onClick={() => onDoiHong(ten, 1)} className="grid place-items-center bg-bo-surface-subtle text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                                        <Plus className="size-3.5" />
                                    </button>
                                </span>
                            </li>
                        );
                    })}
                </ul>
                {d.chuaLyDo ? (
                    <p className="mt-2 text-xs text-bo-danger">{soVN(d.chuaLyDo)} cái từ lượt quét đang chờ chọn lý do: chọn trên thẻ kết quả.</p>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}

/**
 * Lập biên bản giao nhận (A4): người giao, thời điểm, bảng dòng lệch, kết luận, ảnh chụp (không bắt buộc, tải sau khi
 * biên bản đã lập; đang tải thì có nút "Bỏ qua, tải ảnh sau" → `onBoQuaAnh`).
 */
function HopBienBan({ ct, khoNhap, kq, anhChon, tienDoAnh, dangChay, loi, onDong, onXacNhan, onBoQuaAnh, traTieuDiemVe }) {
    const [nguoi, setNguoi] = useState(ct.nguoiVanChuyen ?? "");
    const [thoiDiem, setThoiDiem] = useState(() => giaTriONgayGio(new Date()));
    const [ketLuan, setKetLuan] = useState(`Hai bên xác nhận ${cauLech(kq.tong)} như bảng trên. Phần lệch chờ ${aiXuLyChenhLech(ct)} xử lý.`);
    const [daBam, setDaBam] = useState(false);
    // Thời điểm sau hiện tại: máy chủ từ chối (nhanLech cho lệch tối đa 5 phút), báo ngay ở ô
    const [tuongLai, setTuongLai] = useState(false);
    const idNguoi = useId();
    const idThoiDiem = useId();
    const idKetLuan = useId();
    const loiNguoi = daBam && !nguoi.trim();
    const loiThoiDiem = daBam && (!thoiDiem || tuongLai);
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
            traTieuDiemVe={traTieuDiemVe}
            loi={loi}
            onXacNhan={() => {
                setDaBam(true);
                const sau = Boolean(thoiDiem) && new Date(thoiDiem).getTime() > Date.now() + 5 * 60 * 1000;
                setTuongLai(sau);
                if (!nguoi.trim() || !thoiDiem || sau) return;
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
                    <input id={idThoiDiem} type="datetime-local" value={thoiDiem} onChange={(e) => {
                        setThoiDiem(e.target.value);
                        setTuongLai(false);
                    }} aria-invalid={loiThoiDiem || undefined} aria-describedby={loiThoiDiem ? `${idThoiDiem}-loi` : undefined} className={cn(O_NHAP, loiThoiDiem && O_SO_LOI)} />
                    {loiThoiDiem ? <span id={`${idThoiDiem}-loi`} className="text-xs text-bo-danger">{thoiDiem ? "Thời điểm giao nhận không được sau hiện tại" : "Chọn thời điểm giao nhận"}</span> : null}
                </div>
            </div>
            {/* Hộp rộng 560px: lý do (có thể dài) nằm dòng riêng dưới số lượng, tên sản phẩm một dòng kèm màu / cỡ và lô, không
                phải cuộn ngang. Khung không đặt overflow: thân hộp là lưới có chiều cao giới hạn, khung có overflow bị bóp nhỏ
                hơn bảng trên màn thấp (đè lên ô Kết luận); góc bo nằm ở ô tiêu đề */}
            <div className="rounded-lg border border-bo-border">
                <table className="w-full table-fixed text-[13px]">
                    <thead className="text-left text-xs text-bo-muted">
                        <tr>
                            <th className="rounded-tl-lg bg-bo-surface-subtle px-3 py-2 font-medium">Sản phẩm</th>
                            <th className="w-14 bg-bo-surface-subtle px-2 py-2 text-right font-medium">Gửi</th>
                            <th className="w-14 bg-bo-surface-subtle px-2 py-2 text-right font-medium">Đạt</th>
                            <th className="w-14 bg-bo-surface-subtle px-2 py-2 text-right font-medium">Hỏng</th>
                            <th className="w-14 rounded-tr-lg bg-bo-surface-subtle px-3 py-2 text-right font-medium">Thiếu</th>
                        </tr>
                    </thead>
                    {dongLech.map((d) => (
                        <tbody key={khoaLo(d)} className="border-t border-bo-border tabular-nums">
                            <tr>
                                <td className="px-3 pb-1 pt-2">
                                    <div className="truncate font-medium text-bo-foreground" title={d.tenSanPham}>{d.tenSanPham}</div>
                                    <div className="truncate text-xs text-bo-muted" title={d.sku}>
                                        {[d.tenMau, d.kichCo].filter(Boolean).join(" / ")} · lô <span className="font-mono">{d.maLo}</span> · {d.sku}
                                    </div>
                                </td>
                                <td className="px-2 pb-1 pt-2 text-right align-top">{soVN(d.gui)}</td>
                                <td className="px-2 pb-1 pt-2 text-right align-top">{soVN(d.dat)}</td>
                                <td className="px-2 pb-1 pt-2 text-right align-top">{soVN(d.hong)}</td>
                                <td className="px-3 pb-1 pt-2 text-right align-top">{soVN(Math.max(0, d.thieu))}</td>
                            </tr>
                            <tr>
                                <td colSpan={5} className="px-3 pb-2 text-xs leading-5 text-bo-foreground">
                                    <span className="text-bo-muted">Lý do: </span>
                                    {d.lyDo}
                                </td>
                            </tr>
                        </tbody>
                    ))}
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
