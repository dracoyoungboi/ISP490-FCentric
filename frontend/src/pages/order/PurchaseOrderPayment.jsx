import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import purchaseOrderService from "../../services/purchaseOrderService";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, CheckCircle2, Check, Copy, Lightbulb,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { tenNganHang, useDanhSachNganHang } from "@/services/nganHangService";

const buildVietQRUrl = (data) => {
  if (!data) return null;
  const { nganHang, soNganHang, tongTien, maGiaoDich, tenNhaCungCap } = data;
  // Nhà cung cấp chưa khai báo tài khoản ngân hàng: không tạo được mã QR.
  if (!nganHang || !soNganHang) return null;
  const base = `https://img.vietqr.io/image/${nganHang}-${soNganHang}-qr_only.png`;
  const params = new URLSearchParams({
    amount: tongTien?.toString() ?? "0",
    addInfo: maGiaoDich ?? "",
    accountName: tenNhaCungCap ?? "",
  });
  return `${base}?${params.toString()}`;
};

export default function PurchaseOrderPayment() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef(null);
  // Mã ngân hàng lưu dạng BIN (VD 970415) → hiện tên ngân hàng (VietinBank) cho dễ đọc.
  const { danhSach: nganHangs } = useDanhSachNganHang();

  useEffect(() => {
    purchaseOrderService.layGiaoDich(orderId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);
  //gọi lần đầu
  useEffect(() => {
    purchaseOrderService.kiemTraThanhToan(orderId)
      .then((ok) => {
        if (ok) {
          setPaid(true);
        }
      })
      .catch(console.error);
  }, [orderId]);
  // Poll mỗi 20s
  useEffect(() => {
    if (loading || !data || paid) return;

    intervalRef.current = setInterval(async () => {
      setChecking(true);
      try {
        const ok = await purchaseOrderService.kiemTraThanhToan(orderId);
        if (ok) {
          clearInterval(intervalRef.current);
          setPaid(true);
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời khi polling — giữ nguyên hành vi cũ
      }
      setChecking(false);
    }, 20000);

    return () => clearInterval(intervalRef.current);
  }, [loading, data, paid, orderId]);

  const handleConfirm = () => {
    navigate("/purchase-orders");
  };

  const copy = (val, key) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const qrUrl = buildVietQRUrl(data);
  const fmt = (n) =>
    n != null
      ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
      : "—";

  const fields = data
    ? [
      { label: "Mã đơn mua", value: data.soDonMua, key: "soDonMua" },
      { label: "Mã giao dịch", value: data.maGiaoDich, key: "maGiaoDich", highlight: true },
      { label: "Ngân hàng", value: data.nganHang ? tenNganHang(nganHangs, data.nganHang) : null, key: "nganHang" },
      { label: "Số tài khoản", value: data.soNganHang, key: "soNganHang" },
      { label: "Chủ tài khoản", value: data.tenNhaCungCap, key: "tenNhaCungCap" },
      { label: "Kho", value: data.tenKho, key: "tenKho" },
      { label: "Tổng tiền", value: fmt(data.tongTien), key: "tongTien", money: true },
    ]
    : [];

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        eyebrow="Thanh toán đơn mua hàng"
        title={loading ? "Đang tải..." : data?.soDonMua ?? `#${orderId}`}
        description="Quét mã VietQR hoặc chuyển khoản theo đúng nội dung để hệ thống tự động xác nhận."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
            >
              <ArrowLeft className="size-4" /> Quay lại
            </Button>
            <StatusBadge
              label={checking ? "Đang kiểm tra..." : "Chờ thanh toán"}
              tone={checking ? "info" : "warning"}
            />
          </>
        }
      />

      {/* ── SUCCESS OVERLAY ── */}
      {paid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bo-foreground/60 p-4">
          <div className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-lg border border-bo-border bg-white p-8 text-center shadow-lg">
            <span className="flex size-14 items-center justify-center rounded-full bg-bo-success-soft text-bo-success">
              <CheckCircle2 className="size-8" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-bo-foreground">Thanh toán thành công!</h2>
            <p className="text-sm leading-6 text-bo-muted">
              Giao dịch <strong className="text-bo-primary">{data?.maGiaoDich}</strong> đã được xác nhận.
            </p>
            <div className="rounded-lg border border-green-200 bg-bo-success-soft px-6 py-2.5 text-2xl font-bold tracking-tight text-bo-success">
              {fmt(data?.tongTien)}
            </div>
            <Button
              className="mt-2 h-11 w-full bg-bo-primary text-sm font-semibold text-white hover:bg-bo-primary-hover"
              onClick={handleConfirm}
            >
              Xác nhận &amp; Đóng tab
            </Button>
          </div>
        </div>
      )}

      <div className={paid ? "pointer-events-none blur-sm" : ""}>
        {loading ? (
          <SurfaceCard title="Thông tin thanh toán" description="Đang tải dữ liệu">
            <LoadingState rows={4} label="Đang tải thông tin thanh toán" />
          </SurfaceCard>
        ) : !data ? (
          <SurfaceCard contentClassName="p-0 sm:p-0">
            <ErrorState
              title="Không tìm thấy thông tin giao dịch"
              description="Giao dịch không tồn tại hoặc đã bị xóa khỏi hệ thống."
            />
            <div className="flex justify-center pb-10">
              <Button
                onClick={() => navigate("/purchase-orders")}
                className="h-10 bg-bo-primary px-5 font-semibold text-white hover:bg-bo-primary-hover"
              >
                Quay lại danh sách
              </Button>
            </div>
          </SurfaceCard>
        ) : (
          <SurfaceCard contentClassName="p-0 sm:p-0">
            <div className="flex flex-col lg:flex-row">
              {/* ── QR Section ── */}
              <div className="flex shrink-0 flex-col items-center gap-4 border-b border-bo-border p-6 lg:w-[300px] lg:border-b-0 lg:border-r">
                <div className="relative flex size-[200px] items-center justify-center overflow-hidden rounded-lg border border-bo-border bg-white">
                  {!qrUrl && (
                    <p className="px-4 text-center text-xs leading-5 text-bo-muted">
                      Nhà cung cấp chưa có tài khoản ngân hàng nên chưa tạo được mã QR. Cập nhật ở trang Nhà cung cấp.
                    </p>
                  )}
                  {qrUrl && !qrLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="size-7 animate-spin rounded-full border-[3px] border-bo-border border-t-bo-primary" />
                    </div>
                  )}
                  {qrUrl && (
                    <img
                      src={qrUrl}
                      alt="QR thanh toán"
                      className={`size-full object-cover transition-opacity ${qrLoaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setQrLoaded(true)}
                    />
                  )}
                </div>

                <p className="text-center text-xs leading-5 text-bo-muted">Quét mã để thanh toán qua ứng dụng ngân hàng</p>

                <div className="rounded-lg border border-blue-200 bg-bo-primary-soft px-5 py-2 text-lg font-bold tracking-tight text-bo-primary">
                  {fmt(data.tongTien)}
                </div>

                {/* Polling indicator */}
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${checking ? "bg-bo-warning" : "bg-bo-success"}`} />
                  <span className="text-[11px] text-bo-muted">
                    {checking ? "Đang xác minh giao dịch..." : "Tự động kiểm tra mỗi 20 giây"}
                  </span>
                </div>
              </div>

              {/* ── Info Section ── */}
              <div className="flex min-w-0 flex-1 flex-col gap-1 p-5 sm:p-6">
                {fields.map((f) => (
                  <div
                    key={f.key}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3.5 py-2.5 transition-colors hover:bg-bo-surface-subtle ${f.highlight ? "border border-blue-200 bg-bo-primary-soft" : ""}`}
                    onClick={() => f.value && copy(f.value, f.key)}
                    title="Bấm để sao chép"
                  >
                    <span className="shrink-0 text-xs font-medium text-bo-muted">{f.label}</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`break-all text-right text-sm font-medium ${f.money ? "text-base font-bold text-bo-primary" : "text-bo-foreground"}`}>
                        {f.value ?? "—"}
                      </span>
                      {f.value && (
                        copied === f.key
                          ? <Check className="size-3.5 shrink-0 select-none text-bo-success" />
                          : <Copy className="size-3.5 shrink-0 select-none text-bo-muted" />
                      )}
                    </div>
                  </div>
                ))}

                <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-bo-primary-soft px-4 py-3">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-bo-primary" />
                  <p className="text-[13px] leading-6 text-slate-600">
                    Vui lòng nhập <strong className="text-bo-foreground">{data.maGiaoDich}</strong> vào nội dung chuyển khoản để hệ thống tự động xác nhận.
                  </p>
                </div>
              </div>
            </div>
          </SurfaceCard>
        )}
      </div>
    </PageContainer>
  );
}
