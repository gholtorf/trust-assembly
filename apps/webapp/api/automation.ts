import { Hono } from "@hono/hono";
import { Env } from "./env.ts";
import { ArticleScrapingService } from "./services/ArticleScrapingService.ts";
import { AutomatedTransformationService } from "./services/AutomatedTransformationService.ts";
import { scheduledTaskService } from "./services/ScheduledTaskService.ts";

const app = new Hono<Env>()
  .post("/scrape", async (c) => {
    try {
      const db = c.get('db');
      const scrapingService = new ArticleScrapingService(db);
      
      const { url, limit = 5 } = await c.req.json();
      
      let savedArticleIds: number[] = [];
      
      if (url) {
        // Scrape a specific URL
        const article = await scrapingService.scrapeArticle(url);
        if (article) {
          const articleId = await scrapingService.saveArticle(article);
          if (articleId) {
            savedArticleIds = [articleId];
          }
        }
      } else {
        // Scrape latest articles from all enabled sites
        savedArticleIds = await scrapingService.scrapeLatestArticles(limit);
      }

      return c.json({
        success: true,
        message: `Scraped ${savedArticleIds.length} articles`,
        articleIds: savedArticleIds
      });
      
    } catch (error) {
      console.error("Scraping error:", error);
      return c.json({
        success: false,
        error: "Failed to scrape articles"
      }, 500);
    }
  })
  
  .post("/transform", async (c) => {
    try {
      const db = c.get('db');
      const transformationService = new AutomatedTransformationService(db);
      
      const { maxArticles = 5 } = await c.req.json();
      
      // Process articles for transformation
      const transformationIds = await transformationService.processArticlesForTransformation(maxArticles);
      
      // Automatically deploy transformations
      const deploymentIds = await transformationService.deployTransformations(transformationIds);
      
      return c.json({
        success: true,
        message: `Transformed ${transformationIds.length} headlines and deployed ${deploymentIds.length} replacements`,
        transformationIds,
        deploymentIds
      });
      
    } catch (error) {
      console.error("Transformation error:", error);
      return c.json({
        success: false,
        error: "Failed to transform headlines"
      }, 500);
    }
  })
  
  .post("/full-pipeline", async (c) => {
    try {
      const db = c.get('db');
      const scrapingService = new ArticleScrapingService(db);
      const transformationService = new AutomatedTransformationService(db);
      
      const { scrapeLimit = 3, transformLimit = 5 } = await c.req.json();
      
      console.log("Starting full automation pipeline...");
      
      // Step 1: Scrape articles
      console.log("Step 1: Scraping articles...");
      const savedArticleIds = await scrapingService.scrapeLatestArticles(scrapeLimit);
      
      // Step 2: Transform headlines
      console.log("Step 2: Transforming headlines...");
      const transformationIds = await transformationService.processArticlesForTransformation(transformLimit);
      
      // Step 3: Deploy replacements
      console.log("Step 3: Deploying replacements...");
      const deploymentIds = await transformationService.deployTransformations(transformationIds);
      
      return c.json({
        success: true,
        message: "Full pipeline completed successfully",
        pipeline_results: {
          scraped_articles: savedArticleIds.length,
          generated_transformations: transformationIds.length,
          deployed_replacements: deploymentIds.length
        },
        article_ids: savedArticleIds,
        transformation_ids: transformationIds,
        deployment_ids: deploymentIds
      });
      
    } catch (error) {
      console.error("Pipeline error:", error);
      return c.json({
        success: false,
        error: "Full pipeline failed"
      }, 500);
    }
  })
  
  .get("/replacements/:url", async (c) => {
    try {
      const db = c.get('db');
      const transformationService = new AutomatedTransformationService(db);
      
      const url = decodeURIComponent(c.req.param("url"));
      const replacements = await transformationService.getActiveReplacements(url);
      
      return c.json({
        success: true,
        url,
        replacements
      });
      
    } catch (error) {
      console.error("Get replacements error:", error);
      return c.json({
        success: false,
        error: "Failed to get replacements"
      }, 500);
    }
  })
  
  .get("/status", async (c) => {
    try {
      const db = c.get('db');
      
      // Get system status
      const sitesResult = await db.queryArray`
        SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE enabled = true) as enabled 
        FROM sites
      `;
      
      const articlesResult = await db.queryArray`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'scraped') as pending_transformation,
          COUNT(*) FILTER (WHERE status = 'transformed') as transformed
        FROM articles
      `;
      
      const transformationsResult = await db.queryArray`
        SELECT COUNT(*) as total FROM automated_transformations
      `;
      
      const deploymentsResult = await db.queryArray`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active
        FROM replacement_deployments
      `;
      
      const creatorsResult = await db.queryArray`
        SELECT COUNT(*) as total FROM creators
      `;
      
      return c.json({
        success: true,
        system_status: {
          sites: {
            total: sitesResult.rows[0][0],
            enabled: sitesResult.rows[0][1]
          },
          articles: {
            total: articlesResult.rows[0][0],
            pending_transformation: articlesResult.rows[0][1],
            transformed: articlesResult.rows[0][2]
          },
          transformations: {
            total: transformationsResult.rows[0][0]
          },
          deployments: {
            total: deploymentsResult.rows[0][0],
            active: deploymentsResult.rows[0][1]
          },
          creators: {
            total: creatorsResult.rows[0][0]
          }
        }
      });
      
    } catch (error) {
      console.error("Status error:", error);
      return c.json({
        success: false,
        error: "Failed to get status"
      }, 500);
    }
  })
  
  .get("/sites", async (c) => {
    try {
      const db = c.get('db');
      
      const result = await db.queryArray`
        SELECT id, name, base_url, enabled, created_at 
        FROM sites 
        ORDER BY name
      `;
      
      const sites = result.rows.map(row => ({
        id: row[0],
        name: row[1],
        base_url: row[2],
        enabled: row[3],
        created_at: row[4]
      }));
      
      return c.json({
        success: true,
        sites
      });
      
    } catch (error) {
      console.error("Get sites error:", error);
      return c.json({
        success: false,
        error: "Failed to get sites"
      }, 500);
    }
  })
  
  .get("/creators", async (c) => {
    try {
      const db = c.get('db');
      
      const result = await db.queryArray`
        SELECT 
          c.id, c.name, c.created_at,
          cp.style_description, cp.active
        FROM creators c
        LEFT JOIN creator_prompts cp ON c.id = cp.creator_id
        ORDER BY c.name
      `;
      
      const creators = result.rows.map(row => ({
        id: row[0],
        name: row[1],
        created_at: row[2],
        style_description: row[3],
        active: row[4]
      }));
      
      return c.json({
        success: true,
        creators
      });
      
    } catch (error) {
      console.error("Get creators error:", error);
      return c.json({
        success: false,
        error: "Failed to get creators"
      }, 500);
    }
  })
  
  .get("/schedule/status", async (c) => {
    try {
      const status = scheduledTaskService.getStatus();
      const stats = await scheduledTaskService.getStats();
      
      return c.json({
        success: true,
        schedule_status: status,
        statistics: stats
      });
      
    } catch (error) {
      console.error("Schedule status error:", error);
      return c.json({
        success: false,
        error: "Failed to get schedule status"
      }, 500);
    }
  })
  
  .post("/schedule/start", async (c) => {
    try {
      scheduledTaskService.start();
      
      return c.json({
        success: true,
        message: "Automated pipeline started"
      });
      
    } catch (error) {
      console.error("Schedule start error:", error);
      return c.json({
        success: false,
        error: "Failed to start automated pipeline"
      }, 500);
    }
  })
  
  .post("/schedule/stop", async (c) => {
    try {
      scheduledTaskService.stop();
      
      return c.json({
        success: true,
        message: "Automated pipeline stopped"
      });
      
    } catch (error) {
      console.error("Schedule stop error:", error);
      return c.json({
        success: false,
        error: "Failed to stop automated pipeline"
      }, 500);
    }
  })
  
  .post("/schedule/config", async (c) => {
    try {
      const config = await c.req.json();
      scheduledTaskService.updateConfig(config);
      
      return c.json({
        success: true,
        message: "Configuration updated",
        new_config: scheduledTaskService.getStatus().config
      });
      
    } catch (error) {
      console.error("Schedule config error:", error);
      return c.json({
        success: false,
        error: "Failed to update configuration"
      }, 500);
    }
  })
  
  .get("/schedule/logs", async (c) => {
    try {
      const limit = parseInt(c.req.query("limit") || "20");
      const logs = await scheduledTaskService.getLogs(limit);
      
      return c.json({
        success: true,
        logs
      });
      
    } catch (error) {
      console.error("Schedule logs error:", error);
      return c.json({
        success: false,
        error: "Failed to get logs"
      }, 500);
    }
  });

export default app;