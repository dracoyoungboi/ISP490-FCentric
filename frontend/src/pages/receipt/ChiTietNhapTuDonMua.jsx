import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { ArrowLeft, Check, FileCheck2, Loader2, MoreHorizontal, PenLine, Printer, ScanLine, X } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import { useClaimPageTitle, PAGE_HEADING_TYPE } from "@/components/backoffice/pageTitle";
import StatusBadge from "@/components/shared/StatusBadge";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import OLyDo from "@/components/chung-tu/OLyDo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import HopBienBanTraHang from "@/components/nhap-kho/HopBienBanTraHang";
import HopXacNhanNhapKho from "@/components/nhap-kho/HopXacNhanNhapKho";
import TheHoaDonNhaCungCap from "@/components/nhap-kho/TheHoaDonNhaCungCap";
import { DaiO, OBuoc, ThanhMuc, TienDoSo } from "@/components/nhap-kho/ThanhBuoc";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import { trangThaiKiemDem, trangThaiTraHang } from "@/constants/nhapKho";
import HopXemBienBanTraHang from "@/components/nhap-kho/tra-hang/HopXemBienBanTraHang";
import { choKyBienBan, duongDanInBienBan, tenCachXuLy } from "@/components/nhap-kho/tra-hang/traHangUtils";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { bienBanTraHangService } from "@/services/bienBanTraHangService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate, formatNumber } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { chuanHoaDongInTem } from "@/components/print/tinhTem";
import HopInTem from "@/pages/product/components/product/HopInTem";
import EditProductModal from "@/pages/product/components/product/EditProductModal";
import { t } from "@/i18n";
import { VAI_TRO_KHO, VAI_TRO_SUA_HOA_DON_NCC } from "@/constants/vaiTroTheoNghiepVu";
import { moTrangIn } from "@/lib/moTrangIn";

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/** Mã lô để so: không phân biệt hoa thường / khoảng trắng thừa (khớp máy chủ khi lập lại biên bản). */
const maLoSo = (m) => String(m ?? "").trim().replace(/\s+/g, " ").toUpperCase();

/**
 * Hàng không đạt theo lô và lý do (máy chủ lưu khi khóa lô). Lô khóa trước khi có lý do (chưa có chiTietLoi): biên bản
 * đang hiệu lực có dòng của đúng lô đó (`dongBienBan`: dòng biên bản của biến thể này, cùng mã lô) mà tổng bằng số lỗi
 * của lô thì dùng lại các dòng đó như máy chủ làm khi lập lại; không thì ghi "Chưa ghi lý do".
 */
function dongLoiCuaLo(lots, dongBienBan = []) {
  return (lots ?? []).flatMap((l) => {
    const tongLoi = Number(l.soLuongLoi || 0);
    if (!tongLoi) return [];
    if (!l.chiTietLoi?.length && maLoSo(l.maLo)) {
      const cu = dongBienBan.filter((d) => maLoSo(d.maLo) === maLoSo(l.maLo));
      if (cu.length && cu.reduce((tg, d) => tg + Number(d.soLuong || 0), 0) === tongLoi) {
        return cu.map((d) => ({ maLo: l.maLo, lyDo: d.lyDo, soLuong: Number(d.soLuong || 0), ghiChu: d.ghiChu }));
      }
    }
    const ds = (l.chiTietLoi ?? []).map((c) => ({ maLo: l.maLo, lyDo: c.lyDo, soLuong: Number(c.soLuong || 0), ghiChu: c.ghiChu }));
    const thieu = tongLoi - ds.reduce((tg, d) => tg + d.soLuong, 0);
    // i18n-giu-nguyen: cùng câu máy chủ ghi vào biên bản; dịch lúc hiện (HopBienBanTraHang)
    return thieu > 0 ? [...ds, { maLo: l.maLo, lyDo: "Chưa ghi lý do", soLuong: thieu }] : ds;
  });
}

/**
 * Chi tiết phiếu nhập từ đơn mua — PA2 "Thanh 3 bước + bảng hàng" (FO-096 / FO-099 / FO-100).
 * Phiếu chuyển kho / hoàn trả vẫn dùng màn cũ trong PhieuNhapKhoDetail.
 */
export default function ChiTietNhapTuDonMua({ data, onReload }) {
  useClaimPageTitle(true);
  const navigate = useNavigate();
  const id = data.id;
  const items = useMemo(() => data.items ?? [], [data.items]);
  const nhap = data.trangThai === 0;
  const daNhap = data.trangThai === 3;
  const daHuy = data.trangThai === 4;
  const trangThaiPhieu = getGoodsReceiptStatus(data.trangThai);

  const [moXacNhan, setMoXacNhan] = useState(false);
  const [moHuy, setMoHuy] = useState(false);
  // Lý do hủy phiếu (bắt buộc, lưu vào ghi chú của phiếu)
  const [lyDoHuy, setLyDoHuy] = useState("");
  const [moHuyBienBan, setMoHuyBienBan] = useState(false);
  const [moBienBan, setMoBienBan] = useState(false);
  const [moXemBienBan, setMoXemBienBan] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const dangXuLyRef = useRef(false);

  // Lô đã khóa của từng biến thể (một yêu cầu cho mỗi biến thể, phiếu thường ít biến thể)
  const khoaLo = `${id}|${items.map((i) => `${i.bienTheSanPhamId}:${i.soLuongDatQc}:${i.soLuongLoiQc}:${i.soLoDaKhoa}`).join(",")}`;
  const lo = useTaiDuLieu(async () => {
    const ketQua = await Promise.all(
      items.map((i) =>
        phieuNhapKhoService
          .getLotInput(id, i.bienTheSanPhamId)
          .then((res) => [i.bienTheSanPhamId, Array.isArray(res?.data) ? res.data : []])
          .catch(() => [i.bienTheSanPhamId, null]),
      ),
    );
    return Object.fromEntries(ketQua);
  }, khoaLo);

  const bienBan = useTaiDuLieu(() => bienBanTraHangService.layTheoPhieuNhap(id), `${id}|${data.tongLoiBienBan ?? ""}|${data.maBienBanRtv ?? ""}`);

  // Số đạt / không đạt lấy từ máy chủ (lô đã khóa), không lấy từ trình duyệt đã kiểm: máy nào mở cũng ra cùng số
  const dong = useMemo(
    () =>
      items.map((item) => {
        const canNhap = Number(item.soLuongCanNhap || 0);
        const dat = Number(item.soLuongDatQc || 0);
        const loi = Number(item.soLuongLoiQc || 0);
        const kiem = dat + loi;
        const lots = lo.data?.[item.bienTheSanPhamId] ?? null;
        // Dòng biên bản đang hiệu lực của biến thể này: lô cũ chưa có lý do giữ lý do đã ghi trên biên bản khi lập lại
        const dongBienBan = (bienBan.data?.items ?? []).filter((d) => d.bienTheSanPhamId === item.bienTheSanPhamId);
        return {
          ...item,
          canNhap,
          dat,
          loi,
          kiem,
          dongLoi: dongLoiCuaLo(lots, dongBienBan),
          lots,
          trangThai: trangThaiKiemDem(kiem, canNhap),
        };
      }),
    [items, lo.data, bienBan.data],
  );

  const tong = dong.reduce(
    (tg, d) => ({ can: tg.can + d.canNhap, dat: tg.dat + d.dat, loi: tg.loi + d.loi, kiem: tg.kiem + d.kiem, xong: tg.xong + (d.kiem >= d.canNhap && d.canNhap > 0 ? 1 : 0) }),
    { can: 0, dat: 0, loi: 0, kiem: 0, xong: 0 },
  );
  const kiemXong = dong.length > 0 && tong.xong === dong.length;
  // Hàng lỗi theo lô của biến thể chưa khớp số lỗi của biến thể: lô chưa đọc được (đang tải lần đầu / lỗi), hoặc đang
  // tải lại mà còn giữ danh sách cũ (máy khác vừa khóa / xóa lô lỗi). Bảng hàng lỗi của hộp biên bản thiếu / thừa dòng
  const thieuLoLoi = dong.some((d) => d.dongLoi.reduce((tg, x) => tg + x.soLuong, 0) !== d.loi);
  const coBienBan = Boolean(data.coBienBanRtv);
  // Biên bản đã lập nhưng số lỗi đã đổi (xóa / khóa thêm lô lỗi): máy chủ khóa nhập kho tới khi lập lại
  const bienBanLech = Boolean(data.bienBanLech);
  const xuLyLoiXong = !data.safetyLock;
  const coTheXacNhan = nhap && kiemXong && xuLyLoiXong;
  // Kiểm đếm, lập biên bản, xác nhận, hủy: vai trò kho. Nhân viên mua hàng chỉ xem phiếu (SRS 4.4 "Goods Receipt")
  const xuLyKho = hasAnyRole(VAI_TRO_KHO);
  // In tem theo phiếu đã nhập kho: số tem = số lượng thực nhận (đạt kiểm đếm) của từng biến thể
  const coTheInTem = daNhap && xuLyKho;
  const [dongInTem, setDongInTem] = useState(null);
  // "Đặt giá" ở hộp In tem (SKU chưa có giá): mở form Sửa sản phẩm ngay tại phiếu — giá bán chỉ đổi ở form đó
  const [spDatGia, setSpDatGia] = useState(null);
  const [dangLayTem, setDangLayTem] = useState(false);
  const moInTem = async () => {
    if (dangLayTem) return;
    setDangLayTem(true);
    try {
      const ds = await phieuNhapKhoService.soLuongInTem(id);
      setDongInTem(ds.map(chuanHoaDongInTem));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("Không lấy được số lượng in tem của phiếu")));
    } finally {
      setDangLayTem(false);
    }
  };

  const moKiemDem = (bienTheId) => navigate(`/goods-receipts/${id}/receive/${bienTheId}`);
  const bienTheTiepTheo = dong.find((d) => d.kiem < d.canNhap) ?? dong[0];

  // Máy chủ tự đẩy tồn các SKU vừa nhập lên các sàn đang bật tự động đẩy tồn ngay khi xác nhận, frontend không gọi thêm
  const xacNhanNhapKho = useCallback(
    async () => {
      if (dangXuLyRef.current) return;
      dangXuLyRef.current = true;
      setDangXuLy(true);
      try {
        await phieuNhapKhoService.complete(id);
        toast.success(t("Đã nhập kho {{dat}} sản phẩm", { count: tong.dat, dat: formatNumber(tong.dat) }));
        setMoXacNhan(false);
        onReload();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t("Xác nhận nhập kho thất bại")));
      } finally {
        dangXuLyRef.current = false;
        setDangXuLy(false);
      }
    },
    [id, onReload, tong.dat],
  );

  const huyPhieu = async () => {
    if (dangXuLyRef.current) return;
    dangXuLyRef.current = true;
    setDangXuLy(true);
    try {
      await phieuNhapKhoService.cancel(id, lyDoHuy.trim());
      toast.success(t("Đã hủy phiếu nhập kho"));
      setMoHuy(false);
      navigate("/goods-receipts");
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("Hủy phiếu thất bại")));
    } finally {
      dangXuLyRef.current = false;
      setDangXuLy(false);
    }
  };

  // huy: bấm "Hủy biên bản" (cùng API phát hành, máy chủ hủy khi không còn hàng lỗi).
  // Trả true khi máy chủ đã xử lý xong, false khi lỗi: hộp gọi chỉ đóng khi thành công
  const phatHanhBienBan = async ({ huy = false, ...payload }) => {
    if (dangXuLyRef.current) return false;
    dangXuLyRef.current = true;
    setDangXuLy(true);
    try {
      // Máy chủ tự lấy dòng biên bản từ hàng không đạt đã lưu theo lô
      const ketQua = await bienBanTraHangService.phatHanh(id, payload);
      if (huy && ketQua) {
        // Trang đã cũ: máy khác vừa khóa thêm lô lỗi nên máy chủ lập lại biên bản thay vì hủy
        toast.warning(t("Biên bản {{soBienBan}} được lập lại, không hủy", { soBienBan: ketQua.soBienBan || data.maBienBanRtv || "" }), {
          description: t("Phiếu vừa có thêm hàng lỗi nên biên bản được lập lại theo hàng lỗi mới. Mở biên bản để kiểm tra lại."),
        });
      } else {
        let cau = t("Đã hủy biên bản vì không còn hàng lỗi");
        if (ketQua) cau = bienBanLech ? t("Đã lập lại biên bản trả hàng") : t("Đã lập biên bản trả hàng");
        // Có người ký: biên bản chờ ghi đã ký mới gửi nhà cung cấp
        toast.success(cau, choKyBienBan(ketQua) ? { description: t("In biên bản cho người giao hàng ký rồi bấm Ghi đã ký.") } : undefined);
      }
      setMoBienBan(false);
      onReload();
      // Lập lại giữ số biên bản và có thể giữ tổng lỗi: khóa tải biên bản không đổi nên phải tải lại ở đây
      bienBan.reload();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, huy ? t("Không hủy được biên bản") : t("Không lập được biên bản")));
      return false;
    } finally {
      dangXuLyRef.current = false;
      setDangXuLy(false);
    }
  };

  // ── 3 bước ──
  const b1 = kiemXong || daNhap ? "xong" : "dang";
  const b2 = daNhap || (kiemXong && xuLyLoiXong) ? "xong" : kiemXong || bienBanLech ? "dang" : "cho";
  const b3 = daNhap ? "xong" : coTheXacNhan ? "dang" : "cho";
  const bb = bienBan.data ?? null;
  // Hàng lỗi đã trả ngay cho người giao hàng (đã ký nhận): máy chủ không cho sửa kiểm đếm, không hủy phiếu (chỉ còn nhập kho)
  const daTraNgay = bb?.cachXuLyHang === "TRA_NGAY" && bb?.trangThaiHang === "DA_TRA" && bb?.trangThai !== "DA_HUY";
  // Biên bản lập xong, chưa ghi người giao hàng đã ký: chưa gửi nhà cung cấp, chưa nhập kho được
  const choKy = choKyBienBan(bb);

  let moTa2;
  let nut2 = null;
  // Nút "Xem biên bản" chỉ đọc: nhân viên mua hàng vẫn xem được biên bản đã lập (ghi đã ký chỉ kho làm)
  let nut2ChiXem = false;
  if (bienBanLech && nhap) {
    moTa2 = !tong.loi
      ? t("Biên bản {{maBienBanRtv}} ghi {{tongLoiBienBan}} sản phẩm lỗi nhưng không còn lô nào có hàng lỗi. Hủy biên bản trước khi nhập kho.", { maBienBanRtv: data.maBienBanRtv, count: Number(data.tongLoiBienBan) || 0, tongLoiBienBan: formatNumber(data.tongLoiBienBan) })
      : Number(data.tongLoiBienBan) !== tong.loi
        ? t("Biên bản {{maBienBanRtv}} ghi {{tongLoiBienBan}} sản phẩm lỗi nhưng kiểm đếm hiện có {{loi}}. Lập lại biên bản trước khi nhập kho.", { maBienBanRtv: data.maBienBanRtv, count: Number(data.tongLoiBienBan) || 0, tongLoiBienBan: formatNumber(data.tongLoiBienBan), loi: formatNumber(tong.loi) })
        : t("Biên bản {{maBienBanRtv}} không còn khớp các lô có hàng lỗi (có lô đã xóa hoặc khóa lại). Lập lại biên bản trước khi nhập kho.", { maBienBanRtv: data.maBienBanRtv });
    nut2 = tong.loi ? (
      <Button onClick={() => setMoBienBan(true)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
        <FileCheck2 className="size-4" /> {t("Lập lại biên bản")}
      </Button>
    ) : (
      <Button variant="outline" disabled={dangXuLy} onClick={() => setMoHuyBienBan(true)} className="border-bo-border bg-bo-surface text-bo-danger hover:bg-bo-danger-soft">
        {t("Hủy biên bản")}
      </Button>
    );
  } else if (!kiemXong && !daNhap) moTa2 = tong.loi ? t("Mở sau khi kiểm xong. Đã ghi nhận {{loi}} sản phẩm lỗi.", { count: tong.loi, loi: formatNumber(tong.loi) }) : t("Mở sau khi kiểm xong.");
  else if (tong.loi === 0) moTa2 = t("Không có hàng lỗi, bỏ qua bước này.");
  else if (coBienBan) {
    // Trước nhập kho: hàng lỗi đi đâu; sau nhập kho: trạng thái của biên bản (chờ nhà cung cấp chọn, chờ giao trả...)
    // Hạ chữ đầu, giữ chữ viết tắt (NCC) nguyên dạng
    const haChuDau = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
    let phanTrangThai = "";
    if (bb && choKy) phanTrangThai = t("chờ {{ten}} ký", { ten: bb.nguoiGiao || "" });
    else if (bb && daNhap) phanTrangThai = haChuDau(t(trangThaiTraHang(bb.trangThaiHienThi).label));
    else if (bb && daTraNgay) phanTrangThai = t("đã trả người giao hàng {{ten}}", { ten: bb.nguoiNhanHang || "" }).trim();
    else if (bb) phanTrangThai = haChuDau(tenCachXuLy(bb.cachXuLyHang));
    moTa2 = t("Biên bản {{maBienBanRtv}} · {{loi}} sản phẩm{{phanTrangThai}}.", { maBienBanRtv: data.maBienBanRtv, count: tong.loi, loi: formatNumber(tong.loi), phanTrangThai: phanTrangThai ? ` · ${phanTrangThai}` : "" });
    if (choKy) moTa2 = `${moTa2} ${t("In cho người giao hàng ký rồi ghi đã ký để gửi nhà cung cấp và nhập kho.")}`;
    nut2 = (
      <>
        {choKy && xuLyKho ? (
          <Button onClick={() => setMoXemBienBan(true)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
            <PenLine className="size-4" /> {t("Ghi đã ký")}
          </Button>
        ) : (
          <Button variant="outline" disabled={!bb} onClick={() => setMoXemBienBan(true)} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">{t("Xem biên bản")}</Button>
        )}
        {bb ? (
          <Button variant="outline" onClick={() => moTrangIn(duongDanInBienBan(bb.id), navigate)} className="gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
            <Printer className="size-4" /> {t("In biên bản")}
          </Button>
        ) : null}
      </>
    );
    nut2ChiXem = true;
  } else {
    moTa2 = t("{{loi}} sản phẩm lỗi phải lập biên bản trả nhà cung cấp trước khi nhập kho.", { count: tong.loi, loi: formatNumber(tong.loi) });
    nut2 = (
      <Button onClick={() => setMoBienBan(true)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
        <FileCheck2 className="size-4" /> {t("Lập biên bản trả hàng")}
      </Button>
    );
  }

  if (!xuLyKho && !nut2ChiXem) nut2 = null;

  const soLoKe = new Set(Object.values(lo.data ?? {}).flat().filter(Boolean).map((l) => l.maLo)).size;
  const moTa3 = daNhap
    ? t("Đã nhập {{dat}} sản phẩm vào kho {{tenKho}}.", { count: tong.dat, dat: formatNumber(tong.dat), tenKho: data.tenKho || "" })
    : t("{{dat}} sản phẩm đạt{{phanLo}}. Tồn kho được cộng ngay khi xác nhận.", { count: tong.dat, dat: formatNumber(tong.dat), phanLo: soLoKe ? t(" trong {{soLoKe}} lô", { count: soLoKe, soLoKe }) : "" });

  const oThongTin = [
    [t("Nhà cung cấp"), data.tenNhaCungCap || "—", null],
    [t("Kho nhận"), data.tenKho || "—", null],
    [
      t("Đơn mua hàng"),
      data.donMuaHangId ? (
        <Link to={`/purchase-orders/${data.donMuaHangId}`} className="text-bo-primary hover:text-bo-primary-hover">{data.soDonMua}</Link>
      ) : (data.soDonMua || "—"),
      null,
    ],
    [t("Ngày nhập"), formatDate(data.ngayNhap), data.tenNguoiNhap || null],
  ];

  return (
    <PageContainer className="flex flex-col gap-4 pb-24">
      <button
        type="button"
        onClick={() => navigate("/goods-receipts")}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
      >
        <ArrowLeft className="size-4" /> {t("Phiếu nhập kho")}
      </button>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className={cn("min-w-0 truncate", PAGE_HEADING_TYPE)}>{data.soPhieuNhap}</h1>
          <StatusBadge quyTrinh="phieuNhap" size="lg" label={trangThaiPhieu.label} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {coTheInTem ? (
            <Button variant="outline" disabled={dangLayTem} onClick={moInTem} className="gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
              {dangLayTem ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} {t("In tem")}
            </Button>
          ) : null}
          {!daHuy ? (
            <Button variant="outline" onClick={() => moTrangIn(`/goods-receipts/${id}/print`, navigate)} className="gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
              <Printer className="size-4" /> {t("In phiếu")}
            </Button>
          ) : null}
          {nhap && xuLyKho && !daTraNgay ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("Thao tác khác")} className="text-bo-muted hover:bg-slate-100 hover:text-bo-foreground">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg">
                <DropdownMenuItem
                  onClick={() => {
                    setLyDoHuy("");
                    setMoHuy(true);
                  }}
                  className="cursor-pointer gap-2 rounded-md text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger"
                >
                  <X className="size-4" /> {t("Hủy phiếu")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <DaiO soO={4}>
        {oThongTin.map(([nhan, giaTri, phu]) => (
          <div key={nhan} className="flex min-w-0 flex-col gap-1 bg-bo-surface px-4 py-4">
            <span className="text-xs font-medium text-bo-muted">{nhan}</span>
            <span title={typeof giaTri === "string" ? giaTri : undefined} className="truncate text-sm font-semibold text-bo-heading">{giaTri}</span>
            {phu ? <span className="truncate text-xs text-bo-muted">{phu}</span> : null}
          </div>
        ))}
      </DaiO>

      {daHuy ? (
        <DongThongBao>{t("Phiếu nhập đã hủy, không kiểm đếm hay nhập kho được nữa.")}</DongThongBao>
      ) : (
        // Màn vừa (768 có thanh menu) vùng nội dung chỉ ~490px: 3 bước xếp dọc tới màn rộng
        <DaiO soO={3} className="md:grid-cols-1 lg:grid-cols-3">
          <OBuoc
            trangThai={b1}
            so={1}
            nhan={t("Bước 1")}
            tieuDe={t("Kiểm đếm hàng")}
            moTa={t("{{xong}}/{{tongBienThe}} biến thể · {{kiem}}/{{can}} sản phẩm", { count: dong.length, xong: formatNumber(tong.xong), tongBienThe: formatNumber(dong.length), kiem: formatNumber(tong.kiem), can: formatNumber(tong.can) })}
            phu={<ThanhMuc className="mt-1" phanTram={tong.can ? (tong.kiem / tong.can) * 100 : 0} tone={kiemXong ? "ok" : ""} label={t("Tiến độ kiểm đếm")} />}
            hanhDong={
              kiemXong || daNhap ? (
                <span className="text-xs text-bo-muted">{t("Đã kiểm hết hàng theo đơn mua")}</span>
              ) : bienTheTiepTheo && xuLyKho ? (
                <Button onClick={() => moKiemDem(bienTheTiepTheo.bienTheSanPhamId)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                  <ScanLine className="size-4" /> {t("Kiểm biến thể tiếp theo")}
                </Button>
              ) : null
            }
          />
          <OBuoc trangThai={b2} so={2} nhan={t("Bước 2")} tieuDe={t("Xử lý hàng lỗi")} moTa={moTa2} hanhDong={nut2} />
          <OBuoc
            trangThai={b3}
            so={3}
            nhan={t("Bước 3")}
            tieuDe={t("Xác nhận nhập kho")}
            moTa={moTa3}
            hanhDong={
              daNhap ? (
                <span className="text-xs text-bo-muted">{t("Hoàn tất")}</span>
              ) : !xuLyKho ? null : (
                <Button
                  disabled={!coTheXacNhan || dangXuLy}
                  onClick={() => setMoXacNhan(true)}
                  className={cn(
                    "gap-2",
                    coTheXacNhan
                      ? "bg-bo-primary text-white hover:bg-bo-primary-hover"
                      : "border border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface",
                  )}
                >
                  <Check className="size-4" /> {t("Xác nhận nhập kho")}
                </Button>
              )
            }
          />
        </DaiO>
      )}

      {daNhap ? (
        <TheHoaDonNhaCungCap
          phieuNhapKhoId={id}
          bienBanTraHang={bb}
          tongDat={tong.dat}
          giaTriDat={Number(data.tongTien) || 0}
          coTheSua={hasAnyRole(VAI_TRO_SUA_HOA_DON_NCC)}
        />
      ) : null}

      <TableShell
        toolbar={
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-bo-border px-4 py-2">
            <h2 className="text-base font-semibold text-bo-foreground">{t("Hàng theo đơn mua")}</h2>
          </div>
        }
      >
        {/* Điện thoại và máy tính bảng dọc cảm ứng: mỗi biến thể một thẻ — tên + trạng thái, thanh đã kiểm, đạt · lỗi · lô, nút
            Kiểm đếm / Xem lô ngay trên thẻ (bảng rộng 1000px phải vuốt ngang mới tới nút, kể cả ở 820px) */}
        <ul className="divide-y divide-bo-border md:hidden cam-ung:max-lg:block">
          {dong.map((d) => {
            const chuaKiem = d.kiem === 0;
            const nhanNut = !nhap || d.kiem >= d.canNhap ? t("Xem lô") : chuaKiem ? t("Kiểm đếm") : t("Tiếp tục kiểm");
            const soLo = d.lots == null ? (lo.loading ? t("đang tải lô…") : null) : d.lots.length ? t("{{soLo}} lô", { count: d.lots.length, soLo: d.lots.length }) : t("chưa có lô");
            return (
              <li key={d.bienTheSanPhamId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-bo-foreground">{d.tenBienThe}</div>
                    <div className="text-xs text-bo-muted">
                      {d.mauSac || d.kichCo ? (
                        <>
                          <MauKichCo tenMau={d.mauSac} maMauHex={d.maMauHex} kichCo={d.kichCo} className="max-w-full align-bottom" />
                          {" · "}
                        </>
                      ) : null}
                      <span className="font-mono">{d.sku}</span>
                    </div>
                  </div>
                  <StatusBadge quyTrinh="kiemDem" label={d.trangThai.label} />
                </div>
                <TienDoSo da={d.kiem} tong={d.canNhap} />
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px] tabular-nums text-bo-muted">
                    {chuaKiem ? t("Chưa kiểm") : (
                      <>
                        {t("Đạt")} <b className="font-semibold text-bo-foreground">{formatNumber(d.dat)}</b> {t("· Lỗi")}{" "}
                        <b className={cn("font-semibold", d.loi ? "text-bo-danger" : "text-bo-foreground")}>{formatNumber(d.loi)}</b>
                      </>
                    )}
                    {soLo ? ` · ${soLo}` : ""}
                  </span>
                  {xuLyKho ? (
                    <Button
                      variant="outline"
                      onClick={() => moKiemDem(d.bienTheSanPhamId)}
                      className="h-9 shrink-0 border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground hover:border-bo-primary hover:text-bo-primary"
                    >
                      {nhanNut}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {dong.length === 0 ? <li className="px-4 py-10 text-center text-sm text-bo-muted">{t("Phiếu nhập chưa có hàng hóa.")}</li> : null}
        </ul>
        <table className="w-full min-w-[1000px] text-sm max-md:hidden cam-ung:max-lg:hidden">
          <thead>
            <tr className="border-b border-bo-border bg-bo-surface-subtle">
              <th className={cn(TH, "text-left")}>{t("Biến thể")}</th>
              <th className={cn(TH, "w-[184px] text-left")}>{t("Đã kiểm")}</th>
              <th className={cn(TH, "w-20 text-right")}>{t("Đạt")}</th>
              <th className={cn(TH, "w-20 text-right")}>{t("Lỗi")}</th>
              <th className={cn(TH, "w-[180px] text-left")}>{t("Lô đã khóa")}</th>
              <th className={cn(TH, "w-[150px] text-left")}>{t("Trạng thái")}</th>
              <th className={cn(TH, "w-[152px]")}><span className="sr-only">{t("Thao tác")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bo-border">
            {dong.map((d) => {
              const chuaKiem = d.kiem === 0;
              const nhanNut = !nhap || d.kiem >= d.canNhap ? t("Xem lô") : chuaKiem ? t("Kiểm đếm") : t("Tiếp tục kiểm");
              return (
                <tr key={d.bienTheSanPhamId} className="transition-colors hover:bg-bo-surface-subtle">
                  <td className="h-14 px-4 py-2">
                    <div className="font-semibold text-bo-foreground">{d.tenBienThe}</div>
                    <div className="text-xs text-bo-muted">
                      {d.mauSac || d.kichCo ? (
                        <>
                          <MauKichCo tenMau={d.mauSac} maMauHex={d.maMauHex} kichCo={d.kichCo} className="max-w-full align-bottom" />
                          {" · "}
                        </>
                      ) : null}
                      <span className="font-mono">{d.sku}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2"><TienDoSo da={d.kiem} tong={d.canNhap} /></td>
                  <td className="px-4 py-2 text-right tabular-nums">{chuaKiem ? <span className="text-bo-muted">—</span> : formatNumber(d.dat)}</td>
                  <td className={cn("px-4 py-2 text-right tabular-nums", d.loi ? "font-semibold text-bo-danger" : "text-bo-muted")}>
                    {chuaKiem ? "—" : formatNumber(d.loi)}
                  </td>
                  {/* Mã lô dài (tiền tố + số phiếu): xuống dòng dưới số lô và cắt gọn, không đẩy cột Biến thể hẹp lại */}
                  <td className="max-w-[180px] px-4 py-2">
                    {d.lots == null ? (
                      <span className="text-bo-muted">{lo.loading ? t("Đang tải…") : "—"}</span>
                    ) : d.lots.length ? (
                      <div className="min-w-0">
                        <div>{t("{{soLo}} lô", { count: d.lots.length, soLo: d.lots.length })}</div>
                        <div className="truncate font-mono text-xs text-bo-muted" title={d.lots.map((l) => l.maLo).join(", ")}>
                          {d.lots.map((l) => l.maLo).join(", ")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-bo-muted">{t("Chưa có lô")}</span>
                    )}
                  </td>
                  <td className="px-4 py-2"><StatusBadge quyTrinh="kiemDem" label={d.trangThai.label} /></td>
                  <td className="px-4 py-2 text-right">
                    {xuLyKho ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moKiemDem(d.bienTheSanPhamId)}
                        className="min-w-[120px] border-bo-border bg-bo-surface text-xs text-bo-foreground hover:border-bo-primary hover:text-bo-primary"
                      >
                        {nhanNut}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {dong.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-24 px-4 text-center text-sm text-bo-muted">{t("Phiếu nhập chưa có hàng hóa.")}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>

      <HopXacNhanNhapKho
        open={moXacNhan}
        onOpenChange={setMoXacNhan}
        phieu={data}
        dong={dong.map((d) => ({ ...d, lots: d.lots ?? [] }))}
        dangXuLy={dangXuLy}
        onXacNhan={xacNhanNhapKho}
      />
      <HopBienBanTraHang
        open={moBienBan}
        onOpenChange={setMoBienBan}
        phieu={data}
        dongLoi={dong.flatMap((d) => d.dongLoi.map((l) => ({ ...l, tenBienThe: d.tenBienThe, mauSac: d.mauSac, kichCo: d.kichCo, sku: d.sku })))}
        bienBan={bienBan.data ?? null}
        // Phiếu có biên bản mà biên bản chưa tải xong: hộp chờ, không mở chế độ Lập với phương án mặc định
        dangTaiBienBan={coBienBan && !bienBan.data && !bienBan.error}
        loiTaiBienBan={coBienBan && !bienBan.data && Boolean(bienBan.error)}
        dangTaiLo={thieuLoLoi && lo.loading}
        loiTaiLo={thieuLoLoi && !lo.loading}
        lapLai={bienBanLech}
        dangXuLy={dangXuLy}
        onPhatHanh={phatHanhBienBan}
      />
      <HopXemBienBanTraHang
        open={moXemBienBan}
        onOpenChange={setMoXemBienBan}
        bienBan={bb}
        onDaDoi={() => {
          bienBan.reload();
          onReload();
        }}
      />
      <ConfirmModal
        isOpen={moHuyBienBan}
        onClose={() => setMoHuyBienBan(false)}
        onConfirm={async () => {
          // Gửi lại ghi chú đang có: máy chủ lỡ lập lại (trang cũ) thì không xóa ghi chú. Lỗi thì giữ hộp mở
          if (await phatHanhBienBan({ cachXuLy: bb?.cachXuLyHang ?? "GIU_KHO", benKy: bb?.benKy === "VAN_CHUYEN" ? "VAN_CHUYEN" : "DAI_DIEN_NCC", nguoiNhanHang: bb?.nguoiGiao ?? null, bienSoXe: bb?.bienSoXe ?? null, donViVanChuyen: bb?.donViVanChuyen ?? null, ghiChu: bb?.ghiChu ?? "", huy: true })) setMoHuyBienBan(false);
        }}
        title={t("Hủy biên bản trả hàng")}
        description={t("Biên bản {{maBienBanRtv}} không còn hàng lỗi để trả nhà cung cấp. Hủy biên bản để nhập kho được.", { maBienBanRtv: data.maBienBanRtv || "" })}
        confirmText={t("Hủy biên bản")}
        cancelText={t("Quay lại")}
        isLoading={dangXuLy}
      />
      <HopXacNhanChungTu
        mo={moHuy}
        onDoiMo={setMoHuy}
        tieuDe={t("Hủy phiếu nhập kho")}
        moTa={t("Các lô đã khóa của phiếu bị bỏ (chưa vào tồn kho) và biên bản trả hàng nếu có cũng bị hủy. Thao tác không hoàn tác được.")}
        nhanXacNhan={t("Hủy phiếu")}
        kieu="nguyHiem"
        dangChay={dangXuLy}
        khoaXacNhan={!lyDoHuy.trim()}
        lyDoKhoa={t("Nhập lý do hủy")}
        onXacNhan={huyPhieu}
      >
        <OLyDo giaTri={lyDoHuy} onDoi={setLyDoHuy} goiY={t("Ví dụ: Nhà cung cấp giao nhầm đơn, lập lại phiếu khác")} disabled={dangXuLy} />
      </HopXacNhanChungTu>
      <HopInTem
        open={Boolean(dongInTem)}
        onOpenChange={(mo) => !mo && setDongInTem(null)}
        nguon="phieu"
        dong={dongInTem ?? []}
        maPhieu={data.soPhieuNhap}
        onDatGia={
          hasAnyRole([ROLES.QUAN_TRI_VIEN])
            ? (d) => {
                if (d?.sanPhamId == null) return;
                setDongInTem(null);
                setSpDatGia(d.sanPhamId);
              }
            : undefined
        }
      />
      {hasAnyRole([ROLES.QUAN_TRI_VIEN]) ? (
        <EditProductModal isOpen={spDatGia != null} onClose={() => setSpDatGia(null)} productId={spDatGia} />
      ) : null}
    </PageContainer>
  );
}
