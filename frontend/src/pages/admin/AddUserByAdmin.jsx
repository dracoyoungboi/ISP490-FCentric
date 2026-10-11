import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
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
    getPhoneError,
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
    });

    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState("");

    const getEmailError = (value) => {
        const email = (value ?? "").trim();
        if (!email) return "Email không được để trống";
        if (!EMAIL_REGEX.test(email)) return "Vui lòng nhập đúng định dạng email";
        return "";
    };

    // Validate SĐT real-time: chỉ báo lỗi khi đã đủ 10 số mà sai định dạng (đang gõ dang dở thì không báo)
    const phoneError = getPhoneError(form.soDienThoai);

    // id cố định để blur và submit không tạo ra nhiều toast trùng nhau
    const showEmailError = (message) => {
        setEmailError(message);
        toast.error(message, { id: "add-user-email-error" });
    };

    const handleEmailBlur = () => {
        const message = getEmailError(form.email);
        if (message) showEmailError(message);
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
            toast.error(phoneMessage, { id: "add-user-phone-error" });
            return;
        }

        try {
            setLoading(true);

            await adminService.createUserByAdmin({ ...form, email });
            navigate("/users", {
                state: {
                    success: true,
                    message: "Tạo người dùng thành công! Mật khẩu tạm thời đã được gửi tới email.",
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
                description="Tạo tài khoản với vai trò hệ thống. Mật khẩu tạm thời sẽ được tự động tạo và gửi đến email."
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
                                    placeholder="VD: nguyenvana"
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
                                    value={form.soDienThoai}
                                    onChange={(e) =>
                                        setForm({ ...form, soDienThoai: sanitizePhoneInput(e.target.value) })
                                    }
                                    maxLength={10}
                                    inputMode="numeric"
                                    aria-invalid={Boolean(phoneError)}
                                    className={`mt-2 h-10 border-bo-border bg-white focus-visible:border-bo-primary focus-visible:ring-bo-primary/20 ${
                                        phoneError
                                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                                            : ""
                                    }`}
                                />
                                {phoneError && (
                                    <p className="mt-1 text-sm text-bo-danger">{phoneError}</p>
                                )}
                            </div>

                            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-700">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-full bg-blue-100 p-1.5 text-blue-600">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-blue-900">Mật khẩu tạm thời tự động</p>
                                        <p className="text-xs leading-relaxed text-slate-600">
                                            Hệ thống sẽ tự động tạo mật khẩu tạm thời bảo mật và gửi trực tiếp đến hộp thư của nhân viên. Nhân viên sẽ được yêu cầu đổi mật khẩu mới trong lần đăng nhập đầu tiên.
                                        </p>
                                    </div>
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
