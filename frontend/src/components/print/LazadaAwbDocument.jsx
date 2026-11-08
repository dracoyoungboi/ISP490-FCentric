import React from "react";
import { QRCodeSVG } from "qrcode.react";
import PrintDocCode from "@/components/print/PrintDocCode";
import "@/components/print/lazadaAwb.css";

/**
 * Bản in Vận Đơn Lazada Chuẩn Sàn AWB (Air Waybill) khổ tem nhiệt A6 (100 × 150 mm).
 * Bố cục chuẩn theo mẫu của Lazada Seller Center khi in thực tế:
 * 1. 4 viền chữ watermark lặp mã vận đơn.
 * 2. Header 3 cột (PICKUP BY | DELIVERY BY | Lazada Standard).
 * 3. Barcode Code 128 to bản trung tâm của mã vận đơn.
 * 4. Cụm Người nhận (Trái kèm tag WKD) và Mã chia chọn định tuyến + QR Code (Phải).
 * 5. Dòng số đơn sàn.
 * 6. Thanh 3 chỉ số nghiệp vụ: [Tổng KL: 0.3 KG] | [ĐƯỢC ĐỒNG KIỂM] | [THU HỘ(COD): 62.200 VNĐ].
 * 7. Bảng danh sách hàng hóa tinh gọn.
 * 8. Footer cam kết VAT, Luật Bưu chính và Mã trạm phát đích (BN237B-00-00-03).
 */
export default function LazadaAwbDocument({ model, company }) {
    if (!model) return null;

    const channelInfo = model.channelOrderInfo || {};
    const recipient = model.recipient || {};
    const trackingCode = channelInfo.trackingBarcode || channelInfo.trackingCode || "BESTMP0055505096VNA";
    const orderCode = channelInfo.orderCode || "530454604685005";
    const routingCode = model.routingCode || "3-BNO-TAP";
    const stationCode = model.stationCode || "BN237B-00-00-03";
    const recipientTag = model.recipientTag || "WKD";
    const codLabel = model.codLabel || "THU HỘ(COD): 62.200 VNĐ";
    const inspectionLabel = model.inspectionLabel || "ĐƯỢC ĐỒNG KIỂM";
    const packageWeight = model.packageWeight || "Tổng KL: 0.3 KG";
    const pickupBy = model.pickupBy || "BEST EXPRESS";
    const deliveryBy = model.deliveryBy || "BEST EXPRESS";
    const serviceType = model.serviceType || "STANDARD";
    const qrValue = model.qrCodeValue || trackingCode;
    const items = model.items || [];
    const totalQty = model.totalQuantity || items.reduce((s, it) => s + (it._quantity || 1), 0);
    const orderDateShort = model.orderDateShort || "07 Nov 2026";
    const senderName = company?.tenCongTy || "FCentric";

    return (
        <div className="lawb-wrapper">
            {/* Viền chữ watermark 4 cạnh */}
            <div className="lawb-watermark-top">
                <span>{trackingCode}</span>
                <span>{trackingCode}</span>
            </div>
            <div className="lawb-watermark-bottom">
                <span>{trackingCode}</span>
                <span>{trackingCode}</span>
            </div>
            <div className="lawb-watermark-left">
                <span>{trackingCode}</span>
            </div>
            <div className="lawb-watermark-right">
                <span>{trackingCode}</span>
            </div>

            {/* Khung viền chính */}
            <div className="lawb-card">
                {/* 1. Header 3 cột */}
                <div className="lawb-header">
                    <div className="lawb-header-col">
                        <div className="lawb-header-title">PICKUP BY</div>
                        <div className="lawb-carrier-logo">{pickupBy}</div>
                    </div>
                    <div className="lawb-header-col">
                        <div className="lawb-header-title">DELIVERY BY</div>
                        <div className="lawb-carrier-logo">{deliveryBy}</div>
                    </div>
                    <div className="lawb-header-col">
                        <div className="lawb-lazada-title">
                            <span className="lawb-heart-icon">♥</span>
                            <span>Lazada</span>
                            <span>-</span>
                        </div>
                        <div className="lawb-lazada-tags">
                            <span>{serviceType}</span>
                            <span>PU</span>
                            <span>MP</span>
                        </div>
                    </div>
                </div>

                {/* 2. Barcode to bản */}
                <div className="lawb-barcode-section">
                    <div className="lawb-barcode-render">
                        <PrintDocCode
                            mode="ma_vach"
                            value={trackingCode}
                            paperSize="A6"
                            placement="body"
                        />
                    </div>
                    <div className="lawb-barcode-text">{trackingCode}</div>
                </div>

                {/* 3. Cụm Người nhận & Định tuyến */}
                <div className="lawb-routing-grid">
                    <div className="lawb-recipient-col">
                        <div className="lawb-recipient-header">
                            <div>
                                Người nhận: <strong>{recipient.customer || "Khách hàng"}</strong>
                            </div>
                            <span className="lawb-tag-wkd">{recipientTag}</span>
                        </div>
                        <div className="lawb-address-text">
                            {recipient.address || "Địa chỉ nhận hàng"}
                        </div>
                        <div className="lawb-sender-text">
                            Người gửi: <strong>{senderName}</strong>
                        </div>
                    </div>
                    <div className="lawb-sorting-col">
                        <div className="lawb-routing-code">{routingCode}</div>
                        <div className="lawb-qrcode-wrapper">
                            <QRCodeSVG
                                value={qrValue}
                                size={54}
                                level="M"
                                marginSize={0}
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Số đơn hàng */}
                <div className="lawb-order-row">
                    Số đơn: <strong>{orderCode}</strong>
                </div>

                {/* 5. Thanh 3 chỉ số nghiệp vụ */}
                <div className="lawb-metrics-row">
                    <div className="lawb-metric-item lawb-metric-weight">
                        {packageWeight}
                    </div>
                    <div className="lawb-metric-item lawb-metric-inspection">
                        {inspectionLabel}
                    </div>
                    <div className="lawb-metric-item lawb-metric-cod">
                        {codLabel}
                    </div>
                </div>

                {/* 6. Bảng danh sách hàng hóa */}
                <div className="lawb-items-section">
                    <div className="lawb-items-header">
                        <span>Danh sách SP (Tên - Phân loại - Mã Hàng)</span>
                        <span>(Ngày đặt: {orderDateShort})</span>
                        <span>SL ({totalQty})</span>
                    </div>
                    <div className="lawb-items-list">
                        {items.length === 0 ? (
                            <div className="lawb-item-row">
                                <div className="lawb-item-desc">Hàng hóa thời trang FCentric</div>
                                <div className="lawb-item-qty">1</div>
                            </div>
                        ) : (
                            items.slice(0, 4).map((item, idx) => {
                                const desc = [item.name, item.variant, item.sku].filter(Boolean).join(" - ");
                                return (
                                    <div key={idx} className="lawb-item-row">
                                        <div className="lawb-item-desc">{desc}</div>
                                        <div className="lawb-item-qty">{item.quantity || item._quantity || 1}</div>
                                    </div>
                                );
                            })
                        )}
                        {items.length > 4 ? (
                            <div className="lawb-item-row" style={{ fontStyle: "italic", fontSize: "6pt", color: "#666" }}>
                                ... và {items.length - 4} sản phẩm khác trong kiện
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* 7. Footer pháp lý & mã trạm */}
                <div className="lawb-footer-section">
                    <div className="lawb-legal-disclaimer">
                        ***Người gửi cam kết phát hành và gửi hoá đơn VAT cho người nhận đúng theo quy định của pháp luật. Các điều khoản khác về gửi, nhận đơn hàng được áp dụng như quy định của Luật Bưu Chính.
                    </div>
                    <div className="lawb-station-code">{stationCode}</div>
                </div>
            </div>
        </div>
    );
}

