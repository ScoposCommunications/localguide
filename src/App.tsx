import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero, FilterBar, ContributionGrid, Footer } from './components';
import { useProfileData } from './hooks/useProfileData';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading Profile Data</h2>
        <p className="text-slate-500">Fetching your Google Maps contributions...</p>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Failed to Load Profile</h2>
        <p className="text-slate-600 mb-4">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function Portfolio() {
  const { data, isLoading, error } = useProfileData();
  const [searchQuery, setSearchQuery] = useState('');

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error as Error} />;
  }

  if (!data) {
    return <ErrorState error={new Error('No data received from API')} />;
  }

  // Filter photos by search query
  const filteredPhotos = data.photos?.filter(photo => {
    if (!searchQuery) return true;
    return photo.id.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Hero data={data} />
      <FilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {data.photos && data.photos.length > 0 ? (
          <>
            <div className="mb-6">
              <p className="text-slate-500">
                Showing <span className="text-slate-800 font-medium">{filteredPhotos.length}</span> photos
                {searchQuery && (
                  <span> matching "<span className="text-blue-600">{searchQuery}</span>"</span>
                )}
              </p>
            </div>
            <ContributionGrid photos={filteredPhotos} />
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-500">No photos available yet. Run the data extraction to populate this section.</p>
          </div>
        )}
      </main>

      <Footer profileUrl={data.profileUrl} />
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
