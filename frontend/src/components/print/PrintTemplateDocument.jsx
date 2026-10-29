import PrintHeader from "@/components/print/PrintHeader";
import PrintDocumentInfo from "@/components/print/PrintDocumentInfo";
import PrintSection from "@/components/print/PrintSection";
import PrintItemsTable from "@/components/print/PrintItemsTable";
import PrintSummary from "@/components/print/PrintSummary";
import PrintSignatures from "@/components/print/PrintSignatures";
import PrintDocCode from "@/components/print/PrintDocCode";
import { toBarcodeText, toQrText } from "@/components/print/maVach";
import { dongKhoiTong, getByPath, isEmptyValue } from "@/components/print/khoiTongIn";
import {
    DEFAULT_FONT_SIZE,
    NOTES_LABEL_ITEM,
    getDocCodeMode,
    getDocTitle,
    getFontSize,
    getFooterNote,
    getLabel,
    getPrintSchema,
} from "@/components/print/schemas/printSchemas";
import { isThermalPaper } from "@/components/print/paperStyles";
import "@/components/print/printDocument.css";

/** Các khối cuối phiếu — gom lại để tổng tiền và ô ký không bị tách khỏi nhau khi sang trang. */
const CLOSING_TYPES = new Set(["summary", "notes", "signatures"]);

/**
 * Trường có modelPath bắt đầu bằng "company." đọc từ HỒ SƠ CỬA HÀNG dùng
 * chung (prop `company`), không phải từ dữ liệu phiếu.
 */
function resolveFieldValue(field, model, company) {
    const path = field.modelPath ?? "";
    if (path.startsWith("company.")) {
        const value = getByPath(company ?? {}, path.slice("company.".length));
        return isEmptyValue(value) ? null : value;
    }
    return getByPath(model, path);
}

/**
 * `kind: "badge"` (trạng thái, thanh toán): adapter trả { label } — trên GIẤY
 * in thành CHỮ THƯỜNG như mọi trường khác (badge là thành phần giao diện web).
 */
function renderFieldValue(field, model, company) {
    const value = resolveFieldValue(field, model, company);
    if (field.kind === "badge" && value && typeof value === "object") return value.label || "—";
    return isEmptyValue(value) ? "—" : value;
}

const isBlankCell = (value) => isEmptyValue(value) || value === "—";

/** "Từ" dài hơn mức này (nhãn tự đặt viết liền) thì cho ngắt giữa từ — nhãn gốc không có từ nào dài vậy. */
const LONG_WORD = /\S{16,}/;

/** Nhãn trong bảng / khối tổng: bọc `pdoc-break` khi có từ quá dài để bảng không tràn lề giấy. */
function breakable(label) {
    return typeof label === "string" && LONG_WORD.test(label) ? <span className="pdoc-break">{label}</span> : label;
}

/** Class căn lề theo loại cột. */
function columnClass(column) {
    if (column.kind === "qty" || column.kind === "money") return "pdoc-num";
    if (column.kind === "code") return "pdoc-code";
    if (column.key === "productName") return "pdoc-name";
    return undefined;
}

/**
 * Thuộc tính của một khối bấm được trên tờ giấy trong TRÌNH SỬA MẪU (bấm để mở đúng nhóm tùy chọn).
 * In thật / in thử không truyền `editable` nên DOM không có thuộc tính nào thêm.
 */
function makeBlockProps(editable) {
    if (!editable) return () => undefined;
    return (key, label) => ({
        "data-pdoc-khoi": key,
        "data-pdoc-nhan": label,
    });
}

function renderInfoSection(section, ctx) {
    const { config, model, company, compact } = ctx;
    const sectionConfig = config.sections[section.key] ?? {};
    const fields = section.fields
        .filter((field) => field.essential || sectionConfig[field.key] !== false)
        .filter((field) => !(field.compactOnly && !compact) && !(field.compactHidden && compact))
        // Ẩn sạch (không để lại nhãn trống) khi trường KHÔNG áp dụng cho phiếu
        // này: adapter trả null khi không áp dụng, "—" khi áp dụng mà thiếu dữ liệu.
        .filter(
            (field) =>
                !(
                    (field.hideWhenEmpty || (field.modelPath ?? "").startsWith("company.")) &&
                    isEmptyValue(resolveFieldValue(field, model, company))
                )
        );
    if (fields.length === 0) return null;
    return (
        <PrintSection
            key={section.key}
            title={section.title}
            keepTogether
            blockProps={ctx.blockProps(section.key, section.title)}
        >
            <PrintDocumentInfo
                columns={section.columns ?? 2}
                items={fields.map((field) => ({
                    key: field.key,
                    // Nhãn động theo dữ liệu (vd. "Nguồn hàng" -> "Nhà cung cấp" / "Kho chuyển đi") > nhãn tự đặt > nhãn gốc
                    label:
                        (field.labelModelPath && getByPath(model, field.labelModelPath)) ||
                        getLabel(config, section.key, field.key, field.label),
                    value: renderFieldValue(field, model, company),
                    wide: field.span === 2 && (section.columns ?? 2) > 1,
                }))}
            />
        </PrintSection>
    );
}

function renderLots(row, showLotNote) {
    const lots = row.lots ?? [];
    // Chưa có lô: hàng chưa lấy/chưa nhận thì để trống cho ghi tay, ngược lại "—"
    if (lots.length === 0) return isBlankCell(row.quantity) ? "" : "—";
    const many = lots.length > 1;
    // "LOT-260801 × 30" không bẻ giữa chừng; "· SX 01/08/2026" xuống dòng khi cột hẹp (A5)
    // thay vì đẩy bảng tràn khỏi lề giấy.
    return lots.map((lot, index) => (
        <span key={`${lot.code}-${index}`} className="pdoc-lot">
            <span className="pdoc-nobr">
                {lot.code}
                {many ? <span className="pdoc-lot-note"> × {lot.quantity}</span> : null}
            </span>
            {showLotNote && lot.note ? (
                <>
                    {" "}
                    <span className="pdoc-lot-note pdoc-nobr">· {lot.note}</span>
                </>
            ) : null}
        </span>
    ));
}

function renderItemsSection(section, ctx) {
    const { config, model, compact } = ctx;
    const sectionConfig = config.sections[section.key] ?? {};
    if (sectionConfig.show === false && !section.essentialShow) return null;

    const rows = getByPath(model, section.path) ?? [];
    const available = compact && section.compactColumns ? section.compactColumns : section.columns;
    const enabled = available.filter((column) => column.essential || config.columns[column.key] !== false);

    // Cột in ở dòng phụ dưới tên hàng (thuộc tính biến thể, đơn giá trên K80)
    const inlineColumns = enabled.filter((column) => column.inline);
    // Cột gắn vào cột khác (ngày sản xuất in sau mã lô)
    const attached = new Set(enabled.filter((column) => column.inlineIn).map((column) => column.key));
    const showLotNote = attached.has("productionDate");

    const tableColumns = enabled
        .filter((column) => !column.inline && !column.inlineIn)
        .filter(
            (column) =>
                !column.hideWhenAllEmpty || rows.some((row) => !isBlankCell(row[column.path]))
        );

    const itemColumns = [
        { key: "stt", label: compact ? "#" : "STT", className: "pdoc-stt", render: (row) => row._stt },
        ...tableColumns.map((column) => ({
            key: column.key,
            label: breakable(getLabel(config, section.key, column.key, column.label)),
            className: columnClass(column),
            render: (row) => {
                if (column.kind === "lots") return renderLots(row, showLotNote);
                const value = row[column.path];
                if (column.key !== "productName") return isEmptyValue(value) ? "" : value;
                const sub = inlineColumns
                    .filter((inline) => !isBlankCell(row[inline.path]))
                    // Đơn giá trên khổ nhiệt in kèm nhãn ("Đơn giá 120.000 ₫") để không lẫn với cột Thành tiền
                    .map((inline) =>
                        inline.inlineLabel
                            ? `${getLabel(config, section.key, inline.key, inline.label)} ${row[inline.path]}`
                            : row[inline.path]
                    )
                    .join(" · ");
                return (
                    <>
                        {value ?? "—"}
                        {sub ? <span className="pdoc-sub">{sub}</span> : null}
                    </>
                );
            },
        })),
    ];

    const rowsWithIndex = rows.map((row, index) => ({ ...row, _stt: index + 1 }));

    // Dòng tổng nằm ĐÚNG dưới các cột khai báo; nhãn gộp các cột bên trái
    // cột tổng đầu tiên. Cột tổng bị tắt thì bỏ ô đó.
    let footer = null;
    const totals = (section.totals ?? [])
        .map((total) => ({ ...total, index: itemColumns.findIndex((column) => column.key === total.column) }))
        .filter((total) => total.index > 0);
    if (totals.length > 0 && sectionConfig.showTotal !== false && rows.length > 0) {
        const first = Math.min(...totals.map((total) => total.index));
        const label = totals.find((total) => total.label)?.label ?? "Tổng cộng";
        const cells = [
            <td key="label" colSpan={first} className="pdoc-total-label">
                {label}
            </td>,
        ];
        for (let index = first; index < itemColumns.length; index += 1) {
            const total = totals.find((item) => item.index === index);
            cells.push(
                <td key={itemColumns[index].key} className={itemColumns[index].className}>
                    {total ? getByPath(model, total.modelPath) : null}
                </td>
            );
        }
        footer = <tr>{cells}</tr>;
    }

    return (
        <PrintSection
            key={section.key}
            title={compact ? null : section.title}
            blockProps={ctx.blockProps(section.key, section.title)}
        >
            <PrintItemsTable columns={itemColumns} rows={rowsWithIndex} footer={footer} />
        </PrintSection>
    );
}

function renderSummarySection(section, ctx) {
    const { config, model } = ctx;
    const sectionConfig = config.sections[section.key] ?? {};
    const rows = dongKhoiTong(section, config, model).map((row) => ({ ...row, label: breakable(row.label) }));
    const wordsValue = section.words && sectionConfig[section.words.key] !== false
        ? getByPath(model, section.words.modelPath)
        : null;
    if (rows.length === 0 && !wordsValue) return null;
    return (
        <PrintSummary
            key={section.key}
            rows={rows}
            words={
                wordsValue
                    ? { label: getLabel(config, section.key, section.words.key, section.words.label), value: wordsValue }
                    : null
            }
            blockProps={ctx.blockProps(section.key, section.title)}
        />
    );
}

function renderNotesSection(section, ctx) {
    const sectionConfig = ctx.config.sections[section.key] ?? {};
    if (sectionConfig.show === false) return null;
    const notes = getByPath(ctx.model, section.path);
    // Không có ghi chú thì không in khối trống "Ghi chú: —"
    if (isBlankCell(notes)) return null;
    return (
        <p key={section.key} className="pdoc-notes pdoc-keep" {...ctx.blockProps(section.key, section.title)}>
            <span className="pdoc-notes-label">{getLabel(ctx.config, section.key, NOTES_LABEL_ITEM, section.title)}:</span>{" "}
            <span className="pdoc-notes-text">{notes}</span>
        </p>
    );
}

function renderSignaturesSection(section, ctx) {
    const sectionConfig = ctx.config.sections[section.key] ?? {};
    const blocks = section.blocks
        .filter((block) => sectionConfig[block.key] !== false)
        .map((block) => {
            const value = getByPath(ctx.model, block.path);
            if (!value) return null;
            // value.label: nhãn theo dữ liệu (vd. "Người từ chối") > nhãn tự đặt > nhãn gốc;
            // value.name rỗng = ô ký TRỐNG để ký tay, ghi tên khi nhận
            return {
                key: block.key,
                label: value.label || getLabel(ctx.config, section.key, block.key, block.label),
                name: value.name,
            };
        })
        .filter(Boolean);
    if (blocks.length === 0) return null;
    return (
        <PrintSignatures key={section.key} blocks={blocks} blockProps={ctx.blockProps(section.key, section.title)} />
    );
}

const RENDERERS = {
    info: renderInfoSection,
    items: renderItemsSection,
    summary: renderSummarySection,
    notes: renderNotesSection,
    signatures: renderSignaturesSection,
};

/**
 * Có vẽ được mã của số phiếu không (chưa có số phiếu / số không còn ký tự nào mã hóa được -> không
 * chừa chỗ). Mã vạch quá dài cho khổ giấy thì PrintDocCode in QR thay, nên chỉ cần còn chữ.
 */
function hasDocCode(mode, number) {
    if (mode === "ma_vach") return Boolean(toBarcodeText(number));
    if (mode === "ma_qr") return Boolean(toQrText(number));
    return false;
}

/**
 * Renderer CHUNG cho mọi loại chứng từ — cấu trúc phiếu hoàn toàn do schema
 * của loại chứng từ đó quyết định (section / field / cột), cấu hình mẫu bật/tắt
 * và tùy chỉnh (tiêu đề, nhãn, cỡ chữ, mã số phiếu, lời chân). Dùng chung cho:
 * trình sửa mẫu, trang in thật và bản in trình duyệt — cùng DOM, cùng
 * printDocument.css nên các nơi luôn khớp.
 *
 * K80 / K57: bố cục khổ nhiệt riêng (không co bảng A4), cột bảng dùng `compactColumns`,
 * mã số phiếu in ở cuối hóa đơn. A5: cùng bố cục A4 với cỡ chữ / khoảng cách nhỏ hơn.
 *
 * `editable` (chỉ trình sửa mẫu): các khối thành vùng bấm được (data-pdoc-khoi) và hiện chỗ
 * của lời chân khi chưa có — bản in thật / in thử không bật nên không có gì thêm.
 */
export default function PrintTemplateDocument({ documentType, config, model, company, editable = false }) {
    const schema = getPrintSchema(documentType);
    if (!schema || !model || !config) return null;

    const compact = isThermalPaper(config.paperSize);
    // K57 dùng chung bố cục khổ nhiệt của K80 (class pdoc--k80) + cỡ chữ riêng (pdoc--k57)
    const variant = config.paperSize === "K57" ? "k80 pdoc--k57" : compact ? "k80" : config.paperSize === "A5" ? "a5" : "a4";
    const fontSize = getFontSize(config);
    const blockProps = makeBlockProps(editable);
    const ctx = { config: { ...config, sections: config.sections ?? {}, columns: config.columns ?? {} }, model, company, compact, blockProps };

    const body = [];
    const closing = [];
    let pendingHalf = null;
    const flushHalf = () => {
        if (!pendingHalf) return;
        body.push(
            <div key={`pair-${pendingHalf.key}`} className="pdoc-pair">
                {pendingHalf}
            </div>
        );
        pendingHalf = null;
    };

    for (const section of schema.sections) {
        if (compact && section.compactHidden) continue;
        const node = RENDERERS[section.type]?.(section, ctx) ?? null;
        if (!node) continue;
        if (CLOSING_TYPES.has(section.type)) {
            closing.push(node);
            continue;
        }
        // Hai khối "half" liền nhau đứng cạnh nhau (A4/A5); K80 xếp dọc
        if (section.half) {
            if (pendingHalf) {
                body.push(
                    <div key={`pair-${pendingHalf.key}`} className="pdoc-pair">
                        {pendingHalf}
                        {node}
                    </div>
                );
                pendingHalf = null;
            } else {
                pendingHalf = node;
            }
            continue;
        }
        flushHalf();
        body.push(node);
    }
    flushHalf();

    const footerNote = getFooterNote(schema, config);
    const docNoun = schema.docNoun ?? "phiếu";
    const codeMode = getDocCodeMode(config);
    const code = hasDocCode(codeMode, model.documentNumber) ? (
        <PrintDocCode mode={codeMode} value={model.documentNumber} paperSize={config.paperSize} />
    ) : null;
    const headerLabel = `Đầu ${docNoun}`;
    const footerLabel = `Chân ${docNoun}`;

    return (
        <div
            className={`pdoc pdoc--${variant}${fontSize !== DEFAULT_FONT_SIZE ? ` pdoc--co-${fontSize}` : ""}`}
            style={{ "--pdoc-accent": config.accentColor || undefined }}
        >
            {model.watermark ? (
                <div className="pdoc-watermark" aria-hidden="true">
                    <span>{model.watermark}</span>
                </div>
            ) : null}

            <PrintHeader
                title={getDocTitle(schema, config)}
                number={model.documentNumber}
                // Khổ nhiệt (hóa đơn tại quầy) in thêm giờ bán: "Ngày 16 tháng 09 năm 2026 lúc 14:42"
                date={
                    compact && model.documentDate && model.documentTime
                        ? `${model.documentDate} lúc ${model.documentTime}`
                        : model.documentDate
                }
                branding={config.branding}
                company={company}
                // Khổ tờ: mã ở góc phải đầu phiếu; khổ nhiệt: in ở cuối hóa đơn (bên dưới)
                code={compact ? null : code}
                blockProps={blockProps("dau", headerLabel)}
            />

            {body}

            <div className="pdoc-closing">
                {closing}
                {model.legalNote ? <p className="pdoc-legal">{model.legalNote}</p> : null}
                {compact && code ? (
                    // Bấm vào mã ở cuối hóa đơn mở nhóm "Đầu …" (nơi chọn kiểu mã số)
                    <div className="pdoc-docode-end" {...blockProps("dau", `Mã số ${docNoun}`)}>
                        {code}
                    </div>
                ) : null}
                {footerNote ? (
                    <p className="pdoc-footnote" {...blockProps("chan", footerLabel)}>
                        {footerNote}
                    </p>
                ) : editable ? (
                    <p className="pdoc-footnote pdoc-footnote--trong" {...blockProps("chan", footerLabel)}>
                        (Chưa có lời chân {docNoun} — chỉ hiện khi sửa, không in ra)
                    </p>
                ) : null}
            </div>
        </div>
    );
}
