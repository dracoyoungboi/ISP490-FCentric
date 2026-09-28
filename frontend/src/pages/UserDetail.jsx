import { useEffect, useMemo, useState } from "react";
import { nguoiDungService } from "@/services/nguoiDungService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorModal from "@/components/AvatarEditorModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PageContainer from "@/components/backoffice/PageContainer";

import {
    Calendar,
    Camera,
    CheckCircle2,
    Clock,
    Edit,
    Lock,
    Mail,
    Phone,
    Save,
    Shield,
    User,
    Warehouse,
    X,
    AlertCircle,
} from "lucide-react";

// Hồ sơ cá nhân của người đang đăng nhập (route /profile).
// BE lấy user từ token — không có id trên URL, không hiển thị id nội bộ.
export default function UserDetail() {
    // UI state
    const [loadingUser, setLoadingUser] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [editorOpen, setEditorOpen] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);

    // User data — id chỉ dùng nội bộ cho AvatarEditorModal, không hiển thị
    const [userData, setUserData] = useState({
        id: null,
        tenDangNhap: "",
        hoTen: "",
        email: "",
        soDienThoai: "",
        vaiTro: "",
        trangThai: 0,
        ngayTao: "",
        ngayCapNhat: "",
        khoPhuTrachActive: [],
    });

    // Chỉ các trường cá nhân được phép sửa
    const [editedData, setEditedData] = useState({ hoTen: "", soDienThoai: "" });

    const vaiTroOptions = useMemo(
        () => [
            { value: "quan_tri_vien", label: "Quản trị viên" },
            { value: "quan_ly_kho", label: "Quản lý kho" },
            { value: "nhan_vien_kho", label: "Nhân viên kho" },
            { value: "nhan_vien_ban_hang", label: "Nhân viên bán hàng" },
            { value: "nhan_vien_mua_hang", label: "Nhân viên mua hàng" },
            { value: "khach_hang", label: "Khách hàng" },
        ],
        []
    );

    const getVaiTroLabel = (value) => vaiTroOptions.find((opt) => opt.value === value)?.label || value || "—";
    const isActive = useMemo(() => Number(userData.trangThai) === 1, [userData.trangThai]);

    const formatDateTime = (iso) => {
        if (!iso) return "—";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString();
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(""), 2500);
    };

    // ===== Fetch user =====
    useEffect(() => {
        const fetchUser = async () => {
            setErrorMsg("");
            setLoadingUser(true);

            try {
                const res = await nguoiDungService.getMe();
                const dto = res?.data; // ResponseData.data
                if (!dto) throw new Error("Không nhận được data người dùng từ server");

                setUserData(dto);
                setEditedData({ hoTen: dto.hoTen || "", soDienThoai: dto.soDienThoai || "" });
            } catch (err) {
                const msg = err?.response?.data?.message || err?.message || "Lỗi tải dữ liệu người dùng";
                setErrorMsg(msg);
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUser();
    }, []);

    // ===== Edit handlers =====
    const handleEdit = () => {
        setIsEditing(true);
        setEditedData({ hoTen: userData.hoTen || "", soDienThoai: userData.soDienThoai || "" });
        setErrorMsg("");
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedData({ hoTen: userData.hoTen || "", soDienThoai: userData.soDienThoai || "" });
        setErrorMsg("");
    };

    const handleInputChange = (field, value) => {
        setEditedData((prev) => ({ ...prev, [field]: value }));
    };

    // Chỉ cập nhật thông tin cá nhân — mật khẩu đổi riêng qua modal Bảo mật
    const handleSave = async () => {
        setSaving(true);
        setErrorMsg("");

        try {
            if (!editedData.hoTen?.trim()) {
                throw new Error("Họ tên không được để trống");
            }

            const res = await nguoiDungService.updateMe({
                hoTen: editedData.hoTen.trim(),
                soDienThoai: editedData.soDienThoai?.trim() || null,
            });
            const updatedDto = res?.data; // ResponseData.data
            if (!updatedDto) throw new Error("Cập nhật thành công nhưng response thiếu data");

            setUserData(updatedDto);
            setEditedData({ hoTen: updatedDto.hoTen || "", soDienThoai: updatedDto.soDienThoai || "" });
            setIsEditing(false);

            showSuccess("Cập nhật hồ sơ thành công!");
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Cập nhật thất bại";
            setErrorMsg(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageContainer className="mx-auto max-w-5xl space-y-5">
            {successMsg && (
                <Alert className="border-bo-success/30 bg-bo-success-soft">
                    <CheckCircle2 className="h-4 w-4 text-bo-success" />
                    <AlertDescription className="text-bo-success">{successMsg}</AlertDescription>
                </Alert>
            )}

            {errorMsg && (
                <Alert className="border-bo-danger/30 bg-bo-danger-soft">
                    <AlertCircle className="h-4 w-4 text-bo-danger" />
                    <AlertDescription className="text-bo-danger">{errorMsg}</AlertDescription>
                </Alert>
            )}

            <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                {/* Header hồ sơ */}
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                    <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                        <button
                            type="button"
                            onClick={() => setEditorOpen(true)}
                            aria-label="Thay đổi ảnh đại diện"
                            className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary focus-visible:ring-offset-2"
                        >
                            <UserAvatar userId={userData.id} name={userData.hoTen} size="lg" />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-bo-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                                <Camera className="size-6 text-white" />
                            </span>
                        </button>

                        <div className="min-w-0">
                            <h1 className="break-all text-xl font-bold text-bo-foreground sm:text-2xl">
                                {loadingUser ? "Loading..." : userData.hoTen || "—"}
                            </h1>
                            <p className="mt-1 text-sm text-bo-muted">@{userData.tenDangNhap || "—"}</p>

                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <Badge
                                    variant="outline"
                                    className="border-bo-border bg-bo-surface-subtle text-bo-foreground"
                                >
                                    <Shield className="mr-1 h-3 w-3" />
                                    {getVaiTroLabel(userData.vaiTro)}
                                </Badge>
                                <span
                                    className={
                                        isActive
                                            ? "inline-flex items-center gap-2 text-sm font-medium text-bo-success"
                                            : "inline-flex items-center gap-2 text-sm font-medium text-bo-muted"
                                    }
                                >
                                    <span className={isActive ? "h-2 w-2 rounded-full bg-bo-success" : "h-2 w-2 rounded-full bg-slate-400"} />
                                    {isActive ? "Đang hoạt động" : "Không hoạt động"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:justify-end">
                        {!isEditing ? (
                            <Button
                                onClick={handleEdit}
                                disabled={loadingUser}
                                className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                Chỉnh sửa thông tin
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                   
                                    Hủy
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    {saving ? "Đang lưu..." : "Lưu thông tin"}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Thông tin cá nhân */}
                <div className="border-t border-bo-border px-5 py-6 sm:px-7">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-bo-foreground">Thông tin cá nhân</h2>
                       
                    </div>

                    <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                        <div className="flex min-w-0 items-start gap-3">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-bo-muted" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-bo-foreground">Tên đăng nhập</p>
                                <p className="mt-1 break-all text-sm text-bo-muted">{userData.tenDangNhap || "—"}</p>
                            </div>
                        </div>

                        <div className="flex min-w-0 items-start gap-3">
                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-bo-muted" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-bo-foreground">Email</p>
                                <p className="mt-1 break-all text-sm text-bo-muted">{userData.email || "—"}</p>
                            </div>
                        </div>

                        <div className="min-w-0">
                            {isEditing ? (
                                <div className="space-y-2">
                                    <Label htmlFor="hoTen">Họ và tên</Label>
                                    <Input
                                        id="hoTen"
                                        value={editedData.hoTen}
                                        onChange={(e) => handleInputChange("hoTen", e.target.value)}
                                        disabled={!isEditing || loadingUser}
                                        className="border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                    />
                                </div>
                            ) : (
                                <div className="flex min-w-0 items-start gap-3">
                                    <User className="mt-0.5 h-4 w-4 shrink-0 text-bo-muted" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-bo-foreground">Họ và tên</p>
                                        <p className="mt-1 break-all text-sm text-bo-muted">{userData.hoTen || "—"}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="min-w-0">
                            {isEditing ? (
                                <div className="space-y-2">
                                    <Label htmlFor="soDienThoai" className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-bo-muted" />
                                        Số điện thoại
                                    </Label>
                                    <Input
                                        id="soDienThoai"
                                        value={editedData.soDienThoai}
                                        onChange={(e) => handleInputChange("soDienThoai", e.target.value)}
                                        disabled={!isEditing || loadingUser}
                                        className="border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                    />
                                </div>
                            ) : (
                                <div className="flex min-w-0 items-start gap-3">
                                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-bo-muted" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-bo-foreground">Số điện thoại</p>
                                        <p className="mt-1 break-all text-sm text-bo-muted">{userData.soDienThoai || "—"}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {Array.isArray(userData.khoPhuTrachActive) && userData.khoPhuTrachActive.length > 0 && (
                        <div className="mt-6 border-t border-bo-border pt-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                                <Warehouse className="h-4 w-4 text-bo-primary" />
                                Kho phụ trách
                            </div>
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {userData.khoPhuTrachActive.map((kho, index) => (
                                    <li
                                        key={kho.maKho || index}
                                        className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2"
                                    >
                                        <span className="text-sm font-medium text-bo-foreground">{kho.tenKho}</span>
                                        <span className="text-xs uppercase tracking-wide text-bo-muted">{kho.maKho}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Bảo mật tài khoản */}
                <div className="border-t border-bo-border px-5 py-5 sm:px-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft">
                                <Shield className="h-5 w-5 text-bo-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-bo-foreground">Bảo mật tài khoản</h2>
                                <p className="text-sm text-bo-muted">Quản lý mật khẩu đăng nhập</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                            <div>
                                
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setChangePasswordOpen(true)}
                                disabled={loadingUser}
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                <Lock className="mr-2 h-4 w-4" />
                                Đổi mật khẩu
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Ngày tạo và cập nhật */}
                <div className="flex flex-col gap-3 border-t border-bo-border px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:px-7">
                    <div className="flex items-center gap-2 text-sm text-bo-muted">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>Ngày tạo: {formatDateTime(userData.ngayTao)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-bo-muted">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>Cập nhật: {formatDateTime(userData.ngayCapNhat)}</span>
                    </div>
                </div>
            </section>

            <AvatarEditorModal
                open={editorOpen}
                onOpenChange={setEditorOpen}
                userId={userData.id}
            />

            <ChangePasswordModal
                open={changePasswordOpen}
                onOpenChange={setChangePasswordOpen}
                onSuccess={() => showSuccess("Đổi mật khẩu thành công!")}
            />
        </PageContainer>
    );
}