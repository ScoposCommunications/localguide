import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero, FilterBar, ContributionMap, ContributionGrid, Footer } from './components';
import { useProfileData } from './hooks/useProfileData';
import type { FilterState } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

function Portfolio() {
  const { data, isLoading, error } = useProfileData();

  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    searchQuery: '',
    viewMode: 'map',
  });

  const filteredContributions = useMemo(() => {
    if (!data?.contributions) return [];

    return data.contributions.filter((contribution) => {
      // Filter by category
      if (filters.category !== 'All' && contribution.category !== filters.category) {
        return false;
      }

      // Filter by search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!contribution.placeName.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [data?.contributions, filters.category, filters.searchQuery]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-white mb-2">Unable to Load Profile</h2>
          <p className="text-[#94a3b8]">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section */}
      <Hero data={data} isLoading={isLoading} />

      {/* Filter Bar */}
      <FilterBar filters={filters} onFilterChange={setFilters} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Results count */}
        {!isLoading && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-[#94a3b8]">
              Showing{' '}
              <span className="text-white font-semibold">
                {filteredContributions.length}
              </span>{' '}
              contributions
              {filters.category !== 'All' && (
                <span>
                  {' '}in <span className="text-[#34a853]">{filters.category}</span>
                </span>
              )}
              {filters.searchQuery && (
                <span>
                  {' '}matching "<span className="text-[#34a853]">{filters.searchQuery}</span>"
                </span>
              )}
            </p>
          </div>
        )}

        {/* Map or Grid View */}
        {filters.viewMode === 'map' ? (
          <ContributionMap
            contributions={filteredContributions}
            isLoading={isLoading}
          />
        ) : (
          <ContributionGrid
            contributions={filteredContributions}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        profileUrl={data?.profileUrl || 'https://www.google.com/maps/contrib/103557089728311501865'}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Portfolio />
    </QueryClientProvider>
  );
}

export default App;
