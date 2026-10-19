import { createElement } from "react";
import { Check, Minus, RefreshCcw, ShieldCheck, UserRound, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUAN_TRI_VIEN, canKho, maTranQuyen, moTaHieuLuc, vietHoaDau } from "@/components/nguoi-dung/phanQuyen";

const COT = [
  { khoa: "tao", nhan: "Tạo" },
  { khoa: "duyet", nhan: "Duyệt" },
  { khoa: "huy", nhan: "Hủy" },
];

/**
 * Trạng thái trống của tab: cùng kiểu EmptyState dùng chung (tab Lịch sử), không khung,
 * giãn hết vùng tab và đặt hơi cao hơn tâm (index.css › .nd-trong). `mau="cam"` khi cần xử lý.
 */
function Trong({ icon, tieuDe, noiDung, mau = "xanh", children }) {
  return (
    <div className="nd-trong flex min-h-48 flex-col items-center px-5 py-10 text-center">
      <span
        className={cn(
          "mb-3 flex size-11 items-center justify-center rounded-full",
          mau === "cam" ? "bg-bo-warning-soft text-amber-700" : "bg-bo-primary-soft text-bo-primary",
        )}
      >
        {createElement(icon, { className: "size-5", "aria-hidden": true })}
      </span>
      <h3 className="text-sm font-semibold text-bo-foreground">{tieuDe}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-bo-muted">{noiDung}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** Dấu của một quyền: tích đậm = đã cấp, gạch xám = chưa cấp. Không màu, không nhãn. */
function Dau({ cap }) {
  return cap ? (
    <Check className="size-4 shrink-0 text-slate-700" strokeWidth={2.5} aria-hidden="true" />
  ) : (
    <Minus className="size-3.5 shrink-0 text-slate-400" strokeWidth={2.5} aria-hidden="true" />
  );
}

/** Tô / làm mờ theo điểm đang đánh dấu ở khung Cần xem lại. */
function kieuDanhDau(danhDau, ma) {
  if (!danhDau) return "";
  return danhDau.has(ma) ? "bg-orange-100" : "opacity-30";
}

/** Chữ cho trình đọc màn hình: trạng thái cấp, kèm "cần xem lại" khi ô đang được tô. */
function chuDocMan(danhDau, d) {
  return `${d.cap ? "Đã cấp" : "Chưa cấp"}${danhDau?.has(d.ma) ? " · cần xem lại" : ""}`;
}

function MaTranChungTu({ hang, danhDau }) {
  return (
    // Hẹp: ma trận một hàng riêng (tối đa 560px), các nhóm việc xếp dưới; rộng từ 1024px (vùng tab): cùng một hàng
    <div className="min-w-0 @xl/quyen:col-span-3 @xl/quyen:max-w-[560px] @5xl/quyen:col-span-1 @5xl/quyen:max-w-none">
      <table className="w-full border-collapse text-[13.5px]">
        <caption className="sr-only">Quyền theo chứng từ: tạo, duyệt, hủy</caption>
        <thead>
          <tr className="h-9 border-b border-bo-border text-[12.5px] text-bo-muted">
            <th scope="col" className="text-left font-medium">
              Chứng từ
            </th>
            {COT.map((c) => (
              <th key={c.khoa} scope="col" className="w-[19%] text-center font-medium">
                {c.nhan}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hang.map((h) => {
            const o = COT.map((c) => h[c.khoa]);
            const hangMo = danhDau && !o.some((d) => d && danhDau.has(d.ma));
            return (
              <tr key={h.ten} className="h-9 border-b border-slate-100">
                <th scope="row" className={cn("text-left font-normal text-bo-foreground", hangMo && "opacity-40")}>
                  {h.ten}
                </th>
                {o.map((d, i) =>
                  d ? (
                    <td
                      key={COT[i].khoa}
                      title={`${d.ten} · ${d.cap ? "đã cấp" : "chưa cấp"}`}
                      className={cn("text-center", kieuDanhDau(danhDau, d.ma))}
                    >
                      <span className="inline-flex align-middle">
                        <Dau cap={d.cap} />
                      </span>
                      <span className="sr-only">{chuDocMan(danhDau, d)}</span>
                    </td>
                  ) : (
                    <td key={COT[i].khoa} className="text-center">
                      <span className="sr-only">Không áp dụng</span>
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NhomViec({ nhom, danhDau }) {
  return (
    <section aria-labelledby={`nhom-viec-${nhom.ma}`} className="min-w-0 text-[13.5px]">
      <h3 id={`nhom-viec-${nhom.ma}`} className="flex h-9 items-center border-b border-bo-border text-[12.5px] font-medium text-bo-muted">{nhom.ten}</h3>
      <ul className="m-0 list-none p-0">
        {nhom.dong.map((d) => (
          <li
            key={d.id}
            className={cn(
              "flex min-h-9 items-center gap-2 border-b border-slate-100 py-1.5 pr-1.5 leading-5",
              d.cap ? "text-bo-foreground" : "text-slate-500",
              kieuDanhDau(danhDau, d.ma),
            )}
          >
            <Dau cap={d.cap} />
            <span className="min-w-0">{d.ten}</span>
            <span className="sr-only"> · {chuDocMan(danhDau, d).toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Tab Quyền truy cập (Kiểu D · Ma trận chứng từ, chốt 19/10/2026): quyền tại nơi làm việc xếp thành ma trận
 * chứng từ × Tạo / Duyệt / Hủy và các nhóm việc khác, đơn sắc (tích = đã cấp, gạch = chưa cấp). Cùng một hàng có
 * tích ở cả Tạo lẫn Duyệt là thấy ngay người này tự tạo và tự duyệt chứng từ đó.
 * Không nhãn trên từng dòng: ngoài mẫu, không dùng được, cặp tạo–duyệt… gom ở khung Cần xem lại; bấm một điểm ở
 * đó thì `danhDau` (tập mã quyền) tô các ô liên quan, phần còn lại mờ đi.
 * Tên kho không nhắc lại ở đây (đã ở dòng phụ đầu trang); hiệu lực, người cấp, ghi chú nằm ở dòng phụ tiêu đề.
 */
export default function QuyenTruyCap({
  vaiTro,
  pq,
  danhGia,
  danhDau,
  coThePhanQuyen,
  onPhanQuyen,
  khongDocDuocCauHinh,
  onTaiLaiCauHinh,
  dangTaiCauHinh,
}) {
  if (vaiTro === QUAN_TRI_VIEN) {
    return (
      <Trong
        icon={ShieldCheck}
        tieuDe="Toàn quyền ở mọi kho"
        noiDung="Không cần nơi làm việc hay quyền tại kho. Mọi thao tác của tài khoản này vẫn được ghi vào lịch sử."
      />
    );
  }
  if (!canKho(vaiTro)) {
    return (
      <Trong
        icon={UserRound}
        tieuDe="Không dùng màn nội bộ"
        noiDung="Tài khoản bên ngoài: không có nơi làm việc và không có quyền theo kho."
      />
    );
  }
  if (!pq?.kho) {
    return (
      <Trong
        icon={Warehouse}
        mau="cam"
        tieuDe="Chưa có nơi làm việc"
        noiDung="Chọn nơi làm việc để cấp quyền. Chưa có thì mọi thao tác theo kho đều bị chặn."
      >
        {coThePhanQuyen ? (
          <Button type="button" onClick={onPhanQuyen} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
            Chọn nơi làm việc
          </Button>
        ) : null}
      </Trong>
    );
  }

  const { hang, viecKhac } = maTranQuyen(danhGia);
  const meta = [
    `${danhGia.soCap}/${danhGia.tong} quyền`,
    vietHoaDau(moTaHieuLuc(pq)),
    pq.tenNguoiCapQuyen ? `Người cấp: ${pq.tenNguoiCapQuyen}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="@container/quyen">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold leading-[22px] text-bo-heading">Quyền được cấp</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{meta}</p>
        {pq.ghiChu ? <p className="mt-0.5 break-words text-[13px] leading-5 text-bo-muted">Ghi chú: {pq.ghiChu}</p> : null}
        {khongDocDuocCauHinh ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-bo-muted">
            Không đọc được mẫu quyền theo vai trò nên chưa so được với mẫu.
            {onTaiLaiCauHinh ? (
              <button
                type="button"
                onClick={onTaiLaiCauHinh}
                disabled={dangTaiCauHinh}
                className="inline-flex items-center gap-1 font-medium text-bo-primary hover:text-bo-primary-hover disabled:opacity-50"
              >
                <RefreshCcw className="size-3.5" aria-hidden="true" />
                Thử lại
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="grid items-start gap-x-10 gap-y-6 @xl/quyen:grid-cols-3 @5xl/quyen:grid-cols-[minmax(340px,1.5fr)_repeat(3,minmax(0,1fr))]">
        {hang.length ? <MaTranChungTu hang={hang} danhDau={danhDau} /> : null}
        {viecKhac.map((n) => (
          <NhomViec key={n.ma} nhom={n} danhDau={danhDau} />
        ))}
      </div>
    </div>
  );
}
