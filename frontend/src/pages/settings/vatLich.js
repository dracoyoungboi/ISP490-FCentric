// Lịch thuế suất GTGT (cấu hình VAT_LICH, máy chủ: ThueGtgt): [{ tuNgay: "yyyy-MM-dd", thueSuat: 8 }, ...], mỗi mốc có
// hiệu lực từ tuNgay tới trước mốc kế tiếp.

export const VAT_BAT = "VAT_BAT";
export const VAT_LICH = "VAT_LICH";
export const TOI_DA_MOC = 10;

/** Đọc lịch đã lưu; hỏng thì trả mảng rỗng (màn cấu hình cho sửa lại). */
export function docLich(json) {
  try {
    const ds = JSON.parse(json || "[]");
    if (!Array.isArray(ds)) return [];
    return ds
      .map((m) => ({ tuNgay: String(m?.tuNgay ?? ""), thueSuat: m?.thueSuat == null ? "" : String(m.thueSuat) }))
      .sort((a, b) => a.tuNgay.localeCompare(b.tuNgay));
  } catch {
    return [];
  }
}

/** Lỗi của lịch đang sửa (cùng quy tắc máy chủ); "" = hợp lệ. */
export function loiLich(ds) {
  if (!ds.length) return "Cần ít nhất một mốc thuế suất.";
  if (ds.length > TOI_DA_MOC) return `Tối đa ${TOI_DA_MOC} mốc.`;
  const ngay = new Set();
  for (const m of ds) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.tuNgay) || Number.isNaN(Date.parse(m.tuNgay))) return "Chọn ngày bắt đầu cho mọi mốc.";
    if (ngay.has(m.tuNgay)) return `Hai mốc trùng ngày ${m.tuNgay.split("-").reverse().join("/")}.`;
    ngay.add(m.tuNgay);
    const s = String(m.thueSuat).trim().replace(",", ".");
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s) || Number(s) > 100) return "Thuế suất là số từ 0 đến 100, tối đa 2 chữ số thập phân.";
  }
  return "";
}

/** Chuỗi lưu cấu hình: xếp theo ngày, thuế suất dạng số. */
export function ghiLich(ds) {
  return JSON.stringify([...ds]
    .sort((a, b) => a.tuNgay.localeCompare(b.tuNgay))
    .map((m) => ({ tuNgay: m.tuNgay, thueSuat: Number(String(m.thueSuat).trim().replace(",", ".")) })));
}

/** Thuế suất áp dụng vào ngày (yyyy-MM-dd); trước mốc đầu tiên thì null. */
export function thueSuatTai(ds, ngay) {
  let kq = null;
  for (const m of [...ds].sort((a, b) => a.tuNgay.localeCompare(b.tuNgay))) {
    if (m.tuNgay > ngay) break;
    kq = Number(String(m.thueSuat).replace(",", "."));
  }
  return kq;
}

/** Tiền thuế tách ngược từ tổng đã gồm thuế, làm tròn tới đồng (ví dụ trên màn cấu hình). */
export function tienThue(tong, thueSuat) {
  if (!thueSuat) return 0;
  return Math.round((tong * thueSuat) / (100 + thueSuat));
}
