import { ArrowRightLeft, SplitSquareHorizontal, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { CHAN_HOP, DAU_HOP, HOP, HOP_RONG, MO_TA_HOP, NUT_CHINH, NUT_QUAY_LAI, THAN_HOP, TIEU_DE_HOP } from "@/components/chung-tu/kieuHopThoai";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ThanhSucChua } from "./TheKe";

/**
 * Luồng A3 (BR-BIN-05): kệ đích vừa quét không đủ chỗ cho phần còn phải cất. Hai phương án của BA:
 * - Tách cất nhiều kệ: cất đầy kệ này, phần còn lại quét tiếp kệ khác (A3.1). Kệ hết chỗ thì không có phương án này.
 * - Đổi sang kệ khác: bỏ kệ này, quét kệ có đủ chỗ (A3.2).
 * Quản lý kho có thêm "Cất vượt sức chứa" (Manager Override).
 * Tiêu điểm mở hộp ở nút "Đổi sang kệ khác": phím Enter máy quét gửi kèm mã tiếp theo không vô tình tách cất.
 * `onDongXong`: gọi sau khi hộp đóng (thay việc Radix trả tiêu điểm về nút đã mở hộp) — màn đưa tiêu điểm về ô quét kệ đích.
 */
export default function HopKhongDuSucChua({ mo, ke, can, onTach, onDoi, onVuot, duocVuot, onDongXong }) {
  const conTrong = Math.max(0, ke?.conTrong ?? 0);
  return (
    <Dialog open={mo} onOpenChange={(m) => (!m ? onDoi() : null)}>
      <DialogContent
        className={cn(HOP, HOP_RONG)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onDongXong?.();
        }}
      >
        <DialogHeader className={DAU_HOP}>
          <DialogTitle className={cn(TIEU_DE_HOP, "flex items-center gap-2")}>
            <TriangleAlert className="size-5 text-bo-warning" aria-hidden="true" />
            {t("Kệ đích {{ma}} không đủ sức chứa", { ma: ke?.maViTri ?? "" })}
          </DialogTitle>
          <DialogDescription className={MO_TA_HOP}>
            {t("Yêu cầu cất: {{can}} · Sức chứa còn trống: {{conTrong}} (thiếu {{thieu}} vị trí). Chọn cách xử lý.", {
              can: soVN(can),
              conTrong: soVN(conTrong),
              thieu: soVN(Math.max(0, can - conTrong)),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className={THAN_HOP}>
          {ke ? <ThanhSucChua ke={ke} them={conTrong} /> : null}
          <ul className="grid gap-2 text-sm text-bo-foreground">
            <li className="rounded-lg border border-bo-border p-3">
              <b className="font-semibold">{t("Tách cất nhiều kệ")}</b>
              <span className="text-bo-muted">
                {" "}
                {conTrong > 0
                  ? t("· cất {{so}} vào kệ này cho đầy, {{conLai}} còn lại quét tiếp kệ khác.", { so: soVN(conTrong), conLai: soVN(can - conTrong) })
                  : t("· kệ này đã hết chỗ, không tách được.")}
              </span>
            </li>
            <li className="rounded-lg border border-bo-border p-3">
              <b className="font-semibold">{t("Đổi sang kệ khác")}</b>
              <span className="text-bo-muted"> {t("· bỏ kệ này, quét kệ còn trống từ {{can}} chỗ trở lên.", { can: soVN(can) })}</span>
            </li>
          </ul>
        </div>
        <div className={cn(CHAN_HOP, "pt-4")}>
          {duocVuot ? (
            <Button variant="ghost" onClick={onVuot} className="mr-auto h-9 text-amber-800 hover:bg-bo-warning-soft hover:text-amber-900">
              {t("Cất vượt sức chứa")}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onDoi} className={cn("h-9 gap-2", NUT_QUAY_LAI)} autoFocus>
            <ArrowRightLeft className="size-4" aria-hidden="true" />
            {t("Đổi sang kệ khác")}
          </Button>
          <Button onClick={onTach} disabled={conTrong <= 0} className={cn("h-9 gap-2", NUT_CHINH)}>
            <SplitSquareHorizontal className="size-4" aria-hidden="true" />
            {t("Tách cất nhiều kệ")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
