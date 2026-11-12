import { History, Lock, MapPin, SearchX } from "lucide-react";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t, tDuLieu } from "@/i18n";
import { TrangThaiKe } from "./KeHienThi";

// Tên nhóm cố định (khu vực là dữ liệu, hiện bằng tDuLieu)
const TEN_NHOM = {
  GAN_DAY: t("Dùng gần đây"),
  CO_HANG: t("Kệ đang có hàng"),
  DU_CHO: t("Còn đủ chỗ"),
  THIEU_CHO: t("Thiếu chỗ · sẽ hỏi tách cất"),
  KHONG_NHAN: t("Không nhận hàng"),
};
const LY_DO = {
  KIEM_KE: t("Đang kiểm kê, không chọn được"),
  BAO_TRI: t("Bảo trì, không nhận hàng"),
  DAY: t("Đã đầy"),
  KHAC: t("Không ở trạng thái nhận hàng"),
  TRONG: t("Kệ trống"),
};

/** Mã kệ, phần khớp chữ đang gõ tô nền vàng. */
function MaToDam({ ma, q }) {
  const tim = String(q ?? "").trim();
  const i = tim ? String(ma).toLowerCase().indexOf(tim.toLowerCase()) : -1;
  if (i < 0) return ma;
  return (
    <>
      {ma.slice(0, i)}
      <mark className="rounded-sm bg-amber-100 px-px text-bo-heading">{ma.slice(i, i + tim.length)}</mark>
      {ma.slice(i + tim.length)}
    </>
  );
}

function ThanhNho({ dangChua, sucChua }) {
  if (!sucChua) return null;
  return (
    <span className="flex h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <span className={dangChua >= sucChua ? "bg-amber-500" : "bg-slate-400"} style={{ width: `${Math.min(100, (dangChua / sucChua) * 100)}%` }} />
    </span>
  );
}

/**
 * Danh sách gợi ý mã kệ (kết quả của `locGoiYKe`), dùng chung cho danh sách thả dưới ô quét và bảng chọn kệ trên điện
 * thoại. Kệ nguồn: cột phải là số đang chứa; kệ đích: số còn trống. Kệ không chọn được mờ đi, có ổ khóa và lý do.
 * `idDong(k)`: id DOM của dòng (aria-activedescendant); `dangChon`: id kệ đang trỏ bằng phím; `onChon(k)`.
 */
export default function DanhSachGoiYKe({ kq, q, vaiTro, can, dangChon, onChon, idDong, cao = false, khongThay }) {
  if (!kq.nhom.length) {
    return khongThay ? (
      <div className="grid justify-items-center gap-1.5 px-6 py-6 text-center">
        <span className="grid size-9 place-items-center rounded-full bg-bo-surface-subtle text-slate-400">
          <SearchX className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-bo-heading">{t("Không có kệ nào khớp \"{{ma}}\"", { ma: String(q ?? "").trim() })}</p>
        <p className="text-xs text-bo-muted">{t("Kiểm tra lại mã trên tem kệ, hoặc nhấn Enter để tra trực tiếp.")}</p>
      </div>
    ) : null;
  }
  return kq.nhom.map((n) => (
    <div key={n.ma} role="group" aria-label={n.khu ? tDuLieu(n.ten) || t("Chưa có khu") : TEN_NHOM[n.ten]}>
      <p className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
        <span>{n.khu ? (n.ten ? tDuLieu(n.ten) : t("Chưa có khu")) : TEN_NHOM[n.ten]}</span>
        {n.khu ? <span className="font-normal normal-case tracking-normal">{t("{{so}} kệ", { so: soVN(n.ds.length), count: n.ds.length })}</span> : null}
      </p>
      {n.ds.map((k) => {
        const mo = Boolean(k.khoa);
        const sang = dangChon === k.id;
        return (
          <div
            key={k.id}
            id={idDong(k)}
            role="option"
            aria-selected={sang}
            aria-disabled={mo || undefined}
            // Giữ tiêu điểm ở ô quét khi bấm chuột vào danh sách
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (mo ? null : onChon(k))}
            className={cn(
              "flex items-center gap-3 rounded-md px-3",
              cao ? "py-3" : "py-2",
              sang ? "bg-bo-primary-soft" : !mo && "hover:bg-bo-surface-subtle",
              mo ? "cursor-not-allowed opacity-55" : "cursor-pointer",
            )}
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", sang ? "bg-white text-bo-primary-strong" : "bg-bo-surface-subtle text-bo-muted")}>
              {mo ? <Lock className="size-4" aria-hidden="true" /> : k.ganDay ? <History className="size-4" aria-hidden="true" /> : <MapPin className="size-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-sm font-semibold text-bo-heading">
                  <MaToDam ma={k.maViTri} q={q} />
                </span>
                {k.trangThai && k.trangThai !== "HOAT_DONG" && !k.khoa ? <TrangThaiKe trangThai={k.trangThai} className="text-xs" /> : null}
              </span>
              <span className="flex items-center gap-2 text-xs text-bo-muted">
                {k.khoa ? (
                  <span className={k.khoa === "KIEM_KE" ? "text-red-700" : undefined}>{LY_DO[k.khoa]}</span>
                ) : (
                  <>
                    <span className="tabular-nums">
                      {k.sucChua ? `${soVN(k.dangChua)}/${soVN(k.sucChua)}` : vaiTro === "dich" ? t("Đang chứa {{so}}", { so: soVN(k.dangChua) }) : t("Không giới hạn sức chứa")}
                    </span>
                    <ThanhNho dangChua={k.dangChua} sucChua={k.sucChua} />
                  </>
                )}
                {k.thieu ? <span className="text-bo-warning">· {t("thiếu {{so}} chỗ", { so: soVN(can - k.conTrong) })}</span> : null}
              </span>
            </span>
            {vaiTro === "dich" ? (
              <span className="shrink-0 text-right">
                <span className={cn("block text-sm font-semibold tabular-nums", mo ? "text-slate-400" : k.thieu ? "text-bo-warning" : "text-bo-success")}>
                  {mo ? "—" : k.conTrong == null ? t("Không giới hạn") : soVN(k.conTrong)}
                </span>
                <span className="text-[11px] text-bo-muted">{mo ? "" : k.conTrong == null ? t("sức chứa") : t("còn trống")}</span>
              </span>
            ) : (
              <span className="shrink-0 text-right">
                <span className={cn("block text-sm font-semibold tabular-nums", k.dangChua ? "text-bo-heading" : "text-slate-400")}>{soVN(k.dangChua)}</span>
                <span className="text-[11px] text-bo-muted">{t("đang chứa")}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  ));
}
