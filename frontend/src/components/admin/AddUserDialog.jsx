import { useId, useMemo, useRef, useState } from "react";
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
import { canKho } from "@/components/nguoi-dung/phanQuyen";
import { ROLES } from "@/constants/backend/role";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/adminService";
import { khoService } from "@/services/khoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { laKhoGiaoDich } from "@/utils/kho";
import { HAN_LIEN_KET_MAT_KHAU } from "@/utils/matKhau";
import { PHONE_ERROR_MESSAGE, PHONE_REGEX, sanitizePhoneInput } from "@/utils/phoneValidation";
import { chuanHoaHoTen, loiHoTen } from "@/validations/hoTen";
import { t } from "@/i18n";
import { cauGocMayChu } from "@/i18n/cauGoc";

// Trùng regex của backend (NguoiDungService.EMAIL_PATTERN) để hai phía báo lỗi giống nhau.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Cột ten_dang_nhap dùng collation không phân biệt hoa/thường và dấu → chỉ cho chữ không dấu.
const USERNAME_REGEX = /^[A-Za-z0-9._-]+$/;
const USERNAME_MIN_LENGTH = 3;
// Bằng độ dài cột trong bảng nguoi_dung; vượt quá thì backend báo lỗi chung chung.
// Họ tên không đặt maxLength: trình duyệt đếm theo đơn vị UTF-16 trước chuẩn hóa nên cắt mất chữ khi dán tên có dấu
// viết tách; quá 100 ký tự thì validations/hoTen.js báo lỗi.
const MAX_LENGTH = { tenDangNhap: 50, email: 100 };

// Trùng mặc định của backend khi không gửi vai trò. Danh sách chọn theo đúng thứ tự trong ROLES (Quản trị viên cuối).
const DEFAULT_ROLE = "nhan_vien_kho";

// khoId: id kho dạng chuỗi (giá trị của ô chọn), "" = chưa chọn
const EMPTY_FORM = { hoTen: "", tenDangNhap: "", email: "", soDienThoai: "", vaiTro: DEFAULT_ROLE, khoId: "" };
const TEXT_FIELDS = ["hoTen", "tenDangNhap", "email", "soDienThoai"];
// Thứ tự trên màn hình: lỗi đầu tiên theo thứ tự này được focus khi bấm Tạo tài khoản.
const FIELD_ORDER = ["hoTen", "tenDangNhap", "khoId", "email", "soDienThoai"];

/**
 * Nơi làm việc bắt buộc với vai trò làm theo kho (mọi vai trò trừ Quản trị viên, như ngăn kéo Phân quyền); máy chủ
 * gán kho kèm mẫu quyền của vai trò ngay khi tạo, tài khoản không còn ở trạng thái "Chưa có kho".
 */
const loiNoiLamViec = (form) => (canKho(form.vaiTro) && !form.khoId ? t("Vui lòng chọn nơi làm việc") : "");

const VALIDATORS = {
    // Cùng luật với Hồ sơ của tôi và máy chủ (validations/hoTen.js ↔ HoTen.java)
    hoTen: loiHoTen,
    tenDangNhap: (value) => {
        const username = value.trim();
        if (!username) return t("Vui lòng nhập tên đăng nhập");
        if (!USERNAME_REGEX.test(username)) return t("Chỉ dùng chữ không dấu, số và các ký tự . _ -");
        if (username.length < USERNAME_MIN_LENGTH) {
            return t("Tên đăng nhập cần ít nhất {{count}} ký tự", { count: USERNAME_MIN_LENGTH });
        }
        return "";
    },
    email: (value) => {
        const email = value.trim();
        if (!email) return t("Vui lòng nhập email");
        if (!EMAIL_REGEX.test(email)) return t("Vui lòng nhập đúng định dạng email");
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
    // Dò trên câu gốc tiếng Việt (giao diện tiếng Anh nhận câu đã dịch)
    const text = cauGocMayChu(message).toLowerCase();
    if (text.includes("tên đăng nhập")) return "tenDangNhap";
    if (text.includes("email")) return "email";
    if (text.includes("số điện thoại")) return "soDienThoai";
    if (text.includes("họ tên") || text.includes("họ và tên")) return "hoTen";
    // "Vui lòng chọn nơi làm việc", "Kho … đang ngừng hoạt động…", "Kho ảo…", "Không tìm thấy kho"
    if (text.includes("nơi làm việc") || /(^|\s)kho(\s|$)/.test(text)) return "khoId";
    return null;
}

function getSubmitErrorMessage(error) {
    if (!error?.response) {
        return t("Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.");
    }
    return getApiErrorMessage(error, t("Không thể tạo tài khoản. Vui lòng thử lại."));
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

    // Cùng nguồn và quy tắc với ngăn kéo Phân quyền: kho ảo (hàng đang chuyển) và kho ngừng hoạt động không phân người
    const khoQ = useTaiDuLieu(async () => {
        const res = await khoService.getAllKho();
        return Array.isArray(res?.data?.content) ? res.data.content : [];
    });
    const dsKho = useMemo(() => (khoQ.data ?? []).filter(laKhoGiaoDich), [khoQ.data]);
    const loiTaiKho = Boolean(khoQ.error) && !dsKho.length;

    const isDirty =
        TEXT_FIELDS.some((name) => form[name].trim() !== "") || form.vaiTro !== DEFAULT_ROLE || form.khoId !== "";

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
            if (errors[field] && VALIDATORS[field]) setFieldError(field, VALIDATORS[field](next[field]));
        });
        // Nơi làm việc phụ thuộc cả vai trò: chọn kho, hoặc đổi sang Quản trị viên (không cần kho) thì lỗi mất ngay
        if ((name === "khoId" || name === "vaiTro") && errors.khoId) {
            setFieldError("khoId", loiNoiLamViec(next));
        }
        // SĐT đủ 10 số mà sai đầu số thì báo luôn, giống các màn khác.
        if (name === "soDienThoai" && value.length === 10) {
            setFieldError(name, VALIDATORS.soDienThoai(value));
        }
    };

    const handleBlur = (name) => {
        // Ô trống không bị "mắng" khi chỉ đi ngang qua; chỉ báo khi bấm Tạo tài khoản.
        // Họ tên chỉ có ký tự vô hình (dán nhầm) cũng tính là trống.
        const giaTri = name === "hoTen" ? chuanHoaHoTen(form.hoTen) : form[name].trim();
        if (!giaTri) return;
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
        const khoMessage = loiNoiLamViec(form);
        if (khoMessage) nextErrors.khoId = khoMessage;
        setErrors(nextErrors);
        setSubmitError("");

        const firstInvalid = FIELD_ORDER.find((name) => nextErrors[name]);
        if (firstInvalid) {
            focusField(firstInvalid);
            return;
        }

        const payload = {
            hoTen: chuanHoaHoTen(form.hoTen),
            tenDangNhap: form.tenDangNhap.trim(),
            email: form.email.trim(),
            soDienThoai: form.soDienThoai || null,
            vaiTro: form.vaiTro,
            // Quản trị viên không có nơi làm việc (ô bị ẩn, giá trị đã chọn trước đó bỏ đi)
            khoId: canKho(form.vaiTro) ? Number(form.khoId) : null,
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
                // Kho vừa bị ngừng hoạt động ở màn khác: bỏ chọn và tải lại danh sách để kho đó không còn trong ô chọn
                if (field === "khoId") {
                    setForm((prev) => ({ ...prev, khoId: "" }));
                    khoQ.reload();
                }
                // Chờ render xong (ô hết readOnly) rồi mới focus vào ô cần sửa.
                setTimeout(() => focusField(field), 0);
            } else {
                setSubmitError(message);
            }
            setSubmitting(false);
        }
    };

    const describedBy = (name) => (errors[name] || name === "tenDangNhap" || name === "vaiTro" || name === "khoId"
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
    const needsWarehouse = canKho(form.vaiTro);

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
                // Điện thoại: toàn màn như hộp Khách hàng (biểu mẫu dài, nhiều ô nhập); thân tự cuộn, chân hộp luôn thấy. "!" để thắng
                // lớp dùng chung của index.css (hộp thoại dưới 768px cao tối đa 100dvh − 24px và tự cuộn)
                className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden border-bo-border bg-bo-surface p-0 text-bo-foreground sm:max-w-xl max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none! max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:overflow-hidden!"
            >
                <div className="flex items-start gap-3 border-b border-bo-border px-5 py-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                        <UserPlus className="size-[18px]" />
                    </span>
                    <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
                        <DialogTitle className="text-base font-semibold leading-6 text-bo-foreground">
                            {t("Thêm người dùng")}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-bo-muted">
                            {t("Tạo tài khoản đăng nhập cho nhân viên.")}
                        </DialogDescription>
                    </DialogHeader>
                    <button
                        type="button"
                        onClick={requestClose}
                        disabled={submitting}
                        aria-label={t("Đóng")}
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
                            label={t("Họ và tên")}
                            required
                            error={errors.hoTen}
                            className="sm:col-span-2"
                        >
                            <Input
                                {...textInputProps("hoTen")}
                                aria-required="true"
                                placeholder={t("VD: Nguyễn Văn An")}
                                onChange={(event) => changeField("hoTen", event.target.value)}
                            />
                        </Field>

                        <Field
                            id={fieldId("tenDangNhap")}
                            label={t("Tên đăng nhập")}
                            required
                            error={errors.tenDangNhap}
                            hint={t("Chữ không dấu, số và . _ -")}
                        >
                            <Input
                                {...textInputProps("tenDangNhap")}
                                aria-required="true"
                                maxLength={MAX_LENGTH.tenDangNhap}
                                placeholder={t("VD: {{viDu}}", { viDu: "nguyenvanan" })}
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
                            label={t("Vai trò")}
                            required
                            hint={
                                isAdminRole ? (
                                    <span className="flex items-start gap-1.5 text-bo-warning">
                                        <ShieldAlert className="mt-[3px] size-3.5 shrink-0" />
                                        <span>{t("Có toàn quyền trên hệ thống.")}</span>
                                    </span>
                                ) : (
                                    t("Có thể đổi sau ở trang Chỉnh sửa quyền.")
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
                                    className="z-50 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
                                >
                                    {ROLES.map((role) => (
                                        <SelectItem
                                            key={role.value}
                                            value={role.value}
                                            className="rounded-md py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {t(role.label)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        {/* Ngay dưới Vai trò, cả hàng; Quản trị viên toàn quyền ở mọi kho nên không có ô này */}
                        {needsWarehouse ? (
                            <Field
                                id={fieldId("khoId")}
                                label={t("Nơi làm việc")}
                                required
                                error={
                                    loiTaiKho ? (
                                        <>
                                            {t("Không tải được danh sách kho.")}{" "}
                                            <button
                                                type="button"
                                                onClick={khoQ.reload}
                                                className="font-medium text-bo-primary hover:underline focus-visible:underline focus-visible:outline-none"
                                            >
                                                {t("Thử lại")}
                                            </button>
                                        </>
                                    ) : (
                                        errors.khoId
                                    )
                                }
                                hint={t("Mỗi người 1 kho, quyền theo mẫu của vai trò.")}
                                className="sm:col-span-2"
                            >
                                <Select
                                    value={form.khoId}
                                    onValueChange={(value) => changeField("khoId", value)}
                                    disabled={submitting || !dsKho.length}
                                >
                                    <SelectTrigger
                                        id={fieldId("khoId")}
                                        ref={(element) => {
                                            inputRefs.current.khoId = element;
                                        }}
                                        aria-required="true"
                                        aria-invalid={errors.khoId || loiTaiKho ? true : undefined}
                                        aria-describedby={describedBy("khoId")}
                                        className={cn(
                                            CONTROL_CLASS,
                                            "w-full data-[size=default]:h-10 disabled:cursor-default disabled:opacity-100 data-[placeholder]:text-slate-400",
                                            errors.khoId && CONTROL_ERROR_CLASS,
                                        )}
                                    >
                                        <SelectValue
                                            placeholder={
                                                khoQ.loading && !dsKho.length
                                                    ? t("Đang tải danh sách kho...")
                                                    : loiTaiKho || dsKho.length
                                                      ? t("Chọn kho")
                                                      : t("Chưa có kho đang hoạt động")
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent
                                        position="popper"
                                        sideOffset={4}
                                        className="z-50 max-h-72 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
                                    >
                                        {dsKho.map((kho) => (
                                            <SelectItem
                                                key={kho.id}
                                                value={String(kho.id)}
                                                className="rounded-md py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                            >
                                                {kho.tenKho || kho.maKho}
                                                {kho.tenKho && kho.maKho ? (
                                                    <span className="font-mono text-xs text-bo-muted">{kho.maKho}</span>
                                                ) : null}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        ) : null}

                        <Field id={fieldId("email")} label="Email" required error={errors.email}>
                            <Input
                                {...textInputProps("email")}
                                aria-required="true"
                                type="text"
                                inputMode="email"
                                maxLength={MAX_LENGTH.email}
                                placeholder={t("Ví dụ: an.nguyen@tencuahang.vn")}
                                spellCheck={false}
                                autoCapitalize="none"
                                onChange={(event) => changeField("email", event.target.value)}
                            />
                        </Field>

                        <Field id={fieldId("soDienThoai")} label={t("Số điện thoại")} error={errors.soDienThoai}>
                            <Input
                                {...textInputProps("soDienThoai")}
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                placeholder={t("VD: {{viDu}}", { viDu: "0912345678" })}
                                onChange={(event) => changeField("soDienThoai", sanitizePhoneInput(event.target.value))}
                            />
                        </Field>
                    </div>

                    <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-bo-surface-subtle px-3.5 py-3 text-xs leading-5 text-bo-muted">
                        <Mail className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                        <span>
                            {t("Hệ thống gửi tới email trên một liên kết để người dùng tự đặt mật khẩu (dùng một lần, hết hạn sau {{han}}).", { han: HAN_LIEN_KET_MAT_KHAU })}
                        </span>
                    </p>
                </form>

                <div className="flex flex-col-reverse gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={requestClose}
                        disabled={submitting}
                        className="border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                    >
                        {t("Hủy")}
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
                                {t("Đang tạo...")}
                            </>
                        ) : (
                            <>
                                <UserPlus className="size-4" />
                                {t("Tạo tài khoản")}
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
                        // Bỏ thông tin: popup cũng đóng, focus do popup trả về nút Thêm người dùng.
                        if (discardingRef.current) return;
                        const target = confirmReturnFocusRef.current;
                        if (target?.isConnected) target.focus();
                        else focusField("hoTen");
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base text-bo-foreground">
                            {t("Bỏ thông tin đang nhập?")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-bo-muted">
                            {t("Thông tin bạn đã nhập sẽ không được lưu.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle">
                            {t("Tiếp tục nhập")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                discardingRef.current = true;
                                setConfirmDiscard(false);
                                onClose();
                            }}
                            className="bg-bo-danger text-white hover:bg-bo-danger/90"
                        >
                            {t("Bỏ thông tin")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
