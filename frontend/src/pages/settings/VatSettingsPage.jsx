import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import ConfirmModal from "@/components/ui/confirm-modal";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEditButton,
  SettingsFormActions,
  SettingsGroupLabel,
  SettingsTextButton,
} from "@/components/settings/SettingsUI";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import { getInventorySettings } from "@/services/inventorySettingsService";
import { keToanService } from "@/services/keToanService";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { ngayIso, phangDanhMuc } from "@/components/ke-toan/tinhKeToan";
import { formatCurrency } from "@/utils/formatters";
import { getApiErrorMessage } from "@/utils/apiError";
import { LichThueSuatSua, LichThueSuatXem } from "./LichThueSuat";
import { VAT_BAT, formBang, idTuNgay, khoangNgay, kiemTraBang, mucChungTai, payloadBang, tienThue } from "./vatLich";
import { t } from "@/i18n";
import { cauGocCuaLoi } from "@/i18n/cauGoc";

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
 * Cấu hình › Thuế GTGT: một thẻ gồm công tắc In thuế GTGT và lịch thuế suất — bảng thuế suất dùng chung cho hóa đơn bán
 * hàng (mức chung) và xuất kế toán (thêm dòng theo danh mục). Giá bán đã gồm thuế: tiền thuế tách ngược từ tổng thanh
 * toán. Bấm Sửa thì công tắc và cả bảng cùng sửa, Lưu một lần (PUT /ke-toan/thue-suat, một giao dịch).
 * Đọc công tắc qua /dieu-hanh-he-thong/cau-hinh (VAT_BAT), bảng qua /ke-toan/thue-suat. Quản lý kho chỉ xem.
 */
export default function VatSettingsPage() {
  const { canEdit } = useSettingsPage();
  const [status, setStatus] = useState("loading");
  const [savedBat, setSavedBat] = useState(false);
  const [thueSuat, setThueSuat] = useState([]);
  // Bảng tải riêng: lỗi (vd. máy chủ cũ chưa cho quản lý kho đọc) thì vẫn hiện công tắc, nhưng không cho sửa
  const [loiBang, setLoiBang] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bat, setBat] = useState(false);
  const [bang, setBang] = useState([]);
  const [daThuLuu, setDaThuLuu] = useState(false);
  const [dsDanhMuc, setDsDanhMuc] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // 409 vì người khác vừa sửa bảng: hiện nút tải lại
  const [phaiTaiLai, setPhaiTaiLai] = useState(false);
  // Dòng đã lưu sẽ bị xóa khi Lưu: chờ xác nhận
  const [xoaCho, setXoaCho] = useState(null);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [ds, ts] = await Promise.all([
        getInventorySettings(),
        keToanService.danhSachThueSuat().then((kq) => ({ kq }), () => ({ loi: true })),
      ]);
      const cauHinhBat = ds.find((item) => item?.maCauHinh === VAT_BAT);
      if (!cauHinhBat) throw new Error("thiếu cấu hình"); // i18n-giu-nguyen: lỗi nội bộ, bị catch và không hiện ra
      if (!mountedRef.current) return;
      setSavedBat(laBat(cauHinhBat.giaTri));
      setThueSuat(ts.kq ?? []);
      setLoiBang(Boolean(ts.loi));
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

  const bangGoc = useMemo(() => JSON.stringify(payloadBang(formBang(thueSuat))), [thueSuat]);
  const doiBang = editing && JSON.stringify(payloadBang(bang)) !== bangGoc;
  const doi = editing && (bat !== savedBat || doiBang);
  const loi = editing && daThuLuu ? kiemTraBang(bang) : {};
  const danhMuc = useMemo(
    () => phangDanhMuc(dsDanhMuc, bang.map((d) => Number(d.danhMucId)).filter(Boolean)),
    [dsDanhMuc, bang],
  );
  useUnsavedChanges(doi);

  const batDauSua = () => {
    setBat(savedBat);
    setBang(formBang(thueSuat));
    setDaThuLuu(false);
    setSaveError("");
    setPhaiTaiLai(false);
    setEditing(true);
    // Danh mục chỉ cần cho ô chọn của dòng theo danh mục
    if (!dsDanhMuc.length) {
      danhMucQuanAoService.getAll()
        .then((r) => mountedRef.current && setDsDanhMuc(r?.data?.data ?? []))
        .catch(() => {});
    }
  };
  const huySua = () => { setEditing(false); setSaveError(""); setXoaCho(null); };
  // Đưa con trỏ tới ô Từ ngày của một dòng (dòng vừa thêm, hoặc dòng lỗi đầu tiên) sau khi vẽ lại
  const toiDong = (khoa) => setTimeout(() => document.getElementById(idTuNgay(khoa))?.focus(), 0);

  const gui = async () => {
    setXoaCho(null);
    setSaving(true);
    setSaveError("");
    setPhaiTaiLai(false);
    try {
      const moi = await keToanService.luuBangThueSuat({
        inThue: bat !== savedBat ? bat : null,
        dong: payloadBang(bang),
        idDaXem: thueSuat.map((ts) => ts.id),
      });
      if (!mountedRef.current) return;
      setThueSuat(moi);
      setSavedBat(bat);
      setEditing(false);
      toast.success(t("Đã lưu thuế GTGT."));
    } catch (error) {
      if (!mountedRef.current) return;
      setSaveError(getApiErrorMessage(error, t("Không lưu được. Thử lại.")));
      setPhaiTaiLai(error?.response?.status === 409 && /người khác/.test(cauGocCuaLoi(error)));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const luu = (event) => {
    event.preventDefault();
    if (!doi || saving) return;
    setDaThuLuu(true);
    const loiMoi = kiemTraBang(bang);
    const khoaLoi = bang.map((d) => d.khoa).filter((k) => loiMoi[k]);
    if (khoaLoi.length) {
      setSaveError(khoaLoi.length === 1 ? t("Còn 1 dòng cần sửa.") : t("Còn {{count}} dòng cần sửa.", { count: khoaLoi.length }));
      setPhaiTaiLai(false);
      toiDong(khoaLoi[0]);
      return;
    }
    setSaveError("");
    // Lưu sẽ xóa dòng đã có (gồm cả mức đang áp dụng): hỏi lại trước, liệt kê dòng sẽ xóa
    const conLai = new Set(bang.map((d) => d.id).filter(Boolean));
    const biXoa = thueSuat.filter((ts) => !conLai.has(ts.id));
    if (biXoa.length) setXoaCho(biXoa);
    else gui();
  };

  const taiLaiBang = () => {
    setEditing(false);
    setSaveError("");
    setPhaiTaiLai(false);
    load();
  };

  if (status === "loading") {
    return <SettingsCard><LoadingState label={t("Đang tải cấu hình")} className="min-h-48" /></SettingsCard>;
  }
  if (status === "error") {
    return (
      <SettingsCard>
        <ErrorState title={t("Không thể tải cấu hình")} description={t("Không đọc được cấu hình thuế GTGT từ máy chủ. Vui lòng thử lại.")} onRetry={load} className="min-h-48" />
      </SettingsCard>
    );
  }

  const dangBat = editing ? bat : savedBat;
  const ngay = ngayIso(new Date());
  // Ví dụ hóa đơn theo bảng đang sửa (bỏ dòng chưa đủ thông tin), để thấy ngay mức sẽ in
  const dsXem = editing
    ? payloadBang(bang.filter((d) => d.hieuLucTu && d.tyLe !== "" && !d.rieng))
    : thueSuat;
  const hienHanh = mucChungTai(dsXem, ngay);
  const tsHomNay = hienHanh ? Number(hienHanh.tyLe) : null;
  const viDu = 120000;
  const thue = tsHomNay == null ? 0 : tienThue(viDu, tsHomNay);
  return (
    <>
    <SettingsCard as="form" editing={editing} onSubmit={luu} noValidate aria-label={t("Thuế GTGT trên hóa đơn")}>
      <SettingsCardHeader
        title={t("Thuế GTGT trên hóa đơn")}
        note={t("Áp dụng cho hóa đơn bán hàng (A4, A5 và khổ nhiệt tại quầy)")}
        action={canEdit && !editing && !loiBang ? <SettingsEditButton onClick={batDauSua} aria-label={t("Sửa thuế GTGT")} /> : null}
      />
      <div className="px-5 text-sm">
        <div className="mt-2 flex items-center gap-x-6 gap-y-3 border-t border-[#eef1f5] pt-3.5 pb-4">
          <div className="min-w-0 flex-1">
            <p className="leading-5 font-medium text-bo-foreground" id="vat-in-thue">{t("In thuế GTGT")}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-[#5b6676]">{t("Giá bán đã gồm thuế: tiền thuế tách ra từ tổng thanh toán, số khách trả không đổi.")}</p>
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
              {dangBat ? t("Đang bật") : t("Đang tắt")}
            </span>
          )}
        </div>

        {/* Đang sửa: lịch chiếm cả chiều ngang, ví dụ hóa đơn xuống dưới — hàng nhập cần chỗ khi app còn thanh bên */}
        <div className={cn("grid items-start gap-x-6 gap-y-4 border-t border-[#eef1f5] pt-1 pb-5", !editing && "md:grid-cols-[minmax(0,1fr)_18rem]")}>
          <div className="min-w-0">
            <SettingsGroupLabel className="pb-2">{t("Lịch thuế suất")}</SettingsGroupLabel>
            {loiBang ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-bo-border px-3.5 py-3 text-[#5b6676]">
                <span className="min-w-0 flex-1">{t("Không tải được bảng thuế suất.")}</span>
                <SettingsTextButton onClick={load}>{t("Thử lại")}</SettingsTextButton>
              </div>
            ) : editing ? (
              <LichThueSuatSua bang={bang} loi={loi} danhMuc={danhMuc} disabled={saving} onDoiBang={setBang} onThemDong={toiDong} />
            ) : (
              <>
                <LichThueSuatXem thueSuat={thueSuat} homNay={ngay} />
                <p className="mt-2 mb-0 text-xs leading-5 text-[#5b6676]">{t("Dùng chung cho hóa đơn bán hàng và xuất kế toán.")}</p>
              </>
            )}
          </div>

          <div className={cn("min-w-0", editing && "md:max-w-[18rem]")}>
            <SettingsGroupLabel className="pb-2">{t("Hóa đơn sẽ in như sau")}</SettingsGroupLabel>
            {/* Cùng chữ với khối tổng của mẫu in (printSchemas: grandTotal, vatNote, vatPreTax, vatAmount) */}
            <div className="rounded-md border border-bo-border px-3.5 pt-3 pb-3.5 text-[13px] leading-5 tabular-nums">
              <DongHoaDon className="font-semibold text-bo-foreground" nhan={t("Tổng thanh toán")} giaTri={formatCurrency(viDu)} />
              {loiBang ? null : tsHomNay == null ? (
                <p className="mt-2 text-xs leading-4 text-[#5b6676]">{t("Hôm nay chưa có mức chung: hóa đơn không in thuế.")}</p>
              ) : (
                <>
                  <div className={cn("text-[#5b6676]", !dangBat && "opacity-45")}>
                    <p className="mt-1.5 mb-1 text-xs italic">{t("Giá đã gồm thuế GTGT, trong đó:")}</p>
                    <DongHoaDon className="pl-3" nhan={t("Tiền trước thuế")} giaTri={formatCurrency(viDu - thue)} />
                    <DongHoaDon className="mt-0.5 pl-3" nhan={t("Thuế GTGT ({{tyLe}}%)", { tyLe: tsHomNay })} giaTri={formatCurrency(thue)} />
                  </div>
                  {!dangBat ? <p className="mt-2 text-xs leading-4 text-[#5b6676]">{t("Đang tắt: hóa đơn chỉ in Tổng thanh toán, không in các dòng mờ.")}</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="m-0 flex gap-2 border-t border-[#eef1f5] px-5 py-3 text-xs leading-5 text-[#5b6676]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#7a8594]" aria-hidden="true" />
        <span>{t("Thuế ghi vào đơn lúc chốt; đơn giao sau tính lại theo ngày giao khi xuất đủ hàng. Đơn sàn không in thuế. Nên hỏi kế toán trước khi bật hoặc đổi thuế suất.")}</span>
      </p>
      {editing ? (
        <>
          {saveError ? (
            <div role="alert" className="mx-5 mb-3 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-bo-danger-soft px-3 py-2 text-[13px] leading-5 text-red-800">
              <span className="min-w-0 flex-1">{saveError}</span>
              {phaiTaiLai ? <SettingsTextButton onClick={taiLaiBang}>{t("Tải lại bảng")}</SettingsTextButton> : null}
            </div>
          ) : null}
          <SettingsFormActions className="mt-0" onCancel={huySua} saving={saving} disabled={!doi} />
        </>
      ) : null}
    </SettingsCard>

    <ConfirmModal
      isOpen={Boolean(xoaCho)}
      onClose={() => !saving && setXoaCho(null)}
      onConfirm={gui}
      isLoading={saving}
      variant="danger"
      title={xoaCho?.length > 1 ? t("Xóa {{count}} dòng thuế suất?", { count: xoaCho.length }) : t("Xóa dòng thuế suất?")}
      description={xoaCho ? t("Lưu sẽ xóa: {{danhSach}}. Đơn đã giao và chứng từ đã giao kế toán không đổi; đơn chưa giao và lần xuất kế toán sau dùng bảng mới.", { danhSach: xoaCho.map((ts) => `${Number(ts.tyLe)}% ${khoangNgay(ts).toLowerCase()}${ts.tenDanhMuc ? ` (${ts.tenDanhMuc})` : ""}`).join("; ") }) : ""}
      confirmText={t("Xóa và lưu")}
      cancelText={t("Quay lại sửa")}
    />
    </>
  );
}
