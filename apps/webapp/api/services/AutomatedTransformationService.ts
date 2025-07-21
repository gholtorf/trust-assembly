import BasicDbRepo from "../basicDbRepo.ts";
import transformHeadline from "../cliInterface.ts";

export interface CreatorPrompt {
    id: number;
    creator_id: number;
    creator_name: string;
    prompt_template: string;
    style_description: string;
    active: boolean;
}

export interface TransformationResult {
    original_headline: string;
    transformed_headline: string;
    provider_used: string;
    processing_time_ms: number;
    confidence_score?: number;
}

export interface ArticleForTransformation {
    id: number;
    url: string;
    headline: string;
    content: string;
    author?: string;
    site_id: number;
    site_name: string;
}

export class AutomatedTransformationService {
    private db: BasicDbRepo;

    constructor(db: BasicDbRepo) {
        this.db = db;
    }

    /**
     * Get all active creator prompts
     */
    async getActiveCreatorPrompts(): Promise<CreatorPrompt[]> {
        const result = await this.db.queryArray`
            SELECT 
                cp.id, cp.creator_id, c.name as creator_name, 
                cp.prompt_template, cp.style_description, cp.active
            FROM creator_prompts cp
            JOIN creators c ON cp.creator_id = c.id
            WHERE cp.active = true
            ORDER BY c.name
        `;

        return result.rows.map(row => ({
            id: row[0] as number,
            creator_id: row[1] as number,
            creator_name: row[2] as string,
            prompt_template: row[3] as string,
            style_description: row[4] as string,
            active: row[5] as boolean
        }));
    }

    /**
     * Transform an article headline using a specific creator's prompt
     */
    async transformWithCreatorPrompt(
        article: ArticleForTransformation, 
        creatorPrompt: CreatorPrompt
    ): Promise<TransformationResult | null> {
        try {
            const startTime = Date.now();

            // Replace placeholders in the prompt template
            const customPrompt = creatorPrompt.prompt_template
                .replace('{headline}', article.headline)
                .replace('{content}', article.content.substring(0, 2000)) // Limit content length
                .replace('{author}', article.author || 'Unknown');

            console.log(`Transforming "${article.headline}" with ${creatorPrompt.creator_name} style...`);

            // Use the enhanced CLI interface that can accept custom prompts
            const result = await this.transformWithCustomPrompt(
                article.headline,
                article.content,
                customPrompt
            );

            const processingTime = Date.now() - startTime;

            return {
                original_headline: article.headline,
                transformed_headline: result.transformedHeadline,
                provider_used: result.providerUsed,
                processing_time_ms: processingTime,
                confidence_score: this.calculateConfidenceScore(article.headline, result.transformedHeadline)
            };

        } catch (error) {
            console.error(`Error transforming with ${creatorPrompt.creator_name}:`, error);
            return null;
        }
    }

    /**
     * Transform headline with custom prompt (enhanced CLI interface)
     */
    private async transformWithCustomPrompt(
        headline: string,
        content: string,
        customPrompt: string
    ): Promise<{ transformedHeadline: string; providerUsed: string }> {
        // For now, we'll use the existing interface and prepend the custom prompt
        // In a full implementation, you'd extend the CLI to accept custom prompts
        const enhancedContent = `${customPrompt}\n\nOriginal content: ${content}`;
        
        const result = await transformHeadline({
            title: headline,
            author: "Custom Prompt",
            content: enhancedContent
        });

        return {
            transformedHeadline: result.transformedHeadline,
            providerUsed: result.providerUsed
        };
    }

    /**
     * Calculate a simple confidence score based on headline similarity
     */
    private calculateConfidenceScore(original: string, transformed: string): number {
        // Simple heuristic: if the transformed headline is too similar or too different, lower confidence
        const similarity = this.calculateSimilarity(original, transformed);
        
        if (similarity > 0.9) return 0.6; // Too similar - might not have transformed enough
        if (similarity < 0.2) return 0.7; // Very different - might be hallucinating
        return 0.9; // Good balance
    }

    /**
     * Calculate simple text similarity
     */
    private calculateSimilarity(text1: string, text2: string): number {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const commonWords = words1.filter(word => words2.includes(word));
        return commonWords.length / Math.max(words1.length, words2.length);
    }

    /**
     * Save transformation result to database
     */
    async saveTransformation(
        articleId: number,
        creatorId: number,
        result: TransformationResult,
        promptUsed: string
    ): Promise<number | null> {
        try {
            const dbResult = await this.db.queryArray`
                INSERT INTO automated_transformations (
                    article_id, creator_id, original_headline, transformed_headline,
                    llm_provider, prompt_used, confidence_score, processing_time_ms
                ) VALUES (
                    ${articleId}, ${creatorId}, ${result.original_headline}, 
                    ${result.transformed_headline}, ${result.provider_used}, 
                    ${promptUsed}, ${result.confidence_score || 0}, ${result.processing_time_ms}
                ) RETURNING id
            `;

            const transformationId = dbResult.rows[0][0] as number;
            console.log(`Saved transformation with ID: ${transformationId}`);
            return transformationId;

        } catch (error) {
            console.error(`Error saving transformation:`, error);
            return null;
        }
    }

    /**
     * Process all pending articles for transformation
     */
    async processArticlesForTransformation(maxArticles: number = 10): Promise<number[]> {
        const articles = await this.getArticlesForTransformation(maxArticles);
        const creatorPrompts = await this.getActiveCreatorPrompts();
        const transformationIds: number[] = [];

        console.log(`Processing ${articles.length} articles with ${creatorPrompts.length} creator styles...`);

        for (const article of articles) {
            for (const creatorPrompt of creatorPrompts) {
                try {
                    const result = await this.transformWithCreatorPrompt(article, creatorPrompt);
                    
                    if (result) {
                        const transformationId = await this.saveTransformation(
                            article.id,
                            creatorPrompt.creator_id,
                            result,
                            creatorPrompt.prompt_template
                        );

                        if (transformationId) {
                            transformationIds.push(transformationId);
                        }
                    }

                    // Add delay between transformations to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1500));

                } catch (error) {
                    console.error(`Error processing article ${article.id} with creator ${creatorPrompt.creator_name}:`, error);
                }
            }

            // Mark article as processed
            await this.db.queryArray`
                UPDATE articles SET status = 'transformed' WHERE id = ${article.id}
            `;
        }

        return transformationIds;
    }

    /**
     * Get articles that need transformation
     */
    private async getArticlesForTransformation(limit: number): Promise<ArticleForTransformation[]> {
        const result = await this.db.queryArray`
            SELECT a.id, a.url, a.headline, a.original_content, a.author, a.site_id, s.name as site_name
            FROM articles a
            LEFT JOIN sites s ON a.site_id = s.id
            WHERE a.status = 'scraped'
            ORDER BY a.scraped_at DESC
            LIMIT ${limit}
        `;

        return result.rows.map(row => ({
            id: row[0] as number,
            url: row[1] as string,
            headline: row[2] as string,
            content: row[3] as string,
            author: row[4] as string,
            site_id: row[5] as number,
            site_name: row[6] as string
        }));
    }

    /**
     * Deploy transformations as active replacements
     */
    async deployTransformations(transformationIds: number[]): Promise<number[]> {
        const deploymentIds: number[] = [];

        for (const transformationId of transformationIds) {
            try {
                const result = await this.db.queryArray`
                    INSERT INTO replacement_deployments (transformation_id, status)
                    VALUES (${transformationId}, 'active')
                    RETURNING id
                `;

                const deploymentId = result.rows[0][0] as number;
                deploymentIds.push(deploymentId);

            } catch (error) {
                console.error(`Error deploying transformation ${transformationId}:`, error);
            }
        }

        console.log(`Deployed ${deploymentIds.length} transformations`);
        return deploymentIds;
    }

    /**
     * Get active replacements for a URL
     */
    async getActiveReplacements(url: string): Promise<any[]> {
        const result = await this.db.queryArray`
            SELECT 
                at.original_headline,
                at.transformed_headline,
                c.name as creator_name,
                at.confidence_score,
                rd.views_count,
                rd.click_through_count
            FROM replacement_deployments rd
            JOIN automated_transformations at ON rd.transformation_id = at.id
            JOIN articles a ON at.article_id = a.id
            JOIN creators c ON at.creator_id = c.id
            WHERE a.url = ${url} AND rd.status = 'active'
            ORDER BY at.confidence_score DESC, c.name
        `;

        return result.rows.map(row => ({
            original_headline: row[0],
            transformed_headline: row[1],
            creator_name: row[2],
            confidence_score: row[3],
            views_count: row[4],
            click_through_count: row[5]
        }));
    }
}