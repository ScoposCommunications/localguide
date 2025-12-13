import { useQuery } from '@tanstack/react-query';

const CONTRIBUTOR_ID = '103557089728311501865';

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
}

export interface ProfileData {
  success: boolean;
  profileUrl: string;
  contributorId: string;
  name: string;
  level: number | null;
  totalViews: number | null;
  totalPhotos: number | null;
  totalReviews: number | null;
  totalRatings: number | null;
  totalEdits: number | null;
  photos: Photo[];
  extractedAt: string;
}

export interface ProfileError {
  error: string;
  message: string;
  debug?: {
    url: string;
    rawTextSample: string;
  };
}

const fetchProfileData = async (): Promise<ProfileData> => {
  const response = await fetch(`/api/profile/${CONTRIBUTOR_ID}`);

  if (!response.ok) {
    const errorData: ProfileError = await response.json();
    throw new Error(errorData.message || errorData.error || 'Failed to fetch profile data');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to extract profile data');
  }

  return data;
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile', CONTRIBUTOR_ID],
    queryFn: fetchProfileData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
