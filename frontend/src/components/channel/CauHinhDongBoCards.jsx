import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { ChonPhuongAn, DongCaiDat, DongCongTac, OSoNho, TheCaiDat } from "@/components/channel/KhuonCaiDat";
import { quyTacTonKho } from "@/components/channel/cauHinhDongBo";
import { tinhSoTonDayLenSan } from "@/constants/channel";

const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");

const CHE_DO_TON = [
  { value: "bang", label: "Bằng số khả dụng" },
  { value: "tuy", label: "Tùy chỉnh" },
];

/** Ghi chú cuối thẻ (nền nhạt, biểu tượng i), vd. giờ sale lớn của Lazada. */
function GhiChu({ children }) {
  return (
    <div className="px-6 py-4">
      <p className="flex items-start gap-2 rounded-md bg-bo-surface-subtle px-3 py-2 text-[12.5px] leading-5 text-bo-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </p>
    </div>
  );
}

/**
 * Thẻ "Tồn kho": công tắc tự động cập nhật và cách tính số lượng hiện trên sàn.
 * Dùng chung cho trang Cấu hình và bước 2 của Thiết lập. Quy tắc áp dụng cho mọi lần đẩy tồn
 * (định kỳ, đẩy ngay khi tồn thấp, bấm Đẩy tồn ngay) nên vẫn sửa được khi tắt tự động.
 * `dongKho`: dòng kho trên sàn thay cho dòng vị trí kho Shopify; `ghiChu`: câu nhắc riêng của sàn ở cuối thẻ.
 */
export function TheTonKho({ moTa, values, errors = {}, onChange, cheDo, onDoiCheDo, cauHinh, khoSan, disabled = false, tenSan = "Shopify", dongKho, ghiChu }) {
  const chuKy = cauHinh?.chuKyPhut ?? 10;
  const nguongNgay = cauHinh?.nguongDayNgay ?? 3;
  const quyTac = quyTacTonKho(values);
  const viDu = (kd) => soVN(tinhSoTonDayLenSan(kd, quyTac));

  return (
    <TheCaiDat title="Tồn kho" description={moTa}>
      <DongCongTac
        title={`Tự động cập nhật tồn lên ${tenSan}`}
        description={`Mỗi ${chuKy} phút, và ngay khi tồn dưới ${nguongNgay} cái.`}
        checked={values.tuDongDayTon}
        onCheckedChange={(checked) => onChange("tuDongDayTon", checked)}
        disabled={disabled}
      />
      <DongCaiDat
        title={`Số lượng hiện trên ${tenSan}`}
        control={
          <ChonPhuongAn label={`Cách tính số lượng hiện trên ${tenSan}`} value={cheDo} options={CHE_DO_TON} onChange={onDoiCheDo} disabled={disabled} />
        }
      >
        {cheDo === "tuy" ? (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded-lg bg-bo-surface-subtle px-4 py-3.5">
            <OSoNho
              label="Tỷ lệ"
              unit="%"
              min={1}
              max={100}
              value={values.tyLeDayTon}
              onChange={(value) => onChange("tyLeDayTon", value)}
              error={errors.tyLeDayTon}
              disabled={disabled}
            />
            <OSoNho
              label="Giữ lại"
              unit="cái"
              min={0}
              value={values.tonDem}
              onChange={(value) => onChange("tonDem", value)}
              error={errors.tonDem}
              disabled={disabled}
            />
            <OSoNho
              label="Hiện 0 khi còn ≤"
              unit="cái"
              min={0}
              value={values.nguongVe0}
              onChange={(value) => onChange("nguongVe0", value)}
              error={errors.nguongVe0}
              disabled={disabled}
            />
            <p className="basis-full text-[13px] text-bo-muted">
              Còn 20 cái thì {tenSan} hiện <span className="font-semibold tabular-nums text-bo-heading">{viDu(20)}</span>; còn 3 cái thì hiện{" "}
              <span className="font-semibold tabular-nums text-bo-heading">{viDu(3)}</span>.
            </p>
          </div>
        ) : null}
      </DongCaiDat>
      {dongKho ?? (
        <DongCaiDat
          title="Vị trí kho trên Shopify"
          description="Số tồn được ghi vào địa điểm mặc định của cửa hàng Shopify (Settings › Locations)."
          control={
            <span className={`max-w-[240px] truncate text-sm ${khoSan ? "text-bo-foreground" : "text-bo-muted"}`}>
              {khoSan || "Không đọc được vị trí từ Shopify"}
            </span>
          }
        />
      )}
      {ghiChu ? <GhiChu>{ghiChu}</GhiChu> : null}
    </TheCaiDat>
  );
}

/**
 * Thẻ "Đơn hàng": công tắc tự động lấy đơn, cách xử lý đơn hủy trên sàn và chu kỳ chạy.
 * `children`: dòng thêm của bước 3 Thiết lập (lấy đơn cũ), đặt ngay dưới công tắc.
 * `duongDanDoiChuKy`: có thì hiện liên kết "Đổi" cạnh chu kỳ (chu kỳ dùng chung cho mọi kênh, sửa ở Cấu hình › Đồng bộ kênh bán).
 * Sàn ủy quyền: `nhanCongTac` ("Tự động lấy đơn từ Lazada"), `khachMacDinh` (khách gán cho đơn sàn), `ghiChu` (cách sàn báo đơn mới).
 */
export function TheDonHang({
  moTa,
  values,
  onChange,
  cauHinh,
  duongDanDoiChuKy,
  disabled = false,
  children,
  tenSan = "Shopify",
  tienToDon = "SHP",
  nhanCongTac = "Tự động lấy đơn mới",
  khachMacDinh,
  ghiChu,
}) {
  const chuKy = cauHinh?.chuKyPhut ?? 10;
  return (
    <TheCaiDat title="Đơn hàng" description={moTa}>
      {/* Chu kỳ chỉ ghi ở dòng "Chu kỳ chạy"; câu dưới công tắc chỉ nói số đơn mang tiền tố gì */}
      <DongCongTac
        title={nhanCongTac}
        description={`Đơn về FCentric mang số ${tienToDon}-… để dễ nhận ra.`}
        checked={values.tuDongLayDon}
        onCheckedChange={(checked) => onChange("tuDongLayDon", checked)}
        disabled={disabled}
      />
      {children}
      {/* Job lấy đơn hủy đơn theo sàn; đơn đã xuất kho, hoàn thành hoặc hoàn trả được giữ nguyên. */}
      <DongCaiDat giaTriChu title={`Đơn hủy trên ${tenSan}`} control={<span className="text-sm text-bo-foreground">Hủy theo nếu chưa xuất kho</span>} />
      {khachMacDinh ? (
        <DongCaiDat
          giaTriChu
          title="Khách hàng"
          description="Tên và số điện thoại người nhận do sàn che một phần."
          control={<span className="text-sm text-bo-foreground">{`Gán khách "${khachMacDinh}"`}</span>}
        />
      ) : null}
      <DongCaiDat
        giaTriChu
        title="Chu kỳ chạy"
        description="Dùng chung cho mọi kênh."
        control={
          <span className="text-sm tabular-nums text-bo-foreground">
            {chuKy} phút
            {duongDanDoiChuKy ? (
              <>
                {" · "}
                {/* Điện thoại: vùng chạm 44 px (lề âm giữ nguyên chỗ chữ) */}
                <Link
                  to={duongDanDoiChuKy}
                  className="rounded-sm font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:-mx-3 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:px-3"
                >
                  Đổi
                </Link>
              </>
            ) : null}
          </span>
        }
      />
      {ghiChu ? <GhiChu>{ghiChu}</GhiChu> : null}
    </TheCaiDat>
  );
}
