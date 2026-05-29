# 🐂 BullFarmGame — Setup completo

Persistencia on-chain del juego BullFarm: toros, BFM, ranking — todo guardado en la blockchain. Imposible perder progreso.

---

## 📋 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    JUGADOR                              │
│  (World App con su wallet 0x...)                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ 1. Abre el juego, ve sus toros          
                 │ 2. Compra sobre → firma 1 tx            
                 │ 3. Cosecha → pide firma al backend      
                 ▼                                          
┌─────────────────────────────────────────────────────────┐
│            FRONTEND (GitHub Pages)                       │
│  https://andres2282.github.io/BullFarm-app/             │
│  Lee bulls[player] del contrato                          │
│  Llama a buyPackBFM/buyPackWLD/harvest                   │
└────────────┬────────────────────────────────────────────┘
             │                                              
             │ "Quiero cosechar"                             
             ▼                                              
┌─────────────────────────────────────────────────────────┐
│         BACKEND (Vercel Serverless GRATIS)               │
│  /api/sign-harvest.js                                    │
│  - Lee bulls[player] on-chain                            │
│  - Calcula: producción × tiempo                          │
│  - Firma con EIP-712                                     │
└────────────┬────────────────────────────────────────────┘
             │                                              
             │ Firma + amount                                
             ▼                                              
┌─────────────────────────────────────────────────────────┐
│            CONTRATO BullFarmGame                         │
│  Verifica firma → transfiere BFM al jugador              │
│  Guarda toros, cosechas, stats                           │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Paso a paso

### **PASO 1 — Desplegar BullFarmGame.sol en Remix** ⛓️

1. Ve a `remix.ethereum.org`
2. Nuevo archivo: `BullFarmGame.sol`
3. Pega el contenido de `BullFarmGame.sol`
4. Compile con Solidity **0.8.24**

5. **Crear nueva wallet para el SIGNER** (clave que firmará cosechas):
   - En MetaMask: "Add account" → "Add new account"
   - Anota la dirección: `0xSIGNER_ADDRESS...`
   - **Exporta la clave privada** (la usarás en Vercel)

6. Deploy con estos parámetros:
   ```
   _bfm:    0xa64bF359365C89CA4517381E1E74970d65c1B553
   _wld:    0x2cFc85d8E48F8EAB294be644d9E25C3030863003
   _dev:    0x3de83b386c983426547b3b42e50b810ab9a25deb
   _signer: 0xSIGNER_ADDRESS  ← la wallet nueva
   _owner:  0x3d3c7ab150b0414a8c9a1d2a802193349346a186
   ```

7. **GUARDA la dirección del contrato desplegado**:
   ```
   GAME_CONTRACT = 0x...........
   ```

### **PASO 2 — Cargar BFM al pool del juego** 💰

El contrato necesita BFM para pagar recompensas. Transfiere desde tu wallet:

1. En World App o Remix, transfiere ~10,000,000 BFM al contrato:
   ```
   BFM.transfer(GAME_CONTRACT, 10000000000000000000000000)  // 10M con 18 decimales
   ```

2. Verifica: `BullFarmGame.poolBalance()` debe mostrar 10M BFM

### **PASO 3 — Desplegar backend en Vercel** 🚀

1. Crea cuenta en `vercel.com` (gratis)
2. Instala CLI:
   ```bash
   npm install -g vercel
   ```

3. En tu computadora, ve a la carpeta `backend/`:
   ```bash
   cd backend
   npm install
   ```

4. **Edita `api/sign-harvest.js`**:
   ```javascript
   const GAME_CONTRACT = '0xTU_CONTRATO_DESPLEGADO_AQUI';
   ```

5. Despliega:
   ```bash
   vercel
   ```
   Sigue las instrucciones. Cuando termine, anota la URL:
   ```
   https://bullfarm-backend.vercel.app/api/sign-harvest
   ```

6. **Configura la clave privada del SIGNER**:
   - Ve a `vercel.com/dashboard` → tu proyecto → **Settings → Environment Variables**
   - Add new:
     - Key: `SIGNER_PRIVATE_KEY`
     - Value: `0xTU_CLAVE_PRIVADA_DEL_SIGNER` (sin 0x al inicio si es como hex)
     - Apply to: Production, Preview, Development
   - Save
   - Redeploy:
     ```bash
     vercel --prod
     ```

### **PASO 4 — Conectar el frontend al contrato y backend** 🔌

En el HTML (`bull_token_protocol.html`), agregar estas constantes al bloque JS principal:

```javascript
const GAME_CONTRACT = '0xTU_CONTRATO_AQUI';
const HARVEST_API = 'https://bullfarm-backend.vercel.app/api/sign-harvest';
```

Las funciones `buyPack()`, `harvest()`, etc. ya están en el HTML — solo necesitan apuntar al `GAME_CONTRACT` real.

### **PASO 5 — Configurar Developer Portal de Worldcoin** ⚙️

1. Ve a `developer.worldcoin.org`
2. Tu app → **Configuration → Advanced → Smart Contracts**
3. Agrega:
   - `0xa64bF...` (BFM token)
   - `0x2cFc8...` (WLD token)
   - `0x091AD...` (SwapRouter02 si usas swap)
   - `0xTU_GAME_CONTRACT` ← el nuevo
4. **Save**

### **PASO 6 — Subir HTML a GitHub Pages** 📤

1. Crea repo `BullFarm-app`
2. Sube el HTML como `index.html`
3. Activa GitHub Pages
4. Actualiza URL en Developer Portal

---

## 🧪 Testing

Antes de invitar usuarios:

1. **Compra un sobre BFM** con tu wallet
2. **Verifica que el contrato registró el toro**: `getPlayerBulls(tuWallet)`
3. **Espera 1 hora**
4. **Pide cosecha**: el backend debe firmar
5. **Cosecha**: debe llegar BFM a tu wallet
6. **Verifica stats**: `playerStats(tuWallet)`

---

## 🛡️ Seguridad

### **Si la clave SIGNER se filtra:**
1. Llamar `setSigner(nuevaWallet)` desde el owner
2. Actualizar `SIGNER_PRIVATE_KEY` en Vercel
3. La clave vieja queda inútil

### **Si descubres bug:**
1. Llamar `pause()` desde el owner
2. Nadie puede comprar/cosechar mientras está pausado
3. Diagnóstica, decide qué hacer

### **Si el pool se vacía:**
- Las cosechas fallarán con `InsufficientPoolBalance`
- Transferir más BFM al contrato lo arregla

---

## 💰 Costos estimados

| Acción | Gas en World Chain |
|---|---|
| Deploy contrato | ~$3 USD (una vez) |
| Comprar sobre BFM | ~$0.10 |
| Comprar sobre WLD | ~$0.08 |
| Cosechar | ~$0.10 |
| Fusionar toros | ~$0.05 |
| Vercel (backend) | GRATIS (hasta 100k req/mes) |

---

## 📞 Si algo falla

1. **El swap no funciona** → Revisar Developer Portal Smart Contracts allowlist
2. **La cosecha devuelve InvalidSignature** → Backend está firmando con clave incorrecta
3. **buyPack falla con `ERC20: transfer amount exceeds allowance`** → El jugador no hizo approve primero
4. **`InsufficientPoolBalance` al cosechar** → Transferir más BFM al contrato

Soporte: revisa eventos en `worldscan.org/address/0xTU_GAME_CONTRACT`
