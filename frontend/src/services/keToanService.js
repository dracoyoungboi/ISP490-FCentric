import apiClient from "./apiClient";

const BASE = "/api/v1/ke-toan";

const duLieu = (res) => res.data?.data;

/**
 * API xuất dữ liệu kế toán (AMIS Kế toán doanh nghiệp). Cấu hình, thuế suất và xuất theo lô chỉ quản trị viên gọi được;
 * hóa đơn nhà cung cấp gắn với phiếu nhập (kiểm theo kho đang chọn nên giữ header kho_id).
 */
export const keToanService = {
    async layCauHinh({ signal } = {}) {
        return duLieu(await apiClient.get(`${BASE}/cau-hinh`, { signal, needKho: false }));
    },
    async luuCauHinh(payload) {
        return duLieu(await apiClient.put(`${BASE}/cau-hinh`, payload, { needKho: false }));
    },

    async danhSachThueSuat({ signal } = {}) {
        return duLieu(await apiClient.get(`${BASE}/thue-suat`, { signal, needKho: false })) ?? [];
    },
    async themThueSuat(payload) {
        return duLieu(await apiClient.post(`${BASE}/thue-suat`, payload, { needKho: false }));
    },
    async suaThueSuat(id, payload) {
        return duLieu(await apiClient.put(`${BASE}/thue-suat/${id}`, payload, { needKho: false }));
    },
    async xoaThueSuat(id) {
        await apiClient.delete(`${BASE}/thue-suat/${id}`, { needKho: false });
    },

    /** Kiểm tra trước khi tạo lô; denNgay dạng yyyy-MM-dd. */
    async xemTruoc(denNgay, { signal } = {}) {
        return duLieu(await apiClient.get(`${BASE}/xem-truoc`, { params: { denNgay }, signal, needKho: false }));
    },
    async taoLo({ denNgay, ghiChu, dauVet }) {
        return duLieu(await apiClient.post(`${BASE}/lo-xuat`, { denNgay, ghiChu, dauVet }, { needKho: false }));
    },
    async danhSachLo({ signal } = {}) {
        return duLieu(await apiClient.get(`${BASE}/lo-xuat`, { signal, needKho: false })) ?? [];
    },
    async chungTuCuaLo(loId, { signal } = {}) {
        return duLieu(await apiClient.get(`${BASE}/lo-xuat/${loId}/chung-tu`, { signal, needKho: false })) ?? [];
    },
    async moKhoa(chungTuId, lyDo) {
        return duLieu(await apiClient.post(`${BASE}/chung-tu-xuat/${chungTuId}/mo-khoa`, { lyDo }, { needKho: false }));
    },

    /**
     * Tải tệp nén của lô về máy (đúng bản đã giao kế toán). Lỗi máy chủ trả JSON trong Blob: đọc ra để báo đúng câu.
     * Trả { ten, maBam }.
     */
    async taiTep(lo) {
        try {
            const res = await apiClient.get(`${BASE}/lo-xuat/${lo.id}/tep`, { responseType: "blob", needKho: false });
            const ten = tenTuContentDisposition(res.headers?.["content-disposition"]) || lo.tenTep || `${lo.soLo}.zip`;
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = ten;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return { ten, maBam: res.headers?.["x-ma-bam"] || lo.maBam };
        } catch (error) {
            const blob = error?.response?.data;
            if (blob instanceof Blob) {
                try {
                    const json = JSON.parse(await blob.text());
                    error.response.data = json;
                } catch {
                    // giữ nguyên lỗi gốc
                }
            }
            throw error;
        }
    },

    async layHoaDonDauVao(phieuNhapKhoId, { signal } = {}) {
        return duLieu(await apiClient.get(`${BASE}/hoa-don-dau-vao/${phieuNhapKhoId}`, { signal }));
    },
    async luuHoaDonDauVao(phieuNhapKhoId, payload) {
        return duLieu(await apiClient.put(`${BASE}/hoa-don-dau-vao/${phieuNhapKhoId}`, payload));
    },
};

/** Lấy tên tệp từ header Content-Disposition (ưu tiên filename*=UTF-8''...). */
export function tenTuContentDisposition(header) {
    if (!header) return null;
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utf8) {
        try {
            return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
        } catch {
            return null;
        }
    }
    const thuong = /filename="?([^";]+)"?/i.exec(header);
    return thuong ? thuong[1].trim() : null;
}
