import { createElement } from "react";
import { AlertTriangle, ArrowRight, Check, CircleDashed, ShieldAlert, ShieldCheck, UserRound, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { QUAN_TRI_VIEN, canKho, tenVaiTro } from "@/components/nguoi-dung/phanQuyen";

const NHAN_TAC_DUNG = "Hệ thống chưa kiểm quyền này. Bật hay tắt đều chưa chặn thao tác.";

/** Dấu ở đầu dòng: tròn đậm = theo mẫu (đã cấp, khi vai trò chưa có mẫu), cam = ngoài mẫu, viền = chưa cấp. */
function Dau({ cap, ngoaiMau }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
        !cap && "border-[1.5px] border-slate-300 bg-white",
        cap && !ngoaiMau && "bg-bo-foreground",
        cap && ngoaiMau && "bg-orange-600",
      )}
    >
      {cap ? <Check className="size-2.5 text-white" strokeWidth={3.5} /> : null}
    </span>
  );
}

function DongQuyen({ d, vaiTro, coMau }) {
  let goiY = "Chưa cấp";
  if (d.cap) {
    if (!coMau) goiY = "Đã cấp";
    else goiY = d.ngoaiMau ? `Cấp thêm ngoài mẫu ${tenVaiTro(vaiTro)}` : `Có trong mẫu ${tenVaiTro(vaiTro)}`;
  } else if (coMau && d.trongMau) {
    goiY = "Có trong mẫu nhưng chưa cấp";
  }
  return (
    <li className="flex min-h-[34px] items-center gap-2 border-t border-slate-100 px-3.5 py-[7px] text-[13px] leading-[18px] first:border-t-0" title={goiY}>
      <Dau cap={d.cap} ngoaiMau={d.ngoaiMau} />
      <span className={cn("min-w-0 flex-1", !d.cap && "text-slate-400")}>
        {d.ten}
        <span className="sr-only">{` · ${goiY}`}</span>
      </span>
      {d.nhayCam ? (
        <span className="inline-flex text-amber-700" title="Quyền nhạy cảm">
          <ShieldAlert className="size-3.5" aria-label="Quyền nhạy cảm" />
        </span>
      ) : null}
      {d.voHieu ? (
        <span title={`Vai trò ${tenVaiTro(vaiTro)} không mở được màn dùng quyền này`}>
          <StatusBadge label="Không có tác dụng" nhom="dong" />
        </span>
      ) : null}
      {d.chuaApDung ? (
        // Trang tổng quan chỉ đánh dấu nhẹ (ngăn kéo mới ghi chữ "Chưa áp dụng") để 3 cột luồng việc không bị chật
        <span className="inline-flex text-slate-400" title={`Chưa áp dụng. ${NHAN_TAC_DUNG}`}>
          <CircleDashed className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Chưa áp dụng</span>
        </span>
      ) : null}
    </li>
  );
}

function KhungNhom({ n, so, vaiTro, coMau }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-bo-border">
      <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-bo-border bg-bo-surface-subtle px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {so ? (
            <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-bo-foreground text-[11px] font-bold text-white">
              {so}
            </span>
          ) : null}
          {n.ten}
        </span>
        <span className="text-xs font-semibold tabular-nums text-bo-muted">
          {n.soCap}/{n.dong.length}
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {n.dong.map((d) => (
          <DongQuyen key={d.id} d={d} vaiTro={vaiTro} coMau={coMau} />
        ))}
      </ul>
    </div>
  );
}

function ChuGiai({ coChuaApDung, coMau }) {
  const o = "inline-flex items-center gap-1.5";
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-bo-muted">
      <span className={o}>
        <i className="inline-block size-2.5 rounded-[2px] bg-bo-foreground" />
        {coMau ? "Theo mẫu" : "Đã cấp"}
      </span>
      {/* Vai trò chưa có mẫu (hoặc không tải được cấu hình) thì không so với mẫu */}
      {coMau ? (
        <span className={o}>
          <i className="inline-block size-2.5 rounded-[2px] bg-orange-600" />
          Ngoài mẫu
        </span>
      ) : null}
      <span className={o}>
        <i className="inline-block size-2.5 rounded-[2px] border-[1.5px] border-slate-300 bg-white" />
        Chưa cấp
      </span>
      <span className={o}>
        <ShieldAlert className="size-3.5 text-amber-700" aria-hidden="true" />
        Nhạy cảm
      </span>
      {coChuaApDung ? (
        <span className={o}>
          <CircleDashed className="size-3.5 text-slate-400" aria-hidden="true" />
          Chưa áp dụng
        </span>
      ) : null}
    </div>
  );
}

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

/**
 * Tab Quyền truy cập: quyền tại kho phụ trách so với mẫu của vai trò, xếp theo luồng việc
 * Mua & nhập → Tồn kho → Bán & xuất, kèm Báo cáo và Danh mục & nhân sự.
 * Có cặp tạo–duyệt thì hiện lời nhắc kèm nút Xem lại quyền (mở ngăn kéo).
 */
export default function QuyenTruyCap({ vaiTro, pq, danhGia, coThePhanQuyen, onPhanQuyen }) {
  if (vaiTro === QUAN_TRI_VIEN) {
    return (
      <Trong
        icon={ShieldCheck}
        tieuDe="Quản trị viên có toàn quyền ở mọi kho"
        noiDung="Không cần phân kho hay quyền kho. Mọi thao tác của tài khoản này vẫn được ghi vào lịch sử."
      />
    );
  }
  if (!canKho(vaiTro)) {
    return (
      <Trong
        icon={UserRound}
        tieuDe="Tài khoản khách hàng không dùng màn nội bộ"
        noiDung="Không có kho và không có quyền theo kho."
      />
    );
  }
  if (!pq?.kho) {
    return (
      <Trong
        icon={Warehouse}
        mau="cam"
        tieuDe="Chưa phụ trách kho nào"
        noiDung={`${tenVaiTro(vaiTro)} cần một kho để làm việc. Chưa có kho thì mọi thao tác theo kho đều bị chặn.`}
      >
        {coThePhanQuyen ? (
          <Button type="button" onClick={onPhanQuyen} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
            Phân kho &amp; quyền
          </Button>
        ) : null}
      </Trong>
    );
  }

  const luong = danhGia.nhom.filter((n) => n.luong);
  const phu = danhGia.nhom.filter((n) => !n.luong);
  const tenKho = pq.kho.tenKho || pq.kho.maKho;

  // Ba cột luồng việc theo bề rộng vùng nội dung (container query), không theo khung trình duyệt:
  // cột thuộc tính bên phải chiếm chỗ từ xl nên bề rộng thật của vùng này không tỉ lệ với màn hình
  return (
    <div className="@container/quyen">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-6 text-bo-foreground">Quyền tại {tenKho}</h2>
          <p className="text-[13px] text-bo-muted">
            {danhGia.khongDocDuocMau
              ? `Chưa so được với mẫu quyền của vai trò ${tenVaiTro(vaiTro)}`
              : danhGia.soMau
                ? `So với mẫu quyền của vai trò ${tenVaiTro(vaiTro)}`
                : `Vai trò ${tenVaiTro(vaiTro)} chưa có mẫu quyền`}
          </p>
        </div>
        <ChuGiai coChuaApDung={danhGia.chuaApDung.length > 0} coMau={danhGia.soMau > 0} />
      </div>

      <div className="flex flex-col gap-3 @4xl/quyen:flex-row @4xl/quyen:items-stretch @4xl/quyen:gap-0">
        {luong.map((n, i) => (
          <div key={n.ma} className="contents">
            {i > 0 ? (
              <div className="hidden w-6 shrink-0 items-start justify-center pt-5 text-slate-400 @4xl/quyen:flex" aria-hidden="true">
                <ArrowRight className="size-4" />
              </div>
            ) : null}
            <KhungNhom n={n} so={i + 1} vaiTro={vaiTro} coMau={danhGia.soMau > 0} />
          </div>
        ))}
      </div>

      {phu.length ? (
        <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {phu.map((n) => (
            <KhungNhom key={n.ma} n={n} vaiTro={vaiTro} coMau={danhGia.soMau > 0} />
          ))}
        </div>
      ) : null}

      {danhGia.chuaApDung.length ? (
        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-[18px] text-bo-muted">
          <CircleDashed className="mt-px size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {danhGia.chuaApDung.length} quyền đã cấp hệ thống chưa kiểm khi thao tác: bật hay tắt đều chưa chặn được.
        </p>
      ) : null}

      {danhGia.capTrung.length ? (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-700" aria-hidden="true" />
          <div className="min-w-0 flex-1 basis-60 text-[13px] leading-5 text-orange-900">
            <div className="font-semibold">Người này vừa tạo vừa duyệt được {danhGia.capTrung.length} loại chứng từ</div>
            <div>
              {danhGia.capTrung.map((c) => c.ten).join(", ")}. Nên để một người khác duyệt để tránh sai sót và gian lận.
            </div>
          </div>
          {coThePhanQuyen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPhanQuyen}
              className="shrink-0 border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
            >
              Xem lại quyền
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
