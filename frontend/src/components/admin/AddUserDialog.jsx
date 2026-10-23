import { useId, useRef, useState } from "react";
import { AlertCircle, Loader2, Mail, ShieldAlert, UserPlus, X } from "lucide-react";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ROLES } from "@/constants/backend/role";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/adminService";
import { getApiErrorMessage } from "@/utils/apiError";
import { PHONE_ERROR_MESSAGE, PHONE_REGEX, sanitizePhoneInput } from "@/utils/phoneValidation";

// Trùng regex của backend (NguoiDungService.EMAIL_PATTERN) để hai phía báo lỗi giống nhau.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Cột ten_dang_nhap dùng collation không phân biệt hoa/thường và dấu → chỉ cho chữ không dấu.
const USERNAME_REGEX = /^[A-Za-z0-9._-]+$/;
const USERNAME_MIN_LENGTH = 3;
// Bằng độ dài cột trong bảng nguoi_dung; vượt quá thì backend báo lỗi chung chung.
const MAX_LENGTH = { hoTen: 100, tenDangNhap: 50, email: 100 };

// Trùng mặc định của backend khi không gửi vai trò. Danh sách chọn theo đúng thứ tự trong ROLES (Quản trị viên cuối).
const DEFAULT_ROLE = "nhan_vien_kho";

const EMPTY_FORM = { hoTen: "", tenDangNhap: "", email: "", soDienThoai: "", vaiTro: DEFAULT_ROLE };
// Thứ tự trên màn hình: lỗi đầu tiên theo thứ tự này được focus khi bấm Tạo tài khoản.
const TEXT_FIELDS = ["hoTen", "tenDangNhap", "email", "soDienThoai"];

const VALIDATORS = {
    hoTen: (value) => (value.trim() ? "" : "Vui lòng nhập họ và tên"),
    tenDangNhap: (value) => {
        const username = value.trim();
        if (!username) return "Vui lòng nhập tên đăng nhập";
        if (!USERNAME_REGEX.test(username)) return "Chỉ dùng chữ không dấu, số và các ký tự . _ -";
        if (username.length < USERNAME_MIN_LENGTH) {
            return `Tên đăng nhập cần ít nhất ${USERNAME_MIN_LENGTH} ký tự`;
        }
        return "";
    },
    email: (value) => {
        const email = value.trim();
        if (!email) return "Vui lòng nhập email";
        if (!EMAIL_REGEX.test(email)) return "Vui lòng nhập đúng định dạng email";
        return "";
    },
    // SĐT không bắt buộc; có nhập thì phải đúng định dạng di động Việt Nam.
    soDienThoai: (value) => (!value || PHONE_REGEX.test(value) ? "" : PHONE_ERROR_MESSAGE),
};

/** "Nguyễn Văn Đức" → "nguyenvanduc" (gợi ý tên đăng nhập khi chưa tự nhập). */
function suggestUsername(fullName) {
    return fullName
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, MAX_LENGTH.tenDangNhap);
}

/** Lỗi trùng/sai định dạng từ backend gắn vào đúng ô; lỗi khác hiện ở đầu form. */
function fieldOfServerMessage(message) {
    const text = message.toLowerCase();
    if (text.includes("tên đăng nhập")) return "tenDangNhap";
    if (text.includes("email")) return "email";
    if (text.includes("số điện thoại")) return "soDienThoai";
    if (text.includes("họ tên") || text.includes("họ và tên")) return "hoTen";
    return null;
}

function getSubmitErrorMessage(error) {
    if (!error?.response) {
        return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.";
    }
    return getApiErrorMessage(error, "Không thể tạo tài khoản. Vui lòng thử lại.");
}

const CONTROL_CLASS =
    "h-10 border-bo-border bg-white text-bo-foreground shadow-none placeholder:text-slate-400 focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15";
const CONTROL_ERROR_CLASS =
    "border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15";

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
                <div id={`${id}-message`} className="text-xs leading-5 text-bo-muted">
                    {hint}
                </div>
            ) : null}
        </div>
    );
}

/**
 * Popup "Thêm người dùng" trên trang Danh sách người dùng.
 * - Lỗi hiện ngay dưới từng ô (không dùng toast: lớp phủ của popup che mất toast).
 * - Ô trống chỉ báo lỗi khi bấm Tạo tài khoản; sai định dạng báo khi rời ô; đã báo lỗi thì
 *   kiểm tra lại theo từng phím gõ để lỗi mất ngay khi sửa đúng.
 * - Đang nhập dở mà đóng (Esc, nút X, Hủy) thì hỏi lại; bấm ra ngoài không làm mất dữ liệu.
 * - `onCreated(user)` nhận dữ liệu người dùng vừa tạo (có `id` do backend trả về).
 */
export default function AddUserDialog({ open, onOpenChange, onCreated }) {
    // Mỗi lần mở là một phiên nhập mới (form trắng): đổi key lúc chuyển đóng → mở.
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
            <AddUserForm key={session} onClose={() => onOpenChange(false)} onCreated={onCreated} />
        </Dialog>
    );
}

function AddUserForm({ onClose, onCreated }) {
    const idPrefix = useId();
    const fieldId = (name) => `${idPrefix}-${name}`;
    const formId = fieldId("form");

    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    // Tự nhập tên đăng nhập rồi thì thôi tự gợi ý theo họ tên (xóa trống thì gợi ý lại).
    const [usernameEdited, setUsernameEdited] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const inputRefs = useRef({});
    // Nút đã mở popup: đóng xong trả focus về đó (popup mở bằng state, không qua DialogTrigger).
    const returnFocusRef = useRef(null);
    // Chỗ đang đứng lúc hỏi "Bỏ thông tin?": chọn Tiếp tục nhập thì quay lại đúng chỗ đó.
    const confirmReturnFocusRef = useRef(null);
    const discardingRef = useRef(false);

    const isDirty =
        TEXT_FIELDS.some((name) => form[name].trim() !== "") || form.vaiTro !== DEFAULT_ROLE;

    // Đặt con trỏ cuối ô (không bôi đen): sửa "nguyenvanan" thành "nguyenvanan2" chỉ cần gõ thêm.
    const focusField = (name) => {
        const element = inputRefs.current[name];
        if (!element) return;
        element.focus();
        const end = element.value.length;
        element.setSelectionRange?.(end, end);
    };

    const setFieldError = (name, message) => {
        setErrors((prev) => ((prev[name] || "") === message ? prev : { ...prev, [name]: message }));
    };

    const changeField = (name, value) => {
        const next = { ...form, [name]: value };
        if (name === "hoTen" && !usernameEdited) {
            next.tenDangNhap = suggestUsername(value);
        }
        setForm(next);
        setSubmitError("");

        // Ô đã báo lỗi: kiểm tra lại ngay (lỗi trùng từ máy chủ cũng mất khi giá trị đổi).
        const changed = name === "hoTen" && !usernameEdited ? ["hoTen", "tenDangNhap"] : [name];
        changed.forEach((field) => {
            if (errors[field]) setFieldError(field, VALIDATORS[field](next[field]));
        });
        // SĐT đủ 10 số mà sai đầu số thì báo luôn, giống các màn khác.
        if (name === "soDienThoai" && value.length === 10) {
            setFieldError(name, VALIDATORS.soDienThoai(value));
        }
    };

    const handleBlur = (name) => {
        // Ô trống không bị "mắng" khi chỉ đi ngang qua; chỉ báo khi bấm Tạo tài khoản.
        if (!form[name].trim()) return;
        setFieldError(name, VALIDATORS[name](form[name]));
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

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitting) return;

        const nextErrors = {};
        TEXT_FIELDS.forEach((name) => {
            const message = VALIDATORS[name](form[name]);
            if (message) nextErrors[name] = message;
        });
        setErrors(nextErrors);
        setSubmitError("");

        const firstInvalid = TEXT_FIELDS.find((name) => nextErrors[name]);
        if (firstInvalid) {
            focusField(firstInvalid);
            return;
        }

        const payload = {
            hoTen: form.hoTen.trim(),
            tenDangNhap: form.tenDangNhap.trim(),
            email: form.email.trim(),
            soDienThoai: form.soDienThoai || null,
            vaiTro: form.vaiTro,
        };

        setSubmitting(true);
        try {
            const res = await adminService.createUserByAdmin(payload);
            if (res?.data?.status && res.data.status !== 200) {
                throw Object.assign(new Error(res.data.message), { response: res });
            }
            onCreated?.({ ...payload, ...(res?.data?.data ?? {}) });
            onClose();
        } catch (error) {
            const message = getSubmitErrorMessage(error);
            const field = error?.response ? fieldOfServerMessage(message) : null;
            if (field) {
                setFieldError(field, message);
                // Chờ render xong (ô hết readOnly) rồi mới focus vào ô cần sửa.
                setTimeout(() => focusField(field), 0);
            } else {
                setSubmitError(message);
            }
            setSubmitting(false);
        }
    };

    const describedBy = (name) => (errors[name] || name === "tenDangNhap" || name === "vaiTro"
        ? `${fieldId(name)}-message`
        : undefined);

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
    });

    const isAdminRole = form.vaiTro === "quan_tri_vien";

    return (
        <>
            <DialogContent
                showCloseButton={false}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    returnFocusRef.current = document.activeElement;
                    focusField("hoTen");
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
                // Bấm nhầm ra ngoài không làm mất dữ liệu đang nhập; form trống thì đóng như bình thường.
                onInteractOutside={(event) => {
                    event.preventDefault();
                    if (!submitting && !isDirty) onClose();
                }}
                className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden border-bo-border bg-white p-0 text-bo-foreground sm:max-w-xl"
            >
                <div className="flex items-start gap-3 border-b border-bo-border px-5 py-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                        <UserPlus className="size-[18px]" />
                    </span>
                    <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
                        <DialogTitle className="text-base font-semibold leading-6 text-bo-foreground">
                            Thêm người dùng
                        </DialogTitle>
                        <DialogDescription className="text-sm text-bo-muted">
                            Tạo tài khoản đăng nhập cho nhân viên.
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
                            id={fieldId("hoTen")}
                            label="Họ và tên"
                            required
                            error={errors.hoTen}
                            className="sm:col-span-2"
                        >
                            <Input
                                {...textInputProps("hoTen")}
                                aria-required="true"
                                maxLength={MAX_LENGTH.hoTen}
                                placeholder="VD: Nguyễn Văn An"
                                onChange={(event) => changeField("hoTen", event.target.value)}
                            />
                        </Field>

                        <Field
                            id={fieldId("tenDangNhap")}
                            label="Tên đăng nhập"
                            required
                            error={errors.tenDangNhap}
                            hint="Chữ không dấu, số và . _ -"
                        >
                            <Input
                                {...textInputProps("tenDangNhap")}
                                aria-required="true"
                                maxLength={MAX_LENGTH.tenDangNhap}
                                placeholder="VD: nguyenvanan"
                                spellCheck={false}
                                autoCapitalize="none"
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setUsernameEdited(value.trim() !== "");
                                    changeField("tenDangNhap", value);
                                }}
                            />
                        </Field>

                        <Field
                            id={fieldId("vaiTro")}
                            label="Vai trò"
                            required
                            hint={
                                isAdminRole ? (
                                    <span className="flex items-start gap-1.5 text-bo-warning">
                                        <ShieldAlert className="mt-[3px] size-3.5 shrink-0" />
                                        <span>Có toàn quyền trên hệ thống.</span>
                                    </span>
                                ) : (
                                    "Có thể đổi sau ở trang Chỉnh sửa quyền."
                                )
                            }
                        >
                            <Select
                                value={form.vaiTro}
                                onValueChange={(value) => changeField("vaiTro", value)}
                                disabled={submitting}
                            >
                                <SelectTrigger
                                    id={fieldId("vaiTro")}
                                    aria-describedby={describedBy("vaiTro")}
                                    // Lúc đang tạo: khóa nhưng không làm mờ (giống các ô nhập chỉ đọc bên cạnh).
                                    className={cn(CONTROL_CLASS, "w-full data-[size=default]:h-10 disabled:cursor-default disabled:opacity-100")}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                    position="popper"
                                    sideOffset={4}
                                    className="z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {ROLES.map((role) => (
                                        <SelectItem
                                            key={role.value}
                                            value={role.value}
                                            className="rounded-md py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field id={fieldId("email")} label="Email" required error={errors.email}>
                            <Input
                                {...textInputProps("email")}
                                aria-required="true"
                                type="text"
                                inputMode="email"
                                maxLength={MAX_LENGTH.email}
                                placeholder="Ví dụ: an.nguyen@tencuahang.vn"
                                spellCheck={false}
                                autoCapitalize="none"
                                onChange={(event) => changeField("email", event.target.value)}
                            />
                        </Field>

                        <Field id={fieldId("soDienThoai")} label="Số điện thoại" error={errors.soDienThoai}>
                            <Input
                                {...textInputProps("soDienThoai")}
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                placeholder="VD: 0912345678"
                                onChange={(event) => changeField("soDienThoai", sanitizePhoneInput(event.target.value))}
                            />
                        </Field>
                    </div>

                    <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-bo-surface-subtle px-3.5 py-3 text-xs leading-5 text-bo-muted">
                        <Mail className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                        <span>
                            Hệ thống tự tạo mật khẩu tạm thời và gửi tới email trên. Người dùng phải đổi mật
                            khẩu ở lần đăng nhập đầu tiên.
                        </span>
                    </p>
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
                        className="min-w-[148px] bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <UserPlus className="size-4" />
                                Tạo tài khoản
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
                        // Bỏ thông tin: popup cũng đóng, focus do popup trả về nút Thêm người dùng.
                        if (discardingRef.current) return;
                        const target = confirmReturnFocusRef.current;
                        if (target?.isConnected) target.focus();
                        else focusField("hoTen");
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base text-bo-foreground">
                            Bỏ thông tin đang nhập?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-bo-muted">
                            Thông tin bạn đã nhập sẽ không được lưu.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle">
                            Tiếp tục nhập
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                discardingRef.current = true;
                                setConfirmDiscard(false);
                                onClose();
                            }}
                            className="bg-bo-danger text-white hover:bg-bo-danger/90"
                        >
                            Bỏ thông tin
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
