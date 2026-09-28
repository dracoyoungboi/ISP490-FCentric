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
import SurfaceCard from "@/components/shared/SurfaceCard";

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
                {/* Alerts */}
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

                <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
                    {/* Left - Summary */}
                    <div className="lg:col-span-1">
                        <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                            <div className="flex flex-col items-center p-6 text-center">
                                <button
                                    type="button"
                                    onClick={() => setEditorOpen(true)}
                                    aria-label="Thay đổi ảnh đại diện"
                                    className="group relative mb-4 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary focus-visible:ring-offset-2"
                                >
                                    <UserAvatar userId={userData.id} name={userData.hoTen} size="lg" />
                                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-bo-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Camera className="size-6 text-white" />
                                    </span>
                                </button>

                                <h3 className="break-all text-xl font-bold text-bo-foreground">
                                    {loadingUser ? "Loading..." : userData.hoTen || "—"}
                                </h3>

                                <p className="mb-2 text-bo-muted">@{userData.tenDangNhap || "—"}</p>

                                <Badge variant="outline" className="mb-4 border-bo-border bg-bo-surface-subtle text-bo-foreground">
                                    <Shield className="mr-1 h-3 w-3" />
                                    {getVaiTroLabel(userData.vaiTro)}
                                </Badge>

                                <div className="mb-6 flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${isActive ? "bg-bo-success" : "bg-slate-400"}`} />
                                    <span className={`text-sm font-medium ${isActive ? "text-bo-success" : "text-bo-muted"}`}>
                                        {isActive ? "Đang hoạt động" : "Không hoạt động"}
                                    </span>
                                </div>

                                {/* Kho phụ trách — chỉ hiển thị khi có kho đang hoạt động, còn hiệu lực (BE đã lọc) */}
                                {Array.isArray(userData.khoPhuTrachActive) && userData.khoPhuTrachActive.length > 0 && (
                                    <div className="mb-6 w-full space-y-3 border-t border-bo-border pt-4 text-left">
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                            <Warehouse className="h-4 w-4 text-bo-primary" />
                                            Kho phụ trách
                                        </div>
                                        <ul className="space-y-2">
                                            {userData.khoPhuTrachActive.map((kho, index) => (
                                                <li
                                                    key={kho.maKho || index}
                                                    className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2"
                                                >
                                                    <p className="text-sm font-medium text-bo-foreground">{kho.tenKho}</p>
                                                    <p className="mt-0.5 text-xs uppercase tracking-wide text-bo-muted">{kho.maKho}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="w-full space-y-3 border-t border-bo-border pt-4 text-left">
                                    <div className="flex items-center gap-2 text-sm text-bo-muted">
                                        <Calendar className="h-4 w-4" />
                                        <span>Ngày tạo: {formatDateTime(userData.ngayTao)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-bo-muted">
                                        <Clock className="h-4 w-4" />
                                        <span>Cập nhật: {formatDateTime(userData.ngayCapNhat)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right - Thông tin cá nhân + Bảo mật */}
                    <div className="space-y-5 lg:col-span-2">
                        <SurfaceCard
                            title="Thông tin cá nhân"
                            description="Thông tin cơ bản của tài khoản"
                            action={
                                !isEditing ? (
                                    <Button
                                        onClick={handleEdit}
                                        disabled={loadingUser}
                                        className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                                    >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Chỉnh sửa thông tin
                                    </Button>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleCancel}
                                            disabled={saving}
                                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            <X className="mr-2 h-4 w-4" />
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
                                    </div>
                                )
                            }
                        >
                            <div className="space-y-6">
                                {/* tenDangNhap - read-only */}
                                <div className="space-y-2">
                                    <Label htmlFor="tenDangNhap" className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-bo-muted" />
                                        Tên đăng nhập
                                    </Label>
                                    <Input
                                        id="tenDangNhap"
                                        value={userData.tenDangNhap}
                                        readOnly
                                        disabled
                                        className="border-bo-border bg-bo-surface-subtle text-bo-foreground"
                                    />
                                </div>

                                {/* email - read-only */}
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-bo-muted" />
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={userData.email}
                                        readOnly
                                        disabled
                                        className="border-bo-border bg-bo-surface-subtle text-bo-foreground"
                                    />
                                </div>

                                {/* hoTen */}
                                <div className="space-y-2">
                                    <Label htmlFor="hoTen">Họ và tên</Label>
                                    <Input
                                        id="hoTen"
                                        value={isEditing ? editedData.hoTen : userData.hoTen}
                                        onChange={(e) => handleInputChange("hoTen", e.target.value)}
                                        disabled={!isEditing || loadingUser}
                                        className={!isEditing
                                            ? "border-bo-border bg-bo-surface-subtle text-bo-foreground"
                                            : "border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"}
                                    />
                                </div>

                                {/* soDienThoai */}
                                <div className="space-y-2">
                                    <Label htmlFor="soDienThoai" className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-bo-muted" />
                                        Số điện thoại
                                    </Label>
                                    <Input
                                        id="soDienThoai"
                                        value={isEditing ? editedData.soDienThoai : userData.soDienThoai || ""}
                                        onChange={(e) => handleInputChange("soDienThoai", e.target.value)}
                                        disabled={!isEditing || loadingUser}
                                        className={!isEditing
                                            ? "border-bo-border bg-bo-surface-subtle text-bo-foreground"
                                            : "border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"}
                                    />
                                </div>
                            </div>
                        </SurfaceCard>

                        <SurfaceCard
                            title="Bảo mật tài khoản"
                            description="Quản lý mật khẩu đăng nhập"
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => setChangePasswordOpen(true)}
                                    disabled={loadingUser}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <Lock className="mr-2 h-4 w-4" />
                                    Đổi mật khẩu
                                </Button>
                            }
                        >
                            <div className="flex items-center gap-3">
                                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft">
                                    <Shield className="h-5 w-5 text-bo-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-bo-foreground">Mật khẩu</p>
                                    <p className="text-sm tracking-widest text-bo-foreground">••••••••••••</p>
                                </div>
                            </div>
                           
                        </SurfaceCard>
                    </div>
                </div>

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
