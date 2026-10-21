import CotThuocTinh, {
  BangThuocTinh,
  ChungTuLienQuan,
  GiaTriSaoChep,
  NhomThuocTinh,
} from "@/components/chung-tu/CotThuocTinh";
import TuyenChuyen from "@/components/chung-tu/TuyenChuyen";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { formatDate } from "@/utils/formatters";
import { laDaXuat } from "./phieuXuat.js";

const ngay = (value) => (value ? formatDate(value) : null);
const doanGhiChu = (chu) => (chu ? <span className="whitespace-pre-line">{chu}</span> : null);

/**
 * Cột phải của Chi tiết phiếu xuất kho (mỗi thông tin một chỗ: mốc giờ ở tiến trình, hàng ở bảng).
 * - Chuyển kho: Tuyến chuyển (TuyenChuyen dùng chung với Phiếu chuyển kho), Người xuất khi đã xuất, Ghi chú còn lại (nếu có),
 *   Chứng từ liên quan: phiếu chuyển kho (mã tách từ ghi chú; API chi tiết không trả id phiếu chuyển nên không có liên kết).
 * - Bán hàng: Kho xuất, Ngày tạo / Ngày xuất (chỉ phiếu POS vì không có tiến trình), Người xuất khi đã xuất, Ghi chú;
 *   nhóm Giao vận khi ghi chú có thông tin vận chuyển; Chứng từ liên quan: đơn bán hàng (liên kết).
 * `ghiChu`: kết quả tachGhiChuPhieuXuat.
 */
export default function ThuocTinhPhieuXuat({ phieu, laCk, laPos, ghiChu }) {
  const daXuat = laDaXuat(phieu);
  const nguoiXuat = phieu.nguoiXuat?.hoTen;

  if (laCk) {
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
        <ChungTuLienQuan ds={ghiChu.maPhieuChuyen ? [{ loai: "Phiếu chuyển kho", ma: ghiChu.maPhieuChuyen }] : []} />
      </CotThuocTinh>
    );
  }

  const don = phieu.donBanHang;
  const gv = ghiChu.giaoVan;
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
      {gv ? (
        <NhomThuocTinh nhan="Giao vận">
          <BangThuocTinh
            rongNhan={124}
            muc={[
              { nhan: "Đơn vị vận chuyển", giaTri: gv.donViVanChuyen },
              {
                nhan: "Mã vận đơn",
                giaTri: gv.maVanDon ? (
                  <GiaTriSaoChep giaTri={gv.maVanDon} nhanSaoChep="Sao chép mã vận đơn" className="font-mono" />
                ) : null,
              },
              { nhan: "Cước thực tế", giaTri: gv.cuoc != null ? <span className="tabular-nums">{soVN(gv.cuoc)} ₫</span> : null },
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
