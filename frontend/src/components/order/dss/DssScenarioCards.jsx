import { Flame, Leaf, ShieldCheck, Ban } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const KICH_BAN = [
  {
    code: "PRESET_01_STANDARD",
    ten: t("Hoạt động chuẩn"),
    moTa: t("Tối ưu hàng bán đều quanh năm theo sai lệch nhu cầu và hệ số phục vụ."),
    congThuc: "SS = Z × σ_D × √L_avg",
    icon: ShieldCheck,
    mau: "text-blue-700 bg-blue-50 border-blue-200",
  },
  {
    code: "PRESET_02_PEAK",
    ten: t("Cao điểm & Chiến dịch"),
    moTa: t("Tăng độ sẵn sàng đón Flash Sale hoặc mùa lễ với tồn đệm chịu đỉnh ngày bán."),
    congThuc: "SS = D_max × L_max − D_avg × L_avg",
    icon: Flame,
    mau: "text-amber-700 bg-amber-50 border-amber-200",
  },
  {
    code: "PRESET_03_LEAN",
    ten: t("Tiết kiệm vốn (Lean)"),
    moTa: t("Giữ tồn đệm mỏng theo số ngày cố định cho hàng chậm hoặc chi phí vốn cao."),
    congThuc: "SS = D_avg × B_days",
    icon: Leaf,
    mau: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  {
    code: "PRESET_04_PHASE_OUT",
    ten: t("Ngừng nhập & Xả hàng"),
    moTa: t("Khóa tạo yêu cầu nhập mới (ROP = 0), tính lượng dư để đẩy xả hàng."),
    congThuc: "SS = 0 · ROP = 0 · Q = 0",
    icon: Ban,
    mau: "text-slate-700 bg-slate-100 border-slate-300",
  },
];

// Thanh chọn chế độ kịch bản Màn 1 (Theo hạng ABC tự động hay 1 kịch bản cho toàn bộ) + 4 thẻ Preset What-If (0 API)
export default function DssScenarioCards({ mode, globalPresetCode, onSelectMode, onSelectPreset, disabled }) {
  const dangTheoAbc = mode === "BY_ABC_CLASS";

  return (
    <section aria-label={t("Chế độ kịch bản nhập hàng")} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-bo-border bg-bo-surface p-1 shadow-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectMode("BY_ABC_CLASS")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              dangTheoAbc
                ? "bg-bo-primary text-white shadow-xs"
                : "text-bo-muted hover:text-bo-heading",
            )}
          >
            {t("Theo nhóm ABC tự động")}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectMode("GLOBAL_PRESET")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              !dangTheoAbc
                ? "bg-bo-primary text-white shadow-xs"
                : "text-bo-muted hover:text-bo-heading",
            )}
          >
            {t("Áp dụng 1 kịch bản cho toàn bộ")}
          </button>
        </div>

        <p className="text-xs text-bo-muted">
          {dangTheoAbc
            ? t("Nhóm A (70% doanh thu) → Cao điểm · Nhóm B (20%) → Chuẩn · Nhóm C (10%) → Tiết kiệm vốn")
            : t("Toàn bộ SKU đang kinh doanh áp dụng cùng kịch bản đã chọn bên dưới")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KICH_BAN.map((kb) => {
          const Icon = kb.icon;
          const isSelected = !dangTheoAbc && globalPresetCode === kb.code;
          const isIncludedInAbc =
            dangTheoAbc &&
            (kb.code === "PRESET_01_STANDARD" || kb.code === "PRESET_02_PEAK" || kb.code === "PRESET_03_LEAN");
          return (
            <button
              key={kb.code}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (dangTheoAbc) onSelectMode("GLOBAL_PRESET");
                onSelectPreset(kb.code);
              }}
              className={cn(
                "flex flex-col rounded-lg border bg-bo-surface p-4 text-left transition-all",
                isSelected
                  ? "border-bo-primary ring-2 ring-bo-primary/20 shadow-sm"
                  : isIncludedInAbc
                    ? "border-bo-border hover:border-bo-primary/50"
                    : "border-bo-border/80 opacity-85 hover:opacity-100 hover:border-bo-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", kb.mau)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {kb.ten}
                </span>
                {isSelected ? (
                  <span className="rounded bg-bo-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-bo-primary">
                    {t("Đang chọn")}
                  </span>
                ) : isIncludedInAbc ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {kb.code === "PRESET_02_PEAK"
                      ? t("Nhóm A")
                      : kb.code === "PRESET_01_STANDARD"
                        ? t("Nhóm B")
                        : t("Nhóm C")}
                  </span>
                ) : null}
              </div>
              <p className="mt-2.5 text-xs leading-5 text-bo-muted">{kb.moTa}</p>
              <p className="mt-auto pt-2 font-mono text-[11px] text-slate-500">{kb.congThuc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
