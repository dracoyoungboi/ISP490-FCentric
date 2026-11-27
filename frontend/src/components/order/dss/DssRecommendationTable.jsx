import { AlertTriangle, Lock } from "lucide-react";
import TableShell from "@/components/shared/TableShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { formatNumber } from "@/utils/formatters";

const NHAN_KICH_BAN = {
  PRESET_01_STANDARD: t("Hoạt động chuẩn"),
  PRESET_02_PEAK: t("Cao điểm"),
  PRESET_03_LEAN: t("Tiết kiệm vốn"),
  PRESET_04_PHASE_OUT: t("Ngừng nhập"),
};

const BADGE_URGENCY = {
  CRITICAL: { label: t("Cần nhập gấp"), cls: "border-red-200 bg-red-50 text-red-700" },
  HIGH: { label: t("Chạm ngưỡng ROP"), cls: "border-amber-200 bg-amber-50 text-amber-800" },
  NORMAL: { label: t("An toàn"), cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  EXCESS_OR_PHASE_OUT: { label: t("Ngừng nhập / Xả tồn"), cls: "border-slate-300 bg-slate-100 text-slate-700" },
};

const BADGE_ABC = {
  A: "bg-indigo-100 text-indigo-800 border-indigo-200",
  B: "bg-sky-100 text-sky-800 border-sky-200",
  C: "bg-slate-100 text-slate-700 border-slate-200",
};

function formatNgay(iso) {
  if (!iso) return "—";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Bảng chi tiết đề xuất nhập hàng Màn 1: tick chọn SKU (khóa nếu Phase-Out), sửa tay số lượng đặt Q trước khi mở Modal tạo PR
export default function DssRecommendationTable({
  items,
  loading,
  selectedIds,
  customQtyMap,
  onToggleSelect,
  onToggleAll,
  onChangeQty,
  canCreatePr,
}) {
  const selectable = items.filter((it) => !it.prCreationLocked && Number(it.suggestedOrderQty) > 0);
  const allSelected = selectable.length > 0 && selectable.every((it) => selectedIds.has(it.bienTheSanPhamId));

  return (
    <TableShell
      loading={loading}
      isEmpty={!loading && items.length === 0}
      emptyTitle={t("Chưa có dữ liệu đề xuất cho bộ lọc hiện tại")}
      emptyDescription={t("Thử đổi bộ lọc hoặc bấm Tính toán lại để trích xuất dữ liệu mới.")}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b border-bo-border bg-bo-surface-subtle text-xs font-medium text-bo-muted">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                {canCreatePr ? (
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onToggleAll(Boolean(checked), selectable)}
                    aria-label={t("Chọn tất cả mã cần nhập")}
                  />
                ) : null}
              </th>
              <th className="px-3 py-3">{t("Sản phẩm / SKU")}</th>
              <th className="px-2.5 py-3 text-center">{t("ABC")}</th>
              <th className="px-2.5 py-3 text-right" title={t("Tổng tồn khả dụng trên toàn bộ kho đang hoạt động")}>{t("Khả dụng")}</th>
              <th className="px-2.5 py-3 text-right" title={t("Tổng hàng đang về từ đơn mua trên toàn hệ thống")}>{t("Đang về")}</th>
              <th className="px-2.5 py-3 text-right">{t("Bán/ngày")}</th>
              <th className="px-2.5 py-3 text-right">{t("Lead Time")}</th>
              <th className="px-2.5 py-3 text-right">{t("SS / ROP")}</th>
              <th className="px-2.5 py-3 text-right">{t("DOI (ngày)")}</th>
              <th className="px-2.5 py-3">{t("Hạn đặt / Cạn hàng")}</th>
              <th className="px-2.5 py-3">{t("Mức độ & Kịch bản")}</th>
              <th className="px-3 py-3 text-right">{t("Số lượng đặt Q")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bo-border">
            {items.map((it) => {
              const id = it.bienTheSanPhamId;
              const checked = selectedIds.has(id);
              const badge = BADGE_URGENCY[it.urgencyLevel] || BADGE_URGENCY.NORMAL;
              const qtyVal = customQtyMap[id] ?? it.suggestedOrderQty;
              const locked = Boolean(it.prCreationLocked);

              return (
                <tr key={id} className={cn("hover:bg-bo-surface-subtle/60", checked && "bg-blue-50/40")}>
                  <td className="px-3 py-2.5 text-center align-top">
                    {canCreatePr ? (
                      locked ? (
                        <span title={t("Đang khóa tạo yêu cầu nhập ở kịch bản Ngừng nhập")} className="inline-flex text-slate-400">
                          <Lock className="size-4" aria-hidden="true" />
                        </span>
                      ) : (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggleSelect(id, it.suggestedOrderQty)}
                          aria-label={t("Chọn {{sku}}", { sku: it.maSku })}
                        />
                      )
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="min-w-0">
                      <p className="font-medium text-bo-heading">{it.tenSanPham}</p>
                      <p className="text-xs text-bo-muted">
                        <span className="font-mono text-slate-700">{it.maSku}</span>
                        {it.tenMau || it.tenSize ? ` · ${[it.tenMau, it.tenSize].filter(Boolean).join(" / ")}` : ""}
                      </p>
                      {it.openPrCode ? (
                        <p className="mt-0.5 text-[11px] font-medium text-bo-primary">
                          {t("Đã có phiếu chờ {{ma}}", { ma: it.openPrCode })}
                        </p>
                      ) : null}
                      {it.flashSaleRecommended ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <AlertTriangle className="size-3" aria-hidden="true" />
                          {it.excessStock > 0
                            ? t("Gợi ý Flash Sale xả {{n}} sản phẩm dư", { n: formatNumber(it.excessStock) })
                            : t("Hàng bán chậm / tồn lâu ngày")}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-center align-top">
                    <span
                      className={cn(
                        "inline-flex min-w-6 items-center justify-center rounded border px-1.5 py-0.5 text-xs font-semibold",
                        BADGE_ABC[it.abcClass] || BADGE_ABC.C,
                      )}
                      title={t("Tỷ trọng doanh thu: {{pct}}%", { pct: it.revenueSharePercent })}
                    >
                      {it.abcClass}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-top tabular-nums">
                    <span className={cn("font-semibold", it.ftu <= 0 ? "text-red-600" : "text-bo-heading")}>
                      {formatNumber(it.ftu)}
                    </span>
                    <p className="text-[11px] text-bo-muted">
                      {t("Thực")}: {formatNumber(it.onHand)}
                    </p>
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-top tabular-nums text-bo-foreground">
                    {formatNumber(it.incoming)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-top tabular-nums">
                    <span className="font-medium text-bo-heading">{it.avgDailyDemand}</span>
                    <p className="text-[11px] text-bo-muted">
                      {t("Đỉnh")}: {it.maxDailyDemand}
                    </p>
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-top tabular-nums">
                    <span>{it.leadTimeAvg}d</span>
                    <p className="text-[11px] text-bo-muted">Max: {it.leadTimeMax}d</p>
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-top tabular-nums">
                    <span className="font-semibold text-bo-heading">{formatNumber(it.reorderPoint)}</span>
                    <p className="text-[11px] text-bo-muted">SS: {formatNumber(it.safetyStock)}</p>
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-top tabular-nums">
                    {it.daysOfInventory !== null && it.daysOfInventory !== undefined ? `${it.daysOfInventory}d` : "—"}
                  </td>
                  <td className="px-2.5 py-2.5 align-top text-xs">
                    <p className="text-bo-heading">{t("Đặt trễ nhất")}: {formatNgay(it.latestOrderDate)}</p>
                    <p className="text-bo-muted">{t("Dự kiến hết")}: {formatNgay(it.estimatedStockoutDate)}</p>
                  </td>
                  <td className="px-2.5 py-2.5 align-top">
                    <span className={cn("inline-flex rounded border px-2 py-0.5 text-xs font-medium", badge.cls)}>
                      {badge.label}
                    </span>
                    <p className="mt-1 text-[11px] text-bo-muted">
                      {NHAN_KICH_BAN[it.appliedPreset] || it.appliedPreset}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right align-top">
                    {locked ? (
                      <span className="text-xs font-medium text-slate-500">0</span>
                    ) : canCreatePr ? (
                      <Input
                        type="number"
                        min={0}
                        value={qtyVal}
                        onChange={(e) => onChangeQty(id, Math.max(0, parseInt(e.target.value || "0", 10)))}
                        className="ml-auto h-8 w-20 text-right tabular-nums"
                        aria-label={t("Số lượng đặt {{sku}}", { sku: it.maSku })}
                      />
                    ) : (
                      <span className="font-semibold tabular-nums text-bo-heading">
                        {formatNumber(it.suggestedOrderQty)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}
