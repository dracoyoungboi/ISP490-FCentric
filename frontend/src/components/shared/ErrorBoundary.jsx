import { Component } from "react";
import ErrorState from "@/components/shared/ErrorState";
import { laLoiTaiTep } from "@/lib/taiTrang";
import { t } from "@/i18n";

/**
 * Hứng lỗi khi dựng một trang để chỉ vùng đó báo lỗi, phần còn lại (menu trái, thanh trên) vẫn dùng được.
 * Không có nó, một lỗi bất kỳ trong trang làm trắng cả màn hình.
 * `resetKey` đổi (vd. đường dẫn) thì xóa lỗi, để bấm sang trang khác trên menu là thoát được màn lỗi.
 */
export default class ErrorBoundary extends Component {
  state = { loi: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(loi) {
    return { loi };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) return { loi: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(loi, thongTin) {
    console.error("Lỗi khi dựng trang:", loi, thongTin?.componentStack);
  }

  render() {
    const { loi } = this.state;
    if (!loi) return this.props.children;

    return laLoiTaiTep(loi) ? (
      <ErrorState
        className={this.props.className}
        title={t("Không tải được trang này")}
        description={t("Kết nối mạng có thể đang chập chờn. Kiểm tra mạng rồi bấm Thử lại.")}
        onRetry={() => window.location.reload()}
      />
    ) : (
      <ErrorState
        className={this.props.className}
        title={t("Không mở được trang này")}
        description={t("Trang gặp lỗi khi hiển thị. Bấm Thử lại; nếu vẫn lỗi, hãy báo quản trị viên kèm đường dẫn trang.")}
        onRetry={() => window.location.reload()}
      />
    );
  }
}
