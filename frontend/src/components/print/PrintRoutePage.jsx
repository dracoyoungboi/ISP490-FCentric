import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileX, Lock } from "lucide-react";
import PrintLayout from "@/components/print/PrintLayout";
import PrintTemplateDocument from "@/components/print/PrintTemplateDocument";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";
import { companyProfileService } from "@/services/companyProfileService";

/**
 * Khung chung cho các trang in thật của mọi loại chứng từ:
 * - chỉ dùng dữ liệu API thật (qua `fetcher` + `adapter` của từng loại)
 * - áp dụng mẫu đang hoạt động của loại chứng từ đó
 *   (printTemplateConfigService.getActiveTemplate — active map SERVER)
 *   + hồ sơ công ty dùng chung (companyProfileService — SERVER)
 * - renderer chung với editor nên field/cột bị tắt cũng biến mất ở bản in
 * - nằm ngoài BackofficeLayout: không sidebar/header, không bị shell cắt
 * - KHÔNG bao giờ chứa dữ liệu mẫu hay cảnh báo mẫu
 * - KHÔNG BAO GIỜ in khi cấu hình/hồ sơ chưa tải thành công hoặc dữ liệu
 *   phiếu bị thiếu do request thất bại (`getDataError`)
 *
 * Trạng thái riêng biệt:
 * - loading             : đang tải
 * - forbidden           : HTTP 401/403 -> thông báo quyền (không phải "không tìm thấy")
 * - notfound            : HTTP 404, `fetcher` ném lỗi có `isNotFound`,
 *                         hoặc `fetcher` trả về null
 * - error               : lỗi mạng/API khác -> nút "Thử lại"
 * - configError         : không tải được cấu hình mẫu in -> "Thử lại"
 * - companyError        : không tải được hồ sơ công ty -> "Thử lại"
 * - dataError           : `getDataError(data)` trả về lỗi (vd: lỗi tải dữ liệu lô)
 */
export default function PrintRoutePage({
    documentType,
    fetcher,
    adapter,
    backPath,
    loadingLabel = "Đang tải dữ liệu phiếu in",
    titleFallback = "In phiếu",
    notFoundTitle = "Không tìm thấy phiếu",
    notFoundDescription = "Phiếu có thể đã bị xoá hoặc bạn không có quyền truy cập.",
    forbiddenTitle = "Bạn không có quyền xem phiếu này.",
    forbiddenDescription = "Tài khoản của bạn không có quyền truy cập phiếu này.",
    errorDescription = "Không thể tải dữ liệu phiếu. Vui lòng thử lại.",
    getDataError,
}) {
    const navigate = useNavigate();
    const { id } = useParams();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    // "forbidden" | "notfound" | "error" | null
    const [errorType, setErrorType] = useState(null);
    // Lỗi dữ liệu bổ sung do getDataError phát hiện (vd: lỗi tải lô hàng)
    const [dataError, setDataError] = useState(null);

    const [config, setConfig] = useState(null);
    const [configError, setConfigError] = useState(false);
    const [company, setCompany] = useState(null);
    const [companyError, setCompanyError] = useState(false);

    const loadConfig = useCallback(async () => {
        setConfigError(false);
        setConfig(null);
        try {
            setConfig(await printTemplateConfigService.getActiveTemplate(documentType));
        } catch (err) {
            console.error("Error fetching print template config:", err);
            setConfigError(true);
        }
    }, [documentType]);

    const loadCompany = useCallback(async () => {
        setCompanyError(false);
        setCompany(null);
        try {
            setCompany(await companyProfileService.get());
        } catch (err) {
            console.error("Error fetching company profile:", err);
            setCompanyError(true);
        }
    }, []);

    useEffect(() => {
        loadConfig();
        loadCompany();
    }, [loadConfig, loadCompany]);

    const load = useCallback(async () => {
        setLoading(true);
        setErrorType(null);
        setDataError(null);
        try {
            const result = await fetcher(id);
            const extraError = getDataError?.(result) ?? null;
            setDataError(extraError);
            setData(result ?? null);
            if (result === null || result === undefined) {
                setErrorType("notfound");
            }
        } catch (err) {
            console.error("Error fetching print data:", err);
            const httpStatus = err?.response?.status;
            const envelopeMessage = err?.response?.data?.message ?? "";
            // Backend báo "không tìm thấy" bằng HTTP 400 kèm envelope
            // {status: 400, message: "Không tìm thấy ..."} — phân loại là notfound,
            // KHÔNG phải lỗi chung.
            const isNotFoundEnvelope =
                httpStatus === 400 &&
                /không tìm thấy|not found/i.test(envelopeMessage);

            if (httpStatus === 401 || httpStatus === 403) {
                setErrorType("forbidden");
            } else if (httpStatus === 404 || err?.isNotFound || isNotFoundEnvelope) {
                setErrorType("notfound");
            } else {
                setErrorType("error");
                toast.error("Không thể tải dữ liệu phiếu in");
            }
        } finally {
            setLoading(false);
        }
    }, [fetcher, id, getDataError]);

    useEffect(() => {
        if (id) queueMicrotask(() => load());
    }, [id, load]);

    const model = data ? adapter(data) : null;
    const title = model ? `In phiếu: ${model.documentNumber}` : titleFallback;

    const goBack = () => navigate(backPath.replace(":id", id));

    const paper = config
        ? { size: config.paperSize, orientation: config.orientation, margin: config.margin }
        : undefined;

    const configLoading = !config && !configError;
    const companyLoading = !company && !companyError;
    const disablePrint =
        loading ||
        configLoading ||
        companyLoading ||
        errorType !== null ||
        configError ||
        companyError ||
        dataError !== null ||
        !data ||
        !config ||
        !company;

    return (
        <PrintLayout
            title={title}
            onBack={goBack}
            onPrint={() => window.print()}
            disablePrint={disablePrint}
            paper={paper}
        >
            {loading || configLoading || companyLoading ? (
                <LoadingState rows={5} label={loadingLabel} className="mx-auto max-w-xl" />
            ) : errorType === "forbidden" ? (
                <EmptyState
                    icon={Lock}
                    title={forbiddenTitle}
                    description={forbiddenDescription}
                    action={
                        <Button
                            onClick={goBack}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            Quay lại
                        </Button>
                    }
                />
            ) : errorType === "notfound" ? (
                <EmptyState
                    icon={FileX}
                    title={notFoundTitle}
                    description={notFoundDescription}
                    action={
                        <Button
                            onClick={goBack}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            Quay lại
                        </Button>
                    }
                />
            ) : errorType === "error" ? (
                <ErrorState
                    title="Không thể tải phiếu in"
                    description={errorDescription}
                    onRetry={load}
                    className="mx-auto max-w-xl"
                />
            ) : configError ? (
                <ErrorState
                    title="Không thể tải cấu hình mẫu in"
                    description="Không thể tải cấu hình mẫu in từ máy chủ. Không in khi chưa tải xong cấu hình."
                    onRetry={loadConfig}
                    className="mx-auto max-w-xl"
                />
            ) : companyError ? (
                <ErrorState
                    title="Không thể tải hồ sơ công ty"
                    description="Không thể tải hồ sơ công ty từ máy chủ. Không in khi chưa tải xong hồ sơ."
                    onRetry={loadCompany}
                    className="mx-auto max-w-xl"
                />
            ) : dataError ? (
                <ErrorState
                    title={dataError.title}
                    description={dataError.description}
                    onRetry={load}
                    className="mx-auto max-w-xl"
                />
            ) : !data ? (
                <EmptyState
                    icon={FileX}
                    title={notFoundTitle}
                    description={notFoundDescription}
                    action={
                        <Button
                            onClick={goBack}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            Quay lại
                        </Button>
                    }
                />
            ) : !config ? (
                <EmptyState
                    icon={FileX}
                    title="Chưa có cấu hình mẫu in"
                    description="Loại chứng từ này chưa có mẫu in được cấu hình."
                />
            ) : (
                <PrintTemplateDocument
                    documentType={documentType}
                    config={config}
                    model={model}
                    company={company}
                />
            )}
        </PrintLayout>
    );
}
