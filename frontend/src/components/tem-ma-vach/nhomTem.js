/**
 * Màn "Tem mã vạch" (API POST /san-pham-quan-ao/gia-ban/filter): danh sách phân trang theo SẢN PHẨM, mỗi sản phẩm kèm
 * đủ các SKU khớp bộ lọc. Hàm thuần (không gọi API) dùng cho trang và kiểm thử.
 * Mở / thu gọn nhóm, chọn nhiều, phân trang theo đúng khuôn của màn Sản phẩm theo sàn (components/channel/nhomLienKet.js).
 * Giá bán ở đây chỉ để xem (là giá in trên tem); đổi giá ở form Sửa sản phẩm.
 */
import { khoaNhom, laMotPhanLoai, nhanSoPhanLoai, nhomDangMo } from "../channel/nhomLienKet.js";
import { t } from "../../i18n/t.js";

export { laMotPhanLoai, nhomDangMo };

/** Tab trạng thái (đếm theo SKU), mã nằm trên URL ?trangThai=. */
export const TAB_TEM = Object.freeze([
  { value: "tat-ca", label: t("Tất cả") },
  { value: "hoat-dong", label: t("Hoạt động") },
  { value: "ngung-hoat-dong", label: t("Ngừng hoạt động") },
]);

/** Số sản phẩm mỗi trang: mỗi sản phẩm kéo theo đủ SKU nên không cho 100. */
export const SO_SAN_PHAM_MOI_TRANG = [10, 20, 50];

const so = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};
/** Có giá bán (> 0): SKU chưa có giá thì tem không in được. */
export const coGia = (gia) => gia !== null && gia !== undefined && gia !== "" && Number(gia) > 0;

/** SKU đang hoạt động (bien_the_san_pham.trang_thai = 1); còn lại là Ngừng hoạt động. */
export const dangHoatDong = (dong) => Number(dong?.trangThai) === 1;

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
      giaBan: b.giaBan ?? null,
      tonKho: so(b.tonKho),
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
  };
}

/** Mọi SKU của trang theo thứ tự hiển thị (chọn nhiều, tìm dòng quét). */
export function dongCuaTrang(nhoms) {
  return (nhoms ?? []).flatMap((g) => g.dong);
}

/**
 * Nhóm tự mở: tab Ngừng hoạt động, tìm kiếm chỉ khớp SKU / mã vạch của một phần phân loại (khớp tên sản phẩm thì máy
 * chủ trả đủ phân loại → không tự mở), và nhóm chứa dòng vừa quét.
 */
export function tuMoNhom(nhom, { tab, tuKhoa, idNoiBat = null }) {
  if (tab === "ngung-hoat-dong") return true;
  if (tuKhoa && !nhom.khopTen && nhom.dong.length < nhom.tongPhanLoai) return true;
  return idNoiBat != null && nhom.dong.some((d) => d.id === idNoiBat);
}

/** Dòng phụ ở hàng sản phẩm: "5 phân loại", "4/5 phân loại" (lọc theo tab), "2/5 phân loại khớp" (đang tìm). */
export function nhanPhanLoai(nhom, dangLoc, dinhDangSo = (n) => String(n)) {
  return `${nhanSoPhanLoai(nhom, dinhDangSo)}${dangLoc && nhom.dong.length < nhom.tongPhanLoai ? t(" khớp") : ""}`;
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
 * - giaBan: { loai: "mot", gia } | { loai: "khoang", thapNhat, caoNhat, thieuGia } | { loai: "chua" }.
 */
export function tomTatNhom(nhom) {
  const hoatDong = nhom.dong.filter(dangHoatDong);
  const xet = hoatDong.length ? hoatDong : nhom.dong;
  const tongTon = nhom.dong.reduce((tong, d) => tong + so(d.tonKho), 0);
  const ban = xet.map((d) => d.giaBan);
  const coGiaBan = ban.filter(coGia).map(so);
  let giaBan;
  if (!coGiaBan.length) giaBan = { loai: "chua" };
  else if (coGiaBan.length === ban.length && coGiaBan.every((g) => g === coGiaBan[0])) giaBan = { loai: "mot", gia: coGiaBan[0] };
  // thieuGia: có phân loại (đang xét) chưa có giá — khoảng giá chỉ tính các phân loại đã có giá
  else giaBan = { loai: "khoang", thapNhat: Math.min(...coGiaBan), caoNhat: Math.max(...coGiaBan), thieuGia: coGiaBan.length < ban.length };
  return { tongTon, giaBan };
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
