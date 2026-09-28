import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { adminService } from "@/services/adminService";
import {
    PHONE_ERROR_MESSAGE,
    isPhoneValid,
    sanitizePhoneInput,
} from "@/utils/phoneValidation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddUserByAdmin() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        tenDangNhap: "",
        hoTen: "",
        email: "",
        soDienThoai: "",
        vaiTro: "nhan_vien_kho",
        matKhau: "",
    });

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [phoneError, setPhoneError] = useState("");

    const getEmailError = (value) => {
        const email = (value ?? "").trim();
        if (!email) return "Email không được để trống";
        if (!EMAIL_REGEX.test(email)) return "Vui lòng nhập đúng định dạng email";
        return "";
    };

    // SĐT tùy chọn: chỉ báo lỗi khi có giá trị mà sai định dạng
    const getPhoneError = (value) => {
        if (!isPhoneValid(value)) return PHONE_ERROR_MESSAGE;
        return "";
    };

    // id cố định để blur và submit không tạo ra nhiều toast trùng nhau
    const showEmailError = (message) => {
        setEmailError(message);
        toast.error(message, { id: "add-user-email-error" });
    };

    const showPhoneError = (message) => {
        setPhoneError(message);
        toast.error(message, { id: "add-user-phone-error" });
    };

    const handleEmailBlur = () => {
        const message = getEmailError(form.email);
        if (message) showEmailError(message);
    };

    const handlePhoneBlur = () => {
        const message = getPhoneError(form.soDienThoai);
        if (message) showPhoneError(message);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const email = form.email.trim();
        const message = getEmailError(email);
        if (message) {
            showEmailError(message);
            return;
        }
        setEmailError("");

        const phoneMessage = getPhoneError(form.soDienThoai);
        if (phoneMessage) {
            showPhoneError(phoneMessage);
            return;
        }
        setPhoneError("");

        try {
            setLoading(true);

            await adminService.createUserByAdmin({ ...form, email });
            navigate("/users", {
                state: {
                    success: true,
                    message: "Tạo người dùng thành công",
                },
            });
        } catch (err) {
            toast.error(
                err.response?.data?.message ||
                "Tên đăng nhập / Email / SĐT đã tồn tại"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer>
            {/* FORM CARD */}
            <SurfaceCard
                title="Thêm người dùng mới"
                description="Tạo tài khoản với vai trò hệ thống và mật khẩu tạm thời"
                className="mx-auto max-w-3xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-5">
                            <div>
                                <Label className="font-semibold text-bo-foreground">
                                    Tên đăng nhập
                                </Label>
                                <Input
                                    placeholder="username"
                                    value={form.tenDangNhap}
                                    onChange={(e) =>
                                        setForm({ ...form, tenDangNhap: e.target.value })
                                    }
                                    className="mt-2 h-10 border-bo-border bg-white focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                    required
                                />
                            </div>

                            <div>
                                <Label className="text-bo-foreground">Email</Label>
                                <Input
                                    type="text"
                                    inputMode="email"
                                    autoComplete="email"
                                    placeholder="example@gmail.com"
                                    value={form.email}
                                    onChange={(e) => {
                                        setForm({ ...form, email: e.target.value });
                                        if (emailError) setEmailError("");
                                    }}
                                    onBlur={handleEmailBlur}
                                    aria-invalid={Boolean(emailError)}
                                    className={`mt-2 h-10 border-bo-border bg-white focus-visible:border-bo-primary focus-visible:ring-bo-primary/20 ${
                                        emailError
                                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                                            : ""
                                    }`}
                                />
                            </div>

                            <div>
                                <Label className="font-semibold text-bo-foreground">
                                    Vai trò hệ thống
                                </Label>
                                <Select
                                    value={form.vaiTro}
                                    onValueChange={(v) =>
                                        setForm({ ...form, vaiTro: v })
                                    }
                                >
                                    <SelectTrigger className="mt-2 h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent
                                        position="popper"
                                        side="bottom"
                                        align="start"
                                        sideOffset={4}
                                        className="z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        <SelectItem
                                            value="nhan_vien_kho"
                                            className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Nhân viên kho
                                        </SelectItem>

                                        <SelectItem
                                            value="quan_ly_kho"
                                            className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Quản lý kho
                                        </SelectItem>

                                        <SelectItem
                                            value="nhan_vien_ban_hang"
                                            className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Nhân viên bán hàng
                                        </SelectItem>

                                        <SelectItem
                                            value="nhan_vien_mua_hang"
                                            className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Nhân viên mua hàng
                                        </SelectItem>

                                        <SelectItem
                                            value="quan_tri_vien"
                                            className="rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Quản trị viên
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <Label className="font-semibold text-bo-foreground">
                                    Họ và tên
                                </Label>
                                <Input
                                    placeholder="Nguyễn Văn A"
                                    value={form.hoTen}
                                    onChange={(e) =>
                                        setForm({ ...form, hoTen: e.target.value })
                                    }
                                    className="mt-2 h-10 border-bo-border bg-white focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                    required
                                />
                            </div>

                            <div>
                                <Label className="text-bo-foreground">Số điện thoại</Label>
                                <Input
                                    placeholder="090..."
                                    value={form.soDienThoai}
                                    onChange={(e) => {
                                        setForm({ ...form, soDienThoai: sanitizePhoneInput(e.target.value) });
                                        if (phoneError) setPhoneError("");
                                    }}
                                    onBlur={handlePhoneBlur}
                                    maxLength={10}
                                    inputMode="numeric"
                                    aria-invalid={Boolean(phoneError)}
                                    className={`mt-2 h-10 border-bo-border bg-white focus-visible:border-bo-primary focus-visible:ring-bo-primary/20 ${
                                        phoneError
                                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                                            : ""
                                    }`}
                                />
                            </div>

                            <div>
                                <Label className="font-semibold text-bo-foreground">
                                    Mật khẩu tạm thời
                                </Label>
                                <div className="relative mt-2">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={form.matKhau}
                                        onChange={(e) =>
                                            setForm({ ...form, matKhau: e.target.value })
                                        }
                                        className="h-10 pr-10 border-bo-border bg-white focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute inset-y-0 right-0 px-3 text-bo-muted hover:text-bo-foreground"
                                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTION */}
                    <div className="flex justify-end gap-3 border-t border-bo-border pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            onClick={() => navigate("/users")}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            {loading ? "Đang lưu..." : "Lưu người dùng"}
                        </Button>
                    </div>
                </form>
            </SurfaceCard>
        </PageContainer>
    );
}
