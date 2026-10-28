import apiClient from "./apiClient";

/**
 * Ghi nhận thanh toán đơn bán thường: phiếu thu / hoàn, hủy phiếu, đối chiếu chuyển khoản. Ngày gửi dạng yyyy-MM-dd,
 * máy chủ hiểu theo giờ Việt Nam. Bán tại quầy thu ở màn Bán hàng (posService).
 */
const BASE = "/api/v1/thanh-toan";
const data = (res) => res.data?.data ?? null;

export const thanhToanService = {
  /**
   * Ghi nhận khách trả tiền cho đơn bán thường. phuongThuc: TIEN_MAT | CHUYEN_KHOAN (bắt buộc maThamChieu). ngayThu
   * yyyy-MM-dd (trống = hôm nay; tiền mặt chỉ hôm nay). 409 code THU_THUA: số vượt phần còn phải thu — gửi lại với
   * choThuThua = true nếu khách thật sự trả dư. 409 MA_GD_DA_DUNG: mã giao dịch đã ghi cho đơn khác — gửi lại với
   * choMaDaDung = true nếu là bảng kê gồm nhiều đơn. khoaChongTrung: sinh một lần cho mỗi lần mở hộp — gửi lại sau khi
   * mất phản hồi không ghi phiếu thứ hai (409 KHOA_DA_DUNG nếu lần trước đã ghi với số khác). Trả thanh toán mới của đơn.
   */
  async thuTien(donId, { phuongThuc, soTien, ngayThu, maThamChieu, ghiChu, choThuThua = false, choMaDaDung = false, khoaChongTrung }) {
    const res = await apiClient.post(`${BASE}/don/${donId}/thu`,
      { phuongThuc, soTien, ngayThu: ngayThu || undefined, maThamChieu, ghiChu, choThuThua, choMaDaDung, khoaChongTrung },
      { needKho: false });
    return data(res);
  },

  /**
   * Trả lại khách phần thu thừa (quản trị viên). phuongThuc: TIEN_MAT | CHUYEN_KHOAN (kèm mã giao dịch hoàn trên sao kê).
   * Trả thanh toán mới của đơn.
   */
  async hoanTien(donId, { phuongThuc, soTien, maThamChieu, ghiChu, khoaChongTrung }) {
    const res = await apiClient.post(`${BASE}/don/${donId}/hoan-tien`,
      { phuongThuc, soTien, maThamChieu, ghiChu, khoaChongTrung }, { needKho: false });
    return data(res);
  },

  /** Hủy phiếu (quản trị viên), bắt buộc lý do. Trả thanh toán mới của đơn. */
  async huyPhieu(id, lyDo) {
    const res = await apiClient.put(`${BASE}/${id}/huy`, { lyDo }, { needKho: false });
    return data(res);
  },

  /** Phiếu chuyển khoản chưa đối chiếu sao kê, cũ trước (quản trị viên). khoId trống = mọi cửa hàng. Trả Page. */
  async choDoiChieu({ khoId, page = 0, size = 20 } = {}, { signal } = {}) {
    const res = await apiClient.get(`${BASE}/chuyen-khoan/cho-doi-chieu`,
      { params: { khoId: khoId || undefined, page, size }, signal, needKho: false });
    return data(res);
  },

  /** Đánh dấu các phiếu chuyển khoản đã thấy trên sao kê; trả số phiếu đã đánh dấu. */
  async doiChieu(ids) {
    const res = await apiClient.post(`${BASE}/chuyen-khoan/doi-chieu`, { ids }, { needKho: false });
    return data(res);
  },
};
