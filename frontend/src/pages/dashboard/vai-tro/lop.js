// Lớp Tailwind dùng chung của Tổng quan theo vai trò (tách khỏi khung.jsx để tệp đó chỉ xuất thành phần).

/** Thứ tự đọc khi trang hẹp (một cột); trang rộng hai cột thì theo thứ tự trong cột. Tên lớp viết đầy đủ để Tailwind quét được. */
export const THU_TU = {
  1: "order-1 @min-[968px]/tq:order-none",
  2: "order-2 @min-[968px]/tq:order-none",
  3: "order-3 @min-[968px]/tq:order-none",
  4: "order-4 @min-[968px]/tq:order-none",
  5: "order-5 @min-[968px]/tq:order-none",
  6: "order-6 @min-[968px]/tq:order-none",
};
