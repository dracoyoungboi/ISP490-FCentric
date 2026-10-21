/**
 * Lớp Tailwind dùng chung cho bảng hàng của các màn chi tiết chứng từ (cùng kiểu bảng "Sản phẩm và các đợt nhận"
 * của Chi tiết đơn mua hàng). Màn tự dựng <table> theo cột của mình nhưng lấy lớp ở đây để 8 màn giống nhau.
 *
 * Ví dụ:
 *   <div className={KHUNG_CUON}>
 *     <table className={cn(BANG, "min-w-[640px]")}>
 *       <thead><tr className={DONG_TIEU_DE}><th className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>…</tr></thead>
 *       <tbody><tr className={DONG}><td className={cn(O, O_DAU)}>…</td>…</tr></tbody>
 *     </table>
 *   </div>
 */

/**
 * Khung bảng: bảng rộng hơn màn thì cuộn ngang trong khung (cả trang không cuộn ngang). `relative` để chữ sr-only
 * (position: absolute) trong ô cũng bị khung cắt, không đẩy cả trang rộng ra.
 */
export const KHUNG_CUON = "relative overflow-x-auto border-t border-slate-100";

/** Thẻ <table>. Màn tự thêm bề rộng tối thiểu (vd. min-w-[640px]) để cột không bị bóp trên điện thoại. */
export const BANG = "w-full border-collapse text-sm";

/** Hàng tiêu đề cột (<tr> trong <thead>). */
export const DONG_TIEU_DE =
  "whitespace-nowrap border-b border-bo-border bg-bo-surface-subtle text-xs font-medium leading-4 text-bo-muted";

/** Ô tiêu đề cột (<th scope="col">). Thêm `text-right` cho cột số. */
export const O_TIEU_DE = "px-3 py-2.5 text-left font-medium";

/** Hàng dữ liệu (<tr> trong <tbody>). */
export const DONG = "group border-b border-slate-100 tabular-nums hover:bg-bo-surface-subtle";

/** Ô dữ liệu (<td>). */
export const O = "px-3 py-3 align-middle";

/** Thêm vào ô ĐẦU và ô CUỐI của mỗi hàng: lề trái / phải trùng lề của khối (16px điện thoại, 24px từ sm). */
export const O_DAU = "pl-4 sm:pl-6";
export const O_CUOI = "pr-4 sm:pr-6";

/** Ô đầu của dòng biến thể nằm dưới dòng nhóm sản phẩm (thụt vào như bản demo đã chốt). */
export const O_DAU_DONG_CON = "pl-16 sm:pl-[72px]";

/** Cột dính trái khi bảng cuộn ngang (thêm nền: bg-white / bg-bo-surface-subtle cho ô tiêu đề). */
export const COT_DINH = "sticky left-0 z-[1] shadow-[1px_0_0_var(--color-bo-border)]";

/** Dòng vừa quét / vừa tới (tô xanh nhạt). */
export const DONG_SANG = "bg-bo-primary-soft hover:bg-bo-primary-soft";

/** Dòng không còn tính (vd. "Đã bỏ", lô không dùng): chữ xám slate-500 (tương phản 4,76:1 trên nền trắng). */
export const DONG_MO = "text-slate-500";

/**
 * Bảng hẹp (rà soát N9): khi KHỐI chứng từ hẹp hơn 672px (điện thoại, 768px có thanh bên) ẩn cột phụ (Mã SKU, Lô gợi ý,
 * Ngày nhập, Tình trạng…) và hiện nội dung đó thành dòng phụ dưới tên trong ô sản phẩm; cột số / thao tác chính luôn hiện.
 * Theo container `@container/khoi` của KhungChungTu (bảng phải nằm trong KhungChungTu).
 *   - AN_DIEN_THOAI: thêm vào <th>/<td> của cột phụ.
 *   - CHI_DIEN_THOAI: thêm vào dòng phụ chỉ hiện khi hẹp.
 * Bề rộng tối thiểu của <table> chỉ đặt khi khối rộng, vd. cn(BANG, "@2xl/khoi:min-w-[620px]") — khi hẹp bảng vừa khung.
 */
export const AN_DIEN_THOAI = "@max-2xl/khoi:hidden";
export const CHI_DIEN_THOAI = "@2xl/khoi:hidden";
