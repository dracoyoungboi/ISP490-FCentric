import { TRANG_THAI_KE_CHON } from "@/constants/nhapKho";
import { nhanLoaiKhach } from "@/components/khach-hang/chi-tiet/tinhKhachHang";
import { LOAI_KHO_OPTIONS } from "@/pages/warehouse/loaiKho";
import { formatDateTime } from "@/utils/dateTime";

/**
 * Nhãn dùng chung cho nhật ký (bảng lich_su_thay_doi): ngăn "Lịch sử thay đổi" của danh mục dữ liệu (người dùng, sản
 * phẩm, giá bán, danh mục, thuộc tính, nhà cung cấp, kho, vị trí kệ, khách hàng).
 * Mã hành động khớp backend constant/variables/IHanhDong.java; mã lạ thì hiện nguyên mã (không làm hỏng màn).
 */
export const NHAN_HANH_DONG = {
  // Phân quyền
  cap_quyen: "Cấp quyền",
  thu_hoi_quyen: "Thu hồi quyền",
  cap_nhat_quyen: "Cập nhật quyền",
  them_kho: "Thêm nơi làm việc",
  xoa_kho: "Bỏ nơi làm việc",
  nang_cap_chuc_vu: "Đổi vai trò",
  cap_nhat_phan_quyen: "Lưu phân quyền",
  cap_nhat_mau_quyen: "Sửa mẫu quyền",
  // Sản phẩm, giá bán
  cap_nhat_san_pham: "Sửa sản phẩm",
  them_moi_san_pham: "Thêm sản phẩm",
  xoa_san_pham: "Xóa sản phẩm",
  doi_gia_ban: "Đổi giá bán",
  // Tài khoản
  tao_tai_khoan: "Tạo tài khoản",
  khoa_tai_khoan: "Khóa tài khoản",
  mo_khoa_tai_khoan: "Mở khóa tài khoản",
  doi_mat_khau: "Đổi mật khẩu",
  dat_lai_mat_khau: "Đặt lại mật khẩu",
  sua_tai_khoan: "Sửa thông tin tài khoản",
  // Nhà cung cấp
  them_nha_cung_cap: "Thêm nhà cung cấp",
  sua_nha_cung_cap: "Sửa nhà cung cấp",
  doi_trang_thai_nha_cung_cap: "Đổi trạng thái nhà cung cấp",
  xoa_nha_cung_cap: "Xóa nhà cung cấp",
  // Danh mục dữ liệu
  tao_kho: "Tạo kho",
  sua_kho: "Sửa kho",
  doi_trang_thai_kho: "Đổi trạng thái kho",
  xoa_mem_kho: "Xóa kho",
  tao_khu_vuc: "Tạo khu vực",
  sua_khu_vuc: "Sửa khu vực",
  xoa_khu_vuc: "Xóa khu vực",
  tao_vi_tri: "Tạo vị trí kệ",
  sua_vi_tri: "Sửa vị trí kệ",
  xoa_vi_tri: "Xóa vị trí kệ",
  luu_mat_bang: "Lưu mặt bằng kho",
  them_khach_hang: "Thêm khách hàng",
  sua_khach_hang: "Sửa khách hàng",
  xoa_khach_hang: "Xóa khách hàng",
  them_ma_vach_ncc: "Thêm mã vạch NCC",
  xoa_ma_vach_ncc: "Xóa mã vạch NCC",
  them_danh_muc_chung: "Thêm danh mục",
  sua_danh_muc_chung: "Sửa danh mục",
  xoa_danh_muc_chung: "Xóa danh mục",
};

/** Hành động hiện nhấn đỏ (xóa, khóa tài khoản, thu hồi quyền). */
export function laHanhDongNguyHiem(hanhDong) {
  return /^(xoa|khoa_tai_khoan|thu_hoi)/.test(hanhDong ?? "");
}

export const NHAN_NGUON = {
  nguoi_dung: "Người dùng",
  he_thong: "Hệ thống",
  shopify: "Shopify",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  shopee: "Shopee",
  nha_cung_cap: "Nhà cung cấp",
};

/** Tên trường thường gặp trong giá trị cũ / mới. Khóa lạ thì hiện nguyên khóa. */
export const NHAN_TRUONG = {
  trangThai: "Trạng thái",
  maNhaCungCap: "Mã nhà cung cấp",
  tenNhaCungCap: "Tên nhà cung cấp",
  maSoThue: "Mã số thuế",
  nganHang: "Ngân hàng",
  soNganHang: "Số tài khoản",
  nguoiLienHe: "Người liên hệ",
  email: "Email",
  soDienThoai: "Số điện thoại",
  hoTen: "Họ tên",
  tenDangNhap: "Tên đăng nhập",
  diaChi: "Địa chỉ",
  maKhachHang: "Mã khách hàng",
  tenKhachHang: "Tên khách hàng",
  loaiKhachHang: "Loại khách hàng",
  maKho: "Mã kho",
  tenKho: "Tên kho",
  loaiKho: "Loại kho",
  quanLyKho: "Quản lý kho",
  maKhuVuc: "Mã khu vực",
  tenKhuVuc: "Tên khu vực",
  maViTri: "Mã vị trí",
  tenViTri: "Tên vị trí",
  giaBan: "Giá bán",
  giaVon: "Giá vốn",
  maSku: "SKU",
  sku: "SKU",
  maVach: "Mã vạch",
  ghiChu: "Ghi chú",
  lyDo: "Lý do",
  logo: "Logo",
  ten: "Tên",
  ma: "Mã",
  nhaCungCap: "Nhà cung cấp",
  quanLy: "Quản lý",
  loaiKhu: "Loại khu",
  khuVuc: "Khu vực",
  sucChua: "Sức chứa",
  soViTri: "Số vị trí",
  soCot: "Số cột",
  soHang: "Số hàng",
  soKhuVuc: "Số khu vực",
  soVat: "Số vật cản",
  soMucDoi: "Số mục đổi",
  moTa: "Mô tả",
  maHangNcc: "Mã hàng NCC",
  bienThe: "Biến thể",
  phieuNhap: "Phiếu nhập",
  danhMucCha: "Danh mục cha",
  maMauHex: "Mã màu",
  loaiSize: "Loại kích cỡ",
  thuTu: "Thứ tự",
  // Sản phẩm, biến thể
  maSanPham: "Mã sản phẩm",
  tenSanPham: "Tên sản phẩm",
  danhMuc: "Danh mục",
  danhMucId: "Danh mục (mã số)",
  thuongHieu: "Thương hiệu",
  thuongHieuId: "Thương hiệu (mã số)",
  mucTonToiThieu: "Mức tồn tối thiểu",
  giaBanMacDinh: "Giá bán mặc định",
  giaVonMacDinh: "Giá vốn mặc định",
  maVachSku: "Mã vạch SKU",
  mauSac: "Màu sắc",
  size: "Kích cỡ",
  chatLieu: "Chất liệu",
  anh: "Ảnh",
  anhSanPham: "Ảnh sản phẩm",
  anhBienThe: "Ảnh biến thể",
  bienTheDoiThuocTinh: "Biến thể đổi màu / kích cỡ",
  bienTheThemMoi: "Biến thể thêm mới",
  bienTheDoiTrangThai: "Biến thể đổi trạng thái",
  bienTheDoiAnh: "Biến thể đổi ảnh",
  soBienThe: "Số biến thể",
  tenMau: "Màu",
  tenSize: "Kích cỡ",
  tenChatLieu: "Chất liệu",
  bienTheSanPhams: "Biến thể",
};

const TRANG_THAI_HOAT_DONG = { 0: "Ngừng hoạt động", 1: "Hoạt động" };
// Sản phẩm: 1 / 0 máy chủ tự tính theo tồn mọi kho, 2 = ngừng (khớp tab trang Sản phẩm)
const TRANG_THAI_SAN_PHAM = { 1: "Còn hàng", 0: "Hết hàng", 2: "Ngừng hoạt động" };
// Biến thể (SKU): 1 đang bán, 0 ngừng
const TRANG_THAI_BIEN_THE = { 1: "Đang bán", 0: "Ngừng bán" };
const LOAI_CO_TRANG_THAI_HOAT_DONG = [
  "nha_cung_cap", "khach_hang", "kho", "nguoi_dung", "danh_muc_quan_ao", "mau_sac", "size", "chat_lieu", "thuong_hieu",
];
// Kệ: trạng thái là mã chữ (HOAT_DONG / BAO_TRI), nhãn lấy từ danh sách chọn của màn Vị trí kệ
const TRANG_THAI_KE = Object.fromEntries(TRANG_THAI_KE_CHON.map((t) => [t.ma, t.ten]));
const NHAN_LOAI_KHO = Object.fromEntries(LOAI_KHO_OPTIONS.map((o) => [o.value, o.label]));

// Tra nhãn chỉ theo khóa của chính bảng: khóa lạ trùng tên thuộc tính có sẵn (constructor, __proto__) không trả
// hàm / đối tượng làm hỏng màn
const tra = (bang, khoa) => (khoa != null && Object.hasOwn(bang, khoa) ? bang[khoa] : undefined);

// Chuỗi ngày giờ ISO trong ảnh chụp (Instant / LocalDate của máy chủ) → dạng dễ đọc theo giờ máy người dùng
const LA_NGAY_GIO_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const LA_NGAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Nhãn trạng thái theo loại đối tượng (mã số → chữ); không đoán được thì trả null. */
function nhanTrangThai(loai, giaTri) {
  if (giaTri == null || giaTri === "" || typeof giaTri === "object") return null;
  if (loai === "vi_tri_kho") return tra(TRANG_THAI_KE, String(giaTri)) ?? null;
  const ma = Number(giaTri);
  if (!Number.isFinite(ma)) return null;
  if (loai === "san_pham_quan_ao") return tra(TRANG_THAI_SAN_PHAM, ma) ?? null;
  if (loai === "bien_the_san_pham") return tra(TRANG_THAI_BIEN_THE, ma) ?? null;
  if (LOAI_CO_TRANG_THAI_HOAT_DONG.includes(loai)) return tra(TRANG_THAI_HOAT_DONG, ma) ?? null;
  return null;
}

export const nhanHanhDong = (ma) => tra(NHAN_HANH_DONG, ma) ?? (ma ? String(ma) : "Thay đổi");
export const nhanNguon = (ma) => tra(NHAN_NGUON, ma) ?? (ma ? String(ma) : "");
export const nhanTruong = (khoa) => tra(NHAN_TRUONG, khoa) ?? String(khoa);

/**
 * Đọc chuỗi JSON an toàn: không phải JSON (dòng cũ ghi chữ thường) thì trả về chính chuỗi đó.
 * null / chuỗi rỗng → null.
 */
export function docJson(chuoi) {
  if (chuoi == null) return null;
  if (typeof chuoi !== "string") return chuoi;
  const t = chuoi.trim();
  if (!t) return null;
  // Chỉ đọc JSON đối tượng / mảng / chuỗi: dòng cũ ghi số tài khoản, MST… dạng chữ số trần không bị đổi thành số
  if (!/^[[{"]/.test(t)) return t;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

const laDoiTuongThuong = (v) => v != null && typeof v === "object" && !Array.isArray(v);

/** Một giá trị ra chữ đọc được: số kiểu Việt Nam, đúng/sai thành Có/Không, mảng / đối tượng trải phẳng. */
export function hienGiaTri(v, { loai, truong } = {}) {
  if (v == null || v === "") return "—";
  if (truong === "trangThai") {
    const nhan = nhanTrangThai(loai, v);
    if (nhan) return nhan;
  }
  if (typeof v === "string") {
    if (truong === "loaiKho") return tra(NHAN_LOAI_KHO, v) ?? v;
    if (truong === "loaiKhachHang") return nhanLoaiKhach(v) ?? v;
    // Logo: tên đối tượng lưu trữ ("thuong-hieu/…-uuid.png") khó đọc — chỉ giữ tên tệp
    if (truong === "logo") return v.split("/").pop() || v;
    if (LA_NGAY_GIO_ISO.test(v)) return formatDateTime(v) ?? v;
    const ngay = LA_NGAY_ISO.exec(v);
    if (ngay) return `${ngay[3]}/${ngay[2]}/${ngay[1]}`;
  }
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "number") return new Intl.NumberFormat("vi-VN").format(v);
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    // Các dòng biến thể đổi trạng thái của sản phẩm: trạng thái theo bảng mã của biến thể
    const loaiDong = truong === "bienTheDoiTrangThai" ? "bien_the_san_pham" : loai;
    // Mảng dòng (vd. bienTheThemMoi: [{maSku, tenMau, tenSize}]): mỗi dòng gọn "A – B – C", các dòng cách "; "
    if (v.some(laDoiTuongThuong)) {
      return v
        .map((x) =>
          laDoiTuongThuong(x)
            ? Object.entries(x).map(([k, y]) => hienGiaTri(y, { loai: loaiDong, truong: k })).join(" – ")
            : hienGiaTri(x, { loai: loaiDong }),
        )
        .join("; ");
    }
    return v.map((x) => hienGiaTri(x, { loai: loaiDong })).join(", ");
  }
  if (laDoiTuongThuong(v)) {
    const phan = Object.entries(v).map(([k, x]) => `${nhanTruong(k)}: ${hienGiaTri(x, { loai, truong: k })}`);
    return phan.length ? phan.join(", ") : "—";
  }
  return String(v);
}

/**
 * Các dòng "Trường: cũ → mới" của một bản ghi nhật ký.
 * - Cả hai là đối tượng: mỗi khóa một dòng (khóa có ở một bên thì bên kia "—").
 * - Chỉ có giá trị mới / chỉ có giá trị cũ là đối tượng: mỗi khóa một dòng, chỉ một phía.
 * - Giá trị là chữ (dòng cũ): một dòng không tên trường.
 * Trả về [{ khoa, nhan, cu, moi, coCu, coMoi }].
 */
export function dongThayDoi(dong) {
  const loai = dong?.loaiThamChieu;
  const cu = docJson(dong?.giaTriCu);
  const moi = docJson(dong?.giaTriMoi);
  const ds = [];
  if (laDoiTuongThuong(cu) || laDoiTuongThuong(moi)) {
    const a = laDoiTuongThuong(cu) ? cu : {};
    const b = laDoiTuongThuong(moi) ? moi : {};
    const khoa = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    for (const k of khoa) {
      ds.push({
        khoa: k,
        nhan: nhanTruong(k),
        cu: hienGiaTri(Object.hasOwn(a, k) ? a[k] : undefined, { loai, truong: k }),
        moi: hienGiaTri(Object.hasOwn(b, k) ? b[k] : undefined, { loai, truong: k }),
        coCu: laDoiTuongThuong(cu),
        coMoi: laDoiTuongThuong(moi),
      });
    }
    // Một phía là chữ, phía kia là đối tượng: chữ thành một dòng riêng
    if (cu != null && !laDoiTuongThuong(cu)) ds.push({ khoa: "_cu", nhan: "Trước", cu: hienGiaTri(cu), moi: "", coCu: true, coMoi: false });
    if (moi != null && !laDoiTuongThuong(moi)) ds.push({ khoa: "_moi", nhan: "Sau", cu: "", moi: hienGiaTri(moi), coCu: false, coMoi: true });
    return ds;
  }
  if (cu == null && moi == null) return ds;
  ds.push({
    khoa: "_",
    nhan: "",
    cu: cu == null ? "" : hienGiaTri(cu, { loai }),
    moi: moi == null ? "" : hienGiaTri(moi, { loai }),
    coCu: cu != null,
    coMoi: moi != null,
  });
  return ds;
}

/** Ghi chú bắt đầu "[Nhạy cảm]": đổi MST nhà cung cấp, đổi email tài khoản. */
export const laGhiChuNhayCam = (ghiChu) => /^\s*\[Nhạy cảm\]/i.test(ghiChu ?? "");

/** Ai làm: tên người, hoặc nguồn ("Hệ thống", "Shopify", "Nhà cung cấp") khi không có người. */
export function aiThucHien(dong) {
  if (dong?.nguoiThucHienTen || dong?.nguoiThucHienTenDangNhap) {
    return dong.nguoiThucHienTen || dong.nguoiThucHienTenDangNhap;
  }
  if (dong?.nguon && dong.nguon !== "nguoi_dung") return nhanNguon(dong.nguon);
  return "Không rõ";
}
