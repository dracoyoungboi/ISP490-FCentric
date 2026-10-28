import { useEffect, useState } from "react";
import { X, TrendingUp, Trophy, Loader2, AlertCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { thongKeHeThongService } from "@/services/thongKeHeThongService";
import { formatCurrency } from "@/utils/formatters";

// Medal màu theo rank
const RANK_STYLES = [
    { bg: "bg-yellow-50",  border: "border-yellow-300", text: "text-yellow-600",  icon: "🥇" },
    { bg: "bg-gray-50",    border: "border-gray-300",   text: "text-gray-500",    icon: "🥈" },
    { bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-500",  icon: "🥉" },
];

function RankBadge({ rank }) {
    if (rank <= 3) {
        const s = RANK_STYLES[rank - 1];
        return (
            <span className={`w-8 h-8 flex items-center justify-center rounded-full border ${s.bg} ${s.border} text-base flex-shrink-0`}>
                {s.icon}
            </span>
        );
    }
    return (
        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-50 border border-purple-200 text-xs font-bold text-purple-600 flex-shrink-0">
            {rank}
        </span>
    );
}

function ProductRow({ product, rank }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
            <RankBadge rank={rank} />

            {/* Ảnh sản phẩm */}
            <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {product.anhQuanAos?.[0]?.tepTin?.duongDan ? (
                    <img
                        src={product.anhQuanAos[0].tepTin.duongDan}
                        alt={product.tenSanPham}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="h-5 w-5 text-gray-300" />
                )}
            </div>

            {/* Thông tin */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{product.tenSanPham}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 font-mono">{product.maSanPham}</span>
                    {product.danhMuc?.tenDanhMuc && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                            {product.danhMuc.tenDanhMuc}
                        </span>
                    )}
                </div>
            </div>

            {/* Giá & trạng thái */}
            <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-purple-700">
                    {product.giaBanMacDinh ? formatCurrency(product.giaBanMacDinh) : "—"}
                </div>
                <div className={`text-xs mt-0.5 ${product.trangThai === 1 ? "text-green-500" : "text-red-400"}`}>
                    {product.trangThai === 1 ? "Đang bán" : "Ngừng bán"}
                </div>
            </div>
        </div>
    );
}

export default function TopSellingModal({ isOpen, onClose }) {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await thongKeHeThongService.getSanPhamBanChay(10);
                const serverResponse = res.data;
                if (serverResponse?.status === 200) {
                    setProducts(serverResponse.data || []);
                }
            } catch (e) {
                console.error("Lỗi khi tải sản phẩm bán chạy:", e);
                setError("Không thể tải danh sách sản phẩm bán chạy");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-bo-surface rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-orange-500 to-pink-600 rounded-t-2xl">
                        <div className="flex items-center gap-2.5">
                            <TrendingUp className="h-5 w-5 text-white" />
                            <div>
                                <div className="text-white font-semibold text-sm">Top 10 Sản phẩm bán chạy</div>
                                <div className="text-orange-100 text-xs">Dựa trên số lượng xuất kho (loại bán hàng)</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-bo-surface/10 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Trophy banner */}
                    <div className="px-5 py-3 bg-gradient-to-r from-orange-50 to-pink-50 border-b flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-orange-500" />
                        <span className="text-xs text-gray-600 font-medium">
                            {isLoading ? "Đang tải..." : `${products.length} sản phẩm bán chạy nhất`}
                        </span>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                                        <div className="w-11 h-11 rounded-lg bg-gray-200 flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <div className="h-3.5 bg-gray-200 rounded w-16" />
                                            <div className="h-3 bg-gray-200 rounded w-12" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                                <AlertCircle className="h-10 w-10 text-red-300" />
                                <span className="text-sm text-red-400">{error}</span>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                                <Package className="h-10 w-10 text-gray-200" />
                                <span className="text-sm">Chưa có dữ liệu bán hàng</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {products.map((product, idx) => (
                                    <ProductRow key={product.id} product={product} rank={idx + 1} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t bg-gray-50 rounded-b-2xl flex justify-end">
                        <Button variant="outline" size="sm" onClick={onClose} className="text-sm">
                            Đóng
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}