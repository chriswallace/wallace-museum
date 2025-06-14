# SEO Setup for Wallace Museum

## Overview

The Wallace Museum website has been enhanced with comprehensive SEO content including meta tags, Open Graph data, Twitter Cards, structured data, and more across all major pages.

## What's Been Added

### 1. Homepage SEO (`src/routes/(app)/+page.svelte`)

#### Meta Tags

- **Title**: "Wallace Museum | Digital Art Collection"
- **Description**: Enhanced description with relevant keywords
- **Keywords**: Digital art, generative art, computational aesthetics, etc.
- **Author**: Chris Wallace
- **Robots**: Index, follow
- **Canonical URL**: Set to prevent duplicate content

#### Open Graph (Facebook/Social)

- **Type**: Website
- **Title**: Wallace Museum | Digital Art Collection
- **Description**: Comprehensive description for social sharing
- **Image**: /images/wallace-museum.png
- **Image dimensions**: Specified for better rendering
- **Site name**: Wallace Museum
- **Locale**: en_US

#### Twitter Cards

- **Card type**: summary_large_image
- **Title**: Same as Open Graph
- **Description**: Same as Open Graph
- **Image**: Same as Open Graph
- **Site/Creator**: @chriswallace

#### Structured Data (JSON-LD)

- **Schema type**: Museum
- **Organization details**: Name, description, founder
- **Address**: McKinney, TX
- **Art mediums**: Digital, Generative, Computational, Algorithmic
- **Social profiles**: Twitter

### 2. Artist Pages SEO (`src/routes/(app)/artist/[id]/+page.svelte`)

#### Meta Tags

- **Dynamic Title**: "{Artist Name} | Wallace Museum"
- **Dynamic Description**: Artist bio with fallback
- **Keywords**: Artist-specific keywords including name
- **Canonical URL**: Unique URL for each artist

#### Open Graph

- **Type**: Profile (appropriate for person pages)
- **Dynamic Image**: Artist avatar or fallback to museum logo
- **Artist-specific content**: Name, bio, artwork count

#### Structured Data

- **Schema type**: Person
- **Job title**: Digital Artist
- **Works for**: Wallace Museum
- **Social profiles**: Twitter, Instagram, website links
- **Artwork catalog**: Number of artworks

### 3. Artwork Pages SEO (`src/routes/(app)/artist/[id]/[artworkId]/+page.svelte`)

#### Meta Tags

- **Dynamic Title**: "{Artwork Title} by {Artist Name} | Wallace Museum"
- **Dynamic Description**: Artwork description with artist info
- **Keywords**: Artwork and artist-specific keywords
- **Canonical URL**: Unique URL for each artwork

#### Open Graph

- **Type**: Article (appropriate for individual artworks)
- **Dynamic Image**: Artwork image or fallback
- **Article metadata**: Author, section, tags
- **Artwork dimensions**: Width and height when available

#### Twitter Cards

- **Card type**: summary_large_image (better for artwork images)
- **Artwork-specific content**: Title, description, image

#### Structured Data

- **Schema type**: VisualArtwork
- **Creator information**: Artist details with links
- **Artwork details**: Dimensions, creation date, token ID
- **Art medium**: Digital Art, Computational Art
- **Collection reference**: Part of Wallace Museum collection

### 4. Artists Listing Page SEO (`src/routes/(app)/artists/+page.svelte`)

#### Meta Tags

- **Title**: "Artists | Wallace Museum"
- **Enhanced Description**: More comprehensive with keywords
- **Keywords**: Various artist types and categories

#### Structured Data

- **Schema type**: CollectionPage
- **Item list**: Number of artists in collection
- **Breadcrumb navigation**: Home → Artists
- **Museum reference**: Part of Wallace Museum

### 5. Additional Files Created/Updated

- **robots.txt**: Search engine crawling instructions
- **sitemap.xml**: Basic sitemap with main pages
- **manifest.json**: PWA manifest (updated to use app-icon.png)
- **social-image-template.html**: Template for creating proper social images

### 6. App Layout Enhancements (`src/routes/(app)/+layout.svelte`)

- **Favicon**: Uses app-icon.png for browser tabs
- **Apple touch icons**: For iOS devices
- **Web app manifest**: PWA capabilities
- **DNS prefetch**: Performance optimization

## Image Strategy

The website now uses a dual-image approach:

- **Favicon/App Icons**: `app-icon.png` - Used for browser tabs and mobile app icons
- **Social Sharing**: `wallace-museum.png` - Used for Open Graph and Twitter Card previews
- **Artist Pages**: Individual artist avatars when available, fallback to museum logo
- **Artwork Pages**: Individual artwork images when available, fallback to museum logo

## SEO Features by Page Type

### Homepage

- ✅ Museum schema markup
- ✅ Organization structured data
- ✅ Social media profiles
- ✅ Comprehensive meta tags
- ✅ Open Graph for social sharing

### Artist Pages

- ✅ Person schema markup
- ✅ Dynamic titles and descriptions
- ✅ Artist avatar images for social sharing
- ✅ Social profile links in structured data
- ✅ Artwork catalog information

### Artwork Pages

- ✅ VisualArtwork schema markup
- ✅ Creator attribution
- ✅ Artwork dimensions and metadata
- ✅ Dynamic artwork images for social sharing
- ✅ Collection context

### Artists Listing

- ✅ CollectionPage schema markup
- ✅ Breadcrumb navigation
- ✅ Item count information
- ✅ Museum context

## Recommendations

### 1. Domain Configuration

Update the `siteUrl` constants in all pages to your actual domain when deployed.

### 2. Social Sharing Image

The current `wallace-museum.png` image is 552x172px. For optimal social sharing:

- Use the provided `social-image-template.html` to create a 1200x630px image
- Take a screenshot of the template
- Replace or supplement the current image

### 3. Dynamic Sitemap

Consider creating a dynamic sitemap that includes:

- Individual artist pages
- Individual artwork pages
- Collection pages

### 4. Additional SEO Improvements

- Add breadcrumb structured data to all pages
- Implement FAQ structured data if applicable
- Consider adding local business structured data
- Add image alt text optimization
- Implement lazy loading for artwork images

### 5. Performance Optimizations

- Optimize images for web (WebP format)
- Implement proper image sizing
- Add service worker for caching
- Monitor Core Web Vitals

### 6. Analytics and Monitoring

- Add Google Analytics or similar tracking
- Set up Google Search Console
- Monitor search performance
- Track social sharing metrics

## Testing Your SEO

### Tools to Use:

1. **Facebook Debugger**: https://developers.facebook.com/tools/debug/
2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
3. **Google Rich Results Test**: https://search.google.com/test/rich-results
4. **Google PageSpeed Insights**: https://pagespeed.web.dev/
5. **Lighthouse**: Built into Chrome DevTools

### What to Check:

- Meta tags are properly rendered on all page types
- Social sharing previews look correct for all pages
- Structured data is valid for all schema types
- Page titles are unique and descriptive
- Images have proper alt text
- Links are crawlable
- Canonical URLs are correct

## Next Steps

1. Update domain URLs in all SEO constants
2. Create a proper 1200x630px social sharing image
3. Test all social sharing platforms with different page types
4. Submit sitemap to Google Search Console
5. Monitor search performance and social sharing metrics
6. Consider implementing dynamic sitemaps for better coverage
