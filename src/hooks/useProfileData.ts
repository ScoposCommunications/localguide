import { useQuery } from '@tanstack/react-query';
import type { ProfileData } from '../types';

const fetchProfileData = async (): Promise<ProfileData> => {
  const response = await fetch('/api/profile');
  if (!response.ok) {
    throw new Error('Failed to fetch profile data');
  }
  return response.json();
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfileData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2, // 2 hours (formerly cacheTime)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
