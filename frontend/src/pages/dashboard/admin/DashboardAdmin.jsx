import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ErrorState from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { useTongQuan } from "./tong-quan/useTongQuan";
import { KY_MAC_DINH } from "./tong-quan/tongQuanFormat";
import { CHI_SO_MAC_DINH } from "./tong-quan/tongQuanSoLieu";
import TongQuanHeader from "./tong-quan-moi/TongQuanHeader";
import TrendCard from "./tong-quan-moi/TrendCard";
import Breakdowns from "./tong-quan-moi/Breakdowns";
import StockFlow from "./tong-quan-moi/StockFlow";
import HomNayCard from "./tong-quan-moi/HomNayCard";
import ActionPanel from "./tong-quan-moi/ActionPanel";
import ProductsCard from "./tong-quan-moi/ProductsCard";
import HoatDongGanDay from "./tong-quan-moi/HoatDongGanDay";

/* Hai cột khi vùng nội dung rộng từ 968px (cột chính ≥ 600px, cột phải 352px); hẹp hơn thì một cột
   theo thứ tự đọc của điện thoại: Cần xử lý, Hôm nay, biểu đồ, Phân bổ, Tồn kho, Bán chạy, Hoạt động.
   Dùng container query theo bề rộng trang (thu gọn sidebar cũng được tính), không theo bề rộng màn hình.
   Tên lớp viết đầy đủ (không ghép chuỗi) để Tailwind quét được. */
const HANG = "flex flex-col gap-4 @min-[968px]/tq:flex-row @min-[968px]/tq:items-start";
const COT_CHINH = "contents @min-[968px]/tq:flex @min-[968px]/tq:min-w-0 @min-[968px]/tq:flex-[999_1_600px] @min-[968px]/tq:flex-col @min-[968px]/tq:gap-4";
const COT_PHAI = "contents @min-[968px]/tq:flex @min-[968px]/tq:min-w-0 @min-[968px]/tq:flex-[1_1_352px] @min-[968px]/tq:flex-col @min-[968px]/tq:gap-4";
const THU_TU = {
  1: "order-1 @min-[968px]/tq:order-none",
  2: "order-2 @min-[968px]/tq:order-none",
  3: "order-3 @min-[968px]/tq:order-none",
  4: "order-4 @min-[968px]/tq:order-none",
  5: "order-5 @min-[968px]/tq:order-none",
  6: "order-6 @min-[968px]/tq:order-none",
  7: "order-7 @min-[968px]/tq:order-none",
};

/**
 * Tổng quan của quản trị viên (UC 11.1, màn 11.1.1). Dữ liệu từ GET /api/v1/admin/dashboard/tong-quan.
 * Bố cục Kiểu 3 (chốt 17/10/2026): dải đầu trang gồm phạm vi và 4 chỉ số của kỳ (bấm để đổi biểu đồ);
 * cột chính: biểu đồ theo ngày so với kỳ trước, phân bổ doanh thu, tồn kho; cột phải: cần xử lý (việc phải làm
 * đứng đầu), hôm nay, bán chạy, hoạt động gần đây. Mỗi khối có trạng thái đang tải, lỗi riêng và rỗng (luồng A1, A2).
 */
export default function DashboardAdmin() {
  const [ky, setKy] = useState(KY_MAC_DINH);
  const [khoId, setKhoId] = useState(null);
  const [chon, setChon] = useState(CHI_SO_MAC_DINH);
  const { data, status, refreshing, loiCapNhat, reload } = useTongQuan(ky, khoId);

  const loading = status === "loading";
  const khoiLoi = new Set(data?.khoiLoi ?? []);
  const loi = (k) => !loading && (khoiLoi.has(k) || (data != null && data[k] == null));
  const dsKho = data?.danhSachKho ?? [];
  const chung = { data, ky, khoId, loading, onRetry: reload };

  if (status === "error") {
    return (
      <PageContainer>
        <div className="rounded-lg border border-bo-border bg-white">
          <ErrorState title="Không tải được trang Tổng quan" description="Kiểm tra kết nối tới máy chủ rồi thử lại." onRetry={reload} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="@container/tq flex flex-col gap-4">
      <TongQuanHeader
        data={data}
        ky={ky}
        setKy={setKy}
        khoId={khoId}
        setKhoId={setKhoId}
        dsKho={dsKho}
        loading={loading}
        refreshing={refreshing}
        onReload={reload}
        chon={chon}
        setChon={setChon}
        loiDoanhThu={loi("doanhThu")}
      />

      {/* Giờ số liệu đã ở đầu trang; khối nào lỗi thì tự báo lỗi và có nút Thử lại, nên dải này không liệt kê lại */}
      {loiCapNhat ? <Banner onRetry={reload}>Không cập nhật được số liệu mới.</Banner> : null}

      <div
        className={cn(HANG, "transition-opacity", refreshing && !loading && "opacity-60")}
        aria-busy={refreshing || undefined}
      >
        <div className={COT_CHINH}>
          <TrendCard {...chung} chon={chon} error={loi("doanhThu")} className={THU_TU[3]} />
          <Breakdowns {...chung} loiKho={loi("doanhThuTheoKho")} loiKenh={loi("theoKenh")} className={THU_TU[4]} />
          <StockFlow {...chung} loiTonKho={loi("tonKho")} loiBoSung={loi("hangCanBoSung")} loiNhapXuat={loi("nhapXuat")} className={THU_TU[5]} />
        </div>
        <div className={COT_PHAI}>
          <ActionPanel {...chung} error={loi("viecCanXuLy")} className={THU_TU[1]} />
          <HomNayCard {...chung} error={loi("chiSo")} className={THU_TU[2]} />
          <ProductsCard {...chung} error={loi("sanPhamBanChay")} className={THU_TU[6]} />
          <HoatDongGanDay {...chung} error={loi("hoatDongGanDay")} className={THU_TU[7]} />
        </div>
      </div>
    </PageContainer>
  );
}

function Banner({ children, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" onClick={onRetry} className="cursor-pointer rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-50">
        Thử lại
      </button>
    </div>
  );
}
