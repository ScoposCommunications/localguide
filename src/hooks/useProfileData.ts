import { useQuery } from '@tanstack/react-query';
import { profileData as fallbackData } from '../data/profileData';
import type { ProfileData } from '../types';

const fetchProfileData = async (): Promise<ProfileData> => {
  try {
    const response = await fetch('/api/profile');
    if (!response.ok) {
      throw new Error('API request failed');
    }
    const data = await response.json();

    // If API returns data with actual values, use it
    if (data.totalViews > 0 || data.totalPhotos > 0) {
      return {
        ...data,
        contributions: data.contributions?.length > 0
          ? data.contributions.map((c: any, i: number) => ({
              ...c,
              id: c.id || `photo-${i}`,
              placeName: c.placeName || 'Photo',
              placeUrl: c.placeUrl || data.profileUrl,
              viewCount: c.viewCount || 0,
              category: c.category || 'Other',
            }))
          : fallbackData.contributions,
      };
    }

    // If API returns empty data, use fallback
    return fallbackData;
  } catch (error) {
    console.warn('Failed to fetch from API, using fallback data:', error);
    return fallbackData;
  }
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfileData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: 1,
  });
}
