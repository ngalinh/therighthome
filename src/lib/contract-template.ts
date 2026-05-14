// Build the placeholder map fed to docxtemplater for contract DOCX rendering.
// Centralized so contract creation, "Tạo HĐ" regenerate, and the settings-page
// help block all stay consistent.
import { formatDateVN, formatVND, numberToVietnameseWords } from "@/lib/utils";

type Customer = {
  type: "INDIVIDUAL" | "COMPANY";
  fullName: string | null;
  companyName: string | null;
  idNumber: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  dateOfBirth: Date | string | null;
  hometown: string | null;
  permanentAddress: string | null;
  idIssuedDate: Date | string | null;
  licensePlate?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
};

type Contract = {
  code: string;
  startDate: Date | string;
  endDate: Date | string;
  termMonths: number;
  paymentDay: number;
  monthlyRent: bigint | string | number;
  depositAmount: bigint | string | number;
  notes?: string | null;
};

type Building = { name: string; address: string };
type Room = { number: string };

function asBigInt(v: bigint | string | number): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  return BigInt(v || "0");
}

function customerName(c: Customer | undefined): string {
  if (!c) return "";
  if (c.type === "COMPANY") return c.companyName ?? c.fullName ?? "";
  return c.fullName ?? "";
}

// Empty placeholders are returned as "" so docxtemplater's nullGetter doesn't
// even need to fire — the resulting docx never has dangling braces.
//
// `co_khach_2` is a boolean flag for docxtemplater conditionals
// ({#co_khach_2}...{/co_khach_2}) so the second-tenant section disappears
// entirely when there's only one tenant.
export function buildContractPlaceholders({
  contract, building, room, customers,
}: {
  contract: Contract;
  building: Building;
  room: Room;
  customers: Customer[];
}): Record<string, string | boolean> {
  const primary = customers[0];
  const second = customers[1];
  const rent = asBigInt(contract.monthlyRent);
  const deposit = asBigInt(contract.depositAmount);
  const hasSecond = customers.length >= 2;

  const base: Record<string, string | boolean> = {
    ma_hd: contract.code,
    toa_nha: building.name,
    dia_chi_toa: building.address,
    so_phong: room.number,
    so_nguoi_thue: String(customers.length),

    // Khách 1 (đại diện)
    ten_khach: customerName(primary),
    cccd: primary?.idNumber ?? "",
    ngay_cap: primary?.idIssuedDate ? formatDateVN(primary.idIssuedDate) : "",
    ngay_sinh: primary?.dateOfBirth ? formatDateVN(primary.dateOfBirth) : "",
    que_quan: primary?.hometown ?? "",
    noi_thuong_tru: primary?.permanentAddress ?? "",
    sdt: primary?.phone ?? "",
    email: primary?.email ?? "",
    cong_ty: primary?.companyName ?? "",
    mst: primary?.taxNumber ?? "",
    nguoi_dai_dien: primary?.representativeName ?? "",
    chuc_vu: primary?.representativeTitle ?? "",

    // Khách 2 (nếu có) — wrap section trong template bằng {#co_khach_2}...{/co_khach_2}
    co_khach_2: hasSecond,
    ten_khach_2: customerName(second),
    cccd_2: second?.idNumber ?? "",
    ngay_cap_2: second?.idIssuedDate ? formatDateVN(second.idIssuedDate) : "",
    ngay_sinh_2: second?.dateOfBirth ? formatDateVN(second.dateOfBirth) : "",
    que_quan_2: second?.hometown ?? "",
    noi_thuong_tru_2: second?.permanentAddress ?? "",
    sdt_2: second?.phone ?? "",
    email_2: second?.email ?? "",

    // HĐ
    ngay_bat_dau: formatDateVN(contract.startDate),
    ngay_ket_thuc: formatDateVN(contract.endDate),
    thoi_han: `${contract.termMonths} tháng`,
    gia_thue: formatVND(rent),
    gia_thue_bang_chu: numberToVietnameseWords(rent),
    tien_coc: formatVND(deposit),
    tien_coc_bang_chu: numberToVietnameseWords(deposit),
    ngay_thanh_toan: String(contract.paymentDay),
    ghi_chu: contract.notes ?? "",
  };
  return base;
}

// Resolve the right contract template URL based on building type and primary
// customer kind, with fallback to AppSetting defaults.
//
//   VP + COMPANY primary → contractTemplateUrlCompany ?? appSetting.defaultContractTemplateVpCompany
//   VP + INDIVIDUAL      → contractTemplateUrl       ?? appSetting.defaultContractTemplateVpIndividual
//   CHDV                 → contractTemplateUrl       ?? appSetting.defaultContractTemplateChdv
export function resolveTemplateUrl({
  buildingType,
  primaryType,
  buildingSetting,
  appSetting,
}: {
  buildingType: "CHDV" | "VP";
  primaryType: "INDIVIDUAL" | "COMPANY" | undefined;
  buildingSetting: { contractTemplateUrl?: string | null; contractTemplateUrlCompany?: string | null } | null;
  appSetting: {
    defaultContractTemplateChdv?: string | null;
    defaultContractTemplateVpIndividual?: string | null;
    defaultContractTemplateVpCompany?: string | null;
  } | null;
}): string | null {
  const isVpCompany = buildingType === "VP" && primaryType === "COMPANY";
  if (isVpCompany) {
    return buildingSetting?.contractTemplateUrlCompany ?? appSetting?.defaultContractTemplateVpCompany ?? null;
  }
  if (buildingType === "VP") {
    return buildingSetting?.contractTemplateUrl ?? appSetting?.defaultContractTemplateVpIndividual ?? null;
  }
  return buildingSetting?.contractTemplateUrl ?? appSetting?.defaultContractTemplateChdv ?? null;
}

// Plain-text reference for the settings page (and future docs). Keep ordering
// roughly the same as the data layout above so users can scan quickly.
export const PLACEHOLDER_HELP = `{ma_hd}                Mã hợp đồng
{toa_nha}              Tên toà nhà
{dia_chi_toa}          Địa chỉ toà nhà
{so_phong}             Số phòng
{so_nguoi_thue}        Số người thuê phòng
{ten_khach}            Tên khách 1 (cá nhân hoặc công ty)
{cccd}                 Số CCCD khách 1
{ngay_cap}             Ngày cấp CCCD khách 1
{ngay_sinh}            Ngày sinh khách 1
{que_quan}             Quê quán khách 1
{noi_thuong_tru}       Nơi thường trú khách 1
{sdt}                  Số điện thoại khách 1
{email}                Email khách 1
{cong_ty}              Tên công ty (nếu có)
{mst}                  Mã số thuế (nếu có)
{nguoi_dai_dien}       Người đại diện công ty (nếu có)
{chuc_vu}              Chức vụ người đại diện (nếu có)
{ten_khach_2}          Tên khách 2 (nếu có)
{cccd_2}               Số CCCD khách 2
{ngay_cap_2}           Ngày cấp CCCD khách 2
{ngay_sinh_2}          Ngày sinh khách 2
{que_quan_2}           Quê quán khách 2
{noi_thuong_tru_2}     Nơi thường trú khách 2
{sdt_2}                Số điện thoại khách 2
{email_2}              Email khách 2

Để PHẦN THÔNG TIN KHÁCH 2 tự ẩn khi chỉ có 1 người thuê,
bọc cả khối khách 2 trong file mẫu bằng cặp thẻ:
  {#co_khach_2}
    ... nội dung về khách 2 (Bên B – Khách thuê 2, các dòng {ten_khach_2}, {cccd_2}, ...) ...
  {/co_khach_2}
Khi hợp đồng chỉ có 1 khách, toàn bộ đoạn này sẽ biến mất.
{ngay_bat_dau}         Ngày bắt đầu
{ngay_ket_thuc}        Ngày kết thúc
{thoi_han}             Thời hạn hợp đồng
{gia_thue}             Giá thuê / tháng
{gia_thue_bang_chu}    Giá thuê bằng chữ
{tien_coc}             Tiền cọc
{tien_coc_bang_chu}    Tiền cọc bằng chữ
{ngay_thanh_toan}      Ngày thanh toán hàng tháng
{ghi_chu}              Ghi chú`;
