import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbContext } from '../common/database.service';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ReviewRow {
  id: string;
  org_id: string;
  project_id: string;
  eve_job_id: string | null;
  title: string | null;
  synthesis: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ExpertOpinionRow {
  id: string;
  org_id: string;
  review_id: string;
  expert_slug: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewResponse {
  id: string;
  title: string;
  status: string;
  synthesis: string | null;
  expert_count: number;
  expert_opinions: { expert_slug: string; summary: string }[];
  eve_job_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ReviewsService {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: DbContext, projectId: string): Promise<ReviewResponse[]> {
    const reviews = await this.db.query<ReviewRow>(
      ctx,
      `SELECT * FROM reviews
        WHERE project_id = $1
        ORDER BY created_at DESC`,
      [projectId],
    );

    if (reviews.length === 0) return [];

    const reviewIds = reviews.map((r) => r.id);
    const opinions = await this.db.query<ExpertOpinionRow>(
      ctx,
      `SELECT * FROM expert_opinions
        WHERE review_id = ANY($1)
        ORDER BY created_at`,
      [reviewIds],
    );

    const opinionsByReview = new Map<string, ExpertOpinionRow[]>();
    for (const op of opinions) {
      const list = opinionsByReview.get(op.review_id) ?? [];
      list.push(op);
      opinionsByReview.set(op.review_id, list);
    }

    return reviews.map((r) => this.toResponse(r, opinionsByReview.get(r.id) ?? []));
  }

  async findById(ctx: DbContext, id: string): Promise<ReviewResponse> {
    const review = await this.db.queryOne<ReviewRow>(
      ctx,
      'SELECT * FROM reviews WHERE id = $1',
      [id],
    );
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }

    const opinions = await this.db.query<ExpertOpinionRow>(
      ctx,
      'SELECT * FROM expert_opinions WHERE review_id = $1 ORDER BY created_at',
      [id],
    );

    return this.toResponse(review, opinions);
  }

  async create(
    ctx: DbContext,
    projectId: string,
    input: {
      title?: string;
      synthesis?: string;
      status?: string;
      eve_job_id?: string;
      expert_opinions?: { expert_slug: string; summary: string }[];
    },
  ): Promise<ReviewResponse> {
    return this.db.withClient(ctx, async (client) => {
      const result = await client.query<ReviewRow>(
        `INSERT INTO reviews (org_id, project_id, title, synthesis, status, eve_job_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          ctx.org_id,
          projectId,
          input.title ?? 'Expert Panel Review',
          input.synthesis ?? null,
          input.status ?? 'complete',
          input.eve_job_id ?? null,
        ],
      );
      const review = result.rows[0];

      const opinions: ExpertOpinionRow[] = [];
      if (input.expert_opinions?.length) {
        for (const op of input.expert_opinions) {
          const opResult = await client.query<ExpertOpinionRow>(
            `INSERT INTO expert_opinions (org_id, review_id, expert_slug, summary)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [ctx.org_id, review.id, op.expert_slug, op.summary],
          );
          opinions.push(opResult.rows[0]);
        }
      }

      return this.toResponse(review, opinions);
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toResponse(row: ReviewRow, opinions: ExpertOpinionRow[]): ReviewResponse {
    return {
      id: row.id,
      title: row.title ?? 'Expert Panel Review',
      status: row.status,
      synthesis: row.synthesis,
      expert_count: opinions.length,
      expert_opinions: opinions.map((o) => ({
        expert_slug: o.expert_slug,
        summary: o.summary ?? '',
      })),
      eve_job_id: row.eve_job_id,
      created_at: row.created_at,
    };
  }
}
