import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { ArrowLeft, Lock, Package, Printer, ScanLine, SearchX, Trash2 } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { PAGE_HEADING_TYPE, useClaimPageTitle } from "@/components/backoffice/pageTitle";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import DongThongBao, { NutChu } from "@/components/nhap-kho/DongThongBao";
import HopInTheLenh from "@/components/nhap-kho/HopInTheLenh";
import HopKhoaLo from "@/components/nhap-kho/HopKhoaLo";
import HopMaChuaCo from "@/components/nhap-kho/HopMaChuaCo";
import TheKetQuaQuet from "@/components/nhap-kho/TheKetQuaQuet";
import { LY_DO_LOI } from "@/constants/nhapKho";
import useScanQueue from "@/hooks/useScanQueue";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { cn } from "@/lib/utils";
import { maVachNhaCungCapService } from "@/services/maVachNhaCungCapService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { viTriKhoService } from "@/services/viTriKhoService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate, formatNumber } from "@/utils/formatters";
import { docLoDangKiem, ghiLoDangKiem, xoaHangLoiTamCu } from "@/utils/hangLoiTam";
import { KHO_LAM_VIEC_EVENT, getKhoLamViecId } from "@/utils/khoLamViec";
import { kyTuHopLe, tachSoLuong } from "@/utils/maVach";
import { hasAnyRole, ROLES } from "@/utils/roles";
import { bipKiemDem } from "@/utils/scanBeep";
import {
  CHE_DO_XAC_NHAN,
  cauChanLuot,
  cauChuaKiemKhoaChuaRo,
  cauKeKhongDuoc,
  chonLyDo,
  chuanHoaPhien,
  coKeHoatDong,
  conTrongKe,
  dieuKienKhoaLo,
  docTheLenh,
  doiChieuKhoaChuaRo,
  doiSoLoi,
  doiSoLuong,
  goiYMaLo,
  hoanTacLuot,
  keDungDuoc,
  ketQuaLanTaiMoiNhat,
  khopLanKhoa,
  luotDangCho,
  luotDeHoanTac,
  luotHienTai,
  maCuaBienThe,
  ngayHomNay,
  nhanLuot,
  nhanTrangThai,
  nhomLoiTheoLyDo,
  phienMoi,
  tenDayDu,
  thanhDat,
  thanhKhongDat,
  themLuot,
  THE_LENH,
  tinh,
} from "./kiemDem";

const gio = () => new Date().toLocaleTimeString("vi-VN", { hour12: false });
const TH = "h-10 px-5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/**
 * Kiểm đếm & khóa lô một biến thể của phiếu nhập từ đơn mua — PA2 "Một khối + hộp khóa lô" (chốt 19/10/2026).
 *
 * - Một ô quét cho mọi thứ: sản phẩm (SKU, mã vạch tem FCentric, mã vạch NCC đã liên kết), mã kệ, thẻ lệnh FC-…
 *   Gõ "12*" trước mã để tính cả thùng 12 cái.
 * - Máy quét một nút: mỗi lần quét đúng biến thể hiện thẻ kết quả nổi (không chặn, không lấy con trỏ).
 *   Chế độ "Quét tiếp là Đạt" (mặc định, Cấu hình › Nhập kho): quét cái kế tiếp là lượt trước giữ Đạt;
 *   hàng lỗi quét thẻ KHÔNG ĐẠT rồi mã lý do. Chế độ "Quét thẻ cho từng cái": phải quét ĐẠT / KHÔNG ĐẠT mỗi lượt.
 * - Mã chưa có trong hệ thống: hộp hỏi lại bằng máy quét (quét lại tem = đúng mã NCC) rồi liên kết với biến thể.
 * - Lô đang kiểm lưu tạm trong trình duyệt tới khi khóa; khóa lô thì lưu máy chủ kèm hàng không đạt theo lý do.
 */
export default function KiemDemLo() {
  const { phieuNhapKhoId, bienTheSanPhamId } = useParams();
  // Mỗi (phiếu, biến thể) là một màn mới: bấm "Kiểm tiếp …" sang biến thể khác thì đọc lại đúng lô đang kiểm
  // của biến thể đó, không mang lượt quét / kệ / ngày sản xuất / câu báo của biến thể trước sang.
  return <KiemDemLoNoiDung key={`${phieuNhapKhoId}:${bienTheSanPhamId}`} />;
}

/** Câu báo khi quản lý vừa đổi cách xác nhận chất lượng (Cấu hình › Nhập kho) trong lúc đang kiểm. */
const cauDoiCheDo = (cheDo) =>
  cheDo === CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI
    ? "Cách xác nhận vừa đổi: từ giờ mỗi lượt phải quét thẻ ĐẠT hoặc KHÔNG ĐẠT mới quét tiếp được."
    : "Cách xác nhận vừa đổi: từ giờ quét sản phẩm kế tiếp là lượt trước giữ Đạt; sản phẩm lỗi quét thẻ KHÔNG ĐẠT.";

/** Thời gian dùng lại kết quả kiểm mã vạch NCC với máy chủ (mã bị gỡ / liên kết lại ở máy khác vẫn được phát hiện). */
const KIEM_LAI_MA_NCC_MS = 60_000;

function KiemDemLoNoiDung() {
  useClaimPageTitle(true);
  const { phieuNhapKhoId, bienTheSanPhamId } = useParams();
  const btId = Number(bienTheSanPhamId);
  const navigate = useNavigate();

  const [phieu, setPhieu] = useState(null);
  const [lots, setLots] = useState([]);
  const [loiTai, setLoiTai] = useState(null);
  const [viTris, setViTris] = useState([]);
  const [khuVucs, setKhuVucs] = useState([]);
  const [keTai, setKeTai] = useState("dang");
  const [phien, setPhienState] = useState(null);
  const [thongBao, setThongBao] = useState(null);
  const [anThe, setAnThe] = useState(false);
  const [tab, setTab] = useState("luot");
  const [maQuet, setMaQuet] = useState("");
  const [hopKhoaLo, setHopKhoaLoState] = useState(false);
  const [quetLa, setQuetLaState] = useState(null);
  const [loiQuetKhoa, setLoiQuetKhoa] = useState("");
  const [dangKhoa, setDangKhoa] = useState(false);
  const [loXoa, setLoXoa] = useState(null);
  const [dangXoa, setDangXoa] = useState(false);
  const [moInThe, setMoInThe] = useState(false);
  const [nhacThieu, setNhacThieu] = useState(false);

  const oQuetRef = useRef(null);
  const theRef = useRef(null);
  const phienRef = useRef(null);
  const hopKhoaLoRef = useRef(false);
  const quetLaRef = useRef(null);
  const dangKhoaRef = useRef(false);
  const ctxRef = useRef({});
  const lanTaiRef = useRef(0);
  // Promise kết quả của lần tải mới nhất (lần bị thay chỗ chờ được lần này) và lỗi của lần tải mới nhất bị lỗi
  const taiMoiNhatRef = useRef(null);
  const loiTaiRef = useRef(null);
  // Lúc tải xong lô gần nhất: số trên màn cũ quá thì tải lại trước khi chặn "đã đủ số đặt" (máy khác có thể vừa xóa lô)
  const taiXongLucRef = useRef(0);
  const hopMaChuaCoRef = useRef(null);
  // Mã vạch NCC đã kiểm lại với máy chủ: mã → { bienTheSanPhamId, luc }
  const xacMinhNccRef = useRef(new Map());

  const setPhien = useCallback(
    (moi) => {
      phienRef.current = moi;
      setPhienState(moi);
      // Kèm cách xác nhận của phiếu vừa tải (taiLai gán ctxRef.phieu trước khi khởi tạo phiên): mở lại màn mà quản lý
      // đã đổi cách xác nhận thì báo cho người kiểm
      ghiLoDangKiem(
        phieuNhapKhoId,
        btId,
        moi && (moi.log.length || moi.keId || moi.maLo || moi.nsx)
          ? { ...moi, cheDo: ctxRef.current.phieu?.cheDoXacNhanChatLuong ?? null }
          : null,
      );
    },
    [phieuNhapKhoId, btId],
  );
  const setHopKhoaLo = (mo) => {
    hopKhoaLoRef.current = mo;
    setHopKhoaLoState(mo);
    setNhacThieu(false);
  };
  const setQuetLa = (q) => {
    quetLaRef.current = q;
    setQuetLaState(q);
  };

  const focusQuet = useCallback(() => {
    setTimeout(() => {
      if (!hopKhoaLoRef.current && !quetLaRef.current) oQuetRef.current?.focus();
    }, 30);
  }, []);

  // Lô đang kiểm: đọc lại bản tạm của trình duyệt một lần khi có phiếu; phiếu không còn kiểm đếm thì bỏ bản tạm
  const khoiTaoPhien = useCallback(
    (ct) => {
      const kiemDuoc = ct?.trangThai === 0 && Boolean(ct?.soDonMua) && ct?.items?.some((i) => i.bienTheSanPhamId === btId);
      if (kiemDuoc) {
        const raw = docLoDangKiem(phieuNhapKhoId, btId);
        if (raw?.cheDo && ct.cheDoXacNhanChatLuong && raw.cheDo !== ct.cheDoXacNhanChatLuong && raw.log?.length) {
          setThongBao({ tone: "info", chu: cauDoiCheDo(ct.cheDoXacNhanChatLuong) });
        }
        setPhien(chuanHoaPhien(raw, ""));
      } else {
        phienRef.current = phienMoi();
        setPhienState(phienRef.current);
        ghiLoDangKiem(phieuNhapKhoId, btId, null);
      }
      xoaHangLoiTamCu(phieuNhapKhoId);
    },
    [phieuNhapKhoId, btId, setPhien],
  );

  // ── Tải dữ liệu ──
  const taiLaiLan = useCallback(
    async ({ silent = false, baoLoi = true, theoLanMoi = false } = {}) => {
      // Lần tải về muộn (vd. tải ngầm sau liên kết mã về sau lần tải sau khóa lô) không ghi đè số mới hơn
      const lan = ++lanTaiRef.current;
      // Bị một lần tải bắt đầu sau thay chỗ: trả null. `theoLanMoi`: chờ lấy kết quả lần mới nhất thay vì null
      const biThayCho = () => (theoLanMoi ? ketQuaLanTaiMoiNhat(() => lanTaiRef.current, () => taiMoiNhatRef.current) : null);
      try {
        const [chiTiet, resLo] = await Promise.all([
          phieuNhapKhoService.getDetail(phieuNhapKhoId),
          phieuNhapKhoService.getLotInput(phieuNhapKhoId, btId),
        ]);
        if (lan !== lanTaiRef.current) return biThayCho();
        taiXongLucRef.current = Date.now();
        loiTaiRef.current = null;
        const ct = chiTiet?.data ?? chiTiet;
        const dsLo = Array.isArray(resLo?.data) ? resLo.data : [];
        // Quản lý vừa đổi cách xác nhận chất lượng (Cấu hình › Nhập kho): báo để người kiểm biết cách quét đã khác
        const cheDoCu = ctxRef.current.phieu?.cheDoXacNhanChatLuong;
        if (cheDoCu && ct?.cheDoXacNhanChatLuong && cheDoCu !== ct.cheDoXacNhanChatLuong) {
          setThongBao({ tone: "info", chu: cauDoiCheDo(ct.cheDoXacNhanChatLuong) });
        }
        // Cập nhật ngay cho hàng đợi quét: lượt kế tiếp có thể chạy trước khi màn vẽ lại
        ctxRef.current = { ...ctxRef.current, phieu: ct, lots: dsLo, item: ct?.items?.find((i) => i.bienTheSanPhamId === btId) ?? null };
        setPhieu(ct);
        setLots(dsLo);
        setLoiTai(null);
        if (!phienRef.current) khoiTaoPhien(ct);
        return dsLo;
      } catch (error) {
        if (lan !== lanTaiRef.current) return biThayCho();
        loiTaiRef.current = error;
        if (silent) {
          // `baoLoi` false: nơi gọi tự báo lỗi trong câu của mình (một thông báo cho một lỗi)
          if (baoLoi) toast.error(getApiErrorMessage(error, "Không tải lại được dữ liệu lô hàng"));
          return null;
        }
        const status = getApiErrorStatus(error);
        setLoiTai(status === 400 || status === 404 ? "khong-thay" : getApiErrorMessage(error, "Không tải được dữ liệu kiểm đếm"));
        return null;
      }
    },
    [phieuNhapKhoId, btId, khoiTaoPhien],
  );
  // Mọi lần tải đi qua đây: ghi promise của lần mới nhất để lần tải bị thay chỗ (theoLanMoi) chờ được lần đó
  const taiLai = useCallback(
    (tuyChon) => {
      const p = taiLaiLan(tuyChon);
      taiMoiNhatRef.current = p;
      return p;
    },
    [taiLaiLan],
  );

  useEffect(() => {
    queueMicrotask(() => taiLai());
  }, [taiLai]);

  const khoId = phieu?.khoId;
  const lanTaiKeRef = useRef(0);
  const taiKe = useCallback(async () => {
    if (!khoId) return;
    // Lần tải về muộn (vd. tải khi quay lại thẻ về sau lần tải sau khóa lô) không ghi đè chỗ trống mới hơn
    const lan = ++lanTaiKeRef.current;
    try {
      const [ds, khu] = await Promise.all([viTriKhoService.dsViTri(khoId), viTriKhoService.dsKhuVuc(khoId)]);
      if (lan !== lanTaiKeRef.current) return;
      ctxRef.current = { ...ctxRef.current, viTris: ds ?? [], keTai: "xong" };
      setViTris(ds ?? []);
      setKhuVucs(khu ?? []);
      setKeTai("xong");
    } catch {
      if (lan !== lanTaiKeRef.current) return;
      ctxRef.current = { ...ctxRef.current, keTai: "loi" };
      setKeTai("loi");
    }
  }, [khoId]);
  useEffect(() => {
    queueMicrotask(() => taiKe());
  }, [taiKe]);

  // Kho đang chọn (header kho_id): khóa lô chỉ nhận phiếu thuộc đúng kho này (quản trị viên được mọi kho)
  const [khoDangChonId, setKhoDangChonId] = useState(getKhoLamViecId);
  useEffect(() => {
    const nghe = (event) => setKhoDangChonId(event.detail ?? null);
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, []);

  const item = phieu?.items?.find((i) => i.bienTheSanPhamId === btId) ?? null;
  const laDonMua = Boolean(phieu?.soDonMua);
  const kiemDuoc = phieu?.trangThai === 0 && laDonMua && Boolean(item);
  // Phiếu của kho khác kho đang chọn: chưa cho quét (tới lúc khóa lô máy chủ mới từ chối, mất công đếm)
  const saiKho = kiemDuoc && !hasAnyRole([ROLES.QUAN_TRI_VIEN]) && phieu.khoId != null && khoDangChonId !== phieu.khoId;
  const choSua = kiemDuoc && !saiKho;

  // ── Số liệu ──
  const p = phien ?? phienMoi();
  const canNhap = Number(item?.soLuongCanNhap || 0);
  const datKhoa = lots.reduce((s, l) => s + Number(l.soLuongNhap || 0), 0);
  const loiKhoa = lots.reduce((s, l) => s + Number(l.soLuongLoi || 0), 0);
  const t = tinh(p, { canNhap, datKhoa, loiKhoa });
  const maLoDaCo = useMemo(() => lots.map((l) => l.maLo), [lots]);
  const maLoGoiY = phieu ? goiYMaLo(phieu.soPhieuNhap, maLoDaCo, phieu.tienToMaLo) : "";
  const coKe = keTai === "loi" || coKeHoatDong(viTris);
  const homNay = ngayHomNay();
  const dk = dieuKienKhoaLo(p, { t, viTris, coKe, keDangTai: keTai === "dang", maLoGoiY, maLoDaCo, homNay });
  const cur = luotHienTai(p);
  const cheDo = phieu?.cheDoXacNhanChatLuong === CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI ? CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI : CHE_DO_XAC_NHAN.QUET_TIEP_LA_DAT;

  // Dữ liệu mới nhất cho hàng đợi quét (đọc trong xử lý sự kiện, không đọc lúc vẽ). Gán sau khi vẽ xong, trước khi
  // trình duyệt nhận sự kiện kế tiếp; các lần tải (taiLai / taiKe) tự cập nhật ngay phần của mình.
  useLayoutEffect(() => {
    ctxRef.current = { phieu, item, lots, viTris, keTai, t, dk, cheDo, choSua };
  });

  // ── Báo ──
  const bao = useCallback(
    (tone, chu, bip = tone === "bad" || tone === "warn" ? "sai" : null) => {
      setThongBao({ tone, chu });
      if (bip) bipKiemDem(bip);
      focusQuet();
    },
    [focusQuet],
  );

  const tinhHienTai = () => {
    const c = ctxRef.current;
    const kd = (c.lots ?? []).reduce((s, l) => s + Number(l.soLuongNhap || 0), 0);
    const kl = (c.lots ?? []).reduce((s, l) => s + Number(l.soLuongLoi || 0), 0);
    return tinh(phienRef.current, { canNhap: Number(c.item?.soLuongCanNhap || 0), datKhoa: kd, loiKhoa: kl });
  };

  // Điều kiện khóa lô tính từ dữ liệu mới nhất (hàng đợi quét có thể chạy trước khi màn vẽ lại)
  const dieuKienHienTai = () => {
    const c = ctxRef.current;
    const maLoDaCoNay = (c.lots ?? []).map((l) => l.maLo);
    return dieuKienKhoaLo(phienRef.current, {
      t: tinhHienTai(),
      viTris: c.viTris ?? [],
      coKe: c.keTai === "loi" || coKeHoatDong(c.viTris),
      keDangTai: c.keTai === "dang",
      maLoGoiY: goiYMaLo(c.phieu.soPhieuNhap, maLoDaCoNay, c.phieu.tienToMaLo),
      maLoDaCo: maLoDaCoNay,
      homNay: ngayHomNay(),
    });
  };

  const themVaoLo = async (ma, nguon, soLuong) => {
    let tt = tinhHienTai();
    // Sắp chặn / cắt bớt vì "đủ số đặt" mà số lô trên màn đã cũ: tải lại trước (máy khác có thể vừa xóa lô)
    if (tt.conLai < (soLuong ?? 1) && Date.now() - taiXongLucRef.current > 5000) {
      await taiLai({ silent: true });
      tt = tinhHienTai();
    }
    if (tt.conLai <= 0) {
      bao("warn", `Đã đủ ${formatNumber(tt.can)} sản phẩm theo đơn mua. Sản phẩm thừa để riêng và báo quản lý kho.`);
      return;
    }
    const kq = themLuot(phienRef.current, { ma, nguon, soLuong, conLai: tt.conLai, cheDo: ctxRef.current.cheDo, gio: gio() });
    setPhien(kq.phien);
    setAnThe(false);
    setThongBao(null);
    bipKiemDem("ok");
    focusQuet();
  };

  const suaLuot = (bienDoi, bip) => {
    if (dangKhoaRef.current || !luotHienTai(phienRef.current)) return;
    setPhien(bienDoi(phienRef.current));
    setAnThe(false);
    setThongBao(null);
    if (bip) bipKiemDem(bip);
    focusQuet();
  };

  const hoanTac = (id) => {
    if (dangKhoaRef.current) return;
    const kq = hoanTacLuot(phienRef.current, id);
    if (!kq.luot) return;
    setPhien(kq.phien);
    setThongBao({ tone: "neutral", chu: `Đã hoàn tác lượt quét ${kq.luot.ma} (${formatNumber(kq.luot.sl)} cái).` });
    bipKiemDem("loi");
    focusQuet();
  };

  // ── Khóa lô ──
  const khoaLo = async () => {
    if (dangKhoaRef.current) return;
    // Lần khóa trước không rõ kết quả (mất phản hồi, tải lại cũng lỗi): đối chiếu với danh sách lô VỪA tải lại, không
    // với danh sách trên màn (có thể còn cũ, người kiểm có thể đã gõ mã lô khác). Tải lại lỗi thì chưa biết lần trước
    // đã được lưu hay chưa: không gửi lần khóa mới (doiChieuKhoaChuaRo trả "chua-kiem"), giữ nguyên các lượt.
    let dsDoiChieu = ctxRef.current.lots;
    if (phienRef.current?.khoaChuaRo) {
      dangKhoaRef.current = true;
      setDangKhoa(true);
      try {
        // Lần tải này bị lần tải khác chen vào thay chỗ (quay lại thẻ, liên kết mã, xóa lô) thì lấy kết quả lần đó, không
        // coi là tải lỗi. Không bật thông báo lỗi tải: câu "chưa tải được" bên dưới đã báo
        dsDoiChieu = await taiLai({ silent: true, baoLoi: false, theoLanMoi: true });
      } finally {
        dangKhoaRef.current = false;
        setDangKhoa(false);
      }
    }
    // Đọc sau khi tải lại: số đã khóa, mã lô gợi ý, mã lô đã có theo danh sách mới nhất
    const ph = phienRef.current;
    const tt = tinhHienTai();
    const dieuKien = dieuKienHienTai();
    const keGui = tt.datLo > 0 && dieuKien.ke ? dieuKien.ke : null;
    // `dem`: lượt có id nhỏ hơn là lượt nằm trong lần khóa này (đối chiếu khi lần này mất phản hồi)
    const lanNay = { maLo: dieuKien.maLo, dat: tt.datLo, loi: tt.loiLo, keId: keGui?.id ?? null, nsx: ph.nsx, dem: ph.dem };
    const nhomLoi = nhomLoiTheoLyDo(ph.log);
    // Lô đã khóa trước lần này (để nhận ra lô bị xóa ở máy khác khi tải lại). Bỏ lô tạm vừa khóa mà chưa tải lại
    // được (chưa có id dòng): lô đó không có id thật để so, không phải lô bị xóa.
    const loTruoc = (ctxRef.current.lots ?? [])
      .filter((l) => l.chiTietPhieuNhapKhoId)
      .map((l) => ({ id: l.chiTietPhieuNhapKhoId, maLo: l.maLo }));

    // Kệ theo id (lần khóa trước có thể dùng kệ khác kệ đang chọn)
    const keTheoId = (id) => (id == null ? null : (ctxRef.current.viTris ?? []).find((v) => v.id === id) ?? null);

    // Lô vừa lưu (`lan`: lần khóa đã lưu — lần này, hoặc lần trước không rõ kết quả) vào danh sách nếu chưa có, rồi
    // mới về 0 bộ đếm và xóa bản tạm: tiến độ không tụt, tải lại trang giữa chừng không hiện lại các lượt đã khóa.
    const chotLo = (lan = lanNay) => {
      const hoa = (v) => String(v ?? "").trim().toUpperCase();
      if (!(ctxRef.current.lots ?? []).some((l) => hoa(l.maLo) === hoa(lan.maLo))) {
        const loTam = {
          loHangId: `tam-${lan.maLo}`,
          maLo: lan.maLo,
          soLuongNhap: lan.dat,
          soLuongLoi: lan.loi,
          maViTri: keTheoId(lan.keId)?.maViTri ?? null,
          viTriKhoId: lan.keId,
          ngaySanXuat: lan.nsx,
          chiTietLoi: nhomLoi,
        };
        const ds = [...(ctxRef.current.lots ?? []), loTam];
        ctxRef.current = { ...ctxRef.current, lots: ds };
        setLots(ds);
      }
      // Bộ đếm về 0; giữ ngày sản xuất, giữ kệ nếu còn chỗ cho thùng sau
      const conSau = dieuKien.ke ? conTrongKe(dieuKien.ke) : null;
      const giuKe = dieuKien.ke && (conSau === null || conSau - tt.datLo > 0);
      setPhien({ ...phienMoi(ph.nsx), dem: ph.dem, keId: giuKe ? dieuKien.ke.id : null });
      setHopKhoaLo(false);
      setLoiQuetKhoa("");
    };
    // Câu báo tính theo số mới nhất sau khi tải lại (lô máy khác vừa khóa / xóa)
    const baoDaKhoa = (dsMoi, ghiChuThem = "", lan = lanNay) => {
      const ttSau = tinhHienTai();
      const conId = new Set((dsMoi ?? []).map((l) => l.chiTietPhieuNhapKhoId ?? l.loHangId));
      const biXoa = dsMoi ? loTruoc.filter((l) => !conId.has(l.id)).map((l) => l.maLo) : [];
      const ke = lan.dat > 0 ? keTheoId(lan.keId) : null;
      setThongBao({
        tone: biXoa.length ? "warn" : "ok",
        chu:
          `Đã khóa lô ${lan.maLo}: ${formatNumber(lan.dat)} đạt${ke ? ` tại kệ ${ke.maViTri}` : ""}` +
          `${lan.loi ? `, ${formatNumber(lan.loi)} không đạt để ở khu chờ trả NCC` : ""}.` +
          ghiChuThem +
          (biXoa.length ? ` Lô ${biXoa.join(", ")} vừa bị xóa ở máy khác, còn thiếu ${formatNumber(ttSau.conLai)}.` : "") +
          // Kiểm đủ thì nhãn trạng thái và tiến độ đã nói; chưa đủ thì nhắc bước tiếp theo
          (ttSau.conLai > 0 && !biXoa.length ? " Bộ đếm về 0 cho thùng tiếp theo." : ""),
      });
      bipKiemDem(biXoa.length ? "sai" : "ok");
    };

    // Lần khóa trước không rõ kết quả (mất phản hồi) mà máy chủ thực ra đã lưu đúng lô đó: lô đang kiểm vẫn đúng các
    // lượt của lần đó thì không gửi lại (lô trùng, đếm gấp đôi); đã quét thêm / hoàn tác mà còn lượt của lần đó thì chặn
    const doiChieu = (ds) => doiChieuKhoaChuaRo(ph, ds, lanNay);
    const daLuuTruoc = (ds) => doiChieu(ds) === "da-luu";
    const cauLanTruoc = (lan) =>
      `Lô ${lan.maLo} đã được lưu ở lần khóa trước (lúc mất phản hồi) với ${formatNumber(lan.dat)} đạt, ${formatNumber(lan.loi)} không đạt. ` +
      "Xem tab Lô đã khóa, hoàn tác các lượt đã nằm trong lô đó rồi khóa phần còn lại.";
    const kqTruoc = doiChieu(dsDoiChieu);
    if (kqTruoc === "chua-kiem") {
      // Máy chủ trả lỗi (403 đổi nơi làm việc, 404 phiếu bị hủy…) thì kèm câu của máy chủ; mất mạng thì không có
      const loi = loiTaiRef.current;
      const chu = cauChuaKiemKhoaChuaRo(ph.khoaChuaRo.maLo, getApiErrorStatus(loi) != null ? getApiErrorMessage(loi, "") : "");
      if (hopKhoaLoRef.current) setLoiQuetKhoa(chu);
      setThongBao({ tone: "bad", chu });
      bipKiemDem("sai");
      focusQuet();
      return;
    }
    if (kqTruoc === "da-luu") {
      // Lô đã lưu là lô của lần trước (mã lô gợi ý lúc này có thể đã nhảy sang số kế tiếp): báo và chốt theo lần đó
      chotLo(ph.khoaChuaRo);
      baoDaKhoa(ctxRef.current.lots, " (máy chủ đã lưu lô ở lần khóa trước)", ph.khoaChuaRo);
      return;
    }
    if (kqTruoc === "chan") {
      // Mã lô gợi ý đã nhảy sang số kế tiếp: khóa lúc này là gửi lại cả các lượt đã nằm trong lô của lần trước
      const chu = cauLanTruoc(ph.khoaChuaRo);
      if (hopKhoaLoRef.current) setLoiQuetKhoa(chu);
      setThongBao({ tone: "bad", chu });
      bipKiemDem("sai");
      focusQuet();
      return;
    }

    // Chưa đủ điều kiện: nơi gọi quyết định (mở hộp Khóa lô, hoặc làm nổi dòng còn thiếu trong hộp)
    if (!dieuKien.ok) return "chua-du";
    dangKhoaRef.current = true;
    setDangKhoa(true);

    try {
      await phieuNhapKhoService.khaiBaoLo(phieuNhapKhoId, {
        bienTheSanPhamId: btId,
        maLo: lanNay.maLo,
        ngaySanXuat: `${ph.nsx}T00:00:00.000Z`,
        soLuongNhap: lanNay.dat,
        soLuongLoi: lanNay.loi,
        chiTietLoi: nhomLoi,
        taoMoi: true,
        ...(keGui ? { viTriKhoId: keGui.id } : {}),
      });
      chotLo();
      const [dsMoi] = await Promise.all([taiLai({ silent: true }), taiKe()]);
      baoDaKhoa(dsMoi);
    } catch (error) {
      const status = getApiErrorStatus(error);
      const [dsMoi] = await Promise.all([taiLai({ silent: true }), taiKe()]);
      // Chỉ khi KHÔNG biết kết quả (mất phản hồi, hết giờ chờ, lỗi cổng 5xx) máy chủ mới có thể đã lưu lô. Thấy lô
      // trùng đủ mã, số, kệ, ngày sản xuất thì chính lần khóa này đã thành công: không khóa lại thành lô trùng.
      // Máy chủ đã trả 4xx (vd. 409 "mã lô đã có" vì máy khác vừa khóa đúng mã đó) thì lần này KHÔNG được lưu —
      // trừ khi đó chính là lô của lần khóa trước trên máy này (lần đó mất phản hồi, tải lại cũng lỗi).
      const khongRoKetQua = status == null || status >= 500;
      const daLuuLanNay = khongRoKetQua && (dsMoi ?? []).some((l) => khopLanKhoa(l, lanNay));
      const lanDaLuu = daLuuLanNay ? lanNay : daLuuTruoc(dsMoi) ? ph.khoaChuaRo : null;
      if (lanDaLuu) {
        chotLo(lanDaLuu);
        baoDaKhoa(dsMoi, " (máy chủ đã lưu lô trước khi mất phản hồi)", lanDaLuu);
      } else {
        // Không rõ kết quả mà chưa thấy lô (tải lại cũng lỗi): ghi nhớ lần khóa này trong bản tạm để lần sau đối chiếu.
        // Ghi đè lần trước không làm mất dấu: lần này chỉ được gửi sau khi lần trước đã đối chiếu với danh sách vừa tải
        // (đầu hàm). Lô của lần trước đã thấy trên máy chủ mà còn lượt của lần đó: giữ lần trước để lần sau vẫn bị chặn.
        if (khongRoKetQua && doiChieu(dsMoi) !== "chan") setPhien({ ...phienRef.current, khoaChuaRo: lanNay });
        const hoa = (v) => String(v ?? "").trim().toUpperCase();
        // Số liệu vừa tải lại giải thích lỗi (máy khác vừa khóa thêm, kệ hết chỗ…): báo theo số mới, không lặp câu cũ
        const dkMoi = dieuKienHienTai();
        const loCungMa = dsMoi?.find((l) => hoa(l.maLo) === hoa(lanNay.maLo)) ?? null;
        const mayKhacDaKhoaMa = Boolean(loCungMa);
        // Lô trùng mã chỉ là lô của lần khóa trước trên máy này (mất phản hồi, số đã đổi sau đó do hoàn tác / quét thêm)
        // khi trùng đủ số, kệ, ngày của lần đó và còn lượt của lần đó. Chỉ trùng mã là lô máy khác vừa khóa (lần trước
        // không được lưu): không bảo hoàn tác các lượt.
        const cuaLanTruoc = mayKhacDaKhoaMa && khopLanKhoa(loCungMa, ph.khoaChuaRo) && doiChieu(dsMoi) === "chan";
        const cauMayKhac = !mayKhacDaKhoaMa
          ? ""
          : cuaLanTruoc
            ? cauLanTruoc({ ...ph.khoaChuaRo, maLo: lanNay.maLo })
            : `Máy khác vừa khóa lô ${lanNay.maLo}, lô đang kiểm chưa được lưu và vẫn giữ các lượt quét.` +
              (dkMoi.ok ? ` Mã lô đổi sang ${dkMoi.maLo}: quét KHÓA LÔ để khóa.` : "");
        const chu = mayKhacDaKhoaMa
          ? `${cauMayKhac}${!dkMoi.ok && dkMoi.loi.length ? ` ${dkMoi.loi[0]}` : ""}`
          : dkMoi.loi.length
            ? dkMoi.loi[0]
            : getApiErrorMessage(error, "Không khóa được lô");
        // Trong hộp: câu điều kiện khóa (dk.loi) đã hiện ở dòng riêng, dòng lỗi quét không lặp lại câu đó
        if (hopKhoaLoRef.current) setLoiQuetKhoa(mayKhacDaKhoaMa ? cauMayKhac : dkMoi.loi.length ? "" : chu);
        setThongBao({ tone: "bad", chu });
        bipKiemDem("sai");
      }
    } finally {
      dangKhoaRef.current = false;
      setDangKhoa(false);
      focusQuet();
    }
  };

  const moHopKhoaLo = () => {
    setLoiQuetKhoa("");
    setHopKhoaLo(true);
  };

  // ── Quét kệ ──
  const quetKe = (ke) => {
    const kt = keDungDuoc(ke, 0);
    if (!kt.duoc) {
      bao("bad", cauKeKhongDuoc(ke, kt));
      return;
    }
    const tt = tinhHienTai();
    const con = conTrongKe(ke);
    setPhien({ ...phienRef.current, keId: ke.id });
    // Mã kệ, khu, chỗ trống đã hiện ở "Kệ cho hàng đạt": câu báo chỉ nói bước tiếp theo
    if (con !== null && tt.datLo > con) {
      setThongBao({ tone: "warn", chu: "Đã chọn kệ nhưng kệ không đủ chỗ cho hàng đạt của lô này. Quét kệ khác." });
    } else {
      setThongBao({ tone: "info", chu: "Đã chọn kệ cho hàng đạt. Quét thẻ KHÓA LÔ để khóa." });
    }
    bipKiemDem("ok");
    if (tt.trongLo > 0) moHopKhoaLo();
    else focusQuet();
  };

  // Quét trong hộp Khóa lô: chỉ nhận mã kệ, KHÓA LÔ, HOÀN TÁC (đóng hộp)
  const quetTrongHopKhoaLo = async (raw) => {
    const hoa = String(raw).trim().toUpperCase();
    if (!hoa) return;
    if (hoa === THE_LENH.KHOA_LO) {
      if ((await khoaLo()) !== "chua-du") return;
      // Lý do chưa khóa được đã hiện trong hộp (dòng lỗi / "Còn thiếu"): chỉ làm nổi lên, không lặp lại câu
      setLoiQuetKhoa("");
      setNhacThieu(true);
      bipKiemDem("sai");
      return;
    }
    if (hoa === THE_LENH.HOAN_TAC) {
      setHopKhoaLo(false);
      focusQuet();
      return;
    }
    const ke = ctxRef.current.viTris.find((v) => String(v.maViTri).toUpperCase() === hoa);
    if (!ke) {
      setLoiQuetKhoa("Đang khóa lô: chỉ nhận mã kệ hoặc thẻ KHÓA LÔ. Muốn quét tiếp sản phẩm thì bấm Hủy.");
      bipKiemDem("sai");
      return;
    }
    const kt = keDungDuoc(ke, 0);
    if (!kt.duoc) {
      setLoiQuetKhoa(cauKeKhongDuoc(ke, kt));
      bipKiemDem("sai");
      return;
    }
    setPhien({ ...phienRef.current, keId: ke.id });
    setLoiQuetKhoa("");
    bipKiemDem("ok");
  };

  // ── Thẻ lệnh ──
  const xuLyLenh = async (lenh, hoa) => {
    const ph = phienRef.current;
    const c = luotHienTai(ph);
    switch (lenh.loai) {
      case "KHONG_DAT":
        if (!c) return bao("bad", "Quét sản phẩm trước rồi mới quét thẻ KHÔNG ĐẠT.");
        return suaLuot(thanhKhongDat, "loi");
      case "DAT":
        if (!c) return bao("info", "Chưa có lượt quét nào để xác nhận.");
        return suaLuot(thanhDat, "ok");
      case "LY_DO":
        if (!c || c.kq !== "loi") return bao("bad", "Thẻ lý do chỉ dùng sau thẻ KHÔNG ĐẠT.");
        return suaLuot((x) => chonLyDo(x, LY_DO_LOI[lenh.soLyDo - 1]), "ok");
      case "HOAN_TAC": {
        const dich = luotDeHoanTac(ph);
        if (!dich) return bao("info", "Không còn lượt quét nào trong lô đang kiểm để hoàn tác.");
        return hoanTac(dich.id);
      }
      case "KHOA_LO": {
        const tt = tinhHienTai();
        // Lượt chưa chọn kết quả / lý do: chọn trên thẻ trước (trong hộp Khóa lô không chọn lý do được)
        const choChon = luotDangCho(ph);
        if (choChon) {
          setAnThe(false);
          return bao("bad", cauChanLuot(choChon));
        }
        if ((await khoaLo()) !== "chua-du") return;
        if (tt.trongLo > 0) return moHopKhoaLo();
        // Quét KHÓA LÔ lần nữa sau khi vừa khóa: không biến câu "Đã khóa lô" thành lỗi
        return bao("info", "Lô đang kiểm chưa có sản phẩm nào. Quét sản phẩm của thùng tiếp theo.", null);
      }
      default:
        return bao("bad", `Thẻ lệnh ${hoa} không có trong hệ thống.`);
    }
  };

  // ── Một lần quét ở ô chính ──
  const xuLyMa = async ({ raw, nguonGhi, soLuong }) => {
    const ctx = ctxRef.current;
    if (!ctx.choSua || !ctx.item) return;
    if (hopKhoaLoRef.current) return quetTrongHopKhoaLo(raw);
    // Hộp "Mã chưa có" đang mở (máy quét bắn liền mã sau): đưa mã vào hộp, không bỏ lặng lẽ
    if (quetLaRef.current) {
      hopMaChuaCoRef.current?.nhanMa(raw);
      return;
    }
    const tach = tachSoLuong(raw);
    const ma = tach.ma;
    if (tach.loi) return bao("bad", tach.loi);
    const sl = soLuong ?? tach.soLuong;
    if (!ma) return bao("bad", "Chưa có mã. Quét hoặc nhập mã rồi nhấn Enter.");
    const hoa = ma.toUpperCase();

    const lenh = docTheLenh(hoa, LY_DO_LOI.length);
    if (lenh) return xuLyLenh(lenh, hoa);
    if (!kyTuHopLe(ma)) {
      return bao("bad", `Mã “${ma}” có ký tự không có trên tem mã vạch (chữ có dấu hoặc khoảng trắng). Nếu gõ tay, hãy kiểm tra lại mã.`);
    }
    const cho = luotDangCho(phienRef.current);
    if (cho) {
      // Lượt đang chờ quyết định: hiện lại thẻ (nếu đã ẩn / đang xem tab khác) để chọn ngay trên thẻ
      setAnThe(false);
      return bao("bad", cauChanLuot(cho));
    }

    const ke = ctx.viTris.find((v) => String(v.maViTri).toUpperCase() === hoa);
    if (ke) return quetKe(ke);

    let tt = tinhHienTai();
    if (tt.xong && Date.now() - taiXongLucRef.current > 5000) {
      // Số lô trên màn đã cũ: máy khác có thể vừa xóa lô, tải lại trước khi báo đã kiểm đủ
      await taiLai({ silent: true });
      tt = tinhHienTai();
    }
    if (tt.xong) return bao("info", `Biến thể này đã kiểm đủ ${formatNumber(tt.can)}. Chuyển sang biến thể tiếp theo.`, "sai");

    const nguonTheoMa = () => {
      if (hoa === String(ctx.item.sku).toUpperCase()) return "quét SKU";
      if (ctx.item.maVachSku && hoa === String(ctx.item.maVachSku).toUpperCase()) return "quét mã vạch FCentric";
      return "quét mã vạch NCC";
    };
    const laMaFcentric = hoa === String(ctx.item.sku).toUpperCase() || (ctx.item.maVachSku && hoa === String(ctx.item.maVachSku).toUpperCase());
    if (maCuaBienThe(ctx.item).includes(hoa)) {
      if (laMaFcentric || nguonGhi) return themVaoLo(hoa === String(ctx.item.sku).toUpperCase() ? ctx.item.sku : ma, nguonGhi ?? nguonTheoMa(), sl);
      // Mã vạch NCC lấy từ lúc mở màn: có thể vừa bị gỡ / liên kết lại ở máy khác. Kiểm lại với máy chủ (nhớ 60 giây)
      const daKiem = xacMinhNccRef.current.get(hoa);
      if (daKiem && Date.now() - daKiem.luc < KIEM_LAI_MA_NCC_MS && daKiem.bienTheSanPhamId === btId) {
        return themVaoLo(ma, nguonTheoMa(), sl);
      }
      let kqNcc = null;
      try {
        kqNcc = await maVachNhaCungCapService.tra(ma, ctx.phieu.nhaCungCapId);
      } catch {
        // Mất kết nối: vẫn tính theo danh sách đã có để không dừng việc kiểm đếm
        return themVaoLo(ma, `${nguonTheoMa()} (chưa kiểm lại được với máy chủ)`, sl);
      }
      if (kqNcc?.timThay && kqNcc.bienTheSanPhamId === btId) {
        xacMinhNccRef.current.set(hoa, { bienTheSanPhamId: btId, luc: Date.now() });
        return themVaoLo(ma, nguonTheoMa(), sl);
      }
      // Liên kết đã đổi: bỏ khỏi danh sách mã của biến thể và tải lại phiếu ngầm, rồi xử lý như mã từ máy chủ
      xacMinhNccRef.current.delete(hoa);
      taiLai({ silent: true });
      return xuLyKetQuaTra(ma, kqNcc, sl, nguonGhi);
    }

    const khac = ctx.phieu.items.find((i) => i.bienTheSanPhamId !== btId && maCuaBienThe(i).includes(hoa));
    if (khac) return bao("bad", `Mã ${ma} là của ${tenDayDu(khac)} (cùng phiếu), không phải biến thể đang kiểm. Để riêng sản phẩm này.`);

    // Không khớp gì trong phiếu: hỏi máy chủ (SKU / mã vạch FCentric ngoài phiếu, mã NCC liên kết với biến thể ngoài phiếu)
    let kq;
    try {
      kq = await maVachNhaCungCapService.tra(ma, ctx.phieu.nhaCungCapId);
    } catch (error) {
      return bao("bad", getApiErrorMessage(error, `Không tra được mã ${ma}. Kiểm tra kết nối rồi quét lại`));
    }
    // Danh sách kệ chưa tải xong: mã kệ trông như mã lạ, đừng mở hộp liên kết mã vạch sản phẩm
    if (!kq?.timThay && ctxRef.current.keTai === "dang") {
      return bao("warn", `Đang tải danh sách kệ. Nếu ${ma} là mã kệ, quét lại sau giây lát.`);
    }
    return xuLyKetQuaTra(ma, kq, sl, nguonGhi);
  };

  // Lấy phần đang có ở ô quét chính và xóa ô ngay trên DOM (phím đến tiếp theo bắt đầu từ ô trống)
  const layVaXoaOQuet = () => {
    const o = oQuetRef.current;
    const v = o?.value ?? "";
    if (o) o.value = "";
    setMaQuet("");
    return v;
  };

  // Kết quả máy chủ tra một mã không khớp danh sách mã của phiếu đang có trên màn
  const xuLyKetQuaTra = (ma, kq, sl, nguonGhi) => {
    const ctx = ctxRef.current;
    if (kq?.timThay) {
      if (kq.bienTheSanPhamId === btId) return themVaoLo(ma, nguonGhi ?? (kq.loaiMa === "NCC" ? "quét mã vạch NCC" : "quét mã FCentric"), sl);
      const trongPhieu = ctx.phieu.items.find((i) => i.bienTheSanPhamId === kq.bienTheSanPhamId);
      if (trongPhieu) return bao("bad", `Mã ${ma} là của ${tenDayDu(trongPhieu)} (cùng phiếu), không phải biến thể đang kiểm. Để riêng sản phẩm này.`);
      const ten = [kq.tenBienThe, kq.mauSac, kq.kichCo].filter(Boolean).join(" · ");
      return bao(
        "bad",
        kq.loaiMa === "NCC"
          ? `Mã ${ma} đã liên kết với ${ten} (${kq.sku}), không có trong phiếu nhập này. Để riêng và báo quản lý kho.`
          : `Mã ${ma} là SKU của ${ten}, không có trong phiếu nhập này. Để riêng và báo quản lý kho.`,
      );
    }
    bipKiemDem("sai");
    setThongBao(null);
    // Phần mã máy quét đã gõ tiếp vào ô chính trong lúc chờ tra: chuyển sang ô quét của hộp để ghép đủ.
    // Xóa ngay trên ô (không chờ React vẽ lại): phím đến sau đó không ghép lại phần vừa lấy (ký tự bị nhân đôi).
    const dangGo = layVaXoaOQuet();
    setQuetLa({ ma, sl, lan: Date.now(), dangGo });
  };

  const xuLy = async (viec) => {
    if (viec.loai === "khoaLo") {
      // Nút Khóa lô trong hộp: chưa đủ điều kiện thì làm nổi dòng còn thiếu, không im lặng
      if ((await khoaLo()) === "chua-du") {
        setNhacThieu(true);
        bipKiemDem("sai");
      }
      return;
    }
    if (viec.loai === "them") return themVaoLo(viec.ma, viec.nguon, viec.soLuong);
    return xuLyMa(viec);
  };
  const { enqueue } = useScanQueue(xuLy);

  // Con trỏ rơi khỏi ô quét (bấm vào chỗ trống, đóng hộp xác nhận…) mà máy quét bắn mã: đưa phím về ô quét thay vì
  // để mã mất lặng lẽ. Không đụng khi đang gõ ở ô nhập khác hoặc đang mở hộp thoại.
  useEffect(() => {
    if (!choSua) return undefined;
    const khiGoPhim = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1 || e.key === " ") return;
      const o = oQuetRef.current;
      const dich = e.target;
      if (!o || dich === o) return;
      if (dich instanceof HTMLElement && (dich.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(dich.tagName))) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      o.focus();
      setMaQuet((v) => v + e.key);
    };
    document.addEventListener("keydown", khiGoPhim);
    return () => document.removeEventListener("keydown", khiGoPhim);
  }, [choSua]);

  // Màn thấp (máy quét cầm tay): thẻ kết quả dính đáy màn có thể che ô quét. Sau mỗi lượt / câu báo, nếu ô quét bị thẻ
  // che thì cuộn để ô quét nằm ngay trên cùng (thẻ ở đáy, ô quét ở đầu — người kiểm thấy cả hai).
  // Thẻ đổi chiều cao (Đạt → Không đạt hiện lý do, câu báo lỗi trên thẻ) cũng phải kiểm lại, không chỉ khi sang lượt mới.
  const luotHienTaiId = phien?.cur ?? null;
  useEffect(() => {
    const the = theRef.current;
    if (!the) return undefined;
    let id = 0;
    const kiem = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(() => {
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
      cancelAnimationFrame(id);
      theoDoi?.disconnect();
    };
  }, [luotHienTaiId, thongBao, anThe, hopKhoaLo, quetLa]);

  // Lô đang kiểm chưa khóa chỉ nằm trong thẻ trình duyệt này: đóng thẻ / tải trang thì hỏi lại
  const coLuotChuaKhoa = choSua && Boolean(phien?.log?.some((e) => !e.huy));
  useEffect(() => {
    if (!coLuotChuaKhoa) return undefined;
    const khiRoiTrang = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", khiRoiTrang);
    return () => window.removeEventListener("beforeunload", khiRoiTrang);
  }, [coLuotChuaKhoa]);

  // Quay lại thẻ / cửa sổ: tải ngầm lô và kệ (lô do máy khác khóa / xóa, mã NCC vừa gỡ hiện ra ngay)
  useTaiLaiKhiQuayLai(
    () => {
      xacMinhNccRef.current.clear();
      taiLai({ silent: true });
      taiKe();
    },
    { bat: Boolean(phieu) && !dangKhoa },
  );

  const nhanMa = (e) => {
    e.preventDefault();
    if (!choSua) return;
    enqueue({ raw: maQuet });
    setMaQuet("");
    oQuetRef.current?.focus();
  };

  // ── Hộp mã chưa có ──
  const nhanBiet = (ma) => {
    const hoa = String(ma).trim().toUpperCase();
    if (phieu?.items?.some((i) => maCuaBienThe(i).includes(hoa))) return "san-pham";
    if (viTris.some((v) => String(v.maViTri).toUpperCase() === hoa)) return "ke";
    return null;
  };
  const ungVienGanGiong = useMemo(
    () =>
      (phieu?.items ?? []).flatMap((i) => {
        const nhan = `${[i.mauSac, i.kichCo].filter(Boolean).join(" · ")}${i.bienTheSanPhamId === btId ? " · đang kiểm" : ""}`;
        return [
          { ma: i.sku, nhan: `SKU · ${nhan}` },
          ...(i.maVachSku ? [{ ma: i.maVachSku, nhan: `Mã vạch FCentric · ${nhan}` }] : []),
          ...(i.maVachNcc ?? []).map((m) => ({ ma: m, nhan: `Mã vạch NCC · ${nhan}` })),
        ];
      }),
    [phieu, btId],
  );
  const dongHopMaChuaCo = (lyDo) => {
    const q = quetLaRef.current;
    setQuetLa(null);
    // Phím lọt vào ô chính trước khi hộp kịp lấy con trỏ thuộc về lần quét đã xử lý trong hộp: bỏ, không ghép vào lần sau
    setMaQuet("");
    if (lyDo && q) {
      setThongBao({ tone: "neutral", chu: `${lyDo} mã ${q.ma}, lượt này không được tính. Quét lại sản phẩm hoặc nhập SKU in trên tem FCentric.` });
    }
    focusQuet();
  };
  const dungMa = (ma, nguon) => {
    const q = quetLaRef.current;
    setQuetLa(null);
    setMaQuet("");
    focusQuet();
    enqueue({ raw: ma, nguonGhi: nguon, soLuong: q?.sl ?? 1 });
  };
  const lienKetMa = async ({ bienTheSanPhamId, maHangNcc }) => {
    const q = quetLaRef.current;
    if (!q) return;
    try {
      await maVachNhaCungCapService.lienKet({
        maVach: q.ma,
        maHangNcc: maHangNcc || undefined,
        nhaCungCapId: phieu.nhaCungCapId,
        bienTheSanPhamId,
        phieuNhapKhoId: Number(phieuNhapKhoId),
      });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Không liên kết được mã vạch. Vui lòng thử lại."));
    }
    // Cập nhật ngay danh sách mã của biến thể để lần quét sau nhận luôn, rồi tải lại phiếu ngầm
    const capNhat = {
      ...phieu,
      items: phieu.items.map((i) => (i.bienTheSanPhamId === bienTheSanPhamId ? { ...i, maVachNcc: [...(i.maVachNcc ?? []), q.ma] } : i)),
    };
    setPhieu(capNhat);
    ctxRef.current = { ...ctxRef.current, phieu: capNhat, item: capNhat.items.find((i) => i.bienTheSanPhamId === btId) };
    setQuetLa(null);
    if (bienTheSanPhamId === btId) {
      enqueue({ loai: "them", ma: q.ma, nguon: "mã vạch NCC vừa liên kết", soLuong: q.sl });
    } else {
      const bt = phieu.items.find((i) => i.bienTheSanPhamId === bienTheSanPhamId);
      bao("info", `Đã liên kết mã ${q.ma} với ${tenDayDu(bt)}. Sản phẩm này không thuộc biến thể đang kiểm, để riêng.`);
    }
    focusQuet();
    taiLai({ silent: true });
  };

  // ── Xóa lô ──
  const xoaLo = async () => {
    if (!loXoa) return;
    setDangXoa(true);
    try {
      await phieuNhapKhoService.deleteLo(phieuNhapKhoId, loXoa.chiTietPhieuNhapKhoId);
      toast.success(`Đã xóa lô ${loXoa.maLo}`);
      setLoXoa(null);
      await Promise.all([taiLai({ silent: true }), taiKe()]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xóa được lô"));
    } finally {
      setDangXoa(false);
      focusQuet();
    }
  };

  // ── Trạng thái tải ──
  if (loiTai) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
          {loiTai === "khong-thay" ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy phiếu nhập kho"
              description="Phiếu nhập kho không tồn tại hoặc đã bị xóa khỏi hệ thống."
              action={<Button onClick={() => navigate("/goods-receipts")} className="bg-bo-primary text-white hover:bg-bo-primary-hover">Quay lại danh sách</Button>}
            />
          ) : (
            <ErrorState title="Không tải được dữ liệu kiểm đếm" description={loiTai} onRetry={() => taiLai()} />
          )}
        </div>
      </PageContainer>
    );
  }
  if (!phieu || !phien) {
    return (
      <PageContainer>
        <LoadingState label="Đang tải dữ liệu kiểm đếm" />
      </PageContainer>
    );
  }
  // Phiếu chuyển kho / hoàn trả: lô tự động, dùng màn khai báo lô cũ
  if (!laDonMua) return <Navigate to={`/goods-receipts/${phieuNhapKhoId}/lot-input/${btId}`} replace />;
  if (!item) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
          <EmptyState
            icon={SearchX}
            title="Không tìm thấy biến thể trong phiếu nhập"
            description="Biến thể này không có trong phiếu nhập kho."
            action={<Button onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}`)} className="bg-bo-primary text-white hover:bg-bo-primary-hover">Quay lại phiếu nhập</Button>}
          />
        </div>
      </PageContainer>
    );
  }

  // ── Hiển thị ──
  // Chỉ xem: nhãn theo trạng thái phiếu (phiếu đã hủy / đã nhập kho không còn "Đang kiểm đếm")
  const trangThai = choSua ? nhanTrangThai(t) : phieu.trangThai === 3 ? "Đã nhập kho" : phieu.trangThai === 4 ? "Đã hủy" : nhanTrangThai(t);
  const pct = t.can ? Math.min(100, Math.round((t.daKiem / t.can) * 100)) : 0;
  const theHien = choSua && Boolean(cur) && !anThe && !hopKhoaLo && !quetLa;
  const macDinhChu =
    cheDo === CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI
      ? "Quét từng sản phẩm, rồi quét thẻ ĐẠT hoặc KHÔNG ĐẠT. Gõ 12* trước khi quét để tính cả thùng 12 cái."
      : "Quét từng sản phẩm: mỗi lượt tự tính Đạt. Sản phẩm lỗi thì quét tiếp thẻ KHÔNG ĐẠT. Gõ 12* trước khi quét để tính cả thùng 12 cái.";
  // Lỗi / cảnh báo khi thẻ kết quả đang hiện thì nằm trên thẻ (mắt người kiểm đang ở đó), không lặp dưới ô quét
  const baoTrenThe = theHien && thongBao && (thongBao.tone === "bad" || thongBao.tone === "warn") ? thongBao : null;
  const tb = baoTrenThe ? null : (thongBao ?? (theHien ? null : { tone: "neutral", chu: macDinhChu }));
  const keChon = dk.ke;
  const conKe = keChon ? conTrongKe(keChon) : null;
  const tenKhuChon = keChon ? khuVucs.find((k) => k.id === keChon.khuVucId)?.tenKhuVuc : null;
  const keTxt = keChon
    ? [keChon.maViTri, tenKhuChon, conKe !== null ? `còn trống ${formatNumber(conKe)}` : null].filter(Boolean).join(" · ")
    : t.datLo > 0
      ? keTai === "dang"
        ? "Đang tải danh sách kệ…"
        : coKe
          ? "Chưa chọn"
          : viTris.length
            ? "Không có kệ đang hoạt động"
            : "Kho chưa có kệ"
      : "—";
  const soLuot = p.log.filter((e) => !e.huy).length;
  const dsTab = choSua ? [["luot", "Lượt quét lô này", soLuot], ["lo", "Lô đã khóa", lots.length]] : [["lo", "Lô đã khóa", lots.length]];
  const tabMo = choSua ? tab : "lo";
  const chonTab = (ma) => {
    setTab(ma);
    // Thẻ kết quả nói về lượt đang kiểm: xem lô đã khóa thì cất thẻ để không che bảng; quét tiếp thẻ hiện lại
    setAnThe(ma === "lo");
  };
  const bienTheSau = phieu.items.find(
    (i) => i.bienTheSanPhamId !== btId && Number(i.soLuongDatQc || 0) + Number(i.soLuongLoiQc || 0) < Number(i.soLuongCanNhap || 0),
  );
  const nhanBienTheSau = bienTheSau
    ? bienTheSau.tenBienThe === item.tenBienThe
      ? [bienTheSau.mauSac, bienTheSau.kichCo].filter(Boolean).join(" · ") || bienTheSau.sku
      : tenDayDu(bienTheSau)
    : "";
  // Chân khối chỉ hiện khi có việc phải làm tiếp (số đạt / không đạt / còn lại đã ở dòng tiến độ đầu khối)
  // (Kiểm xong thì nhãn trạng thái đã nói, chân khối chỉ còn nút đi tiếp)
  const ftChu = !choSua
    ? ""
    : !t.xong && t.conLai === 0 && t.trongLo > 0 && t.vuot === 0
      ? "Đủ số theo đơn mua. Khóa lô đang kiểm để hoàn tất biến thể."
      : "";
  // Lượt đang chờ lý do / kết quả đã được báo trên thẻ kết quả: không lặp lại dưới nút Khóa lô
  const goiYNut = !dk.ok && t.trongLo > 0 && !(theHien && luotDangCho(p)) ? (dk.loi[0] ?? `Còn thiếu: ${dk.thieu.join(", ")}.`) : "";

  return (
    // Cao hết vùng nội dung: thẻ kết quả (mt-auto) nằm sát đáy màn ngay cả khi trang còn ngắn
    <PageContainer className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}`)}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
        >
          <ArrowLeft className="size-4" /> Phiếu nhập {phieu.soPhieuNhap}
        </button>
        {choSua ? (
          <button type="button" onClick={() => setMoInThe(true)} className="inline-flex items-center gap-2 text-sm font-medium text-bo-primary hover:text-bo-primary-hover">
            <Printer className="size-4" /> In thẻ lệnh
          </button>
        ) : null}
      </div>

      <section aria-label="Kiểm đếm biến thể" className="min-w-0 rounded-lg border border-bo-border bg-bo-surface shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-5">
          <div className="min-w-0 flex-[1_1_420px]">
            <div className="flex flex-wrap items-center gap-3">
              <AnhBienThe src={item.anh} />
              <h1 title={item.tenBienThe} className={cn("min-w-0 line-clamp-2 break-words", PAGE_HEADING_TYPE)}>{item.tenBienThe}</h1>
              <StatusBadge quyTrinh="kiemDem" size="lg" label={trangThai} />
            </div>
            <p className="mt-1 text-[13px] leading-5 text-bo-muted">
              {item.mauSac || item.kichCo ? (
                <>
                  <MauKichCo tenMau={item.mauSac} maMauHex={item.maMauHex} kichCo={item.kichCo} className="max-w-full align-bottom text-slate-700" />
                  {" · "}
                </>
              ) : null}
              SKU <span className="font-mono">{item.sku}</span>
              {phieu.tenNhaCungCap ? ` · ${phieu.tenNhaCungCap}` : ""}
              {phieu.tenKho ? ` · ${phieu.tenKho}` : ""}
            </p>
          </div>
          <div className="flex min-w-[220px] flex-[0_1_320px] flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-bo-muted">Đã kiểm theo đơn mua</span>
              <span>
                <span className="text-xl font-semibold tabular-nums text-bo-heading">{formatNumber(t.daKiem)}</span>
                <span className="tabular-nums text-bo-muted"> / {formatNumber(t.can)}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e8edf3]" role="progressbar" aria-label="Tiến độ kiểm đếm" aria-valuemin={0} aria-valuemax={t.can} aria-valuenow={t.daKiem}>
              <span className={cn("block h-full rounded-full", t.xong ? "bg-green-700" : "bg-bo-primary")} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-bo-muted">
              {/* Chưa khóa lô nào thì Đạt / Không đạt trùng "Trong lô": chỉ hiện phần còn thiếu. Chỉ xem thì không có "Còn". */}
              {[
                lots.length ? `Đạt ${formatNumber(t.datKhoa + t.datLo)} · Không đạt ${formatNumber(t.loiKhoa + t.loiLo)}` : null,
                choSua ? `Còn ${formatNumber(t.conLai)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>

        {choSua ? (
          <>
            <div className="border-t border-bo-border px-5 py-4">
              <form onSubmit={nhanMa} className="flex gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Mã vạch</span>
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                  <input
                    ref={oQuetRef}
                    autoFocus
                    enterKeyHint="done"
                    autoComplete="off"
                    spellCheck={false}
                    value={maQuet}
                    onChange={(e) => setMaQuet(e.target.value)}
                    placeholder="Quét sản phẩm, mã kệ hoặc thẻ lệnh"
                    aria-label="Ô quét mã"
                    className="h-11 w-full scroll-mt-3 rounded-md border border-slate-300 bg-bo-surface pl-10 pr-3 font-mono text-[15px] text-bo-heading placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:border-bo-primary focus:outline-none focus:ring-[3px] focus:ring-bo-primary/20"
                  />
                </label>
                <Button type="submit" className="h-11 min-w-28 bg-bo-primary text-white hover:bg-bo-primary-hover">Nhận mã</Button>
              </form>
              {tb ? (
                <DongThongBao className="mt-2.5" tone={tb.tone}>{tb.chu}</DongThongBao>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5 border-t border-bo-border px-5 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-bo-primary">
                <Package className="size-[18px]" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-bo-muted">Lô đang kiểm</span>
                <span className="break-all font-mono text-sm font-semibold text-bo-heading">{dk.maLo || "—"}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-bo-muted">Trong lô</span>
                <span className="text-sm font-semibold tabular-nums text-bo-heading">
                  {formatNumber(t.datLo)} đạt · {formatNumber(t.loiLo)} không đạt{t.choLo ? ` · ${formatNumber(t.choLo)} chờ chọn` : ""}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-bo-muted">Kệ cho hàng đạt</span>
                <span className="text-sm font-semibold text-bo-heading">{keTxt}</span>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                <Button
                  type="button"
                  disabled={t.trongLo === 0 || dangKhoa}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={moHopKhoaLo}
                  variant={t.trongLo > 0 ? "default" : "outline"}
                  className={cn("gap-2", t.trongLo > 0 ? "bg-bo-primary text-white hover:bg-bo-primary-hover" : "border-bo-border bg-bo-surface text-bo-foreground")}
                >
                  <Lock className="size-4" /> Khóa lô…
                </Button>
              </div>
              {goiYNut ? <p className="basis-full text-xs text-bo-muted">{goiYNut}</p> : null}
              {keTai === "loi" ? (
                <p className="basis-full text-xs text-bo-danger">
                  Không tải được danh sách kệ của kho. <NutChu onClick={taiKe}>Thử lại</NutChu>
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="border-t border-bo-border px-5 py-4">
            <DongThongBao tone={saiKho ? "warn" : "neutral"}>
              {saiKho
                ? `Phiếu nhập thuộc ${phieu.tenKho || "kho khác"}, không phải nơi làm việc đang chọn. Đổi nơi làm việc sang ${phieu.tenKho || "kho của phiếu"} để kiểm đếm.`
                : phieu.trangThai === 3
                  ? "Phiếu đã nhập kho, chỉ xem lô đã khóa."
                  : "Phiếu không còn ở trạng thái kiểm đếm, chỉ xem lô đã khóa."}
            </DongThongBao>
          </div>
        )}

        <div role="tablist" aria-label="Lịch sử kiểm đếm" className="flex gap-1 border-t border-bo-border px-3">
          {dsTab.map(([ma, nhan, dem], i) => {
            const dangMo = tabMo === ma;
            return (
              <button
                key={ma}
                id={`tab-kiem-dem-${ma}`}
                type="button"
                role="tab"
                aria-selected={dangMo}
                aria-controls="khung-kiem-dem"
                tabIndex={dangMo ? 0 : -1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chonTab(ma)}
                onKeyDown={(e) => {
                  // Bàn phím: mũi tên trái / phải chuyển tab (một điểm dừng Tab cho cả nhóm)
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const ke = dsTab[(i + (e.key === "ArrowRight" ? 1 : dsTab.length - 1)) % dsTab.length][0];
                  chonTab(ke);
                  document.getElementById(`tab-kiem-dem-${ke}`)?.focus();
                }}
                className={cn(
                  "-mb-px inline-flex h-12 items-center gap-2 border-b-2 px-2.5 text-sm",
                  dangMo ? "border-bo-primary font-semibold text-bo-foreground" : "border-transparent font-medium text-bo-muted hover:text-bo-foreground",
                )}
              >
                {nhan}
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">{dem}</span>
              </button>
            );
          })}
        </div>

        <div id="khung-kiem-dem" role="tabpanel" tabIndex={0} aria-labelledby={`tab-kiem-dem-${tabMo}`} className="outline-none">
        {tabMo === "luot" ? (
          p.log.length ? (
            <ul className="border-t border-bo-border">
              {p.log.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    "grid min-h-12 grid-cols-[64px_minmax(0,1fr)_88px] items-center gap-x-3 gap-y-1 border-b border-slate-100 px-5 py-1.5 text-[13px] last:border-b-0 lg:grid-cols-[72px_minmax(0,1.1fr)_minmax(0,1.7fr)_112px]",
                    e.huy && "text-slate-400",
                  )}
                >
                  <span className="tabular-nums text-bo-muted">{e.gio}</span>
                  <span className="truncate font-mono text-xs text-slate-600">{e.ma}</span>
                  <span className={cn("col-span-2 col-start-2 row-start-2 flex min-w-0 items-center gap-2 lg:col-span-1 lg:col-start-auto lg:row-start-auto", e.huy && "line-through")}>
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        e.huy ? "bg-slate-300" : e.kq === "cho" ? "bg-amber-500" : e.kq === "loi" ? (e.sl > e.loi ? "bg-amber-700" : "bg-red-600") : "bg-green-700",
                      )}
                    />
                    <span className="truncate">{nhanLuot(e)}</span>
                    <span className="hidden truncate text-xs text-bo-muted lg:inline">· {e.nguon}</span>
                  </span>
                  <span className="col-start-3 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
                    {e.huy ? (
                      <span className="text-xs text-bo-muted">Đã hoàn tác</span>
                    ) : (
                      <button
                        type="button"
                        disabled={dangKhoa}
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
            <p className="border-t border-bo-border px-5 py-10 text-center text-sm text-bo-muted">Chưa có lượt quét nào trong lô đang kiểm.</p>
          )
        ) : (
          <div className="overflow-x-auto border-t border-bo-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className={cn(TH, "text-left")}>Mã lô</th>
                  <th className={cn(TH, "text-left")}>Kệ</th>
                  <th className={cn(TH, "text-left")}>Ngày sản xuất</th>
                  <th className={cn(TH, "w-24 text-right")}>Đạt</th>
                  <th className={cn(TH, "w-48 text-right")}>Không đạt</th>
                  {choSua ? <th className={cn(TH, "w-16")}><span className="sr-only">Thao tác</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {lots.map((l) => (
                  <tr key={l.chiTietPhieuNhapKhoId ?? l.loHangId}>
                    <td className="h-14 max-w-[280px] px-5 font-mono font-semibold text-bo-foreground"><span className="block truncate" title={l.maLo}>{l.maLo}</span></td>
                    <td className="whitespace-nowrap px-5 font-mono text-[13px]">{l.maViTri || "—"}</td>
                    <td className="px-5 tabular-nums">{formatDate(l.ngaySanXuat)}</td>
                    <td className="px-5 text-right tabular-nums">{formatNumber(l.soLuongNhap)}</td>
                    <td className="px-5 py-2 text-right">
                      <span className={cn("tabular-nums", Number(l.soLuongLoi) ? "font-semibold text-bo-danger" : "text-bo-muted")}>{formatNumber(l.soLuongLoi)}</span>
                      {l.chiTietLoi?.length ? (
                        <span className="block text-xs text-bo-muted">{l.chiTietLoi.map((c) => `${c.lyDo} ${formatNumber(c.soLuong)}`).join(", ")}</span>
                      ) : null}
                    </td>
                    {choSua ? (
                      <td className="px-5 text-right">
                        {/* Lô vừa khóa chưa tải lại được từ máy chủ (chưa có id dòng): chưa xóa được */}
                        {l.chiTietPhieuNhapKhoId ? (
                          <Button variant="ghost" size="icon-sm" aria-label={`Xóa lô ${l.maLo}`} onClick={() => setLoXoa(l)} className="text-bo-muted hover:bg-bo-danger-soft hover:text-bo-danger">
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={choSua ? 6 : 5} className="h-24 px-5 text-center text-sm text-bo-muted">Chưa có lô nào được khóa.</td>
                  </tr>
                ) : null}
              </tbody>
              {/* Một lô thì dòng tổng lặp đúng số của dòng đó */}
              {lots.length > 1 ? (
                <tfoot>
                  <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                    <td className="h-12 px-5" colSpan={3}>Tổng đã khóa</td>
                    <td className="px-5 text-right tabular-nums">{formatNumber(t.datKhoa)}</td>
                    <td className={cn("px-5 text-right tabular-nums", t.loiKhoa ? "text-bo-danger" : "")}>{formatNumber(t.loiKhoa)}</td>
                    {choSua ? <td /> : null}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
        </div>

        {ftChu || (choSua && t.xong) ? (
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-b-lg border-t border-bo-border bg-bo-surface-subtle px-5 py-3">
          {ftChu ? <span className="min-w-0 text-sm text-bo-foreground">{ftChu}</span> : <span className="hidden sm:block" />}
          {t.xong ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={bienTheSau ? "outline" : "default"}
                onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}`)}
                className={bienTheSau ? "border-bo-border bg-white text-bo-foreground" : "bg-bo-primary text-white hover:bg-bo-primary-hover"}
              >
                Về phiếu nhập
              </Button>
              {bienTheSau ? (
                <Button onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}/receive/${bienTheSau.bienTheSanPhamId}`)} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
                  Kiểm tiếp {nhanBienTheSau}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}
      </section>

      {theHien ? (
        <TheKetQuaQuet
          ref={theRef}
          luot={cur}
          thongBao={baoTrenThe}
          cheDo={cheDo}
          conLai={t.conLai}
          lyDoDs={LY_DO_LOI}
          khoa={dangKhoa}
          onDat={() => suaLuot(thanhDat, "ok")}
          onKhongDat={() => suaLuot(thanhKhongDat, "loi")}
          onLyDo={(ten) => suaLuot((x) => chonLyDo(x, ten), "ok")}
          onSoLuong={(d) => suaLuot((x) => doiSoLuong(x, d, tinhHienTai().conLai))}
          onSoLoi={(d) => suaLuot((x) => doiSoLoi(x, d))}
          onHoanTac={() => hoanTac(cur.id)}
          onAn={() => {
            setAnThe(true);
            focusQuet();
          }}
        />
      ) : null}

      <HopKhoaLo
        open={hopKhoaLo}
        t={t}
        dk={dk}
        viTris={viTris}
        khuVucs={khuVucs}
        coKe={coKe}
        keDangTai={keTai === "dang"}
        keId={p.keId}
        nsx={p.nsx}
        maLo={p.maLo ?? maLoGoiY}
        homNay={homNay}
        nhomLoi={nhomLoiTheoLyDo(p.log)}
        dangKhoa={dangKhoa}
        loiQuet={loiQuetKhoa}
        nhacThieu={nhacThieu}
        onQuet={(ma) => enqueue({ raw: ma })}
        onChonKe={(id) => {
          setPhien({ ...phienRef.current, keId: id });
          setLoiQuetKhoa("");
          setNhacThieu(false);
        }}
        onDoiMaLo={(v) => setPhien({ ...phienRef.current, maLo: v })}
        onDoiNsx={(v) => setPhien({ ...phienRef.current, nsx: v })}
        onKhoa={() => enqueue({ loai: "khoaLo" })}
        onHuy={() => {
          if (dangKhoaRef.current) return;
          setHopKhoaLo(false);
          setLoiQuetKhoa("");
          focusQuet();
        }}
      />

      <HopMaChuaCo
        ref={hopMaChuaCoRef}
        quet={quetLa}
        phieu={phieu}
        items={phieu.items}
        bienTheDangKiemId={btId}
        ungVienGanGiong={ungVienGanGiong}
        nhanBiet={nhanBiet}
        traMa={(ma) => maVachNhaCungCapService.tra(ma, phieu.nhaCungCapId)}
        layPhanConLai={layVaXoaOQuet}
        onDungMa={dungMa}
        onBoQua={dongHopMaChuaCo}
        onLienKet={lienKetMa}
        onBip={bipKiemDem}
      />

      <HopInTheLenh
        open={moInThe}
        onOpenChange={(mo) => {
          setMoInThe(mo);
          if (!mo) focusQuet();
        }}
        onQuet={(ma) => enqueue({ raw: ma })}
      />

      <ConfirmModal
        isOpen={Boolean(loXoa)}
        onClose={() => {
          if (dangXoa) return;
          setLoXoa(null);
          focusQuet();
        }}
        onConfirm={xoaLo}
        title="Xóa lô hàng"
        description={
          <>
            Xóa lô <span className="font-semibold text-bo-danger">{loXoa?.maLo}</span> ({formatNumber(loXoa?.soLuongNhap)} đạt, {formatNumber(loXoa?.soLuongLoi)} không đạt)?
            Số lượng của lô bị trừ khỏi tiến độ, cần kiểm lại số này.
            {phieu.coBienBanRtv && Number(loXoa?.soLuongLoi) ? " Biên bản trả hàng đã lập sẽ phải lập lại." : ""}
          </>
        }
        confirmText="Xóa lô"
        isLoading={dangXoa}
      />
    </PageContainer>
  );
}
