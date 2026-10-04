import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Building2, FileX, Lock, Pencil, Printer } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import PrintTemplateDocument from "@/components/print/PrintTemplateDocument";
import PrintOnlyDocument from "@/components/print/PrintOnlyDocument";
import PreviewZoomControl from "@/components/print/PreviewZoomControl";
import { PreviewPrintStyleTag } from "@/components/print/previewPrintStyles";
import { usePreviewViewportSize } from "@/components/print/usePreviewViewportSize";
import {
    computeFitScale,
    getPaperSheetClasses,
} from "@/components/print/paperStyles";
import { PRINT_DOCUMENT_TYPES, getPrintSchema } from "@/components/print/schemas/printSchemas";
import { getSamplePrintModel } from "./samplePrintData";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";
import { companyProfileService } from "@/services/companyProfileService";
import CompanyProfileDialog from "./CompanyProfileDialog";

// Padding màn hình của khung preview (p-3 sm:p-4 = 12-16px) — trừ khỏi kích
// thước viewport khi tính zoom "Vừa trang" để tờ giấy không tràn/không thiếu.
const PREVIEW_VIEWPORT_PADDING = 32;

/**
 * Trang cấu hình mẫu in — MÔ HÌNH MỘT MẪU mỗi loại chứng từ:
 * - trái: danh sách 7 loại chứng từ (dưới lg: select gọn phía trên preview)
 * - phải: toolbar (tên mẫu + nhãn KHỔ GIẤY CHỈ ĐỌC lấy từ cấu hình ĐÃ LƯU +
 *   cụm zoom 50/75/100/"Vừa trang" + In thử / Chỉnh sửa) + vùng preview nhúng
 * - zoom chỉ ảnh hưởng bản xem màn hình, không bao giờ ghi xuống cấu hình;
 *   mặc định "Vừa trang" (fit, tối đa 100%); bấm mức khác chuyển thủ công
 * - "In thử" in qua PRINT MIRROR (PrintOnlyDocument) — bản in chỉ gồm tờ
 *   giấy với cấu hình đã lưu + dữ liệu mẫu, khớp 1:1 bản xem trước
 */
export default function PrintTemplatesPage() {
    const navigate = useNavigate();
    const { documentType: slugParam } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const schema = slugParam ? getPrintSchema(slugParam) : null;

    const [bundle, setBundle] = useState(null);
    const [config, setConfig] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    // HTTP status của lỗi tải bundle — phân biệt 401/403 (thiếu quyền đọc)
    // với lỗi mạng/máy chủ để trạng thái hiển thị chính xác.
    const [loadErrorStatus, setLoadErrorStatus] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Zoom bản xem trước — mặc định "Vừa trang" (fit-page, tối đa 100%).
    // State RIÊNG của bản xem, không liên quan cấu hình đã lưu.
    // Zoom bản xem trước: "fit" = chế độ Vừa trang (tự tính, tối đa 100%),
    // hoặc một mức thủ công (0.5 / 0.75 / 1) sau khi bấm nút tương ứng.
    const [zoomMode, setZoomMode] = useState("fit");
    const previewViewport = usePreviewViewportSize();

    // Hộp thoại "Thông tin công ty" (hồ sơ dùng chung) — mở từ nút trên tiêu đề
    // trang hoặc qua deep-link cũ /settings/company-profile (?action=company).
    const [companyDialogOpen, setCompanyDialogOpen] = useState(false);

    const reload = useCallback(() => setReloadKey((key) => key + 1), []);

    // Thiếu slug -> chuyển về loại chứng từ đầu tiên (giữ search params cho
    // deep-link ?action=company).
    useEffect(() => {
        if (!slugParam) {
            const search = searchParams.toString();
            navigate(
                `/settings/print-templates/${PRINT_DOCUMENT_TYPES[0].slug}${
                    search ? `?${search}` : ""
                }`,
                { replace: true }
            );
        }
    }, [slugParam, navigate, searchParams]);

    // Tải bundle: migrate legacy localStorage một lần rồi đọc config server
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(false);
            setLoadErrorStatus(null);
            try {
                await printTemplateConfigService.migrateLegacyLocalIfNeeded();
                await companyProfileService.migrateLegacyLocalIfNeeded();
                const loadedBundle = await printTemplateConfigService.load();
                if (!cancelled) setBundle(loadedBundle);
            } catch (error) {
                console.error("Error loading print templates:", error);
                if (!cancelled) {
                    setLoadError(true);
                    setLoadErrorStatus(error?.response?.status ?? null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // ── Biến thể DÙNG CHO IN THẬT (mô hình một mẫu) ──
    // Lấy từ cấu hình ĐÃ LƯU: ưu tiên biến thể đang dùng (active map) nếu nó
    // có cấu hình lưu, ngược lại biến thể đã lưu đầu tiên; chưa lưu gì ->
    // mẫu mặc định của registry. KHÔNG có lựa chọn khổ giấy tương tác trên
    // trang xem — khổ giấy do cấu hình đã lưu quyết định.
    const activeId = bundle?.active?.[schema?.key] ?? null;
    const savedTemplateIds =
        bundle?.configs
            ?.filter((config) => config.documentType === schema?.key)
            .map((config) => config.templateId) ?? [];
    const targetTemplateId = schema
        ? savedTemplateIds.length > 0
            ? savedTemplateIds.includes(activeId)
                ? activeId
                : savedTemplateIds[0]
            : (schema.templates.find((template) => template.isDefault) ??
                  schema.templates[0])?.id
        : null;
    const variantDef = schema
        ? schema.templates.find((template) => template.id === targetTemplateId) ?? null
        : null;

    // Deep-link cũ /settings/company-profile -> ?action=company: mở hộp thoại
    // thông tin công ty rồi xóa tham số dùng-một-lần khỏi URL. Khi chưa có
    // slug thì bỏ qua việc dọn URL — effect thiếu-slug ở trên sẽ chuyển trang
    // và giữ lại ?action=, effect này chạy lại và dọn sau.
    useEffect(() => {
        if (searchParams.get("action") !== "company") return;
        setCompanyDialogOpen(true);
        if (!slugParam) return;
        const next = new URLSearchParams(searchParams);
        next.delete("action");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams, slugParam]);

    // Tải cấu hình của biến thể in thật + hồ sơ công ty
    useEffect(() => {
        if (!schema || !bundle || !variantDef) return undefined;
        let cancelled = false;
        (async () => {
            setConfig(null);
            try {
                const [cfg, profile] = await Promise.all([
                    printTemplateConfigService.getTemplate(schema.key, variantDef.id),
                    companyProfileService.get(),
                ]);
                if (cancelled) return;
                setConfig(cfg);
                setCompany(profile);
            } catch (error) {
                console.error("Error loading print template config:", error);
                if (!cancelled) setLoadError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [schema, bundle, variantDef]);

    const sampleModel = useMemo(
        () => (schema ? getSamplePrintModel(schema.key) : null),
        [schema]
    );

    // ── Các hành động ──
    const goToDocType = (slug) => navigate(`/settings/print-templates/${slug}`);

    const openEditor = () =>
        variantDef
            ? navigate(`/settings/print-templates/${schema.slug}/${variantDef.id}/edit`)
            : null;

    // ── Trạng thái trang ──
    if (loading) {
        return (
            <PageContainer>
                <LoadingState label="Đang tải cấu hình mẫu in" />
            </PageContainer>
        );
    }

    if (loadError) {
        // 401/403: tài khoản không được phép ĐỌC cấu hình — retry vô ích,
        // hiển thị đúng lý do thay vì lỗi chung.
        if (loadErrorStatus === 401 || loadErrorStatus === 403) {
            return (
                <PageContainer>
                    <EmptyState
                        icon={Lock}
                        title="Bạn không có quyền đọc cấu hình mẫu in"
                        description="Tài khoản của bạn không được phép đọc cấu hình mẫu in trên máy chủ. Liên hệ quản trị viên nếu bạn cần quyền này."
                        action={
                            <Button
                                className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                                onClick={reload}
                            >
                                Tải lại
                            </Button>
                        }
                    />
                </PageContainer>
            );
        }
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

    if (slugParam && !schema) {
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

    if (!schema || !bundle || !variantDef) return null;

    const displayConfig = config ?? null;
    const paperObj = displayConfig
        ? {
              size: displayConfig.paperSize,
              orientation: displayConfig.orientation,
              margin: displayConfig.margin,
          }
        : {
              size: variantDef.paperSize,
              orientation: variantDef.orientation,
              margin: variantDef.margin,
          };

    const orientationLabel =
        displayConfig?.paperSize === "K80"
            ? "Khổ nhiệt"
            : displayConfig?.orientation === "landscape"
                ? "Ngang"
                : "Dọc";
    // Nhãn khổ giấy CHỈ ĐỌC — phản ánh cấu hình đã lưu (không chọn tương tác)
    const formatLabel = displayConfig
        ? displayConfig.paperSize === "K80"
            ? "K80 · Khổ nhiệt"
            : `${displayConfig.paperSize} · ${orientationLabel}`
        : null;

    // "Vừa trang" = min(1, rộng còn lại/rộng giấy, cao còn lại/cao giấy);
    // zoom thủ công 50/75/100 giữ nguyên. computeFitScale tự bảo vệ khi
    // viewport chưa đo được (trả 1 — không NaN, không flash 0-size).
    const effectiveZoom =
        zoomMode === "fit"
            ? computeFitScale(
                  paperObj,
                  Math.max(0, previewViewport.width - PREVIEW_VIEWPORT_PADDING),
                  Math.max(0, previewViewport.height - PREVIEW_VIEWPORT_PADDING)
              )
            : Number(zoomMode);

    return (
        <PageContainer className="print-template-preview-page flex flex-col space-y-4 pb-4 lg:h-full">
            <PreviewPrintStyleTag paper={paperObj} />

            <PageHeader
                className="no-print"
                title="Cấu hình mẫu in"
                description="Mỗi loại chứng từ có một mẫu in. Chỉnh sửa và lưu cấu hình để phiếu in thật áp dụng ngay."
                actions={
                    <Button
                        variant="outline"
                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={() => setCompanyDialogOpen(true)}
                    >
                        <Building2 className="size-4" />
                        Thông tin công ty
                    </Button>
                }
            />

            <div className="grid items-stretch gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* ── Trái: danh sách loại chứng từ (lg+) / select (dưới lg) ── */}
                <div className="no-print flex min-h-0 flex-col gap-3">
                    <div className="lg:hidden">
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Loại chứng từ
                        </label>
                        <Select
                            value={schema.slug}
                            onValueChange={(value) => goToDocType(value)}
                        >
                            <SelectTrigger className="w-full border-bo-border bg-white">
                                <SelectValue placeholder="Chọn loại chứng từ" />
                            </SelectTrigger>
                            <SelectContent>
                                {PRINT_DOCUMENT_TYPES.map((type) => (
                                    <SelectItem key={type.key} value={type.slug}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <SurfaceCard
                        title="Loại chứng từ"
                        contentClassName="flex min-h-0 flex-1 flex-col p-0"
                        className="hidden min-h-0 lg:flex lg:flex-col"
                    >
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                            {PRINT_DOCUMENT_TYPES.map((type) => {
                                const isSelected = type.key === schema.key;
                                return (
                                    <button
                                        key={type.key}
                                        type="button"
                                        onClick={() => goToDocType(type.slug)}
                                        className={cn(
                                            "flex w-full items-center justify-between gap-2 border-l-2 px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary",
                                            isSelected
                                                ? "border-bo-primary bg-bo-primary-soft font-semibold text-bo-primary"
                                                : "border-transparent text-bo-foreground hover:bg-bo-surface-subtle"
                                        )}
                                    >
                                        <span className="truncate">{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </SurfaceCard>
                </div>

                {/* ── Phải: toolbar + vùng preview ── */}
                <div className="flex min-h-0 flex-col gap-3">
                    <SurfaceCard
                        className="no-print shrink-0"
                        contentClassName="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
                    >
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-bo-foreground">
                                {schema.label}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <StatusBadge label="Dữ liệu mẫu" tone="neutral" dot={false} />
                                {formatLabel ? (
                                    <span className="text-xs text-bo-muted">
                                        Khổ giấy đã lưu: <strong className="font-semibold">{formatLabel}</strong>
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Cụm thu phóng + hành động — thu phóng chỉ tác động
                            lên bản xem màn hình, không ghi cấu hình, không
                            xuất hiện khi in (toolbar no-print + print mirror).
                            KHÔNG tooltip thừa: các nút đã có chữ rõ ràng,
                            nhãn truy cập do aria-label của cụm đảm nhiệm. */}
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <PreviewZoomControl
                                value={zoomMode === "fit" ? "fit" : String(zoomMode)}
                                onChange={(value) =>
                                    setZoomMode(value === "fit" ? "fit" : Number(value))
                                }
                                ariaLabel="Thu phóng bản xem trước"
                            />
                            <Button
                                variant="outline"
                                className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                onClick={() => window.print()}
                                disabled={!displayConfig}
                            >
                                <Printer className="size-4" />
                                In thử
                            </Button>
                            <Button
                                className="h-9 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                onClick={openEditor}
                                disabled={!displayConfig}
                            >
                                <Pencil className="size-4" />
                                Chỉnh sửa
                            </Button>
                        </div>
                    </SurfaceCard>

                    <SurfaceCard
                        className="print-template-preview flex min-h-0 flex-1 flex-col"
                        // p-0! phải dùng important — SurfaceCard mặc định có
                        // sm:p-5 (responsive variant thắng p-0 thường) khiến
                        // vùng xem thụt 20px khỏi mép card trên desktop.
                        contentClassName="flex min-h-0 flex-1 flex-col p-0!"
                    >
                        {/* Viewport cuộn: cha là flex-col có chiều cao xác định
                            (SurfaceCard flex-1 trong cột min-h-0) nên flex-1 ở
                            đây ép viewport bằng đúng chiều cao còn lại — nội
                            dung dài hơn sẽ cuộn tới tận hàng cuối cùng. */}
                        <div
                            ref={previewViewport.ref}
                            className="print-preview-scroll min-h-0 flex-1 overflow-auto bg-bo-canvas p-3 sm:p-4"
                        >
                            {!displayConfig ? (
                                <LoadingState label="Đang tải bản xem trước" className="min-h-64" />
                            ) : (
                                <div
                                    className={`print-preview-sheet print-ruled mx-auto border border-bo-border bg-white shadow-sm ${getPaperSheetClasses(paperObj)}`}
                                    style={{ zoom: effectiveZoom }}
                                >
                                    <PrintTemplateDocument
                                        documentType={schema.key}
                                        config={displayConfig}
                                        model={sampleModel}
                                        company={company}
                                    />
                                </div>
                            )}
                        </div>
                    </SurfaceCard>
                </div>
            </div>

            {/* Hồ sơ công ty dùng chung — hộp thoại thay cho trang riêng */}
            <CompanyProfileDialog
                open={companyDialogOpen}
                onOpenChange={setCompanyDialogOpen}
                onSaved={setCompany}
            />

            {/* Bản in thử qua PRINT MIRROR — chỉ tờ giấy, đúng cấu hình đã lưu */}
            {displayConfig ? (
                <PrintOnlyDocument paper={paperObj}>
                    <PrintTemplateDocument
                        documentType={schema.key}
                        config={displayConfig}
                        model={sampleModel}
                        company={company}
                    />
                </PrintOnlyDocument>
            ) : null}
        </PageContainer>
    );
}
