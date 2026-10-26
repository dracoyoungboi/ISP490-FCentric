import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, Lock, Store } from "lucide-react";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsFooterLink,
  SettingsGroupLabel,
} from "@/components/settings/SettingsUI";
import { PRINT_DOCUMENT_GROUPS, PRINT_DOCUMENT_TYPES } from "@/components/print/schemas/printSchemas";
import { isThermalPaper } from "@/components/print/paperStyles";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";
import DongMauTem from "@/components/settings/DongMauTem";

/** "Khổ A4 · dọc", "Khổ K80 · máy in nhiệt". */
function moTaKhoGiay(schema, config) {
  if (!config) return "";
  if (isThermalPaper(config.paperSize)) return `Khổ ${config.paperSize} · máy in nhiệt`;
  return `Khổ ${config.paperSize} · ${config.orientation === "landscape" ? "ngang" : "dọc"}`;
}

/**
 * Cấu hình › Mẫu in (PA1 bước 1): một thẻ liệt kê các loại chứng từ theo nhóm, mỗi loại một mẫu
 * đang dùng — tên, khi nào dùng và khổ giấy (từ cấu hình đã lưu). Bấm tên hoặc "Sửa mẫu" mở thẳng
 * trình sửa một màn của loại đó; mẫu đã đổi gì, ai đổi, khi nào xem ở Lịch sử chỉnh sửa trong trình sửa.
 * Tem sản phẩm là một dòng cùng khuôn ở cuối nhóm Kho (DongMauTem), sửa trong hộp riêng.
 */
export default function PrintTemplateListPage() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorStatus, setErrorStatus] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorStatus(null);
    try {
      await printTemplateConfigService.migrateLegacyLocalIfNeeded();
      const configs = await Promise.all(
        PRINT_DOCUMENT_TYPES.map((schema) => printTemplateConfigService.getActiveTemplate(schema.key)),
      );
      setRows(
        PRINT_DOCUMENT_TYPES.map((schema, index) => ({
          schema,
          paper: moTaKhoGiay(schema, configs[index]),
        })),
      );
      setStatus("loaded");
    } catch (error) {
      console.error("Không tải được cấu hình mẫu in:", error);
      setErrorStatus(error?.response?.status ?? null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  if (status === "loading") {
    return (
      <>
        <SettingsCard>
          <LoadingState className="min-h-48" label="Đang tải mẫu in" />
        </SettingsCard>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <SettingsCard>
          {errorStatus === 401 || errorStatus === 403 ? (
            <EmptyState
              icon={Lock}
              title="Bạn không có quyền đọc cấu hình mẫu in"
              description="Liên hệ quản trị viên nếu bạn cần quyền này."
            />
          ) : (
            <ErrorState
              className="min-h-48"
              title="Không thể tải mẫu in"
              description="Không đọc được cấu hình mẫu in từ máy chủ. Vui lòng thử lại."
              onRetry={load}
            />
          )}
        </SettingsCard>
      </>
    );
  }

  const groups = PRINT_DOCUMENT_GROUPS.map((group) => ({
    ...group,
    rows: rows.filter((row) => group.types.includes(row.schema.key)),
  })).filter((group) => group.rows.length > 0);

  return (
    <>
      <SettingsCard aria-labelledby="mau-in-tieu-de">
        <SettingsCardHeader
          title="Mẫu chứng từ"
          titleId="mau-in-tieu-de"
          note={`${rows.length} loại chứng từ và tem sản phẩm, mỗi loại một mẫu đang dùng. Bấm tên để xem trước và sửa.`}
        />

        {groups.map((group, groupIndex) => (
          <div key={group.key} className="px-5">
            <SettingsGroupLabel
              id={`mau-in-${group.key}`}
              className={groupIndex ? "mt-1 border-t border-[#eef1f5] pt-3.5" : undefined}
            >
              {group.label}
            </SettingsGroupLabel>
            <ul aria-labelledby={`mau-in-${group.key}`}>
              {group.rows.map(({ schema, paper }, index) => (
                <li
                  key={schema.key}
                  // Nền nhạt khi trỏ chuột (rộng ra 8px mỗi bên); đường kẻ giữa các dòng vẫn thẳng với chữ
                  className={`relative -mx-2 flex items-center gap-x-4 gap-y-2 rounded-md px-2 py-2.5 transition-colors hover:bg-bo-surface-subtle sm:gap-x-6 ${
                    index ? "before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-[#eef1f5]" : ""
                  }`}
                >
                  <FileText className="size-[18px] shrink-0 text-[#7a8594]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/settings/print-templates/${schema.slug}`}
                      className="text-sm leading-5 font-medium text-bo-foreground hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                    >
                      {schema.label}
                    </Link>
                    {schema.description ? (
                      <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{schema.description}</p>
                    ) : null}
                    {/* Màn hẹp: khổ giấy xuống dòng dưới mô tả (màn rộng có cột riêng bên phải) */}
                    <p className="text-[13px] leading-5 text-[#5b6676] sm:hidden">{paper}</p>
                  </div>
                  <span className="hidden shrink-0 text-[13px] leading-5 whitespace-nowrap text-[#5b6676] sm:inline">{paper}</span>
                  <Link
                    to={`/settings/print-templates/${schema.slug}`}
                    aria-label={`Sửa mẫu ${schema.label.toLowerCase()}`}
                    className="-mr-2.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                  >
                    Sửa mẫu
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {group.key === "kho" ? <DongMauTem coVachTren={group.rows.length > 0} /> : null}
            </ul>
          </div>
        ))}

        <div className="h-1.5" />
        <SettingsFooterLink
          to="/settings/store"
          icon={Store}
          title="Thông tin cửa hàng"
          description="Tên, mã số thuế, logo và liên hệ in ở đầu mọi phiếu và hóa đơn"
        />
      </SettingsCard>
    </>
  );
}
