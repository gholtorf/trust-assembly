import { AbstractMigration, Info, ClientPostgreSQL } from "https://deno.land/x/nessie@2.0.11/mod.ts";

/**
 * Migration: create tables to store user-submitted headline replacements and their citations.
 * Notes:
 *  - Headline length constrained to 1..120 chars via CHECK.
 *  - Citations stored in separate table with optional explanation.
 */
export default class extends AbstractMigration<ClientPostgreSQL> {
    async up(_info: Info): Promise<void> {
        await this.client.queryArray`CREATE TABLE headline_replacements (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id),
            url TEXT NOT NULL,
            original_headline VARCHAR(120) NOT NULL CHECK (char_length(original_headline) BETWEEN 1 AND 120),
            replacement_headline VARCHAR(120) NOT NULL CHECK (char_length(replacement_headline) BETWEEN 1 AND 120),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await this.client.queryArray`CREATE TABLE headline_replacement_citations (
            id SERIAL PRIMARY KEY,
            headline_replacement_id UUID NOT NULL REFERENCES headline_replacements(id) ON DELETE CASCADE,
            citation_url TEXT NOT NULL,
            explanation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await this.client.queryArray`CREATE INDEX headline_replacements_user_id ON headline_replacements (user_id)`;
        await this.client.queryArray`CREATE INDEX headline_replacements_url ON headline_replacements (url)`;
        await this.client.queryArray`CREATE INDEX headline_replacement_citations_hr_id ON headline_replacement_citations (headline_replacement_id)`;
    }

    async down(_info: Info): Promise<void> {
        await this.client.queryArray`DROP TABLE headline_replacement_citations`;
        await this.client.queryArray`DROP TABLE headline_replacements`;
    }
}
