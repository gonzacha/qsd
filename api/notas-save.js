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
      res.status(500).json({ error: 'Payload inválido' });
      return;
    }

    const { $schema_version, id, created_at, updated_at, editorial_content } = payload;
    if (!$schema_version || !id || !created_at || !updated_at || !editorial_content) {
      res.status(500).json({ error: 'Payload incompleto' });
      return;
    }

    const notesDir = path.join(process.cwd(), 'notas');
    await fs.mkdir(notesDir, { recursive: true });

    const notePath = path.join(notesDir, `${id}.json`);
    await fs.writeFile(notePath, JSON.stringify(payload, null, 2), 'utf8');

    res.status(200).json({ ok: true, id, path: `notas/${id}.json` });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar el borrador', detail: err.message });
  }
}
