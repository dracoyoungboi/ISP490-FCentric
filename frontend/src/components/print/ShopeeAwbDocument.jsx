import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import PrintDocCode from "@/components/print/PrintDocCode";
import {
    docLoiTuBlob,
    laHtmlNoiBoFCentric,
    laPdfBlob,
    lamSachHtmlDeNhung,
    trichMaVanDonTuHtml,
} from "@/components/print/shopeeAwbHelpers";
import apiClient from "@/services/apiClient";
import { getApiErrorMessage } from "@/utils/apiError";
import { t } from "@/i18n";
import "@/components/print/shopeeAwb.css";

/**
 * Bản in Vận Đơn Shopee Chuẩn Sàn AWB (Air Waybill) khổ tem nhiệt A6 (100 × 150 mm).
 * Tự động tải tệp vận đơn chính thức từ Shopee (/van-don-san) qua apiClient và nhúng gọn trực tiếp
 * vào khung A6 giữa màn hình (giống TikTokShopAwbDocument, không thêm thanh nút/khung bao ngoài),
 * fallback sang tem nhiệt A6 FCentric khi sàn chưa trả tệp.
 */
export default function ShopeeAwbDocument({ model, company }) {
    const [reloadSeq, setReloadSeq] = useState(0);
    const [docState, setDocState] = useState({
        key: null,
        status: "idle",
        pdfUrl: null,
        htmlContent: null,
        resolvedTracking: null,
        errorMessage: null,
    });
    const pdfUrlRef = useRef(null);

    const shippingDocUrl = model?.shippingDocUrl || null;
    const isInternalApi = Boolean(shippingDocUrl && shippingDocUrl.startsWith("/"));
    const fetchKey = isInternalApi ? `${shippingDocUrl}#${reloadSeq}` : null;

    const giaiPhongPdfUrl = () => {
        if (pdfUrlRef.current) {
            window.URL.revokeObjectURL(pdfUrlRef.current);
            pdfUrlRef.current = null;
        }
    };

    useEffect(() => {
        if (!fetchKey || !shippingDocUrl) {
            giaiPhongPdfUrl();
            return undefined;
        }

        let huy = false;
        giaiPhongPdfUrl();

        const taiVanDonNoiBo = async () => {
            try {
                const res = await apiClient.get(shippingDocUrl, { responseType: "blob" });
                if (huy) return;
                const blob = res.data;
                if (await laPdfBlob(blob)) {
                    const pdfBlob = new Blob([blob], { type: "application/pdf" });
                    const objectUrl = window.URL.createObjectURL(pdfBlob);
                    if (huy) {
                        window.URL.revokeObjectURL(objectUrl);
                        return;
                    }
                    pdfUrlRef.current = objectUrl;
                    setDocState({
                        key: fetchKey,
                        status: "pdf",
                        pdfUrl: objectUrl,
                        htmlContent: null,
                        resolvedTracking: null,
                        errorMessage: null,
                    });
                    return;
                }

                const text = await blob.text();
                if (huy) return;

                if (text.trim().startsWith("{")) {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(text);
                    } catch {
                        parsed = null;
                    }
                    if (parsed) {
                        setDocState({
                            key: fetchKey,
                            status: "error",
                            pdfUrl: null,
                            htmlContent: null,
                            resolvedTracking: null,
                            errorMessage: parsed.message || parsed.error || t("Lỗi kết nối"),
                        });
                        return;
                    }
                }

                if (laHtmlNoiBoFCentric(text)) {
                    setDocState({
                        key: fetchKey,
                        status: "fallback",
                        pdfUrl: null,
                        htmlContent: null,
                        resolvedTracking: trichMaVanDonTuHtml(text),
                        errorMessage: null,
                    });
                    return;
                }

                setDocState({
                    key: fetchKey,
                    status: "html",
                    pdfUrl: null,
                    htmlContent: lamSachHtmlDeNhung(text),
                    resolvedTracking: null,
                    errorMessage: null,
                });
            } catch (err) {
                if (huy) return;
                const msgTuBlob = await docLoiTuBlob(err);
                const msg = msgTuBlob || getApiErrorMessage(err, t("Lỗi kết nối"));
                if (huy) return;
                setDocState({
                    key: fetchKey,
                    status: "error",
                    pdfUrl: null,
                    htmlContent: null,
                    resolvedTracking: null,
                    errorMessage: msg,
                });
            }
        };

        taiVanDonNoiBo();
        return () => {
            huy = true;
            giaiPhongPdfUrl();
        };
    }, [fetchKey, shippingDocUrl]);

    if (!model) return null;

    const activeDoc = !shippingDocUrl
        ? {
            status: "idle",
            pdfUrl: null,
            htmlContent: null,
            resolvedTracking: null,
            errorMessage: null,
        }
        : !isInternalApi
            ? {
                status: "pdf",
                pdfUrl: shippingDocUrl,
                htmlContent: null,
                resolvedTracking: null,
                errorMessage: null,
            }
            : docState.key === fetchKey
                ? docState
                : {
                    status: "loading",
                    pdfUrl: null,
                    htmlContent: null,
                    resolvedTracking: null,
                    errorMessage: null,
                };

    const channelInfo = model.channelOrderInfo || {};
    const recipient = model.recipient || {};
    const orderCode = channelInfo.orderCode || "—";
    const rawChannelTracking = channelInfo.trackingBarcode
        || (channelInfo.trackingCode && channelInfo.trackingCode !== "—" ? channelInfo.trackingCode : null);
    const trackingCode = activeDoc.resolvedTracking || rawChannelTracking || orderCode;
    const routingCode = model.routingCode || "—";
    const stationCode = model.stationCode || "";
    const recipientTag = model.recipientTag || "";
    const codLabel = model.codLabel || "ĐÃ THANH TOÁN (COD: 0 đ)";
    const inspectionLabel = model.inspectionLabel || "ĐƯỢC ĐỒNG KIỂM";
    const packageWeight = model.packageWeight || "Tổng KL: 0.3 KG";
    const pickupBy = model.pickupBy || "SPX EXPRESS";
    const deliveryBy = model.deliveryBy || "SPX EXPRESS";
    const serviceType = model.serviceType || "SPX Express";
    const qrValue = activeDoc.resolvedTracking || rawChannelTracking || model.qrCodeValue || trackingCode;
    const items = model.items || [];
    const totalQty = model.totalQuantity || items.reduce((s, it) => s + (it._quantity || 1), 0);
    const orderDateShort = model.orderDateShort || "15 Nov 2026";
    const senderName = company?.tenCongTy || "FCentric";

    const coTepSan = activeDoc.status === "pdf" || activeDoc.status === "html";

    return (
        <div className="sawb-page-container">
            {activeDoc.status === "error" && (
                <div className="sawb-warning-banner no-print">
                    <div className="sawb-warning-desc">
                        {t("Không thể tải vận đơn từ Shopee: {{error}}. Đang hiển thị tem in nhiệt A6 nội bộ FCentric.", {
                            error: activeDoc.errorMessage || t("Lỗi kết nối"),
                        })}
                    </div>
                    <div className="sawb-official-pdf-actions">
                        <button
                            type="button"
                            onClick={() => setReloadSeq((n) => n + 1)}
                            className="sawb-btn sawb-btn-primary"
                        >
                            {t("Thử tải lại")}
                        </button>
                    </div>
                </div>
            )}

            {coTepSan ? (
                <div className="sawb-official-pdf-embed-wrapper">
                    {activeDoc.status === "pdf" ? (
                        <iframe
                            src={activeDoc.pdfUrl}
                            title={t("Vận đơn AWB chính thức Shopee")}
                            className="sawb-pdf-viewer pdoc-pdf-frame"
                        />
                    ) : (
                        <iframe
                            srcDoc={activeDoc.htmlContent}
                            title={t("Vận đơn AWB chính thức Shopee")}
                            className="sawb-pdf-viewer pdoc-pdf-frame"
                        />
                    )}
                </div>
            ) : activeDoc.status === "loading" ? (
                <div className="sawb-loading-box no-print">
                    <div className="sawb-loading-text">{t("Đang tải vận đơn từ Shopee...")}</div>
                </div>
            ) : (
                <div className="sawb-wrapper">
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
                </div>
            )}
        </div>
    );
}
