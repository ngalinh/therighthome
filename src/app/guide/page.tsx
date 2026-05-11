import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import {
  LogIn,
  LayoutDashboard,
  Building2,
  KeyRound,
  FileText,
  Receipt,
  Wallet,
  Settings,
  ClipboardList,
  Upload,
  Lightbulb,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from "lucide-react";

type Section = {
  id: string;
  icon: typeof LogIn;
  title: string;
  sub: string;
  route?: { href: string; label: string };
  intro: string;
  steps: { title: string; body: React.ReactNode }[];
  tips?: React.ReactNode[];
  adminOnly?: boolean;
};

const SECTIONS: Section[] = [
  {
    id: "dang-nhap",
    icon: LogIn,
    title: "Đăng nhập & giao diện chính",
    sub: "Bắt đầu sử dụng hệ thống",
    route: { href: "/login", label: "Trang đăng nhập" },
    intro:
      "Tất cả người dùng đều cần đăng nhập bằng email và mật khẩu do quản trị viên cấp. Sau khi đăng nhập, bạn sẽ thấy thanh điều hướng bên trái (máy tính) hoặc thanh dưới cùng (điện thoại).",
    steps: [
      {
        title: "Mở trang đăng nhập",
        body: (
          <>
            Truy cập <code>/login</code>, nhập email và mật khẩu được cấp, sau đó
            bấm <strong>Đăng nhập</strong>.
          </>
        ),
      },
      {
        title: "Làm quen với thanh điều hướng",
        body: (
          <>
            Trên máy tính, thanh menu bên trái gồm <strong>Tổng quan</strong>,{" "}
            <strong>Quản lý</strong>, <strong>Toà nhà</strong>,{" "}
            <strong>Hướng dẫn</strong> và <strong>Cài đặt chung</strong>. Bấm
            vào mục để mở rộng danh sách con.
          </>
        ),
      },
      {
        title: "Tìm kiếm nhanh",
        body: (
          <>
            Sử dụng ô tìm kiếm trên thanh trên cùng (phím tắt <kbd>⌘K</kbd>) để
            tìm hoá đơn, khách thuê hoặc toà nhà theo tên/số.
          </>
        ),
      },
      {
        title: "Đăng xuất",
        body: (
          <>
            Bấm biểu tượng <strong>Đăng xuất</strong> ở góc dưới cùng thanh menu
            (cạnh tên người dùng).
          </>
        ),
      },
    ],
    tips: [
      "Tài khoản có hai vai trò: Quản trị viên (toàn quyền) và Nhân viên (chỉ thao tác trên toà nhà được phân quyền).",
      "Nếu quên mật khẩu, liên hệ quản trị viên để được đặt lại.",
    ],
  },
  {
    id: "tong-quan",
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
    id: "toa-nha",
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
    id: "so-do-phong",
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
    id: "hop-dong",
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
    id: "hoa-don",
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
    id: "tai-chinh",
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
    id: "quan-ly",
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
    id: "cai-dat",
    icon: Settings,
    title: "Cài đặt chung",
    sub: "Người dùng, danh mục, nhật ký",
    route: { href: "/settings", label: "Mở Cài đặt" },
    adminOnly: true,
    intro:
      "Trang dành riêng cho Quản trị viên. Đây là nơi cấu hình hệ thống ở cấp tổ chức.",
    steps: [
      {
        title: "Quản lý người dùng",
        body:
          "Mời nhân viên mới, đặt vai trò, gán toà nhà mà nhân viên đó được phép thao tác.",
      },
      {
        title: "Danh mục giao dịch",
        body:
          "Tạo / sửa danh mục thu - chi (tiền điện, nước, lương, sửa chữa…) để dùng trong sổ quỹ.",
      },
      {
        title: "Phương thức thanh toán",
        body:
          "Khai báo tài khoản ngân hàng, ví điện tử… để gắn vào hoá đơn khi thu tiền.",
      },
      {
        title: "Nhật ký thao tác",
        body:
          "Xem ai đã làm gì, lúc nào. Dùng để truy vết khi có sai sót hoặc khi cần đối chiếu.",
      },
    ],
  },
  {
    id: "import",
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
  {
    id: "meo",
    icon: Lightbulb,
    title: "Mẹo & câu hỏi thường gặp",
    sub: "Những điều nên biết",
    intro:
      "Một vài lưu ý nhỏ giúp bạn dùng hệ thống mượt hơn.",
    steps: [
      {
        title: "Phím tắt tìm kiếm",
        body: (
          <>
            Bấm <kbd>⌘K</kbd> (Mac) hoặc <kbd>Ctrl K</kbd> (Windows) ở bất cứ
            đâu để mở nhanh ô tìm kiếm trên thanh trên cùng.
          </>
        ),
      },
      {
        title: "Phân quyền theo toà nhà",
        body:
          "Nhân viên chỉ thấy các toà nhà được gán quyền. Nếu một nhân viên báo không thấy toà nhà, kiểm tra phần Người dùng trong Cài đặt chung.",
      },
      {
        title: "Hoá đơn quá hạn",
        body:
          "Trạng thái quá hạn được cập nhật tự động theo ngày đến hạn. Không cần thao tác thủ công.",
      },
      {
        title: "Sao lưu dữ liệu",
        body:
          "Dữ liệu được lưu trong cơ sở dữ liệu của hệ thống; nếu cần sao lưu định kỳ, liên hệ quản trị kỹ thuật.",
      },
    ],
  },
];

export default async function GuidePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;

  return (
    <AppShell
      user={{
        name: session.user.name || "",
        email: session.user.email || "",
        role,
      }}
    >
      <div className="px-4 lg:px-9 pt-6 lg:pt-9 pb-12 lg:pb-20 max-w-[1360px] mx-auto">
        <header className="rise mb-8">
          <div className="page-eyebrow">
            <span className="dot" />
            Hướng dẫn sử dụng
          </div>
          <h1 className="page-title">
            Làm quen với <span className="accent">The Right Home</span>.
          </h1>
          <p className="page-sub">
            Hướng dẫn theo từng phần của hệ thống, dựa trên giao diện hiện tại.
            Bấm vào mục bên trái để nhảy nhanh đến phần bạn cần.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10">
          {/* TOC */}
          <aside className="hidden lg:block">
            <nav
              className="sticky top-24 flex flex-col gap-1 p-3 rounded-[var(--r-lg)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
              }}
            >
              <div
                className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--text-3)" }}
              >
                Mục lục
              </div>
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12.5px] font-medium transition-colors hover:bg-cream-2"
                    style={{ color: "var(--text-2)" }}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--accent-coral)" }}
                    />
                    <span className="truncate">{s.title}</span>
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex flex-col gap-8 lg:gap-10 min-w-0">
            {SECTIONS.map((s, i) => (
              <SectionCard key={s.id} section={s} role={role} index={i} />
            ))}

            <FooterCta />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SectionCard({
  section,
  role,
  index,
}: {
  section: Section;
  role: string;
  index: number;
}) {
  const Icon = section.icon;
  const hidden = section.adminOnly && role !== "ADMIN";
  const riseClass = `rise-${Math.min(6, index + 1)}`;

  return (
    <section
      id={section.id}
      className={`card-soft p-6 lg:p-8 scroll-mt-24 ${riseClass}`}
    >
      <div className="flex items-start gap-4">
        <div className="ico-wrap shrink-0">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title" style={{ margin: 0 }}>
              {section.title}
            </h2>
            {section.adminOnly && (
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-tint)",
                  color: "var(--accent-ink)",
                }}
              >
                Chỉ quản trị
              </span>
            )}
          </div>
          <div className="section-sub" style={{ marginTop: 4 }}>
            {section.sub}
          </div>
        </div>
        {section.route && !hidden && (
          <Link
            href={section.route.href}
            className="hidden sm:inline-flex btn btn-ghost btn-sm shrink-0"
          >
            {section.route.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {hidden ? (
        <p
          className="mt-5 text-[14px] leading-relaxed"
          style={{ color: "var(--text-3)" }}
        >
          Phần này dành riêng cho Quản trị viên. Liên hệ quản trị nếu bạn cần
          truy cập.
        </p>
      ) : (
        <>
          <p
            className="mt-5 text-[14.5px] leading-relaxed"
            style={{ color: "var(--text-2)" }}
          >
            {section.intro}
          </p>

          <ol className="mt-6 flex flex-col gap-3.5">
            {section.steps.map((step, idx) => (
              <li
                key={idx}
                className="flex gap-3.5 p-3.5 rounded-[12px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  className="h-7 w-7 rounded-full grid place-items-center shrink-0 font-serif text-[14px] font-medium"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)",
                    color: "#fff",
                    boxShadow:
                      "0 4px 10px -4px rgba(var(--accent-shadow-rgb), .5)",
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-[14px]"
                    style={{ color: "var(--text)" }}
                  >
                    {step.title}
                  </div>
                  <div
                    className="mt-1 text-[13.5px] leading-relaxed"
                    style={{ color: "var(--text-2)" }}
                  >
                    {step.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {section.tips && section.tips.length > 0 && (
            <div
              className="mt-5 rounded-[12px] p-4"
              style={{
                background: "var(--sun-soft)",
                border: "1px solid #f0d896",
              }}
            >
              <div
                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
                style={{ color: "var(--sun-ink)" }}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Mẹo
              </div>
              <ul className="flex flex-col gap-1.5">
                {section.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-[13px] leading-relaxed"
                    style={{ color: "var(--sun-ink)" }}
                  >
                    <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-80" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.route && (
            <Link
              href={section.route.href}
              className="sm:hidden mt-5 btn btn-ghost btn-sm w-full"
            >
              {section.route.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function FooterCta() {
  return (
    <div
      className="card-soft p-6 lg:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 rise-6"
      style={{
        background:
          "linear-gradient(135deg, var(--accent-tint) 0%, #fdf3ef 100%)",
        borderColor: "var(--accent-soft)",
      }}
    >
      <div
        className="h-12 w-12 rounded-2xl grid place-items-center shrink-0"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)",
          color: "#fff",
          boxShadow: "0 8px 18px -6px rgba(var(--accent-shadow-rgb), .55)",
        }}
      >
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-serif text-[20px] font-medium"
          style={{ color: "var(--text)" }}
        >
          Sẵn sàng bắt đầu?
        </div>
        <div
          className="text-[13.5px] mt-0.5"
          style={{ color: "var(--text-2)" }}
        >
          Mở Tổng quan để xem tình hình hôm nay, hoặc nhảy thẳng đến phần Quản
          lý.
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link href="/" className="btn btn-ghost btn-sm">
          Tổng quan
        </Link>
        <Link href="/manage/chdv" className="btn btn-primary btn-sm">
          Mở Quản lý
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
