import { ROLES } from "../utils/roles.js";

/**
 * Vai trò gửi được yêu cầu báo giá cho nhà cung cấp, và gửi lại email yêu cầu báo giá (K11).
 * Khớp IRoleType.GUI_YEU_CAU_BAO_GIA ở backend (@RequireAuth của POST /don-mua-hang/gui-yeu-cau-bao-gia và
 * POST /don-mua-hang/{id}/gui-lai-yeu-cau); test cùng thư mục so với tệp Java.
 * Chỉ dùng để ẩn / hiện nút; máy chủ vẫn là chốt chặn thật.
 */
export const VAI_TRO_GUI_YEU_CAU_BAO_GIA = Object.freeze([
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_KHO,
  ROLES.NHAN_VIEN_MUA_HANG,
  ROLES.NHAN_VIEN_KHO,
]);
