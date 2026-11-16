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

/**
 * Quét mã hàng (mã vạch, SKU hoặc mã lô) khi chưa có kệ nguồn: hàng đó và các kệ của kho đang chứa nó
 * `{ tenSanPham, mau, kichCo, maSku, maLo, ke: [{ id, maViTri, soLuong, layDuoc, khoa }] }`. Không phải mã hàng → 404.
 */
export const timHang = async (khoId, ma) => du(await apiClient.get(`${GOC}/tim-hang`, { params: { khoId, ma } }));

/** Khóa chống gửi lặp cho một lần xác nhận (giữ nguyên khi gửi lại cùng nội dung). */
export function taoKhoaLenh() {
  const ngauNhien =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `ck-${ngauNhien}`;
}

/** Các kệ của kho (gợi ý khi gõ mã kệ). */
export const layDsKe = async (khoId) => du(await apiClient.get(`${GOC}/ds-ke`, { params: { khoId } })) ?? [];

/**
 * Xác nhận chuyển kệ. `dong`: `[{ loHangId, keDichId, soLuong }]` cùng một kệ nguồn; `vuotSucChua` chỉ quản lý kho.
 * `khoaLenh` (header Idempotency-Key): gửi lại cùng khóa, cùng nội dung thì máy chủ trả lại phiếu đã tạo, không chuyển
 * lần nữa. Trả `{ id, maPhieu, soDong, tongSoLuong }`. Chờ quá {@link CHO_XAC_NHAN_MS} thì bỏ chờ (màn hình coi là chưa rõ
 * kết quả và cho gửi lại cùng khóa), không treo nút Xác nhận mãi.
 */
export const CHO_XAC_NHAN_MS = 40000;
export const xacNhanChuyenKe = async (khoId, { keNguonId, dong, ghiChu, vuotSucChua }, khoaLenh) =>
  du(
    await apiClient.post(
      GOC,
      { keNguonId, dong, ghiChu, vuotSucChua },
      { params: { khoId }, timeout: CHO_XAC_NHAN_MS, ...(khoaLenh ? { headers: { "Idempotency-Key": khoaLenh } } : {}) },
    ),
  );

/** Lịch sử phiếu chuyển kệ của kho: `{ ds, tong, trang, kichThuoc }`. */
export const layLichSuChuyenKe = async (khoId, { tim, tuNgay, denNgay, trang = 0, kichThuoc = 20 } = {}) =>
  du(await apiClient.get(GOC, { params: { khoId, tim: tim || undefined, tuNgay: tuNgay || undefined, denNgay: denNgay || undefined, trang, kichThuoc } }));

export const layPhieuChuyenKe = async (id) => du(await apiClient.get(`${GOC}/${id}`));

/**
 * Kệ đích gợi ý: kệ cùng kho còn chỗ, ưu tiên kệ đang chứa cùng biến thể (dồn kệ), đủ chỗ cho `can`, cùng khu với kệ
 * nguồn. `bienTheIds`: chuỗi id cách nhau dấu phẩy (Spring đọc thành danh sách).
 */
export const goiYKeDich = async (khoId, { keNguonId, bienTheIds, can }) =>
  du(await apiClient.get(`${GOC}/goi-y-ke`, { params: { khoId, keNguonId, bienTheIds: bienTheIds || undefined, can } })) ?? [];
