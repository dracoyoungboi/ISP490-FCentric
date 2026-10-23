/*
 * Logic thuần của Chi tiết phiếu nhập kho NHÁNH CŨ (/goods-receipts/:id khi không có `soDonMua`): phiếu nhập chuyển kho
 * (PN-TRF), phiếu nhập hoàn trả do hủy chuyển kho (PN-RET) và phiếu nhập khách trả hàng (PN-RET từ đơn bán).
 * Loại phiếu, nút, câu chữ, dòng bảng và lô kế thừa. Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 */
import { docSo, soVN } from "../../chung-tu/bangChungTu.js";

export const LOAI_PHIEU_NHAP = Object.freeze({ CHUYEN_KHO: "chuyenKho", HOAN_TRA: "hoanTraChuyenKho", KHACH_TRA: "khachTra" });
const TT = Object.freeze({ CHO_NHAP: 0, DA_NHAP: 3, DA_HUY: 4 });

/**
 * Cùng quy tắc màn cũ: có `phieuXuatGocId` (id phiếu chuyển kho) là phiếu chuyển kho, trong đó phiếu hoàn trả khi
 * `loaiNhap` có "hoàn trả" hoặc mã có "-RET-"; không có là phiếu khách trả hàng.
 */
export function loaiPhieuNhap(data) {
  if (!data?.phieuXuatGocId) return LOAI_PHIEU_NHAP.KHACH_TRA;
  const hoanTra = String(data.loaiNhap ?? "").toLowerCase().includes("hoàn trả") || String(data.soPhieuNhap ?? "").includes("-RET-");
  return hoanTra ? LOAI_PHIEU_NHAP.HOAN_TRA : LOAI_PHIEU_NHAP.CHUYEN_KHO;
}

/**
 * Nút và câu chữ theo loại phiếu. API giữ như màn cũ: phiếu có phiếu chuyển kho gốc (kể cả hoàn trả) gọi
 * PUT …/complete-transfer, phiếu khách trả gọi PUT …/complete. Chỉ phiếu chuyển kho đang chờ nhập hủy được
 * (phiếu PN-RET backend không cho hủy).
 */
export function quyTacPhieuNhap(data) {
  const loai = loaiPhieuNhap(data);
  const tt = data?.trangThai;
  const chuyenKho = loai === LOAI_PHIEU_NHAP.CHUYEN_KHO;
  return {
    loai,
    apiNhan: data?.phieuXuatGocId ? "completeTransfer" : "complete",
    choNhap: tt === TT.CHO_NHAP,
    daNhap: tt === TT.DA_NHAP,
    daHuy: tt === TT.DA_HUY,
    inDuoc: tt !== TT.DA_HUY,
    huyDuoc: chuyenKho && tt === TT.CHO_NHAP,
    nhanNut: chuyenKho ? "Nhận hàng" : "Xác nhận nhập trả",
    tieuDeHop: chuyenKho ? "Nhận hàng chuyển kho" : "Xác nhận nhập trả kho",
    cauThanhCong: chuyenKho ? "Đã nhận hàng chuyển kho" : "Đã nhập kho hoàn trả",
  };
}

/** Dòng thông báo khi phiếu đang chờ nhập: hàng kế thừa lô nào, bấm nút gì. */
export function cauChoNhap(data) {
  const loai = loaiPhieuNhap(data);
  if (loai === LOAI_PHIEU_NHAP.CHUYEN_KHO) {
    return `Hàng kế thừa đúng lô và số lượng ${data?.tenKhoChuyenTu || "kho nguồn"} đã xuất. Kiểm hàng thực tế rồi bấm Nhận hàng để cộng tồn.`;
  }
  if (loai === LOAI_PHIEU_NHAP.HOAN_TRA) {
    return `Phiếu chuyển kho đã hủy khi hàng đang trên đường. Hàng quay về ${data?.tenKho || "kho nguồn"} theo đúng lô đã xuất; kiểm hàng thực tế rồi bấm Xác nhận nhập trả để cộng lại tồn.`;
  }
  return "Hàng khách trả nhập lại đúng lô đã bán. Kiểm hàng thực tế rồi bấm Xác nhận nhập trả để cộng lại tồn.";
}

/** Câu của hộp xác nhận nhập. `tong`: `{ soSanPham, soDong, soLuong }` của cả phiếu, `soLo`: số mã lô (null khi chưa biết). */
export function moTaXacNhan(data, tong, soLo = null) {
  const t = tong ?? {};
  const tomTat = `${soVN(t.soSanPham)} sản phẩm, ${soVN(t.soDong)} biến thể (tổng số lượng ${soVN(t.soLuong)}${soLo != null ? `, ${soVN(soLo)} lô` : ""})`;
  const kho = data?.tenKho || "kho nhận";
  const loai = loaiPhieuNhap(data);
  if (loai === LOAI_PHIEU_NHAP.CHUYEN_KHO) return `Cộng ${tomTat} vào tồn ${kho} theo đúng lô đã xuất. Phiếu chuyển kho chuyển sang Hoàn thành.`;
  if (loai === LOAI_PHIEU_NHAP.HOAN_TRA) return `Cộng lại ${tomTat} vào tồn ${kho} theo đúng lô đã xuất.`;
  return `Cộng lại ${tomTat} vào tồn ${kho} theo đúng lô đã bán.`;
}

/**
 * Thẻ lô của một dòng từ GET …/{id}/bien-the/{bienTheId}/lo-hang (gộp mã lô trùng).
 * `soLuongNhap` ở API đó là số nhập ban đầu của LÔ (lúc lô vào kho từ đơn mua), không phải số kế thừa trên phiếu này,
 * nên chỉ ghi "× số lượng" khi dòng chỉ có một lô (số của lô = số của dòng); nhiều lô thì chỉ ghi mã lô.
 */
export function loCuaDong(lots, soLuongDong) {
  const maLos = [];
  for (const l of Array.isArray(lots) ? lots : []) {
    const ma = String(l?.maLo ?? "").trim();
    if (ma && !maLos.includes(ma)) maLos.push(ma);
  }
  if (maLos.length === 1) return [{ maLo: maLos[0], soLuong: docSo(soLuongDong) }];
  return maLos.map((maLo) => ({ maLo }));
}

/**
 * Dòng chứng từ (bangChungTu.js) từ `items[]` của GET …/{id}/detail; gom theo tên sản phẩm (`tenBienThe` là tên sản
 * phẩm). `loTheoBienThe`: `{ [bienTheSanPhamId]: lots[] | null }` (null = tải lô lỗi); chưa có (đang tải) → undefined.
 * `trangThaiLo`: "dangTai" | "loi" | "co".
 */
export function dongPhieuNhap(items, loTheoBienThe) {
  return (Array.isArray(items) ? items : []).map((it, i) => {
    const soLuong = docSo(it?.soLuongCanNhap);
    const lots = loTheoBienThe ? loTheoBienThe[it?.bienTheSanPhamId] : undefined;
    return {
      id: `${it?.bienTheSanPhamId ?? "dong"}-${i}`,
      bienTheSanPhamId: it?.bienTheSanPhamId ?? null,
      khoaNhom: it?.sanPhamId ?? null,
      tenSanPham: it?.tenBienThe || it?.sku || "",
      tenMau: it?.mauSac || "",
      maMauHex: it?.maMauHex || "",
      kichCo: it?.kichCo || "",
      anh: it?.anh || null,
      sku: it?.sku || "",
      maVach: it?.maVachSku || undefined,
      soLuong,
      lo: lots ? loCuaDong(lots, soLuong) : [],
      trangThaiLo: lots === undefined ? "dangTai" : lots === null ? "loi" : "co",
    };
  });
}

/** Số mã lô khác nhau của cả phiếu; null khi còn dòng đang tải hoặc tải lỗi (không ghi số sai). */
export function demLo(dongs) {
  const ds = Array.isArray(dongs) ? dongs : [];
  if (ds.some((d) => d.trangThaiLo !== "co")) return null;
  return new Set(ds.flatMap((d) => d.lo.map((l) => l.maLo))).size;
}
