/* i18n-giu-nguyen-ca-tep: nội dung chứng từ in */
import { ngayDu, soIn, tienIn } from "@/components/chuyen-kho/inChuyenKho";
import { DauGiay, Ky } from "@/components/print/GiayChungTu";

/*
 * Giấy in "Biên bản trả hàng nhà cung cấp" (A4, ký 3 bên). Khung giấy (CSS, đầu giấy, ô ký) dùng chung ở
 * components/print/GiayChungTu như giấy chuyển kho, kiểm kê. Chữ trên giấy giữ tiếng Việt ở cả hai ngôn ngữ giao diện;
 * khung trang in (thanh công cụ, thông báo lỗi) ở InBienBanTraHang.jsx.
 *
 * Biên bản chỉ ghi điều kiểm được lúc nhận hàng, để người giao hàng (đại diện nhà cung cấp hoặc người của bên vận
 * chuyển, tên in sẵn dưới ô ký) ký xác nhận; in lại lúc nào cũng ra đúng tờ đã ký. Việc đã ký kho ghi trên hệ thống sau
 * khi in, nên không in vào giấy;
 * bản PDF gửi nhà cung cấp thì có thêm dòng đó. Câu trả lời của nhà cung cấp trên cổng, việc giao trả hay tiêu hủy về
 * sau cũng không in vào đây: chúng nằm ở hộp Xem biên bản và email gửi nhà cung cấp. Bản PDF gửi email (backend
 * templates/pdf/bien-ban-tra-hang.html) cùng bố cục và nội dung với giấy này.
 */

/** Phần riêng của biên bản trả hàng, thêm vào CSS_GIAY. */
export const CSS_BIEN_BAN_TRA_HANG = `
.giay-ct .ten-giay{margin-bottom:14px}
.giay-ct .muc{margin-top:10px}
.giay-ct .o-chon{display:inline-block;margin-right:22px}
.giay-ct .o-chon .hop{font-family:"Segoe UI Symbol","DejaVu Sans",Arial,sans-serif;margin-right:4px}
.giay-ct .thut{padding-left:18px}
.giay-ct tr.cong td{font-weight:700}
.giay-ct .dong-cham{border-bottom:1px dotted #555;height:1.6em}
`;

const CHAM = "……………………";
const sach = (v) => String(v ?? "").trim();

/** "Đen / M"; thiếu cả hai → "". */
const mauCo = (d) => [sach(d.mauSac), sach(d.kichCo)].filter(Boolean).join(" / ");

/** Ô đánh dấu ☐ / ☑ kèm nhãn. */
function OChon({ chon, children }) {
  return (
    <span className="o-chon">
      <span className="hop">{chon ? "☑" : "☐"}</span>
      {children}
    </span>
  );
}

/**
 * Dòng hàng lỗi kèm đơn giá: đơn giá lấy ở `theoBienThe` cùng biến thể (đơn giá đơn mua), không có thì để trống.
 * Tổng tiền chỉ in khi mọi dòng có đơn giá, thiếu một dòng thì để trống cho khỏi in số thiếu.
 */
function dongHangTra(bb) {
  const giaTheoBienThe = new Map();
  for (const d of bb?.theoBienThe ?? []) {
    if (d.bienTheSanPhamId != null && d.donGia != null && d.donGia !== "") giaTheoBienThe.set(d.bienTheSanPhamId, Number(d.donGia));
  }
  let tongSoLuong = 0;
  let tongTien = 0;
  let duGia = true;
  const dong = (bb?.items ?? []).map((d, i) => {
    const soLuong = Number(d.soLuong) || 0;
    const donGia = giaTheoBienThe.get(d.bienTheSanPhamId);
    const coGia = Number.isFinite(donGia);
    tongSoLuong += soLuong;
    if (coGia) tongTien += soLuong * donGia;
    else duGia = false;
    return {
      khoa: d.id ?? `${d.bienTheSanPhamId}-${d.maLo ?? ""}-${i}`,
      sku: d.sku,
      ten: d.tenBienThe,
      mauCo: mauCo(d),
      maLo: d.maLo,
      lyDo: d.lyDo,
      soLuong,
      donGia: coGia ? donGia : null,
      thanhTien: coGia ? soLuong * donGia : null,
    };
  });
  return { dong, tongSoLuong, tongTien: duGia && dong.length ? tongTien : null };
}

const laVanChuyen = (bb) => bb.benKy === "VAN_CHUYEN";

/** Người giao hàng ký biên bản ("Lê Văn Tài, Nhà xe Phương Trang, biển số 29C-123.45"); biên bản cũ thì "". */
function nguoiGiao(bb) {
  return [sach(bb.nguoiGiao), laVanChuyen(bb) ? sach(bb.donViVanChuyen) : "", sach(bb.bienSoXe) ? `biển số ${sach(bb.bienSoXe)}` : ""]
    .filter(Boolean)
    .join(", ");
}

/** Ai cùng kiểm số hàng lỗi: chữ ký của bên vận chuyển không phải xác nhận của nhà cung cấp. */
function cauDan(bb) {
  if (laVanChuyen(bb)) return "Khi nhận hàng, bên mua và người giao hàng cùng kiểm số hàng không đạt chất lượng dưới đây:";
  return "Khi nhận hàng, hai bên cùng kiểm và xác nhận số hàng không đạt chất lượng dưới đây:";
}

/** Dòng dưới tên ở ô ký người giao hàng: thuộc bên nào. */
function benNguoiGiao(bb) {
  if (laVanChuyen(bb)) return `(bên vận chuyển${sach(bb.donViVanChuyen) ? `: ${sach(bb.donViVanChuyen)}` : ""})`;
  return sach(bb.nguoiGiao) ? "(đại diện nhà cung cấp)" : "";
}

/** Mục "Hàng lỗi": lúc lập biên bản, hàng lỗi trả ngay cho người giao hàng hay giữ ở kho bên mua. */
function MucHangLoi({ bb }) {
  const traNgay = bb.cachXuLyHang === "TRA_NGAY";
  // Tên người nhận hàng lỗi chỉ ghi kèm khi giao luôn
  const nguoi = traNgay ? nguoiGiao(bb) : "";
  return (
    <div className="muc">
      <p>
        <b>Hàng lỗi:</b>
      </p>
      <p className="thut">
        <OChon chon={traNgay}>Trả ngay cho người giao hàng{nguoi ? ` (${nguoi})` : ""}</OChon>
        <OChon chon={bb.cachXuLyHang === "GIU_KHO"}>Giữ ở kho bên mua</OChon>
      </p>
    </div>
  );
}

/** Tên bên mua trong câu: tên đăng ký của hồ sơ công ty, chưa có thì tên cửa hàng. */
const tenCongTy = (hoSo) => sach(hoSo?.legalName) || sach(hoSo?.name) || CHAM;

export function GiayBienBanTraHang({ bb, hoSo }) {
  const { dong, tongSoLuong, tongTien } = dongHangTra(bb);
  const lienHe = [sach(bb.nguoiLienHeNcc), sach(bb.dienThoaiNcc)].filter(Boolean).join(", ");
  return (
    <>
      {bb.trangThai === "DA_HUY" ? <div className="dau-dong">ĐÃ HỦY</div> : null}
      <DauGiay hoSo={hoSo}>
        Số: <b>{bb.soBienBan}</b>
        <br />
        Ngày lập: {ngayDu(bb.ngayLap)}
      </DauGiay>
      <div className="ten-giay">BIÊN BẢN TRẢ HÀNG NHÀ CUNG CẤP</div>
      <p>
        Căn cứ phiếu nhập kho <b>{bb.soPhieuNhap || CHAM}</b>
        {sach(bb.soDonMua) ? (
          <>
            {" "}và đơn mua hàng <b>{bb.soDonMua}</b>
          </>
        ) : null}
        .
      </p>
      <p>
        – Bên mua: <b>{tenCongTy(hoSo)}</b>, {sach(bb.tenKho) || CHAM}, người lập {sach(bb.nguoiLap) || CHAM}.
      </p>
      <p>
        – Bên bán (nhà cung cấp): <b>{sach(bb.tenNhaCungCap) || CHAM}</b>
        {sach(bb.maNhaCungCap) ? `, mã ${sach(bb.maNhaCungCap)}` : ""}, liên hệ {lienHe || CHAM}
        {sach(bb.emailNcc) ? `, email ${sach(bb.emailNcc)}` : ""}.
      </p>
      <p>{cauDan(bb)}</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>STT</th>
            <th>Mã SKU</th>
            <th>Tên hàng</th>
            <th>Màu / cỡ</th>
            <th>Lô</th>
            <th>Lý do</th>
            <th>SL</th>
            <th>Đơn giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.khoa}>
              <td className="c">{i + 1}</td>
              <td>{d.sku}</td>
              <td>{d.ten}</td>
              <td>{d.mauCo}</td>
              <td>{d.maLo}</td>
              <td>{d.lyDo}</td>
              <td className="r">{soIn(d.soLuong)}</td>
              <td className="r">{tienIn(d.donGia)}</td>
              <td className="r">{tienIn(d.thanhTien)}</td>
            </tr>
          ))}
          <tr className="cong">
            <td />
            <td colSpan={5}>Cộng</td>
            <td className="r">{soIn(tongSoLuong)}</td>
            <td />
            <td className="r">{tienIn(tongTien)}</td>
          </tr>
        </tbody>
      </table>
      <MucHangLoi bb={bb} />
      <div className="muc">
        {sach(bb.ghiChu) ? (
          <p>
            <b>Ghi chú:</b> {sach(bb.ghiChu)}
          </p>
        ) : (
          <>
            <p>
              <b>Ghi chú:</b>
            </p>
            <div className="dong-cham" />
            <div className="dong-cham" />
          </>
        )}
      </div>
      <Ky
        cot={[
          ["Người lập", bb.nguoiLap, "(ký, ghi rõ họ tên)"],
          ["Người giao hàng", sach(bb.nguoiGiao), "(ký, ghi rõ họ tên)", benNguoiGiao(bb)],
          ["Thủ kho", "", "(ký, ghi rõ họ tên)"],
        ]}
      />
    </>
  );
}
