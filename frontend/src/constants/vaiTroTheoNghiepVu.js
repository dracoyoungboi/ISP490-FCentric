import { ROLES } from "../utils/roles.js";

/**
 * Vai trò theo ma trận phân quyền SRS mục 4.4 (F-ORWMS SRS v1.0). Menu (sidebar.config.js), chặn đường dẫn
 * (App.jsx RequireRole) và nút trên từng trang cùng đọc tệp này để không lệch nhau. Mỗi danh sách khớp @RequireAuth của
 * API chính ở backend — frontend chỉ ẩn / hiện, máy chủ mới là chốt chặn thật.
 *
 * Quản trị viên tạm thời toàn quyền (có trong mọi danh sách) để thử nghiệm dễ. Dòng ma trận ghi "Restricted" của vai trò
 * khác nghĩa là trong kho được phân (mỗi người một kho); "View only" là chỉ xem.
 * Không import alias "@/..." để chạy được bằng `node --test`.
 */
const QTV = ROLES.QUAN_TRI_VIEN;
const QLK = ROLES.QUAN_LY_KHO;
const NVK = ROLES.NHAN_VIEN_KHO;
const NVMH = ROLES.NHAN_VIEN_MUA_HANG;
const NVBH = ROLES.NHAN_VIEN_BAN_HANG;

export const TAT_CA_VAI_TRO = Object.freeze([QTV, QLK, NVK, NVMH, NVBH]);

// ─── Người dùng & phân quyền ("User Account", "Role & Permission") ───
export const VAI_TRO_NGUOI_DUNG = Object.freeze([QTV]);

// ─── Sản phẩm ───
/** "Category", "Color / Size / Material": xem trang quản lý và thêm, sửa, xóa. Thương hiệu cùng quy tắc. */
export const VAI_TRO_DANH_MUC = Object.freeze([QTV]);
/** "Product – Create / Edit / Activate / Deactivate", "SKU / Variant – Configure variants / prices". Xem: mọi vai trò. */
export const VAI_TRO_SUA_SAN_PHAM = Object.freeze([QTV]);
/** "Barcode – Generate / Print" (kèm quản lý kho theo UC 2.7): màn Tem mã vạch (giá bán chỉ xem, đổi ở form Sửa sản phẩm). */
export const VAI_TRO_IN_TEM = Object.freeze([QTV, QLK, NVK, NVBH]);
/** Giá vốn là số nội bộ (SRS 2.4.1): nhân viên bán hàng không thấy. Khớp XemGiaVon ở backend. */
export const VAI_TRO_XEM_GIA_VON = Object.freeze([QTV, QLK, NVK, NVMH]);
/** Lịch sử sản phẩm, lịch sử giá (GET /san-pham-quan-ao/{id}/lich-su, /sku/{id}/lich-su-gia). */
export const VAI_TRO_XEM_LICH_SU_SAN_PHAM = Object.freeze([QTV, QLK]);

// ─── Kho hàng ───
/** Chứng từ kho: phiếu nhập, xuất, chuyển kho, kiểm kê, vị trí kệ, lịch sử giao dịch kho. */
export const VAI_TRO_KHO = Object.freeze([QTV, QLK, NVK]);
/** "Internal Bin Relocation": thêm nhân viên bán hàng kiêm kho cửa hàng. */
export const VAI_TRO_CHUYEN_KE = Object.freeze([...VAI_TRO_KHO, NVBH]);
/** Danh sách kho (GET /kho/{id}/tom-tat). Thêm, sửa, xóa kho: chỉ quản trị viên. */
export const VAI_TRO_DANH_SACH_KHO = Object.freeze([QTV, QLK]);
/** "Goods Receipt – View": nhân viên mua hàng chỉ xem để theo dõi hàng về của đơn mua. */
export const VAI_TRO_XEM_PHIEU_NHAP = Object.freeze([...VAI_TRO_KHO, NVMH]);
/** "Low Stock – View low-stock alerts": thẻ Hết hàng / Sắp hết hàng ở Báo cáo tồn kho. */
export const VAI_TRO_CANH_BAO_TON = Object.freeze([QTV, QLK, NVK]);

// ─── Mua hàng ───
/** "Supplier – View / Create / Edit / Delete". */
export const VAI_TRO_NHA_CUNG_CAP = Object.freeze([QTV, NVMH]);
/** "Purchase Request – View": nhân viên mua hàng chỉ xem. */
export const VAI_TRO_XEM_YEU_CAU_NHAP = Object.freeze([QTV, QLK, NVK, NVMH]);
/** "Purchase Request – Create / Edit / Submit" tại kho của mình (POST /nghiep-vu/yeu-cau-mua-hang/create). */
export const VAI_TRO_TAO_YEU_CAU_NHAP = Object.freeze([QTV, QLK, NVK]);
/** "RFQ – Create / Process": gửi, gửi lại yêu cầu báo giá. Khớp IRoleType.GUI_YEU_CAU_BAO_GIA ở backend. */
export const VAI_TRO_GUI_YEU_CAU_BAO_GIA = Object.freeze([QTV, NVMH]);
/** Xem yêu cầu báo giá: nhân viên mua hàng; quản lý kho xem để so báo giá trước khi chốt đơn mua (UC 4.7). */
export const VAI_TRO_XEM_YEU_CAU_BAO_GIA = Object.freeze([QTV, QLK, NVMH]);
/** Đơn mua hàng (GET /don-mua-hang/get-by-id, /filter): nhân viên kho xem để nhập hàng. */
export const VAI_TRO_DON_MUA = Object.freeze([QTV, QLK, NVMH, NVK]);
/** "Purchase Order – Approve" = chốt báo giá thành đơn mua (PUT /nghiep-vu/don-mua-hang/duyet-don). */
export const VAI_TRO_TAO_DON_MUA = Object.freeze([QTV, QLK, NVMH]);
/** Trả hàng nhà cung cấp (GET /bien-ban-tra-hang-ncc): kho lo hàng lỗi, mua hàng theo dõi câu trả lời của nhà cung cấp. */
export const VAI_TRO_TRA_HANG_NCC = Object.freeze([QTV, QLK, NVK, NVMH]);

// ─── Bán hàng ───
/** "Customer – View / Add / Edit". */
export const VAI_TRO_KHACH_HANG = Object.freeze([QTV, NVBH]);
/**
 * Xem đơn bán: nhân viên bán hàng; nhân viên kho chỉ xem ("Sales Order" Restricted). Quản lý kho xem chỉ
 * đọc như nhân viên kho (nhập hàng khách trả mở từ chi tiết đơn).
 */
export const VAI_TRO_DON_BAN = Object.freeze([QTV, NVBH, NVK, QLK]);
/** In hóa đơn bán hàng. */
export const VAI_TRO_GHI_DON_BAN = Object.freeze([QTV, NVBH]);
/** "POS Payment", "POS Return & Exchange": bán và trả hàng tại quầy. */
export const VAI_TRO_BAN_TAI_QUAY = Object.freeze([QTV, NVBH]);
/** Xem phiếu xuất chỉ đọc (GET /phieu-xuat-kho/{id}/view): vai trò kho và nhân viên bán hàng (mở từ đơn bán). */
export const VAI_TRO_XEM_PHIEU_XUAT = Object.freeze([...VAI_TRO_KHO, NVBH]);

// ─── Báo cáo ───
/** UC 11.3 Báo cáo doanh thu (cửa hàng mình với nhân viên bán hàng). */
export const VAI_TRO_BAO_CAO_DOANH_THU = Object.freeze([QTV, NVBH]);
/** UC 11.4 Báo cáo sản phẩm bán chạy. */
export const VAI_TRO_BAO_CAO_SAN_PHAM = Object.freeze([QTV, NVBH]);
/** UC 11.5 Báo cáo nhập xuất (kho mình). */
export const VAI_TRO_BAO_CAO_NHAP_XUAT = Object.freeze([QTV, QLK, NVK]);
/** "MISA Accounting Export": tạm chỉ quản trị viên (quản lý kho cần lọc lô xuất theo kho, làm đợt sau). */
export const VAI_TRO_XUAT_KE_TOAN = Object.freeze([QTV]);

// ─── Kênh bán hàng ("Omnichannel Integration", "Integration Connection Status") ───
export const VAI_TRO_KENH_BAN = Object.freeze([QTV]);
