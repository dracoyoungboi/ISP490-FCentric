import { Barcode, Layers, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import ChipLo from "@/components/chung-tu/ChipLo";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import OTienDo from "@/components/chung-tu/OTienDo";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_MO,
  DONG_SANG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { formatQuantity } from "@/constants/outbound";
import { cn } from "@/lib/utils";
import { DON_VI_DONG, TEN_CHUNG_TU } from "./tinhPhieuNhat";
import { t } from "@/i18n";

// Câu khi lọc nhanh không còn dòng (theo demo, rõ hơn câu chung "Không có … ở bộ lọc này.")
const CHU_LOC_RONG = {
  conThieu: t("Mọi dòng đã nhặt đủ."),
  du: t("Chưa có dòng nào nhặt đủ."),
};

// Ô cuối của hàng khi khối hẹp mà cột Thao tác đang ẩn: lề phải trùng lề khối như O_CUOI
const CUOI_KHI_HEP = "@max-2xl/khoi:pr-4 @max-2xl/khoi:sm:pr-6";

/**
 * Bảng "Sản phẩm cần nhặt" (bảng phẳng, mỗi dòng một biến thể). `bang`: kết quả useBangChungTu theo dòng của trang
 * (trang giữ để gọi `denDong` sau mỗi lần quét). Thứ tự dòng cố định; dòng vừa quét tô sáng (`dongSang`).
 * Ít dòng: lọc Tất cả / Còn thiếu / Đủ ở hàng tiêu đề; quá ngưỡng: thêm ô tìm + phân trang theo dòng.
 * Cột Thao tác (Phân bổ lô) chỉ khi `duocPhanBoLo`; dòng "Đã bỏ" (số cần nhặt 0) không có nút.
 * Khối hẹp (< 672px: điện thoại, 768px có thanh bên): cột "Lô gợi ý" và "Thao tác" ẩn, lô + nút Phân bổ lô xuống dưới tên
 * sản phẩm để cột "Đã nhặt" luôn trong khung.
 */
export default function BangDongNhat({ bang, duocPhanBoLo, dongSang, onPhanBoLo }) {
  const boLoc = bang.rong ? null : (
    <NutPhanDoan
      nhan={t("Lọc dòng")}
      value={bang.locNhanh}
      onChange={bang.datLoc}
      luaChon={[
        { value: "tatCa", label: t("Tất cả") },
        { value: "conThieu", label: t("Còn thiếu"), count: bang.demLoc.conThieu ?? 0 },
        { value: "du", label: t("Đủ"), count: bang.demLoc.du ?? 0 },
      ]}
    />
  );

  return (
    <section aria-labelledby="bang-nhat" className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
        <h2 id="bang-nhat" className="text-base font-semibold leading-6 text-bo-foreground">
          {t("Sản phẩm cần nhặt")}
        </h2>
        {bang.coCongCu ? null : boLoc}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim={t("Tìm theo tên, SKU hoặc mã vạch")}
          nhanTim={t("Tìm trong phiếu nhặt hàng")}
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          boLoc={boLoc}
        />
      ) : null}

      {bang.rong ? null : (
        <div className={KHUNG_CUON}>
          <table
            aria-labelledby="bang-nhat"
            className={cn(BANG, "table-fixed", duocPhanBoLo ? "@2xl/khoi:min-w-[700px]" : "@2xl/khoi:min-w-[560px]")}
          >
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>{t("Sản phẩm")}</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[176px]", AN_DIEN_THOAI)}>{t("Lô gợi ý")}</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[156px]", duocPhanBoLo ? CUOI_KHI_HEP : O_CUOI)}>
                  {t("Đã nhặt")}
                </th>
                {duocPhanBoLo ? (
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[128px]", AN_DIEN_THOAI)}>
                    <span className="sr-only">{t("Thao tác")}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {bang.dong.map((d) => (
                <DongNhat
                  key={d.id}
                  dong={d}
                  sang={dongSang != null && String(dongSang) === String(d.id)}
                  duocPhanBoLo={duocPhanBoLo}
                  onPhanBoLo={onPhanBoLo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bang.khongKetQua && !bang.dangTim ? (
        <KhongKetQua
          bang={bang}
          chu={CHU_LOC_RONG[bang.locNhanh]}
          donVi={DON_VI_DONG}
          nhanNut={t("Xem tất cả")}
          onNut={bang.xoaLoc}
        />
      ) : (
        <KhongKetQua bang={bang} tenChungTu={TEN_CHUNG_TU} donVi={DON_VI_DONG} />
      )}
      <PhanTrangBang {...bang.phanTrang} />
    </section>
  );
}

const THE_KE = "inline-flex h-[22px] max-w-full items-center gap-1 whitespace-nowrap rounded border px-1.5 text-xs";

/**
 * "Lấy ở": kệ lấy hàng của dòng (phân bổ nhặt theo kệ, gộp các lô theo kệ) và phần lấy ở hàng chưa có kệ. Chỉ lấy ở hàng
 * chưa có kệ: một dòng chữ nhạt (đa số hàng chưa lên kệ, thẻ ở mọi dòng sẽ rối). Kệ đang kiểm kê tô vàng; dòng chưa
 * nhặt đủ thì nhắc đổi kệ (người được Phân bổ lô) hoặc chỉ báo kệ đang kiểm kê. Lô phân bổ trước khi có nhặt theo kệ:
 * "Chưa ghi kệ". Thẻ nền trắng để vẫn rõ trên dòng vừa quét (nền xanh nhạt).
 */
function LayO({ layO, coNut, daDu }) {
  if (!layO) return null;
  const { ke, chuaCoKe, chuaRo } = layO;
  if (!ke.length && !(chuaCoKe > 0) && !chuaRo) return null;
  if (!ke.length && !chuaRo) {
    return (
      <div className="mt-1 flex items-center gap-1 text-xs leading-4 text-bo-muted">
        <MapPin className="size-3 shrink-0" aria-hidden="true" />
        {t("Lấy ở hàng chưa có kệ")}
      </div>
    );
  }
  const coKiemKe = !daDu && ke.some((k) => k.dangKiemKe);
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-xs leading-4 text-bo-muted">{t("Lấy ở")}</span>
        {ke.map((k) => (
          <span
            key={k.id}
            title={k.dangKiemKe ? t("Kệ {{ma}} đang được kiểm kê", { ma: k.ma }) : t("Kệ {{ma}}", { ma: k.ma })}
            className={cn(
              THE_KE,
              "font-mono",
              k.dangKiemKe
                ? "border-bo-warning/40 bg-bo-warning-soft text-bo-warning"
                : "border-bo-primary/25 bg-white text-bo-primary-strong",
            )}
          >
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("Kệ")} </span>
            <span className="truncate">{k.ma}</span>
            <span className="font-sans tabular-nums">× {formatQuantity(k.soLuong)}</span>
            {k.dangKiemKe ? <span className="sr-only"> {t("(đang kiểm kê)")}</span> : null}
          </span>
        ))}
        {chuaCoKe > 0 ? (
          <span title={t("Hàng của lô chưa xếp lên kệ nào trong kho")} className={cn(THE_KE, "border-slate-200 bg-white text-slate-600")}>
            {t("Chưa có kệ")}
            <span className="tabular-nums">× {formatQuantity(chuaCoKe)}</span>
          </span>
        ) : null}
        {chuaRo ? (
          <span
            title={t("Lô phân bổ trước khi có nhặt theo kệ. Lưu lại ở Phân bổ lô để hệ thống chia kệ.")}
            className="text-xs leading-4 text-bo-muted"
          >
            {t("Chưa ghi kệ")}
          </span>
        ) : null}
      </div>
      {coKiemKe ? (
        <div className="mt-1 text-xs font-medium leading-4 text-bo-warning">
          {coNut ? t("Đổi kệ trước khi nhặt") : t("Kệ đang kiểm kê")}
        </div>
      ) : null}
    </div>
  );
}

/** Lô gợi ý của một dòng: thẻ lô (nhập trước lấy trước hoặc đã sửa tay), kệ lấy hàng, cảnh báo thiếu lô / chưa phân bổ. */
function LoGoiY({ dong: d, coNut }) {
  if (d.trangThai === "bo") return <span className="text-bo-muted">—</span>;
  if (d.chuaLo) return <span className="text-xs font-medium leading-4 text-bo-warning">{t("Chưa phân bổ lô")}</span>;
  return (
    <>
      <ChipLo lo={d.lo} cuaDong={d.sku} />
      <div className={cn("mt-1 text-xs leading-4", d.thuCong ? "text-slate-600" : "text-bo-muted")}>
        {d.thuCong ? t("Đã sửa tay") : t("Nhập trước lấy trước")}
      </div>
      <LayO layO={d.layO} coNut={coNut} daDu={d.trangThai === "du"} />
      {d.thieuLo > 0 ? (
        <div className="mt-1 text-xs font-medium leading-4 text-bo-warning">
          {t("Còn thiếu {{thieuLo}} theo lô — tồn theo lô không đủ", { thieuLo: formatQuantity(d.thieuLo) })}
        </div>
      ) : null}
    </>
  );
}

function NutPhanBoLo({ dong: d, onPhanBoLo, className }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onPhanBoLo(d.goc)}
      aria-label={t("Phân bổ lô cho {{sanPham}}", { sanPham: d.sku || d.tenSanPham })}
      className={cn(
        "h-7 gap-1 border-bo-border bg-bo-surface px-2 text-xs font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle",
        className,
      )}
    >
      <Layers className="size-3.5" aria-hidden="true" />
      {t("Phân bổ lô")}
    </Button>
  );
}

function DongNhat({ dong: d, sang, duocPhanBoLo, onPhanBoLo }) {
  const bo = d.trangThai === "bo";
  const coNut = duocPhanBoLo && !bo;

  return (
    <tr className={cn(DONG, bo && DONG_MO, sang && DONG_SANG)}>
      <td className={cn(O, O_DAU)}>
        <div className="flex min-w-0 items-start gap-3 @2xl/khoi:items-center">
          <AnhBienThe src={d.anh} />
          <div className="min-w-0 flex-1">
            <div
              className={cn("line-clamp-2 break-words font-medium leading-5", bo ? "text-slate-500" : "text-bo-foreground")}
              title={d.tenSanPham}
            >
              {d.tenSanPham || "—"}
            </div>
            {/* Màu / kích cỡ, SKU, mã vạch: xuống dòng theo từng mục khi cột hẹp (không cắt mã). Điện thoại: mã chỉ ngắt ở dấu
                gạch (SKU) hoặc cả mã xuống dòng (mã vạch), không bẻ giữa dãy số như "89350010009 / 48" */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-4 text-bo-muted">
              <MauKichCo dong={d} />
              {d.sku ? <span className="min-w-0 break-all font-mono max-md:break-normal">{d.sku}</span> : null}
              {d.maVach ? (
                <span className="inline-flex min-w-0 items-center gap-1 break-all font-mono max-md:break-normal">
                  <Barcode className="size-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">{t("Mã vạch")} </span>
                  {d.maVach}
                </span>
              ) : null}
            </div>
            {/* Khối hẹp: lô và nút Phân bổ lô nằm dưới tên (cột riêng đang ẩn) */}
            {bo ? null : (
              <div className={cn("mt-2", CHI_DIEN_THOAI)}>
                <LoGoiY dong={d} coNut={coNut} />
                {coNut ? <NutPhanBoLo dong={d} onPhanBoLo={onPhanBoLo} className="mt-2" /> : null}
              </div>
            )}
          </div>
        </div>
      </td>

      <td className={cn(O, AN_DIEN_THOAI)}>
        <LoGoiY dong={d} coNut={coNut} />
      </td>

      <td className={cn(O, duocPhanBoLo ? CUOI_KHI_HEP : O_CUOI)}>
        {bo ? (
          <span title={t("Đơn chứa dòng này đã hủy, số cần nhặt giảm về 0")}>
            <StatusBadge /* i18n-giu-nguyen: StatusBadge tự dịch lúc vẽ */ label="Đã bỏ" />
            <span className="sr-only">{t(": đơn chứa dòng này đã hủy, số cần nhặt giảm về 0")}</span>
          </span>
        ) : (
          <OTienDo da={d.da} can={d.can} />
        )}
      </td>

      {duocPhanBoLo ? (
        <td className={cn(O, O_CUOI, "text-right", AN_DIEN_THOAI)}>
          {coNut ? <NutPhanBoLo dong={d} onPhanBoLo={onPhanBoLo} /> : null}
        </td>
      ) : null}
    </tr>
  );
}
