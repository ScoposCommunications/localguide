export interface Contribution {
  id: string;
  placeName: string;
  placeUrl: string;
  photoUrl: string;
  thumbnailUrl: string;
  viewCount: number;
  rating?: number;
  category: Category;
  coordinates?: {
    lat: number;
    lng: number;
  };
  date?: string;
}

export type Category =
  | 'Food'
  | 'Hotels'
  | 'Attractions'
  | 'Outdoors'
  | 'Shopping'
  | 'Landmarks'
  | 'Other';

export interface ProfileData {
  name: string;
  level: number;
  totalViews: number;
  totalPhotos: number;
  totalReviews: number;
  profileUrl: string;
  avatarUrl?: string;
  contributions: Contribution[];
  lastUpdated: string;
}

export type ViewMode = 'map' | 'grid';

export interface FilterState {
  category: Category | 'All';
  searchQuery: string;
  viewMode: ViewMode;
}
