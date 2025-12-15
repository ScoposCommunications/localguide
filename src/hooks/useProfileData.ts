import { useQuery } from '@tanstack/react-query';

export const PROFILE_ID = '103557089728311501865';
export const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
}

export interface ProfileData {
  needsSetup?: boolean;
  name: string | null;
  level: number | null;
  totalViews: number | null;
  totalPhotos: number | null;
  totalReviews: number | null;
  totalRatings?: number | null;
  profileUrl: string;
  photos: Photo[];
  lastUpdated: string | null;
  scrapedSuccessfully: boolean;
  error?: string;
}

const getProfileData = async (): Promise<ProfileData> => {
  const response = await fetch(`/api/profile/${PROFILE_ID}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    return {
      name: null,
      level: null,
      totalViews: null,
      totalPhotos: null,
      totalReviews: null,
      profileUrl: PROFILE_URL,
      photos: [],
      lastUpdated: null,
      scrapedSuccessfully: false,
      error: error.message || error.error || 'Failed to fetch profile'
    };
  }
  return response.json();
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile', PROFILE_ID],
    queryFn: getProfileData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    retryDelay: 1000,
  });
}
