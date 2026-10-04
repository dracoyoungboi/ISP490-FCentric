import PrintHeader from "@/components/print/PrintHeader";
import PrintDocumentInfo from "@/components/print/PrintDocumentInfo";
import PrintSection from "@/components/print/PrintSection";
import PrintItemsTable from "@/components/print/PrintItemsTable";
import PrintSignatures from "@/components/print/PrintSignatures";
import StatusBadge from "@/components/shared/StatusBadge";
import { getPrintSchema } from "@/components/print/schemas/printSchemas";

/** Đọc giá trị theo đường dẫn "warehouse.name", "totals.items", ... */
function getByPath(model, path) {
    if (!path) return model;
    return path.split(".").reduce(
        (value, key) => (value === null || value === undefined ? value : value[key]),
        model
    );
}

/**
 * Trường có modelPath bắt đầu bằng "company." đọc từ HỒ SƠ CÔNG TY dùng
 * chung (prop `company`), không phải từ dữ liệu phiếu — dùng cho các khối
 * như "Đơn vị bán". Giá trị rỗng -> null để khối hiển thị ẩn gọn.
 */
function resolveFieldValue(field, model, company) {
    const path = field.modelPath ?? "";
    if (path.startsWith("company.")) {
        const value = getByPath(company ?? {}, path.slice("company.".length));
        return value === "" || value === null || value === undefined ? null : value;
    }
    return getByPath(model, path);
}

/** Render giá trị một field theo `kind` khai báo trong schema. */
function renderFieldValue(field, model, company) {
    const value = resolveFieldValue(field, model, company);
    if (field.kind === "badge" && value && typeof value === "object") {
        return <StatusBadge label={value.label} tone={value.tone} />;
    }
    if (value === null || value === undefined || value === "") return "—";
    return value;
}

/**
 * Renderer CHUNG cho mọi loại chứng từ — cấu trúc phiếu hoàn toàn do schema
 * của loại chứng từ đó quyết định (section / field / cột), cấu hình mẫu chỉ
 * bật/tắt. Dùng chung cho: editor preview, xem trước mẫu, trang in thật và
 * bản in trình duyệt — field/cột bị tắt sẽ biến mất ở mọi nơi.
 *
 * K80: layout compact riêng (không co bảng A4), cột bảng dùng `compactColumns`
 * nếu schema khai báo.
 */
export default function PrintTemplateDocument({ documentType, config, model, company }) {
    const schema = getPrintSchema(documentType);
    if (!schema) return null;

    const compact = config.paperSize === "K80";

    return (
        <div>
            <PrintHeader
                compact={compact}
                title={schema.docTitle}
                branding={config.branding}
                company={company}
                accentColor={config.accentColor}
            />

            {schema.sections.map((section) => {
                const sectionConfig = config.sections[section.key] ?? {};

                if (section.type === "info") {
                    const fields = section.fields
                        .filter((field) => sectionConfig[field.key] !== false)
                        // Trường của hồ sơ công ty rỗng (email/ĐT/địa chỉ chưa
                        // điền) -> ẩn sạch, không để lại nhãn trống hay khoảng trống.
                        .filter(
                            (field) =>
                                !(field.modelPath ?? "").startsWith("company.") ||
                                resolveFieldValue(field, model, company) !== null
                        );
                    if (fields.length === 0) return null;
                    return (
                        <PrintSection
                            key={section.key}
                            compact={compact}
                            title={section.title}
                            accentColor={config.accentColor}
                        >
                            <PrintDocumentInfo
                                compact={compact}
                                columns={compact ? 1 : section.columns}
                                items={fields.map((field) => ({
                                    label: field.label,
                                    value: renderFieldValue(field, model, company),
                                    className: field.span
                                        ? compact
                                            ? undefined
                                            : `col-span-${field.span}`
                                        : undefined,
                                }))}
                            />
                        </PrintSection>
                    );
                }

                if (section.type === "items") {
                    if (sectionConfig.show === false) return null;

                    const availableColumns =
                        compact && section.compactColumns
                            ? section.compactColumns
                            : section.columns;
                    const visibleColumns = availableColumns.filter(
                        (column) => config.columns[column.key] !== false
                    );
                    const rows = getByPath(model, section.path) ?? [];
                    const totalValue =
                        section.total && sectionConfig.showTotal !== false
                            ? getByPath(model, section.total.modelPath)
                            : null;

                    const itemColumns = [
                        {
                            key: "stt",
                            label: compact ? "#" : "STT",
                            className: compact ? "w-5 text-center" : "w-10 text-center",
                            cellClassName: "text-center",
                            render: (row) => row._stt,
                        },
                        ...visibleColumns.map((column) => ({
                            key: column.key,
                            label: column.label,
                            className: ["quantity", "unitPrice", "amount", "discount", "tax"].includes(column.key)
                                ? "text-center"
                                : "",
                            cellClassName: cnColumnCell(column.key),
                            render: (row) => row[column.path] ?? "—",
                        })),
                    ];

                    const rowsWithIndex = rows.map((row, index) => ({
                        ...row,
                        _stt: index + 1,
                    }));

                    return (
                        <PrintSection
                            key={section.key}
                            compact={compact}
                            title={section.title}
                            accentColor={config.accentColor}
                        >
                            <PrintItemsTable
                                compact={compact}
                                columns={itemColumns}
                                rows={rowsWithIndex}
                                emptyMessage={compact ? "Không có dữ liệu" : "Không có dữ liệu"}
                                footer={
                                    totalValue !== null && rows.length > 0 ? (
                                        itemColumns.length > 1 ? (
                                            <tr>
                                                <td
                                                    colSpan={itemColumns.length - 1}
                                                    className={`border border-bo-border bg-bo-surface-subtle text-right font-semibold uppercase tracking-wide text-bo-muted ${compact ? "px-1 py-1 text-[8px]" : "px-2.5 py-2 text-[11px]"}`}
                                                >
                                                    {section.total.label}
                                                </td>
                                                <td
                                                    className={`border border-bo-border bg-bo-surface-subtle text-center font-bold text-bo-foreground ${compact ? "px-1 py-1 text-[10px]" : "px-2.5 py-2 text-[13px]"}`}
                                                >
                                                    {totalValue}
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <td
                                                    className={`border border-bo-border bg-bo-surface-subtle text-right font-semibold uppercase tracking-wide text-bo-muted ${compact ? "px-1 py-1 text-[8px]" : "px-2.5 py-2 text-[11px]"}`}
                                                >
                                                    {section.total.label}:{" "}
                                                    <span className="font-bold text-bo-foreground">
                                                        {totalValue}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    ) : null
                                }
                            />
                        </PrintSection>
                    );
                }

                if (section.type === "notes") {
                    if (sectionConfig.show === false) return null;
                    const notes = getByPath(model, section.path);
                    return (
                        <PrintSection
                            key={section.key}
                            compact={compact}
                            title={section.title}
                            accentColor={config.accentColor}
                        >
                            <p
                                className={`whitespace-pre-wrap leading-relaxed text-bo-foreground ${compact ? "text-[10px]" : "text-[13px]"}`}
                            >
                                {notes || "—"}
                            </p>
                        </PrintSection>
                    );
                }

                if (section.type === "signatures") {
                    const blocks = section.blocks
                        .filter((block) => sectionConfig[block.key] !== false)
                        .map((block) => {
                            const value = getByPath(model, block.path);
                            if (!value) return null;
                            return {
                                label: block.label,
                                name: value.name,
                                email: value.email,
                            };
                        })
                        .filter(Boolean);
                    if (blocks.length === 0) return null;
                    return (
                        <PrintSignatures
                            key={section.key}
                            compact={compact}
                            left={blocks[0] ?? null}
                            right={blocks[1] ?? null}
                        />
                    );
                }

                return null;
            })}
        </div>
    );
}

function cnColumnCell(key) {
    if (key === "productName") return "break-words font-medium";
    if (key === "sku" || key === "lot") return "font-mono";
    if (["quantity", "unitPrice", "amount", "discount", "tax"].includes(key)) {
        return "text-right";
    }
    return "text-center";
}
