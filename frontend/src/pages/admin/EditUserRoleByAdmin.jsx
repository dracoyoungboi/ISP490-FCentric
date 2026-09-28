import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ROLES } from "@/constants/backend/role";
import { nguoiDungService } from "@/services/nguoiDungService";
import { quyenHanService } from "@/services/quyenHan";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  ShieldCheck, RefreshCcw, UserCog,
  Warehouse, AlertCircle, Save, X, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import AssignWarehousePermissionModal from "@/components/admin/AssignWarehousePermissionModal";

export default function UserPermissionEditByAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userWarehouses, setUserWarehouses] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedWarehouseToDelete, setSelectedWarehouseToDelete] = useState(null);

  const [form, setForm] = useState({
    role: "quan_ly_kho",
  });

  const reloadUserWarehouses = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await nguoiDungService.getById(id);
      const dto = res?.data;
      if (!dto) return;

      setUser(dto);
      setForm({
        role: dto.vaiTro || "quan_ly_kho",
      });
      setUserWarehouses(dto.khoPhuTrach || []);
    } catch (err) {
      console.error("Lỗi tải thông tin người dùng:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => reloadUserWarehouses());
  }, [reloadUserWarehouses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      id: Number(id),
      vaiTro: form.role,
    };

    try {
      setLoading(true);
      await nguoiDungService.updatePermission(payload);
      toast.success("Cập nhật vai trò người dùng thành công!");

      setTimeout(() => navigate("/users"), 1000);
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      toast.error(err.response?.data?.message || "Không thể cập nhật vai trò");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (value) => {
    setForm((prev) => ({ ...prev, role: value }));
  };

  const handleDeleteWarehousePermission = (warehousePermission) => {
    setSelectedWarehouseToDelete(warehousePermission);
    setShowDeleteDialog(true);
  };

  const confirmDeleteWarehousePermission = async () => {
    if (!selectedWarehouseToDelete) return;

    try {
      setLoading(true);
      // Call API to delete warehouse permission
      await quyenHanService.xoaQuyenKho(selectedWarehouseToDelete.id);

      toast.success("Xóa quyền kho thành công!");
      setShowDeleteDialog(false);
      setSelectedWarehouseToDelete(null);

      // Reload the warehouse permissions
      await reloadUserWarehouses();
    } catch (error) {
      console.error("Lỗi xóa quyền kho:", error);
      toast.error(error.response?.data?.message || "Không thể xóa quyền kho");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="mx-auto max-w-4xl space-y-5">
      {/* Header Card */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm sm:p-5">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-lg font-bold text-bo-foreground sm:text-xl">
            <UserCog className="h-6 w-6 text-bo-primary" />
            Thiết lập vai trò & quyền kho
          </h1>
          <p className="text-sm text-bo-muted">
            Quản lý vai trò hệ thống và kho phụ trách cho người dùng
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-bo-primary/30 bg-bo-primary-soft text-bo-primary">
          User ID: {id}
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Vai trò hệ thống */}
        <SurfaceCard
          title="1. Vai trò hệ thống"
          description="Quyền hạn tổng thể trên toàn hệ thống"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={`relative flex cursor-pointer items-center rounded-lg border p-4 transition-colors
                  ${form.role === r.value
                    ? "border-bo-primary bg-bo-primary-soft/50 shadow-sm"
                    : "border-bo-border hover:border-bo-primary/40 hover:bg-bo-surface-subtle"}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={form.role === r.value}
                  onChange={() => handleRoleChange(r.value)}
                  className="size-5 accent-bo-primary"
                />
                <div className="ml-3">
                  <p className="font-semibold text-bo-foreground">{r.value}</p>
                  <p className="mt-0.5 text-xs text-bo-muted">{r.label}</p>
                </div>
              </label>
            ))}
          </div>
        </SurfaceCard>

        {/* 2. Phân quyền kho */}
        <SurfaceCard
          title="2. Kho phụ trách & quyền chi tiết"
          description="Người dùng sẽ có quyền truy cập và thực hiện chức năng tại các kho được phân"
        >
          {userWarehouses.length > 1 && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-bo-warning/30 bg-bo-warning-soft p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-bo-warning" />
              <div className="text-sm text-bo-warning">
                <p className="font-semibold">
                  Người dùng đang có {userWarehouses.length} phân quyền kho đang hoạt động.
                </p>
                <p className="mt-1 text-xs">
                  Theo quy định, mỗi người dùng chỉ được có tối đa 1 kho đang hoạt động.
                  Hãy xóa bớt các phân quyền bên dưới (còn tối đa 1 kho) trước khi thêm kho mới.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-bo-muted">
              Thêm kho mới và thiết lập quyền chức năng cụ thể
            </p>
            <Button
              type="button"
              onClick={() => setShowAssignModal(true)}
              disabled={userWarehouses.length > 1}
              title={userWarehouses.length > 1
                ? "Xóa bớt phân quyền kho còn tối đa 1 kho trước khi thêm mới"
                : undefined}
              className="bg-bo-primary text-white hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Thêm kho & phân quyền
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-bo-primary" />
            </div>
          ) : userWarehouses.length === 0 ? (
            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle py-12 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-bo-foreground">Chưa có kho phụ trách</h3>
              <p className="mt-2 text-sm text-bo-muted">
                Nhấn nút "Thêm kho & phân quyền" để bắt đầu gán kho (tối đa 1 kho đang hoạt động) cho người dùng này.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {userWarehouses.map((item) => {
                const kho = item.kho || {};
                const active = Number(kho.trangThai) === 1;
                const permissions = item.chiTietQuyenKhos || [];

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-bo-border bg-white p-5 shadow-sm transition-shadow hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-bo-foreground">{kho.tenKho}</h4>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs uppercase text-bo-muted">{kho.maKho}</span>
                          <span className="text-xs text-slate-400">• ID: {kho.id}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-bo-muted">{kho.diaChi}</p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWarehousePermission(item)}
                          className="h-8 w-8 p-0 text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                          title="Xóa quyền kho này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Badge
                          variant={active ? "default" : "secondary"}
                          className={active ? "bg-bo-success hover:bg-bo-success/90" : ""}
                        >
                          {active ? "Hoạt động" : "Tạm khóa"}
                        </Badge>
                      </div>
                    </div>

                    {permissions.length > 0 && (
                      <div className="mt-4 border-t border-bo-border pt-4">
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-bo-foreground">
                          <ShieldCheck className="h-4 w-4 text-bo-primary" />
                          Quyền tại kho này
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {permissions.map((p) => (
                            <Badge
                              key={p.id}
                              variant="outline"
                              className="border-bo-primary/30 bg-bo-primary-soft text-bo-primary hover:bg-bo-primary-soft"
                            >
                              {p.quyenHan?.tenQuyen || p.maQuyenHan}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 border-t border-bo-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/users")}
            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <X className="mr-2 h-4 w-4" />
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            {loading ? (
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu thay đổi
          </Button>
        </div>
      </form>

      <p className="pt-4 text-center text-xs italic text-bo-muted">
        Dữ liệu được lưu vào bảng: nguoi_dung, phan_quyen_nguoi_dung_kho
      </p>

      <AssignWarehousePermissionModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        userId={id}
        onAssigned={reloadUserWarehouses}
        existingAssignments={userWarehouses}
      />

      {/* Delete Warehouse Permission Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-lg border border-bo-border bg-white text-bo-foreground shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa quyền kho</AlertDialogTitle>
            <AlertDialogDescription className="text-bo-muted">
              Bạn có chắc chắn muốn xóa quyền truy cập kho{" "}
              <span className="font-semibold">
                {selectedWarehouseToDelete?.kho?.tenKho}
              </span>{" "}
              của người dùng{" "}
              <span className="font-semibold">{user?.hoTen}</span> không?
              <br />
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteWarehousePermission}
              className="bg-bo-danger text-white hover:bg-bo-danger/90"
            >
              Xóa quyền kho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

