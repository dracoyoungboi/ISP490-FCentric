import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, PackageCheck } from "lucide-react";
import { NavLink, matchPath, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { SIDEBAR_MENU, SIDEBAR_SECTIONS } from "./sidebar.config";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Mục menu có thể khai báo `match(pathname)` khi đường dẫn con thuộc mục khác
// (vd. /goods-issues/pick-lists không tính là "Phiếu xuất kho"); mặc định theo NavLink.
const isNavItemActive = (item, isActive, pathname) =>
  typeof item.match === "function" ? item.match(pathname) : isActive;

// SidebarMenuButton asChild (Radix Slot) nối className thành chuỗi, nên NavLink
// không nhận được className dạng hàm -> tự tính trạng thái active theo pathname.
const isDirectLinkActive = (item, pathname, end = false) =>
  typeof item.match === "function"
    ? item.match(pathname)
    : Boolean(matchPath({ path: item.to, end }, pathname));

// Khoảng cách flyout tới mép sidebar và tới mép viewport (px).
const FLYOUT_GAP = 8;
const FLYOUT_VIEWPORT_MARGIN = 8;
// Hover-intent: trì hoãn mở để lướt ngang menu không gây nhấp nháy,
// và giữ flyout mở trong lúc con trỏ di chuyển từ icon vào trong flyout.
const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 150;

// ---- Hiệu ứng thu gọn / mở rộng ----
// Mọi phần tử được render giống nhau ở cả hai trạng thái (không gắn/gỡ theo
// `isExpanded`), chỉ CSS theo data-collapsible của sidebar đổi hiển thị — nhờ đó
// chữ, nhóm menu và logo chuyển tiếp cùng nhịp với độ rộng thay vì bật/tắt ở
// khung hình đầu.

// Icon giữ nguyên toạ độ ngang và nằm giữa rail 4rem (63px trong viền phải):
// SidebarContent px-3 (12px) + padding trái 11px + icon 16px (SidebarMenuButton
// ép [&>svg]:size-4) => tâm icon ~31px. gap-3 đẩy chữ ra ngoài vùng nút 39px khi
// thu gọn nên chữ không bao giờ ló ra mép rail.
const MENU_BUTTON_LAYOUT = "h-10 gap-3 px-[11px]";

// Chữ: thu gọn thì mờ nhanh trước khi bị mép rail cắt, mở rộng thì hiện trễ
// một nhịp khi đã đủ chỗ. `invisible` đưa chữ ra khỏi Tab và trình đọc màn hình.
const SIDEBAR_FADE =
  "transition-[opacity,visibility] duration-200 delay-100 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-100";

// Khối co chiều cao về 0 (tiêu đề nhóm, footer) cùng nhịp với độ rộng để các
// icon trượt lên/xuống thay vì nhảy. Phần tử con phải có min-h-0 overflow-hidden.
const SIDEBAR_COLLAPSE_ROW =
  "grid grid-rows-[1fr] transition-[grid-template-rows,opacity,visibility] duration-250 ease-sidebar motion-reduce:transition-none group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:grid-rows-[0fr] group-data-[collapsible=icon]:opacity-0";

// Flyout/tooltip neo theo mép phải của rail (nút giờ rộng gần hết rail).
const getRailRight = (el) =>
  (el.closest('[data-slot="sidebar-container"]') ?? el).getBoundingClientRect()
    .right;

const isSidebarWidthTransition = (event) =>
  event.target === event.currentTarget && event.propertyName === "width";

export default function BackofficeSidebar() {
  const location = useLocation();
  const role = localStorage.getItem("role");
  const { open, isMobile, setOpenMobile } = useSidebar();

  const filteredMenu = useMemo(
    () =>
      SIDEBAR_MENU.filter(
        (item) => !item.roles || item.roles.includes(role),
      ),
    [role],
  );

  // Nhóm menu đã lọc theo section khai báo trong sidebar.config
  // (giữ đúng thứ tự của SIDEBAR_SECTIONS; bỏ nhóm không còn item nào).
  const sections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: filteredMenu.filter((item) => item.section === section.key),
      })).filter((section) => section.items.length > 0),
    [filteredMenu],
  );

  // Mobile uses a full drawer even when desktop sidebar state is collapsed.
  const isExpanded = open || isMobile;

  // Group whose children contain the current route, if any.
  const activeGroup = filteredMenu.find((item) =>
    item.children?.some((child) => location.pathname.startsWith(child.to)),
  );

  // Single-open accordion: one state tracks the currently opened group plus
  // the pathname it was last synced for. The accordion re-syncs during render
  // (React's "adjust state when a prop changes" pattern) so navigating to a
  // child route opens its parent group, and a route outside every group
  // closes them all.
  const [menuState, setMenuState] = useState(() => ({
    pathname: location.pathname,
    openMenu: activeGroup?.label ?? null,
  }));

  if (menuState.pathname !== location.pathname) {
    setMenuState({
      pathname: location.pathname,
      openMenu: activeGroup?.label ?? null,
    });
  }

  const openMenu = menuState.openMenu;

  // ---- Flyout khi sidebar thu gọn (chỉ desktop) ----
  // flyout = { label, Icon, children, left, anchorCenterY, top }
  const [flyout, setFlyout] = useState(null);
  const flyoutRef = useRef(null);
  const flyoutHeaderRef = useRef(null);
  const flyoutTriggerRef = useRef(null);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Hover-to-open chỉ bật trên thiết bị có con trỏ chuột thật;
  // thiết bị cảm ứng dùng click như bình thường.
  const canHover = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );

  const clearFlyoutTimers = () => {
    clearTimeout(openTimerRef.current);
    clearTimeout(closeTimerRef.current);
  };

  const closeFlyout = useCallback(() => {
    clearFlyoutTimers();
    setFlyout(null);
  }, []);

  // ---- Tooltip cho mục điều hướng trực tiếp khi thu gọn ----
  // Một trạng thái dùng chung cho toàn sidebar: mỗi lần hover/focus một item
  // khác là thay thế nguyên tooltip (không có 2 tooltip chồng nhau), và vị trí
  // luôn được tính lại từ rect hiện tại của đúng item đó (viewport coordinates,
  // portal ra document.body + position:fixed — cùng một hệ tọa độ).
  // railTooltip = { label, description, left, anchorCenterY, top }
  const [railTooltip, setRailTooltip] = useState(null);
  const tooltipRef = useRef(null);
  const tooltipTriggerRef = useRef(null);
  const tooltipCloseTimerRef = useRef(null);

  const clearTooltipTimer = () => clearTimeout(tooltipCloseTimerRef.current);

  const showRailTooltip = (event, label, description) => {
    clearTooltipTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect) return;
    tooltipTriggerRef.current = event.currentTarget;
    // Tính ngay trong handler: updater chạy sau, khi currentTarget đã là null.
    const left = getRailRight(event.currentTarget) + FLYOUT_GAP;
    setRailTooltip((current) => ({
      label,
      description,
      left,
      anchorCenterY: rect.top + rect.height / 2,
      top: current?.top ?? 0,
    }));
  };

  const hideRailTooltip = () => {
    clearTooltipTimer();
    tooltipCloseTimerRef.current = setTimeout(() => setRailTooltip(null), 120);
  };

  // Hover vào chính tooltip: chỉ hủy đóng, không neo lại vị trí (tránh tooltip nhảy).
  const keepTooltipOpen = () => clearTooltipTimer();

  // Căn giữa dọc theo icon đang hover và kẹp trong viewport.
  // Deps là cả object railTooltip: mỗi lần đổi item (object mới) đều tính lại
  // top — sửa lỗi tooltip kẹt ở top:0 khi hover liên tiếp nhiều item.
  useLayoutEffect(() => {
    if (!railTooltip || !tooltipRef.current) return;
    const height = tooltipRef.current.getBoundingClientRect().height;
    const top = Math.min(
      Math.max(railTooltip.anchorCenterY - height / 2, FLYOUT_VIEWPORT_MARGIN),
      window.innerHeight - height - FLYOUT_VIEWPORT_MARGIN,
    );
    setRailTooltip((current) =>
      current && top === current.top ? current : { ...current, top },
    );
  }, [railTooltip]);

  // Resize hoặc rail vừa co xong (tooltip mở khi đang chuyển động): neo lại
  // tooltip theo rect mới của item đang hover; cuộn rail thì đóng tooltip.
  useEffect(() => {
    if (!railTooltip) return undefined;
    const handleResize = () => {
      const trigger = tooltipTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setRailTooltip((current) =>
        current
          ? {
              ...current,
              left: getRailRight(trigger) + FLYOUT_GAP,
              anchorCenterY: rect.top + rect.height / 2,
            }
          : null,
      );
    };
    const handleTransitionEnd = (event) => {
      if (isSidebarWidthTransition(event)) handleResize();
    };
    // Chỉ khi vùng chứa item (rail) cuộn — cuộn trang nội dung không liên quan.
    const handleScroll = (event) => {
      const trigger = tooltipTriggerRef.current;
      if (!(event.target instanceof Node) || !event.target.contains(trigger)) return;
      clearTooltipTimer();
      setRailTooltip(null);
    };
    const container = tooltipTriggerRef.current?.closest(
      '[data-slot="sidebar-container"]',
    );
    window.addEventListener("resize", handleResize);
    container?.addEventListener("transitionend", handleTransitionEnd);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      container?.removeEventListener("transitionend", handleTransitionEnd);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [railTooltip]);

  // Đóng tooltip khi route đổi hoặc sidebar mở rộng — điều chỉnh trong render
  // (giống pattern của menuState) để tránh render thừa; timer còn treo chỉ
  // gọi setRailTooltip(null) nên vô hại.
  const [tooltipContext, setTooltipContext] = useState(() => ({
    pathname: location.pathname,
    expanded: isExpanded,
  }));

  if (
    tooltipContext.pathname !== location.pathname ||
    tooltipContext.expanded !== isExpanded
  ) {
    setTooltipContext({ pathname: location.pathname, expanded: isExpanded });
    if (railTooltip !== null) setRailTooltip(null);
  }

  // Đóng flyout khi sidebar mở rộng trở lại hoặc khi route thay đổi —
  // điều chỉnh trong render (giống pattern của menuState) để tránh render thừa.
  const [flyoutContext, setFlyoutContext] = useState(() => ({
    pathname: location.pathname,
    expanded: isExpanded,
  }));

  if (
    flyoutContext.pathname !== location.pathname ||
    flyoutContext.expanded !== isExpanded
  ) {
    setFlyoutContext({ pathname: location.pathname, expanded: isExpanded });
    if (flyout !== null) setFlyout(null);
  }

  // Key của route/trạng thái hiện tại, dùng để vô hiệu hóa timer mở flyout
  // đã lên lịch trước khi navigate/mở rộng sidebar.
  const flyoutAnchorRef = useRef({ pathname: location.pathname, expanded: isExpanded });

  useEffect(() => {
    flyoutAnchorRef.current = { pathname: location.pathname, expanded: isExpanded };
  });

  // Click ngoài / phím Escape / cuộn rail đóng flyout; resize hoặc rail vừa co
  // xong cập nhật lại vị trí (sidebar là fixed nên chỉ những lúc đó anchor lệch).
  useEffect(() => {
    if (!flyout) return undefined;

    const handleMouseDown = (event) => {
      if (flyoutRef.current?.contains(event.target)) return;
      // Click vào chính icon đang mở: để onClick xử lý toggle.
      if (flyoutTriggerRef.current?.contains(event.target)) return;
      closeFlyout();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeFlyout();
    };

    const handleResize = () => {
      const trigger = flyoutTriggerRef.current;
      if (!trigger) {
        closeFlyout();
        return;
      }
      const rect = trigger.getBoundingClientRect();
      setFlyout((current) =>
        current
          ? {
              ...current,
              left: getRailRight(trigger) + FLYOUT_GAP,
              anchorCenterY: rect.top + rect.height / 2,
            }
          : null,
      );
    };

    const handleTransitionEnd = (event) => {
      if (isSidebarWidthTransition(event)) handleResize();
    };

    // Chỉ khi vùng chứa icon (rail) cuộn; danh sách con trong flyout cuộn thì giữ.
    const handleScroll = (event) => {
      const trigger = flyoutTriggerRef.current;
      if (!(event.target instanceof Node) || !event.target.contains(trigger)) return;
      closeFlyout();
    };

    const container = flyoutTriggerRef.current?.closest(
      '[data-slot="sidebar-container"]',
    );
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    container?.addEventListener("transitionend", handleTransitionEnd);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      container?.removeEventListener("transitionend", handleTransitionEnd);
    };
  }, [flyout, closeFlyout]);

  // Dọn timer khi unmount.
  useEffect(
    () => () => {
      clearFlyoutTimers();
      clearTooltipTimer();
    },
    [],
  );

  // Căn hàng header (tên mục cha) theo chiều dọc với icon đang hover:
  // tâm header trùng tâm icon, danh sách con trải xuống bên dưới.
  // Kẹp cả panel trong viewport để menu dài không tràn màn hình.
  useLayoutEffect(() => {
    if (!flyout) return;
    const panel = flyoutRef.current;
    if (!panel) return;
    const panelHeight = panel.getBoundingClientRect().height;
    const headerHeight =
      flyoutHeaderRef.current?.getBoundingClientRect().height || 0;
    const top = Math.min(
      Math.max(flyout.anchorCenterY - headerHeight / 2, FLYOUT_VIEWPORT_MARGIN),
      window.innerHeight - panelHeight - FLYOUT_VIEWPORT_MARGIN,
    );
    if (top !== flyout.top) {
      setFlyout((current) => (current ? { ...current, top } : null));
    }
  }, [flyout]);

  const openFlyoutNow = (item, visibleChildren, triggerEl) => {
    clearFlyoutTimers();
    // Mở flyout thì đóng tooltip của direct link (không để hai overlay cùng hiện).
    clearTooltipTimer();
    setRailTooltip(null);
    flyoutTriggerRef.current = triggerEl;
    const rect = triggerEl.getBoundingClientRect();
    setFlyout((current) =>
      current?.label === item.label
        ? current
        : {
            label: item.label,
            Icon: item.icon,
            children: visibleChildren,
            left: getRailRight(triggerEl) + FLYOUT_GAP,
            anchorCenterY: rect.top + rect.height / 2,
            top: rect.top,
          },
    );
  };

  // Hover-intent: mở sau một khoảng trễ nhỏ; nếu đã có flyout khác đang mở
  // (trượt dọc menu) thì chuyển ngay không cần chờ.
  const scheduleFlyoutOpen = (item, visibleChildren, triggerEl) => {
    if (flyout?.label === item.label) {
      clearTimeout(closeTimerRef.current);
      return;
    }
    clearFlyoutTimers();
    const delay = flyout ? 0 : HOVER_OPEN_DELAY;
    const anchor = flyoutAnchorRef.current;
    openTimerRef.current = setTimeout(() => {
      // Bỏ qua nếu route/trạng thái sidebar đã đổi từ lúc lên lịch.
      if (flyoutAnchorRef.current !== anchor) return;
      openFlyoutNow(item, visibleChildren, triggerEl);
    }, delay);
  };

  // Trì hoãn đóng để con trỏ kịp đi từ icon sang flyout;
  // giữ nguyên nếu focus đang nằm trong flyout (bàn phím).
  const scheduleFlyoutClose = () => {
    clearTimeout(openTimerRef.current);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      const active = document.activeElement;
      if (
        flyoutRef.current &&
        active &&
        active instanceof Node &&
        flyoutRef.current.contains(active)
      ) {
        return;
      }
      setFlyout(null);
    }, HOVER_CLOSE_DELAY);
  };

  const toggleFlyout = (item, visibleChildren, event) => {
    // Click lại chính icon đang mở flyout -> đóng.
    if (flyout?.label === item.label) {
      closeFlyout();
      return;
    }
    openFlyoutNow(item, visibleChildren, event.currentTarget);
    // Click từ bàn phím (Enter/Space có event.detail === 0):
    // chuyển focus vào link đầu tiên để Tab đi tiếp trong flyout.
    if (event.detail === 0) {
      requestAnimationFrame(() => {
        flyoutRef.current?.querySelector("a")?.focus();
      });
    }
  };

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Mục cha chỉ còn một đích đến: khi thu gọn, link phủ thay chỗ nút (và ngược
  // lại khi mở rộng) — chuyển focus theo để Ctrl+B không làm mất focus bàn phím.
  // Gắn vào span bọc ngoài (không phải NavLink: NavLink gộp ref thành hàm mới mỗi
  // lần render và bỏ cleanup); callback ổn định nên React 19 chỉ gọi cleanup khi
  // link thật sự bị gỡ, lúc phần tử vẫn còn trong DOM.
  const railLinkRef = useCallback((wrapper) => {
    const button = wrapper.previousElementSibling;
    const link = wrapper.firstElementChild;
    if (document.activeElement === button) link?.focus();
    return () => {
      if (document.activeElement === link) button?.focus();
    };
  }, []);

  const renderItem = (item) => {
    const Icon = item.icon;
    const visibleChildren = item.children
      ? item.children.filter(
          (child) => !child.roles || child.roles.includes(role),
        )
      : null;
    const isParentActive = visibleChildren?.some((child) =>
      location.pathname.startsWith(child.to),
    );

    // Mục không có menu con: luôn điều hướng trực tiếp, cả expanded lẫn collapsed.
    if (!item.children) {
      const tooltipDescription = item.badge
        ? `${item.badge.label}: ${item.badge.description}`
        : undefined;

      // Collapsed: chỉ còn icon — nhãn hiển thị qua tooltip dùng chung
      // (hover/focus); expanded hiển thị label trực tiếp nên không cần tooltip.
      const directLinkTooltipProps = isExpanded
        ? {}
        : {
            onPointerOver: (event) =>
              showRailTooltip(event, item.label, tooltipDescription),
            onPointerOut: hideRailTooltip,
            onFocus: (event) =>
              showRailTooltip(event, item.label, tooltipDescription),
            onBlur: hideRailTooltip,
          };

      return (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            asChild
            className={MENU_BUTTON_LAYOUT}
            {...directLinkTooltipProps}
          >
            <NavLink
              to={item.to}
              end={item.to === "/dashboard"}
              onClick={handleNavigate}
              aria-label={item.label}
              className={
                isDirectLinkActive(item, location.pathname, item.to === "/dashboard")
                  ? "bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover hover:text-white"
                  : "text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white"
              }
            >
              <Icon className="size-[18px]" />
              <span className={cn("truncate", SIDEBAR_FADE)}>{item.label}</span>
              {item.badge ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={`${item.badge.label} — ${item.badge.description}`}
                      className={cn(
                        "ml-auto shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-300",
                        SIDEBAR_FADE,
                      )}
                    >
                      {item.badge.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.badge.description}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    // Không còn đích đến nào cho role hiện tại -> ẩn luôn mục cha ở cả hai trạng
    // thái (mục không được xuất hiện/biến mất khi thu gọn, làm menu nhảy).
    if (visibleChildren.length === 0) return null;

    // Mục có menu con giữ cùng một cây DOM ở cả hai trạng thái, chỉ đổi hành vi:
    // - Expanded: accordion một nhóm mở; thu gọn sidebar thì nhóm đang mở co lại
    //   cùng nhịp, mở rộng lại thì bung ra đúng nhóm trước đó.
    // - Collapsed, chỉ còn đúng một đích đến -> điều hướng thẳng qua link phủ lên
    //   nút; tooltip dùng chung hiển thị tên mục cha.
    // - Collapsed, nhiều đích đến -> hover mở flyout cạnh icon (click/Enter/Space toggle).
    const isOpen = isExpanded && openMenu === item.label;
    const isFlyoutOpen = flyout?.label === item.label;
    const contentId = `backoffice-nav-group-${filteredMenu.indexOf(item)}`;
    const onlyChild =
      !isExpanded && visibleChildren.length === 1 ? visibleChildren[0] : null;
    const isOnlyChildActive =
      onlyChild !== null && isDirectLinkActive(onlyChild, location.pathname);
    const opensFlyout = !isExpanded && onlyChild === null;

    // Link phủ nhận hover thay nút, nên nút đổi màu theo hover của cả mục.
    const buttonTone = isOnlyChildActive
      ? "bg-bo-primary font-semibold text-white group-hover/menu-item:bg-bo-primary-hover"
      : isParentActive
        ? "bg-bo-sidebar-hover font-semibold text-white hover:bg-bo-sidebar-hover hover:text-white"
        : cn(
            "text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white",
            onlyChild &&
              "group-hover/menu-item:bg-bo-sidebar-hover group-hover/menu-item:text-white",
          );

    const handleGroupClick = (event) => {
      if (isExpanded) {
        setMenuState({
          pathname: location.pathname,
          openMenu: isOpen ? null : item.label,
        });
        return;
      }
      toggleFlyout(item, visibleChildren, event);
    };

    return (
      <Collapsible key={item.label} asChild open={isOpen}>
        <SidebarMenuItem className="group/collapsible">
          <SidebarMenuButton
            type="button"
            aria-label={isExpanded ? undefined : item.label}
            aria-controls={isExpanded ? contentId : undefined}
            aria-expanded={
              isExpanded ? isOpen : opensFlyout ? isFlyoutOpen : undefined
            }
            aria-haspopup={opensFlyout ? "menu" : undefined}
            aria-hidden={onlyChild ? true : undefined}
            tabIndex={onlyChild ? -1 : undefined}
            onPointerOver={
              opensFlyout && canHover
                ? (event) =>
                    scheduleFlyoutOpen(item, visibleChildren, event.currentTarget)
                : undefined
            }
            onPointerOut={opensFlyout && canHover ? scheduleFlyoutClose : undefined}
            onClick={handleGroupClick}
            className={cn(MENU_BUTTON_LAYOUT, buttonTone)}
          >
            <Icon className="size-[18px]" />
            <span className={cn("truncate", SIDEBAR_FADE)}>{item.label}</span>
            <span aria-hidden="true" className={cn("ml-auto flex shrink-0", SIDEBAR_FADE)}>
              <ChevronDown className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </span>
          </SidebarMenuButton>

          {onlyChild ? (
            <span ref={railLinkRef} className="contents">
              <NavLink
                to={onlyChild.to}
                onClick={handleNavigate}
                aria-label={item.label}
                className="absolute inset-x-0 top-0 h-10 rounded-md outline-hidden ring-sidebar-ring focus-visible:ring-2"
                onPointerOver={(event) => showRailTooltip(event, item.label)}
                onPointerOut={hideRailTooltip}
                onFocus={(event) => showRailTooltip(event, item.label)}
                onBlur={hideRailTooltip}
              />
            </span>
          ) : null}

          <CollapsibleContent
            id={contentId}
            className="bo-submenu overflow-hidden"
          >
            <div
              className={cn(
                "ml-5 mt-1 space-y-1 border-l border-bo-sidebar-border pl-3",
                SIDEBAR_FADE,
              )}
            >
              {visibleChildren.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={handleNavigate}
                  className={({ isActive }) =>
                    `block truncate rounded-md px-3 py-2 text-[13px] leading-5 transition-colors ${
                      isNavItemActive(child, isActive, location.pathname)
                        ? "bg-bo-primary/15 font-semibold text-blue-300"
                        : "text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white"
                    }`
                  }
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  const flyoutArrowTop = flyout
    ? `clamp(8px, ${flyout.anchorCenterY - flyout.top - 5}px, calc(100% - 14px))`
    : undefined;

  return (
    <>
      <Sidebar
        id="backoffice-navigation"
        collapsible="icon"
        className="z-50 border-r border-bo-sidebar-border bg-bo-sidebar text-white"
      >
        <SidebarHeader className="h-[72px] justify-center overflow-hidden border-b border-bo-sidebar-border bg-bo-sidebar px-3">
          {/* Logo đầy đủ + icon F chồng lên nhau, biến hình qua lại bằng CSS
              (.bo-sidebar-logo / .bo-sidebar-mark trong index.css). Tâm chữ F
              nằm ở 32px — trùng tâm rail và cột icon menu. */}
          <NavLink
            to="/dashboard"
            onClick={handleNavigate}
            aria-label="FCentric — Trang tổng quan"
            className="relative block h-10 w-full shrink-0 rounded-md outline-hidden ring-sidebar-ring focus-visible:ring-2"
            {...(isExpanded
              ? {}
              : {
                  onPointerOver: (event) => showRailTooltip(event, "FCentric"),
                  onPointerOut: hideRailTooltip,
                  onFocus: (event) => showRailTooltip(event, "FCentric"),
                  onBlur: hideRailTooltip,
                })}
          >
            <img
              src="/branding/f-centric-logo.svg"
              alt=""
              className="bo-sidebar-logo absolute left-[11px] top-0 h-10 w-auto max-w-none"
              draggable={false}
            />
            <img
              src="/branding/f-centric-icon.svg"
              alt=""
              className="bo-sidebar-mark absolute left-0.5 top-1 h-8 w-auto max-w-none"
              draggable={false}
            />
          </NavLink>
        </SidebarHeader>

        <SidebarContent className="bo-sidebar-scroll bg-bo-sidebar px-3 py-3">
          {sections.map((section, index) => (
            <div key={section.key}>
              {index > 0 ? (
                <div
                  aria-hidden="true"
                  className="mx-2 my-2 border-t border-bo-sidebar-border/70"
                />
              ) : null}

              {section.label ? (
                <div className={SIDEBAR_COLLAPSE_ROW}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="truncate px-[11px] pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-bo-sidebar-muted/80">
                      {section.label}
                    </div>
                  </div>
                </div>
              ) : null}

              <SidebarGroup className="p-0">
                <SidebarMenu className="gap-1">
                  {section.items.map(renderItem)}
                </SidebarMenu>
              </SidebarGroup>
            </div>
          ))}
        </SidebarContent>

        <SidebarFooter
          className={cn(
            "border-t border-bo-sidebar-border bg-bo-sidebar p-0",
            SIDEBAR_COLLAPSE_ROW,
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center gap-3 px-[23px] py-4 text-bo-sidebar-muted">
              <PackageCheck className="size-[18px] shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  Fashion Warehouse
                </p>
                <p className="truncate text-[10px]">Internal management system</p>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      {flyout
        ? createPortal(
            <div
              id="backoffice-sidebar-flyout"
              ref={flyoutRef}
              role="menu"
              aria-label={flyout.label}
              className="fixed z-[80] flex max-h-[calc(100vh-16px)] w-60 flex-col rounded-lg border border-bo-sidebar-border bg-bo-sidebar shadow-[0_12px_32px_rgba(2,8,20,0.45)]"
              style={{ left: flyout.left, top: flyout.top }}
              onPointerOver={
                canHover
                  ? () => clearTimeout(closeTimerRef.current)
                  : undefined
              }
              onPointerOut={canHover ? scheduleFlyoutClose : undefined}
              onBlur={(event) => {
                // Focus rời flyout (không quay lại icon trigger) -> đóng.
                if (
                  !event.currentTarget.contains(event.relatedTarget) &&
                  event.relatedTarget !== flyoutTriggerRef.current
                ) {
                  scheduleFlyoutClose();
                }
              }}
            >
              <div
                aria-hidden="true"
                className="absolute -left-[5px] size-2.5 rotate-45 rounded-[1px] border-b border-l border-bo-sidebar-border bg-bo-sidebar"
                style={{ top: flyoutArrowTop }}
              />
              <div
                ref={flyoutHeaderRef}
                className="flex shrink-0 items-center gap-2.5 overflow-hidden rounded-t-[7px] border-b border-bo-sidebar-border bg-bo-sidebar-hover px-3.5 py-2.5"
              >
                <flyout.Icon className="size-[18px] shrink-0 text-white" />
                <span className="min-w-0 truncate text-sm font-semibold text-white">
                  {flyout.label}
                </span>
              </div>

              <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto rounded-b-[7px] p-1.5">
                {flyout.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    role="menuitem"
                    onClick={closeFlyout}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] leading-5 transition-colors ${
                        isNavItemActive(child, isActive, location.pathname)
                          ? "bg-bo-primary/15 font-semibold text-blue-300"
                          : "text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white"
                      }`
                    }
                  >
                    {child.icon ? (
                      <child.icon className="size-4 shrink-0 text-bo-sidebar-muted" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{child.label}</span>
                    {child.badge ? (
                      <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-300">
                        {typeof child.badge === "string"
                          ? child.badge
                          : child.badge.label}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}

      {!isExpanded && railTooltip
        ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              className="fixed z-[80] max-w-56 rounded-md border border-bo-sidebar-border bg-bo-sidebar px-2.5 py-1.5 text-xs font-medium leading-5 text-white shadow-[0_8px_24px_rgba(2,8,20,0.45)]"
              style={{ left: railTooltip.left, top: railTooltip.top }}
              onPointerOver={keepTooltipOpen}
              onPointerOut={hideRailTooltip}
            >
              <div
                aria-hidden="true"
                className="absolute -left-[5px] top-1/2 size-2.5 -translate-y-1/2 rotate-45 rounded-[1px] border-b border-l border-bo-sidebar-border bg-bo-sidebar"
              />
              <span className="block">{railTooltip.label}</span>
              {railTooltip.description ? (
                <span className="mt-0.5 block text-[10px] font-normal leading-4 text-amber-300">
                  {railTooltip.description}
                </span>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
