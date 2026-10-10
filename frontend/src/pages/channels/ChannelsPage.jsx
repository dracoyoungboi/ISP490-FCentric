import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Activity, AlertTriangle, CalendarClock, Globe, KeyRound, Link2, MoreHorizontal, PauseCircle, PlayCircle,
    PlugZap, RefreshCcw, Settings2, ShieldCheck, ShoppingBag, Store, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import KpiCard from "@/components/shared/KpiCard";
import InfoItem from "@/components/shared/InfoItem";
import InlineResult from "@/components/shared/InlineResult";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import ConnectionStatusBadge from "@/components/channel/ConnectionStatusBadge";
import ShopifyConfigDialog from "@/components/channel/ShopifyConfigDialog";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { kenhBanHangService, isShopifyConfigMock } from "@/services/kenhBanHangService";
import { CHANNELS, CONNECTION_STATUS } from "@/constants/channel";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/dateTime";

// Lazada / TikTok Shop chưa có backend: hiển thị để người dùng biết lộ trình (Phần 12–13).
const UPCOMING_CHANNELS = [
    { maKenh: "LAZADA", tenKenh: "Lazada", description: "Kết nối bằng OAuth với Lazada Seller Center. Sẽ mở ở giai đoạn sau." },
    { maKenh: "TIKTOK", tenKenh: "TikTok Shop", description: "Kết nối bằng OAuth với TikTok Shop Partner Center. Sẽ mở ở giai đoạn sau." },
];

/** ShopifyConfigResponse → trạng thái kết nối dùng chung (CONNECTION_STATUS). */
function shopifyStatus(config) {
    if (!config?.hasAccessToken || !config?.shopDomain) return "chua_ket_noi";
    if (config.tokenExpired ?? config.isTokenExpired) return "het_han";
    return Number(config.trangThai) === 1 ? "dang_hoat_dong" : "tam_dung";
}

function formatDuration(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} phút`;
    if (s < 86400) return `${Math.round(s / 3600)} giờ`;
    return `${Math.round(s / 86400)} ngày`;
}

function tokenExpiryText(config) {
    if (!config?.hasAccessToken) return "Chưa có token";
    if (!config.tokenExpiresAt) return "Token tĩnh, không hết hạn";
    if (config.tokenExpired ?? config.isTokenExpired) return `Đã hết hạn lúc ${formatDateTime(config.tokenExpiresAt)}`;
    const remain = config.secondsUntilExpiration != null ? ` · còn ${formatDuration(config.secondsUntilExpiration)}` : "";
    return `Hết hạn ${formatDateTime(config.tokenExpiresAt)}${remain}`;
}

export default function ChannelsPage() {
    const navigate = useNavigate();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [confirm, setConfirm] = useState(null); // "pause" | "resume"
    const [busy, setBusy] = useState(null); // "check" | "refresh" | "status"
    const [checkResult, setCheckResult] = useState(null);
    const busyRef = useRef(false);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            setConfig(await kenhBanHangService.getShopifyConfig());
        } catch (error) {
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được cấu hình Shopify"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        queueMicrotask(() => fetchConfig());
    }, [fetchConfig]);

    const run = async (type, action) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(type);
        try {
            await action();
        } finally {
            busyRef.current = false;
            setBusy(null);
        }
    };

    const handleCheck = () => run("check", async () => {
        try {
            const res = await kenhBanHangService.testShopifyConnection({ shopDomain: config?.shopDomain, accessToken: null });
            setCheckResult(
                res?.connected
                    ? { ok: true, title: "Kết nối hoạt động", message: [res.shopName, res.myshopifyDomain].filter(Boolean).join(" · ") || res.message }
                    : { ok: false, title: "Kết nối có lỗi", message: res?.message },
            );
        } catch (error) {
            setCheckResult({ ok: false, title: "Kiểm tra thất bại", message: getApiErrorMessage(error, "Không kiểm tra được kết nối") });
        }
    });

    const handleRefreshToken = () => run("refresh", async () => {
        try {
            const dto = await kenhBanHangService.refreshShopifyToken();
            if (dto && typeof dto === "object") setConfig(dto);
            else await fetchConfig();
            toast.success("Đã làm mới access token");
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không làm mới được token"));
        }
    });

    const handleConfirmStatus = async () => {
        const nextStatus = confirm === "pause" ? 0 : 1;
        await run("status", async () => {
            try {
                const dto = await kenhBanHangService.updateShopifyConfig({ shopDomain: config.shopDomain, trangThai: nextStatus });
                setConfig(dto);
                toast.success(nextStatus === 0 ? "Đã tạm dừng kênh Shopify" : "Kênh Shopify đã hoạt động lại");
            } catch (error) {
                toast.error(getApiErrorMessage(error, "Không đổi được trạng thái kênh"));
            }
        });
        setConfirm(null);
    };

    const status = shopifyStatus(config);
    const connected = status !== "chua_ket_noi";
    const kenhId = config?.id ?? CHANNELS.SHOPIFY.id;

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isShopifyConfigMock} />

            {/* ══ STATS ══ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    icon={<Store className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Kênh đã kết nối"
                    value={`${connected ? 1 : 0} / 3`}
                    sub="Lazada, TikTok: giai đoạn sau"
                />
                <KpiCard
                    icon={<Activity className="size-5" />}
                    iconClass={status === "dang_hoat_dong" ? "bg-bo-success-soft text-bo-success" : "bg-bo-warning-soft text-bo-warning"}
                    label="Trạng thái Shopify"
                    value={config ? CONNECTION_STATUS[status]?.label ?? "—" : "—"}
                    valueClass="text-lg"
                    sub={config?.shopDomain || "Chưa cấu hình cửa hàng"}
                />
                <KpiCard
                    icon={<KeyRound className="size-5" />}
                    iconClass={status === "het_han" ? "bg-bo-danger-soft text-bo-danger" : "bg-slate-100 text-slate-600"}
                    label="Access token"
                    value={config?.hasAccessToken ? "Đã lưu" : "Chưa có"}
                    valueClass="text-lg"
                    sub={config?.hasAccessToken ? tokenExpiryText(config) : "Nhập khi kết nối cửa hàng"}
                />
                <KpiCard
                    icon={<CalendarClock className="size-5" />}
                    iconClass="bg-slate-100 text-slate-600"
                    label="Lưu gần nhất"
                    value={config?.ngayCapNhat ? formatDateTime(config.ngayCapNhat, { withYear: false }) : "—"}
                    valueClass="text-lg"
                    sub="Cấu hình Shopify"
                />
            </section>

            {/* ══ THAO TÁC ══ */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-bo-muted">
                    Kết nối cửa hàng Shopify để đồng bộ trạng thái đơn khi xuất kho. Token được mã hóa trước khi lưu.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => navigate("/channels/sync")}
                        className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <Activity className="size-4" />
                        Dashboard đồng bộ
                    </Button>
                    <Button
                        variant="outline"
                        onClick={fetchConfig}
                        disabled={loading}
                        className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                    >
                        <RefreshCcw className="size-4" />
                        Tải lại
                    </Button>
                    <Button
                        onClick={() => setConfigOpen(true)}
                        disabled={!config}
                        className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                    >
                        <PlugZap className="size-4" />
                        {connected ? "Cập nhật cấu hình" : "Kết nối Shopify"}
                    </Button>
                </div>
            </div>

            {/* ══ SHOPIFY ══ */}
            <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                <div className="flex flex-col gap-3 border-b border-bo-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <ChannelLogo maKenh="SHOPIFY" />
                        <div className="min-w-0">
                            <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-bo-foreground sm:text-base">
                                {config?.tenKenh || "Cửa hàng Shopify"}
                                {config ? <ConnectionStatusBadge trangThai={status} /> : null}
                            </h2>
                            <p className="mt-0.5 text-xs leading-5 text-bo-muted sm:text-sm">
                                Kết nối bằng Admin API access token của app Shopify đã cài vào cửa hàng.
                            </p>
                        </div>
                    </div>
                    {connected ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/channels/${kenhId}/setup`)}
                                className="h-8 gap-1.5 border-bo-primary/30 bg-bo-primary-soft px-3 text-xs font-semibold text-bo-primary hover:bg-bo-primary-soft/70 hover:text-bo-primary"
                            >
                                <Settings2 className="size-3.5" />
                                Thiết lập đồng bộ
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/channels/${kenhId}/mappings`)}
                                className="h-8 gap-1.5 border-bo-border bg-white px-3 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                <Link2 className="size-3.5" />
                                Liên kết sản phẩm
                            </Button>
                            <Link to="/sales-orders?kenh=shopify">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 border-bo-border bg-white px-3 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <ShoppingBag className="size-3.5" />
                                    Xem đơn
                                </Button>
                            </Link>
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={Boolean(busy)}
                                        aria-label="Thao tác khác"
                                        className="h-8 w-8 border-bo-border bg-white p-0 text-bo-muted hover:bg-bo-surface-subtle"
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="backoffice-user-menu z-50 w-[210px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    <MenuItem icon={Activity} onClick={handleCheck}>Kiểm tra kết nối</MenuItem>
                                    {config?.hasRefreshToken ? (
                                        <MenuItem icon={RefreshCcw} onClick={handleRefreshToken}>Làm mới token</MenuItem>
                                    ) : null}
                                    <MenuItem icon={KeyRound} onClick={() => setConfigOpen(true)}>Cập nhật cấu hình</MenuItem>
                                    {Number(config?.trangThai) === 1 ? (
                                        <MenuItem icon={PauseCircle} onClick={() => setConfirm("pause")}>Tạm dừng kênh</MenuItem>
                                    ) : (
                                        <MenuItem icon={PlayCircle} onClick={() => setConfirm("resume")}>Hoạt động lại</MenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : null}
                </div>

                {loading && !config ? (
                    <LoadingState className="min-h-48" label="Đang tải cấu hình Shopify" />
                ) : loadError && !config ? (
                    <ErrorState onRetry={fetchConfig} />
                ) : !connected ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                        <p className="text-sm text-bo-muted">Chưa kết nối cửa hàng Shopify nào.</p>
                        <Button
                            variant="outline"
                            onClick={() => setConfigOpen(true)}
                            className="h-9 gap-2 border-bo-primary/30 bg-bo-primary-soft text-bo-primary hover:bg-bo-primary-soft/70 hover:text-bo-primary"
                        >
                            <PlugZap className="size-4" />
                            Kết nối Shopify
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 p-4 sm:p-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <InfoItem icon={Globe} label="Cửa hàng" value={<span className="font-mono text-[13px]">{config.shopDomain}</span>} />
                            <InfoItem icon={KeyRound} label="Admin access token" value={config.accessTokenMasked ? <span className="font-mono text-[13px]">{config.accessTokenMasked}</span> : "Chưa có"} />
                            <InfoItem icon={CalendarClock} label="Hạn token" value={tokenExpiryText(config)} />
                            <InfoItem
                                icon={ShieldCheck}
                                label="Khóa OAuth"
                                value={[
                                    config.clientId ? "Client ID" : null,
                                    config.hasApiSecret ? "API secret" : null,
                                    config.hasRefreshToken ? "Refresh token" : null,
                                ].filter(Boolean).join(" · ") || "Không dùng"}
                            />
                        </div>
                        <p className="text-xs text-bo-muted">
                            Admin API: <span className="font-mono">{config.apiUrl || "—"}</span>
                        </p>

                        {status === "het_han" ? (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm text-red-800" role="alert">
                                <XCircle className="mt-0.5 size-4 shrink-0" />
                                <div className="min-w-0">
                                    <p>Access token đã hết hạn, hệ thống không gọi được Shopify.</p>
                                    <button
                                        type="button"
                                        onClick={config.hasRefreshToken ? handleRefreshToken : () => setConfigOpen(true)}
                                        className="mt-1 text-xs font-semibold text-bo-primary hover:underline"
                                    >
                                        {config.hasRefreshToken ? "Làm mới token" : "Cập nhật token"}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {status === "tam_dung" ? (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <p>Kênh đang tạm dừng: hệ thống không đồng bộ với Shopify cho tới khi hoạt động lại.</p>
                            </div>
                        ) : null}

                        <InlineResult result={checkResult} />
                    </div>
                )}
            </section>

            {/* ══ KÊNH GIAI ĐOẠN SAU ══ */}
            {UPCOMING_CHANNELS.map((kenh) => (
                <section key={kenh.maKenh} className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <ChannelLogo maKenh={kenh.maKenh} />
                            <div className="min-w-0">
                                <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">{kenh.tenKenh}</h2>
                                <p className="mt-0.5 text-xs leading-5 text-bo-muted sm:text-sm">{kenh.description}</p>
                            </div>
                        </div>
                        <Button variant="outline" disabled className="h-9 shrink-0 border-bo-border bg-white text-bo-muted">
                            Giai đoạn sau
                        </Button>
                    </div>
                </section>
            ))}

            {configOpen ? (
                <ShopifyConfigDialog
                    open
                    onOpenChange={setConfigOpen}
                    config={config}
                    onSaved={(dto) => {
                        setConfig(dto);
                        setCheckResult(null);
                        setConfigOpen(false);
                        toast.success("Đã lưu cấu hình Shopify");
                    }}
                />
            ) : null}

            <ConfirmModal
                isOpen={Boolean(confirm)}
                onClose={() => busy === null && setConfirm(null)}
                onConfirm={handleConfirmStatus}
                isLoading={busy === "status"}
                variant={confirm === "pause" ? "warning" : "info"}
                title={confirm === "pause" ? "Tạm dừng kênh Shopify" : "Cho kênh Shopify hoạt động lại"}
                description={
                    confirm === "pause"
                        ? "Hệ thống sẽ ngừng đồng bộ với Shopify. Cấu hình và token vẫn được giữ nguyên."
                        : "Hệ thống sẽ tiếp tục đồng bộ với Shopify bằng cấu hình đã lưu."
                }
                confirmText={confirm === "pause" ? "Tạm dừng" : "Hoạt động lại"}
                cancelText="Quay lại"
            />
        </PageContainer>
    );
}

function MenuItem({ icon, onClick, children }) {
    return (
        <DropdownMenuItem
            onClick={onClick}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
        >
            {createElement(icon, { className: "size-4" })}
            {children}
        </DropdownMenuItem>
    );
}
