import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import StatusBadge from "@/components/shared/StatusBadge";
import { daKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiShopify";
import { CONNECTION_STATUS, SAN_BAN_HANG } from "@/constants/channel";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { formatDateTime } from "@/utils/dateTime";

const soVN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("vi-VN"));
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const SAN_CHUA_HO_TRO = SAN_BAN_HANG.filter((s) => !s.hoTro).map((s) => s.ten);

function moiHon(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** Danh sách gian hàng đã có: mỗi gian hàng một dòng, bấm để mở trang quản lý của sàn. Sàn chưa hỗ trợ ghi ở chân bảng. */
export default function ChannelsPage() {
  const navigate = useNavigate();
  const cfg = useTaiDuLieu(() => kenhBanHangService.getShopifyConfig(), "cau-hinh-shopify");
  const ketNoi = daKetNoi(cfg.data);
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo("SHOPIFY"), "cau-hinh-dong-bo", { enabled: ketNoi });
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan("SHOPIFY"), "tong-quan", { enabled: ketNoi });
  const san = SAN_BAN_HANG.find((s) => s.maKenh === "SHOPIFY");
  const duongDan = ketNoi ? san.duongDan : `${san.duongDan}/setup`;
  const trangThai = trangThaiKetNoi(cfg.data);
  const meta = CONNECTION_STATUS[trangThai] ?? CONNECTION_STATUS.chua_ket_noi;
  const cauHinh = ch.data;
  const viecTuDong = cauHinh
    ? [cauHinh.tuDongDayTon ? "tồn kho" : null, cauHinh.tuDongLayDon ? "đơn hàng" : null].filter(Boolean)
    : [];
  const lanCuoi = moiHon(tq.data?.lanDayTonCuoi, tq.data?.lanLayDonCuoi);

  return (
    <PageContainer>
      <ListPageHeader title="Kênh bán hàng" />
      <div className="mt-4 space-y-4">
        <MockModeNotice show={isChannelMock} />
        <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className={`${TH} text-left`}>Gian hàng</th>
                  <th className={`${TH} text-left`}>Trạng thái</th>
                  <th className={`${TH} text-left`}>Đồng bộ tự động</th>
                  <th className={`${TH} text-right`}>SKU đang đồng bộ</th>
                  <th className={`${TH} text-left`}>Lần chạy gần nhất</th>
                  <th className={`${TH} w-px`}>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr onClick={() => navigate(duongDan)} className="cursor-pointer transition-colors hover:bg-bo-surface-subtle">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <ChannelLogo maKenh={san.maKenh} size={28} />
                      <div className="min-w-0">
                        <p className="font-medium text-bo-heading">{san.ten}</p>
                        <p className="truncate text-[13px] text-bo-muted">
                          {cfg.initialLoading ? "Đang tải…" : !cfg.data && cfg.error ? "Không tải được gian hàng" : cfg.data?.shopDomain || "Chưa kết nối"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {cfg.initialLoading || (!cfg.data && cfg.error) ? (
                      <span className="text-bo-muted">—</span>
                    ) : (
                      <StatusBadge label={meta.label} />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-bo-foreground">
                    {!ketNoi || !cauHinh
                      ? "—"
                      : viecTuDong.length
                        ? `${viecTuDong.join(", ").replace(/^./, (c) => c.toUpperCase())} · mỗi ${cauHinh.chuKyPhut ?? "—"} phút`
                        : "Đang tắt"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-bo-foreground">
                    {ketNoi ? soVN(tq.data?.daLienKet) : "—"}
                    {ketNoi && Number(tq.data?.loiDongBo) > 0 ? (
                      <span className="ml-1.5 text-[13px] text-bo-danger">· {soVN(tq.data.loiDongBo)} lỗi</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-bo-muted">{ketNoi ? formatDateTime(lanCuoi, { withYear: false }) || "—" : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {!cfg.data && cfg.error ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          cfg.reload();
                        }}
                        className="h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle"
                      >
                        Thử lại
                      </Button>
                    ) : (
                      <Button
                        asChild
                        variant={ketNoi ? "outline" : "default"}
                        className={
                          ketNoi
                            ? "h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle"
                            : "h-8 rounded-lg bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover"
                        }
                      >
                        <Link to={duongDan} onClick={(event) => event.stopPropagation()}>
                          {ketNoi ? "Mở" : "Kết nối"}
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {SAN_CHUA_HO_TRO.length ? (
            <p className="border-t border-bo-border px-4 py-3 text-[13px] text-bo-muted">{SAN_CHUA_HO_TRO.join(" và ")}: sắp hỗ trợ.</p>
          ) : null}
        </section>
      </div>
    </PageContainer>
  );
}
