import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronsDownUp, ChevronsUpDown, FolderTree, Plus, RefreshCcw, SearchX } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import BangCayDanhMuc from "@/components/danh-muc/BangCayDanhMuc";
import DanhSachDiSau from "@/components/danh-muc/DanhSachDiSau";
import HopChuyenDanhMuc from "@/components/danh-muc/HopChuyenDanhMuc";
import HopDanhMuc from "@/components/danh-muc/HopDanhMuc";
import HopNgungHoatDong from "@/components/danh-muc/HopNgungHoatDong";
import LocTrangThai from "@/components/danh-muc/LocTrangThai";
import {
  LOC_MAC_DINH,
  LOC_TRANG_THAI,
  apDungCapNhat,
  chuanHoaChu,
  demSeHoatDongLai,
  demThongKe,
  dungCay,
  kiemTraChuyen,
  kiemTraPhanHoi,
  kiemTraSua,
  layCon,
  layConChau,
  layDongCap,
  layDuongDan,
  phangHoa,
  taoBodyCapNhat,
  taoDongHienThi,
  timPhang,
  tinhThaoTac,
  tinhTrangThai,
} from "@/components/danh-muc/cayDanhMuc";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Màn Danh mục (PA1 · cây dạng bảng, chốt 17/10/2026).
 * - Máy tính: bảng cây hàng 48px, thụt lề đều 24px có đường gióng; tìm không dấu, lọc trạng thái,
 *   một nút Mở tất cả / Thu gọn tất cả; xem riêng một nhánh (?nhanh=id); kéo thả để chuyển nhánh.
 * - Điện thoại (< 640px): bấm vào danh mục để vào cấp con (dùng chung ?nhanh=id), thao tác trong bảng trượt.
 * - Thêm / sửa / chuyển / đổi trạng thái: chỉ quản trị viên (khớp quyền ở backend). Người khác chỉ xem.
 * - Ngừng hoạt động theo nhánh: chỉ đổi trạng thái của chính danh mục, con ngừng theo nhưng giữ trạng thái riêng.
 */

const GIA_TRI_LOC = Object.values(LOC_TRANG_THAI);
const KHONG_TAI_DUOC = "Không tải được danh mục";

/** Theo dõi một media query (an toàn khi môi trường không có matchMedia). */
function useMediaQuery(query) {
  const [khop, setKhop] = useState(() => Boolean(window.matchMedia?.(query)?.matches));
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return undefined;
    const doi = () => setKhop(mql.matches);
    doi();
    mql.addEventListener("change", doi);
    return () => mql.removeEventListener("change", doi);
  }, [query]);
  return khop;
}

/**
 * `/all` trả đủ cả danh mục ngừng hoạt động. Lỗi thì lùi về cây `/get-cay-danh-muc` (chỉ có danh mục đang hoạt động).
 * Dữ liệu được chuẩn hóa thành danh sách phẳng để sửa tại chỗ ngay sau mỗi lần lưu.
 * `choLui = false` (đã có đủ dữ liệu): `/all` lỗi thì báo lỗi, không thay bảng bằng cây thiếu.
 */
async function taiDanhMuc({ choLui = true } = {}) {
  let loiAll;
  try {
    const phanHoi = await danhMucQuanAoService.getAll();
    if (phanHoi?.data?.status === 200 && Array.isArray(phanHoi.data.data)) {
      return { danhSach: phangHoa(phanHoi.data.data), chiHoatDong: false };
    }
    loiAll = new Error(phanHoi?.data?.message || KHONG_TAI_DUOC);
  } catch (err) {
    loiAll = err;
  }
  // Đang có đủ dữ liệu (cả danh mục ngừng) thì không lùi về cây thiếu: giữ bảng cũ và báo lỗi tải lại
  if (!choLui) throw loiAll;
  try {
    const phanHoi = await danhMucQuanAoService.getCayDanhMuc();
    if (phanHoi?.data?.status === 200 && Array.isArray(phanHoi.data.data)) {
      return { danhSach: phangHoa(phanHoi.data.data), chiHoatDong: true };
    }
  } catch {
    // Báo lỗi của `/all` (nguồn chính) cho người dùng
  }
  throw loiAll;
}

async function guiCapNhat(body) {
  return kiemTraPhanHoi(await danhMucQuanAoService.update(body));
}

export default function DanhMucQuanAoTree() {
  const coTheSua = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const laDienThoai = useMediaQuery("(max-width: 639px)");
  const [searchParams, setSearchParams] = useSearchParams();

  const thamSoLoc = searchParams.get("trangThai");
  // Không có ?trangThai= trên URL là bộ lọc mặc định (Đang hoạt động); chọn Tất cả thì ghi ?trangThai=tat-ca
  const loc = GIA_TRI_LOC.includes(thamSoLoc) ? thamSoLoc : LOC_MAC_DINH;
  const thamSoNhanh = searchParams.get("nhanh");

  const [tuKhoa, setTuKhoa] = useState("");
  const [moRong, setMoRong] = useState({});
  const [daMoLanDau, setDaMoLanDau] = useState(false);
  const [hop, setHop] = useState(null);
  const [keo, setKeo] = useState(null);
  const [dangBatLai, setDangBatLai] = useState(false);

  const daCoDayDu = useRef(false);
  const taiDuLieu = useTaiDuLieu(() => taiDanhMuc({ choLui: !daCoDayDu.current }), "danh-muc");
  const danhSach = taiDuLieu.data?.danhSach;
  const cay = useMemo(() => dungCay(danhSach ?? []), [danhSach]);
  const trangThai = useMemo(() => tinhTrangThai(cay), [cay]);
  const thongKe = useMemo(() => demThongKe(cay, trangThai), [cay, trangThai]);

  // Thao tác Hoàn tác dựng body từ dữ liệu mới nhất (tránh ghi đè bằng tên / cha cũ)
  const cayRef = useRef(cay);
  useEffect(() => {
    cayRef.current = cay;
  }, [cay]);
  useEffect(() => {
    if (taiDuLieu.data) daCoDayDu.current = !taiDuLieu.data.chiHoatDong;
  }, [taiDuLieu.data]);

  // Lần tải đầu: mở sẵn các danh mục gốc
  if (danhSach && !daMoLanDau) {
    setDaMoLanDau(true);
    setMoRong(Object.fromEntries(layCon(cay, null).filter((id) => layCon(cay, id).length).map((id) => [id, true])));
  }

  const goc = useMemo(() => {
    if (thamSoNhanh == null) return null;
    for (const id of cay.theoId.keys()) if (String(id) === thamSoNhanh) return id;
    return null;
  }, [cay, thamSoNhanh]);
  const nutGoc = goc != null ? cay.theoId.get(goc) : null;

  const tuKhoaChuan = chuanHoaChu(tuKhoa.trim());
  const coTuKhoa = Boolean(tuKhoa.trim());
  // "Đang lọc" (hiện Xóa lọc) = có từ khóa, hoặc bộ lọc trạng thái khác mặc định
  const dangLoc = coTuKhoa || loc !== LOC_MAC_DINH;

  const hienThi = useMemo(
    () => taoDongHienThi(cay, { tuKhoa, loc, moRong, goc, trangThai }),
    [cay, tuKhoa, loc, moRong, goc, trangThai],
  );

  const demLoc = useMemo(() => ({
    [LOC_TRANG_THAI.TAT_CA]: thongKe.tong,
    [LOC_TRANG_THAI.HOAT_DONG]: thongKe.hoatDong,
    [LOC_TRANG_THAI.NGUNG]: thongKe.ngung,
  }), [thongKe]);

  const soBatLaiTheo = useMemo(() => {
    const ketQua = new Map();
    trangThai.forEach((tt, id) => {
      if (tt.tuNgung && !tt.doCha) ketQua.set(id, demSeHoatDongLai(cay, id));
    });
    return ketQua;
  }, [cay, trangThai]);

  const layThaoTac = useCallback(
    (dong) => tinhThaoTac({
      dong,
      coTheSua,
      kiemTraSua: kiemTraSua(cay, dong.id),
      soHoatDongLai: soBatLaiTheo.get(dong.id) ?? 0,
    }),
    [cay, coTheSua, soBatLaiTheo],
  );

  // ── Bộ lọc, tìm kiếm, nhánh đang xem ──────────────────────────────────────
  // Gõ từ khóa mới hoặc đổi bộ lọc: bỏ các lần thu gọn cũ để kết quả luôn hiện ra
  const boThuGon = () => setMoRong((cu) => Object.fromEntries(Object.entries(cu).filter(([, mo]) => mo)));

  const doiTuKhoa = (giaTri) => {
    setTuKhoa(giaTri);
    boThuGon();
  };

  const doiLoc = (giaTri) => {
    boThuGon();
    setSearchParams((cu) => {
      const moi = new URLSearchParams(cu);
      if (giaTri === LOC_MAC_DINH) moi.delete("trangThai");
      else moi.set("trangThai", giaTri);
      return moi;
    }, { replace: true });
  };

  const xoaLoc = () => {
    setTuKhoa("");
    boThuGon();
    setSearchParams((cu) => {
      const moi = new URLSearchParams(cu);
      moi.delete("trangThai");
      return moi;
    }, { replace: true });
  };

  const xemNhanh = (id) => {
    setTuKhoa("");
    if (id != null) setMoRong((cu) => ({ ...cu, [id]: true }));
    setSearchParams((cu) => {
      const moi = new URLSearchParams(cu);
      if (id == null) moi.delete("nhanh");
      else moi.set("nhanh", String(id));
      return moi;
    });
  };

  const moDong = useCallback((id, mo) => setMoRong((cu) => ({ ...cu, [id]: mo })), []);

  const doiMoTatCa = () => {
    const pham = goc != null ? layConChau(cay, goc) : [...cay.theoId.keys()];
    const mo = !hienThi.tatCaDangMo;
    setMoRong((cu) => {
      const moi = { ...cu };
      pham.forEach((id) => {
        if (layCon(cay, id).length) moi[id] = mo;
      });
      return moi;
    });
  };

  // ── Thay đổi dữ liệu ─────────────────────────────────────────────────────
  const taiLai = taiDuLieu.reload;
  const { setData } = taiDuLieu;

  // Sửa ngay dữ liệu đang hiện theo đúng body vừa lưu, rồi tải lại để đồng bộ với máy chủ.
  // Nhờ vậy thao tác kế tiếp (kể cả Hoàn tác) luôn dựng body từ dữ liệu mới, không ghi đè ngược.
  const apDung = useCallback((body) => {
    setData((cu) => (cu ? { ...cu, danhSach: apDungCapNhat(cu.danhSach, body) } : cu));
    taiLai();
  }, [setData, taiLai]);

  const loiThaoTac = (tieuDe, err) => toast.error(tieuDe, { description: getApiErrorMessage(err, "Vui lòng thử lại.") });

  /** Hoàn tác: kiểm lại trên cây mới nhất rồi mới gửi (cây có thể đã đổi sau khi thông báo hiện ra). */
  const hoanTac = async (body, thongBaoLoi) => {
    try {
      await guiCapNhat(body);
      apDung(body);
      toast.success("Đã hoàn tác");
    } catch (err) {
      loiThaoTac(thongBaoLoi, err);
      taiLai();
    }
  };

  const hoanTacChuyen = (id, tuChaId) => {
    const cayMoi = cayRef.current;
    const nut = cayMoi.theoId.get(id);
    if (!nut) return;
    const kq = kiemTraChuyen(cayMoi, id, tuChaId, tinhTrangThai(cayMoi));
    if (kq.dangOday) {
      toast.info(`“${nut.ten}” đã ở chỗ cũ`);
      return;
    }
    if (!kq.duoc) {
      toast.error("Không hoàn tác được việc chuyển danh mục", { description: `Chỗ cũ: ${kq.lyDo}.` });
      return;
    }
    hoanTac(taoBodyCapNhat(nut, { chaId: tuChaId }), "Không hoàn tác được việc chuyển danh mục");
  };

  const hoanTacTrangThai = (id, trangThaiCu, thongBaoLoi) => {
    const cayMoi = cayRef.current;
    const nut = cayMoi.theoId.get(id);
    if (!nut) return;
    const sua = kiemTraSua(cayMoi, id);
    if (!sua.duoc) {
      toast.error(thongBaoLoi, { description: sua.lyDo });
      return;
    }
    hoanTac(taoBodyCapNhat(nut, { trangThai: trangThaiCu }), thongBaoLoi);
  };

  const daLuuDanhMuc = ({ cheDo, ten, body, duLieu }) => {
    if (cheDo === "them") {
      if (body.danhMucChaId != null) setMoRong((cu) => ({ ...cu, [body.danhMucChaId]: true }));
      if (duLieu?.id != null) {
        setData((cu) => (cu ? {
          ...cu,
          danhSach: [...cu.danhSach, { ...body, id: duLieu.id, ngayTao: duLieu.ngayTao ?? null }],
        } : cu));
      }
      toast.success(`Đã thêm danh mục “${ten}”`);
      taiLai();
    } else {
      toast.success(`Đã lưu “${ten}”`);
      apDung(body);
    }
  };

  const daChuyen = ({ nut, tuChaId, denChaId, body }) => {
    const cayLucChuyen = cayRef.current;
    if (denChaId != null) setMoRong((cu) => ({ ...cu, [denChaId]: true }));
    const noiDen = denChaId != null ? `vào “${cayLucChuyen.theoId.get(denChaId)?.ten ?? ""}”` : "thành danh mục gốc";
    // Máy chủ từ chối cập nhật khi danh mục cha trực tiếp đang tắt, nên không hoàn tác về chỗ đó được
    const veDuoc = tuChaId == null || cayLucChuyen.theoId.get(tuChaId)?.trangThai !== 0;
    toast.success(`Đã chuyển “${nut.ten}” ${noiDen}`, {
      action: veDuoc ? { label: "Hoàn tác", onClick: () => hoanTacChuyen(nut.id, tuChaId) } : undefined,
    });
    apDung(body);
  };

  // Kéo thả: mỗi lần chỉ gửi một yêu cầu chuyển
  const dangTha = useRef(false);
  const tha = async ({ idChuyen, idDich }) => {
    const nut = cay.theoId.get(idChuyen);
    if (!nut || dangTha.current) return;
    if (!kiemTraChuyen(cay, idChuyen, idDich, trangThai).duoc) return;
    dangTha.current = true;
    try {
      const body = taoBodyCapNhat(nut, { chaId: idDich });
      await guiCapNhat(body);
      daChuyen({ nut, tuChaId: nut.chaId ?? null, denChaId: idDich, body });
    } catch (err) {
      loiThaoTac("Không chuyển được danh mục", err);
      taiLai();
    } finally {
      dangTha.current = false;
    }
  };

  const daNgung = ({ nut, soTheo, body }) => {
    const ghiChu = [
      soTheo > 0 ? `${soTheo} danh mục con ngừng theo.` : "",
      // Đang lọc Đang hoạt động: dòng vừa ngừng biến mất khỏi bảng, nói rõ để người dùng không tưởng là bị xóa
      loc === LOC_TRANG_THAI.HOAT_DONG ? `Đang lọc “Đang hoạt động” nên ${soTheo > 0 ? "cả nhánh" : "danh mục này"} được ẩn.` : "",
    ].filter(Boolean).join(" ");
    toast.success(`Đã ngừng hoạt động “${nut.ten}”`, {
      description: ghiChu || undefined,
      action: {
        label: "Hoàn tác",
        onClick: () => hoanTacTrangThai(nut.id, 1, "Không hoàn tác được việc ngừng hoạt động"),
      },
    });
    apDung(body);
  };

  const batLai = async (id) => {
    const nut = cay.theoId.get(id);
    if (dangBatLai || !nut) return;
    const soTheo = soBatLaiTheo.get(id) ?? 0;
    setDangBatLai(true);
    try {
      const body = taoBodyCapNhat(nut, { trangThai: 1 });
      await guiCapNhat(body);
      toast.success(`Đã cho “${nut.ten}” hoạt động lại`, {
        description: soTheo > 0 ? `${soTheo} danh mục con hoạt động lại theo.` : undefined,
        action: {
          label: "Hoàn tác",
          onClick: () => hoanTacTrangThai(id, 0, "Không hoàn tác được việc cho hoạt động lại"),
        },
      });
      apDung(body);
    } catch (err) {
      loiThaoTac(`Không cho “${nut.ten}” hoạt động lại được`, err);
      taiLai();
    } finally {
      setDangBatLai(false);
    }
  };

  // Popup giữ id; nội dung lấy từ cây mới nhất mỗi lần vẽ lại
  const xuLy = {
    onThemCon: (nut) => setHop({ loai: "them", chaId: nut.id }),
    onSua: (nut) => setHop({ loai: "sua", id: nut.id }),
    onChuyen: (nut) => setHop({ loai: "chuyen", id: nut.id }),
    onDoiTrangThai: (nut, viec) => {
      if (!viec || viec.khoa) return;
      if (viec.loai === "ngung") setHop({ loai: "ngung", id: nut.id });
      else batLai(nut.id);
    },
  };
  const dongHop = (mo) => {
    if (!mo) setHop(null);
  };
  const nutHop = hop?.id != null ? cay.theoId.get(hop.id) ?? null : null;

  // ── Nút trên hàng tiêu đề ────────────────────────────────────────────────
  const themVaoNhanhKhoa = nutGoc ? trangThai.get(goc)?.ngung : false;
  const nhanThem = nutGoc ? `Thêm vào “${nutGoc.ten}”` : "Thêm danh mục";
  const dangTai = taiDuLieu.loading;

  const hanhDong = (
    <>
      <Button
        variant="outline"
        onClick={taiLai}
        disabled={dangTai}
        aria-label="Làm mới danh sách danh mục"
        className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
      >
        <RefreshCcw className={cn("size-4", dangTai && "animate-spin")} aria-hidden="true" />
        <span className="hidden sm:inline">Làm mới</span>
      </Button>
      {coTheSua ? (
        <Button
          onClick={() => setHop({ loai: "them", chaId: goc })}
          disabled={!danhSach || themVaoNhanhKhoa}
          title={themVaoNhanhKhoa ? `“${nutGoc.ten}” đang ngừng hoạt động, không thêm được danh mục con` : undefined}
          className="max-w-[calc(100vw-8rem)] gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover sm:max-w-[320px]"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{nhanThem}</span>
        </Button>
      ) : null}
    </>
  );

  // ── Thân bảng ────────────────────────────────────────────────────────────
  const nutXoaLoc = (
    <Button variant="outline" onClick={xoaLoc} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
      Xóa lọc
    </Button>
  );

  // Trống vì bộ lọc trạng thái: đếm số danh mục (trong phạm vi đang xem, khớp từ khóa) đang bị bộ lọc ẩn đi,
  // để gợi ý "Xem tất cả trạng thái" thay vì để người dùng tưởng là không có
  const demBiAn = () => {
    if (loc === LOC_TRANG_THAI.TAT_CA) return 0;
    const tatCa = [...cay.theoId.keys()];
    const phamVi = laDienThoai
      ? (coTuKhoa ? tatCa : layCon(cay, goc))
      : (goc != null ? layConChau(cay, goc) : tatCa);
    return phamVi.filter((id) => {
      const nut = cay.theoId.get(id);
      const khop = !tuKhoaChuan || chuanHoaChu(nut.ten).includes(tuKhoaChuan) || chuanHoaChu(nut.ma).includes(tuKhoaChuan);
      const ngung = trangThai.get(id).ngung;
      return khop && (loc === LOC_TRANG_THAI.HOAT_DONG ? ngung : !ngung);
    }).length;
  };

  const trongKhiLoc = () => {
    const soBiAn = demBiAn();
    if (soBiAn > 0) {
      const laHoatDong = loc === LOC_TRANG_THAI.HOAT_DONG;
      const tenLoc = laHoatDong ? "đang hoạt động" : "ngừng hoạt động";
      const tieuDe = coTuKhoa
        ? `Không có danh mục ${tenLoc} nào khớp`
        : nutGoc
          ? `“${nutGoc.ten}” không có danh mục con ${tenLoc}`
          : `Không có danh mục nào ${tenLoc}`;
      return (
        <EmptyState
          icon={SearchX}
          title={tieuDe}
          description={`Có ${soBiAn} danh mục ${laHoatDong ? "ngừng hoạt động" : "đang hoạt động"}${coTuKhoa ? " khớp" : ""} đang được ẩn.`}
          action={
            <Button variant="outline" onClick={() => doiLoc(LOC_TRANG_THAI.TAT_CA)} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
              Xem tất cả trạng thái
            </Button>
          }
        />
      );
    }
    if (!coTuKhoa && trongNhanh) return trongNhanh;
    return (
      <EmptyState
        icon={SearchX}
        title="Không có danh mục nào khớp"
        description={
          coTuKhoa
            ? `Không tìm thấy “${tuKhoa.trim()}”${nutGoc && !laDienThoai ? ` trong nhánh “${nutGoc.ten}”` : ""}. Thử bỏ dấu hoặc tìm theo mã.`
            : "Không có danh mục nào ở trạng thái này."
        }
        action={nutXoaLoc}
      />
    );
  };

  const trongNhanh = nutGoc ? (
    <EmptyState
      icon={FolderTree}
      title={`“${nutGoc.ten}” chưa có danh mục con`}
      description={coTheSua ? "Thêm danh mục con để chia nhỏ nhóm sản phẩm." : "Danh mục con sẽ hiện tại đây khi được thêm."}
      action={
        coTheSua && !themVaoNhanhKhoa ? (
          <Button onClick={() => setHop({ loai: "them", chaId: goc })} className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover">
            <Plus className="size-4" aria-hidden="true" />
            Thêm danh mục con
          </Button>
        ) : null
      }
    />
  ) : null;

  let than;
  if (taiDuLieu.initialLoading) {
    than = <LoadingState label="Đang tải danh mục" className="min-h-64" />;
  } else if (taiDuLieu.error && !danhSach) {
    than = (
      <ErrorState
        title={KHONG_TAI_DUOC}
        description={getApiErrorMessage(taiDuLieu.error, "Vui lòng thử lại.")}
        onRetry={taiLai}
      />
    );
  } else if (!cay.theoId.size) {
    than = (
      <EmptyState
        icon={FolderTree}
        title="Chưa có danh mục nào"
        description="Danh mục dùng để nhóm sản phẩm, ví dụ Áo › Áo thun › Áo thun cổ tròn."
        action={
          coTheSua ? (
            <Button onClick={() => setHop({ loai: "them", chaId: null })} className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover">
              <Plus className="size-4" aria-hidden="true" />
              Thêm danh mục
            </Button>
          ) : null
        }
      />
    );
  } else if (laDienThoai) {
    const coDong = tuKhoaChuan
      ? timPhang(cay, tuKhoa, { loc, trangThai }).length > 0
      : layDongCap(cay, trangThai, goc, loc).length > 0;
    than = (
      <DanhSachDiSau
        cay={cay}
        trangThai={trangThai}
        cha={goc}
        loc={loc}
        tuKhoa={tuKhoa}
        tuKhoaChuan={tuKhoaChuan}
        coTheSua={coTheSua}
        layThaoTac={layThaoTac}
        onVao={xemNhanh}
        {...xuLy}
        trong={coDong ? null : trongKhiLoc()}
      />
    );
  } else if (!hienThi.dong.length) {
    than = trongKhiLoc();
  } else {
    than = (
      <BangCayDanhMuc
        dong={hienThi.dong}
        cay={cay}
        trangThai={trangThai}
        tuKhoaChuan={tuKhoaChuan}
        goc={goc}
        coTheSua={coTheSua}
        layThaoTac={layThaoTac}
        onMoDong={moDong}
        onXemNhanh={xemNhanh}
        onTha={tha}
        onDangKeo={setKeo}
        {...xuLy}
      />
    );
  }

  const coDuLieu = Boolean(danhSach) && cay.theoId.size > 0;
  const duongDanGoc = nutGoc ? layDuongDan(cay, goc) : [];

  const thanhNhanh = nutGoc && !laDienThoai ? (
    <nav aria-label="Nhánh đang xem" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-bo-border bg-bo-surface-subtle px-4 py-2 text-[13px] text-bo-muted">
      <span>Đang xem riêng nhánh:</span>
      <button type="button" onClick={() => xemNhanh(null)} className="rounded px-1 py-0.5 font-medium text-bo-primary hover:bg-bo-primary-soft">
        Tất cả danh mục
      </button>
      {duongDanGoc.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-slate-400">›</span>
          {i === duongDanGoc.length - 1 ? (
            <span aria-current="page" className="font-semibold text-bo-foreground">{n.ten}</span>
          ) : (
            <button type="button" onClick={() => xemNhanh(n.id)} className="rounded px-1 py-0.5 font-medium text-bo-primary hover:bg-bo-primary-soft">
              {n.ten}
            </button>
          )}
        </span>
      ))}
      <Button
        variant="ghost"
        onClick={() => xemNhanh(null)}
        className="ml-auto h-8 gap-1.5 px-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-bo-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Xem toàn bộ cây
      </Button>
    </nav>
  ) : null;

  const nutMoTatCa = !laDienThoai && coDuLieu ? (
    <div className="py-2">
      <Button
        variant="ghost"
        onClick={doiMoTatCa}
        disabled={!hienThi.coNhanhDeMo}
        className="h-9 gap-1.5 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-bo-foreground"
      >
        {hienThi.tatCaDangMo ? (
          <ChevronsDownUp className="size-4" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="size-4" aria-hidden="true" />
        )}
        {hienThi.tatCaDangMo ? "Thu gọn tất cả" : "Mở tất cả"}
      </Button>
    </div>
  ) : null;

  const goiYKeo = keo
    ? keo.idDich === undefined
      ? "Thả vào một danh mục để chuyển vào trong đó"
      : keo.duoc
        ? `Thả để chuyển vào ${keo.idDich == null ? "danh mục gốc" : `“${cay.theoId.get(keo.idDich)?.ten ?? ""}”`}`
        : `Không thả vào đây được: ${keo.lyDo}`
    : "Kéo một dòng thả vào danh mục khác để chuyển nhánh";

  const chanBang = coDuLieu ? (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-bo-muted">
      <span className="tabular-nums">
        {thongKe.tong} danh mục · {thongKe.goc} danh mục gốc · {thongKe.ngung} ngừng hoạt động · sâu nhất {thongKe.sauNhat} cấp
      </span>
      {coTheSua && !laDienThoai ? (
        <span aria-live="polite" className={cn(keo && (keo.duoc ? "text-bo-primary-hover" : keo.idDich !== undefined && "text-bo-warning"))}>
          {goiYKeo}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader actions={hanhDong} />

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar tabs={nutMoTatCa} hasFilter={dangLoc} onClear={xoaLoc}>
              <SearchInput
                label="Tìm danh mục"
                placeholder="Tìm theo tên hoặc mã danh mục"
                value={tuKhoa}
                onChange={(event) => doiTuKhoa(event.target.value)}
                onClear={() => doiTuKhoa("")}
                className="sm:w-[320px]"
              />
              <LocTrangThai value={loc} onChange={doiLoc} dem={demLoc} />
            </ListToolbar>
            {taiDuLieu.error && danhSach ? (
              <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bo-border bg-bo-danger-soft px-4 py-2 text-[13px] text-bo-danger">
                <span className="min-w-0 flex-1">
                  Không tải lại được danh mục ({getApiErrorMessage(taiDuLieu.error, "lỗi kết nối")}). Bảng đang hiện dữ liệu lần tải trước.
                </span>
                <button type="button" onClick={taiLai} className="shrink-0 rounded px-1.5 py-0.5 font-semibold hover:bg-white/60">
                  Thử lại
                </button>
              </div>
            ) : null}
            {taiDuLieu.data?.chiHoatDong ? (
              <p role="status" className="border-b border-bo-border bg-bo-warning-soft px-4 py-2 text-[13px] text-bo-warning">
                Chỉ tải được danh mục đang hoạt động. Bấm Làm mới để tải lại đủ cả danh mục ngừng hoạt động.
              </p>
            ) : null}
            {thanhNhanh}
          </>
        }
        footer={chanBang}
      >
        {than}
      </TableShell>

      {coTheSua ? (
        <>
          <HopDanhMuc
            open={hop?.loai === "them" || hop?.loai === "sua"}
            onOpenChange={dongHop}
            cheDo={hop?.loai === "sua" ? "sua" : "them"}
            nut={hop?.loai === "sua" ? nutHop : null}
            chaId={hop?.loai === "them" ? hop.chaId : null}
            cay={cay}
            onDaLuu={daLuuDanhMuc}
          />
          <HopChuyenDanhMuc
            open={hop?.loai === "chuyen"}
            onOpenChange={dongHop}
            cay={cay}
            trangThai={trangThai}
            idChuyen={hop?.loai === "chuyen" ? hop.id : null}
            onDaChuyen={daChuyen}
          />
          <HopNgungHoatDong
            open={hop?.loai === "ngung"}
            onOpenChange={dongHop}
            cay={cay}
            trangThai={trangThai}
            nut={hop?.loai === "ngung" ? nutHop : null}
            onDaNgung={daNgung}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
