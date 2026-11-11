// src/services/chuyenKeService.js
import apiClient from "./apiClient";

/*
 * Chuyển kệ nội bộ (/api/v1/chuyen-ke, UC-7.4): quét kệ, chốt chuyển (sinh phiếu MV-YYYYMMDD-XXXX), lịch sử phiếu.
 * Mọi lời gọi gửi kèm khoId của kho đang làm việc.
 */
const GOC = "/api/v1/chuyen-ke";

const du = (res) => res.data.data;

/** Kệ theo mã quét / gõ: thông tin, sức chứa, hàng trên kệ theo lô kèm số khả dụng chuyển. */
export const traKe = async (khoId, ma) => du(await apiClient.get(`${GOC}/ke`, { params: { khoId, ma } }));

/** Các kệ của kho (gợi ý khi gõ mã kệ). */
export const layDsKe = async (khoId) => du(await apiClient.get(`${GOC}/ds-ke`, { params: { khoId } })) ?? [];

/**
 * Xác nhận chuyển kệ. `dong`: `[{ loHangId, keDichId, soLuong }]` cùng một kệ nguồn; `vuotSucChua` chỉ quản lý kho.
 * Trả `{ id, maPhieu, soDong, tongSoLuong }`.
 */
export const xacNhanChuyenKe = async (khoId, { keNguonId, dong, ghiChu, vuotSucChua }) =>
  du(await apiClient.post(GOC, { keNguonId, dong, ghiChu, vuotSucChua }, { params: { khoId } }));

/** Lịch sử phiếu chuyển kệ của kho: `{ ds, tong, trang, kichThuoc }`. */
export const layLichSuChuyenKe = async (khoId, { tim, tuNgay, denNgay, trang = 0, kichThuoc = 20 } = {}) =>
  du(await apiClient.get(GOC, { params: { khoId, tim: tim || undefined, tuNgay: tuNgay || undefined, denNgay: denNgay || undefined, trang, kichThuoc } }));

export const layPhieuChuyenKe = async (id) => du(await apiClient.get(`${GOC}/${id}`));
