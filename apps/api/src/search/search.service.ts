import { Injectable } from '@nestjs/common';
import { DatabaseService, DbContext } from '../common/database.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  entity_type: string;
  id: string;
  display_id: string;
  title: string;
  excerpt: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  async search(
    ctx: DbContext,
    projectId: string,
    query: string,
  ): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    return this.db.withClient(ctx, async (client) => {
      const { rows } = await client.query<SearchResult>(
        `WITH matches AS (
           -- Tasks: search title + user_story
           SELECT 'task'          AS entity_type,
                  t.id,
                  t.display_id,
                  t.title,
                  ts_headline('english', coalesce(t.title, '') || ' ' || coalesce(t.user_story, ''),
                              plainto_tsquery('english', $2),
                              'StartSel=**,StopSel=**,MaxFragments=1,MaxWords=30') AS excerpt,
                  ts_rank(to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.user_story, '')),
                          plainto_tsquery('english', $2)) AS rank
             FROM tasks t
            WHERE t.project_id = $1
              AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.user_story, ''))
                  @@ plainto_tsquery('english', $2)

           UNION ALL

           -- Questions: search question + answer
           SELECT 'question'      AS entity_type,
                  q.id,
                  q.display_id,
                  q.question       AS title,
                  ts_headline('english', coalesce(q.question, '') || ' ' || coalesce(q.answer, ''),
                              plainto_tsquery('english', $2),
                              'StartSel=**,StopSel=**,MaxFragments=1,MaxWords=30') AS excerpt,
                  ts_rank(to_tsvector('english', coalesce(q.question, '') || ' ' || coalesce(q.answer, '')),
                          plainto_tsquery('english', $2)) AS rank
             FROM questions q
            WHERE q.project_id = $1
              AND to_tsvector('english', coalesce(q.question, '') || ' ' || coalesce(q.answer, ''))
                  @@ plainto_tsquery('english', $2)

           UNION ALL

           -- Ingestion sources: search filename
           SELECT 'source'        AS entity_type,
                  s.id,
                  s.id::text       AS display_id,
                  s.filename       AS title,
                  ts_headline('english', coalesce(s.filename, ''),
                              plainto_tsquery('english', $2),
                              'StartSel=**,StopSel=**,MaxFragments=1,MaxWords=30') AS excerpt,
                  ts_rank(to_tsvector('english', coalesce(s.filename, '')),
                          plainto_tsquery('english', $2)) AS rank
             FROM ingestion_sources s
            WHERE s.project_id = $1
              AND to_tsvector('english', coalesce(s.filename, ''))
                  @@ plainto_tsquery('english', $2)
         )
         SELECT entity_type, id, display_id, title, excerpt
           FROM matches
          ORDER BY rank DESC
          LIMIT 50`,
        [projectId, query],
      );

      return rows;
    });
  }
}
