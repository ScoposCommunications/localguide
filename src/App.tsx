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
    viewMode: 'grid',
  });

  const filteredContributions = useMemo(() => {
    if (!data?.contributions) return [];

    return data.contributions.filter((contribution) => {
      if (filters.category !== 'All' && contribution.category !== filters.category) {
        return false;
      }
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Unable to Load</h2>
          <p className="text-zinc-400">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Hero data={data} isLoading={isLoading} />
      <FilterBar filters={filters} onFilterChange={setFilters} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!isLoading && (
          <div className="mb-6">
            <p className="text-zinc-500">
              Showing{' '}
              <span className="text-white font-medium">{filteredContributions.length}</span>
              {' '}contributions
              {filters.category !== 'All' && (
                <span className="text-emerald-400"> in {filters.category}</span>
              )}
              {filters.searchQuery && (
                <span> matching "<span className="text-emerald-400">{filters.searchQuery}</span>"</span>
              )}
            </p>
          </div>
        )}

        {filters.viewMode === 'map' ? (
          <ContributionMap contributions={filteredContributions} isLoading={isLoading} />
        ) : (
          <ContributionGrid contributions={filteredContributions} isLoading={isLoading} />
        )}
      </main>

      <Footer profileUrl={data?.profileUrl || 'https://www.google.com/maps/contrib/103557089728311501865'} />
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
