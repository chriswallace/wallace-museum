# Wallace Museum - NFT Management System

This application provides tools for managing and displaying NFT collections for the Wallace Museum.

## Key Features

### 1. Wallet Management

The wallet management system allows you to:

- Add multiple blockchain wallet addresses (Ethereum, Tezos, Polygon, Solana)
- Assign aliases to wallet addresses for easy identification
- Delete wallet addresses when no longer needed
- View all registered wallet addresses in one place

### 2. Automated NFT Indexing

The indexing system automatically:

- Fetches NFTs from registered wallet addresses
- Normalizes data across different blockchains
- Stores metadata in a searchable index
- Updates the index daily via a scheduled cron job

#### Setting up the Indexer

1. Set the `INDEXER_API_KEY` environment variable in your `.env` file:

   ```
   INDEXER_API_KEY=your_secure_key_here
   ```

2. Set up a cron job to run the indexer daily:

   ```
   0 2 * * * curl https://your-domain.com/api/admin/index-wallets?key=your_secure_key_here
   ```

3. You can also run the indexer manually from the admin interface.

### 3. NFT Import System

The import system allows you to:

- Search indexed NFTs by name, description, token ID, etc.
- Filter by blockchain, artist, or collection
- Select multiple NFTs to import at once
- Import NFTs into your official collection

### 4. Redis Caching System

The application includes a comprehensive Redis caching system to improve performance:

- **Automatic Query Caching**: Database read queries are automatically cached
- **Environment-Based Control**: Cache can be enabled/disabled per environment
- **Smart Invalidation**: Cache is automatically invalidated when data changes
- **Admin Controls**: API endpoints for cache management and monitoring
- **Sitewide Prefixing**: All cache keys use `wallace-collection:` prefix

See [REDIS_CACHE_SETUP.md](REDIS_CACHE_SETUP.md) for detailed configuration and usage.

## Getting Started

1. Install dependencies:

   ```
   npm install
   ```

2. Set up environment variables in `.env`:

   ```
   DATABASE_URL=your_database_connection_string
   OPENSEA_API_KEY=your_opensea_api_key
   INDEXER_API_KEY=your_secure_key_here
   IPFS_API_KEY=your_ipfs_api_key
   REDISCLOUD_URL=redis://username:password@host:port  # For caching
   ```

3. Run the development server:

   ```
   npm run dev
   ```

4. Access the admin interface at `http://localhost:5173/admin`

## API Endpoints

### Wallet Management

- `GET /api/admin/index-wallets?key=[INDEXER_API_KEY]` - Run the indexer to fetch NFTs from all registered wallets

### Search

- `GET /api/admin/search` - Search indexed NFTs with various filters
  - Parameters:
    - `q` - Search term
    - `blockchain` - Filter by blockchain
    - `artist` - Filter by artist ID
    - `collection` - Filter by collection ID
    - `limit` - Number of results per page (default: 50)
    - `offset` - Pagination offset (default: 0)

### Cache Management

- `GET /api/admin/cache` - Get cache status and statistics
- `DELETE /api/admin/cache` - Clear all cache entries
- `DELETE /api/admin/cache?pattern=artworks:*` - Clear specific cache pattern
- `POST /api/admin/cache` - Invalidate cache patterns

### Health Check

- `GET /api/health` - System health check including cache status

## Database Schema

The system uses the following key tables:

- `Artwork` - Stores imported NFTs
- `ArtworkIndex` - Stores indexed NFT data for search
- `Artist` - Stores artist information
- `Collection` - Stores collection information
- `Settings` - Stores system settings, including wallet addresses

## Testing

Test the caching system with the included test script:

```bash
node test-cache.js
```

This will verify cache functionality, hit/miss rates, and API responses.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Environment Variables

### IPFS Configuration

This app uses the Wallace Museum IPFS microservice for IPFS content delivery with authentication. You'll need to set up the following environment variable:

```env
# IPFS Microservice Configuration
IPFS_API_KEY=your_api_key              # Your IPFS microservice API key
```

### How It Works:

- All IPFS URLs in your app will be automatically routed through `https://ipfs.wallacemuseum.com`
- The microservice uses your API key for authentication
- Supports path-based IPFS URLs (e.g., `ipfs://Qm.../metadata.json`)
- Falls back to public IPFS gateways if the microservice is unavailable
