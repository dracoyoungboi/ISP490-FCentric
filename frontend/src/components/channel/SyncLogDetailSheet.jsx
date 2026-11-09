import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnhSanPham } from "@/components/channel/HienThiKenh";
import StatusBadge from "@/components/shared/StatusBadge";
import { LIEN_KET_STATUS, tinhSoTonDayLenSan } from "@/constants/channel";
import { formatCurrency, formatNumberOrDash } from "@/utils/formatters";
import { formatDateTime } from "@/utils/dateTime";
import { t } from "@/i18n";

function Nhom({ ten, children }) {
  return (
    <div className="pt-3">
      <p className="pb-1 text-[12.5px] font-semibold text-bo-muted">{ten}</p>
      <dl>{children}</dl>
    </div>
  );
}

function Dong({ nhan, children }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 border-b border-[#eef1f5] py-2 text-sm last:border-b-0">
      <dt className="text-bo-muted">{nhan}</dt>
      <dd className="min-w-0 break-words text-bo-foreground">{children}</dd>
    </div>
  );
}

/**
 * Ngăn chi tiết một SKU đã ghép với sàn (mở khi bấm một dòng ở trang Sản phẩm), thông tin chia nhóm:
 * Liên kết, Tồn kho, Giá. `dangXuLy`: tên thao tác đang chạy ("thu-lai" | "bat-tat") để khóa nút.
 */
export default function SyncLogDetailSheet({ lienKet, open, onOpenChange, quyTac, duongDanCauHinh, tenSan = "Shopify", dangXuLy, onThuLai, onDoiBienThe, onBatTat }) {
  const trangThai = lienKet?.trangThaiLienKet;
  const dangDongBo = trangThai !== "chua_lien_ket";
  const meta = LIEN_KET_STATUS[trangThai] ?? { label: trangThai ? `Không xác định (mã ${trangThai})` : "Chưa có trạng thái" }; // i18n-giu-nguyen: nhãn đưa vào StatusBadge, thẻ tự dịch
  const khoa = Boolean(dangXuLy);
  const nutPhu = "h-9 gap-2 rounded-lg border-bo-border bg-white px-3.5 text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-bo-border bg-bo-surface p-0 sm:max-w-[420px]">
        {lienKet ? (
          <>
            <SheetHeader className="flex-row items-start gap-3 space-y-0 border-b border-bo-border px-5 py-4 text-left">
              <AnhSanPham src={lienKet.anhDaiDien} size={40} />
              <div className="min-w-0 flex-1 pr-6">
                <SheetTitle className="text-base font-semibold leading-snug text-bo-heading">
                  {lienKet.tenSanPham || lienKet.tenSanPhamSan || lienKet.maSku || t("Sản phẩm")}
                </SheetTitle>
                <SheetDescription className="text-[13px] text-bo-muted">{lienKet.tenBienThe || lienKet.tenBienTheSan || "—"}</SheetDescription>
                <div className="mt-1.5">
                  <StatusBadge label={meta.label} />
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {trangThai === "loi" ? (
                <p role="alert" className="mt-4 rounded-lg bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger">
                  {lienKet.chiTietLoi || t("Không đẩy được tồn kho lên sàn.")}
                </p>
              ) : null}
              <Nhom ten={t("Liên kết")}>
                <Dong nhan="SKU FCentric">{lienKet.maSku || "—"}</Dong>
                <Dong nhan={t("Mã trên {{tenSan}}", { tenSan })}>
                  <span className="tabular-nums">{lienKet.skuSan || "—"}</span>
                </Dong>
                <Dong nhan={t("Đồng bộ gần nhất")}>{formatDateTime(lienKet.ngayDongBoCuoi) || "—"}</Dong>
              </Nhom>
              <Nhom ten={t("Tồn kho")}>
                <Dong nhan={t("Khả dụng ở FCentric")}>
                  <span className="tabular-nums">{formatNumberOrDash(lienKet.soLuongKhaDung)}</span>
                </Dong>
                <Dong nhan={t("Đã đẩy lên {{tenSan}}", { tenSan })}>
                  {lienKet.soLuongDaDay !== null && lienKet.soLuongDaDay !== undefined ? (
                    <>
                      <span className="tabular-nums">{formatNumberOrDash(lienKet.soLuongDaDay)}</span>
                      {lienKet.ngayDayTonCuoi ? <span className="text-bo-muted"> {t("· lúc {{ngayDayTonCuoi}}", { ngayDayTonCuoi: formatDateTime(lienKet.ngayDayTonCuoi) })}</span> : null}
                    </>
                  ) : (
                    t("Chưa đẩy")
                  )}
                </Dong>
                <Dong nhan={t("Lần đẩy tới")}>
                  {dangDongBo && quyTac ? <span className="tabular-nums">{formatNumberOrDash(tinhSoTonDayLenSan(lienKet.soLuongKhaDung, quyTac))}</span> : t("Không cập nhật")}
                </Dong>
                {quyTac ? (
                  <Dong nhan={t("Quy tắc")}>
                    {t("{{tyLeDayTon}}% · giữ lại {{tonDem}} · ngưỡng {{nguongVe0}}", { tyLeDayTon: quyTac.tyLeDayTon, tonDem: formatNumberOrDash(quyTac.tonDem), nguongVe0: formatNumberOrDash(quyTac.nguongVe0) })}
                    {duongDanCauHinh ? (
                      <Link to={duongDanCauHinh} className="ml-2 font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">
                        {t("Sửa")}
                      </Link>
                    ) : null}
                  </Dong>
                ) : null}
              </Nhom>
              <Nhom ten={t("Giá")}>
                <Dong nhan={t("Giá bán FCentric")}>{lienKet.giaBan != null ? formatCurrency(lienKet.giaBan) : "—"}</Dong>
                <Dong nhan={t("Giá trên {{tenSan}}", { tenSan })}>{lienKet.giaBanSan != null ? formatCurrency(lienKet.giaBanSan) : "—"}</Dong>
                {lienKet.giaBan != null && lienKet.giaBanSan != null && Number(lienKet.giaBan) !== Number(lienKet.giaBanSan) ? (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    {t("⚠️ Giá bán giữa FCentric và {{tenSan}} đang có sự chênh lệch (Lệch giá sàn)", { tenSan })}
                  </p>
                ) : null}
              </Nhom>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-bo-border px-5 py-3">
              <Button type="button" variant="outline" disabled={khoa} onClick={onDoiBienThe} className={nutPhu}>
                {t("Ghép biến thể khác")}
              </Button>
              {trangThai === "loi" ? (
                <Button type="button" variant="outline" disabled={khoa} onClick={onThuLai} className={nutPhu}>
                  {dangXuLy === "thu-lai" ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("Thử lại")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={khoa || (!dangDongBo && !lienKet.bienTheSanPhamId)} onClick={onBatTat} className={nutPhu}>
                {dangXuLy === "bat-tat" ? <Loader2 className="size-4 animate-spin" /> : null}
                {dangDongBo ? t("Ngừng đồng bộ", { context: "nut" }) : t("Bật đồng bộ")}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
