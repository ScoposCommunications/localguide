import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero, FilterBar, ContributionGrid, Footer } from './components';
import { useProfileData, PROFILE_URL } from './hooks/useProfileData';

const queryClient = new QueryClient();

function ScrapeError({ message, lastUpdated }: { message?: string; lastUpdated?: string | null }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Data Sync In Progress</h1>
        <p className="text-slate-500 mb-6">
          {message || 'Profile data is being fetched from Google Maps. This usually takes a few minutes after deployment.'}
        </p>
        {lastUpdated && (
          <p className="text-xs text-slate-400 mb-6">
            Last attempt: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}
        <div className="space-y-3">
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            View Profile on Google Maps
          </a>
          <a
            href="https://github.com/ScoposCommunications/localguide/actions/workflows/scrape-profile.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-6 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Check Sync Status
          </a>
        </div>
        <p className="text-xs text-slate-400 mt-6">
          Data syncs automatically every day at 6 AM UTC
        </p>
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
    return <ScrapeError message={data?.error} lastUpdated={data?.lastUpdated} />;
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
