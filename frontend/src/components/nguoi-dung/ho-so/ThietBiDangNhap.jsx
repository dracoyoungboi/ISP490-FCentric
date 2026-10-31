import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import NganKeoThietBi from "@/components/nguoi-dung/ho-so/NganKeoThietBi";
import TheThietBi, { TheThietBiDayDu } from "@/components/nguoi-dung/ho-so/TheThietBi";
import { SO_THE_TREN_TRANG, chuanBiPhien, phanLoaiPhien } from "@/components/nguoi-dung/ho-so/thietBiHoSo";
import { nguoiDungService } from "@/services/nguoiDungService";
import { getApiErrorMessage } from "@/utils/apiError";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";

const NUT_CHU = "rounded text-[13px] font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40";

/**
 * Mục "Thiết bị đang đăng nhập" ở Hồ sơ (chốt PA5, 31/10/2026).
 * - Trên trang: lưới tối đa 6 thẻ (thiết bị này trước, rồi mới hoạt động trước). Nút Đăng xuất từng thẻ chỉ hiện khi
 *   rê chuột hoặc Tab tới thẻ, để trang không lặp lại nhiều chữ "Đăng xuất". Thao tác chính: "Đăng xuất các thiết bị khác".
 * - Dòng tóm tắt: số thiết bị hoạt động hôm nay, kèm liên kết "N không dùng hơn 7 ngày" mở ngăn kéo đã lọc sẵn.
 * - Nhiều hơn 6 thiết bị: nút "Xem tất cả thiết bị" mở ngăn kéo có tìm, lọc, gom theo thời gian.
 * - Chỉ có thiết bị đang dùng: một thẻ đầy đủ trải hết chiều ngang (kèm lúc đăng nhập, địa chỉ IP).
 * - Thiết bị hiện tại không có nút đăng xuất ở đây (thoát bằng nút Đăng xuất trên thanh trên cùng).
 * Mọi lần đăng xuất đều hỏi lại; xong thì tải lại danh sách.
 */
export default function ThietBiDangNhap({ khoaTaiLai = 0 }) {
  // khoaTaiLai đổi (vd. vừa đổi mật khẩu, máy chủ đã đăng xuất các thiết bị khác) thì tải lại danh sách
  const phienQ = useTaiDuLieu(() => nguoiDungService.layPhien(), String(khoaTaiLai));
  // Mốc tính "x phút trước" là lúc tải danh sách, để số liệu không đổi giữa các lần vẽ
  const bayGio = phienQ.capNhatLuc ? phienQ.capNhatLuc.getTime() : 0;
  const ds = chuanBiPhien(phienQ.data, bayGio);
  const { homNay, khac, lauKhongDung } = phanLoaiPhien(ds);

  const [moNgan, setMoNgan] = useState(false);
  const [loc, setLoc] = useState("tat_ca");
  const [tuKhoa, setTuKhoa] = useState("");

  // xacNhan giữ NỘI DUNG; moXacNhan điều khiển mở/đóng TÁCH RIÊNG để khi đóng không bị nháy chữ
  const [xacNhan, setXacNhan] = useState(null);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);

  const moHoi = (noiDung) => {
    setXacNhan(noiDung);
    setMoXacNhan(true);
  };
  const dongXacNhan = () => {
    if (!dangXuLy) setMoXacNhan(false);
  };
  const moNganKeo = (locBanDau = "tat_ca") => {
    setLoc(locBanDau);
    setTuKhoa("");
    setMoNgan(true);
  };

  const thucHien = async () => {
    if (!xacNhan) return;
    setDangXuLy(true);
    try {
      if (xacNhan.kieu === "mot") {
        await nguoiDungService.dangXuatPhien(xacNhan.id);
        toast.success(`Đã đăng xuất ${xacNhan.ten}.`);
      } else if (xacNhan.kieu === "khac") {
        await nguoiDungService.dangXuatThietBiKhac();
        toast.success("Đã đăng xuất các thiết bị khác.");
        setMoNgan(false);
      } else {
        // Chưa có API đăng xuất theo nhóm: gọi từng phiên, báo số không đăng xuất được (nếu có)
        const ketQua = await Promise.allSettled(xacNhan.ids.map((id) => nguoiDungService.dangXuatPhien(id)));
        const loi = ketQua.filter((k) => k.status === "rejected").length;
        const duoc = ketQua.length - loi;
        if (loi) toast.error(`Đã đăng xuất ${duoc}/${ketQua.length} thiết bị. ${loi} thiết bị chưa đăng xuất được, hãy thử lại.`);
        else toast.success(`Đã đăng xuất ${duoc} thiết bị lâu không dùng.`);
        setLoc("tat_ca");
      }
      setMoXacNhan(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không đăng xuất được. Vui lòng thử lại."));
    } finally {
      setDangXuLy(false);
      phienQ.reload();
    }
  };

  const nhieu = ds.length > SO_THE_TREN_TRANG;
  const tomTatNgan = `${ds.length} thiết bị · ${homNay.length} hoạt động hôm nay${
    lauKhongDung.length ? ` · ${lauKhongDung.length} không dùng hơn 7 ngày` : ""
  }`;

  const hoiMot = (p) => moHoi({ kieu: "mot", id: p.id, ten: p.ten });
  const hoiKhac = () => moHoi({ kieu: "khac", so: khac.length });
  const hoiLauKhongDung = () => moHoi({ kieu: "lau", ids: lauKhongDung.map((p) => p.id) });

  let tieuDeHoi = "";
  let moTaHoi = "";
  let nutHoi = "Đăng xuất";
  if (xacNhan?.kieu === "mot") {
    tieuDeHoi = `Đăng xuất ${xacNhan.ten}?`;
    // Lời khuyên an ninh đặt đúng lúc người dùng định đăng xuất một thiết bị, không treo sẵn trên trang
    moTaHoi = "Thiết bị đó sẽ phải đăng nhập lại. Nếu bạn không nhận ra thiết bị này, hãy đổi mật khẩu ngay sau đó.";
  } else if (xacNhan?.kieu === "khac") {
    tieuDeHoi = `Đăng xuất ${xacNhan.so} thiết bị khác?`;
    moTaHoi = "Mọi thiết bị trừ thiết bị bạn đang dùng sẽ phải đăng nhập lại.";
    nutHoi = `Đăng xuất ${xacNhan.so} thiết bị`;
  } else if (xacNhan?.kieu === "lau") {
    tieuDeHoi = `Đăng xuất ${xacNhan.ids.length} thiết bị lâu không dùng?`;
    moTaHoi = "Các thiết bị không hoạt động hơn 7 ngày sẽ phải đăng nhập lại. Thiết bị bạn đang dùng không bị ảnh hưởng.";
    nutHoi = `Đăng xuất ${xacNhan.ids.length} thiết bị`;
  }

  return (
    <section aria-labelledby="ho-so-thiet-bi" className="px-4 py-5 sm:px-6 sm:py-[22px]">
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 id="ho-so-thiet-bi" className="text-[15px] font-semibold leading-[22px] text-bo-foreground">
            Thiết bị đang đăng nhập
            {ds.length ? <span className="font-normal text-bo-muted"> ({ds.length})</span> : null}
          </h2>
          {/* Chỉ hiện khi có số liệu đáng xem (nhiều thiết bị / có thiết bị lâu không dùng); ít thiết bị thì để trống */}
          {nhieu || lauKhongDung.length ? (
            <p className="mt-0.5 text-[12.5px] leading-[18px] text-bo-muted">
              {homNay.length} hoạt động hôm nay
              {lauKhongDung.length ? (
                <>
                  {" · "}
                  <button type="button" onClick={() => moNganKeo("lau_khong_dung")} className={`${NUT_CHU} text-[12.5px] text-bo-primary`}>
                    {lauKhongDung.length} không dùng hơn 7 ngày
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {khac.length ? (
          <button type="button" onClick={hoiKhac} className={`${NUT_CHU} py-0.5 text-bo-danger`}>
            Đăng xuất các thiết bị khác
          </button>
        ) : null}
      </div>

      {phienQ.initialLoading ? (
        <LoadingState label="Đang tải thiết bị" className="min-h-[88px]" />
      ) : phienQ.error && !phienQ.data ? (
        <ErrorState
          title="Không tải được danh sách thiết bị"
          description={getApiErrorMessage(phienQ.error, "Kiểm tra kết nối rồi thử lại.")}
          onRetry={phienQ.reload}
        />
      ) : ds.length === 0 ? (
        <p className="text-sm text-bo-muted">Không có thiết bị nào đang đăng nhập.</p>
      ) : ds.length === 1 && ds[0].thietBiNay ? (
        // Chỉ thiết bị đang dùng: một thẻ đầy đủ trải hết chiều ngang thay vì nửa ô lưới
        <TheThietBiDayDu phien={ds[0]} />
      ) : (
        <>
          <div className="@container">
            <ul className="m-0 grid list-none gap-2.5 p-0 @lg:grid-cols-2">
              {ds.slice(0, SO_THE_TREN_TRANG).map((p) => (
                <TheThietBi key={p.id} phien={p} onDangXuat={hoiMot} />
              ))}
            </ul>
          </div>
          {nhieu ? (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => moNganKeo()}
                className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
              >
                Xem tất cả thiết bị
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </>
      )}

      <NganKeoThietBi
        open={moNgan}
        onOpenChange={setMoNgan}
        ds={ds}
        tomTat={tomTatNgan}
        loc={loc}
        onLocChange={setLoc}
        tuKhoa={tuKhoa}
        onTuKhoaChange={setTuKhoa}
        soLauKhongDung={lauKhongDung.length}
        coThietBiKhac={khac.length > 0}
        onDangXuatMot={hoiMot}
        onDangXuatLauKhongDung={hoiLauKhongDung}
        onDangXuatTatCaKhac={hoiKhac}
      />

      <ConfirmModal
        isOpen={moXacNhan}
        onClose={dongXacNhan}
        onConfirm={thucHien}
        isLoading={dangXuLy}
        variant="danger"
        title={tieuDeHoi}
        description={moTaHoi}
        confirmText={nutHoi}
        cancelText="Hủy"
      />
    </section>
  );
}
