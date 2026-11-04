/**
 * Composition root of the website: picks the catalogue adapter from the configuration.
 * The only module that knows which implementation is used.
 */
import { readConfig, type AppConfig } from '../config'
import { createJsonFetcher } from './http'
import { LiveCatalogRepository } from './live-repository'
import type { LandscapeRepository } from './landscapes'
import type { CatalogRepository } from './repository'
import { StaticCatalogRepository } from './static-repository'

export function createRepository(config: AppConfig = readConfig()): CatalogRepository & LandscapeRepository {
  return config.apiMode === 'live'
    ? new LiveCatalogRepository(config.apiUrl)
    : new StaticCatalogRepository(config.apiUrl, createJsonFetcher())
}

let shared: (CatalogRepository & LandscapeRepository) | null = null

function repository(): CatalogRepository & LandscapeRepository {
  shared ??= createRepository()
  return shared
}

/** One repository per page, so every island shares the same loaded catalogue. */
export function catalogue(): CatalogRepository {
  return repository()
}

/** Landscape pages: the same adapter, seen through its LandscapeRepository port. */
export function landscapePages(): LandscapeRepository {
  return repository()
}

export type { CatalogRepository, CatalogueOverview } from './repository'
export type { LandscapeRepository } from './landscapes'
