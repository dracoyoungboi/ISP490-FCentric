import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX, Lock } from "lucide-react";
import PrintLayout from "@/components/print/PrintLayout";
import { CSS_GIAY, DauGiay, Ky, TenGiay } from "@/components/print/GiayChungTu";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import useQuayLai from "@/hooks/useQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { companyProfileService } from "@/services/companyProfileService";
import { layDong, layDot, layPhieuDieuChinh } from "@/services/stockTakeService";
import { DVT_MAC_DINH, gioPhut, ngayChu, ngayGio, soIn, tienIn } from "@/components/chuyen-kho/inChuyenKho";
import {
  LOAI_IN_KIEM_KE,
  bienBanKiemKe,
  dongPhieuDieuChinh,
  laBanNhap,
  lyDoChuaInKiemKe,
  phamViIn,
  tenLoaiDieuChinh,
} from "@/components/kiem-ke/inKiemKe";
import { TT_DOT } from "@/components/kiem-ke/kiemKe";
import { ROLES, hasAnyRole } from "@/utils/roles";

/* Phần riêng của giấy kiểm kê, thêm vào khung giấy dùng chung (GiayChungTu). */
const CSS_KIEM_KE = `
.giay-ct h3{font-size:13.5px;font-weight:700;margin:14px 0 2px}
.giay-ct table{margin:8px 0}
.giay-ct td.ghi,.giay-ct .ghi{font-style:italic;color:#444}
.giay-ct tr.cong td{font-weight:700}
.giay-ct .tong-hop td:nth-child(odd){width:34%}
.giay-ct .phu-luc{break-before:page;margin-top:36px;padding-top:28px;border-top:1px dashed #bbb}
.giay-ct .dau-nhap{display:inline-block;margin-top:8px;border:2px solid #c2410c;color:#c2410c;padding:3px 9px;font:700 12px Inter,Arial,sans-serif;letter-spacing:.04em;transform:rotate(-4deg)}
@media print{.giay-ct .phu-luc{margin-top:0;padding-top:0;border-top:0}}
`;

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
function GiayBienBan({ dot, dongApi, hoSo, coTien, phuLuc }) {
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
      <TenGiay ten={LOAI_IN_KIEM_KE["bien-ban"].ten} ngay={ngayLuc(nhap ? dot.ngayHoanThanh : dot.ngayDuyet)} />

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
function GiayDieuChinh({ dot, dongApi, phieu, hoSo }) {
  const { dong, tong } = useMemo(() => dongPhieuDieuChinh(dongApi), [dongApi]);
  return (
    <>
      <DauGiay hoSo={hoSo}>
        Số: <b>{phieu.soPhieu}</b>
      </DauGiay>
      <TenGiay ten={LOAI_IN_KIEM_KE["dieu-chinh"].ten} ngay={ngayChu(phieu.ngayDieuChinh)} />
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

/** Lỗi tải: 401/403 → không có quyền; 404 hoặc 400 "không tìm thấy" → không tìm thấy; còn lại → lỗi chung. */
function phanLoaiLoi(loi) {
  const ma = loi?.response?.status;
  const cau = loi?.response?.data?.message ?? "";
  if (ma === 401 || ma === 403) return "khongQuyen";
  if (ma === 404 || (ma === 400 && /không tìm thấy|not found/i.test(cau))) return "khongThay";
  return "loi";
}

/**
 * Trang in của kiểm kê (ngoài BackofficeLayout): `/stock-take/:id/print` (`loai` = "bien-ban") và
 * `/stock-take/:id/print-adjustment` (`loai` = "dieu-chinh", chỉ Quản trị viên, Quản lý kho — route chặn vai trò).
 * Tiền (đơn giá, giá trị chênh lệch) chỉ in cho Quản trị viên, Quản lý kho; nhân viên kho in bản chỉ có số lượng.
 */
export default function InKiemKe({ loai = "bien-ban" }) {
  const { id } = useParams();
  const mau = LOAI_IN_KIEM_KE[loai];
  const coTien = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  const [phuLuc, setPhuLuc] = useState(true);

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
      const [dot, dong] = await Promise.all([layDot(id), layDong(id)]);
      if (!dot) {
        setDuLieu(null);
        setLoi("khongThay");
        return;
      }
      const phieu = loai === "dieu-chinh" && Number(dot.trangThai) === TT_DOT.DA_DUYET ? await layPhieuDieuChinh(id) : null;
      setDuLieu({ dot, dong: dong ?? [], phieu: phieu ?? null });
    } catch (e) {
      console.error("Lỗi tải dữ liệu in kiểm kê:", e);
      const kieu = phanLoaiLoi(e);
      setLoi(kieu);
      if (kieu === "loi") toast.error("Không thể tải dữ liệu đợt kiểm kê");
    } finally {
      setDangTai(false);
    }
  }, [id, loai]);

  useEffect(() => {
    queueMicrotask(() => taiHoSo());
  }, [taiHoSo]);

  useEffect(() => {
    if (id && mau) queueMicrotask(() => tai());
  }, [id, mau, tai]);

  const ve = useQuayLai(`/stock-take/${id}`);
  const nutVe = (
    <Button onClick={ve} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
      Quay lại
    </Button>
  );

  const dot = duLieu?.dot ?? null;
  let chuaIn = !mau ? "Không có mẫu in này cho đợt kiểm kê." : lyDoChuaInKiemKe(loai, dot, duLieu?.phieu);
  // Dòng phiếu dựng lại từ dòng lệch của đợt: số dòng phải khớp phiếu đã ghi sổ, lệch thì không in giấy sai
  if (!chuaIn && loai === "dieu-chinh" && duLieu?.phieu) {
    const soDongDot = dongPhieuDieuChinh(duLieu.dong).dong.length;
    if (soDongDot !== Number(duLieu.phieu.soDong)) {
      chuaIn = `Phiếu ${duLieu.phieu.soPhieu} có ${duLieu.phieu.soDong} dòng nhưng đợt có ${soDongDot} dòng lệch. Báo quản trị viên kiểm tra trước khi in.`;
    }
  }
  const so = loai === "dieu-chinh" ? duLieu?.phieu?.soPhieu ?? "" : dot?.ma ?? "";
  const dangTaiHoSo = !hoSo && !loiHoSo;
  const sanSang = Boolean(mau && dot && hoSo && !loi && !chuaIn && !dangTai);

  let noiDung;
  if (!mau) {
    noiDung = <EmptyState icon={FileX} title="Không có mẫu in này" description={chuaIn} action={nutVe} />;
  } else if (dangTai || dangTaiHoSo) {
    noiDung = <LoadingState rows={5} label="Đang tải dữ liệu in" className="mx-auto max-w-xl" />;
  } else if (loi === "khongQuyen") {
    noiDung = (
      <EmptyState
        icon={Lock}
        title="Bạn không có quyền xem đợt kiểm kê này."
        description="Tài khoản của bạn không có quyền truy cập đợt này hoặc đợt thuộc kho khác kho đang làm việc."
        action={nutVe}
      />
    );
  } else if (loi === "khongThay" || (!loi && !dot)) {
    noiDung = (
      <EmptyState
        icon={FileX}
        title="Không tìm thấy đợt kiểm kê"
        description="Đợt có thể đã bị xóa hoặc bạn không có quyền truy cập."
        action={nutVe}
      />
    );
  } else if (loi === "loi") {
    noiDung = (
      <ErrorState
        title="Không thể tải dữ liệu in"
        description="Không thể tải đợt kiểm kê. Vui lòng thử lại."
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
      <div className="giay-ct">
        <style>{CSS_GIAY + CSS_KIEM_KE}</style>
        {loai === "dieu-chinh" ? (
          <GiayDieuChinh dot={dot} dongApi={duLieu.dong} phieu={duLieu.phieu} hoSo={hoSo} />
        ) : (
          <GiayBienBan dot={dot} dongApi={duLieu.dong} hoSo={hoSo} coTien={coTien} phuLuc={phuLuc} />
        )}
      </div>
    );
  }

  const tuyChon =
    loai === "bien-ban" && sanSang ? (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-bo-foreground select-none">
        <Checkbox checked={phuLuc} onCheckedChange={(v) => setPhuLuc(v === true)} aria-label="In kèm phụ lục bảng kiểm đếm" />
        <span className="max-sm:hidden">In kèm phụ lục</span>
        {/* Màn rất hẹp (320px) không đủ chỗ cho chữ cạnh nút Quay lại, In phiếu: chỉ còn ô chọn (có aria-label) */}
        <span className="sm:hidden max-[359px]:hidden">Phụ lục</span>
      </label>
    ) : null;

  return (
    <PrintLayout
      title={mau ? `In ${mau.tieuDe.charAt(0).toLowerCase()}${mau.tieuDe.slice(1)}${so && sanSang ? `: ${so}` : ""}` : "In kiểm kê"}
      onBack={ve}
      onPrint={() => window.print()}
      disablePrint={!sanSang}
      pageFooter={sanSang && so ? `Số ${so}` : null}
      toolbarExtra={tuyChon}
    >
      {noiDung}
    </PrintLayout>
  );
}
