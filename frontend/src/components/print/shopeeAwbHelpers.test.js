import { test } from "node:test";
import assert from "node:assert/strict";
import {
    chuanHoaDonViVanChuyen,
    docLoiTuBlob,
    laHtmlNoiBoFCentric,
    laPdfBlob,
    lamSachHtmlDeNhung,
    trichMaVanDonTuHtml,
    trichTheGhiChu,
} from "./shopeeAwbHelpers.js";

// Chạy: node --test src/components/print/shopeeAwbHelpers.test.js

test("nhận diện PDF theo Content-Type hoặc magic bytes %PDF", async () => {
    assert.equal(await laPdfBlob(new Blob(["abc"], { type: "application/pdf" })), true);
    assert.equal(await laPdfBlob(new Blob(["%PDF-1.4 content"], { type: "application/octet-stream" })), true);
    assert.equal(await laPdfBlob(new Blob(["<html><body>awb</body></html>"], { type: "text/html" })), false);
    assert.equal(await laPdfBlob(null), false);
});

test("phân biệt HTML nội bộ FCentric với HTML từ sàn và trích mã vận đơn thật", () => {
    const htmlNoiBo = `
      <div class="barcode-text">SPXVN068899112233</div>
      <div class="footer"><div>Shopee Express · Tem in nhiệt chuẩn A6 (100x150mm)</div></div>
      <script>window.onload = function() { window.focus(); window.print(); };</script>
    `;
    const htmlSanShopee = `<!DOCTYPE html><html><body><h2>SHOPEE EXPRESS (SPX VN)</h2></body></html>`;

    assert.equal(laHtmlNoiBoFCentric(htmlNoiBo), true);
    assert.equal(laHtmlNoiBoFCentric(htmlSanShopee), false);
    assert.equal(trichMaVanDonTuHtml(htmlNoiBo), "SPXVN068899112233");
    assert.equal(trichMaVanDonTuHtml(`<div class="barcode-text">—</div>`), null);
});

test("gỡ bỏ script auto window.print() khi nhúng HTML sàn vào khung A6", () => {
    const html = `<div>Label</div><script>window.onload = function() { window.print(); };</script><p>End</p>`;
    const cleaned = lamSachHtmlDeNhung(html);
    assert.equal(cleaned.includes("window.print"), false);
    assert.equal(cleaned.includes("<div>Label</div>"), true);
    assert.equal(cleaned.includes("<p>End</p>"), true);
});

test("đọc thông điệp lỗi JSON từ Axios Blob error", async () => {
    const err = {
        response: {
            data: new Blob([JSON.stringify({ message: "Đơn hàng đã bị hủy" })], { type: "application/json" }),
        },
    };
    assert.equal(await docLoiTuBlob(err), "Đơn hàng đã bị hủy");
    assert.equal(await docLoiTuBlob({ response: { data: new Blob(["not json"]) } }), null);
    assert.equal(await docLoiTuBlob({}), null);
});

test("trích xuất thẻ [VẬN ĐƠN] và [ĐƠN VỊ] trong ghi chú đơn hàng + chuẩn hóa tên hãng vận chuyển", () => {
    const ghiChu = "Đơn Shopee | [VẬN ĐƠN: SPXVN0512345678] | [ĐƠN VỊ: Shopee Xpress (SPX)]";
    assert.equal(trichTheGhiChu(ghiChu, "VẬN ĐƠN"), "SPXVN0512345678");
    assert.equal(trichTheGhiChu(ghiChu, "ĐƠN VỊ"), "Shopee Xpress (SPX)");
    assert.equal(chuanHoaDonViVanChuyen("Shopee Xpress (SPX)"), "SPX EXPRESS");
    assert.equal(chuanHoaDonViVanChuyen("J&T Express"), "J&T EXPRESS");
    assert.equal(chuanHoaDonViVanChuyen(null), null);
});
