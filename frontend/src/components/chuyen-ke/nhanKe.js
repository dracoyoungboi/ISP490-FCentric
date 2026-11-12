import { soVN } from "@/components/chung-tu/bangChungTu";
import { t, tDuLieu } from "@/i18n";
import { LY_DO_CHUYEN_KE } from "./chuyenKe";

/** Vị trí kệ "Khu A · Dãy 01 · Hàng 02 · Tầng 2" (bỏ phần trống). */
export function viTriKe(ke) {
  return [
    ke?.khuVuc ? tDuLieu(ke.khuVuc) : null,
    ke?.dayKe ? t("Dãy {{so}}", { so: ke.dayKe }) : null,
    ke?.hangKe ? t("Hàng {{so}}", { so: ke.hangKe }) : null,
    ke?.tangKe ? t("Tầng {{so}}", { so: ke.tangKe }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "68/100", hoặc "110 · không giới hạn" khi kệ không đặt sức chứa. */
export function chuSucChua(dangChua, sucChua) {
  return sucChua ? `${soVN(dangChua)}/${soVN(sucChua)}` : t("{{so}} · không giới hạn", { so: soVN(dangChua) });
}

/**
 * Ghi chú phiếu để hiện ra: lý do chọn nhanh lưu bằng tiếng Việt ở đầu ("Dồn kệ · …") được dịch, phần gõ tay giữ
 * nguyên văn (tDuLieu).
 */
export function hienGhiChu(ghiChu) {
  if (!ghiChu) return "";
  const lyDo = LY_DO_CHUYEN_KE.find((x) => ghiChu === x || ghiChu.startsWith(`${x} · `));
  if (!lyDo) return tDuLieu(ghiChu);
  const conLai = ghiChu.slice(lyDo.length).replace(/^ · /, "");
  return conLai ? `${t(lyDo)} · ${conLai}` : t(lyDo);
}
