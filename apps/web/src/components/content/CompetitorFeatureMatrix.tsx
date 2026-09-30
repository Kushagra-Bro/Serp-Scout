import { CheckCircle2, ExternalLink, X, Zap } from 'lucide-react';

export interface MessagingCompetitorRow {
  competitorName: string;
  domain: string;
  headline: string;
  primaryOffer: string;
  priceLanguage: string | null;
  guarantees?: string | null;
  speedOfService?: string | null;
  sourceUrl?: string;
  features?: {
    hasOnlineBooking: boolean;
    hasEmergencyService: boolean;
    hasTransparentPricing: boolean;
    hasSatisfactionGuarantee: boolean;
  };
}

interface CompetitorFeatureMatrixProps {
  competitors: MessagingCompetitorRow[];
}

function YesNoCell({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
      <CheckCircle2 className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-300">
      <X className="w-3.5 h-3.5" />
    </span>
  );
}

/**
 * Audit table showing which core booking capabilities each competitor actually
 * promotes, so the owner can see the gap between their site and the market's.
 */
export default function CompetitorFeatureMatrix({ competitors }: CompetitorFeatureMatrixProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Market Feature &amp; Conversion Hook Matrix</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct audit of which core booking capabilities your competitors actively promote on the
            web.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 self-start sm:self-auto">
          {competitors.length} Rivals Audited
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-[11px]">
              <th className="py-3 px-4 font-bold">Competitor</th>
              <th className="py-3 px-3 font-bold text-center">📱 Online Booking</th>
              <th className="py-3 px-3 font-bold text-center">⚡ Same-Day / Emergency</th>
              <th className="py-3 px-3 font-bold text-center">💳 Clear Pricing / Deals</th>
              <th className="py-3 px-3 font-bold text-center">🛡️ Guarantees</th>
              <th className="py-3 px-4 font-bold">Primary Lead Hook</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {competitors.map((c, i) => (
              <tr key={i} className="hover:bg-slate-50/80 transition">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{c.competitorName}</span>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-indigo-600 transition"
                        title="View Competitor Website"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">{c.domain}</span>
                </td>
                <td className="py-3.5 px-3 text-center">
                  <YesNoCell yes={!!c.features?.hasOnlineBooking} />
                </td>
                <td className="py-3.5 px-3 text-center">
                  <YesNoCell
                    yes={
                      !!c.features?.hasEmergencyService ||
                      !!c.speedOfService?.toLowerCase().includes('same day') ||
                      !!c.speedOfService?.toLowerCase().includes('emergency')
                    }
                  />
                </td>
                <td className="py-3.5 px-3 text-center">
                  <YesNoCell
                    yes={!!c.features?.hasTransparentPricing || !!c.priceLanguage}
                  />
                </td>
                <td className="py-3.5 px-3 text-center">
                  <YesNoCell
                    yes={!!c.features?.hasSatisfactionGuarantee || !!c.guarantees}
                  />
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-semibold text-slate-800 text-xs block">
                    {c.primaryOffer || c.headline}
                  </span>
                  {c.priceLanguage && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 inline-block mt-0.5">
                      {c.priceLanguage}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
