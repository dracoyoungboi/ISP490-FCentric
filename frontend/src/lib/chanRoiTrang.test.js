import { test } from "node:test";
import assert from "node:assert/strict";
import { UNSAFE_createBrowserHistory as createBrowserHistory } from "react-router-dom";
import { chanQuayLaiTrinhDuyet, datChanRoiTrang, xinRoiTrang } from "./chanRoiTrang.js";

test("không có trang chặn: rời ngay", () => {
    let roi = 0;
    xinRoiTrang(() => (roi += 1));
    assert.equal(roi, 1);
});

test("có trang chặn: trang nhận hàm tiếp tục, chỉ rời khi trang gọi; hủy đăng ký thì thôi chặn", () => {
    let roi = 0;
    let dangHoi = null;
    const huy = datChanRoiTrang((tiepTuc) => {
        dangHoi = tiepTuc;
    });
    xinRoiTrang(() => (roi += 1));
    assert.equal(roi, 0);
    dangHoi();
    assert.equal(roi, 1);
    huy();
    xinRoiTrang(() => (roi += 1));
    assert.equal(roi, 2);
});

test("hủy đăng ký của trang cũ không gỡ lớp chặn của trang mới", () => {
    let hoiTrangMoi = 0;
    const huyCu = datChanRoiTrang(() => {});
    const huyMoi = datChanRoiTrang(() => (hoiTrangMoi += 1));
    huyCu();
    xinRoiTrang(() => assert.fail("không được rời khi trang mới đang chặn"));
    assert.equal(hoiTrangMoi, 1);
    huyMoi();
});

// ── Back / Forward của trình duyệt ──

class SuKienGia {
    constructor(type) {
        this.type = type;
        this.dung = false;
    }
    stopImmediatePropagation() {
        this.dung = true;
    }
}

/** EventTarget giả; `batTruoc` = trình nghe pha bắt chạy trước trình nghe thường ở đích (chuẩn DOM hiện hành). */
function taoLopDich(batTruoc) {
    const laBat = (tuyChon) => (typeof tuyChon === "object" ? Boolean(tuyChon?.capture) : Boolean(tuyChon));
    return class DichGia {
        #ds = [];
        addEventListener(loai, ham, tuyChon) {
            const bat = laBat(tuyChon);
            if (this.#ds.some((l) => l.loai === loai && l.ham === ham && l.bat === bat)) return;
            this.#ds.push({ loai, ham, bat });
        }
        removeEventListener(loai, ham, tuyChon) {
            const bat = laBat(tuyChon);
            this.#ds = this.#ds.filter((l) => !(l.loai === loai && l.ham === ham && l.bat === bat));
        }
        dispatchEvent(suKien) {
            const cung = this.#ds.filter((l) => l.loai === suKien.type);
            const thuTu = batTruoc ? [...cung.filter((l) => l.bat), ...cung.filter((l) => !l.bat)] : cung;
            for (const l of thuTu) {
                if (suKien.dung) break;
                if (this.#ds.includes(l)) l.ham.call(this, suKien);
            }
            return true;
        }
    };
}

/**
 * Cửa sổ giả: ngăn xếp mục lịch sử {state, url}; history.go (của mã) và nút Back/Forward (của người dùng)
 * đều chuyển mục ở lượt sau rồi phát popstate như trình duyệt. Kèm lịch sử của React Router nghe như
 * BrowserRouter (đăng ký trước, pha thường).
 * `hangDoi`: mọi lần chuyển (nút của người dùng lẫn history.go của mã) vào MỘT hàng đợi như trình duyệt, chỉ
 * chạy khi test gọi chayMotBuoc / chayHet — lần bấm thứ hai chen được vào trước lệnh bù. Bước tính theo vị
 * trí lúc lần chuyển tới lượt chạy (chuẩn HTML), hoặc `giaiLucGoi` thì theo đích của lần đang chờ cuối hàng
 * lúc gọi (kiểu Chrome). `boQuaGo`: trình duyệt bỏ qua history.go của mã.
 * Hẹn giờ của cửa sổ giả chỉ chạy khi test gọi chayHenGio.
 * `mucDau`: các mục lịch sử có sẵn của tài liệu trước khi React Router khởi tạo (đang đứng ở mục cuối) — mặc
 * định một mục state null như mở thẳng bằng URL / thẻ mới.
 */
function taoUngDung({
    batTruoc = true,
    hangDoi = false,
    giaiLucGoi = false,
    boQuaGo = false,
    mucDau = [{ state: null, duongDan: "/settings/print-templates" }],
} = {}) {
    const LopDich = taoLopDich(batTruoc);
    const muc = mucDau.map(({ state, duongDan }) => ({ state, url: new URL(duongDan, "http://fcentric.test") }));
    let viTri = muc.length - 1;
    const cuaSo = new LopDich();
    const thongKe = { soLanGo: 0 };
    const chuyenToi = (dich) => {
        viTri = dich;
        const suKien = new SuKienGia("popstate");
        suKien.state = muc[viTri].state;
        cuaSo.dispatchEvent(suKien);
    };
    const diChuyen = (buoc) =>
        queueMicrotask(() => {
            const dich = viTri + buoc;
            if (buoc === 0 || dich < 0 || dich >= muc.length) return;
            chuyenToi(dich);
        });
    const hangCho = [];
    const xepHang = (buoc) => {
        if (!giaiLucGoi) {
            hangCho.push({ buoc });
            return;
        }
        const tu = hangCho.length > 0 ? hangCho[hangCho.length - 1].dich : viTri;
        const dich = tu + buoc;
        if (buoc !== 0 && dich >= 0 && dich < muc.length) hangCho.push({ dich });
    };
    const chuyen = hangDoi ? xepHang : diChuyen;
    const chayMotBuoc = () => {
        const lenh = hangCho.shift();
        if (!lenh) return false;
        const dich = lenh.dich ?? viTri + lenh.buoc;
        if (dich !== viTri && dich >= 0 && dich < muc.length) chuyenToi(dich);
        return true;
    };
    const henGio = new Map();
    let soHen = 0;
    cuaSo.setTimeout = (ham) => {
        soHen += 1;
        henGio.set(soHen, ham);
        return soHen;
    };
    cuaSo.clearTimeout = (ma) => henGio.delete(ma);
    cuaSo.EventTarget = LopDich;
    cuaSo.Event = SuKienGia;
    cuaSo.history = {
        get state() {
            return muc[viTri].state;
        },
        pushState(state, _, url) {
            muc.splice(viTri + 1);
            muc.push({ state, url: new URL(url, muc[viTri].url) });
            viTri += 1;
        },
        replaceState(state, _, url) {
            muc[viTri] = { state, url: url == null ? muc[viTri].url : new URL(url, muc[viTri].url) };
        },
        go(buoc) {
            thongKe.soLanGo += 1;
            if (!boQuaGo) chuyen(buoc);
        },
    };
    Object.defineProperty(cuaSo, "location", { get: () => muc[viTri].url });
    const router = createBrowserHistory({ window: cuaSo, v5Compat: true });
    // Trang router đang hiển thị (như state location của BrowserRouter) — chỉ đổi khi router nhận lần chuyển
    const trangRouter = { duongDan: router.location.pathname, khoa: router.location.key };
    router.listen(({ location }) => {
        trangRouter.duongDan = location.pathname + location.hash;
        trangRouter.khoa = location.key;
    });
    return {
        cuaSo,
        router,
        thongKe,
        bamNut: chuyen,
        chayMotBuoc,
        /** Chạy hết hàng đợi lịch sử (tối đa `toiDa` lần chuyển — chạm trần nghĩa là lịch sử lặp không dừng). */
        chayHet(toiDa = 50) {
            let soBuoc = 0;
            while (soBuoc < toiDa && chayMotBuoc()) soBuoc += 1;
            return soBuoc;
        },
        chayHenGio() {
            for (const [ma, ham] of [...henGio]) {
                henGio.delete(ma);
                ham();
            }
        },
        get soHenGio() {
            return henGio.size;
        },
        get trangRouter() {
            return trangRouter.duongDan;
        },
        get khoaRouter() {
            return trangRouter.khoa;
        },
        get urlTrinhDuyet() {
            return cuaSo.location.pathname + cuaSo.location.hash;
        },
    };
}

const choLichSu = () => new Promise((xong) => setTimeout(xong, 0));
const DANH_SACH = "/settings/print-templates";
const PHIEU_NHAP = "/settings/print-templates/phieu-nhap";
const PHIEU_XUAT = "/settings/print-templates/phieu-xuat";
const TONG_QUAN = "/dashboard";
const NEO = "#backoffice-main-content";

test("Back khi đang chặn: router không chuyển trang, trình duyệt về lại trang đang sửa, hỏi một lần; Ở lại thì đứng yên", async () => {
    const app = taoUngDung();
    app.router.push(PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo);
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(hoi.length, 1);
    assert.equal(app.thongKe.soLanGo, 1);
    // Không gọi tiepTuc (Ở lại): không có vòng lặp lịch sử
    await choLichSu();
    await choLichSu();
    assert.equal(hoi.length, 1);
    assert.equal(app.thongKe.soLanGo, 1);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    huy();
});

test("Rời trang: tới đúng đích đã bấm, router chuyển trang — kể cả khi lớp chặn đã gỡ trước lúc popstate tới", async () => {
    for (const goTruoc of [false, true]) {
        const app = taoUngDung();
        app.router.push(PHIEU_NHAP);
        const hoi = [];
        const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo);
        app.bamNut(-1);
        await choLichSu();
        hoi[0]();
        if (goTruoc) huy();
        await choLichSu();
        assert.equal(app.trangRouter, DANH_SACH, `gỡ trước: ${goTruoc}`);
        assert.equal(app.urlTrinhDuyet, DANH_SACH);
        assert.equal(hoi.length, 1);
        huy();
    }
});

test("Forward nhảy nhiều bước cũng bị chặn; Rời thì tới đúng mục đã chọn", async () => {
    const app = taoUngDung();
    app.router.push(PHIEU_NHAP);
    app.router.push("/dashboard");
    app.router.push(PHIEU_XUAT);
    app.bamNut(-2);
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo);
    app.bamNut(2);
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(hoi.length, 1);
    hoi[0]();
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_XUAT);
    assert.equal(app.urlTrinhDuyet, PHIEU_XUAT);
    huy();
});

test("Bấm Back lần nữa khi đang hỏi: hỏi lại, vẫn đứng ở trang; Rời theo lần hỏi sau", async () => {
    const app = taoUngDung();
    app.router.push(PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo);
    app.bamNut(-1);
    await choLichSu();
    app.bamNut(-1);
    await choLichSu();
    assert.equal(hoi.length, 2);
    assert.equal(app.thongKe.soLanGo, 2);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    hoi[1]();
    huy();
    await choLichSu();
    assert.equal(app.trangRouter, DANH_SACH);
});

test("Đã gỡ lớp chặn (hết thay đổi chưa lưu): Back như thường, không hỏi", async () => {
    const app = taoUngDung();
    app.router.push(PHIEU_NHAP);
    let hoi = 0;
    const huy = chanQuayLaiTrinhDuyet(() => (hoi += 1), app.cuaSo);
    huy();
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.trangRouter, DANH_SACH);
    assert.equal(hoi, 0);
    assert.equal(app.thongKe.soLanGo, 0);
});

test("Trình duyệt chưa gọi pha bắt trước ở đích: không chặn, Back như cũ", async () => {
    const app = taoUngDung({ batTruoc: false });
    app.router.push(PHIEU_NHAP);
    let hoi = 0;
    const huy = chanQuayLaiTrinhDuyet(() => (hoi += 1), app.cuaSo);
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.trangRouter, DANH_SACH);
    assert.equal(app.urlTrinhDuyet, DANH_SACH);
    assert.equal(hoi, 0);
    assert.equal(app.thongKe.soLanGo, 0);
    huy();
});

test("Mục lịch sử không có idx (link #neo, state null): không chặn", async () => {
    // Mục đích không có idx
    const app = taoUngDung();
    app.cuaSo.history.pushState(null, "", `${DANH_SACH}${NEO}`);
    app.router.push(PHIEU_NHAP);
    let hoi = 0;
    const huy = chanQuayLaiTrinhDuyet(() => (hoi += 1), app.cuaSo);
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.trangRouter, `${DANH_SACH}${NEO}`);
    assert.equal(hoi, 0);
    huy();

    // Mục hiện tại không có idx
    const app2 = taoUngDung();
    app2.router.push(PHIEU_NHAP);
    app2.cuaSo.history.pushState(null, "", `${PHIEU_NHAP}${NEO}`);
    let hoi2 = 0;
    const huy2 = chanQuayLaiTrinhDuyet(() => (hoi2 += 1), app2.cuaSo);
    app2.bamNut(-2);
    await choLichSu();
    assert.equal(app2.trangRouter, DANH_SACH);
    assert.equal(hoi2, 0);
    huy2();
});

// ── Lịch sử bất thường: luôn quay về hành vi cũ, URL không lệch giao diện, không lặp ──

test("Back đúp / giữ Alt+← chen vào trước lệnh bù: thôi chặn, router theo URL, không gọi thêm history.go, không lặp", () => {
    for (const giaiLucGoi of [false, true]) {
        for (const soLanBam of [2, 5]) {
            const nhan = `bước tính lúc gọi: ${giaiLucGoi}, bấm ${soLanBam} lần`;
            const app = taoUngDung({ hangDoi: true, giaiLucGoi });
            app.router.push(PHIEU_NHAP);
            app.router.push(TONG_QUAN);
            app.router.push(PHIEU_XUAT);
            const hoi = [];
            const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
            for (let lan = 0; lan < soLanBam; lan += 1) app.bamNut(-1);
            const soBuoc = app.chayHet();
            assert.ok(soBuoc <= soLanBam + 1, `${nhan}: ${soBuoc} lần chuyển`);
            assert.equal(app.trangRouter, app.urlTrinhDuyet, nhan);
            assert.notEqual(app.urlTrinhDuyet, PHIEU_XUAT, nhan);
            assert.equal(app.thongKe.soLanGo, 1, nhan);
            assert.equal(hoi.length, 0, nhan);
            assert.equal(app.soHenGio, 0, nhan);
            // Đứng yên: không còn lần chuyển nào; Back tiếp do router xử lý
            assert.equal(app.chayHet(), 0, nhan);
            app.bamNut(-1);
            app.chayHet();
            assert.equal(app.trangRouter, app.urlTrinhDuyet, nhan);
            assert.equal(app.thongKe.soLanGo, 1, nhan);
            huy();
        }
    }
});

test("Back rồi Forward thật nhanh: chỉ dừng khi về đúng mục của trang, URL luôn khớp giao diện", () => {
    for (const giaiLucGoi of [false, true]) {
        const nhan = `bước tính lúc gọi: ${giaiLucGoi}`;
        const app = taoUngDung({ hangDoi: true, giaiLucGoi });
        app.router.push(PHIEU_NHAP);
        app.router.push(TONG_QUAN);
        app.router.push(PHIEU_XUAT);
        app.bamNut(-2);
        app.chayHet();
        assert.equal(app.trangRouter, PHIEU_NHAP);
        const hoi = [];
        const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
        app.bamNut(-1);
        app.bamNut(1);
        assert.ok(app.chayHet() < 10, nhan);
        assert.equal(app.urlTrinhDuyet, PHIEU_NHAP, nhan);
        assert.equal(app.trangRouter, PHIEU_NHAP, nhan);
        assert.ok(hoi.length >= 1, nhan);
        assert.equal(app.soHenGio, 0, nhan);
        // Rời theo lần hỏi sau cùng: router chuyển trang, URL khớp
        hoi[hoi.length - 1]();
        app.chayHet();
        assert.notEqual(app.trangRouter, PHIEU_NHAP, nhan);
        assert.equal(app.trangRouter, app.urlTrinhDuyet, nhan);
        huy();
    }
});

test("idx trùng sau mục #neo (khác key): lệnh bù dừng ở mục khác cùng idx thì không coi là đã về trang", () => {
    const app = taoUngDung({ hangDoi: true });
    app.router.push(PHIEU_NHAP); // idx 1
    app.cuaSo.history.pushState(null, "", `${DANH_SACH}${NEO}`); // link #neo: state null
    app.router.push(TONG_QUAN); // React Router: idx = null + 1 = 1 (trùng PHIEU_NHAP)
    app.router.push(PHIEU_XUAT); // idx 2
    app.bamNut(-3);
    app.chayHet();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    // Forward 3 mục (giữ chuột trên nút Forward): bước tính từ idx là 1, lệnh bù go(-1) dừng ở TONG_QUAN
    app.bamNut(3);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, TONG_QUAN);
    assert.equal(app.trangRouter, TONG_QUAN);
    assert.equal(hoi.length, 0);
    assert.equal(app.thongKe.soLanGo, 1);
    assert.equal(app.soHenGio, 0);
    huy();

    // Đang ở TONG_QUAN (idx 1): Back tới PHIEU_NHAP cùng idx 1 -> không tính được số bước, router xử lý như thường
    const hoi2 = [];
    const huy2 = chanQuayLaiTrinhDuyet((tiepTuc) => hoi2.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    app.bamNut(-2);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(hoi2.length, 0);
    assert.equal(app.thongKe.soLanGo, 1);
    huy2();
});

test("dirty bật/tắt giữa lúc đang đưa trình duyệt về lại trang: vẫn về đúng trang, không đọc nhầm mục lịch sử", () => {
    // Cách trang dùng: đăng ký một lần cho mục lịch sử, đọc dirty qua hàm
    const app = taoUngDung({ hangDoi: true });
    app.router.push(PHIEU_NHAP);
    let dirty = true;
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, {
        dangChan: () => dirty,
        khoaTrang: app.khoaRouter,
    });
    app.bamNut(-1);
    app.chayMotBuoc(); // popstate bị chặn, lệnh bù đang trong hàng đợi
    assert.equal(app.urlTrinhDuyet, DANH_SACH);
    assert.equal(app.trangRouter, PHIEU_NHAP);
    dirty = false;
    dirty = true;
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(hoi.length, 1);
    // Tắt hẳn đúng lúc đó: popstate về trang vẫn được nhận là "đã về" (router không thấy lần đi nên URL vẫn khớp)
    app.bamNut(-1);
    app.chayMotBuoc();
    dirty = false;
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.thongKe.soLanGo, 2);
    // Không còn thay đổi chưa lưu: Back như thường, không gọi history.go
    app.bamNut(-1);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, DANH_SACH);
    assert.equal(app.trangRouter, DANH_SACH);
    assert.equal(app.thongKe.soLanGo, 2);
    huy();

    // Cách cũ (đăng ký lại theo dirty): đăng ký lại khi trình duyệt còn ở mục vừa rời -> lớp chặn mới không
    // lấy mục đó làm mục của trang (khác key router đang hiển thị), không chặn; không lặp, URL khớp
    const app2 = taoUngDung({ hangDoi: true });
    app2.router.push(PHIEU_NHAP);
    app2.router.push(PHIEU_XUAT);
    const hoi2 = [];
    let huy2 = chanQuayLaiTrinhDuyet((tiepTuc) => hoi2.push(tiepTuc), app2.cuaSo, { khoaTrang: app2.khoaRouter });
    app2.bamNut(-1);
    app2.chayMotBuoc();
    assert.equal(app2.urlTrinhDuyet, PHIEU_NHAP);
    huy2();
    huy2 = chanQuayLaiTrinhDuyet((tiepTuc) => hoi2.push(tiepTuc), app2.cuaSo, { khoaTrang: app2.khoaRouter });
    assert.ok(app2.chayHet() < 10);
    assert.equal(app2.urlTrinhDuyet, PHIEU_XUAT);
    assert.equal(app2.trangRouter, PHIEU_XUAT);
    assert.equal(app2.thongKe.soLanGo, 1);
    assert.equal(app2.soHenGio, 0);
    app2.bamNut(-1);
    app2.chayHet();
    assert.equal(app2.trangRouter, app2.urlTrinhDuyet);
    assert.equal(app2.thongKe.soLanGo, 1);
    huy2();
});

test("Bấm Back liên tục (mỗi lần đã về lại trang): quá 4 lần trong 2 giây thì thôi chặn, router xử lý như cũ", async () => {
    const app = taoUngDung();
    app.router.push(PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo);
    for (let lan = 0; lan < 4; lan += 1) {
        app.bamNut(-1);
        await choLichSu();
        assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
        assert.equal(app.trangRouter, PHIEU_NHAP);
    }
    assert.equal(hoi.length, 4);
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.urlTrinhDuyet, DANH_SACH);
    assert.equal(app.trangRouter, DANH_SACH);
    assert.equal(hoi.length, 4);
    assert.equal(app.thongKe.soLanGo, 4);
    huy();
});

test("Trình duyệt bỏ qua lệnh bù: hết hạn chờ thì thôi chặn và router đọc lại URL (giao diện khớp URL)", () => {
    const app = taoUngDung({ hangDoi: true, boQuaGo: true });
    app.router.push(PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    app.bamNut(-1);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, DANH_SACH);
    assert.equal(app.soHenGio, 1);
    app.chayHenGio();
    assert.equal(app.trangRouter, DANH_SACH);
    assert.equal(hoi.length, 0);
    app.bamNut(1);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.thongKe.soLanGo, 1);
    huy();
});

test("tiepTuc của lần hỏi cũ, hoặc gọi sau khi hủy đăng ký: không gọi history.go; khoaTrang khác mục hiện tại: không chặn", async () => {
    const app = taoUngDung();
    app.router.push(PHIEU_NHAP);
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    app.bamNut(-1);
    await choLichSu();
    app.bamNut(-1);
    await choLichSu();
    assert.equal(hoi.length, 2);
    assert.equal(app.thongKe.soLanGo, 2);
    hoi[0]();
    await choLichSu();
    assert.equal(app.thongKe.soLanGo, 2);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    huy();
    hoi[1]();
    await choLichSu();
    assert.equal(app.thongKe.soLanGo, 2);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(app.trangRouter, PHIEU_NHAP);

    const app2 = taoUngDung();
    app2.router.push(PHIEU_NHAP);
    let hoi2 = 0;
    const huy2 = chanQuayLaiTrinhDuyet(() => (hoi2 += 1), app2.cuaSo, { khoaTrang: "khac" });
    app2.bamNut(-1);
    await choLichSu();
    assert.equal(app2.trangRouter, DANH_SACH);
    assert.equal(hoi2, 0);
    assert.equal(app2.thongKe.soLanGo, 0);
    huy2();
});

// ── Mục khởi tạo không có key (mở thẳng trình sửa bằng URL / thẻ mới / bookmark) ──

test("Mở thẳng trình sửa -> sang trang khác -> Back về trình sửa -> Forward: vẫn hỏi; Ở lại đứng yên, Rời tới đúng đích", async () => {
    const app = taoUngDung({ mucDau: [{ state: null, duongDan: PHIEU_NHAP }] });
    // React Router chỉ ghi idx vào mục khởi tạo, location.key là "default"
    assert.deepEqual(app.cuaSo.history.state, { idx: 0 });
    app.router.push(TONG_QUAN);
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.khoaRouter, "default");
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    app.bamNut(1);
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.urlTrinhDuyet, PHIEU_NHAP);
    assert.equal(hoi.length, 1);
    assert.equal(app.thongKe.soLanGo, 1);
    // Ở lại: không lặp lịch sử
    await choLichSu();
    await choLichSu();
    assert.equal(hoi.length, 1);
    assert.equal(app.thongKe.soLanGo, 1);
    assert.equal(app.soHenGio, 0);
    // Rời: router chuyển tới đúng mục đã bấm
    hoi[0]();
    await choLichSu();
    assert.equal(app.trangRouter, TONG_QUAN);
    assert.equal(app.urlTrinhDuyet, TONG_QUAN);
    assert.equal(app.thongKe.soLanGo, 2);
    huy();

    // Back về trình sửa lần nữa, không còn thay đổi chưa lưu: Forward như thường, không hỏi
    app.bamNut(-1);
    await choLichSu();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    const huy2 = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, {
        dangChan: () => false,
        khoaTrang: app.khoaRouter,
    });
    app.bamNut(1);
    await choLichSu();
    assert.equal(app.trangRouter, TONG_QUAN);
    assert.equal(app.urlTrinhDuyet, TONG_QUAN);
    assert.equal(hoi.length, 1);
    assert.equal(app.thongKe.soLanGo, 2);
    huy2();
});

test("Mục khởi tạo không key: lệnh bù dừng ở mục #neo, hoặc đích là mục #neo (state null) -> không nhận nhầm là trang", () => {
    const app = taoUngDung({ hangDoi: true, mucDau: [{ state: null, duongDan: PHIEU_NHAP }] });
    app.router.push(TONG_QUAN); // idx 1
    app.cuaSo.history.pushState(null, "", `${TONG_QUAN}${NEO}`); // link #neo: state null
    app.router.push(PHIEU_XUAT); // React Router: idx = null + 1 = 1
    app.bamNut(-3);
    app.chayHet();
    assert.equal(app.trangRouter, PHIEU_NHAP);
    assert.equal(app.khoaRouter, "default");
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    // Forward 3 mục: bước tính từ idx là 1, lệnh bù go(-1) dừng ở mục #neo -> thôi chặn, router theo URL
    app.bamNut(3);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, `${TONG_QUAN}${NEO}`);
    assert.equal(app.trangRouter, `${TONG_QUAN}${NEO}`);
    assert.equal(hoi.length, 0);
    assert.equal(app.thongKe.soLanGo, 1);
    assert.equal(app.soHenGio, 0);
    assert.equal(app.chayHet(), 0);
    huy();

    // Đích là mục #neo (không có idx): router xử lý như thường, không gọi history.go
    const app2 = taoUngDung({ hangDoi: true, mucDau: [{ state: null, duongDan: PHIEU_NHAP }] });
    app2.cuaSo.history.pushState(null, "", `${PHIEU_NHAP}${NEO}`);
    app2.bamNut(-1);
    app2.chayHet();
    assert.equal(app2.khoaRouter, "default");
    const hoi2 = [];
    const huy2 = chanQuayLaiTrinhDuyet((tiepTuc) => hoi2.push(tiepTuc), app2.cuaSo, { khoaTrang: app2.khoaRouter });
    app2.bamNut(1);
    app2.chayHet();
    assert.equal(app2.urlTrinhDuyet, `${PHIEU_NHAP}${NEO}`);
    assert.equal(app2.trangRouter, `${PHIEU_NHAP}${NEO}`);
    assert.equal(hoi2.length, 0);
    assert.equal(app2.thongKe.soLanGo, 0);
    huy2();
});

test("Back từ mục không key do F5 ở mục #neo: mục khởi tạo khác (cùng idx 0, không key, khác URL) không bị nhận là trang", () => {
    // Tài liệu: mục khởi tạo { idx: 0 } (DANH_SACH) -> PHIEU_XUAT (idx 1) -> link #neo (state null) rồi F5: React
    // Router ghi { idx: 0 } vào mục #neo -> hai mục { idx: 0 } không key trong cùng tài liệu
    const mucDau = [
        { state: { idx: 0 }, duongDan: DANH_SACH },
        { state: { usr: null, key: "k1", idx: 1 }, duongDan: PHIEU_XUAT },
        { state: null, duongDan: `${PHIEU_NHAP}${NEO}` },
    ];
    const app = taoUngDung({ hangDoi: true, mucDau });
    assert.deepEqual(app.cuaSo.history.state, { idx: 0 });
    assert.equal(app.khoaRouter, "default");
    const hoi = [];
    const huy = chanQuayLaiTrinhDuyet((tiepTuc) => hoi.push(tiepTuc), app.cuaSo, { khoaTrang: app.khoaRouter });
    // Back 1 mục: bước tính từ idx (đánh lại từ 0) sai chiều, lệnh bù dừng ở mục khởi tạo -> không coi là đã về
    // trang: thôi chặn, router theo URL, không lặp
    app.bamNut(-1);
    app.chayHet();
    assert.equal(app.urlTrinhDuyet, DANH_SACH);
    assert.equal(app.trangRouter, DANH_SACH);
    assert.equal(hoi.length, 0);
    assert.equal(app.thongKe.soLanGo, 1);
    assert.equal(app.soHenGio, 0);
    assert.equal(app.chayHet(), 0);
    huy();

    // Back thẳng tới mục khởi tạo: router xử lý như thường, không hỏi, không gọi history.go
    const app2 = taoUngDung({ hangDoi: true, mucDau });
    const hoi2 = [];
    const huy2 = chanQuayLaiTrinhDuyet((tiepTuc) => hoi2.push(tiepTuc), app2.cuaSo, { khoaTrang: app2.khoaRouter });
    app2.bamNut(-2);
    app2.chayHet();
    assert.equal(app2.urlTrinhDuyet, DANH_SACH);
    assert.equal(app2.trangRouter, DANH_SACH);
    assert.equal(hoi2.length, 0);
    assert.equal(app2.thongKe.soLanGo, 0);
    huy2();
});

test("Mục không key: chỉ chặn khi khoaTrang là \"default\"; mục hiện tại là mục #neo (state null) thì không chặn", () => {
    for (const khoaTrang of [undefined, "khac"]) {
        const nhan = `khoaTrang: ${khoaTrang}`;
        const app = taoUngDung({ hangDoi: true, mucDau: [{ state: null, duongDan: PHIEU_NHAP }] });
        app.router.push(TONG_QUAN);
        app.bamNut(-1);
        app.chayHet();
        let hoi = 0;
        const huy = chanQuayLaiTrinhDuyet(() => (hoi += 1), app.cuaSo, { khoaTrang });
        app.bamNut(1);
        app.chayHet();
        assert.equal(app.trangRouter, TONG_QUAN, nhan);
        assert.equal(hoi, 0, nhan);
        assert.equal(app.thongKe.soLanGo, 0, nhan);
        huy();
    }

    // Mở thẳng trình sửa rồi bấm link #neo: router vẫn báo location.key "default" nhưng mục hiện tại không có idx
    const app2 = taoUngDung({ hangDoi: true, mucDau: [{ state: null, duongDan: PHIEU_NHAP }] });
    app2.cuaSo.history.pushState(null, "", `${PHIEU_NHAP}${NEO}`);
    let hoi2 = 0;
    const huy2 = chanQuayLaiTrinhDuyet(() => (hoi2 += 1), app2.cuaSo, { khoaTrang: "default" });
    app2.bamNut(-1);
    app2.chayHet();
    assert.equal(app2.trangRouter, PHIEU_NHAP);
    assert.equal(hoi2, 0);
    assert.equal(app2.thongKe.soLanGo, 0);
    huy2();
});
