import { useQuery } from '@tanstack/react-query';
import scrapedData from '../data/profile.json';
import configData from '../data/profile-config.json';

export const PROFILE_URL = 'https://www.google.com/maps/contrib/103557089728311501865';

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
}

export interface ProfileData {
  name: string | null;
  level: number | null;
  totalViews: number | null;
  totalPhotos: number | null;
  totalReviews: number | null;
  profileUrl: string;
  photos: Photo[];
  lastUpdated: string | null;
  scrapedSuccessfully: boolean;
  error?: string;
}

const getProfileData = async (): Promise<ProfileData> => {
  // If scraping succeeded, use scraped data
  if (scrapedData.scrapedSuccessfully) {
    return scrapedData as ProfileData;
  }

  // Fall back to config data (manual/static values)
  return {
    name: configData.name,
    level: configData.level,
    totalViews: configData.totalViews,
    totalPhotos: configData.totalPhotos,
    totalReviews: configData.totalReviews,
    profileUrl: configData.profileUrl || PROFILE_URL,
    photos: [],
    lastUpdated: new Date().toISOString(),
    scrapedSuccessfully: true, // Config is always "successful"
  };
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfileData,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
