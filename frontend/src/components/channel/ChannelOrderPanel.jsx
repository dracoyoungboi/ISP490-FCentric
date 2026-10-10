import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Calendar, CheckCheck, Hash, Loader2, PackagePlus, RefreshCcw, User, XCircle } from "lucide-react";
import { toast } from "sonner";

import SurfaceCard from "@/components/shared/SurfaceCard";
import InfoItem from "@/components/shared/InfoItem";
import StatusBadge from "@/components/shared/StatusBadge";
import ErrorState from "@/components/shared/ErrorState";
import ChannelBadge from "@/components/channel/ChannelBadge";
import FlagList from "@/components/channel/FlagList";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { donBanHangKenhService } from "@/services/donBanHangKenhService";
import { FLAG_META, HOLD_STATUS } from "@/constants/channel";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasAnyRole, ROLES } from "@/utils/roles";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/dateTime";

const TH_CLASS = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const textareaClass =
  "resize-none border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";


/**
 * Khối "Thông tin kênh" trên chi tiết đơn sàn (S-OC-06): mã đơn sàn, trạng thái sàn, cờ, giữ chỗ theo lô
 * và các thao tác theo `hanhDong` do backend tính (GET /api/v1/don-ban-hang/{id}/kenh).
 * Thao tác chỉ dành cho quản trị viên và quản lý kho của đơn (BR-OC-01); backend kiểm lại theo kho.
 */
export default function ChannelOrderPanel({ donBanHang, onChanged }) {
  const id = donBanHang?.id;
  const canAct = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [lyDoError, setLyDoError] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagForm, setFlagForm] = useState({ co: "", ghiChu: "" });
  const [flagError, setFlagError] = useState("");
  const busyRef = useRef(false);

  const fetchInfo = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    try {
      setInfo(await donBanHangKenhService.getThongTinKenh(id));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => fetchInfo());
  }, [fetchInfo]);

  const run = async (name, fn, successMessage) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(name);
    try {
      await fn();
      toast.success(successMessage);
      await fetchInfo();
      onChanged?.();
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error, "Không thực hiện được thao tác");
      if (name === "huy" && error?.response?.status === 400) setLyDoError(message);
      else if (name === "co" && error?.response?.status === 400) setFlagError(message);
      else toast.error(message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const confirmCancel = async () => {
    const ok = await run("huy", () => donBanHangKenhService.xacNhanHuy(id, { lyDo: lyDo.trim() || undefined }), "Đã hủy đơn theo sàn và nhả giữ chỗ");
    if (ok) {
      setCancelOpen(false);
      setLyDo("");
    }
  };

  const confirmApply = async () => {
    await run("ap-dung", () => donBanHangKenhService.apDungThayDoi(id), "Đã áp dụng thay đổi từ sàn");
    setApplyOpen(false);
  };

  const confirmFlag = async () => {
    if (!flagForm.co) {
      setFlagError("Chọn cờ đã xử lý.");
      return;
    }
    if (!flagForm.ghiChu.trim()) {
      setFlagError("Nhập ghi chú cách đã xử lý.");
      return;
    }
    const ok = await run(
      "co",
      () => donBanHangKenhService.xuLyCo(id, { co: flagForm.co, ghiChu: flagForm.ghiChu.trim() }),
      `Đã đánh dấu xử lý cờ ${FLAG_META[flagForm.co]?.label ?? flagForm.co}`,
    );
    if (ok) setFlagOpen(false);
  };

  const hanhDong = info?.hanhDong ?? {};
  const xuLyCo = Array.isArray(hanhDong.xuLyCo) ? hanhDong.xuLyCo : [];
  const hasActions = canAct && (hanhDong.xacNhanHuy || hanhDong.apDungThayDoi || hanhDong.giuBu || xuLyCo.length > 0);
  const giuCho = info?.giuCho ?? [];

  return (
    <SurfaceCard
      title="Thông tin kênh bán"
      description={info ? `${info.tenKenh ?? ""}${info.tenHienThi ? ` · ${info.tenHienThi}` : ""}` : "Đơn nhập về từ sàn thương mại điện tử"}
      action={<ChannelBadge maKenh={info?.maKenh ?? donBanHang?.kenhBanHang?.maKenh} label={info?.tenKenh} />}
    >
      {loading && !info ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-bo-muted">
          <Loader2 className="size-4 animate-spin" /> Đang tải thông tin kênh
        </div>
      ) : failed && !info ? (
        <ErrorState className="min-h-40" description="Không tải được thông tin kênh của đơn." onRetry={fetchInfo} />
      ) : info ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoItem icon={Hash} label="Mã đơn trên sàn" value={info.maDonHangKenh ? <span className="font-mono">{info.maDonHangKenh}</span> : null} />
            <InfoItem icon={BadgeCheck} label="Trạng thái trên sàn" value={info.trangThaiSan} />
            <InfoItem icon={Calendar} label="Cập nhật từ sàn" value={formatDateTime(info.ngayCapNhatSan)} />
            <InfoItem
              icon={User}
              label="Khách hàng hệ thống"
              value={
                <span>
                  {donBanHang?.khachHang?.tenKhachHang || "—"}
                  <span className="mt-0.5 block text-xs font-normal text-bo-muted">Người mua trên sàn được ghi vào khách mặc định của gian hàng.</span>
                </span>
              }
            />
          </div>

          {info.canXuLy?.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">Cần xử lý</p>
              <FlagList value={info.canXuLy} />
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-bo-success">
              <CheckCheck className="size-4" /> Đơn không có cờ cần xử lý.
            </p>
          )}

          {hasActions ? (
            <div className="flex flex-wrap gap-2 border-t border-bo-border pt-4">
              {hanhDong.xacNhanHuy ? (
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setLyDo("");
                    setLyDoError("");
                    setCancelOpen(true);
                  }}
                  className="gap-1.5 border-bo-danger/40 bg-white text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                >
                  <XCircle className="size-4" /> Xác nhận hủy theo sàn
                </Button>
              ) : null}
              {hanhDong.apDungThayDoi ? (
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => setApplyOpen(true)}
                  className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  <RefreshCcw className="size-4" /> Áp dụng thay đổi từ sàn
                </Button>
              ) : null}
              {hanhDong.giuBu ? (
                <Button
                  disabled={Boolean(busy)}
                  onClick={() => run("giu-bu", () => donBanHangKenhService.giuBu(id), "Đã giữ bù phần còn thiếu")}
                  className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                >
                  {busy === "giu-bu" ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
                  Giữ bù
                </Button>
              ) : null}
              {xuLyCo.length > 0 ? (
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setFlagForm({ co: xuLyCo[0], ghiChu: "" });
                    setFlagError("");
                    setFlagOpen(true);
                  }}
                  className="gap-1.5 border-bo-warning/40 bg-white text-bo-warning hover:bg-bo-warning-soft hover:text-bo-warning"
                >
                  <CheckCheck className="size-4" /> Đánh dấu đã xử lý
                </Button>
              ) : null}
            </div>
          ) : null}

          {giuCho.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">Giữ chỗ theo lô</p>
              <div className="overflow-x-auto rounded-md border border-bo-border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                      <th className={`${TH_CLASS} text-left`}>SKU</th>
                      <th className={`${TH_CLASS} text-left`}>Lô</th>
                      <th className={`${TH_CLASS} text-right`}>Số lượng</th>
                      <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bo-border">
                    {giuCho.map((row, index) => {
                      const status = HOLD_STATUS[row.trangThai] ?? { label: row.trangThai, tone: "neutral" };
                      return (
                        <tr key={`${row.chiTietId}-${row.maLo}-${index}`}>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-bo-foreground">{row.maSku}</td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">{row.maLo}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-bo-foreground">{row.soLuong}</td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge label={status.label} tone={status.tone} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Xác nhận hủy theo sàn ── */}
      <Dialog open={cancelOpen} onOpenChange={(open) => !busy && setCancelOpen(open)}>
        <DialogContent className="rounded-xl border-bo-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bo-foreground">Xác nhận hủy theo sàn</DialogTitle>
            <DialogDescription className="text-slate-600">
              Sàn đã hủy đơn {donBanHang?.soDonHang}. Hệ thống sẽ gỡ đơn khỏi Pick List (nếu có), hủy phiếu xuất nháp,
              nhả giữ chỗ và chuyển đơn sang Đã hủy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="ly-do-huy" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Lý do</label>
            <Textarea
              id="ly-do-huy"
              rows={3}
              value={lyDo}
              onChange={(event) => {
                setLyDo(event.target.value);
                setLyDoError("");
              }}
              placeholder="Bắt buộc khi kết nối sàn không còn hoạt động"
              className={cn(textareaClass, lyDoError && "border-bo-danger")}
            />
            {lyDoError ? <p className="text-xs text-bo-danger">{lyDoError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setCancelOpen(false)}
              className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
            >
              Quay lại
            </Button>
            <Button
              type="button"
              disabled={Boolean(busy)}
              onClick={confirmCancel}
              className="min-w-[150px] gap-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy === "huy" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Áp dụng thay đổi từ sàn ── */}
      <ConfirmModal
        isOpen={applyOpen}
        onClose={() => !busy && setApplyOpen(false)}
        onConfirm={confirmApply}
        variant="info"
        title="Áp dụng thay đổi từ sàn"
        description="Hệ thống lấy lại đơn trên sàn, cập nhật số lượng từng dòng, nhả hoặc giữ thêm hàng cho khớp. Đơn đang trong Pick List cần gỡ khỏi Pick List trước."
        confirmText="Áp dụng"
        cancelText="Quay lại"
        isLoading={busy === "ap-dung"}
      />

      {/* ── Đánh dấu đã xử lý cờ ── */}
      <Dialog open={flagOpen} onOpenChange={(open) => !busy && setFlagOpen(open)}>
        <DialogContent className="rounded-xl border-bo-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bo-foreground">Đánh dấu đã xử lý</DialogTitle>
            <DialogDescription className="text-slate-600">Chọn cờ đã xử lý xong và ghi lại cách xử lý để đối soát sau này.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {xuLyCo.map((flag) => {
                const meta = FLAG_META[flag] ?? { label: flag, description: "" };
                const active = flagForm.co === flag;
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => setFlagForm((prev) => ({ ...prev, co: flag }))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active ? "border-bo-primary bg-bo-primary-soft" : "border-bo-border bg-white hover:bg-bo-surface-subtle",
                    )}
                  >
                    <span className={cn("mt-1 size-3 shrink-0 rounded-full border", active ? "border-bo-primary bg-bo-primary" : "border-slate-300")} />
                    <span>
                      <span className="block text-sm font-semibold text-bo-foreground">{meta.label}</span>
                      <span className="block text-xs text-bo-muted">{meta.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ghi-chu-co" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Ghi chú xử lý</label>
              <Textarea
                id="ghi-chu-co"
                rows={3}
                value={flagForm.ghiChu}
                onChange={(event) => {
                  setFlagForm((prev) => ({ ...prev, ghiChu: event.target.value }));
                  setFlagError("");
                }}
                placeholder="Ví dụ: Đã nhận lại hàng hoàn, nhập kho lô LO-2026-05"
                className={cn(textareaClass, flagError && "border-bo-danger")}
              />
              {flagError ? <p className="text-xs text-bo-danger">{flagError}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setFlagOpen(false)}
              className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
            >
              Quay lại
            </Button>
            <Button
              type="button"
              disabled={Boolean(busy)}
              onClick={confirmFlag}
              className="min-w-[140px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
            >
              {busy === "co" ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
              Lưu xử lý
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurfaceCard>
  );
}
