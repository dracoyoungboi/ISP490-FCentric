import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import {
  SO_VI_TRI_TOI_DA_MOI_LAN,
  TRANG_THAI_KE_CHON,
  khoangSo,
  maViTriKe,
  soHang2,
} from "@/constants/nhapKho";
import { viTriKhoService } from "@/services/viTriKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { KhungHop, NhomChon, Truong } from "./KhungHop";
import { O_NHAP, dinhDangSo } from "./kieuNhap";

const CACH_TAO = [
  { ma: "mot", ten: "Một vị trí" },
  { ma: "nhieu", ten: "Tạo hàng loạt" },
];

/**
 * Thêm vị trí kệ (một hoặc hàng loạt theo khoảng hàng × tầng) hoặc sửa một vị trí (FO-094).
 * Mã vị trí tự ghép từ Dãy - Hàng - Tầng. "Đầy" không chọn tay: hệ thống tự tính từ số đang chứa.
 * - viTriSua: vị trí đang sửa (null = thêm mới). Khi sửa không đổi được Dãy / Hàng / Tầng vì mã đã dán trên kệ.
 * - onDaLuu({ ds, laSua }): ds là các vị trí máy chủ trả về.
 * - onXoa(viTri): nút "Xóa vị trí" ở chân hộp khi sửa (chỉ bấm được khi kệ trống).
 */
export default function HopViTri({ open, onOpenChange, khoId, khuVucs, viTris, viTriSua, khuMacDinh, onDaLuu, onXoa }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoiDung
          khoId={khoId}
          khuVucs={khuVucs}
          viTris={viTris}
          viTriSua={viTriSua}
          khuMacDinh={khuMacDinh}
          onDong={() => onOpenChange(false)}
          onDaLuu={onDaLuu}
          onXoa={onXoa}
        />
      ) : null}
    </Dialog>
  );
}

const soNguyen = (v) => (v === "" ? NaN : Number(v));
const chiSo = (v) => v.replace(/\D/g, "").slice(0, 3);

function NoiDung({ khoId, khuVucs, viTris, viTriSua, khuMacDinh, onDong, onDaLuu, onXoa }) {
  const sua = Boolean(viTriSua);
  const [cach, setCach] = useState("mot");
  const [khuVucId, setKhuVucId] = useState(() => String(viTriSua?.khuVucId ?? khuMacDinh ?? khuVucs[0]?.id ?? ""));
  const [day, setDay] = useState(viTriSua?.day ?? "");
  const [hangTu, setHangTu] = useState(viTriSua ? String(Number(viTriSua.hang)) : "1");
  const [hangDen, setHangDen] = useState("1");
  const [tangTu, setTangTu] = useState(viTriSua ? String(Number(viTriSua.tang)) : "1");
  const [tangDen, setTangDen] = useState("1");
  const [sucChua, setSucChua] = useState(viTriSua ? String(viTriSua.sucChua ?? "") : "");
  const [trangThai, setTrangThai] = useState(viTriSua?.trangThai === "BAO_TRI" ? "BAO_TRI" : "HOAT_DONG");
  const [daGui, setDaGui] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiMayChu, setLoiMayChu] = useState("");

  const mot = sua || cach === "mot";
  const dayChuan = day.trim().toUpperCase();
  const maDaCo = useMemo(
    () => new Set(viTris.filter((v) => v.id !== viTriSua?.id).map((v) => String(v.maViTri).toUpperCase())),
    [viTris, viTriSua],
  );

  // Danh sách mã sẽ tạo (một mã hoặc khoảng hàng × tầng)
  const hangs = mot ? khoangSo(hangTu, hangTu) : khoangSo(hangTu, hangDen);
  const tangs = mot ? khoangSo(tangTu, tangTu) : khoangSo(tangTu, tangDen);
  const maSeTao = dayChuan ? hangs.flatMap((h) => tangs.map((t) => maViTriKe(dayChuan, h, t))) : [];
  const maMoi = maSeTao.filter((ma) => !maDaCo.has(ma));
  const soTrung = maSeTao.length - maMoi.length;

  const sc = soNguyen(sucChua);
  const dangChua = Number(viTriSua?.dangChua || 0);
  const loi = {};
  if (!khuVucId) loi.khu = "Chọn khu vực.";
  if (!sua) {
    if (!dayChuan) loi.day = "Nhập dãy.";
    else if (!/^[A-Z0-9]{1,4}$/.test(dayChuan)) loi.day = "Dãy chỉ gồm chữ không dấu hoặc số, tối đa 4 ký tự.";
    if (!hangs.length) loi.hang = mot ? "Hàng là số từ 1." : "Khoảng hàng chưa hợp lệ.";
    if (!tangs.length) loi.tang = mot ? "Tầng là số từ 1." : "Khoảng tầng chưa hợp lệ.";
    if (!loi.day && !loi.hang && !loi.tang) {
      if (mot && soTrung) loi.ma = `Mã ${maSeTao[0]} đã có trong kho.`;
      else if (!mot && maSeTao.length > SO_VI_TRI_TOI_DA_MOI_LAN) loi.ma = `Mỗi lần tạo tối đa ${SO_VI_TRI_TOI_DA_MOI_LAN} vị trí.`;
      else if (!mot && !maMoi.length) loi.ma = "Tất cả mã trong khoảng này đã có.";
    }
  }
  if (!Number.isInteger(sc) || sc < 1) loi.sucChua = "Sức chứa là số nguyên từ 1.";
  else if (sua && sc < dangChua) loi.sucChua = `Kệ đang chứa ${dinhDangSo(dangChua)} sản phẩm, sức chứa không được nhỏ hơn.`;
  const hopLe = Object.keys(loi).length === 0;

  const luu = async () => {
    setDaGui(true);
    if (!hopLe) return;
    setDangLuu(true);
    setLoiMayChu("");
    try {
      let ketQua;
      if (sua) {
        ketQua = await viTriKhoService.suaViTri(khoId, viTriSua.id, { khuVucId: Number(khuVucId), sucChua: sc, trangThai });
      } else if (mot) {
        ketQua = await viTriKhoService.taoViTri(khoId, {
          khuVucId: Number(khuVucId),
          maViTri: maSeTao[0],
          day: dayChuan,
          hang: soHang2(hangs[0]),
          tang: soHang2(tangs[0]),
          sucChua: sc,
          trangThai,
        });
      } else {
        ketQua = await viTriKhoService.taoViTri(khoId, {
          khuVucId: Number(khuVucId),
          day: dayChuan,
          hangTu: hangs[0],
          hangDen: hangs[hangs.length - 1],
          tangTu: tangs[0],
          tangDen: tangs[tangs.length - 1],
          sucChua: sc,
          trangThai,
        });
      }
      const ds = Array.isArray(ketQua) ? ketQua : ketQua ? [ketQua] : [];
      onDaLuu({ ds, laSua: sua });
    } catch (err) {
      setLoiMayChu(getApiErrorMessage(err, "Không lưu được vị trí kệ. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  const loiHien = daGui ? loi : {};
  const xemTruoc = (() => {
    if (!dayChuan || !hangs.length || !tangs.length) return { nhan: "Mã vị trí", gt: "—" };
    if (mot) return { nhan: "Mã vị trí", gt: maSeTao[0] };
    return {
      nhan: `Sẽ tạo ${dinhDangSo(maMoi.length)} vị trí`,
      gt: `${maSeTao[0]} → ${maSeTao[maSeTao.length - 1]}`,
    };
  })();

  return (
    <KhungHop
      tieuDe={sua ? `Sửa vị trí ${viTriSua.maViTri}` : "Thêm vị trí kệ"}
      moTa={sua ? "Dãy, hàng, tầng không đổi được vì mã đã dán trên kệ." : "Mỗi vị trí là một ô trên kệ: dãy → hàng (cột kệ) → tầng."}
      onHuy={onDong}
      onGui={luu}
      nhanGui={sua ? "Lưu thay đổi" : mot ? "Lưu vị trí" : "Tạo các vị trí"}
      dangGui={dangLuu}
      chanTrai={
        sua && onXoa ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onXoa(viTriSua)}
            disabled={dangLuu || dangChua > 0}
            title={dangChua > 0 ? `Kệ còn ${dinhDangSo(dangChua)} sản phẩm, chuyển hàng đi trước khi xóa` : undefined}
            className="h-9 gap-1.5 px-2 text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
          >
            <Trash2 className="size-4" />
            Xóa vị trí
          </Button>
        ) : null
      }
    >
      {sua ? null : <NhomChon nhan="Cách tạo" value={cach} onChange={setCach} luaChon={CACH_TAO} day />}

      <Truong nhan="Khu vực" htmlFor="vt-khu" loi={loiHien.khu}>
        <select id="vt-khu" value={khuVucId} onChange={(e) => setKhuVucId(e.target.value)} className={O_NHAP}>
          {khuVucs.map((k) => (
            <option key={k.id} value={k.id}>
              {k.tenKhuVuc} · {k.maKhuVuc}
            </option>
          ))}
        </select>
      </Truong>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Truong nhan="Dãy" htmlFor="vt-day" loi={loiHien.day}>
          <input
            id="vt-day"
            value={day}
            disabled={sua}
            onChange={(e) => setDay(e.target.value.toUpperCase())}
            placeholder="VD: A"
            aria-invalid={Boolean(loiHien.day)}
            className={`${O_NHAP} font-mono`}
          />
        </Truong>
        <div className="grid grid-cols-2 gap-4">
          <Truong nhan={mot ? "Hàng" : "Hàng (từ – đến)"} htmlFor="vt-hang" loi={loiHien.hang}>
            <KhoangNhap id="vt-hang" mot={mot} tu={hangTu} den={hangDen} onTu={setHangTu} onDen={setHangDen} disabled={sua} nhan="Hàng" />
          </Truong>
          <Truong nhan={mot ? "Tầng" : "Tầng (từ – đến)"} htmlFor="vt-tang" loi={loiHien.tang}>
            <KhoangNhap id="vt-tang" mot={mot} tu={tangTu} den={tangDen} onTu={setTangTu} onDen={setTangDen} disabled={sua} nhan="Tầng" />
          </Truong>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-bo-border bg-bo-surface-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-bo-muted">{xemTruoc.nhan}</p>
          <p className="truncate font-mono text-base font-semibold text-bo-heading">{xemTruoc.gt}</p>
        </div>
        <p className="text-xs text-bo-muted">
          {mot ? "Tự ghép từ Dãy - Hàng - Tầng · tầng 01 sát sàn" : soTrung ? `Bỏ qua ${dinhDangSo(soTrung)} mã đã có` : "Bỏ qua mã đã có"}
        </p>
      </div>
      {loiHien.ma ? <p className="-mt-2 text-xs text-bo-danger">{loiHien.ma}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Truong
          nhan="Sức chứa tối đa"
          htmlFor="vt-suc-chua"
          loi={loiHien.sucChua}
          goiY={sua ? `Đang chứa ${dinhDangSo(dangChua)} sản phẩm` : "Số sản phẩm tối đa trên một vị trí"}
        >
          <input
            id="vt-suc-chua"
            inputMode="numeric"
            value={sucChua}
            onChange={(e) => setSucChua(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="VD: 40"
            aria-invalid={Boolean(loiHien.sucChua)}
            className={`${O_NHAP} tabular-nums`}
          />
        </Truong>
        <Truong nhan="Trạng thái" htmlFor="vt-trang-thai" goiY="“Đầy” do hệ thống tự gắn khi đang chứa bằng sức chứa">
          <select id="vt-trang-thai" value={trangThai} onChange={(e) => setTrangThai(e.target.value)} className={O_NHAP}>
            {TRANG_THAI_KE_CHON.map((t) => (
              <option key={t.ma} value={t.ma}>
                {t.ten}
              </option>
            ))}
          </select>
        </Truong>
      </div>

      {loiMayChu ? <DongThongBao tone="bad">{loiMayChu}</DongThongBao> : null}
    </KhungHop>
  );
}

function KhoangNhap({ id, mot, tu, den, onTu, onDen, disabled, nhan }) {
  const o = `${O_NHAP} text-center font-mono tabular-nums`;
  if (mot) {
    return <input id={id} inputMode="numeric" value={tu} disabled={disabled} onChange={(e) => onTu(chiSo(e.target.value))} className={o} />;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <input id={id} aria-label={`${nhan} từ`} inputMode="numeric" value={tu} onChange={(e) => onTu(chiSo(e.target.value))} className={o} />
      <input aria-label={`${nhan} đến`} inputMode="numeric" value={den} onChange={(e) => onDen(chiSo(e.target.value))} className={o} />
    </div>
  );
}
