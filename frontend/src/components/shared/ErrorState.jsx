import { AlertCircle, Lock, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cauMayChuCua, la403TuGoDuoc, moTaLoiKhongQuyen } from "@/components/chung-tu/loiTai";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Ô báo không tải được dữ liệu, kèm nút "Thử lại" khi có `onRetry`.
 * - `status` (mã HTTP) hoặc `error` (lỗi axios, đọc `error.response.status`): 403 không phải lỗi tạm thời nên không
 *   có "Thử lại" — vẽ như màn chặn vai trò (RequireRole): ổ khóa, "Bạn không có quyền xem mục này", "Liên hệ quản trị
 *   viên nếu bạn cần quyền này.", nút về Tổng quan. 403 vì kho đang chọn / phiên đăng nhập (người dùng tự gỡ được):
 *   câu của máy chủ và vẫn giữ "Thử lại" (khi có `onRetry`) cạnh nút về Tổng quan.
 *   `title` / `description` của trang chỉ dùng cho lỗi khác 403.
 */
export default function ErrorState({
  title = t("Không thể tải dữ liệu"),
  description = t("Đã xảy ra lỗi. Vui lòng thử lại."),
  onRetry,
  status,
  error,
  className,
}) {
  const maLoi = Number(status ?? error?.response?.status) || null;

  if (maLoi === 403) {
    const cauMayChu = cauMayChuCua(error);
    const hienThuLai = Boolean(onRetry) && la403TuGoDuoc(cauMayChu);
    return (
      <div
        role="alert"
        className={cn(
          "flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center",
          className,
        )}
      >
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-bo-primary-soft text-bo-primary">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold text-bo-foreground">{t("Bạn không có quyền xem mục này")}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-bo-muted">
          {moTaLoiKhongQuyen(cauMayChu)}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {hienThuLai ? (
            <Button
              variant="outline"
              className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
              onClick={onRetry}
            >
              <RefreshCcw />
              {t("Thử lại")}
            </Button>
          ) : null}
          <Button asChild className="bg-bo-primary text-white hover:bg-bo-primary-hover">
            <Link to="/dashboard">{t("Về trang tổng quan")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-bo-danger-soft text-bo-danger">
        <AlertCircle className="size-5" />
      </span>
      <h3 className="text-sm font-semibold text-bo-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-bo-muted">
        {description}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          className="mt-4 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
          onClick={onRetry}
        >
          <RefreshCcw />
          {t("Thử lại")}
        </Button>
      ) : null}
    </div>
  );
}
