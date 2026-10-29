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
 * Nút và câu chữ theo loại phiếu. Phiếu nhập của phiếu chuyển kho (PN-TRF, PN-RET hủy chuyển) do máy chủ lập khi nhận
 * hàng / nhập hoàn trả ở màn phiếu chuyển (đặc tả BA) nên ở đây chỉ xem: không nhận, không hủy (phiếu nháp lập theo cách
 * cũ được máy chủ tự hủy khi nhận hàng ở phiếu chuyển). Chỉ phiếu khách trả hàng xác nhận nhập (PUT …/complete).
 * `moPhieuChuyen`: phiếu chuyển kho còn chờ nhập theo cách cũ → nút mở phiếu chuyển.
 */
export function quyTacPhieuNhap(data) {
  const loai = loaiPhieuNhap(data);
  const tt = data?.trangThai;
  const khachTra = loai === LOAI_PHIEU_NHAP.KHACH_TRA;
  const choNhap = tt === TT.CHO_NHAP;
  return {
    loai,
    apiNhan: khachTra ? "complete" : null,
    choNhap,
    daNhap: tt === TT.DA_NHAP,
    daHuy: tt === TT.DA_HUY,
    inDuoc: tt !== TT.DA_HUY,
    huyDuoc: false,
    moPhieuChuyen: !khachTra && choNhap && data?.phieuXuatGocId != null,
    nhanNut: khachTra ? "Xác nhận nhập trả" : null,
    tieuDeHop: "Xác nhận nhập trả kho",
    cauThanhCong: "Đã nhập kho hoàn trả",
  };
}

/** Dòng thông báo khi phiếu đang chờ nhập: hàng kế thừa lô nào, bấm nút gì (phiếu chuyển kho: làm ở đâu). */
export function cauChoNhap(data) {
  const loai = loaiPhieuNhap(data);
  if (loai === LOAI_PHIEU_NHAP.CHUYEN_KHO) {
    return "Phiếu nhập này lập theo cách cũ. Nhận hàng ở màn phiếu chuyển kho: hệ thống tự lập phiếu nhập mới, trừ kho trung chuyển và hủy phiếu này.";
  }
  if (loai === LOAI_PHIEU_NHAP.HOAN_TRA) {
    return `Phiếu nhập hoàn trả này lập theo cách cũ. Nhập hàng hoàn trả về ${data?.tenKho || "kho nguồn"} ở màn phiếu chuyển kho: hệ thống tự lập phiếu nhập mới và hủy phiếu này.`;
  }
  return "Hàng khách trả nhập lại đúng lô đã bán. Kiểm hàng thực tế rồi bấm Xác nhận nhập trả để cộng lại tồn.";
}

/**
 * Câu của hộp xác nhận nhập trả (chỉ phiếu khách trả hàng). `tong`: `{ soSanPham, soDong, soLuong }` của cả phiếu,
 * `soLo`: số mã lô (null khi chưa biết).
 */
export function moTaXacNhan(data, tong, soLo = null) {
  const t = tong ?? {};
  const tomTat = `${soVN(t.soSanPham)} sản phẩm, ${soVN(t.soDong)} biến thể (tổng số lượng ${soVN(t.soLuong)}${soLo != null ? `, ${soVN(soLo)} lô` : ""})`;
  return `Cộng lại ${tomTat} vào tồn ${data?.tenKho || "kho nhận"} theo đúng lô đã bán.`;
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
