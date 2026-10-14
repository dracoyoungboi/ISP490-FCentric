import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeftRight,
  Bell,
  BellRing,
  CheckCheck,
  CircleCheck,
  ClipboardList,
  Lock,
  RefreshCcw,
  RefreshCw,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import useThongBao from "@/hooks/useThongBao";
import { cn } from "@/lib/utils";
import { THONG_BAO_DA_SAN_SANG } from "@/services/thongBaoService";

/*
 * Chuông thông báo trên thanh trên cùng (kiểu nút B + bảng 1 đã chốt 14/10/2026).
 * Backend chưa có API (THONG_BAO_DA_SAN_SANG = false): bảng chỉ báo tính năng đang phát triển.
 * Khi bật: chuông có viên số đỏ (trên 9 hiện "9+"), bảng nổi 400px với tab Tất cả / Chưa đọc,
 * chia nhóm Hôm nay / Trước đó. Dữ liệu lấy qua useThongBao → thongBaoService.
 */

/** Biểu tượng theo loại thông báo. Danh sách loại thật chốt cùng nghiệp vụ; loại lạ dùng hình chuông. */
const LOAI_THONG_BAO = {
  yeu_cau_nhap_hang: ClipboardList,
  dong_bo_loi: RefreshCw,
  ton_kho_thap: TriangleAlert,
  don_ban_moi: ShoppingBag,
  phieu_nhap_xong: CircleCheck,
  phieu_chuyen_kho: ArrowLeftRight,
  tai_khoan_bi_khoa: Lock,
};

const MAU_O_BIEU_TUONG = {
  info: "bg-bo-primary-soft text-bo-primary",
  warning: "bg-bo-warning-soft text-bo-warning",
  danger: "bg-bo-danger-soft text-bo-danger",
  success: "bg-bo-success-soft text-bo-success",
};

const TAB = [
  { value: "tat_ca", label: "Tất cả" },
  { value: "chua_doc", label: "Chưa đọc" },
];

const pad = (n) => String(n).padStart(2, "0");
const cungNgay = (a, b) => a.toDateString() === b.toDateString();

/** "Vừa xong", "5 phút trước", "2 giờ trước", "Hôm qua, 16:40", "12/10/2026". */
function thoiGianTuongDoi(chuoi, bayGio) {
  const d = new Date(chuoi);
  if (Number.isNaN(d.getTime())) return "";
  const phut = Math.floor((bayGio.getTime() - d.getTime()) / 60_000);
  if (phut < 1) return "Vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  if (cungNgay(d, bayGio)) return `${Math.floor(phut / 60)} giờ trước`;
  const homQua = new Date(bayGio);
  homQua.setDate(homQua.getDate() - 1);
  if (cungNgay(d, homQua)) return `Hôm qua, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Danh sách đã xếp mới nhất trước → [{ ten: "Hôm nay", ds }, { ten: "Trước đó", ds }] (bỏ nhóm rỗng). */
function chiaNhom(ds, bayGio) {
  const homNay = [];
  const truocDo = [];
  ds.forEach((n) => {
    const d = new Date(n.thoiGian);
    (!Number.isNaN(d.getTime()) && cungNgay(d, bayGio) ? homNay : truocDo).push(n);
  });
  return [
    { ten: "Hôm nay", ds: homNay },
    { ten: "Trước đó", ds: truocDo },
  ].filter((g) => g.ds.length > 0);
}

/** Viên số đỏ gắn ở góc trên bên phải biểu tượng chuông: tròn 16px, số dài thì giãn ngang. */
function SoChuaDoc({ so }) {
  if (!so) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-bo-danger px-1 text-[10px] font-semibold leading-none text-white tabular-nums ring-2 ring-white"
    >
      {so > 9 ? "9+" : so}
    </span>
  );
}

function DangPhatTrien() {
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-3.5">
        <h2 className="text-base font-semibold leading-6">Thông báo</h2>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-bo-primary-soft px-2 py-0.5 text-xs font-medium leading-5 text-bo-primary-hover">
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          Đang phát triển
        </span>
      </div>

      <div className="flex min-h-[220px] flex-col items-center justify-center border-t border-slate-100 px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bo-primary-soft text-bo-primary">
          <BellRing className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold text-bo-foreground">Tính năng thông báo đang được phát triển</p>
        <p className="mt-1 max-w-[300px] text-balance text-[13px] leading-5 text-bo-muted">
          Sắp tới, hệ thống sẽ báo cho bạn ngay khi có việc cần làm.
        </p>
      </div>
    </>
  );
}

function DongThongBao({ n, bayGio, onChon }) {
  const chuaDoc = !n.daDoc;
  const lop = cn(
    "flex w-full items-start gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30",
    chuaDoc ? "bg-[#f5f9ff] hover:bg-bo-primary-soft" : "bg-white hover:bg-slate-50",
  );
  const noiDung = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          MAU_O_BIEU_TUONG[n.tone] ?? MAU_O_BIEU_TUONG.info,
        )}
      >
        {createElement(LOAI_THONG_BAO[n.loai] ?? Bell, { className: "size-4", "aria-hidden": true })}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-5 text-bo-foreground", chuaDoc ? "font-semibold" : "font-medium")}>
          {n.tieuDe}
        </span>
        {n.moTa ? (
          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[18px] text-bo-muted">{n.moTa}</span>
        ) : null}
        <span className="mt-1 block text-xs leading-4 text-bo-muted">
          {n.nhom ? `${n.nhom} · ` : ""}
          <time dateTime={n.thoiGian}>{thoiGianTuongDoi(n.thoiGian, bayGio)}</time>
        </span>
      </span>
      {chuaDoc ? (
        <>
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-bo-primary" aria-hidden="true" />
          <span className="sr-only">Chưa đọc</span>
        </>
      ) : null}
    </>
  );

  if (n.duongDan) {
    return (
      <Link to={n.duongDan} onClick={() => onChon(n, true)} className={lop}>
        {noiDung}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onChon(n, false)} className={lop}>
      {noiDung}
    </button>
  );
}

function KhungDangTai() {
  return (
    <div className="border-t border-slate-100" aria-hidden="true">
      {[78, 64, 86, 58].map((w, i) => (
        <div key={w} className="flex gap-3 border-b border-slate-100 px-4 py-3.5">
          <Skeleton className="size-8 shrink-0 rounded-full bg-slate-100" />
          <div className="flex flex-1 flex-col gap-2 pt-0.5">
            <Skeleton className="h-3 bg-slate-100" style={{ width: `${w}%` }} />
            <Skeleton className="h-2.5 bg-slate-100" style={{ width: i % 2 ? "46%" : "38%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrangThaiGiua({ icon, mau, tieuDe, moTa, children, role }) {
  return (
    <div role={role} className="flex flex-col items-center gap-2 border-t border-slate-100 px-6 py-10 text-center">
      <span className={cn("flex size-11 items-center justify-center rounded-full", mau)}>
        {createElement(icon, { className: "size-5", "aria-hidden": true })}
      </span>
      <p className="mt-1 text-sm font-semibold text-bo-foreground">{tieuDe}</p>
      <p className="max-w-[280px] text-[13px] leading-[18px] text-bo-muted">{moTa}</p>
      {children}
    </div>
  );
}

/**
 * @param {string} [duongDanXemTatCa] Trang danh sách thông báo đầy đủ. Chưa có trang này nên chưa truyền:
 *   khi bỏ trống thì không hiện nút "Xem tất cả thông báo".
 */
export default function NotificationBell({ duongDanXemTatCa }) {
  const [mo, setMo] = useState(false);
  const [tab, setTab] = useState("tat_ca");
  const [moLuc, setMoLuc] = useState(0);
  const { items, soChuaDoc, dangTai, loi, taiLai, danhDauDaDoc, danhDauTatCaDaDoc } = useThongBao({
    dangBat: THONG_BAO_DA_SAN_SANG,
  });

  const doiTrangThai = (open) => {
    setMo(open);
    if (open) {
      setMoLuc(Date.now());
      taiLai();
    }
  };

  const chonThongBao = (n, coChuyenTrang) => {
    if (!n.daDoc) danhDauDaDoc(n.id);
    if (coChuyenTrang) setMo(false);
  };

  const nhanNut = !THONG_BAO_DA_SAN_SANG
    ? "Thông báo, tính năng đang phát triển"
    : soChuaDoc > 0
      ? `Thông báo, ${soChuaDoc} chưa đọc`
      : "Thông báo";

  let noiDungBang;
  if (!THONG_BAO_DA_SAN_SANG) {
    noiDungBang = <DangPhatTrien />;
  } else {
    const bayGio = new Date(moLuc);
    const hienThi = tab === "chua_doc" ? items.filter((n) => !n.daDoc) : items;

    let than;
    if (dangTai) {
      than = <KhungDangTai />;
    } else if (loi) {
      than = (
        <TrangThaiGiua
          role="alert"
          icon={AlertCircle}
          mau="bg-bo-danger-soft text-bo-danger"
          tieuDe="Không thể tải thông báo"
          moTa="Đã xảy ra lỗi. Vui lòng thử lại."
        >
          <Button
            type="button"
            variant="outline"
            onClick={taiLai}
            className="mt-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <RefreshCcw />
            Thử lại
          </Button>
        </TrangThaiGiua>
      );
    } else if (hienThi.length === 0) {
      than =
        tab === "chua_doc" && items.length > 0 ? (
          <TrangThaiGiua
            icon={CheckCheck}
            mau="bg-bo-success-soft text-bo-success"
            tieuDe="Bạn đã đọc hết thông báo"
            moTa="Các thông báo cũ vẫn xem được ở tab Tất cả."
          />
        ) : (
          <TrangThaiGiua
            icon={Bell}
            mau="bg-bo-primary-soft text-bo-primary"
            tieuDe="Chưa có thông báo nào"
            moTa="Thông báo về phiếu, đơn hàng và cảnh báo tồn kho sẽ hiện ở đây."
          />
        );
    } else {
      than = chiaNhom(hienThi, bayGio).map((g) => (
        <section key={g.ten} aria-label={g.ten}>
          <h3 className="sticky top-0 z-[1] bg-white px-4 pb-1.5 pt-2.5 text-xs font-medium leading-4 text-bo-muted">
            {g.ten}
          </h3>
          <ul>
            {g.ds.map((n) => (
              <li key={n.id}>
                <DongThongBao n={n} bayGio={bayGio} onChon={chonThongBao} />
              </li>
            ))}
          </ul>
        </section>
      ));
    }

    noiDungBang = (
      <>
        <div className="flex items-center justify-between gap-3 pb-2 pl-4 pr-3 pt-3">
          <h2 className="text-base font-semibold leading-6">Thông báo</h2>
          <button
            type="button"
            onClick={danhDauTatCaDaDoc}
            disabled={soChuaDoc === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-bo-primary transition-colors hover:bg-bo-primary-soft hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:pointer-events-none disabled:text-slate-400"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Đánh dấu đã đọc
          </button>
        </div>

        <div className="px-4 pb-3">
          <div role="tablist" aria-label="Lọc thông báo" className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
            {TAB.map((t) => (
              <button
                key={t.value}
                role="tab"
                type="button"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium text-bo-muted transition-colors hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                  tab === t.value && "bg-white text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]",
                )}
              >
                {t.label}
                {t.value === "chua_doc" && soChuaDoc > 0 ? (
                  <span className="rounded bg-red-50 px-1 text-[11px] font-semibold tabular-nums text-red-600">
                    {soChuaDoc}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div
          className="max-h-[min(420px,calc(100dvh-200px))] overflow-y-auto overscroll-contain"
          aria-busy={dangTai || undefined}
        >
          {than}
        </div>

        {duongDanXemTatCa ? (
          <div className="border-t border-bo-border p-1">
            <Link
              to={duongDanXemTatCa}
              onClick={() => setMo(false)}
              className="flex h-10 items-center justify-center rounded-md text-sm font-medium text-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              Xem tất cả thông báo
            </Link>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Popover open={mo} onOpenChange={doiTrangThai}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          type="button"
          aria-label={nhanNut}
          className="shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-bo-primary/30 data-[state=open]:bg-bo-primary-soft data-[state=open]:text-bo-primary data-[state=open]:hover:bg-bo-primary-soft data-[state=open]:hover:text-bo-primary"
        >
          <span className="relative inline-flex">
            <Bell className="size-5" />
            <SoChuaDoc so={THONG_BAO_DA_SAN_SANG ? soChuaDoc : 0} />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={8}
        aria-label="Thông báo"
        className="flex w-[400px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border-bo-border bg-white p-0 font-backoffice text-bo-foreground shadow-lg"
      >
        {noiDungBang}
      </PopoverContent>
    </Popover>
  );
}
