import { MO_DUN_MM, VUNG_TRANG_MO_DUN, giaTrenTem, maVachTem, nhanBienThe } from "./tinhTem.js";

/**
 * Một tem sản phẩm: tên (1 dòng, cắt …), "Màu - Kích cỡ", mã vạch CODE128 của ma_vach_sku, dãy số dưới vạch, giá đậm.
 * Tên cửa hàng và SKU chỉ hiện khi cấu hình bật. Không viền.
 *
 * Mọi kích thước tính bằng mm theo khổ `kho` (components/print/paperStyles.js · KHO_TEM), không max-width hay scale:
 * vạch luôn đúng mô-đun 0,25 mm. `pxMoiMm` (xem trước): vẽ cùng bố cục nhưng đổi mm sang px theo tỉ lệ đó.
 */
export default function TemSanPham({ dong, kho, inTenCuaHang = false, tenCuaHang, inSku = false, pxMoiMm }) {
    const d = (mm) => (pxMoiMm ? `${mm * pxMoiMm}px` : `${mm}mm`);
    const vach = maVachTem(dong?.maVachSku);
    const coTenCuaHang = inTenCuaHang && Boolean(tenCuaHang);
    const coSku = inSku && Boolean(dong?.maSku);
    const { coChu, dongCao } = kho;
    // Dãy số dưới vạch: mã dài hơn mã tự sinh (10 số) thì bỏ giãn chữ và thu cỡ chữ theo độ dài (tối thiểu 80%), để
    // không bị cắt mất chữ số khi đứng cạnh giá lớn
    const soKyTu = String(dong?.maVachSku ?? "").length;
    const coSo = soKyTu > 10 ? Math.max(coChu.so * 0.8, (coChu.so * 11) / soKyTu) : coChu.so;
    const gianSo = soKyTu > 10 ? 0 : MO_DUN_MM * 0.6;
    const motDong = (co, cao, them = {}) => ({
        fontSize: d(co),
        lineHeight: d(cao),
        height: d(cao),
        whiteSpace: "nowrap",
        // Chỉ cắt theo chiều ngang (dấu …); chiều dọc để lộ dấu chồng trên chữ hoa (Ấ, Ổ, Ế) cao hơn dòng
        overflowX: "clip",
        overflowY: "visible",
        textOverflow: "ellipsis",
        ...them,
    });

    return (
        <div
            style={{
                width: d(kho.rongTem),
                height: d(kho.caoTem),
                padding: `${d(kho.leDoc)} ${d(kho.leNgang)}`,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                background: "#fff",
                color: "#000",
                fontFamily: "Inter, Arial, sans-serif",
                flex: "none",
            }}
        >
            <div style={{ minWidth: 0 }}>
                {coTenCuaHang ? <div style={motDong(coChu.cuaHang, dongCao.cuaHang, { fontWeight: 600 })}>{tenCuaHang}</div> : null}
                {/* Có dòng tên cửa hàng: chừa khoảng cho dấu chồng chữ hoa của tên (Ấ, Ế, Ổ) khỏi chạm dòng trên */}
                <div style={motDong(coChu.ten, dongCao.ten, { fontWeight: 700, ...(coTenCuaHang ? { marginTop: d(0.4) } : {}) })}>
                    {dong?.tenSanPham}
                </div>
                <div style={motDong(coChu.bienThe, dongCao.bienThe)}>{nhanBienThe(dong)}</div>
            </div>
            {vach ? (
                <svg
                    role="img"
                    aria-label={`Mã vạch ${dong.maVachSku}`}
                    width={d(vach.rongMm)}
                    height={d(kho.caoVach)}
                    viewBox={`0 0 ${vach.soMoDun + 2 * VUNG_TRANG_MO_DUN} 1`}
                    preserveAspectRatio="none"
                    shapeRendering="crispEdges"
                    style={{ display: "block", alignSelf: "center", flex: "none" }}
                >
                    {vach.vach.map((b) => (
                        <rect key={b.x} x={b.x + VUNG_TRANG_MO_DUN} y="0" width={b.width} height="1" fill="#000" />
                    ))}
                </svg>
            ) : null}
            <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: d(1), height: d(dongCao.gia) }}>
                    <span
                        style={{
                            fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace",
                            fontSize: d(coSo),
                            letterSpacing: d(gianSo),
                            whiteSpace: "nowrap",
                            // Mã dài + giá lớn: dãy số nhường chỗ (cắt bớt) để giá không tràn mép tem
                            minWidth: 0,
                            overflowX: "clip",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {dong?.maVachSku}
                    </span>
                    <span style={{ fontSize: d(coChu.gia), lineHeight: d(dongCao.gia), fontWeight: 700, whiteSpace: "nowrap", flex: "none" }}>
                        {giaTrenTem(dong?.giaBan)}
                    </span>
                </div>
                {coSku ? <div style={motDong(coChu.sku, dongCao.sku)}>{dong.maSku}</div> : null}
            </div>
        </div>
    );
}
