import apiClient from "./apiClient";

const GOC = "/api/v1/phieu-chuyen-kho";
const duLieu = (res) => res.data?.data ?? res.data;
/** Thời gian chờ một lần tải ảnh biên bản (ảnh đã thu nhỏ dưới 1 MB; mạng điện thoại chậm vẫn đủ). */
const THOI_HAN_TAI_ANH_MS = 60000;

/**
 * Chuyển kho nội bộ theo đặc tả BA (UC-7.1): mọi bước đi qua phiếu chuyển, máy chủ tự lập phiếu xuất PX-CK, phiếu nhập
 * PN-TRF / PN-RET, biên bản giao nhận và phiếu điều chỉnh kho. Chi tiết trả kèm `quyen` (nút người đang xem được bấm).
 */
export const phieuChuyenKhoService = {
    /** Danh sách B.6: { tab, q, khoXuatId, khoNhapId, trangThai, page, size } → { content, totalElements, totalPages, soTheoTab }. */
    danhSach: (params) => apiClient.get(GOC, { params }).then(duLieu),
    chiTiet: (id) => apiClient.get(`${GOC}/${id}`).then(duLieu),
    /** { khoXuatId, khoNhapId, ghiChu, chiTietXuat: [{ bienTheSanPhamId, soLuongXuat }] } → phiếu Chờ duyệt. */
    tao: (payload) => apiClient.post(`${GOC}/create`, payload).then(duLieu),
    /** { lyDoDieuDong: BO_SUNG | CAN_BANG | TRA_VE | KHAC, ghiChuLenh } */
    duyet: (id, body) => apiClient.put(`${GOC}/${id}/duyet`, body).then(duLieu),
    /** { lyDo } (không bắt buộc) */
    huy: (id, body) => apiClient.put(`${GOC}/${id}/huy`, body ?? {}).then(duLieu),
    /**
     * "Mở phiếu nhặt" của phiếu Đã duyệt: máy chủ bảo đảm có PX-CK và phiếu nhặt của nó (phiếu duyệt trước bản phiếu nhặt
     * thì lập lúc này) → { id, soPhieuXuat, phieuNhatId, maPickList }. `phieuNhatId` null = phiếu cũ đã chọn lô tay trên
     * PX-CK: mở phiếu xuất `id` để chọn lô như trước.
     */
    phieuXuat: (id) => apiClient.post(`${GOC}/${id}/phieu-xuat`).then(duLieu),
    xacNhanXuat: (id, body) => apiClient.put(`${GOC}/${id}/xac-nhan-xuat`, body).then(duLieu),
    ghiSoXknb: (id, body) => apiClient.put(`${GOC}/${id}/ghi-so-xknb`, body).then(duLieu),
    /** Số phiếu XKNB tiếp theo của ký hiệu (số lớn nhất đã ghi + 1) → { kyHieuXknb, soPhieuXknb }. */
    soXknbTiepTheo: (kyHieu) => apiClient.get(`${GOC}/xknb/so-tiep-theo`, { params: { kyHieu } }).then(duLieu),
    nhanDu: (id) => apiClient.put(`${GOC}/${id}/nhan-du`).then(duLieu),
    /** { dong: [{ bienTheSanPhamId, loHangId, soLuongDat, soLuongHong, lyDo }], nguoiVanChuyen, thoiDiem, ketLuan } */
    nhanLech: (id, body) => apiClient.put(`${GOC}/${id}/nhan-lech`, body).then(duLieu),
    /**
     * Thêm một ảnh vào biên bản giao nhận của phiếu (multipart: file, moTa) → ảnh vừa thêm { id, url, moTa, nguoiChup,
     * ngayChup, duocXoa }. Ảnh nên thu nhỏ trước (components/chuyen-kho/anhBienBan.js thuNhoAnh): nginx nhận tối đa 1 MB.
     * `signal` (AbortSignal): nút "Bỏ qua, tải ảnh sau" / "Dừng tải" hủy lần tải đang chạy.
     */
    themAnhBienBan: (id, file, moTa, { onUploadProgress, signal } = {}) => {
        const form = new FormData();
        form.append("file", file);
        const moTaGon = String(moTa ?? "").trim();
        if (moTaGon) form.append("moTa", moTaGon);
        // postForm: apiClient mặc định gửi JSON, post() thường làm mất tệp (xem nguoiDungService.uploadAvatar)
        return apiClient
            .postForm(`${GOC}/${id}/bien-ban/anh`, form, { timeout: THOI_HAN_TAI_ANH_MS, onUploadProgress, signal })
            .then(duLieu);
    },
    xoaAnhBienBan: (id, anhId) => apiClient.delete(`${GOC}/${id}/bien-ban/anh/${anhId}`).then(duLieu),
    /** { phuongAn: GHI_GIAM_HAO_HUT | GIAO_BU_HANG, lyDo } */
    xuLyChenhLech: (id, body) => apiClient.put(`${GOC}/${id}/xu-ly-chenh-lech`, body).then(duLieu),
    nhapHoanTra: (id) => apiClient.put(`${GOC}/${id}/nhap-hoan-tra`).then(duLieu),
    /** Phiếu điều chỉnh kho ghi giảm chênh lệch (id phiếu điều chỉnh). */
    phieuDieuChinh: (id) => apiClient.get(`${GOC}/dieu-chinh/${id}`).then(duLieu),
};
