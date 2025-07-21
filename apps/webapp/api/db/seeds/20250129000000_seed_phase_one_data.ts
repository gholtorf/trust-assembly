import { AbstractSeed, Info, ClientPostgreSQL } from "https://deno.land/x/nessie@2.0.11/mod.ts";

export default class extends AbstractSeed<ClientPostgreSQL> {
    async run(info: Info): Promise<void> {
        // Insert predetermined sites for Phase 1
        await this.client.queryArray`
            INSERT INTO sites (name, base_url, enabled, scrape_selectors) VALUES
            ('CNN', 'https://cnn.com', true, '{"headline": "h1.headline__text, h1.pg-headline", "content": ".zn-body__paragraph, .l-container p", "author": ".metadata__byline__author"}'),
            ('Fox News', 'https://foxnews.com', true, '{"headline": "h1.headline, h1.article-title", "content": ".article-body p, .article-text p", "author": ".author-byline"}'),
            ('MSNBC', 'https://msnbc.com', true, '{"headline": "h1.articleTitle, h1.f-headline", "content": ".articleBody p, .story-body p", "author": ".byline"}'),
            ('BBC News', 'https://bbc.com/news', true, '{"headline": "h1.story-headline, h1[data-testid=\"headline\"]", "content": "[data-component=\"text-block\"] p, .story-body p", "author": ".byline__name"}'),
            ('Reuters', 'https://reuters.com', true, '{"headline": "h1[data-testid=\"Headline\"], h1.ArticleHeader_headline", "content": "[data-testid=\"paragraph-0\"], .ArticleBodyWrapper p", "author": ".Attribution_container a"}'),
            ('Associated Press', 'https://apnews.com', true, '{"headline": "h1[data-key=\"card-headline\"], h1.Page-headline", "content": ".RichTextStoryBody p, .Article p", "author": ".Component-bylines a"}')
        `;

        // Insert sample creators
        await this.client.queryArray`
            INSERT INTO creators (name) VALUES
            ('Neutral Observer'),
            ('Conservative Analyst'),
            ('Progressive Voice'),
            ('Libertarian Perspective'),
            ('Fact-Based Reporter'),
            ('International Viewpoint')
        `;

        // Get creator IDs for prompt insertion
        const creatorsResult = await this.client.queryArray`SELECT id, name FROM creators`;
        const creators = creatorsResult.rows.map(row => ({ id: row[0], name: row[1] }));

        // Insert creator-specific prompts
        for (const creator of creators) {
            const creatorId = creator.id;
            const creatorName = creator.name;
            
            let promptTemplate = '';
            let styleDescription = '';

            switch (creatorName) {
                case 'Neutral Observer':
                    promptTemplate = `Transform this headline to be more neutral and fact-based. Remove emotional language, speculation, and bias. Focus on verified facts only. 

Original headline: {headline}
Article content: {content}

Transform this into a neutral, factual headline that a responsible journalist would write:`;
                    styleDescription = 'Focuses on factual accuracy, removes emotional language and bias';
                    break;

                case 'Conservative Analyst':
                    promptTemplate = `Transform this headline from a conservative perspective, emphasizing traditional values, fiscal responsibility, and constitutional principles. Maintain accuracy while highlighting conservative concerns.

Original headline: {headline}
Article content: {content}

Rewrite this headline to reflect conservative analytical perspective:`;
                    styleDescription = 'Conservative perspective emphasizing traditional values and constitutional principles';
                    break;

                case 'Progressive Voice':
                    promptTemplate = `Transform this headline from a progressive perspective, emphasizing social justice, equity, and systemic change. Focus on how this affects marginalized communities and workers.

Original headline: {headline}
Article content: {content}

Rewrite this headline to reflect progressive values and social justice concerns:`;
                    styleDescription = 'Progressive perspective emphasizing social justice and equity';
                    break;

                case 'Libertarian Perspective':
                    promptTemplate = `Transform this headline from a libertarian perspective, emphasizing individual freedom, limited government, and personal responsibility. Focus on liberty implications.

Original headline: {headline}
Article content: {content}

Rewrite this headline to reflect libertarian principles of individual freedom and limited government:`;
                    styleDescription = 'Libertarian perspective emphasizing individual freedom and limited government';
                    break;

                case 'Fact-Based Reporter':
                    promptTemplate = `Transform this headline to be strictly factual and evidence-based. Remove all opinion, speculation, and unverified claims. Only include what can be proven.

Original headline: {headline}
Article content: {content}

Create a fact-checked headline that only includes verified information:`;
                    styleDescription = 'Strictly factual reporting with verified information only';
                    break;

                case 'International Viewpoint':
                    promptTemplate = `Transform this headline to reflect an international perspective, considering global implications and how this would be viewed by international audiences.

Original headline: {headline}
Article content: {content}

Rewrite this headline from an international perspective, considering global context:`;
                    styleDescription = 'International perspective considering global context and implications';
                    break;
            }

            await this.client.queryArray`
                INSERT INTO creator_prompts (creator_id, prompt_template, style_description, active)
                VALUES (${creatorId}, ${promptTemplate}, ${styleDescription}, true)
            `;
        }
    }
}