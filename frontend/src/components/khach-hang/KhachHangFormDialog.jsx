import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2, Lock, Pencil, Plus, UserPlus, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { themKhachHang, timKhachTrungLienHe, updateKhachHang } from "@/services/khachHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  NHAN_O,
  THU_TU_O,
  cacOThayDoi,
  canKiemTrung,
  chuanHoaMaKhiNhap,
  chuanHoaSoDienThoaiKhiNhap,
  formThemCoNhap,
  formTuKhachHang,
  kiemTraForm,
  oCuaThongBaoMayChu,
  payloadSua,
  payloadThem,
  thongBaoTrung,
} from "./quyTacKhachHang";
import { t } from "@/i18n";

const CONTROL_CLASS =
  "h-10 border-bo-border bg-white text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 max-sm:h-11 max-sm:text-base";
const CONTROL_ERROR_CLASS = "border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15";
const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
// Hai ô liên hệ ràng buộc nhau ("cần ít nhất một"): sửa ô này thì kiểm tra lại cả ô kia.
const LIEN_QUAN = { soDienThoai: ["email"], email: ["soDienThoai"] };
// Ô kiểm trùng với khách khác khi rời ô (máy chủ cũng chặn khi lưu).
const O_KIEM_TRUNG = ["soDienThoai", "email"];

// Cả form chỉ đánh dấu ô bắt buộc (*); ô không đánh dấu là để trống được.
function Field({ id, label, required = false, error, kiemTra, extra, className, children }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="gap-0.5 text-sm font-medium text-bo-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-bo-danger">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="flex items-start gap-1.5 text-xs leading-5 text-bo-danger">
          <AlertCircle className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {error}
            {extra}
          </span>
        </p>
      ) : kiemTra ? (
        <p id={`${id}-message`} role="status" className="flex items-center gap-1.5 text-xs leading-5 text-bo-muted">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          {kiemTra}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Popup Thêm / Sửa khách hàng (chốt 19/10/2026), dùng ở danh sách và trang chi tiết khách hàng.
 * - `khachHang` có giá trị = sửa (mã cố định, chỉ hiện ở dòng mô tả); không có = thêm mới (mã để trống thì tự tạo).
 * - Không có ô trạng thái: khách mới luôn Hoạt động; ngừng / cho phép hoạt động là thao tác riêng (nút ⋯).
 * - Lỗi hiện ngay dưới từng ô; trùng số điện thoại / email báo ngay khi rời ô, kèm link mở khách đã có.
 * - Sửa: chỉ gửi các ô đã đổi; chưa đổi gì thì nút Lưu mờ.
 * - Đóng (✕, Hủy, Esc, bấm ra ngoài) khi có thay đổi thì hỏi lại; đang lưu thì không đóng được.
 * - `oMoDau`: ô đặt con trỏ khi mở (VD "email" khi bấm "Chưa có email · Thêm").
 * - `onSaved(khachHang, { laSua })` nhận khách máy chủ trả về.
 */
export default function KhachHangFormDialog({ open, onOpenChange, khachHang = null, oMoDau, onSaved }) {
  // Mỗi lần mở là một phiên nhập mới; không xóa form lúc đóng để nội dung không trắng khi hiệu ứng đóng còn chạy.
  const [phien, setPhien] = useState(0);
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) setPhien((n) => n + 1);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(mo) => {
        if (!mo) onOpenChange(false);
      }}
    >
      <KhachHangForm
        key={phien}
        khachHang={khachHang}
        oMoDau={oMoDau}
        onClose={() => onOpenChange(false)}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function KhachHangForm({ khachHang, oMoDau, onClose, onSaved }) {
  const laSua = Boolean(khachHang?.id);
  const idPrefix = useId();
  const fieldId = (name) => `${idPrefix}-${name}`;
  const formId = fieldId("form");

  const [banDau] = useState(() => formTuKhachHang(khachHang));
  const [form, setForm] = useState(banDau);
  const [errors, setErrors] = useState({});
  const [trung, setTrung] = useState({});
  const [dangKiem, setDangKiem] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inputRefs = useRef({});
  const formRef = useRef(form);
  const kiemTraRefs = useRef({});
  const returnFocusRef = useRef(null);
  const confirmReturnFocusRef = useRef(null);
  const discardingRef = useRef(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(
    () => () => {
      Object.values(kiemTraRefs.current).forEach((controller) => controller?.abort());
    },
    [],
  );

  const tuyChon = { laSua, banDau };
  const doiDs = laSua ? cacOThayDoi(form, banDau) : [];
  const isDirty = laSua ? doiDs.length > 0 : formThemCoNhap(form);
  const oDau = oMoDau && THU_TU_O.includes(oMoDau) ? oMoDau : "tenKhachHang";

  const focusField = (name) => {
    const element = inputRefs.current[name];
    if (!element) return;
    element.focus();
    const end = element.value?.length;
    if (typeof end === "number") element.setSelectionRange?.(end, end);
  };

  const setFieldError = (name, message) => {
    setErrors((prev) => ((prev[name] || "") === message ? prev : { ...prev, [name]: message }));
  };

  const huyKiemTrung = (name) => {
    kiemTraRefs.current[name]?.abort();
    kiemTraRefs.current[name] = null;
    setDangKiem((prev) => (prev[name] ? { ...prev, [name]: false } : prev));
  };

  const changeField = (name, value) => {
    const next = { ...form, [name]: value };
    setForm(next);
    setSubmitError("");
    if (O_KIEM_TRUNG.includes(name)) {
      huyKiemTrung(name);
      setTrung((prev) => (prev[name] ? { ...prev, [name]: null } : prev));
    }
    // Ô đã báo lỗi: kiểm tra lại ngay (lỗi trùng / lỗi máy chủ cũng mất khi giá trị đổi).
    const loi = kiemTraForm(next, tuyChon);
    // Ô liên quan không đổi giá trị: đang báo trùng với khách khác thì vẫn trùng, giữ câu báo trùng.
    const loiO = (field) => loi[field] || (field !== name && trung[field] ? thongBaoTrung(field, trung[field]) : "");
    [name, ...(LIEN_QUAN[name] ?? [])].forEach((field) => {
      if (errors[field]) setFieldError(field, loiO(field));
    });
  };

  const kiemTrung = async (name, giaTri) => {
    huyKiemTrung(name);
    const controller = new AbortController();
    kiemTraRefs.current[name] = controller;
    setDangKiem((prev) => ({ ...prev, [name]: true }));
    try {
      const khach = await timKhachTrungLienHe(name, giaTri, { boQuaId: khachHang?.id, signal: controller.signal });
      if (controller.signal.aborted || formRef.current[name].trim() !== giaTri) return;
      setTrung((prev) => ({ ...prev, [name]: khach }));
      if (khach) setFieldError(name, thongBaoTrung(name, khach));
    } catch {
      // Không kiểm tra được thì thôi: máy chủ vẫn chặn trùng khi bấm Lưu.
    } finally {
      if (kiemTraRefs.current[name] === controller) {
        kiemTraRefs.current[name] = null;
        setDangKiem((prev) => ({ ...prev, [name]: false }));
      }
    }
  };

  const handleBlur = (name) => {
    // Ô trống không bị "mắng" khi chỉ đi ngang qua; quy tắc "cần ít nhất một liên hệ" chỉ báo khi bấm Lưu.
    if (!String(form[name] ?? "").trim()) return;
    const loi = kiemTraForm(form, tuyChon)[name] || "";
    if (loi || !trung[name]) setFieldError(name, loi);
    if (O_KIEM_TRUNG.includes(name) && !trung[name] && canKiemTrung(name, form, tuyChon)) {
      kiemTrung(name, form[name].trim());
    }
  };

  const requestClose = () => {
    if (submitting) return;
    if (isDirty) {
      confirmReturnFocusRef.current = document.activeElement;
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const showServerError = (error) => {
    if (!error?.response) {
      setSubmitError(
        t("Không kết nối được máy chủ. Thông tin bạn nhập vẫn còn, bấm {{nut}} để thử lại.", { nut: laSua ? t("Lưu thay đổi") : t("Thêm khách hàng") }),
      );
      return;
    }
    const message = getApiErrorMessage(
      error,
      laSua ? t("Không thể lưu thay đổi. Vui lòng thử lại.") : t("Không thể thêm khách hàng. Vui lòng thử lại."),
    );
    const field = oCuaThongBaoMayChu(message);
    if (field && !(laSua && field === "maKhachHang")) {
      setFieldError(field, message);
      // Chờ render xong (ô hết readOnly) rồi mới focus vào ô cần sửa.
      setTimeout(() => focusField(field), 0);
    } else {
      setSubmitError(message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || (laSua && !isDirty)) return;

    const nextErrors = kiemTraForm(form, tuyChon);
    O_KIEM_TRUNG.forEach((name) => {
      if (!nextErrors[name] && trung[name]) nextErrors[name] = thongBaoTrung(name, trung[name]);
    });
    setErrors(nextErrors);
    setSubmitError("");
    const firstInvalid = THU_TU_O.find((name) => nextErrors[name]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    O_KIEM_TRUNG.forEach(huyKiemTrung);
    setSubmitting(true);
    try {
      const saved = laSua
        ? await updateKhachHang(khachHang.id, payloadSua(form, banDau))
        : await themKhachHang(payloadThem(form));
      onSaved?.(saved, { laSua });
      onClose();
    } catch (error) {
      showServerError(error);
      setSubmitting(false);
    }
  };

  const describedBy = (name) => (errors[name] || dangKiem[name] ? `${fieldId(name)}-message` : undefined);

  const textInputProps = (name) => ({
    id: fieldId(name),
    ref: (element) => {
      inputRefs.current[name] = element;
    },
    value: form[name],
    onBlur: () => handleBlur(name),
    readOnly: submitting,
    autoComplete: "off",
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name),
    className: cn(CONTROL_CLASS, errors[name] && CONTROL_ERROR_CLASS),
    onChange: (event) => changeField(name, event.target.value),
  });

  const moKhachTrung = (name) =>
    trung[name]?.id ? (
      <>
        {" · "}
        <a
          href={`/customers/${trung[name].id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-bo-primary underline-offset-2 hover:underline"
        >
          {t("Mở khách hàng")}
        </a>
      </>
    ) : null;

  const TitleIcon = laSua ? Pencil : UserPlus;

  return (
    <>
      <DialogContent
        showCloseButton={false}
        aria-busy={submitting}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current = document.activeElement;
          focusField(oDau);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected && target !== document.body) target.focus();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          // Bấm nhầm ra ngoài không làm mất dữ liệu: có thay đổi thì hỏi lại.
          requestClose();
        }}
        // Điện thoại: toàn màn. "!" để thắng lớp dùng chung của index.css (hộp thoại dưới 768px cao tối đa 100dvh − 24px và
        // tự cuộn): không có nó, thanh điều hướng đáy lộ một dải 24px dưới chân hộp; thân biểu mẫu tự cuộn, chân hộp luôn thấy.
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden border-bo-border bg-bo-surface p-0 text-bo-foreground sm:max-w-2xl max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none! max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:overflow-hidden!"
      >
        <div className="flex items-start gap-3 border-b border-bo-border px-5 py-4 max-sm:px-4 max-sm:py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary max-sm:hidden">
            <TitleIcon className="size-[18px]" aria-hidden="true" />
          </span>
          <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
            <DialogTitle className="text-base font-semibold leading-6 text-bo-foreground">
              {laSua ? t("Sửa khách hàng") : t("Thêm khách hàng")}
            </DialogTitle>
            <DialogDescription className="text-sm text-bo-muted">
              {laSua
                ? t("Ngừng hoặc cho phép hoạt động ở nút ⋯ trên trang khách hàng.")
                : t("Khách mới ở trạng thái Hoạt động, chọn được ngay khi bán tại quầy.")}
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            aria-label={t("Đóng")}
            title={t("Đóng")}
            className="-mr-1.5 -mt-0.5 rounded-md p-1.5 text-bo-muted transition-colors hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:pointer-events-none disabled:opacity-50 max-sm:-mr-2.5 max-sm:-mt-1.5 max-sm:p-3"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form
          id={formId}
          noValidate
          onSubmit={handleSubmit}
          aria-busy={submitting}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5 max-sm:px-4 max-sm:py-4"
        >
          {submitError ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          ) : null}

          {/* Tên | Mã. Thêm và Sửa cùng bố cục: khi sửa, mã hiện ở ô khóa. */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field id={fieldId("tenKhachHang")} label={t("Tên khách hàng")} required error={errors.tenKhachHang}>
              <Input {...textInputProps("tenKhachHang")} aria-required="true" placeholder={t("VD: Nguyễn Văn An")} />
            </Field>
            {laSua ? (
              <Field id={fieldId("maKhachHang")} label={t("Mã khách hàng")}>
                <div className="relative">
                  <Input
                    id={fieldId("maKhachHang")}
                    value={khachHang.maKhachHang ?? ""}
                    readOnly
                    aria-readonly="true"
                    title={t("Mã cố định sau khi tạo")}
                    className={cn(CONTROL_CLASS, "bg-bo-surface-subtle pr-9 font-mono font-semibold text-slate-700")}
                  />
                  <Lock
                    className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
              </Field>
            ) : (
              <Field id={fieldId("maKhachHang")} label={t("Mã khách hàng")} error={errors.maKhachHang}>
                <Input
                  {...textInputProps("maKhachHang")}
                  placeholder={t("Tự tạo khi lưu")}
                  title={t("Để trống thì hệ thống tự tạo mã. Chỉ nhập khi cần giữ mã từ sổ cũ.")}
                  spellCheck={false}
                  autoCapitalize="characters"
                  className={cn(CONTROL_CLASS, "font-mono placeholder:font-sans", errors.maKhachHang && CONTROL_ERROR_CLASS)}
                  onChange={(event) => changeField("maKhachHang", chuanHoaMaKhiNhap(event.target.value))}
                />
              </Field>
            )}
          </div>

          <section aria-labelledby={fieldId("lien-he")} className="mt-5 border-t border-bo-border pt-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h3 id={fieldId("lien-he")} className="text-sm font-semibold text-bo-foreground">
                {t("Liên hệ")}
              </h3>
              <span className="text-xs text-bo-muted">{t("Cần ít nhất số điện thoại hoặc email")}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <Field
                id={fieldId("soDienThoai")}
                label={t("Số điện thoại")}
                error={errors.soDienThoai}
                kiemTra={dangKiem.soDienThoai ? t("Đang kiểm tra trùng số...") : ""}
                extra={moKhachTrung("soDienThoai")}
              >
                <Input
                  {...textInputProps("soDienThoai")}
                  type="tel"
                  inputMode="numeric"
                  className={cn(CONTROL_CLASS, "tabular-nums", errors.soDienThoai && CONTROL_ERROR_CLASS)}
                  onChange={(event) => changeField("soDienThoai", chuanHoaSoDienThoaiKhiNhap(event.target.value))}
                />
              </Field>

              <Field
                id={fieldId("email")}
                label="Email"
                error={errors.email}
                kiemTra={dangKiem.email ? t("Đang kiểm tra trùng email...") : ""}
                extra={moKhachTrung("email")}
              >
                <Input
                  {...textInputProps("email")}
                  type="text"
                  inputMode="email"
                  placeholder={t("VD: {{viDu}}", { viDu: "lienhe@congty.vn" })}
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </Field>

              <Field id={fieldId("diaChi")} label={t("Địa chỉ")} error={errors.diaChi} className="sm:col-span-2">
                <Textarea
                  {...textInputProps("diaChi")}
                  rows={2}
                  placeholder={t("VD: 27 Trần Phú, Hải Châu, Đà Nẵng")}
                  className={cn(
                    "min-h-[64px] resize-y border-bo-border bg-bo-surface text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 max-sm:text-base",
                    errors.diaChi && CONTROL_ERROR_CLASS,
                  )}
                />
              </Field>
            </div>
          </section>
        </form>

        <div className="flex items-center gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3 max-sm:px-4">
          <span role="status" className="min-w-0 flex-1 truncate text-xs leading-4 text-bo-muted max-sm:hidden">
            {laSua ? (doiDs.length ? t("Đã sửa: {{dsO}}", { dsO: doiDs.map((name) => NHAN_O[name]).join(", ") }) : t("Chưa có thay đổi")) : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            disabled={submitting}
            className={cn(NUT_VIEN, "max-sm:h-11 max-sm:flex-1")}
          >
            {t("Hủy")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={submitting || (laSua && !isDirty)}
            title={laSua && !isDirty ? t("Chưa có thay đổi để lưu") : undefined}
            className="min-w-[168px] bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:h-11 max-sm:min-w-0 max-sm:flex-[2]"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t("Đang lưu...")}
              </>
            ) : laSua ? (
              t("Lưu thay đổi")
            ) : (
              <>
                <Plus className="size-4" aria-hidden="true" />
                {t("Thêm khách hàng")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent
          className="border-bo-border bg-bo-surface sm:max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Bỏ thay đổi: popup cũng đóng, focus do popup trả về nút đã mở nó.
            if (discardingRef.current) return;
            const target = confirmReturnFocusRef.current;
            if (target?.isConnected) target.focus();
            else focusField(oDau);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-bo-foreground">
              {laSua ? t("Bỏ các thay đổi?") : t("Bỏ thông tin đang nhập?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-bo-muted">
              {laSua ? t("Những gì bạn vừa sửa sẽ không được lưu.") : t("Thông tin bạn đã nhập sẽ không được lưu.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className={NUT_VIEN}>{laSua ? t("Tiếp tục sửa") : t("Tiếp tục nhập")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                discardingRef.current = true;
                setConfirmDiscard(false);
                onClose();
              }}
              className="bg-bo-danger text-white hover:bg-bo-danger/90"
            >
              {laSua ? t("Bỏ thay đổi") : t("Bỏ thông tin")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
