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
export const CHE_DO_SO_TEM = Object.freeze({ nhap: "nhap", mot: "mot" });

/** Cách tính mặc định: mở từ phiếu nhập → theo số lượng nhập; còn lại → 1 tem. */
export function cheDoMacDinh(nguon) {
    if (nguon === "phieu") return CHE_DO_SO_TEM.nhap;
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

/** Tên / biến thể dài được co chữ tới tỉ lệ này của cỡ gốc trước khi xuống dòng hoặc cắt "…". */
export const CO_CHU_TOI_THIEU = 0.85;
/** Tên xuống 2 dòng chỉ khi vạch còn cao ít nhất chừng này (mm); thấp hơn thì súng quét cầm tay khó đọc. */
export const CAO_VACH_TOI_THIEU_MM = 7;

/** Cắt chuỗi cho vừa `rong` mm, thêm "…"; `doRong(chu)` trả bề rộng mm ở cỡ đang xét. */
function catVua(chu, rong, doRong) {
    if (doRong(chu) <= rong) return { chu, cat: false };
    let thap = 0;
    let cao = chu.length;
    while (thap < cao) {
        const giua = Math.ceil((thap + cao) / 2);
        if (doRong(`${chu.slice(0, giua).trimEnd()}…`) <= rong) thap = giua;
        else cao = giua - 1;
    }
    return { chu: `${chu.slice(0, thap).trimEnd()}…`, cat: true };
}

/** Chia `chu` thành tối đa 2 dòng theo từ; dòng 2 còn dài thì cắt "…". Từ đầu đã dài hơn một dòng thì null. */
function chiaHaiDong(chu, rong, doRong) {
    const tu = chu.split(/\s+/).filter(Boolean);
    let dong1 = "";
    let i = 0;
    while (i < tu.length) {
        const thu = dong1 ? `${dong1} ${tu[i]}` : tu[i];
        if (doRong(thu) > rong) break;
        dong1 = thu;
        i += 1;
    }
    if (!dong1) return null;
    const dong2 = catVua(tu.slice(i).join(" "), rong, doRong);
    return { dong: [dong1, dong2.chu], cat: dong2.cat };
}

/**
 * Bố cục chữ trên một tem khi tên / "Màu - Kích cỡ" dài hơn bề ngang tem (trừ lề):
 * 1. Tên vừa một dòng: giữ nguyên.
 * 2. Co chữ (không nhỏ hơn CO_CHU_TOI_THIEU cỡ gốc) mà vừa một dòng: co.
 * 3. Không thì xuống 2 dòng cỡ gốc nếu vạch vẫn cao ≥ CAO_VACH_TOI_THIEU_MM (vạch thấp lại vừa đủ chỗ dòng thêm).
 * 4. Không đủ chỗ: một dòng cỡ nhỏ nhất, cắt "…" (`catTen` = true để màn hình báo).
 * "Màu - Kích cỡ" chỉ co rồi cắt, không xuống dòng.
 * `doRong(chu, coMm, dam)` trả bề rộng chữ (mm) ở cỡ `coMm`; `coTenCuaHang`, `coSku`: tem có dòng đó.
 * Trả { ten: [dòng…], coTen, bienThe, coBienThe, caoVach, catTen, catBienThe } (cỡ, cao theo mm).
 */
export function boCucChuTem(dong, kho, { coTenCuaHang = false, coSku = false } = {}, doRong) {
    const rong = kho.rongTem - 2 * kho.leNgang;
    const { coChu, dongCao } = kho;
    const doCo = (co, dam) => (chu) => doRong(chu, co, dam);

    const bienThe = nhanBienThe(dong);
    const rongBienThe = bienThe ? doRong(bienThe, 1, false) : 0;
    const coBienThe = rongBienThe * coChu.bienThe > rong
        ? Math.max(coChu.bienThe * CO_CHU_TOI_THIEU, rong / rongBienThe)
        : coChu.bienThe;
    const btCat = catVua(bienThe, rong, doCo(coBienThe, false));
    const kq = {
        ten: [String(dong?.tenSanPham ?? "")],
        coTen: coChu.ten,
        bienThe: btCat.chu,
        coBienThe,
        caoVach: kho.caoVach,
        catTen: false,
        catBienThe: btCat.cat,
    };

    const ten = kq.ten[0];
    const rongTen = ten ? doRong(ten, 1, true) : 0;
    if (rongTen * coChu.ten <= rong) return kq;
    const coCan = rong / rongTen;
    if (coCan >= coChu.ten * CO_CHU_TOI_THIEU) return { ...kq, coTen: coCan };

    const caoNoiDung = kho.caoTem - 2 * kho.leDoc;
    const dongKhac = (coTenCuaHang ? dongCao.cuaHang + 0.4 : 0) + dongCao.bienThe + dongCao.gia + (coSku ? dongCao.sku : 0);
    const vachHaiDong = Math.min(kho.caoVach, Math.floor((caoNoiDung - dongKhac - 2 * dongCao.ten) * 10) / 10);
    if (vachHaiDong >= CAO_VACH_TOI_THIEU_MM) {
        const hai = chiaHaiDong(ten, rong, doCo(coChu.ten, true));
        if (hai) return { ...kq, ten: hai.dong, caoVach: vachHaiDong, catTen: hai.cat };
    }
    const coNho = coChu.ten * CO_CHU_TOI_THIEU;
    const mot = catVua(ten, rong, doCo(coNho, true));
    return { ...kq, ten: [mot.chu], coTen: coNho, catTen: mot.cat };
}

/** Số tem mặc định của một dòng: theo số lượng nhập của phiếu hoặc 1 tem (BA bỏ in theo tồn). */
export function soTemMacDinh(dong, cheDo) {
    if (cheDo === CHE_DO_SO_TEM.nhap) return gioiHanSoTem(dong?.soLuong);
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
 * soLuong) về cùng dạng với dòng của màn Tem mã vạch (id thay cho bienTheId).
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
        // Giá trước lần đổi giá gần nhất trong 7 ngày (để biết tem nào đang dán giá cũ); null nếu không đổi gần đây
        giaBanCu: x.giaBanCu ?? null,
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
