import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
  RefreshCcw,
  Shield,
  ShieldAlert,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import UserAvatar from "@/components/UserAvatar";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/adminService";
import { khoService } from "@/services/khoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { laKhoAo, laKhoHoatDong } from "@/utils/kho";
import { nhanLoaiKho } from "@/pages/warehouse/loaiKho";
import {
  QUAN_TRI_VIEN,
  VAI_TRO,
  banNhapTuNguoiDung,
  canKho,
  danhGiaQuyen,
  kiemTraBanNhap,
  moTaVaiTro,
  noiDungLuu,
  phanQuyenHienCo,
  quyenCoTacDung,
  quyenNhayCamCapThem,
  sangNgayNhap,
  soManHinh,
  soSanhPhanQuyen,
  tenVaiTro,
} from "@/components/nguoi-dung/phanQuyen";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";

/** Kho không phân người được: kho ảo (hàng đang chuyển) và kho ngừng hoạt động. */
function lyDoKhongChon(kho) {
  if (laKhoAo(kho)) return "Kho ảo chỉ chứa hàng đang chuyển giữa các kho, không phân người";
  if (!laKhoHoatDong(kho)) return "Kho đang ngừng hoạt động";
  return "";
}

function MucChon({ chon, tat, title, onChon, children, className }) {
  return (
    <label
      title={title}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-bo-border bg-bo-surface px-3 text-[13.5px] transition-colors hover:border-slate-400",
        chon && "border-bo-primary bg-blue-50/60 shadow-[inset_0_0_0_1px_var(--color-bo-primary)] hover:border-bo-primary",
        tat && "cursor-not-allowed bg-bo-surface-subtle text-slate-400 hover:border-bo-border",
        className,
      )}
    >
      {children({ onChange: onChon, disabled: tat, checked: chon })}
    </label>
  );
}

function Muc({ tieuDe, moTa, children, cuoi }) {
  return (
    <section className={cn("border-b border-slate-100 px-5 py-[18px]", cuoi && "border-b-0")}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-bo-foreground">{tieuDe}</span>
        {moTa ? <span className="text-xs text-bo-muted">{moTa}</span> : null}
      </div>
      {children}
    </section>
  );
}

function OThongTin({ icon = Info, children, netDut }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-bo-border bg-bo-surface-subtle px-3.5 py-3 text-[13px] leading-[19px]",
        netDut && "border-dashed bg-bo-surface",
      )}
    >
      {createElement(icon, { className: "mt-0.5 size-4 shrink-0 text-bo-muted", "aria-hidden": true })}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const ICON_KIEM_TRA = {
  canhBao: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden="true" />,
  luuY: <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />,
  on: <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />,
};

const KIEU_DAI = {
  canhBao: "bg-orange-50 text-orange-900",
  luuY: "bg-bo-surface-subtle text-slate-700",
  on: "bg-white text-bo-foreground",
};

const KY_HIEU = {
  doi: { k: "~", lop: "text-bo-primary" },
  them: { k: "+", lop: "text-green-700" },
  bo: { k: "−", lop: "text-red-700" },
};

/** Một dòng quyền: ô chọn, tên, biểu tượng nhạy cảm (xám), nhãn "mẫu" (xám), mô tả, chữ "vừa thêm / vừa bỏ". */
function DongQuyen({ d, doi, coMau, onDoi }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 border-t border-slate-100 px-3 py-2 first:border-t-0 hover:bg-bo-surface-subtle">
      <input type="checkbox" checked={d.cap} onChange={onDoi} className="mt-0.5 size-4 shrink-0 accent-bo-primary" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium leading-5">
          {d.ten}
          {d.nhayCam ? (
            <span className="inline-flex text-slate-400" title="Quyền nhạy cảm">
              <Shield className="size-3.5" aria-label="Quyền nhạy cảm" />
            </span>
          ) : null}
          {coMau && d.trongMau ? (
            <span
              className="inline-flex h-[18px] items-center rounded-[3px] border border-slate-200 px-1 text-[11.5px] font-normal leading-none text-bo-muted"
              title="Có trong mẫu quyền của vai trò"
            >
              mẫu
            </span>
          ) : null}
        </span>
        {d.moTa ? <span className="block text-xs leading-4 text-bo-muted">{d.moTa}</span> : null}
      </span>
      {doi ? (
        <span className="whitespace-nowrap text-xs font-medium leading-5 text-bo-primary">{d.cap ? "vừa thêm" : "vừa bỏ"}</span>
      ) : null}
    </label>
  );
}

/**
 * Ngăn kéo Phân quyền (PB2, chốt 18/10/2026; bản gọn chốt 19/10/2026), mở bên phải trang chi tiết (toàn màn hình
 * trên điện thoại). Bản gọn: chỉ liệt kê quyền dùng được với vai trò đang chọn; quyền không dùng được gom vào một khung
 * gập; không nhãn màu trên từng dòng (chỉ "mẫu" và biểu tượng nhạy cảm, đều xám); dòng Kiểm tra nói thẳng vấn đề.
 * `dienMauKhiMo`: mở bằng "Sửa theo mẫu" ở khung Cần xem lại thì bản nháp bắt đầu với đúng mẫu của vai trò.
 * Một lần lưu gồm vai trò, nơi làm việc (tối đa 1 kho), hạn hiệu lực và tập quyền đầy đủ tại kho.
 * Có dải Kiểm tra (cặp tạo–duyệt, quyền không dùng được, lệch mẫu…), hỏi lại trước khi lưu và trước khi bỏ thay đổi.
 * Trang cha đặt `key` mới mỗi lần mở để bản nháp bắt đầu lại từ dữ liệu đang lưu.
 * Ngăn kéo bị đóng từ bên ngoài (nút Back của trình duyệt) khi còn thay đổi chưa lưu thì gọi `onMoLai`
 * để mở lại và hỏi "Bỏ thay đổi?", không mất bản nháp.
 */
export default function NganKeoPhanQuyen({
  mo,
  nguoiDung,
  laChinhMinh,
  dienMauKhiMo = false,
  dsQuyen,
  cauHinh,
  menu,
  onDong,
  onDaLuu,
  onMoLai,
  onTaiLaiCauHinh,
  dangTaiCauHinh,
}) {
  const goc = useMemo(() => banNhapTuNguoiDung(nguoiDung), [nguoiDung]);
  const pqGoc = useMemo(() => phanQuyenHienCo(nguoiDung).pq, [nguoiDung]);
  // Trang cha đặt `key` mới mỗi lần mở, nên giá trị ban đầu chỉ tính một lần cho mỗi lần mở
  const mauBanDau =
    dienMauKhiMo && goc.khoId != null && canKho(goc.vaiTro) ? (cauHinh?.mauQuyen?.[goc.vaiTro] ?? []) : [];
  const [nhap, setNhap] = useState(() =>
    mauBanDau.length ? { ...goc, quyenIds: [...mauBanDau].sort((a, b) => a - b) } : goc,
  );
  const [moNhom, setMoNhom] = useState({});
  const [moKiemTra, setMoKiemTra] = useState(false);
  const [moVoHieu, setMoVoHieu] = useState(false);
  const nutXemVoHieu = useRef(null);
  // { vaiTro, so } của mẫu đã điền (chọn kho lần đầu, hoặc mở bằng "Sửa theo mẫu")
  const [daDienMau, setDaDienMau] = useState(() =>
    mauBanDau.length ? { vaiTro: goc.vaiTro, so: mauBanDau.length } : null,
  );
  const [hop, setHop] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);

  const khoQ = useTaiDuLieu(
    async () => {
      const res = await khoService.getAllKho();
      return Array.isArray(res?.data?.content) ? res.data.content : [];
    },
    "",
    { enabled: mo },
  );
  const dsKho = useMemo(() => {
    const ds = [...(khoQ.data ?? [])];
    if (pqGoc?.kho && !ds.some((k) => k.id === pqGoc.kho.id)) ds.unshift(pqGoc.kho);
    // Kho chọn được lên trước, giữ thứ tự máy chủ trả về trong từng phần
    return ds.sort((a, b) => Number(Boolean(lyDoKhongChon(a))) - Number(Boolean(lyDoKhongChon(b))));
  }, [khoQ.data, pqGoc]);
  const tenKho = (id) => {
    const k = dsKho.find((x) => x.id === id);
    return k ? k.tenKho || k.maKho : `kho #${id}`;
  };

  const mauCua = (vaiTro) => cauHinh?.mauQuyen?.[vaiTro] ?? [];
  const mau = mauCua(nhap.vaiTro);
  const ngu = {
    dsQuyen,
    // Không đọc được cấu hình: null để phần đánh giá không coi là "vai trò chưa có mẫu"
    mau: cauHinh ? mau : null,
    nhayCam: cauHinh?.quyenNhayCam ?? [],
    daApDung: cauHinh?.quyenDaApDung ?? null,
    menu,
  };
  const danhGia = danhGiaQuyen({ vaiTro: nhap.vaiTro, quyenIds: nhap.quyenIds, ...ngu });
  const kiemTra = kiemTraBanNhap(nhap, ngu);
  const thayDoi = soSanhPhanQuyen(goc, nhap, { dsQuyen, tenKho });
  // Quyền nhạy cảm lần lưu này cấp mới: hộp "Lưu phân quyền?" hỏi lại riêng
  const nhayCamCapThem = quyenNhayCamCapThem(goc, nhap, ngu);
  const coThayDoi = thayDoi.length > 0;
  const dungKho = canKho(nhap.vaiTro);
  const coKho = dungKho && nhap.khoId != null;
  const quyenGoc = new Set(goc.khoId != null ? goc.quyenIds : []);
  const homNay = sangNgayNhap(new Date());
  // Lưu có làm mất thứ người dùng đang có không: đổi vai trò, đổi/thu hồi kho, bỏ quyền.
  // Có thì phiên đăng nhập của họ bị thu hồi ngay ở thao tác kế tiếp; chỉ cấp thêm thì phải đăng nhập lại mới dùng được.
  const catQuyen =
    nhap.vaiTro !== goc.vaiTro ||
    (goc.khoId != null && (!coKho || nhap.khoId !== goc.khoId)) ||
    [...quyenGoc].some((id) => !nhap.quyenIds.includes(id));

  // Ngăn kéo vẫn gắn trên trang khi đóng, nên mở lại không qua nút Phân quyền (Forward của trình duyệt, đường dẫn
  // ?phan-quyen=1) sẽ thấy lại trạng thái cũ. Sau khi Bỏ thay đổi ("bo": bản nháp về dữ liệu đang lưu) hoặc lưu xong
  // ("luu": chỉ bỏ gợi ý đã điền mẫu, nhóm đang mở, dải Kiểm tra) thì đặt lại — đợi ngăn kéo đóng hẳn (hết hiệu ứng
  // trượt ra) mới làm để nội dung và hộp "Bỏ N thay đổi?" không nhảy trong lúc đang đóng.
  const datLaiKhiDong = useRef(null);
  const datLai = useCallback(() => {
    const loai = datLaiKhiDong.current;
    if (!loai) return;
    datLaiKhiDong.current = null;
    if (loai === "bo") setNhap(goc);
    setDaDienMau(null);
    setMoNhom({});
    setMoKiemTra(false);
    setMoVoHieu(false);
  }, [goc]);

  // Back của trình duyệt bỏ `?phan-quyen=1` → ngăn kéo đóng mà không qua yeuCauDong: còn thay đổi thì mở lại và hỏi
  const dongChuDong = useRef(false);
  const moTruoc = useRef(mo);
  useEffect(() => {
    if (moTruoc.current && !mo && !dongChuDong.current && coThayDoi && onMoLai) {
      onMoLai();
      setHop("bo");
    }
    if (mo && !moTruoc.current) {
      dongChuDong.current = false;
      // Mở lại trước khi kịp đóng hẳn: đặt lại ngay
      if (datLaiKhiDong.current) queueMicrotask(datLai);
    }
    moTruoc.current = mo;
  }, [mo, coThayDoi, onMoLai, datLai]);
  const dong = () => {
    dongChuDong.current = true;
    onDong();
  };
  const boThayDoi = () => {
    datLaiKhiDong.current = "bo";
    setHop(null);
    dong();
  };

  const sua = (thayDoiMoi) => setNhap((cu) => ({ ...cu, ...thayDoiMoi }));
  const datQuyen = (ids) => sua({ quyenIds: [...new Set(ids)].sort((a, b) => a - b) });

  const chonKho = (kho) => {
    if (nhap.khoId == null && !nhap.quyenIds.length && mau.length) {
      sua({ khoId: kho.id, quyenIds: [...mau].sort((a, b) => a - b) });
      setDaDienMau({ vaiTro: nhap.vaiTro, so: mau.length });
    } else {
      sua({ khoId: kho.id });
    }
  };

  const yeuCauDong = () => {
    // Đang lưu hoặc đang mở hộp hỏi lại thì để hộp đó xử lý
    if (dangLuu || hop) return;
    if (coThayDoi) setHop("bo");
    else dong();
  };

  const luu = async () => {
    if (dangLuu) return;
    setDangLuu(true);
    try {
      const moi = await adminService.luuPhanQuyen(nguoiDung.id, noiDungLuu(nhap, pqGoc));
      setHop(null);
      dongChuDong.current = true;
      datLaiKhiDong.current = "luu";
      onDaLuu(moi, { catQuyen });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được phân quyền. Vui lòng thử lại."));
      setHop(null);
    } finally {
      setDangLuu(false);
    }
  };

  const soMan = (vaiTro) => soManHinh(menu, vaiTro);
  // Quyền dùng được với vai trò đang chọn: hiện trong các nhóm. Quyền không dùng được: gom vào một khung gập
  const dungDuoc = (d) => quyenCoTacDung(d.ma, nhap.vaiTro, menu);
  const dongVoHieu = danhGia.nhom.flatMap((n) => n.dong).filter((d) => !dungDuoc(d));
  const soVoHieuCap = dongVoHieu.filter((d) => d.cap).length;
  const coMauSoSanh = Boolean(cauHinh) && mau.length > 0;

  return (
    <>
      <Sheet open={mo} onOpenChange={(m) => (m ? null : yeuCauDong())}>
        <SheetContent
          side="right"
          className="w-full gap-0 bg-bo-surface p-0 sm:max-w-[640px] [&>button:last-child]:hidden"
          onCloseAutoFocus={datLai}
          onInteractOutside={(e) => {
            if (coThayDoi || dangLuu) {
              e.preventDefault();
              yeuCauDong();
            }
          }}
        >
          {/* Đầu ngăn kéo */}
          <div className="flex shrink-0 items-center gap-3 border-b border-bo-border px-5 py-4">
            <UserAvatar
              userId={nguoiDung.id}
              name={nguoiDung.hoTen || nguoiDung.tenDangNhap}
              avatarUrl={nguoiDung.avatarUrl}
              trungTinh
              className="size-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-bold leading-[26px] text-bo-heading">Phân quyền</SheetTitle>
              {/* Họ tên trống thì chỉ tên đăng nhập, không để dấu "·" đứng đầu */}
              <SheetDescription className="truncate text-[13px] text-bo-muted">
                {[nguoiDung.hoTen?.trim(), nguoiDung.tenDangNhap ? `@${nguoiDung.tenDangNhap}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Đóng" onClick={yeuCauDong} className="text-slate-600">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Vai trò */}
            <Muc tieuDe="Vai trò" moTa="Quyết định menu người dùng thấy">
              <div role="radiogroup" aria-label="Vai trò" className="grid gap-2 sm:grid-cols-2">
                {VAI_TRO.map((vt) => {
                  const tat = laChinhMinh && vt.ma !== goc.vaiTro;
                  return (
                    <MucChon
                      key={vt.ma}
                      chon={nhap.vaiTro === vt.ma}
                      tat={tat}
                      title={tat ? "Bạn không tự đổi vai trò của mình được" : undefined}
                      onChon={() => sua({ vaiTro: vt.ma })}
                    >
                      {({ onChange, disabled, checked }) => (
                        <>
                          <input
                            type="radio"
                            name="vai-tro-ngan-keo"
                            checked={checked}
                            disabled={disabled}
                            onChange={onChange}
                            className="size-4 shrink-0 accent-bo-primary"
                          />
                          <span className="min-w-0 flex-1 font-medium">{vt.ten}</span>
                          <span className="whitespace-nowrap text-xs text-bo-muted">{soMan(vt.ma)} màn hình</span>
                        </>
                      )}
                    </MucChon>
                  );
                })}
              </div>
              <p className="mt-2 text-[12.5px] leading-[18px] text-bo-muted">{moTaVaiTro(nhap.vaiTro)}</p>
              {nhap.vaiTro !== goc.vaiTro ? (
                <p className="mt-1 text-[12.5px] leading-[18px] text-bo-primary">
                  Menu đổi từ {soMan(goc.vaiTro)} thành {soMan(nhap.vaiTro)} màn hình sau khi lưu.
                </p>
              ) : null}
            </Muc>

            {nhap.vaiTro === QUAN_TRI_VIEN ? (
              <section className="border-b border-slate-100 px-5 py-[18px]">
                <OThongTin>
                  <div className="font-semibold text-bo-foreground">Quản trị viên có toàn quyền ở mọi kho</div>
                  <div className="text-bo-muted">
                    {goc.khoId != null && canKho(goc.vaiTro)
                      ? `Không cần nơi làm việc hay quyền tại kho. Khi lưu, phân quyền ${tenKho(goc.khoId)} hiện có (${goc.quyenIds.length} quyền) sẽ được thu hồi.`
                      : "Không cần nơi làm việc hay quyền tại kho."}
                  </div>
                </OThongTin>
              </section>
            ) : null}

            {dungKho ? (
              <>
                {/* Nơi làm việc (trước đây "Kho phụ trách"; đổi tên toàn hệ thống 19/10/2026) */}
                <Muc tieuDe="Nơi làm việc" moTa="Mỗi người tối đa 1 kho">
                  {khoQ.initialLoading ? (
                    <div className="grid gap-2 sm:grid-cols-2" role="status" aria-label="Đang tải danh sách kho">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-14 animate-pulse rounded-md bg-slate-100" />
                      ))}
                    </div>
                  ) : khoQ.error && !dsKho.length ? (
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-bo-muted">
                      Không tải được danh sách kho.
                      <Button type="button" variant="outline" size="sm" onClick={khoQ.reload} className={NUT_VIEN}>
                        <RefreshCcw className="size-3.5" aria-hidden="true" />
                        Thử lại
                      </Button>
                    </div>
                  ) : !dsKho.length ? (
                    <OThongTin netDut>
                      <span className="text-bo-muted">Chưa có kho nào. Tạo kho ở màn Kho trước khi phân người.</span>
                    </OThongTin>
                  ) : (
                    <>
                    {khoQ.error ? (
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-orange-800">
                        Không tải được danh sách kho, đang hiện nơi làm việc hiện tại.
                        <Button type="button" variant="outline" size="sm" onClick={khoQ.reload} className={NUT_VIEN}>
                          <RefreshCcw className="size-3.5" aria-hidden="true" />
                          Thử lại
                        </Button>
                      </div>
                    ) : null}
                    <div role="radiogroup" aria-label="Nơi làm việc" className="grid gap-2 sm:grid-cols-2">
                      {dsKho.map((k) => {
                        const lyDo = k.id === goc.khoId ? "" : lyDoKhongChon(k);
                        const loai = nhanLoaiKho(k).label;
                        return (
                          <MucChon
                            key={k.id}
                            chon={nhap.khoId === k.id}
                            tat={Boolean(lyDo)}
                            title={lyDo || undefined}
                            onChon={() => chonKho(k)}
                            className="items-start py-2"
                          >
                            {({ onChange, disabled, checked }) => (
                              <>
                                <input
                                  type="radio"
                                  name="kho-ngan-keo"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={onChange}
                                  className="mt-0.5 size-4 shrink-0 accent-bo-primary"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-medium">
                                    {k.tenKho || k.maKho}{" "}
                                    <span className="font-mono text-xs font-normal text-bo-muted">{k.maKho}</span>
                                  </span>
                                  <span className="block text-xs leading-[17px] text-bo-muted">
                                    {lyDo ? lyDo : loai}
                                  </span>
                                </span>
                                {k.id === goc.khoId && canKho(goc.vaiTro) ? (
                                  <span className="whitespace-nowrap text-xs text-bo-muted">Hiện tại</span>
                                ) : null}
                              </>
                            )}
                          </MucChon>
                        );
                      })}
                    </div>
                    </>
                  )}

                  {coKho ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-[13px] font-medium">Hiệu lực</span>
                      <div role="group" aria-label="Hiệu lực" className="inline-flex rounded-md border border-bo-border bg-bo-surface-subtle p-0.5">
                        {[
                          ["vo_han", "Không thời hạn"],
                          ["den_ngay", "Đến ngày"],
                        ].map(([ma, nhan]) => (
                          <button
                            key={ma}
                            type="button"
                            aria-pressed={nhap.hieuLuc === ma}
                            onClick={() => sua({ hieuLuc: ma })}
                            className={cn(
                              "h-[30px] rounded px-3 text-[13px] font-medium text-slate-600",
                              nhap.hieuLuc === ma && "bg-bo-surface text-bo-foreground shadow-sm",
                            )}
                          >
                            {nhan}
                          </button>
                        ))}
                      </div>
                      {nhap.hieuLuc === "den_ngay" ? (
                        <label className="inline-flex items-center gap-2 text-[13px] text-bo-muted">
                          hết hạn sau ngày
                          <input
                            type="date"
                            value={nhap.ngayKetThuc}
                            min={homNay}
                            onChange={(e) => sua({ ngayKetThuc: e.target.value })}
                            aria-label="Ngày hết hiệu lực"
                            className="h-8 rounded-md border border-slate-300 bg-bo-surface px-2.5 text-[13px] text-bo-foreground"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </Muc>

                {/* Quyền tại kho */}
                <Muc
                  cuoi
                  tieuDe={`Quyền tại ${coKho ? tenKho(nhap.khoId) : "kho"}`}
                  moTa={
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!coKho || !nhap.quyenIds.length}
                        onClick={() => {
                          datQuyen([]);
                          setDaDienMau(null);
                        }}
                        className="h-8 text-slate-600"
                      >
                        Bỏ chọn
                      </Button>
                      <span
                        className="inline-flex"
                        title={
                          !coKho || mau.length
                            ? undefined
                            : cauHinh
                              ? `Vai trò ${tenVaiTro(nhap.vaiTro)} chưa có mẫu quyền`
                              : "Không đọc được mẫu quyền"
                        }
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!coKho || !mau.length}
                          onClick={() => datQuyen(mau)}
                          className={`h-8 ${NUT_VIEN}`}
                        >
                          Áp dụng mẫu
                        </Button>
                      </span>
                    </span>
                  }
                >
                  <p className="-mt-1 mb-3 text-[12.5px] leading-[18px] text-bo-muted">
                    {coKho
                      ? `Đang chọn ${nhap.quyenIds.length}/${danhGia.tong}${mau.length ? ` · mẫu ${tenVaiTro(nhap.vaiTro)} có ${mau.length} quyền` : ""}`
                      : "Chưa có kho"}
                  </p>

                  {coKho && !cauHinh ? (
                    <div className="mb-3 flex items-start gap-2 rounded-md border border-orange-200 bg-bo-warning-soft px-2.5 py-2 text-[13px] leading-[19px] text-orange-900">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        Không đọc được mẫu quyền và danh sách quyền nhạy cảm: chưa so được với mẫu, khi lưu cũng không nhắc
                        quyền nhạy cảm.
                      </span>
                      {onTaiLaiCauHinh ? (
                        // Tải lại ngay trong ngăn kéo: tải lại cả trang sẽ mất bản nháp đang sửa
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={dangTaiCauHinh}
                          onClick={onTaiLaiCauHinh}
                          className={`h-7 shrink-0 ${NUT_VIEN}`}
                        >
                          <RefreshCcw className="size-3.5" aria-hidden="true" />
                          Thử lại
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Chỉ còn đúng khi vẫn là vai trò đã điền mẫu (đổi vai trò, Bỏ chọn thì thôi nhắc) */}
                  {daDienMau && coKho && daDienMau.vaiTro === nhap.vaiTro && nhap.quyenIds.length ? (
                    <div className="mb-3">
                      <OThongTin>
                        Đã điền sẵn {daDienMau.so} quyền theo mẫu {tenVaiTro(daDienMau.vaiTro)}. Bỏ bớt hoặc thêm nếu cần.
                      </OThongTin>
                    </div>
                  ) : null}

                  {!coKho ? (
                    <OThongTin netDut>
                      <span className="text-bo-muted">Chọn nơi làm việc để cấp quyền. Quyền chỉ có hiệu lực tại kho đó.</span>
                    </OThongTin>
                  ) : (
                    <div className="space-y-2">
                      {danhGia.nhom.map((n) => {
                        const dong = n.dong.filter(dungDuoc);
                        if (!dong.length) return null;
                        const soCap = dong.filter((d) => d.cap).length;
                        const coDoi = dong.some((d) => d.cap !== quyenGoc.has(d.id));
                        // Nhóm có quyền ngoài mẫu hoặc vừa đổi thì tự mở (không còn nhãn "N ngoài mẫu" trên đầu nhóm)
                        const dangMo = moNhom[n.ma] ?? (coDoi || dong.some((d) => d.ngoaiMau));
                        const tatCa = soCap === dong.length;
                        const motPhan = soCap > 0 && !tatCa;
                        const ids = dong.map((d) => d.id);
                        return (
                          <div key={n.ma} className="overflow-hidden rounded-lg border border-bo-border">
                            <div className={cn("flex items-center gap-0 bg-bo-surface-subtle pl-3 pr-2", dangMo && "border-b border-bo-border")}>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={tatCa ? "true" : motPhan ? "mixed" : "false"}
                                aria-label={`Chọn cả nhóm ${n.ten}`}
                                onClick={() =>
                                  datQuyen(tatCa ? nhap.quyenIds.filter((id) => !ids.includes(id)) : [...nhap.quyenIds, ...ids])
                                }
                                className="-my-1 -ml-3 inline-flex size-11 shrink-0 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                              >
                                <span
                                  className={cn(
                                    "inline-flex size-4 items-center justify-center rounded border-[1.5px] border-slate-400 bg-bo-surface",
                                    (tatCa || motPhan) && "border-bo-primary bg-bo-primary",
                                  )}
                                >
                                  {tatCa ? <Check className="size-3 text-white" strokeWidth={3.5} aria-hidden="true" /> : null}
                                  {motPhan ? <Minus className="size-3 text-white" strokeWidth={3.5} aria-hidden="true" /> : null}
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-expanded={dangMo}
                                onClick={() => setMoNhom((cu) => ({ ...cu, [n.ma]: !dangMo }))}
                                className="flex h-11 min-w-0 flex-1 items-center gap-2 text-left text-[13.5px] font-semibold text-bo-foreground"
                              >
                                <span className="min-w-0 flex-1">{n.ten}</span>
                                {coDoi ? <span className="size-[7px] shrink-0 rounded-full bg-bo-primary" title="Có thay đổi chưa lưu" /> : null}
                                <span className="min-w-7 text-right text-xs font-semibold tabular-nums text-bo-muted">
                                  {soCap}/{dong.length}
                                </span>
                                <ChevronDown className={cn("size-4 text-slate-400 transition-transform", dangMo && "rotate-180")} aria-hidden="true" />
                              </button>
                            </div>
                            {dangMo ? (
                              <div>
                                {dong.map((d) => (
                                  <DongQuyen
                                    key={d.id}
                                    d={d}
                                    doi={d.cap !== quyenGoc.has(d.id)}
                                    coMau={coMauSoSanh}
                                    onDoi={() =>
                                      datQuyen(d.cap ? nhap.quyenIds.filter((x) => x !== d.id) : [...nhap.quyenIds, d.id])
                                    }
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {dongVoHieu.length ? (
                        <div className="rounded-lg border border-bo-border bg-bo-surface-subtle">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                            <div className="min-w-0 flex-1 basis-56 text-[13px] leading-[19px]">
                              <div className="font-medium text-bo-foreground">
                                {soVoHieuCap
                                  ? `${soVoHieuCap} quyền đang cấp nhưng không dùng được với ${tenVaiTro(nhap.vaiTro)}`
                                  : `${dongVoHieu.length} quyền khác không dùng được với ${tenVaiTro(nhap.vaiTro)}`}
                              </div>
                              <div className="text-xs leading-4 text-bo-muted">Vai trò này không mở màn hình dùng các quyền đó.</div>
                            </div>
                            {soVoHieuCap ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`Bỏ cả ${soVoHieuCap} quyền không dùng được`}
                                onClick={() => {
                                  datQuyen(nhap.quyenIds.filter((id) => !dongVoHieu.some((d) => d.id === id)));
                                  // Nút này biến mất sau khi bấm: chuyển tiêu điểm sang nút Xem bên cạnh, không rơi về đầu trang
                                  nutXemVoHieu.current?.focus();
                                }}
                                className={`h-8 ${NUT_VIEN}`}
                              >
                                Bỏ cả {soVoHieuCap}
                              </Button>
                            ) : null}
                            <button
                              ref={nutXemVoHieu}
                              type="button"
                              aria-expanded={moVoHieu}
                              aria-controls="quyen-khong-dung-duoc"
                              aria-label={`${moVoHieu ? "Ẩn" : "Xem"} ${dongVoHieu.length} quyền không dùng được`}
                              onClick={() => setMoVoHieu((m) => !m)}
                              className="inline-flex h-8 items-center gap-1 px-1 text-[13px] font-medium text-bo-primary"
                            >
                              {moVoHieu ? "Ẩn" : "Xem"}
                              <ChevronDown className={cn("size-3.5 transition-transform", moVoHieu && "rotate-180")} aria-hidden="true" />
                            </button>
                          </div>
                          {moVoHieu ? (
                            <div id="quyen-khong-dung-duoc" className="rounded-b-lg border-t border-bo-border bg-bo-surface">
                              {dongVoHieu.map((d) => (
                                <DongQuyen
                                  key={d.id}
                                  d={d}
                                  doi={d.cap !== quyenGoc.has(d.id)}
                                  coMau={coMauSoSanh}
                                  onDoi={() =>
                                    datQuyen(d.cap ? nhap.quyenIds.filter((x) => x !== d.id) : [...nhap.quyenIds, d.id])
                                  }
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </Muc>
              </>
            ) : null}
          </div>

          {/* Kiểm tra trước khi lưu */}
          {moKiemTra ? (
            <div id="kiem-tra-phan-quyen" className="max-h-[260px] shrink-0 overflow-y-auto border-t border-bo-border bg-bo-surface px-5 pb-2.5 pt-1.5">
              {kiemTra.muc.map((m) => (
                <div key={m.tieuDe} className="flex items-start gap-2.5 border-t border-slate-100 py-1.5 text-[13px] leading-[19px] first:border-t-0">
                  {ICON_KIEM_TRA[m.loai]}
                  <span>
                    <span className="font-semibold">{m.tieuDe}</span>
                    <span className="block text-xs leading-[17px] text-bo-muted">{m.moTa}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className={cn("flex shrink-0 items-center gap-2.5 border-t border-bo-border px-5 py-2.5 text-[13px]", KIEU_DAI[kiemTra.loai])}>
            {ICON_KIEM_TRA[kiemTra.loai]}
            <span className="flex-1 font-medium">{kiemTra.tomTat}</span>
            <button
              type="button"
              onClick={() => setMoKiemTra((m) => !m)}
              aria-expanded={moKiemTra}
              aria-controls="kiem-tra-phan-quyen"
              aria-label={moKiemTra ? "Ẩn chi tiết kiểm tra" : "Xem chi tiết kiểm tra"}
              className="inline-flex items-center gap-1 py-1 text-[13px] font-medium text-bo-primary"
            >
              {moKiemTra ? "Ẩn" : "Xem"}
              {moKiemTra ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronUp className="size-3.5" aria-hidden="true" />}
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-bo-border bg-bo-surface px-5 py-3">
            {coThayDoi ? <span className="size-2 shrink-0 rounded-full bg-bo-primary" aria-hidden="true" /> : null}
            <span className="flex-1 text-[13.5px] font-medium">
              {coThayDoi ? `${thayDoi.length} thay đổi chưa lưu` : "Chưa có thay đổi"}
            </span>
            <Button type="button" variant="outline" onClick={yeuCauDong} disabled={dangLuu} className={NUT_VIEN}>
              Hủy
            </Button>
            <span
              className="inline-flex"
              title={kiemTra.chanLuu ? kiemTra.muc.find((m) => m.loai === "canhBao")?.tieuDe : undefined}
            >
              <Button
                type="button"
                onClick={() => setHop("luu")}
                disabled={!coThayDoi || kiemTra.chanLuu || dangLuu}
                className="bg-bo-primary text-white hover:bg-bo-primary-hover"
              >
                Lưu phân quyền
              </Button>
            </span>
          </div>
        </SheetContent>
      </Sheet>

      {/* Hỏi lại trước khi lưu */}
      <AlertDialog open={hop === "luu"} onOpenChange={(m) => (!m && !dangLuu ? setHop(null) : null)}>
        <AlertDialogContent className="bg-bo-surface sm:max-w-[520px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Lưu phân quyền cho {nguoiDung.hoTen || nguoiDung.tenDangNhap}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="max-h-60 overflow-y-auto rounded-lg border border-bo-border px-3 py-2">
                  {thayDoi.map((d) => (
                    <div key={`${d.loai}-${d.chu}`} className="flex gap-2 py-[3px] text-[13px] leading-5 text-bo-foreground">
                      <span className={cn("w-3.5 shrink-0 text-center font-bold", KY_HIEU[d.loai].lop)} aria-hidden="true">
                        {KY_HIEU[d.loai].k}
                      </span>
                      <span>
                        <span className="sr-only">{d.loai === "them" ? "Thêm: " : d.loai === "bo" ? "Bỏ: " : ""}</span>
                        {d.chu}
                      </span>
                    </div>
                  ))}
                </div>
                {nhayCamCapThem.length ? (
                  <div className="flex gap-2 rounded-md border border-orange-200 bg-bo-warning-soft px-2.5 py-2 text-[13px] leading-[19px] text-orange-900">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">Cấp thêm {nhayCamCapThem.length} quyền nhạy cảm:</span>{" "}
                      {nhayCamCapThem.join(", ")}. Kiểm tra lại đúng người, đúng kho trước khi lưu.
                    </span>
                  </div>
                ) : null}
                {kiemTra.soCanhBao ? (
                  <div className="flex gap-2 rounded-md border border-orange-200 bg-bo-warning-soft px-2.5 py-2 text-[13px] leading-[19px] text-orange-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Vẫn còn {kiemTra.soCanhBao} cảnh báo ở mục Kiểm tra. Bạn vẫn lưu được nếu đây là chủ ý.
                    </span>
                  </div>
                ) : null}
                <p className="text-[13px] leading-5">
                  {catQuyen
                    ? "Có hiệu lực ngay: nếu người dùng đang đăng nhập, hệ thống buộc đăng nhập lại ở thao tác kế tiếp."
                    : "Quyền mới dùng được sau khi người dùng đăng nhập lại."}{" "}
                  Thay đổi được ghi vào Lịch sử phân quyền.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel disabled={dangLuu}>Quay lại sửa</AlertDialogCancel>
            <AlertDialogAction
              disabled={dangLuu}
              onClick={(e) => {
                e.preventDefault();
                luu();
              }}
              className="bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              {dangLuu ? "Đang lưu..." : "Lưu phân quyền"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hỏi lại trước khi bỏ thay đổi */}
      <AlertDialog open={hop === "bo"} onOpenChange={(m) => (!m ? setHop(null) : null)}>
        <AlertDialogContent className="bg-bo-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ {thayDoi.length} thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai trò, nơi làm việc và quyền của {nguoiDung.hoTen || nguoiDung.tenDangNhap} giữ như trước khi mở ngăn kéo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel>Tiếp tục sửa</AlertDialogCancel>
            <AlertDialogAction
              onClick={boThayDoi}
              className="bg-bo-danger text-white hover:bg-bo-danger/90"
            >
              Bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
