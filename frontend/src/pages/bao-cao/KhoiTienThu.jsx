import { Card } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { t } from "@/i18n";

/** Màu hai cách thu (cùng sắc xanh hệ thống, khác độ đậm để phân biệt được cả khi không thấy màu). */
const MAU_TIEN_MAT = "#0b4fb3";
const MAU_CHUYEN_KHOAN = "#69b1ff";

function Dong({ mau, ten, phu, so, am = false }) {
  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 border-b border-[#eef1f5] py-2.5 last:border-b-0">
      {mau ? <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ background: mau }} /> : <span />}
      <dt className="font-medium text-bo-foreground">{ten}</dt>
      <dd className={`m-0 font-semibold tabular-nums ${am ? "text-bo-danger" : "text-bo-foreground"}`}>{so}</dd>
      {phu ? <><span /><span className="col-span-2 text-xs text-bo-muted">{phu}</span></> : null}
    </div>
  );
}

/**
 * Thẻ "Tiền thu trong kỳ" của Báo cáo doanh thu (máy chủ: /admin/dashboard/bao-cao/tien-thu): tiền thu tại quầy (tiền mặt,
 * chuyển khoản QR payOS), tiền hoàn khi nhận trả hàng tại quầy và sàn thu hộ. Tính theo ngày thu tiền nên khác doanh thu
 * (theo ngày giao hàng) là bình thường. Tải riêng: lỗi ở đây không chặn phần doanh thu.
 * anGhiChuKho: trang đã ghi tên cửa hàng của người xem (nhân viên bán hàng một cửa hàng) nên bỏ dòng "Chỉ tính nơi làm việc…".
 */
export default function KhoiTienThu({ tienThu, loi, loading, onTaiLai, className, anGhiChuKho = false }) {
  const tt = tienThu;
  const tm = Number(tt?.tienMat) || 0;
  const ck = Number(tt?.chuyenKhoan) || 0;
  const tong = tm + ck;
  const phanTm = tong > 0 ? Math.round((tm / tong) * 100) : 0;
  return (
    <Card
      bodyClassName="px-5 py-4 @max-[520px]:px-4"
      className={className}
      error={Boolean(loi)}
      loading={loading && !tt}
      onRetry={onTaiLai}
      scope={t("theo ngày thu")}
      title={t("Tiền thu trong kỳ")}
    >
      {tt ? (
        <div className="flex flex-col gap-3.5 text-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-xs text-bo-muted">
              <span>{t("Đã thu {{tong}}", { tong: formatCurrency(tong) })}</span>
              {tong > 0 ? <span>{t("{{phanTm}}% tiền mặt", { phanTm })}</span> : null}
            </div>
            <div aria-hidden="true" className="flex h-2 overflow-hidden rounded bg-[#eef1f5]">
              <div style={{ width: `${phanTm}%`, background: MAU_TIEN_MAT }} />
              <div style={{ width: `${tong > 0 ? 100 - phanTm : 0}%`, background: MAU_CHUYEN_KHOAN }} />
            </div>
          </div>
          <dl className="m-0 flex flex-col">
            <Dong mau={MAU_TIEN_MAT} phu={t("Tại quầy, gồm phần khách trả trước khi quét QR")} so={formatCurrency(tm)} ten={t("Tiền mặt")} />
            <Dong mau={MAU_CHUYEN_KHOAN} phu={t("QR payOS tại quầy")} so={formatCurrency(ck)} ten={t("Chuyển khoản")} />
            <Dong am={Number(tt.hoan) > 0} phu={t("{{soPhieuHoan}} phiếu trả hàng tại quầy", { soPhieuHoan: formatNumber(tt.soPhieuHoan), count: Number(tt.soPhieuHoan) })} so={Number(tt.hoan) > 0 ? `−${formatCurrency(tt.hoan)}` : formatCurrency(0)} ten={t("Hoàn tiền")} />
            <Dong phu={t("{{soDonSan}} đơn sàn đã giao · đối soát với sàn", { soDonSan: formatNumber(tt.soDonSan), count: Number(tt.soDonSan) })} so={formatCurrency(tt.sanThuHo)} ten={t("Sàn thu hộ")} />
          </dl>
          {tt.theoKhoPhuTrach && !anGhiChuKho ? <p className="m-0 text-xs text-bo-muted">{t("Chỉ tính nơi làm việc của bạn.")}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
