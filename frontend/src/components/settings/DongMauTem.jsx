import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Lock, Tags } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { SettingsFieldHint } from "@/components/settings/SettingsUI";
import { settingsInputClass } from "@/components/settings/settingsStyles";
import { useUnsavedChanges } from "@/components/settings/useSettingsPage";
import TemSanPham from "@/components/print/TemSanPham";
import { layKhoTem } from "@/components/print/paperStyles";
import { pxMoiMmXemTruoc } from "@/components/print/tinhTem";
import { usePreviewViewportSize } from "@/components/print/usePreviewViewportSize";
import { cn } from "@/lib/utils";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { bulkUpdateInventorySettings, getInventorySettings } from "@/services/inventorySettingsService";
import { temSanPhamService } from "@/services/temSanPhamService";
import {
  INVENTORY_SETTINGS,
  getInventoryChanges,
  moTaTacDong,
  phamViCauHinh,
  readCompleteInventorySettings,
  selectInventorySettings,
  validateInventoryField,
} from "@/validations/inventorySettingsSchema";

const NHOM = "label";
const KHO = "TEM_KHO_MAC_DINH";
const IN_TEN = "TEM_IN_TEN_CUA_HANG";
const IN_SKU = "TEM_IN_SKU";
const NGUONG = "TEM_NGUONG_XAC_NHAN";
const fieldCua = (code) => INVENTORY_SETTINGS.find((f) => f.code === code);
// Khớp Boolean.parseBoolean của máy chủ (không phân biệt hoa thường); "1" giữ như cũ
const laBat = (giaTri) => ["true", "1"].includes(String(giaTri ?? "").trim().toLowerCase());
const valuesOf = (settings) => Object.fromEntries(settings.map((item) => [item.maCauHinh, item.giaTri]));
const TEM_MAU = { id: 0, tenSanPham: "Áo thun cotton basic", tenMau: "Đen", kichCo: "M", maVachSku: "2000000150", maSku: "AT2610151-CL001-M-MS-2691", giaBan: 199000 };
const MO_TA = "In từ màn Giá bán & tem mã vạch và phiếu nhập kho";
// Cùng kiểu chữ / nút với các dòng mẫu chứng từ ở PrintTemplateListPage
const CHU_TEN =
  "text-left text-sm leading-5 font-medium text-bo-foreground hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";
const NUT_SUA =
  "-mr-2.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

/**
 * Dòng "Tem sản phẩm" trong danh sách Cấu hình › Mẫu in, cùng khuôn các dòng mẫu chứng từ: tên, nơi dùng, khổ tem đang
 * dùng, "Sửa mẫu". Bấm mở hộp sửa (khổ tem, in tên cửa hàng, in SKU, ngưỡng hỏi xác nhận, tem mẫu xem trước).
 * Cùng nguồn GET/PUT /dieu-hanh-he-thong/cau-hinh (PUT chỉ quản trị viên); quản lý kho mở để xem ("Xem mẫu").
 * `coVachTren`: kẻ đường phân cách phía trên như các dòng đứng sau dòng đầu của nhóm.
 */
export default function DongMauTem({ coVachTren = false }) {
  const canEdit = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const [settings, setSettings] = useState(null);
  const [tenCuaHang, setTenCuaHang] = useState(null);
  const [status, setStatus] = useState("loading");
  const [mo, setMo] = useState(false);
  const requestRef = useRef(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    try {
      const [ds, cauHinhTem] = await Promise.all([
        getInventorySettings({ signal: controller.signal }),
        // Lỗi riêng phần này (undefined) khác với chưa khai báo tên (null): ghi đúng lý do ở dòng "In tên cửa hàng"
        temSanPhamService.cauHinh({ signal: controller.signal }).catch(() => undefined),
      ]);
      const doc = readCompleteInventorySettings(ds, NHOM);
      if (controller.signal.aborted) return;
      setSettings(doc.filter((item) => item.maCauHinh && fieldCua(item.maCauHinh)?.group === NHOM));
      setTenCuaHang(cauHinhTem === undefined ? undefined : cauHinhTem?.tenCuaHang ?? null);
      setStatus("loaded");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
      requestRef.current?.abort();
    };
  }, [load]);

  const kho = layKhoTem(valuesOf(settings ?? [])[KHO]);
  const khoGiay =
    status === "loaded" ? `Tem ${kho.rongTem} × ${kho.caoTem} mm · máy in tem` : status === "error" ? "Không tải được cấu hình tem" : "Đang tải…";
  const nhanNut = status === "error" ? "Thử lại" : canEdit ? "Sửa mẫu" : "Xem mẫu";
  const bam = () => {
    if (status === "error") load();
    else if (status === "loaded") setMo(true);
  };

  return (
    <li
      className={cn(
        "relative -mx-2 flex items-center gap-x-4 gap-y-2 rounded-md px-2 py-2.5 transition-colors hover:bg-bo-surface-subtle sm:gap-x-6",
        coVachTren && "before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-[#eef1f5]",
      )}
    >
      <Tags className="size-[18px] shrink-0 text-[#7a8594]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={bam} disabled={status === "loading"} className={CHU_TEN}>
          Tem sản phẩm
        </button>
        <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{MO_TA}</p>
        {/* Màn hẹp: khổ tem xuống dòng dưới mô tả (màn rộng có cột riêng bên phải) */}
        <p className="text-[13px] leading-5 text-[#5b6676] sm:hidden">{khoGiay}</p>
      </div>
      <span className="hidden shrink-0 text-[13px] leading-5 whitespace-nowrap text-[#5b6676] sm:inline">{khoGiay}</span>
      <button
        type="button"
        onClick={bam}
        disabled={status === "loading"}
        aria-label={status === "error" ? "Tải lại cấu hình tem sản phẩm" : `${nhanNut} tem sản phẩm`}
        className={cn(NUT_SUA, "disabled:opacity-50")}
      >
        {nhanNut}
        {status === "error" ? null : <ChevronRight className="size-3.5" aria-hidden="true" />}
      </button>
      <Dialog open={mo} onOpenChange={setMo}>
        {mo && settings ? (
          <HopMauTem
            canEdit={canEdit}
            settings={settings}
            tenCuaHang={tenCuaHang}
            onDong={() => setMo(false)}
            onDaLuu={(moi) => {
              setSettings(moi);
              setMo(false);
            }}
          />
        ) : null}
      </Dialog>
    </li>
  );
}

/** Nội dung hộp "Tem sản phẩm": cài đặt bên trái, tem mẫu (cùng component với bản in) bên phải; chỉ dựng khi mở. */
function HopMauTem({ canEdit, settings, tenCuaHang, onDong, onDaLuu }) {
  const saved = valuesOf(settings);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const khungTemMau = usePreviewViewportSize();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const changes = canEdit ? getInventoryChanges(settings, draft) : [];
  const errors = {};
  if (canEdit) {
    for (const setting of settings) {
      const error = validateInventoryField(setting.maCauHinh, draft[setting.maCauHinh], setting.kieuDuLieu);
      if (error) errors[setting.maCauHinh] = error;
    }
  }
  const hasErrors = Object.keys(errors).length > 0;
  useUnsavedChanges(changes.length > 0);

  const save = async (event) => {
    event.preventDefault();
    if (!changes.length || hasErrors || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = selectInventorySettings((await bulkUpdateInventorySettings(changes)).data);
      if (changes.some((change) => !updated.some((item) => item.maCauHinh === change.maCauHinh))) {
        throw new Error("Phản hồi lưu thiếu cấu hình đã gửi.");
      }
      if (!mountedRef.current) return;
      toast.success("Đã lưu cấu hình tem sản phẩm.");
      onDaLuu(settings.map((item) => updated.find((result) => result.maCauHinh === item.maCauHinh) ?? item));
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error?.response?.status === 400 ? error?.response?.data?.message : null;
      setSaveError(message || "Chưa lưu được. Vui lòng thử lại, các giá trị bạn nhập vẫn được giữ.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const khoaO = !canEdit || saving;
  const khoField = fieldCua(KHO);
  const kho = layKhoTem(draft[KHO]);
  const rongTemMau = khungTemMau.width ? Math.min(280, khungTemMau.width - 24) : 280;
  const [truocNguong, damNguong, sauNguong] = errors[NGUONG] ? ["Nhập giá trị hợp lệ để xem tác động.", "", ""] : moTaTacDong(NGUONG, draft[NGUONG]);
  const congTac = (code, ghiChu) => (
    <div className="flex items-center gap-4 border-t border-[#eef1f5] py-3">
      <div className="min-w-0 flex-1">
        <p id={`tem-${code}`} className="text-sm leading-5 font-medium text-bo-foreground">{fieldCua(code).label}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">{ghiChu}</p>
      </div>
      <Switch
        checked={laBat(draft[code])}
        onCheckedChange={(bat) => setDraft((cu) => ({ ...cu, [code]: bat ? "true" : "false" }))}
        disabled={khoaO}
        aria-labelledby={`tem-${code}`}
        className={SWITCH_CLASS}
      />
    </div>
  );

  return (
    <DialogContent
      showCloseButton={!saving}
      onEscapeKeyDown={(event) => saving && event.preventDefault()}
      onInteractOutside={(event) => saving && event.preventDefault()}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(760px,calc(100%-2rem))]"
    >
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <DialogHeader className="shrink-0 border-b border-bo-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-[17px] text-bo-foreground">
            Tem sản phẩm
            {!canEdit ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#e9edf2] px-2 text-xs font-medium text-slate-700">
                <Lock className="size-3" aria-hidden="true" />
                Chỉ xem
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-bo-muted">{MO_TA} · mã CODE128 · giá đã gồm thuế</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4 md:flex-row">
          <div className="min-w-0 flex-1">
            <p id="tem-kho" className="text-sm leading-5 font-medium text-bo-foreground">{khoField.label}</p>
            <div
              role="radiogroup"
              aria-labelledby="tem-kho"
              onKeyDown={(event) => {
                // Mũi tên chuyển khổ như nhóm nút radio
                const buoc = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
                if (!buoc || khoaO) return;
                event.preventDefault();
                const ds = khoField.options;
                const moi = (Math.max(0, ds.findIndex((o) => o.value === draft[KHO])) + buoc + ds.length) % ds.length;
                setDraft((cu) => ({ ...cu, [KHO]: ds[moi].value }));
                event.currentTarget.querySelectorAll("[role=radio]")[moi]?.focus();
              }}
              className="mt-2 mb-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {khoField.options.map((o, i) => {
                const chon = draft[KHO] === o.value;
                const k = layKhoTem(o.value);
                const coChon = khoField.options.some((x) => x.value === draft[KHO]);
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={chon}
                    tabIndex={chon || (!coChon && i === 0) ? 0 : -1}
                    disabled={khoaO}
                    onClick={() => setDraft((cu) => ({ ...cu, [KHO]: o.value }))}
                    className={cn(
                      "grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md border bg-white p-3 text-left",
                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bo-primary/25 disabled:cursor-default",
                      chon ? "border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border enabled:hover:border-slate-300",
                      !chon && !canEdit && "opacity-60",
                    )}
                  >
                    <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", chon ? "border-bo-primary" : "border-slate-300")}>
                      {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                    </span>
                    <span className="text-sm font-medium text-bo-foreground">
                      {k.rongTem} × {k.caoTem} mm
                    </span>
                    <span className="col-start-2 text-xs leading-5 text-bo-muted">
                      {k.soCot} tem/hàng · cuộn {k.rongCuon} mm
                    </span>
                  </button>
                );
              })}
            </div>
            {errors[KHO] ? <SettingsFieldHint id="tem-kho-loi" error={errors[KHO]} className="-mt-2 mb-3" /> : null}

            {congTac(
              IN_TEN,
              tenCuaHang
                ? `In dòng "${tenCuaHang}" ở đầu tem.`
                : tenCuaHang === undefined
                  ? "Không tải được tên cửa hàng."
                  : "Chưa khai báo tên ở Thông tin cửa hàng.",
            )}
            {congTac(IN_SKU, "In thêm mã SKU dưới giá (tem chật hơn).")}

            <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-[#eef1f5] pt-3">
              <div className="min-w-0 flex-[1_1_200px]">
                <label htmlFor="tem-nguong" className="text-sm leading-5 font-medium text-bo-foreground">{fieldCua(NGUONG).label}</label>
                <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">
                  {truocNguong}
                  {damNguong ? <strong className="font-semibold text-bo-foreground">{damNguong}</strong> : null}
                  {sauNguong}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <div className="relative w-[140px]">
                  <Input
                    id="tem-nguong"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={draft[NGUONG] ?? ""}
                    onChange={(event) => setDraft((cu) => ({ ...cu, [NGUONG]: event.target.value }))}
                    aria-invalid={Boolean(errors[NGUONG])}
                    aria-describedby="tem-nguong-goi-y"
                    disabled={khoaO}
                    className={settingsInputClass({ error: Boolean(errors[NGUONG]), className: "pr-11 text-right font-medium tabular-nums" })}
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-bo-muted">tem</span>
                </div>
                <SettingsFieldHint id="tem-nguong-goi-y" error={errors[NGUONG]} className="sm:text-right">
                  {phamViCauHinh(NGUONG)}
                </SettingsFieldHint>
              </div>
            </div>
          </div>

          {/* Tem mẫu: cùng component với bản in, phóng một tem vừa khung cho đọc được chữ, đổi ngay theo lựa chọn
              (màn hẹp đặt lên đầu để thấy ngay khi đổi) */}
          <div ref={khungTemMau.ref} className="flex shrink-0 flex-col items-center gap-2 self-start rounded-lg bg-bo-canvas px-3 py-4 max-md:order-first max-md:self-stretch md:w-[304px]">
            <div className="overflow-hidden rounded-[4px] shadow-[0_1px_3px_rgba(15,23,42,0.18)]">
              <TemSanPham
                dong={TEM_MAU}
                kho={kho}
                inTenCuaHang={laBat(draft[IN_TEN])}
                tenCuaHang={tenCuaHang}
                inSku={laBat(draft[IN_SKU])}
                pxMoiMm={pxMoiMmXemTruoc(kho, rongTemMau)}
              />
            </div>
            <span className="text-xs text-bo-muted">Tem mẫu (phóng to)</span>
          </div>
        </div>

        {saveError ? (
          <p role="alert" className="mx-5 mb-3 shrink-0 rounded-md bg-bo-danger-soft px-3 py-2 text-[13px] leading-5 text-red-800">{saveError}</p>
        ) : null}
        <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t border-bo-border bg-[#fafbfc] px-5 py-3">
          {canEdit ? (
            <>
              <Button type="button" variant="outline" onClick={onDong} disabled={saving} className={NUT_PHU}>
                Hủy
              </Button>
              <Button type="submit" disabled={!changes.length || hasErrors || saving} className={NUT_CHINH}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onDong} className={NUT_PHU}>
              Đóng
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
