import { createElement } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  ChartColumn,
  Check,
  Layers,
  Package,
  Tag,
  Users,
} from "lucide-react";
import ErrorState from "@/components/shared/ErrorState";
import StatusBadge from "@/components/shared/StatusBadge";
import { SIDEBAR_MENU } from "@/components/backoffice/sidebar.config";
import {
  QUAN_TRI_VIEN,
  hieuLucCuaToi,
  mailtoLienHe,
  ngayGio,
  quyenCuaToiTheoNhom,
} from "@/components/nguoi-dung/phanQuyen";
import { cn } from "@/lib/utils";

const ID_TIEU_DE = "ho-so-quyen";
const KHUNG = "px-4 py-5 sm:px-6 sm:py-[22px]";
const TIEU_DE = "text-[15px] font-semibold leading-[22px] text-bo-foreground";
/** Có từ chừng này việc trở xuống thì hiện luôn mô tả dưới mỗi việc (nhiều hơn thì mô tả chỉ hiện khi rê chuột). */
const SO_VIEC_HIEN_MO_TA = 6;
const PHU = "mt-0.5 text-[12.5px] leading-[18px] text-bo-muted";

const BIEU_TUONG = {
  nhap: ArrowDownToLine,
  ton: Package,
  xuat: ArrowUpFromLine,
  bao_cao: ChartColumn,
  san_pham: Tag,
  doi_tac: Building2,
  nhan_su: Users,
  khac: Layers,
};

/** "Cần hỗ trợ? Liên hệ quản trị viên." — có email liên hệ của công ty thì là liên kết mở thư soạn sẵn. */
function LienHe({ email, chuDe }) {
  const href = mailtoLienHe(email, chuDe);
  if (!href) return <>Liên hệ quản trị viên nếu cần hỗ trợ.</>;
  return (
    <>
      Cần hỗ trợ?{" "}
      <a href={href} className="font-medium text-bo-primary hover:underline">
        Liên hệ quản trị viên
      </a>
      .
    </>
  );
}

// Số cột theo số nhóm (viết tường minh để Tailwind sinh đủ class): tối đa 4 cột, nhóm thứ 5 trở đi xuống hàng
const COT_THEO_SO_NHOM = {
  1: "",
  2: "@md:grid-cols-2",
  3: "@md:grid-cols-2 @2xl:grid-cols-3",
  4: "@md:grid-cols-2 @3xl:grid-cols-4",
};

/**
 * Khung chia cột như bảng: mỗi ô một nhóm việc, tối đa 4 cột (quản lý kho có tới 7 nhóm thì xuống hàng);
 * khung hẹp thì 2 cột rồi 1 cột. Đường kẻ: mỗi ô kẻ phải và dưới, lưới lùi 1px để giấu đường kẻ sát mép khung.
 */
function KhungQuyen({ nhom, hienMoTa }) {
  const cot = COT_THEO_SO_NHOM[Math.min(nhom.length, 4)] ?? "";
  return (
    <div className="@container mt-3.5">
      <div className="overflow-hidden rounded-[10px] border border-bo-border bg-bo-surface">
        <div className={cn("-mb-px -mr-px grid", cot)}>
          {nhom.map((n) => (
            <section
              key={n.ma}
              aria-label={`${n.ten}: ${n.viec.length} việc`}
              className="min-w-0 border-b border-r border-slate-100"
            >
              <h3 className="flex h-10 items-center gap-2 whitespace-nowrap border-b border-slate-100 bg-bo-surface-subtle px-4 text-[12.5px] font-semibold text-slate-600">
                {createElement(BIEU_TUONG[n.bieuTuong] ?? Layers, { className: "size-3.5 shrink-0 text-slate-400", "aria-hidden": true })}
                <span className="min-w-0 truncate">{n.ten}</span>
                <span className="ml-auto font-medium tabular-nums text-slate-400" aria-hidden="true">
                  {n.viec.length}
                </span>
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 px-4 pb-3.5 pt-3">
                {n.viec.map((v) => (
                  // Ít việc: mô tả hiện luôn dưới tên việc. Nhiều việc: mô tả hiện khi rê chuột, trình đọc màn hình đọc kèm.
                  <li
                    key={v.ma}
                    title={!hienMoTa && v.moTa ? v.moTa : undefined}
                    className="flex items-start gap-1.5 text-sm leading-5 text-bo-foreground"
                  >
                    <Check className="mt-[3px] size-3.5 shrink-0 text-bo-success" aria-hidden="true" />
                    <span className="min-w-0">
                      {v.ten}
                      {v.moTa && !hienMoTa ? <span className="sr-only">: {v.moTa}</span> : null}
                      {v.moi ? (
                        <span className="ml-1.5 inline-flex align-middle">
                          <StatusBadge label="Mới" nhom="dang" />
                        </span>
                      ) : null}
                      {hienMoTa && v.moTa ? (
                        <span className="mt-0.5 block text-[12.5px] leading-[18px] text-bo-muted">{v.moTa}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Mục Quyền của tôi ở Hồ sơ (chốt 18/10/2026), đọc từ CSDL (GET /nguoi-dung/me/quyen, không từ phiên đăng nhập).
 * - Quản trị viên: không có mục này (chốt 31/10/2026) — đầu trang đã ghi "Quản trị viên · Toàn quyền trên mọi kho".
 * - Ít việc (≤ SO_VIEC_HIEN_MO_TA): mô tả hiện luôn dưới mỗi việc để người dùng hiểu việc mình làm được.
 * - Nhân viên có kho: dòng "N việc · hiệu lực" (chữ cam khi sắp hết) và khung chia cột theo nhóm việc; quyền vừa
 *   cấp có thẻ "Mới" cho tới khi đăng nhập lại, quyền vừa thu hồi có một dòng mờ. Tên kho đã có ở đầu trang.
 * - Chưa phân kho: ô viền đứt kèm liên kết liên hệ quản trị viên (email liên hệ của công ty).
 */
export default function QuyenCuaToi({ vaiTro, quyen, dangTai, loi, onThuLai, emailLienHe }) {
  // Vai trò lấy từ hồ sơ để biết ngay là quản trị viên, không phải chờ tải quyền
  const vt = quyen?.vaiTro ?? vaiTro;
  // Quản trị viên không có mục Quyền (trang Hồ sơ cũng không gọi tới); giữ để an toàn nếu nơi khác dùng lại
  if (quyen?.toanQuyen || vt === QUAN_TRI_VIEN) return null;

  const tieuDe = (
    <h2 id={ID_TIEU_DE} className={TIEU_DE}>
      Quyền của tôi
    </h2>
  );

  if (!quyen) {
    return (
      <section aria-labelledby={ID_TIEU_DE} className={KHUNG}>
        {tieuDe}
        {loi && !dangTai ? (
          <ErrorState
            className="mt-3.5 min-h-40 rounded-lg border border-bo-border py-6"
            title="Không tải được quyền của bạn"
            description="Kiểm tra kết nối rồi thử lại."
            onRetry={onThuLai}
          />
        ) : (
          <div role="status" aria-label="Đang tải quyền của bạn" className="mt-3.5 h-28 animate-pulse rounded-[10px] bg-slate-100" />
        )}
      </section>
    );
  }

  if (!quyen.kho) {
    return (
      <section aria-labelledby={ID_TIEU_DE} className={KHUNG}>
        {tieuDe}
        <div className="mt-3.5 rounded-lg border border-dashed border-slate-300 px-4 py-3.5">
          <div className="text-sm font-medium leading-5 text-bo-foreground">Bạn chưa được phân kho</div>
          <p className={PHU}>
            Khi được phân kho, việc bạn làm được sẽ hiện ở đây. <LienHe email={emailLienHe} chuDe="Đề nghị phân kho" />
          </p>
        </div>
      </section>
    );
  }

  const { nhom, soViec, soDaCap, daThuHoi } = quyenCuaToiTheoNhom(quyen, { menu: SIDEBAR_MENU });
  const hieuLuc = hieuLucCuaToi(quyen.ngayKetThuc);

  return (
    <section aria-labelledby={ID_TIEU_DE} className={KHUNG}>
      {tieuDe}
      <p className={cn(PHU, "tabular-nums")}>
        {soViec} việc ·{" "}
        <span className={hieuLuc.sapHet ? "font-semibold text-orange-800" : undefined}>
          {hieuLuc.moTa}
          {hieuLuc.sapHet && hieuLuc.conNgay != null ? ` (còn ${hieuLuc.conNgay} ngày)` : ""}
        </span>
      </p>

      {soViec ? (
        <KhungQuyen nhom={nhom} hienMoTa={soViec <= SO_VIEC_HIEN_MO_TA} />
      ) : (
        <div className="mt-3.5 rounded-lg border border-dashed border-slate-300 px-4 py-3.5 text-[13px] leading-[19px] text-bo-muted">
          {soDaCap
            ? "Các quyền bạn được cấp chưa dùng được với vai trò hiện tại. "
            : "Bạn đã được phân kho nhưng chưa được cấp việc nào. "}
          <LienHe email={emailLienHe} chuDe="Đề nghị cấp quyền" />
        </div>
      )}

      {daThuHoi.length ? (
        <p className="mt-2.5 text-[12.5px] leading-[18px] text-bo-muted">
          Đã thu hồi: {daThuHoi.join(", ")}
          {quyen.capNhatLuc ? `, lúc ${ngayGio(quyen.capNhatLuc)}` : ""}.
        </p>
      ) : null}
    </section>
  );
}
