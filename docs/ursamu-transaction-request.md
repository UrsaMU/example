# Feature Request: Atomic Read-Modify-Write Transactions in `DBO<T>`

## Context

The `DBO<T>` class in `src/services/Database/database.ts` wraps Deno KV but
exposes no atomic operations. Every `modify()` call is a non-atomic
read-then-write:

```typescript
// Current pattern in modify():
const items = await this.query(query);   // READ
for (const item of items) {
  // ... transform ...
  await kv.set(this.getKey(item.id), plainData);  // WRITE (separate roundtrip)
}
```

This means any plugin doing a read-modify-write cycle (which is essentially
every plugin) is vulnerable to lost updates under concurrent access. The
`getNextJobNumber()` counter increment in `src/plugins/jobs/mod.ts` has the
same problem — two concurrent calls can read the same counter value and produce
duplicate job numbers.

Deno KV has native support for this via `kv.atomic()` with compare-and-swap
semantics, but it's currently unused.

## Request

Add an `atomicModify()` method (or equivalent) to `DBO<T>` and `IDatabase<T>`
that performs a guaranteed atomic read-modify-write on a single record, using
Deno KV's `kv.atomic().check().set()` API under the hood. Signature suggestion:

```typescript
// Atomically fetch a record, apply a transform, and write it back.
// Retries automatically on version conflict (configurable, default 3).
atomicModify<T>(
  query: Query<T>,
  transform: (current: T) => Partial<T>,
  retries?: number,
): Promise<T>
```

Also expose a dedicated atomic counter helper, since `getNextJobNumber()` is
used across multiple plugins and the current pattern is racy:

```typescript
// Atomically increment a counter and return the new value.
atomicIncrement(id: string): Promise<number>
```

## Why Deno KV Can Do This

`kv.atomic()` supports compare-and-swap with versionstamp checks:

```typescript
const entry = await kv.get<T>(key);
const result = await kv
  .atomic()
  .check(entry)                        // only commit if version unchanged
  .set(key, transform(entry.value))
  .commit();

if (!result.ok) { /* retry */ }
```

This gives you serialisable single-record updates with no external locking.

## Affected Areas

| File | Location | Issue |
|------|----------|-------|
| `src/services/Database/database.ts` | `modify()` | needs `atomicModify()` added |
| `src/interfaces/IDatabase.ts` | interface | needs new method signature |
| `src/plugins/jobs/mod.ts` | `getNextJobNumber()` | should use `atomicIncrement()` |
| `src/plugins/jobs/router.ts` | ~line 206 | PATCH handler does plain read-then-update |
| `src/plugins/events/db.ts` | sequential ID generation | same racy counter pattern |

## Out of Scope

Multi-record transactions or cross-collection transactions. Single-record atomic
read-modify-write covers all the real cases. If `atomicModify()` is too broad,
even just `atomicIncrement()` for the counter case would close the most visible
race condition.
