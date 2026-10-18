import { cn } from "@/lib/utils";

/** Một ô của dải tóm tắt (cùng kiểu TinhHinhNcc): nhãn nhỏ, giá trị, dòng phụ. */
function O({ nhan, giaTri, phu, mauGiaTri, children }) {
  return (
    <div className="min-w-0 border-bo-border/70 px-4 py-3.5 odd:border-r @max-4xl:[&:nth-child(-n+2)]:border-b sm:px-6 sm:py-4 @4xl:border-r @4xl:last:border-r-0">
      <div className="text-xs font-medium leading-4 text-bo-muted">{nhan}</div>
      <div className={cn("mt-1 flex min-w-0 items-center gap-2.5 text-base font-semibold leading-6 text-bo-foreground", mauGiaTri)}>
        {/* Có mã vạch thì giá trị (vd. 6/23) không bị cắt; mã vạch nhường chỗ */}
        <span className={cn("truncate", children && "shrink-0")}>{giaTri}</span>
        {children}
      </div>
      <div className="mt-0.5 text-xs leading-[18px] text-bo-muted">{phu}</div>
    </div>
  );
}

const MAU_VACH = {
  mau: "bg-bo-foreground",
  ngoai: "bg-orange-600",
  chua: "bg-slate-200",
};

/**
 * "Mã vạch quyền": mỗi vạch một quyền theo thứ tự nhóm, vạch cao là quyền nhạy cảm;
 * màu đậm = theo mẫu, cam = ngoài mẫu, xám nhạt = chưa cấp. Có khoảng hở giữa các nhóm.
 */
function MaVachQuyen({ nhom }) {
  const vach = [];
  nhom.forEach((n, ni) => {
    n.dong.forEach((d, i) => {
      const loai = d.cap ? (d.trongMau ? "mau" : "ngoai") : "chua";
      const nhanLoai = { mau: "theo mẫu", ngoai: "ngoài mẫu", chua: "chưa cấp" }[loai];
      vach.push(
        <span
          key={d.id}
          title={`${d.ten} · ${nhanLoai}`}
          className={cn(
            "w-1 rounded-[1px]",
            d.nhayCam ? "h-[26px]" : "h-4",
            MAU_VACH[loai],
            i === n.dong.length - 1 && ni < nhom.length - 1 ? "mr-1.5" : "mr-0.5",
          )}
        />,
      );
    });
  });
  return (
    <span
      role="img"
      aria-label="Mã vạch quyền: mỗi vạch là một quyền, vạch cao là quyền nhạy cảm"
      className="flex h-[26px] min-w-0 shrink items-end overflow-hidden max-sm:hidden @4xl:@max-6xl:hidden"
    >
      {vach}
    </span>
  );
}

/** Dải tóm tắt truy cập: Vai trò · Kho phụ trách · Quyền tại kho (kèm mã vạch) · Cần xem lại. */
export default function TomTatTruyCap({ tomTat, nhom, coMaVach }) {
  const mauCanXemLai = { cao: "text-orange-700", vua: "text-amber-700", khong: "text-bo-muted" }[tomTat.canXemLai.muc];
  return (
    <section aria-label="Tóm tắt truy cập" className="@container border-t border-bo-border bg-bo-surface-subtle">
      <div className="grid grid-cols-2 @4xl:grid-cols-4">
        <O nhan="Vai trò" giaTri={tomTat.vaiTro.giaTri} phu={tomTat.vaiTro.phu} />
        <O
          nhan="Kho phụ trách"
          giaTri={tomTat.kho.giaTri}
          phu={tomTat.kho.phu}
          mauGiaTri={tomTat.kho.canhBao ? "text-amber-700" : undefined}
        />
        <O nhan="Quyền tại kho" giaTri={tomTat.quyen.giaTri} phu={tomTat.quyen.phu}>
          {coMaVach && nhom?.length ? <MaVachQuyen nhom={nhom} /> : null}
        </O>
        <O nhan="Cần xem lại" giaTri={tomTat.canXemLai.giaTri} phu={tomTat.canXemLai.phu} mauGiaTri={mauCanXemLai} />
      </div>
    </section>
  );
}
