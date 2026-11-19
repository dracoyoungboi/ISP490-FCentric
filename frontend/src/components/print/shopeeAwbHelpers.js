/**
 * Các hàm thuần xử lý dữ liệu tem vận đơn Shopee A6 (tách riêng để kiểm thử độc lập với Node test runner).
 */

export async function docLoiTuBlob(err) {
    const raw = err?.response?.data;
    if (raw instanceof Blob) {
        try {
            const text = await raw.text();
            const parsed = JSON.parse(text);
            if (parsed?.message) return parsed.message;
            if (parsed?.error) return parsed.error;
        } catch {
            return null;
        }
    }
    return null;
}

export async function laPdfBlob(blob) {
    if (!blob) return false;
    if (String(blob.type || "").toLowerCase().includes("pdf")) return true;
    try {
        const header = await blob.slice(0, 4).text();
        return header === "%PDF";
    } catch {
        return false;
    }
}

export function laHtmlNoiBoFCentric(html) {
    if (!html) return false;
    return html.includes("Shopee Express · Tem in nhiệt chuẩn A6");
}

export function trichMaVanDonTuHtml(html) {
    if (!html) return null;
    const match = html.match(/<div[^>]*class="barcode-text"[^>]*>([^<]+)<\/div>/i);
    const ma = match?.[1]?.trim();
    return ma && ma !== "—" ? ma : null;
}

export function lamSachHtmlDeNhung(html) {
    if (!html) return "";
    // Tránh script fallback tự bật hộp thoại in trước khi người dùng bấm nút In phiếu
    return html.replace(/<script\b[^>]*>[\s\S]*?window\.print\s*\([\s\S]*?<\/script>/gi, "");
}

export function trichTheGhiChu(ghiChu, tenThe) {
    if (!ghiChu || !tenThe) return null;
    const escaped = tenThe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = String(ghiChu).match(new RegExp(`\\[${escaped}:\\s*([^\\]]+)\\]`, "i"));
    return match?.[1]?.trim() || null;
}

export function chuanHoaDonViVanChuyen(carrierName) {
    if (!carrierName) return null;
    const upper = String(carrierName).toUpperCase();
    if (upper.includes("BEST")) return "BEST EXPRESS";
    if (upper.includes("LEX") || upper.includes("LAZADA")) return "LEX VN";
    if (upper.includes("NINJA")) return "NINJA VAN";
    if (upper.includes("J&T")) return "J&T EXPRESS";
    if (upper.includes("SHOPEE") || upper.includes("SPX")) return "SPX EXPRESS";
    return carrierName;
}
