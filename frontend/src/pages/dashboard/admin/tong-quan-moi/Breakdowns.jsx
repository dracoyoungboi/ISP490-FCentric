import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Delta, LE } from "./ui";
import { MAU2 } from "./mau";
import GiaiThich from "./GiaiThich";
import { bienDong, docNgay, formatPhanTram, formatSo, formatTienNgan, tyLe } from "../tong-quan/tongQuanFormat";
import { soNgayCuaKy } from "../tong-quan/kyXem";
import { gopNhom } from "../tong-quan/tongQuanSoLieu";
import { t, tDuLieu } from "@/i18n";

/** Kênh POS / trực tiếp: máy chủ trả tên cố định tiếng Việt nên dịch; tên kênh sàn là dữ liệu. */
const tenKenhHien = (k) => (k.maKenh === "POS" || k.maKenh === "TRUC_TIEP" ? t(k.tenKenh) : tDuLieu(k.tenKenh));

/* Lưới cột giống nhau ở cả hai danh sách để số thẳng hàng: tên | doanh thu | tỷ trọng | cột thứ tư. Bản hẹp (bỏ cột Tỷ
   trọng, thanh mảnh xuống dưới tên) khi thẻ ≤ 520px và khi hai danh sách nằm cạnh nhau ở thẻ 680–1099px.
   Điện thoại (≤ 440px): tên rộng hết bên trái; doanh thu và cột thứ tư xếp chồng bên phải. */
const LUOI = [
  "grid grid-cols-[minmax(0,1fr)_112px_124px_84px] items-center gap-x-4",
  "@max-[520px]:grid-cols-[minmax(0,1fr)_104px_64px] @max-[520px]:gap-x-2.5",
  "@min-[680px]:@max-[1100px]:grid-cols-[minmax(0,1fr)_104px_76px] @min-[680px]:@max-[1100px]:gap-x-2.5",
  "@max-[440px]:grid-cols-[minmax(0,1fr)_auto] @max-[440px]:gap-x-3 @max-[440px]:gap-y-0.5",
].join(" ");
const AN_HEP = "@max-[520px]:hidden @min-[680px]:@max-[1100px]:hidden";
const HIEN_HEP = "@max-[520px]:block @min-[680px]:@max-[1100px]:block";
const DOC_HEP = "@max-[520px]:inline @min-[680px]:@max-[1100px]:inline";

/**
 * Phân bổ doanh thu của kỳ (đặc tả bản 2, mục 4, 10).
 * - Tất cả kho: Kho bán (doanh thu, tỷ trọng, so kỳ trước) | Kênh bán (doanh thu, tỷ trọng, Đơn hoàn "2/14").
 * - Một kho: Nhóm hàng (danh mục gốc, 4 nhóm hoặc 3 + Khác) | Kênh bán của kho; kho là cửa hàng thì Nhân viên bán.
 * - Kỳ 1 ngày: cột Đơn hoàn đổi thành Số đơn (đơn mới bán chưa kịp bị hoàn); Hôm nay cột so sánh ghi số tiền tuần trước.
 */
export default function Breakdowns({ data, k, khoId, dsKho, loading, error, onRetry, className }) {
  const pb = data?.phanBo;
  const homNay = k?.ma === "hom_nay";
  const motNgay = k ? soNgayCuaKy(k) <= 1 : false;
  const tuTruoc = k?.tuTruoc;
  const khoXem = khoId == null ? null : dsKho.find((x) => x.id === khoId);
  const tenKho = khoXem?.tenKho ?? t("Tất cả kho");

  const trai = khoId == null
    ? (pb?.theoKho ?? []).map((r) => ({
        key: r.khoId,
        ten: r.tenKho ?? t("Kho đã ngừng hoạt động"),
        doanhThu: r.doanhThu,
        truoc: r.doanhThuTruoc,
        moi: !r.doanhThuTruoc && r.ngayMo && tuTruoc && docNgay(r.ngayMo) > tuTruoc,
        chiTiet: t("{{ten}}: {{soDon}} đơn đã bán", { ten: r.tenKho ?? "", soDon: formatSo(r.soDon), count: Number(r.soDon) }),
      }))
    : gopNhom(pb?.theoNhom).map((r) => ({
        key: r.danhMucId ?? "chua",
        ten: r.khac ? t("Khác") : r.tenNhom ? tDuLieu(r.tenNhom) : t("Chưa phân loại"),
        doanhThu: r.doanhThu,
        truoc: r.doanhThuTruoc,
      }));
  // Tỷ trọng chia trên tổng phần dương: dòng âm (trả nhiều hơn bán) không làm dòng khác vượt 100%.
  const tongDuong = (ds) => ds.reduce((s, x) => s + Math.max(0, x.doanhThu), 0);
  const tongTrai = tongDuong(trai);

  const nhanVien = khoXem && !khoXem.laKhoTong ? pb?.theoNhanVien ?? [] : null;
  const kenh = (pb?.theoKenh ?? []).filter((x) => x.doanhThu !== 0 || x.soDonXuat > 0 || x.doanhThuTruoc !== 0);
  const tongKenh = tongDuong(kenh);
  const tongNv = tongDuong(nhanVien ?? []);

  const trong = !loading && !error && pb && trai.every((r) => !r.doanhThu && !r.truoc) && !kenh.length && !(nhanVien ?? []).length;

  const cot4Trai = homNay ? t("Tuần trước") : t("So kỳ trước");
  const soSanh = (r) => {
    if (homNay) return <span className="tabular-nums text-bo-muted">{formatTienNgan(r.truoc)}</span>;
    if (r.moi) return <span className="text-bo-muted">{t("Mới mở")}</span>;
    const bd = bienDong(r.doanhThu, r.truoc);
    return bd ? <Delta bd={bd} /> : <span className="text-bo-muted">—</span>;
  };

  return (
    <Card
      className={className}
      title={t("Phân bổ doanh thu")}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={trong}
      emptyIcon={Store}
      emptyText={t("Chưa có đơn xuất kho trong kỳ.")}
      bodyClassName="grid grid-cols-1 @min-[680px]:grid-cols-2"
    >
      <div className={cn(LE, "flex min-w-0 flex-col gap-0.5 pb-3.5 pt-3.5")}>
        {khoId == null ? (
          <DauCot
            ten={<GiaiThich tieuDe={t("Kho bán")} moTa={t("Kho xuất hàng cho đơn. Đơn tại quầy tính cho cửa hàng; đơn online và đơn sàn tính cho kho gắn với kênh ở Cấu hình kênh bán.")}>{t("Kho bán")}</GiaiThich>}
            cot4={
              <GiaiThich
                align="end"
                tieuDe={cot4Trai}
                moTa={homNay
                  ? t("Doanh thu của kho từ 00:00 tới cùng giờ này, cùng thứ tuần trước. Hôm nay mới qua vài giờ nên ghi số tiền, không ghi %, tránh những con số như +1.600%.")
                  : t("Doanh thu của kho trong kỳ đang xem so với kỳ so sánh cùng độ dài. Kho mở cửa sau đầu kỳ so sánh ghi Mới mở thay cho %.")}
              >
                {cot4Trai}
              </GiaiThich>
            }
          />
        ) : (
          <DauCot
            ten={<GiaiThich tieuDe={t("Nhóm hàng")} moTa={t("Doanh thu của {{kho}} chia theo danh mục cấp gốc của sản phẩm; các nhóm nhỏ gộp vào Khác để cộng đủ 100%. Khi xem tất cả kho, cột này là Kho bán.", { kho: tenKho })}>{t("Nhóm hàng")}</GiaiThich>}
            cot4={cot4Trai}
          />
        )}
        {trai.length === 0 ? (
          <p className="py-2 text-[13px] text-bo-muted">{t("Chưa có đơn xuất kho trong kỳ.")}</p>
        ) : (
          trai.map((r) => (
            <DongThanh key={r.key} ten={r.ten} phanTram={tyLe(Math.max(0, r.doanhThu), tongTrai)} giaTri={formatTienNgan(r.doanhThu)} cot4={soSanh(r)} chiTiet={r.chiTiet} mo={!r.doanhThu} />
          ))
        )}
      </div>

      <div className={cn(LE, "flex min-w-0 flex-col gap-0.5 border-t border-[#eef1f5] pb-3.5 pt-3.5 @min-[680px]:border-l @min-[680px]:border-t-0")}>
        {nhanVien ? (
          <>
            <DauCot
              ten={<GiaiThich tieuDe={t("Nhân viên bán")} moTa={t("Doanh thu bán tại quầy của {{kho}} theo người lập đơn, đã trừ hàng khách trả. Số đơn là số đơn bán trong kỳ.", { kho: tenKho })}>{t("Nhân viên bán")}</GiaiThich>}
              cot4={t("Số đơn")}
            />
            {nhanVien.length === 0 ? (
              <p className="py-2 text-[13px] text-bo-muted">{t("Chưa có đơn bán tại quầy trong kỳ.")}</p>
            ) : (
              nhanVien.map((x) => (
                <DongThanh key={x.nguoiId} ten={tDuLieu(x.hoTen) || t("Chưa rõ người lập")} phanTram={tyLe(Math.max(0, x.doanhThu), tongNv)} giaTri={formatTienNgan(x.doanhThu)} cot4={<span className="tabular-nums">{formatSo(x.soDon)}</span>} nhanHep={t("Đơn")} />
              ))
            )}
          </>
        ) : (
          <>
            <DauCot
              ten={t("Kênh bán")}
              cot4={
                motNgay ? (
                  t("Số đơn")
                ) : (
                  <GiaiThich
                    align="end"
                    tieuDe={t("Đơn hoàn")}
                    moTa={t("Đơn bán trong kỳ mà tới nay khách đã trả lại hoặc sàn hoàn về. Đơn mới bán vẫn có thể bị hoàn sau này, nên tỷ lệ của kỳ gần đây thường thấp hơn thực tế; xem kỳ Hôm nay, Hôm qua thì cột này đổi thành Số đơn. \"2/14\" là 2 đơn hoàn trên 14 đơn bán của kênh.")}
                    dong={kenh.filter((x) => x.soDonXuat > 0).map((x) => [tenKenhHien(x), `${formatSo(x.soDonHoan)}/${formatSo(x.soDonXuat)} = ${formatPhanTram(tyLe(x.soDonHoan, x.soDonXuat))}`])}
                    ghiChu={t("Kênh ít đơn thì tỷ lệ dao động mạnh, xem số đơn trước khi kết luận.")}
                  >
                    {t("Đơn hoàn")}
                  </GiaiThich>
                )
              }
            />
            {kenh.length === 0 ? (
              <p className="py-2 text-[13px] text-bo-muted">{t("Chưa có đơn xuất kho trong kỳ.")}</p>
            ) : (
              kenh.map((x) => (
                <DongThanh
                  key={x.maKenh}
                  ten={tenKenhHien(x)}
                  phanTram={tyLe(Math.max(0, x.doanhThu), tongKenh)}
                  giaTri={formatTienNgan(x.doanhThu)}
                  mo={!x.doanhThu}
                  nhanHep={motNgay ? t("Đơn") : t("Hoàn")}
                  cot4={
                    motNgay ? (
                      <span className={cn("tabular-nums", !x.soDonXuat && "text-bo-muted")}>{formatSo(x.soDonXuat)}</span>
                    ) : (
                      <span className={cn("tabular-nums", !x.soDonHoan && "text-bo-muted")}>{x.soDonXuat ? `${formatSo(x.soDonHoan)}/${formatSo(x.soDonXuat)}` : "—"}</span>
                    )
                  }
                />
              ))
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function DauCot({ ten, cot4 }) {
  return (
    <div className={cn(LUOI, "pb-1 text-xs font-medium leading-4 text-bo-muted")}>
      <span>{ten}</span>
      <span className="text-right">{t("Doanh thu")}</span>
      <span className={cn("text-right", AN_HEP)}>{t("Tỷ trọng")}</span>
      <span className="whitespace-nowrap text-right @max-[440px]:hidden">{cot4}</span>
    </div>
  );
}

function DongThanh({ ten, phanTram, giaTri, cot4, nhanHep, chiTiet, mo }) {
  const thanh = { width: `${Math.max(0, Math.min(100, phanTram ?? 0))}%`, background: MAU2.chinh, opacity: mo ? 0.4 : 1 };
  return (
    <div className={cn(LUOI, "-mx-2 rounded-md px-2 py-2")} title={chiTiet}>
      <div className="min-w-0 @max-[440px]:row-span-2">
        <span className={cn("block truncate text-sm font-medium @max-[440px]:whitespace-normal", mo ? "text-bo-muted" : "text-bo-foreground")}>
          {ten}
          <span className={cn("sr-only hidden", DOC_HEP)}>{t(", tỷ trọng {{phanTram}}", { phanTram: formatPhanTram(phanTram, 0) })}</span>
        </span>
        <span className={cn("mt-1.5 hidden h-1 overflow-hidden rounded-full bg-[#eef1f5]", HIEN_HEP)} aria-hidden="true">
          <span className="block h-full rounded-full" style={thanh} />
        </span>
      </div>
      <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-bo-foreground">{giaTri}</span>
      <span className={cn("flex items-center justify-end gap-2", AN_HEP)}>
        <span className="h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-[#eef1f5]" aria-hidden="true">
          <span className="block h-full rounded-full" style={thanh} />
        </span>
        <span className="w-9 shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-bo-muted">
          <span className="sr-only">{t("Tỷ trọng")} </span>
          {formatPhanTram(phanTram, 0)}
        </span>
      </span>
      <span className="whitespace-nowrap text-right text-sm @max-[440px]:text-xs">
        {nhanHep ? <span className="hidden text-bo-muted @max-[440px]:inline">{nhanHep} </span> : null}
        {cot4}
      </span>
    </div>
  );
}
