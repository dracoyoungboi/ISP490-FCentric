import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ErrorState from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { useTongQuan } from "./tong-quan/useTongQuan";
import { KY_MAC_DINH, gioPhut } from "./tong-quan/tongQuanFormat";
import TongQuanHeader from "./tong-quan-moi/TongQuanHeader";
import KpiStrip from "./tong-quan-moi/KpiStrip";
import TrendCard from "./tong-quan-moi/TrendCard";
import ActionPanel from "./tong-quan-moi/ActionPanel";
import { ChannelBreakdown, KhoBreakdown } from "./tong-quan-moi/Breakdowns";
import StockFlow from "./tong-quan-moi/StockFlow";
import ProductsCard from "./tong-quan-moi/ProductsCard";

const TEN_KHOI = {
  chiSo: "Chỉ số hôm nay",
  doanhThu: "Doanh thu",
  doanhThuTheoKho: "Doanh thu theo kho",
  theoKenh: "Doanh thu theo kênh",
  viecCanXuLy: "Việc cần xử lý",
  tonKho: "Tồn kho",
  nhapXuat: "Nhập – xuất kho",
  sanPhamBanChay: "Sản phẩm bán chạy",
  hangCanBoSung: "Hàng cần bổ sung",
  hoatDongGanDay: "Hoạt động gần đây",
};

/**
 * Tổng quan của quản trị viên (UC 11.1, màn 11.1.1). Dữ liệu từ GET /api/v1/admin/dashboard/tong-quan.
 * Bố cục (phương án 12/10/2026): dải 4 chỉ số → biểu đồ chính + việc cần xử lý → theo kho, theo kênh
 * → tồn kho, sản phẩm. Mỗi khối có trạng thái đang tải, lỗi riêng và rỗng (luồng A1, A2).
 */
export default function DashboardAdmin() {
  const [ky, setKy] = useState(KY_MAC_DINH);
  const [khoId, setKhoId] = useState(null);
  const { data, status, refreshing, loiCapNhat, reload } = useTongQuan(ky, khoId);

  const loading = status === "loading";
  const khoiLoi = new Set(data?.khoiLoi ?? []);
  const loi = (k) => !loading && (khoiLoi.has(k) || (data != null && data[k] == null));
  const dsKho = data?.danhSachKho ?? [];
  const common = { data, ky, khoId, loading, onRetry: reload };

  if (status === "error") {
    return (
      <PageContainer>
        <h1 className="mb-5 text-2xl font-semibold tracking-[-0.01em] text-bo-foreground">Tổng quan</h1>
        <div className="rounded-xl border border-[#e6e9ef] bg-white">
          <ErrorState title="Không tải được trang Tổng quan" description="Kiểm tra kết nối tới máy chủ rồi thử lại." onRetry={reload} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
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
      />

      {loiCapNhat ? (
        <Banner onRetry={reload}>Không cập nhật được số liệu mới. Đang hiển thị số liệu lúc {gioPhut(data?.thoiDiem)}.</Banner>
      ) : khoiLoi.size ? (
        <Banner onRetry={reload}>Chưa tải được: {[...khoiLoi].map((k) => TEN_KHOI[k] ?? k).join(", ")}. Các khối khác vẫn hiển thị bình thường.</Banner>
      ) : null}

      <div className={cn("space-y-5 transition-opacity", refreshing && !loading && "opacity-60")} aria-busy={refreshing || undefined}>
        <KpiStrip {...common} loiChiSo={loi("chiSo")} loiTonKho={loi("tonKho")} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <TrendCard {...common} error={loi("doanhThu")} />
          </div>
          <div className="flex xl:col-span-4 [&>*]:flex-1">
            <ActionPanel {...common} loiViec={loi("viecCanXuLy")} loiHoatDong={loi("hoatDongGanDay")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <KhoBreakdown {...common} loiDoanhThu={loi("doanhThuTheoKho")} loiTonKho={loi("tonKho")} />
          <ChannelBreakdown {...common} error={loi("theoKenh")} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="flex xl:col-span-4 [&>*]:flex-1">
            <StockFlow {...common} loiTonKho={loi("tonKho")} loiNhapXuat={loi("nhapXuat")} />
          </div>
          <div className="flex min-w-0 xl:col-span-8 [&>*]:flex-1">
            <ProductsCard {...common} loiBanChay={loi("sanPhamBanChay")} loiBoSung={loi("hangCanBoSung")} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function Banner({ children, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" onClick={onRetry} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-50">
        Thử lại
      </button>
    </div>
  );
}
