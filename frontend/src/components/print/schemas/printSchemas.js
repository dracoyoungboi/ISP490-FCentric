/**
 * Registry schema in theo loại chứng từ.
 *
 * Mỗi loại chứng từ có bộ section / field / cột bảng / khổ giấy RIÊNG —
 * editor và renderer đều đọc từ đây, nên không có cấu hình "global" dùng
 * chung cho mọi loại phiếu.
 *
 * Đầu phiếu (PrintHeader) luôn in: thông tin cửa hàng, TÊN chứng từ, "Số" và
 * "Ngày … tháng … năm …" lấy từ model (documentNumber, documentDate). Vì vậy
 * các section bên dưới KHÔNG lặp lại số phiếu / ngày lập / thông tin cửa hàng
 * (mỗi thông tin chỉ in một lần trên tờ giấy).
 *
 * Quy ước:
 * - key          : mã loại chứng từ (dùng làm khóa lưu trữ — KHÔNG đổi)
 * - slug         : dùng trong URL (/settings/print-templates/<slug>/...)
 * - templates    : các mẫu mặc định; khổ giấy nằm trong định danh mẫu
 *                  (vd: purchase_request_default_A4)
 * - description  : một dòng mô tả khi nào dùng chứng từ (trang danh sách mẫu in)
 * - footerNote   : lời chân phiếu mặc định (sửa được trong trình sửa, lưu ở
 *                  sections._tuyChinh.loiChanPhieu)
 * - footerExample: ví dụ lời chân gợi ý trong ô nhập của trình sửa (không in); không có thì
 *                  trình sửa dùng câu chung "… lập thành 2 bản"
 * - docNoun      : danh từ gọi chứng từ trong trình sửa ("hóa đơn"); mặc định "phiếu"
 * - sections     : thứ tự + cấu trúc hiển thị của phiếu
 *   - type "info"       : các dòng "Nhãn: giá trị"; columns = số cột (1|2);
 *                         half = đứng cạnh section half kế tiếp (A4/A5)
 *     field.hideWhenEmpty  = ẩn hẳn khi adapter trả null (không áp dụng cho phiếu đó)
 *     field.labelModelPath = nhãn động lấy từ model
 *     field.compactOnly    = chỉ in trên khổ nhiệt K80
 *     field.defaultOn=false= mặc định tắt (người dùng bật lại trong editor)
 *   - type "items"      : bảng hàng; columns = cột bật/tắt được
 *     column.essential = cột BẮT BUỘC (không tắt được)
 *     column.inline    = không thành cột riêng mà in ở dòng phụ dưới tên hàng
 *                        (màu, cỡ, chất liệu, đơn giá trên K80) — bảng ít cột, tên dài vẫn dễ đọc
 *     column.kind      = "qty" | "money" | "code" | "lots" (căn lề / định dạng)
 *     column.hideWhenAllEmpty = ẩn cột khi mọi dòng đều trống (vd. cột Lỗi)
 *     totals           = dòng tổng nằm đúng dưới các cột khai báo
 *     compactColumns   = bộ cột riêng cho khổ nhiệt K80 (không co bảng A4)
 *     defaultShow=false= bảng mặc định ẩn
 *   - type "summary"    : khối tổng tiền căn phải + dòng "Bằng chữ"
 *     row.emphasis = dòng tổng chính (in đậm); row.hideWhenZero = ẩn khi số gốc (rawPath) bằng 0;
 *     row.hideWhenSameAs = ẩn khi bằng đúng giá trị ở đường dẫn khác (tránh in hai dòng cùng số)
 *   - type "notes"      : "Ghi chú: …" — không có nội dung thì không in
 *   - type "signatures" : các ô ký (2–4 ô một hàng); model trả { label?, name } —
 *                         name rỗng = ô ký TRỐNG để ký tay và ghi rõ họ tên
 *   - compactHidden     : section/field KHÔNG dùng trên khổ nhiệt K80
 * - template.defaults   : cấu hình mặc định riêng của một mẫu (vd. K80 gọn cho quầy)
 */

/** Ba cột thuộc tính biến thể — in ở dòng phụ dưới tên sản phẩm. */
const VARIANT_INLINE_COLUMNS = [
    { key: "color", label: "Màu sắc", path: "color", inline: true },
    { key: "size", label: "Kích cỡ", path: "size", inline: true },
    { key: "material", label: "Chất liệu", path: "material", inline: true },
];

/** Hai mẫu khổ tờ A4 / A5 dùng chung cho các chứng từ không có khổ nhiệt. */
const sheetTemplates = (key) => [
    {
        id: `${key}_default_A4`,
        name: "Mẫu FCentric mặc định",
        paperSize: "A4",
        orientation: "portrait",
        margin: "default",
        isDefault: true,
    },
    {
        id: `${key}_default_A5`,
        name: "Mẫu FCentric mặc định (A5)",
        paperSize: "A5",
        orientation: "portrait",
        margin: "default",
        isDefault: false,
    },
];

/**
 * Mẫu khổ nhiệt cho hóa đơn tại quầy: K80 (mặc định) và K57. Chỉ giữ thông tin cần thiết cho
 * khách mua mang về — người dùng vẫn bật lại được trong editor.
 */
const thermalInvoiceTemplates = (key) =>
    ["K80", "K57"].map((paperSize, index) => ({
        id: `${key}_default_${paperSize}`,
        name: `Mẫu FCentric nhiệt ${paperSize}`,
        paperSize,
        orientation: "portrait",
        margin: "default",
        isDefault: index === 0,
        defaults: {
            sections: {
                buyer: { taxCode: false, contact: false, address: false, deliveryAddress: false },
                items: { showTotal: false },
                totals: { amountInWords: false },
                signatures: { creator: false, buyer: false },
            },
        },
    }));

/**
 * Bố cục hóa đơn bán hàng — dùng chung cho mẫu in từ đơn bán (A4/A5) và mẫu tại quầy (K80/K57):
 * cùng một chứng từ, cùng adapter, chỉ khác khổ giấy và trường bật sẵn.
 */
const SALES_INVOICE_SECTIONS = [
    {
        key: "buyer",
        type: "info",
        title: "Người mua",
        columns: 1,
        half: true,
        fields: [
            { key: "name", label: "Khách hàng", modelPath: "buyer.name" },
            { key: "code", label: "Mã khách hàng", modelPath: "buyer.code", hideWhenEmpty: true, defaultOn: false },
            {
                key: "taxCode",
                label: "Mã số thuế",
                modelPath: "buyer.taxCode",
                hideWhenEmpty: true,
                hint: "Chỉ in khi khách hàng có mã số thuế",
            },
            { key: "contact", label: "Người liên hệ", modelPath: "buyer.contact", hideWhenEmpty: true },
            { key: "phone", label: "Điện thoại", modelPath: "buyer.phone", hideWhenEmpty: true },
            { key: "address", label: "Địa chỉ", modelPath: "buyer.address", hideWhenEmpty: true },
            {
                key: "deliveryAddress",
                label: "Địa chỉ giao hàng",
                modelPath: "buyer.deliveryAddress",
                hideWhenEmpty: true,
                hint: "Chỉ in khi đơn có địa chỉ giao hàng",
            },
        ],
    },
    {
        key: "invoiceInfo",
        type: "info",
        title: "Thông tin hóa đơn",
        columns: 1,
        half: true,
        fields: [
            { key: "channel", label: "Kênh bán", modelPath: "channel", hideWhenEmpty: true },
            { key: "warehouse", label: "Xuất từ kho", modelPath: "warehouse", hideWhenEmpty: true, defaultOn: false },
            // Khổ nhiệt không in ô ký nên in tên nhân viên ở đây; khổ tờ đã có ô ký
            { key: "cashier", label: "Nhân viên", modelPath: "creator.name", compactOnly: true },
            // "Đã thanh toán · Tiền mặt": tình trạng và hình thức (bán tại quầy) trên một dòng
            { key: "paymentStatus", label: "Thanh toán", modelPath: "paymentStatus", kind: "badge" },
            { key: "status", label: "Trạng thái đơn", modelPath: "status", kind: "badge", defaultOn: false },
        ],
    },
    {
        key: "items",
        type: "items",
        essentialShow: true,
        title: "Danh sách sản phẩm",
        path: "items",
        totals: [{ label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" }],
        columns: [
            { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
            { key: "sku", label: "Mã SKU", path: "sku", kind: "code" },
            { key: "unit", label: "ĐVT", path: "unit", hideWhenAllEmpty: true },
            { key: "quantity", label: "Số lượng", path: "quantity", essential: true, kind: "qty" },
            { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true, kind: "money" },
            { key: "amount", label: "Thành tiền", path: "amount", essential: true, kind: "money" },
            // Ghi chú riêng của dòng hàng: in dòng phụ dưới tên, dòng không có thì không in
            { key: "lineNote", label: "Ghi chú dòng hàng", path: "note", inline: true },
        ],
        // Khổ nhiệt (K80 / K57) — KHÔNG co bảng A4 lại: 3 cột, đơn giá in dòng phụ dưới tên
        compactColumns: [
            { key: "productName", label: "Tên hàng", path: "name", essential: true },
            { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true, inline: true },
            { key: "quantity", label: "SL", path: "quantity", essential: true, kind: "qty" },
            { key: "amount", label: "Thành tiền", path: "amount", essential: true, kind: "money" },
        ],
    },
    {
        key: "totals",
        type: "summary",
        title: "Tổng cộng",
        rows: [
            // Không có phí nào cộng thêm thì "Tổng tiền hàng" trùng "Tổng thanh toán" — chỉ in một dòng
            { key: "items", label: "Tổng tiền hàng", modelPath: "totals.items", hideWhenSameAs: "totals.grandTotal" },
            { key: "shipping", label: "Phí vận chuyển", modelPath: "totals.shipping", rawPath: "totals.shippingRaw", hideWhenZero: true },
            { key: "grandTotal", label: "Tổng thanh toán", modelPath: "totals.grandTotal", emphasis: true, essential: true },
            // Bán tại quầy trả tiền mặt (sổ thu POS); đơn khác không có dữ liệu nên tự ẩn
            {
                key: "cashReceived",
                label: "Tiền khách đưa",
                modelPath: "payment.received",
                hint: "Chỉ in khi bán tại quầy, khách trả tiền mặt",
            },
            {
                key: "change",
                label: "Tiền thừa trả khách",
                modelPath: "payment.change",
                rawPath: "payment.changeRaw",
                hideWhenZero: true,
                hint: "Chỉ in khi khách trả tiền mặt và có tiền thừa",
            },
        ],
        words: { key: "amountInWords", label: "Bằng chữ", modelPath: "amountInWords" },
    },
    { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
    {
        key: "signatures",
        type: "signatures",
        title: "Chữ ký",
        blocks: [
            {
                key: "buyer",
                label: "Người mua hàng",
                path: "signatures.buyer",
                hint: "Ô trống — người mua ký và ghi rõ họ tên",
            },
            { key: "creator", label: "Người bán hàng", path: "signatures.creator" },
        ],
    },
];

export const PRINT_SCHEMAS = {
    purchase_request: {
        key: "purchase_request",
        slug: "purchase-request",
        description: "In khi gửi duyệt nhu cầu nhập hàng",
        label: "Yêu cầu nhập hàng",
        docTitle: "PHIẾU YÊU CẦU NHẬP HÀNG",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: sheetTemplates("purchase_request"),
        footerNote: "",
        sections: [
            {
                key: "requestInfo",
                type: "info",
                title: "Thông tin yêu cầu",
                columns: 2,
                fields: [
                    { key: "expectedDate", label: "Ngày giao dự kiến", modelPath: "expectedDate" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                    {
                        key: "rejectionReason",
                        label: "Lý do từ chối",
                        modelPath: "rejectionReason",
                        hideWhenEmpty: true,
                        hint: "Chỉ in khi yêu cầu bị từ chối",
                        span: 2,
                    },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Kho nhận hàng",
                columns: 2,
                fields: [
                    { key: "name", label: "Tên kho", modelPath: "warehouse.name" },
                    { key: "code", label: "Mã kho", modelPath: "warehouse.code" },
                    { key: "manager", label: "Quản lý kho", modelPath: "warehouse.manager" },
                    { key: "address", label: "Địa chỉ", modelPath: "warehouse.address", span: 2, hideWhenEmpty: true },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                totals: [{ label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" }],
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    ...VARIANT_INLINE_COLUMNS,
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true, kind: "code" },
                    { key: "quantity", label: "SL yêu cầu", path: "quantity", essential: true, kind: "qty" },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Người lập", path: "signatures.creator" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                ],
            },
        ],
    },

    quotation_request: {
        key: "quotation_request",
        slug: "quotation-request",
        description: "Gửi nhà cung cấp để xin báo giá",
        label: "Yêu cầu báo giá",
        docTitle: "PHIẾU YÊU CẦU BÁO GIÁ",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: sheetTemplates("quotation_request"),
        footerNote: "",
        sections: [
            {
                key: "requestInfo",
                type: "info",
                title: "Thông tin yêu cầu",
                columns: 2,
                fields: [
                    // key "deadline" giữ nguyên để cấu hình đã lưu không bị mất;
                    // dữ liệu là ngày giao dự kiến, không phải hạn gửi báo giá
                    { key: "deadline", label: "Ngày giao dự kiến", modelPath: "expectedDate" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge", defaultOn: false },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Địa điểm giao hàng",
                columns: 2,
                fields: [
                    { key: "name", label: "Kho nhận", modelPath: "warehouse.name" },
                    { key: "manager", label: "Người liên hệ", modelPath: "warehouse.manager" },
                    { key: "address", label: "Địa chỉ", modelPath: "warehouse.address", span: 2, hideWhenEmpty: true },
                ],
            },
            {
                key: "suppliers",
                type: "items",
                title: "Nhà cung cấp được mời",
                path: "suppliers",
                // Phiếu gửi cho nhà cung cấp KHÔNG được lộ danh sách đối thủ cùng
                // được mời — chỉ bật khi in lưu nội bộ.
                defaultShow: false,
                hint: "Chỉ bật khi in lưu nội bộ — không gửi danh sách này cho nhà cung cấp",
                columns: [
                    { key: "supplierName", label: "Nhà cung cấp", path: "name", essential: true },
                    { key: "supplierEmail", label: "Email", path: "email" },
                    { key: "supplierPhone", label: "Số điện thoại", path: "phone", kind: "code" },
                    { key: "supplierSent", label: "Trạng thái gửi", path: "sentStatus" },
                ],
            },
            {
                key: "products",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm cần báo giá",
                path: "products",
                totals: [{ label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" }],
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    ...VARIANT_INLINE_COLUMNS,
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true, kind: "code" },
                    { key: "quantity", label: "Số lượng", path: "quantity", essential: true, kind: "qty" },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Người lập", path: "signatures.creator" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                ],
            },
        ],
    },

    purchase_order: {
        key: "purchase_order",
        slug: "purchase-order",
        description: "Gửi nhà cung cấp, có ô nhà cung cấp xác nhận",
        label: "Đơn mua hàng",
        docTitle: "ĐƠN MUA HÀNG",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: sheetTemplates("purchase_order"),
        footerNote: "",
        sections: [
            {
                key: "supplier",
                type: "info",
                title: "Nhà cung cấp",
                columns: 1,
                half: true,
                fields: [
                    { key: "name", label: "Tên", modelPath: "supplier.name", essential: true },
                    { key: "code", label: "Mã", modelPath: "supplier.code" },
                    { key: "contact", label: "Người liên hệ", modelPath: "supplier.contact", hideWhenEmpty: true },
                    { key: "phone", label: "Điện thoại", modelPath: "supplier.phone", hideWhenEmpty: true },
                    { key: "email", label: "Email", modelPath: "supplier.email", hideWhenEmpty: true },
                    { key: "address", label: "Địa chỉ", modelPath: "supplier.address", hideWhenEmpty: true },
                ],
            },
            {
                key: "orderInfo",
                type: "info",
                title: "Giao hàng",
                columns: 1,
                half: true,
                fields: [
                    { key: "deliveryWarehouse", label: "Kho nhận", modelPath: "deliverTo.warehouse" },
                    { key: "deliveryAddress", label: "Địa chỉ", modelPath: "deliverTo.address", hideWhenEmpty: true },
                    { key: "expectedDate", label: "Ngày giao dự kiến", modelPath: "expectedDate" },
                    {
                        key: "purchaseRequest",
                        label: "Theo yêu cầu số",
                        modelPath: "purchaseRequest",
                        hideWhenEmpty: true,
                    },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge", defaultOn: false },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                totals: [{ label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" }],
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    ...VARIANT_INLINE_COLUMNS,
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true, kind: "code" },
                    { key: "quantity", label: "Số lượng", path: "quantity", essential: true, kind: "qty" },
                    { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true, kind: "money" },
                    { key: "amount", label: "Thành tiền", path: "amount", essential: true, kind: "money" },
                ],
            },
            {
                key: "totals",
                type: "summary",
                title: "Tổng cộng",
                rows: [
                    { key: "total", label: "Tổng giá trị đơn hàng", modelPath: "totals.total", emphasis: true, essential: true },
                ],
                words: { key: "amountInWords", label: "Bằng chữ", modelPath: "amountInWords" },
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Người lập", path: "signatures.creator" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                    {
                        key: "supplier",
                        label: "Nhà cung cấp xác nhận",
                        path: "signatures.supplier",
                        hint: "Ô trống — đại diện nhà cung cấp ký và ghi rõ họ tên",
                    },
                ],
            },
        ],
    },

    goods_receipt: {
        key: "goods_receipt",
        slug: "goods-receipt",
        description: "In khi nhận hàng vào kho",
        label: "Phiếu nhập kho",
        docTitle: "PHIẾU NHẬP KHO",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: sheetTemplates("goods_receipt"),
        footerNote: "",
        footerExample: "Ví dụ: Hàng nhận đủ, đúng chủng loại. Phiếu lập thành 2 bản.",
        sections: [
            {
                key: "receiptInfo",
                type: "info",
                title: "Thông tin nhập kho",
                columns: 2,
                fields: [
                    { key: "receiptType", label: "Lý do nhập", modelPath: "receiptType" },
                    {
                        key: "purchaseOrder",
                        label: "Theo đơn mua hàng",
                        modelPath: "purchaseOrder",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu nhập từ đơn mua hàng",
                    },
                    // Nhãn đổi theo nguồn: "Nhà cung cấp" hoặc "Kho chuyển đi"
                    { key: "partner", label: "Nguồn hàng", modelPath: "partner", labelModelPath: "partnerLabel", hideWhenEmpty: true },
                    { key: "warehouse", label: "Nhập tại kho", modelPath: "warehouse.name" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách hàng nhập",
                path: "items",
                totals: [
                    { label: "Tổng cộng", modelPath: "totalRequested", column: "requestedQuantity" },
                    { modelPath: "totalQuantity", column: "quantityReceived" },
                    { modelPath: "totalDefect", column: "defectQuantity" },
                ],
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true, kind: "code" },
                    { key: "lot", label: "Lô", path: "lots", kind: "lots" },
                    // Ngày sản xuất in ngay sau mã lô (không tách cột để các lô thẳng hàng)
                    { key: "productionDate", label: "Ngày sản xuất (sau mã lô)", path: "productionDate", inlineIn: "lot" },
                    { key: "requestedQuantity", label: "SL theo chứng từ", path: "requestedQuantity", kind: "qty" },
                    { key: "quantityReceived", label: "Thực nhập", path: "quantity", essential: true, kind: "qty" },
                    {
                        key: "defectQuantity",
                        label: "Lỗi",
                        path: "defectQuantity",
                        kind: "qty",
                        hideWhenAllEmpty: true,
                    },
                ],
            },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    {
                        key: "deliverer",
                        label: "Người giao hàng",
                        path: "signatures.deliverer",
                        hint: "Ô trống — người giao hàng ký và ghi rõ họ tên",
                    },
                    // key "receiver" giữ nguyên để cấu hình đã lưu không bị mất
                    { key: "receiver", label: "Người nhập kho", path: "signatures.receiver" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                    {
                        key: "accountant",
                        label: "Kế toán",
                        path: "signatures.accountant",
                        defaultOn: false,
                        hint: "Ô trống — bật khi phiếu chuyển kế toán ký",
                    },
                ],
            },
        ],
    },

    goods_issue: {
        key: "goods_issue",
        slug: "goods-issue",
        description: "In khi xuất bán hoặc chuyển kho",
        label: "Phiếu xuất kho",
        docTitle: "PHIẾU XUẤT KHO",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: sheetTemplates("goods_issue"),
        footerNote: "",
        footerExample: "Ví dụ: Hàng xuất đủ, đúng chủng loại. Phiếu lập thành 2 bản.",
        sections: [
            {
                key: "issueInfo",
                type: "info",
                title: "Thông tin xuất kho",
                columns: 2,
                fields: [
                    { key: "issueType", label: "Lý do xuất", modelPath: "issueType" },
                    {
                        key: "salesOrder",
                        label: "Theo đơn bán hàng",
                        modelPath: "salesOrder",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu xuất bán hàng",
                    },
                    {
                        key: "transferRef",
                        label: "Theo phiếu chuyển kho",
                        modelPath: "transferRef",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu chuyển kho",
                    },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Xuất từ",
                columns: 1,
                half: true,
                fields: [
                    { key: "name", label: "Kho xuất", modelPath: "warehouse.name" },
                    { key: "code", label: "Mã kho", modelPath: "warehouse.code" },
                    { key: "address", label: "Địa chỉ", modelPath: "warehouse.address", hideWhenEmpty: true },
                ],
            },
            {
                key: "recipient",
                type: "info",
                title: "Giao đến",
                columns: 1,
                half: true,
                fields: [
                    // key "destination" giữ như cấu hình cũ (trước nằm ở mục Kho xuất)
                    {
                        key: "destination",
                        label: "Kho nhận",
                        modelPath: "recipient.warehouse",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu chuyển kho",
                    },
                    {
                        key: "customer",
                        label: "Khách hàng",
                        modelPath: "recipient.customer",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu xuất bán hàng",
                    },
                    { key: "phone", label: "Điện thoại", modelPath: "recipient.phone", hideWhenEmpty: true },
                    { key: "address", label: "Địa chỉ", modelPath: "recipient.address", hideWhenEmpty: true },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách hàng xuất",
                path: "items",
                totals: [
                    { label: "Tổng cộng", modelPath: "totalRequested", column: "requestedQuantity" },
                    { modelPath: "totalQuantity", column: "quantityIssued" },
                ],
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true, kind: "code" },
                    { key: "lot", label: "Lô", path: "lots", kind: "lots" },
                    { key: "requestedQuantity", label: "SL yêu cầu", path: "requestedQuantity", kind: "qty" },
                    { key: "quantityIssued", label: "Thực xuất", path: "quantity", essential: true, kind: "qty" },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "issuer", label: "Người xuất kho", path: "signatures.issuer" },
                    {
                        key: "receiver",
                        label: "Người nhận hàng",
                        path: "signatures.receiver",
                        hint: "Ô trống — người nhận hàng ký và ghi rõ họ tên",
                    },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                    {
                        key: "accountant",
                        label: "Kế toán",
                        path: "signatures.accountant",
                        defaultOn: false,
                        hint: "Ô trống — bật khi phiếu chuyển kế toán ký",
                    },
                ],
            },
        ],
    },

    sales_quotation: {
        key: "sales_quotation",
        slug: "sales-quotation",
        description: "Gửi khách hàng trước khi chốt đơn",
        label: "Báo giá bán",
        docTitle: "BẢNG BÁO GIÁ",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: sheetTemplates("sales_quotation"),
        footerNote: "",
        sections: [
            {
                key: "customer",
                type: "info",
                title: "Kính gửi",
                columns: 1,
                half: true,
                fields: [
                    { key: "name", label: "Khách hàng", modelPath: "buyer.name", essential: true },
                    { key: "code", label: "Mã khách hàng", modelPath: "buyer.code", hideWhenEmpty: true },
                    { key: "contact", label: "Người liên hệ", modelPath: "buyer.contact", hideWhenEmpty: true },
                    { key: "phone", label: "Điện thoại", modelPath: "buyer.phone", hideWhenEmpty: true },
                    { key: "address", label: "Địa chỉ", modelPath: "buyer.address", hideWhenEmpty: true },
                    {
                        key: "deliveryAddress",
                        label: "Địa chỉ giao hàng",
                        modelPath: "buyer.deliveryAddress",
                        hideWhenEmpty: true,
                        hint: "Chỉ in khi báo giá có địa chỉ giao hàng",
                    },
                ],
            },
            {
                key: "quoteInfo",
                type: "info",
                title: "Người báo giá",
                columns: 1,
                half: true,
                fields: [
                    // Họ tên người báo giá in ở ô ký — ở đây chỉ in cách liên hệ
                    { key: "contactPhone", label: "Điện thoại", modelPath: "creator.phone", hideWhenEmpty: true },
                    { key: "contactEmail", label: "Email", modelPath: "creator.email", hideWhenEmpty: true },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge", defaultOn: false },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                totals: [{ label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" }],
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", kind: "code" },
                    { key: "quantity", label: "Số lượng", path: "quantity", essential: true, kind: "qty" },
                    { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true, kind: "money" },
                    { key: "amount", label: "Thành tiền", path: "amount", essential: true, kind: "money" },
                ],
            },
            {
                key: "totals",
                type: "summary",
                title: "Tổng cộng",
                rows: [
                    // Không có phí nào cộng thêm thì "Tổng tiền hàng" trùng "Tổng cộng" — chỉ in một dòng
                    { key: "items", label: "Tổng tiền hàng", modelPath: "totals.items", hideWhenSameAs: "totals.grandTotal" },
                    { key: "shipping", label: "Phí vận chuyển", modelPath: "totals.shipping", rawPath: "totals.shippingRaw", hideWhenZero: true },
                    { key: "grandTotal", label: "Tổng cộng", modelPath: "totals.grandTotal", emphasis: true, essential: true },
                ],
                words: { key: "amountInWords", label: "Bằng chữ", modelPath: "amountInWords" },
            },
            { key: "notes", type: "notes", title: "Điều khoản & ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    {
                        key: "buyer",
                        label: "Khách hàng xác nhận",
                        path: "signatures.buyer",
                        hint: "Ô trống — khách hàng ký và ghi rõ họ tên",
                    },
                    { key: "creator", label: "Người báo giá", path: "signatures.creator" },
                ],
            },
        ],
    },

    sales_invoice: {
        key: "sales_invoice",
        slug: "sales-invoice",
        description: "In từ trang chi tiết đơn bán hàng",
        // Hóa đơn bán hàng của FCentric = chứng từ của đơn bán (don_ban_hang, loai_chung_tu
        // "don_ban_hang"); số hóa đơn là số đơn hàng (SO…). Mẫu này in từ trang đơn bán (khổ tờ);
        // in tại quầy dùng mẫu "pos_invoice" (khổ nhiệt) để hai nơi không phải dùng chung một khổ.
        // Bản in này chưa phải hóa đơn điện tử theo NĐ 254/2026/NĐ-CP nên KHÔNG in mẫu số, ký hiệu,
        // mã của cơ quan thuế; lời chân mặc định chỉ cách khách lấy hóa đơn điện tử (sửa/xóa được).
        label: "Hóa đơn bán hàng",
        docTitle: "HÓA ĐƠN BÁN HÀNG",
        docNoun: "hóa đơn",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        footerNote: "Cảm ơn quý khách đã mua hàng. Quý khách cần hóa đơn điện tử vui lòng liên hệ cửa hàng.",
        footerExample: "Ví dụ: Cảm ơn quý khách đã mua hàng.",
        templates: sheetTemplates("sales_invoice"),
        sections: SALES_INVOICE_SECTIONS,
    },

    pos_invoice: {
        key: "pos_invoice",
        slug: "pos-invoice",
        description: "In ở máy in nhiệt khi thanh toán tại quầy",
        // Cùng chứng từ, cùng dữ liệu với "sales_invoice" (đơn bán tại quầy), in ở máy in nhiệt khi
        // thu ngân bấm "In hóa đơn" trên màn bán tại quầy. Mẫu riêng để chọn khổ K80 / K57 cho quầy
        // mà hóa đơn in từ trang đơn bán vẫn giữ A4 / A5.
        label: "Hóa đơn bán hàng tại quầy",
        docTitle: "HÓA ĐƠN BÁN HÀNG",
        docNoun: "hóa đơn",
        hasRealPrintRoute: true,
        paperProfiles: ["K80", "K57"],
        footerNote: "Cảm ơn quý khách và hẹn gặp lại! Quý khách cần hóa đơn điện tử vui lòng báo nhân viên cửa hàng.",
        footerExample: "Ví dụ: Cảm ơn quý khách và hẹn gặp lại!",
        templates: thermalInvoiceTemplates("pos_invoice"),
        sections: SALES_INVOICE_SECTIONS,
    },
};

/** Tra cứu schema theo key — chấp nhận cả dạng slug có dấu gạch ngang. */
export function getPrintSchema(documentType) {
    if (!documentType) return null;
    if (PRINT_SCHEMAS[documentType]) return PRINT_SCHEMAS[documentType];
    return PRINT_SCHEMAS[documentType.replace(/-/g, "_")] ?? null;
}

/** Danh sách loại chứng từ theo thứ tự khai báo (dùng cho trang danh sách). */
export const PRINT_DOCUMENT_TYPES = Object.values(PRINT_SCHEMAS);

/**
 * Nhóm loại chứng từ theo luồng việc (trang danh sách mẫu in, ô chọn loại chứng từ của trình sửa).
 * Loại chứng từ mới chưa xếp nhóm thì vào nhóm "Khác".
 */
export const PRINT_DOCUMENT_GROUPS = (() => {
    const groups = [
        { key: "mua-hang", label: "Mua hàng", types: ["purchase_request", "quotation_request", "purchase_order"] },
        { key: "kho", label: "Kho", types: ["goods_receipt", "goods_issue"] },
        { key: "ban-hang", label: "Bán hàng", types: ["sales_quotation", "sales_invoice", "pos_invoice"] },
    ];
    const grouped = new Set(groups.flatMap((group) => group.types));
    const others = PRINT_DOCUMENT_TYPES.map((schema) => schema.key).filter((key) => !grouped.has(key));
    return [
        ...groups.map((group) => ({ ...group, schemas: group.types.map((key) => PRINT_SCHEMAS[key]).filter(Boolean) })),
        ...(others.length ? [{ key: "khac", label: "Khác", types: others, schemas: others.map((key) => PRINT_SCHEMAS[key]) }] : []),
    ].filter((group) => group.schemas.length > 0);
})();

/** Khóa phụ trong `sections` lưu tùy chỉnh không thuộc section nào (lời chân phiếu…). */
export const CUSTOM_SECTION_KEY = "_tuyChinh";

/**
 * Lời chân phiếu như người dùng đã nhập (giữ nguyên khoảng trắng — dùng cho ô
 * sửa trong editor): đã lưu (kể cả chuỗi rỗng = không in) hoặc mặc định của loại chứng từ.
 */
export function getFooterNoteDraft(schema, config) {
    const saved = config?.sections?.[CUSTOM_SECTION_KEY]?.loiChanPhieu;
    return typeof saved === "string" ? saved : schema?.footerNote ?? "";
}

/** Lời chân phiếu để in (đã cắt khoảng trắng; rỗng = không in). */
export function getFooterNote(schema, config) {
    return getFooterNoteDraft(schema, config).trim();
}

export const FOOTER_NOTE_MAX_LENGTH = 300;

/** Độ dài tối đa của tên chứng từ tự đặt (sections._tuyChinh.tieuDe) — khớp CauHinhMauInService. */
export const TITLE_MAX_LENGTH = 100;

/** Độ dài tối đa của một nhãn tự đặt (trường, cột, dòng tổng, ô ký) — khớp CauHinhMauInService. */
export const LABEL_MAX_LENGTH = 60;

/** Cỡ chữ của tờ in: Nhỏ / Vừa / Lớn nhân lên cỡ chữ chuẩn của khổ giấy (printDocument.css). */
export const FONT_SIZE_OPTIONS = [
    { value: "nho", label: "Nhỏ" },
    { value: "vua", label: "Vừa" },
    { value: "lon", label: "Lớn" },
];
export const DEFAULT_FONT_SIZE = "vua";

/** Mã của số phiếu in kèm: không in / mã vạch Code 128 / mã QR — máy quét đọc ra đúng số phiếu. */
export const DOC_CODE_OPTIONS = [
    { value: "khong", label: "Không" },
    { value: "ma_vach", label: "Mã vạch" },
    { value: "ma_qr", label: "Mã QR" },
];
export const DEFAULT_DOC_CODE = "khong";

/** Mục "nhãn" của khối ghi chú (khối này không có mục con): khóa nhãn là "<section>.tieuDe". */
export const NOTES_LABEL_ITEM = "tieuDe";

/** Khóa nhãn tự đặt của một mục: "<khóa section>.<khóa mục>" (vd. "items.sku", "signatures.approver"). */
export const labelKey = (sectionKey, itemKey) => `${sectionKey}.${itemKey}`;

/** Các tùy chỉnh không thuộc section nào (sections._tuyChinh) — luôn trả object. */
export function getCustomOptions(config) {
    const custom = config?.sections?.[CUSTOM_SECTION_KEY];
    return custom && typeof custom === "object" && !Array.isArray(custom) ? custom : {};
}

/** Tên chứng từ tự đặt như người dùng đã nhập (cho ô sửa); rỗng = dùng tên gốc. */
export function getTitleDraft(config) {
    const title = getCustomOptions(config).tieuDe;
    return typeof title === "string" ? title : "";
}

/** Tên chứng từ in ở đầu phiếu: tên tự đặt (đã cắt khoảng trắng) hoặc tên gốc của loại chứng từ. */
export function getDocTitle(schema, config) {
    return getTitleDraft(config).trim() || schema?.docTitle || "";
}

/** Cỡ chữ đang chọn (giá trị lạ -> Vừa). */
export function getFontSize(config) {
    const value = getCustomOptions(config).coChu;
    return FONT_SIZE_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_FONT_SIZE;
}

/** Kiểu mã số phiếu đang chọn (giá trị lạ -> không in). */
export function getDocCodeMode(config) {
    const value = getCustomOptions(config).maSoPhieu;
    return DOC_CODE_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_DOC_CODE;
}

/** Nhãn tự đặt của một mục (đã cắt khoảng trắng) hoặc null nếu chưa đặt. */
export function getCustomLabel(config, key) {
    const labels = getCustomOptions(config).nhan;
    const value = labels && typeof labels === "object" ? labels[key] : undefined;
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Nhãn in trên giấy của một mục: nhãn tự đặt nếu có, ngược lại nhãn gốc. */
export function getLabel(config, sectionKey, itemKey, fallback) {
    return getCustomLabel(config, labelKey(sectionKey, itemKey)) ?? fallback;
}
