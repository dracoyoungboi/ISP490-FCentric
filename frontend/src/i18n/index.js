/**
 * Đa ngôn ngữ — điểm dùng chung của ứng dụng: `import { t } from "@/i18n";`.
 * Quy ước viết câu xem đầu tệp ./t.js. Tệp này thêm phần nạp bản dịch tiếng Anh (chỉ chạy trong Vite).
 */
import { khoiTaoI18n, layNgonNguDaLuu, NGON_NGU } from "./t";

export * from "./t";

/** Mỗi module một tệp en/*.json; chỉ tải khi người dùng chọn tiếng Anh. */
const TEP_TIENG_ANH = import.meta.glob("./en/*.json", { import: "default" });

async function napBanDichTiengAnh() {
  const cacTep = await Promise.all(Object.keys(TEP_TIENG_ANH).sort().map((duongDan) => TEP_TIENG_ANH[duongDan]()));
  return Object.assign({}, ...cacTep);
}

/** Gọi trước khi nạp ứng dụng (main.jsx). Không tải được bản dịch thì chạy tiếng Việt, không chặn ứng dụng. */
export async function khoiDongNgonNgu() {
  let ngonNgu = layNgonNguDaLuu();
  let banDich = {};
  if (ngonNgu === NGON_NGU.en) {
    try {
      banDich = await napBanDichTiengAnh();
    } catch (loi) {
      console.error("Không tải được bản dịch tiếng Anh, dùng tiếng Việt:", loi);
      ngonNgu = NGON_NGU.vi;
    }
  }
  const lng = await khoiTaoI18n(ngonNgu, banDich);
  document.documentElement.lang = lng;
  return lng;
}
