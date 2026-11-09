/* i18n-giu-nguyen-ca-tep: nội dung chứng từ in (biên bản kiểm kê, phiếu điều chỉnh kho) */
import { useMemo } from "react";
import { DauGiay, Ky, TenGiay } from "@/components/print/GiayChungTu";
import { DVT_MAC_DINH, gioPhut, ngayChu, ngayGio, soIn, tienIn } from "@/components/chuyen-kho/inChuyenKho";
import { TEN_GIAY_KIEM_KE, bienBanKiemKe, dongPhieuDieuChinh, laBanNhap, phamViIn, tenLoaiDieuChinh } from "@/components/kiem-ke/inKiemKe";

/* Phần giấy in của kiểm kê (InKiemKe.jsx là khung trang: tải dữ liệu, thanh công cụ, trạng thái lỗi). */

/** "+2" / "−3" / "0". */
function coDau(n, dinhDang = soIn) {
  if (n === null || n === undefined) return "";
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${dinhDang(Math.abs(n))}`;
}

/** "Ngày 08 tháng 11 năm 2026, lúc 16:15". */
const ngayLuc = (v) => `${ngayChu(v)}${gioPhut(v) ? `, lúc ${gioPhut(v)}` : ""}`;

/** "16:15 ngày 08/11/2026"; không có → "……". */
function lucNgay(v) {
  const s = ngayGio(v);
  if (!s) return "……";
  const [ngay, gio] = s.split(" ");
  return `${gio} ngày ${ngay}`;
}

/** Dấu bản nháp nằm trong cột phải của đầu giấy (dưới số), không đè lên địa chỉ dài hay tiêu đề; có ở cả trang phụ lục. */
function DauNhap() {
  return (
    <>
      <br />
      <span className="dau-nhap">BẢN NHÁP – CHƯA DUYỆT</span>
    </>
  );
}

function vaiTroTrongBan(x) {
  const dem = x.soDong > 0 ? `kiểm đếm ${soIn(x.soDong)} dòng` : x.daDem ? "kiểm đếm lần trước" : "";
  return [x.chuTri ? "chủ trì" : "", dem].filter(Boolean).join(", ");
}

/** Biên bản kiểm kê hàng hóa (bản vẽ PA B đã chốt 09/11): tổng hợp + dòng lệch, phụ lục đủ dòng xếp theo kệ. */
export function GiayBienBan({ dot, dongApi, hoSo, coTien, phuLuc }) {
  const bb = useMemo(() => bienBanKiemKe(dot, dongApi), [dot, dongApi]);
  const { tong, lech } = bb;
  const nhap = laBanNhap(dot);
  const phieuMa = dot.phieuDieuChinh?.ma;
  return (
    <>
      <DauGiay hoSo={hoSo}>
        Số: <b>{dot.ma}</b>
        {nhap ? <DauNhap /> : null}
      </DauGiay>
      <TenGiay ten={TEN_GIAY_KIEM_KE["bien-ban"]} ngay={ngayLuc(nhap ? dot.ngayHoanThanh : dot.ngayDuyet)} />

      <h3>I. Thông tin chung</h3>
      {dot.ten ? <p>Đợt kiểm kê: <b>{dot.ten}</b></p> : null}
      <p>
        Kho kiểm kê: <b>{dot.kho?.ten || "……"}</b>. Phạm vi: {phamViIn(dot)}.
      </p>
      {String(dot.lyDo ?? "").trim() ? <p>Lý do kiểm kê: {dot.lyDo}</p> : null}
      <p>
        Chốt số theo sổ lúc {lucNgay(dot.ngayBatDau)}; kiểm đếm xong lúc {lucNgay(dot.ngayHoanThanh)}.
      </p>
      <p>Ban kiểm kê gồm:</p>
      {bb.ban.length ? (
        bb.ban.map((x) => (
          <p key={x.khoa}>
            – Ông/bà <b>{x.ten}</b>
            {vaiTroTrongBan(x) ? `, ${vaiTroTrongBan(x)}` : ""}.
          </p>
        ))
      ) : (
        <p>– ……………………………………</p>
      )}

      <h3>II. Kết quả tổng hợp</h3>
      <table className="tong-hop">
        <tbody>
          <tr>
            <td>Số dòng kiểm kê (mặt hàng × lô × kệ)</td>
            <td className="r">{soIn(tong.soDong)}</td>
            <td>Khớp sổ</td>
            <td className="r">{soIn(tong.khop)}</td>
          </tr>
          <tr>
            <td>Tổng số lượng theo sổ</td>
            <td className="r">{soIn(tong.soSach)}</td>
            <td>Tổng số lượng thực tế</td>
            <td className="r">{soIn(tong.thucTe)}</td>
          </tr>
          <tr>
            <td>Thừa ({soIn(tong.dongThua)} dòng)</td>
            <td className="r">{coDau(tong.thua)}</td>
            <td>Thiếu ({soIn(tong.dongThieu)} dòng)</td>
            <td className="r">{coDau(-tong.thieu)}</td>
          </tr>
          {coTien ? (
            <>
              <tr>
                <td>Giá trị thừa (đ)</td>
                <td className="r">{tienIn(tong.giaTriThua)}</td>
                <td>Giá trị thiếu (đ)</td>
                <td className="r">{tienIn(tong.giaTriThieu)}</td>
              </tr>
              <tr>
                <td>
                  <b>Chênh lệch ròng (đ)</b>
                </td>
                <td className="r">
                  <b>{coDau(Math.round(tong.giaTriRong), tienIn)}</b>
                </td>
                <td>Tỷ lệ trên giá trị theo sổ</td>
                <td className="r">
                  {tong.tiLe === null
                    ? "—"
                    : `${tong.tiLe < 0 ? "−" : ""}${Math.abs(tong.tiLe).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`}
                </td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>

      <h3>III. Chi tiết chênh lệch</h3>
      {lech.length ? (
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}>STT</th>
              <th>Tên hàng hóa</th>
              <th>Mã SKU</th>
              <th>Lô</th>
              <th>Kệ</th>
              <th style={{ width: 46 }}>Sổ</th>
              <th style={{ width: 52 }}>Thực tế</th>
              <th style={{ width: 56 }}>Chênh lệch</th>
              {coTien ? <th style={{ width: 86 }}>Giá trị (đ)</th> : null}
              <th>Lý do, hướng xử lý</th>
            </tr>
          </thead>
          <tbody>
            {lech.map((d, i) => (
              <tr key={d.khoa}>
                <td className="c">{i + 1}</td>
                <td>{d.ten}</td>
                <td>{d.sku}</td>
                <td>{d.maLo}</td>
                <td>{d.ke}</td>
                <td className="r">{soIn(d.soSach)}</td>
                <td className="r">{soIn(d.thucTe)}</td>
                <td className="r">{coDau(d.chenhLech)}</td>
                {coTien ? <td className="r">{coDau(Math.round(d.giaTri ?? 0), tienIn)}</td> : null}
                <td>{d.lyDo}</td>
              </tr>
            ))}
            <tr className="cong">
              <td />
              <td colSpan={4}>Cộng</td>
              <td className="r">{soIn(lech.reduce((s, d) => s + d.soSach, 0))}</td>
              <td className="r">{soIn(lech.reduce((s, d) => s + d.thucTe, 0))}</td>
              <td className="r">{coDau(tong.chenhLech)}</td>
              {coTien ? <td className="r">{coDau(Math.round(tong.giaTriRong), tienIn)}</td> : null}
              <td />
            </tr>
          </tbody>
        </table>
      ) : (
        <p>Không có dòng chênh lệch: mọi dòng khớp sổ.</p>
      )}
      {lech.length && tong.khop ? (
        <p className="ghi">
          {soIn(tong.khop)} dòng còn lại khớp sổ{phuLuc ? ", chi tiết ở phụ lục kèm theo" : ""}.
        </p>
      ) : null}

      <h3>IV. Kết luận và xử lý</h3>
      {nhap ? (
        <p>
          Ban kiểm kê thống nhất số liệu trên và trình người có thẩm quyền duyệt. Tồn kho trên F Centric chưa được điều chỉnh
          tới khi đợt được duyệt.
        </p>
      ) : (
        <p>
          Đợt kiểm kê đã được ông/bà <b>{dot.nguoiDuyet?.hoTen || "……"}</b> duyệt lúc {lucNgay(dot.ngayDuyet)}.{" "}
          {phieuMa ? (
            <>
              Chênh lệch được ghi sổ theo phiếu điều chỉnh kho số <b>{phieuMa}</b>
              {coTien ? (
                <>
                  , giá trị ròng <b>{coDau(Math.round(tong.giaTriRong), tienIn)} đ</b>
                </>
              ) : null}
              .{" "}
            </>
          ) : (
            "Không phát sinh điều chỉnh tồn kho. "
          )}
          Tồn kho và sổ kệ đã cập nhật theo số thực tế, các kệ đã mở khóa.
        </p>
      )}
      {bb.soAnh ? <p>Hồ sơ kèm theo: {soIn(bb.soAnh)} ảnh bằng chứng lưu trên F Centric.</p> : null}
      <Ky
        cot={[
          ["Người kiểm đếm", bb.nguoiDem],
          ["Người chủ trì", dot.nguoiChuTri?.hoTen],
          ["Người duyệt", nhap ? "" : dot.nguoiDuyet?.hoTen],
        ]}
      />
      <div className="chan-giay">
        Biên bản lập trên F Centric từ đợt kiểm kê {dot.ma}. Số theo sổ là số chốt lúc bắt đầu đếm
        {coTien ? ", giá trị tính theo giá vốn chốt cùng lúc" : ""}.
      </div>

      {phuLuc ? (
        <div className="phu-luc">
          <DauGiay hoSo={hoSo}>
            Kèm biên bản số: <b>{dot.ma}</b>
            {nhap ? <DauNhap /> : null}
          </DauGiay>
          <TenGiay ten="PHỤ LỤC: BẢNG KIỂM ĐẾM CHI TIẾT" ngay={`Xếp theo kệ · ${soIn(tong.soDong)} dòng`} />
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>STT</th>
                <th>Kệ</th>
                <th>Tên hàng hóa</th>
                <th>Mã SKU</th>
                <th>Lô</th>
                <th style={{ width: 46 }}>Sổ</th>
                <th style={{ width: 52 }}>Thực tế</th>
                <th style={{ width: 56 }}>Chênh lệch</th>
                <th>Người đếm</th>
              </tr>
            </thead>
            <tbody>
              {bb.dong.map((d, i) => (
                <tr key={d.khoa}>
                  <td className="c">{i + 1}</td>
                  <td>{d.ke}</td>
                  <td>{d.ten}</td>
                  <td>{d.sku}</td>
                  <td>{d.maLo}</td>
                  <td className="r">{soIn(d.soSach)}</td>
                  <td className="r">{soIn(d.thucTe)}</td>
                  <td className="r">{coDau(d.chenhLech)}</td>
                  <td>{d.nguoiDem}</td>
                </tr>
              ))}
              <tr className="cong">
                <td />
                <td colSpan={4}>Cộng</td>
                <td className="r">{soIn(tong.soSach)}</td>
                <td className="r">{soIn(tong.thucTe)}</td>
                <td className="r">{coDau(tong.chenhLech)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          <Ky cot={[["Người kiểm đếm", bb.nguoiDem], ["Người chủ trì", dot.nguoiChuTri?.hoTen]]} />
        </div>
      ) : null}
    </>
  );
}

/** Phiếu điều chỉnh kho nguồn kiểm kê: mỗi dòng lệch của đợt đã duyệt là một dòng phiếu. */
export function GiayDieuChinh({ dot, dongApi, phieu, hoSo }) {
  const { dong, tong } = useMemo(() => dongPhieuDieuChinh(dongApi), [dongApi]);
  return (
    <>
      <DauGiay hoSo={hoSo}>
        Số: <b>{phieu.soPhieu}</b>
      </DauGiay>
      <TenGiay ten={TEN_GIAY_KIEM_KE["dieu-chinh"]} ngay={ngayChu(phieu.ngayDieuChinh)} />
      <p>
        Loại điều chỉnh: <b>{tenLoaiDieuChinh(phieu.loaiDieuChinh)}</b> · Kho: <b>{dot.kho?.ten || "……"}</b>
      </p>
      <p>
        Căn cứ biên bản kiểm kê số <b>{dot.ma}</b>
        {dot.ten ? ` (${dot.ten})` : ""}, duyệt lúc {lucNgay(dot.ngayDuyet)}.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 30 }}>STT</th>
            <th>Tên hàng hóa</th>
            <th>Mã SKU</th>
            <th>Lô</th>
            <th>Kệ</th>
            <th style={{ width: 36 }}>ĐVT</th>
            <th style={{ width: 50 }}>Tăng</th>
            <th style={{ width: 50 }}>Giảm</th>
            <th style={{ width: 78 }}>Đơn giá (giá vốn)</th>
            <th style={{ width: 88 }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.khoa}>
              <td className="c">{i + 1}</td>
              <td>{d.ten}</td>
              <td>{d.sku}</td>
              <td>{d.maLo}</td>
              <td>{d.ke}</td>
              <td className="c">{DVT_MAC_DINH}</td>
              <td className="r">{d.chenhLech > 0 ? soIn(d.chenhLech) : ""}</td>
              <td className="r">{d.chenhLech < 0 ? soIn(-d.chenhLech) : ""}</td>
              <td className="r">{tienIn(d.giaVon)}</td>
              <td className="r">{coDau(Math.round(d.chenhLech > 0 ? d.thanhTien : -d.thanhTien), tienIn)}</td>
            </tr>
          ))}
          <tr className="cong">
            <td />
            <td colSpan={5}>Cộng</td>
            <td className="r">{soIn(tong.tang)}</td>
            <td className="r">{soIn(tong.giam)}</td>
            <td />
            <td className="r">{coDau(Math.round(tong.tienRong), tienIn)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Giá trị tăng: {tienIn(phieu.tongGiaTriTang)} đ · Giá trị giảm: {tienIn(phieu.tongGiaTriGiam)} đ · Chênh lệch ròng:{" "}
        <b>{coDau(Math.round(Number(phieu.giaTriChenhLechThuan ?? 0)), tienIn)} đ</b>
      </p>
      {/* Cửa hàng không có kế toán ký giấy kho (chốt 09/11). Phiếu lập tự động khi duyệt nên người lập trên sổ trùng người
          duyệt: ô thứ nhất là người chủ trì đợt, người cầm kết quả kiểm */}
      <Ky cot={[["Người chủ trì", dot.nguoiChuTri?.hoTen], ["Người duyệt", phieu.nguoiDuyet?.hoTen]]} />
      <div className="chan-giay">
        Phiếu lập tự động trên F Centric khi duyệt đợt kiểm kê {dot.ma}; số lượng đã ghi sổ kho loại Điều chỉnh. Đơn giá là
        giá vốn chốt lúc bắt đầu đếm.
      </div>
    </>
  );
}
