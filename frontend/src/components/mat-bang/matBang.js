/**
 * Hàm thuần cho mặt bằng kho (FO-094 PA3). Đơn vị là ô lưới, đếm từ 1; mọi hình là chữ nhật { x, y, rong, cao }.
 * Mặt bằng (lấy từ máy chủ): { soCot, soHang, khuVuc: [{ khuVucId, x, y, rong, cao }], cua, loiDi, vatCoDinh }.
 */

export const KHU_NHO_NHAT = 2;

/** Khu vực cần tối thiểu KHU_NHO_NHAT × KHU_NHO_NHAT ô; lối đi, cửa, vật cố định dày 1 ô vẫn được. */
export const khuQuaNho = (hinh) => Boolean(hinh) && (hinh.rong < KHU_NHO_NHAT || hinh.cao < KHU_NHO_NHAT);
export const THONG_BAO_KHU_QUA_NHO = `Khu vực cần rộng ít nhất ${KHU_NHO_NHAT} × ${KHU_NHO_NHAT} ô.`;

/** Các loại vật vẽ được trên mặt bằng. `ma` trùng tên mảng trong dữ liệu mặt bằng. */
export const LOAI_VAT_MAT_BANG = [
  { ma: "khuVuc", ten: "Khu vực" },
  { ma: "loiDi", ten: "Lối đi" },
  { ma: "cua", ten: "Cửa" },
  { ma: "vatCoDinh", ten: "Vật cố định" },
];

export const tenLoaiVat = (ma) => LOAI_VAT_MAT_BANG.find((l) => l.ma === ma)?.ten ?? "";

/** Mặt bằng trống với kích thước lưới cho trước. */
export const matBangRong = (soCot, soHang) => ({ soCot, soHang, khuVuc: [], cua: [], loiDi: [], vatCoDinh: [] });

/** Đổi kích thước lưới: trả về tên vật đầu tiên bị cắt mất (nằm ngoài lưới mới), "" nếu vừa. */
export function vatNgoaiLuoi(matBang, soCot, soHang, tenKhu) {
  for (const loai of LOAI_VAT_MAT_BANG) {
    for (const vat of matBang?.[loai.ma] ?? []) {
      if (vat.x + vat.rong - 1 > soCot || vat.y + vat.cao - 1 > soHang) {
        return loai.ma === "khuVuc" ? tenKhu?.(vat.khuVucId) ?? "khu vực" : vat.ten;
      }
    }
  }
  return "";
}

export const chongNhau = (a, b) =>
  a.x < b.x + b.rong && b.x < a.x + a.rong && a.y < b.y + b.cao && b.y < a.y + a.cao;

/** Chuẩn hóa hình kéo từ ô (x0,y0) tới ô (x1,y1). */
export function hinhTuHaiO(x0, y0, x1, y1) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    rong: Math.abs(x1 - x0) + 1,
    cao: Math.abs(y1 - y0) + 1,
  };
}

/**
 * Tên vật bị chồng lên (khu khác, lối đi, cửa, vật cố định) hoặc "" nếu chỗ trống.
 * `boQua` = { loai, id }: vật đang được dời / vẽ lại, không tính là vật cản (id là khuVucId với khu,
 * là thứ tự trong mảng với các vật khác).
 */
export function vatBiChong(hinh, matBang, tenKhu, boQua) {
  if (!matBang) return "";
  const laBoQua = (loai, id) => Boolean(boQua) && boQua.loai === loai && boQua.id === id;
  for (const k of matBang.khuVuc ?? []) {
    if (laBoQua("khuVuc", k.khuVucId)) continue;
    if (chongNhau(hinh, k)) return tenKhu?.(k.khuVucId) ?? "khu khác";
  }
  for (const loai of ["loiDi", "cua", "vatCoDinh"]) {
    const ds = matBang[loai] ?? [];
    for (let i = 0; i < ds.length; i++) {
      if (laBoQua(loai, i)) continue;
      if (chongNhau(hinh, ds[i])) return ds[i].ten;
    }
  }
  return "";
}

/** Hình nằm trọn trong lưới mặt bằng. */
export const trongLuoi = (hinh, matBang) =>
  hinh.x >= 1 && hinh.y >= 1 && hinh.x + hinh.rong - 1 <= Number(matBang?.soCot) && hinh.y + hinh.cao - 1 <= Number(matBang?.soHang);

/** Hình hiện tại của một vật trên mặt bằng ({ loai, id }), hoặc null. */
export function hinhCuaVat(matBang, vat) {
  if (!matBang || !vat) return null;
  if (vat.loai === "khuVuc") return (matBang.khuVuc ?? []).find((h) => h.khuVucId === vat.id) ?? null;
  return (matBang[vat.loai] ?? [])[vat.id] ?? null;
}

/** Mặt bằng mới sau khi đổi vị trí / kích thước một vật (giữ nguyên các trường khác của vật). */
export function doiHinhVat(matBang, vat, hinh) {
  const moi = { x: hinh.x, y: hinh.y, rong: hinh.rong, cao: hinh.cao };
  if (vat.loai === "khuVuc") {
    return { ...matBang, khuVuc: (matBang.khuVuc ?? []).map((h) => (h.khuVucId === vat.id ? { ...h, ...moi } : h)) };
  }
  return { ...matBang, [vat.loai]: (matBang[vat.loai] ?? []).map((v, i) => (i === vat.id ? { ...v, ...moi } : v)) };
}

/** Ô lưới trên CSS grid: có 1 hàng thước đo phía trên và 1 cột thước đo bên trái nên lệch 1. */
export const vungLuoi = (h) => `${h.y + 1} / ${h.x + 1} / span ${h.cao} / span ${h.rong}`;

/** Câu chỉ đường từ cửa nhận hàng tới khu (và vị trí kệ nếu có). Trả về mảng đoạn chữ để in đậm phần quan trọng. */
export function cauChiDuong(matBang, khu, hinhKhu, viTri) {
  if (!matBang || !khu || !hinhKhu) return null;
  const soCot = Number(matBang.soCot) || 1;
  const giuaX = hinhKhu.x + hinhKhu.rong / 2;
  const giuaY = hinhKhu.y + hinhKhu.cao / 2;
  const ben = giuaX < soCot / 3 ? "phía bên trái" : giuaX > (soCot * 2) / 3 ? "phía bên phải" : "ở giữa kho";
  const loiDi = (matBang.loiDi ?? [])[0];
  const soVoiLoiDi = loiDi ? (giuaY < loiDi.y ? "phía trên lối đi chính" : "phía dưới lối đi chính") : "";
  const cuaNhan = (matBang.cua ?? []).find((c) => c.huong === "VAO") ?? (matBang.cua ?? [])[0];
  const doan = [
    { chu: `Từ ${cuaNhan ? cuaNhan.ten.toLowerCase() : "cửa kho"}, đi theo ${loiDi ? "lối đi chính" : "lối đi"} tới ` },
    { chu: khu.tenKhuVuc, dam: true },
    { chu: ` (${[soVoiLoiDi, ben].filter(Boolean).join(", ")})` },
  ];
  if (viTri) {
    doan.push(
      { chu: ", tìm " },
      { chu: `dãy ${viTri.day}`, dam: true },
      { chu: ", " },
      { chu: `hàng ${viTri.hang}`, dam: true },
      { chu: ", " },
      { chu: `tầng ${viTri.tang}`, dam: true },
      { chu: " (tầng 01 sát sàn)" },
    );
  }
  doan.push({ chu: "." });
  return doan;
}

/** So sánh "2" < "10" và "A" < "B" (mã dãy / hàng / tầng có thể là chữ hoặc số). */
export const soSanhMa = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true });

/** Nhóm vị trí của một khu theo dãy → lưới hàng × tầng (tầng cao ở trên). */
export function nhomTheoDay(viTris) {
  const theoDay = new Map();
  for (const v of viTris ?? []) {
    if (!theoDay.has(v.day)) theoDay.set(v.day, []);
    theoDay.get(v.day).push(v);
  }
  return [...theoDay.entries()].sort(([a], [b]) => soSanhMa(a, b)).map(([day, ds]) => {
    const hangs = [...new Set(ds.map((v) => v.hang))].sort(soSanhMa);
    const tangs = [...new Set(ds.map((v) => v.tang))].sort(soSanhMa).reverse();
    return { day, hangs, tangs, tim: (hang, tang) => ds.find((v) => v.hang === hang && v.tang === tang) };
  });
}
