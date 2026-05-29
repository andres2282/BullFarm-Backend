// api/sign-harvest.js
// Vercel Serverless Function que firma cosechas con EIP-712.
// El backend calcula cuánto BFM merece el jugador según sus toros on-chain
// y firma para que el contrato lo deje cosechar.

import { ethers } from 'ethers';

// ============= CONFIGURACIÓN =============
// Estos valores DEBEN coincidir con el contrato BullFarmGame.sol desplegado.
const CHAIN_ID = 480;                  // World Chain
const RPC_URL = 'https://worldchain-mainnet.g.alchemy.com/public';

// CONTRATO REAL DESPLEGADO en World Chain:
const GAME_CONTRACT = '0xb20996C8227643bff18c2B2cB8F712329AF3133a';

// Producción de BFM por toro por día (índices = rarezas 0-9)
const DAILY_PRODUCTION = [
  5,       // 0 - Común
  35,      // 1 - Rural
  110,     // 2 - Bravo
  320,     // 3 - Hierro
  850,     // 4 - Salvaje
  2200,    // 5 - Alfa
  5500,    // 6 - Legendario
  13000,   // 7 - Celestial
  30000,   // 8 - Titán
  70000    // 9 - Supremo
];

// Validez de la firma (5 minutos)
const SIGNATURE_VALIDITY_SECONDS = 300;

// ABI mínimo para leer toros del jugador
const GAME_ABI = [
  'function getPlayerBulls(address player) view returns (uint256[10])',
  'function nonces(address player) view returns (uint256)',
  'function totalHarvested(address player) view returns (uint256)'
];

// ============= HANDLER =============
export default async function handler(req, res) {
  // CORS para que el frontend pueda llamar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { player, lastHarvestTimestamp } = req.body;

    // Validar input
    if (!player || !ethers.isAddress(player)) {
      return res.status(400).json({ error: 'Invalid player address' });
    }

    // Cargar clave del signer desde variable de entorno (SECRETO)
    const SIGNER_KEY = process.env.SIGNER_PRIVATE_KEY;
    if (!SIGNER_KEY) {
      return res.status(500).json({ error: 'Signer key not configured' });
    }

    // Leer toros del jugador on-chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const game = new ethers.Contract(GAME_CONTRACT, GAME_ABI, provider);
    const bulls = await game.getPlayerBulls(player);
    const currentNonce = await game.nonces(player);

    // Calcular producción diaria total
    let dailyTotal = 0n;
    for (let i = 0; i < 10; i++) {
      dailyTotal += BigInt(bulls[i]) * BigInt(DAILY_PRODUCTION[i]);
    }

    // Si no tiene toros, no hay nada que cosechar
    if (dailyTotal === 0n) {
      return res.status(400).json({ error: 'No bulls to harvest from' });
    }

    // Calcular tiempo desde última cosecha
    const now = Math.floor(Date.now() / 1000);
    const last = parseInt(lastHarvestTimestamp || 0);
    if (last >= now) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    const secondsElapsed = BigInt(now - last);
    const SECONDS_PER_DAY = 86400n;

    // Cálculo: amount = dailyTotal × (secondsElapsed / 86400)
    // Multiplicamos por 10^18 (decimales del token) y dividimos por SECONDS_PER_DAY
    const amount = (dailyTotal * secondsElapsed * (10n ** 18n)) / SECONDS_PER_DAY;

    if (amount === 0n) {
      return res.status(400).json({ error: 'Amount too small' });
    }

    // Cap máximo de 7 días por cosecha (anti-explotación)
    const MAX_AMOUNT = dailyTotal * 7n * (10n ** 18n);
    const finalAmount = amount > MAX_AMOUNT ? MAX_AMOUNT : amount;

    // ============= FIRMAR EIP-712 =============
    const deadline = now + SIGNATURE_VALIDITY_SECONDS;

    const domain = {
      name: 'BullFarmGame',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: GAME_CONTRACT
    };

    const types = {
      Harvest: [
        { name: 'player',   type: 'address' },
        { name: 'amount',   type: 'uint256' },
        { name: 'nonce',    type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    const value = {
      player: player,
      amount: finalAmount.toString(),
      nonce: currentNonce.toString(),
      deadline: deadline
    };

    const wallet = new ethers.Wallet(SIGNER_KEY);
    const signature = await wallet.signTypedData(domain, types, value);

    return res.status(200).json({
      amount: finalAmount.toString(),
      amountReadable: (Number(finalAmount) / 1e18).toFixed(4),
      deadline: deadline,
      nonce: currentNonce.toString(),
      signature: signature,
      bulls: bulls.map(b => b.toString()),
      dailyProduction: dailyTotal.toString()
    });
  } catch (e) {
    console.error('sign-harvest error:', e);
    return res.status(500).json({ error: e.message });
  }
}
