// INSERT/UPDATE … RETURNING always yields a row; guard for noUncheckedIndexedAccess.
export function one<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) {
    throw new Error('expected a returned row');
  }
  return row;
}
