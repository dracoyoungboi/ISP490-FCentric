import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ShoppingBag,
  Store,
  KeyRound,
  RefreshCw,
  ExternalLink,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  X,
  Truck,
  ArrowRight,
  Search,
  ShoppingCart,
  ShieldCheck,
  Clock,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { shopeeSimulatorService } from "@/services/shopeeSimulatorService";
import { t } from "@/i18n";

export default function ShopeeSimulatorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view") || "buyer";
  const [activeTab, setActiveTab] = useState(initialView);
  const [authStatus, setAuthStatus] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  const taiTrangThaiAuth = async () => {
    setLoadingAuth(true);
    try {
      const data = await shopeeSimulatorService.getAppAuthStatus();
      setAuthStatus(data);
    } catch (e) {
      console.warn("Lỗi kiểm tra trạng thái ủy quyền Shopee:", e);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    taiTrangThaiAuth();
  }, []);

  const setTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ view: tab });
    if (tab === "oauth") {
      taiTrangThaiAuth();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* ── Top Header Phong cách Shopee ─────────────────────────────────── */}
      <header className="bg-[#EE4D2D] text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-inner">
              <ShoppingBag className="w-6 h-6 text-[#EE4D2D]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight">Shopee</span>
                <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full font-medium border border-white/30">
                  Interactive Simulator v2
                </span>
              </div>
              <p className="text-xs text-orange-100 hidden sm:block">
                {t("Cổng kiểm thử giả lập hai chiều: Buyer Storefront & Seller Center")}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center bg-[#d73211] p-1 rounded-xl">
            <button
              onClick={() => setTab("buyer")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "buyer"
                  ? "bg-white text-[#EE4D2D] shadow-sm font-semibold"
                  : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t("Người Mua (Buyer)")}</span>
            </button>
            <button
              onClick={() => setTab("seller")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "seller"
                  ? "bg-white text-[#EE4D2D] shadow-sm font-semibold"
                  : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              <Store className="w-4 h-4" />
              <span>{t("Kênh Người Bán (Seller)")}</span>
            </button>
            <button
              onClick={() => setTab("oauth")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "oauth"
                  ? "bg-white text-[#EE4D2D] shadow-sm font-semibold"
                  : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              {authStatus?.isAuthorized ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>{t("Ứng dụng đã liên kết")}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{t("Ủy quyền OAuth2")}</span>
                </>
              )}
            </button>
          </div>

          {/* External Links & Reset */}
          <div className="flex items-center gap-2">
            <Link
              to="/channels/shopee-sandbox"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
              title={t("Mở FCentric Omnichannel Shopee trong tab mới")}
            >
              <span>{t("Về FCentric")}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
        {activeTab === "buyer" && <BuyerStorefrontView />}
        {activeTab === "seller" && <SellerCenterView />}
        {activeTab === "oauth" && (
          <AppAuthManagementView
            authStatus={authStatus}
            loading={loadingAuth}
            onRefresh={taiTrangThaiAuth}
          />
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        {t("Shopee Open Platform Simulator • Môi trường thử nghiệm tương tác FCentric Omnichannel • Tương thích chuẩn API v2")}
      </footer>
    </div>
  );
}

// =============================================================================
// 1. KÊNH NGƯỜI MUA (BUYER STOREFRONT)
// =============================================================================
function BuyerStorefrontView() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const taiSanPham = async () => {
    setLoading(true);
    try {
      const data = await shopeeSimulatorService.getStorefrontProducts();
      setProducts(data);
    } catch (err) {
      toast.error(t("Không thể tải danh sách sản phẩm sàn Shopee"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    taiSanPham();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter((p) => p.itemName?.toLowerCase().includes(q) || p.itemSku?.toLowerCase().includes(q));
  }, [products, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Banner Khuyến mãi Shopee Mall */}
      <div className="bg-gradient-to-r from-[#EE4D2D] via-[#F53D2D] to-[#FF6B4A] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-black/20 text-xs px-2.5 py-1 rounded-full font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {t("Shopee Mall • Gian Hàng FCentric Official")}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Mua sắm Thời trang FCentric Trực tuyến")}</h1>
          <p className="text-sm text-orange-100 max-w-xl">
            {t("Sản phẩm được đồng bộ tồn kho thời gian thực từ kho FCentric WMS. Đặt hàng để kiểm chứng luồng kéo đơn và trừ tồn giữ chỗ tự động!")}
          </p>
        </div>
      </div>

      {/* Thanh tìm kiếm */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t("Tìm sản phẩm trên Shopee (Áo polo, Sơ mi, Quần tây...)")}
          className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lưới sản phẩm */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#EE4D2D]" />
          <p className="text-sm">{t("Đang tải sản phẩm trên sàn Shopee...")}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">{t("Chưa có sản phẩm nào trên sàn Shopee")}</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {t("Hãy quay lại FCentric và bấm \"Đẩy tồn lên Shopee\" hoặc bấm \"Làm mới\" để tự động khởi tạo dữ liệu mẫu.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredProducts.map((p) => {
            const totalStock = (p.models || []).reduce((sum, m) => sum + (m.stockQuantity || 0), 0);
            return (
              <div
                key={p.itemId}
                onClick={() => setSelectedProduct(p)}
                className="bg-white rounded-xl border border-slate-200 hover:border-[#EE4D2D] hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col group"
              >
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.itemName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ShoppingBag className="w-10 h-10" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-[#EE4D2D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Mall
                  </span>
                  {totalStock === 0 && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                      <span className="bg-white text-slate-800 text-xs font-bold px-2 py-1 rounded">{t("HẾT HÀNG")}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug group-hover:text-[#EE4D2D]">
                      {p.itemName}
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-1">SKU: {p.itemSku}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-[#EE4D2D] font-bold">₫</span>
                      <span className="text-sm font-extrabold text-[#EE4D2D]">
                        {Number(p.price || 0).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">{t("Còn {{so}}", { so: totalStock })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Chi tiết & Đặt mua hàng */}
      {selectedProduct && (
        <BuyerCheckoutModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSuccess={(order) => {
            setSelectedProduct(null);
            setOrderSuccess(order);
            taiSanPham();
          }}
        />
      )}

      {/* Modal Thông báo Đặt hàng thành công */}
      {orderSuccess && <OrderSuccessModal order={orderSuccess} onClose={() => setOrderSuccess(null)} />}
    </div>
  );
}

// ── Modal Đặt Mua Hàng ────────────────────────────────────────────────────────
function BuyerCheckoutModal({ product, onClose, onSuccess }) {
  const models = product.models || [];
  const [selectedModel, setSelectedModel] = useState(models[0] || null);
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("Nguyễn Thu Thảo"); // i18n-giu-nguyen: dữ liệu mẫu gửi máy chủ giả lập
  const [buyerPhone, setBuyerPhone] = useState("0987654321");
  const [address, setAddress] = useState("Số 18 Hoàng Diệu, P. Điện Biên, Q. Ba Đình, Hà Nội"); // i18n-giu-nguyen: dữ liệu mẫu gửi máy chủ giả lập
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_DELIVERY");
  const [submitting, setSubmitting] = useState(false);

  const stock = selectedModel?.stockQuantity || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedModel) {
      toast.error(t("Vui lòng chọn phân loại hàng"));
      return;
    }
    if (quantity > stock) {
      toast.error(t("Số lượng tồn chỉ còn {{count}} sản phẩm", { count: stock }));
      return;
    }

    setSubmitting(true);
    try {
      const order = await shopeeSimulatorService.buyerCheckout({
        itemId: product.itemId,
        modelId: selectedModel.modelId,
        quantity,
        buyerName,
        buyerPhone,
        shippingAddress: address,
        paymentMethod,
      });
      toast.success(t("Đặt hàng thành công trên Shopee Mall!"));
      onSuccess(order);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || t("Đặt hàng thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#EE4D2D] p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <h3 className="font-bold text-base">{t("Đặt Mua Trên Shopee Mall")}</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Thông tin sản phẩm */}
          <div className="flex gap-3 pb-3 border-b border-slate-100">
            <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag className="w-8 h-8 text-slate-300 m-auto mt-4" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{product.itemName}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{t("SKU cha: {{itemSku}}", { itemSku: product.itemSku })}</p>
              <div className="text-[#EE4D2D] font-extrabold text-base mt-1">
                ₫{Number(selectedModel?.price || product.price || 0).toLocaleString("vi-VN")}
              </div>
            </div>
          </div>

          {/* Chọn phân loại hàng */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">{t("Chọn Phân loại hàng (Màu & Size):")}</label>
            <div className="grid grid-cols-2 gap-2">
              {models.map((m) => (
                <button
                  type="button"
                  key={m.modelId}
                  onClick={() => {
                    setSelectedModel(m);
                    if (quantity > m.stockQuantity) setQuantity(Math.max(1, m.stockQuantity));
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedModel?.modelId === m.modelId
                      ? "border-[#EE4D2D] bg-orange-50/50 text-[#EE4D2D] ring-2 ring-orange-200"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  }`}
                >
                  <div className="text-xs font-semibold">{m.tierVariation || m.modelSku}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex justify-between">
                    <span>SKU: {m.modelSku}</span>
                    <span className={m.stockQuantity > 0 ? "font-bold text-emerald-600" : "font-bold text-rose-500"}>
                      {m.stockQuantity > 0 ? t("Còn {{so}}", { so: m.stockQuantity }) : t("Hết hàng")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Số lượng */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-slate-700">{t("Số lượng mua:")}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg border border-slate-300 font-bold hover:bg-slate-50"
              >
                -
              </button>
              <span className="w-10 text-center text-sm font-bold text-slate-800">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                disabled={quantity >= stock}
                className="w-8 h-8 rounded-lg border border-slate-300 font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Thông tin giao hàng */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 block">{t("Địa chỉ nhận hàng (Shopee Address):")}</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder={t("Tên người nhận")}
                required
                className="p-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder={t("Số điện thoại")}
                required
                className="p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("Địa chỉ chi tiết (Số nhà, đường, phường, quận...)")}
              required
              rows={2}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {/* Phương thức thanh toán */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">{t("Phương thức thanh toán:")}</label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center gap-2 p-2.5 border rounded-xl text-xs font-medium cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "CASH_ON_DELIVERY"}
                  onChange={() => setPaymentMethod("CASH_ON_DELIVERY")}
                />
                <span>{t("Thanh toán khi nhận hàng (COD)")}</span>
              </label>
              <label className="flex-1 flex items-center gap-2 p-2.5 border rounded-xl text-xs font-medium cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "SHOPEE_PAY"}
                  onChange={() => setPaymentMethod("SHOPEE_PAY")}
                />
                <span>{t("Ví ShopeePay")}</span>
              </label>
            </div>
          </div>

          {/* Nút bấm */}
          <div className="pt-4 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50"
            >
              {t("Hủy")}
            </button>
            <button
              type="submit"
              disabled={submitting || stock === 0}
              className="flex-1 py-2.5 bg-[#EE4D2D] hover:bg-[#d73211] text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 disabled:opacity-50 transition-colors"
            >
              {submitting ? t("Đang đặt hàng...") : stock === 0 ? t("Hết hàng") : t("Đặt Hàng Ngay")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Thông Báo Đơn Hàng Thành Công ───────────────────────────────────────
function OrderSuccessModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-800">{t("Đặt hàng Shopee thành công!")}</h3>
          <p className="text-xs text-slate-500 mt-1">{t("Đơn hàng đã được ghi nhận trên sàn Shopee Mall")}</p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-left text-xs space-y-2 border border-slate-200">
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Mã đơn Shopee:")}</span>
            <span className="font-mono font-bold text-[#EE4D2D]">{order.orderSn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Mã vận đơn SPX:")}</span>
            <span className="font-mono font-bold text-slate-800">{order.trackingNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Trạng thái sàn:")}</span>
            <span className="font-semibold text-emerald-600">{order.orderStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Người mua:")}</span>
            <span className="font-medium text-slate-700">{order.buyerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Tổng thanh toán:")}</span>
            <span className="font-bold text-slate-800">
              ₫{Number(order.totalAmount || 0).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-3 text-left flex gap-2.5 border border-amber-200 text-amber-800 text-xs">
          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            <strong>{t("Bước tiếp theo:")}</strong> {t("Quay lại hệ thống FCentric, mở trang")}{" "}
            <em>{t("Kênh bán hàng › Shopee Sandbox")}</em> {t("và bấm")} <strong>{t("\"Đồng bộ ngay\"")}</strong> {t("để kéo đơn này về kho và sinh Phiếu xuất kho!")}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold"
          >
            {t("Tiếp tục mua hàng")}
          </button>
          <Link
            to="/channels/shopee-sandbox/orders"
            target="_blank"
            className="flex-1 py-2.5 bg-[#EE4D2D] hover:bg-[#d73211] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <span>{t("Xem ở FCentric")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 2. KÊNH NGƯỜI BÁN (SELLER CENTER)
// =============================================================================
function SellerCenterView() {
  const [subTab, setSubTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const taiDuLieu = async () => {
    setLoading(true);
    try {
      const [prods, ords] = await Promise.all([
        shopeeSimulatorService.getSellerProducts(),
        shopeeSimulatorService.getSellerOrders(),
      ]);
      setProducts(prods);
      setOrders(ords);
    } catch (err) {
      toast.error(t("Không thể tải dữ liệu Shopee Seller Center"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    taiDuLieu();
  }, []);

  const handleUpdateStatus = async (orderSn, newStatus, reason, user) => {
    try {
      await shopeeSimulatorService.updateOrderStatus(orderSn, {
        status: newStatus,
        cancelReason: reason,
        cancelUser: user,
      });
      toast.success(t("Đã cập nhật đơn {{orderSn}} thành {{newStatus}}", { orderSn, newStatus }));
      taiDuLieu();
    } catch (err) {
      toast.error(t("Không thể cập nhật trạng thái đơn hàng"));
    }
  };

  const handleResetData = async () => {
    if (!window.confirm(t("Bạn có chắc chắn muốn đặt lại toàn bộ dữ liệu sàn Shopee Sandbox về mặc định?"))) return;
    try {
      await shopeeSimulatorService.resetData();
      toast.success(t("Đã reset dữ liệu sàn Shopee Sandbox thành công!"));
      taiDuLieu();
    } catch (err) {
      toast.error(t("Lỗi khi reset dữ liệu"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Seller */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-[#EE4D2D]">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-800">{t("Shopee Seller Center (Kênh Người Bán)")}</h2>
            <p className="text-xs text-slate-500">{t("Gian hàng: FCentric Official Store • Shop ID: 10892019")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={taiDuLieu}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{t("Làm mới sàn")}</span>
          </button>
          <button
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t("Reset dữ liệu")}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setSubTab("products")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            subTab === "products"
              ? "border-[#EE4D2D] text-[#EE4D2D]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t("Quản lý Tồn kho & Sản phẩm ({{so}} SKU)", { so: products.length, count: products.length })}
        </button>
        <button
          onClick={() => setSubTab("orders")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            subTab === "orders"
              ? "border-[#EE4D2D] text-[#EE4D2D]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t("Quản lý Đơn hàng sàn ({{count}} đơn)", { count: orders.length })}
        </button>
      </div>

      {/* Tab Content */}
      {subTab === "products" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-orange-50/50 border-b border-slate-100 text-xs text-orange-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#EE4D2D] shrink-0" />
            <span>
              <strong>{t("Kiểm chứng Live Sync:")}</strong> {t("Cột")} <em>{t("\"Tồn kho trên Shopee\"")}</em> {t("sẽ lập tức thay đổi khi bạn xuất kho hoặc bấm \"Đẩy tồn\" từ FCentric WMS!")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Item ID / Model ID</th>
                  <th className="py-3 px-4">{t("Mã SKU FCentric")}</th>
                  <th className="py-3 px-4">{t("Tên sản phẩm & Phân loại")}</th>
                  <th className="py-3 px-4 text-right">{t("Giá niêm yết")}</th>
                  <th className="py-3 px-4 text-center">{t("Tồn kho trên Shopee")}</th>
                  <th className="py-3 px-4 text-center">{t("Trạng thái sàn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {t("Chưa có dữ liệu sản phẩm trên sàn Shopee")}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {p.itemId} / {p.modelId}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{p.modelSku}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{p.itemName}</div>
                        <div className="text-[11px] text-slate-400">{p.tierVariation}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        ₫{Number(p.price || 0).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-extrabold text-xs ${
                            p.stockQuantity > 0
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {t("{{so}} cái", { so: p.stockQuantity })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {p.trangThai}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "orders" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-orange-50/50 border-b border-slate-100 text-xs text-orange-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#EE4D2D] shrink-0" />
              <span>
                {t("Thao tác đổi trạng thái đơn trên sàn để kiểm chứng phản ứng của FCentric (Đặc biệt là ca hủy đơn giữa chừng).")}
              </span>
            </div>
            <Link
              to="/channels/shopee-sandbox/orders"
              target="_blank"
              className="text-xs text-[#EE4D2D] font-bold hover:underline flex items-center gap-1"
            >
              <span>{t("Xem đơn FCentric")}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t("Mã đơn Shopee")}</th>
                  <th className="py-3 px-4">{t("Mã vận đơn SPX")}</th>
                  <th className="py-3 px-4">{t("Người mua & Địa chỉ")}</th>
                  <th className="py-3 px-4 text-right">{t("Tổng tiền")}</th>
                  <th className="py-3 px-4 text-center">{t("Trạng thái sàn")}</th>
                  <th className="py-3 px-4 text-center">{t("Hành động kiểm thử")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {t("Chưa có đơn hàng nào phát sinh trên sàn Shopee")}
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#EE4D2D]">{o.orderSn}</span>
                        <div className="text-[10px] text-slate-400">
                          {new Date(o.createTime * 1000).toLocaleString("vi-VN")}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">{o.trackingNumber || "—"}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-800">{o.buyerName}</div>
                        <div className="text-[11px] text-slate-500 truncate" title={o.shippingAddress}>
                          {o.shippingAddress}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        ₫{Number(o.totalAmount || 0).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            o.orderStatus === "READY_TO_SHIP"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : o.orderStatus === "SHIPPED"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : o.orderStatus === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {o.orderStatus}
                        </span>
                        {o.cancelReason && (
                          <div className="text-[9px] text-rose-500 mt-0.5 truncate" title={o.cancelReason}>
                            {o.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {o.orderStatus === "READY_TO_SHIP" && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(o.orderSn, "SHIPPED")}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[10px] font-semibold"
                                title={t("Giả lập bưu tá SPX lấy hàng")}
                              >
                                {t("Đang giao")}
                              </button>
                              <button
                                onClick={() =>
                                  // i18n-giu-nguyen: lý do hủy gửi máy chủ
                                  handleUpdateStatus(o.orderSn, "CANCELLED", "Người mua đổi ý muốn hủy đơn", "BUYER")
                                }
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[10px] font-semibold"
                                title={t("Giả lập người mua hủy đơn (Kiểm tra Wave Picking Guard)")}
                              >
                                {t("Hủy đơn", { context: "nut" })}
                              </button>
                            </>
                          )}
                          {o.orderStatus === "SHIPPED" && (
                            <button
                              onClick={() => handleUpdateStatus(o.orderSn, "COMPLETED")}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[10px] font-semibold"
                            >
                              {t("Giao xong")}
                            </button>
                          )}
                          {o.orderStatus === "CANCELLED" && (
                            <span className="text-[10px] text-slate-400 italic">{t("Đã hủy")}</span>
                          )}
                          {o.orderStatus === "COMPLETED" && (
                            <span className="text-[10px] text-emerald-600 font-semibold">{t("Hoàn tất")}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 3. QUẢN LÝ ỦY QUYỀN ỨNG DỤNG ĐỐI TÁC (APP AUTHORIZATION MANAGEMENT)
// =============================================================================
function AppAuthManagementView({ authStatus, loading, onRefresh }) {
  const navigate = useNavigate();
  const [approving, setApproving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleAuthorize = () => {
    setApproving(true);
    // Sinh mã auth code giả lập chuẩn Shopee v2 và redirect về OAuthCallbackPage của FCentric
    const mockCode = "shp_auth_code_" + Math.random().toString(36).substring(2, 10);
    const state = "shopee_oauth_sandbox";
    setTimeout(() => {
      navigate(`/channels/oauth/callback/shopee-sandbox?code=${mockCode}&state=${state}`);
    }, 800);
  };

  const handleDeny = () => {
    navigate("/channels/oauth/callback/shopee-sandbox?error=access_denied&error_description=User_denied_authorization");
  };

  const handleRevoke = async () => {
    if (!window.confirm(t("Bạn có chắc chắn muốn hủy ủy quyền ứng dụng FCentric khỏi gian hàng Shopee không? Sau khi hủy, hệ thống FCentric sẽ không thể đọc đơn hàng và cập nhật tồn kho nữa."))) {
      return;
    }
    setRevoking(true);
    try {
      await shopeeSimulatorService.revokeAppAuth();
      toast.success(t("Đã hủy ủy quyền ứng dụng FCentric khỏi gian hàng Shopee thành công!"));
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(t("Lỗi khi hủy ủy quyền ứng dụng"));
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#EE4D2D]" />
        <p className="text-sm font-medium">{t("Đang kiểm tra trạng thái ủy quyền gian hàng Shopee...")}</p>
      </div>
    );
  }

  // ── TRƯỜNG HỢP 1: ĐÃ ỦY QUYỀN THÀNH CÔNG (HIỂN THỊ GIAO DIỆN SHOPEE SELLER CENTER) ──
  if (authStatus?.isAuthorized) {
    const scopes = authStatus.scopes || [
      { code: "product", name: t("Quản lý sản phẩm & tồn kho"), desc: t("Tự động đồng bộ tồn kho khả dụng thời gian thực") },
      { code: "order", name: t("Quản lý đơn hàng"), desc: t("Đọc đơn hàng mới và đồng bộ hủy đơn hai chiều") },
      { code: "logistics", name: t("Hậu cần & Vận chuyển SPX"), desc: t("Cấp mã vận đơn Shopee Xpress, in tem nhãn nhiệt A6") },
      { code: "payment", name: t("Quyết toán ví Shopee & Escrow"), desc: t("Bóc tách doanh thu và đối soát biểu phí sàn") },
    ];

    return (
      <div className="max-w-4xl mx-auto py-6 space-y-6">
        {/* Breadcrumb phong cách Shopee Seller */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Shopee Seller Center</span>
          <span>›</span>
          <span>{t("Thiết Lập Shop")}</span>
          <span>›</span>
          <span className="text-slate-800 font-bold">{t("Nền tảng đối tác (Partner Platforms)")}</span>
        </div>

        {/* Khung quản lý ứng dụng đối tác */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Shopee Seller Center */}
          <div className="p-6 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-[#EE4D2D] rounded-2xl flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800">{t("Quản lý Ứng dụng & Đối tác đã liên kết")}</h2>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                    {t("Đã liên kết 1 App")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("Gian hàng:")} <strong>{authStatus.shopName || "FCentric Official Store"}</strong> • Shop ID: {authStatus.shopId || 10892019}
                </p>
              </div>
            </div>

            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t("Làm mới")}</span>
            </button>
          </div>

          {/* Thẻ chi tiết Ứng dụng FCentric */}
          <div className="p-6 space-y-6">
            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md font-extrabold text-xl tracking-wider shrink-0">
                  FC
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-800">{authStatus.appName || "FCentric Omnichannel Hub & WMS"}</h3>
                    <span className="bg-orange-100 text-[#EE4D2D] text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200 shrink-0">
                      Shopee Certified Partner
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{t("Mã đối tác (Partner ID):")} <strong className="font-mono text-slate-700 font-semibold">{authStatus.partnerId || 1000888}</strong></span>
                    <span className="hidden sm:inline text-slate-300">•</span>
                    <span>{t("Nhà phát triển:")} <strong className="text-slate-700 font-semibold">{authStatus.developerName || "FCentric Technology JSC"}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col items-start md:items-end justify-between w-full md:w-auto gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60">
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-300 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {t("Đang hoạt động (Connected)")}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">{t("Hiệu lực: Còn 364 ngày")}</span>
              </div>
            </div>

            {/* Danh sách các quyền hạn được cấp (Scopes) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("Phạm vi quyền hạn được cấp phép (Authorized Scopes):")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {scopes.map((sc) => (
                  <div key={sc.code} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-800">{sc.name}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{sc.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cảnh báo bảo mật & Thao tác */}
            <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                {t("Bạn có thể ngắt kết nối bất kỳ lúc nào nếu không còn sử dụng dịch vụ quản lý kho của ứng dụng này.")}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
                <Link
                  to="/channels/shopee-sandbox"
                  target="_blank"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  <span>{t("Mở FCentric")}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {revoking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("Đang hủy...")}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("Hủy ủy quyền")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── TRƯỜNG HỢP 2: CHƯA ỦY QUYỀN (HIỂN THỊ MÀN HÌNH XIN CẤP QUYỀN OAUTH CONSENT SCREEN) ──
  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Shopee Open Platform */}
        <div className="bg-gradient-to-r from-[#EE4D2D] to-[#F53D2D] p-6 text-white text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-md mb-3">
            <ShoppingBag className="w-10 h-10 text-[#EE4D2D]" />
          </div>
          <h2 className="text-xl font-bold">Shopee Open Platform</h2>
          <p className="text-xs text-orange-100 mt-1">{t("Cổng Ủy Quyền Ứng Dụng Đối Tác (OAuth 2.0)")}</p>
        </div>

        {/* Nội dung cấp quyền */}
        <div className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-base text-slate-800">{t("Cấp quyền cho Ứng dụng FCentric Omnichannel")}</h3>
            <p className="text-xs text-slate-500">
              {t("Gian hàng:")} <strong>{authStatus?.shopName || "FCentric Official Store"}</strong> (Shop ID: {authStatus?.shopId || 10892019})
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">
              {t("Ứng dụng FCentric sẽ có các quyền hạn sau:")}
            </span>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{t("Quản lý sản phẩm & tồn kho:")}</strong> {t("Đọc thông tin và cập nhật số lượng tồn kho tự động theo thời gian thực.")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{t("Quản lý đơn hàng:")}</strong> {t("Đọc danh sách đơn hàng mới để tạo phiếu xuất kho và xử lý đóng gói.")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{t("Hậu cần & Vận đơn:")}</strong> {t("Lấy mã vận đơn Shopee Express (SPX) và in tem nhãn nhiệt A6.")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{t("Quyết toán ví Shopee & Escrow:")}</strong> {t("Bóc tách tiền thực nhận và đối soát chi tiết thanh toán.")}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center">
            {t("Bằng việc nhấn \"Xác nhận ủy quyền\", bạn đồng ý chia sẻ dữ liệu gian hàng với ứng dụng đối tác FCentric theo chính sách bảo mật của Shopee.")}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDeny}
              className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {t("Từ chối")}
            </button>
            <button
              onClick={handleAuthorize}
              disabled={approving}
              className="flex-1 py-3 bg-[#EE4D2D] hover:bg-[#d73211] text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {approving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t("Đang ủy quyền...")}</span>
                </>
              ) : (
                <span>{t("Xác nhận ủy quyền")}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

