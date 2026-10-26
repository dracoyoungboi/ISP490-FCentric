/*
 * Phần hàng của một đơn mua đang nằm ở các phiếu nhập Nháp (đã tạo phiếu, chưa nhập kho). Máy chủ trừ phần này khi tạo
 * phiếu mới (PhieuNhapKhoService.createDraft, ChiTietPhieuNhapKhoRepository.sumDuKienPhieuNhapCungDon), nên màn hình phải
 * trừ theo đúng cách đó, không thì màn mời nhập mà máy chủ từ chối. Hàm thuần, chạy được bằng `node --test`.
 *
 * Quy ước dữ liệu: chi tiết phiếu nhập (`/phieu-nhap-kho/{id}/detail`) trả `items[]` theo biến thể, `soLuongCanNhap` là số
 * phiếu giữ. Chỉ phiếu trạng thái 0 (Nháp) mới giữ: phiếu hoàn tất đã vào `soLuongDaNhan` của đơn, phiếu hủy không giữ.
 */

export const TRANG_THAI_PHIEU_NHAP_NHAP = 0;

function docSo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function laPhieuNhap(p) {
  return p != null && p.trangThai != null && p.trangThai !== "" && docSo(p.trangThai) === TRANG_THAI_PHIEU_NHAP_NHAP;
}

/**
 * @param phieus chi tiết các phiếu nhập của MỘT đơn mua (mọi trạng thái, hàm tự lọc phiếu Nháp)
 * @returns `{ theoBienThe: Map<bienTheSanPhamId (số), số giữ>, phieu: [{ id, soPhieuNhap, giu, daKiem, bienThe }], tong }`
 *   `phieu`: các phiếu Nháp có giữ hàng; phiếu đã kiểm đếm (đã khai lô) đứng trước, rồi phiếu tạo trước — phiếu nên làm
 *   tiếp là phiếu đã có tiến độ, không phải phiếu cũ nhất (phiếu cũ trùng thường là phiếu bỏ dở);
 *   `daKiem`: tổng số đã kiểm đếm của phiếu (đạt + không đạt); `bienThe`: id các biến thể phiếu đó đang giữ
 */
export function tinhPhanGiu(phieus) {
  const theoBienThe = new Map();
  const phieu = [];
  let tong = 0;
  for (const p of Array.isArray(phieus) ? phieus : []) {
    if (!laPhieuNhap(p)) continue;
    let giu = 0;
    let daKiem = 0;
    const bienThe = [];
    for (const it of Array.isArray(p.items) ? p.items : []) {
      if (it?.bienTheSanPhamId == null) continue;
      // Đã kiểm = đạt + không đạt (lô chỉ có hàng không đạt cũng là phiếu đã kiểm đếm)
      daKiem += Math.max(0, docSo(it.soLuongDatQc)) + Math.max(0, docSo(it.soLuongLoiQc));
      const sl = Math.max(0, docSo(it.soLuongCanNhap));
      if (!sl) continue;
      const khoa = Number(it.bienTheSanPhamId);
      theoBienThe.set(khoa, (theoBienThe.get(khoa) ?? 0) + sl);
      bienThe.push(khoa);
      giu += sl;
    }
    if (giu > 0) {
      phieu.push({ id: p.id, soPhieuNhap: p.soPhieuNhap || `#${p.id}`, giu, daKiem, bienThe });
      tong += giu;
    }
  }
  phieu.sort((a, b) => (b.daKiem > 0) - (a.daKiem > 0) || docSo(a.id) - docSo(b.id));
  return { theoBienThe, phieu, tong };
}

/** Số còn tạo phiếu được cho một dòng đơn: Đặt − Đã nhận − Phiếu nháp giữ, không âm. */
export function conLaiCoTheNhap(dat, daNhan, dangGiu = 0) {
  return Math.max(0, docSo(dat) - docSo(daNhan) - docSo(dangGiu));
}

/**
 * Các dòng đơn mua kèm phần phiếu nháp giữ.
 * @returns mỗi dòng thêm `dangGiu`, `thieu` (Đặt − Đã nhận, không âm) và `conLai` (số còn tạo phiếu được)
 */
export function dongDonKemPhanGiu(chiTiets, theoBienThe) {
  const giu = theoBienThe instanceof Map ? theoBienThe : new Map();
  return (Array.isArray(chiTiets) ? chiTiets : []).map((ct) => {
    const btId = ct?.bienTheSanPham?.id;
    const dangGiu = btId == null ? 0 : giu.get(Number(btId)) ?? 0;
    return {
      ...ct,
      dangGiu,
      thieu: conLaiCoTheNhap(ct?.soLuongDat, ct?.soLuongDaNhan),
      conLai: conLaiCoTheNhap(ct?.soLuongDat, ct?.soLuongDaNhan, dangGiu),
    };
  });
}

/**
 * Phiếu Nháp nên mở để kiểm đếm tiếp: theo thứ tự của tinhPhanGiu (đã kiểm đếm trước, rồi tạo trước), phiếu đầu tiên còn
 * giữ một biến thể đơn chưa nhận đủ. Phiếu cũ (trước khi máy chủ trừ phần giữ) có thể giữ trùng, phiếu chỉ giữ biến thể đã
 * nhận đủ thì không nên mở.
 * @param dongDon kết quả dongDonKemPhanGiu
 */
export function phieuNenMo(phieu, dongDon) {
  const conThieu = new Set(
    (Array.isArray(dongDon) ? dongDon : [])
      .filter((d) => d?.thieu > 0 && d?.bienTheSanPham?.id != null)
      .map((d) => Number(d.bienTheSanPham.id)),
  );
  return (Array.isArray(phieu) ? phieu : []).find((p) => (p.bienThe ?? []).some((id) => conThieu.has(id))) ?? null;
}

/** Id các đơn mua đang có phiếu nhập Nháp, đọc từ danh sách phiếu nhập (PhieuNhapKhoDto có `donMuaHangId`). */
export function donMuaCoPhieuNhap(dsPhieu) {
  const ids = new Set();
  for (const p of Array.isArray(dsPhieu) ? dsPhieu : []) {
    const donId = p?.donMuaHangId ?? p?.donMuaHang?.id;
    if (donId != null && laPhieuNhap(p)) ids.add(Number(donId));
  }
  return ids;
}

/** "PN1", "PN1 và PN2", "PN1, PN2 và PN3" cho câu thông báo. */
export function noiSoPhieu(phieu) {
  const so = (Array.isArray(phieu) ? phieu : []).map((p) => p.soPhieuNhap);
  if (so.length <= 1) return so[0] ?? "";
  return `${so.slice(0, -1).join(", ")} và ${so[so.length - 1]}`;
}
