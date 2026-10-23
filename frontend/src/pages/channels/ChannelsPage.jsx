import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import StatusBadge from "@/components/shared/StatusBadge";
import { ngayThang } from "@/components/channel/ngay";
import { conLaiUyQuyen, daKetNoi, hanUyQuyen, nhanTrangThaiKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { SAN_BAN_HANG } from "@/constants/channel";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/dateTime";

const soVN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("vi-VN"));
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
/** Ô của bảng; dưới sm mỗi dòng là một thẻ có lề riêng nên ô bỏ lề. */
const TD = "px-3 py-3 max-sm:p-0";
/** Dưới sm: ô trạng thái / số liệu thành một dòng "nhãn … giá trị" rộng hết thẻ. */
const DONG_THE = "max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-3 max-sm:text-right";
const NHAN_THE = "shrink-0 text-left text-[13px] text-bo-muted sm:hidden";
const NUT = "h-8 rounded-lg px-3 text-[13px] max-sm:h-11 max-sm:w-full";
const NUT_PHU = cn(NUT, "border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle");
const NUT_CHINH = cn(NUT, "bg-bo-primary text-white hover:bg-bo-primary-hover");
const XUONG = "bg-slate-100";

function moiHon(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** Dấu "·" ngăn các mục trên dòng phụ dưới tên sàn. */
function DauCach() {
  return (
    <span aria-hidden="true" className="w-3 shrink-0 text-center">
      ·
    </span>
  );
}

/**
 * Danh sách gian hàng: mỗi sàn một dòng (KH mục B.2), bấm để mở trang quản lý của sàn hoặc bắt đầu kết nối.
 * Từ sm là bảng cột cố định (khung hẹp hơn bảng thì cuộn trong khung); dưới sm mỗi sàn một thẻ, không cuộn ngang.
 */
export default function ChannelsPage() {
  return (
    <PageContainer>
      <ListPageHeader title="Kênh bán hàng" />
      <div className="mt-4 space-y-4">
        <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />
        <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
          <div className="w-full sm:overflow-x-auto">
            <table className="w-full text-sm max-sm:block sm:min-w-[960px] sm:table-fixed">
              <colgroup className="max-sm:hidden">
                <col />
                <col className="w-[176px]" />
                <col className="w-[212px]" />
                <col className="w-[148px]" />
                <col className="w-[152px]" />
                <col className="w-[100px]" />
              </colgroup>
              <thead className="max-sm:hidden">
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className={`${TH} text-left`}>Gian hàng</th>
                  <th className={`${TH} text-left`}>Trạng thái</th>
                  <th className={`${TH} text-left`}>Đồng bộ tự động</th>
                  <th className={`${TH} text-right`}>SKU đang đồng bộ</th>
                  <th className={`${TH} text-left`}>Lần chạy gần nhất</th>
                  <th className={TH}>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border max-sm:block">
                {SAN_BAN_HANG.filter((san) => san.hoTro).map((san) => (
                  <DongSan key={san.maKenh} san={san} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/**
 * Một dòng sàn: tự tải kết nối, cấu hình đồng bộ và số liệu của sàn. Không tải được kết nối thì dòng có nút Thử lại;
 * không tải được cấu hình hay số liệu thì ô đó báo lỗi kèm nút thử lại riêng phần đó.
 */
function DongSan({ san }) {
  const navigate = useNavigate();
  const kn = useTaiDuLieu(() => kenhBanHangService.getKetNoi(san.maKenh), `ket-noi|${san.maKenh}`);
  const ketNoi = daKetNoi(kn.data);
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(san.maKenh), `cau-hinh-dong-bo|${san.maKenh}`, { enabled: ketNoi });
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan(san.maKenh), `tong-quan|${san.maKenh}`, { enabled: ketNoi });
  // Quay lại tab thì tải lại ngầm trạng thái kết nối và lần đồng bộ gần nhất
  useTaiLaiKhiQuayLai(
    () => {
      kn.reload();
      if (ketNoi) {
        ch.reload();
        tq.reload();
      }
    },
    { bat: !kn.loading, lanCuoi: kn.capNhatLuc },
  );

  const loiTai = !kn.data && Boolean(kn.error);
  // Lần đầu vào trang: cả dòng là khung xương tới khi có đủ kết nối, cấu hình và số liệu (hoặc biết là lỗi), để không
  // hiện nút "Kết nối" cho gian hàng đã kết nối rồi mới đổi thành "Mở", cũng không điền dần từng cột từ "—"
  const dangTai = kn.initialLoading || (ketNoi && (ch.initialLoading || tq.initialLoading));
  const chuaKetNoi = !kn.initialLoading && !loiTai && !ketNoi;
  // Chưa biết đã kết nối chưa (đang tải, lỗi) thì bấm dòng mở Tổng quan: trang đó tự tải và có màn giới thiệu khi chưa kết nối
  const duongDan = chuaKetNoi ? `${san.duongDan}/setup` : san.duongDan;
  const trangThai = trangThaiKetNoi(kn.data);
  const cauHinh = ch.data;
  const tongQuan = tq.data;
  const loiCauHinh = ketNoi && !cauHinh && Boolean(ch.error);
  const loiTongQuan = ketNoi && !tongQuan && Boolean(tq.error);
  const lanCuoi = ketNoi ? formatDateTime(moiHon(tongQuan?.lanDayTonCuoi, tongQuan?.lanLayDonCuoi), { withYear: false }) : null;
  // Thẻ (dưới sm) của gian hàng chưa kết nối hoặc không tải được: bỏ ba dòng số liệu toàn "—"
  const anSoLieuTrenThe = !dangTai && !ketNoi;

  // Dòng phụ: Shopify ghi tên miền; sàn ủy quyền ghi tên gian hàng và hạn ủy quyền (kèm năm). Chưa kết nối thì không có
  // dòng phụ vì thẻ trạng thái của sàn đã ghi "Chưa kết nối"
  let dongPhu = null;
  if (dangTai) {
    dongPhu = (
      <>
        <Skeleton className={cn("mt-1 h-3.5 w-32", XUONG)} />
        <span className="sr-only">Đang tải…</span>
      </>
    );
  } else if (loiTai) {
    dongPhu = <p className="text-[13px] text-bo-danger">Không tải được gian hàng</p>;
  } else if (ketNoi && san.kieuKetNoi === "khoa") {
    dongPhu = (
      <p className="truncate text-[13px] text-bo-muted" title={kn.data?.shopDomain || undefined}>
        {kn.data?.shopDomain || "—"}
      </p>
    );
  } else if (ketNoi) {
    const ten = kn.data?.tenGianHang;
    // Hết hạn thì thẻ trạng thái của sàn đã ghi "Hết hạn ủy quyền": không ghi ngày ở đây
    const han = hanUyQuyen(kn.data);
    const coHan = Boolean(han) && !han.hetHan;
    dongPhu =
      ten || coHan ? (
        // Mỗi mục có dấu "·" phía trước; hàng nào bị xuống dòng thì dấu đầu hàng nằm ngoài lề âm và bị cắt
        <div className="overflow-hidden">
          <p className="-ml-3 flex flex-wrap items-start text-[13px] leading-5 text-bo-muted">
            {ten ? (
              <span className="flex min-w-0 max-w-full">
                <DauCach />
                <span className="truncate" title={ten}>
                  {ten}
                </span>
              </span>
            ) : null}
            {coHan ? (
              <span className="flex min-w-0 max-w-full">
                <DauCach />
                <span className="tabular-nums">
                  ủy quyền đến <span className="whitespace-nowrap">{ngayThang(han.han, { coNam: true })}</span>
                  {han.sapHet ? (
                    <>
                      {" "}
                      <span className="whitespace-nowrap font-medium text-bo-warning">({conLaiUyQuyen(han)})</span>
                    </>
                  ) : null}
                </span>
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-bo-muted">—</p>
      );
  }

  // Hết hạn: tự động không chạy được dù cấu hình đang bật. Tạm dừng: thẻ trạng thái "Tạm dừng" đã nói, ô này để trống
  let tuDong = "—";
  if (ketNoi && trangThai === "het_han") tuDong = "Đang dừng";
  else if (ketNoi && trangThai === "tam_dung") tuDong = "—";
  else if (loiCauHinh) tuDong = <LoiTai onThuLai={ch.reload} />;
  else if (ketNoi && cauHinh) {
    const viec = [cauHinh.tuDongDayTon ? "tồn kho" : null, cauHinh.tuDongLayDon ? "đơn hàng" : null].filter(Boolean);
    tuDong = viec.length ? (
      <span>
        {viec.join(", ").replace(/^./, (c) => c.toUpperCase())}
        {cauHinh.chuKyPhut ? (
          <>
            {/* Dấu "·" đi cùng cụm sau: xuống dòng thì không treo ở cuối dòng trên */}{" "}
            <span className="whitespace-nowrap">· mỗi {cauHinh.chuKyPhut} phút</span>
          </>
        ) : null}
      </span>
    ) : (
      "Đang tắt"
    );
  }

  let soSku = "—";
  if (loiTongQuan) soSku = <LoiTai onThuLai={tq.reload} />;
  else if (ketNoi) {
    soSku = (
      <span>
        {soVN(tongQuan?.daLienKet)}
        {Number(tongQuan?.loiDongBo) > 0 ? (
          <span className="ml-1.5 whitespace-nowrap text-[13px] text-bo-danger">· {soVN(tongQuan.loiDongBo)} lỗi</span>
        ) : null}
      </span>
    );
  }

  return (
    <tr
      onClick={() => navigate(duongDan)}
      aria-busy={dangTai || undefined}
      className="cursor-pointer transition-colors hover:bg-bo-surface-subtle max-sm:flex max-sm:flex-col max-sm:gap-2.5 max-sm:p-4"
    >
      <td className={TD}>
        <div className="flex items-center gap-3">
          <ChannelLogo maKenh={san.maKenh} size={28} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-bo-heading">{san.ten}</p>
            {dongPhu}
          </div>
        </div>
      </td>
      <td className={cn(TD, DONG_THE, "max-sm:items-center max-sm:border-t max-sm:border-[#eef1f5] max-sm:pt-3", loiTai && "max-sm:hidden")}>
        <span className={NHAN_THE}>Trạng thái</span>
        {dangTai ? (
          <Skeleton className={cn("h-6 w-28 rounded-md", XUONG)} />
        ) : loiTai ? (
          <span className="text-bo-muted">—</span>
        ) : (
          <StatusBadge label={nhanTrangThaiKetNoi(trangThai, san.kieuKetNoi)} />
        )}
      </td>
      <td className={cn(TD, DONG_THE, "text-bo-foreground", anSoLieuTrenThe && "max-sm:hidden")}>
        <span className={NHAN_THE}>Đồng bộ tự động</span>
        {dangTai ? <Skeleton className={cn("h-4 w-40 max-sm:w-28", XUONG)} /> : tuDong}
      </td>
      <td className={cn(TD, DONG_THE, "text-right tabular-nums text-bo-foreground", anSoLieuTrenThe && "max-sm:hidden")}>
        <span className={NHAN_THE}>SKU đang đồng bộ</span>
        {dangTai ? <Skeleton className={cn("ml-auto h-4 w-14", XUONG)} /> : soSku}
      </td>
      <td className={cn(TD, DONG_THE, "tabular-nums text-bo-muted max-sm:text-bo-foreground", anSoLieuTrenThe && "max-sm:hidden")}>
        <span className={NHAN_THE}>Lần chạy gần nhất</span>
        {dangTai ? <Skeleton className={cn("h-4 w-24", XUONG)} /> : lanCuoi || "—"}
      </td>
      <td className={cn(TD, "whitespace-nowrap text-right max-sm:pt-1")}>
        {dangTai ? (
          <Skeleton className={cn("ml-auto h-8 w-16 rounded-lg max-sm:h-11 max-sm:w-full", XUONG)} />
        ) : loiTai ? (
          <Button
            type="button"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              kn.reload();
            }}
            className={NUT_PHU}
          >
            Thử lại
          </Button>
        ) : (
          <Button asChild variant={ketNoi ? "outline" : "default"} className={ketNoi ? NUT_PHU : NUT_CHINH}>
            <Link to={duongDan} onClick={(event) => event.stopPropagation()}>
              {ketNoi ? "Mở" : "Kết nối"}
            </Link>
          </Button>
        )}
      </td>
    </tr>
  );
}

/** Một phần số liệu của dòng không tải được: báo ngay tại ô, kèm nút tải lại riêng phần đó. */
function LoiTai({ onThuLai }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
      <span className="text-bo-danger">Không tải được</span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onThuLai();
        }}
        className="rounded-sm font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:-my-3 max-sm:py-3"
      >
        Thử lại
      </button>
    </span>
  );
}
