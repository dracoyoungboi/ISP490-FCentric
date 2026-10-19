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
import { PRINT_DOCUMENT_TYPES } from "@/components/print/schemas/printSchemas";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";

// Nhóm chứng từ theo luồng việc; loại chứng từ mới chưa xếp nhóm thì vào "Khác"
const GROUPS = [
  { key: "mua-hang", label: "Mua hàng", types: ["purchase_request", "quotation_request", "purchase_order"] },
  { key: "kho", label: "Kho", types: ["goods_receipt", "goods_issue"] },
  { key: "ban-hang", label: "Bán hàng", types: ["sales_quotation", "sales_invoice"] },
];

/** "Khổ A4 · dọc", "Khổ K80 · máy in nhiệt"; loại có mẫu K80 mà đang dùng khổ tờ thì nhắc thêm. */
function moTaKhoGiay(schema, config) {
  if (!config) return "";
  if (config.paperSize === "K80") return "Khổ K80 · máy in nhiệt";
  const text = `Khổ ${config.paperSize} · ${config.orientation === "landscape" ? "ngang" : "dọc"}`;
  return schema.templates.some((template) => template.paperSize === "K80")
    ? `${text} · có mẫu K80 cho máy in nhiệt tại quầy`
    : text;
}

/**
 * Cấu hình › Mẫu in: một thẻ liệt kê 7 loại chứng từ theo nhóm, mỗi loại một mẫu đang dùng
 * (khổ giấy lấy từ cấu hình đã lưu). "Sửa mẫu" mở trang xem trước / chỉnh sửa của loại đó.
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
      <SettingsCard>
        <LoadingState className="min-h-48" label="Đang tải mẫu in" />
      </SettingsCard>
    );
  }

  if (status === "error") {
    return (
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
    );
  }

  const groups = [
    ...GROUPS.map((group) => ({ ...group, rows: rows.filter((row) => group.types.includes(row.schema.key)) })),
    { key: "khac", label: "Khác", rows: rows.filter((row) => !GROUPS.some((group) => group.types.includes(row.schema.key))) },
  ].filter((group) => group.rows.length > 0);

  return (
    <SettingsCard aria-labelledby="mau-in-tieu-de">
      <SettingsCardHeader
        title="Mẫu chứng từ"
        titleId="mau-in-tieu-de"
        note={`${rows.length} loại chứng từ, mỗi loại một mẫu đang dùng`}
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
                className={`flex items-center gap-x-6 gap-y-3 py-2.5 ${index ? "border-t border-[#eef1f5]" : ""}`}
              >
                <FileText className="size-[18px] shrink-0 text-[#7a8594]" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-sm leading-5 font-medium text-bo-foreground">{schema.label}</span>
                  <span className="text-[13px] leading-5 text-[#5b6676]">{paper}</span>
                </div>
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
          </ul>
        </div>
      ))}

      <div className="h-1.5" />
      <SettingsFooterLink
        to="/settings/store"
        icon={Store}
        title="Thông tin cửa hàng"
        description="Tên, logo và liên hệ in ở đầu mọi phiếu"
      />
    </SettingsCard>
  );
}
