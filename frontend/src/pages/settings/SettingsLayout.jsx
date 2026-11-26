import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Lock, X } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import VungTaiTrang from "@/components/shared/VungTaiTrang";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import { tinhCoMan } from "@/hooks/useCoMan";
import useHoiKhiRoiTrang from "@/hooks/useHoiKhiRoiTrang";
import { buocVeTruocCauHinh } from "@/lib/lichSuDieuHuong";
import { cn } from "@/lib/utils";
import {
  SETTINGS_GROUPS,
  canEditSettingsPage,
  findSettingsPage,
  settingsPagesFor,
} from "@/components/settings/settings.config";
import { docTrangTruocCauHinh } from "@/components/settings/trangTruocCauHinh";
import { t } from "@/i18n";

/**
 * Khung trung tâm Cấu hình (/settings/*), kiểu trang Cấu hình của Sapo:
 * - trái: menu các mục xếp theo nhóm Cửa hàng / Mua hàng / Kho / Bán hàng / Kế toán nhưng không hiện tên nhóm (chỉ mục
 *   vai trò được mở);
 * - phải: tiêu đề mục, nhãn "Chỉ xem" khi vai trò không được sửa, nút X quay về trang trước khi vào Cấu hình.
 * Trang con báo thay đổi chưa lưu qua useUnsavedChanges: khi đó mọi cách rời mục (chuyển mục, bấm X / ←, Back của
 * trình duyệt, link ở thanh bên, ô tìm kiếm, Đăng xuất, đóng tab) đều hỏi lại trước khi bỏ thay đổi.
 * Điện thoại (< 768px) và máy tính bảng dọc cảm ứng (768–1023px): kiểu trang Cài đặt của iPhone / Android — /settings là
 * danh sách các mục theo nhóm (nút X đóng Cấu hình), chạm một mục mở trang của mục đó với nút ← về danh sách. Máy tính bảng
 * ngang cảm ứng và máy tính dùng chuột giữ menu trái. Trang một mục ở hai cách bày dùng chung một cây phần tử (menu trái
 * chỉ ẩn đi) nên xoay máy / đổi cỡ cửa sổ không dựng lại trang con (không mất phần đang sửa).
 */
export default function SettingsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useClaimPageTitle(true);
  const [coMan, setCoMan] = useState(() => tinhCoMan());
  useEffect(() => {
    const doCo = () => setCoMan(tinhCoMan());
    window.addEventListener("resize", doCo);
    return () => window.removeEventListener("resize", doCo);
  }, []);
  const danhSach = coMan === "dienThoai" || coMan === "mtbDoc";

  const role = localStorage.getItem("role") ?? "";
  const pages = settingsPagesFor(role);
  const current = findSettingsPage(pathname);
  const allowed = Boolean(current) && pages.includes(current);
  const canEdit = canEditSettingsPage(current, role);

  const [dirty, setDirty] = useState(false);
  // Đang chờ xác nhận bỏ thay đổi: { to, lui } khi bấm X (to null) / ←; { tiepTuc } khi rời bằng link, Back của
  // trình duyệt, ô tìm kiếm, Đăng xuất (useHoiKhiRoiTrang: đồng ý thì gọi tiepTuc)
  const [pendingLeave, setPendingLeave] = useState(null);
  useHoiKhiRoiTrang(dirty, (tiepTuc) => setPendingLeave({ tiepTuc }));

  // Nút X về trang ngoài Cấu hình xem gần nhất trong thẻ (BackofficeLayout ghi lại, còn sau F5 và sau khi ra vào trình
  // sửa mẫu in): trang đó nằm phía trước trong lịch sử thì lùi về đúng mục đó (giữ tab, bộ lọc của trang), không thì mở
  // thẳng đường dẫn; chưa có trang nào (mở thẳng Cấu hình ở thẻ mới) thì về Tổng quan.
  const veTrangRef = useRef(null);
  const close = useCallback(() => {
    const daLuu = docTrangTruocCauHinh();
    const buoc = buocVeTruocCauHinh(daLuu, window.history.state);
    if (buoc) {
      veTrangRef.current = daLuu.path;
      navigate(buoc);
    } else {
      navigate(daLuu?.path ?? "/dashboard");
    }
  }, [navigate]);
  // Lùi xong mà vẫn ở Cấu hình (vị trí lịch sử của lần tải trang trước, vd. gõ lại địa chỉ): mở thẳng trang đã lưu
  useEffect(() => {
    const dich = veTrangRef.current;
    if (!dich) return;
    veTrangRef.current = null;
    navigate(dich, { replace: true });
  }, [pathname, navigate]);

  // `lui`: về danh sách bằng nút lùi của lịch sử (vừa mở mục từ danh sách) thay vì thêm một mục lịch sử mới
  const diNgay = useCallback(
    ({ to, lui }) => {
      if (lui) navigate(-1);
      else if (to) navigate(to);
      else close();
    },
    [navigate, close],
  );
  // Đồng ý bỏ thay đổi: tắt lớp chặn trước rồi mới đi (lùi lịch sử là Back — lớp chặn còn bật sẽ hỏi lại lần nữa)
  const diSauRef = useRef(null);
  useEffect(() => {
    const dich = diSauRef.current;
    if (dirty || !dich) return;
    diSauRef.current = null;
    diNgay(dich);
  }, [dirty, diNgay]);
  const leave = (to, lui = false) => {
    if (!dirty) {
      diNgay({ to, lui });
      return;
    }
    diSauRef.current = { to, lui };
    setDirty(false);
  };

  const requestLeave = (to, lui = false) => {
    if (dirty) setPendingLeave({ to, lui });
    else leave(to, lui);
  };

  // Danh sách mục (điện thoại): nhớ vị trí lịch sử của trang danh sách để nút ← ở trang một mục lùi đúng về đó
  const idxDanhSach = useRef(null);
  useEffect(() => {
    if (danhSach && !current) idxDanhSach.current = window.history.state?.idx ?? null;
  }, [danhSach, current]);
  const veDanhSach = () => {
    const idx = window.history.state?.idx;
    requestLeave("/settings", Number.isInteger(idxDanhSach.current) && idx === idxDanhSach.current + 1);
  };

  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: pages.filter((page) => page.group === group.key),
  })).filter((group) => group.items.length > 0);

  // /settings hoặc đường dẫn con không có: điện thoại hiện danh sách mục; máy tính mở mục đầu tiên vai trò được xem
  if (!current) {
    if (danhSach && pages.length) {
      return <DanhSachCauHinh groups={groups} role={role} onDong={close} />;
    }
    return pages.length ? <Navigate to={pages[0].to} replace /> : null;
  }

  return (
    // Cột phải cao ít nhất bằng menu: trang ngắn cho thẻ cuối giãn (flex-1) để đáy hai khối thẳng hàng
    <div
      className={
        danhSach
          ? "mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 sm:p-5"
          : "mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-4 sm:p-5 lg:flex-row lg:gap-8 lg:p-6"
      }
    >
      {/* Mục xếp liền theo thứ tự nhóm Cửa hàng → Mua hàng → Kho → Bán hàng → Kế toán, không hiện tên nhóm (kiểu Sapo) */}
      <nav
        aria-label={t("Cài đặt")}
        className={cn(
          "shrink-0 rounded-lg bg-bo-surface py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)] lg:sticky lg:top-6 lg:w-[236px] lg:self-start",
          danhSach && "hidden",
        )}
      >
        {groups.map((group) => (
          <Fragment key={group.key}>
            {group.items.map((page) => {
              const active = page === current;
              const Icon = page.icon;
              return (
                <NavLink
                  key={page.key}
                  to={page.to}
                  aria-current={active ? "page" : undefined}
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
          {danhSach ? (
            <button
              type="button"
              onClick={veDanhSach}
              aria-label={t("Về danh sách Cài đặt")}
              className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-[#e9edf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <h1 className={cn("min-w-0 truncate text-[22px] leading-7 font-semibold tracking-[-0.01em] text-bo-heading", danhSach && "flex-1")}>
            {allowed ? current.label : t("Cài đặt")}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            {allowed && !canEdit ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#e9edf2] px-2.5 text-xs font-medium text-slate-700">
                <Lock className="size-[13px]" aria-hidden="true" />
                {t("Chỉ xem")}
              </span>
            ) : null}
            {danhSach ? null : (
            <button
              type="button"
              onClick={() => requestLeave(null)}
              aria-label={t("Đóng cài đặt, quay lại trang trước")}
              title={t("Đóng")}
              className="inline-flex size-9 items-center justify-center rounded-md bg-[#e9edf2] text-slate-700 hover:bg-[#dde3ea] hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary"
            >
              <X className="size-[18px]" aria-hidden="true" />
            </button>
            )}
          </div>
        </header>

        {allowed ? (
          <VungTaiTrang>
            <Outlet context={{ page: current, canEdit, setDirty }} />
          </VungTaiTrang>
        ) : (
          <EmptyState
            icon={Lock}
            title={t("Bạn không có quyền truy cập")}
            description={t("Tài khoản của bạn không được phép mở mục cài đặt này.")}
          />
        )}
      </main>

      <ConfirmModal
        isOpen={pendingLeave !== null}
        onClose={() => setPendingLeave(null)}
        onConfirm={() => {
          const target = pendingLeave;
          setPendingLeave(null);
          if (target?.tiepTuc) target.tiepTuc();
          else leave(target?.to ?? null, target?.lui);
        }}
        variant="warning"
        title={t("Bỏ thay đổi chưa lưu?")}
        description={t("Bạn đang sửa dở mục này. Rời đi thì các thay đổi chưa lưu sẽ bị bỏ.")}
        confirmText={t("Bỏ thay đổi")}
        cancelText={t("Ở lại")}
      />
    </div>
  );
}

/**
 * Trang /settings trên điện thoại và máy tính bảng dọc cảm ứng: các mục theo nhóm Cửa hàng / Kho / Bán hàng, mỗi mục một
 * hàng cao 48px (biểu tượng, tên, "Chỉ xem" khi vai trò không được sửa, mũi tên), như trang Cài đặt của iPhone / Android.
 */
function DanhSachCauHinh({ groups, role, onDong }) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-4 sm:p-5">
      <header className="flex min-h-9 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[22px] leading-7 font-semibold tracking-[-0.01em] text-bo-heading">{t("Cài đặt")}</h1>
        <button
          type="button"
          onClick={onDong}
          aria-label={t("Đóng cài đặt, quay lại trang trước")}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-[#e9edf2] text-slate-700 hover:bg-[#dde3ea] hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary"
        >
          <X className="size-[18px]" aria-hidden="true" />
        </button>
      </header>
      <nav aria-label={t("Cài đặt")} className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`nhom-cau-hinh-${group.key}`}>
            <h2
              id={`nhom-cau-hinh-${group.key}`}
              className="mb-1.5 px-1 text-[11px] leading-4 font-semibold tracking-[0.05em] text-[#8a94a3] uppercase"
            >
              {group.label}
            </h2>
            <ul className="divide-y divide-bo-border overflow-hidden rounded-lg bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)]">
              {group.items.map((page) => {
                const Icon = page.icon;
                return (
                  <li key={page.key}>
                    <NavLink
                      to={page.to}
                      className="flex min-h-12 items-center gap-3 px-3.5 text-[15px] font-medium text-bo-foreground active:bg-bo-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef5ff] text-bo-primary">
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{page.label}</span>
                      {canEditSettingsPage(page, role) ? null : <span className="shrink-0 text-xs text-bo-muted">{t("Chỉ xem")}</span>}
                      <ChevronRight className="size-4 shrink-0 text-[#9aa4b2]" aria-hidden="true" />
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
