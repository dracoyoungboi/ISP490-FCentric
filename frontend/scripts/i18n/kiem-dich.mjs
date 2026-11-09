#!/usr/bin/env node
/**
 * Kiểm đa ngôn ngữ của frontend: `node scripts/i18n/kiem-dich.mjs [thư-mục-hoặc-tệp ...] [--chi-tiet] [--json]`
 *
 * 1. CHƯA BỌC: câu có dấu tiếng Việt hiện ra giao diện mà chưa đi qua t() (chữ trong JSX, thuộc tính, chuỗi, template).
 *    Bỏ qua: chú thích, khóa object, so sánh/tra cứu (===, includes, switch case…), console.*, import,
 *    đối số đầu của t()/tNeuChuoi(); tệp test, thư mục ở BO_QUA_THU_MUC (phan-tich.mjs).
 *    Cố ý giữ tiếng Việt: chú thích `i18n-giu-nguyen` trên dòng đó hoặc dòng ngay trên; cả tệp: `i18n-giu-nguyen-ca-tep`.
 * 2. THIẾU BẢN DỊCH: khóa t("…") viết thẳng mà không có trong src/i18n/en/*.json.
 * 3. LỆCH: một khóa có hai bản dịch khác nhau ở hai tệp en.
 * `--ghi-thieu <ten>`: thêm các khóa còn thiếu vào src/i18n/en/<ten>.json với giá trị rỗng để điền bản dịch.
 * Thoát mã 1 nếu còn lỗi.
 */
import fs from "node:fs";
import path from "node:path";
import {
  CO_DAU, GOC, THU_MUC_EN, chonTep, chuJsx, coKhoa, docCay, dongGiuNguyen, giuNguyenCaTep, laNgoaiLe, laTenHam, napBanDich, traverse,
} from "./phan-tich.mjs";

const thamSo = process.argv.slice(2);
const chiTiet = thamSo.includes("--chi-tiet");
const raJson = thamSo.includes("--json");
const viTriGhi = thamSo.indexOf("--ghi-thieu");
const tepGhi = viTriGhi >= 0 ? thamSo[viTriGhi + 1] : null;
const dsDuongDan = thamSo
  .filter((x, i) => !x.startsWith("--") && !(viTriGhi >= 0 && i === viTriGhi + 1))
  .map((x) => path.resolve(process.cwd(), x));
const CHI_T = new Set(["t"]);

function kiemTep(tep, gop) {
  const ma = fs.readFileSync(tep, "utf8");
  if (giuNguyenCaTep(ma)) return { chuaBoc: [], thieu: [] };
  let cay;
  try {
    cay = docCay(ma);
  } catch (loi) {
    return { chuaBoc: [{ dong: 0, chu: `KHÔNG ĐỌC ĐƯỢC TỆP: ${loi.message}` }], thieu: [] };
  }
  const giuNguyen = dongGiuNguyen(ma);
  const chuaBoc = [];
  const thieu = [];
  const ghi = (node, chu) => {
    const so = node.loc?.start.line ?? 0;
    if (!giuNguyen(so)) chuaBoc.push({ dong: so, chu: chu.replace(/\s+/g, " ").trim().slice(0, 100) });
  };
  traverse(cay, {
    StringLiteral(p) {
      if (CO_DAU.test(p.node.value) && !p.parentPath.isDirective?.() && !laNgoaiLe(p)) ghi(p.node, p.node.value);
    },
    TemplateLiteral(p) {
      const chu = p.node.quasis.map((q) => q.value.cooked ?? "").join("…");
      if (CO_DAU.test(chu) && !p.parentPath.isTaggedTemplateExpression() && !laNgoaiLe(p)) ghi(p.node, chu);
    },
    JSXText(p) {
      if (CO_DAU.test(p.node.value)) ghi(p.node, chuJsx(p.node.value));
    },
    CallExpression(p) {
      if (!laTenHam(p.node.callee, CHI_T)) return;
      const a = p.node.arguments[0];
      // Mọi khóa viết thẳng đều phải có bản dịch, kể cả câu không dấu ("In tem", "STT")
      if (a?.type === "StringLiteral" && /\p{L}/u.test(a.value) && !coKhoa(gop, a.value)) {
        thieu.push({ dong: a.loc?.start.line ?? 0, chu: a.value });
      } else if (a?.type === "StringLiteral" && !gop.has(a.value) && (gop.has(`${a.value}_one`) || gop.has(`${a.value}_other`))) {
        // Khóa chỉ có dạng số ít/nhiều: thiếu count thì tiếng Anh không tìm thấy câu, hiện lại tiếng Việt
        const tuyChon = p.node.arguments[1];
        const coTen = (ten) => tuyChon?.type === "ObjectExpression" && tuyChon.properties.some((x) => x.type === "SpreadElement" || x.key?.name === ten || x.key?.value === ten);
        if (!tuyChon || (tuyChon.type === "ObjectExpression" && !coTen("count") && !coTen("context"))) {
          thieu.push({ dong: a.loc?.start.line ?? 0, chu: `${a.value}  (khóa chỉ có _one/_other, chỗ gọi thiếu count)`, thieuCount: true });
        }
      } else if (a?.type === "TemplateLiteral" && a.expressions.length > 0) {
        chuaBoc.push({ dong: a.loc?.start.line ?? 0, chu: `t() nhận template có biến, phải viết t("…{{ten}}…", { ten })` });
      }
    },
  });
  return { chuaBoc, thieu };
}

const { gop, lech } = napBanDich();
const cacTep = chonTep(dsDuongDan);
const ketQua = [];
for (const tep of cacTep) {
  const { chuaBoc, thieu } = kiemTep(tep, gop);
  if (chuaBoc.length || thieu.length) ketQua.push({ tep: path.relative(GOC, tep).split(path.sep).join("/"), chuaBoc, thieu });
}
if (tepGhi) {
  const duongDan = path.join(THU_MUC_EN, `${tepGhi.replace(/\.json$/, "")}.json`);
  const cu = fs.existsSync(duongDan) ? JSON.parse(fs.readFileSync(duongDan, "utf8")) : {};
  let them = 0;
  for (const { thieu } of ketQua) for (const { chu, thieuCount } of thieu) if (!thieuCount && !(chu in cu)) { cu[chu] = ""; them++; }
  fs.writeFileSync(duongDan, JSON.stringify(cu, null, 2) + "\n");
  console.log(`Đã thêm ${them} khóa rỗng vào ${path.relative(GOC, duongDan)}`);
}
const tongChuaBoc = ketQua.reduce((s, x) => s + x.chuaBoc.length, 0);
const tongThieu = ketQua.reduce((s, x) => s + x.thieu.length, 0);

if (raJson) {
  console.log(JSON.stringify({ tongChuaBoc, tongThieu, lech, ketQua }, null, 2));
} else {
  for (const { tep, chuaBoc, thieu } of ketQua) {
    console.log(`${tep}: ${chuaBoc.length} chưa bọc, ${thieu.length} thiếu bản dịch`);
    if (chiTiet) {
      for (const x of chuaBoc) console.log(`  [chưa bọc] ${x.dong}: ${x.chu}`);
      for (const x of thieu) console.log(`  [thiếu]    ${x.dong}: ${x.chu}`);
    }
  }
  for (const x of lech) console.log(`[lệch] "${x.khoa}"\n  ${x.cac.join("\n  ")}`);
  console.log(`\nTệp kiểm: ${cacTep.length} · Chưa bọc: ${tongChuaBoc} · Thiếu bản dịch: ${tongThieu} · Lệch: ${lech.length}`);
}
process.exitCode = tongChuaBoc || tongThieu || lech.length ? 1 : 0;
