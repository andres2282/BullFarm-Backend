// api/sign-harvest.js
// Vercel Serverless Function que firma cosechas con EIP-712.
// V2: Compatible con BullFarmGameV2 (Permit2 + harvestSigned)
// El backend calcula cuánto BFM merece el jugador según sus toros on-chain
// y firma para que el contrato lo deje cosechar.

import { ethers } from 'ethers';

// ============= CONFIGURACIÓN =============
const CHAIN_ID = 480;                  // World Chain
const RPC_URL = 'https://worldchain-mainnet.g.alchemy.com/public';

// CONTRATO V2 (Permit2) DESPLEGADO en World Chain:
const GAME_CONTRACT = '0x6D039549d3C7872279F197Ed7060Df7593B4E4f1';

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

// ABI V2 - usa getPlayerStats que devuelve lastHarvestNonce
const GAME_ABI = [
  'function getPlayerBulls(address player) view returns (uint256[10])',
  'function getPlayerStats(address player) view returns (uint256 totalHarvested, uint256 totalSpent, uint256 packsOpened, uint256 fusionsDone, uint256 lastHarvestNonce)'
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

    // Leer toros y stats del jugador on-chain (V2)
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const game = new ethers.Contract(GAME_CONTRACT, GAME_ABI, provider);
    const bulls = await game.getPlayerBulls(player);
    const stats = await game.getPlayerStats(player);
    // lastHarvestNonce está en stats[4]
    const currentNonce = stats[4];
    // Nuevo nonce = current + 1 (anti-replay V2)
    const nextNonce = BigInt(currentNonce) + 1n;

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
    const amount = (dailyTotal * secondsElapsed * (10n ** 18n)) / SECONDS_PER_DAY;

    if (amount === 0n) {
      return res.status(400).json({ error: 'Amount too small' });
    }

    // Cap máximo de 7 días por cosecha (anti-explotación)
    const MAX_AMOUNT = dailyTotal * 7n * (10n ** 18n);
    const finalAmount = amount > MAX_AMOUNT ? MAX_AMOUNT : amount;

    // ============= FIRMAR EIP-712 (V2 - version "2") =============
    const deadline = now + SIGNATURE_VALIDITY_SECONDS;

    const domain = {
      name: 'BullFarmGame',
      version: '2',                    // V2 actualizado
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
      nonce: nextNonce.toString(),
      deadline: deadline
    };

    const wallet = new ethers.Wallet(SIGNER_KEY);
    const signature = await wallet.signTypedData(domain, types, value);

    return res.status(200).json({
      amount: finalAmount.toString(),
      amountReadable: (Number(finalAmount) / 1e18).toFixed(4),
      deadline: deadline,
      nonce: nextNonce.toString(),
      signature: signature,
      bulls: bulls.map(b => b.toString()),
      dailyProduction: dailyTotal.toString()
    });
  } catch (e) {
    console.error('sign-harvest error:', e);
    return res.status(500).json({ error: e.message });
  }
}
