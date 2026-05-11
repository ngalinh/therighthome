import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Replace contract codes ("HĐ <TYPE>-DDMMYY[-NN]") and invoice codes
 * (legacy "HD-YYMM-NNN" or new "HD-DDMMYY-NN") in `content` with Links to
 * their detail pages, when the code maps to a known id. Unknown codes are
 * rendered as plain text.
 *
 * The two formats are distinguishable: contract codes follow the "HĐ "
 * prefix (Latin H + Vietnamese Đ); invoice codes are bare "HD-..."
 * (Latin H + Latin D).
 */
const CODE_RE = /(HĐ\s+)([A-Z]+-\d{6}(?:-\d{2})?)|(HD-\d{4,6}-\d{2,3})/g;

export function renderContentWithLinks({
  content, buildingId, contractMap, invoiceMap,
}: {
  content: string;
  buildingId: string;
  contractMap: Map<string, string>;
  invoiceMap: Map<string, string>;
}): ReactNode {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_RE.exec(content)) !== null) {
    if (m.index > lastIdx) parts.push(content.slice(lastIdx, m.index));
    if (m[1]) {
      const code = m[2];
      const id = contractMap.get(code);
      if (id) {
        parts.push(<span key={key++}>{m[1]}</span>);
        parts.push(
          <Link key={key++} href={`/buildings/${buildingId}/contracts/${id}/edit`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {code}
          </Link>,
        );
      } else {
        parts.push(m[0]);
      }
    } else if (m[3]) {
      const code = m[3];
      const id = invoiceMap.get(code);
      if (id) {
        parts.push(
          <Link key={key++} href={`/buildings/${buildingId}/invoices/${id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {code}
          </Link>,
        );
      } else {
        parts.push(m[0]);
      }
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < content.length) parts.push(content.slice(lastIdx));
  return <>{parts}</>;
}
