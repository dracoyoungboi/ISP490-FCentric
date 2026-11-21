import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import purchaseRequestService from "@/services/purchaseRequestService";
import { toast } from "@/lib/thongBaoNhanh";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatNumber, formatCurrency } from "@/utils/formatters";
import { t } from "@/i18n";

function defaultDeliveryDateStr(items) {
  const maxLead = items.reduce((acc, it) => Math.max(acc, Number(it.leadTimeAvg || 5)), 5);
  const d = new Date(Date.now() + Math.ceil(maxLead) * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function DssCreatePrModal({
  open,
  onOpenChange,
  khoTong,
  selectedItems,
  qtyMap,
  onSuccess,
}) {
  const navigate = useNavigate();
  const [ngayGiao, setNgayGiao] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNgayGiao(defaultDeliveryDateStr(selectedItems));
      setGhiChu(t("Đề xuất tự động từ hệ thống gợi ý nhập hàng (DSS)"));
    }
  }, [open, selectedItems]);

  const validLines = selectedItems
    .filter((it) => !it.prCreationLocked && Number(qtyMap[it.bienTheSanPhamId] ?? it.suggestedOrderQty) > 0)
    .map((it) => ({
      item: it,
      qty: Number(qtyMap[it.bienTheSanPhamId] ?? it.suggestedOrderQty),
    }));

  const totalUnits = validLines.reduce((acc, l) => acc + l.qty, 0);
  const estimatedValue = validLines.reduce(
    (acc, l) => acc + l.qty * Number(l.item.donGiaNhapGanNhat || 0),
    0,
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!khoTong?.id) {
      toast.error(t("Chưa xác định được Kho tổng nhận hàng."));
      return;
    }
    if (validLines.length === 0) {
      toast.error(t("Chọn ít nhất 1 sản phẩm có số lượng đặt lớn hơn 0."));
      return;
    }
    if (!ngayGiao) {
      toast.error(t("Vui lòng chọn ngày giao dự kiến."));
      return;
    }

    setSubmitting(true);
    try {
      const deliveryIso = new Date(`${ngayGiao}T17:00:00`).toISOString();
      const res = await purchaseRequestService.create({
        khoNhapId: khoTong.id,
        ngayGiaoDuKien: deliveryIso,
        ghiChu: ghiChu.trim(),
        chiTietYeuCauMuaHangs: validLines.map((l) => ({
          bienTheSanPhamId: l.item.bienTheSanPhamId,
          soLuongDat: l.qty,
        })),
      });
      const created = res?.data?.data;
      toast.success(t("Đã tạo yêu cầu nhập hàng {{ma}}", { ma: created?.soYeuCauMuaHang || "" }));
      onOpenChange(false);
      onSuccess?.(created);
      if (created?.id) {
        navigate(`/purchase-requests/${created.id}`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("Không tạo được yêu cầu nhập hàng.")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Xác nhận tạo yêu cầu nhập hàng từ DSS")}</DialogTitle>
          <DialogDescription>
            {t("Nhập về {{kho}} với {{soMa}} mã hàng và tổng {{tong}} sản phẩm.", {
              kho: khoTong?.tenKho || t("Kho tổng"),
              soMa: validLines.length,
              tong: formatNumber(totalUnits),
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-56 overflow-y-auto rounded-md border border-bo-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-bo-border bg-bo-surface-subtle text-bo-muted">
                <tr>
                  <th className="px-3 py-2">{t("Mã SKU")}</th>
                  <th className="px-3 py-2">{t("Sản phẩm")}</th>
                  <th className="px-3 py-2 text-right">{t("Số lượng đặt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {validLines.map(({ item, qty }) => (
                  <tr key={item.bienTheSanPhamId}>
                    <td className="px-3 py-1.5 font-mono text-slate-700">{item.maSku}</td>
                    <td className="px-3 py-1.5 text-bo-heading">{item.tenSanPham}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatNumber(qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {estimatedValue > 0 ? (
            <p className="text-xs text-bo-muted">
              {t("Giá trị nhập ước tính theo giá vốn gần nhất")}:{" "}
              <strong className="text-bo-heading">{formatCurrency(estimatedValue)}</strong>
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="dss-pr-date">{t("Ngày giao dự kiến")}</Label>
              <Input
                id="dss-pr-date"
                type="date"
                value={ngayGiao}
                onChange={(e) => setNgayGiao(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t("Kho nhận hàng")}</Label>
              <Input value={khoTong?.tenKho || t("Kho tổng")} disabled />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="dss-pr-note">{t("Ghi chú yêu cầu")}</Label>
            <Textarea
              id="dss-pr-note"
              rows={2}
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              maxLength={450}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("Hủy")}
            </Button>
            <Button type="submit" disabled={submitting || validLines.length === 0}>
              {submitting ? t("Đang tạo yêu cầu…") : t("Tạo yêu cầu nhập")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
