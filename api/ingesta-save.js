import fs from 'fs/promises';
import path from 'path';

export const config = { runtime: 'nodejs' };
const ALLOW_LOCAL_FS_WRITES = process.env.QSD_ALLOW_LOCAL_FS_WRITES === '1';

export default async function handler(req, res) {
  if (!ALLOW_LOCAL_FS_WRITES) {
    res.status(503).json({
      error: 'Endpoint deshabilitado en serverless',
      detail: 'Este endpoint escribe en disco local y no es compatible con Vercel serverless.',
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    }

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Payload inválido' });
      return;
    }

    const { $schema_version, id, ingest_mode, created_at, title } = payload;
    if (!$schema_version || !id || !ingest_mode || !created_at || !title) {
      res.status(400).json({ error: 'Payload incompleto' });
      return;
    }

    const ingestDir = path.join(process.cwd(), 'ingesta');
    await fs.mkdir(ingestDir, { recursive: true });

    const ingestPath = path.join(ingestDir, `${id}.json`);
    await fs.writeFile(ingestPath, JSON.stringify(payload, null, 2), 'utf8');

    res.status(200).json({ ok: true, id, path: `ingesta/${id}.json` });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar la fuente', detail: err.message });
  }
}
