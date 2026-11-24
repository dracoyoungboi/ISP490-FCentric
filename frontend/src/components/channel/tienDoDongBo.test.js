// Chạy: node --test src/components/channel/tienDoDongBo.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cacBuocDongBo, DB_TRANG_THAI, ketQuaDongBo } from "./tienDoDongBo.js";

test("ketQuaDongBo va cacBuocDongBo: hien thi ro so SKU khong doi thay vi 0/0", () => {
  const phienKhongDoi = {
    maPhien: "p-1",
    trangThai: DB_TRANG_THAI.XONG,
    giaiDoan: "lay_don",
    tongSku: 0,
    daXuLy: 0,
    soThanhCong: 0,
    soLoi: 0,
    soBoQuaKhongDoi: 14,
    soDonMoi: 0,
  };

  const kq = ketQuaDongBo(phienKhongDoi);
  assert.equal(kq.tone, "ok");
  assert.equal(kq.nhan, "Không có biến động");

  const buoc = cacBuocDongBo(phienKhongDoi, "TikTok Shop");
  const buocDayTon = buoc.find((b) => b.ma === "day-ton");
  assert.equal(buocDayTon.tt, "xong");
  assert.equal(buocDayTon.phu, "14 SKU không đổi");
});

test("cacBuocDongBo: ket hop so SKU da day va so SKU khong doi khi co bien dong mot phan", () => {
  const phienMotPhan = {
    maPhien: "p-2",
    trangThai: DB_TRANG_THAI.XONG,
    giaiDoan: "lay_don",
    tongSku: 3,
    daXuLy: 3,
    soThanhCong: 3,
    soLoi: 0,
    soBoQuaKhongDoi: 7,
    soDonMoi: 2,
  };

  const kq = ketQuaDongBo(phienMotPhan);
  assert.equal(kq.nhan, "Đã đồng bộ");

  const buoc = cacBuocDongBo(phienMotPhan, "Lazada");
  const buocDayTon = buoc.find((b) => b.ma === "day-ton");
  assert.equal(buocDayTon.tt, "xong");
  assert.equal(buocDayTon.phu, "3/3 SKU · 7 không đổi");
});
