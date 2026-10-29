/*
 * Logic thuần của các màn chuyển kho nội bộ theo đặc tả BA (danh sách B.6, chi tiết B.1, xác nhận xuất B.3, nhận hàng
 * B.4): định dạng giờ, tiến trình 5 bước, kiểm tra các hộp nhập. Không gọi API, không phụ thuộc React, chạy được bằng
 * `node --test` (src/components/chuyen-kho/hienThiChuyenKho.test.js).
 */
import {
    HINH_THUC_VAN_CHUYEN,
    KY_HIEU_XKNB_RE,
    SDT_RE,
    SO_XKNB_RE,
    TT_CHUYEN,
    XKNB_CHE_DO,
} from "../../constants/phieuChuyenKho.js";
import { kiemTraBienSo } from "./bienSoXe.js";

const p2 = (n) => String(n).padStart(2, "0");
const thanhNgay = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** "14:30 · 23/10" (giờ máy người dùng); trống hoặc sai thì "—". */
export function gioNgayNgan(v) {
    const d = thanhNgay(v);
    if (!d) return "—";
    return `${p2(d.getHours())}:${p2(d.getMinutes())} · ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
}

/** "23/10/2026 14:30"; trống hoặc sai thì "—". */
export function ngayGioDu(v) {
    const d = thanhNgay(v);
    if (!d) return "—";
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "trễ 3 giờ", từ 48 giờ: "trễ 2 ngày"; dưới 1 giờ: "trễ". */
export function treBaoLau(v, bayGio = Date.now()) {
    const d = thanhNgay(v);
    if (!d) return "trễ";
    const gio = Math.floor((bayGio - d.getTime()) / 3600000);
    if (gio >= 48) return `trễ ${Math.floor(gio / 24)} ngày`;
    return gio >= 1 ? `trễ ${gio} giờ` : "trễ";
}

/** Giá trị ô datetime-local ("2026-10-23T14:30") của một mốc; trống thì "". */
export function giaTriONgayGio(v) {
    const d = thanhNgay(v);
    if (!d) return "";
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Ô datetime-local → chuỗi ISO gửi máy chủ (Instant); trống → null; sai → undefined. */
export function tuONgayGio(chuoi) {
    if (!chuoi) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(chuoi);
    if (!m) return undefined;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export const docSoLuong = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Tổng một cột của các dòng hàng. */
export const tongCot = (ds, khoa) => (Array.isArray(ds) ? ds : []).reduce((s, d) => s + docSoLuong(d?.[khoa]), 0);

/** "090****123": che giữa số điện thoại / mã tra cứu ở cột thông tin. */
export function cheGiua(chuoi, dau = 3, cuoi = 3) {
    const s = String(chuoi ?? "");
    if (s.length < dau + cuoi + 2) return s;
    return `${s.slice(0, dau)}****${s.slice(-cuoi)}`;
}

/** Dấu BOM để Excel mở CSV đúng tiếng Việt. */
const DAU_BOM = String.fromCharCode(0xfeff);

const oCsv = (v) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Tệp "dữ liệu chuyến hàng" (CSV, Excel mở được) ở hộp Xác nhận xuất: để nạp vào phần mềm hóa đơn điện tử khi lập phiếu
 * XKNB. Gồm lệnh điều động, kho đi / đến (địa chỉ), người chở, phương tiện và danh sách hàng.
 */
export function noiDungDuLieuChuyenHang(ct, form = {}) {
    const hinhThuc = HINH_THUC_VAN_CHUYEN.find((h) => h.ma === form.hinhThuc)?.nhan ?? "";
    const dong = [
        ["Phiếu chuyển", ct.soPhieuChuyen],
        ["Lệnh điều động", ct.soLenhDieuDong ?? ""],
        ["Ngày lệnh", ct.ngayLenhDieuDong ? ngayGioDu(ct.ngayLenhDieuDong) : ""],
        ["Xuất tại kho", ct.khoXuat?.ten ?? "", ct.khoXuat?.diaChi ?? ""],
        ["Nhập tại kho", ct.khoNhap?.ten ?? "", ct.khoNhap?.diaChi ?? ""],
        ["Người vận chuyển", chuoi(form.nguoi)],
        ["Hình thức vận chuyển", hinhThuc],
        ["Phương tiện", [chuoi(form.loaiPhuongTien), chuoi(form.bienSo)].filter(Boolean).join(" · ") || chuoi(form.donVi)],
        [],
        ["STT", "Mã hàng (SKU)", "Tên hàng", "Màu", "Kích cỡ", "Đơn vị tính", "Số lượng"],
        ...(ct.hang ?? []).map((d, i) => [i + 1, d.sku, d.tenSanPham, d.tenMau ?? "", d.kichCo ?? "", d.donViTinh ?? "", docSoLuong(d.soLuongChuyen)]),
    ];
    return `${DAU_BOM}${dong.map((r) => r.map(oCsv).join(",")).join("\r\n")}\r\n`;
}

/** Phiếu xuất PX-CK đã xuất (trạng thái 3 của phiếu xuất). */
export const phieuXuatDaXuat = (ct) => String(ct?.phieuXuat?.trangThai ?? "") === "3";

/**
 * Ai được xử lý chênh lệch của phiếu, VD "Quản trị viên hoặc Quản lý Kho tổng": máy chủ tính theo Cấu hình › Chuyển kho
 * (PhieuChuyenKhoService.moTaNguoiXuLyChenhLech); máy chủ bản cũ chưa gửi thì dùng câu của cấu hình mặc định.
 */
export const aiXuLyChenhLech = (ct) => String(ct?.aiXuLyChenhLech ?? "").trim() || "Quản trị viên hoặc Quản lý Kho tổng";

/** Tên trạng thái phiếu nhặt (cùng chữ constants/outbound.js PICK_LIST_STATUS). */
const TEN_PHIEU_NHAT = { cho_nhat: "Chờ nhặt", dang_nhat: "Đang nhặt", da_nhat: "Đã nhặt", da_huy: "Đã hủy" };

/**
 * Bước nhặt hàng của phiếu chuyển Đã duyệt (đặc tả bước 8–9): duyệt thì PX-CK vào danh sách chờ nhặt, thủ kho nhặt theo
 * phiếu nhặt, hoàn tất nhặt thì lô ghi vào PX-CK và mới được Xác nhận xuất. Phiếu cũ (không có phiếu nhặt, đã chọn lô
 * tay trên PX-CK) giữ đường chọn lô tay. Trả:
 * - `phieuNhat`: { id, so, trangThai, nguoi } hoặc null; `tenTrangThai`: "Chờ nhặt"…;
 * - `chonLoTay`: phiếu cũ đã chọn lô tay (nút mở phiếu xuất, không mở phiếu nhặt);
 * - `nhanNut`: "Mở phiếu nhặt" / "Xem phiếu nhặt" / "Chọn lô" / "Xem phiếu xuất";
 * - `duocXuat`: được bấm Xác nhận xuất (máy chủ báo `daNhatXong`; máy chủ cũ thì đủ số đã nhặt), `lyDoKhoaXuat`;
 * - `tienDo`: chữ phụ của bước Xuất kho ở tiến trình.
 */
export function tinhNhatChuyenKho(ct) {
    const tong = tongCot(ct?.hang, "soLuongChuyen");
    const daNhat = tongCot(ct?.hang, "daNhat");
    const pn = ct?.phieuNhat && ct.phieuNhat.trangThai !== "da_huy" ? ct.phieuNhat : null;
    const chonLoTay = !pn && Boolean(ct?.chonLoTay);
    const duocXuat = typeof ct?.daNhatXong === "boolean" ? ct.daNhatXong : tong > 0 && daNhat >= tong;
    const tenTrangThai = pn ? TEN_PHIEU_NHAT[pn.trangThai] ?? pn.trangThai : null;
    const so = (n) => n.toLocaleString("vi-VN");

    let nhanNut = "Mở phiếu nhặt";
    if (pn?.trangThai === "da_nhat") nhanNut = "Xem phiếu nhặt";
    else if (chonLoTay) nhanNut = duocXuat ? "Xem phiếu xuất" : "Chọn lô";

    let lyDoKhoaXuat;
    if (!duocXuat) {
        if (pn) lyDoKhoaXuat = `Hoàn tất phiếu nhặt ${pn.so} trước khi xác nhận xuất`;
        else if (chonLoTay) lyDoKhoaXuat = `Chọn đủ lô cho ${so(tong)} sản phẩm trước khi xác nhận xuất`;
        else lyDoKhoaXuat = "Mở phiếu nhặt, nhặt đủ hàng trước khi xác nhận xuất";
    }

    let tienDo = `Đã nhặt ${so(daNhat)}/${so(tong)}`;
    if (pn?.trangThai === "da_nhat") tienDo = "Đã nhặt xong, chờ xác nhận xuất";
    else if (pn?.trangThai === "cho_nhat" && !pn.nguoi) tienDo = `Chờ nhặt · chưa phân công`;
    else if (pn) tienDo = `${tenTrangThai} ${so(daNhat)}/${so(tong)}`;

    return { phieuNhat: pn, tenTrangThai, chonLoTay, nhanNut, duocXuat, lyDoKhoaXuat, tienDo };
}

/**
 * Nhãn loại của phiếu xuất PX-CK ở "Chứng từ liên quan": chưa xuất mà còn phiếu nhặt thì kèm bước nhặt ("· chờ nhặt",
 * "· đang nhặt", "· đã nhặt"); đã xuất, đã hủy, phiếu cũ chọn lô tay: chỉ "Phiếu xuất kho" (thẻ trạng thái nói phần còn lại).
 */
export function nhanPhieuXuatLienQuan(ct) {
    const tt = String(ct?.phieuXuat?.trangThai ?? "");
    // 3: Đã xuất, 4: Đã hủy (constants/phieuXuatKho.js)
    if (tt === "3" || tt === "4") return "Phiếu xuất kho";
    const pn = ct?.phieuNhat && ct.phieuNhat.trangThai !== "da_huy" ? ct.phieuNhat : null;
    const ten = pn ? TEN_PHIEU_NHAT[pn.trangThai] : null;
    return ten ? `Phiếu xuất kho · ${ten.toLowerCase()}` : "Phiếu xuất kho";
}

/**
 * Tiến trình 5 bước của chi tiết phiếu (B.1): Yêu cầu · Lệnh điều động · Xuất kho · Đang vận chuyển · Nhận hàng.
 * Bước đang làm theo đúng bản demo đã duyệt: Chờ duyệt → bước 1, Đã duyệt → bước 2, Đang vận chuyển → bước 4,
 * Chờ xử lý chênh lệch → bước 5 có cảnh báo, Hoàn tất → xong hết; Đã hủy dừng ở bước hủy.
 */
export function buocChuyenKho(ct, bayGio = Date.now()) {
    if (!ct) return [];
    const tt = ct.trangThai;
    const khoXuat = ct.khoXuat?.ten ?? "Kho xuất";
    const khoNhap = ct.khoNhap?.ten ?? "Kho nhận";
    const phieuNhapDich = (ct.phieuNhap ?? []).find((pn) => !pn.laHoanTra && String(pn.trangThai) === "3");
    const ds = [
        { ma: "yeuCau", nhan: "Yêu cầu", ai: khoNhap, ngay: ct.ngayTao, coGio: true },
        {
            ma: "lenh",
            nhan: "Lệnh điều động",
            ai: "Quản lý Kho tổng",
            ngay: ct.ngayLenhDieuDong ?? null,
            coGio: true,
            phu: ct.soLenhDieuDong ? undefined : tt === TT_CHUYEN.DA_HUY ? undefined : "Chờ duyệt",
        },
        {
            ma: "xuat",
            nhan: "Xuất kho",
            ai: khoXuat,
            ngay: phieuXuatDaXuat(ct) ? ct.phieuXuat?.ngay : null,
            coGio: true,
            phu: tt === TT_CHUYEN.DA_DUYET ? tinhNhatChuyenKho(ct).tienDo : undefined,
        },
        {
            ma: "vanChuyen",
            nhan: "Đang vận chuyển",
            ai: ct.nguoiVanChuyen || "Người vận chuyển",
            phu: ct.ngayDuKienDen && phieuXuatDaXuat(ct) ? `Dự kiến ${gioNgayNgan(ct.ngayDuKienDen)}` : undefined,
        },
        { ma: "nhan", nhan: "Nhận hàng", ai: khoNhap, ngay: ct.ngayThucTeDen ?? phieuNhapDich?.ngay ?? null, coGio: true },
    ];

    const datTrangThai = (tuBuoc, kieu) => ds.forEach((b, i) => {
        const n = i + 1;
        b.trangThai = n < tuBuoc ? "xong" : n === tuBuoc ? kieu : "chua";
    });

    if (tt === TT_CHUYEN.DA_HUY) {
        const den = ct.huyKhiDangChuyen ? 4 : ct.soLenhDieuDong ? 3 : 2;
        datTrangThai(den, "dung");
        ds[den - 1].canhBao = ct.huyKhiDangChuyen
            ? (ct.daNhapHoanTra ? "Đã hủy · đã nhập hoàn trả" : "Đã hủy · chờ nhập hoàn trả")
            : "Đã hủy";
    } else if (tt === TT_CHUYEN.CHO_DUYET) {
        datTrangThai(1, "dangLam");
    } else if (tt === TT_CHUYEN.DA_DUYET) {
        datTrangThai(2, "dangLam");
    } else if (tt === TT_CHUYEN.DANG_VAN_CHUYEN) {
        datTrangThai(4, "dangLam");
    } else if (tt === TT_CHUYEN.CHO_XU_LY_LECH) {
        datTrangThai(5, "dangLam");
        ds[4].canhBao = "Có chênh lệch";
    } else {
        datTrangThai(6, "dangLam");
        if (ct.bienBan) ds[4].canhBao = "Có chênh lệch · đã xử lý";
    }
    if (ct.tre && tt === TT_CHUYEN.DANG_VAN_CHUYEN && ct.ngayDuKienDen) ds[3].canhBao = treBaoLau(ct.ngayDuKienDen, bayGio);
    return ds;
}

const chuoi = (v) => String(v ?? "").trim();

/**
 * Kiểm tra hộp Xác nhận xuất (B.3), cùng quy tắc máy chủ (PhieuChuyenKhoService.xacNhanXuat).
 * `form`: { hinhThuc, nguoi, sdt, loaiPhuongTien, bienSo, donVi, maVanDon, duKienDen (ô datetime-local), kyHieu, soXknb,
 * ngayLap, maTraCuu }. `cheDo`: CHAN | CHI_CANH_BAO. `daDongYThieu`: người dùng đã bấm "Vẫn xuất khi chưa có số".
 * Trả về { loi: { ô: câu }, chan: câu | null, canhBaoThieu: boolean, thieu: boolean, yeuCau: body gửi máy chủ | null }.
 */
export function kiemTraXacNhanXuat(form, cheDo, daDongYThieu = false) {
    const f = form ?? {};
    const loi = {};
    const hinhThuc = HINH_THUC_VAN_CHUYEN.some((h) => h.ma === f.hinhThuc) ? f.hinhThuc : "";
    if (!hinhThuc) loi.hinhThuc = "Chọn hình thức vận chuyển";
    const canPhuongTien = hinhThuc === "XE_CONG_TY" || hinhThuc === "THUE_NGOAI";
    const canDonVi = hinhThuc === "THUE_NGOAI" || hinhThuc === "CHUYEN_PHAT";
    const sdt = chuoi(f.sdt).replace(/\s/g, "");
    if (!chuoi(f.nguoi)) loi.nguoi = "Nhập tên người vận chuyển";
    if (!SDT_RE.test(sdt)) loi.sdt = "Số điện thoại gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09";
    if (canPhuongTien && !chuoi(f.loaiPhuongTien)) loi.loaiPhuongTien = "Nhập loại phương tiện";
    // Biển số theo mẫu biển Việt Nam (bienSoXe.js), gửi cách viết chuẩn
    const bienSo = canPhuongTien ? kiemTraBienSo(f.bienSo) : null;
    if (bienSo && !bienSo.hopLe) loi.bienSo = bienSo.loi;
    if (canDonVi && !chuoi(f.donVi)) loi.donVi = "Nhập tên đơn vị";
    if (hinhThuc === "CHUYEN_PHAT" && !chuoi(f.maVanDon)) loi.maVanDon = "Nhập mã vận đơn";
    const duKienDen = tuONgayGio(f.duKienDen);
    if (duKienDen === undefined) loi.duKienDen = "Thời gian không hợp lệ";

    const kyHieu = chuoi(f.kyHieu).toUpperCase();
    const so = chuoi(f.soXknb);
    if (kyHieu && !KY_HIEU_XKNB_RE.test(kyHieu)) loi.kyHieu = "Ký hiệu gồm 7 ký tự, ví dụ 6K26NAB";
    if (so && !SO_XKNB_RE.test(so)) loi.soXknb = "Số phiếu gồm 7 chữ số, ví dụ 0000125";
    const thieu = !kyHieu || !so;
    let chan = null;
    let canhBaoThieu = false;
    if (thieu) {
        if (cheDo !== XKNB_CHE_DO.CHI_CANH_BAO) {
            chan = "Cần ký hiệu và số của giấy đi đường (phiếu XKNB) trước khi hàng rời kho";
            if (!kyHieu) loi.kyHieu = loi.kyHieu ?? "Bắt buộc";
            if (!so) loi.soXknb = loi.soXknb ?? "Bắt buộc";
        } else if (!daDongYThieu) {
            canhBaoThieu = true;
        }
    }
    const coLoi = Object.keys(loi).length > 0 || chan != null;
    const yeuCau = coLoi || canhBaoThieu ? null : {
        hinhThucVanChuyen: hinhThuc,
        nguoiVanChuyen: chuoi(f.nguoi),
        soDienThoaiVanChuyen: sdt,
        loaiPhuongTien: canPhuongTien ? chuoi(f.loaiPhuongTien) : null,
        bienSoXe: bienSo ? bienSo.giaTri : null,
        donViVanChuyen: canDonVi ? chuoi(f.donVi) : null,
        // Ô mã vận đơn / số hợp đồng chỉ hiện khi thuê ngoài, chuyển phát: đổi sang xe công ty thì không gửi số cũ
        maVanDonHopDong: canDonVi ? chuoi(f.maVanDon) || null : null,
        ngayDuKienDen: duKienDen ?? null,
        kyHieuXknb: thieu ? null : kyHieu,
        soPhieuXknb: thieu ? null : so,
        ngayLapXknb: thieu ? null : (chuoi(f.ngayLap) || null),
        maTraCuuXknb: thieu ? null : (chuoi(f.maTraCuu) || null),
        vanXuatKhiChuaCoSo: thieu ? true : null,
    };
    return { loi, chan, canhBaoThieu, thieu, yeuCau };
}

/** Kiểm tra hộp Ghi số XKNB: { loi, yeuCau }. */
export function kiemTraGhiSoXknb(form) {
    const f = form ?? {};
    const loi = {};
    const kyHieu = chuoi(f.kyHieu).toUpperCase();
    const so = chuoi(f.soXknb);
    if (!KY_HIEU_XKNB_RE.test(kyHieu)) loi.kyHieu = "Ký hiệu gồm 7 ký tự, ví dụ 6K26NAB";
    if (!SO_XKNB_RE.test(so)) loi.soXknb = "Số phiếu gồm 7 chữ số, ví dụ 0000125";
    if (Object.keys(loi).length) return { loi, yeuCau: null };
    return {
        loi,
        yeuCau: { kyHieuXknb: kyHieu, soPhieuXknb: so, ngayLapXknb: chuoi(f.ngayLap) || null, maTraCuuXknb: chuoi(f.maTraCuu) || null },
    };
}

/** Ô số đếm: chỉ chữ số, rỗng → 0. */
export function chuanSoDem(v) {
    const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Bảng đếm nhận hàng (B.4) theo lô. `lo`: hangTheoLo của chi tiết; `dem`: { [khoaLo]: { dat, hong, lyDo } }.
 * Mỗi dòng: gui, dat, hong, thieu = gui − dat − hong, vuot (dat + hong > gui), lech (thieu ≠ 0 hoặc có hỏng), thieuLyDo.
 * `khop`: mọi dòng đúng số gửi, không hỏng → được "Xác nhận nhận đủ"; ngược lại (không vượt) → lập biên bản.
 */
export const khoaLo = (d) => `${d.bienTheId}-${d.loHangId}`;

export function tinhNhanHang(lo, dem) {
    const dong = (Array.isArray(lo) ? lo : []).map((d) => {
        const r = dem?.[khoaLo(d)] ?? { dat: 0, hong: 0, lyDo: "" };
        const gui = docSoLuong(d.soLuong);
        const dat = docSoLuong(r.dat);
        const hong = docSoLuong(r.hong);
        const thieu = gui - dat - hong;
        const vuot = dat + hong > gui;
        const lech = thieu !== 0 || hong > 0;
        return { ...d, khoa: khoaLo(d), gui, dat, hong, thieu, vuot, lech, lyDo: r.lyDo ?? "", thieuLyDo: lech && !chuoi(r.lyDo) };
    });
    const tong = {
        gui: dong.reduce((s, d) => s + d.gui, 0),
        dat: dong.reduce((s, d) => s + d.dat, 0),
        hong: dong.reduce((s, d) => s + d.hong, 0),
        thieu: dong.reduce((s, d) => s + Math.max(0, d.thieu), 0),
    };
    const vuot = dong.some((d) => d.vuot);
    const soDongLech = dong.filter((d) => d.lech).length;
    return { dong, tong, vuot, soDongLech, khop: dong.length > 0 && !vuot && soDongLech === 0 };
}

/** Thân yêu cầu nhận lệch gửi máy chủ từ kết quả tinhNhanHang. */
export function yeuCauNhanLech(kq, { nguoiVanChuyen, thoiDiem, ketLuan }) {
    return {
        dong: kq.dong.map((d) => ({
            bienTheSanPhamId: d.bienTheId,
            loHangId: d.loHangId,
            soLuongDat: d.dat,
            soLuongHong: d.hong,
            lyDo: d.lech ? chuoi(d.lyDo) : null,
        })),
        nguoiVanChuyen: chuoi(nguoiVanChuyen),
        thoiDiem: tuONgayGio(thoiDiem) ?? null,
        ketLuan: chuoi(ketLuan) || null,
    };
}

/** Quét mã vạch / SKU khi nhận: cộng 1 vào cột Đạt của lô đầu tiên còn thiếu của biến thể khớp. */
export function quetMotMa(lo, dem, ma) {
    const m = chuoi(ma).toLowerCase();
    if (!m) return { dem, khop: null };
    const cung = (Array.isArray(lo) ? lo : []).filter((d) => chuoi(d.maVach).toLowerCase() === m || chuoi(d.sku).toLowerCase() === m);
    if (!cung.length) return { dem, khop: null };
    const conThieu = cung.find((d) => {
        const r = dem?.[khoaLo(d)] ?? { dat: 0, hong: 0 };
        return docSoLuong(r.dat) + docSoLuong(r.hong) < docSoLuong(d.soLuong);
    });
    const dich = conThieu ?? cung[0];
    const k = khoaLo(dich);
    const cu = dem?.[k] ?? { dat: 0, hong: 0, lyDo: "" };
    return { dem: { ...dem, [k]: { ...cu, dat: docSoLuong(cu.dat) + 1 } }, khop: dich, vuot: !conThieu };
}
