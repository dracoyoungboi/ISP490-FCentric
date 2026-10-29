import { laKhoTong } from "@/utils/kho";
import { dsKhoLamViecTrongToken, getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Quản lý kho được phân ở một Kho tổng (như PhieuChuyenKhoService.laQuanLyKhoTong): duyệt, xử lý chênh lệch mọi tuyến
 * mà không cần đứng ở kho của phiếu.
 */
export const laQuanLyKhoTong = () => hasAnyRole([ROLES.QUAN_LY_KHO]) && dsKhoLamViecTrongToken().some(laKhoTong);

/**
 * Thao tác ghi trên phiếu chuyển kiểm theo kho làm việc (header kho_id, KhoDangChon ở máy chủ): người được phân cả kho
 * xuất lẫn kho nhận mà đang đứng ở kho kia thì chuyển sang đúng kho của bước này trước khi gửi, khỏi bị từ chối sau khi
 * đã điền hộp. Quản trị viên, hoặc kho không nằm trong quyền: giữ nguyên (máy chủ báo lỗi như cũ).
 */
export function lamViecTaiKho(kho) {
    if (!kho?.id || hasAnyRole([ROLES.QUAN_TRI_VIEN]) || getKhoLamViecId() === kho.id) return;
    if (dsKhoLamViecTrongToken().some((k) => k.id === kho.id)) setKhoLamViecId(kho.id);
}

/**
 * Mở được chứng từ con của kho này không (phiếu nhặt, PX, PN kiểm theo phân quyền kho / kho làm việc ở máy chủ): quản trị
 * viên mọi kho, người khác phải được phân kho đó. Không được thì hiện chứng từ dạng chữ, khỏi bấm vào màn báo lỗi.
 */
export function moDuocTaiKho(kho) {
    if (!kho?.id) return false;
    return hasAnyRole([ROLES.QUAN_TRI_VIEN]) || dsKhoLamViecTrongToken().some((k) => k.id === kho.id);
}
