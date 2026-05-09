import type { SubmitOrderBody } from '../../../shared/nlp/submitOrderBody.js'
import type { OrderRow } from '../db/models.js'
import { insertOrderWithAudit } from '../db/repos/ordersRepo.js'

/** Persists a body that already passed `submitOrderBodySchema` (same path as POST /orders). */
export async function createOrderFromValidatedSubmit(body: SubmitOrderBody): Promise<OrderRow> {
  return insertOrderWithAudit(body)
}
