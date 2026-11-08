import { getMineKhoList } from "@/services/khoService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import purchaseOrderService from "@/services/purchaseOrderService";
import purchaseRequestService from "@/services/purchaseRequestService";
import { DON_MUA_HANG_TABS, getDonMuaHangStatus } from "@/constants/donMuaHang";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import { getPhieuChuyenKhoStatus } from "@/constants/phieuChuyenKho";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import { ROLES, hasAnyRole } from "@/utils/roles";

/*
 * Tìm chứng từ theo mã cho ô Tìm kiếm toàn hệ thống: phiếu xuất (PX…, PXK…, PX-CK…), phiếu nhập (PN…, PN-TRF…),
 * phiếu chuyển kho (PX-TRF…, lệnh LDD…), đơn mua (PO…), yêu cầu nhập (PR…). Mỗi loại gọi đúng API lọc mà trang danh
 * sách của nó đang dùng, một trang nhỏ; trang danh sách nào người dùng không được vào (theo menu) thì không tìm loại đó.
 * Một loại bị máy chủ từ chối (403, chưa chọn kho làm việc…) thì bỏ qua loại đó, các loại khác vẫn hiện.
 * `cauHinh` (tùy chọn) truyền xuống axios, vd. { signal } để ô tìm kiếm hủy lần tìm cũ khi người dùng gõ tiếp.
 *
 * Dòng trả về: `{ id, ma, tenLoai, trangThai, quyTrinh, phu, to }` — `quyTrinh` cho StatusBadge, `to`: trang chi tiết.
 */

const SO_DONG_MOI_LOAI = 10;
// Tiền tố mã chứng từ: PX / PXK / PX-CK / PX-TRF (phiếu xuất, phiếu chuyển), PN / PN-TRF / PN-RET (phiếu nhập), PO (đơn
// mua), PR (yêu cầu nhập), LDD (lệnh điều động); TRF, CK: phần giữa mã phiếu chuyển. Chỉ tính khi từ khóa đúng bằng
// tiền tố hoặc tiền tố + "-" ("PX", "PN-RET"), không bắt chữ thường bắt đầu giống tiền tố ("Polo", "Product")
const TIEN_TO_MA = /^(PXK?|PN|PO|PR|LDD|TRF|CK)(-|$)/i;

/** Đơn mua chỉ có trạng thái của trang Đơn mua hàng (tab Tất cả); mã khác là bước báo giá, xem ở Yêu cầu báo giá. */
const TRANG_THAI_DON_MUA = DON_MUA_HANG_TABS.find((t) => t.ma === "tat-ca")?.trangThai ?? [3, 5];

/**
 * Từ khóa có dáng mã chứng từ: không có khoảng trắng và có cả chữ cái lẫn chữ số ("PX2026", "pn-trf-12"), hoặc là tiền
 * tố mã ("PX", "LDD-"). Dãy toàn số (số điện thoại, mã khách), tên sản phẩm, tên khách thì không gọi năm API chứng từ.
 */
export function giongMaChungTu(tuKhoa) {
  const tk = String(tuKhoa ?? "").trim();
  if (tk.length < 2 || /\s/.test(tk)) return false;
  return (/\p{L}/u.test(tk) && /\d/.test(tk)) || TIEN_TO_MA.test(tk);
}

const docTrang = (trang) => ({
  content: Array.isArray(trang?.content) ? trang.content : [],
  totalElements: Number(trang?.totalElements) || 0,
});

const locMa = (fieldName, tuKhoa) => ({ fieldName, operation: "LIKE", value: tuKhoa, logicType: "AND" });

async function timPhieuXuat(tuKhoa, cauHinh) {
  const trang = docTrang(
    await phieuXuatKhoService.filter({
      page: 0,
      size: SO_DONG_MOI_LOAI,
      filters: [locMa("soPhieuXuat", tuKhoa)],
      sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
    }, cauHinh),
  );
  return {
    ...trang,
    content: trang.content.map((p) => ({
      id: `phieuXuat-${p.id}`,
      ma: p.soPhieuXuat,
      tenLoai: "Phiếu xuất kho",
      trangThai: getPhieuXuatKhoStatus(p.trangThai).label,
      quyTrinh: "phieuXuat",
      phu: p.kho?.tenKho,
      to: `/goods-issues/${p.id}`,
    })),
  };
}

async function timPhieuNhap(tuKhoa, cauHinh) {
  const trang = docTrang(
    await phieuNhapKhoService.filter({
      page: 0,
      size: SO_DONG_MOI_LOAI,
      filters: [locMa("soPhieuNhap", tuKhoa)],
      sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
    }, cauHinh),
  );
  return {
    ...trang,
    content: trang.content.map((p) => ({
      id: `phieuNhap-${p.id}`,
      ma: p.soPhieuNhap,
      tenLoai: "Phiếu nhập kho",
      trangThai: getGoodsReceiptStatus(p.trangThai).label,
      quyTrinh: "phieuNhap",
      phu: p.tenKho || p.kho?.tenKho,
      to: `/goods-receipts/${p.id}`,
    })),
  };
}

async function timPhieuChuyen(tuKhoa, cauHinh) {
  // Máy chủ tìm theo số phiếu chuyển và số lệnh điều động
  const trang = docTrang(await phieuChuyenKhoService.danhSach({ q: tuKhoa, page: 0, size: SO_DONG_MOI_LOAI }, cauHinh));
  return {
    ...trang,
    content: trang.content.map((p) => ({
      id: `phieuChuyen-${p.id}`,
      ma: p.soPhieuChuyen,
      tenLoai: "Phiếu chuyển kho",
      trangThai: getPhieuChuyenKhoStatus(p.trangThai, p.coChenhLech, p.tuChoi).label,
      quyTrinh: "chuyenKho",
      phu: p.khoXuatTen && p.khoNhapTen ? `${p.khoXuatTen} → ${p.khoNhapTen}` : p.khoXuatTen || p.khoNhapTen,
      to: `/transfer-tickets/${p.id}`,
    })),
  };
}

async function timDonMua(tuKhoa, cauHinh) {
  // Máy chủ tự giới hạn kho nhận theo vai trò (DonMuaHangService.filter)
  const res = await purchaseOrderService.filter({
    page: 0,
    size: SO_DONG_MOI_LOAI,
    filters: [
      { fieldName: "trangThai", operation: "IN", value: TRANG_THAI_DON_MUA, logicType: "AND" },
      locMa("soDonMua", tuKhoa),
    ],
    sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }],
  }, cauHinh);
  const trang = docTrang(res?.data ?? res);
  return {
    ...trang,
    content: trang.content.map((d) => ({
      id: `donMua-${d.id}`,
      ma: d.soDonMua,
      tenLoai: "Đơn mua hàng",
      trangThai: getDonMuaHangStatus(d.trangThai).label,
      quyTrinh: "donMua",
      phu: d.nhaCungCap?.tenNhaCungCap,
      to: `/purchase-orders/${d.id}`,
    })),
  };
}

// Kho của người dùng (POST /kho/mine), nhớ theo phiên đăng nhập: yêu cầu nhập chỉ giới hạn kho ở trình duyệt như trang
// danh sách Yêu cầu nhập hàng
let khoCuaToiDaNho = { token: null, hua: null };
function khoCuaToi() {
  const token = window.localStorage.getItem("access_token");
  if (khoCuaToiDaNho.token !== token || !khoCuaToiDaNho.hua) {
    const hua = getMineKhoList().then((ds) => ds.map((k) => k.id).filter((id) => id != null));
    // Lỗi thì lần tìm sau hỏi lại
    hua.catch(() => {
      if (khoCuaToiDaNho.hua === hua) khoCuaToiDaNho = { token: null, hua: null };
    });
    khoCuaToiDaNho = { token, hua };
  }
  return khoCuaToiDaNho.hua;
}

async function timYeuCauNhap(tuKhoa, cauHinh) {
  const filters = [locMa("soYeuCauMuaHang", tuKhoa)];
  // Như trang danh sách: quản lý / nhân viên kho (không kiêm quản trị, mua hàng) chỉ thấy yêu cầu của kho mình
  const gioiHanKho =
    !hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG]) && hasAnyRole([ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]);
  if (gioiHanKho) {
    const khoIds = await khoCuaToi();
    if (!khoIds.length) return { content: [], totalElements: 0 };
    filters.push({ fieldName: "khoNhap.id", operation: "IN", value: khoIds, logicType: "AND" });
  }
  const res = await purchaseRequestService.filter({
    page: 0,
    size: SO_DONG_MOI_LOAI,
    filters,
    sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
  }, cauHinh);
  const trang = docTrang(res?.data?.data ?? res?.data);
  return {
    ...trang,
    content: trang.content.map((y) => ({
      id: `yeuCauNhap-${y.id}`,
      ma: y.soYeuCauMuaHang,
      tenLoai: "Yêu cầu nhập hàng",
      trangThai: getYeuCauNhapHangStatus(y.trangThai).label,
      quyTrinh: "yeuCauNhap",
      phu: y.khoNhap?.tenKho,
      to: `/purchase-requests/${y.id}`,
    })),
  };
}

/** Các loại chứng từ theo thứ tự hiện; `trang`: trang danh sách, vai trò được xem lấy theo menu bên trái. */
export const LOAI_CHUNG_TU = [
  { loai: "phieuXuat", trang: "/goods-issues", tim: timPhieuXuat },
  { loai: "phieuNhap", trang: "/goods-receipts", tim: timPhieuNhap },
  { loai: "phieuChuyen", trang: "/transfer-tickets", tim: timPhieuChuyen },
  { loai: "donMua", trang: "/purchase-orders", tim: timDonMua },
  { loai: "yeuCauNhap", trang: "/purchase-requests", tim: timYeuCauNhap },
];

/**
 * Tìm các loại `dsLoai` (phần tử của LOAI_CHUNG_TU) theo mã, gộp thành một trang `{ content, totalElements }`: mã bắt
 * đầu bằng từ khóa lên trước, còn lại giữ thứ tự loại. Từ khóa không giống mã → trang rỗng, không gọi máy chủ. Loại nào
 * lỗi thì bỏ; chỉ khi mọi loại đều lỗi mà có lỗi khác 403 mới báo lỗi cả nhóm. `cauHinh`: cấu hình axios cho mọi lời gọi
 * (vd. { signal }: hủy giữa chừng thì cả nhóm báo lỗi hủy, nơi gọi tự bỏ qua).
 */
export async function timChungTu(tuKhoa, dsLoai, cauHinh) {
  const tk = String(tuKhoa ?? "").trim();
  if (!giongMaChungTu(tk) || !dsLoai?.length) return { content: [], totalElements: 0 };
  const ketQua = await Promise.allSettled(dsLoai.map((l) => l.tim(tk, cauHinh)));
  const xong = ketQua.filter((k) => k.status === "fulfilled").map((k) => k.value);
  const loi = ketQua.filter((k) => k.status === "rejected").map((k) => k.reason);
  if (!xong.length && loi.some((e) => e?.response?.status !== 403)) throw loi.find((e) => e?.response?.status !== 403);

  const tkThuong = tk.toLowerCase();
  const dauKhop = (d) => (String(d.ma ?? "").toLowerCase().startsWith(tkThuong) ? 0 : 1);
  const content = xong
    .flatMap((t) => t.content)
    .filter((d) => d.ma)
    .map((d, i) => ({ d, i }))
    .sort((a, b) => dauKhop(a.d) - dauKhop(b.d) || a.i - b.i)
    .map(({ d }) => d);
  return { content, totalElements: xong.reduce((s, t) => s + t.totalElements, 0) };
}
