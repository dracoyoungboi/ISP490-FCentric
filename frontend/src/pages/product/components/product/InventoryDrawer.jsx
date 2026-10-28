import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronDown, Warehouse, Package, Layers, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { thongKeHeThongService } from "@/services/thongKeHeThongService";
import { formatCurrency } from "@/utils/formatters";

// ─── Badge tồn kho ────────────────────────────────────────────────────────────
function StockBadge({ value }) {
    const num = Number(value ?? 0);
    if (num <= 0)
        return <span className="inline-flex min-w-[78px] items-center justify-center px-2.5 py-1 text-[11px] rounded-full bg-bo-danger-soft text-red-600 border border-red-200 font-semibold">Hết hàng</span>;
    if (num < 10)
        return <span className="inline-flex min-w-[78px] items-center justify-center px-2.5 py-1 text-[11px] rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">{num}</span>;
    return <span className="inline-flex min-w-[78px] items-center justify-center px-2.5 py-1 text-[11px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">{num}</span>;
}

// ─── Bảng lô hàng bên trong 1 kho ────────────────────────────────────────────
function KhoTonKhoPanel({ khoData }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-xl border border-[#e6dcc9] overflow-hidden bg-bo-surface">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#fbf7ef] hover:bg-[#f6efdF] transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <Warehouse className="h-4 w-4 text-[#b8860b]" />
                    <span className="text-sm font-semibold text-[#2f2a23]">{khoData.tenKho}</span>
                    <span className="text-xs text-[#9a8c79]">#{khoData.khoId}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-xs text-[#7a6e5f] hidden sm:flex gap-3">
                        <span>
                            Tồn: <b className="text-[#2f2a23]">{Number(khoData.tongSoLuongTon ?? 0).toLocaleString("vi-VN")}</b>
                        </span>
                        <span>
                            Khả dụng:{" "}
                            <b className="text-emerald-700">{Number(khoData.tongSoLuongKhaDung ?? 0).toLocaleString("vi-VN")}</b>
                        </span>
                        <span>
                            Giá trị: <b className="text-[#b8860b]">{formatCurrency(khoData.giaTriTonKho ?? 0)}</b>
                        </span>
                    </div>
                    {open ? (
                        <ChevronDown className="h-4 w-4 text-[#9a8c79]" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-[#9a8c79]" />
                    )}
                </div>
            </button>

            {open && (
                <div className="overflow-x-auto">
                    {!khoData.danhSachLoHang || khoData.danhSachLoHang.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-[#9a8c79] text-sm">
                            <AlertCircle className="h-4 w-4" />
                            Không có lô hàng nào tại kho này
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-[#f8f3e8] text-[#7a6e5f] uppercase tracking-wide text-[11px]">
                                    <th className="px-4 py-2 text-left font-semibold">Mã lô</th>
                                    <th className="px-4 py-2 text-right font-semibold">Tồn kho</th>
                                    <th className="px-4 py-2 text-right font-semibold">Đã đặt</th>
                                    <th className="px-4 py-2 text-right font-semibold">Khả dụng</th>
                                    <th className="px-4 py-2 text-right font-semibold">Giá vốn</th>
                                    <th className="px-4 py-2 text-right font-semibold">Giá trị</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0e7d8]">
                                {khoData.danhSachLoHang.map((lo, idx) => (
                                    <tr key={lo.maLo ?? idx} className="hover:bg-[#fffaf2]">
                                        <td className="px-4 py-2.5 font-mono font-semibold text-[#4b4236]">{lo.maLo}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <StockBadge value={lo.soLuongTon} />
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-amber-700">
                                            {Number(lo.soLuongDaDat ?? 0).toLocaleString("vi-VN")}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-emerald-700 font-medium">
                                            {Number(lo.soLuongKhaDung ?? 0).toLocaleString("vi-VN")}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-[#6f6354]">
                                            {formatCurrency(lo.giaVon ?? 0)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-[#b8860b] font-semibold">
                                            {formatCurrency(lo.giaTriTonKho ?? 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Panel 1 biến thể ─────────────────────────────────────────────────────────
function BienThePanel({ bienThe, initialTongTon = null }) {
    const [open, setOpen] = useState(false);
    const [tonKhoList, setTonKhoList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const anhUrl = bienThe.anhBienThe?.tepTin?.duongDan;

    const handleToggle = useCallback(async () => {
        const nextOpen = !open;
        setOpen(nextOpen);

        if (nextOpen && !loaded) {
            try {
                setIsLoading(true);
                const res = await thongKeHeThongService.getTonKhoBienThe(bienThe.id);
                const serverResponse = res.data;
                if (serverResponse?.status === 200) {
                    setTonKhoList(serverResponse.data || []);
                }
            } catch (e) {
                console.error("Lỗi khi tải tồn kho biến thể:", e);
            } finally {
                setIsLoading(false);
                setLoaded(true);
            }
        }
    }, [open, loaded, bienThe.id]);

    const tongTon = loaded
        ? tonKhoList.reduce((s, k) => s + Number(k.tongSoLuongTon ?? 0), 0)
        : Number(initialTongTon ?? 0);

    return (
        <div className="border border-[#e5d9c6] rounded-xl overflow-hidden bg-bo-surface shadow-sm">
            {/* Header biến thể */}
            <button
                onClick={handleToggle}
                className="w-full flex items-center gap-3 px-4 py-3 bg-bo-surface hover:bg-[#fffaf2] transition-colors text-left"
            >
                {/* Ảnh / color swatch */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#f8f3e8] flex-shrink-0 flex items-center justify-center border border-[#e6dcc9]">
                    {anhUrl ? (
                        <img src={anhUrl} alt={bienThe.maSku} className="w-full h-full object-cover" />
                    ) : bienThe.mauSac?.maMauHex ? (
                        <span
                            className="w-5 h-5 rounded-full border border-[#cec2ad]"
                            style={{ backgroundColor: bienThe.mauSac.maMauHex }}
                        />
                    ) : (
                        <Package className="h-4 w-4 text-[#b9ac98]" />
                    )}
                </div>

                {/* Thông tin SKU */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-[#8b6a21] bg-[#fff3d9] border border-[#f1ddb2] px-2 py-0.5 rounded font-semibold">
                            {bienThe.maSku}
                        </span>
                        {bienThe.mauSac && (
                            <span className="flex items-center gap-1 text-xs text-[#6f6354]">
                                {bienThe.mauSac.maMauHex && (
                                    <span
                                        className="w-3 h-3 rounded-full border border-[#cec2ad] inline-block"
                                        style={{ backgroundColor: bienThe.mauSac.maMauHex }}
                                    />
                                )}
                                {bienThe.mauSac.tenMau}
                            </span>
                        )}
                        {bienThe.size && (
                            <>
                                <span className="text-[#cabda8] text-xs">·</span>
                                <span className="text-xs text-[#7a6e5f]">Size {bienThe.size.tenSize}</span>
                            </>
                        )}
                        {bienThe.chatLieu && (
                            <>
                                <span className="text-[#cabda8] text-xs">·</span>
                                <span className="text-xs text-[#7a6e5f]">{bienThe.chatLieu.tenChatLieu}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-[#938675]">
                            Giá bán:{" "}
                            <b className="text-[#b8860b]">{bienThe.giaBan ? formatCurrency(bienThe.giaBan) : "—"}</b>
                        </span>
                        <span className="text-[#cabda8] text-xs">|</span>
                        <span className="text-xs text-[#938675]">
                            Giá vốn:{" "}
                            <b className="text-[#5f5446]">{bienThe.giaVon ? formatCurrency(bienThe.giaVon) : "—"}</b>
                        </span>
                        {bienThe.trangThai === 1 ? (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">Đang bán</span>
                        ) : (
                            <span className="text-xs bg-bo-danger-soft text-red-600 border border-red-200 px-1.5 py-0.5 rounded">Ngừng bán</span>
                        )}
                    </div>
                </div>

                {/* Tổng tồn */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {(loaded || initialTongTon !== null) && (
                        <span className="text-xs text-[#7a6e5f]">
                            Tổng tồn:{" "}
                            <b className={tongTon > 0 ? "text-emerald-700" : "text-red-600"}>
                                {tongTon.toLocaleString("vi-VN")}
                            </b>
                        </span>
                    )}
                    {open ? (
                        <ChevronDown className="h-4 w-4 text-[#9a8c79]" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-[#9a8c79]" />
                    )}
                </div>
            </button>

            {/* Danh sách kho */}
            {open && (
                <div className="border-t border-[#efe6d8] bg-[#fffdfa] p-3 space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-[#b8860b] text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Đang tải tồn kho...
                        </div>
                    ) : tonKhoList.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-[#9a8c79] text-sm">
                            <AlertCircle className="h-4 w-4" />
                            Không có dữ liệu tồn kho cho biến thể này
                        </div>
                    ) : (
                        tonKhoList.map((kho, idx) => (
                            <KhoTonKhoPanel key={kho.khoId ?? idx} khoData={kho} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export default function InventoryDrawer({ isOpen, onClose, product }) {
    // ✅ Dùng trực tiếp bienTheSanPhams từ SanPhamQuanAoDto — không cần gọi API riêng
    // Giữ tham chiếu ổn định khi drawer đóng (product = null): nếu dùng `?? []` trực tiếp,
    // mảng mới mỗi render khiến effect bên dưới (deps [isOpen, product, bienTheList])
    // chạy lại mỗi render → setVariantTonKhoMap({}) → vòng lặp setState vô hạn.
    const bienTheList = useMemo(() => product?.bienTheSanPhams ?? [], [product]);

    const [variantTonKhoMap, setVariantTonKhoMap] = useState({});
    const [tongTonBienThe, setTongTonBienThe] = useState(null);
    const [isLoadingTongTon, setIsLoadingTongTon] = useState(false);

    const fallbackTonKhoSanPham = useMemo(() => {
        if (!product) return 0;

        const fromProduct = Number(product.tongSoLuongTon ?? product.soLuongTon);
        if (!Number.isNaN(fromProduct)) return fromProduct;

        const fromVariants = bienTheList.reduce((sum, bt) => {
            const n = Number(bt?.tongSoLuongTon ?? bt?.soLuongTon);
            return sum + (Number.isNaN(n) ? 0 : n);
        }, 0);

        return fromVariants;
    }, [product, bienTheList]);

    useEffect(() => {
        if (!isOpen || !product || bienTheList.length === 0) {
            setVariantTonKhoMap({});
            setTongTonBienThe(null);
            setIsLoadingTongTon(false);
            return;
        }

        let isCancelled = false;

        const fetchTongTonBienThe = async () => {
            try {
                setIsLoadingTongTon(true);

                const responses = await Promise.all(
                    bienTheList
                        .filter((bt) => bt?.id != null)
                        .map(async (bt) => {
                            const res = await thongKeHeThongService.getTonKhoBienThe(bt.id);
                            const list = res?.data?.status === 200 ? (res.data.data || []) : [];
                            const tongTon = list.reduce((s, kho) => s + Number(kho?.tongSoLuongTon ?? 0), 0);
                            return { bienTheId: bt.id, tongTon };
                        })
                );

                if (isCancelled) return;

                const nextMap = responses.reduce((acc, item) => {
                    acc[item.bienTheId] = item.tongTon;
                    return acc;
                }, {});

                const tongAll = responses.reduce((sum, item) => sum + item.tongTon, 0);
                setVariantTonKhoMap(nextMap);
                setTongTonBienThe(tongAll);
            } catch (error) {
                if (isCancelled) return;
                console.error("Lỗi khi tổng hợp tồn kho biến thể:", error);
                setVariantTonKhoMap({});
                setTongTonBienThe(null);
            } finally {
                if (!isCancelled) setIsLoadingTongTon(false);
            }
        };

        fetchTongTonBienThe();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, product, bienTheList]);

    const tonKhoHienTaiDisplay = tongTonBienThe ?? fallbackTonKhoSanPham;

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-40 transition-opacity" onClick={onClose} />

            {/* Popup panel */}
            <div className="fixed inset-0 z-50 p-4 sm:p-6 flex items-center justify-center">
                <div className="w-full max-w-[1100px] max-h-[92vh] bg-[#fffdf8] shadow-2xl flex flex-col border border-[#eadfce] rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#eadfce] bg-gradient-to-r from-[#fdf7ea] to-[#fff2dd]">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#b8860b] to-[#d8a826] text-white shadow-sm">
                            <Layers className="h-5 w-5" />
                        </span>
                        <div>
                            <div className="text-[#2f2a23] font-semibold text-base">Tồn kho chi tiết biến thể</div>
                            <div className="text-[#8b7355] text-xs truncate max-w-sm">{product?.tenSanPham}</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#8b7355] hover:text-[#2f2a23] transition-colors p-1.5 rounded-lg hover:bg-[#fff8ea]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Stats bar */}
                {product && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-6 py-3 bg-[#fffaf2] border-b border-[#eadfce] text-xs">
                        <div className="rounded-lg border border-[#eadfce] bg-bo-surface px-3 py-2 flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-[#b8860b]" />
                            <span className="text-[#7a6e5f]">
                                Mã SP: <b className="text-[#5f5446]">{product.maSanPham}</b>
                            </span>
                        </div>
                        <div className="rounded-lg border border-[#eadfce] bg-bo-surface px-3 py-2">
                            <span className="text-[#7a6e5f]">
                                Tồn kho hiện tại:{" "}
                                <b className="text-emerald-700">{Number(tonKhoHienTaiDisplay ?? 0).toLocaleString("vi-VN")}</b>
                            </span>
                        </div>
                        <div className="rounded-lg border border-[#eadfce] bg-bo-surface px-3 py-2">
                            <span className="text-[#7a6e5f]">
                                Số biến thể: <b className="text-[#5f5446]">{bienTheList.length}</b>
                            </span>
                        </div>
                        {isLoadingTongTon && (
                            <span className="sm:col-span-3 text-[#b8860b] inline-flex items-center gap-1 px-1">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Đang đồng bộ tồn kho...
                            </span>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#fdfbf7]">
                    {bienTheList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 h-52 text-[#9a8c79] rounded-xl border border-dashed border-[#e6dcc9] bg-bo-surface">
                            <Package className="h-12 w-12 text-[#d5c6ad]" />
                            <div className="text-sm">Sản phẩm này chưa có biến thể nào</div>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-[#8b7355] px-1">
                                Nhấn vào biến thể để xem tồn kho theo từng kho → nhấn vào kho để xem chi tiết theo lô hàng
                            </p>
                            {bienTheList.map((bt, idx) => (
                                <BienThePanel
                                    key={bt.id ?? idx}
                                    bienThe={bt}
                                    initialTongTon={bt?.id != null ? variantTonKhoMap[bt.id] ?? null : null}
                                />
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-[#eadfce] bg-[#fffaf2] flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="text-sm border-[#d9c8ad] text-[#6f5f49] hover:bg-[#fff2dc]"
                    >
                        Đóng
                    </Button>
                </div>
                </div>
            </div>
        </>,
        document.body
    );
}