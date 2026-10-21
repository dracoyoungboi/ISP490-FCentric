import DongThongBaoGoc, { NutChu } from "@/components/nhap-kho/DongThongBao";

/**
 * Dòng thông báo trong khối chứng từ: đúng components/nhap-kho/DongThongBao (nền trắng, viền trái màu,
 * tone neutral | info | ok | warn | bad, `actions` bên phải) nhưng BẬT SẴN `nutXuongDong`: trên điện thoại các nút
 * xuống hàng riêng dưới chữ (thẳng lề chữ) thay vì bóp chữ. Truyền `nutXuongDong={false}` để giữ nút bên phải.
 * NutChu: nút dạng chữ đặt trong `actions` hoặc ngay trong câu.
 */
export default function DongThongBao({ nutXuongDong = true, ...props }) {
  return <DongThongBaoGoc nutXuongDong={nutXuongDong} {...props} />;
}

export { NutChu };
