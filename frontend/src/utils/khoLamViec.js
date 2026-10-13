import { jwtDecode } from "jwt-decode";
import { getMineKhoList } from "@/services/khoService";
import { laKhoGiaoDich } from "@/utils/kho";
import { hasAnyRole, ROLES } from "@/utils/roles";

/*
 * Kho làm việc (ngữ cảnh kho) dùng chung cho các màn nghiệp vụ kho.
 * - Lưu ở localStorage "selected_kho_id"; apiClient gửi kèm header kho_id cho mọi request.
 * - Backend (AuthorizationAspect) chỉ chấp nhận header là kho có trong token của người dùng;
 *   quản trị viên được bỏ qua bước này nhưng các màn nhặt hàng vẫn cần biết đang làm ở kho nào.
 * - Màn báo cáo chỉ đổi bộ lọc của riêng nó, không được xóa hoặc ghi kho không hợp lệ vào đây.
 */
export const KHO_LAM_VIEC_KEY = "selected_kho_id";

export function getKhoLamViecId() {
  try {
    const id = Number(window.localStorage.getItem(KHO_LAM_VIEC_KEY));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setKhoLamViecId(id) {
  try {
    window.localStorage.setItem(KHO_LAM_VIEC_KEY, String(id));
  } catch {
    // localStorage bị chặn: màn vẫn chạy với kho truyền trực tiếp qua tham số
  }
}

const laQuanTriVien = () => hasAnyRole([ROLES.QUAN_TRI_VIEN]);

/** Kho được phân công trong token — đúng danh sách backend dùng để kiểm tra header kho_id. */
function khoTrongToken() {
  try {
    const token = window.localStorage.getItem("access_token");
    if (!token) return [];
    const raw = jwtDecode(token)?.warehousePermissions;
    const list = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (Array.isArray(list) ? list : [])
      .filter((pq) => pq?.kho && (pq.trangThai == null || Number(pq.trangThai) === 1))
      .map((pq) => pq.kho);
  } catch {
    return [];
  }
}

/** Kho dùng được làm kho làm việc (đồng bộ, không gọi API) — dùng cho màn chỉ đọc danh sách kho có sẵn. */
export function laKhoLamViecHopLe(kho) {
  if (!laKhoGiaoDich(kho)) return false;
  return laQuanTriVien() || khoTrongToken().some((k) => k.id === kho.id);
}

/**
 * Danh sách kho người dùng làm việc được: quản trị viên = mọi kho giao dịch;
 * người dùng khác = kho được phân công (trong token), bỏ Kho Trung Chuyển và kho ngừng hoạt động.
 */
export async function layDanhSachKhoLamViec() {
  const ds = laQuanTriVien() ? await getMineKhoList() : khoTrongToken();
  const daCo = new Set();
  return ds.filter((kho) => {
    if (!laKhoGiaoDich(kho) || daCo.has(kho.id)) return false;
    daCo.add(kho.id);
    return true;
  });
}

/** Giữ kho làm việc hiện tại nếu còn hợp lệ, không thì chuyển sang kho đầu tiên của danh sách và ghi lại. */
export function chonKhoLamViecHopLe(dsKho) {
  const hienTai = getKhoLamViecId();
  if (hienTai && dsKho.some((kho) => kho.id === hienTai)) return hienTai;
  const dauTien = dsKho[0]?.id ?? null;
  if (dauTien) setKhoLamViecId(dauTien);
  return dauTien;
}
