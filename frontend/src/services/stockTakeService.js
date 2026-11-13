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

/** Số kệ và sản phẩm trên sổ kệ theo danh mục của kho (gộp cây con): `[{ danhMucId, soKe, soLuong }]`. */
export const layDanhMucTrenKe = async (khoId) =>
  du(await apiClient.get(`${GOC}/danh-muc-tren-ke`, { params: { khoId } })) ?? [];

export const layHangChuaCoKe = async (khoId) =>
  du(await apiClient.get(`${GOC}/hang-chua-co-ke`, { params: { khoId } })) ?? [];

/**
 * Số lô, số sản phẩm chưa có kệ ở kho: `{ soLo, soLuong }` — số đếm trên menu, hoặc chỉ hàng của một chứng từ
 * (`phieuChuyenId` / `phieuNhapId`, dòng nhắc trên phiếu chuyển kho, phiếu nhập).
 */
export const demHangChuaCoKe = async (khoId, { phieuChuyenId, phieuNhapId } = {}) =>
  du(await apiClient.get(`${GOC}/hang-chua-co-ke/dem`, { params: { khoId, phieuChuyenId, phieuNhapId } }));

/** Xem trước phạm vi (không khóa, không ghi). `dotId`: đợt nháp đang sửa (không tự giao thoa với chính nó). */
export const xemTruocPhamVi = async (thongTin, dotId) =>
  du(await apiClient.post(`${GOC}/xem-truoc`, thongTin, { params: { dotId } }));

export const luuNhap = async (thongTin) => du(await apiClient.post(GOC, thongTin));

export const suaNhap = async (id, thongTin) => du(await apiClient.put(`${GOC}/${id}`, thongTin));

export const taoVaBatDau = async (thongTin, khoa) => du(await apiClient.post(`${GOC}/bat-dau-ngay`, thongTin, voiKhoa(khoa)));

export const batDau = async (id, phienBan, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/bat-dau`, { phienBan }, voiKhoa(khoa)));

/** Lưu số đếm một dòng: `soLuongThucTe` null = chưa đếm. `phienBan`: phiên bản của dòng lúc tải. */
/**
 * Lưu số đếm một dòng. `khoId`: kho của đợt — gửi làm header kho_id cho riêng yêu cầu này (không đổi kho làm việc chung
 * của các thẻ), nên đổi kho làm việc ở thẻ khác không làm lưu số thất bại. Không truyền thì dùng kho làm việc như cũ.
 */
export const luuSoDem = async (id, dongId, { soLuongThucTe, lyDoChenhLech, bienPhapXuLy, phienBan }, khoId) =>
  du(await apiClient.put(`${GOC}/${id}/dong/${dongId}`, { soLuongThucTe, lyDoChenhLech, bienPhapXuLy, phienBan },
    khoId ? { needKho: false, headers: { kho_id: String(khoId) } } : undefined));

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

/** Cảnh báo không chặn cho hộp Phê duyệt: mã đếm thiếu làm đơn chờ xuất / phiếu chuyển không còn đủ hàng. */
export const layCanhBaoDuyet = async (id) => du(await apiClient.get(`${GOC}/${id}/canh-bao-duyet`)) ?? [];

export const pheDuyet = async (id, phienBan, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/phe-duyet`, { phienBan }, voiKhoa(khoa)));

export const huyDot = async (id, { lyDo, phienBan }, khoa) =>
  du(await apiClient.post(`${GOC}/${id}/huy`, { lyDo, phienBan }, voiKhoa(khoa)));

/**
 * Xếp nhiều phần lên kệ một lượt; `ds`: `[{ loHangId, viTriKhoId, soLuong }]` (một lô chia nhiều kệ là nhiều phần).
 * Trả kết quả từng phần `[{ loHangId, viTriKhoId, soLuong, daXep, loi }]`: phần lỗi không làm hỏng các phần khác.
 */
export const xepKeNhieu = async (khoId, ds) =>
  du(await apiClient.post(`${GOC}/xep-ke-nhieu`, { ds }, { params: { khoId } })) ?? [];

export const chuyenKe = async (khoId, { loHangId, tuViTriKhoId, denViTriKhoId, soLuong }) =>
  du(await apiClient.post(`${GOC}/chuyen-ke`, { loHangId, tuViTriKhoId, denViTriKhoId, soLuong }, { params: { khoId } }));
