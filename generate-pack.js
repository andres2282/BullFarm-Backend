// Endpoint que genera rarezas según probabilidades de cada sobre.

const PACK_PROBABILITIES = {
  '0': { qty: 3, probs: [70, 25, 5, 0, 0, 0, 0, 0, 0, 0] },
  '1': { qty: 3, probs: [40, 45, 13, 2, 0, 0, 0, 0, 0, 0] },
  '2': { qty: 3, probs: [15, 40, 35, 9, 1, 0, 0, 0, 0, 0] },
  '3': { qty: 3, probs: [5, 20, 40, 30, 4, 1, 0, 0, 0, 0] },
  '4': { qty: 4, probs: [0, 10, 30, 40, 15, 4, 1, 0, 0, 0] },
  '5': { qty: 4, probs: [0, 0, 15, 35, 35, 12, 2, 1, 0, 0] },
  '6': { qty: 5, probs: [0, 0, 0, 20, 40, 25, 12, 2, 1, 0] },
  '7': { qty: 5, probs: [0, 0, 0, 0, 25, 40, 25, 8, 1.5, 0.5] },
  '8': { qty: 6, probs: [0, 0, 0, 0, 0, 25, 35, 25, 12, 3] }
};

function pickRarity(probs) {
  const r = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { packId } = req.body;
    if (packId === undefined || packId === null) {
      return res.status(400).json({ error: 'Missing packId' });
    }

    const cfg = PACK_PROBABILITIES[String(packId)];
    if (!cfg) {
      return res.status(400).json({ error: 'Invalid packId' });
    }

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
