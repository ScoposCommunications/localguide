import { useQuery } from '@tanstack/react-query';

const CONTRIBUTOR_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${CONTRIBUTOR_ID}`;

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

const fetchWithTimeout = async (url: string, timeout = 55000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. The server took too long to respond.');
    }
    throw error;
  }
};

const fetchProfileData = async (): Promise<ProfileData> => {
  try {
    const response = await fetchWithTimeout(`/api/profile/${CONTRIBUTOR_ID}`);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Response wasn't JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to extract profile data');
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while fetching profile');
  }
};

export function useProfileData() {
  return useQuery({
    queryKey: ['profile', CONTRIBUTOR_ID],
    queryFn: fetchProfileData,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
    retryDelay: 3000,
  });
}

export { PROFILE_URL };
