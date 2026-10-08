import PrintHeader from "@/components/print/PrintHeader";
import PrintDocumentInfo from "@/components/print/PrintDocumentInfo";
import PrintSection from "@/components/print/PrintSection";
import PrintItemsTable from "@/components/print/PrintItemsTable";
import PrintSignatures from "@/components/print/PrintSignatures";
import { getPrintSchema } from "@/components/print/schemas/printSchemas";

/** Cột số (số lượng / tiền) — căn phải để thẳng hàng với dòng tổng. */
const NUMERIC_COLUMN_KEYS = new Set([
    "quantity",
    "requestedQuantity",
    "quantityReceived",
    "quantityIssued",
    "unitPrice",
    "amount",
    "discount",
    "tax",
]);

/**
 * Class col-span viết ĐẦY ĐỦ (không ghép chuỗi `col-span-${n}`) để Tailwind
 * quét thấy và sinh CSS — chuỗi ghép động sẽ không có class tương ứng.
 */
const SPAN_CLASSES = {
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
};

/** Giá trị "không áp dụng" do adapter trả về (null/undefined/chuỗi rỗng). */
const isEmptyValue = (value) => value === null || value === undefined || value === "";

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

/**
 * Render giá trị một field theo `kind` khai báo trong schema.
 * `kind: "badge"` (trạng thái, thanh toán): adapter trả { label, tone } —
 * trên GIẤY in thành CHỮ THƯỜNG như mọi trường khác (không khung/chấm/màu):
 * badge là thành phần giao diện web, in ra trông như ảnh chụp màn hình và
 * màu nhạt bị mờ trên máy in trắng đen. `tone` được bỏ qua ở bản in.
 */
function renderFieldValue(field, model, company) {
    const value = resolveFieldValue(field, model, company);
    if (field.kind === "badge" && value && typeof value === "object") {
        return value.label || "—";
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
    // A5 = nửa tờ A4: dùng bố cục gọn hơn (chữ/khoảng cách nhỏ hơn) để phiếu
    // ít dòng vừa một trang thay vì đẩy riêng khối ký sang trang 2
    const dense = config.paperSize === "A5";

    return (
        <div>
            <PrintHeader
                compact={compact}
                dense={dense}
                title={schema.docTitle}
                branding={config.branding}
                company={company}
                accentColor={config.accentColor}
            />

            {schema.sections.map((section) => {
                // Section không dùng trên khổ nhiệt (vd. "Đơn vị bán" trùng đầu phiếu)
                if (compact && section.compactHidden) return null;
                const sectionConfig = config.sections[section.key] ?? {};

                if (section.type === "info") {
                    const fields = section.fields
                        .filter((field) => sectionConfig[field.key] !== false)
                        // Ẩn sạch (không để lại nhãn trống) khi trường KHÔNG áp
                        // dụng cho phiếu này:
                        // - trường hồ sơ công ty chưa điền (email/ĐT/địa chỉ);
                        // - trường `hideWhenEmpty` mà adapter trả null — vd. "Kho
                        //   chuyển đến" chỉ có ở phiếu chuyển kho, "Lý do từ chối"
                        //   chỉ có ở phiếu bị từ chối. Adapter trả "—" khi trường
                        //   áp dụng nhưng thiếu dữ liệu, null khi không áp dụng.
                        .filter(
                            (field) =>
                                !(
                                    (field.hideWhenEmpty ||
                                        (field.modelPath ?? "").startsWith("company.")) &&
                                    isEmptyValue(resolveFieldValue(field, model, company))
                                )
                        );
                    if (fields.length === 0) return null;
                    return (
                        <PrintSection
                            key={section.key}
                            compact={compact}
                            dense={dense}
                            keepTogether
                            title={section.title}
                            accentColor={config.accentColor}
                        >
                            <PrintDocumentInfo
                                compact={compact}
                                dense={dense}
                                columns={compact ? 1 : section.columns}
                                items={fields.map((field) => ({
                                    // Nhãn động theo dữ liệu (vd. "Người duyệt" ->
                                    // "Người từ chối" khi phiếu bị từ chối)
                                    label:
                                        (field.labelModelPath &&
                                            getByPath(model, field.labelModelPath)) ||
                                        field.label,
                                    value: renderFieldValue(field, model, company),
                                    className:
                                        field.span && !compact
                                            ? SPAN_CLASSES[field.span]
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
                        (column) => column.essential || config.columns[column.key] !== false
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
                            className: NUMERIC_COLUMN_KEYS.has(column.key) ? "text-center" : "",
                            cellClassName: cnColumnCell(column.key),
                            render: (row) => row[column.path] ?? "—",
                        })),
                    ];

                    const rowsWithIndex = rows.map((row, index) => ({
                        ...row,
                        _stt: index + 1,
                    }));

                    // Dòng tổng nằm ĐÚNG dưới cột khai báo (total.column) — nhãn
                    // gộp các cột bên trái, các cột bên phải (nếu có) để trống.
                    // Không tìm thấy cột (cấu hình lạ) -> dưới cột cuối như cũ.
                    const totalIndexRaw = itemColumns.findIndex(
                        (column) => column.key === section.total?.column
                    );
                    const totalIndex = totalIndexRaw > 0 ? totalIndexRaw : itemColumns.length - 1;
                    const trailingColumns = itemColumns.length - 1 - totalIndex;
                    const cellPad = compact ? "px-1 py-1" : dense ? "px-1.5 py-1" : "px-2.5 py-2";
                    const footerCellClass = `border border-bo-border bg-bo-surface-subtle ${cellPad}`;
                    const totalLabelClass = `border border-bo-border bg-bo-surface-subtle text-right font-semibold uppercase tracking-wide text-bo-muted ${cellPad} ${compact ? "text-[8px]" : dense ? "text-[9px]" : "text-[11px]"}`;
                    const totalValueClass = `border border-bo-border bg-bo-surface-subtle text-right font-bold text-bo-foreground ${cellPad} ${compact ? "text-[10px]" : dense ? "text-xs" : "text-[13px]"}`;

                    return (
                        <PrintSection
                            key={section.key}
                            compact={compact}
                            dense={dense}
                            title={section.title}
                            accentColor={config.accentColor}
                        >
                            <PrintItemsTable
                                compact={compact}
                                dense={dense}
                                columns={itemColumns}
                                rows={rowsWithIndex}
                                emptyMessage={compact ? "Không có dữ liệu" : "Không có dữ liệu"}
                                footer={
                                    totalValue !== null && rows.length > 0 ? (
                                        itemColumns.length > 1 ? (
                                            <tr>
                                                <td
                                                    colSpan={totalIndex}
                                                    className={totalLabelClass}
                                                >
                                                    {section.total.label}
                                                </td>
                                                <td
                                                    className={totalValueClass}
                                                >
                                                    {totalValue}
                                                </td>
                                                {trailingColumns > 0 ? (
                                                    <td colSpan={trailingColumns} className={footerCellClass} />
                                                ) : null}
                                            </tr>
                                        ) : (
                                            <tr>
                                                <td
                                                    className={totalLabelClass}
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
                            dense={dense}
                            title={section.title}
                            accentColor={config.accentColor}
                        >
                            <p
                                className={`whitespace-pre-wrap leading-relaxed text-bo-foreground ${compact ? "text-[10px]" : dense ? "text-xs" : "text-[13px]"}`}
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
                                // value.label: nhãn theo dữ liệu (vd. "Người từ chối");
                                // value.name rỗng = ô ký TRỐNG để ký tay, ghi tên khi nhận
                                label: value.label || block.label,
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
                            dense={dense}
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
    if (NUMERIC_COLUMN_KEYS.has(key)) return "text-right";
    return "text-center";
}
