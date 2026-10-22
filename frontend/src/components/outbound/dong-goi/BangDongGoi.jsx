import { useEffect, useId } from "react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { coCongCu, soVN } from "@/components/chung-tu/bangChungTu";
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
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

const BO_LOC = Object.freeze({ chua: (d) => !d.du, tatCa: null });

/** Thanh tiến độ (đủ thì xanh lá). */
function Thanh({ phanTram, du, lon = false }) {
  return (
    <span aria-hidden="true" className={cn("block overflow-hidden rounded-full bg-slate-200/70", lon ? "h-2.5" : "h-1.5 min-w-10")}>
      <span
        className={cn("block h-full rounded-full", du ? "bg-bo-success" : "bg-bo-primary")}
        // data-viz: bề rộng theo phần trăm đã quét
        style={{ width: `${Math.max(0, Math.min(100, phanTram))}%` }}
      />
    </span>
  );
}

/** Cột Còn lại của một dòng: "Cất về kệ" (đơn bị hủy), thẻ "Đủ" hoặc "Còn n". */
function TrangThaiDong({ hoanKe, du, con }) {
  if (hoanKe) return <StatusBadge label="Cất về kệ" />;
  if (du) return <StatusBadge label="Đủ" />;
  return <span className="whitespace-nowrap font-semibold tabular-nums">Còn {soVN(con)}</span>;
}

/**
 * Bảng "Sản phẩm cần đóng gói": tiến độ cả phiếu (đã quét / cần, số dòng đủ, thanh lớn), lý do khóa Hoàn tất (chỉ khi
 * còn sửa được), mỗi dòng phiếu một dòng (tên, màu / cỡ · SKU · mã vạch, thanh "đã quét / cần", còn lại). Quá
 * NGUONG_CONG_CU dòng: ô tìm (tên, SKU, mã vạch), lọc "Chưa đủ (n)" (mặc định) / "Tất cả", phân trang theo dòng.
 *
 * - `dong`: tinhDongGoi.dongDongGoi đã xếp (chưa đủ trước). `tienDo`: tinhDongGoi.tienDoDongGoi. Bảng chỉ dựng khi đã
 *   có phiên nên lọc mặc định tính đúng theo số dòng thật.
 * - `lyDoKhoa`: "còn 3 sản phẩm chưa quét, thiếu video đóng gói" hoặc ""; `idLyDo`: id của dòng lý do (nút Hoàn tất trỏ tới).
 * - `dongSang`: id dòng vừa quét (tô xanh); `lanQuet` tăng sau mỗi lần quét được → bảng chuyển tới trang chứa dòng đó
 *   (dòng vừa đủ mà đang lọc "Chưa đủ" thì không còn trong bảng, như bản demo).
 * - Khối hẹp (< 672px): ẩn cột Còn lại, "Còn n" / thẻ Đủ / Cất về kệ xuống dưới số đã quét.
 * - `xong`: phiếu đã đóng gói xong (mọi dòng tính đủ). `hoanKe`: đơn bị hủy → cột cuối là thẻ "Cất về kệ".
 */
export default function BangDongGoi({ dong, tienDo, lyDoKhoa = "", idLyDo, dongSang = null, lanQuet = 0, xong = false, hoanKe = false }) {
  const idBang = useId();
  const bang = useBangChungTu(dong, {
    theo: "dong",
    boLoc: BO_LOC,
    // Ít dòng thì không có thanh công cụ → không lọc ngầm; đã đóng gói xong / đơn hủy thì xem tất cả dòng
    locMacDinh: coCongCu(dong.length) && !xong && !hoanKe ? "chua" : "tatCa",
    donVi: "dòng",
  });
  const coDong = bang.dong.length > 0;
  const denDong = bang.denDong;
  const datLoc = bang.datLoc;
  // Vừa hoàn tất / đơn vừa bị hủy: bỏ lọc "Chưa đủ" (không còn gì để quét, cần thấy mọi dòng)
  useEffect(() => {
    if (xong || hoanKe) datLoc("tatCa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xong, hoanKe]);
  useEffect(() => {
    if (lanQuet > 0 && dongSang != null) denDong(dongSang);
    // Chỉ chạy khi có lần quét mới (denDong là hàm mới sau mỗi lần vẽ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanQuet]);

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-5 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">Sản phẩm cần đóng gói</h2>
        <p className="m-0 text-[13px] leading-5 text-bo-muted tabular-nums">
          Đã quét {soVN(tienDo.da)}/{soVN(tienDo.can)} sản phẩm · {soVN(tienDo.dongDu)}/{soVN(tienDo.soDong)} dòng đủ
        </p>
      </div>
      <div className="px-4 pb-3 sm:px-6">
        <Thanh phanTram={tienDo.phanTram} du={tienDo.conLai === 0} lon />
      </div>
      {lyDoKhoa ? (
        <p id={idLyDo} className="-mt-1 px-4 pb-3 text-xs leading-4 text-bo-muted sm:px-6">Chưa hoàn tất được: {lyDoKhoa}.</p>
      ) : null}

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo tên, SKU hoặc mã vạch"
          nhanTim="Tìm trong phiếu"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          // Enter trong ô tìm (máy quét) không gửi biểu mẫu nào
          propsTim={{ onKeyDown: (suKien) => suKien.key === "Enter" && suKien.preventDefault() }}
          boLoc={
            <NutPhanDoan
              nhan="Lọc dòng"
              value={bang.locNhanh}
              onChange={bang.datLoc}
              luaChon={[
                { value: "chua", label: "Chưa đủ", count: bang.demLoc.chua },
                { value: "tatCa", label: "Tất cả" },
              ]}
            />
          }
        />
      ) : null}

      {coDong ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[560px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[140px] @max-2xl/khoi:w-[104px] @max-2xl/khoi:pr-4")}>Đã quét</th>
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[110px] text-right", AN_DIEN_THOAI)}>Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {bang.dong.map((d) => {
                const du = xong || d.du;
                return (
                  <tr key={d.id} className={cn(DONG, String(dongSang) === String(d.id) && DONG_SANG)}>
                    <td className={cn(O, O_DAU)}>
                      <span className="flex min-w-0 items-center gap-3">
                        <AnhBienThe />
                        <span className="block min-w-0">
                          <span className="line-clamp-2 font-medium leading-5 text-bo-foreground" title={d.tenSanPham}>{d.tenSanPham || "—"}</span>
                          <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
                            <span className="text-slate-700">{d.nhanBienThe}</span>
                            {" · "}
                            <span className="break-all font-mono">{d.sku || "—"}</span>
                            {d.maVach ? (
                              <>
                                {" · "}
                                <span className="break-all font-mono">{d.maVach}</span>
                              </>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={cn(O, "@max-2xl/khoi:pr-4")}>
                      <span className="grid grid-cols-[minmax(40px,1fr)_auto] items-center gap-2.5 @max-2xl/khoi:grid-cols-1 @max-2xl/khoi:gap-1">
                        <Thanh phanTram={du ? 100 : d.phanTram} du={du} />
                        <span className="whitespace-nowrap text-right text-[13px] tabular-nums text-slate-600">
                          <b className={cn("font-semibold", du || d.da > 0 ? "text-bo-foreground" : "text-bo-muted")}>{soVN(du ? d.can : d.da)}</b>/{soVN(d.can)}
                        </span>
                      </span>
                      <span className={cn("mt-1.5 block", CHI_DIEN_THOAI)}>
                        <TrangThaiDong hoanKe={hoanKe} du={du} con={d.con} />
                      </span>
                    </td>
                    <td className={cn(O, O_CUOI, "text-right", AN_DIEN_THOAI)}>
                      <TrangThaiDong hoanKe={hoanKe} du={du} con={d.con} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {bang.locNhanh === "chua" && !bang.dangTim && bang.khongKetQua ? (
        <KhongKetQua chu="Đã quét đủ mọi dòng." nhanNut="Xem tất cả dòng" onNut={() => bang.datLoc("tatCa")} />
      ) : (
        <KhongKetQua bang={bang} tenChungTu="phiếu xuất" donVi="dòng" />
      )}
      {bang.phanTrang ? <PhanTrangBang {...bang.phanTrang} /> : null}
    </section>
  );
}
