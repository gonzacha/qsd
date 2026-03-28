import fs from 'fs/promises';
import path from 'path';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const notesDir = path.join(process.cwd(), 'notas');
  let entries = [];

  try {
    entries = await fs.readdir(notesDir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      res.status(200).json({ total: 0, items: [] });
      return;
    }
    res.status(500).json({ error: 'Failed to read notes' });
    return;
  }

  const items = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort();

  res.status(200).json({ total: items.length, items });
}
