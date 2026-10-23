import { useId } from "react";
import DongNhomSanPham from "@/components/chung-tu/DongNhomSanPham";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { soVN } from "@/components/chung-tu/bangChungTu";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_SANG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_DAU_DONG_CON,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { cn } from "@/lib/utils";

/** "10 biến thể"; đang tìm mà nhóm chỉ còn một phần: "3/10 biến thể". */
const chuBienThe = (n) =>
  n.soBienThe !== n.soBienTheCaNhom ? `${soVN(n.soBienThe)}/${soVN(n.soBienTheCaNhom)} biến thể` : `${soVN(n.soBienThe)} biến thể`;

/**
 * Bảng hàng của các màn TẠO chứng từ (tạo phiếu nhập, tạo phiếu chuyển): cùng kiểu bảng của màn chi tiết
 * (BangHangChuyen) — gom theo sản phẩm, dòng nhóm có tổng, dòng biến thể thụt vào; quá NGUONG_CONG_CU dòng thì có
 * ô tìm, "Mở / Thu gọn tất cả" và phân trang theo sản phẩm (config/bangChungTu.js).
 *
 * - `bang`: kết quả useBangChungTu của màn (màn dùng chung tổng cho dòng phụ đầu khối).
 * - `cot`: các cột bên phải cột Sản phẩm `{ ma, nhan, lop, anHep, nhom: (n) => node, dong: (d) => node, phuHep }`;
 *   `lop`: lớp cho cả <th> và <td> (vd. "w-24 text-right"); `anHep`: ẩn khi khối hẹp hơn 672px;
 *   `phuHep: (d) => node`: khi khối hẹp (cột bị ẩn) ghi nội dung này dưới SKU của dòng biến thể để không mất thông tin.
 * - `nhan`: tên vùng bảng cho trình đọc màn hình (vd. "Hàng trong đơn mua").
 * - `dongSang`: id dòng tô sáng (vừa thêm / vừa quét). `tenChungTu`: cho câu "… chưa có sản phẩm nào".
 */
export default function BangHangTaoPhieu({
  bang,
  cot,
  dongSang,
  tenChungTu = "phiếu",
  nhan = "Hàng trong phiếu",
  goiYTim = "Tìm theo tên, SKU, màu hoặc kích cỡ",
  nhanTim = "Tìm trong phiếu",
  rongToiThieu = "@2xl/khoi:min-w-[560px]",
}) {
  const idBang = useId();
  const dsCot = Array.isArray(cot) ? cot.filter(Boolean) : [];
  // Chỉ phân trang khi có từ 2 trang hoặc số sản phẩm vượt cỡ trang nhỏ nhất: 1 sản phẩm nhiều biến thể thì không cần
  const coChanTrang = Boolean(bang.phanTrang)
    && (bang.soTrang > 1 || bang.tongMuc > Math.min(...(bang.luaChonCoTrang?.length ? bang.luaChonCoTrang : [Infinity])));
  const lopCot = (c, i) => cn(c.lop, c.anHep && AN_DIEN_THOAI, i === dsCot.length - 1 && O_CUOI);

  return (
    <section aria-label={nhan} className="flex min-w-0 flex-1 flex-col">
      {bang.chuGoiYThuGon ? (
        <p className="px-4 pt-3 text-[13px] leading-5 text-bo-muted sm:px-6">{bang.chuGoiYThuGon}</p>
      ) : null}
      {bang.coCongCu ? (
        <ThanhCongCuBang
          className="pt-3"
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim={goiYTim}
          nhanTim={nhanTim}
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          moHet={bang.moHet}
          onDoiMoHet={bang.doiMoTatCa}
        />
      ) : null}

      {bang.nhom.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, rongToiThieu)}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                {dsCot.map((c, i) => (
                  <th key={c.ma} scope="col" className={cn(O_TIEU_DE, lopCot(c, i))}>
                    {c.nhan}
                  </th>
                ))}
              </tr>
            </thead>
            {bang.nhom.map((n, iNhom) => {
              const idVung = `${idBang}-nhom-${iNhom}`;
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
                    {dsCot.map((c, i) => (
                      <td key={c.ma} className={cn(O, "font-semibold", lopCot(c, i))}>
                        {c.nhom ? c.nhom(n) : null}
                      </td>
                    ))}
                  </DongNhomSanPham>
                  {n.mo
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={cn(DONG, dongSang != null && String(dongSang) === String(d.id) && DONG_SANG)}>
                        <td className={cn(O, O_DAU_DONG_CON)}>
                          <MauKichCo dong={d} className="max-w-full" />
                          <div className="mt-0.5 break-all font-mono text-xs text-bo-muted">{d.sku || "—"}</div>
                          {dsCot.filter((c) => c.anHep && c.phuHep).map((c) => (
                            <div key={c.ma} className={cn("mt-0.5 text-xs text-bo-muted", CHI_DIEN_THOAI)}>{c.phuHep(d)}</div>
                          ))}
                        </td>
                        {dsCot.map((c, i) => (
                          <td key={c.ma} className={cn(O, lopCot(c, i))}>
                            {c.dong ? c.dong(d) : null}
                          </td>
                        ))}
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      <KhongKetQua bang={bang} tenChungTu={tenChungTu} donVi="biến thể" />
      {coChanTrang ? <PhanTrangBang {...bang.phanTrang} /> : null}
    </section>
  );
}
