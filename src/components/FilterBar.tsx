import { motion } from 'framer-motion';
import type { Category, FilterState, ViewMode } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const categories: (Category | 'All')[] = [
  'All',
  'Food',
  'Hotels',
  'Attractions',
  'Outdoors',
  'Shopping',
  'Landmarks',
];

const categoryIcons: Record<Category | 'All', string> = {
  All: '🌍',
  Food: '🍽️',
  Hotels: '🏨',
  Attractions: '🎢',
  Outdoors: '🏕️',
  Shopping: '🛍️',
  Landmarks: '🏛️',
  Other: '📍',
};

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const handleCategoryChange = (category: Category | 'All') => {
    onFilterChange({ ...filters, category });
  };

  const handleSearchChange = (searchQuery: string) => {
    onFilterChange({ ...filters, searchQuery });
  };

  const handleViewModeChange = (viewMode: ViewMode) => {
    onFilterChange({ ...filters, viewMode });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 glass py-4 px-4"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4">
        {/* Category buttons */}
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${
                  filters.category === category
                    ? 'bg-[#34a853] text-white shadow-lg shadow-[#34a853]/25'
                    : 'bg-[#1f1f1f] text-[#94a3b8] hover:bg-[#2a2a2a] hover:text-white'
                }
              `}
            >
              <span className="mr-1.5">{categoryIcons[category]}</span>
              {category}
            </button>
          ))}
        </div>

        {/* Search and view toggle */}
        <div className="flex items-center gap-3 md:ml-auto">
          {/* Search input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]"
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
              placeholder="Search places..."
              value={filters.searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="
                w-48 md:w-64 pl-10 pr-4 py-2 rounded-full
                bg-[#1f1f1f] border border-[#2a2a2a]
                text-white placeholder-[#94a3b8]
                focus:outline-none focus:border-[#34a853]/50 focus:ring-1 focus:ring-[#34a853]/50
                transition-all duration-200
              "
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#1f1f1f] rounded-full p-1">
            <button
              onClick={() => handleViewModeChange('map')}
              className={`
                p-2 rounded-full transition-all duration-200
                ${
                  filters.viewMode === 'map'
                    ? 'bg-[#34a853] text-white'
                    : 'text-[#94a3b8] hover:text-white'
                }
              `}
              title="Map View"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </button>
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`
                p-2 rounded-full transition-all duration-200
                ${
                  filters.viewMode === 'grid'
                    ? 'bg-[#34a853] text-white'
                    : 'text-[#94a3b8] hover:text-white'
                }
              `}
              title="Grid View"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
