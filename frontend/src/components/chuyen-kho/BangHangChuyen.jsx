import { useId } from "react";
import DongNhomSanPham from "@/components/chung-tu/DongNhomSanPham";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import OTienDo from "@/components/chung-tu/OTienDo";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { soVN } from "@/components/chung-tu/bangChungTu";
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
  O_DAU_DONG_CON,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { cn } from "@/lib/utils";

/** "10 biến thể"; đang tìm / lọc mà nhóm chỉ còn một phần: "3/10 biến thể" (không tưởng nhầm là cả sản phẩm). */
const chuBienThe = (n) =>
  n.soBienThe !== n.soBienTheCaNhom ? `${soVN(n.soBienThe)}/${soVN(n.soBienTheCaNhom)} biến thể` : `${soVN(n.soBienThe)} biến thể`;

/**
 * Mục "Hàng chuyển" của phiếu chuyển kho: bảng gom theo sản phẩm (nhóm thu gọn được khi quá ngưỡng), cột Yêu cầu và,
 * khi đã có phiếu xuất con, cột "Đã lấy" (đang chọn lô) hoặc "Đã xuất". Nhiều dòng: tìm, lọc "Thiếu lô", phân trang
 * theo sản phẩm. DTO chuyển kho không có kích cỡ nên dòng biến thể chỉ ghi màu và SKU.
 * Khối hẹp (điện thoại, 768px có thanh bên) có cột "Đã lấy": ẩn cột Yêu cầu, ô "Đã lấy" ghi cả "đã/cần".
 *
 * - `bang`: kết quả useBangChungTu của trang (trang dùng chung tổng cho dòng phụ đầu khối và hộp xác nhận).
 * - `cot`: null | "daLay" | "daXuat". `coLoc`: hiện lọc "Thiếu lô" (bang phải dùng boLocHangChuyen(coLoc)).
 */
export default function BangHangChuyen({ bang, cot = null, coLoc = false }) {
  const idBang = useId();
  // Có cột Đã lấy / Đã xuất: khi hẹp ẩn cột Yêu cầu (số cần đã nằm trong ô "đã/cần")
  const anYeuCau = cot ? AN_DIEN_THOAI : null;
  const canhBao = cot === "daLay";

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">Hàng chuyển</h2>
        {bang.chuGoiYThuGon ? <span className="text-[13px] leading-5 text-bo-muted">{bang.chuGoiYThuGon}</span> : null}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo tên, SKU hoặc màu"
          nhanTim="Tìm trong phiếu chuyển kho"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          moHet={bang.moHet}
          onDoiMoHet={bang.doiMoTatCa}
          boLoc={coLoc ? (
            <NutPhanDoan
              nhan="Lọc theo số đã lấy"
              value={bang.locNhanh}
              onChange={bang.datLoc}
              luaChon={[
                { value: "tatCa", label: "Tất cả" },
                { value: "thieuLo", label: "Thiếu lô", count: bang.demLoc.thieuLo },
              ]}
            />
          ) : null}
        />
      ) : null}

      {bang.nhom.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, cot ? "@2xl/khoi:min-w-[560px]" : "@2xl/khoi:min-w-[420px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right", !cot && O_CUOI, anYeuCau)}>Yêu cầu</th>
                {cot ? (
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[150px]")}>{cot === "daXuat" ? "Đã xuất" : "Đã lấy"}</th>
                ) : null}
              </tr>
            </thead>
            {bang.nhom.map((n, i) => {
              const idVung = `${idBang}-nhom-${i}`;
              return (
                <tbody key={n.khoa} id={idVung}>
                  <DongNhomSanPham
                    ten={n.tenSanPham}
                    anh={n.anh}
                    mo={n.mo}
                    thuGonDuoc={n.thuGonDuoc}
                    onDoi={() => bang.doiNhom(n.khoa)}
                    idVung={idVung}
                    dongPhu={chuBienThe(n)}
                    tomTat={n.tomTat}
                  >
                    <td className={cn(O, "text-right font-semibold", !cot && O_CUOI, anYeuCau)}>{soVN(n.tong.soLuong)}</td>
                    {cot ? (
                      <td className={cn(O, O_CUOI)}>
                        <OTienDo da={n.tong.daLay} can={n.tong.soLuong} canhBaoKhiThieu={canhBao} />
                      </td>
                    ) : null}
                  </DongNhomSanPham>
                  {n.mo
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={DONG}>
                        <td className={cn(O, O_DAU_DONG_CON)}>
                          <MauKichCo dong={d} />
                          <div className="mt-0.5 break-all font-mono text-xs text-bo-muted">{d.sku || "—"}</div>
                        </td>
                        <td className={cn(O, "text-right", !cot && O_CUOI, anYeuCau)}>{soVN(d.soLuong)}</td>
                        {cot ? (
                          <td className={cn(O, O_CUOI)}>
                            {/* Rộng: cột Yêu cầu đã có số cần → chỉ ghi số đã lấy; hẹp (cột Yêu cầu ẩn) → "đã/cần" */}
                            <OTienDo da={d.daLay} can={d.soLuong} hienCan={false} canhBaoKhiThieu={canhBao} className={AN_DIEN_THOAI} />
                            <OTienDo da={d.daLay} can={d.soLuong} canhBaoKhiThieu={canhBao} className={CHI_DIEN_THOAI} />
                          </td>
                        ) : null}
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      {bang.khongKetQua && !bang.dangTim && bang.dangLoc ? (
        <KhongKetQua chu="Không còn biến thể nào thiếu lô." nhanNut="Xem tất cả" onNut={bang.xoaLoc} />
      ) : (
        <KhongKetQua bang={bang} tenChungTu="phiếu chuyển kho" donVi="biến thể" />
      )}
      <PhanTrangBang {...bang.phanTrang} />
    </section>
  );
}
