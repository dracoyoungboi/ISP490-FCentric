import axios from 'axios';
import { API_BASE_URL } from '../config/apiBase';

/** Header mang phiên báo giá do máy chủ cấp ở bước xác nhận mã (HOP-DONG 2.2). */
export const HEADER_PHIEN_BAO_GIA = 'X-Phien-Bao-Gia';

/*
 * Axios riêng cho 3 API của cổng nhà cung cấp: KHÔNG gắn interceptor của apiClient (token, kho, xử lý "bị khóa" và
 * 401 của nhân viên). Nhờ vậy lỗi của cổng không xóa phiên của nhân viên đang đăng nhập cùng trình duyệt, cũng không
 * chuyển sang trang đăng nhập nội bộ. Lỗi trả nguyên cho trang xử lý theo mã (components/supplier-portal/loiCong.js).
 */
const apiCong = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

const DUONG_DAN = '/api/v1/nghiep-vu/don-mua-hang';

const supplierQuotationService = {
    /**
     * Gửi mã xác nhận tới email nhà cung cấp.
     * @param {Object} data - { email, donMuaHangId } hoặc { email, soDonMua } khi nhà cung cấp tự nhập mã đơn
     * @returns ResponseData, `data` = { hetHanGiay, guiLaiSauGiay }
     */
    requestOtp: async (data) => {
        const response = await apiCong.post(`${DUONG_DAN}/lay-otp`, data);
        return response.data;
    },

    /**
     * Xác nhận mã và lấy đơn mua hàng.
     * @param {Object} data - { email, otp, donMuaHangId } hoặc { email, otp, soDonMua }
     * @returns ResponseData, `data` = { donMua, phienBaoGia, hetHanPhien, cuaHang: { ten, logoUrl } }
     */
    verifyOtp: async (data) => {
        const response = await apiCong.post(`${DUONG_DAN}/xac-nhan-otp`, data);
        return response.data;
    },

    /**
     * Gửi báo giá (payload dựng ở supplier-portal/baoGiaUtils.taoPayloadBaoGia).
     * @param {Object} data - { id, ghiChu, chiTietDonMuaHangBaoGias: [{ id, chiTietDonMuaHangId, donGia }] }
     * @param {string} phienBaoGia - phiên nhận ở bước xác nhận mã
     * @returns ResponseData, `data` = { ngayBaoGia, tongTien, emailXacNhan }
     */
    submitQuote: async (data, phienBaoGia) => {
        const response = await apiCong.post(`${DUONG_DAN}/bao-gia`, data, {
            headers: { [HEADER_PHIEN_BAO_GIA]: phienBaoGia ?? '' },
        });
        return response.data;
    },
};

export default supplierQuotationService;
