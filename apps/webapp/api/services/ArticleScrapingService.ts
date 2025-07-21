import { extract } from "@extractus/article-extractor";
import BasicDbRepo from "../basicDbRepo.ts";

export interface SiteConfig {
    id: number;
    name: string;
    base_url: string;
    enabled: boolean;
    scrape_selectors: {
        headline: string;
        content: string;
        author: string;
    };
}

export interface ScrapedArticle {
    url: string;
    headline: string;
    content: string;
    author?: string;
    published_at?: Date;
    site_id: number;
}

export class ArticleScrapingService {
    private db: BasicDbRepo;

    constructor(db: BasicDbRepo) {
        this.db = db;
    }

    /**
     * Get all enabled sites for scraping
     */
    async getEnabledSites(): Promise<SiteConfig[]> {
        const result = await this.db.queryArray`
            SELECT id, name, base_url, enabled, scrape_selectors 
            FROM sites 
            WHERE enabled = true
        `;
        
        return result.rows.map(row => ({
            id: row[0] as number,
            name: row[1] as string,
            base_url: row[2] as string,
            enabled: row[3] as boolean,
            scrape_selectors: row[4] as any
        }));
    }

    /**
     * Scrape a single article from a URL
     */
    async scrapeArticle(url: string, siteId?: number): Promise<ScrapedArticle | null> {
        try {
            console.log(`Scraping article from: ${url}`);
            
            // Use article-extractor to parse the article
            const parsed = await extract(url);
            
            if (!parsed || !parsed.title || !parsed.content) {
                console.log(`Failed to parse article from: ${url}`);
                return null;
            }

            // Try to determine site if not provided
            if (!siteId) {
                const sites = await this.getEnabledSites();
                const site = sites.find(s => url.includes(new URL(s.base_url).hostname));
                siteId = site?.id;
            }

            const scrapedArticle: ScrapedArticle = {
                url,
                headline: parsed.title,
                content: parsed.content,
                author: parsed.author || undefined,
                published_at: parsed.published ? new Date(parsed.published) : undefined,
                site_id: siteId || 0
            };

            console.log(`Successfully scraped: ${scrapedArticle.headline}`);
            return scrapedArticle;

        } catch (error) {
            console.error(`Error scraping article from ${url}:`, error);
            return null;
        }
    }

    /**
     * Save a scraped article to the database
     */
    async saveArticle(article: ScrapedArticle): Promise<number | null> {
        try {
            // Check if article already exists
            const existingResult = await this.db.queryArray`
                SELECT id FROM articles WHERE url = ${article.url}
            `;

            if (existingResult.rows.length > 0) {
                console.log(`Article already exists: ${article.url}`);
                return existingResult.rows[0][0] as number;
            }

            // Insert new article
            const result = await this.db.queryArray`
                INSERT INTO articles (
                    url, headline, original_content, author, published_at, 
                    scraped_at, site_id, status
                ) VALUES (
                    ${article.url}, 
                    ${article.headline}, 
                    ${article.content}, 
                    ${article.author || null}, 
                    ${article.published_at || null}, 
                    CURRENT_TIMESTAMP, 
                    ${article.site_id || null}, 
                    'scraped'
                ) RETURNING id
            `;

            const articleId = result.rows[0][0] as number;
            console.log(`Saved article with ID: ${articleId}`);
            return articleId;

        } catch (error) {
            console.error(`Error saving article:`, error);
            return null;
        }
    }

    /**
     * Scrape articles from RSS feeds or sitemaps of configured sites
     */
    async scrapeLatestArticles(limit: number = 10): Promise<number[]> {
        const sites = await this.getEnabledSites();
        const savedArticleIds: number[] = [];

        for (const site of sites) {
            try {
                console.log(`Scraping latest articles from ${site.name}...`);
                
                // For this Phase 1 implementation, we'll use a simple approach
                // In production, you'd want to implement RSS feed parsing or sitemap crawling
                const urls = await this.getLatestUrlsForSite(site);
                
                for (const url of urls.slice(0, limit)) {
                    const article = await this.scrapeArticle(url, site.id);
                    if (article) {
                        const articleId = await this.saveArticle(article);
                        if (articleId) {
                            savedArticleIds.push(articleId);
                        }
                    }
                    
                    // Add delay between requests to be respectful
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`Error scraping from ${site.name}:`, error);
            }
        }

        return savedArticleIds;
    }

    /**
     * Get latest URLs for a site (placeholder implementation)
     * In a real implementation, this would parse RSS feeds or sitemaps
     */
    private async getLatestUrlsForSite(site: SiteConfig): Promise<string[]> {
        // This is a placeholder - in a real implementation you would:
        // 1. Check for RSS feeds
        // 2. Parse sitemaps
        // 3. Crawl category pages
        // 4. Use site-specific APIs
        
        // For demo purposes, return some example URLs
        const exampleUrls = [
            `${site.base_url}/politics/latest`,
            `${site.base_url}/world/breaking`,
            `${site.base_url}/business/markets`,
            `${site.base_url}/technology/ai`,
            `${site.base_url}/health/covid`
        ];

        return exampleUrls;
    }

    /**
     * Get articles that need transformation
     */
    async getArticlesForTransformation(limit: number = 20): Promise<any[]> {
        const result = await this.db.queryArray`
            SELECT a.id, a.url, a.headline, a.original_content, a.author, a.site_id, s.name as site_name
            FROM articles a
            LEFT JOIN sites s ON a.site_id = s.id
            WHERE a.status = 'scraped'
            AND NOT EXISTS (
                SELECT 1 FROM automated_transformations at 
                WHERE at.article_id = a.id
            )
            ORDER BY a.scraped_at DESC
            LIMIT ${limit}
        `;

        return result.rows.map(row => ({
            id: row[0],
            url: row[1],
            headline: row[2],
            content: row[3],
            author: row[4],
            site_id: row[5],
            site_name: row[6]
        }));
    }
}