import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { remindersApi, type ReminderListParams } from '../../api/crm'
import { tokenStore } from '../../api/tokenStore'
import type { Page, Reminder, ReminderInput } from '../../api/types'
import { localReminders } from '../../offline/local'
import { currentDb, isNetworkError, queueChange } from '../../offline/sync'
import { withOfflineFallback } from '../customers/hooks'

export function useReminders(params: ReminderListParams) {
  return useQuery({
    queryKey: ['reminders', params],
    queryFn: () =>
      withOfflineFallback(
        () => remindersApi.list(params),
        () => localReminders(params.due ?? 'ALL', params.status === 'DONE', params.page ?? 0, params.size ?? 20),
      ),
    placeholderData: keepPreviousData,
  })
}

function toRecord(input: ReminderInput, base?: Reminder): Reminder {
  const now = new Date().toISOString()
  const user = tokenStore.getUser()
  return {
    id: input.id ?? base!.id,
    title: input.title,
    description: input.description ?? null,
    dueAt: input.dueAt,
    status: input.status ?? base?.status ?? 'PENDING',
    assignedTo: input.assignedTo ?? base?.assignedTo ?? user?.id ?? '',
    assignedToName: base?.assignedToName ?? user?.fullName ?? null,
    customerId: input.customerId ?? null,
    customerName: base?.customerName ?? null,
    leadId: input.leadId ?? null,
    dealId: input.dealId ?? null,
    completedAt: input.status === 'DONE' ? now : null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    version: input.version ?? base?.version ?? 0,
  }
}

export function toInput(r: Reminder): ReminderInput {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    dueAt: r.dueAt,
    status: r.status,
    assignedTo: r.assignedTo,
    customerId: r.customerId,
    leadId: r.leadId,
    dealId: r.dealId,
    version: r.version,
  }
}

/** Create or update; without a connection the change is saved on the device and sent later. */
export function useSaveReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, existing }: { input: ReminderInput; existing?: Reminder }) => {
      try {
        return existing ? await remindersApi.update(existing.id, input) : await remindersApi.create(input)
      } catch (err) {
        if (!isNetworkError(err) || !currentDb()) throw err
        const record = toRecord(input, existing)
        await queueChange('reminder', existing ? 'UPDATE' : 'CREATE', record)
        return { ...record, pending: true }
      }
    },
    // Show ticks / snoozes at once (slow mobile data); roll back if the save fails.
    onMutate: async ({ input, existing }) => {
      if (!existing) return undefined
      await qc.cancelQueries({ queryKey: ['reminders'] })
      const previous = qc.getQueriesData<Page<Reminder>>({ queryKey: ['reminders'] })
      qc.setQueriesData<Page<Reminder>>({ queryKey: ['reminders'] }, (old) =>
        old?.content
          ? {
              ...old,
              content: old.content.map((r) =>
                r.id === existing.id ? { ...r, status: input.status ?? r.status, dueAt: input.dueAt, title: input.title } : r,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['reminders'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCompleteReminder() {
  const save = useSaveReminder()
  return {
    ...save,
    complete: (r: Reminder) => save.mutateAsync({ input: { ...toInput(r), status: 'DONE' }, existing: r }),
    reopen: (r: Reminder) => save.mutateAsync({ input: { ...toInput(r), status: 'PENDING' }, existing: r }),
    snooze: (r: Reminder, until: Date) =>
      save.mutateAsync({ input: { ...toInput(r), status: 'PENDING', dueAt: until.toISOString() }, existing: r }),
  }
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => remindersApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}
