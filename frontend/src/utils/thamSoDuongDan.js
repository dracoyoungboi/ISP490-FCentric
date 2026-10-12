/*
 * Tham số trên đường dẫn dùng để mở sẵn form (ví dụ từ đề xuất bổ sung ở Tổng quan).
 * Giá trị đọc từ đường dẫn luôn có thể bị sửa tay, nên mọi chỗ đọc đều phải kiểm tra lại.
 */

/** Ghép đường dẫn kèm tham số; bỏ qua giá trị rỗng, null, undefined. */
export function duongDanKemThamSo(duongDan, thamSo = {}) {
    const q = new URLSearchParams();
    for (const [khoa, giaTri] of Object.entries(thamSo)) {
        if (giaTri === undefined || giaTri === null || giaTri === "") continue;
        q.set(khoa, String(giaTri));
    }
    const chuoi = q.toString();
    return chuoi ? `${duongDan}?${chuoi}` : duongDan;
}

/** Số nguyên dương (1 đến toiDa) đọc từ đường dẫn; thiếu hoặc sai thì trả về macDinh. */
export function soNguyenDuong(giaTri, macDinh = 1, toiDa = 1_000_000) {
    if (giaTri === undefined || giaTri === null || String(giaTri).trim() === "") return macDinh;
    const so = Number(String(giaTri).trim());
    if (!Number.isFinite(so) || so < 1) return macDinh;
    return Math.min(Math.floor(so), toiDa);
}
