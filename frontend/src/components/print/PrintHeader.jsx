import { joinParts } from "@/components/print/adapters/printFormat";

const DEFAULT_LOGO = "/branding/f-centric-icon.svg";

/**
 * Đầu phiếu in theo kiểu chứng từ Việt Nam:
 * - hàng trên: logo + tên cửa hàng, "MST: …", địa chỉ, "ĐT … · Email …" (hồ sơ cửa hàng
 *   dùng chung — companyProfileService; `branding` chỉ quyết định in trường nào) và, nếu mẫu bật,
 *   mã của số phiếu (`code`) ở góc phải;
 * - giữa: TÊN CHỨNG TỪ, ngay dưới là "Số: …" và "Ngày … tháng … năm …".
 * Số phiếu và ngày lập chỉ in ở đây (các khối bên dưới không lặp lại).
 * Chưa có ngày lập (phiếu chưa xuất/nhập) -> để chỗ trống ghi tay.
 *
 * `blockProps`: thuộc tính khối bấm được của trình sửa mẫu (rỗng khi in thật).
 * Dùng <div> thay vì <header> để không vướng quy tắc ẩn của print.css.
 */
export default function PrintHeader({ title, number, date, branding, company, code = null, blockProps }) {
    const b = branding ?? {};
    const c = company ?? {};

    const contactLine = joinParts([
        b.showPhone && c.phone ? `ĐT: ${c.phone}` : null,
        b.showEmail && c.email ? `Email: ${c.email}` : null,
    ]);
    // Mẫu lưu trước khi có tùy chọn MST: chưa có cờ thì vẫn in (cửa hàng đã nhập MST)
    const taxCode = b.showTaxCode !== false && c.taxCode ? c.taxCode : null;
    const hasCompany = (b.showCompanyName && c.name) || taxCode || (b.showAddress && c.address) || contactLine;

    return (
        <div {...blockProps}>
            {b.showLogo || hasCompany || code ? (
                <div className="pdoc-head">
                    {b.showLogo ? (
                        <img className="pdoc-logo" src={c.logoAsset || DEFAULT_LOGO} alt="" draggable={false} />
                    ) : null}
                    {hasCompany ? (
                        <div className="pdoc-company">
                            {b.showCompanyName && c.name ? <p className="pdoc-company-name">{c.name}</p> : null}
                            {taxCode ? <p className="pdoc-company-line">MST: {taxCode}</p> : null}
                            {b.showAddress && c.address ? <p className="pdoc-company-line">{c.address}</p> : null}
                            {contactLine ? <p className="pdoc-company-line">{contactLine}</p> : null}
                        </div>
                    ) : null}
                    {code}
                </div>
            ) : null}

            <div className="pdoc-titleblock">
                <h1 className="pdoc-title">{title}</h1>
                <p className="pdoc-meta">
                    <span>
                        Số: <strong>{number || "—"}</strong>
                    </span>
                    <span className="pdoc-meta-sep" aria-hidden="true">
                        |
                    </span>
                    <span>{date || "Ngày ..... tháng ..... năm ........"}</span>
                </p>
            </div>
        </div>
    );
}
