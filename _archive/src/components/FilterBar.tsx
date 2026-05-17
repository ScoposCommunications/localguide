import { motion } from 'framer-motion';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function FilterBar({ searchQuery, onSearchChange }: FilterBarProps) {
  return (
    <motion.div
      id="contributions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 py-4 px-6"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Photo Gallery</h2>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="
              w-48 md:w-64 pl-10 pr-4 py-2 rounded-full
              bg-slate-100 border border-slate-200
              text-slate-800 placeholder-slate-400
              focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20
              transition-all duration-200
            "
          />
        </div>
      </div>
    </motion.div>
  );
}
