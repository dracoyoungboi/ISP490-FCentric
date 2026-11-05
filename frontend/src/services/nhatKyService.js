import apiClient from "./apiClient";

/**
 * Lịch sử thay đổi danh mục dữ liệu (bảng lich_su_thay_doi). Mỗi hàm trả mảng NhatKyDto, mới nhất trước.
 * - Người dùng, danh mục, thuộc tính, nhà cung cấp, khách hàng, kho: chỉ quản trị viên.
 * - Sản phẩm, giá bán biến thể, vị trí kệ: quản trị viên và quản lý kho (vị trí kệ: kho mình).
 */

const mang = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

/** loai: nguoi_dung, nha_cung_cap, khach_hang, kho, danh_muc_quan_ao, mau_sac, size, chat_lieu, thuong_hieu. */
export async function layLichSuDanhMuc(loai, id) {
  return mang(await apiClient.get("/api/v1/admin/nhat-ky/doi-tuong", { params: { loai, id } }));
}

/** Sản phẩm: thông tin, biến thể, ảnh, trạng thái và đổi giá các biến thể. */
export async function layLichSuSanPham(sanPhamId) {
  return mang(await apiClient.get(`/api/v1/san-pham-quan-ao/${sanPhamId}/lich-su`));
}

/** Lịch sử giá bán của một biến thể (màn Giá bán & Tem mã vạch). */
export async function layLichSuGiaBienThe(bienTheId) {
  return mang(await apiClient.get(`/api/v1/san-pham-quan-ao/sku/${bienTheId}/lich-su-gia`));
}

/**
 * Vị trí kệ của một kho: loai = khu_vuc_kho | vi_tri_kho (kèm id khu vực / kệ) | mat_bang_kho (không cần id: máy chủ
 * tự lấy mặt bằng của kho). Quản lý kho cần kho đang chọn là kho này (header kho_id).
 */
export async function layLichSuViTri(khoId, loai, id) {
  const params = id == null ? { loai } : { loai, id };
  return mang(await apiClient.get(`/api/v1/kho/${khoId}/lich-su`, { params }));
}
