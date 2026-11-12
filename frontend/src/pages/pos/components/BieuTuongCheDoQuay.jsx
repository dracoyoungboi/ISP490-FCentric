/**
 * Biểu tượng tự vẽ cho công tắc chế độ quầy (Bán hàng / Trả hàng), cùng nét với bộ lucide đang dùng
 * (lưới 24, nét 2, đầu nét bo tròn) để đứng cạnh biểu tượng lucide không bị lệch.
 * Không dùng ShoppingBag / ScanBarcode / Banknote: ở POS ba hình đó đã là giỏ hóa đơn, nút quét và tiền mặt.
 */
function KhungBieuTuong({ children, className, ...props }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Máy tính tiền: màn hình cho khách, cuộn hóa đơn, thân máy có phím và ngăn kéo tiền. */
export function MayTinhTien(props) {
  return (
    <KhungBieuTuong {...props}>
      <rect height="4" rx="1" width="7" x="13" y="3" />
      <path d="M16.5 7v3" />
      <path d="M6.5 10V4h3.5v6" />
      <path d="M5 10h14l1.6 8H3.4Z" />
      <path d="M3.4 18H20.6v2a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1Z" />
      <path d="M8 14h.01M12 14h.01M16 14h.01" />
    </KhungBieuTuong>
  );
}

/** Hóa đơn quay về: trả hàng luôn bắt đầu từ một hóa đơn đã bán. */
export function HoaDonQuayVe(props) {
  return (
    <KhungBieuTuong {...props}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M10 7.5 7.5 10 10 12.5" />
      <path d="M7.5 10H14a2.5 2.5 0 0 1 0 5h-1.5" />
    </KhungBieuTuong>
  );
}
