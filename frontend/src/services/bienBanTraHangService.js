import apiClient from "./apiClient";

/**
 * Biên bản trả hàng nhà cung cấp (FO-099) và lưu hàng lỗi khi kiểm đếm (FO-098).
 * Kho lập biên bản; nhà cung cấp chọn cách bù và nhận lại / tiêu hủy hàng lỗi trên Cổng nhà cung cấp; kho làm theo
 * (ghi đã giao trả, ghi tiêu hủy).
 */
const data = (res) => res.data?.data;
const DUONG_DAN = "/api/v1/bien-ban-tra-hang-ncc";

export const bienBanTraHangService = {
  /** Biên bản còn hiệu lực của phiếu nhập (đủ dòng lỗi, người ký, trạng thái) hoặc null. */
  async layTheoPhieuNhap(phieuNhapKhoId) {
    return (await apiClient.get(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/bien-ban-tra-hang`).then(data)) ?? null;
  },

  /**
   * Lập / lập lại biên bản ở phiếu Nháp. payload: { cachXuLy: "GIU_KHO" | "TRA_NGAY", benKy: "DAI_DIEN_NCC" | "VAN_CHUYEN",
   * nguoiNhanHang (họ tên người ký), bienSoXe, donViVanChuyen (khi VAN_CHUYEN), ghiChu }. Biên bản chờ ghi đã ký (ghiKy).
   * Máy chủ tự lấy dòng hàng lỗi đã lưu theo lô. Trả null khi phiếu hết hàng lỗi (biên bản bị hủy).
   */
  phatHanh(phieuNhapKhoId, payload) {
    return apiClient.post(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/bien-ban-tra-hang`, payload).then(data);
  },

  /**
   * Danh sách biên bản cho tab Trả hàng ở chi tiết nhà cung cấp, khối hàng lỗi ở chi tiết đơn mua và dòng chú ý "hàng
   * lỗi còn treo" ở Đơn mua hàng / Phiếu nhập kho. params: { nhaCungCapId, donMuaHangId, trangThai, tuKhoa } (đều không
   * bắt buộc). Trang chỉ đọc `items`.
   */
  danhSach(params = {}, signal) {
    return apiClient.get(DUONG_DAN, { params, signal }).then(data);
  },

  chiTiet(id, signal) {
    return apiClient.get(`${DUONG_DAN}/${id}`, { signal }).then(data);
  },

  /** Kho ghi người giao hàng đã ký biên bản giấy; biên bản gửi email cho nhà cung cấp sau bước này. */
  ghiKy(id) {
    return apiClient.post(`${DUONG_DAN}/${id}/ky`).then(data);
  },

  /** Mua hàng gửi lại email biên bản cho nhà cung cấp (biên bản còn chờ nhà cung cấp trả lời). */
  guiLaiEmail(id) {
    return apiClient.post(`${DUONG_DAN}/${id}/gui-lai-email`).then(data);
  },

  /**
   * Kho ghi đã giao trả (nhà cung cấp đã chọn nhận lại).
   * payload: { thoiDiem (ISO), cachGiao: "NCC_LAY" | "VAN_CHUYEN", nguoiNhan, maVanDon, ghiChu }.
   */
  giaoTra(id, payload) {
    return apiClient.post(`${DUONG_DAN}/${id}/giao-tra`, payload).then(data);
  },

  /** Quản lý kho ghi tiêu hủy (nhà cung cấp đã đồng ý trên cổng). payload: { thoiDiem (ISO), ghiChu }. */
  tieuHuy(id, payload) {
    return apiClient.post(`${DUONG_DAN}/${id}/tieu-huy`, payload).then(data);
  },
};
