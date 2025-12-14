import { useState } from 'react';
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

function SetupRequired() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Setup Required</h1>
          <p className="text-slate-500">Run the data scraper to load your real Google Maps profile data</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h3 className="font-semibold text-slate-800">Go to GitHub Actions</h3>
              <p className="text-slate-500 text-sm">Navigate to your repository's Actions tab</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <h3 className="font-semibold text-slate-800">Run "Scrape Google Maps Profile"</h3>
              <p className="text-slate-500 text-sm">Click on the workflow, then click "Run workflow"</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <h3 className="font-semibold text-slate-800">Wait for completion</h3>
              <p className="text-slate-500 text-sm">The workflow will scrape your profile and update the site automatically</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/ScoposCommunications/localguide/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-center"
          >
            Open GitHub Actions
          </a>
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-center"
          >
            View Google Profile
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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return <SetupRequired />;
  }

  if (!data || data.needsSetup || !data.scrapedSuccessfully) {
    return <SetupRequired />;
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
            <p className="text-slate-500">Photos will appear here after scraping completes.</p>
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
