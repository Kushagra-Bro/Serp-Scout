import { MapPin, Search } from 'lucide-react';

export interface HeaderBusiness {
  id: string;
  name: string;
  city?: string;
}

interface LocalSeoHeaderProps {
  businesses: HeaderBusiness[];
  selectedBizId: string;
  onBusinessChange: (businessId: string) => void;
  onScan: () => void;
  scanning: boolean;
}

/**
 * Page header for the Local SEO command center: title block, business
 * selector, and the live Maps 3-Pack audit trigger.
 */
export default function LocalSeoHeader({
  businesses,
  selectedBizId,
  onBusinessChange,
  onScan,
  scanning,
}: LocalSeoHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white flex items-center justify-center shadow-sm">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Local SEO &amp; Google Maps
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Track Google Maps 3-Pack positions, sentiment gaps, and local competitor proximity.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {businesses.length > 1 && (
          <select
            value={selectedBizId}
            onChange={(e) => onBusinessChange(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 shadow-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {businesses.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.name} ({biz.city || 'Local'})
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onScan}
          disabled={scanning}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-95 shadow-sm transition disabled:opacity-50 flex items-center gap-2"
        >
          {scanning ? (
            <>
              <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Auditing Maps 3-Pack...
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              Live Maps Audit
            </>
          )}
        </button>
      </div>
    </div>
  );
}
