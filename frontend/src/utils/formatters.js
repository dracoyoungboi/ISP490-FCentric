
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount || 0);
};


export const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('vi-VN');
};


export const formatDateTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('vi-VN');
};

export const formatDateTimeCustom = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Convert các kiểu chuỗi datetime phổ biến sang ISO string để gửi BE
// - "2026-03-07T00:37" (value từ <input type="datetime-local">)
// - "03:33 18/02/2026" (custom "HH:mm DD/MM/YYYY")
export const parseDateTimeToIsoString = (value) => {
    if (!value) return null;
    const trimmed = String(value).trim();

    // Trường hợp 1: value đến từ input type="datetime-local", ví dụ: "2026-03-07T00:37"
    if (trimmed.includes("T") && trimmed.includes("-") && !trimmed.includes(" ")) {
        const d = new Date(trimmed);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString();
    }

    // Trường hợp 2: format "HH:mm DD/MM/YYYY", ví dụ: "03:33 18/02/2026"
    const [timePart, datePart] = trimmed.split(" ");
    if (!timePart || !datePart) return null;

    const [hour, minute] = timePart.split(":").map(Number);
    const [day, month, year] = datePart.split("/").map(Number);

    const d = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(d.getTime())) return null;

    return d.toISOString();
};


export const formatNumber = (number) => {
    return new Intl.NumberFormat('vi-VN').format(number || 0);
};
