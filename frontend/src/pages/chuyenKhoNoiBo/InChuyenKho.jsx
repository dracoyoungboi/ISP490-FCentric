import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX, Lock } from "lucide-react";
import PrintLayout from "@/components/print/PrintLayout";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import useQuayLai from "@/hooks/useQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { companyProfileService } from "@/services/companyProfileService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { LY_DO_DIEU_DONG } from "@/constants/phieuChuyenKho";
import {
  LOAI_IN,
  dauCongTy,
  dongBienBan,
  dongDieuChinh,
  dongHangXknb,
  dongHangYeuCau,
  gioPhut,
  lyDoChuaIn,
  ngayChu,
  ngayDu,
  phuongTienIn,
  sauTen,
  soIn,
  tenLyDoDieuDong,
  tenPhuongAn,
  tienIn,
  veViec,
} from "@/components/chuyen-kho/inChuyenKho";
import { aiXuLyChenhLech } from "@/components/chuyen-kho/hienThiChuyenKho";

/*
 * Giấy in của chuyển kho nội bộ theo bố cục bản demo đã duyệt (tài liệu BA): chữ đen trên nền trắng, phông có chân như
 * chứng từ kế toán. Không dùng thẻ <header>/<footer> vì print.css ẩn hai thẻ đó khi in.
 */
const CSS_GIAY = `
.giay-ck{position:relative;color:#111;font:13.5px/1.45 "Times New Roman",Times,"Liberation Serif",serif}
.giay-ck .dau-giay{display:flex;justify-content:space-between;gap:20px;font-size:12.5px}
.giay-ck .dau-giay b{font-size:13px}
.giay-ck .ten-giay{text-align:center;margin:22px 0 4px;font-size:18px;font-weight:700;letter-spacing:.02em}
.giay-ck .ngay-giay{text-align:center;font-style:italic;margin-bottom:16px}
.giay-ck p{margin:3px 0}
.giay-ck table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12.5px}
.giay-ck th,.giay-ck td{border:1px solid #333;padding:4px 6px;vertical-align:top}
.giay-ck th{font-weight:700;text-align:center}
.giay-ck td.r{text-align:right;white-space:nowrap}
.giay-ck td.c{text-align:center}
.giay-ck tr{break-inside:avoid}
.giay-ck .ky{display:grid;gap:8px;margin-top:22px;text-align:center;font-size:12.5px;break-inside:avoid}
.giay-ck .ky b{display:block}
.giay-ck .ky i{display:block;font-size:11.5px}
.giay-ck .ky .ten-ky{margin-top:62px;font-weight:700;min-height:1.45em}
.giay-ck .chan-giay{margin-top:28px;font-size:11.5px;font-style:italic;color:#333;border-top:1px solid #999;padding-top:8px}
.giay-ck .dau-dong{position:absolute;right:0;top:64px;border:2px solid #c2410c;color:#c2410c;padding:4px 10px;font:700 13px Inter,Arial,sans-serif;transform:rotate(-6deg);letter-spacing:.04em;background:rgba(255,255,255,.8)}
`;

/** Đầu giấy: tên đăng ký, mã số thuế, địa chỉ của công ty (bên trái) và số chứng từ (bên phải). */
function DauGiay({ hoSo, children }) {
  const cty = dauCongTy(hoSo);
  return (
    <div className="dau-giay">
      <div>
        <b>{cty.ten}</b>
        <br />
        Mã số thuế: {cty.maSoThue}
        <br />
        Địa chỉ: {cty.diaChi}
      </div>
      <div style={{ textAlign: "right" }}>{children}</div>
    </div>
  );
}

function TenGiay({ ten, ngay }) {
  return (
    <>
      <div className="ten-giay">{ten}</div>
      <div className="ngay-giay">{ngay}</div>
    </>
  );
}

/** Ô ký: mỗi cột một chức danh, "(Ký, ghi rõ họ tên)" và tên người (nếu có). */
function Ky({ cot }) {
  return (
    <div className="ky" style={{ gridTemplateColumns: `repeat(${cot.length}, 1fr)` }}>
      {cot.map(([chucDanh, ten]) => (
        <div key={chucDanh}>
          <b>{chucDanh}</b>
          <i>(Ký, ghi rõ họ tên)</i>
          <div className="ten-ky">{ten || ""}</div>
        </div>
      ))}
    </div>
  );
}

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

function GiayYeuCau({ ct, hoSo }) {
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

function GiayLenhDieuDong({ ct, hoSo }) {
  return (
    <>
      <DauGiay hoSo={hoSo}>Số: <b>{ct.soLenhDieuDong}</b></DauGiay>
      <TenGiay ten={LOAI_IN["lenh-dieu-dong"].ten} ngay={ngayChu(ct.ngayLenhDieuDong)} />
      <p>Căn cứ yêu cầu chuyển kho số <b>{ct.soPhieuChuyen}</b> ngày {ngayDu(ct.ngayTao)} của {ct.khoNhap?.ten};</p>
      <p>Quản lý Kho tổng điều động hàng hóa như sau:</p>
      <p>– Xuất tại kho: <b>{ct.khoXuat?.ten}</b>{sauTen(ct.khoXuat?.diaChi)}</p>
      <p>– Nhập tại kho: <b>{ct.khoNhap?.ten}</b>{sauTen(ct.khoNhap?.diaChi)}</p>
      <p>– Về việc: {veViec(ct, LY_DO_DIEU_DONG)}</p>
      <BangHangDon ct={ct} />
      <p>Kho xuất lập phiếu xuất kho kiêm vận chuyển nội bộ theo lệnh này trước khi hàng rời kho.</p>
      <Ky cot={[["Người đề nghị", ct.nguoiTao], ["Người ra lệnh", ct.nguoiRaLenh]]} />
      <div className="chan-giay">Lệnh do F Centric cấp số tự động khi phê duyệt yêu cầu chuyển kho.</div>
    </>
  );
}

function GiayXknb({ ct, hoSo }) {
  const coSo = Boolean(ct.soPhieuXknb);
  const daXuat = Boolean(ct.hinhThucVanChuyen);
  const { phuongTien, hopDong } = phuongTienIn(ct);
  const { dong, tongSoLuong, tongTien } = dongHangXknb(ct);
  const lyDo = tenLyDoDieuDong(ct.lyDoDieuDong, ct.ghiChuLenh, LY_DO_DIEU_DONG);
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
        Quản lý Kho tổng về việc {ct.lyDoDieuDong === "KHAC" ? lyDo : lyDo.toLowerCase()}
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

function GiayBienBan({ ct, hoSo }) {
  const bb = ct.bienBan;
  const { dong, tong } = dongBienBan(bb);
  const daXuLy = bb.phuongAn && bb.phuongAn !== "CHUA_XU_LY";
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
      {/* Ảnh không in (A3): chỉ ghi số ảnh đính kèm trên F Centric; không có ảnh thì bỏ dòng */}
      {bb.anh?.length ? <p>Ảnh kèm theo: {bb.anh.length} ảnh</p> : null}
      <Ky cot={[["Đại diện kho nhận", bb.nguoiLap], ["Người vận chuyển (lái xe)", bb.nguoiVanChuyen || ct.nguoiVanChuyen], ["Đại diện kho gửi", ""]]} />
      <div className="chan-giay">
        Biên bản lập 03 bản, mỗi bên giữ 01 bản.{" "}
        {daXuLy
          ? `Phần lệch đã được ${bb.nguoiDuyet ? `${bb.nguoiDuyet} ` : ""}xử lý trên F Centric: ${tenPhuongAn(bb.phuongAn).toLowerCase()}.`
          : `Phần lệch chờ ${aiXuLyChenhLech(ct)} xử lý trên F Centric.`}
      </div>
    </>
  );
}

function GiayDieuChinh({ pdc, hoSo }) {
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

/** Lỗi tải: 401/403 → không có quyền; 404 hoặc 400 "không tìm thấy" → không tìm thấy; còn lại → lỗi chung. */
function phanLoaiLoi(loi) {
  const ma = loi?.response?.status;
  const cau = loi?.response?.data?.message ?? "";
  if (ma === 401 || ma === 403) return "khongQuyen";
  if (ma === 404 || (ma === 400 && /không tìm thấy|not found/i.test(cau))) return "khongThay";
  return "loi";
}

/** Số in ở lề dưới mỗi trang và ở thanh công cụ. */
function soCuaGiay(loai, du) {
  if (!du) return "";
  if (loai === "dieu-chinh") return du.soPhieu ?? "";
  if (loai === "lenh-dieu-dong") return du.soLenhDieuDong ?? "";
  if (loai === "bien-ban") return du.bienBan?.soBienBan ?? "";
  // Phiếu XKNB chưa có số: không mượn số khác (giấy đã đóng dấu "CHƯA CÓ SỐ XKNB")
  if (loai === "xknb") return du.soPhieuXknb ? `${du.kyHieuXknb} ${du.soPhieuXknb}` : "";
  return du.soPhieuChuyen ?? "";
}

/**
 * Trang in của chuyển kho nội bộ (ngoài BackofficeLayout): `/transfer-tickets/:id/print/:loai` với loai = yeu-cau |
 * lenh-dieu-dong | xknb | bien-ban, và `/transfer-tickets/adjustments/:id/print` (`dieuChinh`) cho phiếu điều chỉnh kho.
 * Bố cục cố định theo tài liệu BA (không qua cấu hình mẫu in); đầu giấy lấy hồ sơ công ty dùng chung. Không in khi chưa
 * tải xong phiếu và hồ sơ, hoặc giấy chưa dùng được cho phiếu (vd. lệnh điều động khi phiếu chưa duyệt).
 */
export default function InChuyenKho({ dieuChinh = false }) {
  const { id, loai: loaiDuongDan } = useParams();
  const loai = dieuChinh ? "dieu-chinh" : loaiDuongDan;
  const mau = LOAI_IN[loai];
  const duongDanVe = dieuChinh ? `/transfer-tickets/adjustments/${id}` : `/transfer-tickets/${id}`;
  const tenChungTu = dieuChinh ? "phiếu điều chỉnh kho" : "phiếu chuyển kho";

  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState(null);
  const [hoSo, setHoSo] = useState(null);
  const [loiHoSo, setLoiHoSo] = useState(false);

  const taiHoSo = useCallback(async () => {
    setLoiHoSo(false);
    setHoSo(null);
    try {
      setHoSo(await companyProfileService.get());
    } catch (e) {
      console.error("Lỗi tải hồ sơ công ty:", e);
      setLoiHoSo(true);
    }
  }, []);

  const tai = useCallback(async () => {
    setDangTai(true);
    setLoi(null);
    try {
      const kq = dieuChinh ? await phieuChuyenKhoService.phieuDieuChinh(id) : await phieuChuyenKhoService.chiTiet(id);
      setDuLieu(kq ?? null);
      if (kq == null) setLoi("khongThay");
    } catch (e) {
      console.error("Lỗi tải dữ liệu in chuyển kho:", e);
      const loai = phanLoaiLoi(e);
      setLoi(loai);
      if (loai === "loi") toast.error("Không thể tải dữ liệu phiếu in");
    } finally {
      setDangTai(false);
    }
  }, [dieuChinh, id]);

  useEffect(() => {
    queueMicrotask(() => taiHoSo());
  }, [taiHoSo]);

  useEffect(() => {
    if (id && mau) queueMicrotask(() => tai());
  }, [id, mau, tai]);

  // Mở từ phiếu thì lùi về đúng trang đó (không chồng thêm lịch sử); mở thẳng bằng đường dẫn thì mở phiếu
  const ve = useQuayLai(duongDanVe);
  const nutVe = (
    <Button onClick={ve} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
      Quay lại
    </Button>
  );

  const chuaIn = !mau ? "Không có mẫu in này cho phiếu chuyển kho." : dieuChinh ? null : lyDoChuaIn(loai, duLieu);
  const so = soCuaGiay(loai, duLieu);
  const dangTaiHoSo = !hoSo && !loiHoSo;
  const sanSang = Boolean(mau && duLieu && hoSo && !loi && !chuaIn && !dangTai);

  let noiDung;
  if (!mau) {
    noiDung = <EmptyState icon={FileX} title="Không có mẫu in này" description={chuaIn} action={nutVe} />;
  } else if (dangTai || dangTaiHoSo) {
    noiDung = <LoadingState rows={5} label="Đang tải dữ liệu phiếu in" className="mx-auto max-w-xl" />;
  } else if (loi === "khongQuyen") {
    noiDung = (
      <EmptyState
        icon={Lock}
        title="Bạn không có quyền xem phiếu này."
        description="Tài khoản của bạn không có quyền truy cập phiếu này hoặc phiếu thuộc kho khác kho đang làm việc."
        action={nutVe}
      />
    );
  } else if (loi === "khongThay" || (!loi && !duLieu)) {
    noiDung = (
      <EmptyState
        icon={FileX}
        title={`Không tìm thấy ${tenChungTu}`}
        description="Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập."
        action={nutVe}
      />
    );
  } else if (loi === "loi") {
    noiDung = (
      <ErrorState
        title="Không thể tải phiếu in"
        description="Không thể tải dữ liệu phiếu. Vui lòng thử lại."
        onRetry={tai}
        className="mx-auto max-w-xl"
      />
    );
  } else if (loiHoSo) {
    noiDung = (
      <ErrorState
        title="Không thể tải hồ sơ công ty"
        description="Không thể tải hồ sơ công ty từ máy chủ. Không in khi chưa tải xong hồ sơ."
        onRetry={taiHoSo}
        className="mx-auto max-w-xl"
      />
    );
  } else if (chuaIn) {
    noiDung = <EmptyState icon={FileX} title={`Chưa in được ${mau.tieuDe.toLowerCase()}`} description={chuaIn} action={nutVe} />;
  } else {
    noiDung = (
      <div className="giay-ck">
        <style>{CSS_GIAY}</style>
        {loai === "dieu-chinh" ? <GiayDieuChinh pdc={duLieu} hoSo={hoSo} /> : null}
        {loai === "yeu-cau" ? <GiayYeuCau ct={duLieu} hoSo={hoSo} /> : null}
        {loai === "lenh-dieu-dong" ? <GiayLenhDieuDong ct={duLieu} hoSo={hoSo} /> : null}
        {loai === "xknb" ? <GiayXknb ct={duLieu} hoSo={hoSo} /> : null}
        {loai === "bien-ban" ? <GiayBienBan ct={duLieu} hoSo={hoSo} /> : null}
      </div>
    );
  }

  return (
    <PrintLayout
      title={mau ? `In ${mau.tieuDe.charAt(0).toLowerCase()}${mau.tieuDe.slice(1)}${so && sanSang ? `: ${so}` : ""}` : "In phiếu chuyển kho"}
      onBack={ve}
      onPrint={() => window.print()}
      disablePrint={!sanSang}
      pageFooter={sanSang && so ? `Số ${so}` : null}
    >
      {noiDung}
    </PrintLayout>
  );
}
