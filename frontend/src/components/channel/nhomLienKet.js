/**
 * Danh sách liên kết của trang "Sản phẩm theo sàn" phân trang theo SẢN PHẨM (API /lien-ket/theo-san-pham):
 * mỗi phần tử là một sản phẩm kèm đủ các SKU khớp bộ lọc, nên một sản phẩm không bị cắt sang hai trang.
 * Các hàm ở đây là hàm thuần (không gọi API) để dùng chung cho trang, dữ liệu mẫu và kiểm thử.
 */

/** Khóa nhóm của một sản phẩm; dữ liệu mẫu không có id sản phẩm thì dùng tên. */
export function khoaNhom(sanPhamId, ten) {
  return sanPhamId != null ? `sp-${sanPhamId}` : `ten-${ten ?? ""}`;
}

/**
 * Chuẩn hóa một nhóm từ API: SKU qua `chuanHoaDong`, tổng phân loại không nhỏ hơn số SKU đang có.
 * Trả `{ khoa, sanPhamId, ten, anh, tongPhanLoai, dong }`.
 */
export function chuanHoaNhom(nhom, chuanHoaDong = (dong) => dong) {
  const dong = (nhom?.bienThe ?? []).map(chuanHoaDong);
  const ten = nhom?.tenSanPham || dong[0]?.tenSanPham || dong[0]?.tenSanPhamSan || "—";
  const tong = Number(nhom?.tongPhanLoai);
  return {
    khoa: khoaNhom(nhom?.sanPhamId ?? null, ten),
    sanPhamId: nhom?.sanPhamId ?? null,
    ten,
    anh: nhom?.anhDaiDien ?? dong.find((d) => d.anhDaiDien)?.anhDaiDien ?? null,
    tongPhanLoai: Number.isFinite(tong) && tong > dong.length ? tong : dong.length,
    dong,
  };
}

/** Mọi SKU của trang, theo thứ tự hiển thị (để chọn nhiều dòng, mở chi tiết). */
export function dongCuaTrang(nhoms) {
  return (nhoms ?? []).flatMap((nhom) => nhom.dong);
}

/** Thay một SKU trong trang nhóm (sau bật/tắt đồng bộ, ghép biến thể), giữ nguyên các SKU khác. */
export function capNhatDongTrongTrang(trang, id, capNhat) {
  if (!trang?.content) return trang;
  return {
    ...trang,
    content: trang.content.map((nhom) =>
      nhom.dong.some((dong) => dong.id === id)
        ? { ...nhom, dong: nhom.dong.map((dong) => (dong.id === id ? capNhat(dong) : dong)) }
        : nhom,
    ),
  };
}

/** Sản phẩm chỉ có một phân loại: hiện một dòng, không cần hàng sản phẩm. Đang lọc còn 1/16 vẫn hiện hàng sản phẩm. */
export function laMotPhanLoai(nhom) {
  return nhom.dong.length === 1 && nhom.tongPhanLoai <= 1;
}

/** Dòng phụ ở hàng sản phẩm: "16 phân loại", hoặc "2/16 phân loại" khi bộ lọc chỉ còn một phần. */
export function nhanSoPhanLoai(nhom, dinhDangSo = (n) => String(n)) {
  const soHien = nhom.dong.length;
  return soHien < nhom.tongPhanLoai
    ? `${dinhDangSo(soHien)}/${dinhDangSo(nhom.tongPhanLoai)} phân loại`
    : `${dinhDangSo(soHien)} phân loại`;
}

/**
 * Phân trang theo sản phẩm cho dữ liệu mẫu, cùng hình dạng API thật.
 * `dongKhop`: SKU khớp bộ lọc; `tatCaDong`: mọi SKU (để đếm tổng phân loại của từng sản phẩm).
 */
export function phanTrangTheoSanPham(dongKhop, tatCaDong, { page = 0, size = 20 } = {}) {
  const khoaCua = (dong) => khoaNhom(dong.sanPhamId ?? null, dong.tenSanPham ?? dong.tenSanPhamSan);
  const tongTheoKhoa = new Map();
  (tatCaDong ?? []).forEach((dong) => tongTheoKhoa.set(khoaCua(dong), (tongTheoKhoa.get(khoaCua(dong)) ?? 0) + 1));

  const nhoms = [];
  const theoKhoa = new Map();
  (dongKhop ?? []).forEach((dong) => {
    const khoa = khoaCua(dong);
    if (!theoKhoa.has(khoa)) {
      const moi = {
        sanPhamId: dong.sanPhamId ?? null,
        tenSanPham: dong.tenSanPham ?? dong.tenSanPhamSan ?? null,
        anhDaiDien: dong.anhDaiDien ?? null,
        bienThe: [],
      };
      theoKhoa.set(khoa, moi);
      nhoms.push(moi);
    }
    theoKhoa.get(khoa).bienThe.push(dong);
  });
  theoKhoa.forEach((nhom, khoa) => {
    nhom.tongPhanLoai = Math.max(nhom.bienThe.length, tongTheoKhoa.get(khoa) ?? 0);
  });

  const soDong = Math.max(1, Number(size) || 20);
  const trang = Math.max(0, Number(page) || 0);
  return {
    content: nhoms.slice(trang * soDong, (trang + 1) * soDong),
    totalElements: nhoms.length,
    // Tổng SKU khớp bộ lọc trên mọi trang (cùng tên trường máy chủ trả) để chân bảng ghi "· N SKU"
    tongSku: (dongKhop ?? []).length,
    totalPages: Math.max(1, Math.ceil(nhoms.length / soDong)),
    number: trang,
    size: soDong,
  };
}

/** Dòng còn đẩy tồn (Đang đồng bộ hoặc Lỗi); "chua_lien_ket" là Ngừng đồng bộ. */
export const conDongBo = (dong) => dong?.trangThaiLienKet !== "chua_lien_ket";

/**
 * Dòng đang chờ đẩy: lần đẩy tới sẽ đổi số trên sàn (`seDay` khác số đã đẩy), hoặc vừa bật lại mà chưa có lần đẩy nào
 * sau đó (`vuaBat`). Dòng ngừng không chờ; dòng lỗi đã có nhãn Lỗi + Thử lại nên không ghi thêm.
 */
export function laChoDay(dong, seDay, vuaBat = false) {
  if (!conDongBo(dong) || dong.trangThaiLienKet === "loi") return false;
  if (vuaBat) return true;
  const coSo = (n) => n !== null && n !== undefined;
  const daDay = dong.soLuongDaDay;
  return coSo(seDay) && (!coSo(daDay) || Number(seDay) !== Number(daDay));
}

/**
 * Giờ đẩy chung của một nhóm (giờ xuất hiện nhiều nhất trong các dòng còn đồng bộ đã từng đẩy), ghi một lần ở hàng
 * sản phẩm; dòng con chỉ ghi giờ khi khác giờ này. `dinhDangGio(iso)` → chuỗi giờ hoặc null. Hòa thì lấy giờ gặp trước.
 */
export function gioChungCuaNhom(dsDong, dinhDangGio) {
  const dem = new Map();
  (dsDong ?? []).forEach((dong) => {
    if (!conDongBo(dong) || dong.soLuongDaDay == null || !dong.ngayDayTonCuoi) return;
    const gio = dinhDangGio(dong.ngayDayTonCuoi);
    if (gio) dem.set(gio, (dem.get(gio) ?? 0) + 1);
  });
  let tot = null;
  dem.forEach((so, gio) => {
    if (tot === null || so > dem.get(tot)) tot = gio;
  });
  return tot;
}

/**
 * Nhóm đang mở hay thu gọn (chốt 21/10): mặc định thu gọn; `moTatCa` là chế độ chung cho mọi trang; nhóm `tuMo`
 * (tab Lỗi / Ngừng, tìm kiếm khớp một phần) tự mở trừ khi đã bấm Thu gọn tất cả (`boTuMo`); `laNgoaiLe`: người dùng
 * tự lật nhóm này ngược với cách trên.
 */
export function nhomDangMo({ moTatCa = false, tuMo = false, boTuMo = false, laNgoaiLe = false }) {
  const goc = moTatCa || (tuMo && !boTuMo);
  return laNgoaiLe ? !goc : goc;
}
