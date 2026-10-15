/**
 * Báo cho các thành phần nặng (biểu đồ) biết sidebar backoffice đang thu / mở.
 *
 * Lúc thu / mở, độ rộng sidebar chuyển động (khối "sidebar-gap" trong ui/sidebar.jsx),
 * kéo theo khung nội dung đổi cỡ ở từng khung hình. Thành phần nào vẽ lại theo cỡ khung
 * (biểu đồ Recharts) mà vẽ lại ở từng khung hình thì chuyển động bị giật. Các thành phần
 * đó đọc sidebarDangChuyen() để tạm hoãn, và đăng ký theoDoiSidebarChuyenDong() để vẽ lại
 * một lần ngay khi sidebar dừng.
 *
 * Bám theo sự kiện transition của chính khối sidebar-gap (không đặt giờ cố định), nên tự
 * khớp thời gian chuyển động; khi tắt hiệu ứng (prefers-reduced-motion) không có
 * transition nào, biểu đồ vẽ lại ngay như bình thường.
 */

// Lưới an toàn nếu trình duyệt không bắn transitionend / transitioncancel
// (vd. thu nhỏ cửa sổ về cỡ điện thoại giữa chừng làm khối sidebar-gap bị gỡ).
const THOI_GIAN_TOI_DA_MS = 1000;
// Bấm thu / mở liên tiếp: Chrome hủy transition cũ rồi 1–3 khung hình sau mới chạy
// transition mới; đợi chừng này trước khi coi là đã dừng để không vẽ lại giữa chừng.
const CHO_SAU_KHI_HUY_MS = 100;

let dangChuyen = false;
let daGanSuKien = false;
let khungHinhKetThuc = 0;
let choSauKhiHuy = 0;
let hanAnToan = 0;
const nguoiNghe = new Set();

const laDoRongSidebar = (event) =>
  event.propertyName === "width" &&
  event.target instanceof Element &&
  event.target.matches('[data-slot="sidebar-gap"]');

function datTrangThai(giaTri) {
  if (dangChuyen === giaTri) return;
  dangChuyen = giaTri;
  nguoiNghe.forEach((goiLai) => goiLai());
}

function huyLuotChoDung() {
  cancelAnimationFrame(khungHinhKetThuc);
  clearTimeout(choSauKhiHuy);
}

function dung() {
  clearTimeout(hanAnToan);
  datTrangThai(false);
}

function khiBatDau(event) {
  if (!laDoRongSidebar(event)) return;
  huyLuotChoDung();
  clearTimeout(hanAnToan);
  hanAnToan = setTimeout(() => datTrangThai(false), THOI_GIAN_TOI_DA_MS);
  datTrangThai(true);
}

// Kết thúc bình thường: dừng ở khung hình kế tiếp. Bị hủy (bấm lại giữa chừng): đợi
// CHO_SAU_KHI_HUY_MS, nếu transition mới chạy thì vẫn tính là đang chuyển động.
function khiKetThuc(event) {
  if (!laDoRongSidebar(event)) return;
  huyLuotChoDung();
  if (event.type === "transitioncancel") {
    choSauKhiHuy = setTimeout(dung, CHO_SAU_KHI_HUY_MS);
  } else {
    khungHinhKetThuc = requestAnimationFrame(dung);
  }
}

export function sidebarDangChuyen() {
  return dangChuyen;
}

/** Đăng ký nghe đổi trạng thái; trả về hàm hủy đăng ký. */
export function theoDoiSidebarChuyenDong(goiLai) {
  if (!daGanSuKien && typeof document !== "undefined") {
    document.addEventListener("transitionrun", khiBatDau, true);
    document.addEventListener("transitionend", khiKetThuc, true);
    document.addEventListener("transitioncancel", khiKetThuc, true);
    daGanSuKien = true;
  }
  nguoiNghe.add(goiLai);
  return () => nguoiNghe.delete(goiLai);
}
