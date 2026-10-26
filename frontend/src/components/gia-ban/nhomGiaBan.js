/**
 * Màn "Giá bán & tem mã vạch" (API POST /san-pham-quan-ao/gia-ban/filter): danh sách phân trang theo SẢN PHẨM,
 * mỗi sản phẩm kèm đủ các SKU khớp bộ lọc. Hàm thuần (không gọi API) dùng cho trang và kiểm thử.
 * Mở / thu gọn nhóm, chọn nhiều, phân trang theo đúng khuôn của màn Sản phẩm theo sàn (components/channel/nhomLienKet.js).
 */
import { khoaNhom, laMotPhanLoai, nhanSoPhanLoai, nhomDangMo } from "../channel/nhomLienKet.js";

export { laMotPhanLoai, nhomDangMo };

/** Tab trạng thái (đếm theo SKU), mã nằm trên URL ?trangThai=. */
export const TAB_GIA_BAN = Object.freeze([
  { value: "tat-ca", label: "Tất cả" },
  { value: "hoat-dong", label: "Hoạt động" },
  { value: "ngung-hoat-dong", label: "Ngừng hoạt động" },
]);

/** Số sản phẩm mỗi trang: mỗi sản phẩm kéo theo đủ SKU nên không cho 100. */
export const SO_SAN_PHAM_MOI_TRANG = [10, 20, 50];

/** Giới hạn của cột gia_ban DECIMAL(15,2); máy chủ cũng chặn. */
export const GIA_BAN_TOI_DA = 9999999999999;

/** Lý do đổi giá (chip); lần sau chọn sẵn lý do dùng lần trước. */
export const LY_DO_DOI_GIA = Object.freeze(["Giá nhập mới", "Khuyến mãi", "Điều chỉnh theo thị trường", "Sửa giá nhập sai"]);

const so = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};
const coGia = (gia) => gia !== null && gia !== undefined && gia !== "" && Number(gia) > 0;

/** SKU đang hoạt động (bien_the_san_pham.trang_thai = 1); còn lại là Ngừng hoạt động. */
export const dangHoatDong = (dong) => Number(dong?.trangThai) === 1;

/** SKU đang hoạt động chưa có giá bán hoặc bán thấp hơn giá vốn (cùng điều kiện "Cần xử lý giá" của máy chủ). */
export function canXuLyGia(dong) {
  if (!dangHoatDong(dong)) return false;
  if (!coGia(dong.giaBan)) return true;
  return dong.giaVon !== null && dong.giaVon !== undefined && so(dong.giaBan) < so(dong.giaVon);
}

/** Có giá bán nhưng thấp hơn giá vốn (chữ đỏ + biểu tượng cảnh báo ở ô giá). */
export function duoiGiaVon(dong) {
  return coGia(dong?.giaBan) && dong.giaVon !== null && dong.giaVon !== undefined && so(dong.giaBan) < so(dong.giaVon);
}

/** Chuẩn hóa một trang từ API thành các nhóm `{ khoa, sanPhamId, ten, maSanPham, anh, tongPhanLoai, khopTen, dong }`. */
export function chuanHoaTrang(data) {
  const nhom = (data?.content ?? []).map((g) => {
    const dong = (g?.bienThe ?? []).map((b) => ({
      id: b.id,
      sanPhamId: g.sanPhamId,
      tenSanPham: g.tenSanPham,
      maSku: b.maSku ?? "",
      maVachSku: b.maVachSku ?? "",
      tenMau: b.mauSac?.ten ?? null,
      maMauHex: b.mauSac?.maHex ?? null,
      kichCo: b.kichCo ?? null,
      trangThai: b.trangThai,
      giaVon: b.giaVon ?? null,
      giaBan: b.giaBan ?? null,
      tonKho: so(b.tonKho),
      ngayDoiGiaGanNhat: b.ngayDoiGiaGanNhat ?? null,
    }));
    const tong = Number(g?.tongPhanLoai);
    return {
      khoa: khoaNhom(g?.sanPhamId ?? null, g?.tenSanPham),
      sanPhamId: g?.sanPhamId ?? null,
      ten: g?.tenSanPham || "—",
      maSanPham: g?.maSanPham ?? "",
      anh: g?.anh ?? null,
      tongPhanLoai: Number.isFinite(tong) && tong > dong.length ? tong : dong.length,
      khopTen: Boolean(g?.khopTen),
      dong,
    };
  });
  return {
    nhom,
    tongSanPham: so(data?.tongSanPham),
    tongSku: so(data?.tongSku),
    demTheoTab: data?.demTheoTab ?? null,
    canXuLy: data?.canXuLy ?? { chuaCoGia: 0, duoiGiaVon: 0 },
  };
}

/** Mọi SKU của trang theo thứ tự hiển thị (chọn nhiều, tìm dòng quét). */
export function dongCuaTrangGiaBan(nhoms) {
  return (nhoms ?? []).flatMap((g) => g.dong);
}

/**
 * Nhóm tự mở: tab Ngừng hoạt động và bộ lọc "Cần xử lý giá" (để thấy ngay SKU cần làm), tìm kiếm chỉ khớp SKU / mã
 * vạch của một phần phân loại (khớp tên sản phẩm thì máy chủ trả đủ phân loại → không tự mở), và nhóm chứa dòng vừa quét.
 */
export function tuMoNhom(nhom, { tab, canXuLy, tuKhoa, idNoiBat = null }) {
  if (tab === "ngung-hoat-dong" || canXuLy) return true;
  if (tuKhoa && !nhom.khopTen && nhom.dong.length < nhom.tongPhanLoai) return true;
  return idNoiBat != null && nhom.dong.some((d) => d.id === idNoiBat);
}

/** Dòng phụ ở hàng sản phẩm: "5 phân loại", "4/5 phân loại" (lọc theo tab), "2/5 phân loại khớp" (tìm / cần xử lý giá). */
export function nhanPhanLoai(nhom, dangLoc, dinhDangSo = (n) => String(n)) {
  return `${nhanSoPhanLoai(nhom, dinhDangSo)}${dangLoc && nhom.dong.length < nhom.tongPhanLoai ? " khớp" : ""}`;
}

/** Trạng thái checkbox của một nhóm id: false | true | "indeterminate" (lưng chừng). */
export function trangThaiChon(ids, chon) {
  const soChon = ids.filter((id) => chon.has(id)).length;
  if (soChon === 0) return false;
  return soChon === ids.length ? true : "indeterminate";
}

/**
 * Tóm tắt hàng sản phẩm (tính trên các SKU đang hiện của nhóm; nếu không SKU nào đang hoạt động thì tính trên tất cả):
 * - tongTon: tổng tồn;
 * - giaVonChung: chỉ khi mọi phân loại cùng giá vốn, không thì null;
 * - giaBan: { loai: "mot", gia } | { loai: "khoang", thapNhat, caoNhat } | { loai: "chua" }.
 */
export function tomTatNhom(nhom) {
  const hoatDong = nhom.dong.filter(dangHoatDong);
  const xet = hoatDong.length ? hoatDong : nhom.dong;
  const tongTon = nhom.dong.reduce((t, d) => t + so(d.tonKho), 0);
  const von = xet.map((d) => d.giaVon);
  const giaVonChung = von.length && von.every((v) => v !== null && v !== undefined && so(v) === so(von[0])) ? so(von[0]) : null;
  const ban = xet.map((d) => d.giaBan);
  const coGiaBan = ban.filter(coGia).map(so);
  let giaBan;
  if (!coGiaBan.length) giaBan = { loai: "chua" };
  else if (coGiaBan.length === ban.length && coGiaBan.every((g) => g === coGiaBan[0])) giaBan = { loai: "mot", gia: coGiaBan[0] };
  // thieuGia: có phân loại (đang xét) chưa có giá — khoảng giá chỉ tính các phân loại đã có giá
  else giaBan = { loai: "khoang", thapNhat: Math.min(...coGiaBan), caoNhat: Math.max(...coGiaBan), thieuGia: coGiaBan.length < ban.length };
  return { tongTon, giaVonChung, giaBan };
}

/**
 * Lãi gộp của một giá bán so với giá vốn: { lai, phanTram, lo } (lo = bán dưới giá vốn); null khi chưa nhập giá
 * hoặc không biết giá vốn.
 */
export function tinhLaiGop(giaBan, giaVon) {
  if (!coGia(giaBan) || giaVon === null || giaVon === undefined || giaVon === "") return null;
  const ban = so(giaBan);
  const von = so(giaVon);
  return { lai: ban - von, phanTram: ((ban - von) / ban) * 100, lo: ban < von };
}

/** "25,0%", "−3,3%" (dấu trừ thật). */
export function dinhDangPhanTram(phanTram) {
  const tri = Math.abs(phanTram).toFixed(1).replace(".", ",");
  return `${phanTram < 0 ? "−" : ""}${tri}%`;
}

/**
 * Các SKU sẽ đổi giá trong một lần đổi (ô giá một SKU, cả sản phẩm, hay chọn nhiều): chỉ SKU đang hoạt động.
 * Trả { muc, boQua, vonThap, vonCao, khongDoi(gia), lanGanNhat }.
 */
export function mucDoiGia(dsDong) {
  const muc = (dsDong ?? []).filter(dangHoatDong);
  const boQua = (dsDong ?? []).length - muc.length;
  const von = muc.map((d) => d.giaVon).filter((v) => v !== null && v !== undefined).map(so);
  const lan = muc.map((d) => d.ngayDoiGiaGanNhat).filter(Boolean).map((x) => new Date(x)).filter((d) => !Number.isNaN(d.getTime()));
  return {
    muc,
    boQua,
    vonThap: von.length ? Math.min(...von) : null,
    vonCao: von.length ? Math.max(...von) : null,
    khongDoi: (gia) => muc.length > 0 && muc.every((d) => coGia(d.giaBan) && so(d.giaBan) === so(gia)),
    lanGanNhat: lan.length ? new Date(Math.max(...lan.map((d) => d.getTime()))) : null,
  };
}

/** Tìm SKU đúng mã quét (mã vạch hoặc SKU, không phân biệt hoa thường) trong trang đang xem. */
export function timDongQuet(nhoms, ma) {
  const can = String(ma ?? "").trim().toLowerCase();
  if (!can) return null;
  for (const nhom of nhoms ?? []) {
    const dong = nhom.dong.find((d) => d.maVachSku.toLowerCase() === can) ?? nhom.dong.find((d) => d.maSku.toLowerCase() === can);
    if (dong) return { nhom, dong };
  }
  return null;
}

/** Sau khi đổi giá: các SKU còn hàng cần in lại tem, số tem = tồn. `daDoi` từ máy chủ: [{ id, giaBanMoi, tonKho }]. */
export function dongInLaiSauDoiGia(daDoi, dsDong) {
  const theoId = new Map((dsDong ?? []).map((d) => [d.id, d]));
  return (daDoi ?? [])
    .filter((x) => so(x.tonKho) > 0 && theoId.has(x.id))
    .map((x) => ({ ...theoId.get(x.id), giaBan: x.giaBanMoi, tonKho: so(x.tonKho), ngayDoiGiaGanNhat: new Date().toISOString() }));
}
