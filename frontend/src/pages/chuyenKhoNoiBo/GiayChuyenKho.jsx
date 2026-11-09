/* i18n-giu-nguyen-ca-tep: nội dung chứng từ in */
import { LY_DO_DIEU_DONG_HIEN_THI } from "@/constants/phieuChuyenKho";
import {
  LOAI_IN,
  bienBanMauCu,
  dongBienBan,
  dongDieuChinh,
  dongHangXknb,
  dongHangYeuCau,
  gioPhut,
  kyKhoGui,
  lyDoTrongCau,
  ngayChu,
  ngayDu,
  phuongTienIn,
  sauTen,
  soIn,
  tenPhuongAn,
  tienIn,
  veViec,
} from "@/components/chuyen-kho/inChuyenKho";
import { aiXuLyChenhLech, cauChoXuLyLech } from "@/components/chuyen-kho/hienThiChuyenKho";
import { DauGiay, Ky, TenGiay } from "@/components/print/GiayChungTu";

/*
 * Giấy in của chuyển kho nội bộ theo bố cục bản demo đã duyệt (tài liệu BA); khung giấy (CSS, đầu giấy, ô ký) dùng chung
 * ở components/print/GiayChungTu. Chữ trên giấy giữ tiếng Việt ở cả hai ngôn ngữ giao diện (chứng từ in); khung trang in
 * (thanh công cụ, thông báo lỗi) ở InChuyenKho.jsx.
 */

/** Bảng hàng của yêu cầu và lệnh điều động. */
function BangHangDon({ ct }) {
  const { dong, tongSoLuong } = dongHangYeuCau(ct);
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 34 }}>STT</th>
          <th>Tên hàng hóa</th>
          <th>Mã SKU</th>
          <th>ĐVT</th>
          <th>Số lượng</th>
        </tr>
      </thead>
      <tbody>
        {dong.map((d, i) => (
          <tr key={d.khoa}>
            <td className="c">{i + 1}</td>
            <td>{d.ten}</td>
            <td>{d.sku}</td>
            <td className="c">{d.dvt}</td>
            <td className="r">{soIn(d.soLuong)}</td>
          </tr>
        ))}
        <tr>
          <td />
          <td><b>Cộng</b></td>
          <td />
          <td />
          <td className="r"><b>{soIn(tongSoLuong)}</b></td>
        </tr>
      </tbody>
    </table>
  );
}

export function GiayYeuCau({ ct, hoSo }) {
  return (
    <>
      <DauGiay hoSo={hoSo}>Số: <b>{ct.soPhieuChuyen}</b></DauGiay>
      <TenGiay ten={LOAI_IN["yeu-cau"].ten} ngay={ngayChu(ct.ngayTao)} />
      <p>Kho yêu cầu: <b>{ct.khoNhap?.ten}</b> · Kho cung cấp: <b>{ct.khoXuat?.ten}</b></p>
      <p>Ghi chú: {ct.ghiChu || "—"}</p>
      <BangHangDon ct={ct} />
      <Ky cot={[["Người lập", ct.nguoiTao], ["Quản lý Kho tổng", ""]]} />
    </>
  );
}

export function GiayLenhDieuDong({ ct, hoSo }) {
  return (
    <>
      <DauGiay hoSo={hoSo}>Số: <b>{ct.soLenhDieuDong}</b></DauGiay>
      <TenGiay ten={LOAI_IN["lenh-dieu-dong"].ten} ngay={ngayChu(ct.ngayLenhDieuDong)} />
      <p>Căn cứ yêu cầu chuyển kho số <b>{ct.soPhieuChuyen}</b> ngày {ngayDu(ct.ngayTao)} của {ct.khoNhap?.ten};</p>
      <p>Quản lý Kho tổng điều động hàng hóa như sau:</p>
      <p>– Xuất tại kho: <b>{ct.khoXuat?.ten}</b>{sauTen(ct.khoXuat?.diaChi)}</p>
      <p>– Nhập tại kho: <b>{ct.khoNhap?.ten}</b>{sauTen(ct.khoNhap?.diaChi)}</p>
      <p>– Về việc: {veViec(ct, LY_DO_DIEU_DONG_HIEN_THI)}</p>
      <BangHangDon ct={ct} />
      <p>Kho xuất lập phiếu xuất kho kiêm vận chuyển nội bộ theo lệnh này trước khi hàng rời kho.</p>
      <Ky cot={[["Người đề nghị", ct.nguoiTao], ["Người ra lệnh", ct.nguoiRaLenh]]} />
      <div className="chan-giay">Lệnh do F Centric cấp số tự động khi phê duyệt yêu cầu chuyển kho.</div>
    </>
  );
}

export function GiayXknb({ ct, hoSo }) {
  const coSo = Boolean(ct.soPhieuXknb);
  const daXuat = Boolean(ct.hinhThucVanChuyen);
  const { phuongTien, hopDong } = phuongTienIn(ct);
  const { dong, tongSoLuong, tongTien } = dongHangXknb(ct);
  const lyDo = lyDoTrongCau(ct, LY_DO_DIEU_DONG_HIEN_THI);
  const thuKhoXuat = ct.phieuXuat?.trangThai === "3" ? ct.phieuXuat?.nguoi : "";
  return (
    <>
      {coSo ? null : <div className="dau-dong">CHƯA CÓ SỐ XKNB</div>}
      <DauGiay hoSo={hoSo}>
        Mẫu số: 03/XKNB
        <br />
        Ký hiệu: <b>{coSo ? ct.kyHieuXknb : "……"}</b>
        <br />
        Số: <b>{coSo ? ct.soPhieuXknb : "……"}</b>
      </DauGiay>
      <TenGiay ten={LOAI_IN.xknb.ten} ngay={ngayChu(ct.ngayLapXknb || ct.ngayLenhDieuDong)} />
      <p>
        Căn cứ lệnh điều động số <b>{ct.soLenhDieuDong}</b> ngày {ngayDu(ct.ngayLenhDieuDong)} của {ct.nguoiRaLenh || "……"} –
        Quản lý Kho tổng về việc {lyDo}
      </p>
      <p>Họ tên người vận chuyển: <b>{daXuat && ct.nguoiVanChuyen ? ct.nguoiVanChuyen : "……………………"}</b></p>
      <p>Phương tiện vận chuyển: {phuongTien || "……………………"} · Hợp đồng số: {hopDong}</p>
      <p>Xuất tại kho: {ct.khoXuat?.ten}{sauTen(ct.khoXuat?.diaChi)}</p>
      <p>Nhập tại kho: {ct.khoNhap?.ten}{sauTen(ct.khoNhap?.diaChi)}</p>
      <table>
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: 34 }}>STT</th>
            <th rowSpan={2}>Tên nhãn hiệu, quy cách, phẩm chất vật tư (sản phẩm, hàng hóa)</th>
            <th rowSpan={2}>Mã số</th>
            <th rowSpan={2}>ĐVT</th>
            <th colSpan={2}>Số lượng</th>
            <th rowSpan={2}>Đơn giá</th>
            <th rowSpan={2}>Thành tiền</th>
          </tr>
          <tr>
            <th>Thực xuất</th>
            <th>Thực nhập</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.khoa}>
              <td className="c">{i + 1}</td>
              <td>{d.ten}{d.maLo ? ` · Lô ${d.maLo}` : ""}</td>
              <td>{d.sku}</td>
              <td className="c">{d.dvt}</td>
              <td className="r">{soIn(d.soLuong)}</td>
              <td />
              <td className="r">{tienIn(d.donGia)}</td>
              <td className="r">{tienIn(d.thanhTien)}</td>
            </tr>
          ))}
          <tr>
            <td />
            <td><b>Cộng</b></td>
            <td />
            <td />
            <td className="r"><b>{soIn(tongSoLuong)}</b></td>
            <td />
            <td />
            <td className="r"><b>{tienIn(tongTien)}</b></td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12 }}>
        <i>Đơn giá là giá vốn lô hàng. Phiếu không ghi thuế suất, tiền thuế GTGT.</i>
      </p>
      <Ky cot={[["Người lập phiếu", ""], ["Thủ kho xuất", thuKhoXuat], ["Người vận chuyển", daXuat ? ct.nguoiVanChuyen : ""], ["Thủ kho nhập", ""]]} />
      <div className="chan-giay">
        Bản in đối chiếu từ phần mềm quản lý kho. Chứng từ hợp lệ là bản điện tử lập trên phần mềm hóa đơn điện tử; ghi số
        XKNB vào phiếu chuyển trước khi hàng rời kho.
        {coSo ? (
          <>
            <br />
            Bản thể hiện của phiếu XKNB điện tử {ct.kyHieuXknb} – {ct.soPhieuXknb}. Tra cứu bản gốc: mã{" "}
            {ct.maTraCuuXknb || "—"} trên trang tra cứu của nhà cung cấp hóa đơn điện tử.
          </>
        ) : null}
      </div>
    </>
  );
}

/**
 * Chân biên bản: số bản giấy và việc trên F Centric. Mẫu mới (BA 03/11) lập 02 bản cho kho nhận và người vận chuyển, kho
 * gửi xác nhận trên hệ thống; biên bản mẫu cũ giữ câu 03 bản.
 */
function chanBienBan(ct, bb, daXuLy) {
  const nguoi = bb.nguoiDuyet ? `${bb.nguoiDuyet} ` : "";
  const xuLy = `${nguoi}xử lý: ${tenPhuongAn(bb.phuongAn).toLowerCase()}`;
  if (bienBanMauCu(bb)) {
    return `Biên bản lập 03 bản, mỗi bên giữ 01 bản. Phần lệch đã được ${nguoi}xử lý trên F Centric: ${tenPhuongAn(bb.phuongAn).toLowerCase()}.`;
  }
  const khoGui = ct.khoXuat?.ten ?? "Kho gửi";
  const viec = !bb.ngayXacNhanGui
    ? `chờ ${cauChoXuLyLech(ct, true)} phần lệch`
    : daXuLy
      ? `${khoGui} đã xác nhận, phần lệch đã được ${xuLy}`
      : `${khoGui} đã xác nhận, phần lệch chờ ${aiXuLyChenhLech(ct)} xử lý`;
  return `Biên bản lập 02 bản, kho nhận và người vận chuyển mỗi bên giữ 01 bản. Trên F Centric: ${viec}.`;
}

export function GiayBienBan({ ct, hoSo }) {
  const bb = ct.bienBan;
  const { dong, tong } = dongBienBan(bb);
  const daXuLy = bb.phuongAn && bb.phuongAn !== "CHUA_XU_LY";
  const khoGui = kyKhoGui(bb);
  const phuongTien = [ct.loaiPhuongTien || ct.donViVanChuyen, ct.bienSoXe].filter(Boolean).join(" ");
  return (
    <>
      <DauGiay hoSo={hoSo}>Số: <b>{bb.soBienBan}</b></DauGiay>
      <TenGiay ten={LOAI_IN["bien-ban"].ten} ngay={`${ngayChu(bb.ngayLap)}${gioPhut(bb.ngayLap) ? `, lúc ${gioPhut(bb.ngayLap)}` : ""}`} />
      <p>
        Căn cứ phiếu chuyển kho <b>{ct.soPhieuChuyen}</b>, lệnh điều động <b>{ct.soLenhDieuDong || "……"}</b>, phiếu XKNB{" "}
        {ct.soPhieuXknb ? <b>{ct.kyHieuXknb} – {ct.soPhieuXknb}</b> : "(chưa có số)"}.
      </p>
      <p>Hôm nay tại {ct.khoNhap?.ten}{sauTen(ct.khoNhap?.diaChi)}, chúng tôi gồm:</p>
      <p>– Bên nhận: {ct.khoNhap?.ten}, đại diện ông/bà <b>{bb.nguoiLap || "……………………"}</b></p>
      <p>
        – Bên giao (người vận chuyển): ông/bà <b>{bb.nguoiVanChuyen || ct.nguoiVanChuyen || "……………………"}</b>
        {phuongTien ? `, phương tiện ${phuongTien}` : ""}
      </p>
      <p>– Bên gửi: {ct.khoXuat?.ten}</p>
      <p>Cùng kiểm đếm hàng giao theo phiếu, ghi nhận chênh lệch như sau:</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>STT</th>
            <th>Tên hàng hóa</th>
            <th>Mã SKU</th>
            <th>Lô</th>
            <th>Gửi</th>
            <th>Đạt</th>
            <th>Hỏng</th>
            <th>Thiếu</th>
            <th>Lý do</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.khoa}>
              <td className="c">{i + 1}</td>
              <td>{d.ten}</td>
              <td>{d.sku}</td>
              <td>{d.maLo}</td>
              <td className="r">{soIn(d.gui)}</td>
              <td className="r">{soIn(d.dat)}</td>
              <td className="r">{soIn(d.hong)}</td>
              <td className="r">{soIn(d.thieu)}</td>
              <td>{d.lyDo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Tổng gửi {soIn(tong.gui)}; nhận đạt {soIn(tong.dat)}; hỏng {soIn(tong.hong)}; thiếu {soIn(tong.thieu)}.
      </p>
      <p>Kết luận: {bb.ketLuan || "—"}</p>
      {bb.ghiChuKhoGui ? <p>Ý kiến kho gửi: {bb.ghiChuKhoGui}</p> : null}
      {/* Ảnh không in (A3): chỉ ghi số ảnh đính kèm trên F Centric; không có ảnh thì bỏ dòng */}
      {bb.anh?.length ? <p>Ảnh kèm theo: {bb.anh.length} ảnh</p> : null}
      {/* Kho gửi không ký tay: xác nhận trên F Centric (BA 03/11), ô ghi người và giờ xác nhận */}
      <Ky
        cot={[
          ["Đại diện kho nhận", bb.nguoiLap],
          ["Người vận chuyển (lái xe)", bb.nguoiVanChuyen || ct.nguoiVanChuyen],
          ["Đại diện kho gửi", khoGui.ten, khoGui.nhac, khoGui.luc],
        ]}
      />
      <div className="chan-giay">{chanBienBan(ct, bb, daXuLy)}</div>
    </>
  );
}

export function GiayDieuChinh({ pdc, hoSo }) {
  const { dong, tongSoLuong, tongTien } = dongDieuChinh(pdc);
  return (
    <>
      <DauGiay hoSo={hoSo}>Số: <b>{pdc.soPhieu}</b></DauGiay>
      <TenGiay ten={LOAI_IN["dieu-chinh"].ten} ngay={ngayChu(pdc.ngayDieuChinh)} />
      <p>Loại điều chỉnh: <b>Giảm</b> · Kho: <b>{pdc.kho || "Kho trung chuyển"}</b> (hàng đang đi đường)</p>
      <p>
        Căn cứ biên bản giao nhận số <b>{pdc.bienBan?.so || "……"}</b> ngày {ngayDu(pdc.bienBan?.ngay)} của phiếu chuyển kho{" "}
        <b>{pdc.phieuChuyen?.so}</b> ({pdc.khoXuatTen} → {pdc.khoNhapTen}), lệnh điều động {pdc.soLenhDieuDong || "……"}.
      </p>
      <p>
        Phương án xử lý chênh lệch:{" "}
        <b>
          {pdc.phuongAn === "GIAO_BU_HANG"
            ? `Giao bù hàng${pdc.phieuGiaoBu?.so ? `, phiếu giao bù ${pdc.phieuGiaoBu.so}` : ""}`
            : tenPhuongAn(pdc.phuongAn)}
        </b>
      </p>
      <p>Lý do: {pdc.lyDo || "—"}</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>STT</th>
            <th>Tên hàng hóa</th>
            <th>Mã SKU</th>
            <th>Lô</th>
            <th>ĐVT</th>
            <th>Số lượng giảm</th>
            <th>Đơn giá (giá vốn)</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.khoa}>
              <td className="c">{i + 1}</td>
              <td>{d.ten}</td>
              <td>{d.sku}</td>
              <td>{d.maLo}</td>
              <td className="c">{d.dvt}</td>
              <td className="r">{soIn(d.soLuong)}</td>
              <td className="r">{tienIn(d.giaVon)}</td>
              <td className="r">{tienIn(d.thanhTien)}</td>
            </tr>
          ))}
          <tr>
            <td />
            <td><b>Cộng</b></td>
            <td />
            <td />
            <td />
            <td className="r"><b>{soIn(tongSoLuong)}</b></td>
            <td />
            <td className="r"><b>{tienIn(tongTien)}</b></td>
          </tr>
        </tbody>
      </table>
      {/* Người duyệt xử lý chênh lệch: Quản lý Kho tổng, Quản trị viên hoặc quản lý kho xuất tùy Cấu hình › Chuyển kho */}
      <Ky cot={[["Người lập phiếu", pdc.nguoiLap], ["Người duyệt", pdc.nguoiDuyet], ["Kế toán", ""]]} />
      <div className="chan-giay">
        Phiếu lập tự động trên F Centric khi duyệt xử lý chênh lệch; số lượng đã trừ khỏi kho trung chuyển và ghi sổ kho
        loại Điều chỉnh. Đơn giá là giá vốn lô hàng tạm tính.
      </div>
    </>
  );
}
