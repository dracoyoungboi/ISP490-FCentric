/*
 * Ảnh chụp đính kèm biên bản giao nhận (mockup B.4, ô "Ảnh chụp" không bắt buộc): giới hạn số ảnh, thu nhỏ ảnh ở trình
 * duyệt trước khi tải lên, tải lần lượt. nginx của giao diện nhận tối đa 1 MB mỗi yêu cầu nên ảnh điện thoại (3–8 MB)
 * được vẽ lại với cạnh dài 1600 px, JPEG chất lượng 0,85; vẫn lớn hơn ~950 KB thì giảm chất lượng dần. Vẽ lại cũng bỏ
 * thông tin EXIF (vị trí GPS) của ảnh. Phần tính kích thước, lọc tệp, tải lần lượt là hàm thuần chạy `node --test`
 * (anhBienBan.test.js); thuNhoAnh dùng canvas nên chỉ chạy trên trình duyệt.
 */

/** Tối đa ảnh mỗi biên bản (máy chủ kiểm: AnhBienBanGiaoNhanService.SO_ANH_TOI_DA). */
export const SO_ANH_TOI_DA = 6;
export const CANH_DAI_TOI_DA = 1600;
/** Cạnh dài khi giảm chất lượng vẫn chưa đủ nhỏ. */
export const CANH_DAI_DU_PHONG = 1280;
export const CHAT_LUONG_DAU = 0.85;
/** Ngưỡng sau khi thu nhỏ: chừa chỗ cho phần đầu multipart và mô tả dưới giới hạn 1 MB của nginx. */
export const DUNG_LUONG_DICH = 950 * 1024;
export const MO_TA_TOI_DA = 255;

/** Cỡ ảnh sau khi thu nhỏ: cạnh dài không quá `canhDai`, giữ tỉ lệ, không phóng to ảnh nhỏ; số nguyên ≥ 1. */
export function kichThuocThuNho(rong, cao, canhDai = CANH_DAI_TOI_DA) {
    const r = Number(rong);
    const c = Number(cao);
    if (!(r > 0) || !(c > 0)) return { rong: 0, cao: 0 };
    const tiLe = Math.min(1, canhDai / Math.max(r, c));
    return { rong: Math.max(1, Math.round(r * tiLe)), cao: Math.max(1, Math.round(c * tiLe)) };
}

/**
 * Các lần vẽ thử theo thứ tự, dừng ở lần đầu tiên ra tệp ≤ DUNG_LUONG_DICH: cạnh dài 1600 px chất lượng 0,85 → 0,75 →
 * 0,65 → 0,55; vẫn lớn thì cạnh dài 1280 px chất lượng 0,6 → 0,45.
 */
export function cacLanThu(rong, cao) {
    const lon = kichThuocThuNho(rong, cao, CANH_DAI_TOI_DA);
    const nho = kichThuocThuNho(rong, cao, CANH_DAI_DU_PHONG);
    return [
        ...[CHAT_LUONG_DAU, 0.75, 0.65, 0.55].map((chatLuong) => ({ ...lon, chatLuong })),
        ...[0.6, 0.45].map((chatLuong) => ({ ...nho, chatLuong })),
    ];
}

/** Tên tệp gửi máy chủ: giữ tên gốc, đổi đuôi sang .jpg (ảnh đã vẽ lại thành JPEG). */
export function tenTepJpeg(ten) {
    const goc = String(ten ?? "").trim().replace(/\.[^./\\]*$/, "");
    return `${goc || "anh"}.jpg`;
}

const DUOI_HEIC = /\.(heic|heif)$/i;

/** Ảnh HEIC / HEIF của iPhone (theo đuôi tệp hoặc type): trình duyệt trên máy tính thường không đọc được. */
export const laTepHeic = (f) => DUOI_HEIC.test(String(f?.name ?? "").trim()) || /^image\/hei[cf]/i.test(String(f?.type ?? ""));

/**
 * Lọc tệp vừa chọn: chỉ nhận ảnh (type image/…), nhiều nhất đủ chỗ còn lại (`toiDa` − `daCo`). Tệp .heic / .heif mà
 * trình duyệt không nhận là ảnh (Windows để type rỗng) đếm riêng ở `boQuaHeic` để báo đúng lý do.
 * Trả { nhan: tệp được nhận, boQuaKhongPhaiAnh, boQuaHeic, boQuaVuot }.
 */
export function locAnhChon(tep, daCo, toiDa = SO_ANH_TOI_DA) {
    const ds = Array.from(tep ?? []);
    const anh = ds.filter((f) => String(f?.type ?? "").startsWith("image/"));
    const heic = ds.filter((f) => !String(f?.type ?? "").startsWith("image/") && laTepHeic(f));
    const conCho = Math.max(0, toiDa - Math.max(0, Number(daCo) || 0));
    return {
        nhan: anh.slice(0, conCho),
        boQuaKhongPhaiAnh: ds.length - anh.length - heic.length,
        boQuaHeic: heic.length,
        boQuaVuot: Math.max(0, anh.length - conCho),
    };
}

const CAU_HEIC = "Không đọc được định dạng HEIC, hãy chụp hoặc chọn ảnh JPEG.";

/** Câu báo khi bỏ bớt tệp vừa chọn (kết quả locAnhChon); không bỏ gì thì null. */
export function cauBoQua({ boQuaKhongPhaiAnh = 0, boQuaHeic = 0, boQuaVuot = 0 } = {}, toiDa = SO_ANH_TOI_DA) {
    const phan = [];
    if (boQuaVuot > 0) phan.push(`Mỗi biên bản tối đa ${toiDa} ảnh, đã bỏ ${boQuaVuot} ảnh chọn thừa.`);
    if (boQuaHeic > 0) phan.push(`Đã bỏ ${boQuaHeic} ảnh HEIC. ${CAU_HEIC}`);
    if (boQuaKhongPhaiAnh > 0) phan.push(`Đã bỏ ${boQuaKhongPhaiAnh} tệp không phải ảnh.`);
    return phan.length ? phan.join(" ") : null;
}

/**
 * Một thông báo cho mọi ảnh không thu nhỏ được trong một lần chọn (thay vì mỗi ảnh một thông báo): `{ tieuDe, moTa }`,
 * không có ảnh lỗi thì null. Có ảnh HEIC thì nói rõ định dạng.
 */
export function cauAnhKhongDoc(dsTep) {
    const ds = Array.isArray(dsTep) ? dsTep.filter(Boolean) : [];
    if (!ds.length) return null;
    const ten = ds.map((f) => String(f.name ?? "").trim()).filter(Boolean);
    const dsTen = `${ten.slice(0, 3).join(", ")}${ten.length > 3 ? ` +${ten.length - 3}` : ""}`;
    const tieuDe = ds.length === 1
        ? `Không đọc được ảnh${ten[0] ? ` ${ten[0]}` : ""}`
        : `Không đọc được ${ds.length} ảnh${dsTen ? `: ${dsTen}` : ""}`;
    return { tieuDe, moTa: ds.some(laTepHeic) ? CAU_HEIC : "Chọn ảnh JPEG, PNG hoặc WebP, hoặc chụp lại." };
}

/**
 * Tải lần lượt từng ảnh bằng `guiMot(anh, thuTu)` (trả Promise); một ảnh lỗi không dừng các ảnh sau.
 * `khiTienDo(daXong, tong)` gọi sau mỗi ảnh. `signal` (AbortSignal, không bắt buộc): người dùng bấm dừng thì không gửi
 * ảnh còn lại, các ảnh đó vào `loi` như ảnh lỗi (ảnh đang gửi dừng theo lời gọi hủy của `guiMot`).
 * Trả { daTai: ảnh tải được, loi: [{ anh, loi }], daDung: đã bấm dừng }.
 */
export async function taiLanLuot(ds, guiMot, khiTienDo, signal) {
    const danhSach = Array.isArray(ds) ? ds : [];
    const daTai = [];
    const loi = [];
    for (let i = 0; i < danhSach.length; i += 1) {
        if (signal?.aborted) {
            danhSach.slice(i).forEach((anh) => loi.push({ anh, loi: signal.reason ?? new Error("Đã dừng tải") }));
            break;
        }
        try {
            await guiMot(danhSach[i], i);
            daTai.push(danhSach[i]);
        } catch (e) {
            loi.push({ anh: danhSach[i], loi: e });
        }
        khiTienDo?.(i + 1, danhSach.length);
    }
    return { daTai, loi, daDung: Boolean(signal?.aborted) };
}

/** Câu báo sau khi lập biên bản mà còn ảnh tải lỗi hoặc bị bỏ qua (biên bản vẫn thành công). */
export const cauAnhChuaTai = (soLoi) => `${soLoi} ảnh chưa tải được, thêm lại ở chi tiết phiếu`;

// ─────────────────────────────── Trình duyệt (canvas) ───────────────────────────────

/** Đọc ảnh để vẽ lên canvas, xoay đúng chiều theo EXIF. Trả { anh, rong, cao, donDep }. */
async function docAnh(file) {
    if (typeof createImageBitmap === "function") {
        try {
            const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
            return { anh: bm, rong: bm.width, cao: bm.height, donDep: () => bm.close?.() };
        } catch {
            // Trình duyệt không đọc được theo cách này: thử bằng thẻ <img> bên dưới
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { anh: img, rong: img.naturalWidth, cao: img.naturalHeight, donDep: () => URL.revokeObjectURL(url) };
    } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
    }
}

/**
 * Thu nhỏ một ảnh về JPEG (cạnh dài ≤ 1600 px, ≤ ~950 KB nếu được) để tải lên. Ảnh không đọc được (vd. HEIC trên máy
 * tính) thì ném lỗi; nơi gọi báo người dùng chọn ảnh khác.
 */
export async function thuNhoAnh(file) {
    const nguon = await docAnh(file);
    try {
        if (!(nguon.rong > 0) || !(nguon.cao > 0)) throw new Error("Ảnh không có kích thước");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Trình duyệt không vẽ được ảnh");
        let blob = null;
        let coDangVe = null;
        for (const lan of cacLanThu(nguon.rong, nguon.cao)) {
            if (coDangVe !== `${lan.rong}x${lan.cao}`) {
                coDangVe = `${lan.rong}x${lan.cao}`;
                canvas.width = lan.rong;
                canvas.height = lan.cao;
                // Ảnh PNG trong suốt: nền trắng thay vì nền đen của JPEG
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, lan.rong, lan.cao);
                ctx.drawImage(nguon.anh, 0, 0, lan.rong, lan.cao);
            }
            blob = await new Promise((xong) => canvas.toBlob(xong, "image/jpeg", lan.chatLuong));
            if (!blob) throw new Error("Trình duyệt không nén được ảnh");
            if (blob.size <= DUNG_LUONG_DICH) break;
        }
        return new File([blob], tenTepJpeg(file?.name), { type: "image/jpeg", lastModified: Date.now() });
    } finally {
        nguon.donDep();
    }
}
