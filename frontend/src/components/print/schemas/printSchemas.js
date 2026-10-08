/**
 * Registry schema in theo loại chứng từ.
 *
 * Mỗi loại chứng từ có bộ section / field / cột bảng / khổ giấy RIÊNG —
 * editor và renderer đều đọc từ đây, nên không còn cấu hình "global"
 * dùng chung cho mọi loại phiếu.
 *
 * Quy ước:
 * - key          : mã loại chứng từ (dùng làm khóa lưu trữ)
 * - slug         : dùng trong URL (/settings/print-templates/<slug>/...)
 * - templates    : các mẫu mặc định; khổ giấy nằm trong định danh mẫu
 *                  (vd: purchase_request_default_A4)
 * - sections     : thứ tự + cấu trúc hiển thị của phiếu
 *   - type "info"       : lưới nhãn/giá trị, fields = các trường bật/tắt được;
 *                         field.hideWhenEmpty = ẩn hẳn khi adapter trả null
 *                         (trường không áp dụng cho phiếu đó, vd. "Kho chuyển
 *                         đến" ở phiếu xuất bán); field.labelModelPath = nhãn
 *                         động lấy từ model; field.hint = ghi chú trong editor
 *   - type "items"      : bảng dữ liệu, columns = cột bật/tắt được;
 *                         column.essential = cột BẮT BUỘC (không tắt được —
 *                         phiếu thiếu tên hàng/SKU/số lượng/tiền là vô nghĩa);
 *                         total.column = cột mà dòng tổng nằm dưới
 *   - type "notes"      : khu vực ghi chú tự do
 *   - type "signatures" : khối chữ ký, blocks = từng khối bật/tắt được;
 *                         model trả { label?, name, email } — name rỗng = ô
 *                         ký trống để ký tay, label ghi đè nhãn mặc định
 *   - compactHidden     : section KHÔNG dùng trên khổ nhiệt K80 (không render,
 *                         không hiện trong editor) — vd. "Đơn vị bán" trùng
 *                         đầu phiếu
 * - template.defaults   : cấu hình mặc định riêng của một mẫu, ghi đè lên
 *                         mặc định "bật tất cả" (vd. mẫu K80 gọn cho POS)
 */
export const PRINT_SCHEMAS = {
    purchase_request: {
        key: "purchase_request",
        slug: "purchase-request",
        label: "Yêu cầu nhập hàng",
        docTitle: "PHIẾU YÊU CẦU NHẬP HÀNG",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: [
            {
                id: "purchase_request_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "purchase_request_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
        ],
        sections: [
            {
                key: "requestInfo",
                type: "info",
                title: "Thông tin yêu cầu",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã phiếu", modelPath: "documentNumber", essential: true },
                    { key: "createdAt", label: "Ngày tạo", modelPath: "createdAt" },
                    { key: "expectedDate", label: "Ngày giao dự kiến", modelPath: "expectedDate" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                    {
                        key: "rejectionReason",
                        label: "Lý do từ chối",
                        modelPath: "rejectionReason",
                        hideWhenEmpty: true,
                        hint: "Chỉ in khi yêu cầu bị từ chối",
                        span: 3,
                    },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Thông tin kho nhận",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên kho", modelPath: "warehouse.name" },
                    { key: "code", label: "Mã kho", modelPath: "warehouse.code" },
                    { key: "manager", label: "Người quản lý kho", modelPath: "warehouse.manager" },
                    { key: "address", label: "Địa chỉ", modelPath: "warehouse.address", span: 2 },
                ],
            },
            {
                key: "users",
                type: "info",
                title: "Thông tin người dùng",
                columns: 2,
                fields: [
                    { key: "creator", label: "Người tạo", modelPath: "users.creator" },
                    {
                        key: "approver",
                        label: "Người duyệt",
                        modelPath: "users.approver",
                        // Phiếu bị từ chối in "Người từ chối"
                        labelModelPath: "users.approverLabel",
                    },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                total: { label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true },
                    { key: "color", label: "Màu sắc", path: "color" },
                    { key: "size", label: "Kích cỡ", path: "size" },
                    { key: "material", label: "Chất liệu", path: "material" },
                    { key: "quantity", label: "SL yêu cầu", path: "quantity", essential: true },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Người tạo", path: "signatures.creator" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                ],
            },
        ],
    },

    quotation_request: {
        key: "quotation_request",
        slug: "quotation-request",
        label: "Yêu cầu báo giá",
        docTitle: "PHIẾU YÊU CẦU BÁO GIÁ",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: [
            {
                id: "quotation_request_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "quotation_request_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
        ],
        sections: [
            {
                key: "requestInfo",
                type: "info",
                title: "Thông tin yêu cầu",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã phiếu", modelPath: "documentNumber", essential: true },
                    { key: "createdAt", label: "Ngày tạo", modelPath: "createdAt" },
                    // key "deadline" giữ nguyên để cấu hình đã lưu không bị mất;
                    // dữ liệu là ngày giao dự kiến, không phải hạn gửi báo giá
                    { key: "deadline", label: "Ngày giao dự kiến", modelPath: "expectedDate" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Kho yêu cầu",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên kho", modelPath: "warehouse.name" },
                    { key: "manager", label: "Người quản lý kho", modelPath: "warehouse.manager" },
                    { key: "address", label: "Địa chỉ", modelPath: "warehouse.address", span: 2 },
                ],
            },
            {
                key: "suppliers",
                type: "items",
                title: "Nhà cung cấp được mời",
                path: "suppliers",
                columns: [
                    { key: "supplierName", label: "Nhà cung cấp", path: "name", essential: true },
                    { key: "supplierEmail", label: "Email", path: "email" },
                    { key: "supplierPhone", label: "Số điện thoại", path: "phone" },
                    { key: "supplierSent", label: "Trạng thái gửi", path: "sentStatus" },
                ],
            },
            {
                key: "products",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "products",
                total: { label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantity" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true },
                    { key: "color", label: "Màu sắc", path: "color" },
                    { key: "size", label: "Kích cỡ", path: "size" },
                    { key: "material", label: "Chất liệu", path: "material" },
                    { key: "quantity", label: "SL yêu cầu", path: "quantity", essential: true },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Người tạo", path: "signatures.creator" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                ],
            },
        ],
    },

    purchase_order: {
        key: "purchase_order",
        slug: "purchase-order",
        label: "Đơn mua hàng",
        docTitle: "ĐƠN MUA HÀNG",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: [
            {
                id: "purchase_order_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "purchase_order_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
        ],
        sections: [
            {
                key: "supplier",
                type: "info",
                title: "Nhà cung cấp",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên nhà cung cấp", modelPath: "supplier.name" },
                    { key: "code", label: "Mã nhà cung cấp", modelPath: "supplier.code" },
                    { key: "contact", label: "Người liên hệ", modelPath: "supplier.contact" },
                    { key: "phone", label: "Số điện thoại", modelPath: "supplier.phone" },
                    { key: "email", label: "Email", modelPath: "supplier.email" },
                    { key: "address", label: "Địa chỉ", modelPath: "supplier.address", span: 2 },
                ],
            },
            {
                key: "orderInfo",
                type: "info",
                title: "Thông tin đơn hàng",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã đơn", modelPath: "documentNumber", essential: true },
                    { key: "orderDate", label: "Ngày đặt", modelPath: "orderDate" },
                    { key: "expectedDate", label: "Ngày giao dự kiến", modelPath: "expectedDate" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "deliverTo",
                type: "info",
                title: "Giao hàng đến",
                columns: 2,
                fields: [
                    { key: "name", label: "Kho nhận", modelPath: "deliverTo.name" },
                    { key: "code", label: "Mã kho", modelPath: "deliverTo.code" },
                    { key: "address", label: "Địa chỉ giao hàng", modelPath: "deliverTo.address", span: 2 },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                total: { label: "Tổng tiền", modelPath: "totalAmount", column: "amount" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true },
                    { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true },
                    { key: "quantity", label: "Số lượng", path: "quantity", essential: true },
                    { key: "amount", label: "Thành tiền", path: "amount", essential: true },
                ],
            },
            {
                key: "totals",
                type: "info",
                title: "Tổng cộng",
                columns: 2,
                fields: [
                    { key: "total", label: "Tổng tiền cần thanh toán", modelPath: "totals.total" },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Người tạo", path: "signatures.creator" },
                    { key: "approver", label: "Người duyệt", path: "signatures.approver" },
                ],
            },
        ],
    },

    goods_receipt: {
        key: "goods_receipt",
        slug: "goods-receipt",
        label: "Phiếu nhập kho",
        docTitle: "PHIẾU NHẬP KHO",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: [
            {
                id: "goods_receipt_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "goods_receipt_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
        ],
        sections: [
            {
                key: "receiptInfo",
                type: "info",
                title: "Thông tin phiếu",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã phiếu", modelPath: "documentNumber", essential: true },
                    { key: "receivedDate", label: "Ngày nhập", modelPath: "receivedDate" },
                    { key: "receiptType", label: "Loại nhập", modelPath: "receiptType" },
                    {
                        key: "purchaseOrder",
                        label: "Mã đơn mua",
                        modelPath: "purchaseOrder",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu nhập từ đơn mua hàng",
                    },
                    { key: "partner", label: "Nguồn / Đối tác", modelPath: "partner" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Kho nhận",
                columns: 2,
                fields: [
                    { key: "name", label: "Tên kho", modelPath: "warehouse.name" },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách hàng nhập",
                path: "items",
                total: { label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantityReceived" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true },
                    { key: "lot", label: "Lô", path: "lot" },
                    { key: "productionDate", label: "Ngày sản xuất", path: "productionDate" },
                    { key: "requestedQuantity", label: "SL yêu cầu", path: "requestedQuantity" },
                    { key: "quantityReceived", label: "SL nhận", path: "quantity", essential: true },
                ],
            },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "receiver", label: "Người nhận", path: "signatures.receiver" },
                    {
                        key: "deliverer",
                        label: "Người giao",
                        path: "signatures.deliverer",
                        hint: "Ô trống — người giao hàng ký và ghi rõ họ tên",
                    },
                ],
            },
        ],
    },

    goods_issue: {
        key: "goods_issue",
        slug: "goods-issue",
        label: "Phiếu xuất kho",
        docTitle: "PHIẾU XUẤT KHO",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: [
            {
                id: "goods_issue_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "goods_issue_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
        ],
        sections: [
            {
                key: "issueInfo",
                type: "info",
                title: "Thông tin phiếu",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã phiếu", modelPath: "documentNumber", essential: true },
                    { key: "issuedDate", label: "Ngày xuất", modelPath: "issuedDate" },
                    { key: "issueType", label: "Loại xuất", modelPath: "issueType" },
                    {
                        key: "salesOrder",
                        label: "Đơn bán hàng",
                        modelPath: "salesOrder",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu xuất bán hàng",
                    },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "warehouse",
                type: "info",
                title: "Kho xuất",
                columns: 2,
                fields: [
                    { key: "name", label: "Tên kho", modelPath: "warehouse.name" },
                    { key: "code", label: "Mã kho", modelPath: "warehouse.code" },
                    {
                        key: "destination",
                        label: "Kho chuyển đến",
                        modelPath: "warehouse.destination",
                        hideWhenEmpty: true,
                        hint: "Chỉ in với phiếu chuyển kho",
                    },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách hàng xuất",
                path: "items",
                total: { label: "Tổng số lượng", modelPath: "totalQuantity", column: "quantityIssued" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku", essential: true },
                    { key: "lot", label: "Lô", path: "lot" },
                    { key: "requestedQuantity", label: "SL yêu cầu", path: "requestedQuantity" },
                    { key: "quantityIssued", label: "SL xuất", path: "quantity", essential: true },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "issuer", label: "Người xuất", path: "signatures.issuer" },
                    {
                        key: "receiver",
                        label: "Người nhận",
                        path: "signatures.receiver",
                        hint: "Ô trống — người nhận hàng ký và ghi rõ họ tên",
                    },
                ],
            },
        ],
    },

    sales_quotation: {
        key: "sales_quotation",
        slug: "sales-quotation",
        label: "Báo giá bán",
        docTitle: "BẢNG BÁO GIÁ",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5"],
        templates: [
            {
                id: "sales_quotation_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "sales_quotation_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
        ],
        sections: [
            {
                key: "sellerCompany",
                type: "info",
                title: "Đơn vị bán",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên đơn vị bán", modelPath: "company.name", essential: true },
                    { key: "phone", label: "Điện thoại", modelPath: "company.phone" },
                    { key: "address", label: "Địa chỉ", modelPath: "company.address", span: 2 },
                ],
            },
            {
                key: "creator",
                type: "info",
                title: "Người lập",
                columns: 3,
                fields: [
                    { key: "name", label: "Họ tên", modelPath: "creator.name" },
                    { key: "email", label: "Email", modelPath: "creator.email" },
                    { key: "phone", label: "Số điện thoại", modelPath: "creator.phone" },
                ],
            },
            {
                key: "customer",
                type: "info",
                title: "Khách hàng",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên khách hàng", modelPath: "buyer.name" },
                    { key: "code", label: "Mã khách hàng", modelPath: "buyer.code" },
                    { key: "contact", label: "Người liên hệ", modelPath: "buyer.contact" },
                    { key: "phone", label: "Số điện thoại", modelPath: "buyer.phone" },
                    { key: "address", label: "Địa chỉ", modelPath: "buyer.address", span: 2 },
                    {
                        key: "deliveryAddress",
                        label: "Địa chỉ giao hàng",
                        modelPath: "buyer.deliveryAddress",
                        hideWhenEmpty: true,
                        hint: "Chỉ in khi báo giá có địa chỉ giao hàng",
                        span: 3,
                    },
                ],
            },
            {
                key: "quoteInfo",
                type: "info",
                title: "Thông tin báo giá",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã báo giá", modelPath: "documentNumber", essential: true },
                    { key: "createdAt", label: "Ngày lập", modelPath: "createdAt" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                total: { label: "Tổng tiền hàng", modelPath: "totals.items", column: "amount" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku" },
                    { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true },
                    { key: "quantity", label: "Số lượng", path: "quantity", essential: true },
                    { key: "amount", label: "Thành tiền", path: "amount", essential: true },
                ],
            },
            {
                key: "totals",
                type: "info",
                title: "Tổng cộng",
                columns: 3,
                fields: [
                    { key: "items", label: "Tổng tiền hàng", modelPath: "totals.items" },
                    { key: "shipping", label: "Phí vận chuyển", modelPath: "totals.shipping" },
                    { key: "grandTotal", label: "Tổng cộng", modelPath: "totals.grandTotal" },
                ],
            },
            { key: "notes", type: "notes", title: "Điều khoản & Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Nhân viên bán hàng", path: "signatures.creator" },
                    { key: "buyer", label: "Khách hàng", path: "signatures.buyer" },
                ],
            },
        ],
    },

    sales_invoice: {
        key: "sales_invoice",
        slug: "sales-invoice",
        label: "Hóa đơn bán hàng",
        docTitle: "HÓA ĐƠN BÁN HÀNG",
        hasRealPrintRoute: true,
        paperProfiles: ["A4", "A5", "K80"],
        templates: [
            {
                id: "sales_invoice_default_A4",
                name: "Mẫu FCentric mặc định",
                paperSize: "A4",
                orientation: "portrait",
                margin: "default",
                isDefault: true,
            },
            {
                id: "sales_invoice_default_A5",
                name: "Mẫu FCentric mặc định (A5)",
                paperSize: "A5",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
            },
            {
                id: "sales_invoice_default_K80",
                name: "Mẫu FCentric nhiệt K80",
                paperSize: "K80",
                orientation: "portrait",
                margin: "default",
                isDefault: false,
                // Phiếu bán lẻ POS: chỉ giữ thông tin cần thiết — người dùng
                // vẫn bật lại được trong editor.
                defaults: {
                    sections: {
                        creator: { email: false, phone: false },
                        buyer: { contact: false, address: false, deliveryAddress: false },
                        // Tổng nằm ở mục "Tổng cộng" — bỏ dòng tổng trùng cuối bảng
                        items: { showTotal: false },
                        signatures: { creator: false, buyer: false },
                    },
                },
            },
        ],
        sections: [
            {
                key: "sellerCompany",
                // Đầu phiếu đã có tên/ĐT/địa chỉ công ty — K80 không lặp lại
                compactHidden: true,
                type: "info",
                title: "Đơn vị bán",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên đơn vị bán", modelPath: "company.name", essential: true },
                    { key: "phone", label: "Điện thoại", modelPath: "company.phone" },
                    { key: "address", label: "Địa chỉ", modelPath: "company.address", span: 2 },
                ],
            },
            {
                key: "creator",
                type: "info",
                title: "Người lập",
                columns: 3,
                fields: [
                    { key: "name", label: "Họ tên", modelPath: "creator.name" },
                    { key: "email", label: "Email", modelPath: "creator.email" },
                    { key: "phone", label: "Số điện thoại", modelPath: "creator.phone" },
                ],
            },
            {
                key: "buyer",
                type: "info",
                title: "Người mua",
                columns: 3,
                fields: [
                    { key: "name", label: "Tên người mua", modelPath: "buyer.name" },
                    { key: "contact", label: "Người liên hệ", modelPath: "buyer.contact" },
                    { key: "phone", label: "Số điện thoại", modelPath: "buyer.phone" },
                    { key: "address", label: "Địa chỉ", modelPath: "buyer.address", span: 2 },
                    {
                        key: "deliveryAddress",
                        label: "Địa chỉ giao hàng",
                        modelPath: "buyer.deliveryAddress",
                        hideWhenEmpty: true,
                        hint: "Chỉ in khi đơn có địa chỉ giao hàng",
                        span: 3,
                    },
                ],
            },
            {
                key: "invoiceInfo",
                type: "info",
                title: "Thông tin hóa đơn",
                columns: 3,
                fields: [
                    { key: "documentNumber", label: "Mã hóa đơn", modelPath: "documentNumber", essential: true },
                    { key: "issuedDate", label: "Ngày lập", modelPath: "issuedDate" },
                    { key: "status", label: "Trạng thái", modelPath: "status", kind: "badge" },
                    { key: "paymentStatus", label: "Thanh toán", modelPath: "paymentStatus", kind: "badge" },
                ],
            },
            {
                key: "items",
                type: "items",
                essentialShow: true,
                title: "Danh sách sản phẩm",
                path: "items",
                total: { label: "Tổng tiền hàng", modelPath: "totals.items", column: "amount" },
                columns: [
                    { key: "productName", label: "Tên sản phẩm", path: "name", essential: true },
                    { key: "sku", label: "Mã SKU", path: "sku" },
                    { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true },
                    { key: "quantity", label: "Số lượng", path: "quantity", essential: true },
                    { key: "amount", label: "Thành tiền", path: "amount", essential: true },
                ],
                // K80 là khổ nhiệt 80mm — KHÔNG co bảng A4 lại mà dùng bộ cột compact riêng
                compactColumns: [
                    { key: "productName", label: "Sản phẩm", path: "name", essential: true },
                    { key: "quantity", label: "SL", path: "quantity", essential: true },
                    { key: "unitPrice", label: "Đơn giá", path: "unitPrice", essential: true },
                    { key: "amount", label: "Thành tiền", path: "amount", essential: true },
                ],
            },
            {
                key: "totals",
                type: "info",
                title: "Tổng cộng",
                columns: 3,
                fields: [
                    { key: "items", label: "Tổng tiền hàng", modelPath: "totals.items" },
                    { key: "shipping", label: "Phí vận chuyển", modelPath: "totals.shipping" },
                    { key: "grandTotal", label: "Tổng cộng", modelPath: "totals.grandTotal" },
                ],
            },
            { key: "notes", type: "notes", title: "Ghi chú", path: "notes" },
            {
                key: "signatures",
                type: "signatures",
                title: "Chữ ký",
                blocks: [
                    { key: "creator", label: "Nhân viên bán hàng", path: "signatures.creator" },
                    { key: "buyer", label: "Người mua", path: "signatures.buyer" },
                ],
            },
        ],
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
