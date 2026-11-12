import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import PrintDocCode from "@/components/print/PrintDocCode";
import { t } from "@/i18n";
import "@/components/print/tiktokShopAwb.css";

/**
 * Bản in Vận Đơn TikTok Shop Chuẩn Sàn AWB (Air Waybill) khổ tem nhiệt A6 (100 × 150 mm).
 * 1. Khi có file PDF chính thức từ TikTok Shop API: Hiển thị trực tiếp tem PDF chuẩn sàn do sàn cấp.
 * 2. Khi sàn chưa cấp PDF: Hiển thị cảnh báo và bản xem trước mô phỏng A6.
 */
export default function TikTokShopAwbDocument({ model, company }) {
    if (!model) return null;

    const [showSimulated, setShowSimulated] = useState(false);

    const channelInfo = model.channelOrderInfo || {};
    const recipient = model.recipient || {};
    const trackingCode = channelInfo.trackingBarcode || channelInfo.trackingCode || "862728824413";
    const orderCode = channelInfo.orderCode || "587143735838410130";
    const senderName = company?.tenCongTy || "F-centric";
    const rawCarrier = channelInfo.carrierName || model.deliveryBy || "";
    const carrierName = rawCarrier && rawCarrier !== "—" ? rawCarrier : "J&T Express";
    const serviceType = model.serviceType || "Giao Nhanh 24H";
    const packageWeight = model.packageWeight ? model.packageWeight.replace("Tổng KL: ", "").trim() : "0.300 KG";
    const orderDateTime = model.orderDateTimeFormatted || "2026-11-12 18:04";
    const expectedDelivery = model.expectedDeliveryFormatted || "15-11-2026";
    const shippingDocUrl = model.shippingDocUrl || null;

    // Mã định tuyến (Sort code): ví dụ "473 / H024V02 / 018"
    const routingLines = (model.routingCode || "473\nH024V02\n018").split(/[\n/]/).map((s) => s.trim()).filter(Boolean);

    return (
        <div className="ttawb-wrapper">
            {/* 1. Nếu có file PDF chính thức từ TikTok Shop API */}
            {shippingDocUrl ? (
                <div className="ttawb-official-pdf-section">
                    <div className="ttawb-official-pdf-toolbar">
                        <div className="ttawb-official-pdf-badge">
                            <span className="ttawb-status-dot"></span>
                            <span>{t("Vận đơn AWB chính thức TikTok Shop (PDF chuẩn sàn)")}</span>
                        </div>
                        <div className="ttawb-official-pdf-actions">
                            <a
                                href={shippingDocUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ttawb-btn ttawb-btn-primary"
                            >
                                {t("Mở PDF trong tab mới")}
                            </a>
                            <a
                                href={shippingDocUrl}
                                download={`AWB_${trackingCode}.pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="ttawb-btn ttawb-btn-secondary"
                            >
                                {t("Tải PDF A6")}
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowSimulated((prev) => !prev)}
                                className="ttawb-btn ttawb-btn-secondary"
                            >
                                {showSimulated ? t("Ẩn xem trước") : t("Xem bản mô phỏng")}
                            </button>
                        </div>
                    </div>

                    <div className="ttawb-official-pdf-embed-wrapper">
                        <iframe
                            src={shippingDocUrl}
                            title={t("Vận đơn AWB chính thức TikTok Shop")}
                            className="ttawb-official-pdf-frame"
                        />
                    </div>
                </div>
            ) : (
                /* 2. Cảnh báo khi sàn chưa cấp file PDF */
                <div className="ttawb-warning-banner">
                    <div className="ttawb-warning-title">
                        {t("⚠️ Sàn chưa cấp file PDF vận đơn chính hãng")}
                    </div>
                    <div className="ttawb-warning-desc">
                        {t("TikTok Shop yêu cầu đơn hàng phải ở trạng thái sẵn sàng giao để cấp tem AWB chính thức. Bên dưới là bản xem trước mô phỏng.")}
                    </div>
                </div>
            )}

            {/* Khung HTML mô phỏng (hiển thị khi chưa có PDF hoặc khi người dùng bấm bật xem) */}
            {(!shippingDocUrl || showSimulated) && (
                <div className="ttawb-simulated-container">
                    {/* 2 cạnh viền watermark mã vận đơn */}
                    <div className="ttawb-watermark-left">
                        <span>{trackingCode}</span>
                    </div>
                    <div className="ttawb-watermark-right">
                        <span>{trackingCode}</span>
                    </div>

                    {/* Khung viền chính của tem A6 */}
                    <div className="ttawb-card">
                        {/* 1. Header 3 phần: TikTok Shop | Carrier | Giao Nhanh 24H */}
                        <div className="ttawb-header">
                            <div className="ttawb-header-brand">
                                <span style={{ fontSize: "11pt" }}>🎵</span>
                                <span>TikTok Shop</span>
                            </div>
                            <div className="ttawb-header-carrier">
                                {carrierName}
                            </div>
                            <div className="ttawb-header-badge">
                                {serviceType}
                            </div>
                        </div>

                        {/* 2. Barcode to bản trung tâm */}
                        <div className="ttawb-barcode-section">
                            <div className="ttawb-barcode-render">
                                <PrintDocCode
                                    mode="ma_vach"
                                    value={trackingCode}
                                    paperSize="A6"
                                    placement="body"
                                    showText={false}
                                />
                            </div>
                            <div className="ttawb-barcode-text">{trackingCode}</div>
                        </div>

                        {/* 3. Người gửi */}
                        <div className="ttawb-sender-row">
                            <span className="ttawb-sender-title">{t("Người gửi")}</span>
                            <span className="ttawb-sender-name">{senderName}</span>
                        </div>

                        {/* 4. Cụm Người nhận & Định tuyến */}
                        <div className="ttawb-routing-grid">
                            <div className="ttawb-recipient-col">
                                <div className="ttawb-recipient-header">
                                    <span className="ttawb-recipient-label">{t("Người nhận")}</span>
                                    <span className="ttawb-recipient-name">{recipient.customer || t("Khách TikTok")}</span>
                                </div>
                                {recipient.phone && recipient.phone !== "—" && (
                                    <div className="ttawb-recipient-phone">{recipient.phone}</div>
                                )}
                                <div className="ttawb-recipient-address">
                                    {recipient.address || t("Địa chỉ giao hàng TikTok Shop")}
                                </div>
                            </div>

                            <div className="ttawb-routing-col">
                                <div className="ttawb-routing-numbers">
                                    {routingLines.map((line, idx) => (
                                        <div key={idx} className="ttawb-routing-big">{line}</div>
                                    ))}
                                </div>
                                <div className="ttawb-routing-qr">
                                    <QRCodeSVG
                                        value={trackingCode}
                                        size={50}
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 5. Footer: QR Promo TikTok & Bảng chi tiết đơn */}
                        <div className="ttawb-footer">
                            <div className="ttawb-promo-col">
                                <QRCodeSVG
                                    value="https://seller-vn.tiktok.com"
                                    size={44}
                                    level="L"
                                    includeMargin={false}
                                />
                                <div className="ttawb-promo-text-badge">
                                    {t("Nhận ưu đãi đến 40Tr VND khi mở shop mới trên TikTok. Quét QR ngay!")}
                                </div>
                            </div>

                            <div className="ttawb-meta-col">
                                <div className="ttawb-meta-row">
                                    <div className="ttawb-meta-label">{t("Trọng lượng:")}</div>
                                    <div className="ttawb-meta-val">{packageWeight}</div>
                                </div>
                                <div className="ttawb-meta-row">
                                    <div className="ttawb-meta-label">Order ID:</div>
                                    <div className="ttawb-meta-val">{orderCode}</div>
                                </div>
                                <div className="ttawb-meta-row">
                                    <div className="ttawb-meta-label">{t("Thời gian đặt hàng:")}</div>
                                    <div className="ttawb-meta-val">{orderDateTime}</div>
                                </div>
                                <div className="ttawb-meta-row">
                                    <div className="ttawb-meta-label">{t("Ngày giao dự kiến:")}</div>
                                    <div className="ttawb-meta-val">{expectedDelivery}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

