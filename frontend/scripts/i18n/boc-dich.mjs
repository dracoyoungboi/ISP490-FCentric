#!/usr/bin/env node
/**
 * Tự bọc t() quanh câu tiếng Việt hiện ra giao diện: `node scripts/i18n/boc-dich.mjs <tệp|thư mục> ... [--thu]`
 *   --thu : chỉ in số chỗ sẽ bọc, không ghi tệp.
 * Sửa thẳng trên mã gốc theo vị trí (không định dạng lại tệp, giữ CRLF). Sau khi chạy PHẢI xem lại diff:
 *   - chuỗi dùng làm dữ liệu (gửi máy chủ, so khớp, khóa tra cứu, nội dung in) → gỡ t() và ghi chú `i18n-giu-nguyen`;
 *   - tên tham số tự đặt ({{giaTri}}) nên đổi cho dễ hiểu; câu có số đếm tiếng Anh cần số nhiều → { count }.
 * Ghép chữ JSX với biểu thức đơn giản thành một câu: `Còn {so} sản phẩm` → {t("Còn {{so}} sản phẩm", { so })}.
 * Tệp đã có biến cục bộ tên `t` thì bỏ qua và báo (đổi tên biến đó rồi chạy lại).
 */
import fs from "node:fs";
import path from "node:path";
import { CO_DAU, SRC, chonTep, chuJsx, docCay, dongGiuNguyen, giuNguyenCaTep, laNgoaiLe, traverse } from "./phan-tich.mjs";

const thamSo = process.argv.slice(2);
const chiThu = thamSo.includes("--thu");
const viTriDong = thamSo.indexOf("--dong");
// --dong 12,40: ép coi chữ ở các dòng này là tiếng Việt (chữ không dấu như "STT", "Xem") — dùng với MỘT tệp
const DONG_EP = new Set(viTriDong >= 0 ? String(thamSo[viTriDong + 1]).split(",").map(Number) : []);
const dsDuongDan = thamSo
  .filter((x, i) => !x.startsWith("--") && !(viTriDong >= 0 && i === viTriDong + 1))
  .map((x) => path.resolve(process.cwd(), x));
/** Chữ cần bọc: có dấu tiếng Việt, hoặc nằm ở dòng bị ép (--dong). */
const laViet = (chu, node) =>
  CO_DAU.test(chu) || (DONG_EP.size > 0 && node?.type === "JSXText" && node.loc && [...Array(node.loc.end.line - node.loc.start.line + 1).keys()]
    .some((k) => DONG_EP.has(node.loc.start.line + k)) && /\p{L}{2,}/u.test(chu));

const TEN_HOP_LE = /^[A-Za-z_$][\w$]*$/;
const KIEU_GHEP_DUOC = new Set([
  "Identifier", "MemberExpression", "OptionalMemberExpression", "CallExpression", "OptionalCallExpression",
  "NumericLiteral", "BinaryExpression", "TemplateLiteral", "LogicalExpression",
]);
// Biểu thức có thể là phần tử React: không ghép vào câu
const GIONG_PHAN_TU = /icon|Icon|badge|Badge|render|children|node\b|Node\b|<|Element|element|link\b|Link\b|\bnut\b|\bNut\b|\bo[A-Z]\w*|\bkhoi|\bKhoi/;

/** Các tệp test đang import (tệp được test chạy bằng node thì không dùng alias "@/"). */
function tepDuocTestImport() {
  const ra = new Set();
  const tests = [];
  (function quet(d) {
    for (const m of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, m.name);
      if (m.isDirectory()) quet(p);
      else if (/\.test\.(m?js|jsx)$/.test(m.name)) tests.push(p);
    }
  })(SRC);
  for (const tep of tests) {
    const ma = fs.readFileSync(tep, "utf8");
    for (const m of ma.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      const dich = path.resolve(path.dirname(tep), m[1]);
      for (const duoi of ["", ".js", ".jsx", ".mjs"]) ra.add(path.normalize(dich + duoi));
    }
  }
  return ra;
}

function tenThamSo(bieuThuc, ma, daDung) {
  let ten = null;
  const n = bieuThuc;
  if (n.type === "Identifier") ten = n.name;
  else if ((n.type === "MemberExpression" || n.type === "OptionalMemberExpression") && !n.computed) ten = n.property.name;
  else if (n.type === "CallExpression" || n.type === "OptionalCallExpression") {
    const a = n.arguments[0];
    if (a?.type === "Identifier") ten = a.name;
    else if ((a?.type === "MemberExpression" || a?.type === "OptionalMemberExpression") && !a.computed) ten = a.property.name;
  }
  if (!ten || !TEN_HOP_LE.test(ten) || ten === "t" || ten === "count") ten = "giaTri";
  let ketQua = ten;
  for (let i = 2; daDung.has(ketQua); i++) ketQua = `${ten}${i}`;
  daDung.add(ketQua);
  return ketQua;
}

function chuoiJs(chu) {
  return JSON.stringify(chu);
}

function bocTep(tep, testImport) {
  const ma = fs.readFileSync(tep, "utf8");
  if (giuNguyenCaTep(ma)) return { soCho: 0 };
  const cay = docCay(ma);
  const giuNguyen = dongGiuNguyen(ma);

  let coBienT = false;
  traverse(cay, {
    Scopable(p) {
      if (Object.hasOwn(p.scope.bindings, "t") && p.scope.bindings.t.kind !== "module") coBienT = true;
    },
  });
  const daImportT = /import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*["'][^"']*i18n/.test(ma);
  if (coBienT) return { soCho: 0, xungDot: true };

  /** @type {{start:number,end:number,xay:(lay:(s:number,e:number)=>string)=>string}[]} */
  const sua = [];
  const daXuLy = new Set();

  const bocBieuThuc = (lay, phan) => {
    // phan: [{chu}|{bieuThuc}] → "t(\"…{{ten}}…\", { ten: … })"
    const daDung = new Set();
    let khoa = "";
    const doiSo = [];
    for (const x of phan) {
      if ("chu" in x) khoa += x.chu.replace(/\{\{/g, "{ {");
      else {
        const ten = tenThamSo(x.bieuThuc, ma, daDung);
        khoa += `{{${ten}}}`;
        const nguon = lay(x.bieuThuc.start, x.bieuThuc.end);
        doiSo.push(x.bieuThuc.type === "Identifier" && x.bieuThuc.name === ten ? ten : `${ten}: ${nguon}`);
      }
    }
    return doiSo.length ? `t(${chuoiJs(khoa)}, { ${doiSo.join(", ")} })` : `t(${chuoiJs(khoa)})`;
  };

  const xuLyCon = (children) => {
    let i = 0;
    while (i < children.length) {
      const run = [];
      while (i < children.length) {
        const c = children[i];
        if (c.type === "JSXText") run.push(c);
        else if (c.type === "JSXExpressionContainer" && c.expression.type === "StringLiteral" && !CO_DAU.test(c.expression.value)) run.push(c);
        else if (
          c.type === "JSXExpressionContainer" && KIEU_GHEP_DUOC.has(c.expression.type) &&
          !GIONG_PHAN_TU.test(ma.slice(c.expression.start, c.expression.end))
        ) run.push(c);
        else break;
        i++;
      }
      if (run.length === 0) {
        i++;
        continue;
      }
      // Cắt hai đầu: chỉ giữ từ chữ tiếng Việt đầu tiên/biểu thức sát nó tới chữ cuối
      const coViet = run.some((c) => c.type === "JSXText" && laViet(c.value, c));
      if (!coViet) continue;
      let dau = 0;
      let cuoi = run.length - 1;
      // Hai đầu là khoảng trắng (chữ trắng hoặc {" "}) thì để nguyên ngoài câu, không nuốt mất
      const laTrang = (c) =>
        (c.type === "JSXText" && !chuJsx(c.value).trim()) ||
        (c.type === "JSXExpressionContainer" && c.expression.type === "StringLiteral" && !c.expression.value.trim());
      while (dau <= cuoi && laTrang(run[dau])) dau++;
      while (cuoi >= dau && laTrang(run[cuoi])) cuoi--;
      const doan = run.slice(dau, cuoi + 1);
      if (!doan.length || giuNguyen(doan[0].loc.start.line)) continue;
      doan.forEach((c) => c.type === "JSXText" && daXuLy.add(c));

      const phan = [];
      for (const c of doan) {
        if (c.type === "JSXText") phan.push({ chu: chuJsx(c.value) });
        else if (c.expression.type === "StringLiteral") phan.push({ chu: c.expression.value });
        else phan.push({ bieuThuc: c.expression });
      }
      // Khoảng trắng hai đầu để nguyên trong mã (giữ xuống dòng, thụt lề); câu chỉ lấy phần chữ
      const dauTien = phan[0];
      const cuoiCung = phan[phan.length - 1];
      if ("chu" in dauTien) dauTien.chu = dauTien.chu.replace(/^\s+/, "");
      if ("chu" in cuoiCung) cuoiCung.chu = cuoiCung.chu.replace(/\s+$/, "");
      const start = doan[0].type === "JSXText" ? doan[0].start + ma.slice(doan[0].start, doan[0].end).search(/\S/) : doan[0].start;
      const cuoiNode = doan[doan.length - 1];
      const end = cuoiNode.type === "JSXText" ? cuoiNode.start + ma.slice(cuoiNode.start, cuoiNode.end).trimEnd().length : cuoiNode.end;
      sua.push({ start, end, xay: (lay) => `{${bocBieuThuc(lay, phan)}}` });
    }
  };

  traverse(cay, {
    JSXElement(p) { xuLyCon(p.node.children); },
    JSXFragment(p) { xuLyCon(p.node.children); },
  });

  traverse(cay, {
    JSXText(p) {
      if (daXuLy.has(p.node) || !laViet(p.node.value, p.node) || giuNguyen(p.node.loc.start.line)) return;
      const chu = chuJsx(p.node.value).trim();
      const tho = ma.slice(p.node.start, p.node.end);
      const start = p.node.start + tho.search(/\S/);
      const end = p.node.start + tho.trimEnd().length;
      sua.push({ start, end, xay: () => `{t(${chuoiJs(chu)})}` });
    },
    StringLiteral(p) {
      const n = p.node;
      if (!laViet(n.value, n) || p.parentPath.isDirective?.() || laNgoaiLe(p) || giuNguyen(n.loc.start.line)) return;
      if (p.parentPath.isJSXAttribute()) sua.push({ start: n.start, end: n.end, xay: () => `{t(${chuoiJs(n.value)})}` });
      else sua.push({ start: n.start, end: n.end, xay: () => `t(${chuoiJs(n.value)})` });
    },
    TemplateLiteral(p) {
      const n = p.node;
      const chu = n.quasis.map((q) => q.value.cooked ?? "").join("");
      if (!laViet(chu, n) || p.parentPath.isTaggedTemplateExpression() || laNgoaiLe(p) || giuNguyen(n.loc.start.line)) return;
      const phan = [];
      n.quasis.forEach((q, k) => {
        if (q.value.cooked) phan.push({ chu: q.value.cooked });
        if (k < n.expressions.length) phan.push({ bieuThuc: n.expressions[k] });
      });
      sua.push({ start: n.start, end: n.end, xay: (lay) => bocBieuThuc(lay, phan) });
    },
  });

  if (!sua.length) return { soCho: 0 };

  // Áp dụng lồng nhau: sửa ngoài lấy văn bản của biểu thức con SAU khi đã sửa bên trong
  sua.sort((a, b) => a.start - b.start || b.end - a.end);
  const lay = (s, e) => {
    let ra = "";
    let viTri = s;
    for (const x of sua) {
      if (x.start < viTri || x.end > e || x.start < s) continue;
      if (x.start === s && x.end === e && laDangXay.has(x)) continue;
      ra += ma.slice(viTri, x.start);
      laDangXay.add(x);
      ra += x.xay(lay);
      laDangXay.delete(x);
      viTri = x.end;
    }
    return ra + ma.slice(viTri, e);
  };
  const laDangXay = new Set();
  let moi = lay(0, ma.length);

  if (!daImportT) {
    const xuongDong = ma.includes("\r\n") ? "\r\n" : "\n";
    const nguon = testImport.has(path.normalize(tep))
      ? path.relative(path.dirname(tep), path.join(SRC, "i18n", "t.js")).split(path.sep).join("/").replace(/^(?!\.)/, "./")
      : "@/i18n";
    const dongImport = `import { t } from "${nguon}";`;
    const cacImport = cay.program.body.filter((n) => n.type === "ImportDeclaration");
    if (cacImport.length) {
      const sauImport = cacImport[cacImport.length - 1].end;
      // vị trí trong `moi` = vị trí cũ vì mọi sửa đều nằm sau import cuối
      moi = moi.slice(0, sauImport) + xuongDong + dongImport + moi.slice(sauImport);
    } else {
      moi = dongImport + xuongDong + moi;
    }
  }
  if (!chiThu) fs.writeFileSync(tep, moi);
  return { soCho: sua.length };
}

const testImport = tepDuocTestImport();
let tong = 0;
const xungDot = [];
for (const tep of chonTep(dsDuongDan)) {
  const kq = bocTep(tep, testImport);
  if (kq.xungDot) xungDot.push(path.relative(process.cwd(), tep));
  if (kq.soCho) console.log(`${path.relative(process.cwd(), tep)}: ${kq.soCho}`);
  tong += kq.soCho;
}
for (const x of xungDot) console.log(`[BỎ QUA — có biến cục bộ tên t, đổi tên rồi chạy lại] ${x}`);
console.log(`${chiThu ? "Sẽ bọc" : "Đã bọc"}: ${tong} chỗ`);
