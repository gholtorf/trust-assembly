import { AbstractMigration, Info, ClientPostgreSQL } from "https://deno.land/x/nessie@2.0.11/mod.ts";

export default class extends AbstractMigration<ClientPostgreSQL> {
    /** Runs on migrate */
    async up(info: Info): Promise<void> {
        // Add sites table for predetermined sites to scrape
        await this.client.queryArray`CREATE TABLE sites (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            enabled BOOLEAN DEFAULT true,
            scrape_selectors JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // Add creator_prompts table for creator-specific transformation styles
        await this.client.queryArray`CREATE TABLE creator_prompts (
            id SERIAL PRIMARY KEY,
            creator_id INTEGER NOT NULL,
            prompt_template TEXT NOT NULL,
            style_description TEXT,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creator_id) REFERENCES creators (id)
        )`;

        // Enhance articles table with more metadata
        await this.client.queryArray`ALTER TABLE articles 
            ADD COLUMN site_id INTEGER,
            ADD COLUMN original_content TEXT,
            ADD COLUMN author TEXT,
            ADD COLUMN published_at TIMESTAMP,
            ADD COLUMN scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN status TEXT DEFAULT 'pending',
            ADD CONSTRAINT fk_articles_site FOREIGN KEY (site_id) REFERENCES sites (id)
        `;

        // Add automated_transformations table for storing LLM-generated headlines
        await this.client.queryArray`CREATE TABLE automated_transformations (
            id SERIAL PRIMARY KEY,
            article_id INTEGER NOT NULL,
            creator_id INTEGER NOT NULL,
            original_headline TEXT NOT NULL,
            transformed_headline TEXT NOT NULL,
            llm_provider TEXT NOT NULL,
            prompt_used TEXT,
            confidence_score DECIMAL(3,2),
            processing_time_ms INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES articles (id),
            FOREIGN KEY (creator_id) REFERENCES creators (id)
        )`;

        // Add replacement_deployments table for tracking active replacements
        await this.client.queryArray`CREATE TABLE replacement_deployments (
            id SERIAL PRIMARY KEY,
            transformation_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            deployment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            views_count INTEGER DEFAULT 0,
            click_through_count INTEGER DEFAULT 0,
            FOREIGN KEY (transformation_id) REFERENCES automated_transformations (id)
        )`;

        // Create indexes for performance
        await this.client.queryArray`CREATE UNIQUE INDEX sites_base_url ON sites (base_url)`;
        await this.client.queryArray`CREATE INDEX creator_prompts_creator_id ON creator_prompts (creator_id)`;
        await this.client.queryArray`CREATE INDEX articles_site_id ON articles (site_id)`;
        await this.client.queryArray`CREATE INDEX articles_status ON articles (status)`;
        await this.client.queryArray`CREATE INDEX automated_transformations_article_id ON automated_transformations (article_id)`;
        await this.client.queryArray`CREATE INDEX automated_transformations_creator_id ON automated_transformations (creator_id)`;
        await this.client.queryArray`CREATE INDEX replacement_deployments_transformation_id ON replacement_deployments (transformation_id)`;
        await this.client.queryArray`CREATE INDEX replacement_deployments_status ON replacement_deployments (status)`;
    }

    /** Runs on rollback */
    async down(info: Info): Promise<void> {
        await this.client.queryArray`DROP TABLE replacement_deployments`;
        await this.client.queryArray`DROP TABLE automated_transformations`;
        await this.client.queryArray`ALTER TABLE articles 
            DROP COLUMN site_id,
            DROP COLUMN original_content,
            DROP COLUMN author,
            DROP COLUMN published_at,
            DROP COLUMN scraped_at,
            DROP COLUMN status
        `;
        await this.client.queryArray`DROP TABLE creator_prompts`;
        await this.client.queryArray`DROP TABLE sites`;
    }
}