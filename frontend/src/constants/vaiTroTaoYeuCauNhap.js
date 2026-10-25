import { ROLES } from "../utils/roles.js";

/**
 * Vai trò lập được yêu cầu nhập hàng (màn /purchase-requests/create). Khớp @RequireAuth của
 * POST /nghiep-vu/yeu-cau-mua-hang/create và GET /nghiep-vu/yeu-cau-mua-hang/hang-kho-tong ở backend
 * (NghiepVuSanPhamController). Quản lý kho không lập yêu cầu, chỉ duyệt; việc mua do nhân viên mua hàng.
 * Chỉ dùng để ẩn / hiện nút và chặn đường dẫn; máy chủ vẫn là chốt chặn thật (kèm quyền tao_don_mua_hang theo kho).
 */
export const VAI_TRO_TAO_YEU_CAU_NHAP = Object.freeze([
  ROLES.QUAN_TRI_VIEN,
  ROLES.NHAN_VIEN_BAN_HANG,
  ROLES.NHAN_VIEN_MUA_HANG,
  ROLES.NHAN_VIEN_KHO,
]);
