import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DongCaiDat } from "@/components/channel/KhuonCaiDat";
import { khoDaLuuKhongCon, khoSanDangChon, noiDungSan } from "@/components/channel/noiDungSan";

/**
 * Dòng kho trên sàn của thẻ Tồn kho, cho sàn ủy quyền (KH mục B.3 bước 2):
 * Lazada (gian hàng một kho) chỉ hiện "Kho mặc định"; TikTok Shop chọn kho bán hàng từ GET /{maKenh}/kho-san.
 * `khoSan`: kết quả useTaiDuLieu của getKhoSan; `value` / `onChange`: mã kho đang chọn.
 */
export default function DongKhoSan({ maKenh, tenSan, khoSan, value, maKhoDaLuu, onChange, disabled = false }) {
  const noiDung = noiDungSan(maKenh);
  if (!noiDung) return null;
  const { nhan, chiDoc } = noiDung.khoSan;
  const ds = Array.isArray(khoSan?.data) ? khoSan.data : [];
  // Kho đã lưu không còn trên sàn: nói rõ thay cho câu giải thích (trang cha coi là có thay đổi cần lưu)
  const moTa =
    !chiDoc && khoDaLuuKhongCon(maKhoDaLuu, ds) ? (
      <span className="text-bo-warning">Kho đã lưu không còn trên {tenSan}. Lưu để chuyển sang kho đang chọn.</span>
    ) : (
      noiDung.khoSan.moTa
    );

  let control;
  if (chiDoc) {
    control = <span className="text-sm text-bo-foreground">{chiDoc}</span>;
  } else if (khoSan?.initialLoading) {
    control = <span className="text-sm text-bo-muted">Đang tải…</span>;
  } else if (khoSan?.error && !ds.length) {
    control = (
      <span className="flex flex-wrap items-center gap-x-2 text-sm text-bo-danger">
        Không đọc được kho từ {tenSan}.
        <button
          type="button"
          onClick={khoSan.reload}
          disabled={khoSan.loading}
          className="rounded font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50 max-sm:min-h-11"
        >
          Thử lại
        </button>
      </span>
    );
  } else if (!ds.length) {
    control = <span className="max-w-[240px] text-sm text-bo-muted">{tenSan} chưa có kho bán hàng nào</span>;
  } else {
    control = (
      <Select value={value || khoSanDangChon(null, ds)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={nhan} className="h-9 w-[220px] max-w-full rounded-lg border-bo-border bg-white text-sm text-bo-foreground max-sm:data-[size=default]:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end" className="z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
          {ds.map((kho) => (
            <SelectItem key={kho.maKhoSan} value={kho.maKhoSan} className="rounded-md focus:bg-bo-primary-soft">
              {kho.tenKhoSan}
              {kho.macDinh ? " (mặc định)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Chỉ là chữ (kho chỉ đọc, đang tải, lỗi, chưa có kho): như các dòng khóa–giá trị khác, điện thoại xếp dưới tên
  const laChu = Boolean(chiDoc) || khoSan?.initialLoading || !ds.length;
  return <DongCaiDat title={nhan} description={moTa} control={control} giaTriChu={laChu} />;
}
