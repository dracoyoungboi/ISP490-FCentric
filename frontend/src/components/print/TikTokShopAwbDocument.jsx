import React from "react";
import { QRCodeSVG } from "qrcode.react";
import PrintDocCode from "@/components/print/PrintDocCode";
import "@/components/print/tiktokShopAwb.css";

/**
 * Bản in Vận Đơn TikTok Shop Chuẩn Sàn AWB (Air Waybill) khổ tem nhiệt A6 (100 × 150 mm).
 * Bố cục đồng nhất 100% với mẫu in của TikTok Shop Seller Center:
 * 1. 2 viền chữ watermark lặp mã vận đơn dọc 2 cạnh.
 * 2. Header 3 phần: [TikTok Shop logo] | [J&T Express / ĐVVC] | [GIAO NHANH 24H].
 * 3. Barcode Code 128 to bản trung tâm của mã vận đơn TikTok Shop.
 * 4. Người gửi (F-centric).
 * 5. Cụm Người nhận (Trái) và Mã chia chọn định tuyến 3 tầng + QR Code (Phải).
 * 6. Footer: QR Promo TikTok bên trái và Bảng thông tin đơn (Trọng lượng, Order ID, Ngày đặt, Ngày giao dự kiến).
 */
export default function TikTokShopAwbDocument({ model, company }) {
    if (!model) return null;

    const channelInfo = model.channelOrderInfo || {};
    const recipient = model.recipient || {};
    const trackingCode = channelInfo.trackingBarcode || channelInfo.trackingCode || "862728824413";
    const orderCode = channelInfo.orderCode || "587143735838410130";
    const senderName = company?.tenCongTy || "F-centric";
    const carrierName = channelInfo.carrierName || model.deliveryBy || "J&T Express";
    const serviceType = model.serviceType || "Giao Nhanh 24H";
    const packageWeight = model.packageWeight ? model.packageWeight.replace("Tổng KL: ", "").trim() : "0.300 KG";
    const orderDateTime = model.orderDateTimeFormatted || "2026-11-12 18:04";
    const expectedDelivery = model.expectedDeliveryFormatted || "15-11-2026";
    const shippingDocUrl = model.shippingDocUrl || null;

    // Mã định tuyến (Sort code): ví dụ "473 / H024V02 / 018"
    const routingLines = (model.routingCode || "473\nH024V02\n018").split(/[\n/]/).map((s) => s.trim()).filter(Boolean);

    return (
        <div className="ttawb-wrapper">
            {/* Banner mở PDF gốc nếu sàn đã cấp doc_url */}
            {shippingDocUrl && (
                <div className="ttawb-external-pdf-banner">
                    <span>📄 Đã lấy được file PDF vận đơn gốc từ TikTok Shop API</span>
                    <a
                        href={shippingDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ttawb-external-pdf-btn"
                    >
                        Mở PDF gốc sàn
                    </a>
                </div>
            )}

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
                        />
                    </div>
                    <div className="ttawb-barcode-text">{trackingCode}</div>
                </div>

                {/* 3. Người gửi */}
                <div className="ttawb-sender-row">
                    <span className="ttawb-sender-title">Người gửi</span>
                    <span className="ttawb-sender-name">{senderName}</span>
                </div>

                {/* 4. Cụm Người nhận & Định tuyến */}
                <div className="ttawb-routing-grid">
                    <div className="ttawb-recipient-col">
                        <div className="ttawb-recipient-header">
                            <span className="ttawb-recipient-label">Người nhận</span>
                            <span className="ttawb-recipient-name">{recipient.customer || "Khách TikTok"}</span>
                        </div>
                        {recipient.phone && recipient.phone !== "—" && (
                            <div className="ttawb-recipient-phone">{recipient.phone}</div>
                        )}
                        <div className="ttawb-recipient-address">
                            {recipient.address || "Địa chỉ giao hàng TikTok Shop"}
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
                            Nhận ưu đãi đến 40Tr VND khi mở shop mới trên TikTok. Quét QR ngay!
                        </div>
                    </div>

                    <div className="ttawb-meta-col">
                        <div className="ttawb-meta-row">
                            <div className="ttawb-meta-label">Trọng lượng:</div>
                            <div className="ttawb-meta-val">{packageWeight}</div>
                        </div>
                        <div className="ttawb-meta-row">
                            <div className="ttawb-meta-label">Order ID:</div>
                            <div className="ttawb-meta-val">{orderCode}</div>
                        </div>
                        <div className="ttawb-meta-row">
                            <div className="ttawb-meta-label">Thời gian đặt hàng:</div>
                            <div className="ttawb-meta-val">{orderDateTime}</div>
                        </div>
                        <div className="ttawb-meta-row">
                            <div className="ttawb-meta-label">Ngày giao dự kiến:</div>
                            <div className="ttawb-meta-val">{expectedDelivery}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

