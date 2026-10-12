/*
 * Quy tắc chọn kho dùng chung cho các màn chứng từ.
 * - KHO_TRANSIT là kho ảo chứa hàng đang chuyển giữa các kho: không chọn làm kho của chứng từ nào.
 * - Kho ngừng hoạt động không dùng cho chứng từ mới.
 * - Kho tổng (loaiKho = "kho_tong") nhận hàng từ nhà cung cấp và phân phối, không bán tại quầy.
 * Backend kiểm tra lại cùng quy tắc trong KhoService.
 */
export const MA_KHO_AO = "KHO_TRANSIT";

export const laKhoAo = (kho) => kho?.maKho === MA_KHO_AO;
export const laKhoTong = (kho) => kho?.loaiKho === "kho_tong";
export const laKhoHoatDong = (kho) => Number(kho?.trangThai) === 1;

/** Kho dùng được cho chứng từ: đang hoạt động và không phải kho ảo. */
export const laKhoGiaoDich = (kho) => laKhoHoatDong(kho) && !laKhoAo(kho);
/** Kho bán tại quầy: kho giao dịch và không phải Kho tổng. */
export const laKhoBanTaiQuay = (kho) => laKhoGiaoDich(kho) && !laKhoTong(kho);
/** Kho nhận hàng từ nhà cung cấp: chỉ Kho tổng đang hoạt động. */
export const laKhoNhapNcc = (kho) => laKhoGiaoDich(kho) && laKhoTong(kho);
