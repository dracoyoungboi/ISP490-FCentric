import { t } from "../../i18n/t.js";
/**
 * Gom dòng báo giá theo sản phẩm và công tắc "Một giá cho cả nhóm" (PA3, chốt 16/10/2026).
 *
 * Tất cả CHỈ là cách hiển thị và cách nhập: mảng `dong` vẫn giữ nguyên thứ tự orderData.chiTietDonMuaHangs
 * (backend ghép đơn giá theo vị trí). Bật công tắc nghĩa là điền cùng một số vào `donGia` của từng dòng trong nhóm;
 * dữ liệu gửi đi vẫn là từng dòng như trước. Các hàm ở đây không sửa mảng đầu vào, luôn trả mảng mới.
 */

const coGia = (g) => g !== '' && g != null;
const giong = (a, b) => (coGia(a) ? Number(a) : '') === (coGia(b) ? Number(b) : '');

/**
 * Gom dòng theo `khoaNhom` (thứ tự nhóm = thứ tự xuất hiện đầu tiên, dòng trong nhóm giữ thứ tự gốc).
 * Thuộc tính giống nhau ở mọi dòng (màu, kích cỡ, chất liệu) lên dòng nhóm; phần khác nhau làm nhãn từng dòng.
 * @returns {{ khoa: string, tenSanPham: string, viTri: number[], thuocTinhChung: string, nhan: Record<number, string> }[]}
 */
export function nhomTheoSanPham(dong) {
    const theoKhoa = new Map();
    dong.forEach((d, i) => {
        const khoa = d.khoaNhom || `dong-${i}`;
        if (!theoKhoa.has(khoa)) theoKhoa.set(khoa, { khoa, tenSanPham: d.tenSanPham, viTri: [] });
        theoKhoa.get(khoa).viTri.push(i);
    });
    const TRUONG = ['mau', 'kichCo', 'chatLieu'];
    return [...theoKhoa.values()].map((n) => {
        const cacDong = n.viTri.map((i) => dong[i]);
        const chung = TRUONG.filter((truong) => cacDong.every((d) => (d[truong] || '') === (cacDong[0][truong] || '')));
        const thuocTinhChung = chung.map((truong) => cacDong[0][truong]).filter(Boolean).join(' · ');
        const nhan = {};
        n.viTri.forEach((i) => {
            const rieng = TRUONG.filter((truong) => !chung.includes(truong)).map((truong) => dong[i][truong]).filter(Boolean).join(' · ');
            nhan[i] = rieng || dong[i].thuocTinh || dong[i].maSku || dong[i].tenSanPham;
        });
        return { ...n, thuocTinhChung, nhan };
    });
}

/** Giá chung của nhóm nếu mọi dòng cùng một giá (kể cả cùng trống ''), ngược lại null. */
export function giaChung(dong, viTri) {
    if (!viTri.length) return null;
    const dau = dong[viTri[0]].donGia;
    return viTri.every((i) => giong(dong[i].donGia, dau)) ? (coGia(dau) ? Number(dau) : '') : null;
}

/**
 * Trạng thái công tắc lúc mở trang: nhóm nhiều dòng mà mọi dòng cùng giá (đơn mới: cùng trống) thì bật;
 * giá khác nhau thì tắt để không mất giá riêng. Nhóm một dòng không có công tắc.
 */
export function congTacBanDau(dong, nhom) {
    const kq = {};
    nhom.forEach((n) => {
        kq[n.khoa] = n.viTri.length > 1 && giaChung(dong, n.viTri) !== null;
    });
    return kq;
}

/** Giá xuất hiện nhiều nhất trong nhóm (chỉ tính giá hợp lệ > 0); hòa thì lấy giá gặp trước. Không có giá nào: ''. */
export function giaPhoBien(dong, viTri) {
    const dem = new Map();
    viTri.forEach((i) => {
        const g = Number(dong[i].donGia);
        if (coGia(dong[i].donGia) && g > 0) dem.set(g, (dem.get(g) || 0) + 1);
    });
    let tot = '';
    let soLan = 0;
    dem.forEach((n, g) => {
        if (n > soLan) {
            tot = g;
            soLan = n;
        }
    });
    return tot;
}

/** Điền cùng một giá cho mọi dòng trong nhóm. */
export function apGiaNhom(dong, viTri, gia) {
    const tap = new Set(viTri);
    return dong.map((d, i) => (tap.has(i) ? { ...d, donGia: gia } : d));
}

/**
 * Bật công tắc. Các dòng đang cùng giá: giữ nguyên. Đang khác giá: dùng giá phổ biến nhất,
 * trả kèm `thayDoi` (giá cũ từng dòng) để báo cho người dùng và hoàn tác.
 * @returns {{ dong: object[], thayDoi: null | { gia: number|'', cu: { viTri: number, gia: number|'' }[] } }}
 */
export function batMotGia(dong, viTri) {
    if (giaChung(dong, viTri) !== null) return { dong, thayDoi: null };
    const gia = giaPhoBien(dong, viTri);
    const cu = viTri.map((i) => ({ viTri: i, gia: dong[i].donGia }));
    return { dong: apGiaNhom(dong, viTri, gia), thayDoi: { gia, cu } };
}

/** Khôi phục giá cũ đã lưu trong `thayDoi.cu` (hoàn tác). */
export function khoiPhucGia(dong, cu) {
    const theoViTri = new Map(cu.map((c) => [c.viTri, c.gia]));
    return dong.map((d, i) => (theoViTri.has(i) ? { ...d, donGia: theoViTri.get(i) } : d));
}

// Giới hạn số chữ số như ô nhập tiền (docTien trong logicBienThe: tối đa 13 chữ số)
const SO_CHU_SO_TOI_DA = 13;

// Khoảng trắng chỉ được làm dấu phân cách hàng nghìn: "79 000", "1 250 000" (kể cả khoảng trắng không ngắt dòng)
const SO_CO_KHOANG_TRANG = /^\d{1,3}(\s\d{3})+([.,]\d{1,2})?$/;

/**
 * Đọc một giá dán vào ô (chép từ email, tin nhắn, bảng tính): "185.000", "185,000", "185000", "185.000 ₫", "1,250,000.00", "79 000".
 * Dấu chấm/phẩy cuối cùng có 1–2 chữ số phía sau là phần lẻ (bỏ đi, tiền VND không có phần lẻ);
 * các dấu còn lại là phân cách hàng nghìn. Ô trống, chữ, số âm, quá dài, hai số cách nhau ("185000 190000"): null.
 */
export function docGiaDan(chuoi) {
    const s = String(chuoi ?? '').trim();
    if (!s || s.includes('-')) return null;
    let gon = s.replace(/(vnd|vnđ|₫|đ)/gi, '').trim();
    if (/\s/.test(gon)) {
        if (!SO_CO_KHOANG_TRANG.test(gon)) return null;
        gon = gon.replace(/\s/g, '');
    }
    if (!/^[\d.,]+$/.test(gon) || !/\d/.test(gon)) return null;
    const phanNguyen = gon.replace(/[.,]\d{1,2}$/, '');
    const chuSo = phanNguyen.replace(/[.,]/g, '');
    if (!chuSo || chuSo.length > SO_CHU_SO_TOI_DA) return null;
    return Number(chuSo);
}

/**
 * Gọi tên phân loại của nhóm cho dễ hiểu: các dòng chỉ khác kích cỡ → "kích cỡ", chỉ khác màu → "màu",
 * còn lại (khác nhiều thuộc tính hoặc thiếu thuộc tính) → "phân loại".
 */
/** Ngữ cảnh i18n của tên loại phân loại (tiếng Anh số ít, câu đếm tự thêm số nhiều): khóa "<từ>_nhom". */
export const NGU_CANH_LOAI = { context: "nhom" };

export function tenLoaiPhanLoai(dong, viTri) {
    if (viTri.length < 2) return t("phân loại", NGU_CANH_LOAI);
    const dau = dong[viTri[0]];
    const khac = ['mau', 'kichCo', 'chatLieu'].filter((truong) => viTri.some((i) => (dong[i][truong] || '') !== (dau[truong] || '')));
    if (khac.length === 1 && khac[0] === 'kichCo') return t("kích cỡ", NGU_CANH_LOAI);
    if (khac.length === 1 && khac[0] === 'mau') return t("màu", NGU_CANH_LOAI);
    return t("phân loại", NGU_CANH_LOAI);
}

/**
 * Nối tên các nhóm còn thiếu giá: "A", "A, B", "A và 3 sản phẩm khác".
 * @param {string[]} ten tên theo thứ tự hiển thị
 */
export function noiTenNhom(ten, toiDa = 2) {
    if (ten.length <= toiDa) return ten.join(', ');
    return t("{{dsTen}} và {{count}} sản phẩm khác", { dsTen: ten.slice(0, toiDa - 1).join(', '), count: ten.length - toiDa + 1 });
}

/** Tên các nhóm (theo thứ tự hiển thị) có ít nhất một dòng nằm trong `viTriCanTim`. */
export function tenNhomChua(nhom, viTriCanTim) {
    const tap = new Set(viTriCanTim);
    return nhom.filter((n) => n.viTri.some((i) => tap.has(i))).map((n) => n.tenSanPham);
}

/** Bỏ dấu, chữ thường: "Áo Thun" → "ao thun" (tìm kiếm không phân biệt dấu). */
export const boDau = (s) =>
    String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

/** Nhóm khớp từ khóa (tên sản phẩm, thuộc tính hoặc mã SKU của bất kỳ dòng nào). */
export function nhomKhopTuKhoa(n, dong, tuKhoa) {
    const k = boDau(tuKhoa);
    if (!k) return true;
    if (boDau(n.tenSanPham).includes(k) || boDau(n.thuocTinhChung).includes(k)) return true;
    return n.viTri.some((i) => boDau(dong[i].maSku).includes(k) || boDau(n.nhan[i]).includes(k));
}
