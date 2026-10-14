import apiClient from './apiClient';

const API_URL = '/api/supplier';

// Lấy danh sách (có search)
export const getAllSupplier = async (search = '') => {
    try {
        const response = await apiClient.get(API_URL, { params: { search } });
        return response.data.data || []; // Trả về mảng từ response.data.data
    } catch (error) {
        console.error('Lỗi lấy danh sách nhà cung cấp:', error);
        throw error;
    }
};

// Lấy chi tiết theo ID
export const getSupplierById = async (id) => {
    try {
        const response = await apiClient.get(`${API_URL}/${id}`);
        return response.data.data;
    } catch (error) {
        console.error('Lỗi lấy chi tiết nhà cung cấp:', error);
        throw error;
    }
};

// Tạo mới
export const createSupplier = async (data) => {
    try {
        const response = await apiClient.post(API_URL, data);
        return response.data.data;
    } catch (error) {
        console.error('Lỗi tạo nhà cung cấp:', error);
        throw error;
    }
};

// Cập nhật
export const updateSupplier = async (id, data) => {
    try {
        const response = await apiClient.put(`${API_URL}/${id}`, data);
        return response.data.data;
    } catch (error) {
        console.error('Lỗi cập nhật nhà cung cấp:', error);
        throw error;
    }
};

// Ngừng hoạt động (0) / cho phép hoạt động lại (1) — thao tác riêng, không đi qua form sửa
export const updateSupplierStatus = async (id, trangThai) => {
    try {
        const response = await apiClient.put(`${API_URL}/${id}/trang-thai`, { trangThai });
        return response.data.data;
    } catch (error) {
        console.error('Lỗi đổi trạng thái nhà cung cấp:', error);
        throw error;
    }
};

// Kiểm tra trước khi xóa: { coTheXoa, soDonMuaHang, soPhieuNhapKho, soLoHang }
export const checkSupplierDelete = async (id) => {
    try {
        const response = await apiClient.get(`${API_URL}/${id}/kiem-tra-xoa`);
        return response.data.data;
    } catch (error) {
        console.error('Lỗi kiểm tra xóa nhà cung cấp:', error);
        throw error;
    }
};

// Xóa (chỉ xóa được nhà cung cấp chưa phát sinh giao dịch)
export const deleteSupplier = async (id) => {
    try {
        await apiClient.delete(`${API_URL}/${id}`);
    } catch (error) {
        console.error('Lỗi xóa nhà cung cấp:', error);
        throw error;
    }
};