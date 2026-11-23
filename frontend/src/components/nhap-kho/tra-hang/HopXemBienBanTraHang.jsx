/*
 * Hộp Xem biên bản trả hàng nhà cung cấp. Nhà cung cấp quyết trên Cổng nhà cung cấp (cách bù, nhận lại hay tiêu hủy hàng
 * lỗi còn ở kho); FCentric chỉ làm theo:
 * - Kho (quản trị viên, quản lý kho, nhân viên kho): lập xong in biên bản cho người giao hàng ký rồi ghi đã ký (lúc đó
 *   biên bản mới gửi nhà cung cấp); Ghi đã giao trả khi nhà cung cấp chọn nhận lại; quản lý kho /
 *   quản trị viên: Ghi tiêu hủy khi nhà cung cấp đồng ý tiêu hủy.
 * - Mua hàng (quản trị viên, nhân viên mua hàng): theo dõi hạn trả lời, gửi lại email biên bản.
 * Bố cục: hai thẻ việc cạnh nhau (Hàng lỗi · Nhà cung cấp trả lời) với nút việc tiếp theo ở cuối thẻ; một bảng Sản phẩm
 * lỗi; lịch sử dạng dòng thời gian. Mở theo `bienBanId` (tự tải) hoặc `bienBan` đã có. `onDaDoi(dto)`: sau mỗi thao tác.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, PenLine, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { moTrangIn } from "@/lib/moTrangIn";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/thongBaoNhanh";
import { getApiErrorMessage } from "@/utils/apiError";
import { bienBanTraHangService } from "@/services/bienBanTraHangService";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { VAI_TRO_KHO } from "@/constants/vaiTroTheoNghiepVu";
import { t } from "@/i18n";
import HopGhiHangLoi from "./HopGhiHangLoi";
import { NhanTrangThaiHangLoi, NhanTrangThaiTraHang } from "./NhanTraHang";
import {
  choNccTraLoi,
  choKyBienBan,
  duongDanInBienBan,
  lichSuBienBan,
  moTaKy,
  quaHan,
  tenCachBu,
  tenCachGiao,
  tenCachXuLy,
  tenHangLoiNcc,
  tenNguoiGiao,
  tongTruTien,
  viecKho,
} from "./traHangUtils";

const KHUNG_HOP = "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(820px,calc(100%-2rem))]";
const NUT_VIEN = "border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle";
const TH = "h-9 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted first:pl-4 last:pr-4";
const LIEN_KET = "font-medium text-bo-primary hover:text-bo-primary-hover hover:underline";
/** Email biên bản đi qua hàng đợi, thử lại tới ~2,5 phút: quá 10 phút chưa có giờ gửi mới coi là chưa gửi được. */
const CHO_GUI_EMAIL_MS = 10 * 60 * 1000;

export default function HopXemBienBanTraHang({ open, onOpenChange, bienBanId, bienBan: bienBanSan, onDaDoi }) {
  const id = bienBanId ?? bienBanSan?.id;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Phần mở gắn theo biên bản: đóng hộp hay đổi biên bản thì trạng thái (bản vừa nhận sau thao tác) bỏ đi */}
      {open && id ? <PhanMo key={id} id={id} bienBanSan={bienBanSan} onOpenChange={onOpenChange} onDaDoi={onDaDoi} /> : null}
    </Dialog>
  );
}

function PhanMo({ id, bienBanSan, onOpenChange, onDaDoi }) {
  const [banMoi, setBanMoi] = useState(null);
  const coSan = Boolean(bienBanSan && bienBanSan.id === id);
  const tai = useTaiDuLieu(() => bienBanTraHangService.chiTiet(id), `${id}`, { enabled: !coSan });
  // Chỉ dùng dữ liệu tải về khi đúng biên bản đang mở
  const daTai = tai.data && tai.data.id === id && !tai.error ? tai.data : null;
  const bb = banMoi ?? (coSan ? bienBanSan : null) ?? daTai;
  const daDoi = (dto) => {
    if (!dto) return;
    setBanMoi(dto);
    onDaDoi?.(dto);
  };
  if (!bb) {
    return (
      <DialogContent className={KHUNG_HOP}>
        <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-base text-bo-foreground">{t("Biên bản trả hàng")}</DialogTitle>
          <DialogDescription className="sr-only">{t("Đang đọc biên bản trả hàng")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 px-6 py-8 text-sm text-bo-muted">
          {tai.error ? (
            <>
              <AlertCircle className="size-4 shrink-0 text-bo-danger" /> {t("Không đọc được biên bản. Đóng hộp, tải lại trang rồi mở lại.")}
            </>
          ) : (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin" /> {t("Đang tải biên bản…")}
            </>
          )}
        </div>
      </DialogContent>
    );
  }
  return <NoiDung bb={bb} onDong={() => onOpenChange(false)} onDaDoi={daDoi} />;
}

/**
 * Biên bản chờ nhà cung cấp trả lời: email biên bản (kèm PDF) đã gửi lúc nào và hạn trả lời, chưa gửi được, hoặc nhà
 * cung cấp chưa có email. Mua hàng gửi lại được (không dời hạn).
 */
function TrangThaiEmail({ bb, laMuaHang, onDaDoi }) {
  const [dangGui, setDangGui] = useState(false);
  // Email đi sau khi lưu (hàng đợi, có thử lại): vừa lập / vừa bấm gửi lại mà chưa có giờ gửi là đang gửi, chưa phải lỗi
  const [vuaGuiLaiLuc, setVuaGuiLaiLuc] = useState(null);
  const moc = Math.max(vuaGuiLaiLuc ?? 0, bb.lapCuoiLuc ? new Date(bb.lapCuoiLuc).getTime() : 0);
  const dangCho = !bb.emailGuiLuc && moc > 0 && Date.now() - moc < CHO_GUI_EMAIL_MS;
  const guiLai = async () => {
    setDangGui(true);
    try {
      const dto = await bienBanTraHangService.guiLaiEmail(bb.id);
      toast.success(t("Đã đưa biên bản vào hàng đợi gửi lại cho nhà cung cấp"));
      setVuaGuiLaiLuc(Date.now());
      onDaDoi?.(dto);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("Không gửi lại được biên bản")));
    } finally {
      setDangGui(false);
    }
  };
  let cau;
  if (!bb.emailNcc) cau = t("Nhà cung cấp chưa có email nên chưa gửi được biên bản. Thêm email ở hồ sơ nhà cung cấp rồi gửi lại.");
  else if (bb.emailGuiLuc) cau = t("Đã gửi biên bản kèm PDF tới {{email}} lúc {{luc}}.", { email: bb.emailNcc, luc: formatDateTime(bb.emailGuiLuc) });
  else if (dangCho) cau = t("Đang gửi biên bản tới {{email}}. Mở lại hộp sau ít phút để xem đã gửi chưa.", { email: bb.emailNcc });
  else cau = t("Chưa gửi được email biên bản tới {{email}} (máy chủ email bận hoặc email sai).", { email: bb.emailNcc });
  const canhBao = !bb.emailGuiLuc && !dangCho;
  const daQuaHan = quaHan(bb.hanTraLoi);
  let cauHan = null;
  if (bb.hanTraLoi && daQuaHan) {
    cauHan = t("Đã quá hạn trả lời. Hàng lỗi vẫn giữ ở kho tới khi nhà cung cấp chọn nhận lại hay tiêu hủy: liên hệ nhà cung cấp và gửi lại email.");
  } else if (bb.hanTraLoi) {
    cauHan = bb.choNccChonCachBu
      ? t("Hạn trả lời: hết ngày {{ngay}}. Quá hạn chưa chọn cách bù thì tự chuyển trừ tiền hàng.", { ngay: formatDate(bb.hanTraLoi) })
      : t("Hạn trả lời: hết ngày {{ngay}}.", { ngay: formatDate(bb.hanTraLoi) });
  }
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("text-[13px] leading-5", canhBao ? "text-bo-warning" : "text-bo-muted")}>{cau}</p>
      {cauHan ? (
        <p className={cn("text-[13px] leading-5", daQuaHan ? "text-bo-warning" : "text-bo-muted")}>
          {cauHan}
          {bb.daNhacHan && !daQuaHan ? ` ${t("Đã gửi email nhắc.")}` : ""}
        </p>
      ) : null}
      {laMuaHang && bb.emailNcc ? (
        <Button variant="outline" disabled={dangGui} onClick={guiLai} className={`h-8 w-fit gap-1.5 px-3 ${NUT_VIEN}`}>
          {dangGui ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {t("Gửi lại email")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Biên bản chờ ký: kho in cho người giao hàng ký rồi ghi đã ký; lúc đó biên bản mới gửi nhà cung cấp (giao luôn thì hàng
 * lỗi rời kho theo người giao hàng).
 */
function KhoiKy({ bb, laKho, onIn, onDaDoi }) {
  const [dangGhi, setDangGhi] = useState(false);
  const traNgay = bb.cachXuLyHang === "TRA_NGAY";
  const ghi = async () => {
    setDangGhi(true);
    try {
      const dto = await bienBanTraHangService.ghiKy(bb.id);
      toast.success(t("Đã ghi người giao hàng đã ký. Biên bản đang gửi email cho nhà cung cấp."));
      onDaDoi?.(dto);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("Chưa ghi được việc ký")));
    } finally {
      setDangGhi(false);
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <PenLine className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-bo-foreground">{t("Chờ {{ten}} ký biên bản", { ten: tenNguoiGiao(bb) })}</p>
          <p className="text-[13px] leading-5 text-bo-muted">
            {traNgay
              ? t("In biên bản cho người giao hàng ký và nhận hàng lỗi, rồi ghi đã ký. Biên bản gửi email cho nhà cung cấp sau bước này.")
              : t("In biên bản cho người giao hàng ký, rồi ghi đã ký. Biên bản gửi email cho nhà cung cấp sau bước này.")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={dangGhi} onClick={onIn} className={`h-8 gap-1.5 px-3 ${NUT_VIEN}`}>
          <Printer className="size-3.5" /> {t("In biên bản")}
        </Button>
        {laKho ? (
          <Button disabled={dangGhi} onClick={ghi} className="h-8 gap-1.5 bg-bo-primary px-3 text-white hover:bg-bo-primary-hover">
            {dangGhi ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {traNgay ? t("Đã ký, nhận hàng lỗi") : t("Đã ký biên bản")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** Một dòng nhãn – giá trị trong thẻ việc. */
function Dong({ nhan, children }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-[13px] leading-5">
      <span className="text-bo-muted">{nhan}</span>
      <span className="min-w-0 text-bo-foreground">{children}</span>
    </div>
  );
}

/** Thẻ một việc: nhãn nhỏ, dòng trạng thái, các dòng thông tin, nút ở cuối. */
function TheViec({ nhan, trangThai, children, nut }) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-bo-border bg-bo-surface">
      <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{nhan}</h3>
        <div className="flex min-h-6 flex-wrap items-center gap-2">{trangThai}</div>
        {children ? <div className="flex flex-col gap-1">{children}</div> : null}
      </div>
      {nut ? <div className="flex flex-wrap justify-end gap-2 border-t border-bo-border px-4 py-2.5">{nut}</div> : null}
    </section>
  );
}

/** "Nguyễn Văn A · 14:30 23/11/2026" */
const nguoiVaLuc = (nguoi, luc) => [nguoi, luc ? formatDateTime(luc) : null].filter(Boolean).join(" · ") || "—";

function NoiDung({ bb, onDong, onDaDoi }) {
  const navigate = useNavigate();
  const [hopGhi, setHopGhi] = useState(null); // "giaoTra" | "tieuHuy"
  const laMuaHang = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG]);
  const laKho = hasAnyRole(VAI_TRO_KHO);
  const laQuanLyKho = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  const daHuy = bb.trangThai === "DA_HUY";
  const viec = viecKho(bb);
  const choTraLoi = !daHuy && choNccTraLoi(bb);
  const tru = tongTruTien(bb);
  const lichSu = lichSuBienBan(bb);
  const dongLoi = bb.items ?? [];
  // Đơn giá theo biến thể (có sau khi nhập kho) để tính giá trị hàng lỗi ngay trong bảng
  const giaTheoBienThe = new Map((bb.theoBienThe ?? []).map((d) => [d.bienTheSanPhamId, d.donGia]));
  const coGia = bb.phieuDaNhap && giaTheoBienThe.size > 0;
  const tongLoi = dongLoi.reduce((s, d) => s + Number(d.soLuong || 0), 0) || Number(bb.tongSoLuongLoi) || 0;
  const tongGiaTri = dongLoi.reduce((s, d) => s + Number(d.soLuong || 0) * Number(giaTheoBienThe.get(d.bienTheSanPhamId) || 0), 0);
  const traNgay = bb.cachXuLyHang === "TRA_NGAY";
  const oKho = !daHuy && bb.trangThaiHang === "O_KHO";
  const choKy = choKyBienBan(bb);
  const inBienBan = () => moTrangIn(duongDanInBienBan(bb.id), navigate);
  // Ghi chú nhà cung cấp gửi khi chọn trên cổng (cách bù và hàng lỗi thường cùng một lần nên trùng thì hiện một lần);
  // cách bù do đóng đơn / quá hạn thì ghi chú đó không phải của nhà cung cấp
  const ghiChuNcc = [...new Set([bb.nguonChot === "CONG_NCC" ? bb.ghiChuChot : null, bb.ghiChuChonHangLoi].filter(Boolean))].join(" · ");

  let goiY = null;
  if (bb.duLieuCu && bb.trangThaiHang === "KHONG_RO") {
    goiY = <DongThongBao>{t("Biên bản lập trước khi có bước giao trả nên không rõ hàng lỗi đã đi chưa. Nhà cung cấp chọn nhận lại hay tiêu hủy trên Cổng nhà cung cấp, kho làm theo.")}</DongThongBao>;
  }

  // ── Thẻ Hàng lỗi: kho làm theo lựa chọn của nhà cung cấp ──
  let nutKho = null;
  if (viec === "giaoTra" && laKho) {
    nutKho = <Button variant="outline" onClick={() => setHopGhi("giaoTra")} className={`h-8 px-3 ${NUT_VIEN}`}>{t("Ghi đã giao trả")}</Button>;
  } else if (viec === "tieuHuy" && laQuanLyKho) {
    nutKho = <Button variant="outline" onClick={() => setHopGhi("tieuHuy")} className={`h-8 px-3 ${NUT_VIEN}`}>{t("Ghi tiêu hủy")}</Button>;
  }
  let viecConLai = null;
  if (choKy) viecConLai = null;
  else if (oKho && !bb.hangLoiNcc) viecConLai = t("Chờ nhà cung cấp chọn nhận lại hay đồng ý tiêu hủy.");
  else if (oKho && !bb.phieuDaNhap) viecConLai = t("Làm theo lựa chọn này sau khi phiếu nhập kho.");
  else if (viec === "tieuHuy" && !laQuanLyKho) viecConLai = t("Quản lý kho ghi tiêu hủy.");
  const theHangLoi = (
    <TheViec
      nhan={t("Hàng lỗi")}
      trangThai={
        <>
          <NhanTrangThaiHangLoi ma={bb.trangThaiHang} />
          <span className="text-[13px] text-bo-muted">{t("{{count}} sản phẩm", { count: tongLoi })}</span>
        </>
      }
      nut={nutKho}
    >
      <Dong nhan={t("Cách xử lý")}>{tenCachXuLy(bb.cachXuLyHang)}</Dong>
      <Dong nhan={t("Ký biên bản")}>{moTaKy(bb)}</Dong>
      {bb.trangThaiHang === "DA_TRA" || bb.trangThaiHang === "DA_TIEU_HUY" ? (
        <>
          <Dong nhan={bb.trangThaiHang === "DA_TIEU_HUY" ? t("Người đồng ý") : t("Người nhận")}>{bb.nguoiNhanHang || "—"}</Dong>
          {!traNgay && bb.cachGiao ? (
            <Dong nhan={t("Cách giao")}>
              {tenCachGiao(bb.cachGiao)}
              {bb.maVanDon ? <span className="text-bo-muted"> · {bb.maVanDon}</span> : null}
            </Dong>
          ) : null}
          <Dong nhan={t("Lúc")}>{formatDateTime(bb.thoiDiemTra ?? bb.ngayLap)}</Dong>
        </>
      ) : oKho && !choKy ? (
        <>
          <Dong nhan={t("Ở kho từ")}>{bb.ngayNhapKho ? formatDate(bb.ngayNhapKho) : t("Chưa nhập kho")}</Dong>
          <Dong nhan={t("Nhà cung cấp chọn")}>
            {bb.hangLoiNcc ? tenHangLoiNcc(bb.hangLoiNcc) : <span className="text-bo-muted">{t("Chưa chọn")}</span>}
          </Dong>
          {bb.hangLoiNcc ? <Dong nhan={t("Xác nhận bởi")}>{nguoiVaLuc(bb.nguoiChonHangLoi, bb.thoiDiemChonHangLoi)}</Dong> : null}
        </>
      ) : null}
      {viecConLai ? <p className="mt-1 text-[13px] leading-5 text-bo-muted">{viecConLai}</p> : null}
    </TheViec>
  );

  // ── Thẻ Nhà cung cấp trả lời: cách bù ──
  const coCachBu = !daHuy && bb.phuongAn && bb.phuongAn !== "CHO_CHOT";
  let trangThaiBu;
  if (daHuy) trangThaiBu = <span className="text-sm text-bo-muted">—</span>;
  else if (choKy) trangThaiBu = <span className="text-sm text-bo-muted">{t("Chưa gửi nhà cung cấp")}</span>;
  else if (!coCachBu) trangThaiBu = <span className="text-sm font-semibold text-bo-warning">{t("Chờ nhà cung cấp chọn")}</span>;
  else {
    trangThaiBu = (
      <>
        <span className="text-sm font-semibold text-bo-foreground">{tenCachBu(bb.phuongAn)}</span>
        {!bb.phieuDaNhap ? <span className="text-[13px] text-bo-muted">{t("áp khi nhập kho")}</span> : null}
        {bb.phieuDaNhap && bb.phuongAn === "TRU_CONG_NO" && tru.tien > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-bo-foreground">−{formatCurrency(tru.tien)}</span>
        ) : null}
        {bb.phieuDaNhap && bb.phuongAn === "DOI_HANG" ? (
          <span className={cn("text-[13px]", bb.buXong ? "text-bo-success" : "text-bo-muted")}>
            {bb.buXong ? t("đã nhận đủ hàng bù") : t("chờ hàng bù")}
          </span>
        ) : null}
      </>
    );
  }
  let nguon = null;
  if (coCachBu && bb.nguonChot === "CONG_NCC") nguon = <Dong nhan={t("Xác nhận bởi")}>{nguoiVaLuc(bb.nguoiXacNhanNcc, bb.thoiDiemChot)}</Dong>;
  else if (coCachBu && bb.nguonChot === "TU_DONG") nguon = <Dong nhan={t("Nguồn")}>{t("Tự chuyển khi quá hạn trả lời")}</Dong>;
  else if (coCachBu && bb.nguonChot === "DONG_DON") nguon = <Dong nhan={t("Nguồn")}>{t("Chuyển khi đóng đơn mua")}</Dong>;
  else if (coCachBu && bb.nguonChot === "DU_LIEU_CU") nguon = <Dong nhan={t("Nguồn")}>{t("Theo biên bản cũ")}</Dong>;
  const theBu = (
    <TheViec nhan={t("Nhà cung cấp trả lời")} trangThai={trangThaiBu}>
      {nguon}
      {choTraLoi ? <TrangThaiEmail bb={bb} laMuaHang={laMuaHang} onDaDoi={onDaDoi} /> : null}
    </TheViec>
  );


  return (
    <>
      <DialogContent className={KHUNG_HOP}>
        <DialogHeader className="shrink-0 gap-1 border-b border-bo-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base text-bo-foreground">
            <span>{t("Biên bản trả hàng {{soBienBan}}", { soBienBan: bb.soBienBan })}</span>
            <NhanTrangThaiTraHang ma={bb.trangThaiHienThi} />
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-5 text-bo-muted">
            {bb.tenNhaCungCap || "—"}
            {" · "}
            {bb.phieuNhapKhoId ? (
              <Link to={`/goods-receipts/${bb.phieuNhapKhoId}`} onClick={onDong} className={LIEN_KET}>{bb.soPhieuNhap}</Link>
            ) : (bb.soPhieuNhap || "—")}
            {bb.donMuaHangId ? (
              <>
                {" · "}
                <Link to={`/purchase-orders/${bb.donMuaHangId}`} onClick={onDong} className={LIEN_KET}>{bb.soDonMua}</Link>
              </>
            ) : null}
            {bb.tenKho ? ` · ${bb.tenKho}` : ""}
            {bb.ngayLap ? ` · ${t("lập {{ngay}}", { ngay: formatDate(bb.ngayLap) })}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 *:shrink-0 sm:px-6">
          {choKy ? <KhoiKy bb={bb} laKho={laKho} onIn={inBienBan} onDaDoi={onDaDoi} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {theHangLoi}
            {theBu}
          </div>

          {goiY}

          {/* Một bảng sản phẩm lỗi: theo lô và lý do, kèm đơn giá và giá trị khi đã nhập kho */}
          <section className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-bo-foreground">{t("Sản phẩm lỗi")}</h3>
            <div className="min-w-0 overflow-x-auto rounded-lg border border-bo-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-bo-border bg-bo-surface-subtle">
                    <th className={TH}>{t("Sản phẩm")}</th>
                    <th className={TH}>{t("Lô")}</th>
                    <th className={TH}>{t("Lý do")}</th>
                    <th className={`${TH} text-right`}>{t("SL")}</th>
                    {coGia ? <th className={`${TH} text-right`}>{t("Đơn giá")}</th> : null}
                    {coGia ? <th className={`${TH} text-right`}>{t("Giá trị")}</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bo-border">
                  {dongLoi.map((d, i) => {
                    const gia = giaTheoBienThe.get(d.bienTheSanPhamId);
                    return (
                      <tr key={`${d.sku}-${d.maLo}-${d.lyDo}-${i}`}>
                        <td className="py-2.5 pl-4 pr-3">
                          <div className="font-medium text-bo-foreground">{d.tenBienThe}</div>
                          <div className="text-xs text-bo-muted">
                            {[d.mauSac, d.kichCo].filter(Boolean).join(" / ")}
                            {d.mauSac || d.kichCo ? " · " : ""}
                            <span className="font-mono">{d.sku}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-600">{d.maLo || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-700">{t(d.lyDo)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-bo-foreground last:pr-4">{d.soLuong}</td>
                        {coGia ? <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">{gia != null ? formatCurrency(gia) : "—"}</td> : null}
                        {coGia ? (
                          <td className="whitespace-nowrap py-2.5 pl-3 pr-4 text-right tabular-nums text-bo-foreground">
                            {gia != null ? formatCurrency(Number(gia) * Number(d.soLuong || 0)) : "—"}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-bo-border font-semibold">
                    <td className="h-11 pl-4 pr-3 text-bo-foreground" colSpan={3}>{t("Tổng")}</td>
                    <td className="px-3 text-right tabular-nums text-bo-foreground last:pr-4">{tongLoi}</td>
                    {coGia ? <td /> : null}
                    {coGia ? <td className="whitespace-nowrap pl-3 pr-4 text-right tabular-nums text-bo-foreground">{formatCurrency(tongGiaTri)}</td> : null}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {bb.ghiChu || ghiChuNcc ? (
            <div className="flex flex-col gap-1">
              <Dong nhan={t("Ghi chú")}>{bb.ghiChu}</Dong>
              <Dong nhan={t("Ghi chú nhà cung cấp")}>{ghiChuNcc}</Dong>
            </div>
          ) : null}

          {/* Lịch sử: dòng thời gian gọn (chấm + vạch), cũ trước */}
          {lichSu.length ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-bo-foreground">{t("Lịch sử")}</h3>
              <ol className="relative ml-1.5 border-l border-bo-border">
                {lichSu.map((m, i) => (
                  <li key={`${m.luc}-${i}`} className="relative pb-3 pl-4 last:pb-0">
                    <span aria-hidden="true" className={cn("absolute -left-[4.5px] top-1.5 size-2 rounded-full", i === lichSu.length - 1 ? "bg-bo-primary" : "bg-slate-300")} />
                    <div className="text-[13px] leading-5 text-bo-foreground">{m.noiDung}</div>
                    <div className="text-xs tabular-nums text-bo-muted">{formatDateTime(m.luc)}</div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
          {!daHuy && !choKy ? (
            <Button variant="outline" onClick={inBienBan} className={`gap-2 ${NUT_VIEN}`}>
              <Printer className="size-4" /> {t("In biên bản")}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onDong} className={`min-w-28 ${NUT_VIEN}`}>{t("Đóng")}</Button>
        </DialogFooter>

        {/* Hộp con đặt trong cây của hộp cha: lớp đóng / bẫy tiêu điểm của Radix lồng đúng thứ tự */}
        <HopGhiHangLoi open={Boolean(hopGhi)} onOpenChange={(m) => !m && setHopGhi(null)} cheDo={hopGhi ?? "giaoTra"} bienBan={bb} onXong={onDaDoi} />
      </DialogContent>
    </>
  );
}
