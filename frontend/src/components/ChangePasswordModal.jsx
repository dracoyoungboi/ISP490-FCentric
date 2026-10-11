import { getApiErrorMessage } from "@/utils/apiError";
import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { nguoiDungService } from "@/services/nguoiDungService";

const INPUT_CLASS =
  "border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20";

// Toggle nút hiện/ẩn mật khẩu — pattern dùng chung với trang Login.
function PasswordToggle({ show, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-bo-muted transition-colors hover:text-bo-foreground"
    >
      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

// Modal đổi mật khẩu của người đang đăng nhập.
// State và submit tách biệt hoàn toàn khỏi form "Thông tin cá nhân".
export default function ChangePasswordModal({ open, onOpenChange, onSuccess, forceChange = false }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Reset toàn bộ trường khi modal mở lại (pattern "adjust state during render").
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrorMsg("");
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMsg("");

    // Validate FE nhẹ trước khi gọi API
    if (!currentPassword.trim()) {
      setErrorMsg(forceChange ? "Vui lòng nhập mật khẩu tạm thời" : "Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (!newPassword || newPassword.trim().length < 6) {
      setErrorMsg("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (confirmPassword !== newPassword) {
      setErrorMsg("Xác nhận mật khẩu không khớp");
      return;
    }

    setSubmitting(true);
    try {
      // BE expects đúng payload: { currentPassword, newPassword } — không kèm id
      await nguoiDungService.changePassword({
        currentPassword,
        newPassword: newPassword.trim(),
      });

      // clear toàn bộ trường sau khi đổi thành công
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setErrorMsg(
        getApiErrorMessage(err, "Đổi mật khẩu thất bại")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!forceChange) onOpenChange(next); }}>
      <DialogContent
        className="bg-white text-bo-foreground sm:max-w-md"
        onInteractOutside={(e) => { if (forceChange) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (forceChange) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{forceChange ? "Yêu cầu đổi mật khẩu lần đầu" : "Đổi mật khẩu"}</DialogTitle>
          <DialogDescription className="text-bo-muted">
            {forceChange
              ? "Tài khoản của bạn vừa được cấp lại mật khẩu tạm thời. Vui lòng nhập mật khẩu tạm thời và tạo mật khẩu mới để tiếp tục."
              : "Cập nhật mật khẩu đăng nhập cho tài khoản của bạn."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-bo-muted" />
              {forceChange ? "Mật khẩu tạm thời (từ email)" : "Mật khẩu hiện tại"}
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={submitting}
                className={`${INPUT_CLASS} pr-10`}
              />
              <PasswordToggle
                show={showCurrent}
                onClick={() => setShowCurrent((v) => !v)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-bo-muted" />
              Mật khẩu mới
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
                className={`${INPUT_CLASS} pr-10`}
              />
              <PasswordToggle
                show={showNew}
                onClick={() => setShowNew((v) => !v)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-bo-muted" />
              Xác nhận mật khẩu mới
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                className={`${INPUT_CLASS} pr-10`}
              />
              <PasswordToggle
                show={showConfirm}
                onClick={() => setShowConfirm((v) => !v)}
                disabled={submitting}
              />
            </div>
          </div>

          {errorMsg && (
            <Alert className="border-bo-danger/30 bg-bo-danger-soft">
              <AlertCircle className="h-4 w-4 text-bo-danger" />
              <AlertDescription className="text-bo-danger">
                {errorMsg}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            {!forceChange && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
              >
                Hủy
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              <Lock className="mr-2 h-4 w-4" />
              {submitting ? "Đang xử lý..." : "Đổi mật khẩu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
