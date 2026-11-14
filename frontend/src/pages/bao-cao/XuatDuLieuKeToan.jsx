import { Fragment, createElement, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Ban, Calendar, ChevronDown, ChevronRight, Download, FileSpreadsheet, Info, Loader2, Lock, LockOpen, Search, Settings, XCircle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MetricStrip from "@/components/shared/MetricStrip";
import StatusTabs from "@/components/shared/StatusTabs";
import NutSaoChep from "@/components/shared/NutSaoChep";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import {
  coThue,
  coTien,
  congTongHop,
  dinhDangKichThuoc,
  hienNgay,
  homQuaIso,
  loCoTheHuy,
  ngayIso,
  nhomTheoLoai,
  tenLoai,
} from "@/components/ke-toan/tinhKeToan";
import { t } from "@/i18n";

const TH = "h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const TD = "px-4 py-2.5 align-top";
const SO = "tabular-nums text-right";
const O_NHAN_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto";
const O_NGAY_CLASS = "h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0";
const NUT_CHINH = "h-9 gap-2 bg-bo-primary px-4 text-sm font-medium text-white hover:bg-bo-primary-hover disabled:opacity-50";
const NUT_PHU = "h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle";
const NUT_ICON =
  "inline-flex size-7 items-center justify-center rounded-md text-bo-muted hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

const TABS = [
  { value: "tao", label: t("Tạo lô") },
  { value: "lo", label: t("Các lô đã tạo") },
];

const MAU_VAN_DE = {
  chan: "border-bo-danger/20 bg-bo-danger-soft text-bo-danger",
  canh: "border-bo-warning/30 bg-bo-warning-soft text-bo-warning",
  tin: "border-bo-primary/20 bg-bo-primary-soft text-bo-primary",
};

const tien = (v) => (v == null ? "—" : formatCurrency(v));

/** Một nhóm vấn đề (để lại lô sau / cảnh báo / sau khi xuất): đóng mở được, mặc định mở. */
function NhomVanDe({ tieuDe, moTa, ds, tone, icon }) {
  const [mo, setMo] = useState(true);
  if (!ds?.length) return null;
  return (
    <section className={cn("rounded-lg border", MAU_VAN_DE[tone])}>
      <button type="button" onClick={() => setMo((m) => !m)} aria-expanded={mo}
        className="flex w-full items-start gap-2 rounded-lg px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary">
        {createElement(icon, { className: "mt-0.5 size-4 shrink-0", "aria-hidden": true })}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{tieuDe} · {ds.length}</span>
          <span className="block text-xs text-bo-foreground/80">{moTa}</span>
        </span>
        {mo ? <ChevronDown className="size-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}
      </button>
      {mo ? (
        <ul className="max-h-72 overflow-y-auto border-t border-bo-border/60 bg-white/70 px-4 py-2 text-[13px] text-bo-foreground">
          {ds.map((v, i) => (
            <li key={`${v.loai}-${v.idNguon ?? i}-${i}`} className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-slate-100 py-1.5 last:border-0">
              <span className="min-w-[150px] font-medium">{v.soChungTu || tenLoai(v.loai)}</span>
              <span className="text-xs text-bo-muted">{tenLoai(v.loai)}</span>
              <span className="basis-full">{v.noiDung}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Hộp mở khóa một chứng từ đã giao: bắt nhập lý do (ghi nhật ký). */
function HopMoKhoa({ chungTu, onDong, onXong, onLoiXungDot }) {
  const [lyDo, setLyDo] = useState("");
  const [dangMo, setDangMo] = useState(false);
  const [loi, setLoi] = useState("");

  const xacNhan = async (event) => {
    event.preventDefault();
    if (dangMo) return;
    if (!lyDo.trim()) {
      setLoi(t("Nhập lý do mở khóa"));
      return;
    }
    setDangMo(true);
    try {
      const kq = await keToanService.moKhoa(chungTu.id, lyDo.trim());
      toast.success(t("Đã mở khóa {{soChungTu}}. Chứng từ sẽ vào lô sau.", { soChungTu: chungTu.soChungTu }));
      onXong(kq);
    } catch (e) {
      // Người khác vừa mở khóa: tải lại danh sách để thấy đúng trạng thái
      if (e?.response?.status === 409) onLoiXungDot();
      setLoi(getApiErrorMessage(e, t("Không mở khóa được")));
    } finally {
      setDangMo(false);
    }
  };

  return (
    <Dialog open onOpenChange={(mo) => !mo && !dangMo && onDong()}>
      <DialogContent className="flex flex-col gap-0 rounded-xl border-bo-border p-0 sm:max-w-[520px]">
        <form onSubmit={xacNhan} noValidate>
          <div className="border-b border-bo-border px-6 py-4">
            <DialogTitle className="text-base font-semibold text-bo-foreground">{t("Mở khóa")} {chungTu.soChungTu}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-5 text-bo-muted">
              {t("Chứng từ quay về \"chưa xuất\" và vào lô sau. Kế toán phải xóa chứng từ này trên AMIS trước khi nhập lô mới, vì AMIS chỉ thêm mới và báo trùng số chứng từ. Lần mở khóa được ghi nhật ký.")}
            </DialogDescription>
          </div>
          <div className="flex flex-col gap-1.5 px-6 py-4">
            <label htmlFor="ly-do-mo-khoa" className="text-sm font-medium text-bo-foreground">{t("Lý do")}</label>
            <Textarea id="ly-do-mo-khoa" rows={3} maxLength={500} value={lyDo} autoFocus
              onChange={(e) => { setLyDo(e.target.value); setLoi(""); }}
              placeholder={t("VD: Kế toán đã xóa chứng từ trên AMIS để sửa ngày hạch toán")}
              className="resize-y border-bo-border bg-white text-sm"
              aria-invalid={loi ? true : undefined} aria-describedby={loi ? "ly-do-mo-khoa-loi" : undefined} />
            {loi ? <p id="ly-do-mo-khoa-loi" role="alert" className="text-xs text-bo-danger">{loi}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
            <Button type="button" variant="outline" onClick={onDong} disabled={dangMo} className={NUT_PHU}>{t("Hủy")}</Button>
            <Button type="submit" disabled={dangMo} className="h-9 gap-2 bg-bo-danger px-4 text-white hover:bg-bo-danger-strong">
              {dangMo ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LockOpen className="size-4" aria-hidden="true" />}
              {t("Mở khóa")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hộp hủy lô (chỉ lô còn hiệu lực mới nhất): bắt nhập lý do (ghi nhật ký) và xác nhận kế toán chưa nhập lô vào AMIS hoặc đã
 * xóa các chứng từ của lô trên AMIS — không thì lô mới nhập vào bị trùng chứng từ.
 */
function HopHuyLo({ lo, onDong, onXong, onLoiXungDot }) {
  const [lyDo, setLyDo] = useState("");
  const [daKiem, setDaKiem] = useState(false);
  const [dangHuy, setDangHuy] = useState(false);
  const [loiXacNhan, setLoiXacNhan] = useState("");
  const [loiLyDo, setLoiLyDo] = useState("");
  const [loi, setLoi] = useState("");
  const dangGuiRef = useRef(false);

  const xacNhan = async (event) => {
    event.preventDefault();
    if (dangGuiRef.current) return;
    // Kiểm theo đúng thứ tự trên màn: ô xác nhận rồi lý do
    const thieuXacNhan = !daKiem ? t("Đánh dấu ô xác nhận trước khi hủy lô") : "";
    const thieuLyDo = !lyDo.trim() ? t("Nhập lý do hủy lô") : "";
    setLoiXacNhan(thieuXacNhan);
    setLoiLyDo(thieuLyDo);
    setLoi("");
    if (thieuXacNhan || thieuLyDo) return;
    dangGuiRef.current = true;
    setDangHuy(true);
    try {
      const kq = await keToanService.huyLo(lo.id, lyDo.trim());
      toast.success(t("Đã hủy lô {{soLo}}. Chứng từ của lô sẽ vào lô sau.", { soLo: lo.soLo }));
      onXong(kq);
    } catch (e) {
      // Người khác vừa hủy lô này hoặc vừa tạo lô mới hơn: tải lại danh sách để thấy đúng lô hủy được
      if (e?.response?.status === 409) onLoiXungDot();
      setLoi(getApiErrorMessage(e, t("Không hủy được lô")));
    } finally {
      dangGuiRef.current = false;
      setDangHuy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(mo) => !mo && !dangHuy && onDong()}>
      <DialogContent className="flex flex-col gap-0 rounded-xl border-bo-border p-0 sm:max-w-[540px]">
        <form onSubmit={xacNhan} noValidate>
          <div className="border-b border-bo-border px-6 py-4">
            <DialogTitle className="text-base font-semibold text-bo-foreground">{t("Hủy lô {{soLo}}", { soLo: lo.soLo })}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-5 text-bo-muted">
              {t("Mọi chứng từ của lô quay về \"chưa xuất\" và vào lô sau. Tệp nén vẫn giữ để đối chiếu. Lần hủy được ghi nhật ký.")}
            </DialogDescription>
          </div>
          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 text-[13px] leading-5 text-bo-foreground">
                <input type="checkbox" checked={daKiem} autoFocus
                  onChange={(e) => { setDaKiem(e.target.checked); setLoiXacNhan(""); setLoi(""); }}
                  className="mt-0.5 size-4 shrink-0 accent-bo-primary"
                  aria-invalid={loiXacNhan ? true : undefined} aria-describedby={loiXacNhan ? "xac-nhan-huy-lo-loi" : undefined} />
                <span>{t("Kế toán chưa nhập lô này vào AMIS, hoặc đã xóa trên AMIS mọi chứng từ của lô.")}</span>
              </label>
              {loiXacNhan ? <p id="xac-nhan-huy-lo-loi" role="alert" className="pl-6 text-xs text-bo-danger">{loiXacNhan}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ly-do-huy-lo" className="text-sm font-medium text-bo-foreground">{t("Lý do")}</label>
              <Textarea id="ly-do-huy-lo" rows={3} maxLength={500} value={lyDo}
                onChange={(e) => { setLyDo(e.target.value); setLoiLyDo(""); setLoi(""); }}
                placeholder={t("VD: Nhập vào AMIS bị lỗi, cần sửa đơn rồi xuất lại")}
                className="resize-y border-bo-border bg-white text-sm"
                aria-invalid={loiLyDo ? true : undefined} aria-describedby={loiLyDo ? "ly-do-huy-lo-loi" : undefined} />
              {loiLyDo ? <p id="ly-do-huy-lo-loi" role="alert" className="text-xs text-bo-danger">{loiLyDo}</p> : null}
            </div>
            {loi ? <p role="alert" className="text-xs text-bo-danger">{loi}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
            <Button type="button" variant="outline" onClick={onDong} disabled={dangHuy} className={NUT_PHU}>{t("Quay lại")}</Button>
            <Button type="submit" disabled={dangHuy} className="h-9 gap-2 bg-bo-danger px-4 text-white hover:bg-bo-danger-strong">
              {dangHuy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Ban className="size-4" aria-hidden="true" />}
              {t("Hủy lô")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Chứng từ của một lô, nhóm theo loại; mỗi chứng từ còn khóa có nút mở khóa. */
function ChungTuCuaLo({ lo, onDaMoKhoa }) {
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState(null);
  const [lanTai, setLanTai] = useState(0);
  const [moKhoa, setMoKhoa] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    keToanService
      .chungTuCuaLo(lo.id, { signal: ctrl.signal })
      .then((kq) => {
        setDs(kq);
        setLoi(null);
      })
      .catch((e) => !ctrl.signal.aborted && setLoi(getApiErrorMessage(e, t("Không tải được chứng từ của lô"))));
    return () => ctrl.abort();
  }, [lo.id, lanTai]);

  if (loi) {
    return (
      <p className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-bo-danger">
        {loi}
        <Button variant="outline" size="sm" className={NUT_PHU} onClick={() => setLanTai((k) => k + 1)}>{t("Thử lại")}</Button>
      </p>
    );
  }
  if (!ds) {
    return <p className="flex items-center gap-2 px-4 py-3 text-sm text-bo-muted"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t("Đang tải chứng từ")}</p>;
  }
  if (ds.length === 0) return <p className="px-4 py-3 text-sm text-bo-muted">{t("Lô không có chứng từ.")}</p>;

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {nhomTheoLoai(ds).map((nhom) => (
        <div key={nhom.loai}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">{nhom.ten} · {nhom.chungTu.length}</p>
          <div className="overflow-x-auto rounded-md border border-bo-border bg-white">
            <table className="w-full min-w-[640px] text-[13px]">
              <tbody>
                {nhom.chungTu.map((ct) => (
                  <tr key={ct.id} className="border-b border-slate-100 last:border-0">
                    <td className="w-[220px] px-3 py-2 font-medium whitespace-nowrap">
                      {ct.soChungTu}
                      {tenLoai(ct.loai) !== nhom.ten ? <span className="block text-[11px] font-normal text-bo-muted">{tenLoai(ct.loai)}</span> : null}
                    </td>
                    <td className="w-[110px] px-3 py-2 tabular-nums">{hienNgay(ct.ngayHachToan)}</td>
                    <td className="w-[150px] px-3 py-2 text-right tabular-nums">{Number(ct.tongTien) ? tien(ct.tongTien) : ""}</td>
                    <td className="px-3 py-2">
                      {ct.trangThai === "da_xuat" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-bo-muted"><Lock className="size-3.5" aria-hidden="true" />{t("Đang khóa")}</span>
                      ) : ct.trangThai === "da_huy_lo" ? (
                        <span className="text-xs text-bo-muted">{t("Lô đã hủy, chứng từ vào lô sau")}</span>
                      ) : (
                        <span className="text-xs text-bo-warning">
                          {t("Đã mở khóa")} {ct.moKhoaLuc ? formatDateTime(ct.moKhoaLuc) : ""}{ct.nguoiMoKhoa ? ` · ${ct.nguoiMoKhoa}` : ""}
                          {ct.lyDoMoKhoa ? <span className="block text-bo-muted">{ct.lyDoMoKhoa}</span> : null}
                        </span>
                      )}
                    </td>
                    <td className="w-[110px] px-3 py-2 text-right">
                      {ct.trangThai === "da_xuat" ? (
                        <button type="button" onClick={() => setMoKhoa(ct)} aria-label={t("Mở khóa {{soChungTu}}", { soChungTu: ct.soChungTu })}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-bo-danger hover:bg-bo-danger-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary">
                          <LockOpen className="size-3.5" aria-hidden="true" />{t("Mở khóa")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {moKhoa ? (
        <HopMoKhoa
          chungTu={moKhoa}
          onDong={() => setMoKhoa(null)}
          onLoiXungDot={() => setLanTai((k) => k + 1)}
          onXong={(kq) => {
            setDs((cu) => cu.map((c) => (c.id === kq.id ? kq : c)));
            setMoKhoa(null);
            onDaMoKhoa();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Xuất dữ liệu kế toán sang AMIS Kế toán doanh nghiệp theo lô. Chọn "xuất đến hết ngày" (không chọn khoảng) để không sót
 * chứng từ: lô gồm mọi chứng từ chưa giao từ ngày mốc đến ngày đã chọn. Chỉ quản trị viên.
 */
export default function XuatDuLieuKeToan() {
  const [tab, setTab] = useState("tao");
  const [denNgay, setDenNgay] = useState(() => homQuaIso());
  const [xemTruoc, setXemTruoc] = useState(null);
  const [dangKiem, setDangKiem] = useState(false);
  const [loiKiem, setLoiKiem] = useState(null);
  const [ghiChu, setGhiChu] = useState("");
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [dangTao, setDangTao] = useState(false);
  // Chỉ nhận kết quả của lần kiểm tra mới nhất: đổi ngày khi đang kiểm thì kết quả cũ về muộn bị bỏ
  const lanKiemRef = useRef(0);

  const [dsLo, setDsLo] = useState(null);
  const [loiLo, setLoiLo] = useState(null);
  const [loMo, setLoMo] = useState(null);
  const [dangTai, setDangTai] = useState(null);
  const [huyLo, setHuyLo] = useState(null);

  const kiemTra = useCallback(async () => {
    const lan = ++lanKiemRef.current;
    setDangKiem(true);
    setLoiKiem(null);
    try {
      const kq = await keToanService.xemTruoc(denNgay);
      if (lan === lanKiemRef.current) setXemTruoc(kq);
    } catch (e) {
      if (lan !== lanKiemRef.current) return;
      setXemTruoc(null);
      setLoiKiem(getApiErrorMessage(e, t("Không kiểm tra được dữ liệu kế toán")));
    } finally {
      if (lan === lanKiemRef.current) setDangKiem(false);
    }
  }, [denNgay]);

  // Đang tải thì bỏ lượt gọi thêm: đặt dsLo = null làm effect bên dưới gọi lại một lần nữa
  const dangTaiLoRef = useRef(false);
  const taiDanhSachLo = useCallback(async () => {
    if (dangTaiLoRef.current) return;
    dangTaiLoRef.current = true;
    setLoiLo(null);
    setDsLo(null);
    try {
      setDsLo(await keToanService.danhSachLo());
    } catch (e) {
      setLoiLo(getApiErrorMessage(e, t("Không tải được danh sách lô")));
    } finally {
      dangTaiLoRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (tab === "lo" && dsLo === null && !loiLo) queueMicrotask(() => taiDanhSachLo());
  }, [tab, dsLo, loiLo, taiDanhSachLo]);

  const taiTep = async (lo) => {
    setDangTai(lo.id);
    try {
      await keToanService.taiTep(lo);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("Không tải được tệp của lô")));
    } finally {
      setDangTai(null);
    }
  };

  const taoLo = async () => {
    if (dangTao || !xemTruoc) return;
    setDangTao(true);
    try {
      // Tạo lô theo đúng ngày đã kiểm tra; dấu vết để máy chủ từ chối nếu dữ liệu đổi sau lần kiểm tra
      const lo = await keToanService.taoLo({ denNgay: xemTruoc.denNgay, ghiChu: ghiChu.trim() || null, dauVet: xemTruoc.dauVet });
      setMoXacNhan(false);
      toast.success(t("Đã tạo lô {{soLo}} ({{soChungTu}} chứng từ). Đang tải tệp.", { soLo: lo.soLo, soChungTu: lo.soChungTu, count: Number(lo.soChungTu) }));
      setXemTruoc(null);
      setGhiChu("");
      setLoiLo(null);
      setDsLo(null);
      setTab("lo");
      await taiTep(lo);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("Không tạo được lô")));
      setMoXacNhan(false);
      // Dữ liệu đổi sau lần kiểm tra (hoặc chứng từ vừa vào lô khác): kiểm tra lại để thấy đúng nội dung lô
      if (e?.response?.status === 409) kiemTra();
    } finally {
      setDangTao(false);
    }
  };

  const tong = xemTruoc ? congTongHop(xemTruoc.tongHop) : null;
  const loHuyDuoc = dsLo ? loCoTheHuy(dsLo) : null;
  const ban = xemTruoc?.tongHop?.find((tt) => tt.loai === "ban_hang");
  const dc = xemTruoc?.doiChieu;

  return (
    <PageContainer className="flex flex-col gap-4 pb-16">
      <div className="flex flex-wrap-reverse items-start gap-x-3 border-b border-bo-border">
        <div className="min-w-0 max-w-full">
          <StatusTabs tabs={TABS} value={tab} onChange={setTab} label={t("Xuất dữ liệu kế toán")} />
        </div>
        {tab === "tao" ? (
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto">
            <label className={O_NHAN_CLASS}>
              <Calendar className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
              <span className="shrink-0 text-xs text-bo-muted">{t("Xuất đến hết ngày")}</span>
              <Input type="date" aria-label={t("Xuất đến hết ngày")} value={denNgay} max={ngayIso(new Date())} disabled={dangKiem}
                onChange={(e) => { setDenNgay(e.target.value); setXemTruoc(null); }} className={O_NGAY_CLASS} />
            </label>
            <Button onClick={kiemTra} disabled={dangKiem || !denNgay} className={cn(NUT_CHINH, "w-full sm:w-auto")}>
              {dangKiem ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
              {t("Kiểm tra")}
            </Button>
          </div>
        ) : (
          <div className="ml-auto py-2">
            <Button variant="outline" onClick={taiDanhSachLo} className={NUT_PHU}>{t("Tải lại")}</Button>
          </div>
        )}
      </div>

      {tab === "tao" ? (
        dangKiem ? (
          <LoadingState className="min-h-48" label={t("Đang kiểm tra chứng từ")} />
        ) : loiKiem ? (
          <ErrorState className="min-h-48" title={t("Lỗi kiểm tra")} description={loiKiem} onRetry={kiemTra} />
        ) : !xemTruoc ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={t("Chọn ngày rồi bấm Kiểm tra")}
            description={t("Lô gồm mọi chứng từ chưa giao kế toán, có ngày hạch toán từ ngày mốc đến hết ngày đã chọn. Mặc định là hôm qua, vì chứng từ của hôm nay còn phát sinh.")}
            action={
              <Link to="/settings/accounting" className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary hover:text-bo-primary-hover">
                <Settings className="size-4" aria-hidden="true" />{t("Thiết lập xuất kế toán")}
              </Link>
            }
          />
        ) : (
          <>
            <MetricStrip
              label={t("Tóm tắt lô")}
              items={[
                { label: t("Chứng từ trong lô"), value: String(tong.soChungTu), hint: xemTruoc.tuNgay ? `${hienNgay(xemTruoc.tuNgay)} – ${hienNgay(xemTruoc.denNgay)}` : t("đến hết {{denNgay}}", { denNgay: hienNgay(xemTruoc.denNgay) }) },
                { label: t("Doanh thu trước thuế"), value: tien(ban?.truocThue ?? 0), hint: t("sau chiết khấu") },
                { label: t("Thuế GTGT đầu ra"), value: tien(ban?.thue ?? 0) },
                { label: t("Tổng tiền khách trả"), value: tien(ban?.tongCong ?? 0), hint: t("{{count}} chứng từ bán hàng", { count: ban?.soChungTu ?? 0 }) },
              ]}
            />

            {xemTruoc.coTonDauKy ? (
              <p className={cn("flex gap-2 rounded-lg border px-4 py-3 text-[13px]", MAU_VAN_DE.tin)}>
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("Lô đầu tiên: gồm tồn đầu kỳ tại ngày mốc {{ngayMoc}}. Kế toán nhập số dư ban đầu trước mọi chứng từ.", { ngayMoc: hienNgay(xemTruoc.ngayMoc) })}
              </p>
            ) : null}

            <TableShell title={t("Theo loại chứng từ")} description={t("Đúng thứ tự kế toán nhập vào AMIS: hàng vào kho trước khi xuất.")}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                      <th className={TH}>{t("Loại")}</th>
                      <th className={cn(TH, "text-right")}>{t("Chứng từ")}</th>
                      <th className={cn(TH, "text-right")}>{t("Số dòng")}</th>
                      <th className={cn(TH, "text-right")}>{t("Trước thuế")}</th>
                      <th className={cn(TH, "text-right")}>{t("Thuế GTGT")}</th>
                      <th className={cn(TH, "text-right")}>{t("Tổng")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xemTruoc.tongHop.map((tt) => (
                      <tr key={tt.loai} className="border-b border-slate-100 last:border-0">
                        <td className={cn(TD, "font-medium")}>{t(tt.ten)}</td>
                        <td className={cn(TD, SO)}>{tt.soChungTu}</td>
                        <td className={cn(TD, SO)}>{tt.soDong}</td>
                        <td className={cn(TD, SO)}>{coTien(tt.loai) ? tien(tt.truocThue) : "—"}</td>
                        <td className={cn(TD, SO)}>{coThue(tt.loai) ? tien(tt.thue) : "—"}</td>
                        <td className={cn(TD, SO)}>{coTien(tt.loai) ? tien(tt.tongCong) : "—"}</td>
                      </tr>
                    ))}
                    {xemTruoc.tongHop.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-bo-muted">{t("Không có chứng từ mới.")}</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </TableShell>

            <NhomVanDe tone="chan" icon={XCircle} ds={xemTruoc.loiChan} tieuDe={t("Để lại lô sau")}
              moTa={t("Chứng từ có lỗi không vào lô này. Sửa rồi kiểm tra lại; các chứng từ khác vẫn xuất được.")} />
            <NhomVanDe tone="canh" icon={AlertTriangle} ds={xemTruoc.canhBao} tieuDe={t("Cảnh báo")}
              moTa={t("Vẫn xuất, nhưng nên xem trước khi giao kế toán.")} />
            <NhomVanDe tone="canh" icon={AlertTriangle} ds={xemTruoc.bienDongKho} tieuDe={t("Biến động kho cần lập tay")}
              moTa={t("Hàng hoàn của đơn bán, xuất bán của đơn đã hủy… không có chứng từ trong lô. Kế toán lập tay trên AMIS trước khi nhập xuất kho khác và bán hàng, không thì AMIS báo xuất quá tồn.")} />
            <NhomVanDe tone="tin" icon={Info} ds={xemTruoc.phatSinhSauXuat} tieuDe={t("Phát sinh sau khi xuất")}
              moTa={t("Đơn đã giao kế toán rồi bị hoàn trả trước ngày 14/11/2026 (chưa có nhật ký hoàn trả): kế toán lập Hàng bán trả lại trên AMIS.")} />

            {dc ? (
              <section className="rounded-lg border border-bo-border bg-white px-4 py-3">
                <h2 className="text-sm font-semibold text-bo-foreground">{t("Đối chiếu doanh thu với Báo cáo doanh thu")}</h2>
                <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-[13px]">
                  <dt className="text-bo-muted">{t("Báo cáo doanh thu ({{ngayMoc}} – {{denNgay}})", { ngayMoc: hienNgay(xemTruoc.ngayMoc), denNgay: hienNgay(xemTruoc.denNgay) })}</dt>
                  <dd className="m-0 text-right tabular-nums">{tien(dc.doanhThuBaoCao)}</dd>
                  <dt className="text-bo-muted">{t("Đã giao kế toán ở các lô trước")}</dt>
                  <dd className="m-0 text-right tabular-nums">{tien(dc.doanhThuLoTruoc)}</dd>
                  <dt className="text-bo-muted">{t("Trong lô này")}</dt>
                  <dd className="m-0 text-right tabular-nums">{tien(dc.doanhThuTrongLo)}</dd>
                  <dt className="text-bo-muted">{t("Bị chặn, để lại lô sau")}</dt>
                  <dd className="m-0 text-right tabular-nums">{tien(dc.doanhThuBiChan)}</dd>
                  <dt className="font-medium text-bo-foreground">{t("Chênh lệch")}</dt>
                  <dd className={cn("m-0 text-right font-semibold tabular-nums", Number(dc.chenhLech) === 0 ? "text-bo-success" : "text-bo-warning")}>
                    {tien(dc.chenhLech)}
                  </dd>
                </dl>
                {Number(dc.chenhLech) !== 0 ? (
                  <p className="mt-2 text-xs text-bo-muted">{t("Chênh lệch khác 0 khi có đơn hoàn trả hoặc phiếu trả tại quầy mà kế toán lập tay (đơn hoàn trả trước 14/11/2026, phiếu trả trước khi có chức năng tự dựng).")}</p>
                ) : null}
              </section>
            ) : null}

            {/* Điện thoại: thanh điều hướng đáy (56px, fixed) che đáy màn — dính phía trên nó */}
            <section className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 flex flex-wrap md:bottom-0 items-center gap-3 rounded-lg border border-bo-border bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(16,24,40,0.06)]">
              {xemTruoc.coTheTaoLo ? (
                <>
                  <Input value={ghiChu} maxLength={500} onChange={(e) => setGhiChu(e.target.value)} placeholder={t("Ghi chú cho lô (không bắt buộc)")}
                    aria-label={t("Ghi chú cho lô")} className="h-9 min-w-[220px] flex-1 border-bo-border bg-white text-sm" />
                  <Button onClick={() => setMoXacNhan(true)} disabled={dangTao} className={NUT_CHINH}>
                    <Download className="size-4" aria-hidden="true" />
                    {t("Tạo lô và tải tệp")}
                  </Button>
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm text-bo-muted">
                  <Info className="size-4 shrink-0" aria-hidden="true" />
                  {xemTruoc.lyDoKhongTheTao}
                </p>
              )}
            </section>
          </>
        )
      ) : loiLo ? (
        <ErrorState className="min-h-48" title={t("Lỗi tải danh sách lô")} description={loiLo} onRetry={taiDanhSachLo} />
      ) : dsLo === null ? (
        <LoadingState className="min-h-48" label={t("Đang tải danh sách lô")} />
      ) : dsLo.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title={t("Chưa có lô nào")} description={t("Tạo lô ở tab Tạo lô. Mỗi lô giữ đúng tệp đã giao kế toán để tải lại.")} />
      ) : (
        <TableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className={cn(TH, "w-8")}><span className="sr-only">{t("Mở rộng")}</span></th>
                  <th className={TH}>{t("Số lô", { context: "ke_toan" })}</th>
                  <th className={TH}>{t("Tạo lúc")}</th>
                  <th className={TH}>{t("Chứng từ đến hết")}</th>
                  <th className={cn(TH, "text-right")}>{t("Chứng từ")}</th>
                  <th className={cn(TH, "text-right")}>{t("Tiền khách trả")}</th>
                  <th className={TH}>{t("Tệp")}</th>
                  <th className={cn(TH, "w-[150px]")}><span className="sr-only">{t("Thao tác")}</span></th>
                </tr>
              </thead>
              <tbody>
                {dsLo.map((lo) => (
                  <Fragment key={lo.id}>
                    <tr className="border-b border-slate-100">
                      <td className={TD}>
                        <button type="button" aria-label={loMo === lo.id ? t("Thu gọn lô {{soLo}}", { soLo: lo.soLo }) : t("Xem chứng từ của lô {{soLo}}", { soLo: lo.soLo })}
                          aria-expanded={loMo === lo.id} onClick={() => setLoMo((m) => (m === lo.id ? null : lo.id))} className={NUT_ICON}>
                          {loMo === lo.id ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                        </button>
                      </td>
                      <td className={cn(TD, "font-medium")}>
                        <span className={cn("whitespace-nowrap", lo.trangThai === "da_huy" && "text-bo-muted line-through")}>{lo.soLo}</span>
                        {lo.trangThai === "da_huy" ? <span className="ml-2 rounded-[3px] bg-bo-danger-soft px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-bo-danger">{t("Đã hủy")}</span> : null}
                        {lo.coTonDauKy ? <span className="ml-2 rounded-[3px] bg-bo-primary-soft px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-bo-primary">{t("Có tồn đầu kỳ")}</span> : null}
                        {lo.ghiChu ? <span className="block text-xs font-normal text-bo-muted">{lo.ghiChu}</span> : null}
                        {lo.trangThai === "da_huy" ? (
                          <span className="block text-xs font-normal text-bo-muted">
                            {t("Hủy lúc {{luc}}", { luc: formatDateTime(lo.huyLuc) })}{lo.nguoiHuy ? ` — ${lo.nguoiHuy}` : ""}
                            {lo.lyDoHuy ? <span className="block">{lo.lyDoHuy}</span> : null}
                          </span>
                        ) : null}
                      </td>
                      <td className={cn(TD, "tabular-nums")}>{formatDateTime(lo.ngayTao)}<span className="block text-xs text-bo-muted">{lo.nguoiTao}</span></td>
                      <td className={cn(TD, "tabular-nums")}>{hienNgay(lo.denNgay)}</td>
                      <td className={cn(TD, SO)}>{lo.soChungTu}</td>
                      <td className={cn(TD, SO)}>{Number(lo.tongCong) ? tien(lo.tongCong) : "—"}</td>
                      <td className={TD}>
                        <span className="block text-xs whitespace-nowrap">{lo.tenTep} · {dinhDangKichThuoc(lo.kichThuoc)}</span>
                        <span className="flex items-center gap-1 text-[11px] text-bo-muted" title={lo.maBam}>
                          {t("Mã kiểm tra tệp")} <span className="font-mono">{lo.maBam?.slice(0, 12)}…</span>
                          <NutSaoChep giaTri={lo.maBam} nhan={t("Sao chép mã kiểm tra tệp của lô {{soLo}}", { soLo: lo.soLo })} />
                        </span>
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <div className="flex flex-col items-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => taiTep(lo)} disabled={dangTai === lo.id} className={NUT_PHU}
                            aria-label={t("Tải tệp của lô {{soLo}}", { soLo: lo.soLo })}
                            title={lo.trangThai === "da_huy" ? t("Lô đã hủy: tệp chỉ để đối chiếu, không nhập lại vào AMIS") : undefined}>
                            {dangTai === lo.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                            {t("Tải tệp")}
                          </Button>
                          {loHuyDuoc?.id === lo.id ? (
                            <button type="button" onClick={() => setHuyLo(lo)} aria-label={t("Hủy lô {{soLo}}", { soLo: lo.soLo })}
                              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-bo-danger hover:bg-bo-danger-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary">
                              <Ban className="size-3.5" aria-hidden="true" />{t("Hủy lô")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {loMo === lo.id ? (
                      <tr className="border-b border-bo-border bg-bo-surface-subtle">
                        <td colSpan={8} className="p-0">
                          {/* Mở khóa làm kết quả kiểm tra ở tab Tạo lô cũ đi: bỏ để người dùng kiểm tra lại */}
                          <ChungTuCuaLo lo={lo} onDaMoKhoa={() => setXemTruoc(null)} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </TableShell>
      )}

      {huyLo ? (
        <HopHuyLo
          lo={huyLo}
          onDong={() => setHuyLo(null)}
          onLoiXungDot={() => {
            setXemTruoc(null);
            taiDanhSachLo();
          }}
          onXong={(kq) => {
            setDsLo((cu) => (cu ? cu.map((l) => (l.id === kq.id ? kq : l)) : cu));
            setHuyLo(null);
            // Chứng từ của lô quay về chưa xuất: kết quả kiểm tra cũ ở tab Tạo lô không còn đúng
            setXemTruoc(null);
            if (loMo === kq.id) setLoMo(null);
          }}
        />
      ) : null}

      <ConfirmModal
        isOpen={moXacNhan}
        onClose={() => !dangTao && setMoXacNhan(false)}
        onConfirm={taoLo}
        variant="info"
        isLoading={dangTao}
        title={t("Tạo lô xuất kế toán")}
        description={tong ? t("Lô gồm {{soChungTu}} chứng từ đến hết {{denNgay}}. Tạo xong, các chứng từ này bị khóa (không vào lô khác, hóa đơn nhà cung cấp không sửa được) và tệp nén được lưu để tải lại.", { soChungTu: tong.soChungTu, denNgay: hienNgay(xemTruoc?.denNgay), count: Number(tong.soChungTu) }) : ""}
        confirmText={t("Tạo lô")}
        cancelText={t("Quay lại")}
      />
    </PageContainer>
  );
}
