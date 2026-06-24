"use client";
/* eslint-disable react/no-unknown-property */

export type NoticeRoom = {
  id: string;
  floor: string;
  number: string;
  tag: "" | "new" | "hot";
  tagLabel: string;
  title: string;
  features: string[];   // each can use **bold** for emphasis
  desc: string;
  price: string;        // already formatted, or "Liên hệ"
  priceUnit: string;
  featured: boolean;
  availabilityLabel: string; // "Trống sẵn" or "Trống từ DD/MM"
};

export type NoticeBuilding = {
  id: string;
  name: string;
  metaParts: string[];  // separator dots between
  countLabel: string;   // "N phòng"
  info: string;         // free-form building description shown under meta
  rooms: NoticeRoom[];
};

export type NoticeData = {
  brand: string;
  brandSub: string;
  date: string;
  eyebrow: string;
  titleBefore: string;
  titleEm: string;
  subtitle: string;

  summary: { label: string; value: string; unit: string }[];

  buildings: NoticeBuilding[];

  policy: {
    thongTin: string;          // multiline body for "Thông tin chung"
    thongTinNoteTag: string;
    thongTinNote: string;
    coc: string;
    hoaHongTerm1: string;
    hoaHongPct1: string;
    hoaHongTerm2: string;
    hoaHongPct2: string;
    hoaHongSub: string;
    luuY: string;
    thanhToanIntro: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    guideName: string;
    guidePhone: string;
    guideSub: string;
  };

  footer: {
    phone: string;
    email: string;
    website: string;
    note: string;
  };
};

const HOME_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
  </svg>
);

// KeyRound (lucide) — matches the PWA app icon.
const KEY_ICON = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
  </svg>
);

const PHONE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const MAIL_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <path d="M22 6l-10 7L2 6" />
  </svg>
);

const GLOBE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

const PHONE_GUIDE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
);

// Render `**bold**` inline emphasis inside a string.
function inlineMarkup(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

// Parse `**Heading**: body` lines. If body starts with `- `, it's a list item.
function renderPolicyLines(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <ul className="policy-list">
      {lines.map((line, i) => {
        const trimmed = line.replace(/^- /, "");
        return <li key={i}>{inlineMarkup(trimmed)}</li>;
      })}
    </ul>
  );
}

export function NoticeTemplate({ data, refProp }: { data: NoticeData; refProp?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={refProp} className="notice-root">
      <style>{NOTICE_CSS}</style>
      <div className="bg-pattern" />
      <div className="tpl">
        {/* HEADER */}
        <header className="tpl-header">
          <div className="tpl-header-row">
            <div className="brand">
              <div className="brand-mark">{KEY_ICON}</div>
              <div>
                <div className="brand-name">{data.brand}</div>
                <div className="brand-sub">{data.brandSub}</div>
              </div>
            </div>
            <div className="tpl-meta">
              <div className="date">{data.date}</div>
            </div>
          </div>
          <div className="tpl-headline">
            <span className="tpl-eyebrow"><span className="pip" />{data.eyebrow}</span>
            <h1 className="tpl-title">
              {data.titleBefore}{" "}{data.titleEm && <em>{data.titleEm}</em>}
            </h1>
            <p className="tpl-subtitle">{data.subtitle}</p>
          </div>
        </header>

        {/* SUMMARY */}
        <div className="tpl-summary">
          {data.summary.map((s, i) => (
            <div key={i} className="tpl-summary-item">
              <div className="lbl">{s.label}</div>
              <div className="val">{s.value}<small>{s.unit}</small></div>
            </div>
          ))}
        </div>

        {/* BODY */}
        <div className="tpl-body">
          {data.buildings.map((b) => (
            <div key={b.id} className="bld-group">
              <div className="bld-group-head">
                <div className="bld-group-icon">{HOME_ICON}</div>
                <div className="bld-group-info">
                  <div className="bld-group-name">{b.name}</div>
                  <div className="bld-group-meta">
                    {b.metaParts.filter(Boolean).map((m, mi, arr) => (
                      <span key={mi} style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
                        <span>{m}</span>
                        {mi < arr.length - 1 && <span className="dot" />}
                      </span>
                    ))}
                  </div>
                  {b.info && <div className="bld-group-info-line">{b.info}</div>}
                </div>
                <div className="bld-group-count">{b.countLabel}</div>
              </div>
              <div className={`rooms-grid ${b.rooms.length === 1 ? "single" : ""}`}>
                {b.rooms.map((r) => (
                  <div key={r.id} className={`room-card ${r.featured ? "featured" : ""}`}>
                    {r.tag && <span className={`room-tag ${r.tag}`}>{r.tagLabel}</span>}
                    <div className="room-num-block">
                      {r.floor && <div className="floor">{r.floor}</div>}
                      <div className="num">{r.number}</div>
                    </div>
                    {r.availabilityLabel && (
                      <div className={`avail-badge ${r.availabilityLabel === "Trống sẵn" ? "avail-now" : "avail-soon"}`}>
                        {r.availabilityLabel}
                      </div>
                    )}
                    <div className="room-info">
                      {r.title && <div className="room-title">{r.title}</div>}
                      {r.features.length > 0 && (
                        <div className="room-features">
                          {r.features.map((f, fi) => (
                            <span key={fi} className="feat">{inlineMarkup(f)}</span>
                          ))}
                        </div>
                      )}
                      {r.desc && <p className="room-desc">{r.desc}</p>}
                    </div>
                    <div className={`room-price ${r.price === "Liên hệ" ? "no-price" : ""}`}>
                      <div className="price-val">
                        {r.price === "Liên hệ" ? "Liên hệ" : <>{r.price}<small>đ</small></>}
                      </div>
                      <div className="price-unit">{r.priceUnit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* POLICY GRID */}
          <div className="policy-grid">
            <div className="policy-card">
              <div className="policy-head"><span className="policy-num">01</span><h3>Thông tin chung</h3></div>
              {renderPolicyLines(data.policy.thongTin)}
              {(data.policy.thongTinNoteTag || data.policy.thongTinNote) && (
                <div className="policy-note">
                  {data.policy.thongTinNoteTag && <span className="policy-note-tag">{data.policy.thongTinNoteTag}</span>}
                  {data.policy.thongTinNote && renderPolicyLines(data.policy.thongTinNote)}
                </div>
              )}
            </div>

            <div className="policy-card">
              <div className="policy-head"><span className="policy-num">02</span><h3>Cọc &amp; thanh toán</h3></div>
              {renderPolicyLines(data.policy.coc)}
            </div>

            <div className="policy-card hl-card">
              <div className="policy-head"><span className="policy-num">03</span><h3>Hoa hồng môi giới</h3></div>
              <div className="commission">
                <div className="commission-row">
                  <div>
                    <div className="c-term">{data.policy.hoaHongTerm1}</div>
                    <div className="c-pct">{data.policy.hoaHongPct1}<small>%</small></div>
                  </div>
                  <div className="c-divider" />
                  <div>
                    <div className="c-term">{data.policy.hoaHongTerm2}</div>
                    <div className="c-pct alt">{data.policy.hoaHongPct2}<small>%</small></div>
                  </div>
                </div>
                <div className="c-sub">{data.policy.hoaHongSub}</div>
              </div>
            </div>

            <div className="policy-card warn-card">
              <div className="policy-head"><span className="policy-num warn">!</span><h3>Lưu ý quan trọng</h3></div>
              {renderPolicyLines(data.policy.luuY)}
            </div>

            <div className="policy-card">
              <div className="policy-head"><span className="policy-num">04</span><h3>Thanh toán</h3></div>
              {renderPolicyLines(data.policy.thanhToanIntro)}
              <div className="bank-block">
                <div className="bank-row"><span className="bank-lbl">Ngân hàng</span><span className="bank-val">{data.policy.bankName}</span></div>
                <div className="bank-row"><span className="bank-lbl">Chủ tài khoản</span><span className="bank-val">{data.policy.bankAccountName}</span></div>
                <div className="bank-row"><span className="bank-lbl">Số tài khoản</span><span className="bank-val num">{data.policy.bankAccountNumber}</span></div>
              </div>
            </div>

            <div className="policy-card guide-card">
              <div className="policy-head"><span className="policy-num">05</span><h3>Dẫn khách liên hệ</h3></div>
              <div className="guide-block">
                <div className="guide-name">{data.policy.guideName}</div>
                <span className="guide-phone">
                  {PHONE_GUIDE_ICON}
                  <span>{data.policy.guidePhone}</span>
                </span>
                <div className="guide-sub">{data.policy.guideSub}</div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="tpl-footer">
          <div className="tpl-footer-contact">
            <div className="contact-item">{PHONE_ICON}<span>{data.footer.phone}</span></div>
            <div className="contact-item">{MAIL_ICON}<span>{data.footer.email}</span></div>
            <div className="contact-item">{GLOBE_ICON}<span>{data.footer.website}</span></div>
          </div>
          <div className="tpl-footer-note" style={{ whiteSpace: "pre-line" }}>{inlineMarkup(data.footer.note)}</div>
        </footer>
      </div>
    </div>
  );
}

// Scoped CSS — all selectors live under `.notice-root` to avoid global pollution.
const NOTICE_CSS = `
.notice-root {
  --nc-bg: #faf7f3;
  --nc-surface: #ffffff;
  --nc-surface-2: #f6f1e7;
  --nc-line: #ece4d2;
  --nc-text: #1a1410;
  --nc-text-2: #4a3a2a;
  --nc-text-3: #8a7456;
  --nc-accent: #c96442;
  --nc-accent-ink: #6b2e1a;
  --nc-accent-soft: #fbe6d8;
  --nc-accent-tint: #fef0e8;
  --nc-sage: #5b9669;
  --nc-r-sm: 10px;
  --nc-r-md: 14px;
  --nc-r-lg: 20px;
  --nc-r-xl: 28px;
  font-family: var(--font-sans), system-ui, sans-serif;
  background: var(--nc-bg);
  color: var(--nc-text);
  font-size: 14px;
  line-height: 1.55;
  padding: 24px 16px;
  position: relative;
}
.notice-root * { box-sizing: border-box; }
.notice-root .bg-pattern {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 8% 0%, rgba(201,100,66,0.06), transparent 60%),
    radial-gradient(ellipse 50% 60% at 100% 100%, rgba(91,150,105,0.05), transparent 60%);
}
.notice-root .tpl {
  position: relative; z-index: 1;
  max-width: 920px; margin: 0 auto;
  background: var(--nc-surface);
  border-radius: var(--nc-r-xl);
  box-shadow: 0 24px 60px -20px rgba(60,40,20,0.18), 0 4px 12px rgba(60,40,20,0.06);
  overflow: hidden;
}
.notice-root .tpl-header {
  position: relative;
  padding: 36px 48px 32px;
  background: linear-gradient(135deg, #a84a2a 0%, #8d3a1f 50%, #6b2814 100%);
  color: #fff7eb;
  overflow: hidden;
}
.notice-root .tpl-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.notice-root .brand { display: flex; align-items: center; gap: 14px; }
.notice-root .brand-mark {
  width: 44px; height: 44px;
  background: rgba(255,255,255,0.18);
  border: 1.5px solid rgba(255,247,235,0.5);
  border-radius: 12px;
  display: grid; place-items: center;
  color: #fff7eb;
}
.notice-root .brand-name {
  font-family: var(--font-serif), Georgia, serif;
  font-size: 22px; line-height: 1; letter-spacing: -0.01em;
}
.notice-root .brand-sub {
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #ffd9b5; margin-top: 4px; font-weight: 500;
}
.notice-root .tpl-meta { text-align: right; font-size: 12px; color: #ffd9b5; }
.notice-root .tpl-meta .date {
  font-family: var(--font-mono), ui-monospace, monospace;
  letter-spacing: 0.04em; font-size: 13px; color: #fff2dc;
}
.notice-root .tpl-headline { margin-top: 32px; }
.notice-root .tpl-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  color: #fff2dc; font-weight: 600;
  padding: 6px 12px;
  background: rgba(255,247,235,0.18);
  border: 1px solid rgba(255,247,235,0.35);
  border-radius: 999px;
}
.notice-root .tpl-eyebrow .pip {
  width: 6px; height: 6px; border-radius: 50%;
  background: #fff2dc;
  box-shadow: 0 0 8px #fff2dc;
}
.notice-root .tpl-title {
  font-family: var(--font-serif), Georgia, serif;
  font-weight: 400; font-size: 48px; line-height: 1.05;
  letter-spacing: -0.025em; margin: 16px 0 8px; color: #fff7eb;
}
.notice-root .tpl-title em {
  font-style: italic; color: #fff2dc;
  border-bottom: 2px dashed rgba(255,247,235,0.4);
  padding-bottom: 2px;
}
.notice-root .tpl-subtitle {
  font-size: 14.5px; color: #fde2c4; max-width: 580px; line-height: 1.55;
}
.notice-root .tpl-summary {
  display: grid; grid-template-columns: repeat(4, 1fr);
  background: linear-gradient(180deg, #fbf6ec 0%, #f6efe1 100%);
  border-bottom: 1px solid var(--nc-line);
}
.notice-root .tpl-summary-item {
  padding: 20px 24px;
  border-right: 1px dashed #ddd0b3;
}
.notice-root .tpl-summary-item:last-child { border-right: none; }
.notice-root .tpl-summary-item .lbl {
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--nc-text-3); font-weight: 700;
}
.notice-root .tpl-summary-item .val {
  font-family: var(--font-serif), Georgia, serif;
  font-size: 30px; line-height: 1; color: var(--nc-text);
  margin-top: 8px; font-variant-numeric: tabular-nums;
}
.notice-root .tpl-summary-item .val small {
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 13px; color: var(--nc-text-3); font-weight: 500; margin-left: 4px;
}
.notice-root .tpl-body { padding: 32px 48px 40px; }
.notice-root .bld-group { margin-bottom: 28px; }
.notice-root .bld-group-head {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px;
  /* End the gradient at the surface color (white), not transparent —
     html2canvas-pro renders transparent against its export buffer and the
     PNG can show a dark stripe in some viewers. */
  background: linear-gradient(95deg, var(--nc-accent-tint) 0%, var(--nc-surface) 80%);
  border-left: 3px solid var(--nc-accent);
  border-radius: 0 var(--nc-r-md) var(--nc-r-md) 0;
  margin-bottom: 14px;
}
.notice-root .bld-group-icon {
  width: 38px; height: 38px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-accent-soft);
  border-radius: 10px;
  display: grid; place-items: center;
  color: var(--nc-accent); flex-shrink: 0;
}
.notice-root .bld-group-info { flex: 1; min-width: 0; }
.notice-root .bld-group-name {
  font-family: var(--font-serif), Georgia, serif;
  font-size: 19px; line-height: 1.15; color: var(--nc-text);
  letter-spacing: -0.01em;
}
.notice-root .bld-group-meta {
  display: flex; gap: 14px; align-items: center;
  font-size: 12px; color: var(--nc-text-3); margin-top: 3px;
  flex-wrap: wrap;
}
.notice-root .bld-group-meta .dot {
  width: 3px; height: 3px; border-radius: 50%; background: var(--nc-text-3);
}
.notice-root .bld-group-info-line {
  font-size: 12px; color: var(--nc-text-2); margin-top: 4px;
  line-height: 1.5; white-space: pre-wrap;
}
.notice-root .bld-group-count {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 12px; font-weight: 600;
  background: var(--nc-accent); color: white;
  padding: 5px 12px; border-radius: 999px; letter-spacing: 0.04em;
}
.notice-root .rooms-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.notice-root .rooms-grid.single { grid-template-columns: 1fr; }
.notice-root .room-card {
  display: grid; grid-template-columns: 64px 1fr auto; gap: 16px;
  padding: 16px 18px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-line);
  border-radius: var(--nc-r-md);
  position: relative;
}
.notice-root .room-card.featured {
  background: linear-gradient(180deg, #fff 0%, #fefaf5 100%);
  border-color: var(--nc-accent-soft);
}
.notice-root .room-num-block {
  background: linear-gradient(140deg, #c96442 0%, #a84a2a 100%);
  color: #fff7eb;
  border-radius: var(--nc-r-sm);
  padding: 10px 6px; text-align: center;
  display: flex; flex-direction: column; justify-content: center; min-height: 60px;
}
.notice-root .room-num-block .floor {
  font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #ffd9b5; margin-bottom: 2px; font-weight: 600;
}
.notice-root .room-num-block .num {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-weight: 700; font-size: 16px; letter-spacing: 0.02em; color: #fff7eb;
}
.notice-root .room-info { min-width: 0; }
.notice-root .room-title {
  font-weight: 600; font-size: 14px; color: var(--nc-text);
  line-height: 1.3; margin-bottom: 4px;
}
.notice-root .room-features { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.notice-root .feat {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--nc-text-2); font-weight: 500;
  padding: 4px 9px;
  background: var(--nc-surface-2);
  border-radius: 999px;
}
.notice-root .feat strong {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-weight: 600; color: var(--nc-text);
}
.notice-root .room-desc {
  font-size: 12px; color: var(--nc-text-3);
  line-height: 1.5; margin: 6px 0 0;
}
.notice-root .room-price {
  text-align: right; display: flex; flex-direction: column; justify-content: center;
  min-width: 110px;
}
.notice-root .room-price .price-val {
  font-family: var(--font-serif), Georgia, serif;
  font-style: italic; font-size: 21px; color: var(--nc-accent-ink);
  line-height: 1; font-variant-numeric: tabular-nums;
}
.notice-root .room-price .price-val small {
  font-size: 11px; font-family: var(--font-sans), system-ui, sans-serif;
  font-style: normal; color: var(--nc-text-3); margin-left: 4px;
}
.notice-root .room-price .price-unit {
  font-size: 11px; color: var(--nc-text-3); margin-top: 4px; letter-spacing: 0.04em;
}
.notice-root .room-price.no-price .price-val {
  font-size: 13px; font-style: normal;
  font-family: var(--font-sans), system-ui, sans-serif;
  color: var(--nc-text-3); font-weight: 500;
}
.notice-root .room-tag {
  position: absolute; top: -8px; right: 16px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 4px 10px; border-radius: 999px;
}
.notice-root .room-tag.hot { background: var(--nc-accent); color: white; }
.notice-root .room-tag.new { background: var(--nc-sage); color: white; }
.notice-root .avail-badge {
  display: inline-block; margin: 6px 0 2px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  padding: 3px 10px; border-radius: 999px;
}
.notice-root .avail-badge.avail-now { background: #dcfce7; color: #15803d; }
.notice-root .avail-badge.avail-soon { background: #fef9c3; color: #92400e; }
.notice-root .policy-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 16px; margin-top: 28px;
}
.notice-root .policy-card {
  background: var(--nc-surface);
  border: 1px solid var(--nc-line);
  border-radius: var(--nc-r-md);
  padding: 20px 22px;
}
.notice-root .policy-card.hl-card {
  background: linear-gradient(180deg, #fff8f0 0%, #fdecdb 100%);
  border-color: var(--nc-accent-soft);
  grid-column: span 2;
}
.notice-root .policy-card.warn-card {
  background: linear-gradient(180deg, #fff7ed 0%, #fef0e8 100%);
  border-color: #f4c0a3;
  grid-column: span 2;
}
.notice-root .policy-card.guide-card {
  background: linear-gradient(140deg, #c96442 0%, #a84a2a 100%);
  color: #fff7eb; border: none;
}
.notice-root .policy-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.notice-root .policy-num {
  width: 30px; height: 30px;
  display: grid; place-items: center;
  background: var(--nc-accent-tint); color: var(--nc-accent);
  border-radius: 8px;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.notice-root .policy-num.warn {
  background: var(--nc-accent); color: white; font-size: 16px;
  font-family: var(--font-serif), Georgia, serif; font-style: italic;
}
.notice-root .guide-card .policy-num {
  background: rgba(255,255,255,0.2); color: #fff7eb;
  border: 1px solid rgba(255,255,255,0.3);
}
.notice-root .policy-head h3 {
  font-family: var(--font-serif), Georgia, serif;
  font-weight: 400; font-size: 18px; margin: 0; line-height: 1.1;
  letter-spacing: -0.01em; color: var(--nc-text);
}
.notice-root .guide-card .policy-head h3 { color: #fff7eb; }
.notice-root .policy-list {
  list-style: none; padding: 0; margin: 0;
  font-size: 13px; color: var(--nc-text-2); line-height: 1.65;
}
.notice-root .policy-list li { padding: 3px 0; }
.notice-root .policy-list li strong { color: var(--nc-text); font-weight: 600; }
.notice-root .policy-note {
  margin-top: 14px; padding-top: 14px;
  border-top: 1px dashed var(--nc-line);
}
.notice-root .policy-note-tag {
  display: inline-block;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  color: var(--nc-accent-ink); background: var(--nc-accent-tint);
  padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
}
.notice-root .commission { padding: 4px 0; }
.notice-root .commission-row {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px;
  align-items: center; margin: 8px 0 16px;
}
.notice-root .c-term {
  font-size: 11px; letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--nc-text-3); font-weight: 700;
  margin-bottom: 6px; text-align: center;
}
.notice-root .c-pct {
  font-family: var(--font-serif), Georgia, serif;
  font-style: italic; font-size: 56px; line-height: 1;
  color: var(--nc-accent); text-align: center;
  font-variant-numeric: tabular-nums;
}
.notice-root .c-pct.alt { color: var(--nc-accent-ink); }
.notice-root .c-pct small {
  font-size: 24px; font-style: italic; margin-left: 2px;
}
.notice-root .c-divider {
  width: 1.5px; height: 72px;
  background: linear-gradient(180deg, transparent, var(--nc-accent) 25%, var(--nc-accent) 75%, transparent);
  justify-self: center;
}
.notice-root .c-sub {
  font-size: 12px; color: var(--nc-text-3);
  text-align: center; line-height: 1.5;
  padding: 12px 16px;
  background: rgba(255,255,255,0.5);
  border-radius: var(--nc-r-sm);
}
.notice-root .bank-block {
  margin-top: 12px; padding: 14px;
  background: var(--nc-surface-2);
  border-radius: var(--nc-r-sm);
  border: 1px dashed var(--nc-line);
  display: flex; flex-direction: column; gap: 6px;
}
.notice-root .bank-row {
  display: flex; justify-content: space-between; align-items: center; font-size: 13px;
}
.notice-root .bank-lbl { color: var(--nc-text-3); font-weight: 500; }
.notice-root .bank-val { color: var(--nc-text); font-weight: 600; }
.notice-root .bank-val.num {
  font-family: var(--font-mono), ui-monospace, monospace;
  letter-spacing: 0.04em;
}
.notice-root .guide-block { padding: 4px 0; }
.notice-root .guide-name {
  font-family: var(--font-serif), Georgia, serif;
  font-style: italic; font-size: 26px; line-height: 1; color: #fff7eb;
}
.notice-root .guide-phone {
  display: inline-flex; align-items: center; gap: 10px;
  margin-top: 10px;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 20px; font-weight: 600;
  color: #fff7eb;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,247,235,0.35);
  padding: 10px 16px; border-radius: var(--nc-r-sm);
  letter-spacing: 0.04em;
}
.notice-root .guide-sub { margin-top: 10px; font-size: 12px; color: #ffd9b5; }
.notice-root .tpl-footer {
  background: var(--nc-surface-2);
  padding: 22px 48px;
  border-top: 1px solid var(--nc-line);
  display: flex; justify-content: space-between; align-items: center; gap: 32px;
  flex-wrap: wrap;
}
.notice-root .tpl-footer-contact { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.notice-root .contact-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--nc-text-2); font-weight: 500;
}
.notice-root .contact-item svg { color: var(--nc-accent); flex-shrink: 0; }
.notice-root .tpl-footer-note {
  font-size: 11px; color: var(--nc-text-3);
  text-align: right; max-width: 280px; line-height: 1.4;
}
.notice-root .tpl-footer-note strong { color: var(--nc-text-2); }
`;
