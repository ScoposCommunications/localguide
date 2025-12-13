import { useQuery } from '@tanstack/react-query';
import { profileData as fallbackData } from '../data/profileData';
import scrapedProfile from '../data/profile.json';
import type { ProfileData } from '../types';

const getProfileData = async (): Promise<ProfileData> => {
  // Use scraped data if it exists and was successful
  if (scrapedProfile && scrapedProfile.scrapedSuccessfully) {
    return {
      name: scrapedProfile.name || 'Local Guide',
      level: scrapedProfile.level || fallbackData.level,
      totalViews: scrapedProfile.totalViews || fallbackData.totalViews,
      totalPhotos: scrapedProfile.totalPhotos || fallbackData.totalPhotos,
      totalReviews: scrapedProfile.totalReviews || fallbackData.totalReviews,
      profileUrl: scrapedProfile.profileUrl || fallbackData.profileUrl,
      // Use scraped photos if available, otherwise use fallback contributions
      contributions: scrapedProfile.photos && scrapedProfile.photos.length > 0
        ? scrapedProfile.photos.map((photo: any, i: number) => ({
            id: photo.id || `photo-${i}`,
            placeName: `Photo ${i + 1}`,
            placeUrl: scrapedProfile.profileUrl,
            photoUrl: photo.url || photo.photoUrl,
            thumbnailUrl: photo.thumbnail || photo.thumbnailUrl,
            viewCount: Math.floor(scrapedProfile.totalViews / scrapedProfile.totalPhotos) || 0,
            category: 'Other' as const,
          }))
        : fallbackData.contributions,
      lastUpdated: scrapedProfile.lastUpdated,
    };
  }

  // Fall back to static data if scraping hasn't run yet
  return {
    ...fallbackData,
    // Use scraped stats if available even if photos weren't scraped
    level: scrapedProfile.level || fallbackData.level,
    totalViews: scrapedProfile.totalViews || fallbackData.totalViews,
    totalPhotos: scrapedProfile.totalPhotos || fallbackData.totalPhotos,
    totalReviews: scrapedProfile.totalReviews || fallbackData.totalReviews,
  };
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfileData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
  });
}
