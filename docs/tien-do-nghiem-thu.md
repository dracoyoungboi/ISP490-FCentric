# Tiến độ triển khai và nghiệm thu FCentric

Cập nhật: 18/11/2026 (GMT+7), AUDIT-105. Đây là bảng theo dõi hiện hành; audit lưu lịch sử thay đổi, không thay thế biên bản nghiệm thu.

## Cách đọc tiến độ

- **Đã viết mã**: có đường đi trong mã nguồn. Chưa chứng minh thao tác thực tế chạy đúng.
- **Đã test tự động**: nêu cụ thể bộ kiểm thử và phạm vi. Kiểm thử HTTP giả lập không phải giao dịch Shopify thật.
- **Đã thử thực tế**: có bằng chứng tại môi trường thật, ghi rõ chỉ đọc hay có thay đổi trạng thái.
- **Đã nghiệm thu**: hoàn thành ca kiểm thử nghiệp vụ, đối chiếu dữ liệu hai bên và có người xác nhận. Không suy ra từ số test đạt.

## Bảng tiến độ chung

| Phân hệ | Đã viết mã | Đã test tự động | Đã thử thực tế trong đợt 18/11 | Đã nghiệm thu |
|---|---|---|---|---|
| Sản phẩm, thuộc tính, SKU | Có | Có kiểm thử sẵn; chưa kiểm lại toàn phân hệ trong đợt này | Chưa | Chưa xác nhận |
| Mua hàng, nhập kho, QC, RTV | Có | Có kiểm thử sẵn; chưa nghiệm thu xuyên suốt trong đợt này | Chưa | Chưa xác nhận |
| Nhặt, đóng gói, xuất kho | Có | Chạy hồi quy nhặt chuyển kho, bằng chứng đóng gói và xuất kho | Chưa chạy chuỗi HTTP với MySQL test | Chưa xác nhận |
| POS, tồn khả dụng | Có | Chạy hồi quy bán tại quầy và tính tồn bán được | Chưa | Chưa xác nhận |
| Shopify: tiến trình xử lý đơn | Đã sửa API và kiểm tra kết quả gốc | HTTP giả lập, xử lý lỗi, phân trang, chạy lại, sau commit | Đã đọc cấu hình và quyền thật; bị thiếu quyền Shopify | Chưa đạt điều kiện thử đổi trạng thái |
| Shopify: xuất kho, giao hàng | Có; đã chặn báo thành công khi sàn chưa xác nhận | Kiểm thử dữ liệu fulfillment, số lượng còn được xuất, sự kiện giao hàng và lỗi từ chối | Chưa đổi trạng thái đơn thật | Chưa xác nhận |
| Shopify: hoàn trả, hoàn tiền | Có luồng hoàn toàn đơn; nhận trạng thái hoàn tiền một phần | Có kiểm thử `no_restock`, số tiền do Shopify tính và nhận trạng thái hoàn một phần | Chưa tạo hoàn tiền thật | Chưa xác nhận; còn giới hạn bên dưới |
| Shopee, Lazada, TikTok Shop | Có tích hợp | Có các bộ kiểm thử sẵn; không coi đợt này là nghiệm thu ba sàn | Chưa | Chưa xác nhận |
| Báo cáo, xuất dữ liệu AMIS | Có | Không kiểm lại toàn phân hệ trong đợt này | Chưa | Chưa xác nhận |
| Đa ngôn ngữ, đóng gói frontend | Có | i18n, ESLint phần sửa, kiểm thử frontend và build | Chưa duyệt giao diện qua trình duyệt trong đợt này | Chưa xác nhận giao diện nghiệp vụ |

## Nguyên nhân Shopify kẹt ở “Chưa hoàn tất”

1. Mã cũ gọi `fulfillmentOrderReportProgress` qua phiên bản `2024-01`. Shopify công bố hỗ trợ API này từ `2026-04`, bao gồm kho do cửa hàng tự quản lý.
2. Dữ liệu cũ dùng `progressReport.notes`; schema chính thức là `progressReport.reasonNotes`.
3. Mã cũ kiểm tra lỗi bằng chuỗi JSON, không kiểm tra `errors`, `userErrors` và trạng thái trả về. Sau đó vẫn trả `true` và gắn tag. Tag không thay đổi trạng thái gốc của đơn.
4. Kiểm tra chỉ đọc trên gian hàng đang cấu hình: lấy quyền được HTTP 200, GraphQL `2026-04` được HTTP 200 nhưng đọc `fulfillmentOrders` nhận `ACCESS_DENIED`. Quyền hiện có liên quan gồm `read_fulfillments`, `write_fulfillments`, `write_orders`; thiếu `write_merchant_managed_fulfillment_orders`.

Đã sửa bằng client GraphQL riêng ghim `2026-04`, dùng biến GraphQL, kiểm tra `supportedActions`, duyệt mọi trang và chỉ nhận thành công khi các fulfillment order đang xử lý được xác nhận `IN_PROGRESS`. Đơn đã ở `IN_PROGRESS` không bị gửi lại mutation. Không dùng API chấp nhận yêu cầu dành cho kho thuê ngoài hoặc tạo fulfillment sớm để giả trạng thái.

Các hook sau khi gửi sang kho, nhặt xong và đóng gói xong được giữ nguyên. Khi lấy lại một đơn đang ở trạng thái kho 1/7/8, hệ thống đối soát tiến trình sau commit; không thay đổi tồn hoặc tiền. Việc đối soát này chỉ áp dụng cho những đơn được lấy trong khoảng ngày đang quét, không quét toàn bộ lịch sử.

Nguồn chính thức:

- [Shopify công bố Report Progress từ 2026-04](https://shopify.dev/changelog/posts/report-fulfillment-order-progress-with-new-fulfillmentorderreportprogress-graphql-mutation).
- [Mutation, quyền và cấu trúc dữ liệu 2026-04](https://shopify.dev/docs/api/admin-graphql/2026-04/mutations/fulfillmentOrderReportProgress).

## Ma trận nghiệm thu Shopify theo yêu cầu

| Bước FCentric | Shopify phải thể hiện | Tồn kho phải đối chiếu | Tiền phải đối chiếu | Bằng chứng tự động hiện có | Thử thật / nghiệm thu |
|---|---|---|---|---|---|
| Nhận đơn nháp | Chưa hoàn tất | Giữ chỗ tăng, khả dụng giảm; chưa trừ tồn vật lý | Tổng đơn đúng dữ liệu sàn | Test tạo đơn và nhận dữ liệu | Chưa |
| Chờ nhặt (1) | Đang thực hiện | Giữ nguyên giữ chỗ | Không đổi | Test tiến trình gốc, đối soát đơn cũ sau commit | Chờ quyền Shopify |
| Chờ đóng gói (7) | Đang thực hiện | Chưa trừ tồn vật lý | Không đổi | Cùng client và hook sau nhặt; test đối soát trạng thái 7 | Chờ quyền Shopify |
| Chờ xuất (8) | Đang thực hiện | Chưa trừ tồn vật lý | Không đổi | Cùng client và hook đóng gói; test đối soát trạng thái 8 | Chờ quyền Shopify |
| Đã xuất kho (3) | Đã hoàn tất | Trừ vật lý đúng lượng xuất; không lấy nhầm phần POS/chuyển kho khác đang giữ | Giữ phí vận chuyển thu khách; lưu cước thực tế riêng trên phiếu xuất | Test xuất kho, dòng fulfillment và lượng còn được xuất | Chưa |
| Hoàn thành (5) | Đã giao | Không trừ tồn lần hai | Không sửa tổng hóa đơn | Test sự kiện `delivered`, từ chối HTTP và thiếu fulfillment | Chưa |
| Hủy (4) | Đã hủy, không yêu cầu hoàn tất | Nhả đúng giữ chỗ; chỉ hủy trước khi xuất theo điều kiện nghiệp vụ | Kiểm tra thanh toán/hoàn tiền riêng | Có đường hủy và kiểm thử sẵn; chưa chạy ca xuyên suốt đợt này | Chưa |
| Hoàn toàn đơn (6) | Nhóm trả hàng / hoàn tiền theo phản hồi thực tế | `no_restock`; chỉ tăng vật lý khi có phiếu nhập hoàn | Dùng số tiền Shopify tính; đối chiếu giao dịch hoàn tiền | Test dữ liệu refund và `no_restock` bằng HTTP giả lập | Chưa |
| Hoàn một phần | Nhóm trả hàng / hoàn tiền một phần | Không tự nhập lại tồn | Giữ nguyên hóa đơn gốc; đối chiếu từng dòng và giao dịch hoàn | Test nhận `partially_refunded`; chưa có kiểm thử xuất hoàn từng dòng từ FCentric | Chưa; còn thiếu nghiệp vụ từng dòng |

Không đánh đồng các trạng thái: `IN_PROGRESS` là tiến trình fulfillment order; `fulfilled` là hoàn tất xuất giao; `delivered` là sự kiện giao hàng. Tài chính và trả hàng là các nhóm trạng thái riêng. Refund không chứng minh đã tạo đối tượng Return của Shopify.

## Việc còn cần để chạy thật

1. Trong phần cấu hình quyền ứng dụng Shopify, cấp quyền đọc/ghi đơn do cửa hàng tự quản lý (`write_merchant_managed_fulfillment_orders`; quyền ghi bao gồm quyền đọc tương ứng). Cài đặt/cấp quyền lại theo kiểu ứng dụng, nhận khóa có quyền mới và lưu trong FCentric. Không đưa khóa vào tài liệu hay chat.
2. Khởi động backend từ bản build mới. Vào cấu hình Shopify, bấm **Kiểm tra kết nối**. Kết nối cơ bản và quyền cập nhật tiến trình là hai kết quả riêng; thiếu quyền phải hiện cảnh báo.
3. Dùng đơn thử có thanh toán thử. Thực hiện từng bước trong ma trận, ghi mã đơn hai bên và ảnh trạng thái gốc; tag không được dùng thay bằng chứng.
4. Với đơn cũ đang kẹt, chọn khoảng ngày có đơn và lấy lại đơn. Chỉ thao tác lại việc lấy đơn, không chuyển lùi trạng thái kho hoặc phát hành lại phiếu xuất.
5. Kiểm tra rollback: giao dịch kho bị hủy thì không gửi tiến trình; lỗi Shopify không được đảo ngược giao dịch xuất kho đã commit. Kiểm tra 403, 429, mất mạng và bấm hai lần.
6. Chạy kiểm thử HTTP kho trên MySQL test riêng nếu cần nghiệm thu toàn tuyến; `NhatHangHoanTatIntegrationTest` bị khóa mặc định và có xóa dữ liệu fixture. Không chạy lên DB vận hành. Docker Engine chưa chạy tại thời điểm kiểm tra.
7. Hoàn trả còn giới hạn: luồng `returnOrder` đang hoàn toàn đơn, chưa có đầu vào chọn lượng trả từng dòng ở đường đồng bộ này. Cần hoàn thiện, kiểm tra hoàn tiền lặp, phần đã hoàn trước đó và xác nhận Return riêng trước khi nghiệm thu hoàn một phần. Không lấy test nhận trạng thái một phần làm bằng chứng đã xuất hoàn một phần.

Người dùng đã chọn tiếp tục sửa mã và ghi rõ bước cấp quyền còn thiếu; chưa thực hiện mutation trên gian hàng hay tạo giao dịch hoàn tiền thật trong đợt này.

## Kết quả kiểm tra đợt sửa

- Backend: 214 bài kiểm thử mục tiêu đạt; gồm client HTTP GraphQL, kiểm quyền kết nối, trạng thái đơn, đồng bộ, tồn đa kho, xuất kho, POS, nhặt chuyển kho và bằng chứng đóng gói. Đây không phải toàn bộ test backend hay nghiệm thu với MySQL thật.
- Frontend sau khi nhập cập nhật Dev `b3df8fae`: 692 bài, 691 đạt, 1 bỏ qua, không lỗi.
- Đa ngôn ngữ frontend: 726 tệp, 0 chưa bọc, 0 thiếu bản dịch, 0 lệch.
- Bộ kiểm thông điệp backend cho 4 tệp nguồn sửa: không có câu sót, khóa thiếu hay lỗi kho câu.
- ESLint ba tệp JSX sửa, build frontend và đóng gói backend: đạt.
- Thử thật chỉ đọc: DB kết nối được; quyền Shopify thiếu đã được xác nhận; không ghi tồn, đơn, tiền hoặc khóa.

Khi bổ sung bằng chứng, cập nhật từng ô và ghi rõ môi trường, mã ca, kết quả thực tế, người xác nhận; giữ lại mục chưa đạt thay vì ghi một tỷ lệ hoàn thành chung.
