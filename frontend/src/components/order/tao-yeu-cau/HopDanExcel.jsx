import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { soVN } from "@/components/chung-tu/bangChungTu";
import {
  CHAN_HOP, DAU_HOP, GHI_CHU_HOP, HOP, HOP_RONG, MO_TA_HOP, NUT_CHINH, NUT_QUAY_LAI, THAN_HOP, TIEU_DE_HOP,
} from "@/components/chung-tu/kieuHopThoai";
import { docDanhSachDan, khoaSanPham, SO_LOI_DAN_HIEN } from "./tinhTaoYeuCau";

/**
 * Hộp "Dán từ Excel": dán 2 cột (SKU hoặc mã vạch, số lượng) — chép thẳng từ Excel (cách bằng Tab) hoặc gõ cách bằng
 * dấu phẩy, khoảng trắng. Xem trước ngay: số mã hợp lệ, mã mới / đã có, dòng lặp đã cộng dồn, các dòng lỗi kèm lý do
 * (bị bỏ qua khi thêm). Mã đã có trong yêu cầu: chọn cộng thêm hay thay bằng số mới.
 *
 * - `chiMuc`: chỉ mục danh mục hàng (tra SKU / mã vạch); `dong`: dòng đang có.
 * - `onThem(hop, cach, soLoi)`: `hop` = [{ bienTheId, soLuong }], `cach` = "cong" | "thay", `soLoi` số dòng lỗi để màn báo.
 * - `traTieuDiemVe` (ref): đóng hộp thì đưa tiêu điểm về phần tử này (ô tìm thêm hàng).
 */
export default function HopDanExcel({ mo, onDoiMo, chiMuc, dong, onThem, traTieuDiemVe }) {
  return (
    <Dialog open={mo} onOpenChange={onDoiMo}>
      <DialogContent
        showCloseButton={false}
        className={cn(HOP, HOP_RONG)}
        onCloseAutoFocus={(e) => {
          const el = traTieuDiemVe?.current;
          if (el?.isConnected && !el.disabled) { e.preventDefault(); el.focus(); }
        }}
      >
        {mo ? <NoiDung chiMuc={chiMuc} dong={dong} onThem={onThem} onDong={() => onDoiMo(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NoiDung({ chiMuc, dong, onThem, onDong }) {
  const id = useId();
  const [chu, setChu] = useState("");
  const [cach, setCach] = useState("cong");
  const kq = useMemo(() => docDanhSachDan(chu, chiMuc), [chu, chiMuc]);
  const daCo = useMemo(() => new Set((dong ?? []).map((d) => String(d.bienTheId))), [dong]);
  const soDaCo = kq.hop.filter((x) => daCo.has(String(x.bienTheId))).length;
  const soMoi = kq.hop.length - soDaCo;
  const soSp = new Set(kq.hop.map((x) => khoaSanPham(chiMuc?.theoId?.get(String(x.bienTheId))))).size;
  const tong = kq.hop.reduce((s, x) => s + x.soLuong, 0);
  const coChu = chu.trim() !== "";

  return (
    <>
      <DialogHeader className={DAU_HOP}>
        <DialogTitle className={TIEU_DE_HOP}>Dán danh sách từ Excel</DialogTitle>
        <DialogDescription className={MO_TA_HOP}>
          Mỗi dòng một mã: SKU hoặc mã vạch, rồi số lượng. Chép thẳng 2 cột từ Excel, hoặc gõ cách nhau bằng dấu phẩy,
          khoảng trắng. Mã lặp lại được cộng dồn.
        </DialogDescription>
      </DialogHeader>
      <div className={cn(THAN_HOP, "pb-1")}>
        <label htmlFor={`${id}-dan`} className="sr-only">Danh sách mã và số lượng</label>
        <textarea
          id={`${id}-dan`}
          value={chu}
          onChange={(e) => setChu(e.target.value)}
          spellCheck={false}
          rows={8}
          placeholder={"AK2610234-CL001-M\t30\nAK2610234-CL001-L\t25\n2026102340003\t20"}
          className="min-h-[168px] w-full resize-y rounded-md border border-bo-input-border bg-bo-surface px-2.5 py-2 font-mono text-[12.5px] leading-5 text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
        />
        {soDaCo > 0 ? (
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] leading-5">
            <legend className="float-left mr-1 text-bo-muted">{soVN(soDaCo)} mã đã có trong yêu cầu:</legend>
            {[["cong", "Cộng thêm"], ["thay", "Thay bằng số mới"]].map(([ma, nhan]) => (
              <label key={ma} className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name={`${id}-cach`}
                  value={ma}
                  checked={cach === ma}
                  onChange={() => setCach(ma)}
                  className="size-[15px] accent-bo-primary"
                />
                {nhan}
              </label>
            ))}
          </fieldset>
        ) : null}
        {coChu ? (
          <div className={GHI_CHU_HOP} role="status" aria-live="polite">
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <span className={cn("font-medium", kq.hop.length ? "text-bo-success" : "text-bo-muted")}>
                {soVN(kq.hop.length)} mã hợp lệ{kq.hop.length ? ` (${soVN(soSp)} sản phẩm, tổng ${soVN(tong)})` : ""}
              </span>
              {kq.loi.length ? <span className="font-medium text-bo-danger-strong">{soVN(kq.loi.length)} dòng lỗi, sẽ bỏ qua</span> : null}
              <span className="text-bo-muted">
                {[
                  soMoi ? `${soVN(soMoi)} mã mới` : "",
                  soDaCo ? `${soVN(soDaCo)} mã đã có` : "",
                  kq.soDongLap > 0 ? `${soVN(kq.soDongLap)} dòng lặp đã cộng dồn` : "",
                ].filter(Boolean).join(" · ")}
              </span>
            </p>
            {kq.loi.length ? (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px]">
                {kq.loi.slice(0, SO_LOI_DAN_HIEN).map((e) => (
                  <li key={e.dongSo}>
                    Dòng {e.dongSo}: <span className="break-all font-mono text-bo-foreground">{e.chu}</span> — {e.lyDo}
                  </li>
                ))}
                {kq.loi.length > SO_LOI_DAN_HIEN ? <li>và {soVN(kq.loi.length - SO_LOI_DAN_HIEN)} dòng lỗi khác</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={CHAN_HOP}>
        <Button type="button" variant="outline" className={NUT_QUAY_LAI} onClick={onDong}>Quay lại</Button>
        <Button
          type="button"
          className={NUT_CHINH}
          disabled={!kq.hop.length}
          onClick={() => onThem?.(kq.hop, cach, kq.loi.length)}
        >
          {kq.hop.length ? `Thêm ${soVN(kq.hop.length)} mã` : "Thêm vào yêu cầu"}
        </Button>
      </div>
    </>
  );
}
