import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbContext } from '../common/database.service';

// ---------------------------------------------------------------------------
// Row type — mirrors the ingestion_sources DB table
// ---------------------------------------------------------------------------

export interface IngestionSourceRow {
  id: string;
  org_id: string;
  project_id: string;
  filename: string;
  storage_key: string | null;
  status: string;
  content_type: string | null;
  eve_ingest_id: string | null;
  eve_job_id: string | null;
  file_size: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class SourcesService {
  constructor(private readonly db: DatabaseService) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async list(ctx: DbContext, projectId: string): Promise<IngestionSourceRow[]> {
    return this.db.query<IngestionSourceRow>(
      ctx,
      `SELECT * FROM ingestion_sources
        WHERE project_id = $1
        ORDER BY created_at DESC`,
      [projectId],
    );
  }

  async findById(ctx: DbContext, id: string): Promise<IngestionSourceRow> {
    const source = await this.db.queryOne<IngestionSourceRow>(
      ctx,
      'SELECT * FROM ingestion_sources WHERE id = $1',
      [id],
    );

    if (!source) {
      throw new NotFoundException(`Source ${id} not found`);
    }

    return source;
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(
    ctx: DbContext,
    projectId: string,
    input: { filename: string; content_type?: string; file_size?: number },
  ): Promise<IngestionSourceRow & { upload_url: string }> {
    return this.db.withClient(ctx, async (client) => {
      const result = await client.query<IngestionSourceRow>(
        `INSERT INTO ingestion_sources
              (org_id, project_id, filename, content_type, file_size, status)
         VALUES ($1, $2, $3, $4, $5, 'uploaded')
         RETURNING *`,
        [
          ctx.org_id,
          projectId,
          input.filename,
          input.content_type ?? null,
          input.file_size ?? null,
        ],
      );

      const source = result.rows[0];

      await client.query(
        `INSERT INTO audit_log (org_id, project_id, entity_type, entity_id, action, actor, details)
              VALUES ($1, $2, 'ingestion_source', $3, 'create', $4, $5)`,
        [
          ctx.org_id,
          projectId,
          source.id,
          ctx.user_id ?? null,
          JSON.stringify({ filename: input.filename }),
        ],
      );

      // In production, we'd call Eve's ingest API here:
      // const eveIngest = await eveClient.post(`/projects/${eveProjectId}/ingest`, { filename, content_type })
      // For now, return a placeholder upload_url
      const upload_url = `https://storage.example.com/upload/${source.id}`;

      return { ...source, upload_url };
    });
  }

  async confirm(ctx: DbContext, id: string): Promise<IngestionSourceRow> {
    return this.db.withClient(ctx, async (client) => {
      const result = await client.query<IngestionSourceRow>(
        `UPDATE ingestion_sources
            SET status = 'processing'
          WHERE id = $1 AND status = 'uploaded'
          RETURNING *`,
        [id],
      );

      const source = result.rows[0];
      if (!source) {
        throw new NotFoundException(
          `Source ${id} not found or not in 'uploaded' status`,
        );
      }

      // In production, this would call Eve to confirm the ingest,
      // triggering the ingestion-pipeline workflow.

      await client.query(
        `INSERT INTO audit_log (org_id, project_id, entity_type, entity_id, action, actor, details)
              VALUES ($1, $2, 'ingestion_source', $3, 'confirm', $4, $5)`,
        [
          source.org_id,
          source.project_id,
          source.id,
          ctx.user_id ?? null,
          JSON.stringify({ status: 'processing' }),
        ],
      );

      return source;
    });
  }

  async updateStatus(
    ctx: DbContext,
    id: string,
    status: string,
    extra?: { eve_job_id?: string; error_message?: string },
  ): Promise<IngestionSourceRow> {
    return this.db.withClient(ctx, async (client) => {
      const setClauses = ['status = $2'];
      const params: unknown[] = [id, status];

      if (extra?.eve_job_id !== undefined) {
        params.push(extra.eve_job_id);
        setClauses.push(`eve_job_id = $${params.length}`);
      }
      if (extra?.error_message !== undefined) {
        params.push(extra.error_message);
        setClauses.push(`error_message = $${params.length}`);
      }

      const result = await client.query<IngestionSourceRow>(
        `UPDATE ingestion_sources
            SET ${setClauses.join(', ')}
          WHERE id = $1
          RETURNING *`,
        params,
      );

      const source = result.rows[0];
      if (!source) {
        throw new NotFoundException(`Source ${id} not found`);
      }

      await client.query(
        `INSERT INTO audit_log (org_id, project_id, entity_type, entity_id, action, actor, details)
              VALUES ($1, $2, 'ingestion_source', $3, 'update_status', $4, $5)`,
        [
          source.org_id,
          source.project_id,
          source.id,
          ctx.user_id ?? null,
          JSON.stringify({ status, ...extra }),
        ],
      );

      return source;
    });
  }
}
