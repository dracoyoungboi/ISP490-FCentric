// Khối Cần bổ sung của màn Tổng quan (gom theo sản phẩm): thuần dữ liệu để kiểm thử bằng node --test.

/** Đơn vị của cỡ dạng số + đơn vị ("21 Inch" → "Inch", "28,5 cm" → "cm"); cỡ dạng khác ("Free Size", "M") thì null. */
function duoiCo(tenKichCo) {
  const m = String(tenKichCo ?? "").trim().match(/^\d+(?:[.,]\d+)?\s+(\S+)$/);
  return m ? m[1] : null;
}

/**
 * Tóm tắt các mã của một nhóm theo màu, giữ thứ tự gặp: "Xanh dương 21 · 22 · 23 / Xám 21 · 22 · 23 Inch".
 * Mọi cỡ đều là số cùng một đơn vị (vd. "Inch") thì ghi đơn vị một lần ở cuối; mã không có màu chỉ ghi cỡ.
 */
export function tomTatBienThe(dong) {
  const ds = (dong ?? []).filter(Boolean);
  if (ds.length === 0) return "";
  const duoi = duoiCo(ds[0].tenKichCo);
  const chungDuoi = duoi != null && ds.every((d) => duoiCo(d.tenKichCo) === duoi);
  const theoMau = new Map();
  for (const d of ds) {
    const mau = (d.tenMau ?? "").trim();
    const ten = (d.tenKichCo ?? "").trim();
    const co = chungDuoi ? ten.slice(0, ten.length - duoi.length).trim() : ten;
    if (!theoMau.has(mau)) theoMau.set(mau, []);
    if (co && !theoMau.get(mau).includes(co)) theoMau.get(mau).push(co);
  }
  const phan = [...theoMau].map(([mau, co]) => [mau, co.join(" · ")].filter(Boolean).join(" "));
  return phan.filter(Boolean).join(" / ") + (chungDuoi ? ` ${duoi}` : "");
}

/** Khả dụng của nhóm: mã thấp nhất; deu = mọi mã cùng khả dụng và cùng ngưỡng (ghi "mỗi mã" thay vì "thấp nhất"). */
export function khaDungNhom(dong) {
  const ds = dong ?? [];
  if (ds.length === 0) return { khaDung: 0, nguong: 0, deu: true };
  const thap = ds.reduce((m, d) => (d.khaDung < m.khaDung ? d : m), ds[0]);
  return { khaDung: thap.khaDung, nguong: thap.nguong, deu: ds.every((d) => d.khaDung === thap.khaDung && d.nguong === thap.nguong) };
}

/** Dòng phụ đếm mã của nhóm: "6 mã", hoặc "1 hết · 5 sắp hết" khi nhóm có cả hai mức. */
export function demMaNhom(n) {
  const het = n?.soHet ?? 0;
  const sapHet = n?.soSapHet ?? 0;
  return het && sapHet ? `${het} hết · ${sapHet} sắp hết` : `${het + sapHet} mã`;
}

/**
 * Nhóm từ danh sách phẳng (máy chủ cũ chưa trả `nhom`): gom các mã liền nhau cùng sản phẩm và kho, giữ thứ tự.
 * Máy chủ cũ chỉ trả tối đa 7 mã nên nhóm có thể thiếu mã; máy chủ mới trả sẵn `nhom` đủ mã.
 */
export function nhomCanBoSung(bs) {
  if (Array.isArray(bs?.nhom)) return bs.nhom;
  const nhom = [];
  for (const d of bs?.dong ?? []) {
    const cuoi = nhom[nhom.length - 1];
    if (cuoi && cuoi.tenSanPham === d.tenSanPham && cuoi.khoId === d.khoId) cuoi.dong.push(d);
    else nhom.push({ sanPhamId: null, tenSanPham: d.tenSanPham, khoId: d.khoId, tenKho: d.tenKho, laKhoTong: d.laKhoTong, dong: [d] });
  }
  return nhom.map((n) => {
    const soHet = n.dong.filter((d) => d.khaDung <= 0).length;
    return { ...n, soHet, soSapHet: n.dong.length - soHet };
  });
}
