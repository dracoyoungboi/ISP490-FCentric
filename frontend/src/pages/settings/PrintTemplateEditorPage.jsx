import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import PrintTemplateDocument from "@/components/print/PrintTemplateDocument";
import {
    computeFitScale,
    getPaperSheetClasses,
} from "@/components/print/paperStyles";
import PreviewZoomControl from "@/components/print/PreviewZoomControl";
import { PreviewPrintStyleTag } from "@/components/print/previewPrintStyles";
import { usePreviewViewportSize } from "@/components/print/usePreviewViewportSize";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPrintSchema } from "@/components/print/schemas/printSchemas";
import { getSamplePrintModel } from "./samplePrintData";
import {
    buildDefaultTemplateConfig,
    buildVariantFromDraft,
    printTemplateConfigService,
} from "@/services/printTemplateConfigService";
import { companyProfileService } from "@/services/companyProfileService";
import CompanyProfileDialog from "./CompanyProfileDialog";
import PrintOnlyDocument from "@/components/print/PrintOnlyDocument";

// ── Các bộ điều khiển nhỏ của editor ────────────────────────────────────────

function EditorSection({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <div className="rounded-lg border border-bo-border bg-white shadow-sm">
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                        <span className="text-sm font-semibold text-bo-foreground">
                            {title}
                        </span>
                        <ChevronDown
                            className={cn(
                                "size-4 text-bo-muted transition-transform",
                                open && "rotate-180"
                            )}
                        />
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="border-t border-bo-border px-4 py-4">{children}</div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

function ToggleRow({ label, checked, onChange, locked = false }) {
    return (
        <label
            className={cn(
                "flex items-center justify-between gap-3 py-1.5",
                locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            )}
        >
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-bo-foreground">
                <span className="truncate">{label}</span>
                {locked ? (
                    <span className="shrink-0 rounded-full border border-bo-border bg-bo-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bo-muted">
                        Bắt buộc
                    </span>
                ) : null}
            </span>
            <Checkbox
                checked={checked}
                disabled={locked}
                onCheckedChange={(value) => onChange(Boolean(value))}
            />
        </label>
    );
}

function TextField({ label, value, onChange, placeholder }) {
    return (
        <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-bo-muted">
                {label}
            </span>
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="border-bo-border bg-white text-bo-foreground"
            />
        </div>
    );
}

function SegmentedControl({ options, value, onChange }) {
    return (
        <div className="flex overflow-hidden rounded-md border border-bo-border">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
                        value === option.value
                            ? "bg-bo-primary text-white"
                            : "bg-white text-bo-muted hover:bg-bo-surface-subtle"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function FieldGroup({ label, children }) {
    return (
        <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-bo-muted">
                {label}
            </span>
            {children}
        </div>
    );
}

/** Hộp thoại thay đổi chưa lưu khi rời trang — 3 lựa chọn: lưu & rời / rời không lưu / ở lại. */
function UnsavedDialog({ open, saving, onClose, onSaveAndGo, onDiscardAndGo }) {
    return (
        <Dialog open={open} onOpenChange={(value) => {
            if (!value) onClose();
        }}>
            <DialogContent className="rounded-xl bg-white shadow-lg sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-gray-900">
                        Lưu thay đổi?
                    </DialogTitle>
                    <DialogDescription className="pt-2 text-sm text-gray-600">
                        Bạn có thay đổi chưa lưu. Bạn có muốn lưu trước khi rời trang không?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Ở lại
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        onClick={onDiscardAndGo}
                        disabled={saving}
                    >
                        Rời không lưu
                    </Button>
                    <Button
                        type="button"
                        className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        onClick={onSaveAndGo}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Đang lưu...
                            </>
                        ) : (
                            "Lưu & rời"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Padding màn hình của khung preview (p-4 sm:p-6) — trừ khỏi kích thước
// viewport khi tính zoom "Vừa trang".
const PREVIEW_VIEWPORT_PADDING = 48;

// ── Trang editor ─────────────────────────────────────────────────────────────

export default function PrintTemplateEditorPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { documentType, templateId } = useParams();

    const schema = getPrintSchema(documentType);

    // Draft: bản cấu hình đang chỉnh — chỉ ghi vào server khi nhấn Lưu.
    // Luôn nạp ĐÚNG biến thể theo templateId trên URL (hoặc mẫu đang áp dụng).
    const [draft, setDraft] = useState(null);
    const [company, setCompany] = useState(null);
    const [draftLoading, setDraftLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [saving, setSaving] = useState(false);

    // Snapshot trạng thái đã lưu của DRAFT — hồ sơ công ty không sửa ở đây
    // (sửa qua hộp thoại "Thông tin công ty", không phải trang riêng).
    const savedDraftRef = useRef(null);

    // Biến thể khổ giấy ĐANG DÙNG cho in thật (theo server). Bản nháp ở khổ
    // khác -> lưu được ngay dù chưa sửa gì (lưu = chuyển phiếu in sang khổ đó).
    const [inUseTemplateId, setInUseTemplateId] = useState(null);

    // Hộp thoại thay đổi chưa lưu khi rời trang
    const [leaveTarget, setLeaveTarget] = useState(null);

    // Hộp thoại "Thông tin công ty" — mở tại chỗ, không chuyển trang
    // (tránh kích hoạt cảnh báo thay đổi chưa lưu của draft).
    const [companyDialogOpen, setCompanyDialogOpen] = useState(false);

    // Zoom bản xem trước — mặc định "Vừa trang" (fit-page, tối đa 100%).
    // Callback ref tự gắn lại observer khi vùng preview mount sau khi draft tải xong.
    const [zoom, setZoom] = useState("fit");
    const previewViewport = usePreviewViewportSize();

    const reload = () => setReloadKey((key) => key + 1);

    // Nạp draft + hồ sơ công ty (async, từ server)
    useEffect(() => {
        if (!schema) return undefined;
        let cancelled = false;
        (async () => {
            setDraftLoading(true);
            setLoadError(false);
            setNotFound(false);
            try {
                const [targetCfg, profile, inUseId] = await Promise.all([
                    templateId
                        ? printTemplateConfigService.getTemplate(schema.key, templateId)
                        : printTemplateConfigService.getActiveTemplate(schema.key),
                    companyProfileService.get(),
                    printTemplateConfigService.getInUseTemplateId(schema.key),
                ]);
                if (cancelled) return;
                if (!targetCfg) {
                    setNotFound(true);
                    return;
                }
                setDraft(targetCfg);
                setCompany(profile);
                setInUseTemplateId(inUseId);
                savedDraftRef.current = JSON.stringify(targetCfg);
            } catch (error) {
                console.error("Error loading print template editor:", error);
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setDraftLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [schema, templateId, reloadKey]);

    const sampleModel = useMemo(
        () => (schema ? getSamplePrintModel(schema.key) : null),
        [schema]
    );

    // isDirty: bản nháp khác bản đã nạp/đã lưu (kể cả đổi khổ giấy) — dùng cho
    // cảnh báo rời trang. variantDiffers: khổ giấy của bản nháp khác khổ đang
    // dùng cho in thật (vd. mở thẳng URL mẫu A5 khi đang dùng A4) — chưa sửa
    // gì vẫn lưu được để chuyển phiếu in sang khổ này.
    const isDirty =
        Boolean(draft) &&
        savedDraftRef.current !== JSON.stringify(draft);
    const variantDiffers =
        Boolean(draft) && Boolean(inUseTemplateId) && draft.id !== inUseTemplateId;
    const canSave = isDirty || variantDiffers;
    const inUseDef = schema?.templates.find((template) => template.id === inUseTemplateId) ?? null;

    const editorHref = location.pathname + location.search;

    // Cảnh báo đóng tab / tải lại trang khi đang có thay đổi chưa lưu
    useEffect(() => {
        if (!isDirty) return undefined;
        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    // Chặn điều hướng bằng link nội bộ (<a href="/..."> — sidebar, breadcrumb…)
    // khi đang dirty: mở hộp thoại thay vì mất thay đổi. (Nút Back của trình
    // duyệt không chặn được do app dùng BrowserRouter, không phải data router.)
    useEffect(() => {
        if (!isDirty) return undefined;
        const handleClick = (event) => {
            const anchor =
                event.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href || !href.startsWith("/") || href === editorHref) return;
            event.preventDefault();
            event.stopPropagation();
            setLeaveTarget(href);
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [isDirty, editorHref]);

    // ── Các hành động ──

    const setField = (path, value) => {
        setDraft((prev) => {
            const next = structuredClone(prev);
            const keys = path.split(".");
            let node = next;
            for (const key of keys.slice(0, -1)) {
                node = node[key];
            }
            node[keys[keys.length - 1]] = value;
            return next;
        });
    };

    /** Lỗi validate (im lặng — dùng để disable nút Lưu theo thời gian thật). */
    const collectValidationIssues = () => {
        const errors = [];
        if (!draft?.name?.trim()) errors.push("Tên mẫu in không được để trống");
        if ((draft?.name ?? "").length > 200) errors.push("Tên mẫu in không được quá 200 ký tự");
        if (!/^#[0-9a-fA-F]{6}$/.test(draft?.accentColor ?? "")) {
            errors.push("Màu nhấn không hợp lệ (cần mã hex #RRGGBB)");
        }
        if (
            !draft?.sections ||
            typeof draft.sections !== "object" ||
            Object.keys(draft.sections).length === 0
        ) {
            errors.push("Nội dung chứng từ (sections) không được để trống");
        }
        return errors;
    };

    const validationIssues = draft ? collectValidationIssues() : [];

    const saveDraft = async () => {
        // Mô hình một-mẫu: lưu cấu hình = in thật dùng ngay (backend ghi cả
        // biến thể đang dùng trong cùng transaction — không có bước kích hoạt).
        await printTemplateConfigService.saveTemplate(draft);
    };

    /** Lưu cấu hình — ở lại trang. */
    const handleSave = async () => {
        const errors = collectValidationIssues();
        for (const error of errors) toast.error(error);
        if (errors.length > 0) return;
        setSaving(true);
        try {
            await saveDraft();
            savedDraftRef.current = JSON.stringify(draft);
            setInUseTemplateId(draft.id);
            toast.success("Đã lưu cấu hình mẫu in");
            // Lưu thành công -> quay về trang xem mẫu (khổ giấy do cấu hình
            // đã lưu quyết định, không cần tham số ?paper)
            navigate(`/settings/print-templates/${schema.slug}`);
        } catch (error) {
            console.error("Error saving print template:", error);
            // Giữ nguyên bản nháp để người dùng sửa/thử lại — không mất input
            toast.error("Không thể lưu cấu hình mẫu in");
        } finally {
            setSaving(false);
        }
    };

    // ── Đổi khổ giấy = đổi BIẾN THỂ nhưng GIỮ tuỳ chỉnh của bản nháp ──
    // Chỉ thay bản nháp tại chỗ: KHÔNG tải cấu hình cũ của khổ đích, KHÔNG đổi
    // URL (đổi URL sẽ nạp lại từ server và ghi đè bản nháp). Mốc "đã lưu"
    // giữ nguyên nên bản nháp thành có thay đổi -> nút Lưu bật; đổi ngược về
    // khổ ban đầu mà không sửa gì thì hết thay đổi.
    const handlePaperChange = (paper) => {
        if (!draft || paper === draft.paperSize) return;
        const next = buildVariantFromDraft(schema, draft, paper);
        if (!next) {
            toast.error("Loại chứng từ này không hỗ trợ khổ giấy đã chọn");
            return;
        }
        setDraft(next);
    };

    // ── Rời trang (nút Hủy / link nội bộ bị chặn) ──
    const backHref = schema
        ? `/settings/print-templates/${schema.slug}`
        : "/settings/print-templates";

    const handleCancel = () => {
        if (isDirty) {
            setLeaveTarget(backHref);
            return;
        }
        navigate(backHref);
    };

    const handleLeaveSaveAndGo = async () => {
        const target = leaveTarget ?? backHref;
        setSaving(true);
        try {
            const errors = collectValidationIssues();
            for (const error of errors) toast.error(error);
            if (errors.length > 0) {
                setSaving(false);
                return;
            }
            await saveDraft();
            savedDraftRef.current = JSON.stringify(draft);
            setLeaveTarget(null);
            navigate(target);
        } catch (error) {
            console.error("Error saving before leave:", error);
            toast.error("Không thể lưu cấu hình mẫu in");
        } finally {
            setSaving(false);
        }
    };

    const handleLeaveDiscardAndGo = () => {
        const target = leaveTarget ?? backHref;
        setLeaveTarget(null);
        navigate(target);
    };

    // ── Khôi phục cấu hình mẫu: chỉ đưa BẢN NHÁP về mặc định, đánh dirty ──
    // Không gọi server ở đây — thay đổi chỉ được persist sau khi bấm
    // "Lưu cấu hình". Hồ sơ công ty và cấu hình loại chứng từ khác giữ nguyên.
    const [resetOpen, setResetOpen] = useState(false);
    const handleReset = () => {
        setResetOpen(false);
        const def = schema.templates.find((template) => template.id === draft.id);
        if (!def) return;
        setDraft(buildDefaultTemplateConfig(schema, def));
        toast.info("Đã đưa mẫu về cấu hình mặc định — bấm “Lưu cấu hình” để áp dụng");
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
                        <Button
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            onClick={() => navigate("/settings/print-templates")}
                        >
                            Về trang cấu hình mẫu in
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    if (draftLoading) {
        return (
            <PageContainer>
                <LoadingState label="Đang tải cấu hình mẫu in" />
            </PageContainer>
        );
    }

    if (loadError) {
        return (
            <PageContainer>
                <ErrorState
                    title="Không thể tải cấu hình mẫu in"
                    description="Không thể tải cấu hình mẫu in từ máy chủ. Vui lòng thử lại."
                    onRetry={reload}
                />
            </PageContainer>
        );
    }

    if (notFound || !draft || !company) {
        return (
            <PageContainer>
                <EmptyState
                    icon={FileX}
                    title="Không tìm thấy mẫu in"
                    description="Mẫu in trong đường dẫn không tồn tại hoặc đã bị xoá."
                    action={
                        <Button
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            onClick={() => navigate("/settings/print-templates")}
                        >
                            Về trang cấu hình mẫu in
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    const isK80 = draft.paperSize === "K80";
    const paper = {
        size: draft.paperSize,
        orientation: draft.orientation,
        margin: draft.margin,
    };
    // "Vừa trang" = min(1, rộng còn lại/rộng giấy, cao còn lại/cao giấy);
    // zoom thủ công 50/75/100 giữ nguyên. computeFitScale tự bảo vệ khi
    // viewport chưa đo được (trả 1 — không NaN, không flash 0-size).
    const effectiveZoom =
        zoom === "fit"
            ? computeFitScale(
                  paper,
                  Math.max(0, previewViewport.width - PREVIEW_VIEWPORT_PADDING),
                  Math.max(0, previewViewport.height - PREVIEW_VIEWPORT_PADDING)
              )
            : Number(zoom);

    return (
        <PageContainer className="print-template-preview-page flex flex-col space-y-4 pb-4 lg:h-full">
            <PreviewPrintStyleTag paper={paper} />

            <PageHeader
                className="no-print"
                title="Chỉnh sửa mẫu in"
                eyebrow="Cấu hình mẫu in"
                description={`${draft.name} · ${schema.label} — thay đổi chỉ áp dụng sau khi lưu cấu hình.`}
            />

            <div className="grid items-stretch gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
                {/* ── Cột trái: bản xem trước trực tiếp (không cuộn trang) ── */}
                <div className="flex min-h-0 flex-col">
                    <SurfaceCard
                        className="print-template-preview flex min-h-0 flex-1 flex-col"
                        title="Bản xem trước trực tiếp"
                        description="Xem trước bằng dữ liệu mẫu — thay đổi bên phải hiển thị ngay."
                        contentClassName="flex min-h-0 flex-1 flex-col p-0"
                        action={
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                    onClick={() => window.print()}
                                >
                                    <Printer className="size-4" />
                                    In thử
                                </Button>
                                <PreviewZoomControl value={zoom} onChange={setZoom} />
                            </div>
                        }
                    >
                        <div
                            ref={previewViewport.ref}
                            className="min-h-0 flex-1 overflow-auto bg-bo-canvas p-4 sm:p-6"
                        >
                            <div
                                className={`print-preview-sheet print-ruled mx-auto border border-bo-border bg-white shadow-sm ${getPaperSheetClasses(paper)}`}
                                style={{ zoom: effectiveZoom }}
                            >
                                <PrintTemplateDocument
                                    documentType={schema.key}
                                    config={draft}
                                    model={sampleModel}
                                    company={company}
                                />
                            </div>
                        </div>
                    </SurfaceCard>
                </div>

                {/* ── Cột phải: flex-column — chỉ phần nội dung cấu hình cuộn,
                         thanh thao tác nằm NGOÀI vùng cuộn (shrink-0) nên không
                         bao giờ đè lên các section; pb-4 để section cuối
                         ("Chữ ký") cuộn lên hoàn toàn khỏi mép dưới ── */}
                <div className="flex min-h-0 flex-col">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
                        <EditorSection title="Thông tin mẫu" defaultOpen>
                            <div className="space-y-4">
                                <TextField
                                    label="Tên mẫu"
                                    value={draft.name}
                                    onChange={(value) => setField("name", value)}
                                />
                                <FieldGroup label="Loại chứng từ">
                                    <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2 text-sm font-medium text-bo-muted">
                                        {schema.label}
                                    </p>
                                </FieldGroup>
                                <div className="grid grid-cols-2 gap-3">
                                    <FieldGroup label="Khổ giấy">
                                        <SegmentedControl
                                            options={schema.paperProfiles.map((size) => ({
                                                value: size,
                                                label: size,
                                            }))}
                                            value={draft.paperSize}
                                            onChange={handlePaperChange}
                                        />
                                    </FieldGroup>
                                    {!isK80 ? (
                                        <FieldGroup label="Hướng giấy">
                                            <SegmentedControl
                                                options={[
                                                    { value: "portrait", label: "Dọc" },
                                                    { value: "landscape", label: "Ngang" },
                                                ]}
                                                value={draft.orientation}
                                                onChange={(value) => setField("orientation", value)}
                                            />
                                        </FieldGroup>
                                    ) : null}
                                </div>
                                {variantDiffers && inUseDef ? (
                                    <p className="rounded-md border border-bo-warning/30 bg-bo-warning-soft px-3 py-2 text-xs leading-5 text-bo-foreground">
                                        Phiếu in thật đang dùng khổ <strong>{inUseDef.paperSize}</strong> —
                                        bấm “Lưu cấu hình” để chuyển sang khổ <strong>{draft.paperSize}</strong>.
                                    </p>
                                ) : null}
                                {!isK80 ? (
                                    <FieldGroup label="Lề">
                                        <SegmentedControl
                                            options={[
                                                { value: "narrow", label: "Hẹp" },
                                                { value: "default", label: "Mặc định" },
                                                { value: "wide", label: "Rộng" },
                                            ]}
                                            value={draft.margin}
                                            onChange={(value) => setField("margin", value)}
                                        />
                                    </FieldGroup>
                                ) : null}
                                <FieldGroup label="Màu nhấn">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={draft.accentColor}
                                            onChange={(event) =>
                                                setField("accentColor", event.target.value)
                                            }
                                            className="size-9 cursor-pointer rounded-md border border-bo-border bg-white p-1"
                                        />
                                        <Input
                                            value={draft.accentColor}
                                            onChange={(event) =>
                                                setField("accentColor", event.target.value)
                                            }
                                            className="w-28 border-bo-border bg-white font-mono text-xs text-bo-foreground"
                                        />
                                    </div>
                                </FieldGroup>
                            </div>
                        </EditorSection>

                        <EditorSection title="Hồ sơ công ty (dùng chung)">
                            <p className="mb-3 rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2 text-xs leading-5 text-bo-muted">
                                Hồ sơ công ty dùng chung cho mọi loại chứng từ — sửa
                                bằng nút bên dưới, không sửa trực tiếp trong trình
                                chỉnh sửa mẫu.
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {company.logoAsset ? (
                                        <img
                                            src={company.logoAsset}
                                            alt="Logo công ty"
                                            className="h-10 w-10 rounded-md border border-bo-border bg-white object-contain p-1"
                                        />
                                    ) : null}
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-bo-foreground">
                                            {company.name}
                                        </p>
                                        <p className="truncate text-xs text-bo-muted">
                                            {[company.email, company.phone].filter(Boolean).join(" · ") || "Chưa có email / điện thoại"}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                    onClick={() => setCompanyDialogOpen(true)}
                                >
                                    Chỉnh sửa hồ sơ công ty
                                </Button>
                            </div>
                        </EditorSection>

                        <EditorSection title="Hiển thị thương hiệu">
                            <div>
                                <ToggleRow
                                    label="Hiển thị logo"
                                    checked={draft.branding.showLogo}
                                    onChange={(value) => setField("branding.showLogo", value)}
                                />
                                <ToggleRow
                                    label="Hiển thị tên công ty"
                                    checked={draft.branding.showCompanyName}
                                    onChange={(value) => setField("branding.showCompanyName", value)}
                                />
                                <ToggleRow
                                    label="Hiển thị email"
                                    checked={draft.branding.showEmail}
                                    onChange={(value) => setField("branding.showEmail", value)}
                                />
                                <ToggleRow
                                    label="Hiển thị điện thoại"
                                    checked={draft.branding.showPhone}
                                    onChange={(value) => setField("branding.showPhone", value)}
                                />
                                <ToggleRow
                                    label="Hiển thị địa chỉ"
                                    checked={draft.branding.showAddress}
                                    onChange={(value) => setField("branding.showAddress", value)}
                                />
                            </div>
                        </EditorSection>

                        {schema.sections
                            .filter((section) => !(isK80 && section.compactHidden))
                            .map((section) => (
                            <EditorSection key={section.key} title={section.title} defaultOpen={false}>
                                {section.type === "info" ? (
                                    <div>
                                        {section.fields.map((field) => (
                                            <ToggleRow
                                                key={field.key}
                                                label={field.label}
                                                locked={field.essential}
                                                checked={draft.sections[section.key]?.[field.key] !== false}
                                                onChange={(value) =>
                                                    setField(
                                                        `sections.${section.key}.${field.key}`,
                                                        value
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                ) : null}

                                {section.type === "items" ? (
                                    <div>
                                        <ToggleRow
                                            label="Hiển thị bảng"
                                            locked={section.essentialShow}
                                            checked={draft.sections[section.key]?.show !== false}
                                            onChange={(value) =>
                                                setField(`sections.${section.key}.show`, value)
                                            }
                                        />
                                        {isK80 && section.compactColumns ? (
                                            <p className="mb-1 mt-2 text-xs leading-5 text-bo-muted">
                                                Khổ nhiệt K80 chỉ hỗ trợ các cột sau:
                                            </p>
                                        ) : null}
                                        {(isK80 && section.compactColumns
                                            ? section.compactColumns
                                            : section.columns
                                        ).map((column) => (
                                            <ToggleRow
                                                key={column.key}
                                                label={`Cột: ${column.label}`}
                                                checked={draft.columns[column.key] !== false}
                                                onChange={(value) =>
                                                    setField(`columns.${column.key}`, value)
                                                }
                                            />
                                        ))}
                                        {section.total ? (
                                            <ToggleRow
                                                label={section.total.label}
                                                checked={
                                                    draft.sections[section.key]?.showTotal !== false
                                                }
                                                onChange={(value) =>
                                                    setField(
                                                        `sections.${section.key}.showTotal`,
                                                        value
                                                    )
                                                }
                                            />
                                        ) : null}
                                    </div>
                                ) : null}

                                {section.type === "notes" ? (
                                    <ToggleRow
                                        label="Hiển thị khu vực ghi chú"
                                        checked={draft.sections[section.key]?.show !== false}
                                        onChange={(value) =>
                                            setField(`sections.${section.key}.show`, value)
                                        }
                                    />
                                ) : null}

                                {section.type === "signatures" ? (
                                    <div>
                                        {section.blocks.map((block) => (
                                            <ToggleRow
                                                key={block.key}
                                                label={block.label}
                                                checked={
                                                    draft.sections[section.key]?.[block.key] !== false
                                                }
                                                onChange={(value) =>
                                                    setField(
                                                        `sections.${section.key}.${block.key}`,
                                                        value
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                ) : null}
                            </EditorSection>
                        ))}
                    </div>

                    {/* ── Thanh thao tác DUY NHẤT — nằm ngoài vùng cuộn của cột
                         cấu hình, gọn 1 hàng ở chiều rộng panel (~400px):
                         trái "Khôi phục" (không tooltip — chữ trên nút đã rõ, hộp
                         thoại xác nhận giải thích chi tiết; tooltip cũ tự bật
                         lại khi focus trả về nút sau khi đóng hộp thoại),
                         phải "Hủy" + "Lưu cấu hình" cách nhau 8px. flex-wrap để
                         màn thật hẹp chuyển hàng gọn, không tràn/cắt. ── */}
                    <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-bo-border bg-white px-3 py-3 shadow-sm">
                        <Button
                            variant="outline"
                            className="h-9 border-bo-border bg-white text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
                            onClick={() => setResetOpen(true)}
                        >
                            <RotateCcw className="size-4" />
                            Khôi phục
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                onClick={handleCancel}
                                disabled={saving}
                            >
                                Hủy
                            </Button>
                            <Button
                                className="h-9 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                onClick={handleSave}
                                disabled={saving || !canSave || validationIssues.length > 0}
                                title={
                                    validationIssues.length > 0
                                        ? validationIssues[0]
                                        : undefined
                                }
                            >
                                {saving ? "Đang lưu…" : "Lưu cấu hình"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hộp thoại thay đổi chưa lưu — rời trang */}
            <UnsavedDialog
                open={Boolean(leaveTarget)}
                saving={saving}
                onClose={() => setLeaveTarget(null)}
                onSaveAndGo={handleLeaveSaveAndGo}
                onDiscardAndGo={handleLeaveDiscardAndGo}
            />

            {/* Hồ sơ công ty dùng chung — mở tại chỗ, cập nhật phần tóm tắt ở trên */}
            <CompanyProfileDialog
                open={companyDialogOpen}
                onOpenChange={setCompanyDialogOpen}
                onSaved={setCompany}
            />

            {/* In thử trong editor = in BẢN NHÁP hiện tại (chưa lưu) với dữ
                liệu mẫu — qua print mirror, không ghi gì xuống server. */}
            <PrintOnlyDocument paper={paper}>
                <PrintTemplateDocument
                    documentType={schema.key}
                    config={draft}
                    model={sampleModel}
                    company={company}
                />
            </PrintOnlyDocument>

            {/* Xác nhận khôi phục cấu hình mẫu */}
            <Dialog open={resetOpen} onOpenChange={(value) => {
                if (!value) setResetOpen(false);
            }}>
                <DialogContent className="rounded-xl bg-white shadow-lg sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Khôi phục cấu hình mẫu?
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-sm text-gray-600">
                            Các thay đổi CHƯA LƯU của mẫu này sẽ bị bỏ và mẫu quay về
                            cấu hình mặc định. Thay đổi chỉ được áp dụng sau khi bạn
                            bấm “Lưu cấu hình”. Hồ sơ công ty và cấu hình của loại
                            chứng từ khác không bị ảnh hưởng.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                            onClick={() => setResetOpen(false)}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={handleReset}
                        >
                            Khôi phục cấu hình mẫu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
