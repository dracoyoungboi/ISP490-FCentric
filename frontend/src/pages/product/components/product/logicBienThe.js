import { t } from "../../../../i18n/t.js";
/**
 * Logic thuần của Trình tạo biến thể (form Thêm sản phẩm).
 *
 * Người dùng chọn nhiều màu sắc và nhiều kích cỡ; mỗi cặp Màu × Kích cỡ là một biến thể.
 * Giá nhập một lần rồi áp xuống (chung → theo màu → từng ô), ảnh gắn theo màu:
 * các kích cỡ cùng màu dùng chung một tệp, backend nhận chỉ số tệp qua `viTriAnh`.
 *
 * File này không phụ thuộc React để dễ kiểm thử.
 */

/** Khớp giới hạn SO_BIEN_THE_TOI_DA ở SanPhamQuanAoService. */
export const SO_BIEN_THE_TOI_DA = 100;

export const khoaBienThe = (mauSacId, sizeId) => `${mauSacId}-${sizeId}`;

/** Kích cỡ theo thứ tự hiển thị chuẩn (thuTuSapXep, cùng thứ tự thì theo id). */
export const sapXepKichCo = (sizes) =>
    [...(sizes || [])].sort(
        (a, b) => (a.thuTuSapXep ?? 0) - (b.thuTuSapXep ?? 0) || a.id - b.id,
    );

/** Giống generateCodeFromName ở backend: chữ cái đầu mỗi từ, bỏ dấu, viết hoa. */
export const vietTatDanhMuc = (tenDanhMuc) => {
    if (!tenDanhMuc) return "XX";
    return tenDanhMuc
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toUpperCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((tu) => tu[0])
        .join("");
};

/** Chữ thường, bỏ dấu (đ → d) để tìm kiếm không cần gõ dấu. */
export const boDau = (chuoi) =>
    String(chuoi ?? "").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/** Lọc màu theo tên hoặc mã màu, không phân biệt dấu và hoa/thường; từ khóa trống trả cả danh sách. */
export function locMauSac(mauSacs, tuKhoa) {
    const k = boDau(tuKhoa).trim();
    if (!k) return mauSacs;
    return mauSacs.filter((m) => boDau(m.tenMau).includes(k) || boDau(m.maMau).includes(k));
}

/** Phần ngày yyMMdd trong mã sản phẩm. */
export const ngayTrongMa = (ngay = new Date()) =>
    String(ngay.getFullYear()).slice(2) +
    String(ngay.getMonth() + 1).padStart(2, "0") +
    String(ngay.getDate()).padStart(2, "0");

/** Chuỗi chỉ gồm chữ số -> số nguyên; rỗng -> "" (giá để trống). */
export const docTien = (giaTri) => {
    const chuSo = String(giaTri ?? "").replace(/\D/g, "").slice(0, 13);
    return chuSo === "" ? "" : Number(chuSo);
};

export const hienTien = (so) => (so === "" || so == null ? "" : Number(so).toLocaleString("vi-VN"));

const coSo = (giaTri) => giaTri !== "" && giaTri != null && Number.isFinite(Number(giaTri));

/**
 * Giá bán gợi ý = giá vốn × 1,2 rồi làm tròn lên hàng nghìn (giá đẹp để in tem, vẫn lãi ít nhất 20%).
 * Khớp số máy chủ tự điền khi biến thể chưa có giá bán (SanPhamQuanAoService.recalculatePriceAndStatus, cũng làm
 * tròn lên nghìn). Tính bằng số nguyên (xu × 12 / 10^6 nghìn) để tránh
 * sai số dấu phẩy động.
 * @returns {number|null} null khi chưa có giá vốn.
 */
export function giaBanGoiY(giaVon) {
    if (!coSo(giaVon)) return null;
    const xu = Math.round(Number(giaVon) * 100);
    if (xu <= 0) return null;
    return Math.ceil((xu * 12) / 1_000_000) * 1000;
}

/** Dòng sẽ được lưu và sửa được giá bán (nhận giá gợi ý được). */
export const dongNhanGiaBan = (d) => !d.khoaGiaBan && (d.loai === "cu" || d.tao);
const dongSeLuu = (d) => d.loai === "cu" || d.tao;

/**
 * Giá bán đang trống hoặc thấp hơn `gia`. Gợi ý là giá sàn (lãi ít nhất 20%), không phải giá nên bán: giá bằng hoặc
 * cao hơn thì không gợi ý, để không mời người dùng hạ giá.
 */
export const canNangGia = (giaBan, gia) => gia != null && (!coSo(giaBan) || Number(giaBan) < gia);

/**
 * Giá gợi ý cả màu (hàng màu và nút Nâng giá lên giá sàn chung): theo giá vốn cao nhất trong màu để cỡ nào cũng lãi ít nhất
 * 20%. Đang nhập giá vốn nhóm thì dùng số đó thay cho các dòng sửa được giá vốn (dòng giá vốn khóa vẫn tính).
 * @returns {number|null} null khi màu không có dòng nhận giá bán hoặc chưa có giá vốn nào.
 */
export function goiYMau(dsDong, giaVonNhom = "") {
    if (!dsDong.some(dongNhanGiaBan)) return null;
    const coNhapNhom = coSo(giaVonNhom);
    const giaVons = dsDong
        .filter((d) => dongSeLuu(d) && (!coNhapNhom || d.khoaGia) && coSo(d.giaVon))
        .map((d) => Number(d.giaVon));
    if (coNhapNhom) giaVons.push(Number(giaVonNhom));
    return giaVons.length === 0 ? null : giaBanGoiY(Math.max(...giaVons));
}

/** Số dòng sẽ được nâng lên `gia` (dòng nhận giá bán đang trống hoặc thấp hơn). */
export const demDongCanNang = (dsDong, gia) =>
    gia == null ? 0 : dsDong.filter((d) => dongNhanGiaBan(d) && canNangGia(d.giaBan, gia)).length;

/** Giá bán từ bao nhiêu lần giá vốn trở lên thì nhắc kiểm tra lại (thường là gõ thừa số 0). */
export const HE_SO_GIA_CAO = 5;

/**
 * Mức của giá bán so với giá vốn, quyết định màu bóng đèn trong ô giá bán:
 * - "chuaVon": chưa có giá vốn (trống hoặc 0) nên không tính được lãi.
 * - "trong": chưa có giá bán. Giá 0 cũng coi là trống, giống máy chủ (giá ≤ 0 thì tự đặt khi nhập kho).
 * - "lo": thấp hơn giá vốn. "thap": lãi dưới 20% (so đúng giá vốn × 1,2, không theo giá sàn đã làm tròn lên nghìn,
 *   để câu "Lãi N%, dưới mức tối thiểu 20%" không bao giờ ghi N ≥ 20).
 * - "cao": từ HE_SO_GIA_CAO lần giá vốn trở lên. "dat": còn lại.
 */
export function mucGiaBan(giaVon, giaBan) {
    if (!coSo(giaVon) || Number(giaVon) <= 0) return "chuaVon";
    if (!coSo(giaBan) || Number(giaBan) <= 0) return "trong";
    const von = Number(giaVon);
    const ban = Number(giaBan);
    if (ban < von) return "lo";
    if (ban * 10 < von * 12) return "thap";
    if (ban >= von * HE_SO_GIA_CAO) return "cao";
    return "dat";
}

/** % lãi trên giá vốn, làm tròn xuống (lãi 19,9% hiện 19%, khớp mức "thap"). null khi chưa đủ giá. */
export function phanTramLai(giaVon, giaBan) {
    if (!coSo(giaVon) || Number(giaVon) <= 0 || !coSo(giaBan)) return null;
    return Math.floor(((Number(giaBan) - Number(giaVon)) * 100) / Number(giaVon));
}

/** Độ nghiêm trọng của từng mức: hàng màu hiện mức nặng nhất trong các cỡ. */
const DO_NANG = { dat: 0, chuaVon: 1, trong: 2, cao: 3, thap: 4, lo: 5 };

/**
 * Giá của dòng đã "chốt": dòng đang gõ (`dangGo`, ghi lúc con trỏ vào ô) dùng giá lúc bắt đầu gõ, để bóng đèn và các
 * con số đếm không nhảy theo từng phím (gõ 60.000 thì 6, 60, 600 đều thấp hơn giá sàn). Rời ô thì dùng giá mới.
 */
export function giaDaChot(d, dangGo) {
    if (!dangGo || dangGo.khoa !== d.khoa) return d;
    return { ...d, giaVon: dangGo.giaVon, giaBan: dangGo.giaBan };
}

/** Mức của một dòng theo giá đã chốt; null khi dòng không sửa được giá bán (không có bóng đèn). */
export function mucCuaDong(d, dangGo) {
    if (!dongNhanGiaBan(d)) return null;
    const g = giaDaChot(d, dangGo);
    return mucGiaBan(g.giaVon, g.giaBan);
}

/** Mức nặng nhất trong các dòng của một màu; null khi màu không có dòng nào sửa được giá bán. */
export function mucNangNhat(dsDong, dangGo) {
    let ketQua = null;
    for (const d of dsDong) {
        const muc = mucCuaDong(d, dangGo);
        if (muc && (ketQua == null || DO_NANG[muc] > DO_NANG[ketQua])) ketQua = muc;
    }
    return ketQua;
}

/** Số dòng theo từng mức (giá đã chốt), để ô nổi hàng màu tóm tắt. */
export function demTheoMuc(dsDong, dangGo) {
    const dem = { dat: 0, chuaVon: 0, trong: 0, cao: 0, thap: 0, lo: 0 };
    for (const d of dsDong) {
        const muc = mucCuaDong(d, dangGo);
        if (muc) dem[muc] += 1;
    }
    return dem;
}

/**
 * Xử lý một lần sửa ô tiền đang hiện dạng 1.250.000.
 * Backspace/Delete đúng vào dấu chấm phân cách thì xóa luôn chữ số liền kề (nếu không thao tác sẽ không có tác dụng).
 * @returns {{ giaTri: number|"", soChuSoTruocConTro: number }} số chữ số đứng trước con trỏ để đặt lại con trỏ.
 */
export function xuLyNhapTien({ chuoiMoi, conTro, kieuNhap, giaTriCu }) {
    let chuoi = chuoiMoi;
    let viTriConTro = conTro ?? chuoi.length;
    const chuoiCu = hienTien(giaTriCu);
    const chiXoaDauCham =
        (kieuNhap === "deleteContentBackward" || kieuNhap === "deleteContentForward") &&
        chuoi.length < chuoiCu.length &&
        chuoi.replace(/\D/g, "") === chuoiCu.replace(/\D/g, "");
    if (chiXoaDauCham) {
        const viTriXoa = kieuNhap === "deleteContentBackward" ? viTriConTro - 1 : viTriConTro;
        if (viTriXoa >= 0 && viTriXoa < chuoi.length) {
            chuoi = chuoi.slice(0, viTriXoa) + chuoi.slice(viTriXoa + 1);
            if (kieuNhap === "deleteContentBackward") viTriConTro = viTriXoa;
        }
    }
    return {
        giaTri: docTien(chuoi),
        soChuSoTruocConTro: chuoi.slice(0, viTriConTro).replace(/\D/g, "").length,
    };
}

/** Vị trí con trỏ trong chuỗi hiển thị sao cho đứng sau đúng `soChuSo` chữ số. */
export function viTriSauChuSo(chuoiHienThi, soChuSo) {
    let viTri = 0;
    for (let dem = 0; viTri < chuoiHienThi.length && dem < soChuSo; viTri++) {
        if (/\d/.test(chuoiHienThi[viTri])) dem++;
    }
    return viTri;
}

/** Ảnh tải lên: chỉ nhận tệp ảnh, tối đa 10 MB. */
export const DUNG_LUONG_ANH_TOI_DA = 10 * 1024 * 1024;

/** @returns {string|null} lý do không nhận tệp, null nếu hợp lệ. */
export function kiemTraTepAnh(tep) {
    if (!tep?.type?.startsWith("image/")) return t("\"{{tenTep}}\" không phải tệp ảnh", { tenTep: tep?.name ?? "" });
    if (tep.size > DUNG_LUONG_ANH_TOI_DA) return t("\"{{tenTep}}\" lớn hơn 10 MB", { tenTep: tep.name });
    return null;
}

// ---------------------------------------------------------------------------
// Trạng thái của trình tạo (dùng với useReducer)
// ---------------------------------------------------------------------------

export const trangThaiBanDau = () => ({
    mauDaChon: [], // id màu theo thứ tự người dùng bấm chọn
    kichCoDaChon: [], // id kích cỡ
    dong: {}, // khoaBienThe -> { tao, giaVon, giaBan }; giữ lại khi bỏ chọn rồi chọn lại
    giaMau: {}, // mauSacId -> { giaVon, giaBan } ô giá nhóm của từng màu
    anhMau: {}, // mauSacId -> { id, file, url }
    mauThuGon: [], // id màu đang thu gọn trong bảng
    giaChung: null, // giá chung đã áp dụng gần nhất; tổ hợp sinh thêm sau đó nhận luôn giá này
    dangGo: null, // { khoa, giaVon, giaBan } dòng đang có con trỏ trong ô giá, giá lúc bắt đầu gõ (xem giaDaChot)
});

const dongMoi = (giaChung) => ({
    tao: true,
    giaVon: giaChung?.giaVon ?? "",
    giaBan: giaChung?.giaBan ?? "",
});

/** Tạo sẵn dòng cho mọi tổ hợp đang chọn mà chưa có dòng. */
const boSungDong = (state) => {
    let dong = state.dong;
    for (const mauSacId of state.mauDaChon) {
        for (const sizeId of state.kichCoDaChon) {
            const khoa = khoaBienThe(mauSacId, sizeId);
            if (!dong[khoa]) {
                if (dong === state.dong) dong = { ...dong };
                dong[khoa] = dongMoi(state.giaChung);
            }
        }
    }
    return dong === state.dong ? state : { ...state, dong };
};

const batTat = (ds, id) => (ds.includes(id) ? ds.filter((x) => x !== id) : [...ds, id]);

/** Ghi giá vào các dòng; ô giá để trống thì giữ giá cũ của dòng. */
const ganGia = (dong, khoas, { giaVon, giaBan }) => {
    const ketQua = { ...dong };
    for (const khoa of khoas) {
        ketQua[khoa] = {
            ...ketQua[khoa],
            ...(giaVon !== "" ? { giaVon } : {}),
            ...(giaBan !== "" ? { giaBan } : {}),
        };
    }
    return ketQua;
};

const khoaDangChonCuaMau = (state, mauSacId) =>
    state.kichCoDaChon.map((sizeId) => khoaBienThe(mauSacId, sizeId));

/** Mọi dòng đã có của một màu, kể cả kích cỡ đang bỏ chọn (để chọn lại vẫn đúng giá vừa áp). */
const moiKhoaCuaMau = (dong, mauSacId) => Object.keys(dong).filter((khoa) => khoa.startsWith(`${mauSacId}-`));

export function bienTheReducer(state, action) {
    switch (action.type) {
        case "datLai":
            return trangThaiBanDau();
        case "batTatMau":
            return boSungDong({ ...state, mauDaChon: batTat(state.mauDaChon, action.mauSacId) });
        case "themMau": {
            // Thêm nhiều màu một lần (VD: "Chọn cả N kết quả"), giữ thứ tự đã chọn trước đó.
            const moi = action.mauSacIds.filter((id) => !state.mauDaChon.includes(id));
            return moi.length ? boSungDong({ ...state, mauDaChon: [...state.mauDaChon, ...moi] }) : state;
        }
        case "boChonTatCaMau":
            return { ...state, mauDaChon: [] };
        case "batTatKichCo":
            return boSungDong({ ...state, kichCoDaChon: batTat(state.kichCoDaChon, action.sizeId) });
        case "chonKichCo":
            return boSungDong({ ...state, kichCoDaChon: [...action.sizeIds] });
        case "batTatToHop": {
            const cu = state.dong[action.khoa];
            return { ...state, dong: { ...state.dong, [action.khoa]: { ...cu, tao: !cu.tao } } };
        }
        case "batTatCaMau": {
            const dong = { ...state.dong };
            for (const khoa of khoaDangChonCuaMau(state, action.mauSacId)) {
                dong[khoa] = { ...dong[khoa], tao: action.tao };
            }
            return { ...state, dong };
        }
        case "suaGia": {
            const cu = state.dong[action.khoa];
            return { ...state, dong: { ...state.dong, [action.khoa]: { ...cu, [action.truong]: action.giaTri } } };
        }
        case "suaGiaMau": {
            const cu = state.giaMau[action.mauSacId] ?? { giaVon: "", giaBan: "" };
            return { ...state, giaMau: { ...state.giaMau, [action.mauSacId]: { ...cu, [action.truong]: action.giaTri } } };
        }
        case "apDungGiaMau": {
            const gia = state.giaMau[action.mauSacId];
            if (!gia) return state;
            return { ...state, dong: ganGia(state.dong, moiKhoaCuaMau(state.dong, action.mauSacId), gia) };
        }
        case "apDungGiaChung": {
            // Áp cho mọi dòng đã có, kể cả dòng của màu/kích cỡ đang bỏ chọn: chọn lại sẽ thấy đúng giá chung.
            const khoas = Object.keys(state.dong);
            const giaChung = {
                giaVon: action.giaVon !== "" ? action.giaVon : state.giaChung?.giaVon ?? "",
                giaBan: action.giaBan !== "" ? action.giaBan : state.giaChung?.giaBan ?? "",
            };
            return { ...state, giaChung, dong: ganGia(state.dong, khoas, action) };
        }
        case "nangGiaBanTheoMau": {
            // giaTheoMau: { mauSacId: giá gợi ý của màu } — chỉ nâng dòng giá bán trống hoặc thấp hơn, không hạ giá.
            let dong = state.dong;
            for (const [mauSacId, gia] of Object.entries(action.giaTheoMau)) {
                const khoas = moiKhoaCuaMau(dong, mauSacId).filter((khoa) => canNangGia(dong[khoa].giaBan, gia));
                if (khoas.length > 0) dong = ganGia(dong, khoas, { giaVon: "", giaBan: gia });
            }
            return dong === state.dong ? state : { ...state, dong };
        }
        case "ganAnhMau":
            return { ...state, anhMau: { ...state.anhMau, [action.mauSacId]: action.anh } };
        case "goAnhMau": {
            const anhMau = { ...state.anhMau };
            delete anhMau[action.mauSacId];
            return { ...state, anhMau };
        }
        case "batDauGo":
            return { ...state, dangGo: { khoa: action.khoa, giaVon: action.giaVon, giaBan: action.giaBan } };
        case "ketThucGo":
            return state.dangGo == null ? state : { ...state, dangGo: null };
        case "batTatThuGon":
            return { ...state, mauThuGon: batTat(state.mauThuGon, action.mauSacId) };
        case "thuGonTatCa":
            return { ...state, mauThuGon: action.thuGon ? [...state.mauDaChon] : [] };
        default:
            return state;
    }
}

// ---------------------------------------------------------------------------
// Dữ liệu suy ra để hiển thị, kiểm tra và gửi lên backend
// ---------------------------------------------------------------------------

/**
 * Bảng biến thể nhóm theo màu (theo thứ tự chọn màu), trong mỗi nhóm kích cỡ theo thứ tự chuẩn.
 * @returns {{mauSacId:number, dong:{khoa:string,sizeId:number,tao:boolean,giaVon:number|"",giaBan:number|""}[]}[]}
 */
export function tinhNhomBienThe(state, kichCoTheoThuTu) {
    const kichCoChon = kichCoTheoThuTu.filter((size) => state.kichCoDaChon.includes(size.id));
    return state.mauDaChon.map((mauSacId) => ({
        mauSacId,
        dong: kichCoChon.map((size) => {
            const khoa = khoaBienThe(mauSacId, size.id);
            return { khoa, sizeId: size.id, ...(state.dong[khoa] ?? dongMoi(null)) };
        }),
    }));
}

/** Người dùng đã nhập gì vào trình tạo chưa (để hỏi lại trước khi đóng form). */
export const daNhapBienThe = (state) =>
    state.mauDaChon.length > 0 || state.kichCoDaChon.length > 0 || Object.keys(state.anhMau).length > 0;

export function thongKeBienThe(nhom, anhMau, dangGo = null) {
    let soToHop = 0;
    let soTao = 0;
    let soGiaBanThapHon = 0;
    const mauThieuAnh = [];
    for (const { mauSacId, dong } of nhom) {
        const dongTao = dong.filter((d) => d.tao);
        soToHop += dong.length;
        soTao += dongTao.length;
        // Theo giá đã chốt (rời ô) để số đếm không nhảy theo từng phím gõ.
        soGiaBanThapHon += dongTao.filter((d) => mucCuaDong(d, dangGo) === "lo").length;
        if (dongTao.length > 0 && !anhMau[mauSacId]) mauThieuAnh.push(mauSacId);
    }
    const soMauCoBienThe = nhom.filter((n) => n.dong.some((d) => d.tao)).length;
    return { soToHop, soTao, soBoQua: soToHop - soTao, soGiaBanThapHon, mauThieuAnh, soMauCoBienThe };
}

/**
 * Số dòng vừa nhận giá chung, để báo cho người dùng: chỉ đếm dòng sẽ được lưu (biến thể đã lưu ở form Chỉnh sửa
 * và tổ hợp đang tích). Dòng bỏ tích vẫn nhận giá (tích lại thấy đúng giá) nhưng không đếm.
 * Một dòng được tính là đã áp khi nhận được ít nhất một trong hai giá vừa nhập.
 * @returns {{soApDung:number, soKhoaGia:number}} soKhoaGia: biến thể còn tồn kho giữ nguyên giá vốn (chỉ đếm khi có
 *   nhập giá vốn chung).
 */
export function demDongApGiaChung(nhom, { giaVon = "", giaBan = "" } = {}) {
    const dongSeLuu = nhom.flatMap((n) => n.dong).filter((d) => d.loai === "cu" || d.tao);
    const coGiaVon = giaVon !== "";
    const coGiaBan = giaBan !== "";
    const soApDung = dongSeLuu.filter((d) => (coGiaVon && !d.khoaGia) || (coGiaBan && !d.khoaGiaBan)).length;
    const soKhoaGia = coGiaVon ? dongSeLuu.filter((d) => d.khoaGia).length : 0;
    return { soApDung, soKhoaGia };
}

/**
 * Danh sách biến thể gửi backend + các tệp ảnh khác nhau (mỗi màu một tệp; hai màu chọn cùng
 * một tệp thì chỉ gửi một lần). Biến thể trỏ tới tệp qua viTriAnh = chỉ số trong anhBienThes.
 */
export function taoDuLieuGuiBienThe(nhom, anhMau, chatLieuId) {
    const anhBienThes = [];
    const bienTheSanPhams = [];
    for (const { mauSacId, dong } of nhom) {
        const dongTao = dong.filter((d) => d.tao);
        if (dongTao.length === 0) continue;
        const tep = anhMau[mauSacId].file;
        let viTriAnh = anhBienThes.indexOf(tep);
        if (viTriAnh === -1) {
            viTriAnh = anhBienThes.length;
            anhBienThes.push(tep);
        }
        for (const d of dongTao) {
            bienTheSanPhams.push({
                mauSacId,
                sizeId: d.sizeId,
                chatLieuId: Number(chatLieuId),
                maSku: "",
                maVachSku: "",
                giaVon: d.giaVon === "" ? 0 : d.giaVon,
                giaBan: d.giaBan === "" ? 0 : d.giaBan,
                trangThai: 1,
                viTriAnh,
            });
        }
    }
    return { bienTheSanPhams, anhBienThes };
}

/** Mã SKU xem trước theo công thức backend: [Mã SP]-[Mã chất liệu]-[Mã kích cỡ]-[Mã màu]. */
export function xemTruocSku({ tienToMaSanPham, maChatLieu, maSize, maMau }) {
    return {
        maSanPham: tienToMaSanPham || t("[Mã SP]"),
        phanSau: `-${maChatLieu || t("[Chất liệu]")}-${maSize}-${maMau}`,
    };
}
