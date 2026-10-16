import { useLocation } from "react-router-dom";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner";
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import useKhoangTranhDay from "@/hooks/useKhoangTranhDay";
import { viTriTheoTrang } from "@/lib/tinhThongBaoNhanh";
import "@/styles/thong-bao-nhanh.css";

const {
  beRong,
  cachMep,
  cachMepDienThoai,
  khoangCach,
  soHienCungLuc,
  thoiGian,
  hieuUng,
  boChonThanhDay,
} = CAU_HINH_THONG_BAO_NHANH;

/**
 * Khung thông báo nhanh của cả hệ thống (gắn một lần trong App.jsx, bên trong BrowserRouter).
 * Mọi thông số lấy từ config/thongBaoNhanh.js; giao diện ở styles/thong-bao-nhanh.css.
 * - Góc hiện theo trang (POS sang dưới trái để không che nút Thanh toán).
 * - Tự nâng lên khi có thanh dính đáy (thanh nút Lưu, thanh Thanh toán trên màn nhỏ).
 * - Các ô xếp thành danh sách, không chồng lên nhau; lỗi và cảnh báo luôn có nút đóng.
 */
const Toaster = ({
  ...props
}) => {
  const { pathname } = useLocation();
  const tranhDay = useKhoangTranhDay(boChonThanhDay);

  return (
    <Sonner
      theme="light"
      className="toaster group fc-thong-bao"
      position={viTriTheoTrang(pathname)}
      expand
      closeButton
      visibleToasts={soHienCungLuc}
      gap={khoangCach}
      duration={thoiGian.thongTin}
      offset={{ top: cachMep, right: cachMep, left: cachMep, bottom: cachMep + tranhDay }}
      mobileOffset={{
        top: cachMepDienThoai,
        right: cachMepDienThoai,
        left: cachMepDienThoai,
        bottom: cachMepDienThoai + tranhDay,
      }}
      containerAriaLabel="Thông báo"
      toastOptions={{ closeButtonAriaLabel: "Đóng thông báo" }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--width": `${beRong}px`,
          "--tb-vao": `${hieuUng.vao}ms`,
          "--tb-ra": `${hieuUng.ra}ms`,
        }
      }
      {...props} />
  );
}

export { Toaster }
