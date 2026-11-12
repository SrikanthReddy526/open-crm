import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../api/auth'
import { customersApi, type CustomerListParams } from '../../api/customers'
import { tokenStore } from '../../api/tokenStore'
import type { Customer, CustomerInput } from '../../api/types'
import { localCustomer, localCustomers } from '../../offline/local'
import { currentDb, isNetworkError, queueChange } from '../../offline/sync'

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: CustomerListParams) => ['customers', 'list', params] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
}

/** Runs the API call; without a connection, answers from the device's saved copy instead. */
export async function withOfflineFallback<T>(online: () => Promise<T>, offline: () => Promise<T>): Promise<T> {
  try {
    return await online()
  } catch (err) {
    if (isNetworkError(err) && currentDb()) {
      try {
        return await offline()
      } catch {
        throw err // nothing saved locally either: show the network error
      }
    }
    throw err
  }
}

export function useCustomerList(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () =>
      withOfflineFallback(
        () => customersApi.list(params),
        () => localCustomers(params.q ?? '', params.page ?? 0, params.size ?? 20),
      ),
    placeholderData: keepPreviousData, // keep showing the old page while the next one loads
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: () => withOfflineFallback(() => customersApi.get(id!), () => localCustomer(id!)),
    enabled: !!id,
  })
}

/** Builds the local record for an offline save. */
async function offlineCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const existing = await localCustomer(id).catch(() => null)
  const now = new Date().toISOString()
  return {
    id,
    name: input.name,
    company: input.company ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    addressLine: input.addressLine ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    notes: input.notes ?? null,
    ownerId: input.ownerId ?? existing?.ownerId ?? tokenStore.getUser()?.id ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: input.version ?? existing?.version ?? 0,
  }
}

export function useSaveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: CustomerInput }) => {
      try {
        return id ? await customersApi.update(id, input) : await customersApi.create(input)
      } catch (err) {
        if (!isNetworkError(err) || !currentDb()) throw err
        const recordId = id ?? input.id!
        const record = await offlineCustomer(recordId, input)
        await queueChange('customer', id ? 'UPDATE' : 'CREATE', record)
        return { ...record, pending: true } as Customer
      }
    },
    onSuccess: (saved) => {
      qc.setQueryData(customerKeys.detail(saved.id), saved)
      void qc.invalidateQueries({ queryKey: ['customers', 'list'] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: customerKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: ['customers', 'list'] })
    },
  })
}

export function useImportCustomers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => customersApi.importCsv(file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useUserLookup(enabled = true) {
  return useQuery({ queryKey: ['users', 'lookup'], queryFn: usersApi.lookup, enabled, staleTime: 5 * 60_000 })
}
