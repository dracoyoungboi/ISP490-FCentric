
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount || 0);
};


const pad2 = (n) => String(n).padStart(2, '0');
const toDate = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** "05/10/2026" — luôn đủ 2 chữ số ngày/tháng; trống hoặc sai thì "—". */
export const formatDate = (date) => {
    const d = toDate(date);
    if (!d) return '—';
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "05/10/2026 · 08:03" — cùng kiểu với utils/dateTime.js; trống hoặc sai thì "—". */
export const formatDateTime = (date) => {
    const d = toDate(date);
    if (!d) return '—';
    return `${formatDate(d)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** "1.500.000" — null, undefined, "" thì "0". */
export const formatNumber = (number) => {
    return new Intl.NumberFormat('vi-VN').format(number || 0);
};

/** Như formatNumber nhưng null/undefined (chưa có số liệu) thì "—" thay vì "0". */
export const formatNumberOrDash = (number) => {
    if (number === null || number === undefined) return '—';
    return new Intl.NumberFormat('vi-VN').format(Number(number));
};

const SO_GON = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

/**
 * Tiền rút gọn cho ô số liệu (KPI): "14,3 triệu ₫", "1,5 tỷ ₫"; dưới 1 triệu ghi đủ "999.000 ₫".
 * Bảng và dòng tổng cộng KHÔNG dùng hàm này — dùng formatCurrency để ghi đủ số.
 */
// Làm tròn 1 chữ số thập phân TRƯỚC khi chọn đơn vị, để 999,96 triệu hiện "1 tỷ" chứ không phải "1.000 triệu"
const lamTron1 = (x) => Math.round(x * 10) / 10;
const chonDonVi = (n, bac) => {
    for (const [nguong, ten] of bac) {
        if (Math.abs(lamTron1(n / nguong)) >= 1) return `${SO_GON.format(lamTron1(n / nguong))} ${ten}`;
    }
    return null;
};

export const formatCurrencyCompact = (amount) => {
    const n = Number(amount || 0);
    if (Math.abs(n) < 999_950) return formatCurrency(n);
    return `${chonDonVi(n, [[1e9, 'tỷ'], [1e6, 'triệu']])} ₫`;
};

/** Nhãn trục biểu đồ tiền: "14,3 tr", "1,5 tỷ", "500 N" (nghìn); 0 → "0". Dấu phẩy là phần thập phân. */
export const formatAxisMoney = (amount) => {
    const n = Number(amount || 0);
    if (Math.abs(n) < 999.95) return SO_GON.format(n);
    return chonDonVi(n, [[1e9, 'tỷ'], [1e6, 'tr'], [1e3, 'N']]);
};

/** Tỷ lệ phần trăm có dấu phẩy thập phân: 0.1667 → "16,7%". `value` là tỷ lệ (0–1). Không có mẫu số → "—". */
export const formatPercent = (value, digits = 1) => {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Number(value) * 100)}%`;
};
