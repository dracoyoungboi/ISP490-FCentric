import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Printer } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle, usePageTitle } from "@/components/backoffice/pageTitle";
import ErrorState from "@/components/shared/ErrorState";
import KhoLamViecSelect from "@/components/shared/KhoLamViecSelect";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import HopViTriNamODau from "@/components/mat-bang/HopViTriNamODau";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { THONG_BAO_CHUA_HO_TRO_VI_TRI, viTriKhoService } from "@/services/viTriKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

import DanhSachViTri from "./DanhSachViTri";
import HopChuyenKhu from "./HopChuyenKhu";
import HopInMaKe from "./HopInMaKe";
import HopKhuVuc from "./HopKhuVuc";
import HopViTri from "./HopViTri";
import { NhomChon } from "./KhungHop";
import MatBangKho from "./MatBangKho";
import SoDoKe from "./SoDoKe";
import { NUT_CHINH, NUT_PHU, TAB_TRANG_THAI_KE } from "./kieuNhap";

// Thêm / sửa khu, vị trí, vẽ mặt bằng: quản trị viên và quản lý kho. Nhân viên kho chỉ xem và in tem.
const QUYEN_SUA = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO];

const CHE_DO_XEM = [
  { ma: "danh-sach", ten: "Danh sách" },
  { ma: "so-do", ten: "Sơ đồ kệ" },
  { ma: "mat-bang", ten: "Mặt bằng" },
];

const soHoacNull = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Vị trí kệ (FO-094): Danh sách theo khu (PA1, màn chính) · Sơ đồ kệ · Mặt bằng (PA3, vẽ khu trên lưới).
 * Trạng thái xem nằm trên URL: ?xem=so-do|mat-bang & khu= & viTri= & trangThai= (F5 / quay lại vẫn đúng chỗ;
 * màn kiểm đếm mở thẳng sơ đồ kệ của một vị trí bằng các tham số này).
 * Máy chủ chưa có API khu vực / vị trí thì trang chỉ hiện một dòng thông báo.
 */
export default function ViTriKhoPage() {
  useClaimPageTitle(true);
  const { title } = usePageTitle();
  const coTheSua = hasAnyRole(QUYEN_SUA);
  const [thamSo, setThamSo] = useSearchParams();
  const xem = CHE_DO_XEM.some((c) => c.ma === thamSo.get("xem")) ? thamSo.get("xem") : "danh-sach";
  const khuId = soHoacNull(thamSo.get("khu"));
  const viTriId = soHoacNull(thamSo.get("viTri"));
  const tab = TAB_TRANG_THAI_KE.some((t) => t.value === thamSo.get("trangThai")) ? thamSo.get("trangThai") : "tat-ca";

  const [khoId, setKhoId] = useState(getKhoLamViecId);
  const hoTro = viTriKhoService.hoTro;

  const { data, error, initialLoading, reload, setData } = useTaiDuLieu(
    async () => {
      const [khuVucs, viTris, matBang] = await Promise.all([
        viTriKhoService.dsKhuVuc(khoId),
        viTriKhoService.dsViTri(khoId),
        viTriKhoService.matBang(khoId),
      ]);
      return { khuVucs: khuVucs ?? [], viTris: viTris ?? [], matBang: matBang ?? null };
    },
    `kho-${khoId}`,
    { enabled: hoTro && Boolean(khoId) },
  );

  const [hopKhu, setHopKhu] = useState({ open: false, khu: null });
  const [hopViTri, setHopViTri] = useState({ open: false, viTri: null, khu: null });
  const [hopIn, setHopIn] = useState({ open: false, ds: null });
  const [hopChuyenKhu, setHopChuyenKhu] = useState({ open: false, ds: [] });
  // Hộp xác nhận xóa dùng chung: { loai: "khu" | "viTri" | "nhieu", doiTuong, ds, tieuDe, moTa, nutXoa }
  const [xacNhan, setXacNhan] = useState(null);
  const [dangXoa, setDangXoa] = useState(false);
  // Thao tác hàng loạt chờ hộp xác nhận / chuyển khu đóng lại mới báo cho danh sách bỏ chọn
  const [choHangLoat, setChoHangLoat] = useState(null);
  const [timViTri, setTimViTri] = useState({ open: false, viTriId: null, khuVucId: null });

  const doiThamSo = useCallback(
    (thayDoi, { push = false } = {}) => {
      setThamSo(
        (cu) => {
          const moi = new URLSearchParams(cu);
          for (const [k, v] of Object.entries(thayDoi)) {
            if (v == null || v === "" || (k === "xem" && v === "danh-sach") || (k === "trangThai" && v === "tat-ca")) moi.delete(k);
            else moi.set(k, String(v));
          }
          return moi;
        },
        { replace: !push },
      );
    },
    [setThamSo],
  );

  const doiKho = (id) => {
    setKhoId(id);
    doiThamSo({ khu: null, viTri: null });
  };

  // ── Cập nhật dữ liệu tại chỗ sau thao tác (không tải lại cả trang) ──
  const themKhu = (khu) => {
    if (khu) setData((d) => ({ ...d, khuVucs: [...d.khuVucs, khu] }));
    return khu;
  };
  const taoKhu = async (payload) => themKhu(await viTriKhoService.taoKhuVuc(khoId, payload));
  const luuMatBang = async (matBang) => {
    const daLuu = await viTriKhoService.luuMatBang(khoId, matBang);
    setData((d) => ({ ...d, matBang: daLuu ?? matBang }));
  };
  const capNhatViTri = async (viTri, thayDoi) => {
    const daLuu = await viTriKhoService.suaViTri(khoId, viTri.id, {
      khuVucId: viTri.khuVucId,
      sucChua: viTri.sucChua,
      trangThai: viTri.trangThai,
      ...thayDoi,
    });
    setData((d) => ({ ...d, viTris: d.viTris.map((v) => (v.id === viTri.id ? { ...v, ...thayDoi, ...(daLuu ?? {}) } : v)) }));
  };

  // ── Khu vực: sửa / xóa ──
  const daLuuKhu = (khu, { laSua }) => {
    setHopKhu((h) => ({ ...h, open: false }));
    if (!khu) {
      reload();
      return;
    }
    if (laSua) {
      setData((d) => ({ ...d, khuVucs: d.khuVucs.map((k) => (k.id === khu.id ? { ...k, ...khu } : k)) }));
      toast.success(`Đã lưu khu vực ${khu.tenKhuVuc}`);
    } else {
      themKhu(khu);
      toast.success(`Đã thêm khu vực ${khu.tenKhuVuc}`);
    }
  };
  const yeuCauXoaKhu = (khu) => {
    const soViTri = data.viTris.filter((v) => v.khuVucId === khu.id).length;
    if (soViTri) {
      toast.warning(`Không xóa được ${khu.tenKhuVuc}: khu còn ${soViTri} vị trí kệ`, {
        description: "Xóa các vị trí trống hoặc chọn vị trí rồi bấm Chuyển khu sang khu khác trước.",
        action: { label: "Xem vị trí", onClick: () => doiThamSo({ xem: "danh-sach", khu: khu.id, viTri: null, trangThai: null }, { push: true }) },
      });
      return;
    }
    const daDat = (data.matBang?.khuVuc ?? []).some((h) => h.khuVucId === khu.id);
    setXacNhan({
      loai: "khu",
      doiTuong: khu,
      tieuDe: `Xóa khu vực ${khu.tenKhuVuc}?`,
      moTa: `Khu ${khu.maKhuVuc} chưa có vị trí kệ nào.${daDat ? " Khu cũng được gỡ khỏi mặt bằng." : ""} Không hoàn tác được.`,
      nutXoa: "Xóa khu vực",
    });
  };
  const xoaKhu = async (khu) => {
    await viTriKhoService.xoaKhuVuc(khoId, khu.id);
    setData((d) => ({
      ...d,
      khuVucs: d.khuVucs.filter((k) => k.id !== khu.id),
      matBang: d.matBang ? { ...d.matBang, khuVuc: (d.matBang.khuVuc ?? []).filter((h) => h.khuVucId !== khu.id) } : d.matBang,
    }));
    setHopKhu((h) => ({ ...h, open: false }));
    if (khuId === khu.id) doiThamSo({ khu: null, viTri: null });
    toast.success(`Đã xóa khu vực ${khu.tenKhuVuc}`);
  };

  // ── Vị trí: xóa một / nhiều, chuyển khu ──
  const yeuCauXoaViTri = (v) => {
    if (Number(v.dangChua) > 0) {
      toast.warning(`Không xóa được ${v.maViTri}: kệ còn ${v.dangChua} sản phẩm`, {
        description: "Chuyển hàng sang kệ khác trước, hoặc chuyển kệ sang Bảo trì để ngừng nhận hàng.",
      });
      return;
    }
    setXacNhan({
      loai: "viTri",
      doiTuong: v,
      tieuDe: `Xóa vị trí ${v.maViTri}?`,
      moTa: "Kệ đang trống. Nhớ gỡ tem dán trên kệ sau khi xóa. Không hoàn tác được.",
      nutXoa: "Xóa vị trí",
    });
  };
  const xoaViTri = async (v) => {
    await viTriKhoService.xoaViTri(khoId, v.id);
    setData((d) => ({ ...d, viTris: d.viTris.filter((x) => x.id !== v.id) }));
    setHopViTri((h) => ({ ...h, open: false }));
    if (viTriId === v.id) doiThamSo({ viTri: null });
    toast.success(`Đã xóa vị trí ${v.maViTri}`);
  };
  // Trả về Promise<boolean> cho danh sách: true khi thao tác xong (để bỏ chọn)
  const choKetQua = () => new Promise((resolve) => setChoHangLoat(() => resolve));
  const xongHangLoat = (ok) => {
    choHangLoat?.(ok);
    setChoHangLoat(null);
  };
  const yeuCauXoaNhieu = (ds) => {
    const trong = ds.filter((v) => !Number(v.dangChua));
    const conHang = ds.length - trong.length;
    setXacNhan({
      loai: "nhieu",
      ds: trong,
      tieuDe: `Xóa ${trong.length} vị trí kệ trống?`,
      moTa: `${trong.map((v) => v.maViTri).slice(0, 6).join(", ")}${trong.length > 6 ? "…" : ""}.${conHang ? ` ${conHang} kệ còn hàng được giữ lại.` : ""} Không hoàn tác được.`,
      nutXoa: `Xóa ${trong.length} vị trí`,
    });
    return choKetQua();
  };
  const xoaNhieu = async (ds) => {
    const kq = await Promise.allSettled(ds.map((v) => viTriKhoService.xoaViTri(khoId, v.id)));
    const daXoa = new Set(ds.filter((_, i) => kq[i].status === "fulfilled").map((v) => v.id));
    setData((d) => ({ ...d, viTris: d.viTris.filter((x) => !daXoa.has(x.id)) }));
    if (viTriId && daXoa.has(viTriId)) doiThamSo({ viTri: null });
    const loi = ds.length - daXoa.size;
    if (loi) toast.warning(`Đã xóa ${daXoa.size} vị trí, ${loi} vị trí không xóa được`, { description: getApiErrorMessage(kq.find((r) => r.status === "rejected")?.reason, "") });
    else toast.success(`Đã xóa ${daXoa.size} vị trí kệ`);
  };
  const yeuCauChuyenKhu = (ds) => {
    setHopChuyenKhu({ open: true, ds });
    return choKetQua();
  };
  const chuyenKhu = async (khuVucIdMoi) => {
    const ds = hopChuyenKhu.ds.filter((v) => v.khuVucId !== khuVucIdMoi);
    const kq = await Promise.allSettled(
      ds.map((v) => viTriKhoService.suaViTri(khoId, v.id, { khuVucId: khuVucIdMoi, sucChua: v.sucChua, trangThai: v.trangThai })),
    );
    const daChuyen = new Set(ds.filter((_, i) => kq[i].status === "fulfilled").map((v) => v.id));
    setData((d) => ({ ...d, viTris: d.viTris.map((v) => (daChuyen.has(v.id) ? { ...v, khuVucId: khuVucIdMoi } : v)) }));
    setHopChuyenKhu({ open: false, ds: [] });
    const ten = data.khuVucs.find((k) => k.id === khuVucIdMoi)?.tenKhuVuc ?? "khu mới";
    const loi = ds.length - daChuyen.size;
    if (loi) toast.warning(`Đã chuyển ${daChuyen.size} vị trí sang ${ten}, ${loi} vị trí lỗi`);
    else toast.success(`Đã chuyển ${daChuyen.size} vị trí sang ${ten}`);
    xongHangLoat(true);
  };

  const thucHienXoa = async () => {
    if (!xacNhan) return;
    setDangXoa(true);
    try {
      if (xacNhan.loai === "khu") await xoaKhu(xacNhan.doiTuong);
      else if (xacNhan.loai === "viTri") await xoaViTri(xacNhan.doiTuong);
      else {
        await xoaNhieu(xacNhan.ds);
        xongHangLoat(true);
      }
      setXacNhan(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xóa được. Vui lòng thử lại."));
    } finally {
      setDangXoa(false);
    }
  };

  const daLuuViTri = ({ ds, laSua }) => {
    setHopViTri((h) => ({ ...h, open: false }));
    if (laSua) {
      const moi = ds[0];
      setData((d) => ({ ...d, viTris: d.viTris.map((v) => (moi && v.id === moi.id ? { ...v, ...moi } : v)) }));
      toast.success(`Đã lưu vị trí ${moi?.maViTri ?? ""}`.trim());
      if (!moi) reload();
      return;
    }
    if (!ds.length) {
      reload();
      toast.success("Đã tạo vị trí kệ");
      return;
    }
    setData((d) => {
      const daCo = new Set(d.viTris.map((v) => v.id));
      return { ...d, viTris: [...d.viTris, ...ds.filter((v) => !daCo.has(v.id))] };
    });
    toast.success(ds.length === 1 ? `Đã tạo vị trí ${ds[0].maViTri}` : `Đã tạo ${ds.length} vị trí kệ`);
  };

  // ── Điều hướng giữa các chế độ xem ──
  const moSoDo = (k, v) => doiThamSo({ xem: "so-do", khu: k, viTri: v ?? null }, { push: true });

  const hanhDong = hoTro && khoId && data ? (
    <div className="flex flex-wrap items-center gap-2">
      <NhomChon nhan="Chế độ xem" value={xem} onChange={(ma) => doiThamSo({ xem: ma }, { push: true })} luaChon={CHE_DO_XEM} />
      {xem !== "mat-bang" ? (
        <Button variant="outline" onClick={() => setHopIn({ open: true, ds: null })} disabled={!data.viTris.length} className={cn("gap-1.5", NUT_PHU)}>
          <Printer className="size-4" />
          In tem kệ
        </Button>
      ) : null}
      {coTheSua ? (
        <>
          <Button variant="outline" onClick={() => setHopKhu({ open: true, khu: null })} className={cn("gap-1.5", NUT_PHU)}>
            <Plus className="size-4" />
            Thêm khu vực
          </Button>
          <Button
            onClick={() => setHopViTri({ open: true, viTri: null, khu: khuId })}
            disabled={!data.khuVucs.length}
            title={data.khuVucs.length ? undefined : "Tạo khu vực trước"}
            className={cn("gap-1.5", NUT_CHINH)}
          >
            <Plus className="size-4" />
            Thêm vị trí kệ
          </Button>
        </>
      ) : null}
    </div>
  ) : null;

  let noiDung;
  if (!hoTro) {
    noiDung = <DongThongBao>{THONG_BAO_CHUA_HO_TRO_VI_TRI}</DongThongBao>;
  } else if (!khoId) {
    noiDung = <DongThongBao tone="warn">Chọn kho làm việc ở ô bên trên để xem vị trí kệ.</DongThongBao>;
  } else if (initialLoading) {
    noiDung = (
      <section className="rounded-lg border border-bo-border bg-white shadow-sm">
        <LoadingState rows={6} label="Đang tải vị trí kệ" />
      </section>
    );
  } else if (error && !data) {
    noiDung = (
      <section className="rounded-lg border border-bo-border bg-white shadow-sm">
        <ErrorState title="Không tải được vị trí kệ" description={getApiErrorMessage(error, "Vui lòng thử lại.")} onRetry={reload} />
      </section>
    );
  } else if (data) {
    const chungChung = { khuVucs: data.khuVucs, viTris: data.viTris, coTheSua };
    if (xem === "so-do" && data.khuVucs.length) {
      noiDung = (
        <SoDoKe
          {...chungChung}
          khoId={khoId}
          khuId={khuId}
          viTriId={viTriId}
          onChon={({ khuId: k, viTriId: v }) => doiThamSo({ khu: k, viTri: v })}
          onThemViTri={(k) => setHopViTri({ open: true, viTri: null, khu: k })}
          onCapNhatViTri={capNhatViTri}
          onSuaViTri={(v) => setHopViTri({ open: true, viTri: v, khu: null })}
          onXoaViTri={yeuCauXoaViTri}
          onXemTrenMatBang={({ viTriId: v }) => setTimViTri({ open: true, viTriId: v, khuVucId: null })}
        />
      );
    } else if (xem === "mat-bang") {
      noiDung = (
        <MatBangKho
          key={khoId}
          {...chungChung}
          matBang={data.matBang}
          khuBanDau={khuId}
          onLuuMatBang={luuMatBang}
          onTaoKhu={taoKhu}
          onSuaKhu={(khu) => setHopKhu({ open: true, khu })}
          onMoSoDo={(k) => moSoDo(k)}
        />
      );
    } else {
      noiDung = (
        <DanhSachViTri
          {...chungChung}
          khuId={khuId}
          onChonKhu={(k) => doiThamSo({ khu: k })}
          tab={tab}
          onDoiTab={(t) => doiThamSo({ trangThai: t })}
          onThemKhu={() => setHopKhu({ open: true, khu: null })}
          onSuaKhu={(khu) => setHopKhu({ open: true, khu })}
          onXoaKhu={yeuCauXoaKhu}
          onThemViTri={(k) => setHopViTri({ open: true, viTri: null, khu: k })}
          onSuaViTri={(v) => setHopViTri({ open: true, viTri: v, khu: null })}
          onXoaViTri={yeuCauXoaViTri}
          onInTem={(ds) => setHopIn({ open: true, ds })}
          onChuyenKhu={yeuCauChuyenKhu}
          onXoaNhieu={yeuCauXoaNhieu}
          onMoSoDo={(v) => moSoDo(v.khuVucId, v.id)}
          onXemTrenMatBang={({ viTriId: v = null, khuVucId: k = null }) => setTimViTri({ open: true, viTriId: v, khuVucId: k })}
        />
      );
    }
  }

  return (
    // Chế độ Danh sách: khung bảng giãn hết màn như các trang danh sách khác; Sơ đồ kệ / Mặt bằng cao theo nội dung
    <PageContainer fill={Boolean(data) && noiDung?.type === DanhSachViTri} className="flex flex-col gap-4">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <PageHeading>{title || "Vị trí kệ"}</PageHeading>
          {hoTro ? <KhoLamViecSelect onChange={doiKho} /> : null}
        </div>
        {hanhDong}
      </div>

      <MockModeNotice show={viTriKhoService.mau} reason="máy chủ chưa có API khu vực, vị trí kệ và mặt bằng" />

      {noiDung}

      {data ? (
        <>
          <HopKhuVuc
            open={hopKhu.open}
            onOpenChange={(o) => setHopKhu((h) => ({ ...h, open: o }))}
            khoId={khoId}
            khuVucs={data.khuVucs}
            khuSua={hopKhu.khu}
            onDaLuu={daLuuKhu}
            onXoa={yeuCauXoaKhu}
          />
          <HopViTri
            open={hopViTri.open}
            onOpenChange={(o) => setHopViTri((h) => ({ ...h, open: o }))}
            khoId={khoId}
            khuVucs={data.khuVucs}
            viTris={data.viTris}
            viTriSua={hopViTri.viTri}
            khuMacDinh={hopViTri.khu}
            onDaLuu={daLuuViTri}
            onXoa={yeuCauXoaViTri}
          />
          <HopInMaKe
            open={hopIn.open}
            onOpenChange={(o) => setHopIn((h) => ({ ...h, open: o }))}
            khuVucs={data.khuVucs}
            viTris={data.viTris}
            khuMacDinh={khuId}
            dsChon={hopIn.ds}
          />
          <HopChuyenKhu
            open={hopChuyenKhu.open}
            onOpenChange={(o) => {
              if (!o) {
                setHopChuyenKhu({ open: false, ds: [] });
                xongHangLoat(false);
              }
            }}
            khuVucs={data.khuVucs}
            dsViTri={hopChuyenKhu.ds}
            onXacNhan={chuyenKhu}
          />
          <ConfirmModal
            isOpen={Boolean(xacNhan)}
            onClose={() => {
              if (dangXoa) return;
              if (xacNhan?.loai === "nhieu") xongHangLoat(false);
              setXacNhan(null);
            }}
            onConfirm={thucHienXoa}
            title={xacNhan?.tieuDe ?? ""}
            description={xacNhan?.moTa ?? ""}
            confirmText={xacNhan?.nutXoa ?? "Xóa"}
            cancelText="Không xóa"
            isLoading={dangXoa}
          />
          <HopViTriNamODau
            open={timViTri.open}
            onOpenChange={(o) => setTimViTri((t) => ({ ...t, open: o }))}
            khoId={khoId}
            viTriId={timViTri.viTriId}
            khuVucId={timViTri.khuVucId}
            duLieu={data}
            onMoSoDoKe={({ khuVucId: k, viTriId: v }) => {
              setTimViTri((t) => ({ ...t, open: false }));
              moSoDo(k, v);
            }}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
