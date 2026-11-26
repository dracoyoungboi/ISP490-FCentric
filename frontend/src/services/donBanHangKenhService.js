import apiClient from "./apiClient";
import { donBanHangService } from "./donBanHangService";
import { CHANNEL_MOCK } from "@/mocks/mockHelpers";
import { donBanHangKenhMock } from "@/mocks/donBanHangKenhMock";

const BASE = "/api/v1/don-ban-hang";
const data = (res) => res.data?.data;

/**
 * Đơn bán từ sàn (API-KENH-BAN-HANG.md mục 3). Không sửa donBanHangService (D.7):
 * danh sách / chi tiết / đã giao đi qua đây để chạy được cả dữ liệu mẫu khi VITE_CHANNEL_MOCK=true.
 * Gồm: đọc chi tiết thông tin sàn của đơn (GET /kenh), xác nhận hủy, áp dụng thay đổi, giữ bù (Shopee), xử lý cờ.
 */
const realService = {
  // Đọc danh sách, chi tiết và đánh dấu đã giao dùng chung endpoint don_ban_hang
  filterDonBan: (payload) => donBanHangService.filter(payload),
  getDetail: (id) => donBanHangService.getDetail(id),
  markAsDelivered: (id) => donBanHangService.markAsDelivered(id),

  // Thao tác đặc thù đơn sàn (Màn 9 - Đơn hàng sàn & Chi tiết đơn)
  getThongTinKenh: (id) => apiClient.get(`${BASE}/${id}/kenh`).then(data),
  xacNhanHuy: (id, payload) => apiClient.put(`${BASE}/${id}/xac-nhan-huy-kenh`, payload).then(data),
  apDungThayDoi: (id) => apiClient.put(`${BASE}/${id}/ap-dung-thay-doi-kenh`).then(data),
  giuBu: (id) => apiClient.post(`${BASE}/${id}/giu-bu`).then(data),
  xuLyCo: (id, payload) => apiClient.put(`${BASE}/${id}/xu-ly-co`, payload).then(data),
};

export const donBanHangKenhService = CHANNEL_MOCK ? donBanHangKenhMock : realService;
export const isChannelOrderMock = CHANNEL_MOCK;
