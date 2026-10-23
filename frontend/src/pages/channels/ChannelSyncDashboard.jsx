import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageContainer from "@/components/backoffice/PageContainer";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import AttentionBar from "@/components/shared/AttentionBar";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import ChannelLogo from "@/components/channel/ChannelLogo";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { ChonPhuongAn, CotCaiDat } from "@/components/channel/KhuonCaiDat";
import { NUT_CHINH } from "@/components/channel/BottomActionBar";
import { ngayIso, ngayThang } from "@/components/channel/ngay";
import { daKetNoi, hanUyQuyen, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { buocGioiThieu } from "@/components/channel/noiDungSan";
import { cheDoTheoGiaTri } from "@/components/channel/cauHinhDongBo";
import useSanHienTai from "@/components/channel/useSanHienTai";
import ThanhNhacUyQuyen from "@/components/channel/ThanhNhacUyQuyen";
import NutDongBoNgay from "@/components/channel/NutDongBoNgay";
import useDongBoNgay from "@/components/channel/useDongBoNgay";
import { BUOC_THIET_LAP } from "@/constants/channel";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { cn } from "@/lib/utils";
import { formatNhanTien, formatPhanTram, formatSo, formatTien, formatTienGon, nhanDayDu, nhanTruc } from "@/pages/dashboard/admin/tong-quan/tongQuanFormat";

/** Dấu "·" ngăn các mục trên dòng phụ dưới tên gian hàng. */
function DauCach() {
  return (
    <span aria-hidden="true" className="w-4 shrink-0 text-center">
      ·
    </span>
  );
}
const MAU_KHONG_HUY = "#1677ff";
const MAU_HUY = "#c7d7ee";
const MAU_LUOI = "#eef1f5";
const MAU_CHU = "#94a3b8";
const THE = "rounded-lg border border-bo-border bg-white shadow-sm";

const KY = [
  { value: "7", soNgay: 7, label: "7 ngày" },
  { value: "30", soNgay: 30, label: "30 ngày" },
  { value: "90", soNgay: 90, label: "90 ngày" },
];
const KY_MAC_DINH = "30";

/**
 * Giờ của lần chạy gần nhất: "18:30" nếu là hôm nay, "18:30 ngày 14/10" nếu ngày khác (khác năm thì thêm năm).
 * Không dùng dấu "·" vì dòng phụ đã dùng dấu này để ngăn các mục.
 */
function lanCuoiNgan(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const gio = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const nay = new Date();
  if (d.toDateString() === nay.toDateString()) return gio;
  const nam = d.getFullYear() === nay.getFullYear() ? "" : `/${d.getFullYear()}`;
  return `${gio} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}${nam}`;
}

function moiHon(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/**
 * Tổng quan gian hàng của sàn đang mở (không có tiêu đề trang: đầu trang là gian hàng); chưa kết nối thì hiện màn giới thiệu.
 * Sàn ủy quyền (Lazada, TikTok Shop) thêm hạn ủy quyền ở dòng phụ và thanh nhắc khi sắp hết / đã hết hạn (KH mục B.5).
 */
export default function ChannelSyncDashboard() {
  useClaimPageTitle(true);
  const navigate = useNavigate();
  const SAN = useSanHienTai();
  const TIEU_DE = `Tổng quan ${SAN.ten}`;
  const uyQuyen = SAN.kieuKetNoi === "uy_quyen";
  const cfg = useTaiDuLieu(() => kenhBanHangService.getKetNoi(SAN.maKenh), `ket-noi|${SAN.maKenh}`);
  const config = cfg.data;
  const ketNoi = daKetNoi(config);
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), `cau-hinh-dong-bo|${SAN.maKenh}`, { enabled: ketNoi });
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan(SAN.maKenh), `tong-quan|${SAN.maKenh}`, { enabled: ketNoi });

  const [kyMa, setKyMa] = useTabTrenUrl(
    KY.map((k) => k.value),
    KY_MAC_DINH,
    { ten: "ky" },
  );
  const ky = KY.find((k) => k.value === kyMa) ?? KY[1];
  const den = ngayIso(0);
  const tu = ngayIso(ky.soNgay - 1);
  const tk = useTaiDuLieu(() => kenhBanHangService.getThongKeDon(SAN.maKenh, { tu, den }), `thong-ke|${SAN.maKenh}|${tu}|${den}`, {
    enabled: ketNoi,
  });

  // Đồng bộ tay chạy nền ở máy chủ; xong thì tải lại số liệu của trang. Bấm mà máy chủ báo hết hạn ủy quyền hoặc
  // gian hàng đã bị ngắt (ở tab khác, người khác) thì đọc lại kết nối để trang và menu bên trái đổi theo
  const dongBo = useDongBoNgay(SAN.maKenh, {
    enabled: ketNoi,
    onXong: () => {
      tq.reload();
      tk.reload();
    },
    onMatKetNoi: () => {
      cfg.reload();
      tq.reload();
      taiLaiKenhDaKetNoi();
    },
  });

  // Quay lại tab thì tải lại ngầm kết nối, chế độ tự động và số liệu sản phẩm (ủy quyền có thể vừa hết hạn hay vừa được làm lại)
  useTaiLaiKhiQuayLai(
    () => {
      cfg.reload();
      if (ketNoi) {
        ch.reload();
        tq.reload();
      }
    },
    { bat: !cfg.loading, lanCuoi: cfg.capNhatLuc },
  );

  if (cfg.initialLoading) {
    return (
      <PageContainer>
        <h1 className="sr-only">{TIEU_DE}</h1>
        <LoadingState label="Đang tải gian hàng" />
      </PageContainer>
    );
  }
  if (!config && cfg.error) {
    return (
      <PageContainer>
        <h1 className="sr-only">{TIEU_DE}</h1>
        <ErrorState description="Không tải được thông tin gian hàng. Vui lòng thử lại." onRetry={cfg.reload} />
      </PageContainer>
    );
  }
  if (!ketNoi) return <ManGioiThieu />;

  const cauHinh = ch.data;
  const tongQuan = tq.data;
  const thongKe = tk.data;
  const trangThai = trangThaiKetNoi(config);
  const tamDung = trangThai === "tam_dung";
  // Hạn ủy quyền của sàn ủy quyền; Shopify không có hạn
  const han = uyQuyen ? hanUyQuyen(config) : null;
  const hetHanUyQuyen = uyQuyen && trangThai === "het_han";

  const moTrang = (duongDan) => navigate(`${SAN.duongDan}${duongDan}`);
  const theoNgay = thongKe?.theoNgay ?? [];
  const homNay = theoNgay.find((n) => n.ngay === den);
  const donKhongHuy = thongKe ? Number(thongKe.tongDon || 0) - Number(thongKe.donHuy || 0) : 0;
  const lanCuoi = lanCuoiNgan(moiHon(tongQuan?.lanDayTonCuoi, tongQuan?.lanLayDonCuoi));
  const tuDongTat = cauHinh && !cauHinh.tuDongDayTon && !cauHinh.tuDongLayDon;
  // Chế độ tự động là một dòng chấm + chữ dưới tên gian hàng (không dùng thẻ trạng thái, không lặp chữ "Đang đồng bộ"
  // của nút); sự cố đã có thanh chú ý ngay bên dưới. Chưa có cấu hình (đang tải, lỗi) thì không đoán là đang bật
  const tuDong =
    trangThai === "het_han"
      ? { tone: "danger", label: uyQuyen ? "Ủy quyền đã hết hạn" : "Khóa truy cập đã hết hạn" }
      : tamDung
        ? { tone: "warning", label: "Đang tạm dừng đồng bộ" }
        : !cauHinh
          ? ch.error
            ? { tone: "neutral", label: "Không tải được chế độ tự động", thuLai: true }
            : { tone: "neutral", label: "Đang tải…" }
          : tuDongTat
            ? { tone: "neutral", label: "Tự động đồng bộ đang tắt" }
            : { tone: "success", label: cauHinh.chuKyPhut ? `Tự động mỗi ${cauHinh.chuKyPhut} phút` : "Tự động đồng bộ" };

  return (
    <PageContainer>
      <h1 className="sr-only">{TIEU_DE}</h1>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <ChannelLogo maKenh={SAN.maKenh} size={32} />
          {/* basis-56: màn hẹp không đủ chỗ cho tên đầy đủ cạnh nút thì nút xuống hàng dưới, tên không bị cắt */}
          <div className="min-w-0 flex-1 basis-56">
            <p className="truncate text-base font-semibold leading-[22px] text-bo-heading">Gian hàng {SAN.ten}</p>
            {/* Mỗi mục có dấu "·" phía trước; dòng nào bị xuống hàng thì dấu đầu dòng nằm ngoài lề âm và bị cắt */}
            <div className="overflow-hidden">
              <p className="-ml-4 flex flex-wrap items-center text-[13px] leading-5 text-bo-muted">
                {/* Chưa có tên gian hàng thì bỏ mục này ("Gian hàng <sàn>" đã là tiêu đề ngay trên) */}
                {(uyQuyen ? config.tenGianHang : config.shopDomain) ? (
                  <span className="flex min-w-0 max-w-full items-center">
                    <DauCach />
                    <span className="truncate">{uyQuyen ? config.tenGianHang : config.shopDomain}</span>
                  </span>
                ) : null}
                <span className="flex items-center">
                  <DauCach />
                  <TrangThaiCham label={tuDong.label} tone={tuDong.tone} />
                  {tuDong.thuLai ? (
                    <button
                      type="button"
                      onClick={ch.reload}
                      className="ml-1.5 rounded-sm font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:-my-3 max-sm:py-3"
                    >
                      Thử lại
                    </button>
                  ) : null}
                </span>
                {lanCuoi ? (
                  <span className="flex items-center whitespace-nowrap tabular-nums">
                    <DauCach />
                    lần gần nhất {lanCuoi}
                  </span>
                ) : null}
                {/* Sắp hết hoặc đã hết hạn thì thanh nhắc ngay dưới đã ghi ngày, không ghi lại ở đây */}
                {han && !han.hetHan && !han.sapHet ? (
                  <span className="flex items-center whitespace-nowrap tabular-nums">
                    <DauCach />
                    ủy quyền đến {ngayThang(han.han, { coNam: true })}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          {/* max-w-full: màn hẹp thì nút xuống dòng dưới tên gian hàng (ml-auto giữ bên phải), không lẹm ra ngoài */}
          <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
            <NutDongBoNgay
              tienDo={dongBo}
              tenSan={SAN.ten}
              onDen={moTrang}
              lyDoKhoa={hetHanUyQuyen ? "Ủy quyền lại trước khi đồng bộ" : null}
            />
          </div>
        </div>

        <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />
        {uyQuyen ? (
          <ThanhNhacUyQuyen san={SAN} ketNoi={config} />
        ) : (
          <AttentionBar count={trangThai === "het_han" ? 1 : 0} tone="danger" actionLabel="Cập nhật khóa" onAction={() => moTrang("/settings")}>
            Khóa truy cập đã hết hạn: hệ thống không gọi được {SAN.ten}.
          </AttentionBar>
        )}
        <AttentionBar count={tamDung ? 1 : 0} actionLabel="Mở cấu hình" onAction={() => moTrang("/settings")}>
          Đồng bộ tự động với gian hàng đang tạm dừng.
        </AttentionBar>
        <AttentionBar
          count={tongQuan && Number(tongQuan.tongSkuSan) === 0 ? 1 : 0}
          actionLabel="Liên kết sản phẩm"
          onAction={() => moTrang("/setup?buoc=4")}
        >
          Chưa có sản phẩm nào được liên kết, tồn kho và đơn hàng chưa đồng bộ được.
        </AttentionBar>

        {/* Hai cột cao bằng nhau: biểu đồ giãn theo cột phải, thẻ cuối cột phải giãn theo cột trái */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
          <section aria-labelledby="ket-qua-ban-hang" className={cn(THE, "flex flex-col")}>
            <div className="flex flex-wrap items-center gap-3 border-b border-bo-border px-4 py-3 sm:px-5">
              <h2 id="ket-qua-ban-hang" className="text-[15px] font-semibold text-bo-heading">
                Kết quả bán hàng
              </h2>
              <ChonPhuongAn label="Khoảng thời gian" value={ky.value} options={KY} onChange={setKyMa} className="ml-auto" />
            </div>
            <div className="grid grid-cols-2 border-b border-bo-border md:grid-cols-4 [&>*]:border-bo-border max-md:[&>*:nth-child(-n+2)]:border-b md:[&>*:not(:last-child)]:border-r max-md:[&>*:nth-child(odd)]:border-r">
              <ONhanSo
                nhan="Đơn hàng"
                giaTri={thongKe ? formatSo(thongKe.tongDon) : null}
                phu={homNay ? `Hôm nay ${formatSo(homNay.soDon)}` : "Hôm nay 0"}
                loi={tk.error && !thongKe}
                onClick={() => moTrang("/orders")}
              />
              <ONhanSo nhan="Doanh số" giaTri={thongKe ? formatTienGon(thongKe.doanhSo) : null} phu="Không tính đơn hủy" loi={tk.error && !thongKe} />
              <ONhanSo
                nhan="Đơn hủy"
                giaTri={thongKe ? formatSo(thongKe.donHuy) : null}
                phu={thongKe ? `${formatPhanTram(thongKe.tyLeHuy)} số đơn` : null}
                loi={tk.error && !thongKe}
                onClick={() => moTrang("/orders?trangThai=da-huy-hoan-tra")}
              />
              <ONhanSo
                nhan="Trung bình mỗi đơn"
                giaTri={thongKe ? (donKhongHuy > 0 ? formatTienGon(thongKe.doanhSo / donKhongHuy) : "—") : null}
                phu={thongKe ? `${formatSo(donKhongHuy)} đơn không hủy` : null}
                loi={tk.error && !thongKe}
              />
            </div>
            <BieuDoDon data={theoNgay} loading={tk.initialLoading} error={tk.error && !thongKe} onRetry={tk.reload} tenKy={`${ky.label} qua`} />
          </section>

          <div className="flex flex-col gap-4 [&>*:last-child]:flex-1">
            <ViecCanXuLy theoTrangThai={thongKe?.theoTrangThai} tongQuan={tongQuan} dangTai={tk.initialLoading || tq.initialLoading} onDen={moTrang} />
            <TheSanPham tongQuan={tongQuan} loi={tq.error && !tongQuan} onThuLai={tq.reload} cauHinh={uyQuyen ? cauHinh : undefined} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/** Một ô số trong dải số của thẻ Kết quả bán hàng; `giaTri = null` là đang tải. */
function ONhanSo({ nhan, giaTri, phu, onClick, loi = false }) {
  const noiDung = (
    <>
      <span className="block text-[13px] text-bo-muted">{nhan}</span>
      <span className="mt-0.5 block truncate text-[22px] font-semibold leading-8 tabular-nums tracking-tight text-bo-heading">
        {loi ? "—" : giaTri === null ? <span className="mt-1 block h-6 w-16 animate-pulse rounded bg-slate-100" aria-label="Đang tải" /> : giaTri}
      </span>
      <span className="block min-h-[18px] truncate text-[12.5px] text-bo-muted">{loi ? "Không tải được" : phu}</span>
    </>
  );
  const khung = "min-w-0 px-4 py-3.5 text-left sm:px-5";
  if (!onClick) return <div className={khung}>{noiDung}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(khung, "transition-colors hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
    >
      {noiDung}
    </button>
  );
}

/** Số đơn theo ngày, tách đơn không hủy và đơn hủy. */
function BieuDoDon({ data, loading, error, onRetry, tenKy }) {
  const SAN = useSanHienTai();
  const n = data.length;
  const diem = data.map((d, i) => ({
    ...d,
    nhan: nhanTruc(d.ngay, "ngay", n, i),
    khongHuy: Math.max(0, Number(d.soDon || 0) - Number(d.soHuy || 0)),
    huy: Number(d.soHuy || 0),
  }));
  const trong = !loading && !error && data.every((d) => !d.soDon);

  return (
    <div className="flex flex-1 flex-col px-3 pb-3 pt-4 sm:px-4">
      {loading ? (
        <Skeleton className="min-h-[240px] w-full flex-1 bg-slate-100" />
      ) : error ? (
        <div role="alert" className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-bo-muted">
          Không tải được số liệu đơn hàng.
          <button
            type="button"
            onClick={onRetry}
            className="rounded-sm font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:min-h-11 max-sm:px-3"
          >
            Thử lại
          </button>
        </div>
      ) : trong ? (
        <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-bo-muted">
          <BarChart3 className="size-5 text-slate-400" aria-hidden="true" />
          Chưa có đơn nào từ {SAN.ten} trong {tenKy}.
        </div>
      ) : (
        <>
          {/* Cao tối thiểu 240 px, giãn thêm khi cột phải cao hơn (khung tuyệt đối để không đẩy chiều cao hàng) */}
          <div className="relative min-h-[240px] flex-1" role="figure" aria-label={`Biểu đồ cột số đơn theo ngày, ${tenKy}`}>
            <KhungBieuDo className="absolute inset-0">
              <BarChart data={diem} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%" accessibilityLayer>
                <CartesianGrid vertical={false} stroke={MAU_LUOI} />
                <XAxis dataKey="nhan" tickLine={false} axisLine={false} tick={{ fill: MAU_CHU, fontSize: 12 }} interval="preserveStartEnd" minTickGap={20} tickMargin={8} />
                <YAxis tickFormatter={formatSo} tickLine={false} axisLine={false} tick={{ fill: MAU_CHU, fontSize: 12 }} width={32} allowDecimals={false} tickCount={4} />
                <Tooltip cursor={{ fill: "#f4f6f9" }} content={<GoiY />} />
                <Bar dataKey="khongHuy" stackId="don" fill={MAU_KHONG_HUY} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="huy" stackId="don" fill={MAU_HUY} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </KhungBieuDo>
          </div>
          <div className="flex gap-4 px-2 pt-1 text-[12.5px] text-bo-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#1677ff]" aria-hidden="true" />
              Đơn không hủy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#c7d7ee]" aria-hidden="true" />
              Đơn hủy
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function GoiY({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const khongHuy = Number(d.soDon || 0) - Number(d.soHuy || 0);
  return (
    <div className="min-w-44 rounded-lg bg-[#182537] px-3 py-2.5 text-xs text-white shadow-lg">
      <p className="mb-1.5 font-semibold">{nhanDayDu(d.ngay, "ngay")}</p>
      <DongGoiY nhan="Số đơn" giaTri={formatSo(d.soDon)} />
      {d.soHuy ? <DongGoiY nhan="Đơn hủy" giaTri={formatSo(d.soHuy)} /> : null}
      <DongGoiY nhan="Doanh số" giaTri={formatTien(d.doanhSo)} />
      {khongHuy > 0 ? <DongGoiY nhan="Trung bình mỗi đơn" giaTri={formatNhanTien(d.doanhSo / khongHuy)} /> : null}
    </div>
  );
}

function DongGoiY({ nhan, giaTri }) {
  return (
    <p className="flex justify-between gap-4 py-0.5">
      <span className="text-white/70">{nhan}</span>
      <span className="font-medium tabular-nums">{giaTri}</span>
    </p>
  );
}

/** Việc đang chờ ở gian hàng; chỉ dòng có việc mới nổi bật. Bấm để mở đúng tab. */
function ViecCanXuLy({ theoTrangThai, tongQuan, dangTai, onDen }) {
  const SAN = useSanHienTai();
  const don = (trangThai) => (theoTrangThai ? Number(theoTrangThai[trangThai] ?? 0) : undefined);
  const viec = [
    { ten: "Đơn nháp chờ gửi kho", so: don(0), den: "/orders?trangThai=nhap" },
    { ten: "Chờ nhặt hàng", so: don(1), den: "/orders?trangThai=cho-nhat-hang" },
    { ten: "Chờ đóng gói", so: don(7), den: "/orders?trangThai=cho-dong-goi" },
    { ten: "Chờ xuất kho", so: don(8), den: "/orders?trangThai=cho-xuat-kho" },
    // Chỉ TikTok Shop gửi yêu cầu hủy của khách (KH mục B.5); đơn được giữ lại chờ người bán duyệt trên sàn
    ...(SAN.maKenh === "TIKTOK" ? [{ ten: "Khách yêu cầu hủy", so: tongQuan?.soYeuCauHuy, den: "/orders?yeuCauHuy=1", loi: true }] : []),
    { ten: "SKU đồng bộ lỗi", so: tongQuan?.loiDongBo, den: "/products?trangThai=loi", loi: true },
    { ten: "SKU ngừng đồng bộ", so: tongQuan?.chuaLienKet, den: "/products?trangThai=ngung-dong-bo" },
  ];
  return (
    <section aria-labelledby="viec-can-xu-ly" className={THE}>
      <h2 id="viec-can-xu-ly" className="border-b border-bo-border px-4 py-3 text-[15px] font-semibold text-bo-heading sm:px-5">
        Việc cần xử lý
      </h2>
      <ul className="p-1.5">
        {viec.map((v) => {
          const coViec = Number(v.so) > 0;
          return (
            <li key={v.ten}>
              <button
                type="button"
                onClick={() => onDen(v.den)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                  coViec ? "text-bo-heading" : "text-bo-muted",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{v.ten}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    coViec ? (v.loi ? "font-semibold text-bo-danger" : "font-semibold text-bo-heading") : "text-slate-400",
                  )}
                >
                  {v.so === undefined ? (dangTai ? "…" : "—") : formatSo(v.so)}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Số SKU theo tình trạng đồng bộ (mọi dòng đều ghi đơn vị SKU). Không tải được thì báo lỗi kèm nút Thử lại.
 * `cauHinh`: có (sàn ủy quyền) thì thêm dòng "Số hiện trên <sàn>" theo cách tính đã chọn ở Cấu hình (KH mục B.5).
 */
function TheSanPham({ tongQuan, loi, onThuLai, cauHinh }) {
  const SAN = useSanHienTai();
  const dong = [
    { nhan: "Đang đồng bộ", so: tongQuan?.daLienKet, tone: "success" },
    { nhan: "Ngừng đồng bộ", so: tongQuan?.chuaLienKet, tone: "warning" },
    { nhan: "Lỗi", so: tongQuan?.loiDongBo, tone: "danger" },
  ];
  return (
    <section aria-labelledby="the-san-pham" className={THE}>
      <div className="flex items-center border-b border-bo-border px-4 py-3 sm:px-5">
        <h2 id="the-san-pham" className="text-[15px] font-semibold text-bo-heading">
          Sản phẩm
        </h2>
        {/* Điện thoại: vùng chạm 44 px bằng đệm + lề âm, chữ không xê dịch */}
        <Link
          to={`${SAN.duongDan}/products`}
          className="ml-auto text-sm font-medium text-bo-primary hover:text-bo-primary-hover hover:underline max-sm:-my-3 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
        >
          Xem tất cả
        </Link>
      </div>
      {loi ? (
        <p role="alert" className="flex flex-wrap items-baseline gap-x-2 px-4 pt-3.5 text-sm text-bo-muted sm:px-5">
          Không tải được số liệu sản phẩm.
          <button
            type="button"
            onClick={onThuLai}
            className="rounded-sm font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:-my-3 max-sm:py-3"
          >
            Thử lại
          </button>
        </p>
      ) : null}
      <dl className={cn("space-y-2 px-4 py-3.5 text-sm sm:px-5", loi && !cauHinh && "hidden")}>
        {loi
          ? null
          : dong.map((d) => {
              const co = Number(d.so) > 0;
              return (
                <div key={d.nhan} className="flex items-center justify-between gap-3">
                  <dt>
                    <TrangThaiCham label={d.nhan} tone={co ? (d.tone === "danger" ? "neutral" : d.tone) : "neutral"} />
                  </dt>
                  <dd className={cn("tabular-nums", co ? (d.tone === "danger" ? "font-semibold text-bo-danger" : "font-semibold text-bo-heading") : "text-bo-muted")}>
                    {d.so === undefined ? "…" : `${formatSo(d.so)} SKU`}
                  </dd>
                </div>
              );
            })}
        {cauHinh ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#eef1f5] pt-2">
            <dt className="text-[13px] text-bo-muted">Số hiện trên {SAN.ten}</dt>
            <dd className="text-[13px] text-bo-foreground">{cheDoTheoGiaTri(cauHinh) === "bang" ? "Bằng số khả dụng" : "Tùy chỉnh"}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/**
 * Gian hàng chưa kết nối: giới thiệu 4 bước và nút bắt đầu. Sàn ủy quyền dùng câu của KH mục B.5
 * ("Kết nối <sàn> trong 4 bước", bước 1 là ủy quyền gian hàng).
 */
function ManGioiThieu() {
  const SAN = useSanHienTai();
  const uyQuyen = SAN.kieuKetNoi === "uy_quyen";
  const dsBuoc = uyQuyen ? buocGioiThieu(SAN.ten) : BUOC_THIET_LAP;
  return (
    <PageContainer>
      <h1 className="sr-only">Tổng quan {SAN.ten}</h1>
      <CotCaiDat className="pt-2">
        <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />
        <section className={cn(THE, "p-5 sm:p-6")}>
          <div className="flex items-center gap-3.5">
            <ChannelLogo maKenh={SAN.maKenh} size={40} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-bo-heading">{uyQuyen ? `Kết nối ${SAN.ten} trong 4 bước` : `Kết nối gian hàng ${SAN.ten}`}</h2>
              <p className="text-[13px] text-bo-muted">
                {uyQuyen
                  ? `Tồn kho FCentric sẽ tự cập nhật lên gian hàng, đơn đặt trên ${SAN.ten} sẽ về kho để nhặt hàng, đóng gói và xuất kho.`
                  : `Đẩy tồn kho lên ${SAN.ten} và nhận đơn về để kho xử lý.`}
              </p>
            </div>
          </div>
          {/* Màn rộng: 4 bước nằm một hàng cho cân ngang; màn hẹp: xếp dọc */}
          <ol className="mt-5 grid divide-y divide-[#eef1f5] rounded-lg border border-bo-border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {dsBuoc.map((buoc) => (
              <li key={buoc.so} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-[26px] shrink-0 place-items-center rounded-full border border-slate-300 text-[13px] font-semibold tabular-nums text-slate-500">
                  {buoc.so}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-bo-heading">{buoc.ten}</span>
                  <span className="block text-[13px] text-bo-muted">{buoc.moTa}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild className={NUT_CHINH}>
              <Link to={`${SAN.duongDan}/setup`}>
                {uyQuyen ? "Bắt đầu kết nối" : "Bắt đầu thiết lập"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-[13px] text-bo-muted">Mỗi bước lưu ngay, dừng giữa chừng được.</p>
          </div>
        </section>
      </CotCaiDat>
    </PageContainer>
  );
}
