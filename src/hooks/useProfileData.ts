import { useQuery } from '@tanstack/react-query';
import profileData from '../data/profile.json';

export const PROFILE_URL = 'https://www.google.com/maps/contrib/103557089728311501865';

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  placeName?: string | null;
  placeUrl?: string | null;
  rating?: number | null;
}

export interface ProfileData {
  needsSetup?: boolean;
  name: string | null;
  level: number | null;
  totalViews: number | null;
  totalPhotos: number | null;
  totalReviews: number | null;
  points?: number | null;
  localGuide?: boolean;
  thumbnailUrl?: string | null;
  profileUrl: string;
  photos: Photo[];
  lastUpdated: string | null;
  scrapedSuccessfully: boolean;
  error?: string;
}

const getProfileData = async (): Promise<ProfileData> => {
  return profileData as ProfileData;
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfileData,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
