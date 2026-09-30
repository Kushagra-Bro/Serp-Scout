import { CheckCircle2, Star, TrendingUp } from 'lucide-react';

export interface StatBusiness {
  id: string;
  name: string;
  city?: string;
  websiteUrl?: string;
}

export interface StatMapResult {
  rank: number;
  title: string;
  url: string;
  rating?: string;
  reviewCount?: number;
}

interface LocalStatCardsProps {
  businesses: StatBusiness[];
  selectedBizId: string;
  mapResults: StatMapResult[];
  location: string;
}

/**
 * Live stat cards derived from the current Maps 3-Pack audit. The benchmark
 * maths lives here so the page component stays focused on orchestration.
 */
export default function LocalStatCards({
  businesses,
  selectedBizId,
  mapResults,
  location,
}: LocalStatCardsProps) {
  const selectedBiz = businesses.find((b) => b.id === selectedBizId);

  const myRankItem = mapResults.find((m) => {
    if (selectedBiz?.name && m.title.toLowerCase().includes(selectedBiz.name.toLowerCase())) {
      return true;
    }
    if (selectedBiz?.websiteUrl && m.url) {
      try {
        const host = new URL(selectedBiz.websiteUrl).hostname.replace(/^www\./, '');
        return m.url.includes(host);
      } catch {
        return false;
      }
    }
    return false;
  });

  const averageRivalRating =
    mapResults.length > 0
      ? (
          mapResults.reduce((acc, curr) => acc + (parseFloat(curr.rating || '0') || 0), 0) /
          (mapResults.filter((m) => m.rating).length || 1)
        ).toFixed(1)
      : '4.8';

  const totalReviewsAudited = mapResults.reduce(
    (acc, curr) => acc + (curr.reviewCount || 0),
    0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Google Maps 3-Pack Presence
          </span>
          <span
            className={`p-1.5 rounded-lg ${
              myRankItem && myRankItem.rank <= 3
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl font-black text-slate-900 mt-2">
          {myRankItem
            ? `#${myRankItem.rank} in 3-Pack`
            : mapResults.length > 0
            ? 'Top 10 Contender'
            : 'Awaiting Audit'}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {myRankItem
            ? `Ranked #${myRankItem.rank} in local customer radius`
            : `${mapResults.length} local competitors analyzed`}
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Local Pack Rating Benchmark
          </span>
          <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Star className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl font-black text-indigo-600 mt-2 flex items-center gap-1.5">
          <span>{myRankItem?.rating || averageRivalRating}</span>
          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          <span className="text-sm font-semibold text-slate-400">
            ({myRankItem
              ? `${myRankItem.reviewCount || 0} reviews`
              : `avg ${averageRivalRating}`}
            )
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {totalReviewsAudited > 0
            ? `${totalReviewsAudited} total customer reviews benchmarked`
            : 'Direct trust differentiator against rivals'}
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Audited Target Territory
          </span>
          <span className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
            <TrendingUp className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl font-black text-cyan-700 mt-2 truncate">
          {location ? location : 'Indirapuram'}
        </div>
        <p className="text-xs text-slate-500 mt-1">Direct phone calls &amp; directions focused</p>
      </div>
    </div>
  );
}
