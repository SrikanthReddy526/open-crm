import { api } from './client'
import type { CsvImportResult, Customer, CustomerInput, NearbyCustomer, Page } from './types'

export interface CustomerListParams {
  q?: string
  page?: number
  size?: number
  sort?: string
}

export const customersApi = {
  list: (params: CustomerListParams) =>
    api.get<Page<Customer>>('/api/customers', { params }).then((r) => r.data),

  get: (id: string) => api.get<Customer>(`/api/customers/${id}`).then((r) => r.data),

  create: (input: CustomerInput) => api.post<Customer>('/api/customers', input).then((r) => r.data),

  update: (id: string, input: CustomerInput) =>
    api.put<Customer>(`/api/customers/${id}`, input).then((r) => r.data),

  remove: (id: string) => api.delete(`/api/customers/${id}`),

  nearby: (lat: number, lng: number, radiusKm = 5) =>
    api.get<NearbyCustomer[]>('/api/customers/nearby', { params: { lat, lng, radiusKm } }).then((r) => r.data),

  inArea: (south: number, west: number, north: number, east: number) =>
    api.get<Customer[]>('/api/customers/in-area', { params: { south, west, north, east } }).then((r) => r.data),

  exportCsv: (q: string) =>
    api.get<Blob>('/api/customers/export', { params: { q }, responseType: 'blob' }).then((r) => r.data),

  template: () => api.get<Blob>('/api/customers/import/template', { responseType: 'blob' }).then((r) => r.data),

  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<CsvImportResult>('/api/customers/import', form).then((r) => r.data)
  },
}
