import type { RecordSummary } from '../src/lib/api/types'

export function summary(id: string, over: Partial<RecordSummary> = {}): RecordSummary {
  const [source, local_id] = id.split(':')
  return {
    id, source, local_id, title: local_id, description: null, resource_type: 'dataset',
    themes: [], geography: [], landscapes: [], landscapes_derived: false,
    facets: { source: [source] }, bbox: [], period: null, access: 'public',
    license: null, same_as: [], updated: null,
    producer: null, access_url: null, ...over,
  }
}
