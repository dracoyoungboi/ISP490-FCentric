import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/backoffice/PageContainer";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { ngayThang } from "@/components/channel/ngay";
import { noiDungSan } from "@/components/channel/noiDungSan";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { laUyQuyenLai, xoaDanhDauUyQuyenLai } from "@/components/channel/uyQuyen";
import useSanHienTai from "@/components/channel/useSanHienTai";
import { KhongTimThayTrongKhung } from "@/pages/page-error/NotFound404";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Trang quay về sau khi người bán đồng ý (hoặc từ chối) trên trang của sàn: /channels/oauth/callback/:maKenh?code=&state=
 * (KH mục B.4). Chỉ có ở sàn ủy quyền (Shopify dán khóa thì không).
 * - Gửi mã về máy chủ đúng một lần: main.jsx bọc StrictMode nên effect chạy hai lần ở bản dev, lần sau dùng lại lời gọi
 *   của lần đầu (state chỉ dùng được một lần).
 * - Có kết quả (kể cả lỗi) thì bỏ code / state khỏi thanh địa chỉ, giữ kết quả trong lịch sử: F5 hoặc Back không gửi lại.
 * - Ủy quyền lại (gia hạn) từ gian hàng đã thiết lập: báo gia hạn và về Tổng quan, không đưa vào Thiết lập.
 */
/** 409 GIAN_HANG_KHAC (KH mục C.1): ủy quyền lại bằng tài khoản của gian hàng khác khi đang kết nối; không lưu gì. */
const CAU_GIAN_HANG_KHAC =
  t("Bạn vừa kết nối một gian hàng khác. Muốn đổi gian hàng, hãy ngắt kết nối ở Cấu hình rồi kết nối lại.");

export default function OAuthCallbackPage() {
  const san = useSanHienTai();
  if (san.kieuKetNoi !== "uy_quyen") return <KhongTimThayTrongKhung />;
  return <TrangQuayVe san={san} />;
}

function TrangQuayVe({ san }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // TikTok báo từ chối có thể kèm code=null dạng chữ
  const maTuSan = searchParams.get("code");
  const code = maTuSan && maTuSan !== "null" ? maTuSan : null;
  const maPhien = searchParams.get("state");
  const ketQuaTruoc = location.state?.ketQuaUyQuyen ?? null;
  const tuChoi = !ketQuaTruoc && (Boolean(searchParams.get("error")) || !code);
  // Có mã mà không có state: TikTok Shop bắt buộc state; Lazada và Shopee cho phép xử lý bằng mã code
  // vì mã code chỉ dùng được một lần và máy chủ xác thực chữ ký HMAC-SHA256 với Open Platform.
  const isLazadaAny = san.maKenh === "LAZADA" || san.maKenh === "LAZADA_SANDBOX";
  const isShopeeAny = san.maKenh === "SHOPEE_OFFICIAL" || san.maKenh === "SHOPEE_SANDBOX" || san.maKenh === "SHOPEE";
  const thieuPhien = !ketQuaTruoc && !tuChoi && !maPhien && !isLazadaAny && !isShopeeAny;
  const [ketQua, setKetQua] = useState(null); // { loai: "xong" | "phien" | "khac" | "loi" | "tu_choi", dto?, message?, giaHan? }
  const guiRef = useRef(null);

  // Ghi kết quả vào lịch sử (thay mục hiện tại) và bỏ code / state / error khỏi đường dẫn
  const choKetQua = (kq) => {
    setKetQua(kq);
    navigate(location.pathname, { replace: true, state: { ketQuaUyQuyen: kq } });
  };
  const choKetQuaRef = useRef(choKetQua);
  useEffect(() => {
    choKetQuaRef.current = choKetQua;
  });

  useEffect(() => {
    if (ketQuaTruoc) return undefined;
    if (tuChoi || thieuPhien) {
      xoaDanhDauUyQuyenLai(san.maKenh);
      choKetQuaRef.current({ loai: tuChoi ? "tu_choi" : "phien" });
      return undefined;
    }
    const defaultState = san.maKenh === "LAZADA_SANDBOX" ? "lazada_sandbox_oauth" : (isShopeeAny ? "shopee_oauth" : "lazada_oauth");
    const shopId = searchParams.get("shop_id");
    if (!guiRef.current) guiRef.current = kenhBanHangService.hoanTatUyQuyen(san.maKenh, { code, state: maPhien ?? defaultState, shopId });
    let conGan = true;
    const xong = (dto, giaHan) => {
      // Menu bên trái hiện ngay mục của sàn vừa kết nối
      taiLaiKenhDaKetNoi();
      choKetQuaRef.current({ loai: "xong", dto: dto ?? {}, giaHan });
    };
    guiRef.current.then(
      (dto) => {
        if (!conGan) return;
        const giaHan = laUyQuyenLai(san.maKenh);
        xoaDanhDauUyQuyenLai(san.maKenh);
        xong(dto, giaHan);
      },
      (error) => {
        if (!conGan) return;
        const giaHan = laUyQuyenLai(san.maKenh);
        xoaDanhDauUyQuyenLai(san.maKenh);
        const ma = getApiErrorCode(error);
        if (ma === "STATE_KHONG_HOP_LE") {
          // F5 / Back lúc đang gửi: lần gửi trước có thể đã thành công (state chỉ dùng được một lần) — đọc lại kết nối,
          // vừa ủy quyền xong (trong 15 phút) thì báo thành công thay vì "phiên hết hạn"
          kenhBanHangService.getKetNoi(san.maKenh).then(
            (dto) => {
              if (!conGan) return;
              const vuaUyQuyen =
                trangThaiKetNoi(dto) === "dang_hoat_dong" && Date.now() - new Date(dto?.ngayUyQuyen).getTime() < 15 * 60_000;
              if (vuaUyQuyen) xong(dto, giaHan);
              else choKetQuaRef.current({ loai: "phien" });
            },
            () => {
              if (conGan) choKetQuaRef.current({ loai: "phien" });
            },
          );
          return;
        }
        choKetQuaRef.current(
          ma === "GIAN_HANG_KHAC"
            ? { loai: "khac", message: getApiErrorMessage(error, CAU_GIAN_HANG_KHAC) }
            : { loai: "loi", message: getApiErrorMessage(error, t("Không hoàn tất được ủy quyền với {{ten}}", { ten: san.ten })) },
        );
      },
    );
    return () => {
      conGan = false;
    };
  }, [ketQuaTruoc, tuChoi, thieuPhien, san.maKenh, san.ten, code, maPhien]);

  const kq = ketQuaTruoc ?? ketQua ?? (tuChoi ? { loai: "tu_choi" } : thieuPhien ? { loai: "phien" } : null);
  const loai = kq?.loai ?? "dang";
  const dto = kq?.dto;
  const nhanId = noiDungSan(san.maKenh)?.nhanIdSan ?? t("Mã gian hàng");
  const hanDen = ngayThang(dto?.hanUyQuyen, { coNam: true });
  const thongTinGianHang = [dto?.shopIdSan ? `${nhanId} ${dto.shopIdSan}` : null, hanDen ? t("ủy quyền đến {{hanDen}}", { hanDen }) : null]
    .filter(Boolean)
    .join(" · ");

  const NOI_DUNG = {
    dang: {
      tieuDe: t("Đang hoàn tất ủy quyền với {{ten}}…", { ten: san.ten }),
      moTa: t("Hệ thống đang đổi mã ủy quyền lấy khóa truy cập và đọc thông tin gian hàng. Vui lòng không đóng trang."),
    },
    xong: kq?.giaHan
      ? {
          tieuDe: t("Đã gia hạn ủy quyền {{ten}}", { ten: san.ten }),
          moTa: t("{{thongTin}}Tồn kho và đơn hàng đồng bộ lại ở lượt chạy tới.", { thongTin: thongTinGianHang ? `${thongTinGianHang}. ` : "" }),
        }
      : {
          tieuDe: t("Đã kết nối gian hàng {{tenGianHang}}", { tenGianHang: dto?.tenGianHang || san.ten }),
          moTa: t("{{thongTin}}Tiếp tục thiết lập tồn kho và đơn hàng.", { thongTin: thongTinGianHang ? `${thongTinGianHang}. ` : "" }),
        },
    phien: {
      tieuDe: t("Phiên ủy quyền đã hết hạn"),
      moTa: t("Mỗi lần ủy quyền có hiệu lực 10 phút và chỉ dùng được một lần. Hãy bấm Ủy quyền lại từ trang Thiết lập."),
    },
    tu_choi: {
      tieuDe: t("{{ten}} chưa được cấp quyền", { ten: san.ten }),
      moTa: t("Bạn đã chọn từ chối trên trang của {{ten}}. Chưa có gì thay đổi trong FCentric; ủy quyền lại khi sẵn sàng.", { ten: san.ten }),
    },
    // Gian hàng đang kết nối vẫn giữ nguyên, chỉ lần ủy quyền này không được lưu
    khac: {
      tieuDe: t("Không đổi được sang gian hàng khác"),
      moTa: kq?.message,
    },
    loi: {
      tieuDe: t("Chưa kết nối được {{ten}}", { ten: san.ten }),
      moTa: kq?.message,
    },
  }[loai];

  return (
    <PageContainer>
      <h1 className="sr-only">{t("Ủy quyền {{ten}}", { ten: san.ten })}</h1>
      <div className="space-y-4">
        <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />
        {/* Đang chờ / thành công: thông báo nhẹ; không thành công: cảnh báo */}
        <section
          role={loai === "dang" || loai === "xong" ? "status" : "alert"}
          className="mx-auto flex max-w-[560px] flex-col items-center gap-3 rounded-lg border border-bo-border bg-bo-surface px-6 py-8 text-center shadow-sm sm:mt-6"
        >
          <ChannelLogo maKenh={san.maKenh} size={40} />
          {loai === "dang" ? (
            <Loader2 className="size-10 animate-spin text-bo-primary motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-12 place-items-center rounded-full",
                loai === "xong" ? "bg-bo-success-soft text-bo-success" : "bg-bo-danger-soft text-bo-danger",
              )}
            >
              {loai === "xong" ? <Check className="size-6" strokeWidth={2.5} /> : <X className="size-6" strokeWidth={2.5} />}
            </span>
          )}
          <h2 className="text-[17px] font-semibold text-bo-heading">{NOI_DUNG.tieuDe}</h2>
          {NOI_DUNG.moTa ? <p className="max-w-[460px] text-[13.5px] leading-5 text-bo-muted">{NOI_DUNG.moTa}</p> : null}

          {loai === "khac" ? (
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button asChild className={NUT_CHINH}>
                <Link to={`${san.duongDan}/settings`}>{t("Về Cấu hình")}</Link>
              </Button>
              <Button asChild variant="outline" className={NUT_PHU}>
                <Link to={san.duongDan}>{t("Về Tổng quan")}</Link>
              </Button>
            </div>
          ) : loai === "xong" && kq?.giaHan ? (
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button asChild className={NUT_CHINH}>
                <Link to={san.duongDan}>{t("Về Tổng quan")}</Link>
              </Button>
              <Button asChild variant="outline" className={NUT_PHU}>
                <Link to={`${san.duongDan}/settings`}>{t("Xem cấu hình")}</Link>
              </Button>
            </div>
          ) : loai === "xong" ? (
            <Button asChild className={cn(NUT_CHINH, "mt-1")}>
              <Link to={`${san.duongDan}/setup?buoc=2`}>{t("Tiếp tục thiết lập")}</Link>
            </Button>
          ) : loai !== "dang" ? (
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button asChild className={NUT_CHINH}>
                <Link to={`${san.duongDan}/setup?buoc=1`}>{t("Ủy quyền lại")}</Link>
              </Button>
              <Button asChild variant="outline" className={NUT_PHU}>
                <Link to="/channels">{t("Về Kênh bán hàng")}</Link>
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  );
}
