# Phase 1 Implementation - Trust Assembly

## Overview

This document describes the complete implementation of **Phase 1: Headline Automation and Database Creation** for the Trust Assembly project. The implementation fully meets the phase one requirements outlined in the project README.

## Phase 1 Requirements ✅

### ✅ Use an LLM and samples of writing from various creators to create an automated headline replacer

**Implementation:**
- Enhanced the existing LLM headline transformation system with creator-specific prompts
- Created `creator_prompts` table with customizable prompt templates for different creator styles
- Implemented 6 different creator perspectives: Neutral Observer, Conservative Analyst, Progressive Voice, Libertarian Perspective, Fact-Based Reporter, and International Viewpoint
- Each creator has specific prompt templates that guide the LLM to transform headlines in their unique style

### ✅ Scrape text from predetermined sites (CNN, Fox, MSNBC, etc.)

**Implementation:**
- Created `ArticleScrapingService` for automated content scraping
- Added `sites` table with predetermined news sources including CNN, Fox News, MSNBC, BBC News, Reuters, and Associated Press
- Each site includes specific CSS selectors for headline, content, and author extraction
- Implemented respectful scraping with delays and error handling

### ✅ Feed this text to an LLM with prompts designed by specific content creators to produce new headlines

**Implementation:**
- Built `AutomatedTransformationService` that processes scraped articles through creator-specific prompts
- Each article gets transformed by all active creators, producing multiple perspective headlines
- Implemented confidence scoring and processing time tracking
- Enhanced CLI interface integration for seamless LLM processing

### ✅ Store this in a database

**Implementation:**
- Created comprehensive database schema with new tables:
  - `sites` - Predetermined news sites configuration
  - `creator_prompts` - Creator-specific transformation templates
  - `automated_transformations` - LLM-generated headline transformations
  - `replacement_deployments` - Active headline replacements
- Enhanced existing `articles` and `creators` tables with additional metadata
- Added database migration and seed files

### ✅ Use the browser extension to replace old headlines with new headlines

**Implementation:**
- Enhanced browser extension with automated replacement functionality
- Extension automatically checks for available transformations when loading news pages
- Added visual indicators showing Trust Assembly is active
- Implemented modal interface for users to choose between different creator perspectives
- Enhanced headline selectors to support major news sites (CNN, Fox, MSNBC, BBC, Reuters, AP)

## Key Features Implemented

### 1. Automated Pipeline System

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   Scraping  │ -> │ Transformation│ -> │   Deployment    │ -> │   Browser    │
│   Service   │    │   Service     │    │    Service      │    │  Extension   │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
```

### 2. Scheduled Automation

- `ScheduledTaskService` runs the full pipeline automatically
- Configurable intervals for scraping (30 min) and transformation (15 min)
- Automatic error handling and logging
- Pipeline statistics and monitoring

### 3. Multi-Creator Perspective System

Each article gets transformed by multiple creators:
- **Neutral Observer**: Removes bias, focuses on facts
- **Conservative Analyst**: Traditional values perspective
- **Progressive Voice**: Social justice emphasis  
- **Libertarian Perspective**: Individual freedom focus
- **Fact-Based Reporter**: Strictly verified information
- **International Viewpoint**: Global context

### 4. Browser Extension Enhancements

- Automatic headline replacement on supported sites
- Visual Trust Assembly indicator
- Click-to-view alternative perspectives
- Confidence scoring display
- Usage analytics (views, click-through)

### 5. Administrative Dashboard

- Real-time system status monitoring
- Manual pipeline controls
- Schedule management (start/stop automation)
- Activity statistics and logs
- Configuration management

## API Endpoints

### Automation Pipeline
- `POST /api/automation/scrape` - Scrape articles manually
- `POST /api/automation/transform` - Transform headlines manually  
- `POST /api/automation/full-pipeline` - Run complete pipeline
- `GET /api/automation/replacements/:url` - Get active replacements for URL
- `GET /api/automation/status` - System status overview

### Schedule Management
- `GET /api/automation/schedule/status` - Schedule status and stats
- `POST /api/automation/schedule/start` - Start automation
- `POST /api/automation/schedule/stop` - Stop automation
- `POST /api/automation/schedule/config` - Update configuration
- `GET /api/automation/schedule/logs` - View pipeline logs

### Configuration
- `GET /api/automation/sites` - List configured sites
- `GET /api/automation/creators` - List creators and their styles

## Database Schema

### Core Tables
- `sites` - Predetermined news sites (CNN, Fox, MSNBC, etc.)
- `articles` - Scraped articles with metadata
- `creators` - Content creator definitions
- `creator_prompts` - Creator-specific LLM prompts
- `automated_transformations` - Generated headline alternatives
- `replacement_deployments` - Active replacements served to browsers
- `pipeline_logs` - Automation activity logging

## How It Works

### 1. Content Scraping
```typescript
// Automated scraping from predetermined sites
const scrapingService = new ArticleScrapingService(db);
const articles = await scrapingService.scrapeLatestArticles(5);
```

### 2. Multi-Perspective Transformation
```typescript
// Transform each article with all creator styles
const transformationService = new AutomatedTransformationService(db);
const transformations = await transformationService.processArticlesForTransformation(10);
```

### 3. Deployment & Serving
```typescript
// Deploy transformations for browser extension use
const deployments = await transformationService.deployTransformations(transformationIds);
```

### 4. Browser Integration
```typescript
// Browser extension automatically applies best transformation
const replacements = await checkForReplacements(currentUrl);
if (replacements.length > 0) {
  applyTransformation(replacements[0]);
  showAlternativesButton(replacements);
}
```

## Getting Started

### 1. Database Setup
```bash
# Run new migrations to create Phase 1 tables
docker compose -f docker-compose.dev.yml --profile seed up --build
```

### 2. Access Dashboard
Visit `http://localhost:5173/automation` to view the automation dashboard

### 3. Start Automation
```bash
# Via API
curl -X POST http://localhost:5173/api/automation/schedule/start

# Or use the dashboard interface
```

### 4. Test Browser Extension
1. Load the browser extension in Chrome
2. Visit a news site (CNN, Fox News, etc.)
3. Look for the Trust Assembly indicator
4. Click to see alternative headline perspectives

## Phase 1 Success Criteria ✅

- [x] **Automated headline replacer using LLM** - Implemented with creator-specific prompts
- [x] **Scrape predetermined sites** - CNN, Fox, MSNBC, BBC, Reuters, AP configured
- [x] **Creator-specific prompts** - 6 different creator styles with custom templates
- [x] **Database storage** - Comprehensive schema with all scraped and transformed data
- [x] **Browser extension replacement** - Enhanced with automatic detection and UI
- [x] **Small scope demonstration** - Focused on major news sites as proof of concept
- [x] **Ready for outreach** - Dashboard and demo-ready system for showing to news organizations

## Next Steps (Phase 2)

The Phase 1 implementation provides a solid foundation for Phase 2 requirements:
- ✅ Database structure ready for editing capabilities
- ✅ API endpoints ready for frontend editing interfaces  
- ✅ Browser extension ready for edit notifications
- ✅ Creator system ready for delegation and trust networks

## Files Created/Modified

### Database
- `apps/webapp/api/db/migrations/20250129000000_enhance_phase_one_schema.ts`
- `apps/webapp/api/db/seeds/20250129000000_seed_phase_one_data.ts`

### Services  
- `apps/webapp/api/services/ArticleScrapingService.ts`
- `apps/webapp/api/services/AutomatedTransformationService.ts`
- `apps/webapp/api/services/ScheduledTaskService.ts`

### API
- `apps/webapp/api/automation.ts`
- Enhanced `apps/webapp/api/main.ts`

### Browser Extension
- Enhanced `apps/browser-extension/src/contentScript.ts`

### Frontend
- `apps/webapp/src/components/AutomationDashboard.tsx`
- Enhanced `apps/webapp/src/App.tsx`

This completes the full Phase 1 implementation as specified in the project requirements!