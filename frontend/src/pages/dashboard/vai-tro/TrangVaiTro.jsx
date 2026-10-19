import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ErrorState from "@/components/shared/ErrorState";
import KhoLamViecSelect from "@/components/shared/KhoLamViecSelect";
import { hienKhoLamViecODaySidebar } from "@/components/backoffice/sidebar.config";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";
import { KHO_LAM_VIEC_EVENT, getKhoLamViecId } from "@/utils/khoLamViec";
import { ChanTrang } from "./khung";
import { TEN_KHOI, gioPhut } from "./soLieuVaiTro";
import { useTongQuanVaiTro } from "./useTongQuanVaiTro";

/**
 * Khung chung của Tổng quan theo vai trò: tiêu đề ẩn (h1), ô "Nơi làm việc" (chỉ quản lý kho — nhân viên đã thấy
 * và đổi kho ở đáy sidebar), trạng thái đang tải / lỗi / khối lỗi, chân trang giờ số liệu + tải lại.
 * Nội dung do từng vai trò vẽ qua `children(ctx)`: ctx = { data, loading, loi(khoi), reload }.
 */
export default function TrangVaiTro({ vaiTro, theoKho = false, children }) {
  const [khoId, setKhoId] = useState(() => (theoKho ? getKhoLamViecId() : null));
  const chonKhoTrongTrang = theoKho && !hienKhoLamViecODaySidebar(localStorage.getItem("role"));

  // Đổi kho ở đáy sidebar (hoặc nơi khác): dựng lại nội dung theo kho mới
  useEffect(() => {
    if (!theoKho) return undefined;
    const nghe = (event) => setKhoId(event.detail ?? null);
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, [theoKho]);

  return (
    <PageContainer className="@container/tq flex flex-col gap-4">
      <h1 className="sr-only">Tổng quan</h1>
      {chonKhoTrongTrang ? (
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          <KhoLamViecSelect onChange={setKhoId} />
        </div>
      ) : null}
      {/* Đổi kho: dựng lại phần nội dung để không hiện số của kho cũ trong lúc tải */}
      <NoiDung key={theoKho ? String(khoId ?? "chua-chon") : "moi-kho"} vaiTro={vaiTro} theoKho={theoKho}>
        {children}
      </NoiDung>
    </PageContainer>
  );
}

function NoiDung({ vaiTro, theoKho, children }) {
  const { data, status, refreshing, loiCapNhat, error, reload } = useTongQuanVaiTro(vaiTro);

  if (status === "error") {
    return (
      <div className="rounded-lg border border-bo-border bg-white">
        <ErrorState
          title="Không tải được trang Tổng quan"
          description={getApiErrorMessage(error, theoKho ? "Kiểm tra kết nối và nơi làm việc rồi thử lại." : "Kiểm tra kết nối tới máy chủ rồi thử lại.")}
          onRetry={reload}
        />
      </div>
    );
  }
  if (data && data.vaiTro !== vaiTro) {
    return (
      <div className="rounded-lg border border-bo-border bg-white">
        <ErrorState title="Vai trò của tài khoản đã thay đổi" description="Vui lòng đăng xuất rồi đăng nhập lại để xem đúng trang Tổng quan." />
      </div>
    );
  }

  const loading = status === "loading";
  const khoiLoi = new Set(data?.khoiLoi ?? []);
  const loi = (k) => !loading && khoiLoi.has(k);

  return (
    <>
      {loiCapNhat ? (
        <Banner onRetry={reload}>Không cập nhật được số liệu mới. Đang hiển thị số liệu lúc {gioPhut(data?.thoiDiem)}.</Banner>
      ) : khoiLoi.size ? (
        <Banner onRetry={reload}>
          Chưa tải được: {[...khoiLoi].map((k) => TEN_KHOI[k] ?? k).join(", ")}. Các khối khác vẫn hiển thị bình thường.
        </Banner>
      ) : null}
      <div className={cn("flex flex-col gap-4 transition-opacity", refreshing && !loading && "opacity-60")} aria-busy={refreshing || undefined}>
        {children({ data, loading, loi, reload })}
      </div>
      <ChanTrang thoiDiem={data?.thoiDiem} onReload={reload} dangTai={refreshing} />
    </>
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
