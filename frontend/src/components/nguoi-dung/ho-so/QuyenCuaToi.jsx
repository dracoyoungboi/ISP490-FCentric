import { createElement } from "react";
import { Check, Info, Mail, ShieldCheck, UserRound, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/shared/ErrorState";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { SIDEBAR_MENU } from "@/components/backoffice/sidebar.config";
import {
  QUAN_TRI_VIEN,
  canKho,
  moTaHieuLuc,
  ngayGio,
  quyenCuaToiTheoNhom,
  tenVaiTro,
} from "@/components/nguoi-dung/phanQuyen";

function Trong({ icon, tieuDe, noiDung, netDut, mau = "xanh", children }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg px-6 py-12 text-center",
        netDut ? "border border-dashed border-slate-300" : "border border-bo-border",
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          mau === "cam" ? "bg-bo-warning-soft text-amber-700" : "bg-bo-primary-soft text-bo-primary",
        )}
      >
        {createElement(icon, { className: "size-5", "aria-hidden": true })}
      </span>
      <div className="mt-1 text-base font-semibold text-bo-foreground">{tieuDe}</div>
      <div className="max-w-[480px] text-sm text-bo-muted">{noiDung}</div>
      {children}
    </div>
  );
}

/** Dòng nhắc dưới lưới việc (chứng từ cần người khác duyệt, quyền không dùng được, quyền vừa thu hồi). */
function DongNhac({ children }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg border border-bo-border bg-bo-surface-subtle px-3.5 py-3 text-[13px] leading-[19px] text-slate-700">
      <Info className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function NutEmail({ email, ten }) {
  if (!email) return null;
  return (
    <Button asChild variant="outline" className="mt-2 border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle">
      <a href={`mailto:${email}`}>
        <Mail className="size-4" aria-hidden="true" />
        Gửi email cho {ten || "quản trị viên"}
      </a>
    </Button>
  );
}

/**
 * Tab Quyền của tôi ở Hồ sơ (chốt 18/10/2026): việc người dùng làm được tại kho đang phụ trách,
 * đọc từ CSDL (không từ phiên đăng nhập). Quyền vừa cấp có thẻ "Mới" cho tới khi đăng nhập lại;
 * quyền vừa bị thu hồi, quyền vai trò không mở được màn dùng nó và chứng từ cần người khác duyệt có dòng nhắc riêng.
 */
export default function QuyenCuaToi({ quyen, dangTai, loi, onThuLai }) {
  if (loi && !quyen) {
    return (
      <ErrorState
        className="min-h-48"
        title="Không tải được quyền của bạn"
        description="Kiểm tra kết nối rồi thử lại."
        onRetry={onThuLai}
      />
    );
  }
  if (dangTai && !quyen) {
    return (
      <div className="grid gap-4 pt-3 sm:grid-cols-2" role="status" aria-label="Đang tải quyền của bạn">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }
  if (!quyen) return null;

  if (quyen.toanQuyen || quyen.vaiTro === QUAN_TRI_VIEN) {
    return (
      <Trong
        icon={ShieldCheck}
        tieuDe="Bạn có toàn quyền ở mọi kho"
        noiDung="Quản trị viên mở được mọi màn hình và làm được mọi thao tác. Mọi thao tác vẫn được ghi vào lịch sử."
      />
    );
  }
  if (!canKho(quyen.vaiTro)) {
    return (
      <Trong
        icon={UserRound}
        tieuDe="Tài khoản khách hàng không dùng màn nội bộ"
        noiDung="Tài khoản này không có kho và không có quyền theo kho."
      />
    );
  }
  if (!quyen.kho) {
    return (
      <Trong
        icon={Warehouse}
        netDut
        mau="cam"
        tieuDe="Bạn chưa được phân kho"
        noiDung="Khi được phân kho, các việc bạn làm được sẽ hiện ở đây. Trước đó, mọi thao tác theo kho đều bị chặn."
      >
        <NutEmail email={quyen.capNhatBoiEmail} ten={quyen.capNhatBoi} />
      </Trong>
    );
  }

  const { nhom, soViec, soDaCap, khongDungDuoc, canDuyet, daThuHoi } = quyenCuaToiTheoNhom(quyen, { menu: SIDEBAR_MENU });
  const tenKho = quyen.kho.tenKho || quyen.kho.maKho;
  const tenVt = tenVaiTro(quyen.vaiTro);
  const hieuLuc = moTaHieuLuc({ ngayBatDau: quyen.ngayBatDau, ngayKetThuc: quyen.ngayKetThuc });

  return (
    <div className="pt-3">
      <div className="mb-4 flex flex-wrap items-center gap-3.5 rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-bo-primary shadow-sm">
          <Warehouse className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="text-base font-semibold leading-6 text-bo-foreground">Việc bạn làm được tại {tenKho}</h2>
          <p className="text-[13px] text-bo-muted">
            {tenVt} · {soViec} việc · hiệu lực {hieuLuc}
          </p>
        </div>
        {quyen.capNhatBoi || quyen.capNhatLuc ? (
          <div className="text-right text-[12.5px] leading-[18px] text-bo-muted max-sm:text-left">
            {quyen.capNhatBoi ? (
              <>
                Cập nhật bởi <b className="font-semibold text-bo-foreground">{quyen.capNhatBoi}</b>
                <br />
              </>
            ) : null}
            {ngayGio(quyen.capNhatLuc)}
          </div>
        ) : null}
      </div>

      {soViec ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {nhom.map((n) => (
            <section key={n.ma} className="rounded-lg border border-bo-border">
              <div className="flex items-center justify-between gap-2 border-b border-bo-border px-3.5 py-2.5 text-[13px] font-semibold">
                <span>{n.ten}</span>
                <span className="font-medium text-bo-muted">{n.viec.length} việc</span>
              </div>
              <ul className="m-0 list-none p-0">
                {n.viec.map((v) => (
                  <li key={v.ma} className="flex items-start gap-2.5 border-t border-slate-100 px-3.5 py-2.5 first:border-t-0">
                    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-green-600" aria-hidden="true">
                      <Check className="size-2.5 text-white" strokeWidth={3.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium leading-5">
                        {v.ten}
                        {v.moi ? <StatusBadge label="Mới" nhom="dang" /> : null}
                      </span>
                      {v.moTa ? <span className="block text-xs leading-4 text-bo-muted">{v.moTa}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-bo-muted">
          {soDaCap ? (
            <>
              <span className="max-w-[560px]">
                Các quyền bạn được cấp tại {tenKho} chưa dùng được vì vai trò {tenVt} không mở được màn hình của:{" "}
                {khongDungDuoc.join(", ")}. Liên hệ quản trị viên để chỉnh lại.
              </span>
              <NutEmail email={quyen.capNhatBoiEmail} ten={quyen.capNhatBoi} />
            </>
          ) : (
            `Bạn đã được phân ${tenKho} nhưng chưa được cấp việc nào.`
          )}
        </div>
      )}

      {canDuyet.length || (soViec && khongDungDuoc.length) || daThuHoi.length ? (
        <div className="mt-4 flex flex-col gap-2.5">
          {canDuyet.length ? (
            <DongNhac>Bạn lập được {canDuyet.join(" và ")}. Chứng từ bạn lập cần người có quyền duyệt xác nhận.</DongNhac>
          ) : null}
          {soViec && khongDungDuoc.length ? (
            <DongNhac>
              Được cấp nhưng chưa dùng được vì vai trò {tenVt} không mở được màn hình của: {khongDungDuoc.join(", ")}.
            </DongNhac>
          ) : null}
          {daThuHoi.length ? (
            <DongNhac>
              Không còn làm được: {daThuHoi.join(", ")}
              {quyen.capNhatLuc ? ` (thu hồi lúc ${ngayGio(quyen.capNhatLuc)})` : ""}.
            </DongNhac>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
