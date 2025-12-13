import { motion } from 'framer-motion';
import type { Contribution } from '../types';

interface ContributionGridProps {
  contributions: Contribution[];
  isLoading: boolean;
}

function ContributionCard({ contribution, index }: { contribution: Contribution; index: number }) {
  const viewCountFormatted = contribution.viewCount.toLocaleString();

  return (
    <motion.a
      href={contribution.placeUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.3) }}
      className="group relative block overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 transition-all duration-300"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={contribution.thumbnailUrl || contribution.photoUrl}
          alt={contribution.placeName}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50">
          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
          <span className="text-xs font-medium text-white">{viewCountFormatted}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs">
            {contribution.category}
          </span>
          {contribution.rating && (
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs text-zinc-400">{contribution.rating}</span>
            </div>
          )}
        </div>

        <h3 className="text-white font-medium leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors">
          {contribution.placeName}
        </h3>
      </div>
    </motion.a>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800/50">
      <div className="aspect-[4/3] bg-zinc-800 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
        <div className="h-5 w-3/4 bg-zinc-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ContributionGrid({ contributions, isLoading }: ContributionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(9)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-1">No results found</h3>
        <p className="text-zinc-500">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {contributions.map((contribution, index) => (
        <ContributionCard key={contribution.id} contribution={contribution} index={index} />
      ))}
    </motion.div>
  );
}
