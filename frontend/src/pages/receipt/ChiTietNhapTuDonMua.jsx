import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { ArrowLeft, Check, FileCheck2, Loader2, MoreHorizontal, Printer, ScanLine, X } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import { useClaimPageTitle, PAGE_HEADING_TYPE } from "@/components/backoffice/pageTitle";
import StatusBadge from "@/components/shared/StatusBadge";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
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
import { DaiO, OBuoc, ThanhMuc, TienDoSo } from "@/components/nhap-kho/ThanhBuoc";
import { quyTacTonKho } from "@/components/channel/cauHinhDongBo";
import { ketQuaDayTon } from "@/components/channel/ketQuaThaoTac";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import { PHUONG_AN_MAC_DINH, PHUONG_AN_TRA_HANG, chuanHoaPhuongAn, trangThaiKiemDem } from "@/constants/nhapKho";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { THONG_BAO_CHUA_HO_TRO_BIEN_BAN, bienBanTraHangService } from "@/services/bienBanTraHangService";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate, formatNumber } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { chuanHoaDongInTem } from "@/components/print/tinhTem";
import HopInTem from "@/pages/product/components/product/HopInTem";

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const KENH_SHOPIFY = "SHOPIFY";

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
      if (cu.length && cu.reduce((t, d) => t + Number(d.soLuong || 0), 0) === tongLoi) {
        return cu.map((d) => ({ maLo: l.maLo, lyDo: d.lyDo, soLuong: Number(d.soLuong || 0), ghiChu: d.ghiChu }));
      }
    }
    const ds = (l.chiTietLoi ?? []).map((c) => ({ maLo: l.maLo, lyDo: c.lyDo, soLuong: Number(c.soLuong || 0), ghiChu: c.ghiChu }));
    const thieu = tongLoi - ds.reduce((t, d) => t + d.soLuong, 0);
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
  const [moHuyBienBan, setMoHuyBienBan] = useState(false);
  const [moBienBan, setMoBienBan] = useState(false);
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

  const bienBan = useTaiDuLieu(() => bienBanTraHangService.layTheoPhieuNhap(id), `${id}|${data.tongLoiBienBan ?? ""}|${data.maBienBanRtv ?? ""}`, {
    enabled: bienBanTraHangService.hoTro,
  });

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
    (t, d) => ({ can: t.can + d.canNhap, dat: t.dat + d.dat, loi: t.loi + d.loi, kiem: t.kiem + d.kiem, xong: t.xong + (d.kiem >= d.canNhap && d.canNhap > 0 ? 1 : 0) }),
    { can: 0, dat: 0, loi: 0, kiem: 0, xong: 0 },
  );
  const kiemXong = dong.length > 0 && tong.xong === dong.length;
  // Hàng lỗi theo lô của biến thể chưa khớp số lỗi của biến thể: lô chưa đọc được (đang tải lần đầu / lỗi), hoặc đang
  // tải lại mà còn giữ danh sách cũ (máy khác vừa khóa / xóa lô lỗi). Bảng hàng lỗi của hộp biên bản thiếu / thừa dòng
  const thieuLoLoi = dong.some((d) => d.dongLoi.reduce((t, x) => t + x.soLuong, 0) !== d.loi);
  const coBienBan = Boolean(data.coBienBanRtv);
  // Biên bản đã lập nhưng số lỗi đã đổi (xóa / khóa thêm lô lỗi): máy chủ khóa nhập kho tới khi lập lại
  const bienBanLech = Boolean(data.bienBanLech);
  const xuLyLoiXong = !data.safetyLock;
  const coTheXacNhan = nhap && kiemXong && xuLyLoiXong;
  const coTheDayTon = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  // In tem theo phiếu đã nhập kho: số tem = số lượng thực nhận (đạt kiểm đếm) của từng biến thể
  const coTheInTem = daNhap && hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]);
  const [dongInTem, setDongInTem] = useState(null);
  const [dangLayTem, setDangLayTem] = useState(false);
  const moInTem = async () => {
    if (dangLayTem) return;
    setDangLayTem(true);
    try {
      const ds = await phieuNhapKhoService.soLuongInTem(id);
      setDongInTem(ds.map(chuanHoaDongInTem));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lấy được số lượng in tem của phiếu"));
    } finally {
      setDangLayTem(false);
    }
  };

  const moKiemDem = (bienTheId) => navigate(`/goods-receipts/${id}/receive/${bienTheId}`);
  const bienTheTiepTheo = dong.find((d) => d.kiem < d.canNhap) ?? dong[0];

  const xacNhanNhapKho = useCallback(
    async ({ dayTon }) => {
      if (dangXuLyRef.current) return;
      dangXuLyRef.current = true;
      setDangXuLy(true);
      try {
        await phieuNhapKhoService.complete(id);
        toast.success(`Đã nhập kho ${formatNumber(tong.dat)} sản phẩm`);
        setMoXacNhan(false);
        if (dayTon) {
          try {
            const cauHinh = await kenhBanHangService.getCauHinhDongBo(KENH_SHOPIFY);
            const res = await kenhBanHangService.dayTon(KENH_SHOPIFY, quyTacTonKho(cauHinh));
            const kq = ketQuaDayTon(res, "Shopify");
            (kq.tone === "error" ? toast.error : kq.ok ? toast.success : toast.warning)(kq.title, { description: kq.message });
          } catch (error) {
            toast.warning("Đã nhập kho nhưng chưa đẩy được tồn lên Shopify", {
              description: getApiErrorMessage(error, "Hệ thống sẽ tự đẩy ở chu kỳ đồng bộ tiếp theo."),
            });
          }
        }
        onReload();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Xác nhận nhập kho thất bại"));
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
      await phieuNhapKhoService.cancel(id);
      toast.success("Đã hủy phiếu nhập kho");
      setMoHuy(false);
      navigate("/goods-receipts");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Hủy phiếu thất bại"));
    } finally {
      dangXuLyRef.current = false;
      setDangXuLy(false);
    }
  };

  // huy: bấm "Hủy biên bản" (cùng API phát hành, máy chủ hủy khi không còn hàng lỗi).
  // Trả true khi máy chủ đã xử lý xong, false khi lỗi: hộp gọi chỉ đóng khi thành công
  const phatHanhBienBan = async ({ phuongAn, ghiChu, huy = false }) => {
    if (dangXuLyRef.current) return false;
    dangXuLyRef.current = true;
    setDangXuLy(true);
    try {
      // Máy chủ tự lấy dòng biên bản từ hàng không đạt đã lưu theo lô
      const ketQua = await bienBanTraHangService.phatHanh(id, { phuongAn, ghiChu });
      if (huy && ketQua) {
        // Trang đã cũ: máy khác vừa khóa thêm lô lỗi nên máy chủ lập lại biên bản thay vì hủy
        toast.warning(`Biên bản ${ketQua.soBienBan || data.maBienBanRtv || ""} được lập lại, không hủy`, {
          description: "Phiếu vừa có thêm hàng lỗi nên biên bản được lập lại theo hàng lỗi mới. Mở biên bản để kiểm tra phương án và ghi chú.",
        });
      } else {
        toast.success(ketQua ? (bienBanLech ? "Đã lập lại biên bản trả hàng" : "Đã phát hành biên bản trả hàng") : "Đã hủy biên bản vì không còn hàng lỗi");
      }
      setMoBienBan(false);
      onReload();
      // Lập lại giữ số biên bản và có thể giữ tổng lỗi: khóa tải biên bản không đổi nên phải tải lại ở đây
      bienBan.reload();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, huy ? "Không hủy được biên bản" : "Không phát hành được biên bản"));
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
  // Biên bản lập trước khi đổi tên phương án mang mã cũ DOI_HANG_MOI
  const maPhuongAnHienTai = chuanHoaPhuongAn(bienBan.data?.phuongAn ?? data.phuongAnBienBan) ?? PHUONG_AN_MAC_DINH;
  const tenPhuongAn = PHUONG_AN_TRA_HANG.find((p) => p.ma === maPhuongAnHienTai)?.ten;

  let moTa2;
  let nut2 = null;
  if (bienBanLech && nhap) {
    moTa2 = !tong.loi
      ? `Biên bản ${data.maBienBanRtv} ghi ${formatNumber(data.tongLoiBienBan)} sản phẩm lỗi nhưng không còn lô nào có hàng lỗi. Hủy biên bản trước khi nhập kho.`
      : Number(data.tongLoiBienBan) !== tong.loi
        ? `Biên bản ${data.maBienBanRtv} ghi ${formatNumber(data.tongLoiBienBan)} sản phẩm lỗi nhưng kiểm đếm hiện có ${formatNumber(tong.loi)}. Lập lại biên bản trước khi nhập kho.`
        : `Biên bản ${data.maBienBanRtv} không còn khớp các lô có hàng lỗi (có lô đã xóa hoặc khóa lại). Lập lại biên bản trước khi nhập kho.`;
    nut2 = tong.loi ? (
      <Button onClick={() => setMoBienBan(true)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
        <FileCheck2 className="size-4" /> Lập lại biên bản
      </Button>
    ) : (
      <Button variant="outline" disabled={dangXuLy} onClick={() => setMoHuyBienBan(true)} className="border-bo-border bg-white text-bo-danger hover:bg-bo-danger-soft">
        Hủy biên bản
      </Button>
    );
  } else if (!kiemXong && !daNhap) moTa2 = tong.loi ? `Mở sau khi kiểm xong. Đã ghi nhận ${formatNumber(tong.loi)} sản phẩm lỗi.` : "Mở sau khi kiểm xong.";
  else if (tong.loi === 0) moTa2 = "Không có hàng lỗi, bỏ qua bước này.";
  else if (coBienBan) {
    moTa2 = `Biên bản ${data.maBienBanRtv} · ${formatNumber(tong.loi)} sản phẩm${tenPhuongAn ? ` · ${tenPhuongAn}` : ""}.${bienBanTraHangService.mau ? " (Dữ liệu mẫu, chưa lưu máy chủ.)" : ""}`;
    nut2 = <Button variant="outline" onClick={() => setMoBienBan(true)} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">Xem biên bản</Button>;
  } else if (bienBanTraHangService.hoTro) {
    moTa2 = `${formatNumber(tong.loi)} sản phẩm lỗi phải lập biên bản trả nhà cung cấp trước khi nhập kho.${bienBanTraHangService.mau ? " (Biên bản là dữ liệu mẫu, chưa lưu máy chủ.)" : ""}`;
    nut2 = (
      <Button onClick={() => setMoBienBan(true)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
        <FileCheck2 className="size-4" /> Lập biên bản trả hàng
      </Button>
    );
  } else {
    moTa2 = `${formatNumber(tong.loi)} sản phẩm lỗi. ${THONG_BAO_CHUA_HO_TRO_BIEN_BAN}`;
  }

  const soLoKe = new Set(Object.values(lo.data ?? {}).flat().filter(Boolean).map((l) => l.maLo)).size;
  const moTa3 = daNhap
    ? `Đã nhập ${formatNumber(tong.dat)} sản phẩm vào kho ${data.tenKho || ""}.`
    : `${formatNumber(tong.dat)} sản phẩm đạt${soLoKe ? ` trong ${soLoKe} lô` : ""}. Tồn kho được cộng ngay khi xác nhận.`;

  const oThongTin = [
    ["Nhà cung cấp", data.tenNhaCungCap || "—", null],
    ["Kho nhận", data.tenKho || "—", null],
    [
      "Đơn mua hàng",
      data.donMuaHangId ? (
        <Link to={`/purchase-orders/${data.donMuaHangId}`} className="text-bo-primary hover:text-bo-primary-hover">{data.soDonMua}</Link>
      ) : (data.soDonMua || "—"),
      null,
    ],
    ["Ngày nhập", formatDate(data.ngayNhap), data.tenNguoiNhap || null],
  ];

  return (
    <PageContainer className="flex flex-col gap-4 pb-24">
      <button
        type="button"
        onClick={() => navigate("/goods-receipts")}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
      >
        <ArrowLeft className="size-4" /> Phiếu nhập kho
      </button>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className={cn("min-w-0 truncate", PAGE_HEADING_TYPE)}>{data.soPhieuNhap}</h1>
          <StatusBadge quyTrinh="phieuNhap" size="lg" label={trangThaiPhieu.label} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {coTheInTem ? (
            <Button variant="outline" disabled={dangLayTem} onClick={moInTem} className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
              {dangLayTem ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} In tem
            </Button>
          ) : null}
          {!daHuy ? (
            <Button variant="outline" onClick={() => navigate(`/goods-receipts/${id}/print`)} className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
              <Printer className="size-4" /> In phiếu
            </Button>
          ) : null}
          {nhap ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Thao tác khác" className="text-bo-muted hover:bg-slate-100 hover:text-bo-foreground">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                <DropdownMenuItem onClick={() => setMoHuy(true)} className="cursor-pointer gap-2 rounded-md text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger">
                  <X className="size-4" /> Hủy phiếu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <DaiO soO={4}>
        {oThongTin.map(([nhan, giaTri, phu]) => (
          <div key={nhan} className="flex min-w-0 flex-col gap-1 bg-white px-4 py-4">
            <span className="text-xs font-medium text-bo-muted">{nhan}</span>
            <span title={typeof giaTri === "string" ? giaTri : undefined} className="truncate text-sm font-semibold text-bo-heading">{giaTri}</span>
            {phu ? <span className="truncate text-xs text-bo-muted">{phu}</span> : null}
          </div>
        ))}
      </DaiO>

      {daHuy ? (
        <DongThongBao>Phiếu nhập đã hủy, không kiểm đếm hay nhập kho được nữa.</DongThongBao>
      ) : (
        // Màn vừa (768 có thanh menu) vùng nội dung chỉ ~490px: 3 bước xếp dọc tới màn rộng
        <DaiO soO={3} className="md:grid-cols-1 lg:grid-cols-3">
          <OBuoc
            trangThai={b1}
            so={1}
            nhan="Bước 1"
            tieuDe="Kiểm đếm hàng"
            moTa={`${formatNumber(tong.xong)}/${formatNumber(dong.length)} biến thể · ${formatNumber(tong.kiem)}/${formatNumber(tong.can)} sản phẩm`}
            phu={<ThanhMuc className="mt-1" phanTram={tong.can ? (tong.kiem / tong.can) * 100 : 0} tone={kiemXong ? "ok" : ""} label="Tiến độ kiểm đếm" />}
            hanhDong={
              kiemXong || daNhap ? (
                <span className="text-xs text-bo-muted">Đã kiểm hết hàng theo đơn mua</span>
              ) : bienTheTiepTheo ? (
                <Button onClick={() => moKiemDem(bienTheTiepTheo.bienTheSanPhamId)} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                  <ScanLine className="size-4" /> Kiểm biến thể tiếp theo
                </Button>
              ) : null
            }
          />
          <OBuoc trangThai={b2} so={2} nhan="Bước 2" tieuDe="Xử lý hàng lỗi" moTa={moTa2} hanhDong={nut2} />
          <OBuoc
            trangThai={b3}
            so={3}
            nhan="Bước 3"
            tieuDe="Xác nhận nhập kho"
            moTa={moTa3}
            hanhDong={
              daNhap ? (
                <span className="text-xs text-bo-muted">Hoàn tất</span>
              ) : (
                <Button
                  disabled={!coTheXacNhan || dangXuLy}
                  onClick={() => setMoXacNhan(true)}
                  className={cn(
                    "gap-2",
                    coTheXacNhan
                      ? "bg-bo-primary text-white hover:bg-bo-primary-hover"
                      : "border border-bo-border bg-white text-bo-foreground hover:bg-white",
                  )}
                >
                  <Check className="size-4" /> Xác nhận nhập kho
                </Button>
              )
            }
          />
        </DaiO>
      )}

      <TableShell
        toolbar={
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-bo-border px-4 py-2">
            <h2 className="text-base font-semibold text-bo-foreground">Hàng theo đơn mua</h2>
          </div>
        }
      >
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-bo-border bg-bo-surface-subtle">
              <th className={cn(TH, "text-left")}>Biến thể</th>
              <th className={cn(TH, "w-[184px] text-left")}>Đã kiểm</th>
              <th className={cn(TH, "w-20 text-right")}>Đạt</th>
              <th className={cn(TH, "w-20 text-right")}>Lỗi</th>
              <th className={cn(TH, "w-[180px] text-left")}>Lô đã khóa</th>
              <th className={cn(TH, "w-[150px] text-left")}>Trạng thái</th>
              <th className={cn(TH, "w-[152px]")}><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bo-border">
            {dong.map((d) => {
              const chuaKiem = d.kiem === 0;
              const nhanNut = !nhap || d.kiem >= d.canNhap ? "Xem lô" : chuaKiem ? "Kiểm đếm" : "Tiếp tục kiểm";
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
                      <span className="text-bo-muted">{lo.loading ? "Đang tải…" : "—"}</span>
                    ) : d.lots.length ? (
                      <div className="min-w-0">
                        <div>{d.lots.length} lô</div>
                        <div className="truncate font-mono text-xs text-bo-muted" title={d.lots.map((l) => l.maLo).join(", ")}>
                          {d.lots.map((l) => l.maLo).join(", ")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-bo-muted">Chưa có lô</span>
                    )}
                  </td>
                  <td className="px-4 py-2"><StatusBadge quyTrinh="kiemDem" label={d.trangThai.label} /></td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moKiemDem(d.bienTheSanPhamId)}
                      className="min-w-[120px] border-bo-border bg-white text-xs text-bo-foreground hover:border-bo-primary hover:text-bo-primary"
                    >
                      {nhanNut}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {dong.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-24 px-4 text-center text-sm text-bo-muted">Phiếu nhập chưa có hàng hóa.</td>
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
        coTheDayTon={coTheDayTon}
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
      <ConfirmModal
        isOpen={moHuyBienBan}
        onClose={() => setMoHuyBienBan(false)}
        onConfirm={async () => {
          // Gửi lại ghi chú đang có: máy chủ lỡ lập lại (trang cũ) thì không xóa ghi chú. Lỗi thì giữ hộp mở
          if (await phatHanhBienBan({ phuongAn: maPhuongAnHienTai, ghiChu: bienBan.data?.ghiChu ?? "", huy: true })) setMoHuyBienBan(false);
        }}
        title="Hủy biên bản trả hàng"
        description={`Biên bản ${data.maBienBanRtv || ""} không còn hàng lỗi để trả nhà cung cấp. Hủy biên bản để nhập kho được.`}
        confirmText="Hủy biên bản"
        cancelText="Quay lại"
        isLoading={dangXuLy}
      />
      <ConfirmModal
        isOpen={moHuy}
        onClose={() => setMoHuy(false)}
        onConfirm={huyPhieu}
        title="Hủy phiếu nhập kho"
        description="Các lô đã khóa của phiếu bị bỏ (chưa vào tồn kho) và biên bản trả hàng nếu có cũng bị hủy. Thao tác không hoàn tác được."
        confirmText="Hủy phiếu"
        cancelText="Quay lại"
        isLoading={dangXuLy}
      />
      <HopInTem
        open={Boolean(dongInTem)}
        onOpenChange={(mo) => !mo && setDongInTem(null)}
        nguon="phieu"
        dong={dongInTem ?? []}
        maPhieu={data.soPhieuNhap}
        onDatGia={
          hasAnyRole([ROLES.QUAN_TRI_VIEN])
            ? (d) => navigate("/products/gia-ban-tem", { state: { datGiaMa: d.maSku || d.maVachSku } })
            : undefined
        }
      />
    </PageContainer>
  );
}
