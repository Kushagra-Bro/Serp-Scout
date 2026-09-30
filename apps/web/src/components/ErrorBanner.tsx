import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message?: string | null;
  /** When provided, a dismiss button appears and calls back with null-reason. */
  onDismiss?: () => void;
  /** Compact layout without the icon and rounded corners used on filter bars. */
  compact?: boolean;
}

/**
 * Shared error banner used across the dashboard pages, which each previously
 * carried their own byte-identical (or near-identical) copy of this markup.
 */
export default function ErrorBanner({ message, onDismiss, compact }: ErrorBannerProps) {
  if (!message) return null;

  if (compact) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between animate-fade-in shadow-xs">
        <span>{message}</span>
        {onDismiss && (
          <button onClick={onDismiss} className="text-rose-500 hover:text-rose-700 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center gap-2 animate-fade-in">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}