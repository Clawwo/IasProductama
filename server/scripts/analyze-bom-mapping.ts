/// <reference types="node" />
import 'dotenv/config';
import { Pool } from 'pg';

type Candidate = {
  code: string;
  name: string | null;
  source: 'ITEM' | 'BAHAN_BAKU';
};

type LineInfo = {
  bomId: string;
  bomProduct: string;
  bomProductCode: string;
  lineId: string;
  lineName: string;
  qty: number;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
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
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIndex(items: Candidate[]) {
  const byNorm = new Map<string, Candidate[]>();
  for (const it of items) {
    const key = normalize(it.name) || normalize(it.code);
    if (!key) continue;
    const arr = byNorm.get(key) ?? [];
    arr.push(it);
    byNorm.set(key, arr);
  }
  return byNorm;
}

function findCandidates(
  name: string,
  index: Map<string, Candidate[]>,
  all: Candidate[],
): Candidate[] {
  const norm = normalize(name);
  if (!norm) return [];
  const exact = index.get(norm);
  if (exact?.length) return exact;

  // Fuzzy: contains either way, but short words are skipped
  const results: Candidate[] = [];
  for (const cand of all) {
    const key = normalize(cand.name) || normalize(cand.code);
    if (!key) continue;
    if (key.length < 3 || norm.length < 3) continue;
    if (key.includes(norm) || norm.includes(key)) {
      results.push(cand);
    }
  }
  return results;
}

async function main() {
  const client = await pool.connect();
  try {
    const bomLinesRes = await client.query(
      `SELECT bl.id as "lineId", bl."bomId", bl.name as "lineName", bl.qty,
              b."productCode", COALESCE(b."productName", b."productCode") as "productName"
       FROM "BomLine" bl
       JOIN "Bom" b ON b.id = bl."bomId"
       WHERE (bl.code IS NULL OR bl.code = '')`,
    );

    const itemsRes = await client.query('SELECT code, name FROM "Item"');
    const bahanRes = await client.query('SELECT code, name FROM "BahanBaku"');

    const bomLines = bomLinesRes.rows as Array<{
      lineId: string;
      bomId: string;
      lineName: string;
      qty: number;
      productCode: string;
      productName: string;
    }>;

    const items = itemsRes.rows as Array<{ code: string; name: string | null }>;
    const bahan = bahanRes.rows as Array<{ code: string; name: string | null }>;

    const candidates: Candidate[] = [
      ...items.map((it) => ({
        code: it.code,
        name: it.name,
        source: 'ITEM' as const,
      })),
      ...bahan.map((it) => ({
        code: it.code,
        name: it.name,
        source: 'BAHAN_BAKU' as const,
      })),
    ];

    const index = buildIndex(candidates);

    const proposals: Array<{
      line: LineInfo;
      matches: Candidate[];
    }> = [];

    for (const line of bomLines) {
      const matches = findCandidates(line.lineName ?? '', index, candidates);
      proposals.push({
        line: {
          bomId: line.bomId,
          bomProduct: line.productName,
          bomProductCode: line.productCode,
          lineId: line.lineId,
          lineName: line.lineName ?? '',
          qty: line.qty,
        },
        matches,
      });
    }

    const confident: typeof proposals = [];
    const ambiguous: typeof proposals = [];
    const none: typeof proposals = [];

    for (const p of proposals) {
      if (p.matches.length === 1) confident.push(p);
      else if (p.matches.length > 1) ambiguous.push(p);
      else none.push(p);
    }

    console.log(
      JSON.stringify(
        {
          summary: {
            totalMissing: proposals.length,
            confident: confident.length,
            ambiguous: ambiguous.length,
            none: none.length,
          },
          ambiguous,
          none,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
