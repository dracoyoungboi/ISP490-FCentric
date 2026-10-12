import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Delta, Sparkline, StackBar } from "./ui";
import { MAU2 } from "./mau";
import { formatPhanTram, formatSo, phanTramThayDoi, tachTienGon, tyLe } from "../tong-quan/tongQuanFormat";

const nf1 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * 4 chỉ số chính trong MỘT thẻ, ngăn bằng vạch dọc (thay cho 4 thẻ rời mỗi thẻ 6 tầng chữ).
 * Mỗi ô: nhãn · số lớn · một dòng so sánh · một hình nhỏ cùng chiều cao.
 */
export default function KpiStrip({ data, loading, loiChiSo, loiTonKho, khoId, onRetry }) {
  const c = data?.chiSo;
  const t = data?.tonKho;

  const tichLuy = c ? c.doanhThuTheoGio.reduce((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []) : [];
  const chenhDon = c ? c.soDonMoiHomNay - c.soDonMoiCungGioTuanTruoc : 0;
  const bienNay = c ? tyLe(c.loiNhuanThangNay, c.doanhThuThangNay) : null;
  const bienTruoc = c ? tyLe(c.loiNhuanThangTruoc, c.doanhThuThangTruoc) : null;
  const chenhBien = bienNay != null && bienTruoc != null ? bienNay - bienTruoc : null;
  const thangTruoc = c ? (c.thang === 1 ? 12 : c.thang - 1) : null;

  const theoKho = t?.theoKho ?? [];
  const tongHeThong = theoKho.reduce((s, k) => s + k.giaTri, 0);
  const khoTong = theoKho.filter((k) => k.laKhoTong).reduce((s, k) => s + k.giaTri, 0);
  const coKhoTong = theoKho.some((k) => k.laKhoTong);

  return (
    <section aria-label="Chỉ số chính" className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#e6e9ef] bg-white sm:grid-cols-2 xl:grid-cols-4">
      <Cell idx={0} label="Doanh thu hôm nay" loading={loading} error={loiChiSo} onRetry={onRetry}>
        {c ? (
          <>
            <Value tien={c.doanhThuHomNay} />
            <Line>
              <Delta value={phanTramThayDoi(c.doanhThuHomNay, c.doanhThuCungGioTuanTruoc)} />
              <span>so với cùng giờ tuần trước</span>
            </Line>
            <Viz>
              <Sparkline values={tichLuy} />
            </Viz>
          </>
        ) : null}
      </Cell>

      <Cell idx={1} label="Đơn bán mới hôm nay" loading={loading} error={loiChiSo} onRetry={onRetry}>
        {c ? (
          <>
            <Value so={c.soDonMoiHomNay} donVi="đơn" />
            <Line>
              <Delta value={chenhDon} text={`${formatSo(Math.abs(chenhDon))} đơn`} />
              <span>so với cùng giờ tuần trước</span>
            </Line>
            <Viz>
              <Sparkline values={c.soDonMoiTheoNgay.map((d) => d.soDon)} />
            </Viz>
          </>
        ) : null}
      </Cell>

      <Cell idx={2} label={c ? `Lợi nhuận gộp tháng ${c.thang}` : "Lợi nhuận gộp tháng này"} loading={loading} error={loiChiSo} onRetry={onRetry}>
        {c ? (
          <>
            <Value tien={c.loiNhuanThangNay} />
            <Line>
              <Delta value={chenhBien} text={chenhBien == null ? "—" : `${nf1.format(Math.abs(chenhBien))} điểm`} />
              <span>biên lãi so với tháng {thangTruoc}</span>
            </Line>
            <Viz>
              <Meter value={bienNay} marker={bienTruoc} markerLabel={`Tháng ${thangTruoc}: ${formatPhanTram(bienTruoc)}`} />
            </Viz>
          </>
        ) : null}
      </Cell>

      <Cell idx={3} label="Giá trị tồn kho" loading={loading} error={loiTonKho} onRetry={onRetry}>
        {t ? (
          <>
            <Value tien={t.giaTri} />
            <Line>
              <span>{formatSo(t.khaDung)} sản phẩm khả dụng</span>
            </Line>
            <Viz>
              {khoId == null && coKhoTong ? (
                <div className="w-full">
                  <StackBar
                    height="h-1.5"
                    segments={[
                      { key: "tong", value: khoTong, color: MAU2.chinh },
                      { key: "ch", value: tongHeThong - khoTong, color: MAU2.chinhNhat },
                    ]}
                  />
                  <div className="mt-1.5 flex justify-between text-xs text-bo-muted">
                    <span>Kho tổng {formatPhanTram(tyLe(khoTong, tongHeThong), 0)}</span>
                    <span>Kho bán hàng {formatPhanTram(tyLe(tongHeThong - khoTong, tongHeThong), 0)}</span>
                  </div>
                </div>
              ) : (
                <div className="w-full text-xs text-bo-muted">
                  {khoId != null ? `${formatPhanTram(tyLe(t.giaTri, tongHeThong), 0)} giá trị tồn toàn hệ thống` : `${formatSo(t.tonThucTe)} sản phẩm tồn thực tế`}
                </div>
              )}
            </Viz>
          </>
        ) : null}
      </Cell>
    </section>
  );
}

const VACH = [
  "",
  "border-t sm:border-t-0 sm:border-l",
  "border-t xl:border-t-0 xl:border-l",
  "border-t sm:border-l xl:border-t-0",
];

function Cell({ label, loading, error, onRetry, children, idx }) {
  return (
    <div className={cn("flex min-w-0 flex-col border-[#eef1f5] p-5", VACH[idx])}>
      <h3 className="text-[13px] font-medium text-bo-muted">{label}</h3>
      {loading ? (
        <div className="mt-2.5 space-y-2" aria-hidden="true">
          <Skeleton className="h-8 w-2/3 bg-slate-100" />
          <Skeleton className="h-4 w-1/2 bg-slate-100" />
          <Skeleton className="h-8 w-full bg-slate-100" />
        </div>
      ) : error ? (
        <div role="alert" className="mt-3 flex flex-col items-start gap-1.5 text-[13px] text-bo-muted">
          <span className="inline-flex items-center gap-1.5 font-medium text-bo-warning">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Không tải được
          </span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="font-medium text-bo-primary hover:underline">
              Thử lại
            </button>
          ) : null}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Value({ tien, so, donVi }) {
  const t = tien != null ? tachTienGon(tien) : { so: formatSo(so), donVi };
  return (
    <p className="mt-1.5 truncate text-[28px] font-semibold leading-9 tracking-[-0.02em] text-bo-foreground">
      {t.so}
      <span className="ml-1.5 text-[15px] font-medium tracking-normal text-bo-muted">{t.donVi}</span>
    </p>
  );
}

function Line({ children }) {
  return <p className="mt-1 flex min-h-5 flex-wrap items-center gap-x-1.5 text-xs leading-5 text-bo-muted">{children}</p>;
}

function Viz({ children }) {
  return <div className="mt-auto hidden h-10 items-end pt-3 sm:flex">{children}</div>;
}

function Meter({ value, marker, markerLabel }) {
  const k = (v) => Math.max(0, Math.min(100, v ?? 0));
  return (
    <div className="w-full">
      <div className="relative h-1.5 rounded-full bg-[#e8f1ff]">
        <div className="h-full rounded-full" style={{ width: `${k(value)}%`, background: MAU2.chinh }} />
        {marker != null ? <span className="absolute -top-[3px] h-3 w-0.5 rounded-sm bg-slate-500" style={{ left: `calc(${k(marker)}% - 1px)` }} aria-hidden="true" /> : null}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-bo-muted">
        <span>
          Biên lãi <b className="font-semibold text-bo-foreground">{formatPhanTram(value)}</b>
        </span>
        {marker != null ? <span>{markerLabel}</span> : null}
      </div>
    </div>
  );
}
