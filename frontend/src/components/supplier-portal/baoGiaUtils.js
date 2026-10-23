/**
 * Hàm thuần cho trang báo giá của nhà cung cấp (/supplier/quotation).
 *
 * Máy chủ ghép đơn giá vào dòng theo id dòng (`chiTietDonMuaHangId`, HOP-DONG 2.2), không theo vị trí; dòng đơn mua
 * đến từ máy chủ đã xếp theo id tăng dần (cùng số thứ tự với email yêu cầu báo giá).
 * Chỉ một ghi chú cho cả báo giá (cột ghi_chu_nha_cung_cap); không có ghi chú theo từng dòng.
 */

/** Trạng thái đơn mua còn nhận báo giá (2). Trạng thái khác: trang chỉ xem. */
export const TRANG_THAI_NHAN_BAO_GIA = 2;

/** Đơn giá tối đa một dòng, khớp kiểm tra của máy chủ khi nhận báo giá (đặc tả 6.2, bước 3). */
export const DON_GIA_TOI_DA = 9_999_999_999;

/** Số ký tự tối đa của ghi chú gửi kèm báo giá, khớp máy chủ (đặc tả 6.2, bước 3). */
export const GHI_CHU_TOI_DA = 2000;

/** Múi giờ hiện giờ gửi báo giá: giờ Việt Nam như email Đã nhận báo giá (đặc tả mục 2, Định dạng). */
export const MUI_GIO_VIET_NAM = "Asia/Ho_Chi_Minh";

const soDuong = (giaTri) => Number(giaTri) > 0;

/** Đơn còn nhận báo giá (trạng thái 2). */
export const laDonNhanBaoGia = (orderData) => Number(orderData?.trangThai) === TRANG_THAI_NHAN_BAO_GIA;

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

/** Câu báo lỗi của ô đơn giá, null nếu hợp lệ. */
export const loiDonGia = (donGia) => {
    if (donGia === '' || donGia == null) return 'Nhập đơn giá';
    if (!soDuong(donGia)) return 'Đơn giá phải lớn hơn 0';
    if (Number(donGia) > DON_GIA_TOI_DA) return `Đơn giá tối đa ${DON_GIA_TOI_DA.toLocaleString('vi-VN')} ₫`;
    return null;
};

/** Vị trí các dòng có đơn giá chưa hợp lệ (trống, ≤ 0, quá mức tối đa), theo thứ tự hiển thị. */
export const timDongThieuGia = (dong) =>
    dong.reduce((ds, d, i) => (loiDonGia(d.donGia) ? [...ds, i] : ds), []);

/** Nhà cung cấp đã gửi báo giá cho đơn này trước đó: máy chủ ghi `ngayBaoGia` mỗi lần nhận báo giá. */
export const daCoBaoGiaTruoc = (orderData) => Boolean(orderData?.ngayBaoGia);

/**
 * Thẻ trạng thái cạnh tiêu đề trang báo giá:
 * - `'da-gui'`: vừa gửi trong phiên này, hoặc đã gửi báo giá trước đó (`ngayBaoGia`, HOP-DONG 2.3) và đơn còn nhận
 *   báo giá (vào lại cổng để sửa giá) — không gọi là "Chờ báo giá" khi khung ngay dưới nói đã gửi;
 * - `'cho-bao-gia'`: còn nhận báo giá, chưa báo giá;
 * - `null`: máy chủ vừa báo không còn nhận mà đơn trên trang vẫn ở 2 (chưa biết trạng thái mới): không hiện thẻ;
 * - `'theo-don'`: đơn không còn nhận báo giá: tên trạng thái chung của đơn mua hàng.
 */
export const loaiNhanTrangThaiCong = ({ daGui, chiXem, daBaoGiaTruoc, donConNhanBaoGia }) => {
    if (daGui || daBaoGiaTruoc) return 'da-gui';
    if (!chiXem) return 'cho-bao-gia';
    return donConNhanBaoGia ? null : 'theo-don';
};

/**
 * Dữ liệu gửi POST /don-mua-hang/bao-gia. Mỗi dòng gửi cả `chiTietDonMuaHangId` và `id` (cùng giá trị: id dòng
 * chi_tiet_don_mua_hang, HOP-DONG 6.13) để máy chủ ghép giá theo id. Ghi chú chung đã cắt khoảng trắng.
 */
export const taoPayloadBaoGia = (orderData, dong, ghiChu) => ({
    id: orderData.id,
    ghiChu: String(ghiChu ?? '').trim(),
    chiTietDonMuaHangBaoGias: dong.map(({ id, donGia }) => ({ id, chiTietDonMuaHangId: id, donGia: Number(donGia) })),
});

/**
 * Bản sao orderData mang đơn giá, ghi chú và giờ nhận báo giá của máy chủ vừa gửi, chỉ để lưu vào lịch sử trình duyệt
 * (tải lại trang vẫn thấy báo giá đã gửi). Ghép theo id dòng. Không gửi lên máy chủ.
 */
export const capNhatDonSauKhiGui = (orderData, dong, ghiChu, ngayBaoGia) => {
    const giaTheoId = new Map(dong.map((d) => [d.id, Number(d.donGia) || 0]));
    return {
        ...orderData,
        ghiChuNCC: String(ghiChu ?? '').trim(),
        ngayBaoGia: ngayBaoGia ?? orderData?.ngayBaoGia ?? null,
        chiTietDonMuaHangs: (orderData?.chiTietDonMuaHangs ?? []).map((ct) => ({
            ...ct,
            donGia: giaTheoId.has(ct.id) ? giaTheoId.get(ct.id) : ct.donGia,
        })),
    };
};

/** Có thay đổi chưa gửi so với lúc mở trang (đơn giá, ghi chú chung). */
export const coThayDoiChuaGui = (dongBanDau, dong, ghiChuBanDau, ghiChu) =>
    ghiChuBanDau !== ghiChu || dong.some((d, i) => d.donGia !== dongBanDau[i]?.donGia);

/** id ô đơn giá của dòng i: bảng (từ 768px) và thẻ (dưới 768px) — trang dùng để đưa con trỏ tới dòng thiếu giá. */
export const idOGia = (i) => `bg-gia-${i}`;
export const idOGiaThe = (i) => `bg-gia-the-${i}`;
/** id ô giá chung của nhóm thứ g (nhóm đang bật "Một giá cho cả nhóm"). */
export const idOGiaNhom = (g) => `bg-gia-nhom-${g}`;
export const idOGiaNhomThe = (g) => `bg-gia-nhom-the-${g}`;

const DINH_DANG_GIO = new Intl.DateTimeFormat('vi-VN', {
    timeZone: MUI_GIO_VIET_NAM,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hourCycle: 'h23',
});

/** "14:32 · 16/10/2026", giờ Việt Nam (không theo múi giờ máy nhà cung cấp). */
export const gioVaNgay = (giaTri) => {
    const d = giaTri ? new Date(giaTri) : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    const p = Object.fromEntries(DINH_DANG_GIO.formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.hour}:${p.minute} · ${p.day}/${p.month}/${p.year}`;
};
