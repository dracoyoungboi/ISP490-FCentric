import { RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DongCaiDat } from "@/components/channel/KhuonCaiDat";
import { khoDaLuuKhongCon, khoSanDangChon, noiDungSan } from "@/components/channel/noiDungSan";
import { tenKhoSanHienThi } from "@/components/channel/cauHinhDongBo";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Dòng kho trên sàn của thẻ Tồn kho, cho sàn ủy quyền (Lazada, Shopee, TikTok Shop):
 * tự động hiển thị chỉ đọc khi sàn chỉ có 1 kho, mở dropdown khi có từ 2 kho trở lên,
 * kèm nút "Tải lại từ sàn" để cập nhật ngay khi người bán vừa thêm kho trên Seller Center.
 */
export default function DongKhoSan({
  maKenh,
  tenSan,
  khoSan,
  value,
  maKhoDaLuu,
  onChange,
  onTaiLaiTuSan,
  dangTaiLaiTuSan = false,
  disabled = false,
}) {
  const noiDung = noiDungSan(maKenh);
  if (!noiDung) return null;
  const { nhan, chiDoc } = noiDung.khoSan;
  const ds = Array.isArray(khoSan?.data) ? khoSan.data : [];
  // Kho đã lưu không còn trên sàn: nói rõ thay cho câu giải thích (trang cha coi là có thay đổi cần lưu)
  const moTa =
    !chiDoc && khoDaLuuKhongCon(maKhoDaLuu, ds) ? (
      <span className="text-bo-warning">{t("Kho đã lưu không còn trên {{tenSan}}. Lưu để chuyển sang kho đang chọn.", { tenSan })}</span>
    ) : ds.length === 1 ? (
      t("Gian hàng một kho bán: {{tenSan}} nhận số vào kho bán hàng mặc định, không cần chọn.", { tenSan })
    ) : (
      noiDung.khoSan.moTa
    );

  const nutTaiLai = onTaiLaiTuSan ? (
    <button
      type="button"
      onClick={onTaiLaiTuSan}
      disabled={disabled || dangTaiLaiTuSan || khoSan?.loading}
      title={t("Tải lại danh sách kho mới nhất trực tiếp từ {{tenSan}}", { tenSan })}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-bo-primary hover:bg-bo-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50"
    >
      <RefreshCw className={cn("size-3.5", (dangTaiLaiTuSan || khoSan?.loading) && "animate-spin")} aria-hidden="true" />
      {t("Tải lại từ sàn")}
    </button>
  ) : null;

  let control;
  if (chiDoc) {
    control = <span className="text-sm text-bo-foreground">{chiDoc}</span>;
  } else if (khoSan?.initialLoading) {
    control = <span className="text-sm text-bo-muted">{t("Đang tải…")}</span>;
  } else if (khoSan?.error && !ds.length) {
    control = (
      <span className="flex flex-wrap items-center gap-x-2 text-sm text-bo-danger">
        {t("Không đọc được kho từ {{tenSan}}.", { tenSan })}
        <button
          type="button"
          onClick={onTaiLaiTuSan || khoSan.reload}
          disabled={khoSan.loading || dangTaiLaiTuSan}
          className="rounded font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50 max-sm:min-h-11"
        >
          {t("Thử lại")}
        </button>
      </span>
    );
  } else if (!ds.length) {
    control = (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="max-w-[240px] text-sm text-bo-muted">{t("{{tenSan}} chưa có kho bán hàng nào", { tenSan })}</span>
        {nutTaiLai}
      </div>
    );
  } else if (ds.length === 1) {
    control = (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm font-medium text-bo-foreground">
          {tenKhoSanHienThi(ds[0].tenKhoSan)}
        </span>
        {nutTaiLai}
      </div>
    );
  } else {
    control = (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={value || khoSanDangChon(null, ds)} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger aria-label={nhan} className="h-9 w-[220px] max-w-full rounded-lg border-bo-border bg-bo-surface text-sm text-bo-foreground max-sm:data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end" className="z-50 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg">
            {ds.map((kho) => (
              <SelectItem key={kho.maKhoSan} value={kho.maKhoSan} className="rounded-md focus:bg-bo-primary-soft">
                {tenKhoSanHienThi(kho.tenKhoSan)}
                {kho.macDinh ? t(" (mặc định)") : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {nutTaiLai}
      </div>
    );
  }

  // Chỉ là chữ (kho chỉ đọc, 1 kho duy nhất, đang tải, lỗi, chưa có kho): như các dòng khóa–giá trị khác, điện thoại xếp dưới tên
  const laChu = Boolean(chiDoc) || ds.length === 1 || khoSan?.initialLoading || !ds.length;
  return <DongCaiDat title={nhan} description={moTa} control={control} giaTriChu={laChu} />;
}
