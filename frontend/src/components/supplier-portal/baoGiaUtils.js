/**
 * Hàm thuần cho trang báo giá của nhà cung cấp (/supplier/quotation).
 *
 * QUAN TRỌNG: thứ tự dòng gửi đi phải đúng thứ tự `orderData.chiTietDonMuaHangs`.
 * DonMuaHangService.baoGiaDonMuaHang ghép đơn giá vào dòng theo VỊ TRÍ (get(i)), không theo id,
 * và từ chối khi số dòng khác. Không sắp xếp, lọc hay nhóm mảng `dong`; muốn hiển thị khác thì dùng bản sao.
 */

// Giữ đúng điều kiện cũ của trang: đơn có trangThai 4 thì chỉ xem, không cho nhập giá
export const TRANG_THAI_CHI_XEM = 4;

const soDuong = (giaTri) => Number(giaTri) > 0;

/** Dòng hiển thị/nhập giá, cùng thứ tự với orderData.chiTietDonMuaHangs. */
export const taoDongBaoGia = (orderData) =>
    (orderData?.chiTietDonMuaHangs ?? []).map((ct, i) => {
        const bt = ct.bienTheSanPham ?? {};
        const tenSanPham = bt.tenSanPham || bt.tenBienThe || bt.maSku || '';
        // Gom nhóm theo sản phẩm (chỉ để hiển thị): theo id sản phẩm nếu DTO có, không thì theo tên sản phẩm
        const idSanPham = bt.sanPham?.id ?? bt.sanPhamId ?? bt.idSanPham;
        const tenGon = tenSanPham.trim().toLocaleLowerCase('vi');
        return {
            id: ct.id,
            tenSanPham,
            khoaNhom: idSanPham != null ? `sp-${idSanPham}` : tenGon ? `ten-${tenGon}` : `dong-${i}`,
            mau: bt.mauSac?.tenMau || '',
            kichCo: bt.size?.tenSize || '',
            chatLieu: bt.chatLieu?.tenChatLieu || '',
            thuocTinh: [bt.mauSac?.tenMau, bt.size?.tenSize, bt.chatLieu?.tenChatLieu].filter(Boolean).join(' · '),
            maSku: bt.maSku || '',
            soLuongDat: Number(ct.soLuongDat) || 0,
            // BE tạo dòng với đơn giá 0 -> lần đầu ô để trống
            donGia: soDuong(ct.donGia) ? Number(ct.donGia) : '',
            // giữ cách lấy ghi chú như trang cũ
            ghiChu: ct.ghiChuNCC || ct.ghiChu || '',
        };
    });

/** Thành tiền một dòng = số lượng đặt × đơn giá (BE cũng tính theo số lượng đặt). */
export const thanhTienDong = (d) => (soDuong(d.donGia) ? d.soLuongDat * Number(d.donGia) : 0);

export const tinhTong = (dong) => ({
    soSanPham: dong.length,
    daNhapGia: dong.filter((d) => soDuong(d.donGia)).length,
    tongSoLuong: dong.reduce((s, d) => s + d.soLuongDat, 0),
    tongTien: dong.reduce((s, d) => s + thanhTienDong(d), 0),
});

/** Vị trí các dòng chưa có đơn giá hợp lệ (trống hoặc ≤ 0), theo thứ tự hiển thị. */
export const timDongThieuGia = (dong) =>
    dong.reduce((ds, d, i) => (soDuong(d.donGia) ? ds : [...ds, i]), []);

/** Câu báo lỗi của ô đơn giá, null nếu hợp lệ. */
export const loiDonGia = (donGia) => {
    if (donGia === '' || donGia == null) return 'Nhập đơn giá';
    if (!soDuong(donGia)) return 'Đơn giá phải lớn hơn 0';
    return null;
};

/** Đơn đã có dòng mang đơn giá > 0 nghĩa là nhà cung cấp đã gửi báo giá trước đó. */
export const daCoBaoGiaTruoc = (orderData) =>
    (orderData?.chiTietDonMuaHangs ?? []).some((ct) => soDuong(ct.donGia));

/** Dữ liệu gửi POST /don-mua-hang/bao-gia — giữ nguyên cấu trúc của trang cũ. */
export const taoPayloadBaoGia = (orderData, dong, ghiChu) => ({
    id: orderData.id,
    ghiChu,
    chiTietDonMuaHangBaoGias: dong.map(({ id, donGia, ghiChu: gc }) => ({ id, donGia: Number(donGia), ghiChu: gc })),
});

/**
 * Bản sao orderData mang đơn giá/ghi chú vừa gửi, chỉ để lưu vào lịch sử trình duyệt
 * (tải lại trang vẫn thấy báo giá đã gửi). Không gửi lên máy chủ.
 */
export const capNhatDonSauKhiGui = (orderData, dong, ghiChu) => ({
    ...orderData,
    ghiChuNCC: ghiChu,
    chiTietDonMuaHangs: (orderData?.chiTietDonMuaHangs ?? []).map((ct, i) => ({
        ...ct,
        donGia: Number(dong[i]?.donGia) || 0,
        ghiChuNCC: dong[i]?.ghiChu ?? '',
        ghiChu: dong[i]?.ghiChu ?? '',
    })),
});

/** Có thay đổi chưa gửi so với lúc mở trang (đơn giá, ghi chú dòng, ghi chú chung). */
export const coThayDoiChuaGui = (dongBanDau, dong, ghiChuBanDau, ghiChu) =>
    ghiChuBanDau !== ghiChu ||
    dong.some((d, i) => d.donGia !== dongBanDau[i]?.donGia || d.ghiChu !== dongBanDau[i]?.ghiChu);

/** id ô đơn giá của dòng i: bảng (từ 768px) và thẻ (dưới 768px) — trang dùng để đưa con trỏ tới dòng thiếu giá. */
export const idOGia = (i) => `bg-gia-${i}`;
export const idOGiaThe = (i) => `bg-gia-the-${i}`;
/** id ô giá chung của nhóm thứ g (nhóm đang bật "Một giá cho cả nhóm"). */
export const idOGiaNhom = (g) => `bg-gia-nhom-${g}`;
export const idOGiaNhomThe = (g) => `bg-gia-nhom-the-${g}`;

const pad2 = (n) => String(n).padStart(2, '0');

/** "14:32 · 16/10/2026" */
export const gioVaNgay = (giaTri) => {
    const d = giaTri ? new Date(giaTri) : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
