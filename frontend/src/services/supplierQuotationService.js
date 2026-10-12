import apiClient from './apiClient';

const supplierQuotationService = {
    /**
     * Yêu cầu gửi OTP đến email
     * @param {Object} data - { email, donMuaHangId } hoặc { email, soDonMua } khi nhà cung cấp tự nhập mã đơn
     * @returns Promise<ResponseData<String>>
     */
    requestOtp: async (data) => {
        try {
            const response = await apiClient.post('/api/v1/nghiep-vu/don-mua-hang/lay-otp', data, { needToken: false, needKho: false }  );
            return response.data;
        } catch (error) {
            console.error('Error requesting OTP:', error);
            throw error;
        }
    },

    /**
     * Xác thực OTP và lấy thông tin đơn hàng
     * @param {Object} data - { email, otp, donMuaHangId } hoặc { email, otp, soDonMua }
     * @returns Promise<ResponseData<DonMuaHangDto>>
     */
    verifyOtp: async (data) => {
        try {
            const response = await apiClient.post('/api/v1/nghiep-vu/don-mua-hang/xac-nhan-otp', data, { needToken: false, needKho: false });
            return response.data;
        } catch (error) {
            console.error('Error verifying OTP:', error);
            throw error;
        }
    },

    /**
     * Gửi báo giá
     * @param {Object} data - DonMuaHangBaoGia DTO
     * @returns Promise<ResponseData<String>>
     */
    submitQuote: async (data) => {
        try {
            const response = await apiClient.post('/api/v1/nghiep-vu/don-mua-hang/bao-gia', data, { needToken: false, needKho: false });
            return response.data;
        } catch (error) {
            console.error('Error submitting quote:', error);
            throw error;
        }
    }
};

export default supplierQuotationService;
