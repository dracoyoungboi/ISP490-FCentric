/**
 * Tem sản phẩm (hộp "In tem sản phẩm"): hàm thuần, không gọi API, dùng chung cho hộp in, tờ in và kiểm thử.
 *
 * Mã vạch CODE128 của ma_vach_sku, mô-đun hẹp nhất 0,25 mm, vùng trắng ≥ 10 mô-đun mỗi bên (ISO/IEC 15417),
 * nên độ rộng thật của vạch cố định theo mm — không co giãn theo khung như bản in cũ.
 */
import { encodeCode128, barsFromBits } from "./maVach.js";

/** Mô-đun (vạch hẹp nhất) tính bằng mm. */
export const MO_DUN_MM = 0.25;
/** Vùng trắng mỗi bên vạch, tính bằng số mô-đun. */
export const VUNG_TRANG_MO_DUN = 10;
/** Số tem tối đa của một dòng. */
export const SO_TEM_TOI_DA = 9999;

export const LY_DO_BO_QUA = Object.freeze({
    ngung: "Ngừng hoạt động",
    chuaGia: "Chưa có giá bán",
    thieuMa: "Thiếu mã vạch",
    kyTu: "Mã vạch có ký tự không in được",
    dai: "Mã vạch quá dài cho khổ tem",
});

/** Cách tính số tem mặc định của từng dòng theo nơi mở hộp in. */
export const CHE_DO_SO_TEM = Object.freeze({ nhap: "nhap", ton: "ton", mot: "mot" });

/** Cách tính mặc định: mở từ phiếu nhập → theo số lượng nhập; sau khi đổi giá → theo tồn; còn lại → 1 tem. */
export function cheDoMacDinh(nguon) {
    if (nguon === "phieu") return CHE_DO_SO_TEM.nhap;
    if (nguon === "doi-gia") return CHE_DO_SO_TEM.ton;
    return CHE_DO_SO_TEM.mot;
}

const soNguyen = (giaTri) => {
    const so = Math.floor(Number(giaTri));
    return Number.isFinite(so) ? so : 0;
};

/** Số tem trong khoảng 0–9999. */
export function gioiHanSoTem(giaTri) {
    return Math.min(SO_TEM_TOI_DA, Math.max(0, soNguyen(giaTri)));
}

/**
 * Mã vạch của tem: dãy mô-đun và kích thước theo mm. null khi mã trống hoặc có ký tự ngoài ASCII in được
 * (CODE128 chỉ mã hóa ASCII; bỏ dấu để in sẽ làm máy quét đọc ra mã khác mã đã lưu).
 */
export function maVachTem(ma) {
    const chuoi = typeof ma === "string" ? ma : ma == null ? "" : String(ma);
    if (!chuoi.trim() || !/^[\x20-\x7E]+$/.test(chuoi) || chuoi !== chuoi.trim()) return null;
    const bits = encodeCode128(chuoi);
    if (!bits) return null;
    const soMoDun = bits.length;
    return {
        bits,
        vach: barsFromBits(bits),
        soMoDun,
        rongVachMm: soMoDun * MO_DUN_MM,
        rongMm: (soMoDun + 2 * VUNG_TRANG_MO_DUN) * MO_DUN_MM,
    };
}

/** Bề rộng tối đa dành cho vạch kèm vùng trắng trên một tem (mm). */
export function rongVachToiDaMm(kho) {
    return kho.rongTem - 2 * kho.leAnToan;
}

/**
 * Lý do một SKU không in được tem trên khổ `kho` (chỉ bỏ dòng đó, không chặn cả lần in); null nếu in được.
 * Thứ tự: ngừng hoạt động → chưa có giá → thiếu mã vạch → mã có ký tự lạ → mã quá dài.
 */
export function lyDoBoQua(dong, kho) {
    if (Number(dong?.trangThai) !== 1) return LY_DO_BO_QUA.ngung;
    if (!(Number(dong?.giaBan) > 0)) return LY_DO_BO_QUA.chuaGia;
    const ma = dong?.maVachSku;
    if (ma == null || !String(ma).trim()) return LY_DO_BO_QUA.thieuMa;
    const vach = maVachTem(ma);
    if (!vach) return LY_DO_BO_QUA.kyTu;
    if (vach.rongMm > rongVachToiDaMm(kho)) return LY_DO_BO_QUA.dai;
    return null;
}

/**
 * Tỉ lệ vẽ tem xem trước trên màn hình (px mỗi mm): phóng một tem cho vừa bề rộng `rongPx`, tối đa 8 px/mm. 4 px/mm
 * gần bằng cỡ thật trên màn hình (1 mm ≈ 3,8 px) nên chữ trên tem chỉ còn 6–9 px, không đọc được.
 */
export function pxMoiMmXemTruoc(kho, rongPx = 280) {
    return Math.min(8, Math.floor((rongPx / kho.rongTem) * 10) / 10);
}

/** Số tem mặc định của một dòng: theo số lượng nhập của phiếu, theo tồn hoặc 1 tem. */
export function soTemMacDinh(dong, cheDo) {
    if (cheDo === CHE_DO_SO_TEM.nhap) return gioiHanSoTem(dong?.soLuong);
    if (cheDo === CHE_DO_SO_TEM.ton) return gioiHanSoTem(dong?.tonKho);
    return 1;
}

/** Số tem đang đặt của một dòng: người dùng đã sửa (`soTemDaSua[id]`) thì lấy số đó, không thì số mặc định. */
export function soTemCuaDong(dong, cheDo, soTemDaSua = {}) {
    const daSua = soTemDaSua[dong.id];
    return daSua !== undefined ? gioiHanSoTem(daSua) : soTemMacDinh(dong, cheDo);
}

/**
 * Dựng lần in: dòng in được / bỏ qua, dãy tem theo thứ tự dòng, chia thành các hàng `soCot` tem (mỗi hàng một trang).
 * Trả { hopLe: [{ dong, soTem }], boQua: [{ dong, lyDo }], tem: [dong…], hang: [[dong…]…], tong, soSku }.
 */
export function dungLanIn({ dong = [], cheDo, soTemDaSua = {}, kho }) {
    const hopLe = [];
    const boQua = [];
    for (const d of dong) {
        const lyDo = lyDoBoQua(d, kho);
        if (lyDo) boQua.push({ dong: d, lyDo });
        else hopLe.push({ dong: d, soTem: soTemCuaDong(d, cheDo, soTemDaSua) });
    }
    const tem = [];
    for (const { dong: d, soTem } of hopLe) {
        for (let i = 0; i < soTem; i += 1) tem.push(d);
    }
    const hang = [];
    for (let i = 0; i < tem.length; i += kho.soCot) hang.push(tem.slice(i, i + kho.soCot));
    return {
        hopLe,
        boQua,
        tem,
        hang,
        tong: tem.length,
        soSku: hopLe.filter((x) => x.soTem > 0).length,
    };
}

/** Dòng phụ dưới tên: "Màu - Kích cỡ" (thiếu phần nào thì bỏ phần đó). */
export function nhanBienThe(dong) {
    return [dong?.tenMau, dong?.kichCo].filter((x) => x != null && String(x).trim()).join(" - ");
}

/** Giá in trên tem: "2.000.000 ₫". */
export function giaTrenTem(gia) {
    return `${Math.round(Number(gia) || 0).toLocaleString("vi-VN")} ₫`;
}

/**
 * Dòng in tem từ máy chủ (DongInTemDto: bienTheId, tenSanPham, maSku, maVachSku, tenMau, kichCo, trangThai, giaBan,
 * tonKho, soLuong) về cùng dạng với dòng của màn Giá bán (id thay cho bienTheId).
 */
export function chuanHoaDongInTem(x) {
    return {
        id: x.bienTheId ?? x.id,
        sanPhamId: x.sanPhamId ?? null,
        tenSanPham: x.tenSanPham ?? "",
        maSku: x.maSku ?? "",
        maVachSku: x.maVachSku ?? "",
        tenMau: x.tenMau ?? null,
        maMauHex: x.maMauHex ?? null,
        kichCo: x.kichCo ?? null,
        trangThai: x.trangThai,
        giaBan: x.giaBan ?? null,
        tonKho: Number(x.tonKho) || 0,
        soLuong: x.soLuong ?? null,
    };
}

/** Gộp dòng trùng SKU (giữ dòng đầu), bỏ dòng không có id. */
export function boDongTrung(dsDong) {
    const daGap = new Set();
    return (dsDong ?? []).filter((d) => {
        if (d?.id == null || daGap.has(d.id)) return false;
        daGap.add(d.id);
        return true;
    });
}

/** Tìm dòng theo mã quét (mã vạch hoặc SKU, không phân biệt hoa thường, bỏ khoảng trắng hai đầu). */
export function timDongTheoMa(dsDong, ma) {
    const can = String(ma ?? "").trim().toLowerCase();
    if (!can) return null;
    return (dsDong ?? []).find((d) => String(d.maVachSku ?? "").trim().toLowerCase() === can)
        ?? (dsDong ?? []).find((d) => String(d.maSku ?? "").trim().toLowerCase() === can)
        ?? null;
}
