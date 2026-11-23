/**
 * Phiên đăng nhập cổng nhà cung cấp và các đường dẫn của cổng. Hàm thuần, chạy được bằng `node --test`.
 *
 * Phiên gắn với EMAIL nhà cung cấp (không theo từng đơn): máy chủ cấp ở POST /cong-ncc/dang-nhap/xac-nhan
 * `{ phien, hetHanPhien, nhaCungCap: { ten, email }, cuaHang: { ten, logoUrl } }`; mọi API sau đăng nhập gửi kèm header
 * `X-Phien-Cong-Ncc`. Phiên lưu trong sessionStorage của thẻ trình duyệt (một khóa) để tải lại trang vẫn còn; đóng thẻ
 * là mất. Trình duyệt chặn sessionStorage thì giữ trong bộ nhớ (tải lại trang phải nhận mã mới).
 */

export const KHOA_PHIEN_CONG = "fcentric.congNcc.phien";
export const HEADER_PHIEN_CONG = "X-Phien-Cong-Ncc";
/** Phiên cổng sống 60 phút kể từ lúc nhận (hợp đồng mục 1). */
export const THOI_HAN_PHIEN_MS = 60 * 60 * 1000;

/** Đường dẫn các trang của cổng (route công khai, không qua đăng nhập nhân viên). */
export const DUONG_DAN_CONG = Object.freeze({
  dangNhap: "/supplier/login",
  canXuLy: "/supplier/portal",
  lichSu: "/supplier/portal/history",
});
export const duongDanBienBan = (id) => `/supplier/portal/returns/${encodeURIComponent(String(id))}`;
export const duongDanBaoGia = (id) => `/supplier/portal/quotation/${encodeURIComponent(String(id))}`;

let phienTrongBoNho = null;

function khoMacDinh() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Lấy phần cần giữ từ `data` của xác nhận mã; thiếu mã phiên thì null.
 * `hanCucBo` (ms theo đồng hồ máy này) = lúc nhận + 60 phút. Không so `hetHanPhien` của máy chủ với đồng hồ máy (máy
 * lệch giờ sẽ tưởng phiên đã hết); máy chủ vẫn là nơi quyết định (403 PHIEN_HET_HAN).
 */
export function chuanHoaPhien(data) {
  const phien = typeof data?.phien === "string" ? data.phien.trim() : "";
  if (!phien) return null;
  const nhaCungCap = data.nhaCungCap ?? {};
  const cuaHang = data.cuaHang ?? null;
  return {
    phien,
    hetHanPhien: data.hetHanPhien ?? null,
    hanCucBo: Number.isFinite(data.hanCucBo) ? data.hanCucBo : null,
    nhaCungCap: { ten: String(nhaCungCap.ten ?? "").trim(), email: String(nhaCungCap.email ?? "").trim() },
    cuaHang: cuaHang ? { ten: String(cuaHang.ten ?? "").trim(), logoUrl: cuaHang.logoUrl ?? null } : null,
  };
}

/** Lưu phiên vừa nhận. Trả phiên đã lưu, hoặc null nếu `data` không có mã phiên. */
export function luuPhien(data, kho = khoMacDinh(), bayGio = Date.now()) {
  const phien = data ? chuanHoaPhien({ ...data, hanCucBo: bayGio + THOI_HAN_PHIEN_MS }) : null;
  phienTrongBoNho = phien;
  if (!phien) return null;
  try {
    kho?.setItem(KHOA_PHIEN_CONG, JSON.stringify(phien));
  } catch {
    // Trình duyệt chặn lưu: vẫn dùng được trong lần tải trang này (phienTrongBoNho)
  }
  return phien;
}

/** Phiên đang có (chưa xét hạn), hoặc null. */
export function docPhien(kho = khoMacDinh()) {
  try {
    const chuoi = kho?.getItem(KHOA_PHIEN_CONG);
    if (chuoi) {
      const phien = chuanHoaPhien(JSON.parse(chuoi));
      if (phien) return phien;
    }
  } catch {
    // Không đọc được: dùng bản trong bộ nhớ
  }
  return phienTrongBoNho;
}

export function xoaPhien(kho = khoMacDinh()) {
  phienTrongBoNho = null;
  try {
    kho?.removeItem(KHOA_PHIEN_CONG);
  } catch {
    // không xóa được thì thôi
  }
}

/** Phiên đã quá hạn tính trên máy này (`hanCucBo`); không có hạn thì coi như còn (để máy chủ quyết). */
export function phienDaHetHan(phien, bayGio = Date.now()) {
  if (!phien) return true;
  return Number.isFinite(phien.hanCucBo) && phien.hanCucBo <= bayGio;
}

const LA_ID = /^\d{1,12}$/;
// Đường dẫn chuẩn của cổng: /supplier/portal rồi các đoạn chỉ gồm chữ, số, "-", "_" (không ".", "..", "%", "//")
const DUONG_DAN_CHUAN = /^\/supplier\/portal(?:\/[A-Za-z0-9_-]+)*$/;

/**
 * Chỉ nhận đích nội bộ của cổng (chặn chuyển ra ngoài / đi ngược thư mục qua tham số `tiep`): phần đường dẫn, cả trước
 * và sau khi giải mã, phải là đường dẫn chuẩn trong /supplier/portal; phần tìm kiếm không có "\" hay "#".
 */
export function laDichTrongCong(dich) {
  if (typeof dich !== "string" || dich.length > 500) return false;
  const viTri = dich.indexOf("?");
  const duongDan = viTri < 0 ? dich : dich.slice(0, viTri);
  const timKiem = viTri < 0 ? "" : dich.slice(viTri + 1);
  let giaiMa;
  try {
    giaiMa = decodeURIComponent(duongDan);
  } catch {
    return false;
  }
  if (!DUONG_DAN_CHUAN.test(duongDan) || !DUONG_DAN_CHUAN.test(giaiMa)) return false;
  return !/[\\#]/.test(timKiem);
}

/**
 * Trang mở ngay sau khi đăng nhập, theo tham số trên địa chỉ trang đăng nhập:
 * `?bienBan=ID` (email biên bản trả hàng) → biên bản; `?id=ID` (email yêu cầu báo giá) → trang báo giá đơn đó;
 * `?tiep=/supplier/portal/...` (phiên hết hạn giữa chừng) → trang đang xem; còn lại → Cần xử lý.
 * @param {URLSearchParams | string} thamSo
 */
export function dichSauDangNhap(thamSo) {
  const ts = typeof thamSo === "string" ? new URLSearchParams(thamSo) : thamSo;
  const bienBan = String(ts?.get("bienBan") ?? "").trim();
  if (LA_ID.test(bienBan)) return duongDanBienBan(bienBan);
  const id = String(ts?.get("id") ?? "").trim();
  if (LA_ID.test(id)) return duongDanBaoGia(id);
  const tiep = ts?.get("tiep");
  if (laDichTrongCong(tiep)) return tiep;
  return DUONG_DAN_CONG.canXuLy;
}

/** Liên kết trong email đang dẫn tới đâu: "bien-ban" | "bao-gia" | null (để trang đăng nhập nói trước). */
export function loaiLienKet(thamSo) {
  const ts = typeof thamSo === "string" ? new URLSearchParams(thamSo) : thamSo;
  if (LA_ID.test(String(ts?.get("bienBan") ?? "").trim())) return "bien-ban";
  if (LA_ID.test(String(ts?.get("id") ?? "").trim())) return "bao-gia";
  return null;
}

/** Trang đăng nhập kèm đích quay lại (`tiep`) và email điền sẵn. */
export function diaChiDangNhap({ tiep, email } = {}) {
  const ts = new URLSearchParams();
  if (laDichTrongCong(tiep) && tiep !== DUONG_DAN_CONG.canXuLy) ts.set("tiep", tiep);
  const e = String(email ?? "").trim();
  if (e) ts.set("email", e);
  const chuoi = ts.toString();
  return chuoi ? `${DUONG_DAN_CONG.dangNhap}?${chuoi}` : DUONG_DAN_CONG.dangNhap;
}

/** Email trên địa chỉ trùng email của phiên (không phân biệt hoa thường); địa chỉ không có email thì coi như trùng. */
export function cungEmail(phien, email) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return true;
  return String(phien?.nhaCungCap?.email ?? "").trim().toLowerCase() === e;
}
