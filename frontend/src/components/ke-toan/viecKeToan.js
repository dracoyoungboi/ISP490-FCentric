import { t } from "../../i18n/t.js";

/**
 * Việc kế toán làm thêm trên AMIS ở màn Tạo lô xuất, xếp theo việc phải làm (không theo loại chứng từ).
 * Máy chủ gắn mã `viec` và số liệu `chiTiet` cho từng vấn đề (backend services/impl/ketoan/ViecKeToan.java); tệp này giữ
 * tầng, tiêu đề, đường dẫn trên AMIS, câu hướng dẫn và kiểu bảng của từng mã. Mã lạ hoặc không có mã: "Xem lại trước khi nhập".
 *
 * Ba tầng: `lam` cần làm sau khi nhập các tệp của lô · `cho` làm khi nhà cung cấp gửi hóa đơn · `xong` không cần lập.
 * `bang`: kiểu bảng ViecKeToanAmis vẽ — haoHut (cách xử lý chênh lệch, lý do, biên bản) · kho (kho, số lượng, ghi chú) · don (đơn, kho, số lượng) · cap (phiếu xuất ↔
 * phiếu nhập lại của đơn hủy) · hoaDon · phieuThu · tien · tonDauKy · hangLoi · noiDung (câu đầy đủ của máy chủ).
 */

export const TANG = [
  { ma: "lam", nhan: t("Cần làm trên AMIS"), moTa: t("Lập tay hoặc kiểm lại sau khi nhập các tệp của lô") },
  { ma: "cho", nhan: t("Làm khi có hóa đơn"), moTa: t("Không cần làm ngay, chờ nhà cung cấp gửi hóa đơn") },
  { ma: "xong", nhan: t("Không cần lập"), moTa: t("Hệ thống đã đối chiếu, chỉ để biết") },
];

const VIEC_XEM_LAI = {
  tang: "lam",
  tieuDe: t("Xem lại trước khi nhập"),
  huongDan: t("Hệ thống vẫn xuất các chứng từ này vào lô; xem lại để chắc số liệu trên AMIS đúng."),
  bang: "noiDung",
};

/** Thứ tự khai báo là thứ tự hiện trong tầng. */
export const VIEC = {
  xuat_kho_hao_hut: {
    tang: "lam",
    tieuDe: t("Lập phiếu xuất kho cho hao hụt chuyển kho"),
    amis: t("Kho › Xuất kho"),
    huongDan: t("Hàng thiếu, hỏng khi nhận chuyển kho, đã ghi giảm khỏi kho trung chuyển lúc duyệt biên bản giao nhận. Lập phiếu xuất kho từ kho này. Giao bù hàng: kho gửi chuyển bù bằng phiếu chuyển mới, phiếu đó sang AMIS ở lô có nó. Ghi giảm hao hụt: hàng mất hẳn, hạch toán cho người chịu trách nhiệm bồi thường hoặc tính vào chi phí theo lý do."),
    bang: "haoHut",
  },
  xuat_kho_don_huy: {
    tang: "lam",
    tieuDe: t("Lập phiếu xuất kho cho đơn hủy không về hàng"),
    amis: t("Kho › Xuất kho"),
    huongDan: t("Đơn đã hủy nên không ghi doanh thu, nhưng chưa có phiếu nhập lại kho: hàng đã rời kho mà không về. Lập phiếu xuất kho khác để giảm tồn trên AMIS; hàng về sau thì bỏ qua việc này."),
    bang: "don",
  },
  lech_don_huy: {
    tang: "lam",
    tieuDe: t("Kiểm lại đơn hủy nhập lại lệch số lượng"),
    amis: t("Kho › Nhập kho"),
    huongDan: t("Số nhập lại kho khác số đã xuất. Nhập trùng thì báo kho sửa phiếu; nhập dư thật thì lập phiếu nhập kho khác cho phần dư, thiếu thì lập phiếu xuất kho khác cho phần thiếu."),
    bang: "cap",
  },
  nhap_hang_hoan: {
    tang: "lam",
    tieuDe: t("Xử lý hàng hoàn nhập lại kho"),
    amis: t("Kho › Nhập kho"),
    huongDan: t("Không tìm thấy phiếu xuất của đơn trong lô này. Đơn đã giao kế toán thì lập Hàng bán trả lại; đơn bán trước ngày mốc thì lập phiếu nhập kho; đơn chưa từng giao kế toán (hủy, hoàn trả trước khi xuất) thì không lập gì."),
    bang: "don",
    coPhieuXuat: true,
  },
  tra_lai_sau_xuat: {
    tang: "lam",
    tieuDe: t("Lập Hàng bán trả lại cho đơn đã giao ở lô trước"),
    amis: t("Bán hàng › Trả lại hàng bán"),
    huongDan: t("Đơn đã giao kế toán ở lô trước, sau đó bị hoàn trả. Lập chứng từ Hàng bán trả lại cho đơn trên AMIS."),
    bang: "lo",
  },
  tra_lai_don: {
    tang: "lam",
    tieuDe: t("Nhập kho và chi tiền cho đơn bị hoàn trả"),
    amis: t("Kho › Nhập kho"),
    huongDan: t("Chứng từ Hàng bán trả lại trong lô chỉ giảm trừ công nợ, không kèm phiếu nhập kho. Hàng về kho thì lập phiếu nhập kho loại \"Nhập kho hàng bán trả lại\"; đã thu tiền của khách thì lập phiếu chi khi hoàn tiền."),
    bang: "tien",
    nhanTien: t("Giá trị đơn"),
  },
  hoa_don_sau_xuat: {
    tang: "lam",
    tieuDe: t("Nhận hóa đơn cho phiếu mua đã giao ở lô trước"),
    amis: t("Mua hàng › Nhận hóa đơn"),
    huongDan: t("Phiếu đã giao ở lô trước dạng chưa có hóa đơn, nay đã có thông tin hóa đơn. Làm theo ghi chú của từng phiếu."),
    bang: "noiDung",
  },
  lap_phieu_thu: {
    tang: "lam",
    tieuDe: t("Lập phiếu thu cho khách trả kết hợp"),
    amis: t("Ngân quỹ › Thu tiền"),
    huongDan: t("Đơn tại quầy khách trả bằng nhiều cách, xuất sang AMIS dạng \"Chưa thu tiền\" (phải thu khách hàng). Lập phiếu thu theo từng cách trả để tất toán công nợ."),
    bang: "phieuThu",
  },
  lap_phieu_chi: {
    tang: "lam",
    tieuDe: t("Lập phiếu chi hoàn tiền chuyển khoản"),
    amis: t("Ngân quỹ › Chi tiền gửi"),
    huongDan: t("Phiếu trả hàng tại quầy hoàn tiền bằng chuyển khoản: chứng từ trả lại chỉ giảm công nợ. Lập chứng từ chi tiền gửi trả khách cùng số tiền."),
    bang: "tien",
    nhanTien: t("Tiền hoàn"),
  },
  kiem_ton_dau_ky: {
    tang: "lam",
    tieuDe: t("Kiểm lại số dư tồn đầu kỳ trước khi nhập"),
    amis: t("Kho › Nhập số dư"),
    huongDan: t("Giá trị tồn tính từ giá vốn lô (đơn giá đơn mua đã gồm thuế) trừ thuế theo mức chung. Đối chiếu với sổ sách trước khi nhập tệp tồn đầu kỳ; lệch thì sửa trong tệp."),
    bang: "tonDauKy",
  },
  dieu_chinh_kiem_ke: {
    tang: "lam",
    tieuDe: t("Lập phiếu nhập / xuất kho điều chỉnh kiểm kê"),
    amis: t("Kho › Nhập kho / Xuất kho"),
    huongDan: t("Chênh lệch kiểm kê chưa có chứng từ trong lô: tăng thì lập phiếu nhập kho, giảm thì lập phiếu xuất kho điều chỉnh."),
    bang: "kho",
  },
  xuat_kho_khac: {
    tang: "lam",
    tieuDe: t("Lập phiếu xuất kho khác"),
    amis: t("Kho › Xuất kho"),
    huongDan: t("Phiếu xuất không phải bán hàng, không phải chuyển kho, chưa có chứng từ trong lô."),
    bang: "kho",
  },
  nhap_kho_khac: {
    tang: "lam",
    tieuDe: t("Lập phiếu nhập kho khác"),
    amis: t("Kho › Nhập kho"),
    huongDan: t("Phiếu nhập không từ đơn mua, không từ chuyển kho, chưa có chứng từ trong lô."),
    bang: "kho",
  },
  nhap_lai_truoc_moc: {
    tang: "lam",
    tieuDe: t("Nhập lại hàng của phiếu bán trước ngày mốc"),
    amis: t("Bán hàng › Trả lại hàng bán"),
    huongDan: t("Phiếu xuất bán trước ngày mốc nên AMIS không có chứng từ bán tương ứng. Lập Hàng bán trả lại hoặc phiếu nhập kho."),
    bang: "kho",
  },
  bien_dong_khac: {
    tang: "lam",
    tieuDe: t("Xem biến động kho chưa có chứng từ"),
    huongDan: t("Biến động kho không thuộc nhóm nào ở trên. Xem từng dòng rồi lập chứng từ phù hợp trên AMIS."),
    bang: "noiDung",
  },
  xem_lai: VIEC_XEM_LAI,
  nhan_hoa_don: {
    tang: "cho",
    tieuDe: t("Nhận hóa đơn cho phiếu mua"),
    amis: t("Mua hàng › Nhận hóa đơn"),
    huongDan: t("Phiếu xuất dạng \"Không kèm hóa đơn\": AMIS ghi giá trị hàng đã tách thuế, phần thuế chờ hóa đơn. Khi nhà cung cấp gửi hóa đơn, chọn phiếu tương ứng để ghi nhận thuế. Đã có hóa đơn thì nên nhập vào phiếu nhập trước khi tạo lô."),
    bang: "hoaDon",
  },
  khop_don_huy: {
    tang: "xong",
    tieuDe: t("Đơn hủy đã nhập lại đủ hàng"),
    huongDan: t("Phiếu xuất và phiếu nhập lại của cùng một đơn bù trừ nhau; đơn không ghi doanh thu nên không có gì sang kế toán."),
    bang: "cap",
  },
  hang_loi: {
    tang: "xong",
    tieuDe: t("Hàng lỗi khách trả"),
    huongDan: t("Đã ghi thành chứng từ Hàng bán trả lại riêng (mã đuôi -L), không kèm phiếu nhập kho: hàng lỗi không vào tồn, giá vốn lúc bán giữ nguyên. Trả nhà cung cấp hay hủy hàng làm theo quy định công ty."),
    bang: "hangLoi",
  },
  de_biet: {
    tang: "xong",
    tieuDe: t("Để biết"),
    huongDan: t("Thông tin về chứng từ trong lô, không cần lập thêm."),
    bang: "noiDung",
  },
};

const THU_TU = Object.keys(VIEC);
const so = (v) => (v == null || v === "" ? 0 : Number(v));

/** Ghép các dòng của một cặp đơn hủy (cùng chiTiet.cap): một phiếu xuất (số lượng âm) và các phiếu nhập lại. */
function ghepCap(dong) {
  const theoCap = new Map();
  for (const v of dong) {
    const khoa = v.chiTiet?.cap ?? v.khoa;
    if (!theoCap.has(khoa)) theoCap.set(khoa, { khoa: `cap-${khoa}`, xuat: null, nhap: [] });
    const c = theoCap.get(khoa);
    if (so(v.chiTiet?.soLuong) < 0 && !c.xuat) c.xuat = v;
    else c.nhap.push(v);
  }
  return [...theoCap.values()].map((c) => {
    const ct = (c.xuat ?? c.nhap[0])?.chiTiet ?? {};
    const xuat = so(c.xuat?.chiTiet?.soLuong);
    const nhap = c.nhap.reduce((s, v) => s + so(v.chiTiet?.soLuong), 0);
    return { ...c, soDon: ct.soDon ?? c.nhap.find((v) => v.chiTiet?.soDon)?.chiTiet.soDon ?? null, maKho: ct.maKho, soXuat: xuat, soNhap: nhap, chenh: xuat + nhap };
  });
}

/**
 * Gom vấn đề của bản xem trước thành ba tầng → các nhóm việc → các dòng.
 * Trả `[{ ma, nhan, moTa, soViec, nhom: [{ ma, ...VIEC[ma], dong }] }]` đúng thứ tự TANG; nhóm "cap" có dòng là cặp đã ghép.
 * `soViec` đếm theo dòng hiện ra (một cặp đơn hủy là một việc).
 */
export function xepViecKeToan(xemTruoc) {
  if (!xemTruoc) return TANG.map((g) => ({ ...g, soViec: 0, nhom: [] }));
  const nguon = [
    ...(xemTruoc.bienDongKho ?? []).map((v) => ({ v, nguon: "bd" })),
    ...(xemTruoc.phatSinhSauXuat ?? []).map((v) => ({ v, nguon: "sx", loTruoc: true })),
    ...(xemTruoc.canhBao ?? []).map((v) => ({ v, nguon: "cb" })),
  ];
  const theoViec = new Map();
  nguon.forEach(({ v, nguon: n, loTruoc }, i) => {
    const ma = VIEC[v.viec] ? v.viec : "xem_lai";
    if (!theoViec.has(ma)) theoViec.set(ma, []);
    theoViec.get(ma).push({ ...v, chiTiet: v.chiTiet ?? {}, khoa: `${n}-${v.loai}-${v.idNguon ?? ""}-${i}`, loTruoc: Boolean(loTruoc) });
  });
  const nhom = THU_TU.filter((ma) => theoViec.has(ma)).map((ma) => {
    const dong = VIEC[ma].bang === "cap" ? ghepCap(theoViec.get(ma)) : theoViec.get(ma);
    return { ma, ...VIEC[ma], dong };
  });
  return TANG.map((g) => {
    const cua = nhom.filter((n) => n.tang === g.ma);
    return { ...g, nhom: cua, soViec: cua.reduce((s, n) => s + n.dong.length, 0) };
  });
}

/** Tầng mở sẵn: tầng đầu tiên có việc (thường là "Cần làm"); không tầng nào có việc thì null. */
export const tangMacDinh = (tang) => tang.find((g) => g.soViec > 0)?.ma ?? null;

/** Tổng giá trị hàng và thuế chờ của nhóm Nhận hóa đơn (dòng cộng cuối bảng, số trên thẻ tầng). */
export function congHoaDon(dong = []) {
  return dong.reduce((s, v) => ({ giaTri: s.giaTri + so(v.chiTiet?.giaTri), thue: s.thue + so(v.chiTiet?.thue) }), { giaTri: 0, thue: 0 });
}
