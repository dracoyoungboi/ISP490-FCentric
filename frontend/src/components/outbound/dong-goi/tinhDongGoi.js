/*
 * Hàm thuần của màn Đóng gói đơn hàng (`/goods-issues/packing/:donId`): trạng thái phiên, dòng, tiến độ, bằng chứng,
 * lý do khóa Hoàn tất, tiến trình, thông báo, đơn cùng phiếu nhặt. Không React, không alias "@/…" để chạy `node --test`.
 *
 * Phiên (PhienDongGoiDto, GET /dong-goi/don/{id}): đơn, phiếu xuất (`trangThaiPhieu` 0 Nháp = đang đóng gói, 6 Chờ xuất,
 * 3 Đã xuất, 4 Đã hủy), `items` (mỗi dòng đơn một dòng phiếu), `biHuy` (đơn hủy HOẶC phiếu xuất hủy), bằng chứng gắn
 * theo ĐƠN (`danhSachBangChung`, tự xóa sau `ngayHetHan`). Yêu cầu bằng chứng: GET /dong-goi/don/{id}/bang-chung
 * (`yeuCauVideo`, `huongDan`, `soLuongHienCo`, `soLuongYeuCau`, `thoiLuongVideoToiThieu`, `thoiLuongVideoToiDa`) — giao
 * diện không tự đặt ngưỡng tiền.
 */
import { CANH_BAO_TU_DUNG_VIDEO_GIAY, DUNG_LUONG_VIDEO_TOI_DA_MB, THOI_LUONG_VIDEO_DONG_GOI } from "../../../config/bangChungTu.js";
import { TRANG_THAI_DON, TRANG_THAI_PHIEU_XUAT } from "../../../constants/trangThaiXuatBan.js";
import { docSo, nhanMauKichCo, soVN } from "../../chung-tu/bangChungTu.js";
import { laDaXuat } from "../phieu-xuat/phieuXuat.js";

/** Loại bằng chứng (LoaiBangChungDongGoi của máy chủ) và tên ô khi chưa có tệp (máy chủ trả `tenLoaiBangChung` khi có). */
export const LOAI_BANG_CHUNG = Object.freeze({
  ANH_HANG_TRONG_HOP: "ANH_HANG_TRONG_HOP",
  ANH_NIEM_PHONG_TEM_VC: "ANH_NIEM_PHONG_TEM_VC",
  VIDEO_DONG_GOI: "VIDEO_DONG_GOI",
});
const TEN_LOAI = Object.freeze({
  ANH_HANG_TRONG_HOP: "Ảnh hàng đã cho vào hộp/túi",
  ANH_NIEM_PHONG_TEM_VC: "Ảnh hộp dán băng keo niêm phong kèm tem vận chuyển",
  VIDEO_DONG_GOI: "Video đóng gói từ lúc cho đồ vào đến khi niêm phong",
});
const GOI_Y_LOAI = Object.freeze({
  ANH_HANG_TRONG_HOP: "Bấm Chụp ảnh hoặc chọn ảnh có sẵn.",
  ANH_NIEM_PHONG_TEM_VC: "Chụp rõ tem của đơn vị vận chuyển.",
  VIDEO_DONG_GOI: "Bấm Quay video, quay liên tục đến khi dán niêm phong.",
});

const PX = TRANG_THAI_PHIEU_XUAT;

/**
 * Tình huống của phiên:
 * - `suaDuoc`: phiếu Nháp, chưa bị hủy → quét, chụp, xóa bằng chứng, Hoàn tất.
 * - `xong`: đã đóng gói (Chờ xuất); `daXuat`: phiếu đã xuất kho (mở lại chỉ xem).
 * - `donHuy`: đơn bị hủy (chỉ sàn hủy được ở bước này) → toàn bộ hàng về khu hoàn kệ.
 * - `pxHuy`: chỉ phiếu xuất bị hủy, đơn còn hiệu lực → tạo lại phiếu xuất ở màn đơn bán.
 */
export function tinhHuongPhien(phien) {
  const ttPhieu = Number(phien?.trangThaiPhieu);
  const donHuy = Boolean(phien?.biHuy) && Number(phien?.trangThaiDon) === TRANG_THAI_DON.DA_HUY;
  const pxHuy = !donHuy && (Boolean(phien?.biHuy) || ttPhieu === PX.DA_HUY);
  const daXuat = !donHuy && !pxHuy && laDaXuat({ trangThai: ttPhieu });
  const xong = !donHuy && !pxHuy && (ttPhieu === PX.CHO_XUAT || daXuat);
  return { suaDuoc: !donHuy && !pxHuy && ttPhieu === PX.NHAP, xong, daXuat, donHuy, pxHuy, biHuy: donHuy || pxHuy };
}

/** Dòng chứng từ (bangChungTu.js, phân trang theo dòng) từ `items`: số cần, đã quét, còn lại, đủ. */
export function dongDongGoi(items) {
  return (Array.isArray(items) ? items : []).filter(Boolean).map((x, i) => {
    const can = docSo(x.soLuongCan);
    const da = docSo(x.soLuongDaQuet);
    return {
      id: x.chiTietId ?? `dong-${i}`,
      thuTu: i,
      tenSanPham: x.tenSanPham || x.maSku || "",
      tenMau: x.tenMau || "",
      kichCo: x.tenSize || "",
      nhanBienThe: nhanMauKichCo({ tenMau: x.tenMau, kichCo: x.tenSize }),
      sku: x.maSku || "",
      maVach: x.maVachSku || "",
      can,
      da,
      con: Math.max(0, can - da),
      du: can > 0 && da >= can,
      phanTram: can > 0 ? Math.min(100, Math.round((da / can) * 100)) : 0,
    };
  });
}

/** Dòng chưa đủ lên trước, giữ thứ tự phiếu trong mỗi nhóm. */
export const xepDongDongGoi = (dong) => [...(Array.isArray(dong) ? dong : [])].sort((a, b) => Number(a.du) - Number(b.du) || a.thuTu - b.thuTu);

/** Tiến độ cả phiếu: đã quét / cần, số dòng đủ. Phiếu đã đóng gói xong (Chờ xuất, Đã xuất) coi như quét đủ. */
export function tienDoDongGoi(dong, { xong = false } = {}) {
  const ds = Array.isArray(dong) ? dong : [];
  const can = ds.reduce((s, d) => s + d.can, 0);
  const da = xong ? can : ds.reduce((s, d) => s + Math.min(d.da, d.can), 0);
  const dongDu = xong ? ds.length : ds.filter((d) => d.du).length;
  return { can, da, conLai: Math.max(0, can - da), dongDu, soDong: ds.length, phanTram: can > 0 ? Math.min(100, Math.round((da / can) * 100)) : 0 };
}

/**
 * Các ô bằng chứng cần có theo yêu cầu của máy chủ: video → 1 ô video; không → 2 ô ảnh (hàng trong hộp, niêm phong
 * kèm tem). Mỗi ô `{ loai, ten, goiY, laVideo, bangChung }` (`bangChung` đang hoạt động cùng loại, hoặc null).
 */
export function oBangChung({ yeuCauVideo = false, danhSach = [] } = {}) {
  const loai = yeuCauVideo
    ? [LOAI_BANG_CHUNG.VIDEO_DONG_GOI]
    : [LOAI_BANG_CHUNG.ANH_HANG_TRONG_HOP, LOAI_BANG_CHUNG.ANH_NIEM_PHONG_TEM_VC];
  const ds = Array.isArray(danhSach) ? danhSach : [];
  return loai.map((l) => {
    const bc = ds.find((b) => b?.loaiBangChung === l) ?? null;
    return { loai: l, ten: bc?.tenLoaiBangChung || TEN_LOAI[l], goiY: GOI_Y_LOAI[l], laVideo: l === LOAI_BANG_CHUNG.VIDEO_DONG_GOI, bangChung: bc };
  });
}

/** "1/2 ảnh" / "0/1 video" (số đã có theo các ô cần, số yêu cầu của máy chủ — thiếu thì theo số ô). */
export function chuSoBangChung(o, { yeuCauVideo = false, soLuongYeuCau } = {}) {
  const co = (Array.isArray(o) ? o : []).filter((x) => x.bangChung).length;
  const can = docSo(soLuongYeuCau) || (Array.isArray(o) ? o.length : 0);
  return `${soVN(co)}/${soVN(can)} ${yeuCauVideo ? "video" : "ảnh"}`;
}

/**
 * Bằng chứng đã tự xóa sau hạn lưu: phiếu đã đóng gói xong (Chờ xuất / Đã xuất) bằng bước quét (có dòng đã quét) mà
 * không còn tệp nào — lúc hoàn tất máy chủ đã bắt đủ bằng chứng, rồi job dọn tệp quá hạn lưu (`ngayHetHan`) xóa đi.
 * Phiếu đã xuất từ trước khi có bước đóng gói (không dòng nào được quét) thì chưa từng có bằng chứng: không suy "hết hạn".
 */
export function bangChungHetHan(tinhHuong, danhSach, items = []) {
  const coQuet = (Array.isArray(items) ? items : []).some((x) => docSo(x?.soLuongDaQuet) > 0);
  return Boolean(tinhHuong?.xong) && coQuet && !(Array.isArray(danhSach) && danhSach.length);
}

/** Không đọc được thời lượng của tệp video chọn từ máy. */
export const CAU_KHONG_DOC_THOI_LUONG = "Không đọc được thời lượng video. Chọn tệp video khác.";

/**
 * Khoảng thời lượng video `{ toiThieu, toiDa }` (giây) theo máy chủ (`thoiLuongVideoToiThieu`, `thoiLuongVideoToiDa` của
 * phiên hoặc thông tin bằng chứng). Thiếu hoặc vô lý (không phải số nguyên dương, tối thiểu lớn hơn tối đa) → số trong config.
 */
export function gioiHanVideo(nguon) {
  const toiThieu = Number(nguon?.thoiLuongVideoToiThieu);
  const toiDa = Number(nguon?.thoiLuongVideoToiDa);
  const hopLe = Number.isInteger(toiThieu) && Number.isInteger(toiDa) && toiThieu > 0 && toiThieu <= toiDa;
  return hopLe ? { toiThieu, toiDa } : THOI_LUONG_VIDEO_DONG_GOI;
}

/** 15 → "15 giây", 180 → "3 phút", 150 → "2 phút 30 giây" (trùng cách viết của máy chủ). */
export function chuThoiLuong(giay) {
  const phut = Math.floor(giay / 60);
  const du = giay % 60;
  if (phut === 0) return `${giay} giây`;
  return du === 0 ? `${phut} phút` : `${phut} phút ${du} giây`;
}

/** "15 giây – 3 phút" (nhãn ngắn). */
export const khoangVideoNgan = (gioiHan = THOI_LUONG_VIDEO_DONG_GOI) =>
  `${chuThoiLuong(gioiHan.toiThieu)} – ${chuThoiLuong(gioiHan.toiDa)}`;

/** Câu lỗi thời lượng video — trùng câu máy chủ ("Thời lượng video đóng gói phải từ 15 giây đến 3 phút (Nhận được: 9 giây)!"). */
export function cauThoiLuongVideo(giay, gioiHan = THOI_LUONG_VIDEO_DONG_GOI) {
  const khoang = `từ ${chuThoiLuong(gioiHan.toiThieu)} đến ${chuThoiLuong(gioiHan.toiDa)}`;
  return `Thời lượng video đóng gói phải ${khoang} (Nhận được: ${giay} giây)!`;
}

/**
 * Thời lượng gửi máy chủ (giây nguyên) của video dài `giay` (số thực): vượt mốc tối đa dưới 1 giây thì tính bằng mốc
 * (clip điện thoại hiện "3:00" thật ra 180,6 giây; bộ đếm tự dừng trễ vài trăm mili giây); còn lại làm tròn. Không kẹp
 * video dài hơn hẳn — máy chủ tin số này. Không đọc được → null.
 */
export function thoiLuongGuiLen(giay, gioiHan = THOI_LUONG_VIDEO_DONG_GOI) {
  if (!Number.isFinite(giay) || giay < 0) return null;
  return giay > gioiHan.toiDa && giay < gioiHan.toiDa + 1 ? gioiHan.toiDa : Math.round(giay);
}

/** Thời lượng (giây, làm tròn) có nằm trong khoảng cho phép không. */
export const thoiLuongHopLe = (giay, gioiHan = THOI_LUONG_VIDEO_DONG_GOI) =>
  Number.isFinite(giay) && giay >= gioiHan.toiThieu && giay <= gioiHan.toiDa;

/** Đang quay: còn ≤ `canhBao` giây là tới mốc tự dừng thì trả số giây còn lại ("Tự dừng sau n giây"), chưa tới → null. */
export function giayTuDung(giay, gioiHan = THOI_LUONG_VIDEO_DONG_GOI, canhBao = CANH_BAO_TU_DUNG_VIDEO_GIAY) {
  const conLai = gioiHan.toiDa - giay;
  return conLai <= canhBao ? Math.max(0, conLai) : null;
}

/** Tệp video vượt dung lượng máy chủ nhận (MB, tính theo 1 MB = 1024 × 1024 byte như máy chủ). */
export const videoQuaLon = (bytes, toiDaMb = DUNG_LUONG_VIDEO_TOI_DA_MB) => Number(bytes) > toiDaMb * 1024 * 1024;

/** Câu báo video quá lớn, chặn trước khi tải: tệp chọn từ máy gợi ý quay ngay trên trang; video vừa quay gợi ý quay ngắn hơn. */
export function cauVideoQuaLon(bytes, { daQuay = false, toiDaMb = DUNG_LUONG_VIDEO_TOI_DA_MB } = {}) {
  const mb = soVN(Math.ceil(Number(bytes) / (1024 * 1024)));
  return daQuay
    ? `Video vừa quay ${mb} MB, vượt ${soVN(toiDaMb)} MB. Hãy quay lại ngắn hơn.`
    : `Tệp ${mb} MB, vượt ${soVN(toiDaMb)} MB. Hãy bấm Quay video để quay ngay trên trang, hoặc chọn video ngắn hơn.`;
}

/** Phần trăm đã gửi lên (sự kiện tiến độ của axios); không biết tổng → null. */
export function phanTramTaiLen(suKien) {
  const tong = Number(suKien?.total);
  if (!(tong > 0)) return null;
  return Math.min(100, Math.max(0, Math.floor((Number(suKien.loaded) * 100) / tong)));
}

/**
 * Lý do khóa "Hoàn tất đóng gói" (khớp coTheHoanTat của máy chủ: quét đủ + đủ bằng chứng + phiếu Nháp + không hủy) và
 * mã đang chờ ghi nhận. Đủ điều kiện → "".
 */
export function lyDoKhoaHoanTat({ conLai = 0, duBangChung = false, yeuCauVideo = false, soThieu = 0, dangCho = 0 } = {}) {
  const ly = [];
  if (conLai > 0) ly.push(`còn ${soVN(conLai)} sản phẩm chưa quét`);
  if (!duBangChung) ly.push(yeuCauVideo ? "thiếu video đóng gói" : `thiếu ${soVN(Math.max(1, soThieu))} ảnh đóng gói`);
  if (dangCho > 0) ly.push(`còn ${soVN(dangCho)} mã đang ghi nhận`);
  return ly.join(", ");
}

/**
 * Tiến trình 3 bước: Quét đủ hàng → Bằng chứng (`1/2 ảnh`) → Hoàn tất (bị hủy: "Đã khóa đóng gói", dừng).
 */
export function buocDongGoi({ tinhHuong, tienDo, duBangChung = false, chuBangChung = "", hetHan = false }) {
  const th = tinhHuong ?? {};
  const b1 = (tienDo?.conLai ?? 1) === 0 ? "xong" : th.biHuy ? "chua" : "dangLam";
  const b2 = hetHan || duBangChung ? "xong" : b1 === "xong" && !th.biHuy ? "dangLam" : "chua";
  const b3 = th.biHuy ? "dung" : th.xong ? "xong" : b1 === "xong" && b2 === "xong" ? "dangLam" : "chua";
  return [
    { ma: "quet", nhan: "Quét đủ hàng", trangThai: b1 },
    { ma: "bangChung", nhan: "Bằng chứng", trangThai: b2, phu: hetHan ? "Đã tự xóa sau hạn lưu" : chuBangChung },
    {
      ma: "hoanTat",
      nhan: th.biHuy ? "Đã khóa đóng gói" : "Hoàn tất",
      trangThai: b3,
      phu: th.daXuat ? "Đã xuất kho" : th.xong ? "Chờ xác nhận xuất kho" : "",
    },
  ];
}

/**
 * Dòng thông báo `{ ma, tone, chu, moDon? }`. `doiKho`: tên kho vừa tự chuyển nơi làm việc sang (nếu có).
 * `nhanTrangThaiDon`: tên trạng thái đơn hiện tại (cho câu phiếu xuất bị hủy).
 */
export function thongBaoDongGoi(phien, { tinhHuong, hetHan = false, doiKho = null, nhanTrangThaiDon = "" } = {}) {
  const th = tinhHuong ?? tinhHuongPhien(phien);
  const so = phien?.soDonHang || "";
  const px = phien?.soPhieuXuat || "";
  const ds = [];
  if (doiKho) ds.push({ ma: "doiKho", tone: "info", chu: `Đã chuyển nơi làm việc sang ${doiKho} để mở phiên đóng gói của đơn này.` });
  if (th.donHuy) {
    const tong = (Array.isArray(phien?.items) ? phien.items : []).reduce((s, x) => s + docSo(x?.soLuongCan), 0);
    const san = String(phien?.tenKenh ?? "").trim();
    ds.push({
      ma: "donHuy",
      tone: "bad",
      chu: `Đơn ${so} đã bị hủy${san ? ` trên ${san}` : ""} nên hệ thống đã khóa đóng gói. Chuyển toàn bộ ${soVN(tong)} sản phẩm của đơn về khu hoàn kệ.`,
    });
  }
  if (th.pxHuy) {
    ds.push({
      ma: "pxHuy",
      tone: "bad",
      chu: `Phiếu xuất ${px} đã bị hủy nên đã khóa đóng gói. Đơn ${so} vẫn còn hiệu lực${nhanTrangThaiDon ? ` (${nhanTrangThaiDon})` : ""}: bấm Tạo lại phiếu xuất ở màn đơn bán hàng; phiếu mới phải quét lại từ đầu.`,
      moDon: true,
    });
  }
  if (hetHan) ds.push({ ma: "hetHan", tone: "neutral", chu: "Tệp bằng chứng của đơn đã tự xóa sau hạn lưu." });
  if (th.xong && !th.daXuat) ds.push({ ma: "xong", tone: "ok", chu: `Đã đóng gói xong. Phiếu xuất ${px} chờ xác nhận xuất kho.` });
  return ds;
}

/**
 * Câu phản hồi khi quét được mà máy chủ không trả `thongBao`: dựng như câu của máy chủ
 * "Đã quét 1x {tên} [SKU] (x/y)" từ dòng vừa quét (PhienDongGoiDto.items).
 */
export function cauDaQuet(soLuong, dong, ma) {
  if (!dong) return `Đã quét ${soVN(soLuong)}x [${ma}]`;
  return `Đã quét ${soVN(soLuong)}x ${dong.tenSanPham || dong.maSku} [${dong.maSku}] (${soVN(dong.soLuongDaQuet)}/${soVN(dong.soLuongCan)})`;
}

/** Câu phụ dưới phản hồi quét, theo câu lỗi của máy chủ (DongGoiServiceImpl.quet). */
export function cauPhuPhanHoi(cau) {
  const c = String(cau ?? "");
  if (/không thuộc đơn/i.test(c)) return "Kiểm lại sản phẩm vừa lấy, có thể nhặt nhầm.";
  if (/đã đóng gói đủ số lượng/i.test(c)) return "Không cho thêm vào hộp.";
  if (/vượt quá yêu cầu/i.test(c)) return "Giảm số lượng mỗi lần quét rồi quét lại.";
  return "";
}

/**
 * Đơn cùng phiếu nhặt (DanhSachNhatHangDto.danhSachDonHang) cho cột phải: tóm tắt, danh sách (giữ thứ tự của phiếu
 * nhặt) và đơn tiếp theo còn Chờ đóng gói (khác đơn đang mở).
 */
export function donCungPhieuNhat(dsDon, donDangMoId) {
  const ds = (Array.isArray(dsDon) ? dsDon : []).filter((d) => d && d.id != null);
  const conCho = ds.filter((d) => Number(d.trangThai) === TRANG_THAI_DON.CHO_DONG_GOI && !d.biHuy);
  const tiep = conCho.find((d) => String(d.id) !== String(donDangMoId)) ?? null;
  const tomTat = ds.length > 1 ? `${soVN(ds.length)} đơn · ${soVN(conCho.length)} còn chờ đóng gói` : "Phiếu nhặt chỉ có đơn này";
  return { ds, tiep, tomTat };
}

/** "Trần Văn Kiên · 10:52 · 31,4 MB · lưu đến 20/11" (thiếu phần nào bỏ phần đó). `dinhGio`, `dinhNgay`: hàm định dạng. */
export function chuThongTinTep(bc, { dinhGio, dinhNgay } = {}) {
  if (!bc) return "";
  const mb = bc.kichThuocBytes != null && Number(bc.kichThuocBytes) > 0
    ? `${(Number(bc.kichThuocBytes) / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`
    : "";
  const phan = [
    bc.tenNguoiTao || "",
    bc.ngayTao && dinhGio ? dinhGio(bc.ngayTao) : "",
    mb,
    bc.ngayHetHan && dinhNgay ? `lưu đến ${dinhNgay(bc.ngayHetHan)}` : "",
  ];
  return phan.filter(Boolean).join(" · ");
}

/**
 * Chuẩn hóa URL hiển thị bằng chứng đóng gói:
 * - URL đầy đủ (HTTP/HTTPS/blob/data): giữ nguyên.
 * - Đường dẫn tương đối MinIO (dữ liệu cũ "packing-proofs/..."): ghép origin MinIO công khai HTTPS.
 */
export function resolveProofMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("packing-proofs/")) {
    return `https://minio.slmglobal.vn/fashion/${url}`;
  }
  return url;
}
