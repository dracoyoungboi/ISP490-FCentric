/**
 * Phần dùng chung của kiem-dich.mjs (kiểm) và boc-dich.mjs (tự bọc t()): tìm câu tiếng Việt hiện ra giao diện.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

export const traverse = traverseModule.default ?? traverseModule;
export const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SRC = path.join(GOC, "src");
export const THU_MUC_EN = path.join(SRC, "i18n", "en");

export const CO_DAU = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
export const HAM_DICH = new Set(["t", "tNeuChuoi", "dichNhanTrangThai"]);
const HAM_SO_KHOP = new Set([
  "includes", "startsWith", "endsWith", "indexOf", "lastIndexOf", "match", "matchAll", "test", "replace", "replaceAll",
  "split", "localeCompare", "has", "get", "set", "delete", "getItem", "setItem", "removeItem", "add", "normalize",
]);

/**
 * Thư mục không bọc t(): dữ liệu giả, mẫu in chứng từ (giữ tiếng Việt), chính bộ i18n, và constants/ — bảng nhãn dùng
 * chung cả cho mẫu in nên giữ tiếng Việt ở chỗ khai báo, nơi hiện ra màn hình dịch lúc vẽ: t(TRANG_THAI[x].label).
 */
export const BO_QUA_THU_MUC = [
  `${path.sep}mocks${path.sep}`,
  `${path.sep}components${path.sep}print${path.sep}`,
  `${path.sep}i18n${path.sep}`,
  `${path.sep}src${path.sep}constants${path.sep}`,
];

export function lietKe(thuMuc, ra = []) {
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const p = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) lietKe(p, ra);
    else if (/\.(jsx?|mjs)$/.test(muc.name) && !/\.test\./.test(muc.name)) ra.push(p);
  }
  return ra;
}

export function chonTep(dsDuongDan) {
  const tatCa = (dsDuongDan.length ? dsDuongDan : [SRC]).flatMap((x) => (fs.statSync(x).isDirectory() ? lietKe(x) : [x]));
  return tatCa.filter((tep) => !BO_QUA_THU_MUC.some((bo) => tep.includes(bo)));
}

export function docCay(ma) {
  return parse(ma, { sourceType: "module", plugins: ["jsx"], errorRecovery: true, ranges: true });
}

export function laTenHam(callee, tapTen) {
  if (!callee) return false;
  if (callee.type === "Identifier") return tapTen.has(callee.name);
  // a.b() và a?.b() (OptionalMemberExpression) — `x?.includes("…")` cũng là so khớp
  if ((callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") && !callee.computed && callee.property.type === "Identifier") {
    return tapTen.has(callee.property.name);
  }
  return false;
}

/** Chuỗi này KHÔNG phải chữ hiện ra (so khớp, khóa, console…) hoặc đã đi qua t(). */
export function laNgoaiLe(duongDi) {
  let p = duongDi;
  while (p.parentPath) {
    const cha = p.parentPath;
    const n = cha.node;
    if (cha.isCallExpression() || cha.isOptionalCallExpression() || cha.isNewExpression()) {
      // Chỉ khi chuỗi là ĐỐI SỐ trực tiếp của lời gọi đó (không tính `a("…").test(…)` của yup: chuỗi nằm ở bên gọi)
      const laDoiSo = n.arguments.includes(p.node);
      if (laTenHam(n.callee, HAM_DICH) && n.arguments[0] === p.node) return true;
      if (laDoiSo && laTenHam(n.callee, HAM_SO_KHOP)) return true;
      const c = n.callee;
      if (laDoiSo && c.type === "MemberExpression" && c.object.type === "Identifier" && c.object.name === "console") return true;
      if (laDoiSo && c.type === "Identifier" && c.name === "RegExp") return true;
    }
    if (cha.isBinaryExpression() && ["===", "!==", "==", "!=", "in"].includes(n.operator)) return true;
    if (cha.isSwitchCase() && n.test === p.node) return true;
    if ((cha.isObjectProperty() || cha.isObjectMethod() || cha.isClassProperty()) && n.key === p.node && !n.computed) return true;
    if (cha.isMemberExpression() && n.property === p.node) return true;
    if (cha.isImportDeclaration() || cha.isExportAllDeclaration() || (cha.isExportNamedDeclaration() && n.source === p.node)) return true;
    if (cha.isJSXAttribute()) {
      if (n.name?.name === "className" || n.name?.name === "key") return true;
      // StatusBadge nhận tên tiếng Việt và tự dịch lúc vẽ (tra màu theo tên Việt)
      const the = cha.parentPath?.node?.name;
      return n.name?.name === "label" && the?.type === "JSXIdentifier" && the.name === "StatusBadge";
    }
    if (cha.isStatement() || cha.isJSXElement() || cha.isJSXFragment() || cha.isProgram()) return false;
    p = cha;
  }
  return false;
}

export function giuNguyenCaTep(ma) {
  return /i18n-giu-nguyen-ca-tep/.test(ma.split(/\r?\n/).slice(0, 40).join("\n"));
}

export function dongGiuNguyen(ma) {
  const dong = ma.split(/\r?\n/);
  return (so) => /i18n-giu-nguyen/.test(dong[so - 1] ?? "") || /i18n-giu-nguyen/.test(dong[so - 2] ?? "");
}

/** Chữ JSX theo đúng quy tắc của React: bỏ khoảng trắng có xuống dòng ở hai đầu, nối các dòng bằng một dấu cách. */
export function chuJsx(giaTri) {
  const dong = giaTri.split(/\r\n|\n|\r/);
  let ra = "";
  dong.forEach((d, i) => {
    let s = d.replace(/\t/g, " ");
    if (i !== 0) s = s.replace(/^[ ]+/, "");
    if (i !== dong.length - 1) s = s.replace(/[ ]+$/, "");
    if (s) ra += (ra ? " " : "") + s;
  });
  return ra;
}

export function napBanDich() {
  const gop = new Map();
  const lech = [];
  if (!fs.existsSync(THU_MUC_EN)) return { gop, lech };
  for (const ten of fs.readdirSync(THU_MUC_EN).filter((x) => x.endsWith(".json")).sort()) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(path.join(THU_MUC_EN, ten), "utf8"));
    } catch (loi) {
      lech.push({ khoa: `(tệp ${ten} hỏng JSON)`, cac: [loi.message] });
      continue;
    }
    for (const [khoa, giaTri] of Object.entries(json)) {
      if (typeof giaTri !== "string" || !giaTri.trim()) {
        lech.push({ khoa, cac: [`${ten}: bản dịch rỗng`] });
        continue;
      }
      // Bản dịch chỉ được dùng tham số có trong câu gốc (count là tham số số nhiều)
      const thamSoGoc = new Set([...khoa.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]));
      const thua = [...giaTri.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).filter((x) => x !== "count" && !thamSoGoc.has(x));
      if (thua.length) lech.push({ khoa, cac: [`${ten}: bản dịch dùng tham số không có trong câu gốc: ${thua.join(", ")}`] });
      const cu = gop.get(khoa);
      if (cu && cu.giaTri !== giaTri) lech.push({ khoa, cac: [`${cu.tep}: ${cu.giaTri}`, `${ten}: ${giaTri}`] });
      else if (!cu) gop.set(khoa, { giaTri, tep: ten });
    }
  }
  return { gop, lech };
}

export function coKhoa(gop, khoa) {
  if (gop.has(khoa) || gop.has(`${khoa}_one`) || gop.has(`${khoa}_other`)) return true;
  for (const k of gop.keys()) if (k.startsWith(`${khoa}_`)) return true;
  return false;
}
