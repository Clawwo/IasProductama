import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required');
}

const sslCertPath =
  process.env.PGSSLROOTCERT || process.env.SSL_CERT_FILE || undefined;
const sslMode = process.env.PGSSLMODE || 'verify-full';
const urlObj = new URL(url);
const host = urlObj.hostname;
urlObj.search = '';

const sslConfig = sslCertPath
  ? {
      ca: readFileSync(sslCertPath, 'utf8'),
      rejectUnauthorized: sslMode !== 'allow' && sslMode !== 'prefer',
      servername: host,
    }
  : undefined;

const pool = new Pool({
  connectionString: urlObj.toString(),
  ssl: sslConfig,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const CONFIRM_FLAG = '--confirm';
const confirmed = process.argv.includes(CONFIRM_FLAG);

async function main() {
  if (!confirmed) {
    console.error(`Refusing to run. Pass ${CONFIRM_FLAG} to confirm.`);
    process.exit(1);
  }

  const results = await prisma.$transaction(async (tx) => {
    const drafts = await tx.draft.deleteMany();

    const productionFinishedLines =
      await tx.productionFinishedLine.deleteMany();
    const productionRawLines = await tx.productionRawLine.deleteMany();
    const production = await tx.production.deleteMany();

    const rawOutboundLines = await tx.rawMaterialOutboundLine.deleteMany();
    const rawOutbound = await tx.rawMaterialOutbound.deleteMany();
    const rawInboundLines = await tx.rawMaterialInboundLine.deleteMany();
    const rawInbound = await tx.rawMaterialInbound.deleteMany();

    const convectionOutboundLines =
      await tx.convectionOutboundLine.deleteMany();
    const convectionOutbound = await tx.convectionOutbound.deleteMany();
    const convectionInboundLines = await tx.convectionInboundLine.deleteMany();
    const convectionInbound = await tx.convectionInbound.deleteMany();

    const outboundLines = await tx.outboundLine.deleteMany();
    const outbound = await tx.outbound.deleteMany();
    const inboundLines = await tx.inboundLine.deleteMany();
    const inbound = await tx.inbound.deleteMany();

    return {
      drafts,
      productionFinishedLines,
      productionRawLines,
      production,
      rawOutboundLines,
      rawOutbound,
      rawInboundLines,
      rawInbound,
      convectionOutboundLines,
      convectionOutbound,
      convectionInboundLines,
      convectionInbound,
      outboundLines,
      outbound,
      inboundLines,
      inbound,
    };
  });

  console.log('Cleanup completed:');
  Object.entries(results).forEach(([key, value]) => {
    console.log(`- ${key}: ${value.count}`);
  });
}

main()
  .catch((err) => {
    console.error('Cleanup failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
