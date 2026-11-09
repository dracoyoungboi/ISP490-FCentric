import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, MapPin, PackageX, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CHAN_HOP,
  DAU_HOP,
  GHI_CHU_HOP,
  HOP,
  HOP_RONG,
  MO_TA_HOP,
  NUT_CHINH,
  NUT_QUAY_LAI,
  THAN_HOP,
  TIEU_DE_HOP,
} from "@/components/chung-tu/kieuHopThoai";
import { cauMayChuPhieuNhat } from "@/components/outbound/phieu-nhat/tinhPhieuNhat";
import { giongNhau, kiemChiaTay, kiemTuChia, sangOKe, tuChiaKe, viTriGui } from "@/components/outbound/phieu-nhat/chiaKe";
import { nhatHangService } from "@/services/nhatHangService";
import { formatQuantity, toNumber } from "@/constants/outbound";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Phân bổ lô cho một dòng phiếu nhặt (Log 2). Hệ thống gợi ý theo nhập trước lấy trước (lô nhập kho sớm lấy trước);
 * người nhặt lấy ở lô khác thì sửa tay. Tổng phải đúng bằng số cần nhặt, mỗi lô không vượt phần còn lại (đã trừ phiếu
 * khác đang giữ). Kiểu hộp chung của các màn chứng từ (chung-tu/kieuHopThoai: không nút ×, đóng bằng "Quay lại").
 *
 * Mỗi lô có số lấy còn chia ra kệ (phân bổ nhặt theo kệ): mặc định tự chia như máy chủ (kệ của lô → kệ khác → hàng chưa
 * có kệ, bỏ kệ đang kiểm kê); "Chọn kệ" để tự nhập số từng kệ, phần còn lại lấy ở hàng chưa có kệ. Đổi số của lô thì lô
 * đó quay về tự chia.
 */
export default function LotAllocationDialog({ open, onOpenChange, pickListId, line, onSaved }) {
  const [lots, setLots] = useState([]);
  const [values, setValues] = useState({});
  // Lô đang chọn kệ tay: { [loHangId]: { [viTriKhoId]: "số" } }; lô không có ở đây thì tự chia
  const [keTay, setKeTay] = useState({});
  // Đặt focus sau khi bật / tắt chọn kệ (khối cũ bị gỡ khỏi màn hình): { lo, cho: "ke" | "nut" }
  const [focusKe, setFocusKe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const canNhat = toNumber(line?.soLuongCanNhat);

  useEffect(() => {
    if (!open || !line) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setLoadError("");
      setLots([]);
      setValues({});
      setKeTay({});
    });
    nhatHangService
      .getLoKhaDung(pickListId, line.id)
      .then((list) => {
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        setLots(rows);
        const init = {};
        const tayInit = {};
        // Phân bổ của dòng (chi tiết phiếu): chuaCoKe khác null = đã chia kệ, không dòng kệ nghĩa là lấy ở hàng chưa có kệ
        const daChiaKe = new Set(
          (Array.isArray(line.phanBoLo) ? line.phanBoLo : []).filter((p) => p && p.chuaCoKe != null).map((p) => p.loHangId),
        );
        rows.forEach((lot) => {
          if (toNumber(lot.daPhanBo) > 0) {
            init[lot.loHangId] = String(toNumber(lot.daPhanBo));
            // Đang lưu khác cách tự chia (đã chọn tay, kể cả chọn toàn bộ hàng chưa có kệ): mở đúng cách chia đang lưu.
            // Kệ đã lưu nay không còn hàng (không có trong danh sách kệ) thì để tự chia lại.
            const ke = Array.isArray(lot.ke) ? lot.ke : [];
            const daChon = sangOKe(lot.keDaChon);
            const conDuKe = Object.keys(daChon).every((id) => ke.some((k) => String(k.viTriKhoId) === id));
            const coChon = Object.keys(daChon).length > 0 || daChiaKe.has(lot.loHangId);
            if (ke.length > 0 && coChon && conDuKe && !giongNhau(daChon, sangOKe(tuChiaKe(ke, lot.daPhanBo).chia))) {
              tayInit[lot.loHangId] = daChon;
            }
          }
        });
        setValues(init);
        setKeTay(tayInit);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(cauMayChuPhieuNhat(getApiErrorMessage(error, t("Không tải được danh sách lô"))));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, line, pickListId]);

  // focus chỉ dùng một lần (autoFocus lúc khối mới hiện): xóa ngay sau đó, không thì khối hiện lại vì lý do khác (sửa
  // số của lô về 0 rồi nhập lại) cũng giật focus khỏi ô đang gõ
  useEffect(() => {
    if (!focusKe) return undefined;
    const hen = setTimeout(() => setFocusKe(null), 0);
    return () => clearTimeout(hen);
  }, [focusKe]);

  const tong = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + toNumber(v), 0),
    [values],
  );
  const loVuot = lots.find((lot) => toNumber(values[lot.loHangId]) > toNumber(lot.conLai));
  // Lỗi chia kệ đầu tiên (lô đang lấy > 0, có kệ): chọn tay sai, hoặc tự chia mà hàng chưa có kệ không đủ
  const loiKe = useMemo(() => {
    for (const lot of lots) {
      if (toNumber(values[lot.loHangId]) <= 0 || !(Array.isArray(lot.ke) && lot.ke.length > 0)) continue;
      const tay = keTay[lot.loHangId];
      const loi = tay
        ? kiemChiaTay({ maLo: lot.maLo, soLuong: values[lot.loHangId], ke: lot.ke, tay, chuaCoKeCo: lot.chuaCoKe }).loi
        : kiemTuChia({ maLo: lot.maLo, soLuong: values[lot.loHangId], ke: lot.ke, chuaCoKeCo: lot.chuaCoKe });
      if (loi) return loi;
    }
    return null;
  }, [lots, keTay, values]);
  const hopLe = !loVuot && !loiKe && tong === canNhat && canNhat > 0;

  const handleChange = (loHangId, raw) => {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setValues((prev) => ({ ...prev, [loHangId]: raw }));
    // Đổi số của lô thì cách chia tay cũ không còn khớp: lô quay về tự chia
    if (toNumber(raw) !== toNumber(values[loHangId])) {
      setKeTay((prev) => {
        if (!(loHangId in prev)) return prev;
        const next = { ...prev };
        delete next[loHangId];
        return next;
      });
    }
  };

  const batChonKe = (lot) => {
    setKeTay((prev) => ({ ...prev, [lot.loHangId]: sangOKe(tuChiaKe(lot.ke, values[lot.loHangId]).chia) }));
    setFocusKe({ lo: lot.loHangId, cho: "ke" });
  };
  const tuChiaLai = (loHangId) => {
    setKeTay((prev) => {
      const next = { ...prev };
      delete next[loHangId];
      return next;
    });
    setFocusKe({ lo: loHangId, cho: "nut" });
  };
  const doiSoKe = (loHangId, viTriKhoId, raw) => {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setKeTay((prev) => ({ ...prev, [loHangId]: { ...(prev[loHangId] || {}), [viTriKhoId]: raw } }));
  };

  // Lấy lần lượt từ lô nhập kho sớm nhất (danh sách đã sắp nhập trước lấy trước) cho tới đủ số cần nhặt
  const datLaiFifo = () => {
    let conThieu = canNhat;
    const next = {};
    lots.forEach((lot) => {
      const lay = Math.min(Math.max(toNumber(lot.conLai), 0), conThieu);
      if (lay > 0) {
        next[lot.loHangId] = String(lay);
        conThieu -= lay;
      }
    });
    setValues(next);
    setKeTay({});
  };

  const save = async () => {
    if (!hopLe || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const phanBo = lots
        .filter((lot) => toNumber(values[lot.loHangId]) > 0)
        .map((lot) => {
          const item = { loHangId: lot.loHangId, soLuong: toNumber(values[lot.loHangId]) };
          // Chọn kệ tay: gửi số từng kệ + phần hàng chưa có kệ; tự chia: không gửi, máy chủ chia
          if (keTay[lot.loHangId] && Array.isArray(lot.ke) && lot.ke.length > 0) {
            item.viTri = viTriGui(lot.ke, keTay[lot.loHangId], values[lot.loHangId]);
          }
          return item;
        });
      const dto = await nhatHangService.luuPhanBoLo(pickListId, line.id, { phanBo });
      toast.success(t("Đã lưu phân bổ lô cho {{maSku}}", { maSku: line.maSku }));
      onSaved?.(dto);
      onOpenChange(false);
    } catch (error) {
      toast.error(cauMayChuPhieuNhat(getApiErrorMessage(error, t("Không lưu được phân bổ lô"))));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  let trangThai;
  if (loVuot) {
    trangThai = { tone: "danger", text: t("Lô {{maLo}} chỉ còn {{conLai}} có thể lấy", { maLo: loVuot.maLo, conLai: formatQuantity(loVuot.conLai) }) };
  } else if (loiKe) {
    trangThai = { tone: "danger", text: loiKe };
  } else if (tong === canNhat) {
    trangThai = { tone: "success", text: t("Khớp số cần nhặt") };
  } else if (tong < canNhat) {
    trangThai = { tone: "warning", text: t("Còn thiếu {{so}}", { so: formatQuantity(canNhat - tong) }) };
  } else {
    trangThai = { tone: "danger", text: t("Vượt {{so}} so với số cần nhặt", { so: formatQuantity(tong - canNhat) }) };
  }

  const variantName = [line?.tenMau, line?.tenSize].filter(Boolean).join(" / ");

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className={cn(HOP, HOP_RONG)}>
        <DialogHeader className={DAU_HOP}>
          <DialogTitle className={TIEU_DE_HOP}>{t("Phân bổ lô")}</DialogTitle>
          <DialogDescription className={MO_TA_HOP}>
            {line ? t("{{tenSanPham}}{{bienThe}} ({{maSku}}) · cần nhặt {{canNhat}}", { tenSanPham: line.tenSanPham, bienThe: variantName ? ` · ${variantName}` : "", maSku: line.maSku, canNhat: formatQuantity(canNhat) }) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className={THAN_HOP}>
          <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", GHI_CHU_HOP)}>
            <p>
              {t("Hệ thống gợi ý theo nhập trước lấy trước (lô nhập kho sớm lấy trước). Lấy ở lô khác thì nhập lại số lượng từng lô. Mỗi lô được tự chia theo kệ; muốn lấy ở kệ khác thì bấm Chọn kệ.")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || lots.length === 0 || saving}
              onClick={datLaiFifo}
              className="shrink-0 gap-1.5 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface"
            >
              <RotateCcw className="size-3.5" />
              {t("Đặt lại theo nhập trước lấy trước")}
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-bo-border max-sm:max-h-none">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-bo-muted">
                <Loader2 className="size-4 animate-spin" /> {t("Đang tải danh sách lô")}
              </div>
            ) : loadError ? (
              <p className="px-3 py-6 text-center text-sm text-bo-danger">{loadError}</p>
            ) : lots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-bo-muted">
                <PackageX className="size-5" />
                {t("Sản phẩm không còn lô nào có tồn tại kho này. Báo quản lý kho kiểm kê.")}
              </div>
            ) : (
              <ul className="divide-y divide-bo-border">
                {lots.map((lot, index) => {
                  const value = values[lot.loHangId] ?? "";
                  const vuot = toNumber(value) > toNumber(lot.conLai);
                  return (
                    <li key={lot.loHangId} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold text-bo-foreground">{lot.maLo}</span>
                            {index === 0 ? (
                              <span className="rounded bg-bo-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-bo-success">
                                {t("Nhập sớm nhất")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-bo-muted">
                            {t("Nhập {{ngay}} · Còn lấy được", { ngay: lot.ngayNhapGanNhat ? formatDate(lot.ngayNhapGanNhat) : "—" })}{" "}
                            <span className="font-semibold text-slate-700">{formatQuantity(lot.conLai)}</span>
                          </p>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={t("Số lượng lấy từ lô {{maLo}}", { maLo: lot.maLo })}
                          value={value}
                          placeholder="0"
                          disabled={saving}
                          onChange={(event) => handleChange(lot.loHangId, event.target.value)}
                          className={cn(
                            "h-9 w-20 shrink-0 rounded-md border bg-bo-surface text-center font-semibold text-bo-foreground focus:outline-none focus:ring-2",
                            vuot
                              ? "border-bo-danger focus:ring-bo-danger/20"
                              : "border-bo-border focus:border-bo-primary focus:ring-bo-primary/15",
                          )}
                        />
                      </div>
                      {toNumber(value) > 0 && !vuot ? (
                        <KeCuaLo
                          lot={lot}
                          soLuong={value}
                          tay={keTay[lot.loHangId]}
                          disabled={saving}
                          focus={focusKe?.lo === lot.loHangId ? focusKe.cho : null}
                          onChonKe={() => batChonKe(lot)}
                          onTuChia={() => tuChiaLai(lot.loHangId)}
                          onDoiSo={(viTriKhoId, raw) => doiSoKe(lot.loHangId, viTriKhoId, raw)}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            role="status"
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-sm",
              trangThai.tone === "success" && "border-bo-success/30 bg-bo-success-soft text-bo-success",
              trangThai.tone === "warning" && "border-bo-warning/30 bg-bo-warning-soft text-bo-warning",
              trangThai.tone === "danger" && "border-bo-danger/30 bg-bo-danger-soft text-bo-danger",
            )}
          >
            <span className="text-slate-700">
              {t("Đã phân bổ")} <span className="font-semibold">{formatQuantity(tong)}</span> / {formatQuantity(canNhat)}
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              {trangThai.tone === "success" ? (
                <Check className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              {trangThai.text}
            </span>
          </div>
        </div>

        <div className={CHAN_HOP}>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className={NUT_QUAY_LAI}
          >
            {t("Quay lại")}
          </Button>
          <Button
            type="button"
            disabled={!hopLe || saving || loading}
            onClick={save}
            className={NUT_CHINH}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {t("Lưu phân bổ")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const THE_KE = "inline-flex h-[22px] max-w-full items-center gap-1 whitespace-nowrap rounded border px-1.5 text-xs";
const NUT_CHU =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-xs font-medium text-bo-primary hover:bg-bo-primary-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary disabled:opacity-50";

/**
 * Chỗ lấy của một lô trong hộp Phân bổ lô. Tự chia: thẻ kệ như sẽ lưu (kệ đang kiểm kê hiện vàng, bị bỏ qua) + nút
 * "Chọn kệ". Chọn kệ: ô số cho từng kệ, phần còn lại tính ra "Chưa có kệ". Lô không nằm trên kệ nào: một câu ngắn.
 * Máy chủ chưa chia kệ (`lot.chuaCoKe` null, không có kệ): không hiện gì. `focus`: "ke" | "nut" — sau khi người dùng
 * vừa bật / tắt chọn kệ, đưa focus về ô kệ đầu / nút Chọn kệ (khối cũ đã bị gỡ).
 */
function KeCuaLo({ lot, soLuong, tay, disabled, focus, onChonKe, onTuChia, onDoiSo }) {
  const ke = Array.isArray(lot.ke) ? lot.ke : [];
  if (ke.length === 0) {
    if (lot.chuaCoKe == null) return null;
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-bo-muted">
        <MapPin className="size-3 shrink-0" aria-hidden="true" />
        {t("Lấy ở hàng chưa có kệ")}
      </p>
    );
  }
  if (tay) {
    return (
      <ChiaKeTay
        lot={lot}
        ke={ke}
        soLuong={soLuong}
        tay={tay}
        disabled={disabled}
        focusO={focus === "ke"}
        onTuChia={onTuChia}
        onDoiSo={onDoiSo}
      />
    );
  }

  const { chia, chuaCoKe } = tuChiaKe(ke, soLuong);
  const dangKiem = ke.filter((k) => k.dangKiemKe);
  const loi = kiemTuChia({ maLo: lot.maLo, soLuong, ke, chuaCoKeCo: lot.chuaCoKe });
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-xs text-bo-muted">{t("Lấy ở")}</span>
        {chia.map((k) => (
          <span
            key={k.viTriKhoId}
            title={t("Kệ {{maViTri}}", { maViTri: k.maViTri })}
            className={cn(THE_KE, "border-bo-primary/25 bg-white font-mono text-bo-primary-strong")}
          >
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{k.maViTri}</span>
            <span className="font-sans tabular-nums">× {formatQuantity(k.soLuong)}</span>
          </span>
        ))}
        {chuaCoKe > 0 ? (
          <span className={cn(THE_KE, "border-slate-200 bg-white text-slate-600")}>
            {t("Chưa có kệ")} <span className="tabular-nums">× {formatQuantity(chuaCoKe)}</span>
          </span>
        ) : null}
        {dangKiem.map((k) => (
          <span
            key={`kk-${k.viTriKhoId}`}
            title={t("Kệ {{maViTri}} đang được kiểm kê, không lấy ở đây", { maViTri: k.maViTri })}
            className={cn(THE_KE, "border-bo-warning/40 bg-bo-warning-soft font-mono text-bo-warning")}
          >
            <span className="truncate">{k.maViTri}</span>
            <span className="font-sans">{t("đang kiểm kê")}</span>
          </span>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={onChonKe}
          autoFocus={focus === "nut"}
          aria-label={t("Chọn kệ cho lô {{maLo}}", { maLo: lot.maLo })}
          className={cn(NUT_CHU, "ml-auto")}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          {t("Chọn kệ")}
        </button>
      </div>
      {loi ? <p className="mt-1 text-xs font-medium text-bo-danger">{loi}</p> : null}
    </div>
  );
}

/** Chọn kệ tay cho một lô: ô số từng kệ, phần còn lại là "Chưa có kệ". Kệ đang kiểm kê chỉ sửa được nếu lúc mở đã có số. */
function ChiaKeTay({ lot, ke, soLuong, tay, disabled, focusO, onTuChia, onDoiSo }) {
  // Kệ đang kiểm kê mà lúc mở đã có số (lưu từ trước): cho sửa để bỏ đi; xóa xong ô không tự khóa giữa chừng
  const [kiemKeCoSo] = useState(
    () => new Set(ke.filter((k) => k.dangKiemKe && toNumber(tay[k.viTriKhoId]) > 0).map((k) => k.viTriKhoId)),
  );
  const kq = kiemChiaTay({ maLo: lot.maLo, soLuong, ke, tay, chuaCoKeCo: lot.chuaCoKe });
  const oDau = ke.find((k) => !k.dangKiemKe || kiemKeCoSo.has(k.viTriKhoId));
  return (
    <div className="mt-2 rounded-md border border-bo-border bg-bo-surface-subtle px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-700">{t("Chia theo kệ")}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onTuChia}
          aria-label={t("Tự chia lại lô {{maLo}} theo kệ", { maLo: lot.maLo })}
          className={NUT_CHU}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t("Tự chia")}
        </button>
      </div>
      <ul className="mt-1 space-y-1">
        {ke.map((k) => {
          const vuot = kq.keVuot.has(k.viTriKhoId);
          const khoaO = k.dangKiemKe && !kiemKeCoSo.has(k.viTriKhoId);
          return (
            <li key={k.viTriKhoId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="inline-flex min-w-0 items-center gap-1 font-mono font-semibold text-bo-foreground">
                  <MapPin className="size-3 shrink-0 text-bo-muted" aria-hidden="true" />
                  <span className="truncate" title={k.maViTri}>{k.maViTri}</span>
                </span>
                {k.dangKiemKe ? (
                  <span className="rounded bg-bo-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-bo-warning">
                    {t("Đang kiểm kê")}
                  </span>
                ) : (
                  <span className="text-bo-muted">
                    {t("còn")} <span className="font-semibold tabular-nums text-slate-700">{formatQuantity(k.soLuong)}</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t("Số lấy ở kệ {{maViTri}} của lô {{maLo}}", { maViTri: k.maViTri, maLo: lot.maLo })}
                aria-invalid={vuot || undefined}
                value={tay[k.viTriKhoId] ?? ""}
                placeholder="0"
                autoFocus={focusO && k === oDau}
                disabled={disabled || khoaO}
                onChange={(event) => onDoiSo(k.viTriKhoId, event.target.value)}
                className={cn(
                  "h-8 w-16 shrink-0 rounded-md border bg-bo-surface text-center text-sm font-semibold text-bo-foreground focus:outline-none focus:ring-2 disabled:bg-bo-surface-subtle disabled:text-bo-muted",
                  vuot
                    ? "border-bo-danger focus:ring-bo-danger/20"
                    : "border-bo-border focus:border-bo-primary focus:ring-bo-primary/15",
                )}
              />
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 border-t border-dashed border-bo-border pt-1 text-xs">
          <span className="text-slate-700">
            {t("Chưa có kệ")}
            {lot.chuaCoKe != null ? <span className="text-bo-muted"> {t("· còn")} {formatQuantity(lot.chuaCoKe)}</span> : null}
          </span>
          <span className="w-16 text-center text-sm font-semibold tabular-nums text-bo-foreground">
            {formatQuantity(kq.chuaCoKe)}
          </span>
        </li>
      </ul>
    </div>
  );
}
