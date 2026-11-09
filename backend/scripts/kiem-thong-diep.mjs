#!/usr/bin/env node
/**
 * Kiểm câu thông báo đa ngôn ngữ của backend: `node scripts/kiem-thong-diep.mjs [đường dẫn .java hoặc thư mục ...] [--chi-tiet]`
 *
 * 1. CÂU CHỮ CÒN SÓT: exception ném câu tiếng Việt viết thẳng (`throw new X("…")`, `new CommonException("…")`…)
 *    hoặc `.message("…")` trong response — phải chuyển sang ThongDiep (xem com.dev.backend.i18n.ThongDiep).
 *    Cố ý giữ: chú thích `i18n-giu-nguyen` trên dòng đó hoặc dòng ngay trên.
 * 2. ANNOTATION: message="…" tiếng Việt của @NotBlank/@Size… phải có nguyên văn trong kho câu (để bộ xử lý lỗi dịch).
 * 3. KHÓA: mọi ThongDiep.of/vi/dich("khóa") phải có trong tệp tiếng Việt VÀ tiếng Anh; hai tệp cùng số tham số {n};
 *    dấu nháy đơn phải viết đôi; tệp tiếng Anh không còn chữ có dấu tiếng Việt.
 * Thoát mã 1 nếu còn lỗi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JAVA = path.join(GOC, "src", "main", "java");
const KHO = path.join(GOC, "src", "main", "resources", "i18n", "thong-diep");
const VN = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]/;

const thamSo = process.argv.slice(2);
const chiTiet = thamSo.includes("--chi-tiet");
const dsDuongDan = thamSo.filter((x) => !x.startsWith("--")).map((x) => path.resolve(process.cwd(), x));

function lietKe(d, ra = []) {
  for (const m of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, m.name);
    if (m.isDirectory()) lietKe(p, ra);
    else if (m.name.endsWith(".java")) ra.push(p);
  }
  return ra;
}

function docProperties(tep) {
  const ra = new Map();
  if (!fs.existsSync(tep)) return ra;
  const dong = fs.readFileSync(tep, "utf8").split(/\r?\n/);
  for (let i = 0; i < dong.length; i++) {
    let d = dong[i];
    if (!d.trim() || /^\s*[#!]/.test(d)) continue;
    while (/\\$/.test(d) && i + 1 < dong.length) d = d.slice(0, -1) + dong[++i].trimStart();
    const m = d.match(/^\s*([^=:\s]+)\s*[=:]\s?(.*)$/);
    if (m) ra.set(m[1], m[2]);
  }
  return ra;
}

// Kho câu
const vi = new Map();
const en = new Map();
const loiKho = [];
for (const ten of fs.readdirSync(KHO).filter((x) => x.endsWith(".properties"))) {
  const bang = docProperties(path.join(KHO, ten));
  const laEn = /_en\.properties$/.test(ten);
  for (const [k, v] of bang) {
    const dich = laEn ? en : vi;
    if (dich.has(k)) loiKho.push(`khóa trùng giữa các tệp: ${k} (${ten})`);
    dich.set(k, v);
  }
}
const demThamSo = (s) => new Set([...s.matchAll(/\{(\d+)[^}]*}/g)].map((m) => m[1])).size;
for (const [k, v] of vi) {
  if (!en.has(k)) loiKho.push(`thiếu bản tiếng Anh: ${k}`);
  else {
    if (demThamSo(v) !== demThamSo(en.get(k))) loiKho.push(`lệch số tham số vi/en: ${k}`);
    if (VN.test(en.get(k))) loiKho.push(`bản tiếng Anh còn chữ Việt: ${k}`);
  }
  for (const [ten, s] of [["vi", v], ["en", en.get(k) ?? ""]]) {
    if (/(^|[^'])'([^']|$)/.test(s)) loiKho.push(`nháy đơn chưa viết đôi (${ten}): ${k}`);
  }
}
for (const k of en.keys()) if (!vi.has(k)) loiKho.push(`có tiếng Anh nhưng thiếu tiếng Việt: ${k}`);
const cauViet = new Set([...vi.values()].map((v) => v.replace(/''/g, "'").trim()));

// Mã nguồn
const tatCa = (dsDuongDan.length ? dsDuongDan : [JAVA]).flatMap((x) => (fs.statSync(x).isDirectory() ? lietKe(x) : [x]));
const boChuThich = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"\\])\/\/(?!.*i18n-giu-nguyen).*$/gm, "$1");
const ketQua = [];
const khoaThieu = new Map();
for (const tep of tatCa) {
  const goc = fs.readFileSync(tep, "utf8");
  const ma = boChuThich(goc);
  const dongGoc = goc.split(/\r?\n/);
  const soDong = (i) => ma.slice(0, i).split("\n").length;
  const giuNguyen = (so) => /i18n-giu-nguyen/.test(dongGoc[so - 1] ?? "") || /i18n-giu-nguyen/.test(dongGoc[so - 2] ?? "");
  const sot = [];
  const ghi = (i, chu) => { const so = soDong(i); if (!giuNguyen(so)) sot.push(`${so}: ${chu.replace(/\s+/g, " ").slice(0, 110)}`); };
  for (const m of ma.matchAll(/\bnew (\w*(?:Exception|Error))\(((?:[^;]|"(?:[^"\\]|\\.)*")*?)\)\s*[;)]/g)) {
    if (/ThongDiep\./.test(m[2])) continue;
    const chuoi = [...m[2].matchAll(/"(?:[^"\\\n]|\\.)*"/g)].map((x) => x[0]).filter((x) => VN.test(x));
    if (chuoi.length) ghi(m.index, `new ${m[1]}(${chuoi.join(" + ")})`);
  }
  for (const m of ma.matchAll(/\.message\(\s*("(?:[^"\\\n]|\\.)*")/g)) if (VN.test(m[1])) ghi(m.index, `.message(${m[1]})`);
  for (const m of ma.matchAll(/@\w+\([^)]*?message\s*=\s*"((?:[^"\\\n]|\\.)*)"/g)) {
    if (VN.test(m[1]) && !cauViet.has(m[1].trim())) ghi(m.index, `annotation chưa có trong kho câu: "${m[1]}"`);
  }
  for (const m of ma.matchAll(/ThongDiep\.(?:of|vi|dich)\(\s*"([^"]+)"/g)) if (!vi.has(m[1])) khoaThieu.set(m[1], `${path.relative(GOC, tep)}:${soDong(m.index)}`);
  if (sot.length) ketQua.push({ tep: path.relative(GOC, tep).split(path.sep).join("/"), sot });
}

const tongSot = ketQua.reduce((s, x) => s + x.sot.length, 0);
for (const { tep, sot } of ketQua) {
  console.log(`${tep}: ${sot.length}`);
  if (chiTiet) for (const x of sot) console.log(`  ${x}`);
}
for (const [k, noi] of khoaThieu) console.log(`[khóa chưa có trong tệp tiếng Việt] ${k}  (${noi})`);
for (const x of loiKho) console.log(`[kho câu] ${x}`);
console.log(`\nTệp: ${tatCa.length} · Câu chữ còn sót: ${tongSot} · Khóa thiếu: ${khoaThieu.size} · Lỗi kho câu: ${loiKho.length} · Khóa: ${vi.size}`);
process.exitCode = tongSot || khoaThieu.size || loiKho.length ? 1 : 0;
