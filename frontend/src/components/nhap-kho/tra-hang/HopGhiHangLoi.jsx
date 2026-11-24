import { useId, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { giaTriONgayGio, tuONgayGio } from "@/components/chuyen-kho/hienThiChuyenKho";
import { CACH_GIAO_TRA, GIOI_HAN_TRA_HANG } from "@/constants/nhapKho";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { bienBanTraHangService } from "@/services/bienBanTraHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { t, tDuLieu } from "@/i18n";

const KHUNG_HOP = "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(640px,calc(100%-2rem))]";
const O_NHAP = "h-9 w-full rounded-md border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";
const O_LOI = "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15";
/** Máy chủ cho thời điểm sau hiện tại tối đa 5 phút (đồng hồ lệch). */
const LECH_MS = 5 * 60 * 1000;

/**
 * Kho ghi hàng lỗi đã rời kho, làm theo lựa chọn của nhà cung cấp trên Cổng nhà cung cấp.
 * - cheDo "giaoTra" (nhà cung cấp chọn nhận lại): nhà cung cấp đến lấy (người nhận) hoặc gửi đơn vị vận chuyển (tên đơn
 *   vị + mã vận đơn).
 * - cheDo "tieuHuy" (nhà cung cấp đồng ý tiêu hủy; quản lý kho / quản trị viên ghi): người đồng ý lấy từ câu trả lời của
 *   nhà cung cấp, kho chỉ ghi thời điểm và ghi chú. Thời điểm không trước lúc nhà cung cấp đồng ý.
 * Thời điểm không trước lúc lập biên bản, không sau hiện tại.
 */
export default function HopGhiHangLoi({ open, onOpenChange, bienBan, cheDo = "giaoTra", dong = [], onXong }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && bienBan ? <NoiDung key={`${bienBan.id}-${cheDo}`} bb={bienBan} cheDo={cheDo} dong={dong} onDong={() => onOpenChange(false)} onXong={onXong} /> : null}
    </Dialog>
  );
}

function NoiDung({ bb, cheDo, dong, onDong, onXong }) {
  const idGoc = useId();
  const fid = (ten) => `${idGoc}-${ten}`;
  const tieuHuy = cheDo === "tieuHuy";
  // Dòng ghi lần này (mặc định mọi dòng của việc này; bỏ chọn dòng nhà cung cấp chưa lấy / chưa tiêu hủy)
  const [chonDong, setChonDong] = useState(() => new Set(dong.map((d) => d.id)));
  const dongChon = dong.filter((d) => chonDong.has(d.id));
  // Lúc / người đồng ý tiêu hủy: theo các dòng ghi; biên bản không kèm dòng thì theo lần chọn của cả biên bản
  const lucDongY = dong.length
    ? dongChon.map((d) => d.thoiDiemChonHangLoi).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] ?? null
    : bb.thoiDiemChonHangLoi;
  const nguoiDongY = dong.length
    ? [...new Set(dongChon.map((d) => d.nguoiChonHangLoi).filter(Boolean))].join(", ")
    : bb.nguoiChonHangLoi;
  const soLoi = dong.length ? dongChon.reduce((s, d) => s + Number(d.soLuong || 0), 0) : Number(bb.tongSoLuongLoi) || 0;
  const [cachGiao, setCachGiao] = useState("NCC_LAY");
  const [thoiDiem, setThoiDiem] = useState(() => giaTriONgayGio(new Date()));
  const [nguoi, setNguoi] = useState("");
  const [maVanDon, setMaVanDon] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState({});
  const [dangGui, setDangGui] = useState(false);
  const vanChuyen = !tieuHuy && cachGiao === "VAN_CHUYEN";

  const kiem = () => {
    const l = {};
    const iso = tuONgayGio(thoiDiem);
    if (!iso) l.thoiDiem = iso === undefined ? t("Thời điểm không hợp lệ.") : t("Chọn thời điểm.");
    else if (new Date(iso).getTime() > Date.now() + LECH_MS) l.thoiDiem = t("Thời điểm không được sau hiện tại.");
    else if (bb.ngayLap && new Date(iso).getTime() < new Date(bb.ngayLap).getTime() - 60000) l.thoiDiem = t("Thời điểm không được trước lúc lập biên bản.");
    else if (tieuHuy && lucDongY && new Date(iso).getTime() < new Date(lucDongY).getTime() - 60000) {
      l.thoiDiem = t("Thời điểm tiêu hủy không được trước lúc nhà cung cấp đồng ý ({{luc}}).", { luc: formatDateTime(lucDongY) });
    }
    if (dong.length && !dongChon.length) l.dong = t("Chọn ít nhất một sản phẩm.");
    const ten = nguoi.trim();
    if (!tieuHuy && !ten) l.nguoi = vanChuyen ? t("Nhập đơn vị vận chuyển.") : t("Nhập người nhận hàng.");
    else if (ten.length > GIOI_HAN_TRA_HANG.ten) l.nguoi = t("Tối đa {{so}} ký tự.", { so: GIOI_HAN_TRA_HANG.ten });
    if (vanChuyen && !maVanDon.trim()) l.maVanDon = t("Nhập mã vận đơn.");
    if (ghiChu.trim().length > GIOI_HAN_TRA_HANG.ghiChu) l.ghiChu = t("Tối đa {{so}} ký tự.", { so: GIOI_HAN_TRA_HANG.ghiChu });
    return { l, iso };
  };

  const gui = async () => {
    const { l, iso } = kiem();
    setLoi(l);
    if (Object.keys(l).length) return;
    setDangGui(true);
    try {
      const ghi = ghiChu.trim() || null;
      const dongIds = dong.length ? dongChon.map((d) => d.id) : null;
      const dto = tieuHuy
        ? await bienBanTraHangService.tieuHuy(bb.id, { thoiDiem: iso, ghiChu: ghi, dongIds })
        : await bienBanTraHangService.giaoTra(bb.id, {
          thoiDiem: iso, cachGiao, nguoiNhan: nguoi.trim(), maVanDon: vanChuyen ? maVanDon.trim() : null, ghiChu: ghi, dongIds,
        });
      toast.success(tieuHuy ? t("Đã ghi tiêu hủy hàng lỗi") : t("Đã ghi giao trả hàng lỗi"));
      onXong?.(dto);
      onDong();
    } catch (e) {
      toast.error(getApiErrorMessage(e, tieuHuy ? t("Không ghi được tiêu hủy") : t("Không ghi được giao trả")));
    } finally {
      setDangGui(false);
    }
  };

  const xoaLoi = (ten) => loi[ten] && setLoi((x) => ({ ...x, [ten]: undefined }));
  const moTaLoi = (ten) => (loi[ten] ? { "aria-invalid": true, "aria-describedby": `${fid(ten)}-loi` } : {});
  const dongLoi = (ten) => (loi[ten] ? <p id={`${fid(ten)}-loi`} role="alert" className="text-xs text-bo-danger">{loi[ten]}</p> : null);
  const doiChonDong = (id) => {
    setChonDong((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
    xoaLoi("dong");
  };

  return (
    <DialogContent className={KHUNG_HOP}>
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 pr-12 text-left">
        <DialogTitle className="text-base text-bo-foreground">
          {tieuHuy
            ? t("Ghi tiêu hủy hàng lỗi · {{soBienBan}}", { soBienBan: bb.soBienBan })
            : t("Ghi đã giao trả hàng lỗi · {{soBienBan}}", { soBienBan: bb.soBienBan })}
        </DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          {t("{{soLoi}} sản phẩm · {{ncc}}", { count: soLoi, soLoi, ncc: bb.tenNhaCungCap || "" })}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 *:shrink-0 sm:px-6">
        {dong.length ? (
          <fieldset className="flex flex-col gap-2" {...moTaLoi("dong")}>
            <legend className="mb-2 text-sm font-semibold text-bo-foreground">
              {tieuHuy ? t("Sản phẩm tiêu hủy lần này") : t("Sản phẩm giao trả lần này")}
            </legend>
            <ul className="divide-y divide-bo-border rounded-lg border border-bo-border">
              {dong.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 text-sm hover:bg-bo-surface-subtle">
                    <input type="checkbox" checked={chonDong.has(d.id)} disabled={dangGui} onChange={() => doiChonDong(d.id)} className="mt-0.5 size-4 shrink-0 accent-[#0d61e4]" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-bo-foreground">{d.tenBienThe}</span>
                      <span className="text-bo-muted">{[d.mauSac, d.kichCo].filter(Boolean).length ? ` · ${[d.mauSac, d.kichCo].filter(Boolean).join(" / ")}` : ""}</span>
                      <span className="block text-xs text-bo-muted">
                        <span className="font-mono">{d.maLo || d.sku}</span>{d.lyDo ? ` · ${tDuLieu(d.lyDo)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-bo-foreground">{d.soLuong}</span>
                  </label>
                </li>
              ))}
            </ul>
            {dong.length > 1 ? (
              <p className="text-xs text-bo-muted">
                {tieuHuy
                  ? t("Bỏ chọn sản phẩm chưa tiêu hủy lần này; ghi sau khi tiêu hủy nốt.")
                  : t("Bỏ chọn sản phẩm nhà cung cấp chưa lấy lần này; ghi sau khi lấy nốt.")}
              </p>
            ) : null}
            {dongLoi("dong")}
          </fieldset>
        ) : null}
        {!tieuHuy ? (
          <div className="flex flex-col gap-2">
            <p id="ghi-hang-loi-cach-giao" className="text-sm font-semibold text-bo-foreground">{t("Cách giao")}</p>
            <div role="radiogroup" aria-labelledby="ghi-hang-loi-cach-giao" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CACH_GIAO_TRA.map((c) => {
                const chon = cachGiao === c.ma;
                return (
                  <button
                    key={c.ma}
                    type="button"
                    role="radio"
                    aria-checked={chon}
                    onClick={() => { setCachGiao(c.ma); setLoi({}); }}
                    className={cn(
                      "grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md border bg-bo-surface p-3 text-left",
                      chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                    )}
                  >
                    <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                      {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                    </span>
                    <span className="text-sm font-medium text-bo-foreground">{t(c.ten)}</span>
                    <span className="col-start-2 text-xs text-bo-muted">{t(c.moTa)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : lucDongY ? (
          <DongThongBao>
            {t("{{nguoi}} đồng ý tiêu hủy trên Cổng nhà cung cấp lúc {{luc}}.", {
              nguoi: nguoiDongY || t("Nhà cung cấp"),
              luc: formatDateTime(lucDongY),
            })}
          </DongThongBao>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={fid("thoiDiem")} className="text-sm font-medium text-bo-foreground">
              {tieuHuy ? t("Thời điểm tiêu hủy") : t("Thời điểm giao")} <span className="text-bo-danger">*</span>
            </label>
            <input id={fid("thoiDiem")} type="datetime-local" value={thoiDiem} max={giaTriONgayGio(new Date())}
              onChange={(e) => { setThoiDiem(e.target.value); xoaLoi("thoiDiem"); }}
              className={cn(O_NHAP, loi.thoiDiem && O_LOI)} {...moTaLoi("thoiDiem")} />
            {dongLoi("thoiDiem")}
          </div>
          {!tieuHuy ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={fid("nguoi")} className="text-sm font-medium text-bo-foreground">
                {vanChuyen ? t("Đơn vị vận chuyển") : t("Người nhận")} <span className="text-bo-danger">*</span>
              </label>
              <input id={fid("nguoi")} value={nguoi} maxLength={GIOI_HAN_TRA_HANG.ten}
                onChange={(e) => { setNguoi(e.target.value); xoaLoi("nguoi"); }}
                className={cn(O_NHAP, loi.nguoi && O_LOI)} {...moTaLoi("nguoi")} />
              {dongLoi("nguoi")}
            </div>
          ) : null}
          {vanChuyen ? (
            <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <label htmlFor={fid("maVanDon")} className="text-sm font-medium text-bo-foreground">
                {t("Mã vận đơn")} <span className="text-bo-danger">*</span>
              </label>
              <input id={fid("maVanDon")} value={maVanDon} maxLength={GIOI_HAN_TRA_HANG.maVanDon} spellCheck={false}
                onChange={(e) => { setMaVanDon(e.target.value); xoaLoi("maVanDon"); }}
                className={cn(O_NHAP, "font-mono", loi.maVanDon && O_LOI)} {...moTaLoi("maVanDon")} />
              {dongLoi("maVanDon")}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={fid("ghiChu")} className="text-sm font-medium text-bo-foreground">{t("Ghi chú")}</label>
          <textarea id={fid("ghiChu")} rows={2} value={ghiChu} maxLength={GIOI_HAN_TRA_HANG.ghiChu}
            onChange={(e) => { setGhiChu(e.target.value); xoaLoi("ghiChu"); }}
            className={cn("w-full resize-y rounded-md border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15", loi.ghiChu && O_LOI)}
            {...moTaLoi("ghiChu")} />
          {dongLoi("ghiChu")}
        </div>

        <DongThongBao>
          {tieuHuy
            ? t("Ghi xong, hàng lỗi rời khu chờ trả. Tồn kho không đổi vì hàng lỗi chưa từng vào tồn.")
            : t("Ghi xong, hàng lỗi rời khu chờ trả. Tồn kho không đổi vì hàng lỗi chưa từng vào tồn. Nên giữ biên bản có chữ ký người nhận.")}
        </DongThongBao>
      </div>

      <DialogFooter className="shrink-0 gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button variant="outline" disabled={dangGui} onClick={onDong} className="min-w-28 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
          {t("Hủy")}
        </Button>
        <Button disabled={dangGui} onClick={gui} className="min-w-28 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
          {dangGui ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {tieuHuy ? t("Ghi tiêu hủy") : t("Ghi đã giao trả")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
