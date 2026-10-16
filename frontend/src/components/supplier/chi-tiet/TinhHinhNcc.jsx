import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils/formatters";

/** Màu và chữ của từng vạch trên ô "Giao đúng hạn" (6 đơn gần nhất, cũ bên trái). */
const VACH = {
  dungHan: { mau: "bg-bo-success", chu: "đúng hạn" },
  tre: { mau: "bg-amber-600", chu: "giao trễ" },
  quaHan: { mau: "bg-bo-danger", chu: "quá hạn, chưa nhận đủ" },
  homNay: { mau: "bg-slate-300", chu: "đến hạn hôm nay" },
  conLai: { mau: "bg-slate-300", chu: "chưa tới hạn" },
  khongCo: { mau: "bg-slate-300", chu: "chưa có ngày giao dự kiến" },
  daDu: { mau: "bg-slate-400", chu: "đã nhận đủ" },
};

function O({ nhan, giaTri, coGiaTri, children, phu }) {
  return (
    <div className="min-w-0 border-bo-border/70 px-4 py-3.5 odd:border-r @max-4xl:[&:nth-child(-n+2)]:border-b sm:px-6 sm:py-4 @4xl:border-r @4xl:last:border-r-0">
      <div className="text-xs font-medium leading-4 text-bo-muted">{nhan}</div>
      <div
        className={cn(
          "mt-1 truncate text-lg font-bold leading-7 tracking-tight tabular-nums sm:text-xl",
          coGiaTri ? "text-bo-heading" : "text-slate-400",
        )}
      >
        {giaTri}
      </div>
      {children}
      <div className="mt-1 text-xs leading-4 text-bo-muted">{phu}</div>
    </div>
  );
}

function DangTai() {
  return (
    <div className="@container border-t border-bo-border bg-bo-surface-subtle" aria-hidden="true">
      <div className="grid grid-cols-2 @4xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-bo-border/70 px-4 py-4 odd:border-r @max-4xl:[&:nth-child(-n+2)]:border-b sm:px-6 @4xl:border-r @4xl:last:border-r-0">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-2.5 h-6 w-28 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
      </div>
    </div>
  );
}

/**
 * Dải "Tình hình hợp tác" (thay chỗ thanh tiến trình bên Chi tiết đơn mua hàng): 4 ô số liệu
 * tính từ đơn mua, báo giá và phiếu nhập của nhà cung cấp (`tinhChiSo`).
 */
export default function TinhHinhNcc({ chiSo, dangTai, lyDoKhongTinhGiao }) {
  if (dangTai || !chiSo) return <DangTai />;

  const { giaTri, giaoDungHan, tiLeChot, lanDatGanNhat } = chiSo;
  const vach = giaoDungHan.vach;
  const moTaVach = vach.length
    ? `${vach.length} đơn gần nhất: ` + vach.map((v) => `${v.soDonMua || "đơn"} ${VACH[v.loai]?.chu ?? ""}`).join("; ")
    : "";

  let phuGiao;
  if (!giaoDungHan.tinhDuoc) phuGiao = lyDoKhongTinhGiao || "Chưa tính được";
  else if (giaoDungHan.daXet > 0) phuGiao = `${giaoDungHan.dungHan}/${giaoDungHan.daXet} đơn đã nhận đủ`;
  else phuGiao = "Chưa có đơn nhận đủ";

  return (
    // 4 ô một hàng khi khối đủ rộng (container query), không theo màn hình
    <section aria-label="Tình hình hợp tác" className="@container border-t border-bo-border bg-bo-surface-subtle">
      <div className="grid grid-cols-2 @4xl:grid-cols-4">
      <O
        nhan="Giá trị đơn mua"
        coGiaTri={giaTri.soDon > 0}
        giaTri={giaTri.soDon > 0 ? formatCurrency(giaTri.tong) : "—"}
        phu={giaTri.soDon > 0 ? `${giaTri.soDon} đơn đã chốt` : "Chưa có đơn mua đã chốt"}
      />
      <O
        nhan="Giao đúng hạn"
        coGiaTri={giaoDungHan.phanTram != null}
        giaTri={giaoDungHan.phanTram != null ? `${giaoDungHan.phanTram}%` : "—"}
        phu={phuGiao}
      >
        {vach.length ? (
          <div role="img" aria-label={moTaVach} className="mt-1.5 flex items-center gap-[3px]">
            {vach.map((v) => (
              <span
                key={v.id}
                title={`${v.soDonMua || "Đơn"} · ${VACH[v.loai]?.chu ?? ""}`}
                className={cn("block h-1.5 w-4 rounded-[2px]", VACH[v.loai]?.mau ?? "bg-slate-300")}
              />
            ))}
          </div>
        ) : null}
      </O>
      <O
        nhan="Tỉ lệ chốt báo giá"
        coGiaTri={tiLeChot.phanTram != null}
        giaTri={tiLeChot.phanTram != null ? `${tiLeChot.phanTram}%` : "—"}
        phu={tiLeChot.daXet > 0 ? `${tiLeChot.daChot}/${tiLeChot.daXet} báo giá đã xét` : "Chưa có báo giá đã xét"}
      />
      <O
        nhan="Lần đặt gần nhất"
        coGiaTri={Boolean(lanDatGanNhat)}
        giaTri={lanDatGanNhat ? formatDate(lanDatGanNhat.ngay) : "—"}
        phu={
          lanDatGanNhat ? (
            <>
              Đơn{" "}
              <Link
                to={`/purchase-orders/${lanDatGanNhat.don.id}`}
                className="font-medium text-bo-primary hover:text-bo-primary-hover hover:underline"
              >
                {lanDatGanNhat.don.soDonMua || `#${lanDatGanNhat.don.id}`}
              </Link>
            </>
          ) : (
            "Chưa đặt hàng"
          )
        }
      />
      </div>
    </section>
  );
}
