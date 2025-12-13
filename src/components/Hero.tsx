import { motion } from 'framer-motion';
import { useAnimatedCounter, formatNumber } from '../hooks/useAnimatedCounter';
import type { ProfileData } from '../types';

interface HeroProps {
  data: ProfileData | undefined;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  delay?: number;
  isLoading: boolean;
}

function StatCard({ label, value, suffix = '', delay = 0, isLoading }: StatCardProps) {
  const { count, ref } = useAnimatedCounter(value, 2000);

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <div className="skeleton h-10 w-24 mx-auto mb-2 rounded" />
        <div className="skeleton h-4 w-16 mx-auto rounded" />
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="glass rounded-2xl p-6 text-center hover:border-[#34a853]/30 transition-colors"
    >
      <div className="text-3xl md:text-4xl font-bold text-white mb-1">
        {formatNumber(count)}{suffix}
      </div>
      <div className="text-sm text-[#94a3b8] uppercase tracking-wider">
        {label}
      </div>
    </motion.div>
  );
}

function LevelBadge({ level, isLoading }: { level: number; isLoading: boolean }) {
  if (isLoading) {
    return <div className="skeleton h-8 w-32 rounded-full" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#34a853]/20 border border-[#34a853]/40"
    >
      <svg className="w-5 h-5 text-[#34a853]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
      <span className="text-[#34a853] font-semibold">Level {level} Local Guide</span>
    </motion.div>
  );
}

export function Hero({ data, isLoading }: HeroProps) {
  const { count: viewCount, ref: viewCountRef } = useAnimatedCounter(
    data?.totalViews ?? 0,
    2500
  );

  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#34a853]/5 via-transparent to-transparent pointer-events-none" />

      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#34a853]/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.05, 0.1, 0.05],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#3b82f6]/20 blur-3xl"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Level badge */}
        <div className="mb-8">
          <LevelBadge level={data?.level ?? 0} isLoading={isLoading} />
        </div>

        {/* Main view count */}
        <div ref={viewCountRef} className="mb-4">
          {isLoading ? (
            <div className="skeleton h-32 w-96 mx-auto rounded-xl" />
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-7xl md:text-9xl lg:text-[140px] font-black tracking-tight"
            >
              <span className="bg-gradient-to-r from-white via-white to-[#94a3b8] bg-clip-text text-transparent">
                {formatNumber(viewCount)}
              </span>
            </motion.h1>
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-xl md:text-2xl text-[#94a3b8] mb-12"
        >
          Total Photo Views on Google Maps
        </motion.p>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-2xl mx-auto">
          <StatCard
            label="Photos"
            value={data?.totalPhotos ?? 0}
            delay={0.4}
            isLoading={isLoading}
          />
          <StatCard
            label="Reviews"
            value={data?.totalReviews ?? 0}
            delay={0.5}
            isLoading={isLoading}
          />
          <div className="col-span-2 md:col-span-1">
            <StatCard
              label="Years Contributing"
              value={8}
              suffix="+"
              delay={0.6}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-16"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center text-[#94a3b8]"
          >
            <span className="text-sm mb-2">Explore Contributions</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
