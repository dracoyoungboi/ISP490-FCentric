// src/services/stockTakeService.js
import apiClient from "./apiClient";

/*
 * Kiểm kê khoanh vùng (/api/v1/kiem-ke). Lệnh đổi trạng thái gửi kèm phiên bản đợt (expectedVersion) và header
 * Idempotency-Key: bấm lặp / mạng chập chờn gửi lại cùng khóa thì máy chủ trả kết quả lần đầu, không làm hai lần.
 */
const GOC = "/api/v1/kiem-ke";

const du = (res) => res.data.data;

/** Khóa lệnh mới cho một lần bấm (giữ nguyên khi tự thử lại cùng lần bấm đó). */
export function taoKhoaLenh() {
  const ngauNhien = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `kk-${ngauNhien}`;
}

const voiKhoa = (khoa) => (khoa ? { headers: { "Idempotency-Key": khoa } } : undefined);

export const layDanhSachDot = async ({ khoId, trangThai, loai, tuKhoa } = {}) =>
  du(await apiClient.get(GOC, { params: { khoId, trangThai, loai, tuKhoa } })) ?? [];

export const layTongQuan = async (khoId) => du(await apiClient.get(`${GOC}/tong-quan`, { params: { khoId } }));

export const layDot = async (id) => du(await apiClient.get(`${GOC}/${id}`));

export const layDong = async (id) => du(await apiClient.get(`${GOC}/${id}/dong`)) ?? [];

export const layNhatKy = async (id) => du(await apiClient.get(`${GOC}/${id}/nhat-ky`)) ?? [];

export const layPhieuDieuChinh = async (id) => du(await apiClient.get(`${GOC}/${id}/phieu-dieu-chinh`));

export const laySoDo = async (khoId) => du(await apiClient.get(`${GOC}/so-do`, { params: { khoId } }));

export const layNguoiChuTri = async (khoId) => du(await apiClient.get(`${GOC}/nguoi-chu-tri`, { params: { khoId } })) ?? [];

/** Lô có trong danh mục hàng hóa khớp đầu mã lô / SKU (hộp Thêm lô phát sinh), tối đa 20. */
export const timLo = async (id, tuKhoa) => du(await apiClient.get(`${GOC}/${id}/tim-lo`, { params: { tuKhoa } })) ?? [];

export const layHangChuaCoKe = async (khoId) =>
  du(await apiClient.get(`${GOC}/hang-chua-co-ke`, { params: { khoId } })) ?? [];

/** Xem trước phạm vi (không khóa, không ghi). `dotId`: đợt nháp đang sửa (không tự giao thoa với chính nó). */
export const xemTruocPhamVi = async (thongTin, dotId) =>
  du(await apiClient.post(`${GOC}/xem-truoc`, thongTin, { params: { dotId } }));

export const luuNhap = async (thongTin) => du(await apiClient.post(GOC, thongTin));

export const suaNhap = async (id, thongTin) => du(await apiClient.put(`${GOC}/${id}`, thongTin));

export const taoVaBatDau = async (thongTin, khoa) => du(await apiClient.post(`${GOC}/bat-dau-ngay`, thongTin, voiKhoa(khoa)));

export const batDau = async (id, phienBan, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/bat-dau`, { phienBan }, voiKhoa(khoa)));

/** Lưu số đếm một dòng: `soLuongThucTe` null = chưa đếm. `phienBan`: phiên bản của dòng lúc tải. */
export const luuSoDem = async (id, dongId, { soLuongThucTe, lyDoChenhLech, bienPhapXuLy, phienBan }) =>
  du(await apiClient.put(`${GOC}/${id}/dong/${dongId}`, { soLuongThucTe, lyDoChenhLech, bienPhapXuLy, phienBan }));

export const themPhatSinh = async (id, { viTriKhoId, loHangId, soLuongThucTe, lyDoChenhLech }) =>
  du(await apiClient.post(`${GOC}/${id}/phat-sinh`, { viTriKhoId, loHangId, soLuongThucTe, lyDoChenhLech }));

export const themAnh = async (id, dongId, tep, moTa) => {
  const fd = new FormData();
  fd.append("file", tep);
  if (moTa) fd.append("moTa", moTa);
  return du(await apiClient.post(`${GOC}/${id}/dong/${dongId}/anh`, fd, { headers: { "Content-Type": "multipart/form-data" } }));
};

export const xoaAnh = async (id, dongId, anhId) => du(await apiClient.delete(`${GOC}/${id}/dong/${dongId}/anh/${anhId}`));

export const trinhDuyet = async (id, phienBan, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/trinh-duyet`, { phienBan }, voiKhoa(khoa)));

export const demLai = async (id, { dongIds, lyDo, phienBan }, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/dem-lai`, { dongIds, lyDo, phienBan }, voiKhoa(khoa)));

export const pheDuyet = async (id, phienBan, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/phe-duyet`, { phienBan }, voiKhoa(khoa)));

export const huyDot = async (id, { lyDo, phienBan }, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/huy`, { lyDo, phienBan }, voiKhoa(khoa)));

export const xepKe = async (khoId, { loHangId, viTriKhoId, soLuong }) =>
  du(await apiClient.post(`${GOC}/xep-ke`, { loHangId, viTriKhoId, soLuong }, { params: { khoId } }));

export const chuyenKe = async (khoId, { loHangId, tuViTriKhoId, denViTriKhoId, soLuong }) =>
  du(await apiClient.post(`${GOC}/chuyen-ke`, { loHangId, tuViTriKhoId, denViTriKhoId, soLuong }, { params: { khoId } }));
