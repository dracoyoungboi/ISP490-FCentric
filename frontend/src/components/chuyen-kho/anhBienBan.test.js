// Chạy: node --test src/components/chuyen-kho/anhBienBan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    CANH_DAI_TOI_DA,
    CHAT_LUONG_DAU,
    SO_ANH_TOI_DA,
    cacLanThu,
    cauAnhChuaTai,
    cauAnhKhongDoc,
    cauBoQua,
    kichThuocThuNho,
    laTepHeic,
    locAnhChon,
    taiLanLuot,
    tenTepJpeg,
} from "./anhBienBan.js";

test("kichThuocThuNho: cạnh dài về 1600 px, giữ tỉ lệ, ảnh dọc / ngang / vuông", () => {
    assert.deepEqual(kichThuocThuNho(4000, 3000), { rong: 1600, cao: 1200 });
    assert.deepEqual(kichThuocThuNho(3024, 4032), { rong: 1200, cao: 1600 });
    assert.deepEqual(kichThuocThuNho(2000, 2000), { rong: 1600, cao: 1600 });
    // Làm tròn: 4032 × 1816 → 1600 × 720,6 → 721
    assert.deepEqual(kichThuocThuNho(4032, 1816), { rong: 1600, cao: 721 });
});

test("kichThuocThuNho: không phóng to ảnh nhỏ, đúng ngưỡng giữ nguyên, ảnh rất dẹt vẫn ≥ 1 px", () => {
    assert.deepEqual(kichThuocThuNho(800, 600), { rong: 800, cao: 600 });
    assert.deepEqual(kichThuocThuNho(1600, 900), { rong: 1600, cao: 900 });
    assert.deepEqual(kichThuocThuNho(100000, 10), { rong: 1600, cao: 1 });
    assert.deepEqual(kichThuocThuNho(4000, 3000, 1280), { rong: 1280, cao: 960 });
});

test("kichThuocThuNho: kích thước hỏng → 0 × 0", () => {
    assert.deepEqual(kichThuocThuNho(0, 300), { rong: 0, cao: 0 });
    assert.deepEqual(kichThuocThuNho(undefined, 300), { rong: 0, cao: 0 });
    assert.deepEqual(kichThuocThuNho(-5, -5), { rong: 0, cao: 0 });
    assert.deepEqual(kichThuocThuNho("abc", 300), { rong: 0, cao: 0 });
});

test("cacLanThu: 1600 px chất lượng 0,85 trước, giảm dần, cuối cùng 1280 px", () => {
    const ds = cacLanThu(4000, 3000);
    assert.equal(CANH_DAI_TOI_DA, 1600);
    assert.deepEqual(ds[0], { rong: 1600, cao: 1200, chatLuong: CHAT_LUONG_DAU });
    assert.equal(CHAT_LUONG_DAU, 0.85);
    assert.deepEqual(ds.map((l) => l.chatLuong), [0.85, 0.75, 0.65, 0.55, 0.6, 0.45]);
    assert.deepEqual(ds.slice(0, 4).map((l) => l.rong), [1600, 1600, 1600, 1600]);
    assert.deepEqual(ds.slice(4).map((l) => [l.rong, l.cao]), [[1280, 960], [1280, 960]]);
    // Ảnh nhỏ: không phóng to ở lần nào
    assert.ok(cacLanThu(640, 480).every((l) => l.rong === 640 && l.cao === 480));
});

test("tenTepJpeg: đổi đuôi sang .jpg, tên trống / không đuôi vẫn có tên", () => {
    assert.equal(tenTepJpeg("IMG_0001.HEIC"), "IMG_0001.jpg");
    assert.equal(tenTepJpeg("thung.mop.png"), "thung.mop.jpg");
    assert.equal(tenTepJpeg("anh-chup"), "anh-chup.jpg");
    assert.equal(tenTepJpeg(""), "anh.jpg");
    assert.equal(tenTepJpeg(undefined), "anh.jpg");
    assert.equal(tenTepJpeg(".png"), "anh.jpg");
});

const tep = (ten, type) => ({ name: ten, type });

test("locAnhChon: chỉ nhận ảnh, không vượt 6 ảnh tính cả ảnh đã có", () => {
    const chon = [tep("a.jpg", "image/jpeg"), tep("b.pdf", "application/pdf"), tep("c.png", "image/png"), tep("d.heic", "image/heic")];
    const kq = locAnhChon(chon, 0);
    assert.deepEqual(kq.nhan.map((f) => f.name), ["a.jpg", "c.png", "d.heic"]);
    assert.equal(kq.boQuaKhongPhaiAnh, 1);
    assert.equal(kq.boQuaVuot, 0);

    const conHai = locAnhChon(chon, 4);
    assert.deepEqual(conHai.nhan.map((f) => f.name), ["a.jpg", "c.png"]);
    assert.equal(conHai.boQuaVuot, 1);

    const day = locAnhChon(chon, SO_ANH_TOI_DA);
    assert.equal(day.nhan.length, 0);
    assert.equal(day.boQuaVuot, 3);
    // Đã có nhiều hơn giới hạn (dữ liệu lạ) hay số hỏng: không âm
    assert.equal(locAnhChon(chon, 9).nhan.length, 0);
    assert.equal(locAnhChon(chon, "x").nhan.length, 3);
    assert.deepEqual(locAnhChon(null, 0), { nhan: [], boQuaKhongPhaiAnh: 0, boQuaHeic: 0, boQuaVuot: 0 });
});

test("locAnhChon: ảnh .heic mà Windows để type rỗng báo riêng là HEIC, không gọi là 'không phải ảnh'", () => {
    const chon = [tep("IMG_0001.HEIC", ""), tep("IMG_0002.heif", ""), tep("a.jpg", "image/jpeg"), tep("ghi-chu.txt", "")];
    const kq = locAnhChon(chon, 0);
    assert.deepEqual(kq.nhan.map((f) => f.name), ["a.jpg"]);
    assert.equal(kq.boQuaHeic, 2);
    assert.equal(kq.boQuaKhongPhaiAnh, 1);
    assert.equal(cauBoQua(kq), "Đã bỏ 2 ảnh HEIC. Không đọc được định dạng HEIC, hãy chụp hoặc chọn ảnh JPEG. Đã bỏ 1 tệp không phải ảnh.");
    // Trình duyệt nhận được type image/heic (vd. Safari đọc được HEIC) thì vẫn thử thu nhỏ như ảnh thường
    assert.equal(locAnhChon([tep("b.heic", "image/heic")], 0).nhan.length, 1);
    assert.equal(laTepHeic(tep("c.HEIC ", "")), true);
    assert.equal(laTepHeic(tep("d", "image/heif")), true);
    assert.equal(laTepHeic(tep("e.jpg", "image/jpeg")), false);
    assert.equal(laTepHeic(null), false);
});

test("cauAnhKhongDoc: gộp nhiều ảnh lỗi thành một thông báo, có HEIC thì nói rõ định dạng", () => {
    assert.equal(cauAnhKhongDoc([]), null);
    assert.equal(cauAnhKhongDoc(undefined), null);
    assert.deepEqual(cauAnhKhongDoc([tep("hong.png", "image/png")]), {
        tieuDe: "Không đọc được ảnh hong.png",
        moTa: "Chọn ảnh JPEG, PNG hoặc WebP, hoặc chụp lại.",
    });
    const nhieu = cauAnhKhongDoc([tep("a.heic", "image/heic"), tep("b.png", "image/png"), tep("c.jpg", "image/jpeg"), tep("d.jpg", "image/jpeg")]);
    assert.deepEqual(nhieu, {
        tieuDe: "Không đọc được 4 ảnh: a.heic, b.png, c.jpg +1",
        moTa: "Không đọc được định dạng HEIC, hãy chụp hoặc chọn ảnh JPEG.",
    });
    assert.equal(cauAnhKhongDoc([tep("", "image/png")]).tieuDe, "Không đọc được ảnh");
});

test("cauBoQua: báo phần bị bỏ, không bỏ gì thì null", () => {
    assert.equal(cauBoQua({ boQuaKhongPhaiAnh: 0, boQuaVuot: 0 }), null);
    assert.equal(cauBoQua({ boQuaVuot: 2 }), "Mỗi biên bản tối đa 6 ảnh, đã bỏ 2 ảnh chọn thừa.");
    assert.equal(cauBoQua({ boQuaKhongPhaiAnh: 1 }), "Đã bỏ 1 tệp không phải ảnh.");
    assert.equal(cauBoQua({ boQuaKhongPhaiAnh: 1, boQuaVuot: 1 }),
        "Mỗi biên bản tối đa 6 ảnh, đã bỏ 1 ảnh chọn thừa. Đã bỏ 1 tệp không phải ảnh.");
    assert.equal(cauBoQua(), null);
});

test("taiLanLuot: tải lần lượt, ảnh lỗi không dừng ảnh sau, báo tiến độ sau mỗi ảnh", async () => {
    const thuTu = [];
    const tienDo = [];
    let dangChay = 0;
    const ds = [{ k: 1 }, { k: 2 }, { k: 3 }];
    const kq = await taiLanLuot(ds, async (a, i) => {
        dangChay += 1;
        assert.equal(dangChay, 1, "không gửi hai ảnh cùng lúc");
        thuTu.push([a.k, i]);
        await new Promise((xong) => setTimeout(xong, 1));
        dangChay -= 1;
        if (a.k === 2) throw new Error("413");
    }, (xong, tong) => tienDo.push(`${xong}/${tong}`));
    assert.deepEqual(thuTu, [[1, 0], [2, 1], [3, 2]]);
    assert.deepEqual(kq.daTai.map((a) => a.k), [1, 3]);
    assert.equal(kq.loi.length, 1);
    assert.equal(kq.loi[0].anh.k, 2);
    assert.equal(kq.loi[0].loi.message, "413");
    assert.deepEqual(tienDo, ["1/3", "2/3", "3/3"]);
    assert.equal(kq.daDung, false);
    assert.equal(cauAnhChuaTai(kq.loi.length), "1 ảnh chưa tải được, thêm lại ở chi tiết phiếu");
});

test("taiLanLuot: bấm dừng giữa chừng thì không gửi ảnh còn lại, ảnh chưa tải tính như ảnh lỗi", async () => {
    const dieuKhien = new AbortController();
    const daGui = [];
    const ds = [{ k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }];
    const kq = await taiLanLuot(ds, (a, i) => new Promise((xong, loi) => {
        daGui.push(a.k);
        if (a.k === 2) {
            // Ảnh 2 đang gửi thì người dùng bấm "Bỏ qua, tải ảnh sau": lời gọi bị hủy
            dieuKhien.signal.addEventListener("abort", () => loi(new Error("canceled")));
            dieuKhien.abort();
            return;
        }
        xong(i);
    }), undefined, dieuKhien.signal);
    assert.deepEqual(daGui, [1, 2], "không gửi ảnh 3, 4 sau khi dừng");
    assert.deepEqual(kq.daTai.map((a) => a.k), [1]);
    assert.deepEqual(kq.loi.map((l) => l.anh.k), [2, 3, 4]);
    assert.equal(kq.daDung, true);
    assert.equal(cauAnhChuaTai(kq.loi.length), "3 ảnh chưa tải được, thêm lại ở chi tiết phiếu");

    // Đã dừng trước khi bắt đầu: không gửi ảnh nào
    let goi = 0;
    const daDung = new AbortController();
    daDung.abort();
    const truoc = await taiLanLuot(ds, () => { goi += 1; }, undefined, daDung.signal);
    assert.equal(goi, 0);
    assert.equal(truoc.loi.length, 4);
    assert.equal(truoc.daDung, true);
});

test("taiLanLuot: danh sách trống / không phải mảng thì không gửi gì", async () => {
    let goi = 0;
    assert.deepEqual(await taiLanLuot([], () => { goi += 1; }), { daTai: [], loi: [], daDung: false });
    assert.deepEqual(await taiLanLuot(undefined, () => { goi += 1; }), { daTai: [], loi: [], daDung: false });
    assert.equal(goi, 0);
});
