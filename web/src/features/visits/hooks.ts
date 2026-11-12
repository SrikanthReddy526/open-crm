import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { visitsApi, type VisitListParams } from '../../api/crm'
import { tokenStore } from '../../api/tokenStore'
import type { Page, Visit, VisitInput } from '../../api/types'
import { localVisits, pendingVisits } from '../../offline/local'
import { currentDb, isNetworkError, queueChange } from '../../offline/sync'
import { withOfflineFallback } from '../customers/hooks'

/** Server list, with visits saved on this phone but not yet sent shown on top. */
export function useVisits(params: VisitListParams) {
  return useQuery({
    queryKey: ['visits', params],
    queryFn: async (): Promise<Page<Visit>> => {
      const page = await withOfflineFallback(
        () => visitsApi.list(params),
        () => localVisits(params.customerId, params.page ?? 0, params.size ?? 20),
      )
      if (page.offline || (params.page ?? 0) > 0) return page
      const waiting = await pendingVisits(params.customerId)
      const ids = new Set(page.content.map((v) => v.id))
      return { ...page, content: [...waiting.filter((v) => !ids.has(v.id)), ...page.content] }
    },
    placeholderData: keepPreviousData,
  })
}

export function useSaveVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, customerName }: { input: VisitInput; customerName?: string }) => {
      try {
        return input.version != null ? await visitsApi.update(input.id!, input) : await visitsApi.create(input)
      } catch (err) {
        if (!isNetworkError(err) || !currentDb()) throw err
        const now = new Date().toISOString()
        const user = tokenStore.getUser()
        const record: Visit = {
          id: input.id!,
          customerId: input.customerId,
          customerName: customerName ?? null,
          userId: user?.id ?? '',
          userName: user?.fullName ?? null,
          visitedAt: input.visitedAt,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          outcome: input.outcome ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
          version: input.version ?? 0,
        }
        await queueChange('visit', input.version != null ? 'UPDATE' : 'CREATE', record)
        return { ...record, pending: true }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['visits'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
