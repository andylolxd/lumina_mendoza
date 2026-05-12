/**
 * Aplica un archivo SQL de supabase/migrations contra DATABASE_URL (.env.local).
 * Uso: node scripts/apply-migration-file.cjs 016_delete_in_person_sale_no_stock_revert.sql
 */
const fs = require('fs')
const path = require('path')
const postgres = require('postgres')

function loadDatabaseUrl() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error('No existe .env.local. Agregá DATABASE_URL ahí.')
  }
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    if (key !== 'DATABASE_URL') continue
    let v = trimmed.slice(idx + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    v = v.replace(/\uFEFF/g, '').trim()
    if (v) return v
  }
  throw new Error('DATABASE_URL no está definido en .env.local')
}

async function main() {
  const name = process.argv[2]
  if (!name) {
    console.error('Uso: node scripts/apply-migration-file.cjs <archivo.sql>')
    process.exit(1)
  }
  const url = loadDatabaseUrl()
  const sql = postgres(url, {
    max: 1,
    ssl: 'require',
    connect_timeout: 30,
  })
  const fp = path.join(__dirname, '..', 'supabase', 'migrations', name)
  if (!fs.existsSync(fp)) {
    console.error('No existe:', fp)
    process.exit(1)
  }
  process.stdout.write(`→ ${name} ... `)
  await sql.file(fp)
  await sql.end()
  console.log('OK')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
