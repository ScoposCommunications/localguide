# Local Guide Portfolio

A stunning dark-themed portfolio website that dynamically displays Google Maps Local Guide profile data.

## Features

- **Hero Section** - Massive animated counter showing total photo views with stat cards for photos, reviews, and Local Guide level
- **Filter Bar** - Filter by category (Food, Hotels, Attractions, etc.) with search and view toggle
- **Interactive Map** - Full-width dark-themed map using CartoDB Dark Matter tiles with clustered markers
- **Grid View** - Masonry grid with hover states and view counts
- **Work With Me Footer** - Contact section with links to Google profile

## Tech Stack

- **React** + **Vite** + **TypeScript**
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Leaflet.js** with marker clustering for the map
- **React Query** for data fetching and caching
- **Express** server for API (dev) / Vercel serverless functions (prod)

## Development

```bash
# Install dependencies
npm install

# Start development server (runs both API and client)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

The project is configured with `vercel.json` to:
- Build the Vite app
- Deploy the serverless API function at `/api/profile`
- Handle client-side routing

## API

### GET /api/profile

Returns the Local Guide profile data including:
- `name` - Profile name
- `level` - Local Guide level (1-10)
- `totalViews` - Total photo views
- `totalPhotos` - Number of photos
- `totalReviews` - Number of reviews
- `profileUrl` - Link to Google Maps profile
- `contributions[]` - Array of contribution objects

Data is cached for 1 hour.

## License

MIT
