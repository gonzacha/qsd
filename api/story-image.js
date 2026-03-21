import '../lib/resolve-story-image.js';

export const config = { runtime: 'edge' };
const resolveStoryImage = globalThis.resolveStoryImage || (async () => '');

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('u') || '';

  if (!url) {
    return new Response(JSON.stringify({ image: '' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ image: '' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ image: '' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const image = await resolveStoryImage({ url });
  return new Response(JSON.stringify({ image: image || '' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
