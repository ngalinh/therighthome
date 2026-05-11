import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Building2,
  KeyRound,
  FileText,
  Receipt,
  Wallet,
  ClipboardList,
  Upload,
} from "lucide-react";

export type Section = {
  slug: string;
  icon: typeof LayoutDashboard;
  title: string;
  sub: string;
  route?: { href: string; label: string };
  intro: string;
  steps: { title: string; body: ReactNode }[];
  tips?: ReactNode[];
  adminOnly?: boolean;
};

export const SECTIONS: Section[] = [
  {
    slug: "tong-quan",
    icon: LayoutDashboard,
    title: "Tổng quan",
    sub: "Trang chủ hiển thị tình hình chung",
    route: { href: "/", label: "Mở Tổng quan" },
    intro:
      "Trang Tổng quan tóm tắt tình hình kinh doanh của bạn trong tháng hiện tại: số toà nhà, số hợp đồng đang hoạt động, doanh thu đã thu và số hoá đơn quá hạn.",
    steps: [
      {
        title: "Đọc 4 thẻ số liệu trên cùng",
        body: (
          <>
            Bốn thẻ hiển thị <strong>Toà nhà</strong>,{" "}
            <strong>Hợp đồng đang hoạt động</strong>,{" "}
            <strong>Đã thu trong tháng</strong> và{" "}
            <strong>Hoá đơn quá hạn</strong>. Mỗi thẻ có biểu đồ nhỏ thể hiện xu
            hướng.
          </>
        ),
      },
      {
        title: "Dùng Thao tác nhanh",
        body: (
          <>
            Khu vực <strong>Thao tác nhanh</strong> chứa các đường tắt: tạo hoá
            đơn CHDV, hoá đơn VP, xem hợp đồng sắp hết hạn. Bấm vào để đi thẳng
            đến đúng tab.
          </>
        ),
      },
      {
        title: "Theo dõi mục Cần xử lý",
        body: (
          <>
            Bên phải hiển thị các cảnh báo theo độ ưu tiên: hoá đơn quá hạn, hợp
            đồng sắp hết hạn, và vòng tròn doanh thu tháng.
          </>
        ),
      },
      {
        title: "Mở chi tiết một toà nhà",
        body: (
          <>
            Bên dưới có lưới các toà nhà với thanh % lấp đầy. Bấm vào ô để mở
            sơ đồ phòng của toà nhà đó.
          </>
        ),
      },
    ],
    tips: [
      "Nếu chưa có toà nhà nào, trang sẽ hiển thị nút Thêm toà nhà để bắt đầu.",
      "Số liệu được làm mới mỗi lần bạn quay lại trang.",
    ],
  },
  {
    slug: "toa-nha",
    icon: Building2,
    title: "Toà nhà",
    sub: "Danh sách & tạo toà nhà mới",
    route: { href: "/buildings", label: "Mở danh sách toà nhà" },
    intro:
      "Trang Toà nhà liệt kê tất cả CHDV (căn hộ dịch vụ) và VP (văn phòng) bạn được phân quyền, kèm tỉ lệ lấp đầy hiện tại.",
    steps: [
      {
        title: "Xem danh sách",
        body: (
          <>
            Mỗi thẻ toà nhà hiển thị tên, loại (CHDV/VP), số phòng đã thuê trên
            tổng số phòng và % lấp đầy.
          </>
        ),
      },
      {
        title: "Tạo toà nhà mới",
        body: (
          <>
            Bấm <strong>Thêm toà nhà</strong> ở góc trên bên phải. Nhập tên, địa
            chỉ, chọn loại (CHDV hoặc VP) rồi lưu. Toà nhà mới sẽ xuất hiện
            ngay trong danh sách và trong thanh menu.
          </>
        ),
      },
      {
        title: "Mở chi tiết",
        body: (
          <>
            Bấm vào thẻ toà nhà để vào sơ đồ phòng. Từ đây bạn có thể chuyển
            sang <strong>Hợp đồng</strong>, <strong>Hoá đơn</strong>,{" "}
            <strong>Tài chính</strong> hoặc <strong>Cài đặt</strong> của riêng
            toà nhà đó.
          </>
        ),
      },
    ],
    tips: [
      "Trên điện thoại, khi đang ở trong một toà nhà, thanh dưới cùng sẽ đổi thành 5 mục: Sơ đồ phòng, Hợp đồng, Hoá đơn, Tài chính, Cài đặt.",
    ],
  },
  {
    slug: "so-do-phong",
    icon: KeyRound,
    title: "Sơ đồ phòng",
    sub: "Trạng thái thuê theo từng phòng",
    intro:
      "Sơ đồ phòng cho phép bạn nhìn nhanh tình trạng từng phòng: trống, đang thuê, sắp hết hạn, hay cần xử lý.",
    steps: [
      {
        title: "Đọc trạng thái phòng",
        body: (
          <>
            Mỗi phòng được tô màu theo trạng thái. Bấm vào phòng để xem hợp đồng
            đang gắn với phòng đó (nếu có).
          </>
        ),
      },
      {
        title: "Thêm hoặc sửa phòng",
        body: (
          <>
            Vào tab <strong>Cài đặt</strong> của toà nhà để thêm phòng mới, đổi
            tên hoặc xoá phòng chưa có hợp đồng.
          </>
        ),
      },
    ],
  },
  {
    slug: "hop-dong",
    icon: FileText,
    title: "Hợp đồng",
    sub: "Tạo, gia hạn, kết thúc hợp đồng",
    intro:
      "Mỗi hợp đồng gắn với một phòng và một hoặc nhiều khách thuê. Hệ thống tự động cảnh báo khi hợp đồng sắp hết hạn (30 ngày với CHDV, 60 ngày với VP).",
    steps: [
      {
        title: "Tạo hợp đồng mới",
        body: (
          <>
            Trong tab <strong>Hợp đồng</strong> của một toà nhà, bấm{" "}
            <strong>Thêm hợp đồng</strong>. Chọn phòng, khách thuê (hoặc tạo
            khách mới), nhập ngày bắt đầu - kết thúc, giá thuê, các phí đi
            kèm.
          </>
        ),
      },
      {
        title: "Cập nhật / kết thúc",
        body: (
          <>
            Mở hợp đồng để chỉnh sửa thông tin. Khi khách trả phòng, đổi trạng
            thái sang <strong>Đã kết thúc</strong> để phòng quay lại trạng
            thái trống.
          </>
        ),
      },
      {
        title: "Theo dõi hợp đồng sắp hết hạn",
        body: (
          <>
            Vào <strong>Quản lý → CHDV</strong> hoặc <strong>VP</strong>, mở
            tab <strong>Hợp đồng sắp hết hạn</strong> để lọc theo toà nhà và
            chủ động liên hệ khách trước khi hết hạn.
          </>
        ),
      },
    ],
    tips: [
      "Khách thuê được lưu chung trong hệ thống — có thể gắn cùng một khách vào nhiều hợp đồng theo thời gian.",
    ],
  },
  {
    slug: "hoa-don",
    icon: Receipt,
    title: "Hoá đơn",
    sub: "Tạo hàng loạt, thu tiền, xuất PDF",
    intro:
      "Hoá đơn được phát hành theo tháng dựa trên hợp đồng đang hoạt động. Bạn có thể tạo từng cái hoặc tạo hàng loạt cho cả toà nhà.",
    steps: [
      {
        title: "Tạo hoá đơn hàng loạt",
        body: (
          <>
            Vào <strong>Quản lý → CHDV / VP</strong>, tab{" "}
            <strong>Hoá đơn</strong>. Chọn tháng/năm, các phòng cần tạo, nhập
            chỉ số điện nước (nếu có) và bấm <strong>Tạo hoá đơn</strong>.
          </>
        ),
      },
      {
        title: "Ghi nhận thanh toán",
        body: (
          <>
            Mở hoá đơn cần thu tiền, bấm <strong>Ghi nhận thanh toán</strong>,
            nhập số tiền, ngày, phương thức (chuyển khoản/tiền mặt). Trạng thái
            sẽ tự đổi sang <strong>Đã thanh toán</strong> hoặc{" "}
            <strong>Thanh toán một phần</strong>.
          </>
        ),
      },
      {
        title: "Xuất PDF",
        body: (
          <>
            Trong chi tiết hoá đơn, bấm <strong>Xuất PDF</strong> để tải file
            gửi cho khách.
          </>
        ),
      },
      {
        title: "Lọc & tìm",
        body: (
          <>
            Dùng bộ lọc theo trạng thái (đã thu / chưa thu / quá hạn) hoặc theo
            tháng để thu gọn danh sách.
          </>
        ),
      },
    ],
    tips: [
      "Hoá đơn quá ngày đến hạn sẽ tự chuyển trạng thái sang Quá hạn và được đếm vào thẻ ở Tổng quan.",
      "Có thể chỉnh sửa hoá đơn miễn là chưa ghi nhận thanh toán.",
    ],
  },
  {
    slug: "tai-chinh",
    icon: Wallet,
    title: "Tài chính toà nhà",
    sub: "Doanh thu, chi phí, sổ quỹ",
    intro:
      "Mỗi toà nhà có trang Tài chính riêng với biểu đồ doanh thu - chi phí theo tháng và sổ quỹ chi tiết.",
    steps: [
      {
        title: "Xem biểu đồ",
        body: (
          <>
            Biểu đồ cột so sánh thu - chi theo tháng giúp bạn nhìn xu hướng cả
            năm.
          </>
        ),
      },
      {
        title: "Ghi nhận chi phí",
        body: (
          <>
            Vào tab <strong>Sổ quỹ</strong> (trong{" "}
            <strong>Quản lý → CHDV / VP</strong>), bấm{" "}
            <strong>Thêm giao dịch</strong>, chọn danh mục (điện, nước, sửa
            chữa, lương...) và nhập số tiền.
          </>
        ),
      },
      {
        title: "Đối soát",
        body: (
          <>
            Lọc theo tháng và danh mục để đối soát với chứng từ. Mỗi giao dịch
            có thể đính kèm ghi chú.
          </>
        ),
      },
    ],
  },
  {
    slug: "quan-ly",
    icon: ClipboardList,
    title: "Quản lý CHDV & Văn phòng",
    sub: "5 tab thao tác hàng ngày",
    route: { href: "/manage/chdv", label: "Mở Quản lý CHDV" },
    intro:
      "Trang Quản lý gom các thao tác hàng ngày cho riêng từng loại hình (CHDV hoặc VP) thành 5 tab.",
    steps: [
      {
        title: "Hoá đơn",
        body:
          "Tạo, lọc và xuất hoá đơn cho toàn bộ toà nhà cùng loại. Phù hợp khi phát hành hoá đơn đầu tháng.",
      },
      {
        title: "Hợp đồng",
        body:
          "Xem nhanh các hợp đồng sắp hết hạn cùng thông tin khách thuê để chủ động gia hạn.",
      },
      {
        title: "Công việc",
        body:
          "Tạo và phân công các đầu việc (sửa chữa, dọn dẹp, gặp khách…), đánh dấu hoàn thành khi xong.",
      },
      {
        title: "Tăng ca",
        body:
          "Nhân viên có thể ghi nhận giờ tăng ca; quản trị viên duyệt và dùng số liệu này để tính lương.",
      },
      {
        title: "Sổ quỹ",
        body:
          "Danh sách giao dịch thu - chi của toàn bộ toà nhà cùng loại, có thể lọc theo danh mục.",
      },
    ],
  },
  {
    slug: "import",
    icon: Upload,
    title: "Nhập dữ liệu từ Excel",
    sub: "Khởi tạo nhanh khi mới dùng",
    route: { href: "/import", label: "Mở trang Nhập dữ liệu" },
    adminOnly: true,
    intro:
      "Khi mới chuyển sang dùng hệ thống, bạn có thể tải lên file Excel chứa danh sách toà nhà, phòng, khách thuê và hợp đồng để khởi tạo nhanh.",
    steps: [
      {
        title: "Tải mẫu Excel",
        body:
          "Mở trang Nhập dữ liệu, tải file mẫu, điền dữ liệu theo đúng cột.",
      },
      {
        title: "Tải lên & kiểm tra",
        body:
          "Kéo file vào khung tải lên. Hệ thống sẽ hiển thị danh sách dòng hợp lệ và dòng có lỗi để bạn sửa trước khi nhập.",
      },
      {
        title: "Xác nhận nhập",
        body:
          "Khi mọi dòng đã hợp lệ, bấm Xác nhận để nhập vào hệ thống. Dữ liệu cũ trùng tên sẽ được giữ nguyên (không ghi đè).",
      },
    ],
  },
];
