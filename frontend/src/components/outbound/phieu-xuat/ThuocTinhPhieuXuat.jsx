import CotThuocTinh, {
  BangThuocTinh,
  ChungTuLienQuan,
  GiaTriSaoChep,
  NhomThuocTinh,
} from "@/components/chung-tu/CotThuocTinh";
import TuyenChuyen from "@/components/chung-tu/TuyenChuyen";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { formatDate } from "@/utils/formatters";
import { laDaXuat, layThongTinGiaoVan } from "./phieuXuat.js";

const ngay = (value) => (value ? formatDate(value) : null);
const doanGhiChu = (chu) => (chu ? <span className="whitespace-pre-line">{chu}</span> : null);

/**
 * Cột phải của Chi tiết phiếu xuất kho (mỗi thông tin một chỗ: mốc giờ ở tiến trình, hàng ở bảng).
 * - Chuyển kho: Tuyến chuyển (TuyenChuyen dùng chung với Phiếu chuyển kho), Người xuất khi đã xuất, Ghi chú còn lại (nếu có),
 *   Chứng từ liên quan: phiếu chuyển kho (soPhieuChuyenKhoGoc / phieuChuyenKhoGocId của máy chủ, liên kết tới màn phiếu
 *   chuyển; dữ liệu cũ thiếu id thì chỉ hiện mã tách từ ghi chú).
 * - Bán hàng: Kho xuất, Ngày tạo / Ngày xuất (chỉ phiếu POS vì không có tiến trình), Người xuất khi đã xuất, Ghi chú;
 *   nhóm Giao vận khi ghi chú có thông tin vận chuyển hoặc phiếu có cước thực tế (cột phiVanChuyenThucTe; phiếu cũ
 *   chỉ có cước trong ghi chú); Chứng từ liên quan: đơn bán hàng (liên kết).
 * `ghiChu`: kết quả tachGhiChuPhieuXuat.
 */
export default function ThuocTinhPhieuXuat({ phieu, laCk, laPos, ghiChu }) {
  const daXuat = laDaXuat(phieu);
  const nguoiXuat = phieu.nguoiXuat?.hoTen;

  if (laCk) {
    const maPhieuChuyen = phieu.soPhieuChuyenKhoGoc || ghiChu.maPhieuChuyen;
    return (
      <CotThuocTinh nhan="Thông tin phiếu xuất">
        <NhomThuocTinh nhan="Tuyến chuyển">
          <TuyenChuyen
            khoNguon={phieu.kho?.tenKho}
            khoDich={phieu.khoChuyenDen?.tenKho}
            ghiChu="Hàng đi qua kho Trung chuyển trong lúc vận chuyển"
          />
        </NhomThuocTinh>
        {daXuat || ghiChu.ghiChu ? (
          <NhomThuocTinh>
            <BangThuocTinh
              muc={[
                { nhan: "Người xuất", giaTri: nguoiXuat, an: !daXuat },
                { nhan: "Ghi chú", giaTri: doanGhiChu(ghiChu.ghiChu), an: !ghiChu.ghiChu },
              ]}
            />
          </NhomThuocTinh>
        ) : null}
        <ChungTuLienQuan ds={maPhieuChuyen ? [{
          loai: "Phiếu chuyển kho",
          ma: maPhieuChuyen,
          to: phieu.phieuChuyenKhoGocId != null ? `/transfer-tickets/${phieu.phieuChuyenKhoGocId}` : undefined,
        }] : []} />
      </CotThuocTinh>
    );
  }

  const don = phieu.donBanHang;
  const thongTin = layThongTinGiaoVan(phieu, ghiChu);
  const cuoc = thongTin.cuocThucTe;

  let nhanCod = thongTin.nhanThanhToan;
  if (!nhanCod && thongTin.tienThuHoCod != null) {
    const codNum = Number(thongTin.tienThuHoCod);
    nhanCod = codNum > 0 ? `Thu hộ (COD): ${soVN(codNum)} ₫` : "Đã thanh toán (COD: 0 đ)";
  }

  return (
    <CotThuocTinh nhan="Thông tin phiếu xuất">
      <NhomThuocTinh>
        <BangThuocTinh
          muc={[
            {
              nhan: "Kho xuất",
              giaTri: phieu.kho?.tenKho ? (
                <>
                  {phieu.kho.tenKho}
                  {phieu.kho.maKho ? <span className="ml-1.5 font-mono text-bo-muted">{phieu.kho.maKho}</span> : null}
                </>
              ) : null,
            },
            { nhan: "Ngày tạo", giaTri: ngay(phieu.ngayTao), an: !laPos },
            { nhan: "Ngày xuất", giaTri: ngay(phieu.ngayXuat), an: !laPos },
            { nhan: "Người xuất", giaTri: nguoiXuat, an: !daXuat },
            { nhan: "Ghi chú", giaTri: doanGhiChu(ghiChu.ghiChu) },
          ]}
        />
      </NhomThuocTinh>
      {thongTin.coSanThongTin || cuoc != null ? (
        <NhomThuocTinh nhan="Giao vận">
          <BangThuocTinh
            rongNhan={124}
            muc={[
              { nhan: "Đơn vị vận chuyển", giaTri: thongTin.donViVanChuyen ?? null, an: !thongTin.donViVanChuyen },
              {
                nhan: "Mã vận đơn",
                giaTri: thongTin.maVanDon ? (
                  <GiaTriSaoChep giaTri={thongTin.maVanDon} nhanSaoChep="Sao chép mã vận đơn" className="font-mono font-medium text-bo-primary" />
                ) : null,
                an: !thongTin.maVanDon,
              },
              {
                nhan: "Mã kiện hàng",
                giaTri: thongTin.maKienHang ? (
                  <GiaTriSaoChep giaTri={thongTin.maKienHang} nhanSaoChep="Sao chép mã kiện hàng" className="font-mono text-xs" />
                ) : null,
                an: !thongTin.maKienHang,
              },
              {
                nhan: "Mã chia chọn",
                giaTri: thongTin.maDinhTuyen ? (
                  <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800">
                    {thongTin.maDinhTuyen}
                  </span>
                ) : null,
                an: !thongTin.maDinhTuyen,
              },
              {
                nhan: "Trạm đích",
                giaTri: thongTin.maTramPhat ? (
                  <span className="font-mono text-xs text-slate-600">{thongTin.maTramPhat}</span>
                ) : null,
                an: !thongTin.maTramPhat,
              },
              {
                nhan: "Thu hộ (COD)",
                giaTri: nhanCod ? (
                  <span className="font-medium text-slate-700">{nhanCod}</span>
                ) : null,
                an: !nhanCod,
              },
              {
                nhan: "Chỉ dẫn sàn",
                giaTri: thongTin.chiDanDongKiem ? (
                  <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                    {thongTin.chiDanDongKiem}
                  </span>
                ) : null,
                an: !thongTin.chiDanDongKiem,
              },
              { nhan: "Cước thực tế", giaTri: cuoc != null ? <span className="tabular-nums font-mono">{soVN(cuoc)} ₫</span> : null, an: cuoc == null },
            ]}
          />
        </NhomThuocTinh>
      ) : null}
      <ChungTuLienQuan
        ds={
          don?.soDonHang
            ? [{ loai: "Đơn bán hàng", ma: don.soDonHang, to: don.id ? `/sales-orders/${don.id}` : undefined }]
            : []
        }
      />
    </CotThuocTinh>
  );
}
