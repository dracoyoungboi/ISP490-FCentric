import { Barcode, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import ChipLo from "@/components/chung-tu/ChipLo";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import OTienDo from "@/components/chung-tu/OTienDo";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_MO,
  DONG_SANG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { formatQuantity } from "@/constants/outbound";
import { cn } from "@/lib/utils";
import { DON_VI_DONG, TEN_CHUNG_TU } from "./tinhPhieuNhat";

// Câu khi lọc nhanh không còn dòng (theo demo, rõ hơn câu chung "Không có … ở bộ lọc này.")
const CHU_LOC_RONG = {
  conThieu: "Mọi dòng đã nhặt đủ.",
  du: "Chưa có dòng nào nhặt đủ.",
};

// Ô cuối của hàng khi khối hẹp mà cột Thao tác đang ẩn: lề phải trùng lề khối như O_CUOI
const CUOI_KHI_HEP = "@max-2xl/khoi:pr-4 @max-2xl/khoi:sm:pr-6";

/**
 * Bảng "Sản phẩm cần nhặt" (bảng phẳng, mỗi dòng một biến thể). `bang`: kết quả useBangChungTu theo dòng của trang
 * (trang giữ để gọi `denDong` sau mỗi lần quét). Thứ tự dòng cố định; dòng vừa quét tô sáng (`dongSang`).
 * Ít dòng: lọc Tất cả / Còn thiếu / Đủ ở hàng tiêu đề; quá ngưỡng: thêm ô tìm + phân trang theo dòng.
 * Cột Thao tác (Phân bổ lô) chỉ khi `duocPhanBoLo`; dòng "Đã bỏ" (số cần nhặt 0) không có nút.
 * Khối hẹp (< 672px: điện thoại, 768px có thanh bên): cột "Lô gợi ý" và "Thao tác" ẩn, lô + nút Phân bổ lô xuống dưới tên
 * sản phẩm để cột "Đã nhặt" luôn trong khung.
 */
export default function BangDongNhat({ bang, duocPhanBoLo, dongSang, onPhanBoLo }) {
  const boLoc = bang.rong ? null : (
    <NutPhanDoan
      nhan="Lọc dòng"
      value={bang.locNhanh}
      onChange={bang.datLoc}
      luaChon={[
        { value: "tatCa", label: "Tất cả" },
        { value: "conThieu", label: "Còn thiếu", count: bang.demLoc.conThieu ?? 0 },
        { value: "du", label: "Đủ", count: bang.demLoc.du ?? 0 },
      ]}
    />
  );

  return (
    <section aria-labelledby="bang-nhat" className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
        <h2 id="bang-nhat" className="text-base font-semibold leading-6 text-bo-foreground">
          Sản phẩm cần nhặt
        </h2>
        {bang.coCongCu ? null : boLoc}
      </div>

      {bang.coCongCu ? (
        <ThanhCongCuBang
          tuKhoa={bang.tuKhoa}
          onDoiTuKhoa={bang.datTuKhoa}
          onXoaTuKhoa={bang.xoaTuKhoa}
          goiYTim="Tìm theo tên, SKU hoặc mã vạch"
          nhanTim="Tìm trong phiếu nhặt hàng"
          ketQua={bang.chuKetQua}
          khongKetQua={bang.khongKetQua}
          boLoc={boLoc}
        />
      ) : null}

      {bang.rong ? null : (
        <div className={KHUNG_CUON}>
          <table
            aria-labelledby="bang-nhat"
            className={cn(BANG, "table-fixed", duocPhanBoLo ? "@2xl/khoi:min-w-[700px]" : "@2xl/khoi:min-w-[560px]")}
          >
            <thead>
              <tr className={DONG_TIEU_DE}>
                <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[176px]", AN_DIEN_THOAI)}>Lô gợi ý</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[156px]", duocPhanBoLo ? CUOI_KHI_HEP : O_CUOI)}>
                  Đã nhặt
                </th>
                {duocPhanBoLo ? (
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[128px]", AN_DIEN_THOAI)}>
                    <span className="sr-only">Thao tác</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {bang.dong.map((d) => (
                <DongNhat
                  key={d.id}
                  dong={d}
                  sang={dongSang != null && String(dongSang) === String(d.id)}
                  duocPhanBoLo={duocPhanBoLo}
                  onPhanBoLo={onPhanBoLo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bang.khongKetQua && !bang.dangTim ? (
        <KhongKetQua
          bang={bang}
          chu={CHU_LOC_RONG[bang.locNhanh]}
          donVi={DON_VI_DONG}
          nhanNut="Xem tất cả"
          onNut={bang.xoaLoc}
        />
      ) : (
        <KhongKetQua bang={bang} tenChungTu={TEN_CHUNG_TU} donVi={DON_VI_DONG} />
      )}
      <PhanTrangBang {...bang.phanTrang} />
    </section>
  );
}

/** Lô gợi ý của một dòng: thẻ lô (nhập trước lấy trước hoặc đã sửa tay), cảnh báo thiếu lô / chưa phân bổ. */
function LoGoiY({ dong: d }) {
  if (d.trangThai === "bo") return <span className="text-bo-muted">—</span>;
  if (d.chuaLo) return <span className="text-xs font-medium leading-4 text-bo-warning">Chưa phân bổ lô</span>;
  return (
    <>
      <ChipLo lo={d.lo} cuaDong={d.sku} />
      <div className={cn("mt-1 text-xs leading-4", d.thuCong ? "text-slate-600" : "text-bo-muted")}>
        {d.thuCong ? "Đã sửa tay" : "Nhập trước lấy trước"}
      </div>
      {d.thieuLo > 0 ? (
        <div className="mt-1 text-xs font-medium leading-4 text-bo-warning">
          Còn thiếu {formatQuantity(d.thieuLo)} theo lô — tồn theo lô không đủ
        </div>
      ) : null}
    </>
  );
}

function NutPhanBoLo({ dong: d, onPhanBoLo, className }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onPhanBoLo(d.goc)}
      aria-label={`Phân bổ lô cho ${d.sku || d.tenSanPham}`}
      className={cn(
        "h-7 gap-1 border-bo-border bg-bo-surface px-2 text-xs font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle",
        className,
      )}
    >
      <Layers className="size-3.5" aria-hidden="true" />
      Phân bổ lô
    </Button>
  );
}

function DongNhat({ dong: d, sang, duocPhanBoLo, onPhanBoLo }) {
  const bo = d.trangThai === "bo";
  const coNut = duocPhanBoLo && !bo;

  return (
    <tr className={cn(DONG, bo && DONG_MO, sang && DONG_SANG)}>
      <td className={cn(O, O_DAU)}>
        <div className="flex min-w-0 items-start gap-3 @2xl/khoi:items-center">
          <AnhBienThe src={d.anh} />
          <div className="min-w-0 flex-1">
            <div
              className={cn("line-clamp-2 break-words font-medium leading-5", bo ? "text-slate-500" : "text-bo-foreground")}
              title={d.tenSanPham}
            >
              {d.tenSanPham || "—"}
            </div>
            {/* Màu / kích cỡ, SKU, mã vạch: xuống dòng theo từng mục khi cột hẹp (không cắt mã) */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-4 text-bo-muted">
              <MauKichCo dong={d} />
              {d.sku ? <span className="min-w-0 break-all font-mono">{d.sku}</span> : null}
              {d.maVach ? (
                <span className="inline-flex min-w-0 items-center gap-1 break-all font-mono">
                  <Barcode className="size-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Mã vạch </span>
                  {d.maVach}
                </span>
              ) : null}
            </div>
            {/* Khối hẹp: lô và nút Phân bổ lô nằm dưới tên (cột riêng đang ẩn) */}
            {bo ? null : (
              <div className={cn("mt-2", CHI_DIEN_THOAI)}>
                <LoGoiY dong={d} />
                {coNut ? <NutPhanBoLo dong={d} onPhanBoLo={onPhanBoLo} className="mt-2" /> : null}
              </div>
            )}
          </div>
        </div>
      </td>

      <td className={cn(O, AN_DIEN_THOAI)}>
        <LoGoiY dong={d} />
      </td>

      <td className={cn(O, duocPhanBoLo ? CUOI_KHI_HEP : O_CUOI)}>
        {bo ? (
          <span title="Đơn chứa dòng này đã hủy, số cần nhặt giảm về 0">
            <StatusBadge label="Đã bỏ" />
            <span className="sr-only">: đơn chứa dòng này đã hủy, số cần nhặt giảm về 0</span>
          </span>
        ) : (
          <OTienDo da={d.da} can={d.can} />
        )}
      </td>

      {duocPhanBoLo ? (
        <td className={cn(O, O_CUOI, "text-right", AN_DIEN_THOAI)}>
          {coNut ? <NutPhanBoLo dong={d} onPhanBoLo={onPhanBoLo} /> : null}
        </td>
      ) : null}
    </tr>
  );
}
