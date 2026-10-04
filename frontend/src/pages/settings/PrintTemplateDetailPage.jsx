import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileX, Pencil, Printer } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import PrintTemplateDocument from "@/components/print/PrintTemplateDocument";
import PreviewZoomControl from "@/components/print/PreviewZoomControl";
import { PreviewPrintStyleTag } from "@/components/print/previewPrintStyles";
import { usePreviewViewportSize } from "@/components/print/usePreviewViewportSize";
import { computeFitScale, getPaperSheetClasses } from "@/components/print/paperStyles";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getPrintSchema } from "@/components/print/schemas/printSchemas";
import { getSamplePrintModel } from "./samplePrintData";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";
import { companyProfileService } from "@/services/companyProfileService";
import PrintOnlyDocument from "@/components/print/PrintOnlyDocument";

/**
 * Trang xem trước riêng của một mẫu (route cũ, giữ lại cho deep-link).
 * Trang cấu hình chính giờ đã nhúng preview — trang này chỉ còn dùng cho
 * URL cũ dạng /settings/print-templates/:documentType/:templateId.
 * Định danh mẫu không hợp lệ -> trạng thái "Không tìm thấy" (không còn
 * âm thầm mở mẫu đầu tiên).
 */
export default function PrintTemplateDetailPage() {
    const navigate = useNavigate();
    const { documentType, templateId } = useParams();

    const schema = getPrintSchema(documentType);

    const [config, setConfig] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    // Zoom bản xem trước — mặc định "Vừa trang" (fit-page, tối đa 100%)
    const [zoom, setZoom] = useState("fit");
    const previewViewport = usePreviewViewportSize();

    const reload = useCallback(() => setReloadKey((key) => key + 1), []);

    useEffect(() => {
        if (!schema) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(false);
            try {
                const [cfg, profile] = await Promise.all([
                    templateId
                        ? printTemplateConfigService.getTemplate(schema.key, templateId)
                        : printTemplateConfigService.getActiveTemplate(schema.key),
                    companyProfileService.get(),
                ]);
                if (cancelled) return;
                setConfig(cfg);
                setCompany(profile);
            } catch (error) {
                console.error("Error loading print template detail:", error);
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
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

    if (loading) {
        return (
            <PageContainer>
                <LoadingState rows={4} label="Đang tải mẫu in" />
            </PageContainer>
        );
    }

    if (loadError) {
        return (
            <PageContainer>
                <ErrorState
                    title="Không thể tải mẫu in"
                    description="Không thể tải cấu hình mẫu in từ máy chủ. Vui lòng thử lại."
                    onRetry={reload}
                />
            </PageContainer>
        );
    }

    if (!config) {
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

    const paper = {
        size: config.paperSize,
        orientation: config.orientation,
        margin: config.margin,
    };

    const orientationLabel =
        config.paperSize === "K80"
            ? "Khổ nhiệt"
            : config.orientation === "landscape"
                ? "Ngang"
                : "Dọc";

    // Trang này cuộn theo trang (page-level scroll) nên "Vừa trang" chỉ cần
    // khớp chiều rộng khung preview, cap 100% — không phóng to quá khổ in thật.
    const effectiveZoom =
        zoom === "fit"
            ? computeFitScale(
                  paper,
                  Math.max(0, previewViewport.width - 48),
                  Math.max(0, previewViewport.height - 48)
              )
            : Number(zoom);

    return (
        <PageContainer className="print-template-preview-page space-y-5 pb-24">
            <PreviewPrintStyleTag paper={paper} />

            <PageHeader
                className="no-print"
                eyebrow="Cấu hình mẫu in"
                title={config.name}
                description={`Loại chứng từ: ${schema.label} · Khổ giấy: ${config.paperSize} (${orientationLabel})`}
                actions={
                    <>
                        <Button
                            variant="outline"
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            onClick={() =>
                                navigate(
                                    `/settings/print-templates/${schema.slug}?paper=${config.paperSize}`
                                )
                            }
                        >
                            <ArrowLeft className="size-4" />
                            Quay lại
                        </Button>
                        <Button
                            variant="outline"
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            onClick={() => window.print()}
                        >
                            <Printer className="size-4" />
                            Xem bản in mẫu
                        </Button>
                        <Button
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            onClick={() =>
                                navigate(
                                    `/settings/print-templates/${schema.slug}/${config.id}/edit`
                                )
                            }
                        >
                            <Pencil className="size-4" />
                            Chỉnh sửa mẫu
                        </Button>
                    </>
                }
            />

            <SurfaceCard className="no-print" title="Thông tin mẫu">
                <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Tên mẫu
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold text-bo-foreground">
                            {config.name}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Loại chứng từ
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold text-bo-foreground">
                            {schema.label}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Khổ giấy
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold text-bo-foreground">
                            {config.paperSize} ({orientationLabel})
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            Lề
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold text-bo-foreground">
                            {config.margin === "narrow"
                                ? "Hẹp"
                                : config.margin === "wide"
                                    ? "Rộng"
                                    : "Mặc định"}
                        </dd>
                    </div>
                </dl>
            </SurfaceCard>

            <SurfaceCard
                className="print-template-preview"
                title="Bản xem trước"
                description={
                    schema.hasRealPrintRoute
                        ? "Dữ liệu mẫu minh họa — không phải dữ liệu thật. Bản xem trước áp dụng đúng cấu hình mẫu đã lưu."
                        : "Dữ liệu mẫu minh họa — loại chứng từ này chưa có bản in thật."
                }
                contentClassName="p-0"
                action={<PreviewZoomControl value={zoom} onChange={setZoom} />}
            >
                <div
                    ref={previewViewport.ref}
                    className="print-preview-scroll overflow-auto bg-bo-canvas p-4 sm:p-6"
                >
                    <div
                        className={`print-preview-sheet print-ruled mx-auto border border-bo-border bg-white shadow-sm ${getPaperSheetClasses(paper)}`}
                        style={{ zoom: effectiveZoom }}
                    >
                        <PrintTemplateDocument
                            documentType={schema.key}
                            config={config}
                            model={sampleModel}
                            company={company}
                        />
                    </div>
                </div>
            </SurfaceCard>

            {/* Bản in mẫu qua PRINT MIRROR — chỉ tờ giấy, đúng cấu hình đã lưu */}
            <PrintOnlyDocument paper={paper}>
                <PrintTemplateDocument
                    documentType={schema.key}
                    config={config}
                    model={sampleModel}
                    company={company}
                />
            </PrintOnlyDocument>
        </PageContainer>
    );
}
