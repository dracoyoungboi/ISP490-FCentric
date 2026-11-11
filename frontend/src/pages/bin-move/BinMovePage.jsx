// src/pages/bin-move/BinMovePage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCheck, History, Loader2, MapPin, PackageSearch, Warehouse } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { NUT_CHINH, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import ChonKhoKiemKe from "@/components/kiem-ke/ChonKhoKiemKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import OQuet from "@/components/chuyen-ke/OQuet";
import HopKhongDuSucChua from "@/components/chuyen-ke/HopKhongDuSucChua";
import { DauKe, DongLo } from "@/components/chuyen-ke/TheKe";
import {
  conTrongCua,
  dongDaChon,
  dongTheoMaQuet,
  lyDoKhongDung,
  phanBoKeDich,
  soNguyen,
  taoDongGui,
  tongSoLuong,
} from "@/components/chuyen-ke/chuyenKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { layDsKe, traKe, xacNhanChuyenKe } from "@/services/chuyenKeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { playScanBeep } from "@/utils/scanBeep";
import { t } from "@/i18n";

const TOI_DA_GHI_CHU = 255;

/** Báo lỗi bằng tiếng bíp trầm và rung (máy quét cầm tay / điện thoại), BA A1, A4. */
function baoLoi() {
  playScanBeep(false);
  try {
    navigator.vibrate?.(200);
  } catch {
    // Trình duyệt không cho rung: bỏ qua
  }
}

/** Số thứ tự bước trong đầu thẻ. */
function DauThe({ so, tieuDe, phu, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bo-border px-4 py-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">{so}</span>
      <h2 className="text-[15px] font-semibold text-bo-heading">{tieuDe}</h2>
      {phu ? <span className="text-[13px] text-bo-muted">{phu}</span> : null}
      {children ? <span className="ml-auto flex items-center gap-2">{children}</span> : null}
    </div>
  );
}

/**
 * Chuyển kệ nội bộ (/warehouse/bin-moves, UC-7.4 Scan-to-Move): đổi chỗ hàng giữa các kệ của một kho, tồn kho không
 * đổi. Bước 1 quét kệ nguồn, chọn lô và số lượng (quét mã SKU / lô để cộng 1, hoặc "Chuyển toàn bộ kệ"); bước 2 quét kệ
 * đích — kệ không đủ chỗ thì hỏi tách cất nhiều kệ hay đổi kệ (A3); bước 3 ghi chú rồi xác nhận, máy chủ ghi một phiếu
 * MV-YYYYMMDD-XXXX trong một giao dịch.
 */
export default function BinMovePage() {
  const navigate = useNavigate();
  const kho = useKhoKiemKe();
  const khoId = kho.khoId;
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const duocVuot = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);

  const taiDsKe = useCallback(() => layDsKe(khoId), [khoId]);
  const dsKeQ = useTaiDuLieu(taiDsKe, `chuyen-ke-ds-ke-${khoId}`, { enabled: khoId != null });
  const goiYKe = useMemo(
    () => (dsKeQ.dungKhoa && Array.isArray(dsKeQ.data) ? dsKeQ.data : []).map((k) => ({ value: k.maViTri, nhan: k.khuVuc ?? "" })),
    [dsKeQ.dungKhoa, dsKeQ.data],
  );

  const oNguonRef = useRef(null);
  const oHangRef = useRef(null);
  const oDichRef = useRef(null);

  const [maNguon, setMaNguon] = useState("");
  const [nguon, setNguon] = useState(null);
  const [phNguon, setPhNguon] = useState(null);
  const [maHang, setMaHang] = useState("");
  const [phHang, setPhHang] = useState(null);
  const [chon, setChon] = useState({});
  const [loiDong, setLoiDong] = useState({});
  const [dongNoiBat, setDongNoiBat] = useState(null);
  const [maDich, setMaDich] = useState("");
  const [dsDich, setDsDich] = useState([]);
  const [phDich, setPhDich] = useState(null);
  const [hopA3, setHopA3] = useState(null);
  const [ghiChu, setGhiChu] = useState("");
  const [dangTra, setDangTra] = useState(null);
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const [lan, setLan] = useState(0);

  const dsChon = useMemo(() => dongDaChon(nguon?.dong, chon), [nguon, chon]);
  const tong = tongSoLuong(dsChon);
  const { phan, conLai } = useMemo(() => phanBoKeDich(tong, dsDich), [tong, dsDich]);
  const coVuot = phan.some((p) => p.vuot && p.nhan > conTrongCua(p.ke));
  const duocGui = nguon && tong > 0 && conLai === 0 && !dangGui;
  // Số mới nhất cho các bước chạy sau khi chờ máy chủ (người dùng có thể đổi số lượng trong lúc tra kệ đích)
  const moiNhat = useRef({ tong, conLai, dsDich });
  moiNhat.current = { tong, conLai, dsDich };

  // Đổi số lượng sau khi đã có kệ đích: câu "đã đủ chỗ cho N" cũ không còn đúng
  useEffect(() => {
    setPhDich((ph) => (ph?.kieu === "ok" ? null : ph));
  }, [tong]);

  /** Bỏ cả lượt đang làm, về ô quét kệ nguồn. */
  const lamMoi = useCallback(() => {
    setMaNguon("");
    setNguon(null);
    setPhNguon(null);
    setMaHang("");
    setPhHang(null);
    setChon({});
    setLoiDong({});
    setMaDich("");
    setDsDich([]);
    setPhDich(null);
    setHopA3(null);
    setDongNoiBat(null);
    setGhiChu("");
    setTimeout(() => oNguonRef.current?.focus(), 0);
  }, []);

  // Đổi kho: lượt đang làm thuộc kho cũ
  useEffect(() => {
    lamMoi();
    setKetQua(null);
  }, [khoId, lamMoi]);

  /** Thao tác ghi theo kho: nhân viên đổi kho làm việc về kho đang xem trước (như các màn kho khác). */
  const dongBoKho = () => {
    if (!laQtv && khoId != null && getKhoLamViecId() !== khoId) setKhoLamViecId(khoId);
  };

  const tra = async (ma, vaiTro) => {
    dongBoKho();
    setDangTra(vaiTro);
    try {
      return await traKe(khoId, ma);
    } finally {
      setDangTra(null);
    }
  };

  // ── Bước 1: kệ nguồn ──
  const quetNguon = async (giaTri) => {
    const ma = String(giaTri ?? "").trim();
    setLan((x) => x + 1);
    if (!ma) return;
    try {
      const ke = await tra(ma, "nguon");
      setMaNguon("");
      if (lyDoKhongDung(ke, "nguon")) {
        baoLoi();
        setPhNguon({ kieu: "loi", chu: ke.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: ke.maViTri }) });
        return;
      }
      // Kệ không có gì chuyển được: giữ ô quét kệ nguồn để quét ngay kệ khác
      if (!(ke.dong ?? []).some((d) => d.khaDung > 0 && !d.khoaKiemKe)) {
        baoLoi();
        setPhNguon({
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
      setDsDich([]);
      setPhDich(null);
      setDongNoiBat(null);
      setPhNguon(null);
      setPhHang(null);
    } catch (e) {
      baoLoi();
      setPhNguon({ kieu: "loi", chu: getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")) });
      setMaNguon("");
    } finally {
      // Ô quét chỉ khóa đọc khi đang tra: đặt lại tiêu điểm cho lần quét tiếp
      setTimeout(() => (oHangRef.current ?? oNguonRef.current)?.focus(), 0);
    }
  };

  const boNguon = () => lamMoi();

  /** Đặt số lượng một lô; vượt khả dụng thì tự điền lại số tối đa và báo (A2). */
  const datSo = (dong, giaTri) => {
    const so = soNguyen(giaTri);
    const raw = String(giaTri ?? "");
    if (so > dong.khaDung) {
      setChon((c) => ({ ...c, [dong.loHangId]: String(dong.khaDung) }));
      setLoiDong((l) => ({
        ...l,
        [dong.loHangId]: dong.dangGiuNhat > 0
          ? t("Số lượng khả dụng tại kệ chỉ còn {{x}} (có {{y}} sản phẩm đang chờ nhặt theo đơn hàng).", {
              x: soVN(dong.khaDung),
              y: soVN(dong.dangGiuNhat),
            })
          : t("Số lượng khả dụng tại kệ chỉ còn {{x}}.", { x: soVN(dong.khaDung) }),
      }));
      baoLoi();
      return;
    }
    setChon((c) => ({ ...c, [dong.loHangId]: raw === "" ? "" : String(so) }));
    setLoiDong((l) => (l[dong.loHangId] ? { ...l, [dong.loHangId]: null } : l));
  };

  const quetHang = (giaTri) => {
    const ma = String(giaTri ?? "").trim();
    setLan((x) => x + 1);
    setMaHang("");
    if (!ma || !nguon) return;
    const dong = dongTheoMaQuet(nguon.dong, chon, ma);
    if (!dong) {
      baoLoi();
      setPhHang({ kieu: "loi", chu: t("Mã {{ma}} không có trên kệ {{ke}}.", { ma, ke: nguon.maViTri }) });
      return;
    }
    if (dong.khoaKiemKe || dong.khaDung <= 0) {
      baoLoi();
      setPhHang({ kieu: "loi", chu: dong.khoaKiemKe ? t("Lô {{lo}} đang kiểm kê ở kệ này, chưa chuyển được.", { lo: dong.maLo }) : t("Lô {{lo}} không còn số khả dụng để chuyển.", { lo: dong.maLo }) });
      return;
    }
    const daCo = soNguyen(chon[dong.loHangId]);
    if (daCo >= dong.khaDung) {
      datSo(dong, daCo + 1);
      setPhHang({ kieu: "canhBao", chu: t("Lô {{lo}} đã chọn hết số khả dụng ({{so}}).", { lo: dong.maLo, so: soVN(dong.khaDung) }) });
      return;
    }
    playScanBeep(true);
    datSo(dong, daCo + 1);
    setDongNoiBat(dong.loHangId);
    setPhHang({ kieu: "ok", chu: t("Lô {{lo}}: {{so}} sản phẩm", { lo: dong.maLo, so: soVN(daCo + 1), count: daCo + 1 }) });
  };

  /** A5: chọn toàn bộ số khả dụng của mọi lô trên kệ. */
  const chuyenToanBo = () => {
    const moi = {};
    for (const d of nguon?.dong ?? []) if (!d.khoaKiemKe && d.khaDung > 0) moi[d.loHangId] = String(d.khaDung);
    setChon(moi);
    setLoiDong({});
    const so = Object.values(moi).reduce((s, v) => s + Number(v), 0);
    setPhHang({ kieu: "thongTin", chu: t("Đã chọn toàn bộ {{so}} sản phẩm khả dụng trên kệ.", { so: soVN(so), count: so }) });
    setTimeout(() => oDichRef.current?.focus(), 0);
  };

  const boChon = () => {
    setChon({});
    setLoiDong({});
    setPhHang(null);
  };

  // ── Bước 2: kệ đích ──
  /** Thêm kệ đích; `toiDa`: quản lý kho cho cất vượt sức chứa đúng phần đang thiếu lúc duyệt (tăng số sau đó phải hỏi lại). */
  const themDich = (ke, toiDa) => {
    const { tong: tongMoi, dsDich: dsCu } = moiNhat.current;
    const muc = toiDa != null ? { ke, vuot: true, toiDa } : { ke };
    setDsDich((ds) => [...ds, muc]);
    const sau = phanBoKeDich(tongMoi, [...dsCu, muc]);
    setPhDich(
      sau.conLai > 0
        ? { kieu: "thongTin", chu: t("Còn {{so}} sản phẩm chưa có chỗ. Quét kệ đích tiếp theo.", { so: soVN(sau.conLai), count: sau.conLai }) }
        : { kieu: "ok", chu: t("Đã đủ chỗ cho {{so}} sản phẩm. Kiểm tra lại rồi xác nhận.", { so: soVN(tongMoi), count: tongMoi }) },
    );
  };

  const veODich = () => setTimeout(() => oDichRef.current?.focus(), 0);

  const quetDich = async (giaTri) => {
    const ma = String(giaTri ?? "").trim();
    setLan((x) => x + 1);
    setMaDich("");
    if (!ma || !nguon) return;
    if (tong <= 0) {
      baoLoi();
      setPhDich({ kieu: "loi", chu: t("Chọn lô và số lượng cần chuyển trước khi quét kệ đích.") });
      return;
    }
    // A4: kệ đích trùng kệ nguồn (so cả mã gõ khác hoa thường)
    if (ma.toLowerCase() === String(nguon.maViTri).toLowerCase()) {
      baoLoi();
      setPhDich({ kieu: "loi", chu: t("Kệ đích phải khác kệ nguồn.") });
      return;
    }
    if (conLai <= 0) {
      setPhDich({ kieu: "canhBao", chu: t("Đã đủ chỗ cho mọi sản phẩm. Bỏ bớt kệ đích nếu muốn cất sang kệ khác.") });
      return;
    }
    try {
      const ke = await tra(ma, "dich");
      // Người dùng có thể đã đổi số lượng trong lúc chờ: dùng số mới nhất
      const { conLai: conLaiMoi, dsDich: dsMoi } = moiNhat.current;
      if (ke.id === nguon.id) {
        baoLoi();
        setPhDich({ kieu: "loi", chu: t("Kệ đích phải khác kệ nguồn.") });
        return;
      }
      if (dsMoi.some((d) => d.ke.id === ke.id)) {
        baoLoi();
        setPhDich({ kieu: "canhBao", chu: t("Kệ {{ma}} đã có trong danh sách kệ đích.", { ma: ke.maViTri }) });
        return;
      }
      const lyDo = lyDoKhongDung(ke, "dich");
      if (lyDo) {
        baoLoi();
        setPhDich({
          kieu: "loi",
          chu: lyDo === "KHAC" ? t("Kệ {{ma}} không ở trạng thái nhận hàng. Chọn kệ khác.", { ma: ke.maViTri }) : ke.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: ke.maViTri }),
        });
        return;
      }
      if (conLaiMoi <= 0) {
        setPhDich({ kieu: "canhBao", chu: t("Đã đủ chỗ cho mọi sản phẩm. Bỏ bớt kệ đích nếu muốn cất sang kệ khác.") });
        return;
      }
      if (conTrongCua(ke) < conLaiMoi) {
        // A3: không đủ sức chứa — hỏi tách cất hay đổi kệ
        playScanBeep(false);
        setHopA3({ ke, can: conLaiMoi });
        return;
      }
      playScanBeep(true);
      themDich(ke);
    } catch (e) {
      baoLoi();
      setPhDich({ kieu: "loi", chu: getApiErrorMessage(e, t("Không tra được kệ. Thử lại.")) });
    } finally {
      veODich();
    }
  };

  const boDich = (id) => {
    setDsDich((ds) => ds.filter((d) => d.ke.id !== id));
    setPhDich(null);
    setTimeout(() => oDichRef.current?.focus(), 0);
  };

  const dongA3 = (ham) => {
    const hop = hopA3;
    setHopA3(null);
    ham?.(hop);
  };

  // ── Bước 3: xác nhận ──
  const xacNhan = async () => {
    if (!duocGui) return;
    const dong = taoDongGui(dsChon, phan.filter((p) => p.nhan > 0));
    setDangGui(true);
    dongBoKho();
    try {
      const kq = await xacNhanChuyenKe(khoId, { keNguonId: nguon.id, dong, ghiChu: ghiChu.trim() || null, vuotSucChua: coVuot || undefined });
      playScanBeep(true);
      setKetQua({ ...kq, tu: nguon.maViTri, den: phan.filter((p) => p.nhan > 0).map((p) => p.ke.maViTri) });
      lamMoi();
      dsKeQ.reload?.();
    } catch (e) {
      baoLoi();
      toast.error(getApiErrorMessage(e, t("Không chuyển được kệ. Thử lại.")));
      // Số trên kệ / sức chứa kệ đích có thể đã đổi (người khác nhặt, chuyển): tải lại kệ nguồn, kẹp số đã chọn theo
      // khả dụng mới (báo câu A2 ở dòng bị kẹp), bỏ các kệ đích để quét lại với sức chứa mới
      try {
        const moi = await traKe(khoId, nguon.maViTri);
        if (lyDoKhongDung(moi, "nguon")) {
          lamMoi();
          setPhNguon({ kieu: "loi", chu: moi.lyDoKhoa ?? t("Vị trí {{ma}} đang trong phiên kiểm kê định kỳ hoặc đang bảo dưỡng. Thao tác bị từ chối.", { ma: moi.maViTri }) });
          return;
        }
        const kep = {};
        const loiMoi = {};
        for (const d of moi.dong ?? []) {
          const so = soNguyen(chon[d.loHangId]);
          if (!so) continue;
          const toiDa = d.khoaKiemKe ? 0 : d.khaDung;
          kep[d.loHangId] = String(Math.min(so, toiDa));
          if (so > toiDa) loiMoi[d.loHangId] = t("Số lượng khả dụng tại kệ chỉ còn {{x}}.", { x: soVN(toiDa) });
        }
        setNguon(moi);
        setChon(kep);
        setLoiDong(loiMoi);
        setDsDich([]);
        setPhDich({ kieu: "thongTin", chu: t("Số trên kệ vừa được tải lại. Kiểm tra số lượng rồi quét lại kệ đích.") });
        veODich();
      } catch {
        // giữ nguyên kệ đang hiện
      }
    } finally {
      setDangGui(false);
    }
  };

  const lyDoChuaGui = !nguon
    ? t("Quét kệ nguồn để bắt đầu.")
    : tong <= 0
      ? t("Chọn lô và số lượng cần chuyển.")
      : conLai > 0
        ? t("Còn {{so}} sản phẩm chưa có kệ đích.", { so: soVN(conLai), count: conLai })
        : null;

  const khongCoKho = !kho.dangTai && !kho.loi && kho.dsKho.length === 0;

  return (
    <PageContainer className="space-y-4">
      <ListPageHeader
        title={t("Chuyển kệ nội bộ")}
        actions={
          <>
            {kho.dsKho.length > 1 ? <ChonKhoKiemKe dsKho={kho.dsKho} value={khoId} onChange={kho.doiKho} className="w-full sm:w-[220px]" /> : null}
            <Button variant="outline" onClick={() => navigate(`/warehouse/bin-moves/history${khoId ? `?khoId=${khoId}` : ""}`)} className="h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
              <History className="size-4" />
              {t("Lịch sử chuyển kệ")}
            </Button>
          </>
        }
      />

      {kho.loi ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <ErrorState title={t("Không tải được danh sách kho")} description={getApiErrorMessage(kho.loi, t("Lỗi kết nối"))} onRetry={kho.taiLai} />
        </div>
      ) : khongCoKho ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <EmptyState icon={Warehouse} title={laQtv ? t("Chưa có kho giao dịch nào") : t("Bạn chưa được phân kho nào")} description={t("Nhờ quản trị viên phân kho để chuyển hàng giữa các kệ.")} />
        </div>
      ) : (
        <>
          {ketQua ? (
            <DongThongBao
              tone="ok"
              actions={<NutChu onClick={() => navigate(`/warehouse/bin-moves/history?khoId=${khoId}&tim=${encodeURIComponent(ketQua.maPhieu)}`)}>{t("Xem phiếu")}</NutChu>}
            >
              {t("Phiếu {{ma}}: đã chuyển {{so}} sản phẩm từ {{tu}} sang {{den}}.", {
                ma: ketQua.maPhieu,
                so: soVN(ketQua.tongSoLuong),
                count: ketQua.tongSoLuong,
                tu: ketQua.tu,
                den: ketQua.den.join(", "),
              })}
            </DongThongBao>
          ) : null}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* ── Bước 1: kệ nguồn và hàng cần chuyển ── */}
            <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm" aria-labelledby="ck-nguon">
              <DauThe so={1} tieuDe={<span id="ck-nguon">{t("Kệ nguồn")}</span>} phu={nguon ? null : t("Quét mã kệ đang chứa hàng cần chuyển")} />
              <div className="grid gap-3 p-4">
                {nguon ? (
                  <DauKe ke={nguon} onBo={boNguon} nhanBo={t("Đổi kệ nguồn")} />
                ) : (
                  <OQuet
                    ref={oNguonRef}
                    id="ck-o-nguon"
                    nhan={t("Mã kệ nguồn")}
                    giaTri={maNguon}
                    onDoi={setMaNguon}
                    onQuet={quetNguon}
                    placeholder={t("Quét hoặc nhập mã kệ nguồn, VD: A-01-02")}
                    dsGoiY={goiYKe}
                    phanHoi={phNguon}
                    lan={lan}
                    khoa={khoId == null}
                    ban={dangTra === "nguon"}
                  />
                )}

                {nguon && nguon.dong?.length ? (
                  <>
                    <div className="flex flex-wrap items-start gap-2">
                      <OQuet
                        ref={oHangRef}
                        id="ck-o-hang"
                        nhan={t("Quét mã sản phẩm hoặc mã lô")}
                        giaTri={maHang}
                        onDoi={setMaHang}
                        onQuet={quetHang}
                        placeholder={t("Quét mã vạch, SKU hoặc mã lô để cộng 1")}
                        phanHoi={phHang}
                        lan={lan}
                        cao="h-10"
                        className="min-w-[220px] flex-1"
                      />
                      <Button variant="outline" onClick={chuyenToanBo} className="h-10 gap-2 border-bo-border bg-white" disabled={!nguon.dong.some((d) => d.khaDung > 0 && !d.khoaKiemKe)}>
                        <CheckCheck className="size-4" />
                        {t("Chuyển toàn bộ kệ")}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-bo-muted">
                      <span>{t("{{soLo}} lô trên kệ · lô cũ xếp trước", { count: nguon.dong.length, soLo: soVN(nguon.dong.length) })}</span>
                      {tong > 0 ? <NutChu onClick={boChon}>{t("Bỏ chọn")}</NutChu> : null}
                    </div>
                    <ul className="grid gap-2" aria-label={t("Hàng trên kệ nguồn")}>
                      {nguon.dong.map((d) => (
                        <DongLo
                          key={d.loHangId}
                          dong={d}
                          giaTri={chon[d.loHangId] ?? ""}
                          onDoi={(v) => datSo(d, v)}
                          loi={loiDong[d.loHangId]}
                          noiBat={dongNoiBat === d.loHangId}
                        />
                      ))}
                    </ul>
                  </>
                ) : nguon ? (
                  <EmptyState icon={PackageSearch} title={t("Kệ không có hàng")} description={t("Quét kệ khác để chuyển hàng.")} />
                ) : null}
              </div>
            </section>

            {/* ── Bước 2–3: kệ đích, ghi chú, xác nhận ── */}
            <div className="grid gap-4 lg:sticky lg:top-4">
              <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm" aria-labelledby="ck-dich">
                <DauThe so={2} tieuDe={<span id="ck-dich">{t("Kệ đích")}</span>}>
                  {tong > 0 ? (
                    <span className="text-[13px] tabular-nums text-bo-muted">
                      {t("Cần cất")} <b className="font-semibold text-bo-foreground">{soVN(tong)}</b>
                    </span>
                  ) : null}
                </DauThe>
                <div className="grid gap-3 p-4">
                  {phan.map((p) => (
                    <DauKe key={p.ke.id} ke={p.ke} them={p.nhan} onBo={() => boDich(p.ke.id)} nhanBo={t("Bỏ kệ đích {{ma}}", { ma: p.ke.maViTri })}>
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <MapPin className="size-4 text-bo-primary" aria-hidden="true" />
                        <span>
                          {p.nhan > 0 ? t("Cất {{so}} sản phẩm", { so: soVN(p.nhan), count: p.nhan }) : <span className="text-bo-muted">{t("Không cần dùng kệ này")}</span>}
                        </span>
                        {p.vuot && p.nhan > conTrongCua(p.ke) ? (
                          <span className="rounded-full border border-amber-200 bg-bo-warning-soft px-2 py-0.5 text-xs font-medium text-amber-800">{t("Vượt sức chứa")}</span>
                        ) : null}
                      </p>
                    </DauKe>
                  ))}

                  {nguon && (conLai > 0 || tong === 0) ? (
                    <OQuet
                      ref={oDichRef}
                      id="ck-o-dich"
                      nhan={t("Mã kệ đích")}
                      giaTri={maDich}
                      onDoi={setMaDich}
                      onQuet={quetDich}
                      placeholder={dsDich.length ? t("Quét kệ đích tiếp theo") : t("Quét hoặc nhập mã kệ đích, VD: B-03-01")}
                      dsGoiY={goiYKe.filter((g) => g.value !== nguon.maViTri && !dsDich.some((d) => d.ke.maViTri === g.value))}
                      phanHoi={phDich}
                      lan={lan}
                      khoa={tong <= 0}
                      ban={dangTra === "dich"}
                    />
                  ) : phDich ? (
                    <div role="status" aria-live="polite">
                      <p className={cn("text-[13px]", phDich.kieu === "ok" ? "text-bo-success" : "text-bo-muted")}>{phDich.chu}</p>
                    </div>
                  ) : null}

                  {!nguon ? (
                    <p className="text-[13px] text-bo-muted">{t("Quét kệ nguồn và chọn hàng trước.")}</p>
                  ) : conLai > 0 && phan.length ? (
                    <p className="text-[13px] font-medium text-bo-warning">{t("Còn {{so}} sản phẩm chưa có chỗ.", { so: soVN(conLai), count: conLai })}</p>
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm" aria-labelledby="ck-xac-nhan">
                <DauThe so={3} tieuDe={<span id="ck-xac-nhan">{t("Xác nhận")}</span>} />
                <div className="grid gap-3 p-4">
                  {nguon && tong > 0 && phan.some((p) => p.nhan > 0) ? (
                    <ul className="grid gap-1 text-[13px] text-bo-foreground">
                      {phan
                        .filter((p) => p.nhan > 0)
                        .map((p) => (
                          <li key={p.ke.id} className="flex items-center gap-2 tabular-nums">
                            <span className="font-mono">{nguon.maViTri}</span>
                            <ArrowRight className="size-3.5 text-bo-muted" aria-hidden="true" />
                            <span className="font-mono">{p.ke.maViTri}</span>
                            <span className="ml-auto font-semibold">{soVN(p.nhan)}</span>
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium text-bo-foreground">{t("Ghi chú")}</span>
                    <textarea
                      value={ghiChu}
                      maxLength={TOI_DA_GHI_CHU}
                      onChange={(e) => setGhiChu(e.target.value)}
                      rows={2}
                      placeholder={t("Lý do chuyển, VD: dồn kệ, đón hàng mới, bảo trì kệ")}
                      className={O_NHAP_NHIEU_DONG}
                    />
                    <span className="text-right text-xs tabular-nums text-bo-muted">
                      {ghiChu.length}/{TOI_DA_GHI_CHU}
                    </span>
                  </label>
                  <Button onClick={xacNhan} disabled={!duocGui} className={cn("h-11 w-full gap-2 text-[15px]", NUT_CHINH)}>
                    {dangGui ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                    {t("Xác nhận chuyển kệ ({{so}})", { so: soVN(tong) })}
                  </Button>
                  {lyDoChuaGui ? <p className="text-center text-xs text-bo-muted">{lyDoChuaGui}</p> : null}
                  {coVuot ? <p className="text-center text-xs text-amber-800">{t("Có kệ đích cất vượt sức chứa (quản lý kho cho phép).")}</p> : null}
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      <HopKhongDuSucChua
        mo={Boolean(hopA3)}
        ke={hopA3?.ke}
        can={hopA3?.can ?? 0}
        duocVuot={duocVuot}
        onTach={() => dongA3((h) => themDich(h.ke))}
        onDoi={() =>
          dongA3((h) => {
            setPhDich({ kieu: "thongTin", chu: t("Quét vị trí kệ mới có sức chứa từ {{so}} trở lên.", { so: soVN(h?.can ?? conLai) }) });
          })
        }
        onVuot={() => dongA3((h) => themDich(h.ke, h.can))}
        onDongXong={veODich}
      />
    </PageContainer>
  );
}
