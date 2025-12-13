import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import type { ProfileData } from '../hooks/useProfileData';

interface HeroProps {
  data: ProfileData;
}

function formatNumber(num: number | null): string {
  if (num === null) return '—';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function AnimatedCounter({ value, duration = 2000 }: { value: number | null; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (value === null || hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * value));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);

  return (
    <div ref={ref} className="text-4xl md:text-5xl font-bold text-slate-800">
      {value === null ? '—' : formatNumber(count)}
    </div>
  );
}

export function Hero({ data }: HeroProps) {
  return (
    <section className="relative py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-blue-700 text-sm font-medium">
              Level {data.level ?? '—'} Google Local Guide
            </span>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-800 leading-tight">
            Helping millions discover<br />
            <span className="text-blue-600">amazing places</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12"
        >
          8+ years documenting the world's best restaurants, hotels, and landmarks.
          My photos and reviews help travelers make confident decisions.
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-12"
        >
          <div className="bg-slate-50 rounded-2xl p-6">
            <AnimatedCounter value={data.totalViews} />
            <div className="text-slate-500 text-sm uppercase tracking-wide mt-1">Total Views</div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="text-4xl md:text-5xl font-bold text-slate-800">
              {formatNumber(data.totalPhotos)}
            </div>
            <div className="text-slate-500 text-sm uppercase tracking-wide mt-1">Photos</div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="text-4xl md:text-5xl font-bold text-slate-800">
              {formatNumber(data.totalReviews)}
            </div>
            <div className="text-slate-500 text-sm uppercase tracking-wide mt-1">Reviews</div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="text-4xl md:text-5xl font-bold text-slate-800">8+</div>
            <div className="text-slate-500 text-sm uppercase tracking-wide mt-1">Years Active</div>
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
            href={data.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            View Google Profile
          </a>
          <a
            href="#contributions"
            className="inline-flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-full hover:bg-slate-50 transition-colors"
          >
            Explore My Work
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
