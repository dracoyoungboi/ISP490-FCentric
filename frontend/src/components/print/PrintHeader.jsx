/**
 * Đầu phiếu in: khối thương hiệu (logo / tên công ty / email / điện thoại /
 * địa chỉ) bên trái, tiêu đề phiếu ở giữa.
 *
 * Dữ liệu công ty đến từ hồ sơ công ty dùng chung (companyProfileService);
 * `branding` chỉ quyết định HIỂN THỊ từng trường hay không.
 * Dùng <div> thay vì <header> để không vướng quy tắc ẩn của print.css.
 * `compact` = layout khổ nhiệt K80 (xếp dọc, căn giữa).
 * `dense` = khổ A5: logo/chữ nhỏ hơn A4 để dành chỗ cho nội dung phiếu.
 */
export default function PrintHeader({
    title,
    branding,
    company,
    accentColor = "#0F2A43",
    compact = false,
    dense = false,
}) {
    const b = branding ?? {};
    const c = company ?? {};

    const logoNode = b.showLogo ? (
        <img
            src={c.logoAsset ?? "/branding/f-centric-icon.svg"}
            alt=""
            className={
                compact
                    ? "mx-auto h-10 w-auto object-contain"
                    : dense
                      ? "h-8 w-auto object-contain object-left"
                      : "h-10 w-auto object-contain object-left"
            }
            draggable={false}
        />
    ) : null;

    const nameClass = dense
        ? "text-sm font-bold leading-snug text-bo-foreground"
        : "text-base font-bold leading-snug text-bo-foreground";
    const lineClass = dense
        ? "break-words text-[10px] leading-4 text-bo-muted"
        : "mt-0.5 break-words text-xs leading-5 text-bo-muted";

    const companyLines = [
        b.showCompanyName && c.name ? (
            <p key="name" className={nameClass}>{c.name}</p>
        ) : null,
        b.showEmail && c.email ? (
            <p key="email" className={lineClass}>{c.email}</p>
        ) : null,
        b.showPhone && c.phone ? (
            <p key="phone" className={lineClass}>{c.phone}</p>
        ) : null,
        b.showAddress && c.address ? (
            <p key="address" className={lineClass}>{c.address}</p>
        ) : null,
    ].filter(Boolean);

    if (dense) {
        // A5: logo đứng cạnh thông tin công ty, tiêu đề bên phải — thấp hơn
        // bố cục A4 (logo trên, chữ dưới) khoảng 1cm cho phần nội dung phiếu
        return (
            <div className="border-b-2 pb-3" style={{ borderColor: accentColor }}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        {logoNode}
                        {companyLines.length > 0 ? <div className="min-w-0">{companyLines}</div> : null}
                    </div>
                    <h1 className="max-w-[55%] self-center text-right text-base font-bold uppercase leading-snug tracking-wide text-bo-foreground">
                        {title}
                    </h1>
                </div>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="border-b-2 border-dashed pb-2" style={{ borderColor: accentColor }}>
                <div className="text-center">
                    {logoNode}
                    <div className="mt-1">{companyLines}</div>
                    <h1 className="mt-2 text-[13px] font-bold uppercase leading-snug tracking-wide text-bo-foreground">
                        {title}
                    </h1>
                </div>
            </div>
        );
    }

    return (
        <div className="border-b-2 pb-4" style={{ borderColor: accentColor }}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6">
                <div className="min-w-0">
                    {logoNode}
                    {companyLines.length > 0 ? <div className={b.showLogo ? "mt-1" : ""}>{companyLines}</div> : null}
                </div>
                <h1 className="min-w-0 max-w-md self-center text-center text-lg font-bold uppercase leading-snug tracking-wide text-bo-foreground">
                    {title}
                </h1>
                <div />
            </div>
        </div>
    );
}
