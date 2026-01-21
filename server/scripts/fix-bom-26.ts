import 'dotenv/config';
import { Pool } from 'pg';

type Source = 'ITEM' | 'BAHAN_BAKU';

type LineDef = {
  name: string;
  qty: number;
  code: string;
  sourceType: Source;
};

type BomRow = {
  id: string;
  productCode: string;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set. Please add it to server/.env');
  process.exit(1);
}

const ssl =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString, ssl });

function normalize(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[`"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text: string) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

function shortHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6).toUpperCase();
}

async function ensureRaw(client: Pool, name: string) {
  const norm = name.toLowerCase();
  const existing = await client.query<{ code: string; name: string }>(
    'SELECT code, name FROM "BahanBaku" WHERE lower(name) = $1',
    [norm],
  );
  if (existing.rowCount) return existing.rows[0];

  const code = `BB-${slugify(name)}-${shortHash(name)}`.toUpperCase();
  await client.query(
    'INSERT INTO "BahanBaku" ("code", "name") VALUES ($1, $2) ON CONFLICT ("code") DO NOTHING',
    [code, name],
  );
  return { code, name };
}

async function getItemOrRawByCode(client: Pool, code: string) {
  const item = await client.query<{ code: string; name: string }>(
    'SELECT code, name FROM "Item" WHERE code = $1',
    [code],
  );
  if (item.rowCount)
    return {
      code: item.rows[0].code,
      name: item.rows[0].name,
      sourceType: 'ITEM' as const,
    };

  const raw = await client.query<{ code: string; name: string }>(
    'SELECT code, name FROM "BahanBaku" WHERE code = $1',
    [code],
  );
  if (raw.rowCount)
    return {
      code: raw.rows[0].code,
      name: raw.rows[0].name,
      sourceType: 'BAHAN_BAKU' as const,
    };

  throw new Error(`Code not found: ${code}`);
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const headHitam26 = await ensureRaw(client, 'Head Hitam 26"');
    const headPutih26 = await ensureRaw(client, 'Head Putih 26"');
    const headHitam28 = await ensureRaw(client, 'Head Hitam 28"');
    const headPutih28 = await ensureRaw(client, 'Head Putih 28"');

    const lookups = await Promise.all([
      getItemOrRawByCode(client, 'BB-BODY-TABUNG-J33FZD'),
      getItemOrRawByCode(client, 'BBK-0040'),
      getItemOrRawByCode(client, 'RING KAYU'),
      getItemOrRawByCode(client, 'LUG-HTS-13-STD'),
      getItemOrRawByCode(client, 'BB-CLAW-CAKRAM-X6EGZZ'),
      getItemOrRawByCode(client, 'ACC-GEN-10-STD'),
      getItemOrRawByCode(client, 'ACC-GEN-00-STD15'),
      getItemOrRawByCode(client, 'ACC-GEN-00-STD10'),
      getItemOrRawByCode(client, 'BB-BUSA-18MPT'),
      getItemOrRawByCode(client, 'BB-SLING-1BM4EH'),
      getItemOrRawByCode(client, 'BB-PEMUKUL-G8G6G5'),
      getItemOrRawByCode(client, 'BB-CAKRAM-2MM-H3JNR1'),
      getItemOrRawByCode(client, 'BB-LUG-PREMIUM-E1MFBF'),
      getItemOrRawByCode(client, 'BB-LUG-LITE-UK-20-DEHYGA'),
      getItemOrRawByCode(client, 'ACC-GEN-00-STD17'),
      getItemOrRawByCode(client, 'HARN-GEN-00-STD10'),
      getItemOrRawByCode(client, 'ACC-HTS-00-PRM'),
      getItemOrRawByCode(client, 'BB-SPON-1JDP8'),
    ]);

    const [
      body,
      mika,
      ring,
      lug,
      claw,
      baut,
      kempongan,
      mataAyam,
      busa,
      sling,
      pemukul,
      cakram2mm,
      lugPremium,
      lugLite,
      pengaitBass,
      harnest,
      mataAyamHts,
      spon,
    ] = lookups;

    const buildLines = (head: { code: string; name: string }) => {
      const headLine: LineDef = {
        name: head.name,
        qty: 2,
        code: head.code,
        sourceType: 'BAHAN_BAKU',
      };
      const rest: LineDef[] = [
        {
          name: body.name,
          qty: 1,
          code: body.code,
          sourceType: body.sourceType,
        },
        {
          name: 'Mika glitter',
          qty: 1,
          code: mika.code,
          sourceType: mika.sourceType,
        },
        { name: 'Ring', qty: 2, code: ring.code, sourceType: ring.sourceType },
        { name: 'Lug', qty: 12, code: lug.code, sourceType: lug.sourceType },
        {
          name: 'Claw (cakram)',
          qty: 24,
          code: claw.code,
          sourceType: claw.sourceType,
        },
        { name: 'Baut', qty: 24, code: baut.code, sourceType: baut.sourceType },
        {
          name: 'Kempongan',
          qty: 2,
          code: kempongan.code,
          sourceType: kempongan.sourceType,
        },
        {
          name: 'Mata Ayam',
          qty: 1,
          code: mataAyam.code,
          sourceType: mataAyam.sourceType,
        },
        { name: 'Busa', qty: 1, code: busa.code, sourceType: busa.sourceType },
        {
          name: 'Sling',
          qty: 1,
          code: sling.code,
          sourceType: sling.sourceType,
        },
        {
          name: 'Pemukul',
          qty: 1,
          code: pemukul.code,
          sourceType: pemukul.sourceType,
        },
      ];
      return [headLine, ...rest];
    };

    const buildHtsLines = (
      head: { code: string; name: string },
      lugLine: LineDef,
    ) => {
      const headLine: LineDef = {
        name: head.name,
        qty: 2,
        code: head.code,
        sourceType: 'BAHAN_BAKU',
      };
      const rest: LineDef[] = [
        {
          name: body.name,
          qty: 1,
          code: body.code,
          sourceType: body.sourceType,
        },
        {
          name: 'Mika glitter',
          qty: 1,
          code: mika.code,
          sourceType: mika.sourceType,
        },
        {
          name: ring.name,
          qty: 2,
          code: ring.code,
          sourceType: ring.sourceType,
        },
        lugLine,
        {
          name: 'Cakram 2mm',
          qty: 24,
          code: cakram2mm.code,
          sourceType: cakram2mm.sourceType,
        },
        { name: 'Baut', qty: 24, code: baut.code, sourceType: baut.sourceType },
        {
          name: 'Pengait Bass',
          qty: 1,
          code: pengaitBass.code,
          sourceType: pengaitBass.sourceType,
        },
        { name: 'Spon', qty: 1, code: spon.code, sourceType: spon.sourceType },
        {
          name: 'Mata Ayam HTS',
          qty: 1,
          code: mataAyamHts.code,
          sourceType: mataAyamHts.sourceType,
        },
        {
          name: harnest.name,
          qty: 1,
          code: harnest.code,
          sourceType: harnest.sourceType,
        },
        {
          name: 'Pemukul',
          qty: 1,
          code: pemukul.code,
          sourceType: pemukul.sourceType,
        },
      ];
      return [headLine, ...rest];
    };

    const targets = [
      { productCode: 'DRBD-BD-26-BLK', lines: buildLines(headHitam26) },
      { productCode: 'DRBD-BD-26-WHT', lines: buildLines(headPutih26) },
      {
        productCode: 'HTS-BD-26-PB-35',
        lines: buildHtsLines(headHitam26, {
          name: 'Lug Premium',
          qty: 12,
          code: lugPremium.code,
          sourceType: lugPremium.sourceType,
        }),
      },
      {
        productCode: 'HTS-BD-26-PW-35',
        lines: buildHtsLines(headPutih26, {
          name: 'Lug Premium',
          qty: 12,
          code: lugPremium.code,
          sourceType: lugPremium.sourceType,
        }),
      },
      {
        productCode: 'HTS-BD-26-UB-35',
        lines: buildHtsLines(headHitam26, {
          name: 'Lug Lite uk. 20',
          qty: 12,
          code: lugLite.code,
          sourceType: lugLite.sourceType,
        }),
      },
      {
        productCode: 'HTS-BD-26-UW-35',
        lines: buildHtsLines(headPutih26, {
          name: 'Lug Lite uk. 20',
          qty: 12,
          code: lugLite.code,
          sourceType: lugLite.sourceType,
        }),
      },
      { productCode: 'DRBD-BD-28-BLK', lines: buildLines(headHitam28) },
      { productCode: 'DRBD-BD-28-WHT', lines: buildLines(headPutih28) },
      {
        productCode: 'HTS-BD-28-PB-35',
        lines: buildHtsLines(headHitam28, {
          name: 'Lug Premium',
          qty: 12,
          code: lugPremium.code,
          sourceType: lugPremium.sourceType,
        }),
      },
      {
        productCode: 'HTS-BD-28-PW-35',
        lines: buildHtsLines(headPutih28, {
          name: 'Lug Premium',
          qty: 12,
          code: lugPremium.code,
          sourceType: lugPremium.sourceType,
        }),
      },
      {
        productCode: 'HTS-BD-28-UB-35',
        lines: buildHtsLines(headHitam28, {
          name: 'Lug Lite uk. 20',
          qty: 6,
          code: lugLite.code,
          sourceType: lugLite.sourceType,
        }),
      },
      {
        productCode: 'HTS-BD-28-UW-35',
        lines: buildHtsLines(headPutih28, {
          name: 'Lug Lite uk. 20',
          qty: 6,
          code: lugLite.code,
          sourceType: lugLite.sourceType,
        }),
      },
    ];

    const bomRows = await client.query<BomRow>(
      'SELECT id, "productCode" FROM "Bom" WHERE "productCode" = ANY($1)',
      [targets.map((t) => t.productCode)],
    );

    if (bomRows.rowCount !== targets.length) {
      const found = new Set(bomRows.rows.map((r) => r.productCode));
      const missing = targets
        .filter((t) => !found.has(t.productCode))
        .map((t) => t.productCode);
      throw new Error(`Missing BOM rows: ${missing.join(', ')}`);
    }

    const bomIdByCode = new Map(bomRows.rows.map((r) => [r.productCode, r.id]));

    const bomIds = bomRows.rows.map((r) => r.id);
    await client.query('DELETE FROM "BomLine" WHERE "bomId" = ANY($1)', [
      bomIds,
    ]);

    for (const target of targets) {
      const bomId = bomIdByCode.get(target.productCode)!;
      const params: string[] = [];
      const values: Array<string | number> = [];

      target.lines.forEach((line, idx) => {
        const base = idx * 5;
        params.push(
          `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
        );
        values.push(bomId, line.sourceType, line.code, line.name, line.qty);
      });

      const sql = `
        INSERT INTO "BomLine" ("id", "bomId", "sourceType", "code", "name", "qty")
        VALUES ${params.join(',')};
      `;
      await client.query(sql, values);
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          updatedProducts: targets.map((t) => t.productCode),
          insertedHeadCodes: {
            hitam26: headHitam26.code,
            putih26: headPutih26.code,
            hitam28: headHitam28.code,
            putih28: headPutih28.code,
          },
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to fix BOM 26"', err);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
