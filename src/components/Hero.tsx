import { motion } from 'framer-motion';
import { useAnimatedCounter, formatNumber } from '../hooks/useAnimatedCounter';
import type { ProfileData } from '../types';

interface HeroProps {
  data: ProfileData | undefined;
  isLoading: boolean;
}

export function Hero({ data, isLoading }: HeroProps) {
  const { count: viewCount, ref: viewCountRef } = useAnimatedCounter(
    data?.totalViews ?? 0,
    2500
  );

  return (
    <section className="relative min-h-screen flex flex-col justify-center px-6 py-20">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-transparent to-blue-950/20" />

      <div className="relative z-10 max-w-6xl mx-auto w-full">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          {isLoading ? (
            <div className="h-8 w-48 bg-white/5 rounded-full animate-pulse" />
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">Level {data?.level} Google Local Guide</span>
            </div>
          )}
        </motion.div>

        {/* Main headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            Helping millions discover<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              amazing places
            </span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12"
        >
          8+ years documenting the world's best restaurants, hotels, and landmarks.
          My photos and reviews help travelers make confident decisions.
        </motion.p>

        {/* Stats row */}
        <motion.div
          ref={viewCountRef}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-12"
        >
          <div className="space-y-1">
            {isLoading ? (
              <div className="h-12 w-32 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-4xl md:text-5xl font-bold text-white">
                {formatNumber(viewCount)}
              </div>
            )}
            <div className="text-zinc-500 text-sm uppercase tracking-wide">Total Views</div>
          </div>

          <div className="space-y-1">
            {isLoading ? (
              <div className="h-12 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-4xl md:text-5xl font-bold text-white">
                {formatNumber(data?.totalPhotos ?? 0)}
              </div>
            )}
            <div className="text-zinc-500 text-sm uppercase tracking-wide">Photos</div>
          </div>

          <div className="space-y-1">
            {isLoading ? (
              <div className="h-12 w-20 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-4xl md:text-5xl font-bold text-white">
                {formatNumber(data?.totalReviews ?? 0)}
              </div>
            )}
            <div className="text-zinc-500 text-sm uppercase tracking-wide">Reviews</div>
          </div>

          <div className="space-y-1">
            <div className="text-4xl md:text-5xl font-bold text-white">8+</div>
            <div className="text-zinc-500 text-sm uppercase tracking-wide">Years Active</div>
          </div>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap gap-4"
        >
          <a
            href={data?.profileUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 font-semibold rounded-full hover:bg-zinc-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            View Google Profile
          </a>
          <a
            href="#contributions"
            className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-700 text-white font-semibold rounded-full hover:bg-white/5 transition-colors"
          >
            Explore My Work
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent" />
    </section>
  );
}
