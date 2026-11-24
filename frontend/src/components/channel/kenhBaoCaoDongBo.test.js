// Chạy: node --test src/components/channel/kenhBaoCaoDongBo.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MA_KENH_BAO_CAO,
  chuanHoaKenhBaoCao,
  duongDanBaoCaoDongBoKenh,
  layKenhTuSearchParams,
} from "./kenhBaoCaoDongBo.js";

test("chuanHoaKenhBaoCao: anh xa dung ma san, ma noi bo va slug chu thuong", () => {
  assert.ok(MA_KENH_BAO_CAO.includes("ALL"));
  assert.equal(chuanHoaKenhBaoCao("SHOPIFY"), "SHOPIFY");
  assert.equal(chuanHoaKenhBaoCao("shopify"), "SHOPIFY");
  assert.equal(chuanHoaKenhBaoCao("LAZADA"), "LAZADA");
  assert.equal(chuanHoaKenhBaoCao("LAZADA_SANDBOX"), "LAZADA");
  assert.equal(chuanHoaKenhBaoCao("lazada-sandbox"), "LAZADA");
  assert.equal(chuanHoaKenhBaoCao("TIKTOK"), "TIKTOK");
  assert.equal(chuanHoaKenhBaoCao("TIKTOK_SHOP"), "TIKTOK");
  assert.equal(chuanHoaKenhBaoCao("tiktok-shop"), "TIKTOK");
  assert.equal(chuanHoaKenhBaoCao("SHOPEE"), "SHOPEE");
  assert.equal(chuanHoaKenhBaoCao("SHOPEE_OFFICIAL"), "SHOPEE");
  assert.equal(chuanHoaKenhBaoCao("shopee-official"), "SHOPEE");
  assert.equal(chuanHoaKenhBaoCao("SHOPEE_SANDBOX"), "SHOPEE_SANDBOX");
  assert.equal(chuanHoaKenhBaoCao("shopee-sandbox"), "SHOPEE_SANDBOX");

  // Giá trị rỗng, ALL hoặc kênh lạ rơi an toàn về ALL
  assert.equal(chuanHoaKenhBaoCao(null), "ALL");
  assert.equal(chuanHoaKenhBaoCao(""), "ALL");
  assert.equal(chuanHoaKenhBaoCao("all"), "ALL");
  assert.equal(chuanHoaKenhBaoCao("POS"), "ALL");
  assert.equal(chuanHoaKenhBaoCao("KENH_LA"), "ALL");
});

test("duongDanBaoCaoDongBoKenh: gan dung query ?channel=... cho tung kenh va bo query khi ALL", () => {
  assert.equal(duongDanBaoCaoDongBoKenh("ALL"), "/channels/analytics");
  assert.equal(duongDanBaoCaoDongBoKenh(null), "/channels/analytics");
  assert.equal(duongDanBaoCaoDongBoKenh("SHOPIFY"), "/channels/analytics?channel=SHOPIFY");
  assert.equal(duongDanBaoCaoDongBoKenh("LAZADA"), "/channels/analytics?channel=LAZADA");
  assert.equal(duongDanBaoCaoDongBoKenh("LAZADA_SANDBOX"), "/channels/analytics?channel=LAZADA");
  assert.equal(duongDanBaoCaoDongBoKenh("TIKTOK"), "/channels/analytics?channel=TIKTOK");
  assert.equal(duongDanBaoCaoDongBoKenh("SHOPEE_OFFICIAL"), "/channels/analytics?channel=SHOPEE");
  assert.equal(duongDanBaoCaoDongBoKenh("SHOPEE_SANDBOX"), "/channels/analytics?channel=SHOPEE_SANDBOX");
});

test("layKenhTuSearchParams: doc ?channel= hoac ?kenh= va fallback ALL", () => {
  assert.equal(layKenhTuSearchParams(new URLSearchParams("channel=SHOPEE_OFFICIAL")), "SHOPEE");
  assert.equal(layKenhTuSearchParams(new URLSearchParams("channel=TIKTOK")), "TIKTOK");
  assert.equal(layKenhTuSearchParams(new URLSearchParams("kenh=shopee-sandbox")), "SHOPEE_SANDBOX");
  assert.equal(layKenhTuSearchParams(new URLSearchParams("")), "ALL");
  assert.equal(layKenhTuSearchParams(new URLSearchParams("channel=INVALID")), "ALL");
  assert.equal(layKenhTuSearchParams(null), "ALL");
});
