// src/pages/bin-move/BinMovePage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, History, ScanBarcode, Warehouse } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import ChonKhoKiemKe from "@/components/kiem-ke/ChonKhoKiemKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import ThanhQuet from "@/components/chuyen-ke/ThanhQuet";
import CotTuKe from "@/components/chuyen-ke/CotTuKe";
import CotSangKe from "@/components/chuyen-ke/CotSangKe";
import ThanhXacNhan from "@/components/chuyen-ke/ThanhXacNhan";
import { hienGhiChu } from "@/components/chuyen-ke/nhanKe";
import {
  conTrongCua,
  dongDaChon,
  dongTheoMaQuet,
  ghepGhiChu,
  lyDoKhongDung,
  phanBoKeDich,
  soNguyen,
  taoDongGui,
  themKeGanDay,
  tongSoLuong,
} from "@/components/chuyen-ke/chuyenKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { formatDateTime } from "@/utils/dateTime";
import { goiYKeDich, layDsKe, layLichSuChuyenKe, traKe, xacNhanChuyenKe } from "@/services/chuyenKeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { playScanBeep } from "@/utils/scanBeep";
import { t, tDuLieu } from "@/i18n";

const TH = "h-10 pr-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
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
  const [moGhiChu, setMoGhiChu] = useState(false);
  const [ghiChu, setGhiChu] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const [keGanDay, setKeGanDay] = useState([]);

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

  // ── Dữ liệu phụ: mã kệ cho ô gõ tay, lượt chuyển gần đây, kệ gợi ý ──
  const taiDsKe = useCallback(() => layDsKe(khoId), [khoId]);
  const dsKeQ = useTaiDuLieu(taiDsKe, `chuyen-ke-ds-ke-${khoId}`, { enabled: khoId != null });
  const dsKe = useMemo(() => (dsKeQ.dungKhoa && Array.isArray(dsKeQ.data) ? dsKeQ.data : []), [dsKeQ.dungKhoa, dsKeQ.data]);
  const taiGanDay = useCallback(() => layLichSuChuyenKe(khoId, { kichThuoc: 4 }), [khoId]);
  const ganDayQ = useTaiDuLieu(taiGanDay, `chuyen-ke-gan-day-${khoId}`, { enabled: khoId != null });
  const luotGanDay = ganDayQ.dungKhoa ? ganDayQ.data?.ds ?? [] : [];

  // Gợi ý kệ: chỉ tải lại khi đổi kệ nguồn / tập mã hàng (không theo từng lần +1); "đủ chỗ" và thứ tự tính lại ở đây theo
  // số còn phải cất, cùng thứ tự máy chủ: cùng mã hàng → đủ chỗ → cùng khu → ít chỗ trống trước → mã kệ
  const bienTheIds = useMemo(() => [...new Set(dsChon.map((d) => d.bienTheId).filter(Boolean))].sort((a, b) => a - b).join(","), [dsChon]);
  const coGoiY = Boolean(nguon) && tong > 0 && conLai > 0;
  const khoaGoiY = useTre(nguon && bienTheIds ? `${khoId}|${nguon.id}|${bienTheIds}` : "", 300);
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
      .sort((a, b) => Number(b.cungMa) - Number(a.cungMa) || Number(b.duCho) - Number(a.duCho) || Number(b.cungKhu) - Number(a.cungKhu)
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
    setMoGhiChu(false);
    setGhiChu("");
    // Màn cảm ứng không tự đưa tiêu điểm vào ô quét (tránh bật bàn phím ảo)
    if (!document.documentElement.hasAttribute("data-cam-ung")) setTimeout(() => oQuetRef.current?.focus(), 0);
  }, []);

  // Đổi kho: lượt đang làm và kệ gần đây thuộc kho cũ
  useEffect(() => {
    lamMoi();
    setKetQua(null);
    setPhanHoi(null);
    setKeGanDay(khoId == null ? [] : docKeGanDay(khoId));
  }, [khoId, lamMoi]);

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
  const datNguon = (ke) => {
    if (lyDoKhongDung(ke, "nguon")) {
      baoLoi();
      setPhanHoi({ kieu: "loi", chu: ke.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: ke.maViTri }) });
      return;
    }
    if (!(ke.dong ?? []).some((d) => d.khaDung > 0 && !d.khoaKiemKe)) {
      baoLoi();
      setPhanHoi({
        kieu: "canhBao",
        chu: !ke.dong?.length
          ? t("Kệ {{ma}} không có hàng. Quét kệ khác.", { ma: ke.maViTri })
          : t("Hàng trên kệ {{ma}} đang chờ nhặt hoặc đang kiểm kê, chưa chuyển được.", { ma: ke.maViTri }),
      });
      return;
    }
    playScanBeep(true);
    setNguon(ke);
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

  const chonTatCa = () => {
    const moi = {};
    for (const d of nguon?.dong ?? []) if (!d.khoaKiemKe && d.khaDung > 0) moi[d.loHangId] = String(d.khaDung);
    const so = Object.values(moi).reduce((s, v) => s + Number(v), 0);
    setChon(moi);
    setLoiDong({});
    setPhanHoi({ kieu: "thongTin", chu: t("Đã chọn toàn bộ {{so}} sản phẩm khả dụng trên kệ.", { so: soVN(so), count: so }) });
    veOQuet();
  };

  // ── Kệ đích ──
  /** Thêm kệ đích; `toiDa`: quản lý kho cho cất vượt sức chứa đúng phần đang thiếu lúc duyệt. */
  const themDich = (ke, toiDa) => {
    const { tong: tongMoi, dsDich: dsCu } = moiNhat.current;
    const muc = toiDa != null ? { ke, vuot: true, toiDa } : { ke };
    setDsDich([...dsCu, muc]);
    setThieuCho(null);
    const sau = phanBoKeDich(tongMoi, [...dsCu, muc]);
    const coVuotMoi = sau.phan.some((p) => p.vuot && p.nhan > conTrongCua(p.ke));
    setPhanHoi(
      sau.conLai <= 0 && coVuotMoi
        ? { kieu: "canhBao", chu: t("Đã có chỗ cho {{so}} sản phẩm, có kệ cất vượt sức chứa. Kiểm tra lại rồi xác nhận.", { so: soVN(tongMoi), count: tongMoi }) }
        : sau.conLai > 0
        ? { kieu: "thongTin", chu: t("Còn {{so}} sản phẩm chưa có chỗ. Quét kệ đích tiếp theo.", { so: soVN(sau.conLai), count: sau.conLai }) }
        : { kieu: "ok", chu: t("Đã đủ chỗ cho {{so}} sản phẩm. Kiểm tra lại rồi xác nhận.", { so: soVN(tongMoi), count: tongMoi }) },
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
      setPhanHoi({ kieu: "canhBao", chu: t("Kệ {{ma}} chỉ còn {{conTrong}} chỗ cho {{can}} sản phẩm. Chọn cách xử lý ở cột Kệ đích.", { ma: ke.maViTri, conTrong: soVN(conTrongCua(ke)), can: soVN(cl) }) });
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
          : getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")),
      });
    } finally {
      veOQuet();
    }
  };

  // ── Xác nhận ──
  const duocGui = Boolean(nguon) && tong > 0 && conLai === 0 && !dangGui;
  const xacNhan = async () => {
    if (!duocGui) return;
    const phanCo = phan.filter((p) => p.nhan > 0);
    const dong = taoDongGui(dsChon, phanCo);
    setDangGui(true);
    dongBoKho();
    try {
      const kq = await xacNhanChuyenKe(khoId, { keNguonId: nguon.id, dong, ghiChu: ghepGhiChu(lyDo, ghiChu), vuotSucChua: coVuot || undefined });
      playScanBeep(true);
      const theoLo = Object.fromEntries(nguon.dong.map((d) => [d.loHangId, d]));
      const tenKe = Object.fromEntries(phanCo.map((p) => [p.ke.id, p.ke.maViTri]));
      setKetQua({
        ...kq,
        tu: nguon.maViTri,
        den: phanCo.map((p) => p.ke.maViTri),
        lyDo: ghepGhiChu(lyDo, ghiChu),
        dong: dong.map((d, i) => ({ ...d, i, lo: theoLo[d.loHangId], keDich: tenKe[d.keDichId] })),
        luc: new Date().toISOString(),
      });
      setPhanHoi(null);
      lamMoi();
      ganDayQ.reload?.();
      dsKeQ.reload?.();
    } catch (e) {
      baoLoi();
      toast.error(getApiErrorMessage(e, t("Không chuyển được kệ. Thử lại.")));
      // Số trên kệ / sức chứa kệ đích có thể đã đổi: tải lại kệ nguồn, kẹp số đã chọn theo khả dụng mới, bỏ các kệ đích
      try {
        const moi = await traKe(khoId, nguon.maViTri);
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
        setDsDich([]);
        setThieuCho(null);
        setPhanHoi({ kieu: "thongTin", chu: t("Số trên kệ vừa được tải lại. Kiểm tra số lượng rồi quét lại kệ đích.") });
        veOQuet();
      } catch {
        // giữ nguyên kệ đang hiện
      }
    } finally {
      setDangGui(false);
    }
  };

  const goiYO = !nguon
    ? t("Quét hoặc nhập mã kệ cần lấy hàng, VD: A-01-02")
    : tong <= 0
      ? t("Quét mã hàng để cộng 1, hoặc quét kệ khác để đổi kệ nguồn")
      : conLai > 0
        ? t("Quét mã hàng để cộng 1, hoặc quét mã kệ đích")
        : t("Quét thêm mã hàng, hoặc bấm Xác nhận chuyển kệ");
  const soLo = dsChon.length;
  const phanCo = phan.filter((p) => p.nhan > 0);
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
            <DongThongBao
              tone="ok"
              actions={<NutChu onClick={() => navigate(`/warehouse/bin-moves/history?khoId=${khoId}&tim=${encodeURIComponent(ketQua.maPhieu)}`)}>{t("Xem phiếu")}</NutChu>}
            >
              {t("Phiếu {{ma}}: đã chuyển {{so}} sản phẩm từ {{tu}} sang {{den}}. Tồn kho của kho không đổi.", {
                ma: ketQua.maPhieu,
                so: soVN(ketQua.tongSoLuong),
                count: ketQua.tongSoLuong,
                tu: ketQua.tu,
                den: ketQua.den.join(", "),
              })}
            </DongThongBao>
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
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
              <CotTuKe
                ke={nguon}
                chon={chon}
                loiDong={loiDong}
                noiBat={noiBat}
                onDatSo={datSo}
                onXong={veOQuet}
                onChonTatCa={chonTatCa}
                onBoChon={() => {
                  setChon({});
                  setLoiDong({});
                  setPhanHoi(null);
                  veOQuet();
                }}
                onDoiKe={() => {
                  lamMoi();
                  setPhanHoi(null);
                }}
              />
              <CotSangKe
                coNguon
                tong={tong}
                conLai={conLai}
                phan={phan}
                goiY={goiY}
                dangTaiGoiY={Boolean(khoaGoiY) && goiYQ.loading}
                thieuCho={thieuCho}
                duocVuot={duocVuot}
                ban={dangTra || dangGui}
                onChonGoiY={chonGoiY}
                onBoDich={boDich}
                onTach={() => themDich(thieuCho.ke)}
                onDoiKe={() => {
                  setPhanHoi({ kieu: "thongTin", chu: t("Quét vị trí kệ mới có sức chứa từ {{so}} trở lên.", { so: soVN(thieuCho?.can ?? conLai) }) });
                  setThieuCho(null);
                  veOQuet();
                }}
                onVuot={() => themDich(thieuCho.ke, thieuCho.can)}
              />
            </div>
          ) : (
            <>
              {ketQua ? <BienNhan ketQua={ketQua} /> : null}
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
                <section className={`${THE} grid place-items-center px-6 py-12 text-center`}>
                  <div className="grid max-w-md justify-items-center gap-2">
                    <span className="grid size-12 place-items-center rounded-full bg-bo-primary-soft text-bo-primary">
                      <ScanBarcode className="size-6" aria-hidden="true" />
                    </span>
                    <h2 className="text-base font-semibold text-bo-heading">{t("Quét mã kệ đang chứa hàng cần chuyển")}</h2>
                    <p className="text-sm text-bo-muted">{t("Hệ thống hiện hàng trên kệ theo lô và số được chuyển (đã trừ hàng đang chờ nhặt). Kệ đang kiểm kê sẽ bị từ chối.")}</p>
                    {keGanDay.length ? (
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[13px] text-bo-muted">{t("Kệ dùng gần đây:")}</span>
                        {keGanDay.map((k) => (
                          <button
                            key={k}
                            type="button"
                            disabled={dangTra}
                            onClick={() => quet(k)}
                            className="h-7 rounded-md border border-bo-border bg-white px-2.5 font-mono text-[13px] text-bo-foreground hover:bg-slate-50"
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
                <CotSangKe coNguon={false} tong={0} conLai={0} phan={[]} />
              </div>
              {luotGanDay.length ? (
                <section className={THE} aria-labelledby="ck-gan-day">
                  <div className="flex items-center justify-between border-b border-bo-border px-4 py-3">
                    <h2 id="ck-gan-day" className="text-sm font-semibold text-bo-heading">
                      {t("Lượt chuyển gần đây")}
                    </h2>
                    <NutChu onClick={() => navigate(`/warehouse/bin-moves/history?khoId=${khoId}`)}>{t("Xem tất cả")}</NutChu>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                          <th className={`${TH} w-[200px] pl-4 text-left`}>{t("Mã phiếu chuyển kệ")}</th>
                          <th className={`${TH} text-left`}>{t("Kệ nguồn → kệ đích")}</th>
                          <th className={`${TH} text-left`}>{t("Người thực hiện")}</th>
                          <th className={`${TH} w-24 text-right`}>{t("Số lượng")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {luotGanDay.map((p) => (
                          <tr key={p.id} className="border-b border-bo-border last:border-b-0 hover:bg-bo-surface-subtle">
                            <td className="py-2.5 pl-4 pr-4 font-mono text-[13px] text-bo-primary-strong">{p.maPhieu}</td>
                            <td className="py-2.5 pr-4">
                              <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[13px]">
                                {p.keNguon.join(", ")}
                                <ArrowRight className="size-3.5 text-slate-400" aria-hidden="true" />
                                {p.keDich.join(", ")}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-[13px] text-bo-muted">
                              {p.nguoiThucHien ? tDuLieu(p.nguoiThucHien) : "—"} · {formatDateTime(p.ngayThucHien)}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{soVN(p.tongSoLuong)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {nguon ? (
            <ThanhXacNhan
              tieuDe={
                tong > 0
                  ? `${t("{{so}} sản phẩm", { so: soVN(tong), count: tong })} · ${t("{{so}} lô", { so: soVN(soLo), count: soLo })}${
                      phanCo.length && conLai === 0 ? ` → ${t("{{so}} kệ", { so: soVN(phanCo.length), count: phanCo.length })}` : ""
                    }`
                  : t("Chưa chọn hàng")
              }
              phu={
                tong <= 0
                  ? t("Nhập số lượng ở bảng hoặc quét mã hàng.")
                  : conLai > 0
                    ? t("Còn {{so}} sản phẩm chưa có kệ đích.", { so: soVN(conLai), count: conLai })
                    : `${nguon.maViTri} → ${phanCo.map((p) => p.ke.maViTri).join(", ")}`
              }
              san={duocGui}
              dangGui={dangGui}
              lyDoMo={tong > 0}
              lyDo={lyDo}
              onLyDo={(x) => {
                setLyDo(x);
                veOQuet();
              }}
              moGhiChu={moGhiChu}
              onMoGhiChu={() => setMoGhiChu(true)}
              ghiChu={ghiChu}
              onGhiChu={setGhiChu}
              coVuot={coVuot}
              onXacNhan={xacNhan}
            />
          ) : null}
        </>
      )}
    </PageContainer>
  );
}

/** Biên nhận lượt vừa chuyển: từng lô sang kệ nào (hiện tới khi quét kệ nguồn cho lượt mới). */
function BienNhan({ ketQua }) {
  return (
    <section className={THE} aria-labelledby="ck-bien-nhan">
      <div className="border-b border-bo-border px-4 py-3">
        <h2 id="ck-bien-nhan" className="text-sm font-semibold text-bo-heading">
          {t("Chi tiết phiếu {{ma}}", { ma: ketQua.maPhieu })}
        </h2>
        <p className="text-[13px] text-bo-muted">
          {formatDateTime(ketQua.luc)}
          {ketQua.lyDo ? ` · ${hienGhiChu(ketQua.lyDo)}` : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-bo-border bg-bo-surface-subtle">
              <th className={`${TH} pl-4 text-left`}>{t("Sản phẩm")}</th>
              <th className={`${TH} text-left`}>{t("Lô")}</th>
              <th className={`${TH} text-left`}>{t("Kệ đích")}</th>
              <th className={`${TH} text-right`}>{t("Số lượng")}</th>
            </tr>
          </thead>
          <tbody>
            {ketQua.dong.map((d) => (
              <tr key={d.i} className="border-b border-bo-border last:border-b-0">
                <td className="py-2.5 pl-4 pr-4">
                  {d.lo?.tenSanPham ? tDuLieu(d.lo.tenSanPham) : d.lo?.maSku}
                  {d.lo?.mau || d.lo?.kichCo ? <span className="text-bo-muted"> · {[d.lo.mau, d.lo.kichCo].filter(Boolean).map((x) => tDuLieu(x)).join(" · ")}</span> : null}
                </td>
                <td className="py-2.5 pr-4 font-mono text-[13px]">{d.lo?.maLo}</td>
                <td className="py-2.5 pr-4 font-mono text-[13px] text-bo-primary-strong">{d.keDich}</td>
                <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{soVN(d.soLuong)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
