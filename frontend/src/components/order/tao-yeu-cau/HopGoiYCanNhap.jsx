import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { khopTuKhoa, soVN, tachTuKhoa } from "@/components/chung-tu/bangChungTu";
import { CHAN_HOP, DAU_HOP, HOP, MO_TA_HOP, NUT_CHINH, NUT_QUAY_LAI, O_NHAP, TIEU_DE_HOP } from "@/components/chung-tu/kieuHopThoai";
import { NHAN_CANH_BAO, NHAN_TRUNG, O_CHON } from "./kieuTaoYeuCau";
import { dongTimCua, khoaSanPham, laGoiY, soSanhUuTienDss } from "./tinhTaoYeuCau";
import { t } from "@/i18n";

// Hiện dần theo sản phẩm: kho lớn có thể vài nghìn mã cần nhập, vẽ hết một lần làm hộp mở chậm
const SO_SP_HIEN = 30;

const NHAN_KICH_BAN = {
  PRESET_01_STANDARD: t("Hoạt động chuẩn"),
  PRESET_02_PEAK: t("Cao điểm"),
  PRESET_03_LEAN: t("Tiết kiệm vốn"),
  PRESET_04_PHASE_OUT: t("Ngừng nhập"),
};

// Điện thoại (< 768px): chỉ 3 cột (chọn · sản phẩm · đề xuất), khả dụng / đang về ghi thành dòng phụ dưới SKU để hộp không cuộn ngang
const LUOI = "grid grid-cols-[44px_minmax(0,1fr)_76px] items-center md:grid-cols-[44px_minmax(220px,1fr)_84px_80px_84px]";
const CHI_MAY_TINH = "max-md:hidden";

const trangThai = (ids, chon) => {
  const so = ids.filter((id) => chon.has(String(id))).length;
  return so === 0 ? false : so === ids.length ? true : "indeterminate";
};

/**
 * Hộp "Gợi ý cần nhập": các mã Kho tổng đã chạm điểm đặt hàng lại (ROP) theo công thức DSS, gom theo sản phẩm, tích để
 * thêm cả loạt theo số đề xuất Q. Mặc định tích mọi mã chưa có trong yêu cầu này và không nằm trong yêu cầu nhập khác
 * đang mở (ẩn các mã đó, bật lại được). Mã đã có trong yêu cầu hiện mờ, không tích được.
 *
 * - `dsHang`: danh mục hàng Kho tổng; `dong`: dòng đang có; `tenKho`, `cauHinhDss` cho câu mô tả công thức DSS.
 * - `onThem(ids)`: thêm các mã đã tích (màn tự lấy số đề xuất). Mã đang ẩn (trong yêu cầu khác) không tính là đã chọn.
 * - `traTieuDiemVe` (ref): đóng hộp thì đưa tiêu điểm về phần tử này (ô tìm thêm hàng).
 */
export default function HopGoiYCanNhap({ mo, onDoiMo, dsHang, dong, tenKho, cauHinhDss, onThem, traTieuDiemVe }) {
  return (
    <Dialog open={mo} onOpenChange={onDoiMo}>
      <DialogContent
        showCloseButton={false}
        className={cn(HOP, "sm:max-w-[880px]")}
        onCloseAutoFocus={(e) => {
          const el = traTieuDiemVe?.current;
          if (el?.isConnected && !el.disabled) { e.preventDefault(); el.focus(); }
        }}
      >
        {mo ? <NoiDung dsHang={dsHang} dong={dong} tenKho={tenKho} cauHinhDss={cauHinhDss} onThem={onThem} onDong={() => onDoiMo(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NoiDung({ dsHang, dong, tenKho, cauHinhDss, onThem, onDong }) {
  const daCo = useMemo(() => new Map((dong ?? []).map((d) => [String(d.bienTheId), d.soLuong])), [dong]);
  const goiY = useMemo(() => (dsHang ?? []).filter(laGoiY).sort(soSanhUuTienDss), [dsHang]);
  const soTrung = useMemo(() => goiY.filter((bt) => bt.yeuCauMo && !daCo.has(String(bt.bienTheId))).length, [goiY, daCo]);
  const [tuKhoa, setTuKhoa] = useState("");
  const [anTrung, setAnTrung] = useState(true);
  const [soSpHien, setSoSpHien] = useState(SO_SP_HIEN);
  // Chỉ tích sẵn một lần lúc mở hộp
  const [chon, setChon] = useState(() => new Set(goiY
    .filter((bt) => !bt.yeuCauMo && !daCo.has(String(bt.bienTheId)))
    .map((bt) => String(bt.bienTheId))));

  const hien = useMemo(() => {
    const tu = tachTuKhoa(tuKhoa);
    return goiY.filter((bt) => (!anTrung || !bt.yeuCauMo || daCo.has(String(bt.bienTheId)))
      && (!tu.length || khopTuKhoa(dongTimCua(bt), tu)));
  }, [goiY, tuKhoa, anTrung, daCo]);

  const nhom = useMemo(() => {
    const ds = [];
    hien.forEach((bt) => {
      const khoa = khoaSanPham(bt);
      let n = ds.find((x) => x.khoa === khoa);
      if (!n) { n = { khoa, bt, dong: [] }; ds.push(n); }
      n.dong.push(bt);
    });
    return ds;
  }, [hien]);

  const chonDuoc = hien.filter((bt) => !daCo.has(String(bt.bienTheId))).map((bt) => String(bt.bienTheId));
  const daChon = goiY.filter((bt) => chon.has(String(bt.bienTheId)) && !daCo.has(String(bt.bienTheId))
    && (!anTrung || !bt.yeuCauMo));
  const soSp = new Set(daChon.map(khoaSanPham)).size;
  const tong = daChon.reduce((s, bt) => s + Number(bt.soLuongDeXuat || 0), 0);

  const datChon = (ids, co) => setChon((cu) => {
    const moi = new Set(cu);
    ids.forEach((id) => (co ? moi.add(id) : moi.delete(id)));
    return moi;
  });
  const ttTatCa = chonDuoc.length ? trangThai(chonDuoc, chon) : false;

  return (
    <>
      <DialogHeader className={DAU_HOP}>
        <DialogTitle className={cn(TIEU_DE_HOP, "flex items-center gap-2")}>
          <Sparkles className="size-[18px] text-bo-primary" aria-hidden="true" />
          {t("Gợi ý cần nhập · {{tenKho}}", { tenKho: tenKho || t("Kho tổng") })}
        </DialogTitle>
        <DialogDescription className={MO_TA_HOP}>
          {cauHinhDss?.cheDo === "GLOBAL_PRESET"
            ? t("Áp dụng cùng công thức Gợi ý nhập hàng (DSS) trên tổng toàn bộ kho đang hoạt động theo kịch bản {{kichBan}} (quan sát {{n}} ngày, dự trữ {{t}} ngày). Chỉ hiển thị mã đã chạm điểm đặt hàng lại (ROP) và cần bổ sung.", {
                kichBan: NHAN_KICH_BAN[cauHinhDss?.kichBanChung] || t("Hoạt động chuẩn"),
                n: soVN(cauHinhDss?.chuKyQuanSatN || 14),
                t: soVN(cauHinhDss?.chuKyDuTruT || 14),
              })
            : t("Áp dụng cùng công thức Gợi ý nhập hàng (DSS) trên tổng toàn bộ kho đang hoạt động theo nhóm ABC tự động (quan sát {{n}} ngày, dự trữ {{t}} ngày). Chỉ hiển thị mã đã chạm điểm đặt hàng lại (ROP) và cần bổ sung.", {
                n: soVN(cauHinhDss?.chuKyQuanSatN || 14),
                t: soVN(cauHinhDss?.chuKyDuTruT || 14),
              })}{" "}
          <Link to="/purchase-requests/dss" className="font-medium text-bo-primary hover:underline">
            {t("Xem và điều chỉnh ở Gợi ý nhập hàng (DSS)")}
          </Link>
        </DialogDescription>
      </DialogHeader>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3 pt-4 sm:px-6">
        <label className="relative w-full min-w-0 sm:w-72">
          <span className="sr-only">{t("Tìm trong gợi ý")}</span>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-bo-muted" aria-hidden="true" />
          <input
            type="search"
            autoComplete="off"
            value={tuKhoa}
            onChange={(e) => { setTuKhoa(e.target.value); setSoSpHien(SO_SP_HIEN); }}
            placeholder={t("Tìm tên, SKU, màu, cỡ, nhóm hàng")}
            className={cn(O_NHAP, "pl-8")}
          />
        </label>
        {soTrung > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] leading-5 text-slate-700">
            <Checkbox checked={anTrung} onCheckedChange={(v) => setAnTrung(v === true)} className={O_CHON} />
            {t("Ẩn mã đang trong yêu cầu khác ({{soTrung}})", { soTrung: soVN(soTrung) })}
          </label>
        ) : null}
        <span className="text-[13px] tabular-nums text-bo-muted sm:ml-auto">
          {t("{{soMa}} mã · {{soSp}} sản phẩm", { count: hien.length, soMa: soVN(hien.length), soSp: soVN(nhom.length) })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border-y border-bo-border" role="table" aria-label={t("Mã gợi ý cần nhập")}>
        <div className="md:min-w-[560px]">
          <div role="row" className={cn(LUOI, "sticky top-0 z-[1] border-b border-bo-border bg-bo-surface-subtle text-xs font-medium leading-4 text-bo-muted")}>
            <span role="columnheader" className="flex items-center py-2.5 pl-5 sm:pl-6">
              <Checkbox
                checked={ttTatCa}
                disabled={!chonDuoc.length}
                onCheckedChange={() => datChon(chonDuoc, ttTatCa !== true)}
                aria-label={t("Chọn tất cả mã gợi ý đang hiện")}
                className={O_CHON}
              />
            </span>
            <span role="columnheader" className="px-3 py-2.5">{t("Sản phẩm")}</span>
            <span role="columnheader" className={cn("px-3 py-2.5 text-right", CHI_MAY_TINH)} title={t("Tổng khả dụng trên toàn bộ kho đang hoạt động")}>{t("Khả dụng")}</span>
            <span role="columnheader" className={cn("px-3 py-2.5 text-right", CHI_MAY_TINH)} title={t("Tổng phần chưa nhận của đơn mua đã chốt trên toàn hệ thống")}>{t("Đang về")}</span>
            <span role="columnheader" className="py-2.5 pl-3 pr-5 text-right sm:pr-6">{t("Đề xuất")}</span>
          </div>
          {nhom.slice(0, soSpHien).map((n) => {
            const ids = n.dong.filter((bt) => !daCo.has(String(bt.bienTheId))).map((bt) => String(bt.bienTheId));
            // Cả sản phẩm đã có trong yêu cầu: ô nhóm tích sẵn và khóa, cùng kiểu với từng mã
            const tt = ids.length ? trangThai(ids, chon) : true;
            return (
              <Fragment key={n.khoa}>
                <div role="row" className={cn(LUOI, "border-b border-slate-100 bg-bo-row-group text-[13px] tabular-nums")}>
                  <span role="cell" className="flex items-center py-2 pl-5 sm:pl-6">
                    <Checkbox
                      checked={tt}
                      disabled={!ids.length}
                      onCheckedChange={() => datChon(ids, tt !== true)}
                      aria-label={t("Chọn các mã gợi ý của {{tenSanPham}}", { tenSanPham: n.bt.tenSanPham })}
                      className={O_CHON}
                    />
                  </span>
                  <span role="cell" className="flex min-w-0 items-center gap-2.5 px-3 py-2">
                    <AnhBienThe src={n.bt.anh} co="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-bo-foreground" title={n.bt.tenSanPham}>{n.bt.tenSanPham}</span>
                      <span className="block text-xs leading-4 text-bo-muted">
                        {[n.bt.maSanPham, n.bt.nhomHang, t("{{soMa}} mã sắp hết", { count: n.dong.length, soMa: soVN(n.dong.length) })].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </span>
                  <span role="cell" className={cn("px-3 py-2 text-right", CHI_MAY_TINH)}>{soVN(n.dong.reduce((s, bt) => s + Number(bt.khaDung || 0), 0))}</span>
                  <span role="cell" className={cn("px-3 py-2 text-right", CHI_MAY_TINH)}>{soVN(n.dong.reduce((s, bt) => s + Number(bt.dangVe || 0), 0))}</span>
                  <span role="cell" className="py-2 pl-3 pr-5 text-right font-semibold sm:pr-6">
                    {soVN(n.dong.reduce((s, bt) => s + Number(bt.soLuongDeXuat || 0), 0))}
                  </span>
                </div>
                {n.dong.map((bt) => {
                  const slCo = daCo.get(String(bt.bienTheId));
                  const coRoi = slCo !== undefined;
                  const daTich = !coRoi && chon.has(String(bt.bienTheId));
                  return (
                    <div key={bt.bienTheId} role="row" className={cn(LUOI, "border-b border-slate-100 text-[13px] tabular-nums", coRoi && "text-bo-muted")}>
                      <span role="cell" className="flex items-center py-2 pl-5 sm:pl-6">
                        <Checkbox
                          checked={coRoi || daTich}
                          disabled={coRoi}
                          onCheckedChange={() => datChon([String(bt.bienTheId)], !daTich)}
                          aria-label={t("Chọn {{ten}}", { ten: `${bt.tenSanPham} ${bt.tenMau || ""} ${bt.tenSize || ""}`.trim() })}
                          className={O_CHON}
                        />
                      </span>
                      <span role="cell" className="flex min-w-0 flex-col items-start py-2 pl-[50px] pr-3">
                        <MauKichCo tenMau={bt.tenMau} maMauHex={bt.maMauHex} kichCo={bt.tenSize} className={coRoi ? "" : "text-bo-foreground"} />
                        <span className="break-all font-mono text-xs leading-4 text-bo-muted">{bt.maSku}</span>
                        {bt.phanLoaiAbc || bt.mucDoKhanCap === "CRITICAL" || bt.mucDoKhanCap === "HIGH" || bt.nguong > 0 ? (
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-4">
                            {bt.phanLoaiAbc ? (
                              <span className="rounded border border-slate-200 bg-slate-100 px-1.5 font-semibold text-slate-700">
                                {t("Nhóm {{nhom}}", { nhom: bt.phanLoaiAbc })}
                              </span>
                            ) : null}
                            {bt.mucDoKhanCap === "CRITICAL" ? (
                              <span className="rounded border border-red-200 bg-red-50 px-1.5 font-medium text-red-700">
                                {t("Cần nhập gấp")}
                              </span>
                            ) : bt.mucDoKhanCap === "HIGH" ? (
                              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 font-medium text-amber-800">
                                {t("Chạm ngưỡng ROP")}
                              </span>
                            ) : null}
                            {bt.nguong > 0 ? (
                              <span className="tabular-nums text-bo-muted">
                                {t("ROP {{rop}}", { rop: soVN(bt.nguong) })}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {coRoi ? <span className="mt-0.5 text-xs text-bo-muted">{t("Đã có trong yêu cầu này · {{slCo}}", { slCo: soVN(slCo) })}</span> : null}
                        {!coRoi && bt.yeuCauMo ? (
                          <span className={cn(NHAN_CANH_BAO, NHAN_TRUNG)}>{t("Đang trong {{ma}}", { ma: bt.yeuCauMo.ma })}</span>
                        ) : null}
                        <span className="mt-0.5 text-xs leading-4 text-bo-muted md:hidden">
                          {t("Khả dụng {{khaDung}} · Đang về {{dangVe}}", { khaDung: soVN(bt.khaDung), dangVe: soVN(bt.dangVe) })}
                        </span>
                      </span>
                      <span role="cell" className={cn("px-3 py-2 text-right", CHI_MAY_TINH)}>{soVN(bt.khaDung)}</span>
                      <span role="cell" className={cn("px-3 py-2 text-right", CHI_MAY_TINH)}>{soVN(bt.dangVe)}</span>
                      <span role="cell" className="py-2 pl-3 pr-5 text-right font-semibold sm:pr-6">{soVN(bt.soLuongDeXuat)}</span>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
          {nhom.length > soSpHien ? (
            <div className="flex justify-center px-6 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                onClick={() => setSoSpHien((n) => n + SO_SP_HIEN)}
              >
                {t("Hiện thêm {{soThem}} sản phẩm (còn {{soCon}})", {
                  count: Math.min(SO_SP_HIEN, nhom.length - soSpHien),
                  soThem: soVN(Math.min(SO_SP_HIEN, nhom.length - soSpHien)),
                  soCon: soVN(nhom.length - soSpHien),
                })}
              </Button>
            </div>
          ) : null}
          {!nhom.length ? (
            <p className="px-6 py-8 text-center text-sm text-bo-muted">
              {goiY.length
                ? t("Không có mã gợi ý nào khớp.")
                : cauHinhDss?.cheDo === "GLOBAL_PRESET" && cauHinhDss?.kichBanChung === "PRESET_04_PHASE_OUT"
                  ? t("Hệ thống DSS đang ở kịch bản Ngừng nhập và xả hàng nên không đề xuất nhập mới.")
                  : t("Toàn hệ thống chưa có mã nào chạm điểm đặt hàng lại (ROP) theo DSS.")}
            </p>
          ) : null}
        </div>
      </div>

      <div className={CHAN_HOP}>
        <span className="mr-auto text-[13px] tabular-nums text-bo-muted">
          {t("Đã chọn")} <b className="font-semibold text-bo-foreground">{soVN(daChon.length)}</b>{" "}
          {t("mã · {{soSp}} sản phẩm · tổng", { count: daChon.length, soSp: soVN(soSp) })}{" "}
          <b className="font-semibold text-bo-foreground">{soVN(tong)}</b>
        </span>
        <Button type="button" variant="outline" className={NUT_QUAY_LAI} onClick={onDong}>{t("Quay lại")}</Button>
        <Button
          type="button"
          className={NUT_CHINH}
          disabled={!daChon.length}
          onClick={() => onThem?.(daChon.map((bt) => bt.bienTheId))}
        >
          {t("Thêm {{soMa}} mã theo số đề xuất", { count: daChon.length, soMa: soVN(daChon.length) })}
        </Button>
      </div>
    </>
  );
}
