import { ArticleScrapingService } from "./ArticleScrapingService.ts";
import { AutomatedTransformationService } from "./AutomatedTransformationService.ts";
import BasicDbRepo from "../basicDbRepo.ts";

export class ScheduledTaskService {
    private isRunning: boolean = false;
    private intervalId: number | null = null;
    private config = {
        scrapeIntervalMinutes: 30, // Scrape every 30 minutes
        transformIntervalMinutes: 15, // Transform every 15 minutes  
        maxArticlesPerScrape: 5,
        maxArticlesPerTransform: 10
    };

    constructor() {
        console.log('Scheduled Task Service initialized');
    }

    /**
     * Start the automated pipeline
     */
    start() {
        if (this.isRunning) {
            console.log('Scheduled tasks already running');
            return;
        }

        this.isRunning = true;
        console.log('Starting automated pipeline...');

        // Run initial pipeline
        this.runPipeline();

        // Schedule recurring pipeline runs
        this.intervalId = setInterval(() => {
            this.runPipeline();
        }, this.config.scrapeIntervalMinutes * 60 * 1000);

        // Also schedule more frequent transformations
        setInterval(() => {
            this.runTransformationOnly();
        }, this.config.transformIntervalMinutes * 60 * 1000);

        console.log(`Pipeline scheduled every ${this.config.scrapeIntervalMinutes} minutes`);
    }

    /**
     * Stop the automated pipeline
     */
    stop() {
        if (!this.isRunning) {
            console.log('Scheduled tasks not running');
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('Stopped automated pipeline');
    }

    /**
     * Check if the service is running
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            nextRun: this.intervalId ? new Date(Date.now() + this.config.scrapeIntervalMinutes * 60 * 1000) : null
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<typeof this.config>) {
        this.config = { ...this.config, ...newConfig };
        console.log('Updated configuration:', this.config);

        // Restart if running to apply new schedule
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * Run the full pipeline (scrape + transform + deploy)
     */
    private async runPipeline() {
        try {
            console.log(`[${new Date().toISOString()}] Running full automation pipeline...`);
            
            using db = await BasicDbRepo.create();
            const scrapingService = new ArticleScrapingService(db);
            const transformationService = new AutomatedTransformationService(db);

            // Step 1: Scrape new articles
            console.log('Step 1: Scraping articles...');
            const scrapedArticleIds = await scrapingService.scrapeLatestArticles(this.config.maxArticlesPerScrape);
            console.log(`Scraped ${scrapedArticleIds.length} articles`);

            // Step 2: Transform headlines
            console.log('Step 2: Transforming headlines...');
            const transformationIds = await transformationService.processArticlesForTransformation(this.config.maxArticlesPerTransform);
            console.log(`Generated ${transformationIds.length} transformations`);

            // Step 3: Deploy replacements
            console.log('Step 3: Deploying replacements...');
            const deploymentIds = await transformationService.deployTransformations(transformationIds);
            console.log(`Deployed ${deploymentIds.length} replacements`);

            // Log pipeline results
            const results = {
                timestamp: new Date().toISOString(),
                scraped_articles: scrapedArticleIds.length,
                generated_transformations: transformationIds.length,
                deployed_replacements: deploymentIds.length
            };

            console.log('Pipeline completed:', results);
            await this.logPipelineRun(results);

        } catch (error) {
            console.error('Pipeline error:', error);
            await this.logPipelineError(error);
        }
    }

    /**
     * Run only the transformation pipeline
     */
    private async runTransformationOnly() {
        try {
            console.log(`[${new Date().toISOString()}] Running transformation pipeline...`);
            
            using db = await BasicDbRepo.create();
            const transformationService = new AutomatedTransformationService(db);

            // Transform pending articles
            const transformationIds = await transformationService.processArticlesForTransformation(this.config.maxArticlesPerTransform);
            
            if (transformationIds.length > 0) {
                // Deploy new transformations
                const deploymentIds = await transformationService.deployTransformations(transformationIds);
                console.log(`Transformation-only pipeline: ${transformationIds.length} transformations, ${deploymentIds.length} deployments`);
            } else {
                console.log('No articles pending transformation');
            }

        } catch (error) {
            console.error('Transformation pipeline error:', error);
        }
    }

    /**
     * Log pipeline run results to database
     */
    private async logPipelineRun(results: any) {
        try {
            using db = await BasicDbRepo.create();
            
            // Create a simple log table if it doesn't exist
            await db.queryArray`
                CREATE TABLE IF NOT EXISTS pipeline_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    pipeline_type TEXT NOT NULL,
                    results JSONB,
                    status TEXT DEFAULT 'success'
                )
            `;

            await db.queryArray`
                INSERT INTO pipeline_logs (pipeline_type, results, status)
                VALUES ('full_pipeline', ${JSON.stringify(results)}, 'success')
            `;

        } catch (error) {
            console.error('Error logging pipeline run:', error);
        }
    }

    /**
     * Log pipeline errors to database
     */
    private async logPipelineError(error: any) {
        try {
            using db = await BasicDbRepo.create();
            
            await db.queryArray`
                CREATE TABLE IF NOT EXISTS pipeline_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    pipeline_type TEXT NOT NULL,
                    results JSONB,
                    status TEXT DEFAULT 'success'
                )
            `;

            await db.queryArray`
                INSERT INTO pipeline_logs (pipeline_type, results, status)
                VALUES ('full_pipeline', ${JSON.stringify({ error: error.message })}, 'error')
            `;

        } catch (logError) {
            console.error('Error logging pipeline error:', logError);
        }
    }

    /**
     * Get recent pipeline logs
     */
    async getLogs(limit: number = 20) {
        try {
            using db = await BasicDbRepo.create();
            
            const result = await db.queryArray`
                SELECT timestamp, pipeline_type, results, status
                FROM pipeline_logs
                ORDER BY timestamp DESC
                LIMIT ${limit}
            `;

            return result.rows.map(row => ({
                timestamp: row[0],
                pipeline_type: row[1],
                results: row[2],
                status: row[3]
            }));

        } catch (error) {
            console.error('Error getting logs:', error);
            return [];
        }
    }

    /**
     * Get pipeline statistics
     */
    async getStats() {
        try {
            using db = await BasicDbRepo.create();
            
            // Get recent activity stats
            const statsResult = await db.queryArray`
                SELECT 
                    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as runs_24h,
                    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as runs_7d,
                    COUNT(*) FILTER (WHERE status = 'error' AND timestamp > NOW() - INTERVAL '24 hours') as errors_24h
                FROM pipeline_logs
                WHERE pipeline_type = 'full_pipeline'
            `;

            const articlesResult = await db.queryArray`
                SELECT 
                    COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '24 hours') as scraped_24h,
                    COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '7 days') as scraped_7d
                FROM articles
            `;

            const transformationsResult = await db.queryArray`
                SELECT 
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as created_24h,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as created_7d
                FROM automated_transformations
            `;

            return {
                pipeline_runs: {
                    last_24h: statsResult.rows[0][0] || 0,
                    last_7d: statsResult.rows[0][1] || 0,
                    errors_24h: statsResult.rows[0][2] || 0
                },
                articles_scraped: {
                    last_24h: articlesResult.rows[0][0] || 0,
                    last_7d: articlesResult.rows[0][1] || 0
                },
                transformations_created: {
                    last_24h: transformationsResult.rows[0][0] || 0,
                    last_7d: transformationsResult.rows[0][1] || 0
                }
            };

        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    }
}

// Global instance
export const scheduledTaskService = new ScheduledTaskService();