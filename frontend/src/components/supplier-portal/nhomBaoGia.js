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
        const chung = TRUONG.filter((t) => cacDong.every((d) => (d[t] || '') === (cacDong[0][t] || '')));
        const thuocTinhChung = chung.map((t) => cacDong[0][t]).filter(Boolean).join(' · ');
        const nhan = {};
        n.viTri.forEach((i) => {
            const rieng = TRUONG.filter((t) => !chung.includes(t)).map((t) => dong[i][t]).filter(Boolean).join(' · ');
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

/** Thứ tự dòng đang hiện trên màn hình (theo nhóm), dùng cho dán nhiều giá và tìm ô thiếu giá đầu tiên. */
export const thuTuHienThi = (nhom) => nhom.flatMap((n) => n.viTri);

// Giới hạn số chữ số như ô nhập tiền (docTien trong logicBienThe: tối đa 13 chữ số)
const SO_CHU_SO_TOI_DA = 13;

// Khoảng trắng chỉ được làm dấu phân cách hàng nghìn: "79 000", "1 250 000" (kể cả khoảng trắng không ngắt dòng)
const SO_CO_KHOANG_TRANG = /^\d{1,3}(\s\d{3})+([.,]\d{1,2})?$/;

/**
 * Đọc một ô giá chép từ Excel/Google Sheets: "185.000", "185,000", "185000", "185.000 ₫", "1,250,000.00", "79 000".
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

/** Câu báo khi nội dung dán có nhiều cột số (cheDo "nhieu-cot"), dùng chung cho ô bảng và hộp "Dán giá từ Excel". */
export const LOI_NHIEU_COT =
    'Nội dung vừa dán có nhiều cột số nên không biết cột nào là đơn giá. Chỉ chép một cột Đơn giá, hoặc hai cột Mã SKU và Đơn giá.';

/**
 * Tách một dòng dán thành các ô: Tab (chép từ Excel / Google Sheets); không có Tab thì thử dấu ";" hoặc "|"
 * (CSV kiểu châu Âu, bảng chép từ tài liệu). Dấu phẩy không dùng để tách vì trùng dấu phân cách hàng nghìn.
 */
const tachO = (dongVan) => (dongVan.includes('\t') ? dongVan.split('\t') : /[;|]/.test(dongVan) ? dongVan.split(/[;|]/) : [dongVan]);

// Phần số tiền ở cuối một ô có chữ: "Quần jean 21 Inch 100.000" → "100.000". Thử kiểu có khoảng trắng hàng nghìn
// ("100 000") trước, không đọc được (vd. "Size 30 100.000" bị dính "30") thì thử kiểu chỉ có dấu chấm/phẩy.
const SO_CUOI_O = [
    /(\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:₫|đ|vnđ|vnd)?\s*$/i,
    /(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:₫|đ|vnđ|vnd)?\s*$/i,
];

/** Giá trong các ô còn lại của dòng: ô đọc được nằm xa nhất bên phải; không ô nào đọc thẳng được thì lấy số ở cuối ô. */
function giaTrongCacO(cacO) {
    for (let k = cacO.length - 1; k >= 0; k -= 1) {
        const gia = docGiaDan(cacO[k]);
        if (gia !== null) return gia;
    }
    for (let k = cacO.length - 1; k >= 0; k -= 1) {
        for (const mau of SO_CUOI_O) {
            const so = String(cacO[k]).trim().match(mau);
            const gia = so ? docGiaDan(so[0]) : null;
            if (gia !== null) return gia;
        }
    }
    return null;
}

// Dòng tiêu đề cột: có chữ nhưng không có chữ số nào ("Mã SKU  Đơn giá"). Dòng có số (mã hàng, giá) không phải tiêu đề.
const laTieuDe = (o) => o.some((c) => /\p{L}/u.test(c)) && !o.some((c) => /\d/.test(c));

// Từ trông như mã hàng (có cả chữ và số, ví dụ "QJ2610141-CL003-21"): dùng để báo "không khớp mã" thay cho "không đọc được"
const giongMaHang = (tu) => tu.length >= 4 && /\p{L}/u.test(tu) && /\d/.test(tu);

/**
 * Phân tích nội dung dán. Ba kết quả:
 * - "theo-sku": có dòng chứa mã SKU của đơn → ghép theo mã. Mã và giá có thể nằm ở hai ô (Tab, ";", "|")
 *   hoặc cùng một ô cách nhau bằng dấu cách ("QJ-21 100.000"). Giá là ô đọc được xa nhất bên phải.
 *   Dòng tiêu đề (có chữ, không mã, không số) bỏ đi.
 * - "theo-thu-tu": một cột giá (có thể kèm cột chữ như tên sản phẩm) → điền lần lượt từ ô đang chọn xuống.
 *   `coMaLa: true` khi nội dung có từ trông như mã hàng nhưng không trùng mã nào của đơn.
 * - "nhieu-cot": có dòng mang từ hai ô số trở lên mà không có mã SKU (vd. STT + Đơn giá, SL + Đơn giá) →
 *   không đoán cột nào là giá, không điền gì (tránh lấy nhầm số thứ tự hay số lượng làm đơn giá).
 */
export function phanTichNoiDungDan(van, dong) {
    const cacDong = String(van ?? '').replace(/\r\n?/g, '\n').split('\n');
    while (cacDong.length && cacDong[cacDong.length - 1].trim() === '') cacDong.pop();
    const skuCuaDon = new Map();
    dong.forEach((d) => {
        if (d.maSku) skuCuaDon.set(d.maSku.trim().toLowerCase(), d.maSku);
    });
    const laSku = (chu) => skuCuaDon.has(String(chu).trim().toLowerCase());
    const oCuaDong = cacDong.map(tachO);

    /** Mã SKU của dòng và các ô còn lại (đã bỏ phần mã). */
    const timSku = (o) => {
        const oSku = o.find(laSku);
        if (oSku !== undefined) return { sku: skuCuaDon.get(oSku.trim().toLowerCase()), conLai: o.filter((c) => c !== oSku) };
        for (const c of o) {
            const tu = c.trim().split(/\s+/);
            const k = tu.findIndex(laSku);
            if (k >= 0) {
                return { sku: skuCuaDon.get(tu[k].toLowerCase()), conLai: [...o.filter((x) => x !== c), tu.filter((_, j) => j !== k).join(' ')] };
            }
        }
        return null;
    };

    const theoMa = oCuaDong.map(timSku);
    if (theoMa.some(Boolean)) {
        const muc = oCuaDong.map((o, k) => ({
            sku: theoMa[k]?.sku ?? null,
            gia: giaTrongCacO(theoMa[k]?.conLai ?? o),
            tieuDe: laTieuDe(o),
        }));
        if (muc.length && !muc[0].sku && muc[0].gia === null && muc[0].tieuDe) muc.shift();
        return { cheDo: 'theo-sku', muc: muc.map(({ sku, gia }) => ({ sku, gia })) };
    }
    const muc = oCuaDong.map((o) => {
        const so = o.map(docGiaDan).filter((g) => g !== null);
        return { sku: null, gia: so.length === 1 ? so[0] : null, coChu: o.some((c) => /\p{L}/u.test(c)), tieuDe: laTieuDe(o), nhieuSo: so.length > 1 };
    });
    // Dòng đầu là tiêu đề cột (vd. "Đơn giá") thì bỏ, không tính là một dòng
    if (muc.length && muc[0].gia === null && muc[0].tieuDe) muc.shift();
    if (muc.some((m) => m.nhieuSo)) return { cheDo: 'nhieu-cot', muc: [] };
    const coMaLa = cacDong.some((l) => l.split(/[\s;|]+/).some(giongMaHang));
    return { cheDo: 'theo-thu-tu', coMaLa, muc: muc.map(({ sku, gia, coChu }) => ({ sku, gia, coChu })) };
}

/** Câu báo khi dán có mã hàng nhưng không trùng mã SKU nào của đơn. */
export const LOI_KHONG_KHOP_MA =
    'Không thấy mã SKU nào của đơn này trong nội dung vừa dán. Kiểm tra lại mã (xem cột Mã SKU trong bảng), hoặc chỉ chép cột Đơn giá.';

/**
 * Áp nội dung đã phân tích vào `dong`.
 * - theo-thu-tu: điền lần lượt các dòng trong `thuTu` (thứ tự hiển thị), bắt đầu tại dòng `batDau`;
 *   ô trống/không đọc được thì bỏ qua dòng đó (giữ giá cũ).
 * - theo-sku: điền mọi dòng có mã khớp.
 * @returns {{ dong: object[], daDien: number[], boQua: number, thua: number }}
 */
export function apNoiDungDan(dong, phanTich, thuTu, batDau) {
    const moi = dong.map((d) => ({ ...d }));
    const daDien = [];
    let boQua = 0;
    let thua = 0;
    if (phanTich.cheDo === 'theo-sku') {
        phanTich.muc.forEach(({ sku, gia }) => {
            if (!sku || gia === null) {
                boQua += 1;
                return;
            }
            moi.forEach((d, i) => {
                if (d.maSku === sku) {
                    d.donGia = gia;
                    daDien.push(i);
                }
            });
        });
    } else {
        const tu = Math.max(0, thuTu.indexOf(batDau));
        phanTich.muc.forEach(({ gia }, k) => {
            const i = thuTu[tu + k];
            if (i === undefined) {
                thua += 1;
                return;
            }
            if (gia === null) {
                boQua += 1;
                return;
            }
            moi[i].donGia = gia;
            daDien.push(i);
        });
    }
    return { dong: moi, daDien: [...new Set(daDien)], boQua, thua };
}

/**
 * Sau khi dán: nhóm đang bật công tắc mà các dòng giờ khác giá thì phải tắt (để giữ đúng giá đã dán).
 * @returns {string[]} khóa các nhóm cần tắt
 */
export function nhomCanTatSauKhiDan(dong, nhom, motGia) {
    return nhom.filter((n) => motGia[n.khoa] && n.viTri.length > 1 && giaChung(dong, n.viTri) === null).map((n) => n.khoa);
}

/**
 * Gọi tên phân loại của nhóm cho dễ hiểu: các dòng chỉ khác kích cỡ → "kích cỡ", chỉ khác màu → "màu",
 * còn lại (khác nhiều thuộc tính hoặc thiếu thuộc tính) → "phân loại".
 */
export function tenLoaiPhanLoai(dong, viTri) {
    if (viTri.length < 2) return 'phân loại';
    const dau = dong[viTri[0]];
    const khac = ['mau', 'kichCo', 'chatLieu'].filter((t) => viTri.some((i) => (dong[i][t] || '') !== (dau[t] || '')));
    if (khac.length === 1 && khac[0] === 'kichCo') return 'kích cỡ';
    if (khac.length === 1 && khac[0] === 'mau') return 'màu';
    return 'phân loại';
}

/**
 * Nối tên các nhóm còn thiếu giá: "A", "A, B", "A và 3 sản phẩm khác".
 * @param {string[]} ten tên theo thứ tự hiển thị
 */
export function noiTenNhom(ten, toiDa = 2) {
    if (ten.length <= toiDa) return ten.join(', ');
    return `${ten.slice(0, toiDa - 1).join(', ')} và ${ten.length - toiDa + 1} sản phẩm khác`;
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
