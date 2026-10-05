import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { nguoiDungService } from "@/services/nguoiDungService";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB — trùng giới hạn backend

// Hộp thoại đổi ảnh đại diện của người đang đăng nhập.
// Chọn tệp / bấm "Xóa ảnh đại diện" chỉ đổi DRAFT trong hộp thoại — chưa ghi gì
// xuống server. Hủy / Escape / đóng hộp thoại vứt draft. Chỉ bấm "Lưu" mới gọi
// API (upload hoặc xóa); lỗi giữ nguyên draft để bấm lại.
export default function AvatarEditorModal({
  open,
  onOpenChange,
  userId,
  userName,
  avatarUrl,
  onSaved,
}) {
  // Draft state — chỉ tồn tại trong phiên mở hộp thoại
  const [draftFile, setDraftFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); // object URL của tệp đang chọn
  const [draftRemove, setDraftRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  // Reset draft khi mở hộp thoại; thu hồi object URL khi đóng — pattern
  // "adjust state during render" thay vì setState-in-effect cascading render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraftFile(null);
      setPreviewUrl(null);
      setDraftRemove(false);
      setSaving(false);
      setErrorMsg("");
    } else {
      // Đóng hộp thoại: vứt draft + thu hồi object URL preview
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setDraftFile(null);
      setDraftRemove(false);
      setSaving(false);
    }
  }

  // Thu hồi object URL khi bị thay thế hoặc unmount
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg("Ảnh đại diện vượt quá 2 MB. Vui lòng chọn ảnh nhỏ hơn");
      return;
    }
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP");
      return;
    }

    setErrorMsg("");
    setDraftFile(file);
    setDraftRemove(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // Draft "xóa ảnh" — chỉ đổi trạng thái draft, chưa gọi API
  const handleRemoveClick = () => {
    setErrorMsg("");
    setDraftRemove(true);
    setDraftFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const isDirty = draftRemove || draftFile != null;

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setErrorMsg("");

    try {
      let res;
      if (draftRemove) {
        res = await nguoiDungService.removeAvatar();
      } else {
        res = await nguoiDungService.uploadAvatar(draftFile);
      }
      const dto = res?.data; // ResponseData.data
      if (!dto) throw new Error("Lưu thành công nhưng response thiếu data");

      onSaved?.(dto);
      onOpenChange(false);
    } catch (err) {
      // Giữ hộp thoại + draft để người dùng thử lại
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (draftRemove
          ? "Không thể xóa ảnh đại diện. Vui lòng thử lại"
          : "Không thể lưu ảnh đại diện. Vui lòng thử lại");
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  // Preview: tệp đang chọn → ảnh hiện tại → initials (khi draft là "xóa")
  const previewSrc = draftRemove ? null : previewUrl || avatarUrl || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white text-bo-foreground sm:max-w-md"
        // Chặn đóng hộp thoại khi đang submit — lỗi sẽ giữ draft để thử lại
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Thay đổi ảnh đại diện</DialogTitle>
          <DialogDescription className="text-bo-muted">
            Chọn ảnh cá nhân của bạn (JPEG, PNG hoặc WebP, tối đa 2 MB) hoặc xóa
            ảnh đại diện hiện tại.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Preview */}
          <UserAvatar
            userId={userId}
            name={userName}
            avatarUrl={previewSrc}
            size="lg"
          />

          {errorMsg && (
            <Alert className="w-full border-bo-danger/30 bg-bo-danger-soft">
              <AlertCircle className="h-4 w-4 text-bo-danger" />
              <AlertDescription className="text-bo-danger">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <ImagePlus className="mr-2 size-4" />
              Chọn ảnh
            </Button>

            <Button
              type="button"
              variant="outline"
              className="border-bo-danger/40 bg-white text-bo-danger hover:bg-bo-danger-soft"
              onClick={handleRemoveClick}
              disabled={saving || !avatarUrl}
              title={avatarUrl ? undefined : "Bạn chưa có ảnh đại diện"}
            >
              <Trash2 className="mr-2 size-4" />
              Xóa ảnh đại diện
            </Button>
          </div>

          {draftRemove && (
            <p className="text-xs text-bo-muted">
              Sau khi Lưu, ảnh đại diện sẽ bị xóa và chuyển về chữ viết tắt tên của bạn.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={!isDirty || saving}
            onClick={handleSave}
            className="bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
