import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import PrintDocCode from "@/components/print/PrintDocCode";
import apiClient from "@/services/apiClient";
import { toast } from "@/lib/thongBaoNhanh";
import { getApiErrorMessage } from "@/utils/apiError";
import { t } from "@/i18n";
import "@/components/print/shopeeAwb.css";

/**
 * Bản in Vận Đơn Shopee Chuẩn Sàn AWB (Air Waybill) khổ tem nhiệt A6 (100 × 150 mm).
 * Bố cục chuẩn theo mẫu của Shopee Xpress (SPX Express Vietnam):
 * 1. Khi có file PDF chính thức từ Shopee API: Cung cấp liên kết mở/tải PDF gốc.
 * 2. 4 viền chữ watermark lặp mã vận đơn (SPXVN...).
 * 3. Header 3 cột: PICKUP BY | DELIVERY BY | Shopee SPX.
 * 4. Barcode Code 128 to bản trung tâm của mã vận đơn.
 * 5. Cụm Người nhận (Trái kèm tag WKD) và Mã trạm định tuyến Hub + QR Code (Phải).
 * 6. Dòng số đơn sàn.
 * 7. Thanh 3 chỉ số: [Tổng KL: 0.3 KG] | [ĐƯỢC ĐỒNG KIỂM] | [ĐÃ THANH TOÁN (COD: 0 đ)].
 * 8. Bảng danh sách hàng hóa tinh gọn.
 * 9. Footer cam kết pháp luật và Mã trạm đích (SG100A-00-00-01).
 */
export default function ShopeeAwbDocument({ model, company }) {
    if (!model) return null;

    const [showSimulated, setShowSimulated] = useState(true);
    const [dangTaiPdf, setDangTaiPdf] = useState(false);

    const channelInfo = model.channelOrderInfo || {};
    const recipient = model.recipient || {};
    const trackingCode = channelInfo.trackingBarcode || channelInfo.trackingCode || "SPXVN261115BBMC00TC";
    const orderCode = channelInfo.orderCode || "261115BBMC00TC";
    const routingCode = model.routingCode || "1-SGN-HUB";
    const stationCode = model.stationCode || "SG100A-00-00-01";
    const recipientTag = model.recipientTag || "WKD";
    const codLabel = model.codLabel || "ĐÃ THANH TOÁN (COD: 0 đ)";
    const inspectionLabel = model.inspectionLabel || "ĐƯỢC ĐỒNG KIỂM";
    const packageWeight = model.packageWeight || "Tổng KL: 0.3 KG";
    const pickupBy = model.pickupBy || "SPX EXPRESS";
    const deliveryBy = model.deliveryBy || "SPX EXPRESS";
    const serviceType = model.serviceType || "Sandbox SPX Express";
    const qrValue = model.qrCodeValue || trackingCode;
    const items = model.items || [];
    const totalQty = model.totalQuantity || items.reduce((s, it) => s + (it._quantity || 1), 0);
    const orderDateShort = model.orderDateShort || "15 Nov 2026";
    const senderName = company?.tenCongTy || "FCentric";
    const shippingDocUrl = model.shippingDocUrl || null;

    const xuLyTaiPdfChinhThuc = async (taiVe = false) => {
        if (!shippingDocUrl || dangTaiPdf) return;
        if (!shippingDocUrl.startsWith("/")) {
            window.open(shippingDocUrl, "_blank", "noopener,noreferrer");
            return;
        }
        try {
            setDangTaiPdf(true);
            const res = await apiClient.get(shippingDocUrl, { responseType: "blob" });
            const blob = res.data;
            const blobUrl = window.URL.createObjectURL(blob);
            if (taiVe) {
                const duoi = String(blob?.type || "").toLowerCase().includes("pdf") ? "pdf" : "html";
                const link = document.createElement("a");
                link.href = blobUrl;
                link.download = `AWB_Shopee_${trackingCode}.${duoi}`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            } else {
                const win = window.open(blobUrl, "_blank");
                if (!win) window.location.href = blobUrl;
            }
            window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
        } catch (err) {
            toast.error(t("Không thể tải tem vận đơn từ sàn: {{error}}", { error: getApiErrorMessage(err, t("Lỗi kết nối")) }));
        } finally {
            setDangTaiPdf(false);
        }
    };

    return (
        <div className="sawb-wrapper">
            {/* 1. Nếu có file PDF / URL vận đơn chính thức từ Shopee API */}
            {shippingDocUrl ? (
                <div className="sawb-official-pdf-section">
                    <div className="sawb-official-pdf-toolbar">
                        <div className="sawb-official-pdf-badge">
                            <span className="sawb-status-dot"></span>
                            <span>{t("Vận đơn AWB chính thức Shopee (PDF chuẩn sàn)")}</span>
                        </div>
                        <div className="sawb-official-pdf-actions">
                            <button
                                type="button"
                                disabled={dangTaiPdf}
                                onClick={() => xuLyTaiPdfChinhThuc(false)}
                                className="sawb-btn sawb-btn-primary"
                            >
                                {t("Mở PDF trong tab mới")}
                            </button>
                            <button
                                type="button"
                                disabled={dangTaiPdf}
                                onClick={() => xuLyTaiPdfChinhThuc(true)}
                                className="sawb-btn sawb-btn-secondary"
                            >
                                {t("Tải PDF A6")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSimulated((prev) => !prev)}
                                className="sawb-btn sawb-btn-secondary"
                            >
                                {showSimulated ? t("Ẩn xem trước") : t("Xem bản in nhiệt")}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* 2. Bản in tem nhiệt A6 chuẩn sàn Shopee Express */}
            {(!shippingDocUrl || showSimulated) && (
                <>
                    {/* Viền chữ watermark 4 cạnh */}
                    <div className="sawb-watermark-top">
                        <span>{trackingCode}</span>
                        <span>{trackingCode}</span>
                    </div>
                    <div className="sawb-watermark-bottom">
                        <span>{trackingCode}</span>
                        <span>{trackingCode}</span>
                    </div>
                    <div className="sawb-watermark-left">
                        <span>{trackingCode}</span>
                    </div>
                    <div className="sawb-watermark-right">
                        <span>{trackingCode}</span>
                    </div>

                    {/* Khung viền chính */}
                    <div className="sawb-card">
                        {/* 1. Header 3 cột */}
                        <div className="sawb-header">
                            <div className="sawb-header-col">
                                <div className="sawb-header-title">{t("PICKUP BY")}</div>
                                <div className="sawb-carrier-logo">{pickupBy}</div>
                            </div>
                            <div className="sawb-header-col">
                                <div className="sawb-header-title">{t("DELIVERY BY")}</div>
                                <div className="sawb-carrier-logo">{deliveryBy}</div>
                            </div>
                            <div className="sawb-header-col">
                                <div className="sawb-shopee-title">
                                    <span>Shopee</span>
                                </div>
                                <div className="sawb-shopee-tags">
                                    <span>{serviceType}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Barcode to bản */}
                        <div className="sawb-barcode-section">
                            <div className="sawb-barcode-render">
                                <PrintDocCode
                                    mode="ma_vach"
                                    value={trackingCode}
                                    paperSize="A6"
                                    placement="body"
                                />
                            </div>
                            <div className="sawb-barcode-text">{trackingCode}</div>
                        </div>

                        {/* 3. Cụm Người nhận & Định tuyến */}
                        <div className="sawb-routing-grid">
                            <div className="sawb-recipient-col">
                                <div className="sawb-recipient-header">
                                    <div className="sawb-recipient-name">
                                        {t("Người nhận:")} {recipient.customer || t("Khách hàng Shopee")}
                                    </div>
                                    {recipientTag && <span className="sawb-recipient-tag">{recipientTag}</span>}
                                </div>
                                <div className="sawb-recipient-address">
                                    {recipient.address || t("Theo bưu kiện giao vận Shopee")}
                                </div>
                                <div className="sawb-sender-row">
                                    <span>{t("Người gửi:")} {senderName}</span>
                                </div>
                            </div>

                            <div className="sawb-routing-col">
                                <div className="sawb-hub-code">{routingCode}</div>
                                <div className="sawb-qrcode-box">
                                    <QRCodeSVG value={qrValue} size={64} level="M" />
                                </div>
                            </div>
                        </div>

                        {/* 4. Dòng số đơn sàn */}
                        <div className="sawb-order-code-row">
                            <span>{t("Số đơn:")} {orderCode}</span>
                        </div>

                        {/* 5. Khối 3 chỉ số nghiệp vụ */}
                        <div className="sawb-metrics-row">
                            <div className="sawb-metric-item">{packageWeight}</div>
                            <div className="sawb-metric-item">{inspectionLabel}</div>
                            <div className="sawb-metric-item">{codLabel}</div>
                        </div>

                        {/* 6. Danh sách hàng hóa */}
                        <div className="sawb-items-section">
                            <div className="sawb-items-header">
                                <span>{t("Danh sách SP (Tên - Phân loại - Mã hàng)")}</span>
                                <span>({t("Ngày đặt:")} {orderDateShort})</span>
                                <span>{t("SL ({{count}})", { count: totalQty })}</span>
                            </div>
                            <div className="sawb-items-list">
                                {items.length > 0 ? (
                                    items.map((it, idx) => (
                                        <div key={idx} className="sawb-item-row">
                                            <div className="sawb-item-info">
                                                <span className="sawb-item-name">{it.name}</span>
                                                {it.variant && <span className="sawb-item-meta"> - {it.variant}</span>}
                                                {it.sku && <span className="sawb-item-meta"> - {it.sku}</span>}
                                            </div>
                                            <div className="sawb-item-qty">{it.quantity}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="sawb-item-row">
                                        <div className="sawb-item-info">
                                            <span className="sawb-item-name">{t("Sản phẩm Shopee")}</span>
                                        </div>
                                        <div className="sawb-item-qty">1</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 7. Footer */}
                        <div className="sawb-footer">
                            <div className="sawb-legal-text">
                                {t("**Người gửi cam kết tuân thủ mọi quy định vận chuyển theo quy định của pháp luật. Căn bản kiểm soát vô giá, nhận định đúng quy định Luật Bưu Chính.**")}
                            </div>
                            <div className="sawb-station-code">{stationCode}</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
