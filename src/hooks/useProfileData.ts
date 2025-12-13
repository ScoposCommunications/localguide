import { useQuery } from '@tanstack/react-query';
import { profileData } from '../data/profileData';
import type { ProfileData } from '../types';

const fetchProfileData = async (): Promise<ProfileData> => {
  // Simulate network delay for loading animation
  await new Promise((resolve) => setTimeout(resolve, 800));
  return profileData;
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfileData,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
  });
}
