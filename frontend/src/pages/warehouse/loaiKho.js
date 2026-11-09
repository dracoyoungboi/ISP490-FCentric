/*
 * Loại kho (cột kho.loai_kho).
 * - kho_tong: Kho tổng, nhận hàng từ nhà cung cấp và phân phối cho các kho bán hàng. Chỉ có một Kho tổng đang hoạt động.
 * - cua_hang: Kho bán hàng, bán tại quầy và giao đơn, nhận hàng từ Kho tổng.
 * KHO_TRANSIT là kho ảo chứa hàng đang chuyển giữa các kho, không đổi loại được.
 */
import { laKhoAo } from "@/utils/kho";
import { t } from "@/i18n";

export { MA_KHO_AO, laKhoAo } from "@/utils/kho";

export const LOAI_KHO_OPTIONS = [
    {
        value: "kho_tong",
        label: t("Kho tổng"),
        moTa: t("Nhận hàng từ nhà cung cấp, phân phối cho các kho bán hàng. Chỉ có một Kho tổng."),
    },
    {
        value: "cua_hang",
        label: t("Kho bán hàng"),
        moTa: t("Bán tại quầy và giao đơn cho khách, nhận hàng từ Kho tổng."),
    },
];

/** Nhãn hiển thị cho một kho: { label, moTa }. Loại kho là phân loại nên hiện chữ thường, không dùng thẻ trạng thái. */
export function nhanLoaiKho(kho) {
    if (laKhoAo(kho)) return { label: t("Kho ảo"), moTa: t("Chứa hàng đang chuyển giữa các kho, không dùng để bán hay nhập hàng.") };
    const o = LOAI_KHO_OPTIONS.find((x) => x.value === kho?.loaiKho) ?? LOAI_KHO_OPTIONS[1];
    return { label: o.label, moTa: o.moTa };
}
