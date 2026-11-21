import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DSS_PRESETS, simulateDssItem } from "./dssFormula.js";

const baseConfig = {
  mode: "GLOBAL_PRESET",
  globalPresetCode: DSS_PRESETS.PRESET_01_STANDARD,
  serviceLevelZ: 1.65,
  cycleDaysT: 14,
  peakGrowthPercentG: 30,
  peakCampaignDays: 14,
  leanBufferDaysB: 3,
  phaseOutRemainingDays: 15,
  defaultLeadTimeAvg: 5,
  defaultLeadTimeMax: 7,
};

describe("dssFormula", () => {
  it("tính đúng công thức Chuẩn (PRESET_01_STANDARD)", () => {
    const out = simulateDssItem(
      {
        abcClass: "B",
        avgDailyDemand: 3,
        maxDailyDemand: 5,
        demandStdDev: 1,
        leadTimeAvg: 4,
        leadTimeMax: 6,
        ftu: 10,
        incoming: 0,
      },
      baseConfig,
    );
    // SS = ceil(1.65 * 1 * 2) = 4, ROP = ceil(3*4 + 4) = 16, Q = ceil(3*14 + 4 - 10) = 36
    assert.equal(out.safetyStock, 4);
    assert.equal(out.reorderPoint, 16);
    assert.equal(out.suggestedOrderQty, 36);
    assert.equal(out.urgencyLevel, "CRITICAL");
  });

  it("tính đúng công thức Cao điểm (PRESET_02_PEAK) và Tinh gọn (PRESET_03_LEAN)", () => {
    const peak = simulateDssItem(
      {
        abcClass: "A",
        avgDailyDemand: 2,
        maxDailyDemand: 5,
        leadTimeAvg: 4,
        leadTimeMax: 6,
        ftu: 20,
        incoming: 0,
      },
      { ...baseConfig, globalPresetCode: DSS_PRESETS.PRESET_02_PEAK },
    );
    // SS = 30 - 8 = 22, D_target = 2.6, ROP = ceil(2.6*6 + 22) = 38, Q = ceil(2.6*14 + 22 - 20) = 39
    assert.equal(peak.safetyStock, 22);
    assert.equal(peak.reorderPoint, 38);
    assert.equal(peak.suggestedOrderQty, 39);

    const lean = simulateDssItem(
      {
        abcClass: "C",
        avgDailyDemand: 4,
        leadTimeAvg: 5,
        ftu: 30,
        incoming: 0,
      },
      { ...baseConfig, mode: "BY_ABC_CLASS" },
    );
    // ABC = C -> LEAN: SS = 4*3 = 12, ROP = 4*5 + 12 = 32, Q = 4*14 + 12 - 30 = 38
    assert.equal(lean.appliedPreset, DSS_PRESETS.PRESET_03_LEAN);
    assert.equal(lean.safetyStock, 12);
    assert.equal(lean.reorderPoint, 32);
    assert.equal(lean.suggestedOrderQty, 38);
  });

  it("khóa tạo PR và tính ExcessStock khi Ngừng nhập (PRESET_04_PHASE_OUT)", () => {
    const po = simulateDssItem(
      {
        abcClass: "C",
        avgDailyDemand: 2,
        ftu: 50,
        incoming: 10,
      },
      { ...baseConfig, globalPresetCode: DSS_PRESETS.PRESET_04_PHASE_OUT },
    );
    assert.equal(po.safetyStock, 0);
    assert.equal(po.reorderPoint, 0);
    assert.equal(po.suggestedOrderQty, 0);
    assert.equal(po.excessStock, 20);
    assert.equal(po.prCreationLocked, true);
    assert.equal(po.needsReorder, false);
    assert.equal(po.flashSaleRecommended, true);
  });

  it("đánh dấu deadStock khi DOI > 60 ngày ở mọi kịch bản", () => {
    const slow = simulateDssItem(
      {
        abcClass: "C",
        avgDailyDemand: 1,
        maxDailyDemand: 1,
        leadTimeAvg: 5,
        ftu: 120,
        incoming: 0,
      },
      baseConfig,
    );
    assert.equal(slow.deadStock, true);
    assert.equal(slow.flashSaleRecommended, true);
    assert.equal(slow.urgencyLevel, "EXCESS_OR_PHASE_OUT");
  });
});

