import { useQuery } from '@tanstack/react-query';
import profileData from '../data/profile.json';

export const PROFILE_URL = 'https://www.google.com/maps/contrib/103557089728311501865';

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
}

export interface ProfileData {
  name: string;
  level: number;
  totalViews: number;
  totalPhotos: number;
  totalReviews: number;
  profileUrl: string;
  photos: Photo[];
  lastUpdated: string;
  scrapedSuccessfully: boolean;
  message?: string;
}

const getProfileData = async (): Promise<ProfileData> => {
  // Return the static data from the JSON file
  // This file is updated by GitHub Actions
  return profileData as ProfileData;
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfileData,
    staleTime: Infinity, // Static data doesn't go stale
    gcTime: Infinity,
  });
}
