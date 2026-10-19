import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";

/**
 * Trang con của SettingsLayout đọc thông tin chung qua Outlet context:
 * - page:    mục cấu hình đang mở (settings.config.js)
 * - canEdit: vai trò hiện tại có được sửa mục này không
 */
export function useSettingsPage() {
  return useOutletContext();
}

/**
 * Báo cho SettingsLayout biết trang đang có thay đổi chưa lưu: chuyển mục, bấm X hay đóng tab
 * khi đó sẽ hỏi lại trước khi bỏ thay đổi.
 */
export function useUnsavedChanges(dirty) {
  const { setDirty } = useOutletContext();
  useEffect(() => {
    setDirty(Boolean(dirty));
    return () => setDirty(false);
  }, [dirty, setDirty]);
}
