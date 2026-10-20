import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, LayoutGrid, Package, Search, ShoppingCart, UserRound, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { xinRoiTrang } from "@/lib/chanRoiTrang";
import StatusBadge from "@/components/shared/StatusBadge";
import { SIDEBAR_FOOTER_SECTION, SIDEBAR_MENU, SIDEBAR_SECTIONS } from "@/components/backoffice/sidebar.config";
import apiClient from "@/services/apiClient";
import { productService } from "@/services/productService";
import { donBanHangKenhService } from "@/services/donBanHangKenhService";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { formatCurrency } from "@/utils/formatters";

/*
 * Ô tìm kiếm toàn hệ thống trên thanh trên cùng (thay breadcrumb, phương án 14/10/2026).
 * - Ctrl/⌘ + K để mở. Chưa gõ: hàng tab + gợi ý, kèm "Tìm gần đây" nếu có.
 * - Gõ từ 2 ký tự: tab Tất cả / Màn hình / Sản phẩm / Đơn hàng / Khách hàng.
 *   Màn hình lọc tại chỗ từ menu bên trái; ba nhóm còn lại gọi đúng API lọc mà trang danh sách đang dùng.
 * - Nhóm nào người dùng không có quyền vào trang danh sách tương ứng thì ẩn (quyền lấy từ sidebar.config).
 */

const SO_KY_TU_TOI_THIEU = 2;
const THOI_GIAN_CHO_MS = 300;
const SO_KET_QUA_MOI_NHOM = 10;
const SO_DONG_XEM_TRUOC = 3;
const SO_TIM_GAN_DAY = 5;

const NHOM = [
  { key: "manHinh", label: "Màn hình", trangDanhSach: null, icon: LayoutGrid },
  { key: "sanPham", label: "Sản phẩm", trangDanhSach: "/products", icon: Package },
  { key: "donHang", label: "Đơn hàng", trangDanhSach: "/sales-orders", icon: ShoppingCart },
  { key: "khachHang", label: "Khách hàng", trangDanhSach: "/customers", icon: UserRound },
];

const GOI_Y_THEO_TAB = {
  tatCa: "sản phẩm, đơn hàng, khách hàng, màn hình",
  manHinh: "màn hình, chức năng",
  sanPham: "sản phẩm theo tên",
  donHang: "đơn hàng theo mã đơn",
  khachHang: "khách hàng theo tên, mã hoặc số điện thoại",
};

const TRANG_THAI_SAN_PHAM = {
  1: { label: "Còn hàng" },
  0: { label: "Hết hàng" },
  2: { label: "Ngừng hoạt động" },
};

/* ---------- Tiện ích ---------- */

const boDau = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const vietHoaChuDau = (text) => (text ? text.charAt(0) + text.slice(1).toLowerCase() : "");

/** Tô đậm phần khớp từ khóa, không phân biệt dấu (bỏ dấu không đổi độ dài chuỗi với chữ tiếng Việt dựng sẵn). */
function ToDam({ text, tuKhoa }) {
  const chuoi = String(text ?? "");
  const tk = boDau(tuKhoa.trim());
  const viTri = tk ? boDau(chuoi).indexOf(tk) : -1;
  if (viTri < 0 || boDau(chuoi).length !== chuoi.length) return chuoi;
  return (
    <>
      {chuoi.slice(0, viTri)}
      <mark className="rounded-sm bg-amber-100 px-px text-inherit">{chuoi.slice(viTri, viTri + tk.length)}</mark>
      {chuoi.slice(viTri + tk.length)}
    </>
  );
}

/** Vai trò được vào một trang, đọc từ menu bên trái (mục con không khai báo thì theo mục cha). */
function vaiTroCuaTrang(duongDan) {
  for (const muc of SIDEBAR_MENU) {
    if (muc.to === duongDan) return muc.roles ?? [];
    const con = muc.children?.find((c) => c.to === duongDan);
    if (con) return con.roles ?? muc.roles ?? [];
  }
  return [];
}

/** Danh sách màn hình người dùng được vào, lấy từ menu bên trái. */
function danhSachManHinh(role) {
  const tenNhom = Object.fromEntries(SIDEBAR_SECTIONS.map((s) => [s.key, vietHoaChuDau(s.label)]));
  // Mục ghim ở đáy sidebar (Cấu hình) không thuộc nhóm có tiêu đề
  tenNhom[SIDEBAR_FOOTER_SECTION] = "Hệ thống";
  const ketQua = [];
  for (const muc of SIDEBAR_MENU) {
    if (!muc.roles?.includes(role)) continue;
    const nhom = tenNhom[muc.section] || "Trang chính";
    if (muc.to) ketQua.push({ id: muc.to, label: muc.label, to: muc.to, viTri: nhom });
    for (const con of muc.children ?? []) {
      if ((con.roles ?? muc.roles).includes(role)) {
        ketQua.push({ id: con.to, label: con.label, to: con.to, viTri: `${nhom} › ${muc.label}` });
      }
    }
  }
  return ketQua;
}

function docTimGanDay(khoa) {
  try {
    const giaTri = JSON.parse(localStorage.getItem(khoa) || "[]");
    return Array.isArray(giaTri) ? giaTri.filter((x) => typeof x === "string").slice(0, SO_TIM_GAN_DAY) : [];
  } catch {
    return [];
  }
}

function ghiTimGanDay(khoa, danhSach) {
  try {
    localStorage.setItem(khoa, JSON.stringify(danhSach));
  } catch {
    // Trình duyệt chặn lưu trữ: bỏ qua, chỉ mất phần "Tìm gần đây"
  }
}

/* ---------- Gọi API (cùng điều kiện lọc với trang danh sách) ---------- */

const trangRong = { content: [], totalElements: 0 };

async function timSanPham(tuKhoa) {
  const res = await productService.filterProducts({
    page: 0,
    size: SO_KET_QUA_MOI_NHOM,
    filters: [{ fieldName: "tenSanPham", operation: "ILIKE", value: tuKhoa, logicType: "OR" }],
    sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
  });
  return res?.data?.data ?? trangRong;
}

async function timDonHang(tuKhoa) {
  const res = await donBanHangKenhService.filterDonBan({
    page: 0,
    size: SO_KET_QUA_MOI_NHOM,
    filters: [
      { fieldName: "loaiChungTu", operation: "EQUALS", value: "don_ban_hang" },
      { fieldName: "soDonHang", operation: "LIKE", value: tuKhoa },
    ],
    sorts: [{ fieldName: "id", direction: "DESC" }],
  });
  return res ?? trangRong;
}

async function timKhachHang(tuKhoa) {
  const res = await apiClient.post("/api/v1/khach-hang/filter", {
    filters: ["tenKhachHang", "maKhachHang", "soDienThoai", "email"].map((fieldName) => ({
      fieldName,
      operation: "ILIKE",
      value: `%${tuKhoa}%`,
      logicType: "OR",
    })),
    sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
    page: 0,
    size: SO_KET_QUA_MOI_NHOM,
  });
  return res?.data?.data ?? trangRong;
}

const HAM_TIM = { sanPham: timSanPham, donHang: timDonHang, khachHang: timKhachHang };

/* ---------- Thành phần ---------- */

export default function GlobalSearch({ userId, role, isPhone = false, placeholder = "Tìm kiếm (Ctrl + K)" }) {
  const navigate = useNavigate();
  const listboxId = useId();
  const khungRef = useRef(null);
  const oNhapRef = useRef(null);
  const lanTimRef = useRef(0);

  const [mo, setMo] = useState(false);
  const [tuKhoa, setTuKhoa] = useState("");
  const [tab, setTab] = useState("tatCa");
  const [dongChon, setDongChon] = useState(0);
  const [ketQua, setKetQua] = useState({}); // { sanPham: {trangThai, content, totalElements} }
  const khoaGanDay = `fc_tim_gan_day_${userId ?? "khach"}`;
  const [timGanDay, setTimGanDay] = useState(() => docTimGanDay(khoaGanDay));

  const manHinh = useMemo(() => danhSachManHinh(role), [role]);
  const nhomDuocXem = useMemo(
    () => NHOM.filter((n) => !n.trangDanhSach || vaiTroCuaTrang(n.trangDanhSach).includes(role)),
    [role],
  );

  const tk = tuKhoa.trim();
  const daGoDu = tk.length >= SO_KY_TU_TOI_THIEU;
  const tabHienTai = tab === "tatCa" || nhomDuocXem.some((n) => n.key === tab) ? tab : "tatCa";

  // Màn hình: lọc tại chỗ, không phân biệt dấu
  const manHinhKhop = useMemo(() => {
    if (!daGoDu) return [];
    const k = boDau(tk);
    return manHinh.filter((m) => boDau(`${m.label} ${m.viTri}`).includes(k));
  }, [daGoDu, tk, manHinh]);

  // Gọi API khi ngừng gõ; chỉ nhận kết quả của lần gõ mới nhất
  useEffect(() => {
    if (!daGoDu) return undefined;
    const lanTim = ++lanTimRef.current;
    const nhomApi = nhomDuocXem.filter((n) => HAM_TIM[n.key]);
    const hen = setTimeout(() => {
      setKetQua(Object.fromEntries(nhomApi.map((n) => [n.key, { trangThai: "dangTai" }])));
      nhomApi.forEach((n) => {
        HAM_TIM[n.key](tk)
          .then((trang) => {
            if (lanTim !== lanTimRef.current) return;
            setKetQua((cu) => ({
              ...cu,
              [n.key]: { trangThai: "xong", content: trang.content ?? [], totalElements: trang.totalElements ?? 0 },
            }));
          })
          .catch(() => {
            if (lanTim !== lanTimRef.current) return;
            setKetQua((cu) => ({ ...cu, [n.key]: { trangThai: "loi" } }));
          });
      });
    }, THOI_GIAN_CHO_MS);
    return () => clearTimeout(hen);
  }, [daGoDu, tk, nhomDuocXem]);

  const dangCho = daGoDu && Object.keys(ketQua).length === 0;

  // Gom dữ liệu theo nhóm để vẽ và để điều khiển bằng bàn phím
  const nhomHienThi = useMemo(() => {
    if (!daGoDu) return [];
    return nhomDuocXem
      .map((n) => {
        if (n.key === "manHinh") {
          return { ...n, trangThai: "xong", content: manHinhKhop, totalElements: manHinhKhop.length };
        }
        return { ...n, ...(ketQua[n.key] ?? { trangThai: "dangTai" }) };
      })
      .filter((n) => tabHienTai === "tatCa" || n.key === tabHienTai);
  }, [daGoDu, nhomDuocXem, manHinhKhop, ketQua, tabHienTai]);

  const dongs = useMemo(() => {
    if (!daGoDu) return timGanDay.map((q) => ({ loai: "ganDay", key: `gd-${q}`, giaTri: q }));
    const ds = [];
    nhomHienThi.forEach((n) => {
      if (n.trangThai !== "xong") return;
      const gioiHan = tabHienTai === "tatCa" ? SO_DONG_XEM_TRUOC : SO_KET_QUA_MOI_NHOM;
      n.content.slice(0, gioiHan).forEach((item) => ds.push({ loai: n.key, key: `${n.key}-${item.id}`, giaTri: item }));
    });
    return ds;
  }, [daGoDu, timGanDay, nhomHienThi, tabHienTai]);

  const dongChonHopLe = Math.min(dongChon, Math.max(dongs.length - 1, 0));

  const dong = useCallback(() => {
    setMo(false);
    oNhapRef.current?.blur();
  }, []);

  const luuTimGanDay = useCallback(
    (q) => {
      if (q.length < SO_KY_TU_TOI_THIEU) return;
      setTimGanDay((cu) => {
        const moi = [q, ...cu.filter((x) => x !== q)].slice(0, SO_TIM_GAN_DAY);
        ghiTimGanDay(khoaGanDay, moi);
        return moi;
      });
    },
    [khoaGanDay],
  );

  const chonDong = useCallback(
    (d) => {
      if (!d) return;
      if (d.loai === "ganDay") {
        setTuKhoa(d.giaTri);
        setKetQua({});
        setDongChon(0);
        oNhapRef.current?.focus();
        return;
      }
      luuTimGanDay(tk);
      const duongDan = {
        manHinh: d.giaTri.to,
        sanPham: `/products/${d.giaTri.id}`,
        donHang: `/sales-orders/${d.giaTri.id}`,
        khachHang: `/customers/${d.giaTri.id}`,
      }[d.loai];
      setTuKhoa("");
      setKetQua({});
      dong();
      // Trang đang sửa dở (vd. trình sửa mẫu in) được hỏi trước khi rời
      xinRoiTrang(() => navigate(duongDan));
    },
    [dong, luuTimGanDay, navigate, tk],
  );

  // Ctrl/⌘ + K ở bất kỳ đâu trong backoffice
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        oNhapRef.current?.focus();
        oNhapRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!mo) return undefined;
    const onDown = (e) => {
      if (!khungRef.current?.contains(e.target)) setMo(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mo]);

  // Giữ dòng đang chọn trong vùng nhìn thấy
  useEffect(() => {
    if (!mo) return;
    document.getElementById(`${listboxId}-dong-${dongChonHopLe}`)?.scrollIntoView({ block: "nearest" });
  }, [mo, dongChonHopLe, listboxId]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMo(true);
      setDongChon(Math.min(dongChonHopLe + 1, dongs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDongChon(Math.max(dongChonHopLe - 1, 0));
    } else if (e.key === "Enter") {
      if (dongs[dongChonHopLe]) {
        e.preventDefault();
        chonDong(dongs[dongChonHopLe]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      dong();
    }
  };

  const doiTuKhoa = (giaTri) => {
    setTuKhoa(giaTri);
    setDongChon(0);
    setMo(true);
    // Bỏ kết quả của từ khóa cũ ngay, tránh hiện kết quả cũ trong lúc chờ ngừng gõ
    setKetQua({});
  };

  const xoaTimGanDay = () => {
    setTimGanDay([]);
    ghiTimGanDay(khoaGanDay, []);
  };

  const chiSoDong = (key) => dongs.findIndex((d) => d.key === key);
  const tongKetQua = nhomHienThi.reduce((s, n) => s + (n.trangThai === "xong" ? n.totalElements : 0), 0);
  const conDangTai = dangCho || nhomHienThi.some((n) => n.trangThai === "dangTai");
  const dongDangChon = dongs[dongChonHopLe];

  /* ---------- Vẽ một dòng kết quả ---------- */
  const veDong = (d) => {
    const i = chiSoDong(d.key);
    const chon = i === dongChonHopLe;
    const item = d.giaTri;
    let bieuTuong;
    let chinh;
    let phu;
    let benPhai = null;

    if (d.loai === "manHinh") {
      bieuTuong = <LayoutGrid className="size-4" />;
      chinh = <ToDam text={item.label} tuKhoa={tk} />;
      phu = item.viTri;
    } else if (d.loai === "sanPham") {
      const anh = item.anhQuanAos?.[0]?.tepTin?.duongDan;
      const tt = TRANG_THAI_SAN_PHAM[item.trangThai];
      bieuTuong = anh ? (
        <img src={anh} alt="" className="size-full rounded-md object-cover" loading="lazy" />
      ) : (
        <Package className="size-4" />
      );
      chinh = <ToDam text={item.tenSanPham} tuKhoa={tk} />;
      phu = [item.thuongHieu?.tenThuongHieu, item.giaBanMacDinh != null ? formatCurrency(item.giaBanMacDinh) : null]
        .filter(Boolean)
        .join(" · ") || "—";
      benPhai = tt ? <StatusBadge label={tt.label} /> : null;
    } else if (d.loai === "donHang") {
      const tt = getDonBanHangStatus(item.trangThai);
      bieuTuong = <ShoppingCart className="size-4" />;
      chinh = (
        <>
          <ToDam text={item.soDonHang} tuKhoa={tk} /> · {item.khachHang?.tenKhachHang || "Khách lẻ"}
        </>
      );
      phu = [item.kenhBanHang?.tenKenh, item.ngayDatHang ? new Date(item.ngayDatHang).toLocaleDateString("vi-VN") : null]
        .filter(Boolean)
        .join(" · ") || "—";
      benPhai = (
        <span className="flex flex-col items-end gap-1">
          {item.tongCong != null ? (
            <span className="text-xs font-medium text-bo-foreground">{formatCurrency(item.tongCong)}</span>
          ) : null}
          {tt?.label ? <StatusBadge label={tt.label} /> : null}
        </span>
      );
    } else if (d.loai === "khachHang") {
      bieuTuong = <UserRound className="size-4" />;
      chinh = <ToDam text={item.tenKhachHang} tuKhoa={tk} />;
      phu = (
        <>
          {item.soDienThoai ? <ToDam text={item.soDienThoai} tuKhoa={tk} /> : null}
          {item.soDienThoai && item.maKhachHang ? " · " : null}
          {item.maKhachHang ? <ToDam text={item.maKhachHang} tuKhoa={tk} /> : null}
          {!item.soDienThoai && !item.maKhachHang ? "—" : null}
        </>
      );
    } else {
      bieuTuong = <History className="size-4" />;
      chinh = item;
      phu = null;
    }

    return (
      <li
        key={d.key}
        id={`${listboxId}-dong-${i}`}
        role="option"
        aria-selected={chon}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => chonDong(d)}
        onMouseMove={() => i !== dongChonHopLe && setDongChon(i)}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-4 py-2 sm:px-5",
          chon ? "bg-bo-primary-soft/70" : "hover:bg-slate-50",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100 text-slate-500">
          {bieuTuong}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-bo-foreground">{chinh}</span>
          {phu ? <span className="mt-0.5 block truncate text-xs text-bo-muted">{phu}</span> : null}
        </span>
        {benPhai ? <span className="shrink-0">{benPhai}</span> : null}
      </li>
    );
  };

  /* ---------- Thân khung kết quả ---------- */
  let than;
  if (!daGoDu) {
    than = timGanDay.length ? (
      <>
        <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:px-5">
          Tìm gần đây
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={xoaTimGanDay}
            className="text-xs font-medium normal-case tracking-normal text-bo-primary hover:underline"
          >
            Xóa
          </button>
        </div>
        <ul role="listbox" id={listboxId} aria-label="Tìm gần đây">
          {dongs.map(veDong)}
        </ul>
      </>
    ) : (
      <TrangThaiRong>
        {tk.length > 0
          ? `Gõ thêm ít nhất ${SO_KY_TU_TOI_THIEU - tk.length} ký tự nữa`
          : `Nhập từ khóa để tìm ${GOI_Y_THEO_TAB[tabHienTai]}…`}
      </TrangThaiRong>
    );
  } else if (!conDangTai && tongKetQua === 0 && nhomHienThi.every((n) => n.trangThai === "xong")) {
    than = (
      <TrangThaiRong ghiChu="Thử tìm theo mã đơn, tên sản phẩm, tên hoặc số điện thoại khách hàng">
        Không tìm thấy kết quả cho “{tk}”
      </TrangThaiRong>
    );
  } else {
    than = (
      <ul role="listbox" id={listboxId} aria-label="Kết quả tìm kiếm">
        {nhomHienThi.map((n) => {
          if (n.trangThai === "xong" && n.totalElements === 0) return null;
          const gioiHan = tabHienTai === "tatCa" ? SO_DONG_XEM_TRUOC : SO_KET_QUA_MOI_NHOM;
          const conNua = n.trangThai === "xong" && n.totalElements > Math.min(gioiHan, n.content.length);
          return (
            <li key={n.key} role="presentation">
              <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:px-5">
                {n.label}
                {tabHienTai === "tatCa" && conNua ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setTab(n.key);
                      setDongChon(0);
                    }}
                    className="text-xs font-medium normal-case tracking-normal text-bo-primary hover:underline"
                  >
                    Xem {n.totalElements.toLocaleString("vi-VN")} kết quả
                  </button>
                ) : null}
              </div>
              {n.trangThai === "dangTai" ? (
                <div className="space-y-2 px-4 py-2 sm:px-5" aria-hidden="true">
                  <div className="h-9 animate-pulse rounded-md bg-slate-100" />
                  <div className="h-9 animate-pulse rounded-md bg-slate-100" />
                </div>
              ) : n.trangThai === "loi" ? (
                <p className="px-4 py-2 text-xs text-bo-danger sm:px-5">Không tải được {n.label.toLowerCase()}. Thử lại sau.</p>
              ) : (
                <ul role="group" aria-label={n.label}>
                  {dongs.filter((d) => d.loai === n.key).map(veDong)}
                </ul>
              )}
              {tabHienTai !== "tatCa" && conNua ? (
                <p className="px-4 pb-2 pt-1 text-xs text-bo-muted sm:px-5">
                  Đang hiện {Math.min(gioiHan, n.content.length)} / {n.totalElements.toLocaleString("vi-VN")} kết quả, gõ cụ thể hơn để thu hẹp.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const tabs = [{ key: "tatCa", label: "Tất cả" }, ...nhomDuocXem];
  const demTab = (key) => {
    if (!daGoDu || conDangTai) return null;
    if (key === "tatCa") return tongKetQuaTatCa(nhomDuocXem, ketQua, manHinhKhop.length);
    if (key === "manHinh") return manHinhKhop.length;
    return ketQua[key]?.trangThai === "xong" ? ketQua[key].totalElements : null;
  };

  return (
    <div ref={khungRef} className="relative w-full min-w-0" style={{ maxWidth: 600 }}>
      <div
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-lg border px-3 transition-[border-color,box-shadow,background-color]",
          mo ? "border-bo-primary bg-white" : "border-transparent hover:bg-slate-50",
        )}
        style={mo ? { boxShadow: "0 0 0 3px rgba(22,119,255,0.12)" } : undefined}
      >
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={oNhapRef}
          type="text"
          value={tuKhoa}
          onChange={(e) => doiTuKhoa(e.target.value)}
          onFocus={() => setMo(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label="Tìm kiếm trong hệ thống"
          aria-expanded={mo}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={mo && dongDangChon ? `${listboxId}-dong-${dongChonHopLe}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-bo-foreground outline-none placeholder:text-slate-400"
        />
        {tuKhoa ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              doiTuKhoa("");
              oNhapRef.current?.focus();
            }}
            aria-label="Xóa từ khóa"
            className="grid size-6 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {mo ? (
        <div
          className={cn(
            "z-50 overflow-hidden rounded-xl border border-bo-border bg-white",
            isPhone ? "fixed inset-x-3" : "absolute inset-x-0",
          )}
          style={{ top: isPhone ? 60 : "calc(100% + 6px)", boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}
        >
          <div
            className="flex overflow-x-auto overflow-y-hidden border-b border-bo-border px-2 sm:px-3"
            style={{ scrollbarWidth: "none" }}
            role="tablist"
            aria-label="Nhóm kết quả"
          >
            {tabs.map((t) => {
              const so = demTab(t.key);
              const dangChon = tabHienTai === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={dangChon}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTab(t.key);
                    setDongChon(0);
                  }}
                  className={cn(
                    "-mb-px shrink-0 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:px-3",
                    dangChon ? "border-bo-primary text-bo-primary" : "border-transparent text-bo-muted hover:text-bo-foreground",
                  )}
                >
                  {t.label}
                  {so != null ? (
                    <span
                      className={cn(
                        "ml-1.5 rounded-full px-1.5 text-[11px]",
                        dangChon ? "bg-bo-primary-soft text-bo-primary" : "bg-slate-100 text-bo-muted",
                      )}
                    >
                      {so.toLocaleString("vi-VN")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="overflow-y-auto pb-2" style={{ maxHeight: "min(440px, calc(100dvh - 140px))" }}>{than}</div>
        </div>
      ) : null}
    </div>
  );
}

function tongKetQuaTatCa(nhomDuocXem, ketQua, soManHinh) {
  return nhomDuocXem.reduce((tong, n) => {
    if (n.key === "manHinh") return tong + soManHinh;
    return tong + (ketQua[n.key]?.trangThai === "xong" ? ketQua[n.key].totalElements : 0);
  }, 0);
}

function TrangThaiRong({ children, ghiChu }) {
  return (
    <div className="px-6 py-8 text-center">
      <Search className="mx-auto mb-2 size-8 text-slate-300" aria-hidden="true" />
      <p className="text-sm text-bo-muted">{children}</p>
      {ghiChu ? <p className="mt-1 text-xs text-slate-400">{ghiChu}</p> : null}
    </div>
  );
}
