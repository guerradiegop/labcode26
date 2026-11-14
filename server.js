// Servidor local de demonstração. Não exponha publicamente sem autenticação e HTTPS.
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "ocorrencias.json");
const PORT = Number(process.env.PORT) || 3000;
const TIPOS = new Set(["Desmatamento ilegal", "Queimada", "Extração ilegal de madeira", "Invasão de área protegida", "Outro"]);
const PUBLIC = { "/": "index.html", "/index.html": "index.html", "/script.js": "script.js", "/style.css": "style.css", "/logo.png": "logo.png" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png" };

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n", { flag: "wx" });
function listar() {
  const content = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!Array.isArray(content)) throw new Error("Arquivo JSON inválido");
  return content;
}
function gravar(lista) {
  const temp = path.join(DATA_DIR, ".ocorrencias-" + process.pid + "-" + crypto.randomUUID() + ".tmp");
  try {
    fs.writeFileSync(temp, JSON.stringify(lista, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    fs.renameSync(temp, DATA_FILE);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function responder(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(obj));
}
function texto(v, max) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
function coordenada(v, min, max) {
  if (v === null || v === "" || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error("Coordenada fora da região aproximada de Joinville");
  return v;
}
function validar(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("Dados inválidos");
  const tipo = texto(d.tipo, 80), cidade = texto(d.cidade, 80), uf = texto(d.uf, 2);
  const endereco = texto(d.endereco, 200), desc = texto(d.desc, 1000), data = texto(d.data, 10);
  if (!TIPOS.has(tipo) || cidade !== "Joinville" || uf !== "SC") throw new Error("Informe um tipo válido e o município Joinville/SC");
  if (endereco.length < 5 || desc.length < 10) throw new Error("Preencha endereço e descrição");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data + "T12:00:00Z")) ||
      new Date(data + "T12:00:00Z").toISOString().slice(0, 10) !== data || data > new Date().toISOString().slice(0, 10)) {
    throw new Error("Data inválida ou futura");
  }
  return { tipo, cidade: "Joinville", uf: "SC", endereco, local: texto(d.local, 120), data, desc,
    anonima: d.anonima !== false, contato: d.anonima === false ? texto(d.contato, 120) : "",
    lat: coordenada(d.lat, -26.65, -25.9), lng: coordenada(d.lng, -49.45, -48.55) };
}
function corpo(req) {
  return new Promise((resolve, reject) => {
    let str = ""; let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 65536) { reject(new Error("Corpo muito grande")); req.destroy(); return; }
      str += chunk;
    });
    req.on("end", () => { try { resolve(JSON.parse(str)); } catch { reject(new Error("JSON inválido")); } });
    req.on("error", reject);
  });
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "GET" && url.pathname === "/api/ocorrencias") return responder(res, 200, listar());
      if (req.method === "POST" && url.pathname === "/api/ocorrencias") {
        const d = validar(await corpo(req));
        const lista = listar();
        const reg = { id: crypto.randomUUID(), protocolo: "DES-" + new Date().getFullYear() + "-" + crypto.randomBytes(5).toString("hex").toUpperCase(),
          ...d, criada: new Date().toISOString(), status: "Registrada" };
        lista.unshift(reg); gravar(lista);
        return responder(res, 201, reg);
      }
      if (req.method === "POST" && url.pathname === "/api/importar") {
        const entrada = await corpo(req);
        if (!Array.isArray(entrada) || entrada.length > 100) return responder(res, 400, { erro: "Envie até 100 ocorrências por lote" });
        const lista = listar(); let importadas = 0;
        const vistos = new Set(lista.map(r => r.protocolo));
        for (const original of entrada) {
          if (!original || typeof original !== "object") continue;
          const protocolo = texto(original.protocolo, 60);
          if (!protocolo || vistos.has(protocolo)) continue;
          // Preserva registros históricos de outros municípios; novas denúncias são apenas Joinville.
          const reg = { ...original, id: crypto.randomUUID(), protocolo, origem: "localStorage" };
          lista.push(reg); vistos.add(protocolo); importadas++;
        }
        if (importadas) gravar(lista);
        return responder(res, 200, { importadas });
      }
      if (req.method === "DELETE" && url.pathname === "/api/ocorrencias") {
        gravar([]); return responder(res, 200, { removidas: "todas" });
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/ocorrencias/")) {
        const id = decodeURIComponent(url.pathname.slice("/api/ocorrencias/".length));
        const lista = listar(), nova = lista.filter(r => r.id !== id && r.protocolo !== id);
        if (nova.length === lista.length) return responder(res, 404, { erro: "Ocorrência não encontrada" });
        gravar(nova); return responder(res, 200, { removidas: lista.length - nova.length });
      }
      return responder(res, 404, { erro: "Rota não encontrada" });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return responder(res, 405, { erro: "Método não permitido" });
    const file = PUBLIC[url.pathname];
    if (!file) return responder(res, 404, { erro: "Arquivo não encontrado" });
    const p = path.join(ROOT, file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)], "X-Content-Type-Options": "nosniff" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    const invalido = /inválid|Informe|Preencha|fora|grande|futura|até 100/i.test(e.message);
    console.error(e);
    responder(res, invalido ? 400 : 500, { erro: invalido ? e.message : "Erro interno ao acessar ocorrências" });
  }
}).listen(PORT, "127.0.0.1", () => console.log("Floresta em Pé: http://localhost:" + PORT));
