import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Search } from "lucide-react";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import StatusBadge from "@/components/shared/StatusBadge";
import { getBaoGiaStatus } from "@/constants/baoGia";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { cn } from "@/lib/utils";
import { dashboardService } from "@/services/dashboardService";
import { Card, LE, MoreLink } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { MAU2 } from "@/pages/dashboard/admin/tong-quan-moi/mau";
import { docNgay, formatNhanTien, formatSo, formatTien, formatTienNgan, tenThu } from "@/pages/dashboard/admin/tong-quan/tongQuanFormat";
import TrangVaiTro from "@/pages/dashboard/vai-tro/TrangVaiTro";
import { BoCuc, CAM, ChuGiai, DO, DaySo, FOCUS, NutBang, ThaoTacNhanh, VIEN, XANH } from "@/pages/dashboard/vai-tro/khung";
import { phimTab } from "@/pages/dashboard/vai-tro/banPhim";
import { THU_TU } from "@/pages/dashboard/vai-tro/lop";
import { chuYDon, diemTheoGio, giaBan, gioPhut, guiLuc, nhanGio, tenBienThe, theSoBanHang, vachGio, vachTron } from "@/pages/dashboard/vai-tro/soLieuVaiTro";

/**
 * Tổng quan của NHÂN VIÊN BÁN HÀNG tại kho làm việc (ô đầu trang). Hàng 1: 4 ô số. Cột chính: doanh thu cộng dồn
 * trong ngày so với cùng thứ tuần trước · đơn của bạn (3 tab). Cột phải: bán nhanh · tra còn hàng (ngay cạnh nút bán,
 * khách hỏi là tra được) · bán chạy. Điện thoại: nút bán ngay sau ô số. "Của bạn" là chứng từ bạn tạo.
 */
export default function DashboardSalesStaff() {
  return (
    <TrangVaiTro vaiTro="nhan_vien_ban_hang" theoKho>
      {({ data, loading, loi, reload }) => {
        const b = data?.banHang;
        const thoiDiem = data?.thoiDiem;
        return (
          <>
            <DaySo loading={loading} error={loi("chiSo")} onRetry={reload} the={b?.chiSo ? theSoBanHang(b.chiSo, thoiDiem) : []} />
            <BoCuc
              chinh={[
                <DoanhThuTheoGio
                  key="dt"
                  className={THU_TU[4]}
                  tg={b?.theoGio}
                  cungGioTruoc={b?.chiSo?.doanhThu?.cungGioTruoc ?? null}
                  thoiDiem={thoiDiem}
                  loading={loading}
                  error={loi("theoGio")}
                  onRetry={reload}
                />,
                <DonCuaBan
                  key="don"
                  className={THU_TU[2]}
                  don={b?.don}
                  baoGia={b?.baoGia}
                  tom={b?.chiSo?.donCuaToi}
                  thoiDiem={thoiDiem}
                  loading={loading}
                  loiDon={loi("don")}
                  loiBaoGia={loi("baoGia")}
                  onRetry={reload}
                />,
              ]}
              phai={[
                <ThaoTacNhanh
                  key="nhanh"
                  className={THU_TU[1]}
                  tieuDe="Bán hàng"
                  ds={[
                    { ten: "Bán tại quầy", to: "/pos" },
                    { ten: "Tạo đơn", to: "/sales-orders/create" },
                    { ten: "Tạo báo giá", to: "/sales-quotations/create" },
                  ]}
                />,
                <TraTon key="tra" className={THU_TU[3]} />,
                <BanChay key="bc" className={THU_TU[5]} dong={b?.banChay} loading={loading} error={loi("banChay")} onRetry={reload} />,
              ]}
            />
          </>
        );
      }}
    </TrangVaiTro>
  );
}

/* ---------- Doanh thu cộng dồn trong ngày: hôm nay (xanh, nét liền) và cùng thứ tuần trước (xám, nét đứt) ---------- */
function DoanhThuTheoGio({ tg, cungGioTruoc, thoiDiem, className, loading, error, onRetry }) {
  const [bang, setBang] = useState(false);
  // Số "cùng giờ tuần trước" lấy đúng số của ô Doanh thu (máy chủ tính đến từng phút) để hai nơi khớp nhau
  const s = useMemo(() => (tg && thoiDiem ? diemTheoGio(tg, thoiDiem, cungGioTruoc) : null), [tg, thoiDiem, cungGioTruoc]);
  const bayGio = docNgay(thoiDiem);
  const thuTruoc = bayGio ? tenThu(bayGio) : "";
  const vachY = s ? vachTron(Math.max(0, ...s.ds.map((r) => Math.max(r.truoc, r.nay ?? 0)))) : [0, 1, 2, 3, 4];
  const ticks = s ? vachGio(s.dau, s.cuoi, s.buoc) : [];
  return (
    <Card
      className={className}
      title="Doanh thu trong ngày"
      scope="cộng dồn theo giờ"
      scopeClassName="@max-[440px]:hidden"
      right={<NutBang bang={bang} setBang={setBang} />}
      bodyClassName={cn(LE, "pb-4 pt-4")}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {s ? (
        <>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <ChuGiai mau={XANH} net="solid" ten={`Hôm nay, đến ${gioPhut(thoiDiem)}`} so={formatTienNgan(s.homNay)} donVi="" />
            <ChuGiai mau={MAU2.kyTruoc} net="dashed" ten={`${thuTruoc} tuần trước, cùng giờ`} so={formatTienNgan(s.truocCungGio)} donVi="" />
            <p className="text-xs text-bo-muted @min-[640px]:ml-auto">
              Cả ngày tuần trước: <b className="font-semibold text-bo-foreground">{formatTienNgan(s.truocCaNgay)}</b>
            </p>
          </div>
          {bang ? (
            <div className="mt-3 max-h-[220px] overflow-y-auto rounded-md border border-[#eef1f5]">
              <table className="w-full text-sm">
                <caption className="sr-only">Doanh thu cộng dồn theo giờ</caption>
                <thead className="sticky top-0 bg-bo-surface-subtle text-left text-xs text-bo-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Đến</th>
                    <th className="px-3 py-2 text-right font-medium">Hôm nay</th>
                    <th className="px-3 py-2 text-right font-medium">Tuần trước</th>
                  </tr>
                </thead>
                <tbody>
                  {s.ds.map((r) => (
                    <tr key={r.gio} className="border-t border-[#eef1f5]">
                      <td className="px-3 py-1.5">{nhanGio(r.gio)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.nay == null ? "—" : formatTien(r.nay)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatTien(Math.round(r.truoc))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 h-[220px] @max-[520px]:h-[190px]" role="figure" aria-label="Doanh thu cộng dồn theo giờ, hôm nay so với cùng thứ tuần trước. Bấm nút bảng để đọc từng giờ.">
              <KhungBieuDo>
                <ComposedChart data={s.ds} margin={{ top: 8, right: 10, bottom: 0, left: 0 }} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke={MAU2.luoi} />
                  <XAxis
                    dataKey="gio"
                    type="number"
                    domain={[s.dau, s.cuoi]}
                    ticks={ticks}
                    tickFormatter={(v) => `${v}h`}
                    tickLine={false}
                    axisLine={{ stroke: MAU2.truc }}
                    tick={{ fill: MAU2.chu, fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis width={52} domain={[0, vachY[4]]} ticks={vachY} tickLine={false} axisLine={false} tick={{ fill: MAU2.chu, fontSize: 12 }} tickFormatter={(v) => formatNhanTien(v)} />
                  <Tooltip cursor={{ stroke: MAU2.truc, strokeWidth: 1 }} isAnimationActive={false} content={<TipGio />} />
                  <Area type="monotone" dataKey="nay" stroke="none" fill="rgba(22,119,255,0.10)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                  <Line
                    type="monotone"
                    dataKey="truoc"
                    stroke={MAU2.kyTruoc}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 5, fill: MAU2.kyTruoc, stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="nay"
                    stroke={XANH}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                    dot={(p) => (p.payload.bayGio ? <circle key="bay-gio" cx={p.cx} cy={p.cy} r={4.5} fill={XANH} stroke="#fff" strokeWidth={2} /> : <g key={p.index} />)}
                    activeDot={{ r: 5, fill: XANH, stroke: "#fff", strokeWidth: 2 }}
                  />
                </ComposedChart>
              </KhungBieuDo>
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}

function TipGio({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="min-w-48 rounded-md border border-bo-border bg-bo-surface px-3 py-2.5 text-xs leading-4 shadow-lg">
      <p className="mb-1.5 font-medium text-bo-foreground">Đến {nhanGio(r.gio)}</p>
      {r.nay != null ? (
        <p className="mt-1 flex items-center gap-2">
          <i className="inline-block w-4 border-t-2" style={{ borderColor: XANH }} aria-hidden="true" />
          <span className="flex-1 text-bo-muted">Hôm nay</span>
          <b className="text-sm font-semibold tabular-nums text-bo-foreground">{formatTienNgan(r.nay)}</b>
        </p>
      ) : null}
      <p className="mt-1 flex items-center gap-2">
        <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MAU2.kyTruoc }} aria-hidden="true" />
        <span className="flex-1 text-bo-muted">Tuần trước</span>
        <b className="text-sm font-semibold tabular-nums text-bo-foreground">{formatTienNgan(Math.round(r.truoc))}</b>
      </p>
    </div>
  );
}

/* ---------- Đơn của bạn: 3 tab — cần chú ý · đang xử lý · báo giá chờ khách ---------- */
const TAB_DON = [
  { key: "chuY", ten: "Cần chú ý", trong: "Không có đơn nào cần chú ý." },
  { key: "dang", ten: "Đang xử lý", trong: "Không có đơn nào đang xử lý." },
  { key: "baoGia", ten: "Báo giá", trong: "Không có báo giá nào đang chờ khách." },
];

function DonCuaBan({ don, baoGia, tom, thoiDiem, className, loading, loiDon, loiBaoGia, onRetry }) {
  const nhom = {
    chuY: (don ?? []).filter((o) => o.chuY),
    dang: (don ?? []).filter((o) => !o.chuY),
    baoGia: baoGia ?? [],
  };
  // Số trên tab lấy từ tổng của máy chủ (danh sách chỉ trả tối đa 50 đơn mới nhất); không có thì đếm danh sách
  const soTab = {
    chuY: tom ? tom.canChuY : nhom.chuY.length,
    dang: tom ? tom.tong - tom.canChuY : nhom.dang.length,
    baoGia: nhom.baoGia.length,
  };
  const [tab, setTab] = useState(null);
  const tabHien = tab ?? (nhom.chuY.length ? "chuY" : nhom.dang.length || !nhom.baoGia.length ? "dang" : "baoGia");
  const loiTab = tabHien === "baoGia" ? loiBaoGia : loiDon;
  const tabInfo = TAB_DON.find((t) => t.key === tabHien);
  return (
    <Card
      className={className}
      title="Đơn của bạn"
      right={<MoreLink to={tabHien === "baoGia" ? "/sales-quotations?trangThai=cho-phan-hoi" : "/sales-orders"}>{tabHien === "baoGia" ? "Tất cả báo giá" : "Tất cả đơn"}</MoreLink>}
      loading={loading}
      error={loiDon && loiBaoGia}
      onRetry={onRetry}
    >
      {/* Hẹp thì cuộn ngang (ẩn thanh cuộn); -mb-px để gạch chân tab đè lên viền dưới mà không tràn dọc */}
      <div className={cn(LE, "border-b border-[#eef1f5]")}>
        <div
          role="tablist"
          aria-label="Nhóm đơn"
          className="-mb-px flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onKeyDown={(e) => phimTab(e, TAB_DON.map((t) => t.key), tabHien, setTab, "don-tab-")}
        >
          {TAB_DON.map((t) => {
            const on = t.key === tabHien;
            const n = soTab[t.key];
            return (
              <button
                key={t.key}
                id={`don-tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="don-ds"
                tabIndex={on ? 0 : -1}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30",
                  on ? "border-bo-primary font-medium text-bo-foreground" : "border-transparent text-bo-muted hover:text-bo-foreground",
                )}
              >
                {t.ten}
                <span className={cn("text-xs font-semibold tabular-nums", t.key === "chuY" && n ? "text-[#a34a06]" : "text-bo-muted")}>{formatSo(n)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div id="don-ds" role="tabpanel" aria-labelledby={`don-tab-${tabHien}`}>
        {loiTab ? (
          <p className={cn(LE, "flex items-center justify-between gap-3 py-4 text-sm text-bo-muted")}>
            Chưa tải được danh sách này.
            <button type="button" onClick={onRetry} className={cn(FOCUS, "cursor-pointer rounded text-[13px] font-medium text-bo-primary")}>
              Thử lại
            </button>
          </p>
        ) : nhom[tabHien].length === 0 ? (
          <p className={cn(LE, "py-4 text-sm text-bo-muted")}>{tabInfo.trong}</p>
        ) : (
          <ul>
            {nhom[tabHien].map((o) => {
              const laBaoGia = tabHien === "baoGia";
              const ghiChu = laBaoGia ? guiLuc(o.ngayTao, thoiDiem) : chuYDon(o, thoiDiem);
              const canhBao = laBaoGia ? o.quaHan : Boolean(o.chuY);
              const nhan = laBaoGia ? getBaoGiaStatus(0).label : getDonBanHangStatus(o.trangThai).label;
              return (
                <li key={o.id} className={cn("border-t first:border-t-0", VIEN)}>
                  <Link to={laBaoGia ? `/sales-quotations/${o.id}` : `/sales-orders/${o.id}`} className={cn(LE, FOCUS, "flex min-h-[60px] items-center gap-3 py-2.5 transition-colors hover:bg-[#fafbfc]")}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <b className="font-semibold">{o.ma}</b> <span className="text-bo-muted">· {o.khachHang ?? "Khách lẻ"}</span>
                      </span>
                      {ghiChu ? <span className={cn("block text-xs", canhBao ? cn("font-medium", CAM) : "text-bo-muted")}>{ghiChu}</span> : null}
                      <span className="block text-xs text-bo-muted @min-[520px]:hidden">{formatTien(o.giaTri)}</span>
                    </span>
                    <span className="hidden shrink-0 text-sm tabular-nums text-bo-foreground @min-[520px]:block">{formatTien(o.giaTri)}</span>
                    {/* Rộng tối thiểu đủ nhãn dài nhất ("Đã xuất một phần" kèm vòng tiến trình) để các dòng thẳng cột và thẻ
                        không lấn sang cột giá trị; nhãn lạ dài hơn thì nới cột. Hẹp (< 520px) không còn cột giá trị nên bỏ bề
                        rộng tối thiểu để nhường chỗ cho mã · khách. */}
                    <span className="flex min-w-[144px] shrink-0 justify-end @max-[520px]:min-w-0">
                      <StatusBadge quyTrinh={laBaoGia ? "baoGiaBan" : "donBan"} label={nhan} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ---------- Bán chạy 7 ngày tại kho này: số đã bán + còn hàng ---------- */
function BanChay({ dong, className, loading, error, onRetry }) {
  const list = dong ?? [];
  return (
    <Card className={className} title="Bán chạy" scope="7 ngày, tại kho này" loading={loading} error={error} onRetry={onRetry}>
      {list.length === 0 ? (
        <p className={cn(LE, "py-6 text-sm text-bo-muted")}>Chưa bán được sản phẩm nào trong 7 ngày qua.</p>
      ) : (
        <ol>
          {list.map((r, i) => (
            <li key={r.sanPhamId} className={cn(LE, "flex items-baseline gap-3 border-t border-[#eef1f5] py-2.5 text-sm first:border-t-0")}>
              <span className="w-4 shrink-0 tabular-nums text-bo-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-bo-foreground">{r.tenSanPham}</span>
              <span className="shrink-0 text-xs tabular-nums text-bo-muted">{formatSo(r.daBan)} đã bán</span>
              <span className={cn("w-20 shrink-0 text-right text-xs", r.conLai > 0 ? "text-bo-muted" : cn("font-medium", DO))}>{r.conLai > 0 ? `Còn ${formatSo(r.conLai)}` : "Hết hàng"}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ---------- Còn hàng không? Tra ở kho làm việc theo tên / mã (gõ không dấu cũng được) ---------- */
function TraTon({ className }) {
  const [q, setQ] = useState("");
  const [kq, setKq] = useState({ q: "", ds: [], dangTai: false, loi: false });
  const [chon, setChon] = useState(null);
  const ctrlRef = useRef(null);
  const tuKhoa = q.trim();

  useEffect(() => {
    if (tuKhoa.length < 2) return undefined;
    const hen = window.setTimeout(async () => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setKq((s) => ({ ...s, dangTai: true, loi: false }));
      try {
        const res = await dashboardService.traTon(tuKhoa, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setKq({ q: tuKhoa, ds: res.data?.data ?? [], dangTai: false, loi: false });
      } catch {
        if (ctrl.signal.aborted) return;
        setKq({ q: tuKhoa, ds: [], dangTai: false, loi: true });
      }
    }, 300);
    return () => window.clearTimeout(hen);
  }, [tuKhoa]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const goiY = tuKhoa.length >= 2 && kq.q === tuKhoa ? kq.ds : [];
  const chonSanPham = (sp) => {
    setChon(sp);
    setQ("");
  };

  return (
    <Card className={className} title="Còn hàng không?" scope="tra ở nơi làm việc" scopeClassName="@max-[440px]:hidden" bodyClassName="flex flex-col">
      <div className={cn(LE, "relative pt-4")}>
        <label htmlFor="tra-ton" className="sr-only">
          Tìm sản phẩm theo tên, mã sản phẩm hoặc mã SKU
        </label>
        <Search className="pointer-events-none absolute left-8 top-[28px] size-4 text-bo-muted @max-[520px]:left-7" aria-hidden="true" />
        <input
          id="tra-ton"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && goiY.length) {
              e.preventDefault();
              chonSanPham(goiY[0]);
            }
          }}
          placeholder="Tên, mã sản phẩm hoặc mã SKU"
          autoComplete="off"
          className="h-10 w-full rounded-md border border-[#d5dbe3] bg-bo-surface pl-9 pr-9 text-sm placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/20"
        />
        <p className="sr-only" role="status" aria-live="polite">
          {tuKhoa.length >= 2 && kq.q === tuKhoa && !kq.dangTai ? (kq.loi ? "Không tra được" : `${goiY.length} sản phẩm`) : ""}
        </p>
        {kq.dangTai && tuKhoa.length >= 2 ? <Loader2 className="absolute right-8 top-[28px] size-4 animate-spin text-bo-muted @max-[520px]:right-7" aria-hidden="true" /> : null}
        {goiY.length ? (
          <ul className="mt-1 overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm" aria-label="Kết quả">
            {goiY.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => chonSanPham(p)} className={cn(FOCUS, "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#fafbfc]")}>
                  <span className="min-w-0">{p.ten}</span>
                  <span className="shrink-0 text-xs text-bo-muted">{p.ma}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : tuKhoa.length >= 2 && kq.q === tuKhoa && !kq.dangTai ? (
          <p className="mt-2 text-xs text-bo-muted">{kq.loi ? "Không tra được, vui lòng thử lại." : "Không tìm thấy sản phẩm đang bán nào."}</p>
        ) : tuKhoa.length === 1 ? (
          <p className="mt-2 text-xs text-bo-muted">Gõ ít nhất 2 ký tự.</p>
        ) : null}
      </div>
      {chon ? (
        <div className="pb-1 pt-4">
          <p className={cn(LE, "flex items-baseline justify-between gap-3 pb-2")}>
            <span className="min-w-0 text-sm font-semibold text-bo-heading">
              {chon.ten} <span className="whitespace-nowrap font-normal text-bo-muted">· {chon.ma}</span>
            </span>
            <span className="shrink-0 text-[13px] font-medium text-bo-foreground">{giaBan(chon)}</span>
          </p>
          {chon.bienThe.length ? (
            <ul>
              {chon.bienThe.map((b) => (
                <li key={b.id} className={cn(LE, "flex items-center gap-3 border-t border-[#eef1f5] py-2 text-sm")}>
                  <span className="min-w-0 flex-1">{tenBienThe(b.tenMau, b.tenKichCo) || b.maSku}</span>
                  <span className={cn("w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums", b.taiKho ? "text-bo-foreground" : DO)}>
                    {b.taiKho ? `Còn ${formatSo(b.taiKho)}` : "Hết"}
                  </span>
                  <span className="w-[150px] shrink-0 text-right text-xs leading-4 text-bo-muted @max-[440px]:w-[112px]">
                    <span className="block">{b.khoKhac ? `Kho khác còn ${formatSo(b.khoKhac)}` : "Kho khác hết"}</span>
                    {b.dangVe ? <span className="block">Đang về {formatSo(b.dangVe)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn(LE, "border-t border-[#eef1f5] py-3 text-sm text-bo-muted")}>Sản phẩm chưa có biến thể đang bán.</p>
          )}
        </div>
      ) : (
        <p className={cn(LE, "pb-4 pt-3 text-[13px] text-bo-muted")}>Chọn một sản phẩm để xem còn bao nhiêu ở kho này, kho khác và hàng đang về.</p>
      )}
    </Card>
  );
}
