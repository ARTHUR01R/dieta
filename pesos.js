// Função serverless da Vercel: guarda pesos e configurações no Upstash Redis.
// Variáveis de ambiente: SENHA, e UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// (ou KV_REST_API_URL / KV_REST_API_TOKEN), criadas ao conectar o Upstash ao projeto.

const URL_REDIS = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const CAMPOS = ["modo","sexo","idade","altura","atv","bf","ajuste","semanal","prot","gord","semanas","inicio"];

async function redis(cmd) {
  const r = await fetch(URL_REDIS, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.SENHA || !URL_REDIS || !TOKEN) {
    return res.status(500).json({ erro: "Configuração faltando" });
  }
  if (req.headers["x-senha"] !== process.env.SENHA) {
    return res.status(401).json({ erro: "senha" });
  }

  const config = req.query && req.query.k === "config";
  const chave = config ? "config" : "pesos";

  try {
    if (req.method === "GET") {
      const v = await redis(["GET", chave]);
      return res.status(200).json(v ? JSON.parse(v) : config ? {} : []);
    }
    if (req.method === "PUT") {
      let limpo;
      if (config) {
        const b = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
        limpo = {};
        CAMPOS.forEach((k) => {
          if (b[k] !== undefined) limpo[k] = String(b[k]).slice(0, 20);
        });
      } else {
        const arr = Array.isArray(req.body) ? req.body : [];
        limpo = arr
          .filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.d) && x.p > 20 && x.p < 400)
          .map((x) => ({ d: x.d, p: Number(x.p) }));
      }
      await redis(["SET", chave, JSON.stringify(limpo)]);
      return res.status(200).json(limpo);
    }
    return res.status(405).json({ erro: "método" });
  } catch (e) {
    return res.status(500).json({ erro: "falha" });
  }
};
