/*
 * Logic thuần của màn Chi tiết phiếu chuyển kho nội bộ (/transfer-tickets/:id): đổi dòng API sang dòng chứng từ,
 * tìm phiếu xuất con / phiếu nhập trong hai danh sách đã tải, quyền và nút theo trạng thái, 4 bước tiến trình,
 * các dòng thông báo. Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Mã trạng thái (backend PhieuXuatKhoService / PhieuNhapKhoService):
 * - Phiếu chuyển kho (phiếu xuất loại `khac`): 0 Nháp → 1 Chờ duyệt → 2 Chờ xuất hàng → 3 Đang vận chuyển → 5 Hoàn thành; 4 Đã hủy.
 * - Phiếu xuất con (loại `chuyen_kho`): 0 Nháp (đang chọn lô) → 3 Đã xuất; 4 Đã hủy.
 * - Phiếu nhập: 0 Chờ nhập kho → 3 Đã nhập kho; 4 Đã hủy.
 */
import { cauChungTuRong, docSo } from "../chung-tu/bangChungTu.js";

export const TT_CHUYEN = Object.freeze({ NHAP: 0, CHO_DUYET: 1, CHO_XUAT: 2, DANG_CHUYEN: 3, DA_HUY: 4, HOAN_THANH: 5 });
export const TT_PHIEU_XUAT = Object.freeze({ NHAP: 0, DA_XUAT: 3, DA_HUY: 4 });
export const TT_PHIEU_NHAP = Object.freeze({ CHO_NHAP: 0, DA_NHAP: 3, DA_HUY: 4 });

// Backend trả "Chưa duyệt" khi phiếu chưa có người duyệt (TransferDetailDto.nguoiDuyetTen)
const CHUA_DUYET = "Chưa duyệt";
// tenSanPham của dòng chuyển kho là "<Tên sản phẩm> - <Tên màu>" (getTransferDetail), không có kích cỡ
const NOI_TEN_MAU = " - ";

const cungId = (a, b) => a != null && b != null && String(a) === String(b);
const coChu = (x) => x != null && String(x).trim() !== "";

/**
 * Tách "<Tên sản phẩm> - <Tên màu>" ở dấu " - " CUỐI: tên sản phẩm có thể chứa " - ", tên màu thì không.
 * Không có dấu nối: cả chuỗi là tên sản phẩm (không màu).
 */
export function tachTenMau(ten) {
  const chu = String(ten ?? "").trim();
  const viTri = chu.lastIndexOf(NOI_TEN_MAU);
  if (viTri <= 0) return { tenSanPham: chu, tenMau: "" };
  return { tenSanPham: chu.slice(0, viTri).trim(), tenMau: chu.slice(viTri + NOI_TEN_MAU.length).trim() };
}

/**
 * Dòng chứng từ (bangChungTu.js) từ `items[]` của GET /phieu-chuyen-kho/{id}. Gom nhóm theo tên sản phẩm đã tách
 * (DTO không có id sản phẩm; SKU cũ không theo một mẫu nên không tách được mã sản phẩm từ SKU).
 *
 * @param soDaLay `{ [bienTheId]: number }` số đã lấy của từng biến thể (từ phiếu xuất con), hoặc `null` khi không
 *   hiện cột; `"theoYeuCau"`: hàng đã xuất (backend chỉ cho xuất khi đã lấy đủ) nên số đã xuất = số yêu cầu.
 */
export function dongChuyenKho(items, soDaLay = null) {
  return (Array.isArray(items) ? items : []).map((it, i) => {
    const { tenSanPham, tenMau } = tachTenMau(it?.tenSanPham);
    const soLuong = docSo(it?.soLuongYeuCau);
    let daLay = null;
    if (soDaLay === "theoYeuCau") daLay = soLuong;
    else if (soDaLay && typeof soDaLay === "object") daLay = docSo(soDaLay[it?.bienTheId]);
    return {
      id: `${it?.bienTheId ?? "dong"}-${i}`,
      bienTheId: it?.bienTheId ?? null,
      tenSanPham: tenSanPham || it?.sku || "",
      tenMau,
      sku: it?.sku || "",
      soLuong,
      daLay,
    };
  });
}

/**
 * Lọc nhanh của bảng hàng chuyển cho useBangChungTu: "Thiếu lô" (số đã lấy < yêu cầu) chỉ lọc khi phiếu xuất con đang
 * chọn lô (`coLoc`); ngoài lúc đó lựa chọn này là null (không lọc) nên lọc đã chọn trước không che dòng khi cột
 * "Đã lấy" không còn.
 */
export const boLocHangChuyen = (coLoc) => ({
  tatCa: null,
  thieuLo: coLoc ? (d) => d.daLay != null && d.daLay < d.soLuong : null,
});

/** Số đã lấy theo biến thể từ `chiTiet[]` của GET /phieu-xuat-kho/{id} (mỗi dòng gốc mang tổng đã lấy của biến thể). */
export function soDaLayTheoBienThe(chiTiet) {
  const kq = {};
  for (const ct of Array.isArray(chiTiet) ? chiTiet : []) {
    if (ct?.bienTheSanPhamId == null || kq[ct.bienTheSanPhamId] != null) continue;
    kq[ct.bienTheSanPhamId] = docSo(ct.soLuongDaPick);
  }
  return kq;
}

// Cùng điều kiện so khớp màn cũ đang dùng (giữ nguyên cách tìm trong hai danh sách đã tải)
const laPhieuXuatCua = (px, id) =>
  cungId(px?.phieuChuyenKhoGocId, id) || cungId(px?.phieuChuyenId, id) || cungId(px?.transferId, id);
const laPhieuNhapCua = (pn, id) =>
  cungId(pn?.phieuXuatGocId, id) || cungId(pn?.phieuChuyenId, id) || cungId(pn?.transferId, id);

/** Phiếu xuất con của phiếu chuyển `id` (bỏ phiếu đã hủy), như màn cũ; không có thì null. */
export function timPhieuXuatCon(dsPhieuXuat, id) {
  return (Array.isArray(dsPhieuXuat) ? dsPhieuXuat : []).find((px) => laPhieuXuatCua(px, id) && px.trangThai !== TT_PHIEU_XUAT.DA_HUY) ?? null;
}

/**
 * Phiếu nhập của phiếu chuyển `id`: `tatCa` (giữ thứ tự danh sách, kể cả phiếu đã hủy) và `hieuLuc` (phiếu chưa hủy đầu
 * tiên). Backend (createImportFromTransfer) cho lập lại phiếu nhập sau khi phiếu trước bị hủy, nên phiếu đã hủy không
 * còn khóa nút "Nhập kho" như bản cũ.
 */
export function timPhieuNhap(dsPhieuNhap, id) {
  const tatCa = (Array.isArray(dsPhieuNhap) ? dsPhieuNhap : []).filter((pn) => laPhieuNhapCua(pn, id));
  return { tatCa, hieuLuc: tatCa.find((pn) => pn.trangThai !== TT_PHIEU_NHAP.DA_HUY) ?? null };
}

/** Phiếu nhập hoàn trả (nhập lại kho nguồn sau khi hủy) hay phiếu nhập ở kho đích. */
export function laPhieuNhapHoanTra(pn, phieu) {
  if (!pn) return false;
  if (pn.khoId != null && phieu?.khoXuatId != null) return cungId(pn.khoId, phieu.khoXuatId);
  return String(pn.soPhieuNhap ?? "").includes("-RET-");
}

/** Phiếu đã qua bước duyệt xuất (có người duyệt, hoặc trạng thái / phiếu xuất con cho thấy đã duyệt). */
export function daDuyetXuat(phieu, phieuXuat) {
  const tt = phieu?.trangThai;
  if ([TT_CHUYEN.CHO_XUAT, TT_CHUYEN.DANG_CHUYEN, TT_CHUYEN.HOAN_THANH].includes(tt) || phieuXuat) return true;
  return coChu(phieu?.nguoiDuyetTen) && phieu.nguoiDuyetTen !== CHUA_DUYET;
}

/**
 * Hàng đã rời kho nguồn: phiếu xuất con Đã xuất (phiếu chuyển 3 / 5 chỉ có được khi đã xuất), hoặc phiếu chuyển đã có
 * phiếu nhập, kể cả phiếu đã hủy (`coPhieuNhap`: backend chỉ lập phiếu nhập khi có phiếu xuất con Đã xuất). Phiếu nhập giúp
 * người ở kho đích biết hàng đã xuất: danh sách phiếu xuất chỉ có phiếu của các kho mình phụ trách.
 */
export function daXuatHang(phieu, phieuXuat, coPhieuNhap = false) {
  return [TT_CHUYEN.DANG_CHUYEN, TT_CHUYEN.HOAN_THANH].includes(phieu?.trangThai) ||
    phieuXuat?.trangThai === TT_PHIEU_XUAT.DA_XUAT ||
    Boolean(coPhieuNhap);
}

/**
 * Quyền hiển thị — giữ đúng cách màn cũ tính (backend @RequireAuth vẫn là chốt chặn thật):
 * - `laKho`: quản lý kho hoặc nhân viên kho (quản trị viên thuần không có nút tạo phiếu xuất / nhập).
 * - `laQuanLyDich` / `laQuanLyNguon`: quản trị viên, hoặc quản lý kho được phân công kho đích / kho nguồn.
 * - `oKhoNguon` / `oKhoDich`: kho nguồn / kho đích có trong các kho được phân công (POST /kho/mine).
 */
export function tinhQuyen(vaiTro, khoCuaToi, phieu) {
  const ds = Array.isArray(vaiTro) ? vaiTro : [];
  const kho = (Array.isArray(khoCuaToi) ? khoCuaToi : []).map(String);
  const laQuanTri = ds.includes("quan_tri_vien");
  const laQuanLy = ds.includes("quan_ly_kho") || laQuanTri;
  const oKhoNguon = phieu?.khoXuatId != null && kho.includes(String(phieu.khoXuatId));
  const oKhoDich = phieu?.khoNhapId != null && kho.includes(String(phieu.khoNhapId));
  return {
    laKho: ds.includes("quan_ly_kho") || ds.includes("nhan_vien_kho"),
    laNhanVienKho: ds.includes("nhan_vien_kho"),
    laQuanTri,
    laQuanLyDich: laQuanTri || (laQuanLy && oKhoDich),
    laQuanLyNguon: laQuanTri || (laQuanLy && oKhoNguon),
    oKhoNguon,
    oKhoDich,
  };
}

/**
 * Nút ở đầu khối theo trạng thái (mỗi trạng thái nhiều nhất một nút chính) và mục "Hủy phiếu" của menu ⋯.
 * Điều kiện hiện giữ như màn cũ; chỗ khác: đã có phiếu xuất / phiếu nhập đang chờ thì mở phiếu đó thay cho nút tạo bị
 * khóa, phiếu nhập đã hủy không còn khóa nút, "Nhập kho hoàn trả" chỉ khi hàng đã rời kho nguồn.
 *
 * @returns `{ guiDuyet: { khoa, lyDo } | null, pheDuyet, taoPhieuXuat, moPhieuXuat, nhapKho, moPhieuNhap,
 *   nhapHoanTra: { khoa, lyDo } | null, huy }` (`moPhieuXuat` / `moPhieuNhap`: phiếu cần mở hoặc null)
 */
export function tinhNut({ phieu, quyen, phieuXuat = null, phieuNhap = null, coPhieuNhap = Boolean(phieuNhap), rong = false }) {
  const tt = phieu?.trangThai;
  const q = quyen ?? {};
  const kq = {
    guiDuyet: null,
    pheDuyet: false,
    taoPhieuXuat: false,
    moPhieuXuat: null,
    nhapKho: false,
    moPhieuNhap: null,
    nhapHoanTra: null,
    huy: !q.laNhanVienKho && [TT_CHUYEN.NHAP, TT_CHUYEN.CHO_DUYET, TT_CHUYEN.CHO_XUAT, TT_CHUYEN.DANG_CHUYEN].includes(tt),
  };
  if (tt === TT_CHUYEN.NHAP && q.laQuanLyDich) {
    kq.guiDuyet = { khoa: rong, lyDo: rong ? cauChungTuRong("phiếu chuyển kho", { dauCham: false }) : "" };
  }
  if (tt === TT_CHUYEN.CHO_DUYET && q.laQuanLyNguon) kq.pheDuyet = true;
  if (tt === TT_CHUYEN.CHO_XUAT && q.laKho && q.oKhoNguon) {
    if (phieuXuat) kq.moPhieuXuat = phieuXuat;
    else kq.taoPhieuXuat = true;
  }
  if (tt === TT_CHUYEN.DANG_CHUYEN && q.laKho && q.oKhoDich) {
    if (!phieuNhap) kq.nhapKho = true;
    else if (phieuNhap.trangThai === TT_PHIEU_NHAP.CHO_NHAP) kq.moPhieuNhap = phieuNhap;
  }
  if (tt === TT_CHUYEN.DA_HUY && q.laKho && q.oKhoNguon && daXuatHang(phieu, phieuXuat, coPhieuNhap)) {
    if (!phieuNhap) {
      kq.nhapHoanTra = { khoa: false, lyDo: "" };
    } else if (laPhieuNhapHoanTra(phieuNhap, phieu)) {
      if (phieuNhap.trangThai === TT_PHIEU_NHAP.CHO_NHAP) kq.moPhieuNhap = phieuNhap;
    } else if (phieuNhap.trangThai === TT_PHIEU_NHAP.CHO_NHAP) {
      kq.nhapHoanTra = {
        khoa: true,
        lyDo: `Phiếu nhập ${phieuNhap.soPhieuNhap || ""} tại ${phieu?.khoNhapTen || "kho đích"} chưa hủy`.replace(/\s+/g, " "),
      };
    }
  }
  return kq;
}

/**
 * Bốn bước Tạo yêu cầu (kho đích) → Duyệt xuất (kho nguồn) → Xuất kho (kho nguồn) → Nhận hàng (kho đích) cho
 * TienTrinhChungTu. Phiếu đã hủy: bước dừng ghi "Đã hủy" và lúc hủy (trước khi duyệt / khi đang chọn lô / hàng chưa nhận).
 * `daLay`: `{ da, can }` khi phiếu xuất con đang chọn lô (đã tải số đã lấy), không thì null.
 */
export function tinhBuocChuyenKho({ phieu, phieuXuat = null, phieuNhap = null, coPhieuNhap = Boolean(phieuNhap), daLay = null }) {
  const tt = phieu?.trangThai;
  const huy = tt === TT_CHUYEN.DA_HUY;
  const duyet = daDuyetXuat(phieu, phieuXuat);
  const xuat = daXuatHang(phieu, phieuXuat, coPhieuNhap);
  const pnHoanTra = laPhieuNhapHoanTra(phieuNhap, phieu) ? phieuNhap : null;
  const pnDich = phieuNhap && !pnHoanTra ? phieuNhap : null;
  const so = (n) => docSo(n).toLocaleString("vi-VN");

  const tao = tt === TT_CHUYEN.NHAP
    ? { ma: "tao", nhan: "Tạo yêu cầu", ai: "Kho đích", trangThai: "dangLam", phu: "Chưa gửi duyệt", ngay: phieu?.ngayTao, coGio: true }
    : { ma: "tao", nhan: "Tạo yêu cầu", ai: "Kho đích", trangThai: "xong", ngay: phieu?.ngayTao, coGio: true };

  let buocDuyet = { ma: "duyet", nhan: "Duyệt xuất", ai: "Kho nguồn", trangThai: "chua" };
  if (huy && !duyet) buocDuyet = { ...buocDuyet, nhan: "Đã hủy", trangThai: "dung", phu: "Trước khi duyệt" };
  else if (duyet) buocDuyet = { ...buocDuyet, trangThai: "xong" };
  else if (tt === TT_CHUYEN.CHO_DUYET) {
    buocDuyet = { ...buocDuyet, trangThai: "dangLam", phu: phieu?.khoXuatTen ? `Chờ quản lý ${phieu.khoXuatTen}` : "Chờ quản lý kho nguồn" };
  }

  let buocXuat = { ma: "xuat", nhan: "Xuất kho", ai: "Kho nguồn", trangThai: "chua" };
  if (huy && duyet && !xuat) {
    buocXuat = { ...buocXuat, nhan: "Đã hủy", trangThai: "dung", phu: phieuXuat ? "Khi đang chọn lô" : "Trước khi xuất hàng" };
  } else if (xuat) {
    buocXuat = { ...buocXuat, trangThai: "xong", ngay: phieuXuat?.ngayXuat, coGio: true };
  } else if (tt === TT_CHUYEN.CHO_XUAT) {
    const phu = !phieuXuat
      ? "Chờ tạo phiếu xuất"
      : daLay
        ? `Đang chọn lô · đã lấy ${so(daLay.da)}/${so(daLay.can)}`
        : "Đang chọn lô";
    buocXuat = { ...buocXuat, trangThai: "dangLam", phu };
  }

  let buocNhan = { ma: "nhan", nhan: "Nhận hàng", ai: "Kho đích", trangThai: "chua" };
  if (huy && xuat) {
    const phu = pnHoanTra?.trangThai === TT_PHIEU_NHAP.DA_NHAP
      ? "Đã nhập hoàn trả"
      : pnHoanTra?.trangThai === TT_PHIEU_NHAP.CHO_NHAP
        ? "Chờ nhập hoàn trả"
        : "Hàng chưa nhận";
    buocNhan = {
      ...buocNhan,
      nhan: "Đã hủy",
      trangThai: "dung",
      phu,
      ngay: pnHoanTra?.trangThai === TT_PHIEU_NHAP.DA_NHAP ? pnHoanTra.ngayNhap : undefined,
      coGio: true,
    };
  } else if (tt === TT_CHUYEN.HOAN_THANH || pnDich?.trangThai === TT_PHIEU_NHAP.DA_NHAP) {
    buocNhan = { ...buocNhan, trangThai: "xong", ngay: pnDich?.ngayNhap, coGio: true };
  } else if (tt === TT_CHUYEN.DANG_CHUYEN) {
    buocNhan = { ...buocNhan, trangThai: "dangLam", phu: pnDich?.trangThai === TT_PHIEU_NHAP.CHO_NHAP ? "Chờ nhận hàng" : "Chờ lập phiếu nhập" };
  }

  return [tao, buocDuyet, buocXuat, buocNhan];
}

/**
 * Các dòng thông báo khi phiếu đã hủy mà hàng hay phiếu con còn dở (nơi khác của màn chưa nói):
 * - `dangDuong`: hàng đã rời kho nguồn, chưa có phiếu nhập hoàn trả;
 * - `phieuXuatNhap`: phiếu xuất con vẫn Nháp (backend không tự hủy theo, vẫn xuất được);
 * - `phieuNhapCho`: phiếu nhập ở kho đích vẫn chờ nhận (phải hủy trước khi lập phiếu nhập hoàn trả).
 */
export function tinhThongBao({ phieu, phieuXuat = null, phieuNhap = null, coPhieuNhap = Boolean(phieuNhap) }) {
  if (phieu?.trangThai !== TT_CHUYEN.DA_HUY) return { dangDuong: false, phieuXuatNhap: null, phieuNhapCho: null };
  const xuat = daXuatHang(phieu, phieuXuat, coPhieuNhap);
  return {
    dangDuong: xuat && !phieuNhap,
    phieuXuatNhap: phieuXuat?.trangThai === TT_PHIEU_XUAT.NHAP ? phieuXuat : null,
    phieuNhapCho: xuat && phieuNhap && !laPhieuNhapHoanTra(phieuNhap, phieu) && phieuNhap.trangThai === TT_PHIEU_NHAP.CHO_NHAP
      ? phieuNhap
      : null,
  };
}

/**
 * Khi quay lại tab, có cần tải lại hai danh sách lớn (phiếu xuất / phiếu nhập) không: chỉ khi chứng từ liên quan có thể
 * vừa đổi (chưa có mà sắp có, hoặc đang ở bước dở). Trả `{ phieuXuat, phieuNhap }`.
 */
export function canTaiLaiChungTu({ phieu, phieuXuat = null, phieuNhap = null, coPhieuNhap = Boolean(phieuNhap) }) {
  const tt = phieu?.trangThai;
  const xuat = daXuatHang(phieu, phieuXuat, coPhieuNhap);
  const canPhieuXuat =
    (tt === TT_CHUYEN.CHO_XUAT && (!phieuXuat || phieuXuat.trangThai === TT_PHIEU_XUAT.NHAP)) ||
    ([TT_CHUYEN.DANG_CHUYEN, TT_CHUYEN.HOAN_THANH].includes(tt) && phieuXuat?.trangThai !== TT_PHIEU_XUAT.DA_XUAT) ||
    (tt === TT_CHUYEN.DA_HUY && phieuXuat?.trangThai === TT_PHIEU_XUAT.NHAP);
  const canPhieuNhap =
    (tt === TT_CHUYEN.DANG_CHUYEN && (!phieuNhap || phieuNhap.trangThai === TT_PHIEU_NHAP.CHO_NHAP)) ||
    (tt === TT_CHUYEN.HOAN_THANH && phieuNhap?.trangThai !== TT_PHIEU_NHAP.DA_NHAP) ||
    (tt === TT_CHUYEN.DA_HUY && xuat && (!phieuNhap || phieuNhap.trangThai === TT_PHIEU_NHAP.CHO_NHAP));
  return { phieuXuat: canPhieuXuat, phieuNhap: canPhieuNhap };
}
