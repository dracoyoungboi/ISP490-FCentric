/**
 * DEPRECATED — gộp mẫu in cho danh sách thẻ (hiển thị non-destructive).
 *
 * Trang cấu hình mẫu in hiện tại KHÔNG còn dùng thẻ: preview nhúng ngay và
 * các biến thể khổ giấy (A4/A5/K80) được chọn qua paper selector trên URL.
 * Giữ file để tránh vỡ import cũ; nếu còn dùng, nhóm được định danh ỔN ĐỊNH
 * theo documentType (một nhóm = một loại chứng từ) — KHÔNG dùng màu nhấn /
 * branding / cột để định danh nhóm (sửa màu hoặc cột không được tạo thẻ
 * trùng tên), và không ép riêng loại nào (hóa đơn bán hàng cũng tuân theo
 * quy tắc chung).
 */

const PAPER_SIZES = ["A3", "A4", "A5", "A6", "K57", "K80", "LEGAL", "LETTER"];
const PAPER_SUFFIX_RE = new RegExp(
    `\\s*\\((?:${PAPER_SIZES.join("|")})\\)\\s*$`,
    "i"
);

/** Bỏ hậu tố khổ giấy ở tên hiển thị: "Mẫu FCentric mặc định (A5)" → "Mẫu FCentric mặc định". */
export function stripPaperSizeSuffix(name) {
    return String(name ?? "").replace(PAPER_SUFFIX_RE, "").trim();
}

/**
 * Dấu vân tay nhóm — ỔN ĐỊNH theo documentType. Không dùng accentColor /
 * branding / sections / columns vì chúng đổi khi người dùng chỉnh mẫu và sẽ
 * tách biến thể khổ giấy thành nhóm riêng (thẻ trùng tên).
 */
export function visualTemplateKey(template) {
    return String(template.documentType);
}

/**
 * Gộp danh sách mẫu thành các nhóm theo documentType (identity ổn định),
 * thứ tự theo biến thể đầu tiên xuất hiện (thứ tự registry). Mỗi nhóm:
 *   - key      : documentType (dùng làm React key của thẻ)
 *   - name     : tên hiển thị của biến thể đang hoạt động, bỏ hậu tố khổ giấy
 *   - primary  : biến thể mở khi bấm thẻ — mẫu đang hoạt động (isDefault)
 *                nếu có, ngược lại biến thể đầu tiên
 *   - variants : MỌI biến thể gốc (id + cấu hình giữ nguyên, không sửa đổi)
 *
 * Mọi biến thể khổ giấy của một loại chứng từ nằm trong MỘT nhóm — truy cập
 * qua paper selector, không bao giờ tách thẻ do khác màu/cột.
 */
export function groupPrintTemplates(templates) {
    const list = templates || [];
    const groups = new Map();
    for (const template of list) {
        const key = visualTemplateKey(template);
        let group = groups.get(key);
        if (!group) {
            group = { key, name: "", primary: template, variants: [] };
            groups.set(key, group);
        }
        group.variants.push(template);
        if (template.isDefault && !group.primary.isDefault) {
            group.primary = template;
        }
    }
    for (const group of groups.values()) {
        group.name = stripPaperSizeSuffix(group.primary.name);
    }
    return Array.from(groups.values());
}
