import { RefreshCw } from "lucide-react";
import { DongCaiDat } from "@/components/channel/KhuonCaiDat";
import { khoMacDinhSan, noiDungSan } from "@/components/channel/noiDungSan";
import { tenKhoSanHienThi } from "@/components/channel/cauHinhDongBo";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Dòng kho trên sàn của thẻ Tồn kho (Lazada, Shopee, TikTok Shop):
 * luôn hiển thị chỉ đọc kho bán hàng / lấy hàng mặc định của sàn, kèm nút "Tải lại từ sàn"
 * để đồng bộ ngay khi người bán đổi kho mặc định trên Seller Center.
 */
export default function DongKhoSan({
  maKenh,
  tenSan,
  khoSan,
  onTaiLaiTuSan,
  dangTaiLaiTuSan = false,
  disabled = false,
}) {
  const noiDung = noiDungSan(maKenh);
  if (!noiDung) return null;
  const { nhan, chiDoc, moTa } = noiDung.khoSan;
  const ds = Array.isArray(khoSan?.data) ? khoSan.data : [];
  const khoMacDinh = khoMacDinhSan(ds);

  const nutTaiLai = onTaiLaiTuSan ? (
    <button
      type="button"
      onClick={onTaiLaiTuSan}
      disabled={disabled || dangTaiLaiTuSan || khoSan?.loading}
      title={t("Tải lại danh sách kho mới nhất trực tiếp từ {{tenSan}}", { tenSan })}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-bo-primary hover:bg-bo-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50"
    >
      <RefreshCw className={cn("size-3.5", (dangTaiLaiTuSan || khoSan?.loading) && "animate-spin")} aria-hidden="true" />
      {t("Tải lại từ sàn")}
    </button>
  ) : null;

  let noiDungKho;
  if (chiDoc) {
    noiDungKho = <p className="min-w-0 break-words text-sm text-bo-foreground">{chiDoc}</p>;
  } else if (khoSan?.initialLoading) {
    noiDungKho = <p className="text-sm text-bo-muted">{t("Đang tải…")}</p>;
  } else if (khoSan?.error && !ds.length) {
    noiDungKho = (
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 break-words text-sm text-bo-danger">
        <span>{t("Không đọc được kho từ {{tenSan}}.", { tenSan })}</span>
        <button
          type="button"
          onClick={onTaiLaiTuSan || khoSan.reload}
          disabled={khoSan.loading || dangTaiLaiTuSan}
          className="rounded font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50 max-sm:min-h-11"
        >
          {t("Thử lại")}
        </button>
      </p>
    );
  } else if (!khoMacDinh) {
    noiDungKho = (
      <p className="min-w-0 break-words text-sm text-bo-muted">
        {t("{{tenSan}} chưa có kho bán hàng nào", { tenSan })}
      </p>
    );
  } else {
    noiDungKho = (
      <div className="min-w-0 rounded-lg border border-bo-border bg-bo-surface-subtle/60 px-3 py-2.5">
        <p className="min-w-0 break-words text-sm font-medium leading-5 text-bo-foreground">
          {tenKhoSanHienThi(khoMacDinh.tenKhoSan || khoMacDinh.maKhoSan)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            {t("Mặc định trên sàn")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <DongCaiDat title={nhan} description={moTa} control={chiDoc ? null : nutTaiLai} giaTriChu>
      {noiDungKho}
    </DongCaiDat>
  );
}
