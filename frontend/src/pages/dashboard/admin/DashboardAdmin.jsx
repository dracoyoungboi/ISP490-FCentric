import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ErrorState from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { useTongQuan } from "./tong-quan/useTongQuan";
import { KY_MAC_DINH, kyTuMayChu } from "./tong-quan/kyXem";
import { CHI_SO_MAC_DINH } from "./tong-quan/tongQuanSoLieu";
import TongQuanHeader from "./tong-quan-moi/TongQuanHeader";
import TrendCard from "./tong-quan-moi/TrendCard";
import Breakdowns from "./tong-quan-moi/Breakdowns";
import StockFlow from "./tong-quan-moi/StockFlow";
import ActionPanel from "./tong-quan-moi/ActionPanel";
import ProductsCard from "./tong-quan-moi/ProductsCard";
import HoatDongGanDay from "./tong-quan-moi/HoatDongGanDay";
import { t } from "@/i18n";

/* Lưới hai cột khi vùng nội dung rộng từ 968px (cột phải 360px), như bản demo: mỗi hàng một cặp thẻ cao bằng nhau —
   biểu đồ với Cần xử lý, Phân bổ với Bán chạy, Tồn kho với Hoạt động gần đây. Hẹp hơn thì một cột theo thứ tự đọc của
   điện thoại: Cần xử lý, biểu đồ, Phân bổ, Tồn kho, Bán chạy, Hoạt động. Dùng container query theo bề rộng trang (thu gọn
   sidebar cũng được tính), không theo bề rộng màn hình. Tên lớp viết đầy đủ (không ghép chuỗi) để Tailwind quét được. */
const LUOI = "grid grid-cols-1 gap-4 @min-[968px]/tq:grid-cols-[minmax(0,1fr)_360px]";
const THU_TU = {
  1: "order-1 @min-[968px]/tq:order-none",
  2: "order-2 @min-[968px]/tq:order-none",
  3: "order-3 @min-[968px]/tq:order-none",
  4: "order-4 @min-[968px]/tq:order-none",
  5: "order-5 @min-[968px]/tq:order-none",
  6: "order-6 @min-[968px]/tq:order-none",
};

/**
 * Tổng quan của quản trị viên (UC 11.1, màn 11.1.1; làm lại 28/11/2026 theo đặc tả bản 2). Dữ liệu từ
 * GET /api/v1/admin/dashboard/tong-quan.
 * Dải đầu trang: kho, kỳ (Hôm nay … 12 tháng, Tùy chọn) kèm khoảng ngày giờ thật và 4 chỉ số (bấm để đổi biểu đồ).
 * Cột chính: biểu đồ, Phân bổ doanh thu, Tồn kho (hiện tại). Cột phải, cao theo thẻ cùng hàng: Cần xử lý, Bán chạy, Hoạt
 * động gần đây.
 * Tồn kho, Cần xử lý, Hoạt động không đổi theo kỳ. Mỗi khối có trạng thái đang tải, lỗi riêng và rỗng (luồng A1, A2).
 */
export default function DashboardAdmin() {
  const [kyChon, setKyChon] = useState({ ma: KY_MAC_DINH });
  const [khoId, setKhoIdGoc] = useState(null);
  const [chon, setChon] = useState(CHI_SO_MAC_DINH);
  // Đổi kho / kỳ mà tải lỗi: đưa bộ lọc về kho, kỳ của số đang hiện (cùng giá trị thì không tải lại)
  const veBoLocCuaSo = (d) => {
    setKhoIdGoc(d.khoId ?? null);
    const kd = kyTuMayChu(d.ky);
    if (!kd) return;
    setKyChon(kd.ma === "tuy_chon" ? { ma: "tuy_chon", tuNgay: kd.tu, denNgay: new Date(kd.den.getTime() - 1) } : { ma: kd.ma });
  };
  const { data, status, refreshing, loiCapNhat, reload } = useTongQuan(kyChon, khoId, veBoLocCuaSo);

  const loading = status === "loading";
  const khoiLoi = new Set(data?.khoiLoi ?? []);
  const loi = (k) => !loading && (khoiLoi.has(k) || (data != null && data[k] == null));
  const dsKho = data?.danhSachKho ?? [];
  const k = kyTuMayChu(data?.ky);
  const setKhoId = (id) => {
    setKhoIdGoc(id);
    // Bấm dòng ở bảng Theo kho: đưa người xem về đầu trang để thấy cả trang đã lọc theo kho đó
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  // Các khối vẽ theo kho của số đang có (data.khoId): vừa đổi kho mà số mới chưa về thì không vẽ số cũ theo kiểu kho mới
  const chung = { data, k, khoId: data ? data.khoId ?? null : khoId, dsKho, loading, onRetry: reload };

  if (status === "error") {
    return (
      <PageContainer>
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <ErrorState title={t("Không tải được trang Tổng quan")} description={t("Kiểm tra kết nối tới máy chủ rồi thử lại.")} onRetry={reload} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="@container/tq flex flex-col gap-4">
      <TongQuanHeader
        data={data}
        k={k}
        kyChon={kyChon}
        setKyChon={setKyChon}
        khoId={khoId}
        setKhoId={setKhoIdGoc}
        dsKho={dsKho}
        loading={loading}
        refreshing={refreshing}
        onReload={reload}
        chon={chon}
        setChon={setChon}
        loiKetQua={loi("ketQua")}
      />

      {/* Giờ số liệu đã ở đầu trang; khối nào lỗi thì tự báo lỗi và có nút Thử lại, nên dải này không liệt kê lại */}
      {loiCapNhat ? <Banner onRetry={reload}>{t("Không cập nhật được số liệu mới.")}</Banner> : null}

      <div className={cn(LUOI, "transition-opacity", refreshing && !loading && "opacity-60")} aria-busy={refreshing || undefined}>
        <TrendCard {...chung} chon={chon} error={loi("bieuDo")} className={THU_TU[2]} />
        <ActionPanel {...chung} error={loi("viecCanXuLy")} className={THU_TU[1]} />
        <Breakdowns {...chung} error={loi("phanBo")} className={THU_TU[3]} />
        <ProductsCard {...chung} error={loi("banChay")} className={THU_TU[5]} />
        <StockFlow {...chung} setKhoId={setKhoId} error={loi("tonKho")} className={THU_TU[4]} />
        <HoatDongGanDay {...chung} error={loi("hoatDong")} className={THU_TU[6]} />
      </div>
    </PageContainer>
  );
}

function Banner({ children, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" onClick={onRetry} className="cursor-pointer rounded-md border border-amber-300 bg-bo-surface px-2.5 py-1 text-xs font-medium hover:bg-amber-50">
        {t("Thử lại")}
      </button>
    </div>
  );
}
