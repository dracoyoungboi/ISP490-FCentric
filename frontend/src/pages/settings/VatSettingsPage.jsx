import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEditButton,
  SettingsFieldHint,
  SettingsFormActions,
  SettingsPill,
  SettingsTextButton,
} from "@/components/settings/SettingsUI";
import { settingsInputClass } from "@/components/settings/settingsStyles";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { bulkUpdateInventorySettings, getInventorySettings } from "@/services/inventorySettingsService";
import { formatCurrency } from "@/utils/formatters";
import { TOI_DA_MOC, VAT_BAT, VAT_LICH, docLich, ghiLich, loiLich, thueSuatTai, tienThue } from "./vatLich";

/** Ngày yyyy-mm-dd theo giờ máy. */
const homNay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ngayVN = (s) => (s ? s.split("-").reverse().join("/") : "");
const laBat = (v) => /^(true|1)$/i.test(String(v ?? ""));

/**
 * Cấu hình › Thuế GTGT: bật in thuế GTGT trên hóa đơn bán hàng và lịch thuế suất theo ngày hiệu lực. Giá bán đã gồm
 * thuế: tiền thuế tách ngược từ tổng thanh toán (gồm phí vận chuyển). Đơn chụp thuế suất lúc chốt (bán tại quầy, tạo
 * đơn, chuyển báo giá thành đơn) nên đổi cấu hình không đổi hóa đơn đã bán. Đơn sàn không tính thuế.
 * Đọc / lưu qua /dieu-hanh-he-thong/cau-hinh (VAT_BAT, VAT_LICH); quản lý kho chỉ xem.
 */
export default function VatSettingsPage() {
  const { canEdit } = useSettingsPage();
  const [status, setStatus] = useState("loading");
  const [saved, setSaved] = useState(null); // { bat, lich }
  const [editing, setEditing] = useState(false);
  const [bat, setBat] = useState(false);
  const [lich, setLich] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const ds = await getInventorySettings();
      const tim = (ma) => ds.find((item) => item?.maCauHinh === ma);
      if (!tim(VAT_BAT) || !tim(VAT_LICH)) throw new Error("thiếu cấu hình");
      if (!mountedRef.current) return;
      setSaved({ bat: laBat(tim(VAT_BAT).giaTri), lich: docLich(tim(VAT_LICH).giaTri) });
      setStatus("ready");
    } catch {
      if (mountedRef.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    queueMicrotask(load);
    return () => { mountedRef.current = false; };
  }, [load]);

  const loi = editing ? loiLich(lich) : "";
  const doi = editing && saved && (bat !== saved.bat || ghiLich(lich) !== ghiLich(saved.lich));
  useUnsavedChanges(doi);

  const batDauSua = () => {
    setBat(saved.bat);
    setLich(saved.lich.map((m) => ({ ...m })));
    setSaveError("");
    setEditing(true);
  };
  const huySua = () => { setEditing(false); setSaveError(""); };
  const suaMoc = (i, khoa, giaTri) => setLich((ds) => ds.map((m, j) => (j === i ? { ...m, [khoa]: giaTri } : m)));

  const luu = async (event) => {
    event.preventDefault();
    if (!doi || loi || saving) return;
    setSaving(true);
    setSaveError("");
    const thayDoi = [];
    if (bat !== saved.bat) thayDoi.push({ maCauHinh: VAT_BAT, giaTri: String(bat) });
    if (ghiLich(lich) !== ghiLich(saved.lich)) thayDoi.push({ maCauHinh: VAT_LICH, giaTri: ghiLich(lich) });
    try {
      await bulkUpdateInventorySettings(thayDoi);
      if (!mountedRef.current) return;
      setSaved({ bat, lich: docLich(ghiLich(lich)) });
      setEditing(false);
      toast.success("Đã lưu cấu hình thuế GTGT.");
    } catch (error) {
      if (mountedRef.current) setSaveError(error?.response?.data?.message || "Không lưu được. Thử lại.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  if (status === "loading") {
    return <SettingsCard><LoadingState label="Đang tải cấu hình" className="min-h-48" /></SettingsCard>;
  }
  if (status === "error") {
    return (
      <SettingsCard>
        <ErrorState title="Không thể tải cấu hình" description="Không đọc được cấu hình thuế GTGT từ máy chủ. Vui lòng thử lại." onRetry={load} className="min-h-48" />
      </SettingsCard>
    );
  }

  const ds = editing ? lich : saved.lich;
  const dangBat = editing ? bat : saved.bat;
  const tsHomNay = loiLich(ds) ? null : thueSuatTai(ds, homNay());
  const viDu = 120000;
  return (
    <SettingsCard as="form" editing={editing} onSubmit={luu} noValidate aria-label="Thuế GTGT">
      <SettingsCardHeader
        title="Thuế GTGT trên hóa đơn"
        note="Áp dụng cho hóa đơn bán hàng (A4, A5 và khổ nhiệt tại quầy)"
        action={canEdit && !editing ? <SettingsEditButton onClick={batDauSua} aria-label="Sửa cấu hình thuế GTGT" /> : null}
      />
      <div className="space-y-4 px-5 pb-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] pb-4">
          <div className="min-w-0">
            <p className="font-medium text-bo-foreground">In thuế GTGT trên hóa đơn</p>
            <p className="text-[13px] text-bo-muted">Giá bán đã gồm thuế: tiền thuế tách ra từ tổng thanh toán, số khách trả không đổi.</p>
          </div>
          {editing ? (
            <label className="flex items-center gap-2">
              <input checked={bat} className="size-4 accent-bo-primary" disabled={saving} onChange={(e) => setBat(e.target.checked)} type="checkbox" />
              Bật
            </label>
          ) : (
            <SettingsPill tone={dangBat ? "ok" : "off"}>{dangBat ? "Đang bật" : "Đang tắt"}</SettingsPill>
          )}
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 font-medium text-bo-foreground">Lịch thuế suất</legend>
          <ul className="m-0 list-none space-y-2 p-0">
            {ds.map((m, i) => (
              <li className="flex flex-wrap items-center gap-2" key={i}>
                {editing ? (
                  <>
                    <label className="flex items-center gap-2">
                      <span className="w-14 text-bo-muted">Từ ngày</span>
                      <Input aria-label={`Từ ngày, mốc ${i + 1}`} className={settingsInputClass({ className: "w-40" })} disabled={saving}
                        onChange={(e) => suaMoc(i, "tuNgay", e.target.value)} type="date" value={m.tuNgay} />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-bo-muted">Thuế suất</span>
                      <span className="relative">
                        <Input aria-label={`Thuế suất, mốc ${i + 1}`} className={settingsInputClass({ className: "w-24 pr-7 text-right tabular-nums" })} disabled={saving}
                          inputMode="decimal" onChange={(e) => suaMoc(i, "thueSuat", e.target.value)} value={m.thueSuat} />
                        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-bo-muted">%</span>
                      </span>
                    </label>
                    <button aria-label={`Bỏ mốc ${i + 1}`} className="rounded-md p-1.5 text-bo-muted hover:bg-bo-surface-subtle hover:text-red-600 disabled:opacity-40"
                      disabled={saving || ds.length <= 1} onClick={() => setLich((cu) => cu.filter((_, j) => j !== i))} type="button">
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <span>
                    Từ <strong className="font-medium text-bo-foreground">{ngayVN(m.tuNgay)}</strong>:{" "}
                    <strong className="font-semibold tabular-nums text-bo-foreground">{m.thueSuat}%</strong>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {editing && ds.length < TOI_DA_MOC ? (
            <SettingsTextButton className="mt-2 -ml-2.5" disabled={saving} onClick={() => setLich((cu) => [...cu, { tuNgay: "", thueSuat: "" }])}>
              <Plus className="size-[15px]" aria-hidden="true" />Thêm mốc
            </SettingsTextButton>
          ) : null}
          {loi ? <SettingsFieldHint error={loi} /> : null}
        </fieldset>

        <p className="rounded-md bg-bo-surface-subtle px-3 py-2 text-[13px] leading-5 text-bo-muted">
          {!dangBat ? "Đang tắt: hóa đơn không in thuế. " : null}
          {tsHomNay == null
            ? "Hôm nay chưa có mốc thuế suất nào có hiệu lực: hóa đơn không in thuế."
            : <>{dangBat ? "Hôm nay áp dụng" : "Khi bật, hôm nay áp dụng"} <strong className="text-bo-foreground">{tsHomNay}%</strong>. Ví dụ đơn {formatCurrency(viDu)}: tiền chưa thuế {formatCurrency(viDu - tienThue(viDu, tsHomNay))}, thuế GTGT {formatCurrency(tienThue(viDu, tsHomNay))}.</>}
          {" "}Đơn đã chốt giữ thuế suất lúc chốt; đơn sàn không tính thuế. Nên hỏi kế toán trước khi bật hoặc đổi thuế suất.
        </p>
      </div>
      {editing ? (
        <>
          {saveError ? <p role="alert" className="mx-5 mb-3 rounded-md bg-bo-danger-soft px-3 py-2 text-[13px] leading-5 text-red-800">{saveError}</p> : null}
          <SettingsFormActions onCancel={huySua} saving={saving} disabled={!doi || Boolean(loi)} />
        </>
      ) : <div className="h-1.5" />}
    </SettingsCard>
  );
}
