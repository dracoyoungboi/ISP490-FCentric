import { CircleCheck, Loader2, OctagonAlert, TriangleAlert } from "lucide-react";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

function O({ so, nhan }) {
  return (
    <div className="min-w-0 rounded-md border border-bo-border bg-white px-3 py-2">
      <span className="block text-lg font-semibold leading-6 tabular-nums text-bo-heading">{so}</span>
      <span className="block truncate text-xs leading-4 text-bo-muted">{nhan}</span>
    </div>
  );
}

/**
 * Xem trước phạm vi của một đợt (POST /kiem-ke/xem-truoc): số kệ sẽ khóa, số dòng (cặp kệ – lô) sẽ chốt, số lô, tổng sản
 * phẩm trên sổ kệ, kèm các vướng mắc (kệ đang thuộc đợt khác, hàng chưa có kệ, phiếu nhặt đang giữ hàng…). Ước tính lúc xem;
 * Bắt đầu tính lại trong giao dịch.
 *
 * - `kq`: KiemKeDto.XemTruoc. `dang`: đang tính. `loi`: câu lỗi (kèm `onThuLai`).
 * - `cheDo`: "toan_ke" | "theo_lo" — câu giải thích khóa.
 * - `nutCuaVanDe(vanDe)`: nút gỡ vướng mắc đặt sau câu (vd. "Xếp kệ" cho hàng chưa có kệ); mọi vướng mắc đều chặn Bắt đầu.
 * - `kq.canhBao`: lưu ý KHÔNG chặn Bắt đầu (phiếu chuyển đang về kho, phiếu nhập chưa hoàn tất đã gán kệ trong phạm vi).
 */
export default function XemTruocPhamVi({ kq, dang = false, loi, onThuLai, cheDo = "toan_ke", nutCuaVanDe, className }) {
  if (loi) {
    return (
      <div className={cn("rounded-lg border border-bo-danger/25 bg-bo-danger-soft px-3 py-2.5 text-[13px] leading-5 text-bo-danger-strong", className)}>
        {t("Chưa xem trước được phạm vi: {{loi}}.", { loi })} {onThuLai ? <NutChu onClick={onThuLai}>{t("Thử lại")}</NutChu> : null}
      </div>
    );
  }
  if (!kq) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-dashed border-bo-border px-3 py-3 text-[13px] text-bo-muted", className)}>
        {dang ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {dang ? t("Đang tính phạm vi…") : t("Chọn phạm vi để xem trước.")}
      </div>
    );
  }
  const vanDe = Array.isArray(kq.vanDe) ? kq.vanDe : [];
  const canhBao = Array.isArray(kq.canhBao) ? kq.canhBao : [];
  return (
    <div className={cn("grid gap-3", dang && "opacity-70 transition-opacity", className)} aria-busy={dang || undefined}>
      <div className="grid grid-cols-2 gap-2">
        <O so={soVN(kq.soViTri)} nhan={cheDo === "theo_lo" ? t("kệ có hàng thuộc phạm vi") : t("kệ sẽ khóa")} />
        <O so={soVN(kq.soDong)} nhan={t("dòng sẽ chốt (kệ – lô)")} />
        <O so={soVN(kq.soLo)} nhan={t("lô hàng")} />
        <O so={soVN(kq.tongSoLuong)} nhan={t("sản phẩm trên sổ kệ")} />
      </div>
      {kq.soDanhMuc ? (
        <p className="text-xs leading-4 text-bo-muted">{t("Gồm {{soDanhMuc}} danh mục (kể cả danh mục con).", { count: kq.soDanhMuc, soDanhMuc: soVN(kq.soDanhMuc) })}</p>
      ) : null}
      {vanDe.length ? (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {vanDe.map((v, i) => (
            <li
              key={`${v.ma}-${i}`}
              className="flex items-start gap-2 rounded-md border border-bo-danger/25 bg-bo-danger-soft px-2.5 py-2 text-[13px] leading-5 text-bo-danger-strong"
            >
              <OctagonAlert className="mt-0.5 size-4 shrink-0 text-bo-danger" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {v.noiDung} {nutCuaVanDe?.(v) ?? null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {canhBao.length ? (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {canhBao.map((v, i) => (
            <li
              key={`${v.ma}-${i}`}
              className="flex items-start gap-2 rounded-md border border-bo-warning/30 bg-bo-warning-soft px-2.5 py-2 text-[13px] leading-5 text-bo-foreground"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bo-warning" aria-hidden="true" />
              <span className="min-w-0 break-words">{v.noiDung}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {kq.coTheBatDau ? (
        <p className="flex items-start gap-2 text-[13px] leading-5 text-bo-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("Sẵn sàng bắt đầu.")}{" "}
            <span className="text-slate-700">
              {cheDo === "theo_lo"
                ? t("Chỉ hàng thuộc danh mục bị giữ; hàng khác trên cùng kệ vẫn nhập, xuất, bán bình thường.")
                : t("Các kệ trên tạm dừng nhập, xuất, chuyển kho và bán tại quầy tới khi duyệt hoặc hủy.")}
            </span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
