// api/generate-pack.js
// Endpoint que genera las rarezas de un sobre según sus probabilidades.
// El frontend usa estas rarezas para llamar a buyPackWithPermit2BFM/WLD.

// Probabilidades por sobre (suma = 100% por sobre)
// Cada array representa las prob de las 10 rarezas (0=Común ... 9=Supremo)
// qty = cantidad de toros que da el sobre
const PACK_PROBABILITIES = {
  // Sobre 0: Común — paga 1500 BFM
  '0': { qty: 1, probs: [80, 20, 0, 0, 0, 0, 0, 0, 0, 0] },
  // Sobre 1: Rural — paga 5000 BFM
  '1': { qty: 1, probs: [5, 70, 25, 0, 0, 0, 0, 0, 0, 0] },
  // Sobre 2: Bravo — paga 15000 BFM
  '2': { qty: 1, probs: [0, 10, 60, 30, 0, 0, 0, 0, 0, 0] },
  // Sobre 3: Épico — paga 40000 BFM
  '3': { qty: 1, probs: [0, 0, 15, 50, 35, 0, 0, 0, 0, 0] },
  // Sobre 4: Alfa — paga 15 WLD
  '4': { qty: 1, probs: [0, 0, 0, 15, 55, 30, 0, 0, 0, 0] },
  // Sobre 5: Legend — paga 40 WLD
  '5': { qty: 1, probs: [0, 0, 0, 0, 15, 50, 35, 0, 0, 0] },
  // Sobre 6: Divino — paga 100 WLD
  '6': { qty: 1, probs: [0, 0, 0, 0, 0, 15, 50, 35, 0, 0] },
  // Sobre 7: Supremo — paga 250 WLD
  '7': { qty: 1, probs: [0, 0, 0, 0, 0, 0, 15, 55, 30, 0] },
  // Sobre 8: God — paga 600 WLD
  '8': { qty: 1, probs: [0, 0, 0, 0, 0, 0, 0, 15, 55, 30] }
};

function pickRarity(probs) {
  // Aplicamos randomness segura del servidor
  const r = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return 0; // fallback
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { packId } = req.body;

    if (packId === undefined || packId === null) {
      return res.status(400).json({ error: 'Missing packId' });
    }

    const cfg = PACK_PROBABILITIES[String(packId)];
    if (!cfg) {
      return res.status(400).json({ error: 'Invalid packId' });
    }

    // Generar rarezas
    const rarities = [];
    for (let i = 0; i < cfg.qty; i++) {
      rarities.push(pickRarity(cfg.probs));
    }

    return res.status(200).json({
      packId: String(packId),
      rarities: rarities,
      quantity: cfg.qty
    });
  } catch (e) {
    console.error('generate-pack error:', e);
    return res.status(500).json({ error: e.message });
  }
}
