import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

const LUA_CHON_Z = [
  { value: 1.28, label: "90% (Z = 1.28)" },
  { value: 1.65, label: "95% (Z = 1.65)" },
  { value: 1.96, label: "97.5% (Z = 1.96)" },
  { value: 2.33, label: "99% (Z = 2.33)" },
];

export default function DssParameterPanel({
  draftConfig,
  onChange,
  onSaveAndRecalc,
  onReset,
  saving,
  canEdit,
  hasChanges,
}) {
  if (!draftConfig) return null;

  const setNum = (field, min, max, isFloat = false) => (e) => {
    const raw = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    if (Number.isNaN(raw)) return;
    onChange({ ...draftConfig, [field]: Math.max(min, Math.min(max, raw)) });
  };

  return (
    <section className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-bo-border pb-2.5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-bo-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-bo-heading">{t("Tham số mô hình & Thời gian quan sát")}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasChanges ? (
            <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={saving}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
              {t("Hoàn tác")}
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" size="sm" onClick={onSaveAndRecalc} disabled={saving}>
              {saving ? t("Đang tính lại…") : t("Lưu & Tính lại ROP")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="dss-n" className="text-xs text-bo-muted">
            {t("Chu kỳ quan sát N (ngày)")}
          </Label>
          <Input
            id="dss-n"
            type="number"
            min={7}
            max={90}
            disabled={!canEdit || saving}
            value={draftConfig.observationDaysN}
            onChange={setNum("observationDaysN", 7, 90)}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="dss-z" className="text-xs text-bo-muted">
            {t("Mức độ phục vụ Z")}
          </Label>
          <select
            id="dss-z"
            disabled={!canEdit || saving}
            value={Number(draftConfig.serviceLevelZ).toFixed(2)}
            onChange={(e) => onChange({ ...draftConfig, serviceLevelZ: parseFloat(e.target.value) })}
            className="h-9 w-full rounded-md border border-bo-border bg-white px-2.5 text-sm text-bo-heading focus:outline-none focus:ring-2 focus:ring-bo-primary/30"
          >
            {LUA_CHON_Z.map((z) => (
              <option key={z.value} value={z.value.toFixed(2)}>
                {z.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dss-t" className="text-xs text-bo-muted">
            {t("Chu kỳ dự trữ T (ngày)")}
          </Label>
          <Input
            id="dss-t"
            type="number"
            min={1}
            max={120}
            disabled={!canEdit || saving}
            value={draftConfig.cycleDaysT}
            onChange={setNum("cycleDaysT", 1, 120)}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="dss-g" className="text-xs text-bo-muted">
            {t("Tăng trưởng cao điểm g (%)")}
          </Label>
          <Input
            id="dss-g"
            type="number"
            min={-80}
            max={300}
            disabled={!canEdit || saving}
            value={draftConfig.peakGrowthPercentG}
            onChange={setNum("peakGrowthPercentG", -80, 300)}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="dss-b" className="text-xs text-bo-muted">
            {t("Số ngày đệm Lean B")}
          </Label>
          <Input
            id="dss-b"
            type="number"
            min={1}
            max={90}
            disabled={!canEdit || saving}
            value={draftConfig.leanBufferDaysB}
            onChange={setNum("leanBufferDaysB", 1, 90)}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="dss-rem" className="text-xs text-bo-muted">
            {t("Ngày còn lại xả hàng")}
          </Label>
          <Input
            id="dss-rem"
            type="number"
            min={1}
            max={90}
            disabled={!canEdit || saving}
            value={draftConfig.phaseOutRemainingDays}
            onChange={setNum("phaseOutRemainingDays", 1, 90)}
            className="h-9"
          />
        </div>
      </div>
    </section>
  );
}

