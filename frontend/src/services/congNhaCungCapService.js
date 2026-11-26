import axios from 'axios';
import { API_BASE_URL } from '../config/apiBase';
import { ngonNguHienTai } from '../i18n/t';
import { ghiCauGoc } from "../i18n/cauGoc.js";
import { getApiErrorCode } from '../utils/apiError.js';
import { HEADER_PHIEN_CONG, docPhien, xoaPhien } from '../components/supplier-portal/phienCong.js';

/*
 * API của cổng nhà cung cấp (/api/v1/cong-ncc, công khai, không dùng tài khoản nhân viên).
 *
 * Axios riêng: KHÔNG gắn interceptor của apiClient (token, kho, xử lý "bị khóa" và 401 của nhân viên). Nhờ vậy lỗi của
 * cổng không xóa phiên của nhân viên đang đăng nhập cùng trình duyệt, cũng không chuyển sang trang đăng nhập nội bộ.
 * Mọi API sau đăng nhập gửi kèm header X-Phien-Cong-Ncc (phiên lưu ở supplier-portal/phienCong.js).
 * Lỗi trả nguyên cho trang xử lý theo mã (components/supplier-portal/loiCong.js); riêng PHIEN_HET_HAN thì xóa phiên
 * ngay tại đây để mọi trang sau đó đều về trang nhận mã.
 */
const apiCong = axios.create({
    baseURL: `${API_BASE_URL}/api/v1/cong-ncc`,
    headers: { 'Content-Type': 'application/json' },
});
apiCong.interceptors.request.use((config) => {
    config.headers['Accept-Language'] = ngonNguHienTai();
    const phien = docPhien()?.phien;
    if (phien && !config.khongGuiPhien) config.headers[HEADER_PHIEN_CONG] = phien;
    return config;
});
apiCong.interceptors.response.use(undefined, (error) => {
    ghiCauGoc(error?.response?.data);
    if (getApiErrorCode(error) === 'PHIEN_HET_HAN') xoaPhien();
    return Promise.reject(error);
});

const data = (res) => res.data?.data ?? null;

const congNhaCungCapService = {
    /** Gửi mã đăng nhập tới email. `data` = { hetHanGiay, guiLaiSauGiay }. Trả cả ResponseData. */
    layMa: async (email) => (await apiCong.post('/dang-nhap/lay-ma', { email }, { khongGuiPhien: true })).data,

    /** Xác nhận mã. `data` = { phien, hetHanPhien, nhaCungCap: { ten, email }, cuaHang: { ten, logoUrl } }. */
    xacNhanMa: async (email, ma) => (await apiCong.post('/dang-nhap/xac-nhan', { email, ma }, { khongGuiPhien: true })).data,

    dangXuat: async () => {
        await apiCong.post('/dang-xuat');
    },

    /** { nhaCungCap, bienBanCho, donChoBaoGia, soLieu30Ngay, nguoiPhuTrach } */
    viecCanLam: async (signal) => data(await apiCong.get('/viec-can-lam', { signal })),

    /** { donMua, cuaHang } — donMua cùng dạng đơn của trang báo giá cũ. */
    donMua: async (id, signal) => data(await apiCong.get(`/don-mua/${encodeURIComponent(id)}`, { signal })),

    /**
     * Gửi báo giá (payload dựng ở supplier-portal/baoGiaUtils.taoPayloadBaoGia).
     * `data` = { ngayBaoGia, tongTien, emailXacNhan }. Trả cả ResponseData.
     */
    guiBaoGia: async (id, payload) => (await apiCong.post(`/don-mua/${encodeURIComponent(id)}/bao-gia`, payload)).data,

    /** BienBanCong */
    bienBan: async (id, signal) => data(await apiCong.get(`/bien-ban/${encodeURIComponent(id)}`, { signal })),

    /** { phuongAn: "DOI_HANG" | "TRU_CONG_NO", nguoiXacNhan, ghiChu } → BienBanCong sau khi ghi nhận. */
    xacNhanBienBan: async (id, payload) => data(await apiCong.post(`/bien-ban/${encodeURIComponent(id)}/xac-nhan`, payload)),

    /** { items, tomTat }. tuNgay / denNgay yyyy-mm-dd, bỏ trống = không giới hạn đầu đó (cả hai trống: mọi thời gian). */
    lichSuBaoGia: async ({ tuNgay, denNgay, tuKhoa }, signal) =>
        data(await apiCong.get('/lich-su/bao-gia', { params: thamSoLichSu(tuNgay, denNgay, tuKhoa), signal })),

    /** { items, tomTat }; tham số như lichSuBaoGia. */
    lichSuTraHang: async ({ tuNgay, denNgay, tuKhoa }, signal) =>
        data(await apiCong.get('/lich-su/tra-hang', { params: thamSoLichSu(tuNgay, denNgay, tuKhoa), signal })),
};

function thamSoLichSu(tuNgay, denNgay, tuKhoa) {
    const p = {};
    if (tuNgay) p.tuNgay = tuNgay;
    if (denNgay) p.denNgay = denNgay;
    const k = String(tuKhoa ?? '').trim();
    if (k) p.tuKhoa = k;
    return p;
}

export default congNhaCungCapService;
