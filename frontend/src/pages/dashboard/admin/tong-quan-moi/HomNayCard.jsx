import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Delta, LE } from "./ui";
import { MAU2 } from "./mau";
import { bienDong, docNgay, formatSo, formatTienNgan, tachTien, tenThuGiuaCau } from "../tong-quan/tongQuanFormat";

const hai = (n) => String(n).padStart(2, "0");
/** Khung giờ của cột thứ i: "06:00–07:00". */
const khungGio = (i) => `${hai(i)}:00–${hai((i + 1) % 24)}:00`;
/* Nhãn trục giờ đặt đúng giữa cột của giờ đó (24 cột đều nhau); nhãn đầu canh trái, nhãn cuối canh phải để không tràn. */
const NHAN_GIO = [0, 6, 12, 18, 23];

/**
 * Hôm nay (đến giờ số liệu): doanh thu và đơn bán mới, % so với cùng giờ cùng thứ tuần trước, và một dòng ghi rõ
 * số của tuần trước (để % đọc được, kể cả khi tuần trước bằng 0 nên không tính được %). Doanh thu theo giờ
 * (giờ đang chạy tô nhạt) và số đơn đã giao. Chưa có đơn nào thì chỉ một dòng, không hiện số 0 to.
 */
export default function HomNayCard({ data, loading, error, onRetry, className }) {
  const c = data?.chiSo;
  const t = docNgay(data?.thoiDiem);
  const coSo = c ? c.doanhThuHomNay > 0 || c.soDonMoiHomNay > 0 : false;
  const theoGio = c?.doanhThuTheoGio ?? [];
  const gioHienTai = theoGio.length - 1;
  const maxGio = Math.max(1, ...theoGio);
  const dt = tachTien(c?.doanhThuHomNay ?? 0);

  return (
    <Card
      className={className}
      title="Hôm nay"
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {!c ? null : coSo ? (
        <>
          <dl className="grid grid-cols-2">
            <So
              ten="Doanh thu"
              so={dt.so}
              donVi={dt.donVi}
              bd={bienDong(c.doanhThuHomNay, c.doanhThuCungGioTuanTruoc)}
              tieuDe={`Cùng giờ tuần trước: ${formatTienNgan(c.doanhThuCungGioTuanTruoc)}`}
            />
            <So
              ten="Đơn bán mới"
              so={formatSo(c.soDonMoiHomNay)}
              donVi="đơn"
              bd={bienDong(c.soDonMoiHomNay, c.soDonMoiCungGioTuanTruoc)}
              tieuDe={`Cùng giờ tuần trước: ${formatSo(c.soDonMoiCungGioTuanTruoc)} đơn`}
              vach
            />
          </dl>
          <p className={cn(LE, "border-b border-[#eef1f5] pb-3 pt-1 text-xs text-bo-muted")}>
            Cùng giờ {t ? tenThuGiuaCau(t) : ""} tuần trước:{" "}
            <span className="whitespace-nowrap font-medium tabular-nums text-bo-foreground">{formatTienNgan(c.doanhThuCungGioTuanTruoc)}</span> ·{" "}
            <span className="whitespace-nowrap font-medium tabular-nums text-bo-foreground">{formatSo(c.soDonMoiCungGioTuanTruoc)} đơn</span>
          </p>
          <div className={cn(LE, "pb-3.5 pt-3")}>
            <div className="mb-2 flex justify-between gap-3 text-xs text-bo-muted">
              <span>Doanh thu theo giờ</span>
              <span>Đã giao {formatSo(c.soDonGiaoHomNay)} đơn</span>
            </div>
            <div
              className="flex h-16 items-end gap-[2px] border-b border-[#cbd5e1]"
              role="img"
              aria-label={`Doanh thu hôm nay theo giờ: ${theoGio.map((v, i) => `${khungGio(i)} ${formatTienNgan(v)}`).join(", ")}. Giờ đang chạy tô nhạt.`}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const v = theoGio[i] ?? 0;
                return (
                  <i
                    key={i}
                    className="block flex-1 rounded-t-[2px]"
                    style={{ height: `${(v / maxGio) * 100}%`, background: i === gioHienTai ? "#9cc3ff" : MAU2.chinh }}
                    title={i < theoGio.length ? `${khungGio(i)}: ${formatTienNgan(v)}${i === gioHienTai ? " (đang chạy)" : ""}` : undefined}
                  />
                );
              })}
            </div>
            <div className="relative mt-1.5 h-4 text-xs tabular-nums text-bo-muted" aria-hidden="true">
              {NHAN_GIO.map((h, i) => (
                <span
                  key={h}
                  className="absolute top-0 whitespace-nowrap"
                  style={
                    i === 0
                      ? { left: 0 }
                      : i === NHAN_GIO.length - 1
                        ? { right: 0 }
                        : { left: `${((h + 0.5) / 24) * 100}%`, transform: "translateX(-50%)" }
                  }
                >
                  {hai(h)}:00
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className={cn(LE, "flex items-start gap-2 py-3.5 text-sm text-bo-muted")}>
          <Clock3 className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            Chưa có đơn bán nào. Cùng giờ {t ? tenThuGiuaCau(t) : ""} tuần trước: {formatSo(c.soDonMoiCungGioTuanTruoc)} đơn.
          </span>
        </p>
      )}
    </Card>
  );
}

function So({ ten, so, donVi, bd, tieuDe, vach }) {
  return (
    <div className={cn("min-w-0 pb-1 pt-3.5", vach ? "border-l border-[#eef1f5] pl-4 pr-5 @max-[520px]:pr-4" : "pl-5 pr-4 @max-[520px]:pl-4")} title={tieuDe}>
      <dt className="truncate text-sm text-bo-muted">{ten}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap text-xl font-semibold leading-7 tracking-[-0.01em] text-bo-foreground">
        {so}
        <span className="text-sm font-medium tracking-normal text-bo-muted">{donVi}</span>
        <Delta bd={bd} className="text-xs tracking-normal" />
      </dd>
    </div>
  );
}
