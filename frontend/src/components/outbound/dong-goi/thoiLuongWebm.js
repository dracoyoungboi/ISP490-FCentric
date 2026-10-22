/*
 * Ghi thời lượng vào tệp WebM do MediaRecorder quay. Trình duyệt ghi tệp theo kiểu phát trực tiếp: Segment không có
 * kích thước, phần Info không có Duration — trình phát báo thời lượng Infinity, thanh tua không dùng được (khó xem lại
 * video dài). Thêm phần tử Duration (0x4489, float64, đơn vị TimecodeScale) vào Info là đủ để tua.
 * Hàm thuần trên mảng byte (không React) để chạy `node --test`. Cấu trúc lạ thì trả null — nơi gọi tải tệp gốc.
 */

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_SEEK_HEAD = 0x114d9b74;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_CLUSTER = 0x1f43b675;
const TIMECODE_SCALE_MAC_DINH = 1000000; // ns

/** Đọc ID phần tử (giữ cả bit đánh dấu độ dài, như cách viết ID trong đặc tả). */
function docId(b, i) {
  const dau = b[i];
  let dai = 0;
  for (let m = 0x80; m >= 0x10 && !(dau & m); m >>= 1) dai++;
  dai += 1;
  if (dai > 4 || i + dai > b.length) return null;
  let id = 0;
  for (let k = 0; k < dai; k++) id = id * 256 + b[i + k];
  return { id, dai };
}

/** Đọc kích thước (số nguyên độ dài thay đổi). `khongRo`: mọi bit giá trị đều là 1 (kích thước không xác định). */
function docKichThuoc(b, i) {
  const dau = b[i];
  let dai = 1;
  while (dai <= 8 && !(dau & (0x100 >> dai))) dai++;
  if (dai > 8 || i + dai > b.length) return null;
  let giaTri = dau & (0xff >> dai);
  let tatCaMot = giaTri === 0xff >> dai;
  for (let k = 1; k < dai; k++) {
    giaTri = giaTri * 256 + b[i + k];
    if (b[i + k] !== 0xff) tatCaMot = false;
  }
  return { giaTri, dai, khongRo: tatCaMot };
}

/** Viết kích thước `giaTri` thành số nguyên độ dài thay đổi dài đúng `dai` byte; không vừa thì null. */
function vietKichThuoc(giaTri, dai) {
  if (dai < 1 || dai > 8 || giaTri >= 2 ** (7 * dai) - 1) return null;
  const ra = new Uint8Array(dai);
  let con = giaTri;
  for (let k = dai - 1; k >= 0; k--) {
    ra[k] = con % 256;
    con = Math.floor(con / 256);
  }
  ra[0] |= 0x100 >> dai;
  return ra;
}

function docPhanTu(b, i) {
  const id = docId(b, i);
  if (!id) return null;
  const kt = docKichThuoc(b, i + id.dai);
  if (!kt) return null;
  const batDauDuLieu = i + id.dai + kt.dai;
  return { id: id.id, viTri: i, dauDai: id.dai + kt.dai, kt, batDauDuLieu, ketThuc: kt.khongRo ? null : batDauDuLieu + kt.giaTri };
}

function docSoNguyen(b, tu, den) {
  let v = 0;
  for (let k = tu; k < den; k++) v = v * 256 + b[k];
  return v;
}

function float64(giaTri) {
  const ra = new Uint8Array(8);
  new DataView(ra.buffer).setFloat64(0, giaTri);
  return ra;
}

/**
 * Trả bản sao `bytes` (Uint8Array) có Duration = `thoiLuongMs` (mili giây); Duration có sẵn mà bằng 0 / Infinity thì
 * ghi đè tại chỗ. Trả null (dùng tệp gốc) khi: đã có thời lượng hợp lệ, không phải WebM, Segment có SeekHead trước Info
 * (Chrome mới ghi tệp đầy đủ kiểu này; đổi độ dài Info làm lệch vị trí SeekHead trỏ tới), kích thước không đủ chỗ…
 * Đã thử trên tệp VP9 thật của Chrome (22/10/2026): tệp kiểu phát trực tiếp báo Infinity, ghi xong tua được.
 */
export function ghiThoiLuongWebm(bytes, thoiLuongMs) {
  if (!(bytes instanceof Uint8Array) || !(thoiLuongMs > 0) || !Number.isFinite(thoiLuongMs)) return null;
  const ebml = docPhanTu(bytes, 0);
  if (!ebml || ebml.id !== ID_EBML || ebml.ketThuc == null) return null;
  const seg = docPhanTu(bytes, ebml.ketThuc);
  if (!seg || seg.id !== ID_SEGMENT) return null;

  // Tìm Info trong các phần tử con đầu tiên của Segment (trước Cluster đầu)
  let i = seg.batDauDuLieu;
  let info = null;
  while (i < bytes.length) {
    const pt = docPhanTu(bytes, i);
    if (!pt || pt.ketThuc == null || pt.ketThuc > bytes.length) return null;
    if (pt.id === ID_SEEK_HEAD || pt.id === ID_CLUSTER) return null;
    if (pt.id === ID_INFO) {
      info = pt;
      break;
    }
    i = pt.ketThuc;
  }
  if (!info) return null;

  let timecodeScale = TIMECODE_SCALE_MAC_DINH;
  let duration = null;
  for (let j = info.batDauDuLieu; j < info.ketThuc; ) {
    const con = docPhanTu(bytes, j);
    if (!con || con.ketThuc == null || con.ketThuc > info.ketThuc) return null;
    if (con.id === ID_TIMECODE_SCALE) timecodeScale = docSoNguyen(bytes, con.batDauDuLieu, con.ketThuc) || TIMECODE_SCALE_MAC_DINH;
    if (con.id === ID_DURATION) duration = con;
    j = con.ketThuc;
  }
  const giaTri = (thoiLuongMs * 1e6) / timecodeScale;

  if (duration) {
    const dai = duration.ketThuc - duration.batDauDuLieu;
    if (dai !== 4 && dai !== 8) return null;
    // Đã có thời lượng hợp lệ (Chrome mới tự ghi khi dừng quay): giữ nguyên, số của trình duyệt chính xác hơn
    const dvGoc = new DataView(bytes.buffer, bytes.byteOffset + duration.batDauDuLieu, dai);
    const cu = dai === 8 ? dvGoc.getFloat64(0) : dvGoc.getFloat32(0);
    if (Number.isFinite(cu) && cu > 0) return null;
    const ra = bytes.slice();
    const dv = new DataView(ra.buffer, duration.batDauDuLieu, dai);
    if (dai === 8) dv.setFloat64(0, giaTri);
    else dv.setFloat32(0, giaTri);
    return ra;
  }

  // Thêm Duration (ID 2 byte + kích thước 1 byte + 8 byte giá trị) vào cuối Info, sửa kích thước Info (và Segment nếu
  // Segment có kích thước)
  const them = new Uint8Array([0x44, 0x89, 0x88, ...float64(giaTri)]);
  const ktInfoMoi = vietKichThuoc(info.kt.giaTri + them.length, info.kt.dai);
  if (!ktInfoMoi) return null;
  let ktSegMoi = null;
  if (!seg.kt.khongRo) {
    ktSegMoi = vietKichThuoc(seg.kt.giaTri + them.length, seg.kt.dai);
    if (!ktSegMoi) return null;
  }
  const idSegDai = seg.dauDai - seg.kt.dai;
  const idInfoDai = info.dauDai - info.kt.dai;
  const ra = new Uint8Array(bytes.length + them.length);
  let o = 0;
  const chep = (tu, den) => {
    ra.set(bytes.subarray(tu, den), o);
    o += den - tu;
  };
  chep(0, seg.viTri + idSegDai);
  if (ktSegMoi) {
    ra.set(ktSegMoi, o);
    o += ktSegMoi.length;
  } else chep(seg.viTri + idSegDai, seg.batDauDuLieu);
  chep(seg.batDauDuLieu, info.viTri + idInfoDai);
  ra.set(ktInfoMoi, o);
  o += ktInfoMoi.length;
  chep(info.batDauDuLieu, info.ketThuc);
  ra.set(them, o);
  o += them.length;
  chep(info.ketThuc, bytes.length);
  return ra;
}
