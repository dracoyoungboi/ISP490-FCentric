import { useEffect, useId, useRef, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { AlertCircle, Info, Loader2, Pencil, Plus, UserPlus, X } from "lucide-react";

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
  LOAI_KHACH_HANG,
  MAX_LENGTH,
  NHAN_O,
  THU_TU_O,
  cacOThayDoi,
  canKiemTrung,
  chuanHoaMaKhiNhap,
  chuanHoaMaSoThueKhiNhap,
  chuanHoaSoDienThoaiKhiNhap,
  formThemCoNhap,
  formTuKhachHang,
  goiYTen,
  hienMaSoThue,
  hienNguoiLienHe,
  kiemTraForm,
  nhanDiaChi,
  oCuaThongBaoMayChu,
  payloadSua,
  payloadThem,
  thongBaoTrung,
} from "./quyTacKhachHang";

const CONTROL_CLASS =
  "h-10 border-bo-border bg-white text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 max-sm:h-11 max-sm:text-base";
const CONTROL_ERROR_CLASS = "border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15";
const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
// Hai ô liên hệ ràng buộc nhau ("cần ít nhất một"): sửa ô này thì kiểm tra lại cả ô kia.
const LIEN_QUAN = { soDienThoai: ["email"], email: ["soDienThoai"] };
const O_KIEM_TRUNG = ["soDienThoai", "email"];

function Field({ id, label, required = false, optional = false, hint, error, kiemTra, extra, className, children }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="gap-0.5 text-sm font-medium text-bo-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-bo-danger">
            *
          </span>
        ) : null}
        {optional ? <span className="ml-1 font-normal text-bo-muted">(không bắt buộc)</span> : null}
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
      ) : hint ? (
        <p id={`${id}-message`} className="text-xs leading-5 text-bo-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Popup Thêm / Sửa khách hàng (chốt 19/10/2026), dùng ở danh sách và trang chi tiết khách hàng.
 * - `khachHang` có giá trị = sửa (mã cố định, chỉ hiện ở dòng mô tả); không có = thêm mới (mã để trống thì tự tạo).
 * - Không có ô trạng thái: khách mới luôn Hoạt động; ngừng / cho phép hoạt động là thao tác riêng (nút ⋯).
 * - Loại khách lên đầu: đổi gợi ý tên, hiện Người liên hệ cho khách sỉ / doanh nghiệp, đổi nhãn địa chỉ.
 *   Khách chưa phân loại không bị chọn sẵn Khách lẻ.
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
  const loaiRef = useRef(null);
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
  const coNguoiLienHe = hienNguoiLienHe(form, banDau);
  const coMaSoThue = hienMaSoThue(form, banDau);
  const oDau = oMoDau && THU_TU_O.includes(oMoDau) ? oMoDau : "tenKhachHang";

  const focusField = (name) => {
    // Loại khách: focus ô đang chọn, chưa chọn thì ô đầu (cách nhóm radio của trình duyệt).
    const element =
      name === "loaiKhachHang"
        ? loaiRef.current?.querySelector('[data-state="checked"]') ?? loaiRef.current?.querySelector('[role="radio"]')
        : inputRefs.current[name];
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
    [name, ...(LIEN_QUAN[name] ?? [])].forEach((field) => {
      if (errors[field]) setFieldError(field, loi[field] || "");
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
        `Không kết nối được máy chủ. Thông tin bạn nhập vẫn còn, bấm ${laSua ? "Lưu thay đổi" : "Thêm khách hàng"} để thử lại.`,
      );
      return;
    }
    const message = getApiErrorMessage(
      error,
      laSua ? "Không thể lưu thay đổi. Vui lòng thử lại." : "Không thể thêm khách hàng. Vui lòng thử lại.",
    );
    const field = oCuaThongBaoMayChu(message);
    if (
      field &&
      !(laSua && field === "maKhachHang") &&
      !(field === "nguoiLienHe" && !coNguoiLienHe) &&
      !(field === "maSoThue" && !coMaSoThue)
    ) {
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

  const describedBy = (name, coGoiY = false) =>
    errors[name] || dangKiem[name] || coGoiY ? `${fieldId(name)}-message` : undefined;

  const textInputProps = (name, coGoiY = false) => ({
    id: fieldId(name),
    ref: (element) => {
      inputRefs.current[name] = element;
    },
    value: form[name],
    onBlur: () => handleBlur(name),
    readOnly: submitting,
    autoComplete: "off",
    maxLength: MAX_LENGTH[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, coGoiY),
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
          Mở khách hàng
        </a>
      </>
    ) : null;

  const TitleIcon = laSua ? Pencil : UserPlus;
  const chuaPhanLoai = laSua && !form.loaiKhachHang;

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
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden border-bo-border bg-white p-0 text-bo-foreground sm:max-w-2xl max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
      >
        <div className="flex items-start gap-3 border-b border-bo-border px-5 py-4 max-sm:px-4 max-sm:py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary max-sm:hidden">
            <TitleIcon className="size-[18px]" aria-hidden="true" />
          </span>
          <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
            <DialogTitle className="text-base font-semibold leading-6 text-bo-foreground">
              {laSua ? "Sửa khách hàng" : "Thêm khách hàng"}
            </DialogTitle>
            <DialogDescription className="text-sm text-bo-muted">
              {laSua ? (
                <>
                  Mã <span className="font-mono font-semibold text-slate-700">{khachHang.maKhachHang}</span> cố định sau khi
                  tạo. Trạng thái đổi ở nút ⋯ trên trang khách hàng.
                </>
              ) : (
                "Khách mới ở trạng thái Hoạt động, chọn được ngay khi tạo báo giá, bán tại quầy."
              )}
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            aria-label="Đóng"
            title="Đóng"
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

          <div className="space-y-1.5">
            <span id={fieldId("loai-nhan")} className="text-sm font-medium text-bo-foreground">
              Loại khách hàng
            </span>
            <RadioGroupPrimitive.Root
              ref={loaiRef}
              value={form.loaiKhachHang}
              onValueChange={(value) => changeField("loaiKhachHang", value)}
              disabled={submitting}
              aria-labelledby={fieldId("loai-nhan")}
              aria-describedby={errors.loaiKhachHang ? `${fieldId("loaiKhachHang")}-message` : undefined}
              className="grid grid-cols-3 gap-2"
            >
              {LOAI_KHACH_HANG.map((loai) => (
                <RadioGroupPrimitive.Item
                  key={loai.value}
                  value={loai.value}
                  className="group flex min-w-0 items-start gap-2.5 rounded-lg border border-bo-border bg-white px-3 py-2.5 text-left text-bo-foreground transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary-soft/60 data-[state=checked]:shadow-[inset_0_0_0_1px_var(--color-bo-primary)] max-sm:flex-col max-sm:items-center max-sm:gap-1 max-sm:px-1.5 max-sm:py-2.5 max-sm:text-center"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-slate-400 bg-white group-data-[state=checked]:border-bo-primary"
                  >
                    <span className="size-2 rounded-full bg-bo-primary opacity-0 group-data-[state=checked]:opacity-100" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5 max-sm:text-[13px]">{loai.label}</span>
                    <span className="block text-xs leading-4 text-bo-muted max-sm:hidden">{loai.moTa}</span>
                  </span>
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
            {errors.loaiKhachHang ? (
              <p id={`${fieldId("loaiKhachHang")}-message`} className="flex items-start gap-1.5 text-xs leading-5 text-bo-danger">
                <AlertCircle className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.loaiKhachHang}</span>
              </p>
            ) : null}
            {chuaPhanLoai ? (
              <p className="flex items-start gap-2 rounded-md border border-slate-100 bg-bo-surface-subtle px-2.5 py-2 text-xs leading-[18px] text-slate-600">
                <Info className="mt-px size-3.5 shrink-0 text-bo-muted" aria-hidden="true" />
                <span>
                  Khách này chưa được phân loại (thường do tạo tự động từ đơn Shopify). Chọn loại nếu đã biết; để trống vẫn
                  lưu được.
                </span>
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field
              id={fieldId("tenKhachHang")}
              label="Tên khách hàng"
              required
              error={errors.tenKhachHang}
              className={laSua ? "sm:col-span-2" : undefined}
            >
              <Input {...textInputProps("tenKhachHang")} aria-required="true" placeholder={goiYTen(form.loaiKhachHang)} />
            </Field>
            {!laSua ? (
              <Field
                id={fieldId("maKhachHang")}
                label="Mã khách hàng"
                optional
                error={errors.maKhachHang}
                hint="Để trống thì hệ thống tự tạo mã khi lưu. Chỉ nhập khi cần giữ mã từ sổ cũ."
              >
                <Input
                  {...textInputProps("maKhachHang", true)}
                  placeholder="Để trống để tự tạo"
                  spellCheck={false}
                  autoCapitalize="characters"
                  className={cn(CONTROL_CLASS, "font-mono placeholder:font-sans", errors.maKhachHang && CONTROL_ERROR_CLASS)}
                  onChange={(event) => changeField("maKhachHang", chuanHoaMaKhiNhap(event.target.value))}
                />
              </Field>
            ) : null}
            {coMaSoThue ? (
              <Field
                id={fieldId("maSoThue")}
                label="Mã số thuế"
                optional
                error={errors.maSoThue}
                hint="In ở mục Người mua trên hóa đơn bán hàng"
              >
                <Input
                  {...textInputProps("maSoThue", true)}
                  // Không đặt maxLength: dán "0312.345.678-001" thì trình duyệt cắt còn 14 ký tự trước khi bỏ dấu
                  // chấm; chuanHoaMaSoThueKhiNhap đã giới hạn độ dài. Không dùng inputMode="numeric": bàn phím số
                  // của iOS không có dấu "-" để gõ mã đơn vị phụ thuộc.
                  maxLength={undefined}
                  placeholder="VD: 0312345678"
                  spellCheck={false}
                  className={cn(CONTROL_CLASS, "tabular-nums", errors.maSoThue && CONTROL_ERROR_CLASS)}
                  onChange={(event) => changeField("maSoThue", chuanHoaMaSoThueKhiNhap(event.target.value))}
                />
              </Field>
            ) : null}
          </div>

          <section aria-labelledby={fieldId("lien-he")} className="mt-5 border-t border-bo-border pt-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h3 id={fieldId("lien-he")} className="text-sm font-semibold text-bo-foreground">
                Liên hệ
              </h3>
              <span className="text-xs text-bo-muted">Cần ít nhất số điện thoại hoặc email</span>
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              {coNguoiLienHe ? (
                <Field
                  id={fieldId("nguoiLienHe")}
                  label="Người liên hệ"
                  error={errors.nguoiLienHe}
                  hint="Người đặt hàng, nhận báo giá bên phía khách"
                  className="sm:col-span-2"
                >
                  <Input {...textInputProps("nguoiLienHe", true)} placeholder="VD: Trần Thị Mai" />
                </Field>
              ) : null}

              <Field
                id={fieldId("soDienThoai")}
                label="Số điện thoại"
                error={errors.soDienThoai}
                kiemTra={dangKiem.soDienThoai ? "Đang kiểm tra trùng số..." : ""}
                hint="Di động, máy bàn hoặc tổng đài 1800/1900"
                extra={moKhachTrung("soDienThoai")}
              >
                <Input
                  {...textInputProps("soDienThoai", true)}
                  type="tel"
                  inputMode="numeric"
                  // Không đặt maxLength: dán "+84 912 345 678" thì trình duyệt cắt trước khi bỏ dấu;
                  // chuanHoaSoDienThoaiKhiNhap đã giới hạn số chữ số.
                  maxLength={undefined}
                  placeholder="VD: 0912345678"
                  className={cn(CONTROL_CLASS, "tabular-nums", errors.soDienThoai && CONTROL_ERROR_CLASS)}
                  onChange={(event) => changeField("soDienThoai", chuanHoaSoDienThoaiKhiNhap(event.target.value))}
                />
              </Field>

              <Field
                id={fieldId("email")}
                label="Email"
                error={errors.email}
                kiemTra={dangKiem.email ? "Đang kiểm tra trùng email..." : ""}
                extra={moKhachTrung("email")}
              >
                <Input
                  {...textInputProps("email")}
                  type="text"
                  inputMode="email"
                  placeholder="VD: lienhe@congty.vn"
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </Field>

              <Field
                id={fieldId("diaChi")}
                label={nhanDiaChi(form.loaiKhachHang)}
                error={errors.diaChi}
                hint="Tự điền làm địa chỉ giao hàng khi tạo báo giá cho khách này; sửa được trên từng báo giá."
                className="sm:col-span-2"
              >
                <Textarea
                  {...textInputProps("diaChi", true)}
                  rows={2}
                  placeholder="VD: 27 Trần Phú, Hải Châu, Đà Nẵng"
                  className={cn(
                    "min-h-[64px] resize-y border-bo-border bg-white text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 max-sm:text-base",
                    errors.diaChi && CONTROL_ERROR_CLASS,
                  )}
                />
              </Field>
            </div>
          </section>
        </form>

        <div className="flex items-center gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3 max-sm:px-4">
          <span role="status" className="min-w-0 flex-1 truncate text-xs leading-4 text-bo-muted max-sm:hidden">
            {laSua ? (doiDs.length ? `Đã sửa: ${doiDs.map((name) => NHAN_O[name]).join(", ")}` : "Chưa có thay đổi") : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            disabled={submitting}
            className={cn(NUT_VIEN, "max-sm:h-11 max-sm:flex-1")}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={submitting || (laSua && !isDirty)}
            title={laSua && !isDirty ? "Chưa có thay đổi để lưu" : undefined}
            className="min-w-[168px] bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:h-11 max-sm:min-w-0 max-sm:flex-[2]"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Đang lưu...
              </>
            ) : laSua ? (
              "Lưu thay đổi"
            ) : (
              <>
                <Plus className="size-4" aria-hidden="true" />
                Thêm khách hàng
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent
          className="border-bo-border bg-white sm:max-w-md"
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
              {laSua ? "Bỏ các thay đổi?" : "Bỏ thông tin đang nhập?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-bo-muted">
              {laSua ? "Những gì bạn vừa sửa sẽ không được lưu." : "Thông tin bạn đã nhập sẽ không được lưu."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className={NUT_VIEN}>{laSua ? "Tiếp tục sửa" : "Tiếp tục nhập"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                discardingRef.current = true;
                setConfirmDiscard(false);
                onClose();
              }}
              className="bg-bo-danger text-white hover:bg-bo-danger/90"
            >
              {laSua ? "Bỏ thay đổi" : "Bỏ thông tin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
