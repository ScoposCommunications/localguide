import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero, FilterBar, ContributionGrid, Footer } from './components';
import { useProfileData, PROFILE_URL } from './hooks/useProfileData';

const queryClient = new QueryClient();

function ScrapeError({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Scrape Failed</h1>
        <p className="text-slate-500 mb-4">
          {message || 'Could not extract data from Google Maps profile'}
        </p>
        <a
          href={PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          View Profile on Google Maps
        </a>
      </div>
    </div>
  );
}

function Portfolio() {
  const { data, isLoading } = useProfileData();
  const [searchQuery, setSearchQuery] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show error if scrape failed
  if (!data || !data.scrapedSuccessfully) {
    return <ScrapeError message={data?.error} />;
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
            <p className="text-slate-500">No photos extracted from profile.</p>
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
