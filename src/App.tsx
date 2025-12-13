import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero, FilterBar, ContributionGrid, Footer } from './components';
import { useProfileData, PROFILE_URL } from './hooks/useProfileData';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingState() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading Profile Data</h2>
        <p className="text-slate-500 mb-2">Fetching your Google Maps contributions...</p>
        <p className="text-slate-400 text-sm">
          {elapsed < 10 ? 'Starting up...' :
           elapsed < 30 ? 'Launching browser...' :
           elapsed < 45 ? 'Extracting data...' :
           'Almost done...'}
          ({elapsed}s)
        </p>
        {elapsed > 55 && (
          <p className="text-amber-600 text-sm mt-2">Taking longer than expected...</p>
        )}
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
        <p className="text-slate-600 mb-6">{error.message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            View on Google
          </a>
        </div>
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
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">Photos Loading</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Profile stats loaded successfully. Photo extraction may take additional time.
            </p>
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
