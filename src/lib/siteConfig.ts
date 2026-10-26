/**
 * Public business details shown on the legal pages. Set these in Vercel as
 * VITE_* environment variables; they are public by nature (not secrets).
 */
const v = (key: string, fallback: string) => {
  const val = (import.meta.env as Record<string, string | undefined>)[key];
  return val && val.trim() ? val.trim() : fallback;
};

export const SITE = {
  name: 'Arthashastra AI',
  operator: v('VITE_LEGAL_ENTITY', '[Operator / business name — set VITE_LEGAL_ENTITY]'),
  address: v('VITE_LEGAL_ADDRESS', '[Registered address — set VITE_LEGAL_ADDRESS]'),
  contactEmail: v('VITE_CONTACT_EMAIL', '[Contact email — set VITE_CONTACT_EMAIL]'),
  grievanceOfficer: v('VITE_GRIEVANCE_OFFICER', '[Grievance Officer name — set VITE_GRIEVANCE_OFFICER]'),
  grievanceEmail: v('VITE_GRIEVANCE_EMAIL', '[Grievance email — set VITE_GRIEVANCE_EMAIL]'),
  priceLabel: v('VITE_PRICE_LABEL', '₹34 for 30 days'),
  governingLaw: v('VITE_GOVERNING_LAW', 'the laws of India'),
};
