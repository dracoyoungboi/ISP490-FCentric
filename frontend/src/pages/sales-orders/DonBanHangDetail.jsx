import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircleCheckBig, PackageCheck, Printer, RefreshCw, Send, Truck, Undo2, XCircle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import {
  CAU_HET_THOI_HAN,
  MO_TA_HET_THOI_HAN,
  chayCoThoiHan,
  khiGocKetThuc,
  khoaKhiChoGoc,
  laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import BangHangBan from "@/components/ban-hang/BangHangBan";
import TongTienBan from "@/components/ban-hang/TongTienBan";
import { idKho } from "@/components/ban-hang/chonKho";
import HopGuiSangKho from "@/components/ban-hang/chi-tiet-don-ban/HopGuiSangKho";
import ThuocTinhDonBan from "@/components/ban-hang/chi-tiet-don-ban/ThuocTinhDonBan";
import KhoiPhieuThu from "@/components/ban-hang/chi-tiet-don-ban/KhoiPhieuThu";
import {
  buocDonBan,
  cauLechDong,
  cauLechTong,
  dongHangBan,
  gioNgay,
  hauQuaHuy,
  laDonSan,
  laDonTaiQuay,
  lyDoSanHuy,
  maBaoGiaGoc,
  tenKenhCua,
  thanhToanDonBan,
  thaoTacDonBan,
  thongBaoDonBan,
  tienDonBan,
} from "@/components/ban-hang/chi-tiet-don-ban/tinhDonBan";
import MockModeNotice from "@/components/shared/MockModeNotice";
import StatusBadge from "@/components/shared/StatusBadge";
import { getBaoGiaStatus } from "@/constants/baoGia";
import { DON_BAN_HANG_DA_KET_THUC_KHONG_THU, DON_BAN_HANG_THANH_TOAN, getDonBanHangStatus } from "@/constants/donBanHang";
import { TRANG_THAI_DON } from "@/constants/trangThaiXuatBan";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { donBanHangService } from "@/services/donBanHangService";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";

const TEN_CHUNG_TU = "đơn bán hàng";
const TONG_THEO = Object.freeze({ soLuong: "soLuong", thanhTien: "thanhTien" });
// Máy chủ từ chối vì đơn đã đổi ở nơi khác (409 khi hủy đơn đã vào phiếu nhặt…), dữ liệu sai (400) hoặc không còn
// quyền (403): đóng hộp, báo câu máy chủ, tải lại; lỗi khác giữ hộp để bấm lại
const LOI_DA_DOI_NOI_KHAC = [400, 403, 409];
// Máy chủ ném RuntimeException "Không tìm thấy đơn bán" (HTTP 500) khi mã đơn không có
const TUY_CHON_LOI = Object.freeze({ coi500LaKhongThay: true });

/**
 * Chi tiết đơn bán hàng · bản "một khối" (21/10/2026, artboard Main của canvas "Màn bán hàng & kho cấp 2–3"):
 * đầu khối (mã, trạng thái, nguồn đơn, số biến thể, tổng số lượng, nút theo vai trò × trạng thái), tiến trình 6 bước,
 * dòng thông báo khi có việc phải biết, bảng hàng gom theo sản phẩm + tổng tiền và thanh toán, cột thông tin bên phải.
 * Quyền nút: tinhDonBan.thaoTacDonBan (khớp @RequireAuth của DonBanHangController). Đơn sàn thao tác như đơn thường
 * (giữ nghiệp vụ cũ cho tới khi chốt Q17); nhân viên bán hàng bấm phiếu xuất mở trang xem cũ (Q15 chưa chốt).
 */
export default function DonBanHangDetail() {
  const { id } = useParams();
  // Đổi sang đơn khác thì dựng lại màn: từ khóa, trang, hộp thoại của đơn cũ không mang sang
  return <ChiTietDonBanHang key={id} id={id} />;
}

function ChiTietDonBanHang({ id }) {
  const navigate = useNavigate();
  const quayLai = useQuayLai("/sales-orders");
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const laBan = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_BAN_HANG]);
  const laKho = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]);

  // ── Đơn ──────────────────────────────────────────────────────────────────
  const taiDon = useCallback(async () => {
    const res = await donBanHangKenhService.getDetail(id);
    return res?.data ?? null;
  }, [id]);
  const q = useTaiDuLieu(taiDon, `don-ban-${id}`, { enabled: Boolean(id) });
  const ct = q.data?.donBanHang && String(q.data.donBanHang.id) === String(id) ? q.data : null;
  const don = ct?.donBanHang ?? null;
  const laBaoGia = don?.loaiChungTu === "bao_gia";

  // Mở mã của báo giá ở màn đơn: chuyển sang chi tiết báo giá (cùng bảng don_ban_hang)
  useEffect(() => {
    if (laBaoGia) navigate(`/sales-quotations/${id}`, { replace: true });
  }, [laBaoGia, id, navigate]);

  // ── Báo giá gốc (suy SO → BG như backend): bán hàng tra trạng thái thật qua /filter; kho chỉ thấy mã ──
  const laPos = laDonTaiQuay(ct);
  const laSan = laDonSan(don);
  const maBG = don && !laBaoGia ? maBaoGiaGoc(don.soDonHang, { laPos, laSan }) : null;
  const taiBaoGia = useCallback(async () => {
    const page = await donBanHangService.filter({
      page: 0,
      size: 5,
      filters: [
        { fieldName: "loaiChungTu", operation: "EQUALS", value: "bao_gia" },
        { fieldName: "soDonHang", operation: "EQUALS", value: maBG },
      ],
      sorts: [],
    });
    return (page?.content ?? []).find((bg) => bg?.soDonHang === maBG) ?? null;
  }, [maBG]);
  // Khóa có trạng thái đơn: hủy đơn đưa báo giá về Chờ phản hồi nên tra lại
  const qBaoGia = useTaiDuLieu(taiBaoGia, `bao-gia-goc-${maBG}-${don?.trangThai}`, { enabled: Boolean(maBG && laBan) });

  const [hop, setHop] = useState(""); // "" | "guiKho" | "huy" | "daGiao" | "hoanTra"
  const [dangChay, setDangChay] = useState(""); // thao tác đang gửi lên máy chủ
  const [loiHop, setLoiHop] = useState(null);
  // Hết thời hạn mà máy chủ có thể vẫn đang làm: khóa nút thao tác tới khi lời gọi gốc kết thúc (khiGocKetThuc)
  const [choGoc, setChoGoc] = useState(false);
  const huyChoGocRef = useRef(null);
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
      huyChoGocRef.current?.();
    };
  }, []);

  // Quay lại tab thì tải lại ngầm (kho đổi trạng thái khi nhặt, đóng gói, xuất); không tải khi đang thao tác
  useTaiLaiKhiQuayLai(() => q.reload(), { bat: Boolean(ct) && !q.loading && !dangChay && !hop, lanCuoi: q.capNhatLuc });

  // ── Tính toán ───────────────────────────────────────────────────────────
  const dong = useMemo(() => dongHangBan(ct?.chiTiet), [ct]);
  const bang = useBangChungTu(dong, { tongTheo: TONG_THEO });

  // ── Đang tải / lỗi / không tìm thấy ────────────────────────────────────
  if (!ct || laBaoGia) {
    if (laBaoGia || q.loading || (!q.error && q.data === undefined)) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungDangTai nhan="Đang tải đơn bán hàng" />
        </PageContainer>
      );
    }
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiChungTu
          loi={q.error}
          tenChungTu={TEN_CHUNG_TU}
          tuyChonLoi={TUY_CHON_LOI}
          onVeDanhSach={() => navigate("/sales-orders")}
          onThuLai={q.reload}
        />
      </PageContainer>
    );
  }

  const tt = Number(don.trangThai);
  const so = don.soDonHang || `#${don.id}`;
  const tenKenh = tenKenhCua(don);
  const v = thaoTacDonBan(ct, { laBan, laKho });
  const buoc = buocDonBan(ct);
  const tien = tienDonBan(don, dong, { laSan });
  const thanhToan = thanhToanDonBan(ct);

  // Báo giá gốc cho cột phải và hộp hủy:
  // - tra được (bán hàng): mã, liên kết, trạng thái thật;
  // - quản trị viên tra không thấy (không giới hạn phạm vi): đơn không từ báo giá → không hiện;
  // - nhân viên bán hàng tra không thấy (/filter chỉ trả báo giá của chính họ), tra lỗi, vai trò kho: chỉ hiện mã.
  const bgTim = qBaoGia.data;
  const daTraBaoGia = laBan && !qBaoGia.error && qBaoGia.data !== undefined;
  const baoGia = !maBG
    ? null
    : daTraBaoGia && bgTim
      ? { ma: maBG, id: bgTim.id, trangThai: getBaoGiaStatus(bgTim.trangThai).label, chacChan: Number(bgTim.trangThai) === 2 }
      : daTraBaoGia && laQtv
        ? null
        : laBan && qBaoGia.loading && qBaoGia.data === undefined
          ? null
          : { ma: maBG, chacChan: false };
  // Hộp hủy: báo giá đã biết không ở Đã chốt đơn thì bỏ dòng; chưa biết thì ghi "nếu đang Đã chốt đơn"
  const baoGiaHuy = baoGia && (baoGia.chacChan || !baoGia.id) ? baoGia : null;

  // ── Thao tác ────────────────────────────────────────────────────────────
  const moHop = (loai) => {
    setLoiHop(null);
    setHop(loai);
  };
  const doiMoHop = (mo) => {
    if (!mo) setHop("");
  };

  // Khóa nút thao tác tới khi lời gọi gốc kết thúc (tối đa THOI_HAN_CHO_GOC_MS) rồi tải lại; màn gỡ thì hủy chờ
  const khoaToiKhiGocXong = (loi) => {
    huyChoGocRef.current?.();
    setChoGoc(true);
    huyChoGocRef.current = khiGocKetThuc(loi, () => {
      huyChoGocRef.current = null;
      setChoGoc(false);
      q.reload();
    });
  };

  /** Chạy một thao tác (có thời hạn); `coHop`: thao tác chạy từ hộp xác nhận (lỗi thường hiện trong hộp). */
  // `loi500LaDaDoi`: thao tác mà máy chủ báo "trạng thái không còn đúng" bằng RuntimeException (HTTP 500) — vd. đã giao,
  // hoàn trả khi tab khác vừa làm — thì đóng hộp và tải lại như lỗi 400/409 (bấm lại cũng chỉ lỗi y như vậy)
  const thucHien = async (ma, viec, { thanhCong, coHop = true, loi500LaDaDoi = false, cauLoi = "Không thực hiện được thao tác" }) => {
    setLoiHop(null);
    setDangChay(ma);
    try {
      const kq = await chayCoThoiHan(viec);
      if (coHop) setHop("");
      thanhCong?.(kq);
      q.reload();
    } catch (error) {
      if (laLoiHetThoiHan(error)) {
        if (daGoRef.current) return;
        // Máy chủ chưa trả lời sau thời hạn: đóng hộp, báo lỗi, tải lại; khóa nút tới khi lời gọi gốc kết thúc
        setHop("");
        toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
        q.reload();
        khoaToiKhiGocXong(error);
        return;
      }
      // Câu dự phòng không có dấu chấm: mất mạng thì getApiErrorMessage nối thêm ": không nhận được phản hồi…"
      const cau = getApiErrorMessage(error, cauLoi);
      const trangThaiLoi = getApiErrorStatus(error);
      if (!coHop || LOI_DA_DOI_NOI_KHAC.includes(trangThaiLoi) || (loi500LaDaDoi && trangThaiLoi === 500)) {
        setHop("");
        toast.error(cau);
      } else {
        setLoiHop(cau);
      }
      // Tải lại ngầm để màn khớp máy chủ (đơn có thể vừa đổi ở nơi khác)
      q.reload();
    } finally {
      setDangChay("");
    }
  };

  const guiSangKho = (kho) =>
    thucHien("guiKho", () => donBanHangService.sendToWarehouse(id, { khoId: Number(idKho(kho)) }), {
      cauLoi: "Không gửi được đơn sang kho",
      thanhCong: () => toast.success(`Đã gửi đơn ${so} sang ${kho.tenKho}`, { description: "Đơn chuyển sang Chờ nhặt hàng" }),
    });
  // Máy chủ trả thành công mà không làm gì khi đơn đã hủy (vd. sàn vừa hủy): đọc lại đơn để không báo nhầm "đã gửi sang sàn"
  const huyDon = () =>
    thucHien(
      "huy",
      async () => {
        await donBanHangService.cancel(id);
        const moi = await donBanHangService.getDetail(id).catch(() => null);
        return moi?.data?.donBanHang ?? null;
      },
      {
        cauLoi: "Không hủy được đơn",
        thanhCong: (donMoi) => {
          const sanHuy = lyDoSanHuy(donMoi?.lyDoTuChoi);
          if (sanHuy) toast.info(`${sanHuy.tenSan} đã hủy đơn ${so} trước đó`);
          else toast.success(`Đã hủy đơn ${so}`, { description: laSan ? `Đã gửi yêu cầu hủy sang ${tenKenh}` : "Hàng của đơn đã trả về tồn có thể bán" });
        },
      },
    );
  const xacNhanDaGiao = () =>
    thucHien("daGiao", () => donBanHangKenhService.markAsDelivered(id), {
      loi500LaDaDoi: true,
      cauLoi: "Không xác nhận được giao hàng",
      thanhCong: () => toast.success("Đã xác nhận giao hàng", { description: `Đơn ${so} chuyển sang Hoàn thành` }),
    });
  const ghiNhanHoanTra = () =>
    thucHien("hoanTra", () => donBanHangService.returnOrder(id), {
      loi500LaDaDoi: true,
      cauLoi: "Không ghi nhận được hoàn trả",
      thanhCong: () => toast.success(`Đã ghi nhận hoàn trả đơn ${so}`, { description: "Đơn chuyển sang Bị hoàn trả" }),
    });
  // Phiếu xuất bị hủy sau khi nhặt xong: tạo phiếu mới dùng lại lô đã nhặt; lô cũ không còn đủ thì máy chủ báo canSuaLo
  const taoLaiPhieuXuat = () =>
    thucHien("taoLai", () => phieuXuatKhoService.taoLaiTheoDon(id), {
      coHop: false,
      cauLoi: "Không tạo lại được phiếu xuất",
      thanhCong: (res) => {
        const kq = res?.data;
        const cau = res?.message || (kq?.soPhieuXuat ? `Đã tạo lại phiếu xuất ${kq.soPhieuXuat}` : "Đã tạo lại phiếu xuất");
        if (kq?.canSuaLo?.length) toast.warning(cau);
        else toast.success(cau, { description: "Dùng lại lô đã nhặt, đơn chuyển sang Chờ đóng gói." });
      },
    });

  // ── Đầu khối ────────────────────────────────────────────────────────────
  const nguon = laPos ? "Bán tại quầy" : laSan ? `Đơn ${tenKenh}` : "Đơn bán hàng";
  const nutChinh = khoaKhiChoGoc(
    [
      v.nutGuiKho ? { ma: "guiKho", nhan: "Gửi sang kho", icon: Send, onClick: () => moHop("guiKho") } : null,
      v.nutDaGiao ? { ma: "daGiao", nhan: "Xác nhận đã giao", icon: CircleCheckBig, onClick: () => moHop("daGiao") } : null,
      v.nutDongGoi
        ? { ma: "dongGoi", nhan: "Đóng gói", icon: PackageCheck, dieuHuong: true, onClick: () => navigate(`/goods-issues/packing/${id}`) }
        : null,
      v.nutXuat
        ? { ma: "xuat", nhan: "Xuất kho", icon: Truck, dieuHuong: true, onClick: () => navigate(`/goods-issues/${v.pxMo.id}`) }
        : null,
      v.nutTaoLai
        ? { ma: "taoLai", nhan: "Tạo lại phiếu xuất", icon: RefreshCw, dangChay: dangChay === "taoLai", khoa: Boolean(dangChay), onClick: taoLaiPhieuXuat }
        : null,
    ].filter(Boolean),
    choGoc,
  );
  const menu = [
    v.menuHoanTra
      ? { ma: "hoanTra", nhan: "Ghi nhận hoàn trả", moTa: "Khách trả lại cả đơn", icon: Undo2, khoa: choGoc, onSelect: () => moHop("hoanTra") }
      : null,
    v.menuHuy
      ? {
        ma: "huy",
        nhan: "Hủy đơn",
        moTa: v.lyDoKhoaHuy || (laSan ? `Gửi yêu cầu hủy sang ${tenKenh}` : "Trả hàng về tồn có thể bán"),
        icon: XCircle,
        nguyHiem: true,
        khoa: Boolean(v.lyDoKhoaHuy) || choGoc,
        onSelect: () => moHop("huy"),
      }
      : null,
  ].filter(Boolean);

  // ── Thông báo ───────────────────────────────────────────────────────────
  const thongBao = [
    ...thongBaoDonBan(ct, { laBan, laKho }).map((n) => (
      <DongThongBao
        key={n.ma}
        tone={n.tone}
        actions={n.lienKet === "donChoXuat" ? <NutChu onClick={() => navigate("/goods-issues/pending-orders")}>Mở Đơn chờ xuất</NutChu> : null}
      >
        {n.chu}
      </DongThongBao>
    )),
    tien.lechDong ? (
      <DongThongBao key="lech-dong">{cauLechDong({ tenKenh, chenh: tien.chenhDong })}</DongThongBao>
    ) : null,
    // Tải lại (sau thao tác, khi quay lại tab) lỗi: màn đang hiện dữ liệu cũ
    q.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai" tone="bad" actions={<NutChu onClick={q.reload}>Thử lại</NutChu>}>
        Không tải lại được đơn: {getApiErrorMessage(q.error, "lỗi kết nối")}. Thông tin đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  // ── Tổng tiền và thanh toán ─────────────────────────────────────────────
  const nhanThanhToan = thanhToan.maTrangThai ? DON_BAN_HANG_THANH_TOAN[thanhToan.maTrangThai]?.label : null;
  const khoiThanhToan = (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span>Thanh toán</span>
        {nhanThanhToan ? (
          // "Chưa thanh toán" của đơn sàn chỉ là trạng thái chụp lúc đồng bộ, hệ thống không thu; đơn thường đã hủy / hoàn
          // trả không còn phải thu: không tô màu nhắc
          <StatusBadge label={nhanThanhToan} nhom={thanhToan.maTrangThai === "chua_thanh_toan"
            && (!thanhToan.laDonThuong || DON_BAN_HANG_DA_KET_THUC_KHONG_THU.includes(tt)) ? "dong" : undefined} />
        ) : null}
      </div>
      <p className={nhanThanhToan ? "mt-1 text-bo-foreground" : "mt-1"}>
        {thanhToan.phuongThuc ? [thanhToan.phuongThuc, gioNgay(thanhToan.ngayThu)].filter(Boolean).join(" · ") : thanhToan.chu}
      </p>
      {/* Đơn bán thường: phiếu thu / hoàn; hoàn tiền, hủy phiếu chỉ quản trị viên */}
      <KhoiPhieuThu coTheHoan={laQtv} coTheThu={laBan} donId={id} laQtv={laQtv} onDaDoi={q.reload} thanhToan={ct.thanhToan} />
    </>
  );
  const ttq = ct.thanhToanTaiQuay;
  // Thiếu số của máy chủ thì hiện "—" (không ghi "0 ₫" như thể khách đưa 0 đồng)
  const tienHoacTrong = (so) => (so == null || so === "" ? null : formatCurrency(so));
  const mucTien = [
    { ma: "hang", nhan: "Tiền hàng", giaTri: formatCurrency(tien.tienHang) },
    { ma: "phi", nhan: "Phí vận chuyển", giaTri: formatCurrency(tien.phi) },
    // Thuế GTGT chụp lúc chốt đơn (giá đã gồm thuế): tách ngược từ tổng cộng
    ...(don.thueSuatGtgt != null && don.tienThueGtgt != null ? [
      { ma: "chua-thue", nhan: "Cộng tiền chưa thuế", giaTri: formatCurrency(Number(don.tongCong) - Number(don.tienThueGtgt)) },
      { ma: "thue", nhan: `Thuế GTGT ${Number(don.thueSuatGtgt).toLocaleString("vi-VN")}%`, giaTri: formatCurrency(don.tienThueGtgt) },
    ] : []),
    { ma: "tong", nhan: "Tổng cộng", giaTri: formatCurrency(tien.tongCong), tong: true },
    thanhToan.laTienMat ? { ma: "dua", nhan: "Khách đưa", giaTri: tienHoacTrong(ttq?.soTienThu) ?? "—" } : null,
    thanhToan.laTienMat ? { ma: "thua", nhan: "Tiền thừa", giaTri: tienHoacTrong(ttq?.soTienThua) ?? "—" } : null,
    // Trả kết hợp tại quầy: phần tiền mặt khách trả trước và phần quét QR payOS
    thanhToan.ketHop ? { ma: "tien-mat", nhan: "Tiền mặt", giaTri: formatCurrency(thanhToan.ketHop.tienMat) } : null,
    thanhToan.ketHop ? { ma: "qr", nhan: "QR payOS", giaTri: formatCurrency(thanhToan.ketHop.qr) } : null,
  ];

  const tieuDeHuy = `Hủy đơn ${so}?`;

  return (
    <PageContainer className="flex min-h-full flex-col gap-3">
      <MockModeNotice show={isChannelOrderMock} />
      <KhungChungTu
        dau={
          <DauChungTu
            ma={so}
            trangThai={{ label: getDonBanHangStatus(don.trangThai).label, quyTrinh: "donBan" }}
            dongPhu={[
              nguon,
              bang.rong ? "chưa có sản phẩm" : <b key="bt" className="font-semibold text-bo-foreground">{soVN(bang.tong.soDong)} biến thể</b>,
              bang.rong ? null : <b key="sl" className="font-semibold text-bo-foreground">tổng số lượng {soVN(bang.tong.soLuong)}</b>,
            ]}
            onQuayLai={quayLai}
            nhanQuayLai="Về danh sách đơn bán hàng"
            nutPhu={
              v.coIn
                ? {
                  ma: "in",
                  nhan: "In hóa đơn",
                  icon: Printer,
                  // Đơn bán tại quầy in lại bằng mẫu khổ nhiệt như lúc thanh toán
                  onClick: () => navigate(`/sales-orders/${id}/invoice${laPos ? "?mau=tai-quay" : ""}`),
                }
                : null
            }
            saoChepMa={{ giaTri: don.soDonHang, nhan: "Sao chép mã đơn" }}
            menu={menu}
            nutChinh={nutChinh}
          />
        }
        tienTrinh={buoc.length ? <TienTrinhChungTu buoc={buoc} nhan="Tiến trình đơn bán hàng" /> : null}
        thongBao={thongBao.length ? thongBao : null}
        chinh={
          <BangHangBan bang={bang} tenChungTu={TEN_CHUNG_TU} nhanTim="Tìm trong đơn">
            <TongTienBan
              trai={khoiThanhToan}
              muc={mucTien}
              chuThich={tien.lechTong ? cauLechTong({ laSan, tenKenh }) : null}
            />
          </BangHangBan>
        }
        cotPhai={<ThuocTinhDonBan ct={ct} laBan={laBan} laKho={laKho} baoGia={baoGia} />}
      />

      <HopGuiSangKho
        mo={hop === "guiKho"}
        onDoiMo={doiMoHop}
        don={don}
        dangChay={dangChay === "guiKho"}
        loi={loiHop}
        onXacNhan={guiSangKho}
      />
      <HopXacNhanChungTu
        mo={hop === "huy"}
        onDoiMo={doiMoHop}
        tieuDe={tieuDeHuy}
        moTa="Không hoàn tác được."
        nhanXacNhan="Hủy đơn"
        kieu="nguyHiem"
        dangChay={dangChay === "huy"}
        loi={loiHop}
        onXacNhan={huyDon}
      >
        <ul className={`${GHI_CHU_HOP} m-0 list-disc pl-7`}>
          {hauQuaHuy(ct, { baoGia: baoGiaHuy }).map((cau) => (
            <li key={cau}>{cau}</li>
          ))}
        </ul>
      </HopXacNhanChungTu>
      <HopXacNhanChungTu
        mo={hop === "daGiao"}
        onDoiMo={doiMoHop}
        tieuDe="Xác nhận đã giao"
        moTa={`Khách đã nhận đủ hàng của đơn ${so}? Đơn chuyển sang Hoàn thành.`}
        nhanXacNhan="Xác nhận đã giao"
        iconXacNhan={CircleCheckBig}
        dangChay={dangChay === "daGiao"}
        loi={loiHop}
        onXacNhan={xacNhanDaGiao}
      />
      <HopXacNhanChungTu
        mo={hop === "hoanTra"}
        onDoiMo={doiMoHop}
        tieuDe="Ghi nhận hoàn trả"
        moTa={`Khách trả lại toàn bộ đơn ${so}? Đơn chuyển sang Bị hoàn trả.`}
        nhanXacNhan="Ghi nhận hoàn trả"
        iconXacNhan={Undo2}
        dangChay={dangChay === "hoanTra"}
        loi={loiHop}
        onXacNhan={ghiNhanHoanTra}
      >
        <div className={GHI_CHU_HOP}>
          Hàng chưa vào lại tồn kho khi ghi nhận. Hiện chỉ ghi nhận trả cả đơn, chưa trả từng phần.
          {tt === TRANG_THAI_DON.DA_XUAT_MOT_PHAN ? " Phần chưa xuất của đơn thôi giữ chỗ trong tồn có thể bán." : null}
        </div>
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
