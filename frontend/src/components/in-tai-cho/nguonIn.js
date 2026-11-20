/*
 * Nguồn bản in của từng loại chứng từ: loại mẫu in, cách lấy dữ liệu và đổi sang số liệu in. Dùng chung cho trang in
 * (/…/print, PrintRoutePage) và in tại chỗ (useInTaiCho) để hai đường in ra đúng một bản.
 *
 * - `documentType`: loại mẫu in (Cấu hình › Mẫu in).
 * - `fetcher(id)`: dữ liệu phiếu từ máy chủ; null = không tìm thấy.
 * - `adapter(data)`: số liệu in đưa vào PrintTemplateDocument.
 * - `getDataError(data)`: dữ liệu tải về thiếu (vd. lỗi tải lô) thì trả { title, description }, không in.
 * - `copies`: nhãn từng liên khi in nhiều liên (mỗi liên một trang).
 */
import { toGoodsIssuePrintModel } from "@/components/print/adapters/goodsIssuePrintAdapter";
import { toSalesInvoicePrintModel } from "@/components/print/adapters/donBanHangPrintAdapter";
import { toPosReturnPrintModel } from "@/components/print/adapters/posReturnPrintAdapter";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { donBanHangService } from "@/services/donBanHangService";
import { traHangService } from "@/services/traHangService";
import { t } from "@/i18n";

/**
 * Phiếu xuất kho: `GET /api/v1/phieu-xuat-kho/{id}` + lô đã nhặt, tên lô của từng dòng. PHÂN BIỆT lỗi tải lô
 * (pickedLotFailures / availableLotFailures — chặn in) với "tải được nhưng không có lô" (in bình thường, lô là "—").
 */
export const NGUON_IN_PHIEU_XUAT = Object.freeze({
  documentType: "goods_issue",
  adapter: toGoodsIssuePrintModel,
  fetcher: async (id) => {
    const detail = await phieuXuatKhoService.getDetail(id);
    if (!detail) return null;
    const { phieu, chiTiet = [] } = detail;

    // Lô đã nhặt của từng dòng + bảng tên lô (loHangId -> maLo)
    const pickedLotsByDetailId = {};
    const lotNameByLotId = {};
    const pickedLotFailures = [];
    const availableLotFailures = [];

    await Promise.all(
      chiTiet.map(async (item) => {
        try {
          const picks = await phieuXuatKhoService.getPickedLots(id, item.id);
          pickedLotsByDetailId[item.id] = Array.isArray(picks) ? picks : [];
        } catch {
          // LỖI request — khác với "không có lô đã nhặt"
          pickedLotsByDetailId[item.id] = [];
          pickedLotFailures.push(item.id);
        }
        if (!item.bienTheSanPhamId) return;
        try {
          const lots = await phieuXuatKhoService.getAvailableLots(id, item.bienTheSanPhamId);
          (lots || []).forEach((lot) => {
            if (lot.loHangId && lot.maLo) lotNameByLotId[lot.loHangId] = lot.maLo;
          });
        } catch {
          // LỖI request — tên lô có thể hiển thị sai (#id)
          availableLotFailures.push(item.bienTheSanPhamId);
        }
      }),
    );

    const hasPicks = Object.values(pickedLotsByDetailId).some((picks) => picks.length > 0);
    return { phieu, chiTiet, pickedLotsByDetailId, lotNameByLotId, pickedLotFailures, availableLotFailures, hasPicks };
  },
  getDataError: (payload) => {
    if (!payload) return null;
    if (payload.pickedLotFailures?.length) {
      return {
        title: t("Không thể tải dữ liệu lô đã xuất"),
        description: t("Không thể tải lô đã chọn của một số dòng hàng. Bản in có thể thiếu dữ liệu — vui lòng thử lại."),
      };
    }
    if (payload.availableLotFailures?.length && payload.hasPicks) {
      return {
        title: t("Không thể tải tên lô"),
        description: t("Không thể tải tên lô từ kho. Bản in có thể hiển thị sai tên lô — vui lòng thử lại."),
      };
    }
    return null;
  },
});

const layDonBan = async (id) => {
  const result = await donBanHangService.getDetail(id);
  return result?.data ?? null;
};

/** Hóa đơn bán hàng in từ trang đơn bán: mẫu `sales_invoice` (A4 / A5). */
export const NGUON_IN_HOA_DON = Object.freeze({
  documentType: "sales_invoice",
  fetcher: layDonBan,
  adapter: toSalesInvoicePrintModel,
});

/** Hóa đơn bán tại quầy (in ở màn bán, in lại đơn bán tại quầy): mẫu `pos_invoice` (K80 / K57). */
export const NGUON_IN_HOA_DON_TAI_QUAY = Object.freeze({
  documentType: "pos_invoice",
  fetcher: layDonBan,
  adapter: toSalesInvoicePrintModel,
});

/**
 * Biên bản trả hàng 02 liên (đặc tả BA bước 5.5): khổ giấy và các mục bật / tắt theo Cấu hình › Mẫu in › Biên bản
 * trả hàng (mặc định A5).
 */
export const NGUON_IN_BIEN_BAN_TRA = Object.freeze({
  documentType: "pos_return",
  fetcher: (id) => traHangService.phieu(id),
  adapter: toPosReturnPrintModel,
  // i18n-giu-nguyen: nhãn liên in trên giấy (mẫu in giữ tiếng Việt)
  copies: Object.freeze(["1 · Giao khách hàng giữ", "2 · Lưu quầy, kẹp hóa đơn gốc"]),
});
