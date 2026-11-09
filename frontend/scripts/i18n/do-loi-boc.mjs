#!/usr/bin/env node
/**
 * Dò lỗi thường gặp sau khi bọc t(): `node scripts/i18n/do-loi-boc.mjs [--git <ref>]`
 *  1. MẤT KHOẢNG TRẮNG: số `{" "}` / `{' '}` trong tệp ít hơn so với bản ở git <ref> (mặc định HEAD).
 *  2. T TRONG SO KHỚP: t(...) là toán hạng của ===/!== hoặc đối số của includes/startsWith/… (so câu đã dịch).
 *  3. PHẦN TỬ JSX LÀM THAM SỐ: t("…", { x: <Jsx/> }) → hiện "[object Object]".
 *  4. THAM SỐ THIẾU: khóa có {{x}} mà object tham số không có x (và ngược lại).
 *  5. CHỮ CHƯA BỌC KHÔNG DẤU: chữ JSX / title / placeholder / aria-label / label viết thẳng mà không qua t()
 *     (công cụ chính chỉ bắt chữ có dấu). Chỉ để rà bằng mắt, có thể là tiếng Anh/mã cố ý.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { GOC, SRC, chonTep, docCay, giuNguyenCaTep, laTenHam, traverse } from "./phan-tich.mjs";

const thamSo = process.argv.slice(2);
const viTriGit = thamSo.indexOf("--git");
const ref = viTriGit >= 0 ? thamSo[viTriGit + 1] : "HEAD";
const SO_KHOP = new Set(["includes", "startsWith", "endsWith", "indexOf", "test", "match", "has", "localeCompare"]);
const THUOC_TINH_HIEN = new Set(["title", "placeholder", "aria-label", "label", "alt", "description", "tieuDe", "moTa", "nhan"]);
const CHU_TRANG = /\{\s*(["'])\s\1\s*\}/g;
const laT = (n) => n?.type === "CallExpression" && n.callee.type === "Identifier" && n.callee.name === "t";

const ketQua = { matKhoangTrang: [], tTrongSoKhop: [], jsxThamSo: [], lechThamSo: [], chuaBocKhongDau: [] };
for (const tep of chonTep([])) {
  const tuongDoi = path.relative(path.resolve(GOC, ".."), tep).split(path.sep).join("/");
  const ma = fs.readFileSync(tep, "utf8");
  let cu = "";
  try {
    cu = execFileSync("git", ["show", `${ref}:${tuongDoi}`], { cwd: GOC, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch { /* tệp mới */ }
  const demCu = (cu.match(CHU_TRANG) ?? []).length;
  const demMoi = (ma.match(CHU_TRANG) ?? []).length;
  if (cu && demMoi < demCu) ketQua.matKhoangTrang.push(`${tuongDoi}: ${demCu} → ${demMoi}`);
  if (giuNguyenCaTep(ma)) continue;
  let cay;
  try { cay = docCay(ma); } catch { continue; }
  const o = (n) => `${tuongDoi}:${n.loc?.start.line}`;
  traverse(cay, {
    CallExpression(p) {
      const n = p.node;
      if (laT(n)) {
        const [khoa, doi] = n.arguments;
        if (doi?.type === "ObjectExpression") {
          for (const pr of doi.properties) {
            if (pr.type === "ObjectProperty" && (pr.value.type === "JSXElement" || pr.value.type === "JSXFragment")) ketQua.jsxThamSo.push(o(n));
          }
        }
        if (khoa?.type === "StringLiteral") {
          const can = new Set([...khoa.value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]));
          const co = new Set();
          let coSpread = false;
          if (doi?.type === "ObjectExpression") {
            for (const pr of doi.properties) {
              if (pr.type === "SpreadElement") coSpread = true;
              else if (pr.key) co.add(pr.key.name ?? pr.key.value);
            }
          } else if (doi) coSpread = true;
          const thieu = [...can].filter((x) => !co.has(x) && x !== "count");
          if (!coSpread && thieu.length) ketQua.lechThamSo.push(`${o(n)} thiếu ${thieu.join(",")} — "${khoa.value.slice(0, 60)}"`);
        }
        const cha = p.parentPath;
        if (cha.isBinaryExpression() && ["===", "!==", "==", "!="].includes(cha.node.operator)) ketQua.tTrongSoKhop.push(`${o(n)} (so sánh)`);
        if ((cha.isCallExpression() || cha.isOptionalCallExpression()) && cha.node.arguments.includes(n) && laTenHam(cha.node.callee, SO_KHOP)) {
          ketQua.tTrongSoKhop.push(`${o(n)} (đối số ${cha.node.callee.property?.name})`);
        }
      }
    },
    JSXText(p) {
      const chu = p.node.value.replace(/\s+/g, " ").trim();
      if (/[A-Za-zÀ-ỹ]{2,}/.test(chu)) ketQua.chuaBocKhongDau.push(`${o(p.node)}  ${chu.slice(0, 60)}`);
    },
    JSXAttribute(p) {
      const ten = p.node.name?.name;
      if (THUOC_TINH_HIEN.has(ten) && p.node.value?.type === "StringLiteral" && /[A-Za-zÀ-ỹ]{2,}/.test(p.node.value.value)) {
        const the = p.parentPath.node.name?.name;
        if (!(ten === "label" && the === "StatusBadge")) ketQua.chuaBocKhongDau.push(`${o(p.node)}  ${ten}="${p.node.value.value.slice(0, 50)}"`);
      }
    },
  });
}
for (const [loai, ds] of Object.entries(ketQua)) {
  console.log(`\n== ${loai}: ${ds.length}`);
  for (const x of ds) console.log("  " + x);
}
