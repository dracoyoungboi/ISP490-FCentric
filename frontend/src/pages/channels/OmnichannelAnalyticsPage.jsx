import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, Check, RefreshCw, ShieldAlert } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import MetricStrip from "@/components/shared/MetricStrip";
import NutGiaiThich from "@/components/shared/NutGiaiThich";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { chuanHoaKenhBaoCao, layKenhTuSearchParams } from "@/components/channel/kenhBaoCaoDongBo";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import omnichannelAnalyticsService from "@/services/omnichannelAnalyticsService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatNumber } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";

const KENH_LOC = [
  { value: "ALL", label: t("Tất cả kênh") },
  { value: "SHOPIFY", label: "Shopify" },
  { value: "SHOPEE", label: "Shopee" },
  { value: "LAZADA", label: "Lazada" },
  { value: "TIKTOK", label: "TikTok Shop" },
];

function nhanSanChuan(code) {
  const norm = String(code || "").trim().toUpperCase();
  if (!norm) return t("Kênh bán");
  if (norm.includes("SHOPEE")) return "Shopee";
  if (norm.includes("TIKTOK")) return "TikTok Shop";
  if (norm.includes("LAZADA")) return "Lazada";
  if (norm.includes("SHOPIFY")) return "Shopify";
  if (norm === "POS") return t("Bán tại quầy (POS)");
  return code;
}

function chuanHoaGianHangVaSan(it) {
  const tenSan = nhanSanChuan(it.platformCode || it.maKenh);
  const rawName = String(it.tenKenh || "").trim();
  const tenGianHang = rawName || tenSan;
  return { tenGianHang, tenSan };
}

/**
 * Nút "i" cạnh tiêu đề (chốt 23/11): báo cáo đo mọi lần gọi API sàn (OmnichannelTelemetryInterceptor, cả đẩy tồn,
 * lấy đơn, sản phẩm) nên không nói "tỷ lệ cập nhật tồn". Nút áp dụng gợi ý chỉ hiện cho quản trị viên (isAdmin),
 * máy chủ cũng chỉ cho quản trị viên gọi apply-recommendations.
 */
function GiaiThichBaoCao() {
  return (
    <NutGiaiThich label={t("Báo cáo này cho biết gì")} tieuDe={t("Báo cáo đồng bộ kênh")}>
      <p className="text-bo-muted">
        {t("Theo dõi các lần FCentric trao đổi dữ liệu với sàn: đẩy tồn, lấy đơn, cập nhật sản phẩm.")}
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-[18px] text-bo-muted">
        <li>{t("Sàn phản hồi nhanh hay chậm, bao nhiêu lần thành công")}</li>
        <li>{t("Kênh nào đang lỗi và lỗi loại gì")}</li>
        <li>{t("Gợi ý giữ lại một phần tồn cho bán tại quầy")}</li>
      </ul>
      <p className="mt-2 text-xs text-bo-muted">{t("Chỉ quản trị viên áp dụng được gợi ý.")}</p>
    </NutGiaiThich>
  );
}

export default function OmnichannelAnalyticsPage() {
  const userRole = localStorage.getItem("role") || "";
  const isAdmin = hasAnyRole([userRole], [ROLES.QUAN_TRI_VIEN]);

  const [searchParams, setSearchParams] = useSearchParams();
  const channel = layKenhTuSearchParams(searchParams);
  const reqIdRef = useRef(0);

  const [range, setRange] = useState("24h");
  const [days, setDays] = useState(14);

  const [overview, setOverview] = useState(null);
  const [recData, setRecData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editMap, setEditMap] = useState({});

  const handleChannelChange = useCallback(
    (nextVal) => {
      const normalized = chuanHoaKenhBaoCao(nextVal);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("kenh");
          if (normalized === "ALL") {
            next.delete("channel");
          } else {
            next.set("channel", normalized);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const loadData = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const [ovRes, recRes] = await Promise.all([
        omnichannelAnalyticsService.getOverview(range, channel),
        omnichannelAnalyticsService.getSyncRecommendations(days, channel),
      ]);
      if (reqId !== reqIdRef.current) return;
      const ov = ovRes?.data?.data ?? null;
      const rc = recRes?.data?.data ?? null;
      setOverview(ov);
      setRecData(rc);

      const initialEdits = {};
      const autoChecked = new Set();
      for (const it of rc?.items ?? []) {
        initialEdits[it.mappingId] = {
          bufferPercent: it.recommendedBufferPercent,
          realtimeThreshold: it.recommendedRealtimeThreshold,
        };
        if (it.needsAdjustment) {
          autoChecked.add(it.mappingId);
        }
      }
      setEditMap(initialEdits);
      setSelectedIds(autoChecked);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      toast.error(getApiErrorMessage(err, t("Không tải được dữ liệu hiệu năng đồng bộ đa kênh.")));
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [range, channel, days]);

  useEffect(() => {
    loadData();
    return () => {
      reqIdRef.current += 1;
    };
  }, [loadData]);

  const recommendations = useMemo(() => recData?.items ?? [], [recData]);

  async function handleApplySelected() {
    const itemsToApply = [];
    for (const id of selectedIds) {
      const edits = editMap[id];
      if (!edits) continue;
      itemsToApply.push({
        mappingId: id,
        bufferPercent: Number(edits.bufferPercent ?? 0),
        realtimeThreshold: Number(edits.realtimeThreshold ?? 3),
      });
    }
    if (itemsToApply.length === 0) {
      toast.error(t("Chọn ít nhất 1 liên kết SKU để áp dụng cấu hình."));
      return;
    }

    setApplying(true);
    try {
      const res = await omnichannelAnalyticsService.applyRecommendations(itemsToApply);
      toast.success(res?.data?.message || t("Đã áp dụng cấu hình giữ tồn an toàn và ngưỡng đồng bộ tức thời."));
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("Không áp dụng được cấu hình Buffer và ngưỡng đồng bộ.")));
    } finally {
      setApplying(false);
    }
  }

  function computePreviewPublished(ftu, buf, rt) {
    const numFtu = Math.max(0, Number(ftu || 0));
    const numRt = Math.max(0, Number(rt || 0));
    const numBuf = Math.max(0, Math.min(50, Number(buf || 0)));
    if (numBuf <= 0 || numFtu <= numRt) return numFtu;
    return Math.floor(numFtu * ((100 - numBuf) / 100));
  }

  const metricItems = [
    {
      label: t("Độ trễ API P95"),
      value: `${formatNumber(overview?.p95LatencyMs ?? 0)} ms`,
      tone: (overview?.p95LatencyMs ?? 0) > 1500 ? "warning" : undefined,
      hint: t("Trung bình {{avg}} ms · SLA ≤ 1.500 ms", { avg: overview?.avgLatencyMs ?? 0 }),
    },
    {
      label: t("Độ trễ Webhook P95"),
      value: `${formatNumber(overview?.webhookDelayP95Ms ?? 0)} ms`,
      tone: (overview?.webhookDelayP95Ms ?? 0) > 5000 ? "warning" : undefined,
      hint: t("{{n}} sự kiện nhận · SLA ≤ 5.000 ms", { n: formatNumber(overview?.webhookCount ?? 0) }),
    },
    {
      label: t("Tỷ lệ đồng bộ thành công"),
      value: `${overview?.syncSuccessRatePercent ?? 100}%`,
      tone:
        (overview?.totalCalls ?? 0) > 0 && (overview?.syncSuccessRatePercent ?? 100) < 99
          ? "danger"
          : "success",
      hint: t("{{ok}}/{{tong}} lượt · SLA ≥ 99%", {
        ok: formatNumber(overview?.successCalls ?? 0),
        tong: formatNumber(overview?.totalCalls ?? 0),
      }),
    },
    {
      label: t("Tải hạn mức API sàn"),
      value: `${overview?.maxRateLimitUtilizationPercent ?? 0}%`,
      tone:
        (overview?.maxRateLimitUtilizationPercent ?? 0) >= 85
          ? "danger"
          : (overview?.maxRateLimitUtilizationPercent ?? 0) >= 75
            ? "warning"
            : undefined,
      hint: overview?.throttlingActive
        ? t("Đang kích hoạt trễ +500ms bảo vệ luồng định kỳ")
        : t("Ngưỡng cảnh báo 75% · Ngưỡng điều tiết 85%"),
    },
    {
      label: t("Sự cố bán vượt tồn (Oversell)"),
      value: `${overview?.oversellRatePercent ?? 0}%`,
      tone: (overview?.oversellRatePercent ?? 0) > 0.5 ? "danger" : undefined,
      hint: t("{{n}} đơn hủy/âm tồn · SLA ≤ 0,5%", { n: formatNumber(overview?.oversellIncidenceCount ?? 0) }),
    },
    {
      label: t("Phục hồi hết hàng TB"),
      value: `${overview?.avgOosRecoveryMinutes ?? 0} ${t("phút")}`,
      hint: t("Thời gian phản hồi cập nhật tồn khi về 0"),
    },
  ];

  const rangeTabs = [
    { value: "1h", label: t("1 giờ qua") },
    { value: "24h", label: t("24 giờ qua") },
    { value: "7d", label: t("7 ngày qua") },
  ];

  const tenKenhDangLoc = KENH_LOC.find((k) => k.value === channel)?.label ?? nhanSanChuan(channel);

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={channel === "ALL" ? t("Báo cáo đồng bộ kênh") : t("Báo cáo đồng bộ kênh — {{kenh}}", { kenh: tenKenhDangLoc })}
        giaiThich={<GiaiThichBaoCao />}
        actions={
          <>
            <select
              value={channel}
              onChange={(e) => handleChannelChange(e.target.value)}
              aria-label={t("Lọc theo kênh bán")}
              className="h-9 rounded-md border border-bo-border bg-white px-2.5 text-sm text-bo-heading focus:outline-none focus:ring-2 focus:ring-bo-primary/30"
            >
              {KENH_LOC.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={loading ? "mr-1.5 size-4 animate-spin" : "mr-1.5 size-4"} aria-hidden="true" />
              {t("Tải lại")}
            </Button>
          </>
        }
      />

      <div className="rounded-lg border border-bo-border bg-bo-surface px-4">
        <StatusTabs tabs={rangeTabs} value={range} onChange={setRange} />
      </div>

      {overview?.throttlingActive ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("Cơ chế bảo vệ hạn mức API (Throttling Guard) đang kích hoạt")}</p>
            <p className="text-xs text-amber-800">
              {t("Lưu lượng gọi sàn đạt mức từ 85% trở lên. Hệ thống tự động chèn trễ 500ms cho các đợt quét định kỳ nhưng giữ 0ms trễ cho các cập nhật tồn khẩn cấp.")}
            </p>
          </div>
        </div>
      ) : null}

      <MetricStrip items={metricItems} loading={loading} label={t("Bộ chỉ số đo đạc tích hợp sàn TMĐT")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-xs lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-bo-heading">
              <Activity className="size-4 text-bo-primary" aria-hidden="true" />
              {t("Biểu đồ độ trễ phản hồi API đối tác (ms)")}
            </h2>
          </div>
          {(overview?.latencyTrend?.length ?? 0) === 0 ? (
            <div className="flex h-60 items-center justify-center text-sm text-bo-muted">
              {t("Chưa có dữ liệu gọi API sàn trong khoảng thời gian đã chọn.")}
            </div>
          ) : (
            <div className="relative h-60">
              <KhungBieuDo>
                <AreaChart data={overview.latencyTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="p95LatencyMs" name={t("P95 (ms)")} stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                  <Area type="monotone" dataKey="avgLatencyMs" name={t("Trung bình (ms)")} stroke="#16a34a" fill="#dcfce7" strokeWidth={1.5} />
                </AreaChart>
              </KhungBieuDo>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold text-bo-heading">{t("Sức khỏe từng kênh & Nhóm lỗi")}</h2>
          <div className="space-y-3">
            {(overview?.channelStats?.length ?? 0) === 0 ? (
              <p className="text-xs text-bo-muted">{t("Chưa ghi nhận lượt gọi API nào.")}</p>
            ) : (
              overview.channelStats.map((ch) => (
                <div key={ch.channel} className="rounded-md border border-bo-border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-bo-heading">
                    <span>{nhanSanChuan(ch.channel)}</span>
                    <span className={ch.successRatePercent >= 99 ? "text-emerald-700" : "text-red-600"}>
                      {ch.successRatePercent}%
                    </span>
                  </div>
                  <p className="mt-1 text-bo-muted">
                    {t("{{n}} lượt · P95: {{p95}} ms · Bucket: {{pct}}%", {
                      n: formatNumber(ch.totalCalls),
                      p95: ch.p95LatencyMs,
                      pct: ch.rateLimitUtilizationPercent,
                    })}
                  </p>
                </div>
              ))
            )}

            {(overview?.errorBreakdown?.length ?? 0) > 0 ? (
              <div className="border-t border-bo-border pt-3">
                <p className="mb-2 text-xs font-medium text-bo-muted">{t("Phân loại nguyên nhân lỗi")}</p>
                <div className="space-y-1.5">
                  {overview.errorBreakdown.map((err) => (
                    <div key={err.errorCategory} className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-bo-heading">
                        <AlertTriangle className="size-3.5 text-amber-600" aria-hidden="true" />
                        {err.errorCategory}
                      </span>
                      <span className="tabular-nums text-bo-muted">
                        {formatNumber(err.count)} ({err.sharePercent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* Đề xuất Buffer% (r_POS) và Threshold_RT,k */}
      <section className="rounded-lg border border-bo-border bg-bo-surface shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bo-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-bo-heading">
              {t("Khuyến nghị giữ tồn an toàn POS (Buffer %) & Ngưỡng đồng bộ tức thời")}
            </h2>
            <p className="text-xs text-bo-muted">
              {t("POS là lượng bán tại quầy cửa hàng; Tỷ trọng POS = POS / Tổng bán (POS + Online). Nhóm A (POS ≥ 30%) đệm 10%–25%, Nhóm B (POS ≥ 40%) đệm 10%; tồn ≤ Ngưỡng tức thời sẽ đẩy 100%.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label={t("Số ngày tính tỷ trọng POS")}
              className="h-9 rounded-md border border-bo-border bg-white px-2.5 text-sm text-bo-heading"
            >
              <option value={7}>{t("7 ngày qua")}</option>
              <option value={14}>{t("14 ngày qua")}</option>
              <option value={30}>{t("30 ngày qua")}</option>
            </select>
            {isAdmin ? (
              <Button type="button" size="sm" disabled={applying || selectedIds.size === 0} onClick={handleApplySelected}>
                <Check className="mr-1.5 size-4" aria-hidden="true" />
                {t("Áp dụng cho {{n}} liên kết", { n: selectedIds.size })}
              </Button>
            ) : null}
          </div>
        </div>

        <TableShell
          loading={loading}
          isEmpty={!loading && recommendations.length === 0}
          emptyTitle={t("Chưa có SKU nào liên kết với kênh bán đang hoạt động")}
          emptyDescription={t("Hãy liên kết sản phẩm ở từng kênh bán để nhận khuyến nghị giữ tồn tự động.")}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-bo-border bg-bo-surface-subtle text-xs font-medium text-bo-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    {isAdmin ? (
                      <Checkbox
                        checked={recommendations.length > 0 && recommendations.every((r) => selectedIds.has(r.mappingId))}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds(new Set(recommendations.map((r) => r.mappingId)));
                          else setSelectedIds(new Set());
                        }}
                        aria-label={t("Chọn tất cả liên kết")}
                      />
                    ) : null}
                  </th>
                  <th className="px-3 py-2.5">{t("Sản phẩm / SKU")}</th>
                  <th className="px-2 py-2.5 text-center">{t("ABC")}</th>
                  <th className="px-2.5 py-2.5">{t("Gian hàng / Kênh bán")}</th>
                  <th className="px-2.5 py-2.5 text-right">{t("Khả dụng")}</th>
                  <th className="px-2.5 py-2.5 text-right" title={t("Số lượng bán tại quầy (POS) trên tổng lượng bán mọi kênh")}>
                    {t("POS / Tổng bán")}
                  </th>
                  <th className="px-2.5 py-2.5 text-right" title={t("Tỷ trọng bán tại quầy r_POS = POS / Tổng bán")}>
                    {t("Tỷ trọng POS")}
                  </th>
                  <th className="px-2.5 py-2.5 text-right">{t("Buffer %")}</th>
                  <th className="px-2.5 py-2.5 text-right">{t("Ngưỡng tức thời")}</th>
                  <th className="px-3 py-2.5 text-right">{t("Số đẩy sàn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {recommendations.map((it) => {
                  const edits = editMap[it.mappingId] || {
                    bufferPercent: it.recommendedBufferPercent,
                    realtimeThreshold: it.recommendedRealtimeThreshold,
                  };
                  const previewPublished = computePreviewPublished(
                    it.ftu,
                    edits.bufferPercent,
                    edits.realtimeThreshold,
                  );
                  const { tenGianHang, tenSan } = chuanHoaGianHangVaSan(it);
                  const abc = it.abcClass || "C";
                  return (
                    <tr key={it.mappingId} className="hover:bg-bo-surface-subtle/60">
                      <td className="px-3 py-2 text-center">
                        {isAdmin ? (
                          <Checkbox
                            checked={selectedIds.has(it.mappingId)}
                            onCheckedChange={() =>
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(it.mappingId)) next.delete(it.mappingId);
                                else next.add(it.mappingId);
                                return next;
                              })
                            }
                            aria-label={t("Chọn {{sku}}", { sku: it.maSku })}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-bo-heading">{it.tenSanPham}</p>
                        <p className="font-mono text-xs text-bo-muted">{it.maSku}</p>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={cn(
                            "inline-flex min-w-6 items-center justify-center rounded border px-1.5 py-0.5 text-xs font-semibold",
                            abc === "A"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : abc === "B"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-slate-100 text-slate-600",
                          )}
                        >
                          {abc}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-bo-heading">{tenGianHang}</span>
                          <span className="inline-flex rounded border border-bo-border bg-bo-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-bo-muted">
                            {tenSan}
                          </span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{formatNumber(it.ftu)}</td>
                      <td className="px-2.5 py-2 text-right text-xs tabular-nums text-bo-muted">
                        {formatNumber(it.posSoldN)} / {formatNumber(it.totalSoldN)}
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">
                        <span className={cn("font-medium", it.rPos >= 0.3 ? "text-amber-700" : "text-bo-heading")}>
                          {Math.round(it.rPos * 100)}%
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          disabled={!isAdmin || applying}
                          value={edits.bufferPercent}
                          onChange={(e) =>
                            setEditMap((prev) => ({
                              ...prev,
                              [it.mappingId]: {
                                ...edits,
                                bufferPercent: Math.max(0, Math.min(50, parseInt(e.target.value || "0", 10))),
                              },
                            }))
                          }
                          className="ml-auto h-8 w-20 text-right tabular-nums"
                          aria-label={t("Buffer phần trăm {{sku}}", { sku: it.maSku })}
                        />
                        <p className="mt-0.5 text-[11px] text-bo-muted">
                          {t("Hiện tại")}: {it.currentBufferPercent ?? 0}%
                        </p>
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          disabled={!isAdmin || applying}
                          value={edits.realtimeThreshold}
                          onChange={(e) =>
                            setEditMap((prev) => ({
                              ...prev,
                              [it.mappingId]: {
                                ...edits,
                                realtimeThreshold: Math.max(0, Math.min(1000, parseInt(e.target.value || "0", 10))),
                              },
                            }))
                          }
                          className="ml-auto h-8 w-20 text-right tabular-nums"
                          aria-label={t("Ngưỡng đồng bộ tức thời {{sku}}", { sku: it.maSku })}
                        />
                        <p className="mt-0.5 text-[11px] text-bo-muted">
                          {t("Hiện tại")}: {it.currentRealtimeThreshold ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="font-semibold text-bo-primary">{formatNumber(previewPublished)}</span>
                        <p className="text-[11px] text-bo-muted">
                          {t("Trước")}: {formatNumber(it.currentPublishedQty)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TableShell>
      </section>
    </PageContainer>
  );
}
