import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Plus, X } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEditButton,
  SettingsFieldHint,
  SettingsFormActions,
  SettingsGroupLabel,
  SettingsPill,
  SettingsTextButton,
} from "@/components/settings/SettingsUI";
import { settingsInputClass } from "@/components/settings/settingsStyles";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { bulkUpdateInventorySettings, getInventorySettings } from "@/services/inventorySettingsService";
import { formatCurrency } from "@/utils/formatters";
import { TOI_DA_MOC, VAT_BAT, VAT_LICH, docLich, ghiLich, loiLich, thueSuatTai, tienThue } from "./vatLich";

/** Ngày yyyy-mm-dd theo giờ máy. */
const ghiNgay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const homNay = () => ghiNgay(new Date());
/** Ngày liền trước (yyyy-mm-dd): mốc cũ hết hiệu lực trước ngày mốc kế tiếp một ngày. */
const ngayTruoc = (s) => {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return ghiNgay(d);
};
const ngayVN = (s) => (s ? s.split("-").reverse().join("/") : "");
const laBat = (v) => /^(true|1)$/i.test(String(v ?? ""));

/** Một dòng tiền kiểu hóa đơn giấy: nhãn … số tiền, nối bằng đường chấm. */
function DongHoaDon({ nhan, giaTri, className }) {
  return (
    <p className={cn("m-0 flex items-baseline gap-1.5", className)}>
      <span>{nhan}</span>
      <span aria-hidden="true" className="min-w-4 flex-1 -translate-y-[3px] border-b border-dotted border-[#c3cad4]" />
      <span className="whitespace-nowrap">{giaTri}</span>
    </p>
  );
}

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
  const ngay = homNay();
  const tsHomNay = loiLich(ds) ? null : thueSuatTai(ds, ngay);
  // Mốc đang hiệu lực hôm nay (lịch đã lưu luôn xếp theo ngày); -1 = chưa tới mốc nào.
  const iHienHanh = ds.reduce((kq, m, i) => (m.tuNgay && m.tuNgay <= ngay ? i : kq), -1);
  const viDu = 120000;
  const thue = tsHomNay == null ? 0 : tienThue(viDu, tsHomNay);
  return (
    <SettingsCard as="form" editing={editing} onSubmit={luu} noValidate aria-label="Thuế GTGT">
      <SettingsCardHeader
        title="Thuế GTGT trên hóa đơn"
        note="Áp dụng cho hóa đơn bán hàng (A4, A5 và khổ nhiệt tại quầy)"
        action={canEdit && !editing ? <SettingsEditButton onClick={batDauSua} aria-label="Sửa cấu hình thuế GTGT" /> : null}
      />
      <div className="px-5 text-sm">
        <div className="mt-2 flex items-center gap-x-6 gap-y-3 border-t border-[#eef1f5] pt-3.5 pb-4">
          <div className="min-w-0 flex-1">
            <p className="leading-5 font-medium text-bo-foreground" id="vat-in-thue">In thuế GTGT</p>
            <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">Giá bán đã gồm thuế: tiền thuế tách ra từ tổng thanh toán, số khách trả không đổi.</p>
          </div>
          {editing ? (
            <Switch
              aria-labelledby="vat-in-thue"
              checked={bat}
              className="h-6 w-10 data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:size-[18px] [&>span]:bg-bo-surface [&>span]:data-[state=checked]:translate-x-[18px] [&>span]:data-[state=unchecked]:translate-x-0.5"
              disabled={saving}
              onCheckedChange={setBat}
            />
          ) : (
            <span className={cn("inline-flex shrink-0 items-center gap-2 text-[13px] leading-5 font-medium whitespace-nowrap", dangBat ? "text-bo-foreground" : "text-[#5b6676]")}>
              <span aria-hidden="true" className={cn("size-2 rounded-full", dangBat ? "bg-green-600 ring-[3px] ring-green-100" : "bg-slate-400 ring-[3px] ring-slate-100")} />
              {dangBat ? "Đang bật" : "Đang tắt"}
            </span>
          )}
        </div>

        <div className="grid items-start gap-x-6 gap-y-4 border-t border-[#eef1f5] pt-1 pb-5 md:grid-cols-[minmax(0,1fr)_18rem]">
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="contents"><SettingsGroupLabel className="pb-2">Lịch thuế suất</SettingsGroupLabel></legend>
            <ul className="m-0 list-none divide-y divide-[#eef1f5] rounded-md border border-bo-border p-0">
              {!ds.length ? <li className="px-3.5 py-2.5 text-bo-muted">Chưa có mốc thuế suất.</li> : null}
              {ds.map((m, i) => (
                editing ? (
                  <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5" key={i}>
                    <label className="flex items-center gap-2">
                      <span className="text-bo-muted">Từ ngày</span>
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
                    <button aria-label={`Bỏ mốc ${i + 1}`} className="ml-auto rounded-md p-1.5 text-bo-muted hover:bg-bo-surface-subtle hover:text-red-600 disabled:opacity-40"
                      disabled={saving || ds.length <= 1} onClick={() => setLich((cu) => cu.filter((_, j) => j !== i))} type="button">
                      <X className="size-4" />
                    </button>
                  </li>
                ) : (
                  <li className={cn("flex min-h-11 items-center gap-3 px-3.5 py-2", i < iHienHanh ? "text-bo-muted" : "text-bo-foreground")} key={i}>
                    <span className="min-w-0 flex-1 tabular-nums">
                      {i + 1 < ds.length ? `${ngayVN(m.tuNgay)} – ${ngayVN(ngayTruoc(ds[i + 1].tuNgay))}` : `Từ ${ngayVN(m.tuNgay)}`}
                    </span>
                    {i === iHienHanh ? <SettingsPill tone="info">Hiện hành</SettingsPill> : null}
                    {i > iHienHanh ? <SettingsPill tone="off">Sắp tới</SettingsPill> : null}
                    {i < iHienHanh ? <span className="text-xs">Đã qua</span> : null}
                    <span className="w-12 text-right font-semibold tabular-nums">{m.thueSuat}%</span>
                  </li>
                )
              ))}
            </ul>
            {editing && ds.length < TOI_DA_MOC ? (
              <SettingsTextButton className="mt-2 -ml-2.5" disabled={saving} onClick={() => setLich((cu) => [...cu, { tuNgay: "", thueSuat: "" }])}>
                <Plus className="size-[15px]" aria-hidden="true" />Thêm mốc
              </SettingsTextButton>
            ) : null}
            {loi ? <SettingsFieldHint className="mt-2" error={loi} /> : null}
          </fieldset>

          <div className="min-w-0">
            <SettingsGroupLabel className="pb-2">Hóa đơn sẽ in như sau</SettingsGroupLabel>
            {/* Cùng chữ với khối tổng của mẫu in (printSchemas: grandTotal, vatNote, vatPreTax, vatAmount) */}
            <div className="rounded-md border border-bo-border px-3.5 pt-3 pb-3.5 text-[13px] leading-5 tabular-nums">
              <DongHoaDon className="font-semibold text-bo-foreground" nhan="Tổng thanh toán" giaTri={formatCurrency(viDu)} />
              {tsHomNay == null ? (
                <p className="mt-2 text-xs leading-4 text-[#5b6676]">Hôm nay chưa có mốc thuế suất nào có hiệu lực: hóa đơn không in thuế.</p>
              ) : (
                <>
                  <div className={cn("text-[#5b6676]", !dangBat && "opacity-45")}>
                    <p className="mt-1.5 mb-1 text-xs italic">Giá đã gồm thuế GTGT, trong đó:</p>
                    <DongHoaDon className="pl-3" nhan="Tiền trước thuế" giaTri={formatCurrency(viDu - thue)} />
                    <DongHoaDon className="mt-0.5 pl-3" nhan={`Thuế GTGT (${tsHomNay}%)`} giaTri={formatCurrency(thue)} />
                  </div>
                  {!dangBat ? <p className="mt-2 text-xs leading-4 text-[#5b6676]">Đang tắt: hóa đơn chỉ in Tổng thanh toán, không in các dòng mờ.</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="m-0 flex gap-2 border-t border-[#eef1f5] px-5 py-3 text-xs leading-5 text-[#5b6676]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#7a8594]" aria-hidden="true" />
        <span>Đơn đã chốt giữ thuế suất lúc chốt; đơn sàn không tính thuế. Nên hỏi kế toán trước khi bật hoặc đổi thuế suất.</span>
      </p>
      {editing ? (
        <>
          {saveError ? <p role="alert" className="mx-5 mb-3 mt-1 rounded-md bg-bo-danger-soft px-3 py-2 text-[13px] leading-5 text-red-800">{saveError}</p> : null}
          <SettingsFormActions className="mt-0" onCancel={huySua} saving={saving} disabled={!doi || Boolean(loi)} />
        </>
      ) : null}
    </SettingsCard>
  );
}
