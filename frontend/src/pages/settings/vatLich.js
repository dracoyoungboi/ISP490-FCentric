// Thuế GTGT (Cấu hình › Thuế GTGT): công tắc In thuế (cấu hình VAT_BAT) và bảng thuế suất có ngày hiệu lực (API
// /ke-toan/thue-suat, lưu cả bảng một lần). Hóa đơn bán hàng in mức chung (dòng không danh mục) có hiệu lực ở ngày đó
// (máy chủ: ThueGtgtService); dòng theo danh mục chỉ dùng khi xuất kế toán. Hàm thuần, chạy được bằng node --test.
import { THUE_SUAT, chongNhau, hienNgay } from "../../components/ke-toan/tinhKeToan.js";
import { t } from "../../i18n/t.js";

export const VAT_BAT = "VAT_BAT";
export const TOI_DA_DONG = 50;

const laMucChung = (ts) => !ts?.danhMucId;
const hieuLucNgay = (ts, ngay) => ts.hieuLucTu <= ngay && (!ts.hieuLucDen || ts.hieuLucDen >= ngay);

/** Dòng mức chung có hiệu lực vào ngày (yyyy-MM-dd); null = chưa có (hóa đơn không in thuế). */
export function mucChungTai(ds, ngay) {
  return (ds ?? [])
    .filter((ts) => laMucChung(ts) && hieuLucNgay(ts, ngay))
    .sort((a, b) => b.hieuLucTu.localeCompare(a.hieuLucTu))[0] ?? null;
}

/** Trạng thái dòng so với ngày (yyyy-MM-dd): "qua" đã hết hiệu lực, "toi" chưa tới, "hien" đang áp dụng. */
export function trangThaiDong(ts, ngay) {
  if (ts.hieuLucDen && ts.hieuLucDen < ngay) return "qua";
  return ts.hieuLucTu > ngay ? "toi" : "hien";
}

/** "01/07/2025 – 31/12/2026" hoặc "Từ 01/01/2027" khi chưa hết hiệu lực. */
export const khoangNgay = (ts) =>
  ts.hieuLucDen ? `${hienNgay(ts.hieuLucTu)} – ${hienNgay(ts.hieuLucDen)}` : t("Từ {{ngay}}", { ngay: hienNgay(ts.hieuLucTu) });

/** Bảng xếp để hiện: mức chung theo ngày bắt đầu, rồi dòng theo danh mục (tên, ngày). */
export function sapXep(ds) {
  const theoNgay = (a, b) => a.hieuLucTu.localeCompare(b.hieuLucTu);
  const chung = (ds ?? []).filter(laMucChung).sort(theoNgay);
  const rieng = (ds ?? []).filter((ts) => !laMucChung(ts))
    .sort((a, b) => (a.tenDanhMuc ?? "").localeCompare(b.tenDanhMuc ?? "", "vi") || theoNgay(a, b));
  return { chung, rieng };
}

let dem = 0;
/** Dòng đang sửa (giá trị chuỗi như ô nhập); khoa giữ ổn định khi thêm / bỏ dòng. rieng = dòng theo danh mục. */
export function formDong(ts, rieng = Boolean(ts?.danhMucId)) {
  return {
    khoa: ts?.id != null ? `id-${ts.id}` : `moi-${++dem}`,
    id: ts?.id ?? null,
    rieng,
    danhMucId: ts?.danhMucId ? String(ts.danhMucId) : "",
    tenDanhMuc: ts?.tenDanhMuc ?? null,
    tyLe: ts?.tyLe != null ? String(Number(ts.tyLe)) : "",
    hieuLucTu: ts?.hieuLucTu ?? "",
    hieuLucDen: ts?.hieuLucDen ?? "",
    ghiChu: ts?.ghiChu ?? "",
  };
}

/** id ô "Từ ngày" của một dòng đang sửa (đưa con trỏ tới dòng mới thêm hoặc dòng lỗi đầu tiên). */
export const idTuNgay = (khoa) => `ts-tu-${khoa}`;

/** Bảng đang sửa từ bảng đã lưu: mức chung trước rồi dòng theo danh mục. */
export function formBang(ds) {
  const { chung, rieng } = sapXep(ds);
  return [...chung, ...rieng].map((ts) => formDong(ts));
}

/**
 * Lỗi của bảng đang sửa (cùng quy tắc máy chủ ThueSuatService.luuCaBang): { [khoa]: câu lỗi }, rỗng = hợp lệ.
 * Chồng ngày trong cùng phạm vi (mức chung, hoặc cùng danh mục) báo ở dòng sau.
 */
export function kiemTraBang(ds) {
  const loi = {};
  const ok = [];
  for (const d of ds) {
    const ts = String(d.tyLe).trim();
    if (d.rieng && !d.danhMucId) loi[d.khoa] = t("Chọn danh mục");
    else if (ts === "" || !THUE_SUAT.includes(Number(ts))) loi[d.khoa] = t("Chọn thuế suất");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(d.hieuLucTu)) loi[d.khoa] = t("Chọn ngày bắt đầu");
    else if (d.hieuLucDen && d.hieuLucDen < d.hieuLucTu) loi[d.khoa] = t("Ngày kết thúc phải từ ngày bắt đầu trở đi");
    else if (d.ghiChu.trim().length > 255) loi[d.khoa] = t("Ghi chú tối đa 255 ký tự");
    else {
      const pv = d.rieng ? d.danhMucId : "";
      const trung = ok.find((o) => o.pv === pv && chongNhau(o.d.hieuLucTu, o.d.hieuLucDen || null, d.hieuLucTu, d.hieuLucDen || null));
      if (trung) loi[d.khoa] = t("Trùng khoảng ngày với dòng {{tyLe}}% từ {{ngay}}: đặt ngày kết thúc cho dòng trước", { tyLe: Number(trung.d.tyLe), ngay: hienNgay(trung.d.hieuLucTu) });
      else ok.push({ pv, d });
    }
  }
  return loi;
}

/** Dữ liệu gửi máy chủ (toàn bộ bảng). */
export function payloadBang(ds) {
  return ds.map((d) => ({
    id: d.id,
    tyLe: String(d.tyLe).trim() === "" ? null : Number(d.tyLe),
    hieuLucTu: d.hieuLucTu,
    hieuLucDen: d.hieuLucDen || null,
    danhMucId: d.rieng && d.danhMucId ? Number(d.danhMucId) : null,
    ghiChu: d.ghiChu.trim() || null,
  }));
}

/** Tiền thuế tách ngược từ tổng đã gồm thuế, làm tròn tới đồng (ví dụ trên màn cấu hình). */
export function tienThue(tong, thueSuat) {
  if (!thueSuat) return 0;
  return Math.round((tong * thueSuat) / (100 + thueSuat));
}
