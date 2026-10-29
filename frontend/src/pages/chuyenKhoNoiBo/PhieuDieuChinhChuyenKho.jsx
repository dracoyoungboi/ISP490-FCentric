import { useCallback, useId } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import CotThuocTinh, { BangThuocTinh, ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import {
  chuLech,
  dongDieuChinh,
  ngayGio,
  soIn,
  tenLoaiSoKho,
  tenPhuongAn,
  tienIn,
  trangThaiDieuChinh,
} from "@/components/chuyen-kho/inChuyenKho";
import { getPhieuChuyenKhoStatus } from "@/constants/phieuChuyenKho";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useQuayLai from "@/hooks/useQuayLai";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { cn } from "@/lib/utils";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;
const LienKetPhieu = ({ to, children }) => (
  <Link to={to} className="rounded font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30">
    {children}
  </Link>
);

/** Số có dấu của sổ kho: giảm ghi "−3" (dấu trừ thật, không phải gạch nối). */
const soCoDau = (n) => {
  const so = Number(n) || 0;
  return so < 0 ? `−${soIn(-so)}` : soIn(so);
};

function TieuDeMuc({ id, ten, phu }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
      <h2 id={id} className="text-base font-semibold leading-6 text-bo-foreground">{ten}</h2>
      {phu ? <span className="text-[13px] leading-5 text-bo-muted">{phu}</span> : null}
    </div>
  );
}

/** Bảng "Hàng điều chỉnh" và "Sổ kho ghi kèm" của phiếu điều chỉnh. */
function BangDieuChinh({ pdc, tinh }) {
  const id = useId();
  const { dong, tongSoLuong, tongTien } = tinh;
  const soKho = pdc.soKho ?? [];
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <section aria-labelledby={`${id}-hang`}>
        <TieuDeMuc id={`${id}-hang`} ten="Hàng điều chỉnh" phu={`${soIn(dong.length)} dòng · ${soIn(tongSoLuong)} sản phẩm`} />
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[720px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI)}>Lô</th>
                <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI)}>Lệch theo biên bản</th>
                <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Số lượng giảm</th>
                <th scope="col" className={cn(O_TIEU_DE, "text-right", AN_DIEN_THOAI)}>Giá vốn</th>
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "text-right")}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {dong.map((d) => {
                const lech = chuLech(d);
                return (
                  <tr key={d.khoa} className={DONG}>
                    <td className={cn(O, O_DAU)}>
                      <div className="font-medium text-bo-foreground">{d.tenSanPham || d.sku}</div>
                      <MauKichCo dong={d} className="mt-0.5 text-[13px] text-slate-600" />
                      <div className="mt-0.5 break-all font-mono text-xs text-bo-muted">{d.sku || "—"}</div>
                      <div className={cn("mt-1 text-xs leading-4 text-bo-muted", CHI_DIEN_THOAI)}>
                        {[d.maLo ? `Lô ${d.maLo}` : "", lech].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className={cn(O, "whitespace-nowrap font-mono text-xs", AN_DIEN_THOAI)}>{d.maLo || "—"}</td>
                    <td className={cn(O, AN_DIEN_THOAI)}>
                      {lech || <span className="text-bo-muted">—</span>}
                      {d.lyDo ? <div className="mt-0.5 text-xs leading-4 text-bo-muted">{d.lyDo}</div> : null}
                    </td>
                    <td className={cn(O, "text-right font-semibold")}>−{soIn(d.soLuong)}</td>
                    <td className={cn(O, "text-right", AN_DIEN_THOAI)}>{d.giaVon == null ? "—" : tienIn(d.giaVon)}</td>
                    <td className={cn(O, O_CUOI, "text-right")}>{d.thanhTien == null ? "—" : tienIn(d.thanhTien)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-b border-slate-100 font-semibold tabular-nums text-bo-foreground">
                <td className={cn(O, O_DAU)}>Tổng</td>
                <td className={cn(O, AN_DIEN_THOAI)} />
                <td className={cn(O, AN_DIEN_THOAI)} />
                <td className={cn(O, "text-right")}>−{soIn(tongSoLuong)}</td>
                <td className={cn(O, AN_DIEN_THOAI)} />
                <td className={cn(O, O_CUOI, "text-right")}>{tongTien == null ? "—" : tienIn(tongTien)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {soKho.length ? (
        <section aria-labelledby={`${id}-so-kho`} className="pb-4">
          <TieuDeMuc id={`${id}-so-kho`} ten="Sổ kho ghi kèm" phu="Thẻ kho của kho trung chuyển, loại Điều chỉnh" />
          <div className={KHUNG_CUON}>
            <table className={cn(BANG, "@2xl/khoi:min-w-[640px]")}>
              <thead>
                <tr className={DONG_TIEU_DE}>
                  <th scope="col" className={cn(O_TIEU_DE, O_DAU, AN_DIEN_THOAI)}>Kho</th>
                  <th scope="col" className={cn(O_TIEU_DE, "@max-2xl/khoi:pl-4")}>Sản phẩm · lô</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI)}>Loại</th>
                  <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Số lượng</th>
                  <th scope="col" className={cn(O_TIEU_DE, "text-right")}>Trước</th>
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "text-right")}>Sau</th>
                </tr>
              </thead>
              <tbody>
                {soKho.map((s, i) => (
                  <tr key={`${s.sku}-${s.maLo}-${i}`} className={DONG}>
                    <td className={cn(O, O_DAU, AN_DIEN_THOAI)}>{s.kho}</td>
                    <td className={cn(O, "@max-2xl/khoi:pl-4")}>
                      <span className="font-mono text-xs">{s.sku}</span>
                      <span className="text-bo-muted"> · </span>
                      <span className="font-mono text-xs">{s.maLo}</span>
                      {s.ngay ? <div className="mt-0.5 text-xs text-bo-muted">{ngayGio(s.ngay)}</div> : null}
                    </td>
                    <td className={cn(O, AN_DIEN_THOAI)}>{tenLoaiSoKho(s.loai)}</td>
                    <td className={cn(O, "text-right")}>{soCoDau(s.soLuong)}</td>
                    <td className={cn(O, "text-right")}>{soIn(s.truoc)}</td>
                    <td className={cn(O, O_CUOI, "text-right")}>{soIn(s.sau)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pt-3 text-xs leading-4 text-bo-muted sm:px-6">
            Trước, Sau là tồn của lô ở kho trung chuyển tại lúc ghi; kho trung chuyển dùng chung cho mọi phiếu chuyển.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Phiếu điều chỉnh kho ghi giảm chênh lệch chuyển kho (/transfer-tickets/adjustments/:id), theo bản demo đã duyệt:
 * máy chủ lập phiếu khi duyệt xử lý chênh lệch (ghi giảm hoặc giao bù; ai được duyệt theo Cấu hình › Chuyển kho) và
 * trừ ngay khỏi kho trung chuyển, nên màn chỉ xem và in. Bảng hàng theo lô kèm số lệch của biên bản, sổ kho ghi kèm; cột phải: chứng từ nguồn
 * (phiếu chuyển, biên bản, phiếu giao bù) và thông tin phiếu. Đổi phiếu trên cùng đường dẫn thì dựng lại màn (`key`).
 */
export default function PhieuDieuChinhChuyenKho() {
  const { id } = useParams();
  return <ManPhieuDieuChinh key={id} id={id} />;
}

function ManPhieuDieuChinh({ id }) {
  const navigate = useNavigate();
  const tai = useCallback(() => phieuChuyenKhoService.phieuDieuChinh(id), [id]);
  const q = useTaiDuLieu(tai, `phieu-dieu-chinh-${id}`);
  const pdc = q.data;
  // Không có trang trước trong ứng dụng: về phiếu chuyển của phiếu điều chỉnh (chưa tải được thì về danh sách)
  const quayLai = useQuayLai(pdc?.phieuChuyen?.id ? `/transfer-tickets/${pdc.phieuChuyen.id}` : "/transfer-tickets");

  if (!pdc) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        {q.loading || !q.error ? (
          <KhungDangTai nhan="Đang tải phiếu điều chỉnh kho" />
        ) : (
          <KhungLoiChungTu
            loi={q.error}
            tenChungTu="phiếu điều chỉnh kho"
            onVeDanhSach={() => navigate("/transfer-tickets")}
            nhanVeDanhSach="Về danh sách phiếu chuyển kho"
            onThuLai={q.reload}
          />
        )}
      </PageContainer>
    );
  }

  const tinh = dongDieuChinh(pdc);
  const tt = trangThaiDieuChinh(pdc.trangThai);
  const tenPa = tenPhuongAn(pdc.phuongAn);
  const giaoBu = pdc.phuongAn === "GIAO_BU_HANG";
  const pc = pdc.phieuChuyen;
  const khoTen = pdc.kho || "Kho trung chuyển";

  const lienQuan = [
    pc ? {
      khoa: `pc-${pc.id}`,
      loai: "Phiếu chuyển kho",
      ma: pc.so,
      to: `/transfer-tickets/${pc.id}`,
      trangThai: getPhieuChuyenKhoStatus(pc.trangThai, pdc.phuongAn === "GHI_GIAM_HAO_HUT").label,
      quyTrinh: "chuyenKho",
    } : null,
    pdc.bienBan && pc ? {
      khoa: `bb-${pdc.bienBan.id}`,
      loai: "Biên bản giao nhận",
      ma: pdc.bienBan.so,
      to: `/transfer-tickets/${pc.id}/print/bien-ban`,
    } : null,
    pdc.phieuGiaoBu ? {
      khoa: `gb-${pdc.phieuGiaoBu.id}`,
      loai: "Phiếu chuyển giao bù",
      ma: pdc.phieuGiaoBu.so,
      to: `/transfer-tickets/${pdc.phieuGiaoBu.id}`,
      trangThai: getPhieuChuyenKhoStatus(pdc.phieuGiaoBu.trangThai).label,
      quyTrinh: "chuyenKho",
    } : null,
  ].filter(Boolean);

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma={pdc.soPhieu}
            trangThai={tt}
            dongPhu={[
              "Phiếu điều chỉnh kho",
              <span key="giam"><B>giảm {soIn(tinh.tongSoLuong)} sản phẩm</B> tại {khoTen}</span>,
              pdc.bienBan && pc ? `theo biên bản ${pdc.bienBan.so} của ${pc.so}` : null,
            ]}
            onQuayLai={quayLai}
            nhanQuayLai="Quay lại"
            saoChepMa={{ giaTri: pdc.soPhieu, nhan: "Sao chép mã phiếu" }}
            nutPhu={{ nhan: "In phiếu", icon: Printer, onClick: () => navigate(`/transfer-tickets/adjustments/${id}/print`) }}
          />
        }
        thongBao={
          <DongThongBao tone="info">
            Phiếu lập tự động khi duyệt phương án <B>{tenPa}</B>, trong cùng một lần lưu với việc đóng phiếu
            chuyển
            {giaoBu && pdc.phieuGiaoBu ? (
              <>
                {" "}và sinh phiếu giao bù <LienKetPhieu to={`/transfer-tickets/${pdc.phieuGiaoBu.id}`}>{pdc.phieuGiaoBu.so}</LienKetPhieu>
              </>
            ) : null}
            . Trừ {soIn(tinh.tongSoLuong)} sản phẩm khỏi kho trung chuyển (kho ảo của hàng đang đi đường) và ghi sổ kho loại
            Điều chỉnh. Phiếu đã áp dụng thì không sửa, không xóa.
          </DongThongBao>
        }
        chinh={<BangDieuChinh pdc={pdc} tinh={tinh} />}
        cotPhai={
          <CotThuocTinh nhan="Thông tin phiếu điều chỉnh kho">
            <ChungTuLienQuan ds={lienQuan} nhan="Nguồn" />
            <NhomThuocTinh nhan="Thông tin phiếu">
              <BangThuocTinh
                rongNhan={128}
                muc={[
                  { ma: "nguon", nhan: "Nguồn", giaTri: "Chuyển kho nội bộ" },
                  { ma: "tuyen", nhan: "Tuyến", giaTri: pdc.khoXuatTen && pdc.khoNhapTen ? `${pdc.khoXuatTen} → ${pdc.khoNhapTen}` : null },
                  { ma: "kho", nhan: "Kho", giaTri: khoTen },
                  { ma: "loai", nhan: "Loại", giaTri: "Giảm" },
                  { ma: "pa", nhan: "Phương án", giaTri: tenPa },
                  { ma: "lyDo", nhan: "Lý do", giaTri: pdc.lyDo },
                  { ma: "lenh", nhan: "Lệnh điều động", giaTri: pdc.soLenhDieuDong },
                  { ma: "lap", nhan: "Người lập", giaTri: pdc.nguoiLap },
                  { ma: "duyet", nhan: "Người duyệt", giaTri: pdc.nguoiDuyet },
                  { ma: "luc", nhan: "Áp dụng lúc", giaTri: ngayGio(pdc.ngayDuyet || pdc.ngayDieuChinh) || null },
                  { ma: "tien", nhan: "Tổng giá trị giảm", giaTri: tinh.tongTien == null ? null : `${tienIn(tinh.tongTien)} đ` },
                ]}
              />
            </NhomThuocTinh>
          </CotThuocTinh>
        }
      />
    </PageContainer>
  );
}
