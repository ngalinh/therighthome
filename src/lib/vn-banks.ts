// Vietnamese bank list with BIN (banking identification number) used by the
// VietQR / Napas247 standard. Order is roughly by popularity.
//
// Used for two things:
// 1. Bank picker in PaymentMethod settings (Settings → Tài khoản TT)
// 2. Building the VietQR image URL on the invoice receipt:
//      https://img.vietqr.io/image/<bin>-<account>-compact2.png
//        ?amount=<amount>&addInfo=<memo>&accountName=<name>

export type VnBank = {
  bin: string;
  shortName: string;
  fullName: string;
};

export const VN_BANKS: VnBank[] = [
  { bin: "970436", shortName: "Vietcombank", fullName: "Ngân hàng TMCP Ngoại Thương Việt Nam" },
  { bin: "970415", shortName: "VietinBank", fullName: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: "970418", shortName: "BIDV", fullName: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: "970405", shortName: "Agribank", fullName: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: "970422", shortName: "MB Bank", fullName: "Ngân hàng TMCP Quân đội" },
  { bin: "970407", shortName: "Techcombank", fullName: "Ngân hàng TMCP Kỹ Thương Việt Nam" },
  { bin: "970416", shortName: "ACB", fullName: "Ngân hàng TMCP Á Châu" },
  { bin: "970432", shortName: "VPBank", fullName: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970423", shortName: "TPBank", fullName: "Ngân hàng TMCP Tiên Phong" },
  { bin: "970403", shortName: "Sacombank", fullName: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { bin: "970437", shortName: "HDBank", fullName: "Ngân hàng TMCP Phát triển TP.HCM" },
  { bin: "970441", shortName: "VIB", fullName: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", shortName: "SHB", fullName: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { bin: "970440", shortName: "SeABank", fullName: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970448", shortName: "OCB", fullName: "Ngân hàng TMCP Phương Đông" },
  { bin: "970426", shortName: "MSB", fullName: "Ngân hàng TMCP Hàng Hải" },
  { bin: "970431", shortName: "Eximbank", fullName: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970449", shortName: "LPBank", fullName: "Ngân hàng TMCP Bưu Điện Liên Việt" },
  { bin: "970409", shortName: "BacABank", fullName: "Ngân hàng TMCP Bắc Á" },
  { bin: "970425", shortName: "ABBANK", fullName: "Ngân hàng TMCP An Bình" },
  { bin: "970400", shortName: "Saigonbank", fullName: "Ngân hàng TMCP Sài Gòn Công Thương" },
  { bin: "970427", shortName: "VietABank", fullName: "Ngân hàng TMCP Việt Á" },
  { bin: "970428", shortName: "NamABank", fullName: "Ngân hàng TMCP Nam Á" },
  { bin: "970412", shortName: "PVcomBank", fullName: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: "970438", shortName: "BaoVietBank", fullName: "Ngân hàng TMCP Bảo Việt" },
  { bin: "970433", shortName: "VietBank", fullName: "Ngân hàng TMCP Việt Nam Thương Tín" },
  { bin: "970452", shortName: "KienLongBank", fullName: "Ngân hàng TMCP Kiên Long" },
  { bin: "970406", shortName: "DongABank", fullName: "Ngân hàng TMCP Đông Á" },
  { bin: "970419", shortName: "NCB", fullName: "Ngân hàng TMCP Quốc Dân" },
  { bin: "970430", shortName: "PGBank", fullName: "Ngân hàng TMCP Xăng Dầu Petrolimex" },
  { bin: "970454", shortName: "BVBank", fullName: "Ngân hàng TMCP Bản Việt" },
  { bin: "970444", shortName: "CBBank", fullName: "Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam" },
];

export function findBankByBin(bin: string | null | undefined): VnBank | undefined {
  if (!bin) return undefined;
  return VN_BANKS.find((b) => b.bin === bin);
}

// Build the VietQR.io image URL for a given account + amount + memo.
// Returns null if any required piece is missing.
export function vietQrUrl(args: {
  bankBin: string | null | undefined;
  accountNumber: string | null | undefined;
  accountHolder?: string | null;
  amount?: bigint | number | string | null;
  memo?: string | null;
  template?: "compact" | "compact2" | "qr_only" | "print";
}): string | null {
  const bin = args.bankBin?.trim();
  const acc = args.accountNumber?.trim();
  if (!bin || !acc) return null;
  const tpl = args.template ?? "compact2";
  const params = new URLSearchParams();
  if (args.amount !== null && args.amount !== undefined && args.amount !== "") {
    params.set("amount", String(args.amount));
  }
  if (args.memo) params.set("addInfo", args.memo);
  if (args.accountHolder) params.set("accountName", args.accountHolder);
  const qs = params.toString();
  return `https://img.vietqr.io/image/${bin}-${acc}-${tpl}.png${qs ? `?${qs}` : ""}`;
}
