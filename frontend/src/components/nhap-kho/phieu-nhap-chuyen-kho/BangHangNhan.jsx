import { useId } from "react";
import ChipLo from "@/components/chung-tu/ChipLo";
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
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_DAU_DONG_CON,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { cn } from "@/lib/utils";

const CHU_LO = {
  dangTai: "Đang tải lô…",
  loi: "Không tải được lô",
  co: "—",
};

/** Số mã lô khác nhau của một nhóm; còn dòng chưa có lô (đang tải / lỗi) thì không ghi. */
function soLoCuaNhom(dong) {
  if (dong.some((d) => d.trangThaiLo !== "co")) return "";
  const so = new Set(dong.flatMap((d) => d.lo.map((l) => l.maLo))).size;
  return so ? `${soVN(so)} lô` : "";
}

/** "10 biến thể"; đang tìm mà nhóm chỉ còn một phần: "3/10 biến thể". */
const chuBienThe = (n) =>
  n.soBienThe !== n.soBienTheCaNhom ? `${soVN(n.soBienThe)}/${soVN(n.soBienTheCaNhom)} biến thể` : `${soVN(n.soBienThe)} biến thể`;

function LoCuaDong({ dong }) {
  return (
    <ChipLo
      lo={dong.lo}
      cuaDong={dong.sku || dong.tenSanPham}
      khiTrong={<span className="text-xs">{CHU_LO[dong.trangThaiLo] ?? "—"}</span>}
    />
  );
}

/**
 * Mục "Hàng nhận" của phiếu nhập chuyển kho / hoàn trả / khách trả: bảng gom theo sản phẩm (nhóm thu gọn được khi quá
 * ngưỡng), cột "Lô kế thừa" (thẻ lô, "+n lô") và Số lượng. Nhiều dòng: tìm theo tên, SKU, màu, kích cỡ, mã lô và phân
 * trang theo sản phẩm. Khối hẹp (điện thoại, 768px có thanh bên): cột lô ẩn, thẻ lô xuống dưới tên biến thể.
 * `bang`: kết quả useBangChungTu của trang (dùng chung tổng ở đầu khối và hộp xác nhận).
 */
export default function BangHangNhan({ bang }) {
  const idBang = useId();

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">Hàng nhận</h2>
        {bang.chuGoiYThuGon ? <span className="text-[13px] leading-5 text-bo-muted">{bang.chuGoiYThuGon}</span> : null}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo tên, SKU, màu, kích cỡ hoặc mã lô"
          nhanTim="Tìm trong phiếu nhập kho"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          moHet={bang.moHet}
          onDoiMoHet={bang.doiMoTatCa}
        />
      ) : null}

      {bang.nhom.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[600px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[38%]", AN_DIEN_THOAI)}>Lô kế thừa</th>
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-24 text-right")}>Số lượng</th>
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
                    <td className={cn(O, "text-xs text-bo-muted", AN_DIEN_THOAI)}>{soLoCuaNhom(n.dong)}</td>
                    <td className={cn(O, O_CUOI, "text-right font-semibold")}>{soVN(n.tong.soLuong)}</td>
                  </DongNhomSanPham>
                  {n.mo
                    ? n.dong.map((d) => (
                      <tr key={d.id} className={DONG}>
                        <td className={cn(O, O_DAU_DONG_CON)}>
                          <MauKichCo dong={d} />
                          <div className="mt-0.5 break-all font-mono text-xs text-bo-muted">{d.sku || "—"}</div>
                          <div className={cn("mt-1.5", CHI_DIEN_THOAI)}>
                            <LoCuaDong dong={d} />
                          </div>
                        </td>
                        <td className={cn(O, AN_DIEN_THOAI)}>
                          <LoCuaDong dong={d} />
                        </td>
                        <td className={cn(O, O_CUOI, "text-right")}>{soVN(d.soLuong)}</td>
                      </tr>
                    ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      <KhongKetQua bang={bang} tenChungTu="phiếu nhập kho" donVi="biến thể" />
      <PhanTrangBang {...bang.phanTrang} />
    </section>
  );
}
