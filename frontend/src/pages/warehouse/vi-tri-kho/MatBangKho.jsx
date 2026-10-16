import { createElement, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Grid3x3, Pencil, PenLine, Trash2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import MetricStrip from "@/components/shared/MetricStrip";
import { Button } from "@/components/ui/button";
import ChuGiaiMucDay from "@/components/mat-bang/ChuGiaiMucDay";
import LuoiMatBang from "@/components/mat-bang/LuoiMatBang";
import {
  THONG_BAO_KHU_QUA_NHO,
  doiHinhVat,
  hinhCuaVat,
  khuQuaNho,
  matBangRong,
  nhomTheoDay,
  tenLoaiVat,
  trongLuoi,
  vatBiChong,
} from "@/components/mat-bang/matBang";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { DaiO, ThanhMuc } from "@/components/nhap-kho/ThanhBuoc";
import { HUONG_CUA, NGUONG_SAP_DAY, mucDay, nhomTrangThaiKe, toneMucDay } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";
import HopDatLenMatBang from "./HopDatLenMatBang";
import HopKichThuocLuoi from "./HopKichThuocLuoi";
import HopSuaVat from "./HopSuaVat";
import { NUT_CHINH, NUT_PHU, dinhDangSo } from "./kieuNhap";

const SO_DONG_CAN_CHU_Y = 5;

const tongMuc = (ds) => {
  const conHoatDong = ds.filter((v) => v.trangThai !== "BAO_TRI");
  const dangChua = conHoatDong.reduce((t, v) => t + Number(v.dangChua || 0), 0);
  const sucChua = conHoatDong.reduce((t, v) => t + Number(v.sucChua || 0), 0);
  return { dangChua, sucChua, phanTram: Math.round(mucDay(dangChua, sucChua) * 100) };
};

// Cần chú ý: đầy trước, rồi bảo trì, rồi sắp đầy (mức cao trước)
const HANG_CHU_Y = { DAY: 0, BAO_TRI: 1, CON_CHO: 2 };

/** Nhãn loại (khu, cửa…): chữ trên nền xám, không chấm màu để khỏi lẫn với nhãn trạng thái. */
const NhanLoai = ({ children }) => (
  <span className="inline-flex h-5 shrink-0 items-center rounded border border-bo-border bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">
    {children}
  </span>
);

const toneSo = (phanTram) => (phanTram >= 100 ? "danger" : phanTram >= NGUONG_SAP_DAY * 100 ? "warning" : undefined);

/**
 * Mặt bằng kho — PA3 (FO-094). Vẽ khu vực, lối đi, cửa, vật cố định bằng cách kéo trên lưới.
 * Mỗi thay đổi lưu cả mặt bằng lên máy chủ ngay (có Hoàn tác khi dời, vẽ lại, gỡ / xóa).
 * Dời vật: kéo trên mặt bằng hoặc bấm mũi tên (dịch 1 ô); không cho chồng lên vật khác hay ra ngoài lưới.
 * - onLuuMatBang(matBangMoi): Promise; trang cha cập nhật dữ liệu sau khi lưu.
 * - onTaoKhu(payload): Promise<khu> — tạo khu mới ngay trong lúc đặt lên mặt bằng.
 * - onSuaKhu(khu): mở hộp sửa thông tin khu (tên, loại, ghi chú) của trang cha.
 */
export default function MatBangKho({ khuVucs, viTris, matBang, coTheSua, khuBanDau, onLuuMatBang, onTaoKhu, onSuaKhu, onMoSoDo }) {
  const [dangVe, setDangVe] = useState(false);
  // Vật đang được vẽ lại: { loai, id } (id là khuVucId với khu, thứ tự trong mảng với vật khác)
  const [veLai, setVeLai] = useState(null);
  const [hopSuaVat, setHopSuaVat] = useState(null);
  const [vatChon, setVatChon] = useState(() => (khuBanDau ? { loai: "khuVuc", id: khuBanDau } : null));
  const [thongBao, setThongBao] = useState(null);
  const [hinhMoi, setHinhMoi] = useState(null);
  const [hopLuoi, setHopLuoi] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);

  const tenKhu = (id) => khuVucs.find((k) => k.id === id)?.tenKhuVuc ?? "khu vực";
  const tenVat = (vat) => (vat?.loai === "khuVuc" ? tenKhu(vat.id) : (matBang?.[vat?.loai] ?? [])[vat?.id]?.ten ?? "");
  const coMatBang = Boolean(matBang?.soCot && matBang?.soHang);
  const daDat = useMemo(() => new Set((matBang?.khuVuc ?? []).map((h) => h.khuVucId)), [matBang]);
  const khuChuaDat = khuVucs.filter((k) => !daDat.has(k.id));
  const tong = tongMuc(viTris);

  const luu = async (moi, { thanhCong, hoanTac } = {}) => {
    const cu = matBang;
    setDangLuu(true);
    try {
      await onLuuMatBang(moi);
      if (thanhCong) {
        toast.success(thanhCong, hoanTac ? { action: { label: "Hoàn tác", onClick: () => luu(cu, { thanhCong: "Đã hoàn tác" }) } } : undefined);
      }
    } finally {
      setDangLuu(false);
    }
  };

  const batTatVe = () => {
    setThongBao(null);
    setVeLai(null);
    setDangVe((v) => !v);
    if (!dangVe) setVatChon(null);
  };

  const onVe = async ({ hinh, loi }) => {
    if (loi) {
      setThongBao({ tone: "bad", chu: loi });
      return;
    }
    setThongBao(null);
    if (veLai) {
      const vat = veLai;
      if (vat.loai === "khuVuc" && khuQuaNho(hinh)) {
        setThongBao({ tone: "bad", chu: `${THONG_BAO_KHU_QUA_NHO} Hãy kéo hình lớn hơn.` });
        return;
      }
      try {
        await luu(doiHinhVat(matBang, vat, hinh), { thanhCong: `Đã vẽ lại ${tenVat(vat)}`, hoanTac: true });
        setDangVe(false);
        setVeLai(null);
        setVatChon(vat);
      } catch (err) {
        setThongBao({ tone: "bad", chu: getApiErrorMessage(err, "Không lưu được mặt bằng. Vui lòng thử lại.") });
      }
      return;
    }
    setHinhMoi(hinh);
  };

  // Hộp "Đặt lên mặt bằng" trả lựa chọn: lỗi ném ra để hộp hiện tại chỗ
  const datLenMatBang = async (luaChon) => {
    const hinh = hinhMoi;
    let moi;
    let ten;
    let chon;
    if (luaChon.loai === "khuVuc") {
      const khuVucId = luaChon.khuMoi ? (await onTaoKhu(luaChon.khuMoi)).id : luaChon.khuVucId;
      ten = luaChon.khuMoi?.tenKhuVuc ?? tenKhu(khuVucId);
      moi = { ...matBang, khuVuc: [...(matBang.khuVuc ?? []), { khuVucId, ...hinh }] };
      chon = { loai: "khuVuc", id: khuVucId };
    } else {
      const vat = luaChon.loai === "cua" ? { ten: luaChon.ten, huong: luaChon.huong, ...hinh } : { ten: luaChon.ten, ...hinh };
      const ds = [...(matBang[luaChon.loai] ?? []), vat];
      ten = luaChon.ten;
      moi = { ...matBang, [luaChon.loai]: ds };
      chon = { loai: luaChon.loai, id: ds.length - 1 };
    }
    await luu(moi, { thanhCong: `Đã đặt ${ten} lên mặt bằng` });
    setHinhMoi(null);
    setDangVe(false);
    setVatChon(chon);
  };

  const goKhoiMatBang = async () => {
    if (!vatChon) return;
    const { loai, id } = vatChon;
    const ten = loai === "khuVuc" ? tenKhu(id) : matBang[loai]?.[id]?.ten;
    const moi =
      loai === "khuVuc"
        ? { ...matBang, khuVuc: matBang.khuVuc.filter((h) => h.khuVucId !== id) }
        : { ...matBang, [loai]: matBang[loai].filter((_, i) => i !== id) };
    try {
      await luu(moi, { thanhCong: `Đã gỡ ${ten} khỏi mặt bằng`, hoanTac: true });
      setVatChon(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được mặt bằng. Vui lòng thử lại."));
    }
  };

  // Dời vật tới chỗ mới (kéo thả hoặc nút mũi tên)
  const doiCho = async (vat, hinh, loiChong) => {
    if (loiChong) {
      setThongBao({ tone: "bad", chu: loiChong });
      return;
    }
    setThongBao(null);
    try {
      await luu(doiHinhVat(matBang, vat, hinh), {
        thanhCong: `Đã dời ${tenVat(vat)} tới cột ${hinh.x}, hàng ${hinh.y}`,
        hoanTac: true,
      });
      setVatChon(vat);
    } catch (err) {
      setThongBao({ tone: "bad", chu: getApiErrorMessage(err, "Không lưu được mặt bằng. Vui lòng thử lại.") });
    }
  };
  const dich1O = (vat, dx, dy) => {
    const goc = hinhCuaVat(matBang, vat);
    if (!goc) return;
    const hinh = { x: goc.x + dx, y: goc.y + dy, rong: goc.rong, cao: goc.cao };
    if (!trongLuoi(hinh, matBang)) {
      setThongBao({ tone: "bad", chu: `“${tenVat(vat)}” đã sát mép lưới, không dời thêm được.` });
      return;
    }
    const chong = vatBiChong(hinh, matBang, tenKhu, vat);
    doiCho(vat, hinh, chong ? `Không dời được “${tenVat(vat)}” vì chồng lên “${chong}”.` : "");
  };
  // Sửa tên / hướng cửa của lối đi, cửa, vật cố định
  const suaVat = async ({ ten, huong }) => {
    const vat = hopSuaVat;
    const ds = (matBang[vat.loai] ?? []).map((v, i) => (i === vat.id ? { ...v, ten, ...(huong ? { huong } : {}) } : v));
    await luu({ ...matBang, [vat.loai]: ds }, { thanhCong: `Đã lưu ${ten}`, hoanTac: true });
    setHopSuaVat(null);
  };

  const luuKichThuoc = async ({ soCot, soHang }) => {
    const moi = coMatBang ? { ...matBang, soCot, soHang } : matBangRong(soCot, soHang);
    await luu(moi, { thanhCong: coMatBang ? "Đã đổi kích thước lưới" : "Đã tạo mặt bằng kho" });
    setHopLuoi(false);
  };

  if (!coMatBang) {
    return (
      <>
        <DongThongBao
          actions={
            coTheSua ? (
              <Button onClick={() => setHopLuoi(true)} className={cn("h-8 gap-1.5", NUT_CHINH)}>
                <Grid3x3 className="size-4" />
                Tạo mặt bằng
              </Button>
            ) : null
          }
        >
          Kho này chưa có mặt bằng.{" "}
          {coTheSua ? "Tạo lưới rồi kéo để vẽ các khu, lối đi và cửa." : "Quản lý kho tạo mặt bằng để nhân viên tra chỗ để hàng."}
        </DongThongBao>
        <HopKichThuocLuoi open={hopLuoi} onOpenChange={setHopLuoi} matBang={null} tenKhu={tenKhu} onXacNhan={luuKichThuoc} />
      </>
    );
  }

  const soBaoTri = viTris.filter((v) => v.trangThai === "BAO_TRI").length;
  const ghiChuVe = veLai
    ? `Vẽ lại ${tenVat(veLai)}: kéo hình mới ở chỗ trống, hình cũ được thay khi thả.`
    : "Chế độ vẽ: nhấn giữ ở một góc trên lưới, kéo tới góc đối diện rồi thả. Không vẽ chồng lên khu khác, lối đi, cửa hay vật cố định.";

  return (
    <div className="flex flex-col gap-4">
      <MetricStrip
        label="Tổng quan mặt bằng"
        items={[
          {
            label: "Khu trên mặt bằng",
            value: `${daDat.size}/${khuVucs.length}`,
            hint: khuChuaDat.length ? `${khuChuaDat.length} khu chưa đặt` : "Đã đặt đủ các khu",
          },
          { label: "Vị trí kệ", value: dinhDangSo(viTris.length), hint: `${soBaoTri} đang bảo trì` },
          {
            label: "Đang chứa",
            value: `${dinhDangSo(tong.dangChua)} / ${dinhDangSo(tong.sucChua)}`,
            hint: "Sản phẩm, không tính kệ bảo trì",
          },
          { label: "Mức đầy chung", value: `${tong.phanTram}%`, hint: "Trên các kệ đang hoạt động", tone: toneSo(tong.phanTram) },
        ]}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bo-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-bo-heading">Mặt bằng kho</h2>
              <p className="text-xs text-bo-muted">
                Nhìn từ trên xuống · lưới {matBang.soCot} × {matBang.soHang} ô
              </p>
            </div>
            {coTheSua ? (
              <div className="flex flex-wrap gap-2">
                {dangVe ? (
                  <Button onClick={batTatVe} disabled={dangLuu} className={cn("h-9 gap-1.5", NUT_CHINH)}>
                    <Check className="size-4" />
                    Xong
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setHopLuoi(true)} disabled={dangLuu} className={cn("h-9 gap-1.5", NUT_PHU)}>
                      <Grid3x3 className="size-4" />
                      Kích thước lưới
                    </Button>
                    <Button variant="outline" onClick={batTatVe} disabled={dangLuu} className={cn("h-9 gap-1.5", NUT_PHU)}>
                      <Pencil className="size-4" />
                      Vẽ
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {dangVe || thongBao ? (
            <div className="border-b border-bo-border px-4 py-3">
              <DongThongBao tone={thongBao?.tone ?? "info"}>{thongBao?.chu ?? ghiChuVe}</DongThongBao>
            </div>
          ) : null}

          <LuoiMatBang
            matBang={matBang}
            khuVucs={khuVucs}
            viTris={viTris}
            cheDo="sua"
            dangVe={dangVe && !dangLuu}
            vatChon={vatChon}
            onChonVat={(v) => {
              setThongBao(null);
              setVatChon((cu) => (cu?.loai === v.loai && cu?.id === v.id ? null : v));
            }}
            boQua={veLai}
            onVe={onVe}
            choDiChuyen={coTheSua && !dangLuu}
            onDiChuyen={({ loai, id, hinh, loi }) => doiCho({ loai, id }, hinh, loi)}
          />

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-bo-border px-4 py-3">
            <ChuGiaiMucDay />
            <span className="text-xs text-bo-muted">
              {daDat.size} khu · {(matBang.cua ?? []).length} cửa · {(matBang.loiDi ?? []).length} lối đi
            </span>
          </div>
        </section>

        <BenPhai
          vatChon={dangVe ? null : vatChon}
          dangVe={dangVe}
          matBang={matBang}
          khuVucs={khuVucs}
          viTris={viTris}
          khuChuaDat={khuChuaDat}
          coTheSua={coTheSua}
          dangLuu={dangLuu}
          onMoSoDo={onMoSoDo}
          onVeLai={(vat) => {
            setThongBao(null);
            setVeLai(vat);
            setDangVe(true);
          }}
          onGo={goKhoiMatBang}
          onDich={dich1O}
          onSua={(vat) => {
            if (vat.loai === "khuVuc") onSuaKhu?.(khuVucs.find((k) => k.id === vat.id));
            else setHopSuaVat({ ...vat, ...(matBang[vat.loai] ?? [])[vat.id] });
          }}
        />
      </div>

      <HopDatLenMatBang
        open={Boolean(hinhMoi)}
        onOpenChange={(o) => !o && setHinhMoi(null)}
        hinh={hinhMoi}
        khuChuaDat={khuChuaDat}
        khuVucs={khuVucs}
        onXacNhan={datLenMatBang}
      />
      <HopKichThuocLuoi open={hopLuoi} onOpenChange={setHopLuoi} matBang={matBang} tenKhu={tenKhu} onXacNhan={luuKichThuoc} />
      <HopSuaVat open={Boolean(hopSuaVat)} onOpenChange={(o) => !o && setHopSuaVat(null)} vat={hopSuaVat} onXacNhan={suaVat} />
    </div>
  );
}

function KhungBen({ tieuDe, phu, children, chan }) {
  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm xl:sticky xl:top-4">
      <div className="border-b border-bo-border px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{tieuDe}</div>
        {phu ? <p className="mt-0.5 text-xs text-bo-muted">{phu}</p> : null}
      </div>
      {children}
      {chan ? <div className="mt-auto border-t border-bo-border bg-bo-surface-subtle p-3">{chan}</div> : null}
    </aside>
  );
}

const TieuDeNho = ({ children }) => <p className="text-xs font-semibold uppercase tracking-wide text-bo-muted">{children}</p>;

/** Bốn nút mũi tên dịch vật 1 ô (cho bàn phím / cảm ứng, thay cho kéo thả). Nút mờ khi đã sát mép lưới. */
function BanDich({ hinh, matBang, dangLuu, onDich }) {
  const nut = [
    ["Dời lên 1 ô", ArrowUp, 0, -1, "col-start-2"],
    ["Dời sang trái 1 ô", ArrowLeft, -1, 0, "col-start-1 row-start-2"],
    ["Dời xuống 1 ô", ArrowDown, 0, 1, "col-start-2 row-start-2"],
    ["Dời sang phải 1 ô", ArrowRight, 1, 0, "col-start-3 row-start-2"],
  ];
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs leading-5 text-bo-muted">
        Kéo trên mặt bằng để dời, hoặc bấm mũi tên để dịch từng ô. Đang ở cột {hinh.x}, hàng {hinh.y}.
      </p>
      <div role="group" aria-label="Dời vật" className="grid shrink-0 grid-cols-3 grid-rows-2 gap-1">
        {nut.map(([nhan, bieuTuong, dx, dy, viTri]) => {
          const toi = { ...hinh, x: hinh.x + dx, y: hinh.y + dy };
          return (
            <button
              key={nhan}
              type="button"
              title={nhan}
              aria-label={nhan}
              disabled={dangLuu || !trongLuoi(toi, matBang)}
              onClick={() => onDich(dx, dy)}
              className={cn(
                "grid size-8 place-items-center rounded-md border border-bo-border bg-white text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary disabled:cursor-not-allowed disabled:opacity-40",
                viTri,
              )}
            >
              {createElement(bieuTuong, { className: "size-4", "aria-hidden": true })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BenPhai({ vatChon, dangVe, matBang, khuVucs, viTris, khuChuaDat, coTheSua, dangLuu, onMoSoDo, onVeLai, onGo, onDich, onSua }) {
  const nutGo = (nhan) =>
    coTheSua ? (
      <Button variant="ghost" onClick={onGo} disabled={dangLuu} className="h-9 w-full gap-1.5 text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger">
        <Trash2 className="size-4" />
        {nhan}
      </Button>
    ) : null;
  const nutSuaVeLai = (vat) => (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => onSua(vat)} disabled={dangLuu} className={cn("h-9 gap-1.5", NUT_PHU)}>
        <PenLine className="size-4" />
        Sửa thông tin
      </Button>
      <Button variant="outline" onClick={() => onVeLai(vat)} disabled={dangLuu} className={cn("h-9 gap-1.5", NUT_PHU)}>
        <Pencil className="size-4" />
        Vẽ lại
      </Button>
    </div>
  );

  if (vatChon?.loai === "khuVuc") {
    const khu = khuVucs.find((k) => k.id === vatChon.id);
    const hinh = matBang.khuVuc?.find((h) => h.khuVucId === vatChon.id);
    if (khu && hinh) {
      const ds = viTris.filter((v) => v.khuVucId === khu.id);
      const muc = tongMuc(ds);
      const conCho = ds.filter((v) => nhomTrangThaiKe(v).ma === "CON_CHO").length;
      const canChuY = ds
        .filter((v) => v.trangThai === "BAO_TRI" || mucDay(v.dangChua, v.sucChua) >= NGUONG_SAP_DAY)
        .sort(
          (a, b) =>
            HANG_CHU_Y[nhomTrangThaiKe(a).ma] - HANG_CHU_Y[nhomTrangThaiKe(b).ma] ||
            mucDay(b.dangChua, b.sucChua) - mucDay(a.dangChua, a.sucChua),
        )
        .slice(0, SO_DONG_CAN_CHU_Y);
      return (
        <KhungBen
          tieuDe={
            <>
              <h2 className="truncate text-base font-semibold text-bo-heading">{khu.tenKhuVuc}</h2>
              {khu.loaiKhu ? <NhanLoai>{khu.loaiKhu}</NhanLoai> : null}
            </>
          }
          phu={
            <>
              <span className="font-mono">{khu.maKhuVuc}</span> · {hinh.rong} × {hinh.cao} ô · từ cột {hinh.x}, hàng {hinh.y}
            </>
          }
          chan={
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => onMoSoDo(khu.id)} disabled={!ds.length} className={cn("h-9", NUT_PHU)}>
                Xem sơ đồ kệ
              </Button>
              {coTheSua ? nutSuaVeLai(vatChon) : null}
              {nutGo("Gỡ khỏi mặt bằng")}
            </div>
          }
        >
          {coTheSua ? (
            <div className="border-b border-bo-border px-4 py-3">
              <BanDich hinh={hinh} matBang={matBang} dangLuu={dangLuu} onDich={(dx, dy) => onDich(vatChon, dx, dy)} />
            </div>
          ) : null}
          <DaiO soO={2} phang className="border-b border-bo-border">
            <div className="flex flex-col gap-1 bg-white px-4 py-3">
              <span className="text-xs font-medium text-bo-muted">Vị trí kệ</span>
              <span className="text-lg font-semibold tabular-nums text-bo-heading">{dinhDangSo(ds.length)}</span>
              <span className="text-xs text-bo-muted">{ds.length ? `${conCho} còn chỗ` : "Chưa tạo vị trí"}</span>
            </div>
            <div className="flex flex-col gap-1.5 bg-white px-4 py-3">
              <span className="text-xs font-medium text-bo-muted">Mức đầy</span>
              <span className="text-lg font-semibold tabular-nums text-bo-heading">{muc.phanTram}%</span>
              <ThanhMuc phanTram={muc.phanTram} tone={toneMucDay(muc.phanTram / 100)} />
            </div>
          </DaiO>
          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-2">
              <TieuDeNho>Dãy kệ</TieuDeNho>
              {ds.length ? (
                <ul className="divide-y divide-bo-border">
                  {nhomTheoDay(ds).map(({ day, hangs, tangs }) => {
                    const m = tongMuc(ds.filter((v) => v.day === day));
                    return (
                      <li key={day} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 py-2">
                        <span className="min-w-0">
                          <b className="block text-[13px] text-bo-heading">Dãy {day}</b>
                          <span className="text-xs text-bo-muted">
                            {hangs.length} hàng × {tangs.length} tầng
                          </span>
                        </span>
                        <span className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2">
                          <ThanhMuc phanTram={m.phanTram} tone={toneMucDay(m.phanTram / 100)} />
                          <span className="text-right text-xs tabular-nums text-slate-600">{m.phanTram}%</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-bo-muted">Chưa có dãy kệ trong khu này.</p>
              )}
            </div>
            {ds.length ? (
              <div className="flex flex-col gap-2">
                <TieuDeNho>Cần chú ý</TieuDeNho>
                {canChuY.length ? (
                  <ul className="divide-y divide-bo-border">
                    {canChuY.map((v) => {
                      const nhom = nhomTrangThaiKe(v);
                      const nhan = nhom.ma === "CON_CHO" ? `Sắp đầy · ${dinhDangSo(v.dangChua)}/${dinhDangSo(v.sucChua)}` : nhom.label;
                      return (
                        <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                          <span className="font-mono font-semibold text-bo-heading">{v.maViTri}</span>
                          <span className={cn("flex items-center gap-1.5", nhom.ma === "DAY" ? "text-bo-danger" : nhom.ma === "BAO_TRI" ? "text-bo-muted" : "text-amber-700")}>
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                            {nhan}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[13px] text-bo-muted">Không có vị trí đầy, sắp đầy hay bảo trì.</p>
                )}
              </div>
            ) : null}
          </div>
        </KhungBen>
      );
    }
  }

  if (vatChon && vatChon.loai !== "khuVuc") {
    const vat = matBang[vatChon.loai]?.[vatChon.id];
    if (vat) {
      const huong = vatChon.loai === "cua" ? HUONG_CUA.find((h) => h.ma === vat.huong)?.ten : null;
      return (
        <KhungBen
          tieuDe={
            <>
              <h2 className="truncate text-base font-semibold text-bo-heading">{vat.ten}</h2>
              <NhanLoai>{huong ?? tenLoaiVat(vatChon.loai)}</NhanLoai>
            </>
          }
          phu={`${vat.rong} × ${vat.cao} ô · từ cột ${vat.x}, hàng ${vat.y}`}
          chan={
            coTheSua ? (
              <div className="flex flex-col gap-2">
                {nutSuaVeLai(vatChon)}
                {nutGo("Xóa khỏi mặt bằng")}
              </div>
            ) : null
          }
        >
          {coTheSua ? (
            <div className="border-b border-bo-border px-4 py-3">
              <BanDich hinh={vat} matBang={matBang} dangLuu={dangLuu} onDich={(dx, dy) => onDich(vatChon, dx, dy)} />
            </div>
          ) : null}
          <p className="px-4 py-4 text-[13px] leading-5 text-slate-600">
            {vatChon.loai === "cua" && vat.huong === "VAO"
              ? "Chỉ đường tới khu và vị trí kệ bắt đầu từ cửa nhận hàng này."
              : vatChon.loai === "loiDi"
                ? "Lối đi chính được dùng để mô tả khu nằm phía trên hay phía dưới khi chỉ đường."
                : "Chỉ để nhân viên định hướng, không chứa hàng."}
          </p>
        </KhungBen>
      );
    }
  }

  return (
    <KhungBen tieuDe={<h2 className="text-sm font-semibold text-bo-heading">{dangVe ? "Vẽ trên mặt bằng" : "Chọn trên mặt bằng"}</h2>}>
      <div className="flex flex-col gap-4 px-4 py-4">
        {dangVe ? (
          <ol className="flex flex-col gap-2.5 text-[13px] text-bo-foreground">
            {["Nhấn giữ ở một góc trên lưới", "Kéo tới góc đối diện, khung xanh hiện kích thước", "Thả ra, chọn đó là khu vực, lối đi, cửa hay vật cố định"].map((buoc, i) => (
              <li key={buoc} className="flex items-start gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-bo-primary text-[11px] font-semibold text-bo-primary">{i + 1}</span>
                {buoc}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] leading-5 text-slate-600">
            Bấm vào một khu, cửa hoặc lối đi để xem chi tiết
            {coTheSua ? "; nhấn giữ rồi kéo để dời, hoặc chọn rồi sửa, vẽ lại, gỡ khỏi mặt bằng" : ""}.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <TieuDeNho>Khu chưa đặt lên mặt bằng · {khuChuaDat.length}</TieuDeNho>
          {khuChuaDat.length ? (
            <ul className="divide-y divide-bo-border">
              {khuChuaDat.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="truncate text-bo-foreground">{k.tenKhuVuc}</span>
                  <span className="shrink-0 font-mono text-xs text-bo-muted">{k.maKhuVuc}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-bo-muted">Đã đặt đủ các khu.</p>
          )}
        </div>
      </div>
    </KhungBen>
  );
}
