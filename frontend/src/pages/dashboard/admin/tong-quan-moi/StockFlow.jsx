import { Boxes } from "lucide-react";
import { Bar, BarChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import { Card, MoreLink, StackBar } from "./ui";
import { MAU2 } from "./mau";
import { formatPhanTram, formatSo, nhanDayDu, tyLe } from "../tong-quan/tongQuanFormat";

const MUC = [
  { key: "hetHang", ten: "Hết hàng" },
  { key: "thieuHang", ten: "Sắp hết hàng" },
  { key: "binhThuong", ten: "Bình thường" },
  { key: "duHang", ten: "Dư hàng" },
];

/**
 * Tồn kho: 3 con số cốt lõi (khả dụng, đang giữ, đang về), phân bố 4 mức tình trạng,
 * và luồng nhập – xuất của kỳ dạng cột hai chiều (nhập lên trên, xuất xuống dưới).
 */
export default function StockFlow({ data, khoId, loading, loiTonKho, loiNhapXuat, onRetry }) {
  const t = data?.tonKho;
  const io = data?.nhapXuat;
  const nhom = io?.nhom ?? "ngay";
  const cot = (io?.diem ?? []).map((d) => ({ ...d, xuatAm: -d.xuat }));

  return (
    <Card
      title="Tồn kho"
      right={<MoreLink to="/reports/inventory">Báo cáo tồn kho</MoreLink>}
      loading={loading}
      error={loiTonKho}
      onRetry={onRetry}
      empty={t ? t.tonThucTe === 0 && t.soDong === 0 : false}
      emptyIcon={Boxes}
      emptyText="Tồn kho sẽ hiện sau khi xác nhận phiếu nhập đầu tiên."
    >
      {t ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Num label="Khả dụng" value={t.khaDung} />
            <Num label="Đang giữ cho đơn" value={t.dangGiu} />
            <Num label="Đang về từ nhà cung cấp" value={t.dangVe} />
            <Num label={khoId == null ? "Đang chuyển giữa kho" : "Đang chuyển đi hoặc đến"} value={t.dangChuyen} />
          </dl>

          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between text-xs text-bo-muted">
              <span>Tình trạng theo mã tại từng kho</span>
              <span className="tabular-nums" title={`Ngưỡng là mức tối thiểu của sản phẩm (chưa đặt thì dùng ${formatSo(t.nguongMacDinh)}); dư hàng khi vượt ${formatSo(t.heSoDu)} lần ngưỡng.`}>
                {formatSo(t.soDong)} dòng
              </span>
            </div>
            <StackBar height="h-2.5" segments={MUC.map((m) => ({ key: m.key, value: t[m.key], color: MAU2.tinhTrang[m.key] }))} />
            <dl className="mt-3 space-y-1.5">
              {MUC.map((m) => (
                <div key={m.key} className="flex items-center gap-2 text-[13px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: MAU2.tinhTrang[m.key] }} aria-hidden="true" />
                  <dt className="min-w-0 flex-1 truncate text-bo-muted">{m.ten}</dt>
                  <dd className="font-semibold tabular-nums text-bo-foreground">{formatSo(t[m.key])}</dd>
                  <dd className="w-10 text-right text-xs tabular-nums text-bo-muted">{formatPhanTram(tyLe(t[m.key], t.soDong), 0)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-5 border-t border-[#eef1f5] pt-4">
            <div>
              <h3 className="text-[13px] font-medium text-bo-foreground">Nhập – xuất trong kỳ</h3>
              {io && !loiNhapXuat ? (
                <p className="mt-1 flex items-center gap-4 text-xs tabular-nums text-bo-muted">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: MAU2.nhap }} aria-hidden="true" />Nhập <b className="font-semibold text-bo-foreground">{formatSo(io.tongNhap)}</b></span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: MAU2.xuat }} aria-hidden="true" />Xuất <b className="font-semibold text-bo-foreground">{formatSo(io.tongXuat)}</b></span>
                </p>
              ) : null}
            </div>
            {loiNhapXuat ? (
              <p role="alert" className="mt-2 text-[13px] text-bo-warning">Không tải được số liệu nhập – xuất.</p>
            ) : (
              <div className="mt-2 h-[92px]" role="figure" aria-label={`Nhập ${formatSo(io?.tongNhap)} và xuất ${formatSo(io?.tongXuat)} sản phẩm trong kỳ`}>
                <KhungBieuDo>
                  <BarChart data={cot} stackOffset="sign" margin={{ top: 2, right: 0, bottom: 2, left: 0 }} barCategoryGap="22%">
                    <XAxis dataKey="tu" hide />
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <ReferenceLine y={0} stroke="#e2e8f0" />
                    <Tooltip cursor={{ fill: "#f4f6f9" }} content={<IoTip nhom={nhom} />} />
                    <Bar dataKey="nhap" stackId="a" fill={MAU2.nhap} radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
                    <Bar dataKey="xuatAm" stackId="a" fill={MAU2.xuat} radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
                  </BarChart>
                </KhungBieuDo>
              </div>
            )}
            <div className="mt-1 flex justify-between text-xs text-bo-muted">
              <span>{io?.boChuyenKhoNoiBo ? "Không tính chuyển kho nội bộ" : "Gồm hàng chuyển đến và chuyển đi"}</span>
              <MoreLink to="/reports/stock-movements">Nhật ký</MoreLink>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function Num({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-bo-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-bo-foreground">{formatSo(value)}</dd>
    </div>
  );
}

function IoTip({ active, payload, nhom }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="min-w-40 rounded-lg bg-[#182537] px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">{nhanDayDu(d.tu, nhom)}</p>
      <p className="flex justify-between gap-4"><span className="text-white/70">Nhập kho</span><b className="tabular-nums">{formatSo(d.nhap)}</b></p>
      <p className="flex justify-between gap-4"><span className="text-white/70">Xuất kho</span><b className="tabular-nums">{formatSo(d.xuat)}</b></p>
      {d.chuaKetThuc ? <p className="mt-1 border-t border-white/15 pt-1 text-white/70">Chưa kết thúc</p> : null}
    </div>
  );
}
