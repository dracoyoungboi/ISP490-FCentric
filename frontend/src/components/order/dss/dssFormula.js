// Tính toán thử nghiệm (What-If preview) công thức DSS khớp với DssPolicyEngine.java.
// Không dùng alias "@/..." để chạy trực tiếp bằng `node --test`.

export const DSS_PRESETS = {
  PRESET_01_STANDARD: "PRESET_01_STANDARD",
  PRESET_02_PEAK: "PRESET_02_PEAK",
  PRESET_03_LEAN: "PRESET_03_LEAN",
  PRESET_04_PHASE_OUT: "PRESET_04_PHASE_OUT",
};

export function resolvePresetForItem(config, abcClass) {
  if (config?.mode === "GLOBAL_PRESET" && config?.globalPresetCode) {
    return config.globalPresetCode;
  }
  switch (abcClass || "C") {
    case "A":
      return DSS_PRESETS.PRESET_02_PEAK;
    case "B":
      return DSS_PRESETS.PRESET_01_STANDARD;
    default:
      return DSS_PRESETS.PRESET_03_LEAN;
  }
}

function ceilNonNegative(v) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.ceil(v - 1e-9);
}

/**
 * Mô phỏng tức thời SS, ROP, Q, ExcessStock khi người dùng chỉnh tham số trước khi bấm Lưu & Tính lại.
 */
export function simulateDssItem(item, config) {
  const dAvg = Number(item.avgDailyDemand || 0);
  const dMax = Number(item.maxDailyDemand || 0);
  const sigmaD = Number(item.demandStdDev || 0);
  const lAvg = Math.max(1, Number(item.leadTimeAvg || config?.defaultLeadTimeAvg || 5));
  const lMax = Math.max(lAvg, Number(item.leadTimeMax || config?.defaultLeadTimeMax || 7));
  const ftu = Number(item.ftu || 0);
  const incoming = Math.max(0, Number(item.incoming || 0));

  const appliedPreset = resolvePresetForItem(config, item.abcClass);
  const isPhaseOut = appliedPreset === DSS_PRESETS.PRESET_04_PHASE_OUT;

  let safetyStock = 0;
  let reorderPoint = 0;
  let suggestedOrderQty = 0;
  let excessStock = 0;

  if (isPhaseOut) {
    const tRemain = Math.max(1, Number(config?.phaseOutRemainingDays ?? 15));
    const minNeeded = ceilNonNegative(dAvg * tRemain);
    excessStock = Math.max(0, ftu - minNeeded);
  } else if (appliedPreset === DSS_PRESETS.PRESET_02_PEAK) {
    const g = Number(config?.peakGrowthPercentG ?? 30);
    const tCampaign = Math.max(1, Number(config?.peakCampaignDays ?? 14));
    const dTarget = dAvg * Math.max(0, 1 + g / 100);
    safetyStock = ceilNonNegative(dMax * lMax - dAvg * lAvg);
    reorderPoint = ceilNonNegative(dTarget * lMax + safetyStock);
    suggestedOrderQty = ceilNonNegative(dTarget * tCampaign + safetyStock - (ftu + incoming));
  } else if (appliedPreset === DSS_PRESETS.PRESET_03_LEAN) {
    const bDays = Math.max(1, Number(config?.leanBufferDaysB ?? 3));
    const tCycle = Math.max(1, Number(config?.cycleDaysT ?? 14));
    safetyStock = ceilNonNegative(dAvg * bDays);
    reorderPoint = ceilNonNegative(dAvg * lAvg + safetyStock);
    suggestedOrderQty = ceilNonNegative(dAvg * tCycle + safetyStock - (ftu + incoming));
  } else {
    const z = Math.max(0, Number(config?.serviceLevelZ ?? 1.65));
    const tCycle = Math.max(1, Number(config?.cycleDaysT ?? 14));
    safetyStock = ceilNonNegative(z * sigmaD * Math.sqrt(lAvg));
    reorderPoint = ceilNonNegative(dAvg * lAvg + safetyStock);
    suggestedOrderQty = ceilNonNegative(dAvg * tCycle + safetyStock - (ftu + incoming));
  }

  const doi = dAvg > 0.0001 ? Math.round((Math.max(0, ftu) / dAvg) * 10) / 10 : null;
  const deadStock = ftu > 0 && (Boolean(item.deadStock) || (doi !== null && doi > 60));
  let urgencyLevel = "NORMAL";
  if (isPhaseOut) {
    urgencyLevel = "EXCESS_OR_PHASE_OUT";
  } else if (dAvg > 0.0001 && ((doi !== null && doi < lAvg) || ftu <= 0)) {
    urgencyLevel = "CRITICAL";
  } else if (ftu <= reorderPoint && (suggestedOrderQty > 0 || dAvg > 0.0001)) {
    urgencyLevel = "HIGH";
  } else if (deadStock) {
    urgencyLevel = "EXCESS_OR_PHASE_OUT";
  }

  return {
    ...item,
    appliedPreset,
    safetyStock,
    reorderPoint,
    suggestedOrderQty,
    excessStock,
    daysOfInventory: doi,
    deadStock,
    urgencyLevel,
    needsReorder: !isPhaseOut && ftu <= reorderPoint && suggestedOrderQty > 0,
    prCreationLocked: isPhaseOut,
    flashSaleRecommended: (isPhaseOut && (excessStock > 0 || (doi !== null && doi > 60))) || deadStock,
  };
}

