// src/pages/bin-move/BinMovePage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Warehouse, WifiOff } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import ChonKhoKiemKe from "@/components/kiem-ke/ChonKhoKiemKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import ThanhQuet from "@/components/chuyen-ke/ThanhQuet";
import CotTuKe from "@/components/chuyen-ke/CotTuKe";
import CotSangKe from "@/components/chuyen-ke/CotSangKe";
import ThanhXacNhan from "@/components/chuyen-ke/ThanhXacNhan";
import BienNhanChuyenKe from "@/components/chuyen-ke/BienNhanChuyenKe";
import { SoDoKeDich, TheSoDoNguon } from "@/components/chuyen-ke/SoDoKeChuyen";
import {
  capNhatKeDich,
  conLaiTheoLo,
  conTrongCua,
  dongDaChon,
  dongTheoMaQuet,
  ghepGhiChu,
  gomTheoKeDich,
  lyDoKhongDung,
  phanBoKeDich,
  soNguyen,
  taoDongGui,
  themKeGanDay,
  tongSoLuong,
} from "@/components/chuyen-ke/chuyenKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { goiYKeDich, layDsKe, taoKhoaLenh, timHang, traKe, xacNhanChuyenKe } from "@/services/chuyenKeService";
import { VAI_TRO_KHO } from "@/components/backoffice/sidebar.config";
import { getApiErrorMessage } from "@/utils/apiError";
import { getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { playScanBeep } from "@/utils/scanBeep";
import { t, tDuLieu } from "@/i18n";

const THE = "rounded-lg border border-bo-border bg-bo-surface shadow-sm";
const NUT_PHU = "h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle";

/** Báo lỗi bằng tiếng bíp trầm và rung (máy quét cầm tay / điện thoại), BA A1, A4. */
function baoLoi() {
  playScanBeep(false);
  try {
    navigator.vibrate?.(200);
  } catch {
    // Trình duyệt không cho rung: bỏ qua
  }
}

const khoaKeGanDay = (khoId) => `fcentric.chuyen-ke.ke-gan-day.${khoId}`;
function docKeGanDay(khoId) {
  try {
    const v = JSON.parse(localStorage.getItem(khoaKeGanDay(khoId)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function ghiKeGanDay(khoId, ds) {
  try {
    localStorage.setItem(khoaKeGanDay(khoId), JSON.stringify(ds));
  } catch {
    // Trình duyệt chặn lưu: chỉ mất phần gợi ý kệ gần đây
  }
}

// Lượt chuyển đang dở (chưa xác nhận), lưu theo thẻ trình duyệt và kho: tải lại trang thì hỏi làm tiếp. sessionStorage
// để không mang sang thẻ khác / ngày khác và hai thẻ không đè nhau.
const khoaLuotDo = (khoId) => `fcentric.chuyen-ke.luot-do.${khoId}`;
const LUOT_DO_HET_HAN_MS = 12 * 60 * 60 * 1000;
function docLuotDo(khoId) {
  try {
    const v = JSON.parse(sessionStorage.getItem(khoaLuotDo(khoId)) ?? "null");
    return v && typeof v.ma === "string" && Date.now() - (v.luc ?? 0) < LUOT_DO_HET_HAN_MS ? v : null;
  } catch {
    return null;
  }
}
function ghiLuotDo(khoId, v) {
  try {
    if (v) sessionStorage.setItem(khoaLuotDo(khoId), JSON.stringify(v));
    else sessionStorage.removeItem(khoaLuotDo(khoId));
  } catch {
    // Trình duyệt chặn lưu: chỉ mất phần làm tiếp sau khi tải lại trang
  }
}

// Lần gửi chưa rõ kết quả (đã bấm Xác nhận, chưa nhận trả lời): ghi TRƯỚC khi chờ máy chủ, xóa khi máy chủ trả lời. Tải lại
// trang giữa chừng vẫn gửi lại được đúng nội dung, đúng khóa chống gửi lặp (không tạo phiếu thứ hai).
const khoaDangGui = (khoId) => `fcentric.chuyen-ke.dang-gui.${khoId}`;
function docDangGui(khoId) {
  try {
    const v = JSON.parse(sessionStorage.getItem(khoaDangGui(khoId)) ?? "null");
    return v && v.khoId === khoId && v.yeuCau && v.khoa && Date.now() - (v.luc ?? 0) < LUOT_DO_HET_HAN_MS ? v : null;
  } catch {
    return null;
  }
}
function ghiDangGui(khoId, v) {
  try {
    if (v) sessionStorage.setItem(khoaDangGui(khoId), JSON.stringify(v));
    else sessionStorage.removeItem(khoaDangGui(khoId));
  } catch {
    // Trình duyệt chặn lưu: tải lại trang thì mất lần gửi treo, kiểm tra ở Lịch sử
  }
}

/**
 * Lỗi mà máy chủ có thể đã chuyển xong: không có phản hồi (mất mạng, hết giờ chờ), cổng / proxy báo lỗi (502, 504,
 * Cloudflare 52x) hoặc lỗi 5xx không phải thân trả lời của máy chủ. Còn lại là máy chủ đã trả lời "không chuyển".
 */
function chuaRoKetQua(e) {
  const r = e?.response;
  if (!r) return true;
  const coThan = r.data != null && typeof r.data === "object";
  return r.status === 502 || r.status === 504 || r.status >= 520 || (r.status >= 500 && !coThan);
}

// Cách chọn kệ đích người dùng chọn lần trước ("goi-y" | "so-do"), nhớ trên máy này
const KHOA_CHE_DO_DICH = "fcentric.chuyen-ke.che-do-dich";
function docCheDoDich() {
  try {
    return localStorage.getItem(KHOA_CHE_DO_DICH) === "so-do" ? "so-do" : "goi-y";
  } catch {
    return "goi-y";
  }
}

/** Tên một lô để hiện: tên sản phẩm · màu · cỡ (dữ liệu, dịch nếu có), hoặc mã SKU. */
function tenLo(lo) {
  if (!lo) return "";
  return [lo.tenSanPham ? tDuLieu(lo.tenSanPham) : lo.maSku, ...[lo.mau, lo.kichCo].filter(Boolean).map((x) => tDuLieu(x))].join(" · ");
}

/** Giá trị trễ `ms` (gọi gợi ý kệ sau khi người dùng ngừng đổi số lượng). */
function useTre(giaTri, ms) {
  const [v, setV] = useState(giaTri);
  useEffect(() => {
    const id = setTimeout(() => setV(giaTri), ms);
    return () => clearTimeout(id);
  }, [giaTri, ms]);
  return v;
}

/**
 * Chuyển kệ nội bộ (/warehouse/bin-moves, UC-7.4 Scan-to-Move): đổi chỗ hàng giữa các kệ của một kho, tồn kho không đổi.
 * Một ô quét cho cả lượt: mã kệ đầu tiên là kệ nguồn; sau đó mã hàng / lô trên kệ cộng 1, mã kệ khác là kệ đích (chưa
 * chọn hàng thì là đổi kệ nguồn). Kệ đích thiếu chỗ xử lý ngay trong cột "Kệ đích" (A3: tách cất hoặc đổi kệ). Xác nhận
 * ở thanh dưới cùng, máy chủ ghi một phiếu MV-YYYYMMDD-XXXX trong một giao dịch.
 * Màn mở đầu là sơ đồ kệ của kho (bấm ô = quét mã kệ đó) kèm mục Cần xử lý; ở bước Kệ đích có thể chọn kệ trên sơ đồ.
 * Sau khi chốt, kệ nguồn còn hàng thì giữ nguyên để chuyển tiếp.
 */
export default function BinMovePage() {
  const navigate = useNavigate();
  const kho = useKhoKiemKe();
  const khoId = kho.khoId;
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const duocVuot = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);

  const oQuetRef = useRef(null);
  const [ma, setMa] = useState("");
  const [phanHoi, setPhanHoi] = useState(null);
  const [lan, setLan] = useState(0);
  const [dangTra, setDangTra] = useState(false);
  const [nguon, setNguon] = useState(null);
  const [chon, setChon] = useState({});
  const [loiDong, setLoiDong] = useState({});
  const [noiBat, setNoiBat] = useState(null);
  const [dsDich, setDsDich] = useState([]);
  const [thieuCho, setThieuCho] = useState(null);
  const [lyDo, setLyDo] = useState(null);
  const [ghiChu, setGhiChu] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const [keGanDay, setKeGanDay] = useState([]);
  const [cheDoDich, setCheDoDich] = useState(docCheDoDich);
  // Đợt 2: kết quả quét mã hàng ở bước đầu. Đợt 3: lượt dở chờ hỏi làm tiếp; lần gửi mất kết nối chưa rõ kết quả
  const [hangTim, setHangTim] = useState(null);
  const [luotDo, setLuotDo] = useState(null);
  const [chuaRo, setChuaRo] = useState(null);
  // Khóa chống gửi lặp của nội dung đang gửi: `{ noiDung, khoa }`, đổi nội dung thì sinh khóa mới
  const khoaLenhRef = useRef(null);
  // Kho của lần lưu lượt dở trước: lần vẽ đổi kho vẫn còn kệ nguồn của kho cũ, không ghi nó vào khóa của kho mới
  const khoLuotDoRef = useRef(khoId);
  const coViTriKho = hasAnyRole(VAI_TRO_KHO);

  const dsChon = useMemo(() => dongDaChon(nguon?.dong, chon), [nguon, chon]);
  const tong = tongSoLuong(dsChon);
  const { phan, conLai } = useMemo(() => phanBoKeDich(tong, dsDich), [tong, dsDich]);
  const coVuot = phan.some((p) => p.vuot && p.nhan > conTrongCua(p.ke));
  const buoc = !nguon ? 0 : tong <= 0 ? 1 : conLai > 0 ? 2 : 3;
  // Số mới nhất cho các bước chạy sau khi chờ máy chủ (người dùng có thể đổi số lượng trong lúc tra mã)
  const moiNhat = useRef({ nguon, tong, conLai, dsDich, chon, khoId });
  moiNhat.current = { nguon, tong, conLai, dsDich, chon, khoId };

  // Đưa tiêu điểm về ô quét cho máy quét; màn cảm ứng (html[data-cam-ung]) thì không, để bàn phím ảo khỏi bật liên tục
  const veOQuet = () => {
    if (document.documentElement.hasAttribute("data-cam-ung")) return;
    setTimeout(() => oQuetRef.current?.focus(), 0);
  };

  // ── Dữ liệu phụ: các kệ của kho (sơ đồ, gợi ý khi gõ mã kệ), kệ gợi ý ──
  const taiDsKe = useCallback(() => layDsKe(khoId), [khoId]);
  const dsKeQ = useTaiDuLieu(taiDsKe, `chuyen-ke-ds-ke-${khoId}`, { enabled: khoId != null });
  const dsKe = useMemo(() => (dsKeQ.dungKhoa && Array.isArray(dsKeQ.data) ? dsKeQ.data : []), [dsKeQ.dungKhoa, dsKeQ.data]);
  const taiLaiDsKe = dsKeQ.reload;
  // Quay lại cửa sổ khi chưa mở kệ nguồn: người khác có thể vừa chuyển hàng, tải lại số trên sơ đồ
  useEffect(() => {
    const khiHien = () => {
      if (document.visibilityState === "visible" && !moiNhat.current.nguon) taiLaiDsKe?.();
    };
    document.addEventListener("visibilitychange", khiHien);
    return () => document.removeEventListener("visibilitychange", khiHien);
  }, [taiLaiDsKe]);

  // Tên từng mã hàng trong giỏ (gợi ý kệ đích ghi "Đang chứa: …") và số mã đang chuyển
  const tenMa = useMemo(() => {
    const m = new Map();
    for (const d of dsChon) if (d.bienTheId != null && !m.has(d.bienTheId)) m.set(d.bienTheId, tenLo(d));
    return m;
  }, [dsChon]);

  // Lô nào sẽ đặt lên kệ đích nào (cùng phép chia gửi máy chủ), để người cầm xe đẩy đặt đúng chỗ
  const loTheoKe = useMemo(() => {
    const theoLo = Object.fromEntries((nguon?.dong ?? []).map((d) => [d.loHangId, d]));
    const m = new Map();
    for (const g of gomTheoKeDich(taoDongGui(dsChon, phan.filter((p) => p.nhan > 0)))) {
      m.set(
        g.keDichId,
        g.dong.map((d) => ({ loHangId: d.loHangId, ten: tenLo(theoLo[d.loHangId]), maLo: theoLo[d.loHangId]?.maLo, soLuong: d.soLuong })),
      );
    }
    return m;
  }, [nguon, dsChon, phan]);

  // Gợi ý kệ: chỉ tải lại khi đổi kệ nguồn / tập mã hàng (không theo từng lần +1); "đủ chỗ" và thứ tự tính lại ở đây theo
  // số còn phải cất, cùng thứ tự máy chủ: cùng mã hàng → đủ chỗ → cùng khu → ít chỗ trống trước → mã kệ
  const bienTheIds = useMemo(() => [...new Set(dsChon.map((d) => d.bienTheId).filter(Boolean))].sort((a, b) => a - b).join(","), [dsChon]);
  const coGoiY = Boolean(nguon) && tong > 0 && conLai > 0;
  const khoaGoiYMoi = nguon && bienTheIds ? `${khoId}|${nguon.id}|${bienTheIds}` : "";
  const khoaGoiY = useTre(khoaGoiYMoi, 300);
  const taiGoiY = useCallback(() => {
    const [k, ke, bt] = khoaGoiY.split("|");
    return goiYKeDich(Number(k), { keNguonId: Number(ke), bienTheIds: bt, can: 0 });
  }, [khoaGoiY]);
  const goiYQ = useTaiDuLieu(taiGoiY, `chuyen-ke-goi-y-${khoaGoiY}`, { enabled: coGoiY && Boolean(khoaGoiY) });
  // Giữ danh sách cũ của cùng kệ nguồn trong lúc tải lại (không nhấp nháy dưới con trỏ)
  const goiYCu = useRef({ khoa: "", ds: undefined });
  if (goiYQ.dungKhoa && goiYQ.data) goiYCu.current = { khoa: khoaGoiY, ds: goiYQ.data };
  const goiY = useMemo(() => {
    const cungNguon = nguon && goiYCu.current.khoa.startsWith(`${khoId}|${nguon.id}|`);
    const ds = goiYQ.dungKhoa && goiYQ.data ? goiYQ.data : cungNguon ? goiYCu.current.ds : undefined;
    if (!ds) return undefined;
    return ds
      .map((k) => ({ ...k, duCho: k.conTrong == null || k.conTrong >= conLai }))
      .sort((a, b) => (b.bienTheKhop?.length ?? Number(b.cungMa)) - (a.bienTheKhop?.length ?? Number(a.cungMa)) || Number(b.duCho) - Number(a.duCho) || Number(b.cungKhu) - Number(a.cungKhu)
        || (a.conTrong ?? Infinity) - (b.conTrong ?? Infinity) || String(a.maViTri).localeCompare(String(b.maViTri)));
  }, [goiYQ.dungKhoa, goiYQ.data, nguon, khoId, conLai]);

  /** Bỏ cả lượt đang làm (giữ kết quả lượt vừa xong), tiêu điểm về ô quét. */
  const lamMoi = useCallback(() => {
    setMa("");
    setNguon(null);
    setChon({});
    setLoiDong({});
    setNoiBat(null);
    setDsDich([]);
    setThieuCho(null);
    setLyDo(null);
    setGhiChu("");
    setHangTim(null);
    // Không xóa chuaRo: lần gửi chưa rõ kết quả còn đó tới khi gửi lại hoặc người dùng bỏ
    // Màn cảm ứng không tự đưa tiêu điểm vào ô quét (tránh bật bàn phím ảo)
    if (!document.documentElement.hasAttribute("data-cam-ung")) setTimeout(() => oQuetRef.current?.focus(), 0);
  }, []);

  // Đổi kho: lượt đang làm và kệ gần đây thuộc kho cũ
  useEffect(() => {
    lamMoi();
    setKetQua(null);
    setPhanHoi(null);
    setKeGanDay(khoId == null ? [] : docKeGanDay(khoId));
    setLuotDo(khoId == null ? null : docLuotDo(khoId));
    // Lần gửi trước khi tải lại trang chưa rõ kết quả: hỏi gửi lại (lamMoi ở trên vừa xóa chuaRo, lệnh này chạy sau)
    setChuaRo(khoId == null ? null : docDangGui(khoId));
    khoaLenhRef.current = null;
  }, [khoId, lamMoi]);

  // Lưu lượt đang dở mỗi khi đổi (chưa mở kệ nguồn thì không đụng tới: còn chờ hỏi làm tiếp)
  useEffect(() => {
    if (khoLuotDoRef.current !== khoId) {
      khoLuotDoRef.current = khoId;
      return;
    }
    if (khoId == null || !nguon) return;
    if (tong <= 0 && !dsDich.length) {
      ghiLuotDo(khoId, null);
      return;
    }
    ghiLuotDo(khoId, {
      ma: nguon.maViTri,
      chon,
      dich: dsDich.map((d) => ({ ma: d.ke.maViTri, vuot: Boolean(d.vuot), toiDa: d.toiDa ?? null })),
      lyDo,
      ghiChu,
      tong,
      luc: Date.now(),
    });
  }, [khoId, nguon, chon, dsDich, lyDo, ghiChu, tong]);

  // Đổi số lượng hoặc bỏ một kệ đích: khối "kệ thiếu chỗ" tính theo số cũ, bỏ để quét / chọn lại
  useEffect(() => {
    setThieuCho(null);
  }, [tong, conLai]);

  /** Thao tác ghi theo kho: nhân viên đổi kho làm việc về kho đang xem trước (như các màn kho khác). */
  const dongBoKho = () => {
    if (!laQtv && khoId != null && getKhoLamViecId() !== khoId) setKhoLamViecId(khoId);
  };

  const tra = async (maKe) => {
    dongBoKho();
    setDangTra(true);
    try {
      return await traKe(khoId, maKe);
    } finally {
      setDangTra(false);
    }
  };

  // ── Kệ nguồn ──
  /** Mở `ke` làm kệ nguồn; trả false khi kệ không lấy hàng được (đã báo lỗi). */
  const datNguon = (ke) => {
    if (lyDoKhongDung(ke, "nguon")) {
      baoLoi();
      setPhanHoi({ kieu: "loi", chu: ke.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: ke.maViTri }) });
      return false;
    }
    if (!(ke.dong ?? []).some((d) => d.khaDung > 0 && !d.khoaKiemKe)) {
      baoLoi();
      setPhanHoi({
        kieu: "canhBao",
        chu: !ke.dong?.length
          ? t("Kệ {{ma}} không có hàng. Quét kệ khác.", { ma: ke.maViTri })
          : t("Hàng trên kệ {{ma}} đang chờ nhặt hoặc đang kiểm kê, chưa chuyển được.", { ma: ke.maViTri }),
      });
      return false;
    }
    playScanBeep(true);
    setNguon(ke);
    setHangTim(null);
    setLuotDo(null);
    setChon({});
    setLoiDong({});
    setNoiBat(null);
    setDsDich([]);
    setThieuCho(null);
    setKetQua(null);
    const moi = themKeGanDay(docKeGanDay(khoId), ke.maViTri);
    setKeGanDay(moi);
    ghiKeGanDay(khoId, moi);
    setPhanHoi({ kieu: "ok", chu: t("Đã mở kệ {{ma}} · {{soLo}} lô. Quét mã hàng hoặc nhập số lượng cần chuyển.", { ma: ke.maViTri, soLo: soVN(ke.dong.length), count: ke.dong.length }) });
    return true;
  };

  /** Đặt số lượng một lô; vượt khả dụng thì tự điền lại số tối đa và báo (A2). */
  const datSo = (dong, giaTri) => {
    const so = soNguyen(giaTri);
    const raw = String(giaTri ?? "");
    if (so > dong.khaDung) {
      setChon((c) => ({ ...c, [dong.loHangId]: String(dong.khaDung) }));
      setLoiDong((l) => ({
        ...l,
        [dong.loHangId]: dong.dangGiuNhat > 0
          ? t("Số lượng khả dụng tại kệ chỉ còn {{x}} (có {{y}} sản phẩm đang chờ nhặt theo đơn hàng).", { x: soVN(dong.khaDung), y: soVN(dong.dangGiuNhat) })
          : t("Số lượng khả dụng tại kệ chỉ còn {{x}}.", { x: soVN(dong.khaDung) }),
      }));
      baoLoi();
      return;
    }
    setChon((c) => ({ ...c, [dong.loHangId]: raw === "" ? "" : String(so) }));
    setLoiDong((l) => (l[dong.loHangId] ? { ...l, [dong.loHangId]: null } : l));
  };

  const congHang = (dong) => {
    if (dong.khoaKiemKe || dong.khaDung <= 0) {
      baoLoi();
      setPhanHoi({ kieu: "loi", chu: dong.khoaKiemKe ? t("Lô {{lo}} đang kiểm kê ở kệ này, chưa chuyển được.", { lo: dong.maLo }) : t("Lô {{lo}} không còn số khả dụng để chuyển.", { lo: dong.maLo }) });
      return;
    }
    const daCo = soNguyen(moiNhat.current.chon[dong.loHangId]);
    setNoiBat(dong.loHangId);
    if (daCo >= dong.khaDung) {
      datSo(dong, daCo + 1);
      setPhanHoi({ kieu: "canhBao", chu: t("Lô {{lo}} đã chọn hết số khả dụng ({{so}}).", { lo: dong.maLo, so: soVN(dong.khaDung) }) });
      return;
    }
    playScanBeep(true);
    datSo(dong, daCo + 1);
    setPhanHoi({
      kieu: "ok",
      chu: t("Đã thêm 1 · {{ten}}, lô {{lo}} ({{so}} sản phẩm)", { ten: dong.tenSanPham ? tDuLieu(dong.tenSanPham) : dong.maSku, lo: dong.maLo, so: soVN(daCo + 1), count: daCo + 1 }),
    });
  };

  /** Chọn toàn bộ số khả dụng trên kệ `ke` (mặc định kệ nguồn đang mở). */
  const chonTatCa = (ke = nguon) => {
    const moi = {};
    for (const d of ke?.dong ?? []) if (!d.khoaKiemKe && d.khaDung > 0) moi[d.loHangId] = String(d.khaDung);
    const so = Object.values(moi).reduce((s, v) => s + Number(v), 0);
    setChon(moi);
    setLoiDong({});
    setPhanHoi({ kieu: "thongTin", chu: t("Đã chọn toàn bộ {{so}} sản phẩm khả dụng trên kệ.", { so: soVN(so), count: so }) });
    veOQuet();
  };

  /**
   * Mở kệ từ sơ đồ hoặc mục Cần xử lý (như quét mã kệ đó). `viec`: "bao-tri" chọn cả kệ và điền lý do Bảo trì kệ;
   * "vuot" nhắc số cần chuyển bớt.
   */
  const moKe = async (maKe, viec = null) => {
    const khoLuc = moiNhat.current.khoId;
    try {
      const ke = await tra(maKe);
      if (moiNhat.current.khoId !== khoLuc) return;
      if (!datNguon(ke)) return;
      if (viec?.loai === "bao-tri") {
        chonTatCa(ke);
        setLyDo("Bảo trì kệ"); // i18n-giu-nguyen: giá trị lưu vào ghi chú phiếu (LY_DO_CHUYEN_KE)
      } else if (viec?.loai === "vuot") {
        setPhanHoi({ kieu: "thongTin", chu: t("Kệ {{ma}} dư {{so}} sản phẩm: nhập số cần chuyển bớt ở bảng bên dưới.", { ma: ke.maViTri, so: soVN(viec.so), count: viec.so }) });
      } else if (viec?.loai === "hang") {
        const dong = (ke.dong ?? []).find((d) => (viec.loHangId ? d.loHangId === viec.loHangId : d.bienTheId === viec.bienTheId) && d.khaDung > 0 && !d.khoaKiemKe);
        if (dong) setNoiBat(dong.loHangId);
      }
    } catch (e) {
      baoLoi();
      setPhanHoi({ kieu: "loi", chu: getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")) });
    } finally {
      veOQuet();
    }
  };

  // ── Kệ đích ──
  /** Thêm kệ đích; `toiDa`: quản lý kho cho cất vượt sức chứa đúng phần đang thiếu lúc duyệt. */
  const themDich = (ke, toiDa) => {
    const { tong: tongMoi, dsDich: dsCu } = moiNhat.current;
    const muc = toiDa != null ? { ke, vuot: true, toiDa } : { ke };
    setDsDich([...dsCu, muc]);
    setThieuCho(null);
    // Câu dưới ô quét chỉ báo việc vừa làm; số còn thiếu chỗ đã có ở thanh tiến độ chân khối
    const sau = phanBoKeDich(tongMoi, [...dsCu, muc]);
    const cat = sau.phan.find((p) => p.ke.id === ke.id)?.nhan ?? 0;
    // Kèm việc cần làm tiếp (người chỉ nhìn ô quét, nhất là trên điện thoại khi chân khối còn ở dưới)
    const tiep = sau.conLai > 0 ? t("Quét kệ đích tiếp theo.") : t("Đủ chỗ, bấm Xác nhận chuyển kệ.");
    setPhanHoi(
      toiDa != null
        ? { kieu: "canhBao", chu: `${t("Đã thêm kệ {{ma}}: cất {{so}} sản phẩm, vượt sức chứa.", { ma: ke.maViTri, so: soVN(cat), count: cat })} ${tiep}` }
        : { kieu: "ok", chu: `${t("Đã thêm kệ {{ma}}: cất {{so}} sản phẩm.", { ma: ke.maViTri, so: soVN(cat), count: cat })} ${tiep}` },
    );
    veOQuet();
  };

  const chonDich = (ke) => {
    const { nguon: ng, conLai: cl, dsDich: ds } = moiNhat.current;
    if (!ng) return;
    if (ke.id === ng.id) {
      baoLoi();
      setPhanHoi({ kieu: "loi", chu: t("Kệ đích phải khác kệ nguồn.") });
      return;
    }
    if (ds.some((d) => d.ke.id === ke.id)) {
      baoLoi();
      setPhanHoi({ kieu: "canhBao", chu: t("Kệ {{ma}} đã có trong danh sách kệ đích.", { ma: ke.maViTri }) });
      return;
    }
    const lyDoKhoa = lyDoKhongDung(ke, "dich");
    if (lyDoKhoa) {
      baoLoi();
      setPhanHoi({
        kieu: "loi",
        chu: lyDoKhoa === "KHAC"
          ? t("Kệ {{ma}} không ở trạng thái nhận hàng. Chọn kệ khác.", { ma: ke.maViTri })
          : ke.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: ke.maViTri }),
      });
      return;
    }
    if (cl <= 0) {
      setPhanHoi({ kieu: "canhBao", chu: t("Đã đủ chỗ cho mọi sản phẩm. Bỏ bớt kệ đích nếu muốn cất sang kệ khác.") });
      return;
    }
    if (conTrongCua(ke) < cl) {
      // A3: không đủ sức chứa — xử lý ngay trong cột Sang kệ
      playScanBeep(false);
      setThieuCho({ ke, can: cl });
      setPhanHoi({ kieu: "canhBao", chu: t("Vừa quét {{ma}}: thiếu chỗ. Chọn cách xử lý ở cột Kệ đích.", { ma: ke.maViTri }) });
      return;
    }
    playScanBeep(true);
    themDich(ke);
  };

  const chonGoiY = async (maKe) => {
    const khoLuc = moiNhat.current.khoId;
    try {
      const ke = await tra(maKe);
      if (moiNhat.current.khoId !== khoLuc) return; // đã đổi kho trong lúc tra
      chonDich(ke);
    } catch (e) {
      baoLoi();
      setPhanHoi({ kieu: "loi", chu: getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")) });
    } finally {
      veOQuet();
    }
  };

  const boDich = (id) => {
    setDsDich((ds) => ds.filter((d) => d.ke.id !== id));
    setPhanHoi(null);
    veOQuet();
  };

  // ── Một ô quét cho cả lượt ──
  const quet = async (giaTri) => {
    const m = String(giaTri ?? "").trim();
    setLan((x) => x + 1);
    setMa("");
    setLoiDong({});
    if (!m || khoId == null) return;
    const { nguon: ng, tong: tg } = moiNhat.current;
    if (ng) {
      const dong = dongTheoMaQuet(ng.dong, moiNhat.current.chon, m);
      if (dong) {
        congHang(dong);
        return;
      }
      if (m.toLowerCase() === String(ng.maViTri).toLowerCase()) {
        if (tg > 0) {
          baoLoi();
          setPhanHoi({ kieu: "loi", chu: t("Kệ đích phải khác kệ nguồn.") });
        } else {
          setPhanHoi({ kieu: "thongTin", chu: t("Đang lấy hàng từ kệ {{ma}}. Quét mã hàng hoặc nhập số lượng.", { ma: ng.maViTri }) });
        }
        return;
      }
    }
    const khoLuc = moiNhat.current.khoId;
    // Chưa có kệ nguồn và mã không trùng kệ nào của kho (đã tải): quét mã hàng → các kệ đang chứa hàng đó
    const laMaKe = (dsKe ?? []).some((k) => String(k.maViTri).toLowerCase() === m.toLowerCase());
    if (!ng && dsKe.length && !laMaKe) {
      try {
        const h = await (async () => {
          dongBoKho();
          setDangTra(true);
          try {
            return await timHang(khoId, m);
          } finally {
            setDangTra(false);
          }
        })();
        if (moiNhat.current.khoId !== khoLuc || moiNhat.current.nguon) return;
        const ten = [h.tenSanPham, h.mau, h.kichCo].filter(Boolean).map((x) => tDuLieu(x)).join(" · ") || m;
        if (!h.ke?.length) {
          baoLoi();
          setHangTim(null);
          setPhanHoi({ kieu: "canhBao", chu: t("{{ten}} không nằm trên kệ nào của kho này.", { ten }) });
        } else {
          playScanBeep(true);
          setHangTim(h);
          setPhanHoi({ kieu: "ok", chu: t("{{ten}} đang ở {{so}} kệ. Chọn kệ để lấy hàng.", { ten, so: soVN(h.ke.length), count: h.ke.length }) });
        }
        veOQuet();
        return;
      } catch (e) {
        // Không phải mã hàng: thử như mã kệ (kệ vừa tạo chưa có trong danh sách đã tải)
        if (e?.response?.status !== 404) {
          baoLoi();
          setPhanHoi({ kieu: "loi", chu: getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")) });
          veOQuet();
          return;
        }
      }
    }
    try {
      const ke = await tra(m);
      if (moiNhat.current.khoId !== khoLuc) return; // đã đổi kho trong lúc tra: bỏ kết quả của kho cũ
      // Chưa có kệ nguồn, hoặc chưa chọn hàng: mã kệ vừa quét là kệ nguồn (đổi kệ nguồn)
      if (!moiNhat.current.nguon || moiNhat.current.tong <= 0) datNguon(ke);
      else chonDich(ke);
    } catch (e) {
      baoLoi();
      const khongThay = e?.response?.status === 404;
      setPhanHoi({
        kieu: "loi",
        chu: khongThay && ng
          ? t("Mã {{ma}} không có trên kệ {{ke}} và không phải mã kệ của kho.", { ma: m, ke: ng.maViTri })
          : khongThay
            ? t("Không tìm thấy mã {{ma}}: không phải mã kệ hay mã hàng.", { ma: m })
            : getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")),
      });
    } finally {
      veOQuet();
    }
  };

  // ── Xác nhận ──
  const coCho = tong - conLai;
  const duocGui = Boolean(nguon) && tong > 0 && conLai === 0 && !dangGui;
  /**
   * Chốt lượt chuyển. `chiPhanCoCho`: kho không đủ chỗ cho cả giỏ, chuyển phần đã có kệ đích trước (phần còn lại vẫn chọn
   * ở kệ nguồn). Xong: kệ nguồn còn hàng lấy được thì giữ nguyên để chuyển tiếp; không thì về màn mở đầu.
   */
  const xacNhan = (chiPhanCoCho = false) => {
    // Lần gửi trước chưa rõ kết quả: chỉ "Gửi lại" đúng nội dung đó (gửi nội dung khác sẽ ra khóa khác, có thể chuyển đôi)
    if (dangGui || chuaRo || !nguon || tong <= 0 || (chiPhanCoCho ? coCho <= 0 : conLai !== 0)) return;
    const phanCo = phan.filter((p) => p.nhan > 0);
    const dong = taoDongGui(dsChon, phanCo);
    const coVuotGui = phanCo.some((p) => p.vuot && p.nhan > conTrongCua(p.ke));
    const ghi = ghepGhiChu(lyDo, ghiChu);
    const keNguon = nguon;
    const yeuCau = { keNguonId: keNguon.id, dong, ghiChu: ghi, vuotSucChua: coVuotGui || undefined };
    // Cùng nội dung → cùng khóa (bấm lại sau lỗi không chuyển hai lần); đổi nội dung → khóa mới
    const noiDung = JSON.stringify(yeuCau);
    if (khoaLenhRef.current?.noiDung !== noiDung) khoaLenhRef.current = { noiDung, khoa: taoKhoaLenh() };
    const theoLo = Object.fromEntries(keNguon.dong.map((d) => [d.loHangId, d]));
    const keTheoId = Object.fromEntries(phanCo.map((p) => [p.ke.id, p.ke]));
    // Mọi thứ cần sau khi gửi nằm trong `goi` (không đọc giỏ hiện tại): gửi lại sau khi tải trang vẫn dựng đúng biên nhận
    return gui({
      khoId,
      yeuCau,
      khoa: khoaLenhRef.current.khoa,
      chiPhanCoCho,
      tu: keNguon.maViTri,
      keNguonId: keNguon.id,
      lyDo: ghi,
      tong: chiPhanCoCho ? coCho : tong,
      chuaChuyen: chiPhanCoCho ? tong - coCho : 0,
      conChon: chiPhanCoCho ? conLaiTheoLo(dsChon, dong) : {},
      baoTriNguon: keNguon.khoa === "BAO_TRI" || keNguon.trangThai === "BAO_TRI",
      nhom: gomTheoKeDich(dong).map((g) => ({
        ...g,
        ma: keTheoId[g.keDichId]?.maViTri,
        truoc: keTheoId[g.keDichId]?.dangChua ?? 0,
        suc: keTheoId[g.keDichId]?.sucChua ?? null,
        dong: g.dong.map((d) => ({ ...d, ten: tenLo(theoLo[d.loHangId]), maLo: theoLo[d.loHangId]?.maLo })),
      })),
      luc: Date.now(),
    });
  };

  /** Gửi một lượt đã chốt nội dung (`goi` từ xacNhan, hoặc lần gửi chưa rõ kết quả để gửi lại cùng khóa). */
  const gui = async (goi) => {
    if (dangGui) return;
    const { khoId: khoGui, chiPhanCoCho } = goi;
    // Ghi trước khi chờ: tải lại trang lúc đang chờ vẫn còn đúng nội dung và khóa để gửi lại
    ghiDangGui(khoGui, goi);
    setDangGui(true);
    setChuaRo(null);
    dongBoKho();
    try {
      const kq = await xacNhanChuyenKe(khoGui, goi.yeuCau, goi.khoa);
      playScanBeep(true);
      khoaLenhRef.current = null;
      ghiDangGui(khoGui, null);
      ghiLuotDo(khoGui, null);
      // Gửi lại sau khi tải trang: lượt dở đã lưu chính là lượt vừa chuyển, không hỏi làm tiếp nữa
      if (moiNhat.current.khoId === khoGui) setLuotDo(null);
      const ketQuaMoi = { ...kq, tu: goi.tu, lyDo: goi.lyDo, luc: new Date().toISOString(), nhom: goi.nhom, conLai: 0, baoTriTrong: false };
      taiLaiDsKe?.();
      // Kệ nguồn sau khi chuyển: còn hàng lấy được thì giữ (kèm phần chưa có chỗ nếu chỉ chuyển một phần)
      let keSau = null;
      try {
        keSau = await traKe(khoGui, goi.tu);
      } catch {
        // Không tra lại được: coi như xong lượt, quét lại kệ nếu cần
      }
      if (moiNhat.current.khoId !== khoGui) return;
      // Trong lúc gửi người dùng đã đổi / bỏ kệ nguồn (hoặc gửi lại sau khi tải trang): chỉ hiện biên nhận, không mở lại kệ
      if (moiNhat.current.nguon?.id !== goi.keNguonId) {
        setKetQua(ketQuaMoi);
        return;
      }
      const khaDungSau = (keSau?.dong ?? []).reduce((tg, d) => tg + (d.khoaKiemKe ? 0 : Math.max(0, d.khaDung)), 0);
      if (keSau && !lyDoKhongDung(keSau, "nguon") && khaDungSau > 0) {
        const conChon = goi.conChon ?? {};
        const chonMoi = {};
        for (const d of keSau.dong) {
          const so = Math.min(conChon[d.loHangId] ?? 0, d.khoaKiemKe ? 0 : d.khaDung);
          if (so > 0) chonMoi[d.loHangId] = String(so);
        }
        setNguon(keSau);
        setChon(chonMoi);
        setLoiDong({});
        setNoiBat(null);
        setDsDich([]);
        setThieuCho(null);
        if (!chiPhanCoCho) {
          setLyDo(null);
          setGhiChu("");
        }
        ketQuaMoi.conLai = khaDungSau;
        // Cùng kệ nguồn, cùng mã hàng: khóa gợi ý không đổi nên phải tự tải lại (kệ vừa cất có thể đã đầy)
        goiYQ.reload?.();
        setPhanHoi(null);
        veOQuet();
      } else {
        // Chỉ chuyển một phần mà không mở lại được kệ nguồn: báo phần chưa chuyển để quét lại
        if (chiPhanCoCho) ketQuaMoi.chuaChuyen = goi.chuaChuyen;
        ketQuaMoi.baoTriTrong = Boolean(goi.baoTriNguon) && keSau != null && (keSau.dangChua ?? 0) === 0;
        setPhanHoi(null);
        lamMoi();
      }
      setKetQua(ketQuaMoi);
    } catch (e) {
      baoLoi();
      // Mất mạng, hết giờ chờ, cổng báo lỗi: chưa biết máy chủ đã chuyển chưa. Giữ lần gửi (đã lưu) để gửi lại đúng nội
      // dung, đúng khóa; không tải lại, không kẹp số
      if (chuaRoKetQua(e)) {
        if (moiNhat.current.khoId === khoGui) setChuaRo(goi);
        return;
      }
      // Máy chủ đã trả lời là không chuyển: bỏ lần gửi đã lưu
      ghiDangGui(khoGui, null);
      toast.error(getApiErrorMessage(e, t("Không chuyển được kệ. Thử lại.")));
      // Số trên kệ / sức chứa kệ đích có thể đã đổi: tải lại kệ nguồn (kẹp số đã chọn theo khả dụng mới) và các kệ đích
      // (chỉ bỏ kệ đã khóa / hết chỗ, giữ kệ còn dùng được)
      try {
        const [moi, dsMoi] = await Promise.all([traKe(khoGui, goi.tu), layDsKe(khoGui).catch(() => null)]);
        if (moiNhat.current.khoId !== khoGui || moiNhat.current.nguon?.id !== goi.keNguonId) return;
        if (lyDoKhongDung(moi, "nguon")) {
          lamMoi();
          setPhanHoi({ kieu: "loi", chu: moi.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: moi.maViTri }) });
          return;
        }
        const kep = {};
        const loiMoi = {};
        const chonHienTai = moiNhat.current.chon;
        for (const d of moi.dong ?? []) {
          const so = soNguyen(chonHienTai[d.loHangId]);
          if (!so) continue;
          const toiDa = d.khoaKiemKe ? 0 : d.khaDung;
          kep[d.loHangId] = String(Math.min(so, toiDa));
          if (so > toiDa) loiMoi[d.loHangId] = t("Số lượng khả dụng tại kệ chỉ còn {{x}}.", { x: soVN(toiDa) });
        }
        setNguon(moi);
        setChon(kep);
        setLoiDong(loiMoi);
        setThieuCho(null);
        if (dsMoi) {
          const { dsDich: giu, bo } = capNhatKeDich(moiNhat.current.dsDich, dsMoi);
          setDsDich(giu);
          dsKeQ.setData?.(() => dsMoi);
          const daDoi = bo.length > 0 || giu.some((d) => d.vuaDoi) || Object.keys(loiMoi).length > 0;
          // Lỗi không do số liệu (mạng, quyền…): thông báo của máy chủ đã hiện, không báo nhầm "số vừa thay đổi"
          setPhanHoi(
            !daDoi
              ? null
              : {
                  kieu: "canhBao",
                  chu: bo.length
                    ? t("Số trên kệ vừa thay đổi. Đã bỏ kệ {{ds}} (đã khóa hoặc hết chỗ): giữ hàng trên xe, chưa đặt lên các kệ này. Kiểm tra lại rồi xác nhận.", { ds: bo.join(", ") })
                    : t("Số trên kệ vừa thay đổi. Kiểm tra lại số lượng và kệ đích rồi xác nhận."),
                },
          );
        } else {
          setDsDich([]);
          setPhanHoi({ kieu: "thongTin", chu: t("Số trên kệ vừa được tải lại. Kiểm tra số lượng rồi quét lại kệ đích.") });
        }
        veOQuet();
      } catch {
        // giữ nguyên kệ đang hiện
      }
    } finally {
      setDangGui(false);
    }
  };

  /** Mở lại lượt đang dở đã lưu: tra lại kệ nguồn và kệ đích, kẹp số theo khả dụng mới, bỏ kệ đích đã khóa / hết chỗ. */
  const lamTiep = async () => {
    const luu = luotDo;
    setLuotDo(null);
    if (!luu || khoId == null) return;
    const khoLuc = khoId;
    // Khóa ô quét suốt lúc mở lại (tra cả kệ đích): quét xen vào sẽ bị ghi đè khi lượt cũ dựng xong
    dongBoKho();
    setDangTra(true);
    try {
      const ke = await traKe(khoLuc, luu.ma);
      if (moiNhat.current.khoId !== khoLuc) return;
      if (!datNguon(ke)) {
        ghiLuotDo(khoLuc, null);
        return;
      }
      const chonMoi = {};
      for (const d of ke.dong ?? []) {
        const so = Math.min(soNguyen(luu.chon?.[d.loHangId]), d.khoaKiemKe ? 0 : d.khaDung);
        if (so > 0) chonMoi[d.loHangId] = String(so);
      }
      setChon(chonMoi);
      const giu = [];
      const bo = [];
      for (const d of luu.dich ?? []) {
        try {
          const k = await traKe(khoLuc, d.ma);
          if (k.id === ke.id || lyDoKhongDung(k, "dich") || (!d.vuot && conTrongCua(k) <= 0)) bo.push(d.ma);
          else giu.push(d.vuot ? { ke: k, vuot: true, toiDa: d.toiDa ?? undefined } : { ke: k });
        } catch {
          bo.push(d.ma);
        }
      }
      if (moiNhat.current.khoId !== khoLuc || moiNhat.current.nguon?.id !== ke.id) return;
      setDsDich(giu);
      setLyDo(luu.lyDo ?? null);
      setGhiChu(luu.ghiChu ?? "");
      setPhanHoi(
        bo.length
          ? { kieu: "canhBao", chu: t("Đã mở lại lượt đang dở ở kệ {{ma}}. Đã bỏ kệ {{ds}} (đã khóa hoặc hết chỗ).", { ma: ke.maViTri, ds: bo.join(", ") }) }
          : { kieu: "ok", chu: t("Đã mở lại lượt đang dở ở kệ {{ma}}. Kiểm tra lại rồi xác nhận.", { ma: ke.maViTri }) },
      );
    } catch (e) {
      baoLoi();
      ghiLuotDo(khoLuc, null);
      setPhanHoi({ kieu: "loi", chu: getApiErrorMessage(e, t("Không mở lại được lượt đang dở. Quét lại kệ nguồn.")) });
    } finally {
      setDangTra(false);
      veOQuet();
    }
  };

  /** Bỏ lần gửi chưa rõ kết quả (người dùng đã xem Lịch sử): xóa bản lưu, cho xác nhận lượt khác. */
  const boDangGui = () => {
    ghiDangGui(khoId, null);
    setChuaRo(null);
    khoaLenhRef.current = null;
    veOQuet();
  };

  // Lần gửi chưa rõ kết quả: hiện ở cả màn mở đầu (sau khi tải lại trang) lẫn trong lượt đang làm. Nút Xác nhận khóa tới
  // khi gửi lại hoặc bỏ, vì gửi nội dung khác sẽ ra khóa khác
  const khoiChuaRo = chuaRo ? (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-bo-warning-soft px-3 py-2.5 text-[13px] text-amber-900" role="alert">
      <WifiOff className="size-4 shrink-0 text-bo-warning" aria-hidden="true" />
      <span className="mr-auto min-w-0">
        <b className="font-semibold">{t("Chưa rõ đã chuyển chưa")}</b>{" "}
        {t("Lượt chuyển {{so}} sản phẩm từ kệ {{ma}} bị ngắt kết nối lúc gửi. Gửi lại an toàn: cùng mã lượt nên không tạo phiếu thứ hai.", {
          so: soVN(chuaRo.tong ?? 0),
          ma: chuaRo.tu,
          count: chuaRo.tong ?? 0,
        })}
      </span>
      <Button
        variant="outline"
        onClick={() => navigate(`/warehouse/bin-moves/history?khoId=${khoId}`)}
        className="h-8 gap-1.5 border-bo-border bg-white px-2.5 text-[13px] text-bo-foreground hover:bg-slate-50"
      >
        <History className="size-3.5" aria-hidden="true" />
        {t("Kiểm tra lịch sử")}
      </Button>
      <Button
        variant="outline"
        onClick={boDangGui}
        disabled={dangGui}
        title={t("Chỉ bỏ khi Lịch sử đã có phiếu của lượt này, hoặc bạn chắc hàng chưa chuyển.")}
        className="h-8 border-bo-border bg-white px-2.5 text-[13px] text-bo-foreground hover:bg-slate-50"
      >
        {t("Bỏ lần gửi")}
      </Button>
      <Button onClick={() => gui(chuaRo)} disabled={dangGui} className="h-8 gap-1.5 bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover">
        {t("Gửi lại")}
      </Button>
    </div>
  ) : null;

  // Kệ vừa đổi số trong lượt vừa chuyển (đánh dấu trên sơ đồ màn mở đầu tới lượt sau)
  const doiTheoKe = useMemo(() => {
    if (!ketQua) return null;
    const d = { [ketQua.tu]: -ketQua.tongSoLuong };
    for (const g of ketQua.nhom) if (g.ma) d[g.ma] = (d[g.ma] ?? 0) + g.tong;
    return d;
  }, [ketQua]);

  const goiYO = !nguon
    ? t("Quét hoặc nhập mã kệ cần lấy hàng, VD: A-01-02")
    : tong <= 0
      ? t("Quét mã hàng để cộng 1, hoặc quét kệ khác để đổi kệ nguồn")
      : conLai > 0
        ? t("Quét mã hàng để cộng 1, hoặc quét mã kệ đích")
        : t("Quét thêm mã hàng, hoặc bấm Xác nhận chuyển kệ");
  const khongCoKho = !kho.dangTai && !kho.loi && kho.dsKho.length === 0;

  return (
    <PageContainer fill className="gap-4">
      <ListPageHeader
        title={t("Chuyển kệ nội bộ")}
        actions={
          <>
            {kho.dsKho.length > 1 ? <ChonKhoKiemKe dsKho={kho.dsKho} value={khoId} onChange={kho.doiKho} className="w-full sm:w-[220px]" /> : null}
            <Button variant="outline" onClick={() => navigate(`/warehouse/bin-moves/history${khoId ? `?khoId=${khoId}` : ""}`)} className={NUT_PHU}>
              <History className="size-4" />
              {t("Lịch sử chuyển kệ")}
            </Button>
          </>
        }
      />

      {kho.loi ? (
        <div className={THE}>
          <ErrorState title={t("Không tải được danh sách kho")} description={getApiErrorMessage(kho.loi, t("Lỗi kết nối"))} onRetry={kho.taiLai} />
        </div>
      ) : khongCoKho ? (
        <div className={THE}>
          <EmptyState icon={Warehouse} title={laQtv ? t("Chưa có kho giao dịch nào") : t("Bạn chưa được phân kho nào")} description={t("Nhờ quản trị viên phân kho để chuyển hàng giữa các kệ.")} />
        </div>
      ) : (
        <>
          {ketQua ? (
            <BienNhanChuyenKe
              ketQua={ketQua}
              coViTriKho={coViTriKho}
              onXemPhieu={() => navigate(`/warehouse/bin-moves/history?khoId=${khoId}&tim=${encodeURIComponent(ketQua.maPhieu)}`)}
              onDong={() => {
                setKetQua(null);
                veOQuet();
              }}
            />
          ) : null}

          <ThanhQuet
            ref={oQuetRef}
            giaTri={ma}
            onDoi={setMa}
            onQuet={quet}
            goiY={goiYO}
            buoc={buoc}
            phanHoi={phanHoi}
            lan={lan}
            ban={dangTra || dangGui}
            onQuetKhiBan={baoLoi}
            khoa={khoId == null}
            dsKe={dsKe}
            ganDay={keGanDay}
            vaiTro={buoc >= 2 ? "dich" : "nguon"}
            keNguonId={nguon?.id}
            can={buoc >= 2 ? conLai : 0}
          />

          {nguon ? (
            // Một khối cho cả lượt chuyển: Kệ nguồn | Kệ đích, sơ đồ kệ đích (nếu chọn), chân khối tiến độ + lý do + xác nhận
            // (dính đáy khi dài, kể cả lúc cuộn sơ đồ)
            <section className={THE} aria-label={t("Lượt chuyển kệ")}>
              <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
                <CotTuKe
                  ke={nguon}
                  chon={chon}
                  loiDong={loiDong}
                  noiBat={noiBat}
                  onDatSo={datSo}
                  onXong={veOQuet}
                  onChonTatCa={() => chonTatCa()}
                  onBoChon={() => {
                    setChon({});
                    setLoiDong({});
                    setPhanHoi(null);
                    veOQuet();
                  }}
                  onDoiKe={() => {
                    lamMoi();
                    ghiLuotDo(khoId, null);
                    khoaLenhRef.current = null;
                    setPhanHoi(null);
                    taiLaiDsKe?.();
                  }}
                />
                <CotSangKe
                  coNguon
                  tong={tong}
                  conLai={conLai}
                  phan={phan}
                  loTheoKe={loTheoKe}
                  tenMa={tenMa}
                  soMa={tenMa.size}
                  goiY={goiY}
                  // Còn trong khoảng chờ 300ms hoặc đang tải: hiện "đang tải", không báo nhầm "không còn kệ nào trống"
                  dangTaiGoiY={coGoiY && (khoaGoiY !== khoaGoiYMoi || !goiYQ.dungKhoa || goiYQ.loading)}
                  thieuCho={thieuCho}
                  duocVuot={duocVuot}
                  ban={dangTra || dangGui}
                  cheDoXem={cheDoDich}
                  onCheDoXem={(m) => {
                    setCheDoDich(m);
                    try {
                      localStorage.setItem(KHOA_CHE_DO_DICH, m);
                    } catch {
                      // Không lưu được: lần sau về mặc định Gợi ý
                    }
                  }}
                  onChonGoiY={chonGoiY}
                  onBoDich={boDich}
                  onTach={() => themDich(thieuCho.ke)}
                  onDoiKe={() => {
                    setPhanHoi({ kieu: "thongTin", chu: t("Quét vị trí kệ mới có sức chứa từ {{so}} trở lên.", { so: soVN(thieuCho?.can ?? conLai) }) });
                    setThieuCho(null);
                    veOQuet();
                  }}
                  onVuot={() => themDich(thieuCho.ke, thieuCho.can)}
                  className="border-t border-bo-border xl:border-l xl:border-t-0"
                />
              </div>
              {cheDoDich === "so-do" && tong > 0 ? (
                <SoDoKeDich
                  key={khoId}
                  ds={dsKe}
                  keNguonId={nguon.id}
                  can={conLai}
                  goiY={goiY}
                  phan={phan}
                  ban={dangTra || dangGui}
                  capNhatLuc={dsKeQ.capNhatLuc}
                  dangTai={dsKeQ.loading}
                  onTaiLai={taiLaiDsKe}
                  onChon={(ke) => chonGoiY(ke.maViTri)}
                  onVeOQuet={veOQuet}
                />
              ) : null}
              {chuaRo ? <div className="mx-4 mb-3 mt-1">{khoiChuaRo}</div> : null}
              <ThanhXacNhan
                tong={tong}
                coCho={coCho}
                san={duocGui && !chuaRo}
                dangGui={dangGui}
                coVuot={coVuot}
                lyDo={lyDo}
                onLyDo={setLyDo}
                ghiChu={ghiChu}
                onGhiChu={setGhiChu}
                onDongLyDo={veOQuet}
                onXacNhan={() => xacNhan()}
                onChuyenPhan={chuaRo ? undefined : () => xacNhan(true)}
              />
            </section>
          ) : (
            <>
            {chuaRo ? khoiChuaRo : null}
            {luotDo && !chuaRo ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bo-primary/30 bg-bo-primary-soft/50 px-4 py-2.5 text-[13px]" role="status">
                <History className="size-4 shrink-0 text-bo-primary" aria-hidden="true" />
                <span className="mr-auto min-w-0">
                  {t("Lượt chuyển đang dở ở kệ {{ma}}: đã chọn {{so}} sản phẩm, {{soKe}} kệ đích. Mở lại để làm tiếp?", {
                    ma: luotDo.ma,
                    so: soVN(luotDo.tong ?? 0),
                    soKe: soVN(luotDo.dich?.length ?? 0),
                    count: luotDo.tong ?? 0,
                  })}
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    ghiLuotDo(khoId, null);
                    setLuotDo(null);
                    veOQuet();
                  }}
                  className="h-8 border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-slate-50"
                >
                  {t("Bỏ lượt này")}
                </Button>
                <Button onClick={lamTiep} disabled={dangTra} className="h-8 bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover">
                  {t("Làm tiếp")}
                </Button>
              </div>
            ) : null}
            <TheSoDoNguon
              key={khoId}
              khoId={khoId}
              onVeOQuet={veOQuet}
              q={ma}
              ds={dsKe}
              dangTai={dsKeQ.loading}
              // Đổi kho: dữ liệu kho cũ không dùng được, coi như tải lần đầu (không báo nhầm "chưa có kệ")
              lanDau={dsKeQ.initialLoading || (dsKeQ.loading && !dsKeQ.dungKhoa)}
              loi={dsKeQ.error}
              capNhatLuc={dsKeQ.capNhatLuc}
              onTaiLai={taiLaiDsKe}
              doi={doiTheoKe}
              ban={dangTra || dangGui}
              coViTriKho={coViTriKho}
              onChonKe={(ke) => (hangTim ? moKe(ke.maViTri, { loai: "hang", bienTheId: hangTim.bienTheId, loHangId: hangTim.loHangId }) : moKe(ke.maViTri))}
              onXuLy={(x) => moKe(x.ke.maViTri, x)}
              hangTim={hangTim}
              onBoHangTim={() => {
                setHangTim(null);
                setPhanHoi(null);
                veOQuet();
              }}
            />
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}
