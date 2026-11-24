import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShoppingCart, Sparkles } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import MetricStrip from "@/components/shared/MetricStrip";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import { Button } from "@/components/ui/button";
import { VAI_TRO_TAO_YEU_CAU_NHAP } from "@/constants/vaiTroTheoNghiepVu";
import { t } from "@/i18n";
import { toast } from "@/lib/thongBaoNhanh";
import dssService from "@/services/dssService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatNumber } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";
import DssScenarioCards from "@/components/order/dss/DssScenarioCards";
import DssParameterPanel from "@/components/order/dss/DssParameterPanel";
import DssRecommendationTable from "@/components/order/dss/DssRecommendationTable";
import DssCreatePrModal from "@/components/order/dss/DssCreatePrModal";
import { simulateDssItem } from "@/components/order/dss/dssFormula";

const VAI_TRO_SUA_CAU_HINH_DSS = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_KHO,
  ROLES.NHAN_VIEN_MUA_HANG,
];

function summarizeItems(items) {
  let criticalCount = 0;
  let highCount = 0;
  let normalCount = 0;
  let phaseOutOrExcessCount = 0;
  let needReorderCount = 0;
  let totalSuggestedQty = 0;
  let classACount = 0;
  let classBCount = 0;
  let classCCount = 0;

  for (const it of items) {
    if (it.abcClass === "A") classACount++;
    else if (it.abcClass === "B") classBCount++;
    else classCCount++;

    if (it.urgencyLevel === "CRITICAL") criticalCount++;
    else if (it.urgencyLevel === "HIGH") highCount++;
    else if (it.urgencyLevel === "EXCESS_OR_PHASE_OUT") phaseOutOrExcessCount++;
    else normalCount++;

    if (it.needsReorder) {
      needReorderCount++;
      totalSuggestedQty += Number(it.suggestedOrderQty || 0);
    }
  }
  return {
    totalSkus: items.length,
    criticalCount,
    highCount,
    normalCount,
    phaseOutOrExcessCount,
    needReorderCount,
    totalSuggestedQty,
    classACount,
    classBCount,
    classCCount,
  };
}

export default function DssReplenishmentPage() {
  const userRole = localStorage.getItem("role") || "";
  const canEditConfig = hasAnyRole([userRole], VAI_TRO_SUA_CAU_HINH_DSS);
  const canCreatePr = hasAnyRole([userRole], VAI_TRO_TAO_YEU_CAU_NHAP);

  const [warehouses, setWarehouses] = useState([]);
  const [data, setData] = useState(null);
  const [draftConfig, setDraftConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState("NEED_REORDER");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [customQtyMap, setCustomQtyMap] = useState({});
  const [modalOpen, setModalOpen] = useState(false);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, recRes] = await Promise.all([
        dssService.getWarehouses(),
        dssService.getRecommendations(),
      ]);
      const whList = whRes?.data?.data ?? [];
      const payload = recRes?.data?.data ?? null;
      setWarehouses(payload?.includedWarehouses?.length ? payload.includedWarehouses : whList);
      if (payload) {
        setData(payload);
        setDraftConfig(payload.config);
        // Mặc định chọn các mã cần nhập (chưa bị khóa phase-out)
        const autoSelected = new Set();
        for (const it of payload.items || []) {
          if (it.needsReorder && !it.prCreationLocked) {
            autoSelected.add(it.bienTheSanPhamId);
          }
        }
        setSelectedIds(autoSelected);
        setCustomQtyMap({});
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("Không tải được gợi ý nhập hàng.")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const hasConfigChanges = useMemo(() => {
    if (!data?.config || !draftConfig) return false;
    return JSON.stringify(data.config) !== JSON.stringify(draftConfig);
  }, [data, draftConfig]);

  // Tính toán xem trước tức thời khi người dùng đang chỉnh tham số hoặc đổi kịch bản
  const displayItems = useMemo(() => {
    const raw = data?.items ?? [];
    if (!hasConfigChanges || !draftConfig) return raw;
    return raw.map((it) => simulateDssItem(it, draftConfig));
  }, [data, draftConfig, hasConfigChanges]);

  const displaySummary = useMemo(() => summarizeItems(displayItems), [displayItems]);

  const tabCounts = useMemo(() => {
    let need = 0;
    let crit = 0;
    let high = 0;
    let abcA = 0;
    let phaseOut = 0;
    for (const it of displayItems) {
      if (it.needsReorder) need++;
      if (it.urgencyLevel === "CRITICAL") crit++;
      if (it.urgencyLevel === "HIGH") high++;
      if (it.abcClass === "A") abcA++;
      if (it.urgencyLevel === "EXCESS_OR_PHASE_OUT" || it.deadStock) phaseOut++;
    }
    return {
      ALL: displayItems.length,
      NEED_REORDER: need,
      CRITICAL: crit,
      HIGH: high,
      ABC_A: abcA,
      DEAD_OR_PHASE_OUT: phaseOut,
    };
  }, [displayItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayItems.filter((it) => {
      if (tab === "NEED_REORDER" && !it.needsReorder) return false;
      if (tab === "CRITICAL" && it.urgencyLevel !== "CRITICAL") return false;
      if (tab === "HIGH" && it.urgencyLevel !== "HIGH") return false;
      if (tab === "ABC_A" && it.abcClass !== "A") return false;
      if (tab === "DEAD_OR_PHASE_OUT" && it.urgencyLevel !== "EXCESS_OR_PHASE_OUT" && !it.deadStock) return false;
      if (q) {
        const hay = `${it.tenSanPham || ""} ${it.maSku || ""} ${it.maSanPham || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [displayItems, tab, search]);

  async function handleSaveAndRecalc() {
    if (!draftConfig) return;
    setSaving(true);
    try {
      const res = await dssService.updateConfig({
        ...draftConfig,
        khoId: targetKhoTong?.id ?? null,
        recalculateNow: true,
      });
      const payload = res?.data?.data ?? null;
      if (payload) {
        setData(payload);
        setDraftConfig(payload.config);
        setCustomQtyMap({});
        const autoSelected = new Set();
        for (const it of payload.items || []) {
          if (it.needsReorder && !it.prCreationLocked) {
            autoSelected.add(it.bienTheSanPhamId);
          }
        }
        setSelectedIds(autoSelected);
      }
      toast.success(t("Đã lưu tham số và cập nhật ngưỡng cảnh báo tồn thấp."));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("Không lưu được tham số gợi ý nhập hàng.")));
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculateOnly() {
    setSaving(true);
    try {
      const res = await dssService.recalculate(targetKhoTong?.id ?? null);
      const payload = res?.data?.data ?? null;
      if (payload) {
        setData(payload);
        setDraftConfig(payload.config);
      }
      toast.success(t("Đã tính toán lại tồn an toàn và ngưỡng đặt hàng từ dữ liệu mới nhất."));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("Không tính lại được gợi ý nhập hàng.")));
    } finally {
      setSaving(false);
    }
  }

  function handleToggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleAll(checked, visibleSelectable) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const it of visibleSelectable) {
        if (checked) next.add(it.bienTheSanPhamId);
        else next.delete(it.bienTheSanPhamId);
      }
      return next;
    });
  }

  const selectedItems = useMemo(
    () => displayItems.filter((it) => selectedIds.has(it.bienTheSanPhamId) && !it.prCreationLocked),
    [displayItems, selectedIds],
  );

  // Yêu cầu nhập hàng luôn gửi về Kho tổng
  const centralWarehouses = useMemo(
    () => warehouses.filter((w) => w.laKhoTong),
    [warehouses],
  );
  const targetKhoTong = useMemo(
    () => centralWarehouses[0] || null,
    [centralWarehouses],
  );
  const includedWarehouses = data?.includedWarehouses ?? warehouses;
  const soKhoHoatDong = data?.includedWarehouseCount || includedWarehouses.length;
  const tenCacKho = includedWarehouses.map((w) => w.tenKho).filter(Boolean).join(", ");

  const metricItems = [
    {
      label: t("Tổng SKU đang bán"),
      value: formatNumber(displaySummary.totalSkus),
      hint: t("A: {{a}} · B: {{b}} · C: {{c}}", {
        a: displaySummary.classACount,
        b: displaySummary.classBCount,
        c: displaySummary.classCCount,
      }),
    },
    {
      label: t("Cần nhập gấp"),
      value: formatNumber(displaySummary.criticalCount),
      tone: displaySummary.criticalCount > 0 ? "danger" : undefined,
      hint: t("DOI nhỏ hơn Lead Time nhà cung cấp"),
    },
    {
      label: t("Chạm ngưỡng ROP"),
      value: formatNumber(displaySummary.highCount),
      tone: displaySummary.highCount > 0 ? "warning" : undefined,
      hint: t("Tổng tồn khả dụng toàn hệ thống thấp hơn hoặc bằng ROP"),
    },
    {
      label: t("Tổng đề xuất đặt Q"),
      value: formatNumber(displaySummary.totalSuggestedQty),
      hint: t("{{n}} mã cần bổ sung hàng", { n: displaySummary.needReorderCount }),
    },
    {
      label: t("Ngừng nhập / Xả tồn"),
      value: formatNumber(displaySummary.phaseOutOrExcessCount),
      hint: t("SKU chậm bán trên 30 ngày hoặc đang xả hàng"),
    },
  ];

  const tabs = [
    { value: "NEED_REORDER", label: t("Cần đặt hàng"), count: tabCounts.NEED_REORDER, tone: "warning" },
    { value: "CRITICAL", label: t("Nhập gấp"), count: tabCounts.CRITICAL, tone: "danger" },
    { value: "HIGH", label: t("Chạm ngưỡng ROP"), count: tabCounts.HIGH, tone: "warning" },
    { value: "ABC_A", label: t("Nhóm A (70%)"), count: tabCounts.ABC_A },
    { value: "DEAD_OR_PHASE_OUT", label: t("Tồn chậm / Ngừng nhập"), count: tabCounts.DEAD_OR_PHASE_OUT },
    { value: "ALL", label: t("Tất cả SKU"), count: tabCounts.ALL },
  ];

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={t("Gợi ý nhập hàng")}
        actions={
          <>
            {soKhoHoatDong > 0 ? (
              <span
                title={tenCacKho || undefined}
                aria-label={t("Phạm vi tính gợi ý")}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-bo-border bg-bo-surface-subtle px-3 text-xs font-medium text-bo-heading"
              >
                {t("Toàn hệ thống ({{count}} kho)", { count: soKhoHoatDong })}
              </span>
            ) : null}

            {canEditConfig ? (
              <Button type="button" variant="outline" onClick={handleRecalculateOnly} disabled={loading || saving}>
                <RefreshCw className={saving ? "mr-1.5 size-4 animate-spin" : "mr-1.5 size-4"} aria-hidden="true" />
                {t("Tính toán lại")}
              </Button>
            ) : null}

            {canCreatePr ? (
              <Button
                type="button"
                disabled={selectedItems.length === 0 || !targetKhoTong}
                onClick={() => setModalOpen(true)}
              >
                <ShoppingCart className="mr-1.5 size-4" aria-hidden="true" />
                {t("Tạo yêu cầu nhập ({{n}})", { n: selectedItems.length })}
              </Button>
            ) : null}
          </>
        }
      />

      {hasConfigChanges ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            {t("Đang xem trước mô phỏng theo kịch bản mới. Bấm Lưu & Tính lại ROP để cập nhật ngưỡng cảnh báo hệ thống.")}
          </span>
          {canEditConfig ? (
            <Button type="button" size="sm" onClick={handleSaveAndRecalc} disabled={saving}>
              {t("Lưu & Tính lại ROP")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <MetricStrip items={metricItems} loading={loading} label={t("Tổng quan gợi ý nhập hàng")} />

      <DssScenarioCards
        mode={draftConfig?.mode || "BY_ABC_CLASS"}
        globalPresetCode={draftConfig?.globalPresetCode || "PRESET_01_STANDARD"}
        disabled={!canEditConfig || saving || loading}
        onSelectMode={(nextMode) => setDraftConfig((prev) => ({ ...(prev || {}), mode: nextMode }))}
        onSelectPreset={(code) => setDraftConfig((prev) => ({ ...(prev || {}), globalPresetCode: code }))}
      />

      <DssParameterPanel
        draftConfig={draftConfig}
        onChange={setDraftConfig}
        onSaveAndRecalc={handleSaveAndRecalc}
        onReset={() => setDraftConfig(data?.config || null)}
        saving={saving}
        canEdit={canEditConfig}
        hasChanges={hasConfigChanges}
      />

      <div className="rounded-lg border border-bo-border bg-bo-surface shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bo-border px-4">
          <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="py-2 sm:w-72">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder={t("Tìm theo tên sản phẩm hoặc mã SKU…")}
            />
          </div>
        </div>

        <DssRecommendationTable
          items={filteredItems}
          loading={loading}
          selectedIds={selectedIds}
          customQtyMap={customQtyMap}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          onChangeQty={(id, nextQty) => setCustomQtyMap((prev) => ({ ...prev, [id]: nextQty }))}
          canCreatePr={canCreatePr}
        />
      </div>

      <DssCreatePrModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        khoTong={targetKhoTong}
        dsKhoTong={centralWarehouses}
        selectedItems={selectedItems}
        qtyMap={customQtyMap}
        onSuccess={() => loadRecommendations()}
      />
    </PageContainer>
  );
}
