import { QRCodeSVG } from "qrcode.react";
import { barsFromBits, encodeCode128, toBarcodeText, toQrText } from "@/components/print/maVach";

/** Vùng trắng hai bên mã vạch (mô-đun) — máy quét cần lề trắng ≥ 10 mô-đun để nhận biết mã. */
const QUIET_ZONE = 10;
/** Vùng trắng quanh mã QR (mô-đun) — chuẩn QR yêu cầu 4 mô-đun. */
const QR_QUIET_ZONE = 4;
/**
 * Mô-đun mã vạch nhỏ nhất (mm) khi phải thu nhỏ cho vừa bề ngang — khổ tờ in máy in laser / phun
 * (≥ 300 dpi) nên thu tới 0,19 mm vẫn quét chắc; nhỏ hơn thì in mã QR thay. Khổ nhiệt có mức riêng
 * (`minModuleMm`).
 */
const MIN_MODULE_MM = 0.19;

/**
 * Kích thước theo khổ giấy (mm). Mô-đun mã vạch khổ nhiệt = đúng 2 chấm máy in 203 dpi (0,25 mm) và
 * KHÔNG thu nhỏ: 1,5–1,9 chấm làm vạch rộng hẹp lệch nhau, máy quét đọc không chắc — số dài quá
 * bề ngang thì in mã QR. Bề ngang tối đa vừa khoảng trống góc phải đầu phiếu (A4/A5) hoặc vùng in
 * khổ nhiệt. QR gồm cả vùng trắng 4 mô-đun.
 */
const SIZES = {
    A4: { moduleMm: 0.3, maxWidthMm: 70, heightMm: 10, qrMm: 20 },
    A5: { moduleMm: 0.26, maxWidthMm: 45, heightMm: 8, qrMm: 17 },
    K80: { moduleMm: 0.25, minModuleMm: 0.25, maxWidthMm: 70, heightMm: 9, qrMm: 24 },
    K57: { moduleMm: 0.25, minModuleMm: 0.25, maxWidthMm: 48, heightMm: 8, qrMm: 20 },
};

const round = (value) => Math.round(value * 100) / 100;

function QrCode({ text, size }) {
    return (
        <div className="pdoc-docode pdoc-docode--qr" aria-hidden="true">
            <QRCodeSVG
                value={text}
                level="M"
                marginSize={QR_QUIET_ZONE}
                size={128}
                className="pdoc-docode-svg"
                style={{ width: `${size.qrMm}mm`, height: `${size.qrMm}mm` }}
            />
        </div>
    );
}

/**
 * Mã của số phiếu: mã vạch Code 128 hoặc mã QR, đều chứa đúng số phiếu (không chứa đường dẫn hay
 * dữ liệu khác). Vẽ bằng SVG thuần nên in sắc nét ở mọi máy in, cùng một DOM cho xem trước và in.
 * Không có số phiếu (phiếu chưa đánh số) thì không vẽ gì. Số phiếu quá dài để in mã vạch còn quét
 * được trong bề ngang của khổ thì tự in mã QR.
 */
export default function PrintDocCode({ mode, value, paperSize }) {
    const size = SIZES[paperSize] ?? SIZES.A4;
    if (mode === "ma_qr") {
        const text = toQrText(value);
        return text ? <QrCode text={text} size={size} /> : null;
    }
    if (mode !== "ma_vach") return null;

    const bits = encodeCode128(value);
    if (!bits) return null;
    const modules = bits.length + QUIET_ZONE * 2;
    const moduleMm = Math.min(size.moduleMm, size.maxWidthMm / modules);
    // So sánh có dung sai làm tròn (0,25 mm chia đúng vẫn là 0,25 mm)
    if (moduleMm + 1e-9 < (size.minModuleMm ?? MIN_MODULE_MM)) {
        // Cùng chuỗi với mã vạch (đã bỏ dấu) để hai kiểu mã quét ra giống nhau
        return <QrCode text={toBarcodeText(value)} size={size} />;
    }
    return (
        <div className="pdoc-docode pdoc-docode--barcode" aria-hidden="true">
            <svg
                className="pdoc-docode-svg"
                viewBox={`0 0 ${modules} ${size.heightMm}`}
                preserveAspectRatio="none"
                shapeRendering="crispEdges"
                style={{ width: `${round(modules * moduleMm)}mm`, height: `${size.heightMm}mm` }}
            >
                <rect x="0" y="0" width={modules} height={size.heightMm} fill="#ffffff" />
                {barsFromBits(bits).map((bar) => (
                    <rect key={bar.x} x={bar.x + QUIET_ZONE} y="0" width={bar.width} height={size.heightMm} fill="#000000" />
                ))}
            </svg>
        </div>
    );
}
