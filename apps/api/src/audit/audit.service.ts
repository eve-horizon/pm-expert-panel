import { Injectable } from '@nestjs/common';
import { DatabaseService, DbContext } from '../common/database.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string | null;
  details: unknown;
  created_at: string;
}

export interface AuditFilter {
  entity_type?: string;
  actor?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    ctx: DbContext,
    projectId: string,
    filter: AuditFilter,
  ): Promise<AuditEntry[]> {
    const conditions = ['a.project_id = $1'];
    const params: unknown[] = [projectId];

    if (filter.entity_type) {
      params.push(filter.entity_type);
      conditions.push(`a.entity_type = $${params.length}`);
    }
    if (filter.actor) {
      params.push(filter.actor);
      conditions.push(`a.actor = $${params.length}`);
    }
    if (filter.action) {
      params.push(filter.action);
      conditions.push(`a.action = $${params.length}`);
    }

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    return this.db.withClient(ctx, async (client) => {
      const { rows } = await client.query<AuditEntry>(
        `SELECT a.id, a.entity_type, a.entity_id, a.action,
                a.actor, a.details, a.created_at
           FROM audit_log a
          WHERE ${conditions.join(' AND ')}
          ORDER BY a.created_at DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );

      return rows;
    });
  }
}
