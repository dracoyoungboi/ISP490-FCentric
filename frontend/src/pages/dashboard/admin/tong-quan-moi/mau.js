// Màu số liệu của màn Tổng quan (bản Kiểu 3). Một chuỗi số liệu một màu; kỳ trước là nét đứt xám.
// Bốn mức tồn: hai mức cần xử lý nổi màu, Bình thường xám để các mức cần chú ý dễ thấy.
// Chữ trên biểu đồ (trục, nhãn) đạt tương phản 4,5:1 trên nền trắng; nét kỳ trước đạt 3:1 (WCAG 1.4.11).
export const MAU2 = {
  chinh: "#1677ff",
  nenVung: "rgba(22, 119, 255, 0.08)",
  kyTruoc: "#8592a6",
  luoi: "#eef1f5",
  truc: "#cbd5e1",
  chu: "#64748b",
  // Bình thường và Dư hàng xám như Tổng quan của quản lý kho (vai-tro/khung.jsx), chỉ hai mức cần làm nổi màu (chốt 29/10/2026)
  tinhTrang: { hetHang: "#d92d20", thieuHang: "#f38744", binhThuong: "#dfe4ea", duHang: "#a6b0bf" },
};
