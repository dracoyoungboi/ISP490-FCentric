import { forwardRef } from "react";
import TemSanPham from "./TemSanPham.jsx";
import { getLabelPageCss, leCuonTem } from "./paperStyles.js";

/**
 * Tờ in tem: mỗi hàng tem là một trang (trang rộng bằng cuộn giấy, cao bằng tem — getLabelPageCss), hàng cuối không
 * ngắt trang để khỏi đẩy ra tem trắng. Hàng thấp hơn tem 0,2 mm để trình duyệt làm tròn số không tràn sang trang sau.
 * Chỉ dùng làm nội dung in (react-to-print); trên màn hình bọc trong khối ẩn. Thẻ <style> khổ trang đi kèm tờ in để
 * nằm sau print.css trong khung in (xem getLabelPageCss).
 */
const ToTem = forwardRef(function ToTem({ hang, kho, inTenCuaHang, tenCuaHang, inSku }, ref) {
    const le = leCuonTem(kho);
    return (
        <div ref={ref} style={{ background: "#fff", margin: 0, padding: 0 }}>
            <style>{getLabelPageCss(kho)}</style>
            {hang.map((row, i) => (
                <div
                    // Hàng tem không có khóa riêng; thứ tự cố định trong một lần in
                    key={i}
                    style={{
                        width: `${kho.rongCuon}mm`,
                        height: `${kho.caoTem - 0.2}mm`,
                        padding: `0 ${le}mm`,
                        boxSizing: "border-box",
                        display: "flex",
                        gap: `${kho.khe}mm`,
                        overflow: "hidden",
                        breakInside: "avoid",
                        pageBreakInside: "avoid",
                        ...(i < hang.length - 1 ? { breakAfter: "page", pageBreakAfter: "always" } : {}),
                    }}
                >
                    {row.map((dong, j) => (
                        <TemSanPham
                            // Một SKU có thể lặp nhiều tem trên cùng hàng
                            key={`${dong.id}-${j}`}
                            dong={dong}
                            kho={kho}
                            inTenCuaHang={inTenCuaHang}
                            tenCuaHang={tenCuaHang}
                            inSku={inSku}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
});

export default ToTem;
