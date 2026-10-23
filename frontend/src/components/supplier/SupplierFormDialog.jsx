import { useId, useRef, useState } from "react";
import { AlertCircle, Building2, Loader2, Pencil, Plus, X } from "lucide-react";

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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createSupplier, updateSupplier } from "@/services/supplierService";
import { getApiErrorMessage } from "@/utils/apiError";
import {
    MAX_LENGTH,
    VALIDATORS,
    chiGiuChuSo,
    formTuNhaCungCap,
    oCuaThongBaoMayChu,
    payloadTuForm,
} from "./quyTacNhaCungCap";

// Thứ tự trên màn hình: lỗi đầu tiên theo thứ tự này được focus khi bấm Lưu.
// Không có ô Ngân hàng / Số tài khoản: không quản lý thanh toán nhà cung cấp (chốt 16/10, gỡ ô 22/10/2026). Khi sửa,
// payloadTuForm gửi lại nguyên giá trị đang có (PUT /api/supplier/{id} ghi đè mọi trường, bỏ trống là xóa mất).
const FIELDS = ["maNhaCungCap", "tenNhaCungCap", "nguoiLienHe", "soDienThoai", "email", "diaChi"];

const CONTROL_CLASS =
    "h-10 border-bo-border bg-white text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15";
const CONTROL_ERROR_CLASS =
    "border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15";

function getSubmitErrorMessage(error, laSua) {
    if (!error?.response) {
        return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.";
    }
    return getApiErrorMessage(
        error,
        laSua ? "Không thể lưu thay đổi. Vui lòng thử lại." : "Không thể thêm nhà cung cấp. Vui lòng thử lại.",
    );
}

function Field({ id, label, required = false, hint, error, className, children }) {
    return (
        <div className={cn("space-y-1.5", className)}>
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
                    <AlertCircle className="mt-[3px] size-3.5 shrink-0" />
                    <span>{error}</span>
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
 * Popup Thêm / Sửa nhà cung cấp (dùng ở danh sách, trang chi tiết và màn Gửi yêu cầu báo giá).
 * - `supplier` có giá trị = sửa (mã khóa lại); không có = thêm mới.
 * - Không có ô trạng thái: nhà cung cấp mới luôn Hoạt động; ngừng / cho phép hoạt động là thao tác riêng.
 * - Lỗi hiện ngay dưới từng ô (không dùng toast: lớp phủ của popup che mất toast).
 * - Đang nhập dở mà đóng (Esc, nút X, Hủy) thì hỏi lại; bấm ra ngoài không làm mất dữ liệu.
 * - `onSaved(supplier, { laSua })` nhận dữ liệu nhà cung cấp máy chủ trả về.
 * - `oDauTien`: tên ô có tiêu điểm khi mở (vd. "email" khi mở để cập nhật email ở màn Gửi yêu cầu báo giá); mặc định ô
 *   đầu tiên sửa được.
 */
export default function SupplierFormDialog({ open, onOpenChange, supplier = null, onSaved, oDauTien = null }) {
    // Mỗi lần mở là một phiên nhập mới: đổi key lúc chuyển đóng → mở.
    // Không xóa form lúc đóng để nội dung không bị trắng khi hiệu ứng đóng còn đang chạy.
    const [session, setSession] = useState(0);
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) setSession((value) => value + 1);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onOpenChange(false);
            }}
        >
            <SupplierForm
                key={session}
                supplier={supplier}
                onClose={() => onOpenChange(false)}
                onSaved={onSaved}
                oDauTien={oDauTien}
            />
        </Dialog>
    );
}

function SupplierForm({ supplier, onClose, onSaved, oDauTien }) {
    const laSua = Boolean(supplier?.id);
    const idPrefix = useId();
    const fieldId = (name) => `${idPrefix}-${name}`;
    const formId = fieldId("form");

    const [initial] = useState(() => formTuNhaCungCap(supplier));
    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const inputRefs = useRef({});
    // Nút đã mở popup: đóng xong trả focus về đó (popup mở bằng state, không qua DialogTrigger).
    const returnFocusRef = useRef(null);
    const confirmReturnFocusRef = useRef(null);
    const discardingRef = useRef(false);

    const firstField = FIELDS.includes(oDauTien) && !(laSua && oDauTien === "maNhaCungCap")
        ? oDauTien
        : laSua ? "tenNhaCungCap" : "maNhaCungCap";
    const isDirty = FIELDS.some((name) => form[name].trim() !== initial[name].trim());

    const focusField = (name) => {
        const element = inputRefs.current[name];
        if (!element) return;
        element.focus();
        const end = element.value?.length ?? 0;
        element.setSelectionRange?.(end, end);
    };

    const setFieldError = (name, message) => {
        setErrors((prev) => ((prev[name] || "") === message ? prev : { ...prev, [name]: message }));
    };

    const changeField = (name, value) => {
        const next = { ...form, [name]: value };
        setForm(next);
        setSubmitError("");
        // Ô đã báo lỗi: kiểm tra lại ngay (lỗi từ máy chủ cũng mất khi giá trị đổi).
        if (errors[name]) setFieldError(name, VALIDATORS[name](next[name], next));
    };

    const handleBlur = (name) => {
        // Ô trống không bị "mắng" khi chỉ đi ngang qua; chỉ báo khi bấm Lưu.
        if (!form[name].trim()) return;
        setFieldError(name, VALIDATORS[name](form[name], form));
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

    const showServerErrors = (error) => {
        const message = getSubmitErrorMessage(error, laSua);
        // Lỗi kiểm tra dữ liệu (400) của backend kèm map { tenTruong: câu báo lỗi }.
        const fieldErrors = error?.response?.data?.data;
        const fromMap = fieldErrors && typeof fieldErrors === "object" && !Array.isArray(fieldErrors)
            ? FIELDS.filter((name) => typeof fieldErrors[name] === "string")
            : [];
        if (fromMap.length > 0) {
            setErrors((prev) => {
                const next = { ...prev };
                fromMap.forEach((name) => {
                    next[name] = fieldErrors[name];
                });
                return next;
            });
            setTimeout(() => focusField(fromMap[0]), 0);
            return;
        }
        // Chỉ gắn vào ô đang có trên hộp. Câu về ngân hàng / số tài khoản là dữ liệu cũ không hợp lệ mà hộp không còn ô để sửa.
        const field = error?.response ? oCuaThongBaoMayChu(message) : null;
        if (field && FIELDS.includes(field) && !(laSua && field === "maNhaCungCap")) {
            setFieldError(field, message);
            // Chờ render xong (ô hết readOnly) rồi mới focus vào ô cần sửa.
            setTimeout(() => focusField(field), 0);
        } else if (field === "nganHang" || field === "soNganHang") {
            setSubmitError(
                `Chưa lưu được vì thông tin ngân hàng đã lưu của nhà cung cấp này không hợp lệ (${message.replace(/\.$/, "")}). Hãy báo quản trị hệ thống.`,
            );
        } else {
            setSubmitError(message);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitting) return;

        const nextErrors = {};
        FIELDS.forEach((name) => {
            if (laSua && name === "maNhaCungCap") return;
            const message = VALIDATORS[name](form[name], form);
            if (message) nextErrors[name] = message;
        });
        setErrors(nextErrors);
        setSubmitError("");

        const firstInvalid = FIELDS.find((name) => nextErrors[name]);
        if (firstInvalid) {
            focusField(firstInvalid);
            return;
        }

        setSubmitting(true);
        try {
            const payload = payloadTuForm(form, { laSua });
            const saved = laSua
                ? await updateSupplier(supplier.id, payload)
                : await createSupplier(payload);
            onSaved?.(saved ?? { ...supplier, ...payload }, { laSua });
            onClose();
        } catch (error) {
            showServerErrors(error);
            setSubmitting(false);
        }
    };

    const describedBy = (name, hasHint = false) =>
        (errors[name] || hasHint ? `${fieldId(name)}-message` : undefined);

    const textInputProps = (name, hasHint = false) => ({
        id: fieldId(name),
        ref: (element) => {
            inputRefs.current[name] = element;
        },
        value: form[name],
        onBlur: () => handleBlur(name),
        readOnly: submitting,
        autoComplete: "off",
        "aria-invalid": errors[name] ? true : undefined,
        "aria-describedby": describedBy(name, hasHint),
        className: cn(CONTROL_CLASS, errors[name] && CONTROL_ERROR_CLASS),
    });

    const TitleIcon = laSua ? Pencil : Building2;

    return (
        <>
            <DialogContent
                showCloseButton={false}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    returnFocusRef.current = document.activeElement;
                    focusField(firstField);
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
                // Bấm nhầm ra ngoài không làm mất dữ liệu đang nhập; form chưa đổi thì đóng như bình thường.
                onInteractOutside={(event) => {
                    event.preventDefault();
                    if (!submitting && !isDirty) onClose();
                }}
                className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden border-bo-border bg-white p-0 text-bo-foreground sm:max-w-2xl"
            >
                <div className="flex items-start gap-3 border-b border-bo-border px-5 py-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                        <TitleIcon className="size-[18px]" />
                    </span>
                    <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
                        <DialogTitle className="text-base font-semibold leading-6 text-bo-foreground">
                            {laSua ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-bo-muted">
                            {laSua
                                ? `Mã ${supplier.maNhaCungCap} cố định sau khi tạo, các thông tin khác sửa được.`
                                : "Nhà cung cấp mới ở trạng thái Hoạt động, nhận được yêu cầu báo giá ngay."}
                        </DialogDescription>
                    </DialogHeader>
                    <button
                        type="button"
                        onClick={requestClose}
                        disabled={submitting}
                        aria-label="Đóng"
                        className="-mr-1.5 -mt-0.5 rounded-md p-1.5 text-bo-muted transition-colors hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:pointer-events-none disabled:opacity-50"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <form
                    id={formId}
                    noValidate
                    onSubmit={handleSubmit}
                    aria-busy={submitting}
                    className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
                >
                    {submitError ? (
                        <div
                            role="alert"
                            className="mb-4 flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger"
                        >
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            <span>{submitError}</span>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                        <Field
                            id={fieldId("maNhaCungCap")}
                            label="Mã nhà cung cấp"
                            required={!laSua}
                            error={errors.maNhaCungCap}
                            hint={laSua ? null : "Chữ không dấu, số và . _ -"}
                        >
                            <Input
                                {...textInputProps("maNhaCungCap", !laSua)}
                                aria-required={laSua ? undefined : "true"}
                                disabled={laSua}
                                maxLength={MAX_LENGTH.maNhaCungCap}
                                placeholder="VD: NCC001"
                                spellCheck={false}
                                autoCapitalize="characters"
                                className={cn(
                                    CONTROL_CLASS,
                                    "font-mono",
                                    laSua && "disabled:bg-bo-surface-subtle disabled:opacity-100",
                                    errors.maNhaCungCap && CONTROL_ERROR_CLASS,
                                )}
                                onChange={(event) => changeField("maNhaCungCap", event.target.value)}
                            />
                        </Field>

                        <Field
                            id={fieldId("tenNhaCungCap")}
                            label="Tên nhà cung cấp"
                            required
                            error={errors.tenNhaCungCap}
                        >
                            <Input
                                {...textInputProps("tenNhaCungCap")}
                                aria-required="true"
                                maxLength={MAX_LENGTH.tenNhaCungCap}
                                placeholder="VD: Công ty TNHH May mặc Hà Nội"
                                onChange={(event) => changeField("tenNhaCungCap", event.target.value)}
                            />
                        </Field>

                        <Field id={fieldId("nguoiLienHe")} label="Người liên hệ" error={errors.nguoiLienHe}>
                            <Input
                                {...textInputProps("nguoiLienHe")}
                                maxLength={MAX_LENGTH.nguoiLienHe}
                                placeholder="VD: Nguyễn Văn An"
                                onChange={(event) => changeField("nguoiLienHe", event.target.value)}
                            />
                        </Field>

                        <Field id={fieldId("soDienThoai")} label="Số điện thoại" required error={errors.soDienThoai}>
                            <Input
                                {...textInputProps("soDienThoai")}
                                aria-required="true"
                                type="tel"
                                inputMode="numeric"
                                // Không đặt maxLength: dán "024-3825-1234" thì trình duyệt cắt theo số ký tự
                                // trước khi bỏ dấu "-"; chiGiuChuSo đã giới hạn số chữ số. Không đặt số mẫu làm gợi ý.
                                onChange={(event) =>
                                    changeField("soDienThoai", chiGiuChuSo(event.target.value, MAX_LENGTH.soDienThoai))}
                            />
                        </Field>

                        <Field
                            id={fieldId("email")}
                            label="Email"
                            required
                            error={errors.email}
                            hint="Yêu cầu báo giá được gửi tới email này; nhà cung cấp cũng dùng email này để vào trang báo giá."
                            className="sm:col-span-2"
                        >
                            <Input
                                {...textInputProps("email", true)}
                                aria-required="true"
                                type="text"
                                inputMode="email"
                                maxLength={MAX_LENGTH.email}
                                placeholder="VD: lienhe@congty.vn"
                                spellCheck={false}
                                autoCapitalize="none"
                                onChange={(event) => changeField("email", event.target.value)}
                            />
                        </Field>

                        <Field id={fieldId("diaChi")} label="Địa chỉ" error={errors.diaChi} className="sm:col-span-2">
                            <Textarea
                                {...textInputProps("diaChi")}
                                rows={2}
                                maxLength={MAX_LENGTH.diaChi}
                                placeholder="VD: Số 8 Tôn Thất Thuyết, Cầu Giấy, Hà Nội"
                                className={cn(
                                    "min-h-[64px] resize-y border-bo-border bg-white text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15",
                                    errors.diaChi && CONTROL_ERROR_CLASS,
                                )}
                                onChange={(event) => changeField("diaChi", event.target.value)}
                            />
                        </Field>
                    </div>
                </form>

                <div className="flex flex-col-reverse gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={requestClose}
                        disabled={submitting}
                        className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                    >
                        Hủy
                    </Button>
                    <Button
                        type="submit"
                        form={formId}
                        disabled={submitting}
                        className="min-w-[168px] bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Đang lưu...
                            </>
                        ) : laSua ? (
                            "Lưu thay đổi"
                        ) : (
                            <>
                                <Plus className="size-4" />
                                Thêm nhà cung cấp
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
                        else focusField(firstField);
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base text-bo-foreground">
                            {laSua ? "Bỏ các thay đổi?" : "Bỏ thông tin đang nhập?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-bo-muted">
                            {laSua
                                ? "Những gì bạn vừa sửa sẽ không được lưu."
                                : "Thông tin bạn đã nhập sẽ không được lưu."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle">
                            {laSua ? "Tiếp tục sửa" : "Tiếp tục nhập"}
                        </AlertDialogCancel>
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
