/**
 * Logic thuần của Trình tạo biến thể ở chế độ SỬA sản phẩm.
 *
 * Trạng thái là bản mở rộng của trạng thái chế độ thêm (logicBienThe.js) nên dùng chung giao diện:
 * - Biến thể đã lưu nằm trong `bienTheCu` (tra theo id). Màu và kích cỡ của chúng bị khóa: không bỏ chọn được.
 * - Chọn thêm màu hoặc kích cỡ thì chỉ sinh tổ hợp còn thiếu (dòng "mới"), giống chế độ thêm.
 * - Biến thể còn tồn kho: giá do hệ thống tính theo lô nhập nên không sửa được (`conTonKho`).
 * - Biến thể chưa phát sinh giao dịch đổi được màu/kích cỡ (backend kiểm tra lại khi lưu).
 *
 * File này không phụ thuộc React để dễ kiểm thử.
 */
import { bienTheReducer, khoaBienThe, trangThaiBanDau } from "./logicBienThe.js";

const KHOA_CU = "id:";
export const khoaBienTheCu = (id) => `${KHOA_CU}${id}`;
const laKhoaCu = (khoa) => typeof khoa === "string" && khoa.startsWith(KHOA_CU);
const idTuKhoa = (khoa) => Number(khoa.slice(KHOA_CU.length));
const soTien = (giaTri) => (giaTri === "" || giaTri == null ? "" : Number(giaTri));
const themNeuChuaCo = (ds, id) => (ds.includes(id) ? ds : [...ds, id]);

/**
 * Trạng thái ban đầu từ danh sách biến thể của API chi tiết sản phẩm.
 * Ô trống trong lưới (màu × kích cỡ đang có nhưng chưa có biến thể) mặc định KHÔNG tạo,
 * để mở form rồi lưu không vô tình sinh thêm biến thể.
 */
export function khoiTaoSuaBienThe(dsBienThe = []) {
    const state = { ...trangThaiBanDau(), cheDo: "sua", bienTheCu: {}, thuTuCu: [], anhMauCu: {} };
    const daDung = new Set();
    for (const bt of dsBienThe) {
        const mauSacId = bt.mauSac?.id ?? null;
        const sizeId = bt.size?.id ?? null;
        if (bt.id == null || mauSacId == null || sizeId == null) continue;
        const giaVon = soTien(bt.giaVon ?? 0);
        const giaBan = soTien(bt.giaBan ?? 0);
        const trangThai = bt.trangThai ?? 1;
        state.bienTheCu[bt.id] = {
            id: bt.id,
            mauSacId,
            sizeId,
            chatLieuId: bt.chatLieu?.id ?? null,
            maSku: bt.maSku || "",
            giaVon,
            giaBan,
            trangThai,
            // Thiếu cờ (backend cũ) thì coi như đã phát sinh giao dịch / còn tồn cho an toàn.
            daPhatSinhGiaoDich: bt.daPhatSinhGiaoDich !== false,
            conTonKho: bt.conTonKho !== false,
            goc: { mauSacId, sizeId, giaVon, giaBan, trangThai },
        };
        state.thuTuCu.push(bt.id);
        state.mauDaChon = themNeuChuaCo(state.mauDaChon, mauSacId);
        state.kichCoDaChon = themNeuChuaCo(state.kichCoDaChon, sizeId);
        const url = bt.anhBienThe?.tepTin?.duongDan || bt.anhBienThe?.urlAnh;
        if (url && !state.anhMauCu[mauSacId]) state.anhMauCu[mauSacId] = url;
        daDung.add(khoaBienThe(mauSacId, sizeId));
    }
    for (const mauSacId of state.mauDaChon) {
        for (const sizeId of state.kichCoDaChon) {
            const khoa = khoaBienThe(mauSacId, sizeId);
            if (!daDung.has(khoa)) state.dong[khoa] = { tao: false, giaVon: "", giaBan: "" };
        }
    }
    return state;
}

const dsCu = (state) => state.thuTuCu.map((id) => state.bienTheCu[id]).filter(Boolean);

/** Màu và kích cỡ đang có biến thể đã lưu: không bỏ chọn được. */
export const mauBiKhoa = (state) => [...new Set(dsCu(state).map((b) => b.mauSacId))];
export const kichCoBiKhoa = (state) => [...new Set(dsCu(state).map((b) => b.sizeId))];

/** Ghi giá vào các biến thể đã lưu (bỏ qua biến thể còn tồn kho); ô giá để trống thì giữ giá cũ. */
function ganGiaCu(state, chon, { giaVon, giaBan }) {
    let bienTheCu = state.bienTheCu;
    for (const b of dsCu(state)) {
        if (b.conTonKho || !chon(b)) continue;
        const moi = {
            ...b,
            ...(giaVon !== "" && giaVon != null ? { giaVon } : {}),
            ...(giaBan !== "" && giaBan != null ? { giaBan } : {}),
        };
        if (moi.giaVon === b.giaVon && moi.giaBan === b.giaBan) continue;
        if (bienTheCu === state.bienTheCu) bienTheCu = { ...bienTheCu };
        bienTheCu[b.id] = moi;
    }
    return bienTheCu === state.bienTheCu ? state : { ...state, bienTheCu };
}

/**
 * Kiểm tra đổi màu/kích cỡ của một biến thể đã lưu. Trả về câu lỗi, hoặc null nếu hợp lệ.
 * Giống backend: không trùng tổ hợp của biến thể khác, và không đổi chéo trong cùng một lần lưu.
 */
export function kiemTraDoiThuocTinh(state, id, mauSacId, sizeId) {
    const b = state.bienTheCu[id];
    if (!b) return "Không tìm thấy biến thể.";
    if (b.daPhatSinhGiaoDich) return "Biến thể đã phát sinh giao dịch nên không đổi được màu sắc, kích cỡ.";
    if (mauSacId == null || sizeId == null) return "Vui lòng chọn màu sắc và kích cỡ.";
    for (const khac of dsCu(state)) {
        if (khac.id === id) continue;
        if (khac.mauSacId === mauSacId && khac.sizeId === sizeId) {
            return `Đã có biến thể ${khac.maSku} cùng màu sắc và kích cỡ này.`;
        }
        if (khac.goc.mauSacId === mauSacId && khac.goc.sizeId === sizeId) {
            return `Tổ hợp này đang được lưu cho biến thể ${khac.maSku}. Vui lòng lưu thay đổi của biến thể đó trước.`;
        }
    }
    return null;
}

/**
 * Màu/kích cỡ vừa được thêm vào lưới do đổi thuộc tính một biến thể: các ô mới sinh ra mặc định KHÔNG tạo,
 * để đổi màu một biến thể không kéo theo cả loạt biến thể mới.
 */
function chanTuSinhDong(state, mauMoi, kichCoMoi) {
    let dong = state.dong;
    for (const mauSacId of state.mauDaChon) {
        for (const sizeId of state.kichCoDaChon) {
            if (!mauMoi.includes(mauSacId) && !kichCoMoi.includes(sizeId)) continue;
            const khoa = khoaBienThe(mauSacId, sizeId);
            if (dong[khoa]) continue;
            if (dong === state.dong) dong = { ...dong };
            dong[khoa] = { tao: false, giaVon: "", giaBan: "" };
        }
    }
    return dong === state.dong ? state : { ...state, dong };
}

/**
 * Reducer chế độ sửa: chặn bỏ chọn màu/kích cỡ đang có biến thể, áp giá cho cả biến thể đã lưu,
 * thêm các hành động riêng (đổi trạng thái, đổi màu/kích cỡ). Phần còn lại dùng bienTheReducer.
 */
export function suaBienTheReducer(state, action) {
    switch (action.type) {
        case "khoiTaoSua":
            return khoiTaoSuaBienThe(action.dsBienThe);
        case "datLai":
            return khoiTaoSuaBienThe([]);
        case "batTatMau":
            return mauBiKhoa(state).includes(action.mauSacId) ? state : bienTheReducer(state, action);
        case "boChonTatCaMau": {
            const khoa = mauBiKhoa(state);
            return { ...state, mauDaChon: state.mauDaChon.filter((id) => khoa.includes(id)) };
        }
        case "batTatKichCo":
            return kichCoBiKhoa(state).includes(action.sizeId) ? state : bienTheReducer(state, action);
        case "chonKichCo":
            return bienTheReducer(state, { ...action, sizeIds: [...new Set([...kichCoBiKhoa(state), ...action.sizeIds])] });
        case "suaGia": {
            if (!laKhoaCu(action.khoa)) return bienTheReducer(state, action);
            const b = state.bienTheCu[idTuKhoa(action.khoa)];
            if (!b || b.conTonKho) return state;
            return { ...state, bienTheCu: { ...state.bienTheCu, [b.id]: { ...b, [action.truong]: action.giaTri } } };
        }
        case "apDungGiaMau": {
            const gia = state.giaMau[action.mauSacId];
            if (!gia) return state;
            return ganGiaCu(bienTheReducer(state, action), (b) => b.mauSacId === action.mauSacId, gia);
        }
        case "apDungGiaChung":
            return ganGiaCu(bienTheReducer(state, action), () => true, action);
        case "batTatToHop":
            return laKhoaCu(action.khoa) ? state : bienTheReducer(state, action);
        case "doiTrangThai": {
            const b = state.bienTheCu[action.id];
            if (!b) return state;
            return { ...state, bienTheCu: { ...state.bienTheCu, [b.id]: { ...b, trangThai: b.trangThai === 1 ? 0 : 1 } } };
        }
        case "doiThuocTinh": {
            const b = state.bienTheCu[action.id];
            if (!b || kiemTraDoiThuocTinh(state, action.id, action.mauSacId, action.sizeId)) return state;
            const khoaCu = khoaBienThe(b.mauSacId, b.sizeId);
            const mauMoi = state.mauDaChon.includes(action.mauSacId) ? [] : [action.mauSacId];
            const kichCoMoi = state.kichCoDaChon.includes(action.sizeId) ? [] : [action.sizeId];
            const sauKhiDoi = {
                ...state,
                bienTheCu: { ...state.bienTheCu, [b.id]: { ...b, mauSacId: action.mauSacId, sizeId: action.sizeId } },
                mauDaChon: themNeuChuaCo(state.mauDaChon, action.mauSacId),
                kichCoDaChon: themNeuChuaCo(state.kichCoDaChon, action.sizeId),
                // Ô vừa bỏ trống không tự sinh biến thể mới
                dong: { ...state.dong, [khoaCu]: { giaVon: "", giaBan: "", ...state.dong[khoaCu], tao: false } },
            };
            return chanTuSinhDong(sauKhiDoi, mauMoi, kichCoMoi);
        }
        default:
            return bienTheReducer(state, action);
    }
}

/**
 * Bảng biến thể nhóm theo màu: dòng đã lưu + dòng mới cho tổ hợp còn trống, sắp theo thứ tự kích cỡ.
 * Dòng đã lưu: { khoa: "id:12", loai: "cu", id, trangThai, khoaGia, maSku, doiDuoc, daDoi, ... }.
 * Dòng mới: { khoa: "25-18", loai: "moi", tao, ... } giống chế độ thêm.
 */
export function tinhNhomSua(state, kichCoTheoThuTu) {
    const thuTu = new Map(kichCoTheoThuTu.map((s, i) => [s.id, i]));
    const viTri = (sizeId) => thuTu.get(sizeId) ?? Number.MAX_SAFE_INTEGER;
    const cu = dsCu(state);
    const daDung = new Set(cu.map((b) => khoaBienThe(b.mauSacId, b.sizeId)));
    return state.mauDaChon.map((mauSacId) => {
        const dongCu = cu
            .filter((b) => b.mauSacId === mauSacId)
            .map((b) => ({
                khoa: khoaBienTheCu(b.id),
                loai: "cu",
                id: b.id,
                sizeId: b.sizeId,
                tao: true,
                trangThai: b.trangThai,
                giaVon: b.giaVon,
                giaBan: b.giaBan,
                khoaGia: b.conTonKho,
                maSku: b.maSku,
                doiDuoc: !b.daPhatSinhGiaoDich,
                daDoi: b.mauSacId !== b.goc.mauSacId || b.sizeId !== b.goc.sizeId,
            }));
        const dongMoi = state.kichCoDaChon
            .filter((sizeId) => !daDung.has(khoaBienThe(mauSacId, sizeId)))
            .map((sizeId) => {
                const khoa = khoaBienThe(mauSacId, sizeId);
                const d = state.dong[khoa] ?? { tao: true, giaVon: "", giaBan: "" };
                return { khoa, loai: "moi", sizeId, tao: d.tao, giaVon: d.giaVon, giaBan: d.giaBan };
            });
        const dong = [...dongCu, ...dongMoi].sort((a, b) => viTri(a.sizeId) - viTri(b.sizeId) || a.khoa.localeCompare(b.khoa));
        return { mauSacId, dong };
    });
}

/** Số liệu cho dòng tóm tắt và kiểm tra trước khi lưu. */
export function thongKeSua(nhom, state) {
    let soCu = 0;
    let soTao = 0;
    let soBoQua = 0;
    let soGiaBanThapHon = 0;
    let soGiaTrong = 0;
    const mauThieuAnh = [];
    for (const { mauSacId, dong } of nhom) {
        const dongCu = dong.filter((d) => d.loai === "cu");
        const dongTao = dong.filter((d) => d.loai === "moi" && d.tao);
        soCu += dongCu.length;
        soTao += dongTao.length;
        soBoQua += dong.length - dongCu.length - dongTao.length;
        soGiaTrong += dongCu.filter((d) => d.giaVon === "" || d.giaBan === "").length;
        soGiaBanThapHon += [...dongCu.filter((d) => d.trangThai === 1), ...dongTao].filter(
            (d) => d.giaVon !== "" && d.giaBan !== "" && d.giaBan < d.giaVon,
        ).length;
        if (dongTao.length > 0 && !state.anhMau[mauSacId] && !state.anhMauCu[mauSacId]) mauThieuAnh.push(mauSacId);
    }
    const soMauCoBienThe = nhom.filter((n) => n.dong.some((d) => d.loai === "cu" || d.tao)).length;
    return {
        soCu,
        soTao,
        soBoQua,
        soToHop: soCu + soTao + soBoQua,
        soSauLuu: soCu + soTao,
        soGiaBanThapHon,
        soGiaTrong,
        mauThieuAnh,
        soMauCoBienThe,
    };
}

/** Có thay đổi gì ở phần biến thể không (để chọn đường lưu và hỏi trước khi bỏ). */
export function coThayDoiBienThe(state, thongKe) {
    if (thongKe.soTao > 0) return true;
    if (Object.keys(state.anhMau).some((mauSacId) => state.mauDaChon.includes(Number(mauSacId)))) return true;
    return dsCu(state).some(
        (b) =>
            b.giaVon !== b.goc.giaVon ||
            b.giaBan !== b.goc.giaBan ||
            b.trangThai !== b.goc.trangThai ||
            b.mauSacId !== b.goc.mauSacId ||
            b.sizeId !== b.goc.sizeId,
    );
}

/**
 * Dữ liệu biến thể gửi PUT /update: mọi biến thể đã lưu (kèm thay đổi) + biến thể mới được tick.
 * Màu có ảnh mới: mọi biến thể của màu đó trỏ cùng một tệp qua viTriAnh (đổi ảnh cho cả màu).
 * Biến thể mới của màu đã có ảnh thì không gửi ảnh, backend tự dùng lại ảnh của màu.
 */
export function taoDuLieuGuiSua(state, nhom, chatLieuMoiId) {
    const anhBienThes = [];
    const viTriAnhCuaMau = (mauSacId) => {
        const tep = state.anhMau[mauSacId]?.file;
        if (!tep) return null;
        let viTri = anhBienThes.indexOf(tep);
        if (viTri === -1) {
            viTri = anhBienThes.length;
            anhBienThes.push(tep);
        }
        return viTri;
    };
    const so = (giaTri) => (giaTri === "" ? 0 : giaTri);
    const bienTheSanPhams = dsCu(state).map((b) => ({
        id: b.id,
        mauSacId: b.mauSacId,
        sizeId: b.sizeId,
        giaVon: so(b.giaVon),
        giaBan: so(b.giaBan),
        trangThai: b.trangThai,
        viTriAnh: viTriAnhCuaMau(b.mauSacId),
    }));
    for (const { mauSacId, dong } of nhom) {
        for (const d of dong) {
            if (d.loai !== "moi" || !d.tao) continue;
            bienTheSanPhams.push({
                id: null,
                mauSacId,
                sizeId: d.sizeId,
                chatLieuId: chatLieuMoiId != null ? Number(chatLieuMoiId) : null,
                giaVon: so(d.giaVon),
                giaBan: so(d.giaBan),
                trangThai: 1,
                viTriAnh: viTriAnhCuaMau(mauSacId),
            });
        }
    }
    return { bienTheSanPhams, anhBienThes };
}
