import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { NGUONG_SAP_DAY, mucDay } from "@/constants/nhapKho";
import { hinhTuHaiO, nhomTheoDay, vatBiChong, vungLuoi } from "@/components/mat-bang/matBang";

// Nhích quá ngần này điểm ảnh mới tính là kéo (dưới mức này là bấm để chọn)
const NGUONG_KEO_PX = 5;

/**
 * Ô lưới dưới tọa độ màn hình, tính theo vị trí ô đầu và ô cuối (không phụ thuộc phần tử nằm trên,
 * kể cả khi con trỏ rơi vào khe hở giữa hai ô). `kep`: ngoài lưới thì kẹp về ô sát mép thay vì trả null.
 */
function oTaiToaDo(luoi, soCot, soHang, x, y, kep = false) {
  const dau = luoi?.querySelector('[data-o="1,1"]')?.getBoundingClientRect();
  const cuoi = luoi?.querySelector(`[data-o="${soCot},${soHang}"]`)?.getBoundingClientRect();
  if (!dau || !cuoi) return null;
  const buocX = soCot > 1 ? (cuoi.left - dau.left) / (soCot - 1) : dau.width;
  const buocY = soHang > 1 ? (cuoi.top - dau.top) / (soHang - 1) : dau.height;
  let cot = Math.floor((x - dau.left) / buocX) + 1;
  let hang = Math.floor((y - dau.top) / buocY) + 1;
  const ngoai = cot < 1 || hang < 1 || cot > soCot || hang > soHang;
  if (ngoai && !kep) return null;
  cot = Math.min(Math.max(cot, 1), soCot);
  hang = Math.min(Math.max(hang, 1), soHang);
  return [cot, hang];
}

/**
 * Mặt bằng kho nhìn từ trên xuống (FO-094 PA3).
 * - cheDo "sua": bấm khu / cửa / lối đi / vật cố định để chọn (`vatChon` = { loai, id }: id là khuVucId với khu,
 *   là thứ tự trong mảng với các vật khác); `dangVe` bật thì nhấn giữ trên lưới và kéo để vẽ (chuột hoặc cảm ứng).
 *   `boQua` ({ loai, id }): vật đang được vẽ lại, không tính là vật cản.
 *   `choDiChuyen`: nhấn giữ một vật rồi kéo để dời (chuột: mọi vật; cảm ứng: vật đang chọn, để vẫn cuộn được trang);
 *   thả ra gọi `onDiChuyen({ loai, id, hinh, loi })` — `loi` khác rỗng khi chỗ mới chồng lên vật khác.
 * - cheDo "xem": chỉ xem để chỉ đường; `khuNoiBat` viền xanh, khu khác mờ; `viTriNoiBat` nhấp nháy.
 * Mỗi khu vẽ thu nhỏ các dãy kệ: một ô vuông là một vị trí, phần tô là mức đầy.
 */
export default function LuoiMatBang({
  matBang,
  khuVucs,
  viTris,
  cheDo = "xem",
  dangVe = false,
  vatChon,
  onChonVat,
  boQua,
  onVe,
  choDiChuyen = false,
  onDiChuyen,
  khuNoiBat,
  viTriNoiBat,
}) {
  const soCot = Number(matBang?.soCot) || 0;
  const soHang = Number(matBang?.soHang) || 0;
  const sua = cheDo === "sua";
  const [keo, setKeo] = useState(null);
  const dangKeo = keo !== null;
  const keoRef = useRef(null);
  // Dời vật: { loai, id, ten, hinhGoc, o0, px0, py0, dx, dy, daKeo }
  const [doi, setDoi] = useState(null);
  const dangGiu = doi !== null;
  const doiRef = useRef(null);
  const vuaKeoRef = useRef(false);
  const luoiRef = useRef(null);
  const oTai = (x, y, kep) => oTaiToaDo(luoiRef.current, soCot, soHang, x, y, kep);
  const goiLaiRef = useRef({ onVe, onDiChuyen });
  useEffect(() => {
    goiLaiRef.current = { onVe, onDiChuyen };
  });

  const tenKhu = (id) => khuVucs?.find((k) => k.id === id)?.tenKhuVuc ?? "khu khác";

  // Kéo để vẽ: theo dõi con trỏ trên cả trang (cảm ứng giữ con trỏ ở ô bắt đầu nên dò ô theo tọa độ)
  useEffect(() => {
    if (!dangKeo) return undefined;
    const diChuyen = (e) => {
      const o = oTai(e.clientX, e.clientY, true);
      const cu = keoRef.current;
      if (!o || !cu || (o[0] === cu.x1 && o[1] === cu.y1)) return;
      keoRef.current = { ...cu, x1: o[0], y1: o[1] };
      setKeo(keoRef.current);
    };
    const tha = () => {
      const cu = keoRef.current;
      keoRef.current = null;
      setKeo(null);
      if (!cu) return;
      const hinh = hinhTuHaiO(cu.x0, cu.y0, cu.x1, cu.y1);
      const chong = vatBiChong(hinh, matBang, tenKhu, boQua);
      goiLaiRef.current.onVe?.({ hinh, loi: chong ? `Hình vừa vẽ chồng lên “${chong}”. Hãy vẽ ở chỗ trống.` : "" });
    };
    window.addEventListener("pointermove", diChuyen);
    window.addEventListener("pointerup", tha);
    window.addEventListener("pointercancel", tha);
    return () => {
      window.removeEventListener("pointermove", diChuyen);
      window.removeEventListener("pointerup", tha);
      window.removeEventListener("pointercancel", tha);
    };
    // Chỉ gắn một lần mỗi lượt kéo (mặt bằng không đổi trong lúc kéo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangKeo]);

  // Kéo để dời một vật: hình giữ nguyên kích thước, luôn nằm trong lưới
  useEffect(() => {
    if (!dangGiu) return undefined;
    const diChuyen = (e) => {
      const cu = doiRef.current;
      if (!cu) return;
      if (!cu.daKeo && Math.hypot(e.clientX - cu.px0, e.clientY - cu.py0) < NGUONG_KEO_PX) return;
      const o = oTai(e.clientX, e.clientY, true);
      if (!o) return;
      const g = cu.hinhGoc;
      const dx = Math.min(Math.max(o[0] - cu.o0[0], 1 - g.x), soCot - g.rong + 1 - g.x);
      const dy = Math.min(Math.max(o[1] - cu.o0[1], 1 - g.y), soHang - g.cao + 1 - g.y);
      if (cu.daKeo && dx === cu.dx && dy === cu.dy) return;
      doiRef.current = { ...cu, dx, dy, daKeo: true };
      setDoi(doiRef.current);
    };
    const tha = (e) => {
      const cu = doiRef.current;
      doiRef.current = null;
      setDoi(null);
      if (!cu?.daKeo || e.type === "pointercancel") return;
      // Thả sau khi kéo: bỏ qua cú "click" trình duyệt bắn ra ngay sau đó
      vuaKeoRef.current = true;
      if (!cu.dx && !cu.dy) return;
      const hinh = { ...cu.hinhGoc, x: cu.hinhGoc.x + cu.dx, y: cu.hinhGoc.y + cu.dy };
      const chong = vatBiChong(hinh, matBang, tenKhu, { loai: cu.loai, id: cu.id });
      goiLaiRef.current.onDiChuyen?.({
        loai: cu.loai,
        id: cu.id,
        hinh,
        loi: chong ? `Không dời được “${cu.ten}” tới đó vì chồng lên “${chong}”.` : "",
      });
    };
    window.addEventListener("pointermove", diChuyen);
    window.addEventListener("pointerup", tha);
    window.addEventListener("pointercancel", tha);
    return () => {
      window.removeEventListener("pointermove", diChuyen);
      window.removeEventListener("pointerup", tha);
      window.removeEventListener("pointercancel", tha);
    };
    // Chỉ gắn một lần mỗi lượt kéo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangGiu]);

  if (!soCot || !soHang) return null;

  const batDauKeo = (e) => {
    if (!sua || !dangVe) return;
    const o = oTai(e.clientX, e.clientY);
    if (!o) return;
    e.preventDefault();
    const [x, y] = o;
    keoRef.current = { x0: x, y0: y, x1: x, y1: y };
    setKeo(keoRef.current);
  };

  const hinhKeo = keo ? hinhTuHaiO(keo.x0, keo.y0, keo.x1, keo.y1) : null;
  const keoLoi = hinhKeo ? vatBiChong(hinhKeo, matBang, tenKhu, boQua) : "";
  const chonDuoc = sua && !dangVe;
  const dangChon = (loai, id) => chonDuoc && vatChon?.loai === loai && vatChon?.id === id;
  const dangDoi = (loai, id) => Boolean(doi?.daKeo) && doi.loai === loai && doi.id === id;
  const hinhDoi = doi?.daKeo ? { ...doi.hinhGoc, x: doi.hinhGoc.x + doi.dx, y: doi.hinhGoc.y + doi.dy } : null;
  const doiLoi = hinhDoi ? vatBiChong(hinhDoi, matBang, tenKhu, { loai: doi.loai, id: doi.id }) : "";

  const chon = (vat) => {
    // Vừa kéo dời xong thì không tính là bấm chọn
    if (vuaKeoRef.current) {
      vuaKeoRef.current = false;
      return;
    }
    onChonVat?.(vat);
  };
  const batDauDoi = (e, loai, id, ten, hinhGoc) => {
    if (!chonDuoc || !choDiChuyen || e.button !== 0) return;
    // Cảm ứng: chỉ dời vật đang chọn, để kéo trên vật khác vẫn cuộn được trang
    if (e.pointerType === "touch" && !dangChon(loai, id)) return;
    const o0 = oTai(e.clientX, e.clientY, true);
    if (!o0) return;
    vuaKeoRef.current = false;
    doiRef.current = { loai, id, ten, hinhGoc, o0, px0: e.clientX, py0: e.clientY, dx: 0, dy: 0, daKeo: false };
    setDoi(doiRef.current);
  };
  // Cửa, lối đi, vật cố định: ở chế độ sửa bấm được để chọn (và kéo để dời), còn lại chỉ để xem
  const vatBam = (loai, id, vat) =>
    chonDuoc
      ? {
          role: "button",
          tabIndex: 0,
          "aria-pressed": dangChon(loai, id),
          "aria-label": `${vat.ten}, bấm để chọn${choDiChuyen ? ", kéo để dời" : ""}`,
          onClick: () => chon({ loai, id }),
          onPointerDown: (e) => batDauDoi(e, loai, id, vat.ten, vat),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChonVat?.({ loai, id });
            }
          },
        }
      : {};
  const kieuBam = (loai, id) =>
    cn(
      chonDuoc ? "outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30" : "pointer-events-none",
      chonDuoc && (choDiChuyen ? "cursor-grab" : "cursor-pointer"),
      choDiChuyen && dangChon(loai, id) && "touch-none",
      dangDoi(loai, id) && "opacity-30",
    );

  const o = [];
  for (let x = 1; x <= soCot; x++) {
    o.push(<span key={`c${x}`} data-thuoc="" className="grid place-items-center text-[10px] tabular-nums text-slate-400" style={{ gridArea: `1 / ${x + 1}` }}>{x}</span>);
  }
  for (let y = 1; y <= soHang; y++) {
    o.push(<span key={`r${y}`} data-thuoc="" className="grid place-items-center text-[10px] tabular-nums text-slate-400" style={{ gridArea: `${y + 1} / 1` }}>{y}</span>);
    for (let x = 1; x <= soCot; x++) {
      o.push(
        <span
          key={`${x}-${y}`}
          data-o={sua ? `${x},${y}` : undefined}
          className={cn("rounded-[3px]", sua && dangVe ? "cursor-crosshair bg-slate-100 hover:bg-blue-100" : "bg-[#f7f9fb]")}
          style={{ gridArea: `${y + 1} / ${x + 1}` }}
        />,
      );
    }
  }

  return (
    <div className="overflow-x-auto px-2 pb-4 pt-2">
      <div
        ref={luoiRef}
        onPointerDown={batDauKeo}
        className={cn(
          "relative grid select-none gap-1",
          sua && dangVe && "touch-none",
          doi?.daKeo && "cursor-grabbing [&_*]:cursor-grabbing",
          !(sua && (dangVe || doi?.daKeo)) && "[&>[data-thuoc]]:invisible",
        )}
        style={{
          gridTemplateColumns: `20px repeat(${soCot}, minmax(20px, 1fr))`,
          gridTemplateRows: `20px repeat(${soHang}, 32px)`,
          minWidth: 20 + soCot * 24,
        }}
      >
        {o}

        {/* Tường bao */}
        <span
          aria-hidden="true"
          className="pointer-events-none -m-2 rounded-lg border-2 border-[#9aa7b8]"
          style={{ gridArea: `2 / 2 / span ${soHang} / span ${soCot}` }}
        />

        {(matBang.loiDi ?? []).map((l, i) => (
          <span
            key={`loi-di-${i}-${l.x}-${l.y}`}
            {...vatBam("loiDi", i, l)}
            title={l.ten}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 before:flex-1 before:border-t before:border-dashed before:border-slate-300 after:flex-1 after:border-t after:border-dashed after:border-slate-300",
              kieuBam("loiDi", i),
              chonDuoc && "hover:bg-slate-100",
              dangChon("loiDi", i) && "bg-blue-50 text-bo-primary ring-2 ring-bo-primary/25",
            )}
            style={{ gridArea: vungLuoi(l) }}
          >
            <span className="truncate">{l.ten}</span>
          </span>
        ))}

        {(matBang.vatCoDinh ?? []).map((v, i) => (
          <span
            key={`vat-${i}-${v.x}-${v.y}`}
            {...vatBam("vatCoDinh", i, v)}
            title={v.ten}
            className={cn(
              "grid place-items-center overflow-hidden rounded-md border border-slate-300 bg-[repeating-linear-gradient(135deg,#f8fafc_0_6px,#eef2f6_6px_12px)] px-1 text-center text-xs font-medium text-slate-600",
              kieuBam("vatCoDinh", i),
              chonDuoc && "hover:border-slate-500",
              dangChon("vatCoDinh", i) && "border-bo-primary ring-2 ring-bo-primary/25",
            )}
            style={{ gridArea: vungLuoi(v) }}
          >
            <span className="max-w-full truncate">{v.ten}</span>
          </span>
        ))}

        {(matBang.cua ?? []).map((c, i) => (
          <span
            key={`cua-${i}-${c.x}-${c.y}`}
            {...vatBam("cua", i, c)}
            title={c.ten}
            className={cn(
              "relative z-[2] -mb-2.5 flex items-center justify-center gap-1.5 rounded-t-md border border-b-[3px] border-dashed border-[#9aa7b8] border-b-white bg-white px-1 text-xs font-semibold text-slate-600",
              kieuBam("cua", i),
              chonDuoc && "hover:border-slate-500",
              dangChon("cua", i) && "border-bo-primary text-bo-primary",
              !sua && khuNoiBat && c.huong === "VAO" && "border-bo-primary text-bo-primary",
            )}
            style={{ gridArea: vungLuoi(c) }}
          >
            <ArrowDownToLine className={cn("size-3.5 shrink-0", c.huong === "RA" && "rotate-180")} aria-hidden="true" />
            <span className="truncate">{c.ten}</span>
          </span>
        ))}

        {(matBang.khuVuc ?? []).map((hinh) => {
          const khu = khuVucs?.find((k) => k.id === hinh.khuVucId);
          if (!khu) return null;
          const viTriKhu = (viTris ?? []).filter((v) => v.khuVucId === khu.id);
          const conHoatDong = viTriKhu.filter((v) => v.trangThai !== "BAO_TRI");
          const dangChua = conHoatDong.reduce((t, v) => t + Number(v.dangChua || 0), 0);
          const sucChua = conHoatDong.reduce((t, v) => t + Number(v.sucChua || 0), 0);
          const phanTram = Math.round(mucDay(dangChua, sucChua) * 100);
          const coNoiDung = hinh.cao >= 4;
          const coChan = hinh.cao >= 2;
          // Khu hẹp (dưới 4 cột) chỉ giữ tên, để chữ không bị bẻ dọc
          const coDuoi = hinh.cao >= 3 && hinh.rong >= 4;
          const coNhan = hinh.rong >= 6;
          const noiBat = khuNoiBat === khu.id;
          const daChon = dangChon("khuVuc", khu.id);
          const dangVeLai = sua && dangVe && boQua?.loai === "khuVuc" && boQua?.id === khu.id;
          const TheKhu = sua ? "button" : "div";
          return (
            <TheKhu
              key={khu.id}
              type={sua ? "button" : undefined}
              onClick={sua ? () => chon({ loai: "khuVuc", id: khu.id }) : undefined}
              onPointerDown={sua ? (e) => batDauDoi(e, "khuVuc", khu.id, khu.tenKhuVuc, hinh) : undefined}
              aria-pressed={sua ? daChon : undefined}
              aria-label={`${khu.tenKhuVuc}, ${viTriKhu.length} vị trí, đầy ${phanTram}%`}
              title={khu.tenKhuVuc}
              className={cn(
                "relative z-[1] flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border bg-white px-2.5 py-2 text-left shadow-sm",
                viTriKhu.length ? "border-slate-300" : "border-dashed border-slate-300",
                sua && !dangVe && cn(choDiChuyen ? "cursor-grab" : "cursor-pointer", "hover:border-slate-500"),
                sua && dangVe && "pointer-events-none opacity-75",
                choDiChuyen && daChon && "touch-none",
                dangVeLai && "border-dashed opacity-40",
                dangDoi("khuVuc", khu.id) && "opacity-30",
                daChon && "border-bo-primary ring-2 ring-bo-primary/25",
                noiBat && "border-bo-primary ring-[3px] ring-bo-primary/25",
                !sua && khuNoiBat && !noiBat && "opacity-40 shadow-none",
              )}
              style={{ gridArea: vungLuoi(hinh) }}
            >
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold leading-[18px] text-bo-heading">{khu.tenKhuVuc}</span>
                {coNhan && khu.loaiKhu ? (
                  <span className="shrink-0 rounded border border-bo-border bg-slate-100 px-1.5 text-[11px] font-medium leading-[18px] text-slate-600">
                    {khu.loaiKhu}
                  </span>
                ) : null}
              </span>
              {/* Khu đang chỉ đường: bỏ mã khu và dòng chân để dãy kệ phóng to (có nhãn tầng / hàng) đủ chỗ */}
              {coChan && !noiBat ? <span className="truncate font-mono text-[11px] leading-[14px] text-bo-muted">{khu.maKhuVuc}</span> : null}
              {coNoiDung ? (
                <span className="flex min-h-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-1">
                  {viTriKhu.length ? (
                    <DayKeThuNho viTris={viTriKhu} noiBat={noiBat ? viTriNoiBat : null} />
                  ) : hinh.rong >= 4 ? (
                    <span className="text-xs text-bo-muted">Chưa có vị trí kệ</span>
                  ) : null}
                </span>
              ) : null}
              {coDuoi && !noiBat ? (
                <span className="mt-auto flex items-center justify-between gap-2 border-t border-bo-border pt-1.5 text-xs text-bo-muted">
                  <span>{viTriKhu.length} vị trí</span>
                  {viTriKhu.length ? (
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        phanTram >= 100 ? "text-bo-danger" : phanTram >= NGUONG_SAP_DAY * 100 ? "text-bo-warning" : "text-bo-heading",
                      )}
                    >
                      {phanTram}%
                    </span>
                  ) : null}
                </span>
              ) : null}
            </TheKhu>
          );
        })}

        {hinhKeo ? (
          <span
            className={cn(
              "pointer-events-none relative z-[3] grid place-items-center rounded-md border-2 border-dashed",
              keoLoi ? "border-bo-danger bg-red-500/5" : "border-bo-primary bg-blue-500/10",
            )}
            style={{ gridArea: vungLuoi(hinhKeo) }}
          >
            <em
              className={cn(
                "rounded bg-white px-1.5 py-0.5 text-xs font-semibold not-italic shadow-sm",
                keoLoi ? "text-bo-danger" : "text-blue-700",
              )}
            >
              {keoLoi ? "Chồng lên khu khác" : `${hinhKeo.rong} × ${hinhKeo.cao} ô`}
            </em>
          </span>
        ) : null}

        {hinhDoi ? (
          <span
            className={cn(
              "pointer-events-none relative z-[3] grid place-items-center overflow-hidden rounded-md border-2 border-dashed",
              doiLoi ? "border-bo-danger bg-red-500/5" : "border-bo-primary bg-blue-500/10",
            )}
            style={{ gridArea: vungLuoi(hinhDoi) }}
          >
            <em
              className={cn(
                "max-w-full truncate rounded bg-white px-1.5 py-0.5 text-xs font-semibold not-italic shadow-sm",
                doiLoi ? "text-bo-danger" : "text-blue-700",
              )}
            >
              {doiLoi ? `Chồng lên “${doiLoi}”` : `Cột ${hinhDoi.x}, hàng ${hinhDoi.y}`}
            </em>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Dãy kệ thu nhỏ trong một khu. Khu chứa vị trí cần tìm thì ô to hơn, có nhãn tầng (T) và hàng (H). */
function DayKeThuNho({ viTris, noiBat }) {
  return nhomTheoDay(viTris).map(({ day, hangs, tangs, tim }) => {
    const coNhan = Boolean(noiBat) && viTris.some((v) => v.id === noiBat && v.day === day);
    const kichThuoc = coNhan ? 22 : 16;
    return (
      <span key={day} className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-bo-muted [writing-mode:vertical-rl] rotate-180">Dãy {day}</span>
        <span
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `${coNhan ? "auto " : ""}repeat(${hangs.length}, ${kichThuoc}px)` }}
        >
          {tangs.map((tang) => [
            coNhan ? <span key={`t${tang}`} className="pr-0.5 text-[10px] font-semibold tabular-nums text-bo-muted">T{tang}</span> : null,
            ...hangs.map((hang) => {
              const v = tim(hang, tang);
              return <OViTri key={`${hang}-${tang}`} viTri={v} kichThuoc={kichThuoc} noiBat={v && v.id === noiBat} />;
            }),
          ])}
          {coNhan ? [<span key="goc" />, ...hangs.map((h) => <span key={`h${h}`} className="text-center text-[10px] font-semibold tabular-nums text-bo-muted">H{h}</span>)] : null}
        </span>
      </span>
    );
  });
}

function OViTri({ viTri, kichThuoc, noiBat }) {
  if (!viTri) return <span style={{ width: kichThuoc, height: kichThuoc }} className="invisible" />;
  const baoTri = viTri.trangThai === "BAO_TRI";
  const muc = mucDay(viTri.dangChua, viTri.sucChua);
  return (
    <span
      title={`${viTri.maViTri} · ${baoTri ? "Bảo trì" : `${viTri.dangChua ?? 0}/${viTri.sucChua ?? 0}`}`}
      className={cn(
        "relative inline-block overflow-hidden rounded-[3px] border bg-white",
        baoTri ? "border-dashed border-slate-300 bg-bo-surface-subtle" : "border-slate-300",
        noiBat && "z-[1] animate-pulse border-bo-primary ring-2 ring-bo-primary ring-offset-2",
      )}
      style={{ width: kichThuoc, height: kichThuoc }}
    >
      {baoTri ? null : (
        <span
          className={cn("absolute inset-x-0 bottom-0", muc >= 1 ? "bg-bo-danger" : muc >= NGUONG_SAP_DAY ? "bg-amber-600" : "bg-bo-primary")}
          style={{ height: `${Math.round(muc * 100)}%` }}
        />
      )}
    </span>
  );
}
