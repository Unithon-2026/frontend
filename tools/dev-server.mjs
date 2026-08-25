#!/usr/bin/env node
/**
 * 개발용 정적 서버 + API 프록시. 의존성 없음 (Node 18+).
 *
 *   node tools/dev-server.mjs
 *   → http://localhost:3000/prototype/index.html
 *
 * 백엔드 SecurityConfig 에 CORS 설정이 없어서, 브라우저가 3000 → 8080 직접 호출을
 * 차단합니다. 이 서버는 /api/* 요청을 백엔드로 대신 전달(프록시)하므로
 * 브라우저 입장에서는 전부 같은 오리진이 되고, CORS 자체가 발생하지 않습니다.
 * 백엔드를 고치지 않고 프론트만으로 해결하는 방법입니다.
 *
 * 환경변수:
 *   PORT=3000                        이 서버가 뜰 포트
 *   BACKEND=http://localhost:8080    프록시 대상 백엔드
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const PORT = Number(process.env.PORT || 3000);
const BACKEND = (process.env.BACKEND || 'http://localhost:8080').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.yaml': 'text/yaml; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8'
};

const server = createServer(async (req, res) => {
  // ── /api/* → 백엔드로 프록시 ────────────────────────────────────────────
  if (req.url.startsWith('/api/')) {
    const target = BACKEND + req.url;
    try {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
      const upstream = await fetch(target, {
        method: req.method,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(text);
    } catch (err) {
      // 백엔드가 안 떠 있으면 프로토타입이 폴백으로 넘어가도록 그대로 실패시킨다.
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        success: false, code: 'COMMON500',
        message: `백엔드(${BACKEND})에 연결하지 못했습니다: ${err.message}`, data: null
      }));
    }
  }

  // ── 정적 파일 ───────────────────────────────────────────────────────────
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const path = join(ROOT, rel === '/' ? 'prototype/index.html' : rel);
  if (!path.startsWith(ROOT)) { res.writeHead(403); return res.end(); }   // 경로 탈출 차단
  try {
    const buf = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 ' + rel);
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`정적 파일  http://localhost:${PORT}/prototype/index.html`);
  console.log(`API 프록시 /api/*  →  ${BACKEND}`);
});
