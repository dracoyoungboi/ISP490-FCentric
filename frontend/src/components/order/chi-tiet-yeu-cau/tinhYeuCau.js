/*
 * Hàm thuần cho màn Chi tiết yêu cầu nhập hàng và Chi tiết yêu cầu báo giá (cùng bản ghi yeu_cau_mua_hang,
 * cùng API GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}): dòng bảng, các báo giá còn hiệu lực, tóm tắt báo giá
 * (đã gửi / đã báo giá / đã chốt, giá trị đã chốt), 5 bước tiến trình, quyền Phê duyệt / Từ chối theo kho nhận.
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Trạng thái yêu cầu (constants/yeuCauNhapHang.js): 0 Nháp (dữ liệu cũ) · 1 Chờ duyệt · 2 Đã duyệt ·
 * 3 Đã gửi yêu cầu báo giá · 4 Từ chối · 5 Đã chuyển thành đơn mua hàng.
 * `donMuaHangs[]`: mỗi nhà cung cấp được gửi yêu cầu là một báo giá (don_mua_hang), xem chi-tiet-bao-gia/tinhBaoGia.js.
 */
import { docSo, soVN, tuBienThe } from "../../chung-tu/bangChungTu.js";
import { congGia, laDaChot, tongTienBaoGia, TRANG_THAI_BAO_GIA } from "../chi-tiet-bao-gia/tinhBaoGia.js";
import { ROLES } from "../../../utils/roles.js";

export const TRANG_THAI_YEU_CAU = Object.freeze({
  NHAP: 0,
  CHO_DUYET: 1,
  DA_DUYET: 2,
  DA_GUI_BAO_GIA: 3,
  TU_CHOI: 4,
  DA_CHUYEN_DON_MUA: 5,
});

/** Số ký tự tối đa của lý do từ chối (backend YeuCauMuaHangService.LY_DO_TU_CHOI_MAX). */
export const LY_DO_TU_CHOI_TOI_DA = 500;

/**
 * Vai trò mở được Chi tiết báo giá / Chi tiết đơn mua hàng (khớp @RequireAuth của GET /don-mua-hang/get-by-id).
 * Nhân viên bán hàng xem được yêu cầu nhưng không xem được báo giá, đơn mua: tên / mã hiện chữ thường, không phải link.
 */
export const VAI_TRO_XEM_DON_MUA = Object.freeze([
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_KHO,
  ROLES.NHAN_VIEN_MUA_HANG,
  ROLES.NHAN_VIEN_KHO,
]);

function docNgay(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Đổi `chiTietYeuCauMuaHangs` sang dòng của bảng chứng từ (xem đầu chung-tu/bangChungTu.js).
 * `bienTheId` để ghép với dòng báo giá; `chatLieu` hiện ở dòng nhóm và cũng được tìm.
 */
export function dongYeuCau(yc) {
  return (Array.isArray(yc?.chiTietYeuCauMuaHangs) ? yc.chiTietYeuCauMuaHangs : []).map((ct, viTri) => {
    const chatLieu = ct?.bienTheSanPham?.chatLieu?.tenChatLieu || "";
    return {
      id: ct?.id ?? `dong-${viTri}`,
      ...tuBienThe(ct?.bienTheSanPham),
      bienTheId: ct?.bienTheSanPham?.id ?? null,
      chatLieu,
      chuTimThem: chatLieu,
      soLuong: docSo(ct?.soLuongDat),
    };
  });
}

/**
 * Số biến thể trên dòng nhóm sản phẩm: đang tìm mà chỉ một phần biến thể khớp thì "3/10 biến thể" (tổng phụ của dòng
 * nhóm lúc đó chỉ cộng biến thể khớp), còn lại "10 biến thể". `nhom`: một nhóm của useBangChungTu.
 */
export function chuSoBienThe(nhom, dangTim = false) {
  const so = docSo(nhom?.soBienThe);
  const caNhom = docSo(nhom?.soBienTheCaNhom) || so;
  return dangTim && so < caNhom ? `${soVN(so)}/${soVN(caNhom)} biến thể` : `${soVN(so)} biến thể`;
}

/**
 * Chất liệu trên dòng nhóm sản phẩm: các chất liệu khác nhau của các dòng trong nhóm (bỏ rỗng, bỏ trùng, giữ thứ tự),
 * nối bằng ", ". Biến thể cùng sản phẩm có thể khác chất liệu nên không lấy riêng dòng đầu. `dongs`: `nhom.dong`.
 */
export function chuChatLieu(dongs) {
  const ds = (Array.isArray(dongs) ? dongs : []).map((d) => String(d?.chatLieu ?? "").trim()).filter(Boolean);
  return [...new Set(ds)].join(", ");
}

/**
 * Lọc câu máy chủ trước khi hiện ở màn "Không tìm thấy" (KhungLoiChungTu → locCauMayChu): câu "Không tìm thấy yêu cầu
 * mua hàng id: 19" / "Không tìm thấy đơn mua hàng id: 58" chỉ lặp ý của tiêu đề (lại gọi bằng tên bảng) nên bỏ; câu khác giữ.
 */
export function locCauMayChuMuaHang(cau) {
  const chu = String(cau ?? "").trim();
  if (!chu || /^không tìm thấy\b/i.test(chu)) return null;
  return chu;
}

/** Các báo giá còn hiệu lực của yêu cầu: bỏ báo giá đã xóa (trạng thái 0), như bản in yêu cầu báo giá. */
export function baoGiaHieuLuc(yc) {
  return (Array.isArray(yc?.donMuaHangs) ? yc.donMuaHangs : []).filter(
    (don) => don && docSo(don.trangThai) !== TRANG_THAI_BAO_GIA.DA_XOA,
  );
}

/** Báo giá đã chấp nhận (đã thành đơn mua hàng): trạng thái 3 hoặc 5. Backend cho chấp nhận nhiều báo giá. */
export function baoGiaDaChot(yc) {
  return baoGiaHieuLuc(yc).filter((don) => laDaChot(don.trangThai));
}

/** Lúc gửi yêu cầu báo giá: ngày gửi sớm nhất trong các báo giá (backend ghi `ngayDatHang` lúc gửi). */
export function ngayGuiBaoGia(yc) {
  const ngays = baoGiaHieuLuc(yc)
    .map((don) => docNgay(don.ngayDatHang))
    .filter(Boolean)
    .map((d) => d.getTime());
  return ngays.length ? new Date(Math.min(...ngays)) : null;
}

/** Số nhà cung cấp đã gửi giá (ít nhất một dòng có giá) trên tổng số nhà cung cấp được gửi yêu cầu. */
export function demNccDaGuiGia(yc) {
  const ds = baoGiaHieuLuc(yc);
  return { daGui: ds.filter((don) => congGia(don.chiTietDonMuaHangs).coMotPhan).length, tong: ds.length };
}

/** Tên nhà cung cấp của một báo giá (thiếu thì mã nhà cung cấp, rồi số báo giá). */
const tenNccCua = (don) => don?.nhaCungCap?.tenNhaCungCap || don?.nhaCungCap?.maNhaCungCap || don?.soDonMua || "";

/**
 * Tóm tắt báo giá của yêu cầu cho màn Yêu cầu báo giá (dòng phụ đầu khối, nhóm "Báo giá" ở cột phải), tính trên các
 * báo giá còn hiệu lực (bỏ báo giá đã xóa).
 * @returns `{ daGui, daBaoGia, daChot, tongDaChot, nccChot, ngayGui }`
 *   - `daGui`: số nhà cung cấp được gửi yêu cầu · `daBaoGia`: đã gửi giá ít nhất một dòng · `daChot`: đã chấp nhận (3, 5)
 *   - `tongDaChot`: cộng tổng tiền các báo giá đã chấp nhận (tinhBaoGia.tongTienBaoGia) · `nccChot`: tên nhà cung cấp của chúng
 *   - `ngayGui`: lúc gửi yêu cầu sớm nhất (ngayGuiBaoGia), chưa gửi thì null
 */
export function tomTatBaoGia(yc) {
  const ds = baoGiaHieuLuc(yc);
  const chot = ds.filter((don) => laDaChot(don.trangThai));
  return {
    daGui: ds.length,
    daBaoGia: ds.filter((don) => congGia(don.chiTietDonMuaHangs).coMotPhan).length,
    daChot: chot.length,
    tongDaChot: chot.reduce((tong, don) => tong + tongTienBaoGia(don), 0),
    nccChot: chot.map(tenNccCua).filter(Boolean),
    ngayGui: ngayGuiBaoGia(yc),
  };
}

/**
 * Các phần của dòng phụ đầu khối (nối bằng " · "): "đã gửi 3 nhà cung cấp", "2 đã báo giá", "1 đã chốt".
 * Chưa ai báo giá thì "chưa có báo giá"; chưa chốt thì bỏ phần chốt; chưa gửi thì chỉ "chưa gửi nhà cung cấp nào".
 * `tomTat`: tomTatBaoGia.
 */
export function chuDemBaoGia(tomTat) {
  const daGui = docSo(tomTat?.daGui);
  if (!daGui) return ["chưa gửi nhà cung cấp nào"];
  const daBaoGia = docSo(tomTat?.daBaoGia);
  const daChot = docSo(tomTat?.daChot);
  return [
    `đã gửi ${soVN(daGui)} nhà cung cấp`,
    daBaoGia ? `${soVN(daBaoGia)} đã báo giá` : "chưa có báo giá",
    daChot ? `${soVN(daChot)} đã chốt` : null,
  ].filter(Boolean);
}

/** Danh sách tên nhà cung cấp ngắn gọn: tối đa `toiDa` tên, còn lại "và n nhà cung cấp khác". */
export function chuDsNcc(ten, toiDa = 2) {
  const ds = (Array.isArray(ten) ? ten : []).filter(Boolean);
  if (ds.length <= toiDa) return ds.join(", ");
  return `${ds.slice(0, toiDa).join(", ")} và ${soVN(ds.length - toiDa)} nhà cung cấp khác`;
}

/**
 * 5 bước: Tạo yêu cầu → Quản lý kho duyệt → Gửi yêu cầu báo giá → Nhận báo giá (n/N nhà cung cấp) → Chốt đơn mua hàng.
 * Mỗi bước `{ ma, nhan, trangThai: "xong" | "dangLam" | "chua" | "dung", phu, ngay, coGio }` (TienTrinhChungTu).
 * Mốc giờ: `ngayTao`, `ngayDuyet` (lần duyệt / từ chối gần nhất), ngày gửi báo giá sớm nhất. Ngày chốt không có ở backend.
 */
export function tinhBuocYeuCau(yc) {
  const tt = docSo(yc?.trangThai);
  const coTrangThai = yc?.trangThai != null && Object.values(TRANG_THAI_YEU_CAU).includes(tt);
  const daDuyet = [TRANG_THAI_YEU_CAU.DA_DUYET, TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA, TRANG_THAI_YEU_CAU.DA_CHUYEN_DON_MUA].includes(tt);
  const daGui = tt === TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA || tt === TRANG_THAI_YEU_CAU.DA_CHUYEN_DON_MUA;
  const daChuyen = tt === TRANG_THAI_YEU_CAU.DA_CHUYEN_DON_MUA;
  const { daGui: soDaGuiGia, tong: soNcc } = demNccDaGuiGia(yc);
  const nccChot = baoGiaDaChot(yc).map(tenNccCua).filter(Boolean);

  const tao = coTrangThai && tt === TRANG_THAI_YEU_CAU.NHAP
    ? { trangThai: "dangLam", phu: "Nháp" }
    : { trangThai: "xong", phu: "" };

  let duyet;
  if (tt === TRANG_THAI_YEU_CAU.CHO_DUYET) {
    const quanLy = yc?.khoNhap?.quanLy?.hoTen;
    duyet = { nhan: "Quản lý kho duyệt", trangThai: "dangLam", phu: quanLy ? `Chờ ${quanLy}` : "Chờ quản lý kho" };
  } else if (daDuyet) {
    duyet = { nhan: "Quản lý kho duyệt", trangThai: "xong", ngay: yc?.ngayDuyet ?? null, coGio: true };
  } else if (tt === TRANG_THAI_YEU_CAU.TU_CHOI) {
    duyet = { nhan: "Đã từ chối", trangThai: "dung", ngay: yc?.ngayDuyet ?? null, coGio: true };
  } else {
    duyet = { nhan: "Quản lý kho duyệt", trangThai: "chua" };
  }

  let gui;
  if (tt === TRANG_THAI_YEU_CAU.DA_DUYET) gui = { trangThai: "dangLam", phu: "Chờ nhân viên mua hàng gửi" };
  else if (daGui) {
    gui = { trangThai: "xong", phu: soNcc ? `${soVN(soNcc)} nhà cung cấp` : "", ngay: ngayGuiBaoGia(yc), coGio: true };
  } else gui = { trangThai: "chua" };

  const chuNhan = soNcc ? `${soVN(soDaGuiGia)}/${soVN(soNcc)} nhà cung cấp đã gửi giá` : "";
  const nhanGia = daChuyen
    ? { trangThai: "xong", phu: chuNhan }
    : tt === TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA
      ? { trangThai: "dangLam", phu: chuNhan }
      : { trangThai: "chua" };

  return [
    { ma: "tao", nhan: "Tạo yêu cầu", ngay: yc?.ngayTao ?? null, coGio: true, ...tao },
    { ma: "duyet", ...duyet },
    { ma: "gui", nhan: "Gửi yêu cầu báo giá", ...gui },
    { ma: "nhan", nhan: "Nhận báo giá", ...nhanGia },
    { ma: "chot", nhan: "Chốt đơn mua hàng", trangThai: daChuyen ? "xong" : "chua", phu: daChuyen ? nccChot.join(", ") : "" },
  ];
}

/**
 * Quyền Phê duyệt / Từ chối, khớp backend YeuCauMuaHangService.coQuyenDuyetKho: quản trị viên mọi kho; quản lý kho
 * chỉ kho nhận của yêu cầu — là quản lý ghi trên kho (`khoNhap.quanLy`) hoặc được phân quyền còn hiệu lực tại kho đó.
 *
 * @param tuyChon
 *   - `laQuanTriVien`, `laQuanLyKho`: vai trò người đang đăng nhập
 *   - `nguoiDungId`: id người đang đăng nhập (JWT `id`)
 *   - `khoNhap`: kho nhận của yêu cầu (`{ id, quanLy: { id } }`)
 *   - `khoPhuTrachIds`: id các kho được phân quyền còn hiệu lực (đọc từ token như backend)
 * @returns `{ duocDuyet, khacKho }` — `khacKho`: là quản lý kho nhưng không phụ trách kho nhận (hiện câu giải thích)
 */
export function quyenDuyetYeuCau({ laQuanTriVien = false, laQuanLyKho = false, nguoiDungId = null, khoNhap = null, khoPhuTrachIds = [] } = {}) {
  if (laQuanTriVien) return { duocDuyet: true, khacKho: false };
  if (!laQuanLyKho) return { duocDuyet: false, khacKho: false };
  const giong = (a, b) => a != null && b != null && String(a) === String(b);
  const laQuanLyGhiTrenKho = giong(khoNhap?.quanLy?.id, nguoiDungId);
  const duocPhanQuyen = (Array.isArray(khoPhuTrachIds) ? khoPhuTrachIds : []).some((id) => giong(id, khoNhap?.id));
  const duocDuyet = Boolean(khoNhap) && (laQuanLyGhiTrenKho || duocPhanQuyen);
  return { duocDuyet, khacKho: !duocDuyet };
}
