/** Typed reads of a module's free options (renderer, inspector, panel, chart builder). */
import { ConfigError, type ModuleOptions } from './config'

export class Options {
  constructor(
    private readonly o: ModuleOptions | Record<string, unknown>,
    private readonly where: string,
  ) {}

  private fail(key: string, what: string): never {
    throw new ConfigError(`${this.where}.${key}`, what)
  }

  has(key: string): boolean {
    return this.o[key] != null
  }

  str(key: string): string {
    const v = this.o[key]
    return typeof v === 'string' ? v : this.fail(key, 'must be text')
  }

  optStr(key: string): string | undefined {
    const v = this.o[key]
    return typeof v === 'string' ? v : v == null ? undefined : this.fail(key, 'must be text')
  }

  num(key: string, fallback?: number): number {
    const v = this.o[key]
    if (typeof v === 'number') return v
    return v == null && fallback !== undefined ? fallback : this.fail(key, 'must be a number')
  }

  bool(key: string, fallback = false): boolean {
    const v = this.o[key]
    return typeof v === 'boolean' ? v : fallback
  }

  strList(key: string): string[] {
    const v = this.o[key]
    if (v == null) return []
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : this.fail(key, 'must be a list of text')
  }

  numList(key: string): number[] {
    const v = this.o[key]
    if (v == null) return []
    return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : this.fail(key, 'must be a list of numbers')
  }

  strMap(key: string): Record<string, string> {
    const v = this.o[key]
    if (v == null) return {}
    if (typeof v !== 'object' || Array.isArray(v)) this.fail(key, 'must be a mapping')
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, String(x)]))
  }

  /** A nested block, read with the same helpers. */
  sub(key: string): Options | null {
    const v = this.o[key]
    if (v == null) return null
    if (typeof v !== 'object' || Array.isArray(v)) this.fail(key, 'must be a mapping')
    return new Options(v as Record<string, unknown>, `${this.where}.${key}`)
  }

  list(key: string): Options[] {
    const v = this.o[key]
    if (v == null) return []
    if (!Array.isArray(v)) this.fail(key, 'must be a list')
    return (v as Record<string, unknown>[]).map((x, i) => new Options(x, `${this.where}.${key}[${i}]`))
  }

  raw<T = unknown>(key: string): T | undefined {
    return this.o[key] as T | undefined
  }
}
