import { Link } from "react-router-dom";
import { ChonPhuongAn, DongCaiDat, DongCongTac, OSoNho, TheCaiDat } from "@/components/channel/KhuonCaiDat";
import { quyTacTonKho } from "@/components/channel/cauHinhDongBo";
import { tinhSoTonDayLenSan } from "@/constants/channel";

const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");

const CHE_DO_TON = [
  { value: "bang", label: "Bằng số khả dụng" },
  { value: "tuy", label: "Tùy chỉnh" },
];

/**
 * Thẻ "Tồn kho": công tắc tự động cập nhật và cách tính số lượng hiện trên Shopify.
 * Dùng chung cho trang Cấu hình và bước 2 của Thiết lập. Quy tắc áp dụng cho mọi lần đẩy tồn
 * (định kỳ, đẩy ngay khi tồn thấp, bấm Đẩy tồn ngay) nên vẫn sửa được khi tắt tự động.
 */
export function TheTonKho({ moTa, values, errors = {}, onChange, cheDo, onDoiCheDo, cauHinh, khoSan, disabled = false }) {
  const chuKy = cauHinh?.chuKyPhut ?? 10;
  const nguongNgay = cauHinh?.nguongDayNgay ?? 3;
  const quyTac = quyTacTonKho(values);
  const viDu = (kd) => soVN(tinhSoTonDayLenSan(kd, quyTac));

  return (
    <TheCaiDat title="Tồn kho" description={moTa}>
      <DongCongTac
        title="Tự động cập nhật tồn lên Shopify"
        description={`Mỗi ${chuKy} phút, và ngay khi tồn dưới ${nguongNgay} cái.`}
        checked={values.tuDongDayTon}
        onCheckedChange={(checked) => onChange("tuDongDayTon", checked)}
        disabled={disabled}
      />
      <DongCaiDat
        title="Số lượng hiện trên Shopify"
        control={
          <ChonPhuongAn label="Cách tính số lượng hiện trên Shopify" value={cheDo} options={CHE_DO_TON} onChange={onDoiCheDo} disabled={disabled} />
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
              Còn 20 cái thì Shopify hiện <span className="font-semibold tabular-nums text-bo-heading">{viDu(20)}</span>; còn 3 cái thì hiện{" "}
              <span className="font-semibold tabular-nums text-bo-heading">{viDu(3)}</span>.
            </p>
          </div>
        ) : null}
      </DongCaiDat>
      <DongCaiDat
        title="Vị trí kho trên Shopify"
        control={<span className="max-w-[240px] truncate text-sm text-bo-foreground">{khoSan || "Vị trí chính của cửa hàng"}</span>}
      />
    </TheCaiDat>
  );
}

/**
 * Thẻ "Đơn hàng": công tắc tự động lấy đơn, cách xử lý đơn hủy trên sàn và chu kỳ chạy.
 * `children`: dòng thêm của bước 3 Thiết lập (lấy đơn cũ), đặt ngay dưới công tắc.
 * `duongDanDoiChuKy`: có thì hiện liên kết "Đổi" cạnh chu kỳ (chu kỳ dùng chung cho mọi kênh, sửa ở Cấu hình hệ thống kho).
 */
export function TheDonHang({ moTa, values, onChange, cauHinh, duongDanDoiChuKy, disabled = false, children }) {
  const chuKy = cauHinh?.chuKyPhut ?? 10;
  return (
    <TheCaiDat title="Đơn hàng" description={moTa}>
      <DongCongTac
        title="Tự động lấy đơn mới"
        description={`Thành đơn bán hàng mã SHP-, mỗi ${chuKy} phút.`}
        checked={values.tuDongLayDon}
        onCheckedChange={(checked) => onChange("tuDongLayDon", checked)}
        disabled={disabled}
      />
      {children}
      {/* Job lấy đơn hủy đơn theo sàn; đơn đã xuất kho, hoàn thành hoặc hoàn trả được giữ nguyên. */}
      <DongCaiDat title="Đơn hủy trên Shopify" control={<span className="text-sm text-bo-foreground">Hủy theo nếu chưa xuất kho</span>} />
      <DongCaiDat
        title="Chu kỳ chạy"
        description="Dùng chung cho mọi kênh."
        control={
          <span className="text-sm tabular-nums text-bo-foreground">
            {chuKy} phút
            {duongDanDoiChuKy ? (
              <>
                {" · "}
                <Link to={duongDanDoiChuKy} className="font-medium text-bo-primary hover:underline">
                  Đổi
                </Link>
              </>
            ) : null}
          </span>
        }
      />
    </TheCaiDat>
  );
}
