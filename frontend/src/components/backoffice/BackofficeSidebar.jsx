import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router-dom";

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
import {
  NHOM_MO_SAN_THEO_VAI_TRO,
  SIDEBAR_FOOTER_SECTION,
  SIDEBAR_MENU,
  SIDEBAR_SECTIONS,
  hienKhoLamViecODaySidebar,
} from "./sidebar.config";
import SidebarKhoLamViec from "./SidebarKhoLamViec";
import { useKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { useSoChuyenKhoanCanXuLy } from "@/components/pos/payosCanXuLy";
import { cn } from "@/lib/utils";

// Một đích điều hướng (mục thẳng hoặc mục con) khớp đường dẫn: theo `match(pathname)` nếu mục khai báo
// (vd. /goods-issues/pick-lists không tính là "Phiếu xuất kho"), không thì khớp từ đầu theo từng đoạn;
// riêng Tổng quan (/dashboard) khớp đúng đường dẫn.
const khopDich = (dich, pathname) =>
  typeof dich.match === "function"
    ? dich.match(pathname)
    : Boolean(matchPath({ path: dich.to, end: dich.to === "/dashboard" }, pathname));

// Đường dẫn nằm trong một mục (chính mục đó hoặc trang con), so theo từng đoạn: nhóm mở theo trang đang xem.
// Không so chuỗi thuần để /channels/shopifyx (trang "Không tìm thấy") không mở nhóm Shopify.
const namTrongMuc = (to, pathname) => Boolean(matchPath({ path: to, end: false }, pathname));

// Lề giữ lại khi cuộn mục đang chọn vào tầm nhìn của menu (px).
const LE_CUON_MUC = 8;

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

// Biểu tượng 16px (SidebarMenuButton ép [&>svg]:size-4). Mở rộng: lề SidebarContent 12px
// + đệm nút 11px, tâm biểu tượng ở x = 31px. Thu gọn còn rail 48px: lề 6px + đệm 10px,
// tâm ở x = 24px, giữa rail (lề, đệm và chuyển động ở .bo-sidebar-content /
// .bo-sidebar-item trong index.css).
// gap-3 đẩy chữ ra ngoài vùng nút 36px khi thu gọn nên chữ không bao giờ ló ra mép rail.
const MENU_BUTTON_LAYOUT = "bo-sidebar-item h-10 gap-3 px-[11px]";
// Mục Cấu hình ghim ở đáy: thấp hơn 4px để khối đáy gọn
const FOOTER_BUTTON_LAYOUT = "bo-sidebar-item h-9 gap-3 px-[11px]";

// ---- Màu mục menu ----
// Đang chọn: nền sáng hơn sidebar một bậc, chữ trắng đậm, chỉ icon mang màu xanh
// (không tô khối xanh đặc để không lấn át nội dung trang). Mỗi lúc chỉ một khối được tô.
// Nhấn: nền sáng thêm một bậc và co nhẹ 2% (tắt co khi giảm chuyển động).
const ITEM_IDLE = "text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white";
const ITEM_ACTIVE =
  "bg-bo-sidebar-active font-semibold text-white hover:bg-bo-sidebar-active-hover hover:text-white";
const ITEM_ICON_ACTIVE = "[&>svg]:text-bo-sidebar-icon-active";
const ITEM_PRESS = "active:bg-bo-sidebar-press motion-safe:active:scale-98";
// Mục menu con (sidebar mở rộng và flyout): cùng màu, chuyển cả độ co khi nhấn.
const SUB_ITEM_TONE = (active) =>
  cn(
    "transition-[color,background-color,scale] active:bg-bo-sidebar-press motion-safe:active:scale-98",
    active
      ? "bg-bo-sidebar-active font-semibold text-white hover:bg-bo-sidebar-active-hover"
      : ITEM_IDLE,
  );

// Chữ: thu gọn thì mờ nhanh trước khi bị mép rail cắt, mở rộng thì hiện trễ
// một nhịp khi đã đủ chỗ. `invisible` đưa chữ ra khỏi Tab và trình đọc màn hình.
const SIDEBAR_FADE =
  "transition-[opacity,visibility] duration-200 delay-100 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-100";

// Khối co chiều cao về 0 (tiêu đề nhóm) cùng nhịp với độ rộng để các
// icon trượt lên/xuống thay vì nhảy. Phần tử con phải có min-h-0 overflow-hidden.
const SIDEBAR_COLLAPSE_ROW =
  "grid grid-rows-[1fr] transition-[grid-template-rows,opacity,visibility] duration-250 ease-sidebar motion-reduce:transition-none group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:grid-rows-[0fr] group-data-[collapsible=icon]:opacity-0";

// Flyout/tooltip neo theo mép phải của rail (nút giờ rộng gần hết rail).
const getRailRight = (el) =>
  (el.closest('[data-slot="sidebar-container"]') ?? el).getBoundingClientRect()
    .right;

const isSidebarWidthTransition = (event) =>
  event.target === event.currentTarget && event.propertyName === "width";

// Phím bổ trợ của phím tắt Ctrl + B (thu gọn / mở rộng menu, khai báo ở ui/sidebar.jsx):
// ⌘ trên máy Mac, Ctrl trên Windows/Linux — cùng cách BackofficeHeader hiện Ctrl + K.
const PHIM_MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "") ? "⌘" : "Ctrl";

// Rê chuột vào nút thu gọn bao lâu thì hiện chú thích (focus bằng bàn phím thì hiện ngay).
const TOGGLE_TOOLTIP_DELAY = 300;

// Biểu tượng nút thu gọn (vẽ riêng, khung 20×20). Khung ngoài cao 16,6px: cạnh trên chạm
// đỉnh chữ thường, cạnh dưới chạm chân chữ "Centric" của logo 36px. Cột trái co lại khi
// rê chuột lúc đang mở rộng, giãn ra lúc đang thu gọn — gợi hướng menu sắp đổi.
function BieuTuongKhungMenu({ thuGon }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <rect
        x="1.875"
        y="2.575"
        width="16.25"
        height="14.85"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="4.25"
        y="5.25"
        width="3.25"
        height="9.5"
        rx="1.1"
        fill="currentColor"
        className={cn(
          "origin-left transition-transform duration-200 [transform-box:fill-box] motion-reduce:transition-none",
          thuGon
            ? "group-hover/tg:scale-x-[1.6] group-focus-visible/tg:scale-x-[1.6]"
            : "group-hover/tg:scale-x-[0.55] group-focus-visible/tg:scale-x-[0.55]",
        )}
      />
    </svg>
  );
}

/**
 * Số đếm việc cần xử lý (vd. giao dịch chuyển khoản lỗi): chữ số trơn màu đỏ, không viền, không nền — gọn trên nền
 * menu tối, chỉ việc "có vấn đề" mới được tô đỏ. 0 thì không vẽ.
 * `anChuDoc`: nơi đặt đã đọc số qua aria-label (nút nhóm) thì không lặp lại cho trình đọc màn hình.
 */
function SoDemMenu({ so, anChuDoc = false }) {
  if (!so) return null;
  return (
    <span className="ml-auto shrink-0 text-xs font-semibold leading-5 text-red-400 tabular-nums">
      <span aria-hidden="true">{so > 99 ? "99+" : so}</span>
      {anChuDoc ? null : <span className="sr-only">({so} cần xử lý)</span>}
    </span>
  );
}

export default function BackofficeSidebar() {
  const location = useLocation();
  const role = localStorage.getItem("role");
  const { open, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  // Mục của từng sàn (khai báo `maKenh`) chỉ hiện khi gian hàng đã kết nối
  const kenhDaKetNoi = useKenhDaKetNoi();
  // Số đếm cạnh mục con khai báo `badge`
  const soChuyenKhoanCanXuLy = useSoChuyenKhoanCanXuLy();
  const soDem = (child) => (child.badge === "payosCanXuLy" ? soChuyenKhoanCanXuLy : 0);

  const filteredMenu = useMemo(
    () =>
      SIDEBAR_MENU.filter(
        (item) =>
          (!item.roles || item.roles.includes(role)) &&
          (!item.maKenh || kenhDaKetNoi.includes(item.maKenh)),
      ).map((item) =>
        item.matchKenh ? { ...item, match: (path) => item.matchKenh(path, kenhDaKetNoi) } : item,
      ),
    [role, kenhDaKetNoi],
  );

  // Nhóm menu đã lọc theo section khai báo trong sidebar.config
  // (giữ đúng thứ tự của SIDEBAR_SECTIONS; bỏ nhóm không còn item nào).
  // Mục khai báo `hienThi: "nut-them"` (Tất cả kênh) không là một dòng menu mà là nút "+" trên tiêu đề nhóm.
  const sections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((section) => {
        const cuaNhom = filteredMenu.filter((item) => item.section === section.key);
        const items = cuaNhom.filter((item) => item.hienThi !== "nut-them");
        const nutThem = cuaNhom.find((item) => item.hienThi === "nut-them") ?? null;
        // Vai trò chỉ thấy đúng một mục và không có nút "+": ẩn tiêu đề, giữ đường kẻ
        const hienTieuDe = Boolean(section.label) && !(section.anTieuDeKhiMotMuc && items.length === 1 && !nutThem);
        return { ...section, items, nutThem, hienTieuDe };
      }).filter((section) => section.items.length > 0 || section.nutThem),
    [filteredMenu],
  );

  // Mobile uses a full drawer even when desktop sidebar state is collapsed.
  const isExpanded = open || isMobile;

  // Mục ghim ở đáy sidebar (Cấu hình): luôn là link thẳng, không mở nhóm con.
  const footerItem = filteredMenu.find((item) => item.section === SIDEBAR_FOOTER_SECTION) ?? null;
  // Vai trò làm theo kho mà không có mục Cấu hình (nhân viên): đáy sidebar hiện kho làm việc
  const showKhoLamViec = !footerItem && hienKhoLamViecODaySidebar(role);

  // Group whose children contain the current route, if any.
  const activeGroup = filteredMenu.find(
    (item) =>
      item !== footerItem &&
      item.children?.some((child) => namTrongMuc(child.to, location.pathname)),
  );
  const activeGroupLabel = activeGroup?.label ?? null;

  // Trang đang mở: mỗi lúc chỉ MỘT đích được tô nổi bật và mang aria-current="page", là đích khớp cụ thể
  // nhất (đường dẫn dài nhất). NavLink tự đánh dấu mọi link khớp tiền tố (ở /channels/lazada/orders cả
  // /channels lẫn /channels/lazada đều thành "trang hiện tại"), nên menu dùng Link và tự gắn aria-current.
  // Mục ghim ở đáy (Cấu hình) là link thẳng: mục con của nó không vẽ trên menu nên không xét.
  const dichHienTai = useMemo(() => {
    let tot = null;
    for (const item of filteredMenu) {
      const dsDich =
        item.children && item.section !== SIDEBAR_FOOTER_SECTION
          ? item.children.filter((child) => !child.roles || child.roles.includes(role))
          : [item];
      for (const dich of dsDich) {
        if (dich.to && khopDich(dich, location.pathname) && (tot === null || dich.to.length > tot.length)) {
          tot = dich.to;
        }
      }
    }
    return tot;
  }, [filteredMenu, role, location.pathname]);
  const laHienTai = (dich) => dich.to === dichHienTai;

  // Single-open accordion: one state tracks the currently opened group plus
  // the pathname and active group it was last synced for. The accordion re-syncs during render
  // (React's "adjust state when a prop changes" pattern) so navigating to a
  // child route opens its parent group, and a route outside every group
  // closes them all. Nhóm chứa trang đổi mà đường dẫn giữ nguyên (vừa kết nối sàn ngay trên trang Thiết lập:
  // danh sách sàn đã kết nối đổi, nhóm của sàn hiện ra) cũng đồng bộ lại để nhóm đó tự mở, không phải tải lại trang.
  // Vào Tổng quan (chưa thuộc nhóm nào) thì mở sẵn nhóm việc chính của vai trò (NHOM_MO_SAN_THEO_VAI_TRO).
  const nhomMoSan = (pathname) =>
    activeGroupLabel ?? (pathname === "/dashboard" ? (NHOM_MO_SAN_THEO_VAI_TRO[role] ?? null) : null);

  const [menuState, setMenuState] = useState(() => ({
    pathname: location.pathname,
    activeGroup: activeGroupLabel,
    openMenu: nhomMoSan(location.pathname),
  }));

  if (menuState.pathname !== location.pathname || menuState.activeGroup !== activeGroupLabel) {
    setMenuState({
      pathname: location.pathname,
      activeGroup: activeGroupLabel,
      openMenu: nhomMoSan(location.pathname),
    });
  }

  const openMenu = menuState.openMenu;

  // ---- Giữ mục đang chọn trong tầm nhìn của vùng cuộn menu ----
  // Mở thẳng một trang ở cuối menu (vd. Cấu hình của TikTok Shop trên màn 1366×800) thì mục đang chọn nằm
  // dưới mép vùng cuộn. Khi vào trang, đổi trang hoặc nhóm chứa trang đổi, cuộn riêng vùng menu vừa đủ để
  // mục đó lọt vào tầm nhìn (như scrollIntoView block "nearest"); tự đặt scrollTop để không bao giờ cuộn trang chính.
  const vungCuonRef = useRef(null);
  const choCuonSauHieuUngRef = useRef(false);

  const cuonToiMucHienTai = useCallback(() => {
    const vung = vungCuonRef.current;
    if (!vung) return;
    // Link của trang đang mở; nhóm đang đóng, menu thu gọn hay trang không có mục riêng (Thiết lập) thì nút của nhóm.
    const muc =
      vung.querySelector('[aria-current="page"]') ?? vung.querySelector("[data-nhom-hien-tai]");
    if (!muc) return;
    const khung = vung.getBoundingClientRect();
    const viTri = muc.getBoundingClientRect();
    if (viTri.top < khung.top + LE_CUON_MUC) {
      vung.scrollTop -= khung.top + LE_CUON_MUC - viTri.top;
    } else if (viTri.bottom > khung.bottom - LE_CUON_MUC) {
      vung.scrollTop += viTri.bottom - (khung.bottom - LE_CUON_MUC);
    }
  }, []);

  // Ngăn kéo menu trên điện thoại dựng lại vùng cuộn mỗi lần mở: cuộn ngay khi vùng cuộn gắn vào trang.
  const ganVungCuon = useCallback(
    (node) => {
      vungCuonRef.current = node;
      if (node) cuonToiMucHienTai();
    },
    [cuonToiMucHienTai],
  );

  useEffect(() => {
    cuonToiMucHienTai();
    // Nhóm vừa mở / đóng còn đang co giãn (.bo-submenu, 250 ms) nên vị trí chưa cuối cùng:
    // cuộn lại khi hiệu ứng xong (khiHetHieuUngMenu). Quá hạn thì thôi, để người dùng tự mở nhóm khác không bị kéo về.
    choCuonSauHieuUngRef.current = true;
    const hen = setTimeout(() => {
      choCuonSauHieuUngRef.current = false;
    }, 500);
    return () => {
      clearTimeout(hen);
      choCuonSauHieuUngRef.current = false;
    };
  }, [location.pathname, dichHienTai, activeGroupLabel, cuonToiMucHienTai]);

  const khiHetHieuUngMenu = useCallback(
    (event) => {
      if (choCuonSauHieuUngRef.current && event.target.classList?.contains("bo-submenu")) {
        cuonToiMucHienTai();
      }
    },
    [cuonToiMucHienTai],
  );

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
  // railTooltip = { label, description, placement, phimTat, left, anchorCenterY,
  //                 anchorRight, anchorBottom, top }
  // placement "right": cạnh phải rail (mục menu khi thu gọn) — mặc định.
  // placement "bottom": dưới nút, canh mép phải nút (nút thu gọn khi menu đang mở rộng).
  // phimTat: hiện thêm phím tắt Ctrl B dạng phím.
  // xuyenChuot: chú thích chỉ để đọc, không giữ chuột — bấm xuyên qua được xuống mục bên dưới.
  const [railTooltip, setRailTooltip] = useState(null);
  const tooltipRef = useRef(null);
  const tooltipTriggerRef = useRef(null);
  const tooltipCloseTimerRef = useRef(null);
  const tooltipOpenTimerRef = useRef(null);
  const toggleButtonRef = useRef(null);
  // Mục đang mang title tên đầy đủ (xem showFullLabelIfTruncated).
  const titledItemRef = useRef(null);

  const clearTooltipTimer = () => {
    clearTimeout(tooltipCloseTimerRef.current);
    clearTimeout(tooltipOpenTimerRef.current);
  };

  const showRailTooltipAt = (element, label, description, tuyChon = {}) => {
    clearTooltipTimer();
    const rect = element?.getBoundingClientRect();
    if (!rect) return;
    tooltipTriggerRef.current = element;
    const placement = tuyChon.placement ?? "right";
    // Tính ngay ở đây: updater chạy sau, khi currentTarget của sự kiện đã là null.
    const left =
      placement === "bottom" ? rect.right : getRailRight(element) + FLYOUT_GAP;
    setRailTooltip((current) => ({
      label,
      description,
      placement,
      phimTat: Boolean(tuyChon.phimTat),
      xuyenChuot: Boolean(tuyChon.xuyenChuot),
      left,
      anchorCenterY: rect.top + rect.height / 2,
      anchorRight: rect.right,
      anchorBottom: rect.bottom,
      top: current?.top ?? 0,
    }));
  };

  const showRailTooltip = (event, label, description) =>
    showRailTooltipAt(event.currentTarget, label, description);

  const hideRailTooltip = () => {
    clearTooltipTimer();
    tooltipCloseTimerRef.current = setTimeout(() => setRailTooltip(null), 120);
  };

  // Hover vào chính tooltip: chỉ hủy đóng, không neo lại vị trí (tránh tooltip nhảy).
  const keepTooltipOpen = () => clearTooltipTimer();

  // Căn giữa dọc theo icon đang hover và kẹp trong viewport.
  // Deps là cả object railTooltip: mỗi lần đổi item (object mới) đều tính lại
  // top — sửa lỗi tooltip kẹt ở top:0 khi hover liên tiếp nhiều item.
  // Chú thích đặt dưới nút: canh mép phải với nút, không tràn mép trái màn hình.
  useLayoutEffect(() => {
    if (!railTooltip || !tooltipRef.current) return;
    const { width, height } = tooltipRef.current.getBoundingClientRect();
    const isBottom = railTooltip.placement === "bottom";
    const top = isBottom
      ? railTooltip.anchorBottom + FLYOUT_GAP
      : Math.min(
          Math.max(railTooltip.anchorCenterY - height / 2, FLYOUT_VIEWPORT_MARGIN),
          window.innerHeight - height - FLYOUT_VIEWPORT_MARGIN,
        );
    const bottomLeft = Math.max(railTooltip.anchorRight - width, FLYOUT_VIEWPORT_MARGIN);
    setRailTooltip((current) => {
      if (!current) return current;
      const left = isBottom ? bottomLeft : current.left;
      if (top === current.top && left === current.left) return current;
      return { ...current, top, left };
    });
  }, [railTooltip]);

  // Resize hoặc rail vừa co xong (tooltip mở khi đang chuyển động): neo lại
  // tooltip theo rect mới của item đang hover; cuộn rail thì đóng tooltip.
  useEffect(() => {
    if (!railTooltip) return undefined;
    const handleResize = () => {
      const trigger = tooltipTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setRailTooltip((current) => {
        if (!current) return null;
        if (current.placement === "bottom") {
          return { ...current, anchorRight: rect.right, anchorBottom: rect.bottom };
        }
        return {
          ...current,
          left: getRailRight(trigger) + FLYOUT_GAP,
          anchorCenterY: rect.top + rect.height / 2,
        };
      });
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

  // Thu gọn / mở rộng (kể cả bằng Ctrl + B) khi chú thích của nút thu gọn đang chờ hiện:
  // hủy lượt chờ, tránh hiện chú thích cũ ở vị trí nút cũ. Đồng thời gỡ title tên đầy đủ
  // của mục đang rê chuột, để khi thu gọn không hiện chồng với chú thích của rail.
  useEffect(
    () => () => {
      clearTimeout(tooltipOpenTimerRef.current);
      titledItemRef.current?.removeAttribute("title");
      titledItemRef.current = null;
    },
    [isExpanded],
  );

  // Thu gọn (Ctrl + B) khi logo hoặc nút "+" trên tiêu đề nhóm đang được focus bằng bàn phím: hai phần tử đó
  // ẩn đi khi thu gọn (không focus được nữa), nên chuyển focus sang nút mở rộng để không mất focus.
  useEffect(() => {
    if (isExpanded) return;
    const button = toggleButtonRef.current;
    const active = document.activeElement;
    if (button && active !== button && active?.closest(".bo-sidebar-head, [data-nut-them]")) button.focus();
  }, [isExpanded]);

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
    if (top !== flyout.top || headerHeight !== flyout.headerHeight) {
      setFlyout((current) => (current ? { ...current, top, headerHeight } : null));
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

  // ---- Nút thu gọn ở đầu sidebar ----
  // Chỉ máy tính; trên điện thoại menu là ngăn kéo, mở bằng nút ở thanh trên.
  const showToggleButton = !isMobile;
  const toggleLabel = isExpanded ? "Thu gọn menu" : "Mở rộng menu";

  const showToggleTooltip = (element) =>
    showRailTooltipAt(element, toggleLabel, undefined, {
      placement: isExpanded ? "bottom" : "right",
      phimTat: true,
      // Chú thích nằm đè lên mục "Tổng quan" / ô tìm kiếm: không được chặn cú bấm.
      xuyenChuot: true,
    });

  const scheduleToggleTooltip = (event) => {
    const element = event.currentTarget;
    // Đang có chú thích của mục khác: đổi ngay sang chú thích của nút (như tooltip thường).
    if (railTooltip) {
      showToggleTooltip(element);
      return;
    }
    // Chỉ hủy lượt chờ hiện; lượt đóng của chú thích trước (nếu có) vẫn chạy đúng giờ.
    clearTimeout(tooltipOpenTimerRef.current);
    tooltipOpenTimerRef.current = setTimeout(
      () => showToggleTooltip(element),
      TOGGLE_TOOLTIP_DELAY,
    );
  };

  // Nhãn bị cắt (vd "Danh mục & sản p…") hiện tên đầy đủ khi rê chuột, qua title của mục.
  // Chỉ gắn khi đang mở rộng và chữ thật sự bị cắt; khi thu gọn đã có chú thích riêng.
  const showFullLabelIfTruncated = (event) => {
    const element = event.currentTarget;
    const label = element.matches("[data-nhan]") ? element : element.querySelector("[data-nhan]");
    if (isExpanded && label && label.scrollWidth > label.clientWidth + 1) {
      element.title = label.textContent;
      titledItemRef.current = element;
    } else {
      element.removeAttribute("title");
    }
  };

  const handleToggleClick = () => {
    clearTooltipTimer();
    setRailTooltip(null);
    toggleSidebar();
  };

  // Mục điều hướng thẳng (không có menu con, hoặc mục ghim ở đáy): cả expanded lẫn collapsed.
  // `layout`: lớp kích thước của nút (mục ghim ở đáy dùng bản thấp hơn).
  const renderDirectLink = (item, layout = MENU_BUTTON_LAYOUT) => {
    const Icon = item.icon;
    const hienTai = laHienTai(item);

    // Collapsed: chỉ còn icon — nhãn hiển thị qua tooltip dùng chung
    // (hover/focus); expanded hiển thị label trực tiếp nên không cần tooltip.
    const directLinkTooltipProps = isExpanded
      ? {}
      : {
          onPointerOver: (event) => showRailTooltip(event, item.label),
          onPointerOut: hideRailTooltip,
          onFocus: (event) => showRailTooltip(event, item.label),
          onBlur: hideRailTooltip,
        };

    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton
          asChild
          className={layout}
          onPointerEnter={showFullLabelIfTruncated}
          {...directLinkTooltipProps}
        >
          <Link
            to={item.to}
            onClick={handleNavigate}
            aria-label={item.label}
            aria-current={hienTai ? "page" : undefined}
            className={cn(hienTai ? cn(ITEM_ACTIVE, ITEM_ICON_ACTIVE) : ITEM_IDLE, ITEM_PRESS)}
          >
            <Icon className="size-[18px]" />
            <span data-nhan className={cn("truncate", SIDEBAR_FADE)}>{item.label}</span>
            {item.badge ? (
              <span className={cn("ml-auto flex shrink-0", SIDEBAR_FADE)}>
                <SoDemMenu so={soDem(item)} />
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
        {/* Menu thu gọn: số bị ẩn cùng nhãn, thay bằng chấm đỏ như nút nhóm */}
        {item.badge && soDem(item) > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[21px] top-[10px] hidden size-2 rounded-full bg-red-500 ring-2 ring-bo-sidebar group-data-[collapsible=icon]:block"
          />
        ) : null}
      </SidebarMenuItem>
    );
  };

  // Đường kẻ mảnh giữa chứng từ và dữ liệu gốc trong cùng một nhóm (mục con khai báo `nhom` khác mục liền trước).
  // Tính trên danh sách mục con đã lọc theo vai trò, nên vai trò không thấy mục nào phía trước thì không có đường kẻ.
  const keTruoc = (dsCon, viTri) =>
    viTri > 0 && Boolean(dsCon[viTri].nhom) && Boolean(dsCon[viTri - 1].nhom) && dsCon[viTri].nhom !== dsCon[viTri - 1].nhom;

  const renderItem = (item) => {
    if (!item.children) return renderDirectLink(item);

    const Icon = item.icon;
    const visibleChildren = item.children.filter(
      (child) => !child.roles || child.roles.includes(role),
    );

    // Không còn đích đến nào cho role hiện tại -> ẩn luôn mục cha ở cả hai trạng
    // thái (mục không được xuất hiện/biến mất khi thu gọn, làm menu nhảy).
    if (visibleChildren.length === 0) return null;

    // Vai trò chỉ thấy đúng một mục con (vd. quản lý kho chỉ có "Đơn bán hàng" trong nhóm Bán hàng): hiện thẳng mục đó
    // thành link cấp 1 mang icon của nhóm, ở cả hai trạng thái — không bắt bấm mở một nhóm chỉ có một dòng.
    if (visibleChildren.length === 1) {
      const [conDuyNhat] = visibleChildren;
      return renderDirectLink({ ...conDuyNhat, icon: item.icon });
    }

    const isParentActive = visibleChildren.some((child) =>
      namTrongMuc(child.to, location.pathname),
    );

    // Mục có menu con giữ cùng một cây DOM ở cả hai trạng thái, chỉ đổi hành vi:
    // - Expanded: accordion một nhóm mở; thu gọn sidebar thì nhóm đang mở co lại
    //   cùng nhịp, mở rộng lại thì bung ra đúng nhóm trước đó.
    // - Collapsed -> hover mở flyout cạnh icon (click/Enter/Space toggle).
    const isOpen = isExpanded && openMenu === item.label;
    const isFlyoutOpen = flyout?.label === item.label;
    const contentId = `backoffice-nav-group-${filteredMenu.indexOf(item)}`;
    const opensFlyout = !isExpanded;
    // Số việc cần xử lý của cả nhóm: nhóm đóng thì hiện cạnh tên nhóm, menu thu gọn thì thành chấm đỏ trên icon,
    // để không bị giấu khi không thấy mục con. Nhóm mở thì số chỉ nằm ở mục con, không đếm hai lần.
    const tongSoDem = visibleChildren.reduce((tong, child) => tong + soDem(child), 0);
    const hienSoNhom = isExpanded && !isOpen && tongSoDem > 0;
    const nhanNhom = tongSoDem > 0 ? `${item.label}, ${tongSoDem} việc cần xử lý` : item.label;

    // Mục cha chứa trang đang mở: khi nhóm đang bung (thấy mục con được tô) thì cha
    // chỉ đổi chữ trắng + icon xanh; khi nhóm đóng hoặc sidebar thu gọn (không thấy
    // mục con) thì cha được tô như mục đang chọn để vẫn biết mình đang ở đâu.
    const showsActive = isParentActive && !isOpen;
    const buttonTone = cn(
      showsActive
        ? "bg-bo-sidebar-active font-semibold text-white hover:bg-bo-sidebar-active-hover hover:text-white"
        : isParentActive
          ? "font-semibold text-white hover:bg-bo-sidebar-hover hover:text-white"
          : ITEM_IDLE,
      isParentActive && ITEM_ICON_ACTIVE,
      ITEM_PRESS,
    );

    const handleGroupClick = (event) => {
      if (isExpanded) {
        setMenuState((current) => ({
          ...current,
          openMenu: isOpen ? null : item.label,
        }));
        return;
      }
      toggleFlyout(item, visibleChildren, event);
    };

    return (
      <Collapsible key={item.label} asChild open={isOpen}>
        <SidebarMenuItem className="group/collapsible">
          <SidebarMenuButton
            type="button"
            aria-label={isExpanded ? (tongSoDem > 0 ? nhanNhom : undefined) : nhanNhom}
            aria-controls={isExpanded ? contentId : undefined}
            aria-expanded={isExpanded ? isOpen : isFlyoutOpen}
            aria-haspopup={opensFlyout ? "menu" : undefined}
            // Đích cuộn của cuonToiMucHienTai khi không thấy link của trang đang mở
            data-nhom-hien-tai={isParentActive ? "" : undefined}
            onPointerOver={
              opensFlyout && canHover
                ? (event) =>
                    scheduleFlyoutOpen(item, visibleChildren, event.currentTarget)
                : undefined
            }
            onPointerOut={opensFlyout && canHover ? scheduleFlyoutClose : undefined}
            onPointerEnter={showFullLabelIfTruncated}
            onClick={handleGroupClick}
            className={cn(MENU_BUTTON_LAYOUT, buttonTone)}
          >
            <Icon className="size-[18px]" />
            <span data-nhan className={cn("truncate", SIDEBAR_FADE)}>{item.label}</span>
            <span aria-hidden="true" className={cn("ml-auto flex shrink-0 items-center gap-2", SIDEBAR_FADE)}>
              {hienSoNhom ? <SoDemMenu so={tongSoDem} anChuDoc /> : null}
              <ChevronDown className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </span>
          </SidebarMenuButton>

          {/* Menu thu gọn: chấm đỏ góc trên phải icon nhóm khi trong nhóm có việc cần xử lý (số nằm trong aria-label) */}
          {tongSoDem > 0 ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[21px] top-[10px] hidden size-2 rounded-full bg-red-500 ring-2 ring-bo-sidebar group-data-[collapsible=icon]:block"
            />
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
              {visibleChildren.map((child, viTri) => (
                <Fragment key={child.to}>
                  {keTruoc(visibleChildren, viTri) ? (
                    <div aria-hidden="true" className="mx-1 border-t border-bo-sidebar-border" />
                  ) : null}
                  <Link
                    to={child.to}
                    onClick={handleNavigate}
                    onPointerEnter={showFullLabelIfTruncated}
                    aria-current={laHienTai(child) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] leading-5",
                      SUB_ITEM_TONE(laHienTai(child)),
                    )}
                  >
                    <span data-nhan className="min-w-0 flex-1 truncate">{child.label}</span>
                    <SoDemMenu so={soDem(child)} />
                  </Link>
                </Fragment>
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
  // Mũi tên cùng màu vùng nó đè lên để nửa trong panel chìm vào nền, chỉ còn
  // tam giác như tooltip: thường là header; mục sát đáy màn hình làm panel bị
  // đẩy lên thì mũi tên rơi xuống phần danh sách con.
  const flyoutArrowOnHeader =
    flyout != null && flyout.anchorCenterY - flyout.top < flyout.headerHeight;

  return (
    <>
      <Sidebar
        id="backoffice-navigation"
        collapsible="icon"
        className="z-50 border-r border-bo-sidebar-border bg-bo-sidebar text-white"
      >
        {/* Cao 57px = thanh trên (h-14 + viền dưới 1px), nên hai đường kẻ ngang thẳng hàng. */}
        <SidebarHeader className="bo-sidebar-head group/head relative h-[57px] flex-row items-center overflow-hidden border-b border-bo-sidebar-border bg-bo-sidebar px-3">
          {/* Logo đầy đủ (cao 36px) + icon F chồng lên nhau, biến hình qua lại bằng CSS
              (.bo-sidebar-logo / .bo-sidebar-mark trong index.css). Khi thu gọn, chữ F
              cao 28px, tâm ở x = 24px — giữa rail 48px, thẳng cột biểu tượng menu. Lúc
              đó logo chỉ để nhìn: nút mở rộng hiện chồng lên chữ F khi rê chuột / Tab tới.
              Link thường: logo không mang aria-current (mục "Tổng quan" của menu đã mang). */}
          <Link
            to="/dashboard"
            onClick={handleNavigate}
            aria-label="FCentric — Trang tổng quan"
            tabIndex={isExpanded ? undefined : -1}
            aria-hidden={isExpanded ? undefined : true}
            className={cn(
              "relative block h-9 min-w-0 flex-1 rounded-md outline-hidden ring-sidebar-ring focus-visible:ring-2",
              // Chừa chỗ cho nút thu gọn (28px + 5px) nằm đè ở mép phải đầu sidebar.
              showToggleButton && "mr-[33px]",
              !isExpanded && "pointer-events-none",
            )}
          >
            <img
              src="/branding/f-centric-logo.svg"
              alt=""
              className="bo-sidebar-logo absolute left-[11px] top-0 h-9 w-auto max-w-none"
              draggable={false}
            />
            <img
              src="/branding/f-centric-icon.svg"
              alt=""
              className="bo-sidebar-mark absolute left-0.5 top-0.5 h-8 w-auto max-w-none"
              draggable={false}
            />
          </Link>

          {/* Nút thu gọn / mở rộng menu (mẫu "Khung mảnh"). Khi mở rộng neo cách mép phải
              17px (12px lề + 5px): tâm trùng cột mũi tên của menu (x = 208px). Khi thu gọn neo
              cách mép phải 9px: tâm trùng chữ F giữa rail 48px (x = 24px). Nút neo theo mép
              phải nên lúc thu / mở trượt theo mép sidebar thay vì nhảy chỗ (kể cả khi bấm đảo
              chiều giữa chừng). Khi mở rộng hạ thêm 3,5px để tâm nằm giữa dải chữ thường của
              logo (chuyển động ở .bo-sidebar-toggle, index.css).
              Khi thu gọn chỉ hiện khi rê chuột vào đầu rail hoặc Tab tới (focus bằng chuột
              thì không giữ nút hiện); máy cảm ứng không rê chuột được nên nút luôn hiện. */}
          {showToggleButton ? (
            <button
              ref={toggleButtonRef}
              type="button"
              onClick={handleToggleClick}
              aria-label={toggleLabel}
              aria-expanded={isExpanded}
              aria-controls="backoffice-navigation"
              aria-keyshortcuts={PHIM_MOD === "⌘" ? "Meta+B" : "Control+B"}
              onPointerEnter={scheduleToggleTooltip}
              onPointerLeave={hideRailTooltip}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) {
                  showToggleTooltip(event.currentTarget);
                }
              }}
              onBlur={hideRailTooltip}
              className={cn(
                "bo-sidebar-toggle group/tg absolute right-[17px] top-1/2 grid size-7 place-items-center rounded-lg text-white/80 outline-hidden",
                "hover:bg-white/8 hover:text-white active:scale-94 active:bg-white/12",
                "focus-visible:ring-2 focus-visible:ring-blue-300",
                isExpanded
                  ? "translate-y-[calc(-50%+3.5px)]"
                  : "right-[9px] -translate-y-1/2 opacity-0 group-hover/head:opacity-100 group-has-[:focus-visible]/head:opacity-100 [@media(hover:none)]:opacity-100",
              )}
            >
              <BieuTuongKhungMenu thuGon={!isExpanded} />
            </button>
          ) : null}
        </SidebarHeader>

        <SidebarContent
          ref={ganVungCuon}
          onAnimationEnd={khiHetHieuUngMenu}
          className="bo-sidebar-scroll bo-sidebar-content bg-bo-sidebar px-3 pt-3 pb-1"
        >
          {sections.map((section, index) => (
            <div key={section.key}>
              {index > 0 ? (
                <div
                  aria-hidden="true"
                  className="bo-sidebar-divider mx-2 my-2 border-t border-bo-sidebar-border/70"
                />
              ) : null}

              {section.hienTieuDe ? (
                <div className={SIDEBAR_COLLAPSE_ROW}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 pr-1.5 pb-1.5 pl-[11px]">
                      <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-bo-sidebar-muted/80">
                        {section.label}
                      </span>
                      {section.nutThem ? (
                        // "Tất cả kênh": nút "+" mở trang kết nối kênh; sáng lên khi đang ở trang đó (như mục đang chọn)
                        <Link
                          data-nut-them=""
                          to={section.nutThem.to}
                          onClick={handleNavigate}
                          aria-label={section.nutThem.nhanNut ?? section.nutThem.label}
                          title={section.nutThem.nhanNut ?? section.nutThem.label}
                          aria-current={laHienTai(section.nutThem) ? "page" : undefined}
                          className={cn(
                            "grid size-[22px] shrink-0 place-items-center rounded-md outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-blue-300",
                            laHienTai(section.nutThem)
                              ? "bg-bo-sidebar-active text-white"
                              : "text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white",
                          )}
                        >
                          <Plus className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                        </Link>
                      ) : null}
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

        {footerItem || showKhoLamViec ? (
          // Kẻ ngăn thụt lề giống giữa các nhóm menu (không kẻ hết chiều rộng); đệm 4px trên/dưới để khối
          // đáy gọn. Quản trị viên / quản lý kho: mục Cấu hình; nhân viên: kho làm việc.
          <SidebarFooter className="bo-sidebar-content gap-0 bg-bo-sidebar px-3 pt-0 pb-1 [&:not(:has(li))]:hidden">
            <div
              aria-hidden="true"
              className="bo-sidebar-divider mx-2 mb-1 border-t border-bo-sidebar-border/70"
            />
            <SidebarMenu>
              {footerItem ? (
                renderDirectLink(footerItem, FOOTER_BUTTON_LAYOUT)
              ) : (
                <SidebarKhoLamViec
                  isExpanded={isExpanded}
                  layoutClass={FOOTER_BUTTON_LAYOUT}
                  fadeClass={SIDEBAR_FADE}
                  onShowTooltip={showRailTooltip}
                  onHideTooltip={hideRailTooltip}
                />
              )}
            </SidebarMenu>
          </SidebarFooter>
        ) : null}
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
                className={cn(
                  "absolute -left-[5px] size-2.5 rotate-45 rounded-[1px] border-b border-l border-bo-sidebar-border",
                  flyoutArrowOnHeader ? "bg-bo-sidebar-hover" : "bg-bo-sidebar",
                )}
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
                {flyout.children.map((child, viTri) => (
                  <Fragment key={child.to}>
                    {keTruoc(flyout.children, viTri) ? (
                      <div aria-hidden="true" className="mx-2 my-0.5 border-t border-bo-sidebar-border" />
                    ) : null}
                    <Link
                      to={child.to}
                      role="menuitem"
                      onClick={closeFlyout}
                      aria-current={laHienTai(child) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] leading-5",
                        SUB_ITEM_TONE(laHienTai(child)),
                      )}
                    >
                      {child.icon ? (
                        <child.icon
                          className={cn(
                            "size-4 shrink-0",
                            laHienTai(child) ? "text-bo-sidebar-icon-active" : "text-bo-sidebar-muted",
                          )}
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{child.label}</span>
                      <SoDemMenu so={soDem(child)} />
                    </Link>
                  </Fragment>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}

      {railTooltip && (!isExpanded || railTooltip.placement === "bottom")
        ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              className={cn(
                "fixed z-[80] max-w-56 rounded-md border border-bo-sidebar-border bg-bo-sidebar px-2.5 py-1.5 text-xs font-medium leading-5 text-white shadow-[0_8px_24px_rgba(2,8,20,0.45)]",
                railTooltip.xuyenChuot && "pointer-events-none",
              )}
              style={{ left: railTooltip.left, top: railTooltip.top }}
              onPointerOver={railTooltip.xuyenChuot ? undefined : keepTooltipOpen}
              onPointerOut={railTooltip.xuyenChuot ? undefined : hideRailTooltip}
            >
              {railTooltip.placement === "bottom" ? (
                // Mũi tên ở cạnh trên, chỉ vào giữa nút 28px (tooltip canh mép phải với nút).
                <div
                  aria-hidden="true"
                  className="absolute -top-[5px] right-[9px] size-2.5 rotate-45 rounded-[1px] border-l border-t border-bo-sidebar-border bg-bo-sidebar"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="absolute -left-[5px] top-1/2 size-2.5 -translate-y-1/2 rotate-45 rounded-[1px] border-b border-l border-bo-sidebar-border bg-bo-sidebar"
                />
              )}
              {railTooltip.phimTat ? (
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {railTooltip.label}
                  <span className="flex gap-0.5" aria-hidden="true">
                    {[PHIM_MOD, "B"].map((phim) => (
                      <kbd
                        key={phim}
                        className="min-w-[18px] rounded border border-white/15 bg-white/10 px-1 text-center font-sans text-[11px] font-semibold leading-4 text-slate-300"
                      >
                        {phim}
                      </kbd>
                    ))}
                  </span>
                </span>
              ) : (
                <span className="block">{railTooltip.label}</span>
              )}
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
