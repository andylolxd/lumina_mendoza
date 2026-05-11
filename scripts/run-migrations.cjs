/**
 * Ejecuta migraciones SQL contra DATABASE_URL (solo .env.local, no commitear).
 * Uso: npm run migrate
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

function assertValidDbUrl(url) {
  if (!url || url.length < 12) {
    throw new Error('DATABASE_URL está vacío o incompleto. Debe empezar con postgresql:// o postgres://')
  }
  const lower = url.toLowerCase()
  if (!lower.startsWith('postgres://') && !lower.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_URL debe ser una URI Postgres (postgresql://... o postgres://...). Revisá el pegado desde Supabase.',
    )
  }
  // No usamos `new URL(url)`: si la contraseña tiene @ # : etc. sin codificar, el parser estándar falla aunque Postgres acepte la URI.
}

async function main() {
  const url = loadDatabaseUrl()
  assertValidDbUrl(url)
  const sql = postgres(url, {
    max: 1,
    ssl: 'require',
    connect_timeout: 30,
  })

  const files = [
    '003_subsubcategorias.sql',
    '004_subsubcategorias_rls_grants.sql',
    '006_product_image_gallery.sql',
    '007_product_variants.sql',
  ]

  for (const f of files) {
    const fp = path.join(__dirname, '..', 'supabase', 'migrations', f)
    if (!fs.existsSync(fp)) {
      console.warn('Omitido (no existe):', f)
      continue
    }
    process.stdout.write(`→ ${f} ... `)
    await sql.file(fp)
    console.log('OK')
  }

  await sql.end()
  console.log('Migraciones terminadas.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
