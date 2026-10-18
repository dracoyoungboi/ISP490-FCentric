// Chạy: node --test src/lib/lichSuDieuHuong.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { UNSAFE_createBrowserHistory as createBrowserHistory } from "react-router-dom";
import { coTrangTruocTrongUngDung } from "./lichSuDieuHuong.js";

// Cửa sổ giả tối thiểu cho lịch sử trình duyệt của React Router: một ngăn xếp mục {state, url} và con trỏ.
function taoCuaSoGia(urlBanDau) {
  const muc = [{ state: null, url: new URL(urlBanDau, "http://fcentric.test") }];
  let viTri = 0;
  const history = {
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
  };
  return {
    history,
    get location() {
      return muc[viTri].url;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

test("coTrangTruocTrongUngDung: không có state / idx 0 / idx lạ thì coi như mở thẳng", () => {
  for (const state of [undefined, null, {}, { idx: 0 }, { idx: null }, { idx: "2" }, { idx: -1 }, { idx: 1.5 }, { idx: NaN }]) {
    assert.equal(coTrangTruocTrongUngDung(state), false, JSON.stringify(state));
  }
});

test("coTrangTruocTrongUngDung: idx > 0 là có trang trước của ứng dụng", () => {
  assert.equal(coTrangTruocTrongUngDung({ idx: 1 }), true);
  assert.equal(coTrangTruocTrongUngDung({ usr: { from: "/supplier" }, key: "ab12cd34", idx: 7 }), true);
});

test("React Router: mở thẳng rồi đổi tab (replace) thì key không còn 'default' nhưng vẫn là mục đầu tiên", () => {
  const cuaSo = taoCuaSoGia("/supplier/5");
  const lichSu = createBrowserHistory({ window: cuaSo });
  assert.equal(lichSu.location.key, "default");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), false);

  lichSu.replace("/supplier/5?tab=bao-gia");
  assert.notEqual(lichSu.location.key, "default"); // cách nhận biết cũ hỏng ở đây
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), false);
});

test("React Router: đường dẫn cũ chuyển hướng bằng replace vẫn là mục đầu tiên", () => {
  const cuaSo = taoCuaSoGia("/supplier/view/5");
  const lichSu = createBrowserHistory({ window: cuaSo });
  lichSu.replace("/supplier/5");
  assert.notEqual(lichSu.location.key, "default");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), false);
});

test("React Router: từ danh sách vào chi tiết (push), đổi tab, F5 đều còn trang trước", () => {
  const cuaSo = taoCuaSoGia("/supplier?trang=2");
  const lichSu = createBrowserHistory({ window: cuaSo });
  lichSu.push("/supplier/5");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), true);

  lichSu.replace("/supplier/5?tab=san-pham");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), true);

  // F5: trình duyệt giữ history.state, React Router tạo lại lịch sử từ đó
  const sauF5 = createBrowserHistory({ window: cuaSo });
  assert.equal(sauF5.location.pathname, "/supplier/5");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), true);
});

test("React Router: mở thẳng, đổi tab rồi chuyển sang trang khác (push) thì trang sau có trang trước", () => {
  const cuaSo = taoCuaSoGia("/supplier/5");
  const lichSu = createBrowserHistory({ window: cuaSo });
  lichSu.replace("/supplier/5?tab=don-mua");
  lichSu.push("/purchase-orders/7");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), true);
});

test("Mục lịch sử không do React Router tạo (link #neo, state null) thì coi như mở thẳng", () => {
  const cuaSo = taoCuaSoGia("/supplier");
  const lichSu = createBrowserHistory({ window: cuaSo });
  lichSu.push("/supplier/5");
  cuaSo.history.pushState(null, "", "/supplier/5#backoffice-main-content");
  assert.equal(coTrangTruocTrongUngDung(cuaSo.history.state), false);
});
