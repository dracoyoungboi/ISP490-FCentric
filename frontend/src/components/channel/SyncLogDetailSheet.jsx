import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnhSanPham, TrangThaiCham } from "@/components/channel/HienThiKenh";
import { LIEN_KET_STATUS, tinhSoTonDayLenSan } from "@/constants/channel";
import { formatCurrency } from "@/utils/formatters";
import { formatDateTime } from "@/utils/dateTime";

const soVN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("vi-VN"));

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
  const meta = LIEN_KET_STATUS[trangThai] ?? { label: trangThai || "—", tone: "neutral" };
  const khoa = Boolean(dangXuLy);
  const nutPhu = "h-9 gap-2 rounded-lg border-bo-border bg-white px-3.5 text-bo-foreground hover:bg-bo-surface-subtle";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-bo-border bg-white p-0 sm:max-w-[420px]">
        {lienKet ? (
          <>
            <SheetHeader className="flex-row items-start gap-3 space-y-0 border-b border-bo-border px-5 py-4 text-left">
              <AnhSanPham src={lienKet.anhDaiDien} size={40} />
              <div className="min-w-0 flex-1 pr-6">
                <SheetTitle className="text-base font-semibold leading-snug text-bo-heading">
                  {lienKet.tenSanPham || lienKet.tenSanPhamSan || lienKet.maSku || "Sản phẩm"}
                </SheetTitle>
                <SheetDescription className="text-[13px] text-bo-muted">{lienKet.tenBienThe || lienKet.tenBienTheSan || "—"}</SheetDescription>
                <div className="mt-1.5">
                  <TrangThaiCham label={meta.label} tone={meta.tone} />
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {trangThai === "loi" ? (
                <p role="alert" className="mt-4 rounded-lg bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger">
                  {lienKet.chiTietLoi || "Không đẩy được tồn kho lên sàn."}
                </p>
              ) : null}
              <Nhom ten="Liên kết">
                <Dong nhan="SKU FCentric">{lienKet.maSku || "—"}</Dong>
                <Dong nhan={`Mã trên ${tenSan}`}>
                  <span className="tabular-nums">{lienKet.skuSan || "—"}</span>
                </Dong>
                <Dong nhan="Đồng bộ gần nhất">{formatDateTime(lienKet.ngayDongBoCuoi) || "—"}</Dong>
              </Nhom>
              <Nhom ten="Tồn kho">
                <Dong nhan="Khả dụng ở FCentric">
                  <span className="tabular-nums">{soVN(lienKet.soLuongKhaDung)}</span>
                </Dong>
                <Dong nhan={`Hiện trên ${tenSan}`}>
                  {dangDongBo && quyTac ? <span className="tabular-nums">{soVN(tinhSoTonDayLenSan(lienKet.soLuongKhaDung, quyTac))}</span> : "Không cập nhật"}
                </Dong>
                {quyTac ? (
                  <Dong nhan="Quy tắc">
                    {quyTac.tyLeDayTon}% · giữ lại {soVN(quyTac.tonDem)} · ngưỡng {soVN(quyTac.nguongVe0)}
                    {duongDanCauHinh ? (
                      <Link to={duongDanCauHinh} className="ml-2 font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">
                        Sửa
                      </Link>
                    ) : null}
                  </Dong>
                ) : null}
              </Nhom>
              <Nhom ten="Giá">
                <Dong nhan="Giá bán FCentric">{lienKet.giaBan != null ? formatCurrency(lienKet.giaBan) : "—"}</Dong>
              </Nhom>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-bo-border px-5 py-3">
              <Button type="button" variant="outline" disabled={khoa} onClick={onDoiBienThe} className={nutPhu}>
                Ghép biến thể khác
              </Button>
              {trangThai === "loi" ? (
                <Button type="button" variant="outline" disabled={khoa} onClick={onThuLai} className={nutPhu}>
                  {dangXuLy === "thu-lai" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Thử lại
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={khoa || (!dangDongBo && !lienKet.bienTheSanPhamId)} onClick={onBatTat} className={nutPhu}>
                {dangXuLy === "bat-tat" ? <Loader2 className="size-4 animate-spin" /> : null}
                {dangDongBo ? "Ngừng đồng bộ" : "Bật đồng bộ"}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
