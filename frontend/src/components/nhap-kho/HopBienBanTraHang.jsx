import { useRef, useState } from "react";
import {
  AlertCircle,
  FileCheck2,
  Handshake,
  Loader2,
  Lock,
  PackageX,
  PenLine,
  RotateCcw,
  Truck,
  Undo2,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { VI_DU_BIEN_SO, kiemTraBienSo, loiKhiDangGo } from "@/components/chuyen-kho/bienSoXe";
import { BEN_KY, BEN_KY_MAC_DINH, CACH_XU_LY_HANG, CACH_XU_LY_MAC_DINH, GIOI_HAN_TRA_HANG } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";
import {
  HO_TEN_TOI_DA,
  HO_TEN_TOI_THIEU,
  LOI_HO_TEN_KY_TU,
  LOI_HO_TEN_NGAN,
  LOI_HO_TEN_TRONG,
  chuanHoaHoTen,
  loiHoTen,
} from "@/validations/hoTen";
import { t } from "@/i18n";

/**
 * Lập / lập lại biên bản trả hàng nhà cung cấp (FO-099) ở phiếu Nháp. Kho chọn ai ký biên bản bên giao hàng trước: đại
 * diện nhà cung cấp, hoặc người của bên vận chuyển (chỉ xác nhận số lỗi lúc giao, không thay nhà cung cấp); rồi hàng lỗi
 * đi đâu: giữ ở kho, hoặc trả ngay cho người giao hàng (chỉ khi là đại diện nhà cung cấp). Lập xong kho in cho người đó
 * ký rồi ghi đã ký ở tra-hang/HopXemBienBanTraHang; lúc đó biên bản mới gửi email cho nhà cung cấp. Xem biên bản đã
 * lập cũng ở tra-hang/HopXemBienBanTraHang.
 * - dongLoi: hàng không đạt hiện tại theo lô đã khóa (máy chủ lưu) [{ tenBienThe, mauSac, kichCo, sku, maLo, lyDo, soLuong }].
 *   Máy chủ tự lấy đúng các dòng này khi lập, trình duyệt không gửi danh sách.
 * - bienBan: biên bản đang có của phiếu hoặc null; chỉ dùng khi `lapLai` (điền sẵn người ký, cách xử lý, ghi chú cũ).
 * - lapLai: biên bản lệch số lỗi hiện tại (xóa / khóa thêm lô lỗi sau khi lập): lập lại theo số mới, giữ số biên bản.
 * - dangTaiBienBan / loiTaiBienBan: phiếu có biên bản nhưng chưa đọc được. Hộp chờ (hoặc báo lỗi), KHÔNG mở hộp lập
 *   với giá trị mặc định — bấm Lập lúc đó sẽ ghi đè người ký và ghi chú của biên bản đã lập.
 * - dangTaiLo / loiTaiLo: hàng lỗi theo lô của một số biến thể chưa đọc được, hoặc chưa khớp số lỗi của biến thể (đang
 *   tải lại sau khi máy khác khóa / xóa lô lỗi), nên `dongLoi` thiếu / thừa dòng. Hộp báo đang tải (hoặc lỗi) và khóa
 *   nút Lập, không hiện bảng lệch như số kiểm đếm thật.
 */
export default function HopBienBanTraHang({
  open,
  onOpenChange,
  phieu,
  dongLoi,
  bienBan,
  dangTaiBienBan = false,
  loiTaiBienBan = false,
  dangTaiLo = false,
  loiTaiLo = false,
  lapLai = false,
  dangXuLy,
  onPhatHanh,
}) {
  let noiDung = null;
  if (open && (dangTaiBienBan || loiTaiBienBan)) {
    noiDung = <DangTai loi={loiTaiBienBan} onDong={() => onOpenChange(false)} />;
  } else if (open) {
    noiDung = (
      <NoiDung
        // Biên bản đọc xong (hoặc đổi biên bản) là nội dung mới: người ký / ghi chú lấy lại từ biên bản
        key={`${bienBan?.id ?? "moi"}:${lapLai ? "lap-lai" : "lap"}`}
        phieu={phieu}
        dongLoi={dongLoi}
        bienBan={bienBan}
        dangTaiLo={dangTaiLo}
        loiTaiLo={loiTaiLo}
        lapLai={lapLai}
        dangXuLy={dangXuLy}
        onDong={() => onOpenChange(false)}
        onPhatHanh={onPhatHanh}
      />
    );
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !dangXuLy && onOpenChange(next)}>
      {noiDung}
    </Dialog>
  );
}

const KHUNG_HOP = "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(800px,calc(100%-2rem))]";
const O_NHAP =
  "h-9 w-full rounded-md border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle";

const BIEU_TUONG_CACH = { GIU_KHO: Warehouse, TRA_NGAY: Truck };
// Việc xảy ra sau khi lập (canhBao: tô cam — việc không làm lại được)
const IN_CHO_KY = { icon: PenLine, chu: t("In biên bản cho người giao hàng ký rồi ghi đã ký. Lúc đó biên bản mới gửi email kèm PDF cho nhà cung cấp.") };
const GIU_KHO_SAU = [
  { icon: PackageX, chu: t("Hàng lỗi nằm ở khu chờ trả, không cộng vào tồn kho.") },
  { icon: Undo2, chu: t("Nhà cung cấp chọn nhận lại hay tiêu hủy; kho ghi đã giao trả hoặc tiêu hủy theo lựa chọn đó.") },
  { icon: RotateCcw, chu: t("Số lỗi đổi thì lập lại biên bản được, phiếu vẫn hủy được.") },
];
const TRA_NGAY_SAU = [
  { icon: Truck, chu: t("Người giao hàng ký nhận thì mang hàng lỗi đi, biên bản ghi là đã giao trả.") },
  { icon: RotateCcw, chu: t("Người giao hàng không mang hàng lỗi về thì lập lại biên bản, chọn giữ ở kho rồi in lại.") },
  { icon: Lock, chu: t("Ghi đã ký xong thì không lập lại biên bản, không sửa lô lỗi và không hủy phiếu được nữa."), canhBao: true },
];
// Bên vận chuyển chỉ xác nhận số lỗi lúc giao: không nhận hàng lỗi thay nhà cung cấp (máy chủ chặn cùng luật)
const LY_DO_KHOA_TRA_NGAY = t("Bên vận chuyển không nhận hàng lỗi thay nhà cung cấp.");
const DONG_CHUNG = { icon: Handshake, chu: t("Nhà cung cấp trả lời trên Cổng nhà cung cấp trong 7 ngày kể từ khi nhận email.") };

function viecSauKhiLap(traNgay) {
  return [IN_CHO_KY, ...(traNgay ? TRA_NGAY_SAU : GIU_KHO_SAU), DONG_CHUNG];
}

// Họ tên người ký: cùng luật họ tên người dùng (validations/hoTen.js ↔ máy chủ HoTen), câu ngắn cho ô nửa hộp (một dòng)
function loiTenNguoiKy(chuoi) {
  const loi = loiHoTen(chuoi);
  if (!loi) return "";
  if (loi === LOI_HO_TEN_TRONG) return t("Nhập họ tên người ký");
  if (loi === LOI_HO_TEN_KY_TU) return t("Tên chỉ gồm chữ cái và dấu cách");
  if (loi === LOI_HO_TEN_NGAN) return t("Tên cần ít nhất {{toiThieu}} ký tự", { toiThieu: HO_TEN_TOI_THIEU });
  return t("Tên tối đa {{toiDa}} ký tự", { toiDa: HO_TEN_TOI_DA });
}
// Đếm như máy chủ: theo ký tự (code point) sau khi cắt khoảng trắng hai đầu
const doDaiGhiChu = (chuoi) => [...String(chuoi ?? "").trim()].length;

function DangTai({ loi, onDong }) {
  return (
    <DialogContent className={KHUNG_HOP}>
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
        <DialogTitle className="text-base text-bo-foreground">{t("Biên bản trả hàng")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Đang đọc biên bản trả hàng của phiếu nhập")}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 px-6 py-8 text-sm text-bo-muted">
        {loi ? (
          <>
            <AlertCircle className="size-4 shrink-0 text-bo-danger" /> {t("Không đọc được biên bản. Đóng hộp, tải lại trang rồi mở lại.")}
          </>
        ) : (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" /> {t("Đang tải biên bản…")}
          </>
        )}
      </div>
      <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" onClick={onDong} className="min-w-28 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
          {t("Đóng")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NoiDung({ phieu, dongLoi, bienBan, dangTaiLo, loiTaiLo, lapLai, dangXuLy, onDong, onPhatHanh }) {
  // Lập lại: điền sẵn theo biên bản đang có
  const bbCu = lapLai ? bienBan : null;
  const [cachXuLy, setCachXuLy] = useState(bbCu?.cachXuLyHang ?? CACH_XU_LY_MAC_DINH);
  // Ai ký biên bản bên giao hàng (trả ngay thì người ký cũng là người nhận hàng lỗi)
  const [benKy, setBenKy] = useState(BEN_KY.some((b) => b.ma === bbCu?.benKy) ? bbCu.benKy : BEN_KY_MAC_DINH);
  const [nguoiNhan, setNguoiNhan] = useState(bbCu?.nguoiGiao ?? "");
  const [bienSo, setBienSo] = useState(bbCu?.bienSoXe ?? "");
  const [donVi, setDonVi] = useState(bbCu?.donViVanChuyen ?? "");
  const [ghiChu, setGhiChu] = useState(bbCu?.ghiChu ?? "");
  // Câu lỗi dưới từng ô: báo khi rời ô hoặc bấm Lập, mất ngay khi sửa (biển số chắc chắn sai thì báo lúc đang gõ)
  const [loi, setLoi] = useState({ nguoiNhan: "", bienSo: "", donVi: "", ghiChu: "" });
  const oNguoiNhan = useRef(null);
  const oBienSo = useRef(null);
  const oDonVi = useRef(null);
  const oGhiChu = useRef(null);
  const vanChuyen = benKy === "VAN_CHUYEN";
  // Bên vận chuyển ký thì chỉ giữ ở kho; đổi lại đại diện nhà cung cấp thì lựa chọn trước đó quay lại
  const khoaTraNgay = vanChuyen;
  const cachHieuLuc = khoaTraNgay ? "GIU_KHO" : cachXuLy;
  const traNgay = cachHieuLuc === "TRA_NGAY";
  const dong = dongLoi ?? [];
  const tong = dong.reduce((tg, d) => tg + Number(d.soLuong || 0), 0);
  // Hàng lỗi theo lô chưa đọc đủ: bảng thiếu dòng, không so số và không lập theo bảng đó
  const thieuDong = dangTaiLo || loiTaiLo;
  const soKyTuGhiChu = doDaiGhiChu(ghiChu);
  const hienDongGhiChu = Boolean(loi.ghiChu) || soKyTuGhiChu > GIOI_HAN_TRA_HANG.ghiChu - 55;
  const id = (ten) => `bien-ban-${ten}`;

  const datLoi = (o, cau) => setLoi((l) => (l[o] === cau ? l : { ...l, [o]: cau }));
  const loiGhiChu = (chuoi) =>
    doDaiGhiChu(chuoi) > GIOI_HAN_TRA_HANG.ghiChu ? t("Tối đa {{so}} ký tự", { so: GIOI_HAN_TRA_HANG.ghiChu }) : "";

  // Rời ô Họ tên người ký: đúng luật thì gọn khoảng trắng, sai thì báo; để trống thì đợi bấm Lập
  const roiONguoiKy = () => {
    if (!nguoiNhan.trim()) return;
    const cau = loiTenNguoiKy(nguoiNhan);
    if (cau) datLoi("nguoiNhan", cau);
    else setNguoiNhan(chuanHoaHoTen(nguoiNhan));
  };
  const goBienSo = (giaTri) => {
    setBienSo(giaTri);
    datLoi("bienSo", loiKhiDangGo(giaTri) ?? "");
  };
  // Rời ô Biển số: đúng mẫu thì đổi sang cách viết chuẩn, sai thì báo; để trống thì thôi (không bắt buộc)
  const roiOBienSo = () => {
    if (!bienSo.trim()) return datLoi("bienSo", "");
    const kq = kiemTraBienSo(bienSo);
    if (kq.hopLe) setBienSo(kq.giaTri);
    else datLoi("bienSo", loiKhiDangGo(bienSo) ?? kq.loi);
  };

  const loiDonVi = (chuoi) => {
    if (!chuoi.trim()) return t("Nhập đơn vị vận chuyển");
    return [...chuoi.trim()].length > GIOI_HAN_TRA_HANG.ten ? t("Tối đa {{so}} ký tự", { so: GIOI_HAN_TRA_HANG.ten }) : "";
  };

  const bamLap = () => {
    const loiTen = loiTenNguoiKy(nguoiNhan);
    const kqBienSo = bienSo.trim() ? kiemTraBienSo(bienSo) : null;
    const loiBienSo = kqBienSo && !kqBienSo.hopLe ? loiKhiDangGo(bienSo) ?? kqBienSo.loi : "";
    const loiDv = vanChuyen ? loiDonVi(donVi) : "";
    const loiGc = loiGhiChu(ghiChu);
    setLoi({ nguoiNhan: loiTen, bienSo: loiBienSo, donVi: loiDv, ghiChu: loiGc });
    const oSai = loiDv ? oDonVi : loiTen ? oNguoiNhan : loiBienSo ? oBienSo : loiGc ? oGhiChu : null;
    if (oSai) {
      oSai.current?.focus();
      return;
    }
    if (kqBienSo?.hopLe) setBienSo(kqBienSo.giaTri);
    onPhatHanh({
      cachXuLy: cachHieuLuc,
      benKy,
      nguoiNhanHang: chuanHoaHoTen(nguoiNhan),
      bienSoXe: kqBienSo?.hopLe ? kqBienSo.giaTri : null,
      donViVanChuyen: vanChuyen ? donVi.trim().replace(/\s+/g, " ") : null,
      ghiChu: ghiChu.trim(),
    });
  };

  const nhanNut = bbCu ? t("Lập lại biên bản") : t("Lập biên bản");

  return (
    // Đầu và chân hộp cố định, chỉ phần giữa cuộn: nút Lập / Hủy luôn thấy; bảng rộng chỉ cuộn ngang trong khung bảng
    <DialogContent className={KHUNG_HOP}>
      {/* pr-12: chừa chỗ nút đóng (X), tiêu đề dài không bị đè trên điện thoại */}
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
        <DialogTitle className="text-base text-bo-foreground">
          {bbCu
            ? t("Lập lại biên bản trả hàng {{soBienBan}}", { soBienBan: bbCu.soBienBan })
            : t("Lập biên bản trả hàng nhà cung cấp")}
        </DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          {t("Phiếu nhập")} {phieu?.soPhieuNhap} · {phieu?.tenNhaCungCap || "—"} · {phieu?.soDonMua || "—"}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 *:shrink-0 sm:px-6">
        <div className="min-w-0 overflow-x-auto rounded-lg border border-bo-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                {[t("Sản phẩm"), t("Lô phát hiện"), t("Lý do lỗi")].map((tg) => (
                  <th key={tg} className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{tg}</th>
                ))}
                <th className="h-10 w-24 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("SL lỗi")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {dong.map((d, i) => (
                <tr key={`${d.sku}-${d.maLo}-${d.lyDo}-${i}`}>
                  <td className="h-14 px-4 py-2">
                    <div className="font-semibold text-bo-foreground">{d.tenBienThe}</div>
                    <div className="text-xs text-bo-muted">
                      {[d.mauSac, d.kichCo].filter(Boolean).join(" · ")}
                      {d.mauSac || d.kichCo ? " · " : ""}
                      <span className="font-mono">{d.sku}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{d.maLo || "—"}</td>
                  <td className="px-4 py-2">{t(d.lyDo)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-bo-danger">{d.soLuong}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                <td className="h-12 px-4" colSpan={3}>{t("Tổng cộng")}</td>
                <td className="px-4 text-right tabular-nums text-bo-danger">{tong}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <p id={id("ben-ky")} className="text-sm font-semibold text-bo-foreground">{t("Ai ký biên bản bên giao hàng")}</p>
          <div role="radiogroup" aria-labelledby={id("ben-ky")} aria-describedby={id("ben-ky-mo-ta")} className="flex flex-wrap gap-2">
            {BEN_KY.map((b) => {
              const chon = benKy === b.ma;
              return (
                <button
                  key={b.ma}
                  type="button"
                  role="radio"
                  aria-checked={chon}
                  onClick={() => {
                    setBenKy(b.ma);
                    setLoi((l) => ({ ...l, nguoiNhan: "", bienSo: "", donVi: "" }));
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 rounded-md border bg-bo-surface px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/25 disabled:cursor-default",
                    chon ? "border-bo-primary text-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border text-bo-foreground hover:border-slate-300",
                  )}
                >
                  <span className={cn("grid size-3.5 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                    {chon ? <span className="size-1.5 rounded-full bg-bo-primary" /> : null}
                  </span>
                  {t(b.ten)}
                </button>
              );
            })}
          </div>
          <p id={id("ben-ky-mo-ta")} className="text-xs leading-5 text-bo-muted">{t(BEN_KY.find((b) => b.ma === benKy)?.moTa ?? "")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p id={id("cach")} className="text-sm font-semibold text-bo-foreground">{t("Hàng lỗi đi đâu")}</p>
          <div role="radiogroup" aria-labelledby={id("cach")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CACH_XU_LY_HANG.map((pa) => {
              const chon = cachHieuLuc === pa.ma;
              const khoa = khoaTraNgay && pa.ma === "TRA_NGAY";
              const BieuTuong = BIEU_TUONG_CACH[pa.ma];
              return (
                <button
                  key={pa.ma}
                  type="button"
                  role="radio"
                  aria-checked={chon}
                  disabled={khoa}
                  onClick={() => setCachXuLy(pa.ma)}
                  className={cn(
                    "grid grid-cols-[16px_minmax(0,1fr)_20px] gap-x-3 gap-y-0.5 rounded-md border bg-bo-surface p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/25 disabled:cursor-default",
                    chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border",
                    !chon && !khoa && "hover:border-slate-300",
                    khoa && "cursor-not-allowed bg-bo-surface-subtle",
                  )}
                >
                  <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                    {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                  </span>
                  <span className={cn("text-sm font-medium", khoa ? "text-bo-muted" : "text-bo-foreground")}>{t(pa.ten)}</span>
                  {BieuTuong ? <BieuTuong className={cn("size-5", chon ? "text-bo-primary" : "text-bo-muted")} aria-hidden /> : <span />}
                  <span className="col-start-2 col-end-4 text-xs text-bo-muted">{khoa ? LY_DO_KHOA_TRA_NGAY : t(pa.moTa)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Khung gắn với hai lựa chọn ở trên: người ký và việc xảy ra sau khi lập */}
        <div className="flex flex-col gap-4 rounded-md border border-bo-border bg-bo-surface-subtle p-4">
          <div className="flex flex-col gap-3">
            {vanChuyen ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={id("don-vi")} className="text-sm font-medium text-bo-foreground">
                  {t("Đơn vị vận chuyển")} <span className="text-bo-danger">*</span>
                </label>
                <input
                  ref={oDonVi}
                  id={id("don-vi")}
                  value={donVi}
                  autoComplete="off"
                  placeholder={t("VD: Nhà xe Phương Trang, Viettel Post")}
                  onChange={(e) => {
                    setDonVi(e.target.value);
                    datLoi("donVi", "");
                  }}
                  onBlur={() => donVi.trim() && datLoi("donVi", loiDonVi(donVi))}
                  aria-invalid={loi.donVi ? true : undefined}
                  aria-describedby={loi.donVi ? id("don-vi-loi") : undefined}
                  className={cn(O_NHAP, loi.donVi && "border-bo-danger")}
                />
                {loi.donVi ? <p id={id("don-vi-loi")} role="alert" className="text-xs text-bo-danger">{loi.donVi}</p> : null}
              </div>
            ) : null}
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={id("nguoi-nhan")} className="text-sm font-medium text-bo-foreground">
                  {traNgay ? t("Họ tên người ký và nhận hàng lỗi") : t("Họ tên người ký")} <span className="text-bo-danger">*</span>
                </label>
                <input
                  ref={oNguoiNhan}
                  id={id("nguoi-nhan")}
                  value={nguoiNhan}
                  autoComplete="off"
                  onChange={(e) => {
                    setNguoiNhan(e.target.value);
                    datLoi("nguoiNhan", "");
                  }}
                  onBlur={roiONguoiKy}
                  aria-invalid={loi.nguoiNhan ? true : undefined}
                  aria-describedby={loi.nguoiNhan ? id("nguoi-nhan-loi") : undefined}
                  className={cn(O_NHAP, loi.nguoiNhan && "border-bo-danger")}
                />
                {loi.nguoiNhan ? <p id={id("nguoi-nhan-loi")} role="alert" className="text-xs text-bo-danger">{loi.nguoiNhan}</p> : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={id("bien-so")} className="text-sm font-medium text-bo-foreground">{t("Biển số xe")}</label>
                <input
                  ref={oBienSo}
                  id={id("bien-so")}
                  value={bienSo}
                  maxLength={GIOI_HAN_TRA_HANG.bienSo}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={VI_DU_BIEN_SO}
                  onChange={(e) => goBienSo(e.target.value.toUpperCase())}
                  onBlur={roiOBienSo}
                  aria-invalid={loi.bienSo ? true : undefined}
                  aria-describedby={loi.bienSo ? id("bien-so-loi") : undefined}
                  className={cn(O_NHAP, "uppercase placeholder:normal-case", loi.bienSo && "border-bo-danger")}
                />
                {loi.bienSo ? <p id={id("bien-so-loi")} role="alert" className="text-xs text-bo-danger">{loi.bienSo}</p> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Sau khi lập")}</p>
            <ul className="flex flex-col gap-2">
              {viecSauKhiLap(traNgay).map((muc) => {
                const BieuTuong = muc.icon;
                return (
                  <li key={muc.chu} className={cn("flex items-start gap-2.5 text-[13px] leading-5", muc.canhBao ? "font-medium text-amber-700" : "text-bo-foreground")}>
                    <BieuTuong className={cn("mt-0.5 size-4 shrink-0", muc.canhBao ? "text-amber-600" : "text-bo-muted")} aria-hidden />
                    <span>{muc.chu}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("ghi-chu")} className="text-sm font-medium text-bo-foreground">{t("Ghi chú gửi nhà cung cấp")}</label>
          <textarea
            ref={oGhiChu}
            id={id("ghi-chu")}
            rows={2}
            value={ghiChu}
            onChange={(e) => {
              setGhiChu(e.target.value);
              // Đang báo quá dài thì cập nhật theo số ký tự mới (xóa bớt đủ là mất ngay)
              if (loi.ghiChu) datLoi("ghiChu", loiGhiChu(e.target.value));
            }}
            onBlur={() => datLoi("ghiChu", loiGhiChu(ghiChu))}
            placeholder={t("VD: Áo rách đường may tay trái")}
            aria-invalid={loi.ghiChu ? true : undefined}
            aria-describedby={hienDongGhiChu ? id("ghi-chu-dem") : undefined}
            className={cn(
              "w-full resize-y rounded-md border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle",
              loi.ghiChu && "border-bo-danger",
            )}
          />
          {/* Câu lỗi bên trái, số ký tự bên phải: chỉ hiện khi gần giới hạn hoặc đang báo lỗi */}
          {hienDongGhiChu ? (
            <div id={id("ghi-chu-dem")} className="flex items-start justify-between gap-3 text-xs">
              <p role={loi.ghiChu ? "alert" : undefined} className="text-bo-danger">{loi.ghiChu}</p>
              <p className={cn("shrink-0 tabular-nums", soKyTuGhiChu > GIOI_HAN_TRA_HANG.ghiChu ? "text-bo-danger" : "text-bo-muted")}>
                {soKyTuGhiChu}/{GIOI_HAN_TRA_HANG.ghiChu}
              </p>
            </div>
          ) : null}
        </div>

        {thieuDong ? (
          <DongThongBao tone={loiTaiLo ? "bad" : "neutral"}>
            {loiTaiLo
              ? t("Hàng lỗi theo lô của một số biến thể chưa đọc được hoặc vừa đổi ở máy khác nên bảng trên chưa khớp số kiểm đếm. Đóng hộp, tải lại trang rồi mở lại.")
              : t("Đang tải hàng lỗi theo lô…")}
          </DongThongBao>
        ) : bbCu ? (
          <DongThongBao tone="warn">
            {Number(bbCu.tongSoLuongLoi) !== tong
              ? t("Biên bản đang ghi {{tongSoLuongLoi}} sản phẩm lỗi, kiểm đếm hiện có {{tong}}.", { count: Number(bbCu.tongSoLuongLoi) || 0, tongSoLuongLoi: bbCu.tongSoLuongLoi, tong })
              : t("Biên bản không còn khớp các lô có hàng lỗi (có lô đã xóa hoặc khóa lại).")}{" "}
            {t("Lập lại sẽ thay toàn bộ dòng của biên bản bằng các dòng ở trên, giữ số biên bản {{soBienBan}}. In lại cho người giao hàng ký.", { soBienBan: bbCu.soBienBan })}
          </DongThongBao>
        ) : null}
      </div>

      <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" disabled={dangXuLy} onClick={onDong} className="min-w-28 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
          {t("Hủy")}
        </Button>
        <Button
          disabled={dangXuLy || tong === 0 || thieuDong}
          onClick={bamLap}
          className="min-w-28 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
        >
          {dangXuLy ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
          {nhanNut}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
