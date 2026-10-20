import { Fragment, useCallback, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Lock, X } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import { cn } from "@/lib/utils";
import {
  SETTINGS_GROUPS,
  canEditSettingsPage,
  findSettingsPage,
  settingsPagesFor,
} from "@/components/settings/settings.config";

/**
 * Khung trung tâm Cấu hình (/settings/*), kiểu trang Cấu hình của Sapo:
 * - trái: menu các mục theo nhóm Cửa hàng / Kho / Bán hàng (chỉ mục vai trò được mở);
 * - phải: tiêu đề mục, nhãn "Chỉ xem" khi vai trò không được sửa, nút X quay về trang trước khi vào Cấu hình.
 * Trang con báo thay đổi chưa lưu qua useUnsavedChanges: chuyển mục / bấm X / đóng tab khi đó sẽ hỏi lại.
 */
export default function SettingsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useClaimPageTitle(true);

  const role = localStorage.getItem("role") ?? "";
  const pages = settingsPagesFor(role);
  const current = findSettingsPage(pathname);
  const allowed = Boolean(current) && pages.includes(current);
  const canEdit = canEditSettingsPage(current, role);

  // Vị trí lịch sử lúc vào Cấu hình (React Router ghi `idx` vào history.state). Khung giữ nguyên khi chuyển mục,
  // nên nút X lùi đúng về trang trước khi vào Cấu hình thay vì về mục cấu hình vừa xem.
  const [entryIdx] = useState(() => window.history.state?.idx);
  const [dirty, setDirty] = useState(false);
  // Đích đang chờ xác nhận bỏ thay đổi: { to } khi chuyển mục, { to: null } khi bấm X
  const [pendingLeave, setPendingLeave] = useState(null);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const close = useCallback(() => {
    const currentIdx = window.history.state?.idx;
    if (Number.isInteger(entryIdx) && entryIdx > 0 && Number.isInteger(currentIdx)) {
      navigate(entryIdx - 1 - currentIdx);
    } else {
      navigate("/dashboard");
    }
  }, [entryIdx, navigate]);

  const leave = (to) => {
    setDirty(false);
    if (to) navigate(to);
    else close();
  };

  const requestLeave = (to) => {
    if (dirty) setPendingLeave({ to });
    else leave(to);
  };

  // /settings hoặc đường dẫn con không có: mở mục đầu tiên vai trò được xem
  if (!current) {
    return pages.length ? <Navigate to={pages[0].to} replace /> : null;
  }

  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: pages.filter((page) => page.group === group.key),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-8 lg:p-6">
      <nav
        aria-label="Cấu hình"
        className="shrink-0 rounded-lg bg-bo-surface py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)] lg:sticky lg:top-6 lg:w-[236px]"
      >
        {groups.map((group, index) => (
          <Fragment key={group.key}>
            <p
              className={cn(
                "mx-[18px] mb-1 text-[11px] leading-4 font-semibold tracking-[0.05em] text-[#8a94a3] uppercase",
                index === 0 ? "mt-1.5" : "mt-3.5",
              )}
            >
              {group.label}
            </p>
            {group.items.map((page) => {
              const active = page === current;
              const Icon = page.icon;
              return (
                <NavLink
                  key={page.key}
                  to={page.to}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => {
                    if (!dirty || active) return;
                    event.preventDefault();
                    setPendingLeave({ to: page.to });
                  }}
                  className={cn(
                    "relative mx-2 my-0.5 flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-bo-foreground",
                    "hover:bg-bo-canvas focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
                    active &&
                      "bg-[#eef5ff] font-semibold text-bo-primary before:absolute before:inset-y-0 before:-left-2 before:w-[3px] before:rounded-r-[3px] before:bg-bo-primary hover:bg-[#eef5ff]",
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-bo-primary" : "text-[#7a8594]")} aria-hidden="true" />
                  <span className="min-w-0 truncate">{page.label}</span>
                </NavLink>
              );
            })}
          </Fragment>
        ))}
      </nav>

      <main className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex min-h-9 items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-[22px] leading-7 font-semibold tracking-[-0.01em] text-bo-heading">
            {allowed ? current.label : "Cấu hình"}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            {allowed && !canEdit ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#e9edf2] px-2.5 text-xs font-medium text-slate-700">
                <Lock className="size-[13px]" aria-hidden="true" />
                Chỉ xem
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => requestLeave(null)}
              aria-label="Đóng cấu hình, quay lại trang trước"
              title="Đóng"
              className="inline-flex size-9 items-center justify-center rounded-md bg-[#e9edf2] text-slate-700 hover:bg-[#dde3ea] hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary"
            >
              <X className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
        </header>

        {allowed ? (
          <Outlet context={{ page: current, canEdit, setDirty }} />
        ) : (
          <EmptyState
            icon={Lock}
            title="Bạn không có quyền truy cập"
            description="Tài khoản của bạn không được phép mở mục cấu hình này."
          />
        )}
      </main>

      <ConfirmModal
        isOpen={pendingLeave !== null}
        onClose={() => setPendingLeave(null)}
        onConfirm={() => {
          const target = pendingLeave;
          setPendingLeave(null);
          leave(target?.to ?? null);
        }}
        variant="warning"
        title="Bỏ thay đổi chưa lưu?"
        description="Bạn đang sửa dở mục này. Rời đi thì các thay đổi chưa lưu sẽ bị bỏ."
        confirmText="Bỏ thay đổi"
        cancelText="Ở lại"
      />
    </div>
  );
}
