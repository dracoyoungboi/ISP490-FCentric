import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileX, History, Lock, Printer, RotateCcw, Store } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OUTLINE_BUTTON, PRIMARY_BUTTON, settingsInputClass } from "@/components/settings/settingsStyles";
import { cn } from "@/lib/utils";
import PrintTemplateDocument from "@/components/print/PrintTemplateDocument";
import PrintOnlyDocument from "@/components/print/PrintOnlyDocument";
import PreviewZoomControl from "@/components/print/PreviewZoomControl";
import { PreviewPrintStyleTag } from "@/components/print/previewPrintStyles";
import { usePreviewViewportSize } from "@/components/print/usePreviewViewportSize";
import {
    computeFitScale,
    getPageFooterText,
    getPaperSheetClasses,
    isThermalPaper,
} from "@/components/print/paperStyles";
import {
    FOOTER_NOTE_MAX_LENGTH,
    LABEL_MAX_LENGTH,
    PRINT_DOCUMENT_GROUPS,
    TITLE_MAX_LENGTH,
    getCustomOptions,
    getDocCodeMode,
    getFontSize,
    getFooterNoteDraft,
    getPrintSchema,
    getTitleDraft,
} from "@/components/print/schemas/printSchemas";
import {
    applyEssentials,
    buildDefaultTemplateConfig,
    buildVariantFromDraft,
    configFromSaved,
    normalizeConfig,
    sameConfig,
} from "@/components/print/cauHinhMauIn";
import { chanQuayLaiTrinhDuyet, datChanRoiTrang } from "@/lib/chanRoiTrang";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";
import { HO_SO_TRONG, companyProfileService } from "@/services/companyProfileService";
import { ROLES } from "@/constants/backend/role";
import { formatDateTime } from "@/utils/dateTime";
import { getApiErrorMessage } from "@/utils/apiError";
import { getSamplePrintModel } from "./samplePrintData";
import CompanyProfileDialog from "./CompanyProfileDialog";
import ChonMot from "./mau-in/ChonMot";
import DongTuyChon from "./mau-in/DongTuyChon";
import NhomTuyChon from "./mau-in/NhomTuyChon";
import NganKeoLichSu from "./mau-in/NganKeoLichSu";
import {
    ACCENT_PRESETS,
    DOC_CODE_OPTIONS,
    FONT_SIZE_OPTIONS,
    GROUP_FOOTER,
    GROUP_HEADER,
    GROUP_LAYOUT,
    MARGIN_OPTIONS,
    ORIENTATION_OPTIONS,
    buildEditorGroups,
    setCustomOption,
    setLabel,
    setPath,
    summarizeChanges,
    toggleGroup,
    toggleRow,
} from "./mau-in/moHinhTrinhSua";
import "./mau-in/trinhSuaMauIn.css";

const LIST_HREF = "/settings/print-templates";
const editorHref = (schema) => `${LIST_HREF}/${schema.slug}`;

// Padding màn hình của khung xem trước (p-6 = 24px mỗi bên) — trừ khỏi kích thước vùng xem khi
// tính "Vừa trang".
const PREVIEW_VIEWPORT_PADDING = 48;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const BLOCK_KEY = /^[A-Za-z0-9_]+$/;

/** Lỗi khiến không lưu được (máy chủ cũng chặn đúng các giới hạn này). */
function collectIssues(schema, draft) {
    if (!schema || !draft) return [];
    const issues = [];
    const docNoun = schema.docNoun ?? "phiếu";
    if (!draft.name?.trim()) issues.push("Tên mẫu in không được để trống");
    if (getTitleDraft(draft).length > TITLE_MAX_LENGTH) {
        issues.push(`Tiêu đề ${docNoun} không được quá ${TITLE_MAX_LENGTH} ký tự`);
    }
    if (getFooterNoteDraft(schema, draft).length > FOOTER_NOTE_MAX_LENGTH) {
        issues.push(`Lời chân ${docNoun} không được quá ${FOOTER_NOTE_MAX_LENGTH} ký tự`);
    }
    const labels = getCustomOptions(draft).nhan;
    if (labels && typeof labels === "object" && Object.values(labels).some((label) => String(label ?? "").trim().length > LABEL_MAX_LENGTH)) {
        issues.push(`Mỗi nhãn không được quá ${LABEL_MAX_LENGTH} ký tự`);
    }
    if (!HEX_COLOR.test(draft.accentColor ?? "")) issues.push("Màu tên chứng từ không hợp lệ (cần mã màu #RRGGBB)");
    return issues;
}

const roleLabel = (value) => ROLES.find((role) => role.value === value)?.label ?? null;

/**
 * Nút mở lớp nổi (menu, ô nổi, ngăn kéo của Radix) chứa `element` — tìm theo aria-controls trỏ tới
 * lớp đó. Dùng để trả focus về đúng nút khi lớp nổi đã đóng.
 */
function triggerOfLayer(element) {
    const start = element instanceof Element ? element : null;
    // Lớp nổi ngoài cùng chứa phần tử — nút nằm trong chính lớp đó (vd. nút mở nhóm trong ngăn kéo menu)
    // cũng biến mất khi lớp đóng nên không dùng được
    const layer = start?.closest(OVERLAY_SELECTOR) ?? null;
    let outer = layer;
    while (outer?.parentElement?.closest(OVERLAY_SELECTOR)) outer = outer.parentElement.closest(OVERLAY_SELECTOR);
    for (let node = start; node && node !== document.body; node = node.parentElement) {
        if (!node.id) continue;
        const trigger = document.querySelector(`[aria-controls="${CSS.escape(node.id)}"]`);
        if (trigger instanceof HTMLElement && !(outer && outer.contains(trigger))) return trigger;
    }
    return null;
}

/** Lớp nổi của Radix: menu, danh sách chọn, hộp thoại / ngăn kéo, ô nổi. */
const OVERLAY_SELECTOR = "[role='menu'], [role='listbox'], [role='dialog'], [data-radix-popper-content-wrapper]";

/** Phần tử nhận focus lại được: còn trên trang, không phải <body>, không nằm trong lớp nổi (sắp đóng). */
const focusable = (element) =>
    element instanceof HTMLElement && element.isConnected && element !== document.body && !element.closest(OVERLAY_SELECTOR);

/** Đóng các thông báo có nút "Hoàn tác" đang hiện (ref giữ Set id thông báo). */
function dismissUndoToasts(ref) {
    for (const id of ref.current) toast.dismiss(id);
    ref.current.clear();
}
const lowerFirst = (text) => (text ? text.charAt(0).toLocaleLowerCase("vi") + text.slice(1) : text);
const upperFirst = (text) => (text ? text.charAt(0).toLocaleUpperCase("vi") + text.slice(1) : text);

/** Hộp thoại rời trang khi còn thay đổi chưa lưu: Ở lại / Rời không lưu / Lưu và rời. */
function UnsavedDialog({ open, saving, onClose, onSaveAndGo, onDiscardAndGo, onCloseAutoFocus }) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!value && !saving) onClose();
            }}
        >
            <DialogContent className="rounded-xl bg-white shadow-lg sm:max-w-[440px]" onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-bo-foreground">Lưu thay đổi trước khi rời?</DialogTitle>
                    <DialogDescription className="pt-1 text-sm leading-6 text-bo-muted">
                        Mẫu in đang có thay đổi chưa lưu. Rời trang mà không lưu thì các thay đổi này sẽ mất.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={onClose} disabled={saving}>
                        Ở lại
                    </Button>
                    <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={onDiscardAndGo} disabled={saving}>
                        Rời không lưu
                    </Button>
                    <Button type="button" className={PRIMARY_BUTTON} onClick={onSaveAndGo} disabled={saving}>
                        {saving ? "Đang lưu…" : "Lưu và rời"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Nhãn + nội dung của một tùy chọn trong nhóm (Hướng giấy, Cỡ chữ…). */
function OptionLine({ label, hint, children, stacked = false }) {
    return (
        <div className={cn("py-2", stacked ? "space-y-2" : "flex flex-wrap items-center justify-between gap-x-3 gap-y-2")}>
            <div className="min-w-0">
                <p className="text-sm leading-5 text-bo-foreground">{label}</p>
                {hint ? <p className="mt-0.5 text-xs leading-4 text-bo-muted">{hint}</p> : null}
            </div>
            {children}
        </div>
    );
}

/** Màu tên chứng từ: các màu tối gợi ý + "Màu khác" (giữ được màu của mẫu cũ). */
function AccentPicker({ value, onChange, disabled, docNoun }) {
    const current = (value ?? "").toUpperCase();
    const isPreset = ACCENT_PRESETS.some((preset) => preset.value === current);
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {ACCENT_PRESETS.map((preset) => {
                const active = preset.value === current;
                return (
                    <button
                        key={preset.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(preset.value)}
                        aria-pressed={active}
                        aria-label={`Màu tên ${docNoun}: ${preset.label}`}
                        title={preset.label}
                        className={cn(
                            "inline-flex size-8 items-center justify-center rounded-full border-2 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary",
                            active ? "border-bo-primary" : "border-transparent hover:border-bo-border"
                        )}
                    >
                        <span className="size-[22px] rounded-full" style={{ background: preset.value }} />
                    </button>
                );
            })}
            <label
                className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border-2 bg-white pr-3 pl-1 text-[13px]",
                    isPreset ? "border-transparent text-bo-muted hover:border-bo-border" : "border-bo-primary text-bo-foreground",
                    "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-bo-primary"
                )}
            >
                {/* Đang dùng màu gợi ý: chấm cầu vồng (chưa chọn màu khác); màu riêng: chấm đúng màu đó */}
                <span
                    aria-hidden="true"
                    className="size-[22px] shrink-0 rounded-full"
                    style={{
                        background: isPreset
                            ? "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)"
                            : value,
                    }}
                />
                <input
                    type="color"
                    value={HEX_COLOR.test(value ?? "") ? value.toLowerCase() : "#0f2a43"}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value.toUpperCase())}
                    aria-label={`Chọn màu khác cho tên ${docNoun}`}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                Màu khác
            </label>
        </div>
    );
}

/**
 * Cấu hình › Mẫu in › <loại chứng từ> — TRÌNH SỬA MỘT MÀN (PA1, kiểu Sapo):
 * - trái: tờ giấy xem trước bằng dữ liệu mẫu; bấm một phần trên giấy để mở đúng nhóm tùy chọn;
 *   thu phóng 50/75/100% / Vừa trang;
 * - phải: Loại chứng từ + Khổ giấy, các nhóm tùy chọn khớp từng khối trên giấy (bật/tắt từng
 *   mục hoặc cả nhóm, đổi tên nhãn, tiêu đề, mã số phiếu, cỡ chữ, màu, lời chân), cuối cột là
 *   Khôi phục mặc định · Hủy · Lưu;
 * - đầu trang: quay lại danh sách, dấu "Có thay đổi chưa lưu", Lịch sử chỉnh sửa, In thử.
 * Mô hình một mẫu: lưu = mẫu dùng ngay cho in thật của loại chứng từ (kể cả khi đổi khổ giấy).
 * Mọi thay đổi chỉ nằm ở bản đang sửa cho tới khi bấm Lưu.
 */
export default function PrintTemplateEditorPage() {
    useClaimPageTitle(true);
    const navigate = useNavigate();
    const { key: locationKey } = useLocation();
    const { documentType: slugParam } = useParams();
    const schema = getPrintSchema(slugParam);
    const docNoun = schema?.docNoun ?? "phiếu";

    const [draft, setDraft] = useState(null);
    const [saved, setSaved] = useState(null);
    const [company, setCompany] = useState(null);
    const [status, setStatus] = useState("loading");
    const [errorStatus, setErrorStatus] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [saving, setSaving] = useState(false);

    const [openGroup, setOpenGroup] = useState(GROUP_HEADER);
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [hoverBlock, setHoverBlock] = useState(null);
    const [zoom, setZoom] = useState("fit");
    const previewViewport = usePreviewViewportSize();

    const [historyOpen, setHistoryOpen] = useState(false);
    const [history, setHistory] = useState({ status: "idle", items: [], errorStatus: null });
    const [leaveTarget, setLeaveTarget] = useState(null);
    const [companyDialogOpen, setCompanyDialogOpen] = useState(false);

    const groupRefs = useRef(new Map());
    const typeSelectRef = useRef(null);
    const scrollTargetRef = useRef(null);
    const historyRequestRef = useRef(0);
    // Ngăn lịch sử đang mở (đọc sau khi lưu xong — giá trị state trong hàm lưu đã cũ)
    const historyOpenRef = useRef(false);
    const savingRef = useRef(false);
    // Thông báo có nút "Hoàn tác" của loại chứng từ đang sửa — đóng khi chuyển loại chứng từ
    const undoToastsRef = useRef(new Set());
    // Mỗi thông báo Hoàn tác một id riêng: lớp thông báo nhanh gộp các thông báo cùng nội dung theo id,
    // nên dùng chung id thì lệnh đóng thông báo cũ (chạy trễ vài khung hình) đóng nhầm thông báo mới
    const undoSeqRef = useRef(0);
    // Tăng mỗi lần nạp loại chứng từ: lần lưu xong sau khi đã sang loại khác (Back/Forward của trình
    // duyệt trong lúc đang lưu) không được ghi đè bản đang sửa của loại mới
    const loadSeqRef = useRef(0);
    // Phần tử đang có focus khi mở hộp thoại rời trang — trả focus về đó khi chọn Ở lại
    const leaveReturnFocusRef = useRef(null);
    // Phần tử ngoài lớp nổi được focus gần nhất (nút mở menu, ô tìm kiếm…) — chỗ trả focus dự phòng
    // khi focus đang nằm trong menu / ngăn kéo sắp đóng hoặc đã rơi về <body>
    const lastOutsideFocusRef = useRef(null);

    const schemaKey = schema?.key ?? null;

    // ── Nạp mẫu đang dùng + thông tin cửa hàng ──
    useEffect(() => {
        if (!schemaKey) return undefined;
        let cancelled = false;
        setStatus("loading");
        setErrorStatus(null);
        // Hộp thoại rời trang của loại chứng từ trước (vd. đang mở thì bấm Back của trình duyệt): bỏ,
        // không được tự đi tiếp tới đích cũ
        setLeaveTarget(null);
        setOpenGroup(GROUP_HEADER);
        setSelectedBlock(null);
        setHoverBlock(null);
        setHistoryOpen(false);
        setHistory({ status: "idle", items: [], errorStatus: null });
        // Lịch sử đang tải của loại chứng từ trước: bỏ kết quả; "Hoàn tác" của loại trước: đóng
        loadSeqRef.current += 1;
        historyRequestRef.current += 1;
        dismissUndoToasts(undoToastsRef);
        (async () => {
            try {
                // Dữ liệu localStorage đời cũ: chỉ chuyển lên máy chủ khi máy chủ chưa có — lỗi ở bước này
                // không được chặn việc sửa mẫu.
                await Promise.all([
                    printTemplateConfigService.migrateLegacyLocalIfNeeded().catch((error) => {
                        console.warn("Không chuyển được cấu hình mẫu in cũ:", error);
                    }),
                    companyProfileService.migrateLegacyLocalIfNeeded().catch((error) => {
                        console.warn("Không chuyển được thông tin cửa hàng cũ:", error);
                    }),
                ]);
                // Nạp lại từ máy chủ (không dùng bộ nhớ đệm): người khác có thể vừa lưu mẫu này
                const [config, profile] = await Promise.all([
                    printTemplateConfigService
                        .load({ force: true })
                        .then(() => printTemplateConfigService.getActiveTemplate(schemaKey)),
                    companyProfileService.get(),
                ]);
                if (cancelled) return;
                if (!config) {
                    setStatus("notFound");
                    return;
                }
                setDraft(config);
                setSaved(config);
                // Máy chủ chưa có dòng thông tin cửa hàng -> đầu phiếu trống (sửa ở Thông tin cửa hàng)
                setCompany(profile ?? HO_SO_TRONG);
                setStatus("ready");
            } catch (error) {
                console.error("Không tải được trình sửa mẫu in:", error);
                if (cancelled) return;
                setErrorStatus(error?.response?.status ?? null);
                setStatus("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [schemaKey, reloadKey]);

    const sampleModel = useMemo(() => (schemaKey ? getSamplePrintModel(schemaKey) : null), [schemaKey]);
    const groups = useMemo(() => buildEditorGroups(schema, draft), [schema, draft]);
    const dirty = useMemo(
        () =>
            status === "ready" &&
            Boolean(draft && saved) &&
            draft.documentType === schemaKey &&
            !sameConfig(schema, draft, saved),
        [status, schema, schemaKey, draft, saved]
    );
    const issues = useMemo(() => collectIssues(schema, draft), [schema, draft]);

    // ── Chặn rời trang khi còn thay đổi chưa lưu ──
    useEffect(() => {
        if (!dirty) return undefined;
        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [dirty]);

    /**
     * Mở hộp thoại "Lưu thay đổi trước khi rời?" cho một đích (đường dẫn hoặc hàm). Mở ở lượt sau để
     * menu / danh sách chọn / ô tìm kiếm vừa bấm kịp đóng và trả focus (hai lớp phủ cùng lúc giành
     * focus và khóa con trỏ trên trang), rồi nhớ phần tử đang focus để trả lại khi chọn Ở lại —
     * focus còn nằm trong lớp đang đóng (hoặc đã rơi về trang) thì dùng `fallbackFocus`.
     */
    const requestLeave = useCallback((target, fallbackFocus = null) => {
        setTimeout(() => {
            const active = document.activeElement;
            leaveReturnFocusRef.current = focusable(active)
                ? active
                : focusable(fallbackFocus)
                  ? fallbackFocus
                  : lastOutsideFocusRef.current;
            setLeaveTarget(typeof target === "function" ? () => target : target);
        }, 0);
    }, []);

    // Ghi nhớ phần tử ngoài lớp nổi được focus gần nhất (chỉ khi đang có thay đổi chưa lưu)
    useEffect(() => {
        if (!dirty) return undefined;
        if (focusable(document.activeElement)) lastOutsideFocusRef.current = document.activeElement;
        const track = (event) => {
            if (focusable(event.target)) lastOutsideFocusRef.current = event.target;
        };
        document.addEventListener("focusin", track, true);
        return () => document.removeEventListener("focusin", track, true);
    }, [dirty]);

    // Link nội bộ (menu trái, menu tài khoản, thông báo…) -> hỏi trước. Back / Forward của trình duyệt
    // chặn riêng ở dưới (BrowserRouter không có useBlocker).
    const currentHref = schema ? editorHref(schema) : LIST_HREF;
    useEffect(() => {
        if (!dirty) return undefined;
        const handleClick = (event) => {
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
            const href = anchor.getAttribute("href");
            if (!href || !href.startsWith("/") || href.startsWith("//") || href === currentHref) return;
            // Chỉ chặn việc chuyển trang (Link và mục menu của Radix đều tôn trọng preventDefault);
            // không chặn lan truyền để việc riêng của link vẫn chạy (đánh dấu thông báo đã đọc, đóng
            // menu trái trên điện thoại…)
            event.preventDefault();
            // Link nằm trong menu / ô nổi / ngăn kéo (menu tài khoản, thông báo, menu trái trên điện
            // thoại): mục menu bị chặn thì menu không tự đóng — đóng lớp đó bằng Esc trước khi hỏi
            let fallbackFocus = null;
            if (anchor.closest(OVERLAY_SELECTOR)) {
                fallbackFocus = triggerOfLayer(anchor);
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
            }
            requestLeave(href, fallbackFocus);
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [dirty, currentHref, requestLeave]);

    // Ô tìm kiếm chung, Đăng xuất… (không phải link) -> cũng hỏi trước khi rời
    useEffect(() => {
        if (!dirty) return undefined;
        // Gọi ngay trong lúc bấm (vd. mục Đăng xuất của menu tài khoản): nhớ nút mở menu để trả focus
        return datChanRoiTrang((tiepTuc) => requestLeave(tiepTuc, triggerOfLayer(document.activeElement)));
    }, [dirty, requestLeave]);

    // Back / Forward của trình duyệt (cả Alt+←) -> trình duyệt được đưa về lại trang này rồi hỏi; Rời thì đi
    // tiếp đúng số bước đã bấm. Trình duyệt không hỗ trợ cách chặn này / lịch sử bất thường thì giữ như cũ
    // (không hỏi). Đăng ký một lần cho mỗi mục lịch sử của trang (theo location.key) và đọc `dirty` qua ref:
    // `dirty` đổi qua lại đúng lúc trình duyệt đang được đưa về lại trang không làm đăng ký lại / đọc lại mục
    // lịch sử (lúc đó history.state còn là mục vừa rời).
    const dirtyRef = useRef(false);
    useEffect(() => {
        dirtyRef.current = dirty;
    }, [dirty]);
    useEffect(
        () =>
            chanQuayLaiTrinhDuyet((tiepTuc) => requestLeave(tiepTuc), window, {
                dangChan: () => dirtyRef.current,
                khoaTrang: locationKey,
            }),
        [locationKey, requestLeave]
    );

    // Rời trình sửa: đóng thông báo Hoàn tác (không còn gì để hoàn tác)
    useEffect(() => () => dismissUndoToasts(undoToastsRef), []);

    useEffect(() => {
        historyOpenRef.current = historyOpen;
    }, [historyOpen]);

    // Mở nhóm từ tờ giấy -> cuộn nhóm vào tầm nhìn ở cột phải
    useEffect(() => {
        const key = scrollTargetRef.current;
        if (!key || key !== openGroup) return;
        scrollTargetRef.current = null;
        const node = groupRefs.current.get(key);
        if (node && typeof node.scrollIntoView === "function") {
            node.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [openGroup]);

    // ── Lịch sử chỉnh sửa ──
    const loadHistory = useCallback(
        async ({ silent = false } = {}) => {
            if (!schemaKey) return;
            const request = ++historyRequestRef.current;
            if (!silent) setHistory((prev) => ({ ...prev, status: "loading", errorStatus: null }));
            try {
                const items = await printTemplateConfigService.getHistory(schemaKey);
                if (request !== historyRequestRef.current) return;
                setHistory({ status: "ready", items, errorStatus: null });
            } catch (error) {
                console.error("Không tải được lịch sử mẫu in:", error);
                if (request !== historyRequestRef.current) return;
                setHistory((prev) =>
                    silent && prev.status === "ready"
                        ? prev
                        : { status: "error", items: [], errorStatus: error?.response?.status ?? null }
                );
            }
        },
        [schemaKey]
    );

    const openHistory = () => {
        setHistoryOpen(true);
        if (history.status !== "ready" && history.status !== "loading") loadHistory();
    };

    const historyEntries = useMemo(() => {
        if (!schema) return [];
        return history.items.map((item, index) => {
            const who = [item.actorName, roleLabel(item.actorRole)].filter(Boolean).join(" · ");
            const when = formatDateTime(item.at) ?? "Không rõ thời gian";
            if (!item.config) {
                return { id: item.id, when, who, summary: "Phiên bản này dùng khổ giấy không còn hỗ trợ", isCurrent: false, restorable: false, config: null };
            }
            let summary;
            if (item.previous) {
                summary = summarizeChanges(schema, item.previous, item.config);
            } else if (item.hasPrevious) {
                // Có bản trước nhưng không đọc được (khổ giấy không còn hỗ trợ…) — không phải lần lưu đầu
                summary = "Không đọc được phiên bản trước để so sánh";
            } else {
                // Trước lần lưu đầu, in thật dùng mẫu mặc định của registry (khổ mặc định của loại chứng từ)
                const def = schema.templates.find((template) => template.isDefault) ?? schema.templates[0];
                const base = def ? applyEssentials(schema, buildDefaultTemplateConfig(schema, def)) : null;
                const diff = base ? summarizeChanges(schema, base, item.config) : "";
                summary = !diff || diff === "Lưu lại, không đổi nội dung" ? "Lưu lần đầu, giữ như mẫu mặc định" : `Lưu lần đầu: ${lowerFirst(diff)}`;
            }
            const isCurrent = index === 0 && Boolean(saved) && sameConfig(schema, item.config, saved);
            return { id: item.id, when, who, summary, isCurrent, restorable: true, config: item.config };
        });
    }, [schema, history.items, saved]);

    /** Hoàn tác về bản đang sửa trước đó — chỉ khi vẫn đang sửa cùng loại chứng từ. */
    const undoTo = useCallback((previous) => {
        setDraft((current) => (current && previous && current.documentType === previous.documentType ? previous : current));
    }, []);

    // Chỉ một "Hoàn tác" có hiệu lực: thao tác hàng loạt mới (kể cả Hủy), Lưu xong hay rời trang đều đóng
    // thông báo cũ. Đang lưu thì bấm Hoàn tác chưa có tác dụng và thông báo vẫn mở (lưu lỗi thì vẫn
    // hoàn tác được; lưu xong thì thông báo tự đóng).
    const showUndoToast = (message, previous) => {
        dismissUndoToasts(undoToastsRef);
        const id = `hoan-tac-${(undoSeqRef.current += 1)}`;
        toast.info(message, {
            id,
            action: {
                label: "Hoàn tác",
                onClick: (event) => {
                    if (savingRef.current) {
                        event?.preventDefault?.();
                        return;
                    }
                    undoToastsRef.current.delete(id);
                    undoTo(previous);
                },
            },
        });
        undoToastsRef.current.add(id);
    };

    const restoreVersion = (entry) => {
        if (!entry?.config || savingRef.current || entry.config.documentType !== schema.key) return;
        const previous = draft;
        setDraft(structuredClone(entry.config));
        setHistoryOpen(false);
        showUndoToast(`Đã đưa phiên bản ${entry.when} vào bản đang sửa — bấm Lưu để áp dụng`, previous);
    };

    // ── Sửa bản nháp ──
    const update = (next) => {
        if (next && next !== draft) setDraft(next);
    };

    const handlePaperChange = (paper) => {
        if (!draft || paper === draft.paperSize) return;
        const next = buildVariantFromDraft(schema, draft, paper);
        if (!next) {
            toast.error(`${schema.label} không có khổ giấy ${paper}`);
            return;
        }
        setDraft(next);
    };

    const openGroupFromPanel = (key, open) => {
        setOpenGroup(open ? key : null);
        setSelectedBlock(open ? key : null);
    };

    /** Khóa nhóm của khối trên giấy chứa `target` (null nếu không có nhóm tương ứng). */
    const blockKeyAt = (target) => {
        const element = target instanceof Element ? target.closest("[data-pdoc-khoi]") : null;
        const key = element?.getAttribute("data-pdoc-khoi") ?? null;
        return key && groups.some((group) => group.key === key) ? key : null;
    };

    const activateBlockFromPaper = (target) => {
        const key = blockKeyAt(target);
        if (!key) return false;
        scrollTargetRef.current = key;
        setOpenGroup(key);
        setSelectedBlock(key);
        return true;
    };

    const resetToDefault = () => {
        const def = schema.templates.find((template) => template.id === draft.id) ?? schema.templates[0];
        const previous = draft;
        const next = applyEssentials(schema, buildDefaultTemplateConfig(schema, def));
        if (sameConfig(schema, previous, next)) {
            toast.info("Mẫu đang là mẫu mặc định");
            return;
        }
        setDraft(next);
        showUndoToast(`Đã đưa mẫu về mặc định (giữ khổ ${def.paperSize}) — bấm Lưu để áp dụng`, previous);
    };

    // Hủy cũng là thao tác hàng loạt: hoàn tác được như Khôi phục mặc định / Khôi phục phiên bản
    const discardChanges = () => {
        if (!saved) return;
        const previous = draft;
        setDraft(structuredClone(saved));
        showUndoToast("Đã hủy các thay đổi chưa lưu", previous);
    };

    /** Lưu bản đang sửa. Trả true khi lưu xong. */
    const saveDraft = async () => {
        if (!draft || savingRef.current) return false;
        // Bản đang sửa phải đúng loại chứng từ của trang (không lưu nhầm bản của loại vừa rời)
        if (draft.documentType !== schema.key) return false;
        if (issues.length > 0) {
            toast.error(issues[0]);
            return false;
        }
        savingRef.current = true;
        setSaving(true);
        const loadSeq = loadSeqRef.current;
        try {
            const dto = await printTemplateConfigService.saveTemplate(draft);
            if (loadSeq !== loadSeqRef.current) {
                // Trang đã sang loại chứng từ khác trong lúc lưu: chỉ báo đã lưu, giữ nguyên trang mới
                toast.success(`Đã lưu mẫu in ${schema.label.toLocaleLowerCase("vi")}`);
                return true;
            }
            // Đọc lại từ chính phản hồi lưu (không gọi thêm máy chủ — lỗi mạng lúc này không được biến
            // lần lưu đã thành công thành "không lưu được")
            const fresh = (dto ? configFromSaved(schema, draft.id, dto) : null) ?? normalizeConfig(schema, draft);
            setDraft(fresh);
            setSaved(fresh);
            dismissUndoToasts(undoToastsRef);
            toast.success(`Đã lưu mẫu in — từ giờ ${docNoun} in ra sẽ dùng mẫu này`);
            // Lịch sử: đang mở thì tải lại; đang đóng thì lần mở sau tải mới (bỏ kết quả đang tải dở)
            historyRequestRef.current += 1;
            if (historyOpenRef.current) loadHistory({ silent: true });
            else setHistory({ status: "idle", items: [], errorStatus: null });
            return true;
        } catch (error) {
            console.error("Không lưu được mẫu in:", error);
            toast.error(getApiErrorMessage(error, "Không lưu được mẫu in"));
            return false;
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    // ── Rời trang ──
    const goBack = () => {
        if (dirty) requestLeave(LIST_HREF);
        else navigate(LIST_HREF);
    };

    const switchDocumentType = (key) => {
        const next = getPrintSchema(key);
        if (!next || next.key === schema.key) return;
        if (dirty) requestLeave(editorHref(next), typeSelectRef.current);
        else navigate(editorHref(next));
    };

    /** Đích rời trang: đường dẫn (link, quay lại, đổi loại chứng từ) hoặc hàm (tìm kiếm, đăng xuất). */
    const goTo = useCallback(
        (target) => {
            if (typeof target === "function") target();
            else if (target) navigate(target);
        },
        [navigate]
    );

    const leaveWithoutSaving = () => {
        const target = leaveTarget;
        setLeaveTarget(null);
        if (!target) return;
        dismissUndoToasts(undoToastsRef);
        // Bỏ thay đổi trước khi rời để mọi lớp chặn rời trang thôi hỏi
        if (saved) setDraft(structuredClone(saved));
        goTo(target);
    };

    // Lưu xong thì hiệu ứng bên dưới đi tiếp tới đích (lưu lỗi: hộp thoại giữ nguyên để chọn lại)
    const saveAndLeave = async () => {
        if (!leaveTarget || savingRef.current) return;
        await saveDraft();
    };

    // Đang chờ rời trang mà không còn gì chưa lưu (vừa "Lưu và rời", hoặc hộp thoại mở đúng lúc một lần
    // Lưu đang chạy và lần lưu đó đã xong) -> đi tiếp luôn, không hỏi lại / không lưu lần hai
    useEffect(() => {
        if (!leaveTarget || saving || dirty || status !== "ready" || draft?.documentType !== schemaKey) return;
        const target = leaveTarget;
        setLeaveTarget(null);
        goTo(target);
    }, [leaveTarget, saving, dirty, status, draft, schemaKey, goTo]);

    /** Đóng hộp thoại rời trang (Ở lại): trả focus về chỗ người dùng vừa thao tác thay vì đầu trang. */
    const returnFocusAfterLeaveDialog = (event) => {
        const recorded = leaveReturnFocusRef.current;
        leaveReturnFocusRef.current = null;
        const element = focusable(recorded) ? recorded : focusable(lastOutsideFocusRef.current) ? lastOutsideFocusRef.current : null;
        if (element) {
            event.preventDefault();
            element.focus({ preventScroll: true });
        }
    };

    // ── Trạng thái trang ──
    if (!schema) {
        return (
            <PageContainer>
                <EmptyState
                    icon={FileX}
                    title="Không tìm thấy loại chứng từ"
                    description="Loại chứng từ trong đường dẫn không tồn tại."
                    action={
                        <Button className={PRIMARY_BUTTON} onClick={() => navigate(LIST_HREF)}>
                            Về danh sách mẫu in
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    // Vừa đổi loại chứng từ (đường dẫn đã đổi, bản đang sửa vẫn của loại cũ): coi như đang tải
    if (status === "loading" || (status === "ready" && draft && draft.documentType !== schemaKey)) {
        return (
            <PageContainer>
                <LoadingState label="Đang tải mẫu in" />
            </PageContainer>
        );
    }

    if (status === "error") {
        return (
            <PageContainer>
                {errorStatus === 401 || errorStatus === 403 ? (
                    <EmptyState
                        icon={Lock}
                        title="Bạn không có quyền sửa mẫu in"
                        description="Liên hệ quản trị viên nếu bạn cần quyền này."
                    />
                ) : (
                    <ErrorState
                        title="Không thể tải mẫu in"
                        description="Không đọc được cấu hình mẫu in hoặc thông tin cửa hàng từ máy chủ. Vui lòng thử lại."
                        onRetry={() => setReloadKey((key) => key + 1)}
                    />
                )}
            </PageContainer>
        );
    }

    if (status === "notFound" || !draft) {
        return (
            <PageContainer>
                <EmptyState
                    icon={FileX}
                    title="Không tìm thấy mẫu in"
                    description="Mẫu in của loại chứng từ này không còn tồn tại."
                    action={
                        <Button className={PRIMARY_BUTTON} onClick={() => navigate(LIST_HREF)}>
                            Về danh sách mẫu in
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    const thermal = isThermalPaper(draft.paperSize);
    const paper = { size: draft.paperSize, orientation: draft.orientation, margin: draft.margin };
    const effectiveZoom =
        zoom === "fit"
            ? computeFitScale(
                  paper,
                  Math.max(0, previewViewport.width - PREVIEW_VIEWPORT_PADDING),
                  Math.max(0, previewViewport.height - PREVIEW_VIEWPORT_PADDING)
              )
            : Number(zoom);

    // Khối đang chọn / đang trỏ: viền + nền nhạt. Nhãn tên khối chỉ hiện khi đang trỏ (ở giấy hoặc ở
    // cột phải) — khối đang chọn không giữ nhãn để không che chữ căn phải của khối khi đang sửa.
    const highlighted = [...new Set([selectedBlock, hoverBlock])].filter((key) => key && BLOCK_KEY.test(key));
    const chipKey = hoverBlock && BLOCK_KEY.test(hoverBlock) ? hoverBlock : null;
    const highlightCss =
        (highlighted.length
            ? `${highlighted.map((key) => `.pe-giay [data-pdoc-khoi="${key}"]`).join(",")}{outline-color:var(--color-bo-primary,#1677ff);background-color:rgb(22 119 255/.04)}`
            : "") + (chipKey ? `.pe-giay [data-pdoc-khoi="${chipKey}"]::before{display:block}` : "");

    const titleDraft = getTitleDraft(draft);
    const footerDraft = getFooterNoteDraft(schema, draft);
    const disabled = saving;

    const renderGroupBody = (group) => {
        if (group.key === GROUP_LAYOUT) {
            return (
                <div className="divide-y divide-[#eef1f5]">
                    {!thermal ? (
                        <>
                            <OptionLine label="Hướng giấy">
                                <ChonMot
                                    label="Hướng giấy"
                                    options={ORIENTATION_OPTIONS}
                                    value={draft.orientation}
                                    onChange={(value) => update(setPath(draft, "orientation", value))}
                                    disabled={disabled}
                                />
                            </OptionLine>
                            <OptionLine label="Lề giấy">
                                <ChonMot
                                    label="Lề giấy"
                                    options={MARGIN_OPTIONS}
                                    value={draft.margin}
                                    onChange={(value) => update(setPath(draft, "margin", value))}
                                    disabled={disabled}
                                />
                            </OptionLine>
                        </>
                    ) : null}
                    <OptionLine label="Cỡ chữ">
                        <ChonMot
                            label="Cỡ chữ"
                            options={FONT_SIZE_OPTIONS}
                            value={getFontSize(draft)}
                            onChange={(value) => update(setCustomOption(draft, "coChu", value))}
                            disabled={disabled}
                        />
                    </OptionLine>
                    <OptionLine
                        stacked
                        label={`Màu tên ${docNoun}`}
                        hint="In trắng đen sẽ ra xám đậm — nên chọn màu tối."
                    >
                        <AccentPicker
                            value={draft.accentColor}
                            onChange={(value) => update(setPath(draft, "accentColor", value))}
                            disabled={disabled}
                            docNoun={docNoun}
                        />
                    </OptionLine>
                </div>
            );
        }

        if (group.key === GROUP_FOOTER) {
            return (
                <div className="space-y-1.5 pt-1">
                    <label htmlFor="loi-chan-mau-in" className="block text-[13px] leading-5 font-medium text-bo-foreground">
                        Lời chân {docNoun}
                    </label>
                    <Textarea
                        id="loi-chan-mau-in"
                        value={footerDraft}
                        maxLength={FOOTER_NOTE_MAX_LENGTH}
                        rows={3}
                        disabled={disabled}
                        placeholder={schema.footerExample ?? `Ví dụ: ${upperFirst(docNoun)} lập thành 2 bản, mỗi bên giữ 1 bản.`}
                        onChange={(event) =>
                            update(setCustomOption(draft, "loiChanPhieu", event.target.value.slice(0, FOOTER_NOTE_MAX_LENGTH)))
                        }
                        className={settingsInputClass({ className: "h-auto min-h-20 resize-y py-2 leading-5" })}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-4 text-bo-muted">
                        <span>In căn giữa ở cuối {docNoun}. Để trống nếu không cần.</span>
                        <span aria-live="polite">
                            {footerDraft.length}/{FOOTER_NOTE_MAX_LENGTH}
                        </span>
                    </div>
                    {schema.footerNote && footerDraft !== schema.footerNote ? (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => update(setCustomOption(draft, "loiChanPhieu", schema.footerNote))}
                            className="text-xs font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                        >
                            Dùng lời chân mặc định
                        </button>
                    ) : null}
                </div>
            );
        }

        const rows = group.rows.map((row) => (
            <DongTuyChon
                key={row.id}
                row={row}
                disabled={disabled}
                onToggle={(value) => update(toggleRow(draft, row, value))}
                onRename={row.labelKey ? (value) => update(setLabel(draft, row.labelKey, value, row.defaultLabel)) : undefined}
            />
        ));

        if (group.key === GROUP_HEADER) {
            return (
                <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                        <label htmlFor="tieu-de-mau-in" className="block text-[13px] leading-5 font-medium text-bo-foreground">
                            Tiêu đề {docNoun}
                        </label>
                        <Input
                            id="tieu-de-mau-in"
                            value={titleDraft}
                            maxLength={TITLE_MAX_LENGTH}
                            disabled={disabled}
                            placeholder={schema.docTitle}
                            onChange={(event) =>
                                update(setCustomOption(draft, "tieuDe", event.target.value.slice(0, TITLE_MAX_LENGTH)))
                            }
                            className={settingsInputClass()}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-4 text-bo-muted">
                            {titleDraft.trim() ? (
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => update(setCustomOption(draft, "tieuDe", ""))}
                                    className="font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                                >
                                    Trả về tên gốc
                                </button>
                            ) : (
                                <span>Để trống sẽ dùng tên gốc. Tiêu đề luôn in chữ hoa.</span>
                            )}
                            <span aria-live="polite">
                                {titleDraft.length}/{TITLE_MAX_LENGTH}
                            </span>
                        </div>
                    </div>
                    <div>{rows}</div>
                    <OptionLine
                        stacked
                        label={`Mã số ${docNoun}`}
                        hint={`${thermal ? `In ở cuối ${docNoun}` : `In ở góc phải đầu ${docNoun}`}. Máy quét đọc ra đúng số ${docNoun}, dùng để tìm nhanh ${docNoun} khi kiểm đếm, đối chiếu.`}
                    >
                        <ChonMot
                            label={`Mã số ${docNoun}`}
                            options={DOC_CODE_OPTIONS}
                            value={getDocCodeMode(draft)}
                            onChange={(value) => update(setCustomOption(draft, "maSoPhieu", value))}
                            disabled={disabled}
                        />
                    </OptionLine>
                    <div className="flex items-start gap-2.5 rounded-md bg-bo-surface-subtle px-3 py-2.5">
                        <Store className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                        <div className="min-w-0 text-xs leading-5 text-bo-muted">
                            Đầu phiếu lấy từ Thông tin cửa hàng, dùng chung cho mọi mẫu in và email.{" "}
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => setCompanyDialogOpen(true)}
                                className="font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                            >
                                Sửa thông tin cửa hàng
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        const columnHint =
            group.kind === "items"
                ? thermal
                    ? `Khổ ${draft.paperSize} dùng bảng gọn riêng cho máy in nhiệt. Bật/tắt cột và dòng tổng của bảng. Bấm bút chì để đổi tên.`
                    : "Bật/tắt cột và dòng tổng của bảng. Bấm bút chì để đổi tên."
                : null;
        return (
            <div>
                {columnHint ? <p className="pb-1 text-xs leading-4 text-bo-muted">{columnHint}</p> : null}
                {rows}
            </div>
        );
    };

    // Màn rộng (xl): giấy và cột chỉnh sửa đứng cạnh nhau, cao bằng khung trang; màn hẹp hơn (kể cả
    // 1024px có menu trái) xếp dọc để tờ giấy đủ rộng. xl:pb-4: thanh Lưu cách đáy màn hình dưới 24px
    // nên thông báo nhanh tự nâng lên, không che nút Lưu.
    return (
        <PageContainer className="print-template-preview-page flex flex-col gap-4 xl:h-full xl:pb-4">
            <PreviewPrintStyleTag paper={paper} footerText={getPageFooterText(sampleModel)} />
            {highlightCss ? <style>{highlightCss}</style> : null}

            {/* ── Đầu trang ── */}
            <div className="no-print flex min-h-9 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={goBack}
                        aria-label="Quay lại danh sách mẫu in"
                        title="Quay lại"
                        className={`shrink-0 ${OUTLINE_BUTTON}`}
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                    </Button>
                    <PageHeading>{schema.label}</PageHeading>
                    {dirty ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] leading-5 text-bo-warning" role="status">
                            <span className="size-[7px] rounded-full bg-bo-warning" aria-hidden="true" />
                            Có thay đổi chưa lưu
                        </span>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={openHistory}>
                        <History className="size-4" aria-hidden="true" />
                        Lịch sử chỉnh sửa
                    </Button>
                    <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => window.print()}>
                        <Printer className="size-4" aria-hidden="true" />
                        In thử
                    </Button>
                </div>
            </div>

            <div className="no-print flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
                {/* ── Tờ giấy xem trước ── */}
                <section
                    aria-label="Xem trước tờ giấy"
                    className="flex h-[72vh] min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm xl:h-auto xl:min-h-0"
                >
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-bo-border px-4 py-2.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                            <StatusBadge label="Dữ liệu mẫu" />
                            <span className="text-[13px] leading-5 text-bo-muted">Bấm vào phần cần sửa trên giấy</span>
                        </div>
                        <PreviewZoomControl value={zoom} onChange={setZoom} ariaLabel="Thu phóng bản xem trước" />
                    </div>
                    <div ref={previewViewport.ref} className="min-h-0 flex-1 overflow-auto bg-bo-canvas p-6">
                        <div
                            className={`pe-giay print-preview-sheet print-ruled mx-auto bg-white shadow-[0_1px_3px_rgba(0,0,0,0.16)] ${getPaperSheetClasses(paper)}`}
                            style={{ zoom: effectiveZoom, "--pe-zoom": effectiveZoom }}
                            onClick={(event) => activateBlockFromPaper(event.target)}
                            // Trỏ vào một phần trên giấy thì nhóm tương ứng ở cột phải cũng sáng lên
                            // (chuột / bút; không tính chạm: chạm trên màn cảm ứng giả lập "trỏ" và giữ mãi nhãn khối)
                            onPointerOver={(event) => {
                                if (event.pointerType !== "touch") setHoverBlock(blockKeyAt(event.target));
                            }}
                            onPointerLeave={(event) => {
                                if (event.pointerType !== "touch") setHoverBlock(null);
                            }}
                        >
                            <PrintTemplateDocument
                                documentType={schema.key}
                                config={draft}
                                model={sampleModel}
                                company={company}
                                editable
                            />
                        </div>
                    </div>
                </section>

                {/* ── Cột chỉnh sửa ── */}
                <aside
                    aria-label="Chỉnh sửa mẫu in"
                    className="flex min-w-0 flex-col rounded-lg border border-bo-border bg-white shadow-sm xl:w-[380px] xl:shrink-0 xl:overflow-hidden 2xl:w-[400px]"
                >
                    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-bo-border px-4 py-3.5">
                        <div className="min-w-0 space-y-1.5">
                            <span id="loai-chung-tu-label" className="block text-[13px] leading-5 font-medium text-bo-foreground">
                                Loại chứng từ
                            </span>
                            <Select value={schema.key} onValueChange={switchDocumentType} disabled={disabled}>
                                <SelectTrigger
                                    ref={typeSelectRef}
                                    aria-labelledby="loai-chung-tu-label"
                                    className={settingsInputClass({ className: "w-full" })}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                    position="popper"
                                    align="start"
                                    className="z-50 max-h-[360px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {PRINT_DOCUMENT_GROUPS.map((documentGroup) => (
                                        <SelectGroup key={documentGroup.key}>
                                            <SelectLabel className="text-xs font-semibold text-bo-muted">{documentGroup.label}</SelectLabel>
                                            {documentGroup.schemas.map((item) => (
                                                <SelectItem
                                                    key={item.key}
                                                    value={item.key}
                                                    className="rounded-md focus:bg-bo-primary-soft"
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <span className="block text-[13px] leading-5 font-medium text-bo-foreground">Khổ giấy</span>
                            <ChonMot
                                label="Khổ giấy"
                                options={schema.paperProfiles.map((size) => ({ value: size, label: size }))}
                                value={draft.paperSize}
                                onChange={handlePaperChange}
                                disabled={disabled}
                            />
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 xl:overflow-y-auto">
                        {groups.map((group) => (
                            <NhomTuyChon
                                key={group.key}
                                ref={(node) => {
                                    if (node) groupRefs.current.set(group.key, node);
                                    else groupRefs.current.delete(group.key);
                                }}
                                group={group}
                                open={openGroup === group.key}
                                active={selectedBlock === group.key || hoverBlock === group.key}
                                disabled={disabled}
                                onOpenChange={(open) => openGroupFromPanel(group.key, open)}
                                onToggleAll={(value) => update(toggleGroup(draft, group, value))}
                                onHover={setHoverBlock}
                            >
                                {renderGroupBody(group)}
                            </NhomTuyChon>
                        ))}
                    </div>

                    {/* Màn hẹp: cột chỉnh sửa nằm dưới tờ giấy, thanh thao tác bám đáy màn hình khi cuộn */}
                    <div
                        data-tranh-thong-bao
                        className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-b-lg border-t border-bo-border bg-white px-4 py-3"
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-9 px-2.5 text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
                            onClick={resetToDefault}
                            disabled={disabled}
                        >
                            <RotateCcw className="size-4" aria-hidden="true" />
                            Khôi phục mặc định
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className={OUTLINE_BUTTON}
                                onClick={discardChanges}
                                disabled={disabled || !dirty}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="button"
                                className={PRIMARY_BUTTON}
                                onClick={saveDraft}
                                disabled={disabled || !dirty || issues.length > 0}
                                title={issues[0]}
                            >
                                {saving ? "Đang lưu…" : "Lưu"}
                            </Button>
                        </div>
                    </div>
                </aside>
            </div>

            <NganKeoLichSu
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                history={{ ...history, entries: historyEntries }}
                onRetry={() => loadHistory()}
                onRestore={restoreVersion}
                restoreDisabled={saving}
                docNoun={docNoun}
            />

            <UnsavedDialog
                open={Boolean(leaveTarget)}
                saving={saving}
                onClose={() => setLeaveTarget(null)}
                onSaveAndGo={saveAndLeave}
                onDiscardAndGo={leaveWithoutSaving}
                onCloseAutoFocus={returnFocusAfterLeaveDialog}
            />

            <CompanyProfileDialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen} onSaved={setCompany} />

            {/* In thử = in BẢN ĐANG SỬA (kể cả chưa lưu) với dữ liệu mẫu, có chữ chìm BẢN IN THỬ */}
            <PrintOnlyDocument paper={paper}>
                <PrintTemplateDocument documentType={schema.key} config={draft} model={sampleModel} company={company} />
            </PrintOnlyDocument>

        </PageContainer>
    );
}
