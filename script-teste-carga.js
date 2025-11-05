/*
 * SCRIPT K6 - TESTE DE CENÁRIO AUTENTICADO
 *
 * Baseado no OpenAPI da Aplicação de Planejamento de Viagens.
 * Simula um fluxo de usuário "read-heavy" (leitura pesada) após o login.
 *
 * COMO RODAR: k6 run script-teste-carga.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// --- CONFIGURAÇÃO DA URL BASE ---
const BASE_URL = 'http://localhost:8080'; // URL do seu backend Go

// --- MÉTRICAS CUSTOMIZADAS (PERFEITO PARA SEU TCC) ---
// Vamos medir o TTFB (Time To First Byte) para cada endpoint
const mTTFB_Profile = new Trend('ttfb_get_profile');
const mTTFB_ListGroups = new Trend('ttfb_get_groups');
const mTTFB_ViewGroup = new Trend('ttfb_get_group_details');
const mErrorRate = new Rate('error_rate');

// --- OPÇÕES DE TESTE (TESTE DE CARGA) ---
export const options = {
    stages: [
        { duration: '30s', target: 25 }, // Rampa de 0 a 25 usuários em 30s
        { duration: '1m', target: 25 },  // Mantém 25 usuários por 1 minuto
        { duration: '15s', target: 0 },  // Rampa de descida
    ],
    thresholds: {
        'http_req_duration': ['p(95)<1000'], // Latência geral p95 < 1 segundo
        'error_rate': ['rate==0'],           // 0% de taxa de erro
        // Metas (SLOs) por endpoint (TTFB)
        'ttfb_get_profile': ['p(95)<500'],
        'ttfb_get_groups': ['p(95)<800'],
        'ttfb_get_group_details': ['p(95)<600'],
    },
};

// --- FUNÇÃO SETUP (Roda 1x ANTES do teste) ---
// Perfeita para fazer login e obter dados de teste
export function setup() {
    console.log('Executando setup: Autenticando e criando dados de teste...');

    // !!! MUDE AQUI PARA UM USUÁRIO DE TESTE REAL DA SUA BASE !!!
    const loginPayload = JSON.stringify({
        email: 'felipe@email.com', // E-mail de teste
        password: 'FlF03052002',         // Senha de teste
    });
    const loginParams = { headers: { 'Content-Type': 'application/json' } };

    // 1. Fazer Login
    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

    // Verifica se o login falhou
    if (loginRes.status !== 200) {
        throw new Error('Setup falhou: Não foi possível fazer login. Verifique as credenciais.');
    }

    // Extrai o token da resposta
    const authToken = loginRes.json('token');
    console.log('Setup: Login realizado, token obtido.');

    // Prepara os headers de autenticação para as próximas chamadas
    const authParams = {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        },
    };

    // 2. Criar um Grupo de Teste (para termos um ID válido para testar)
    // (Baseado no schema TravelGroupCreateRequest)
    const createGroupPayload = JSON.stringify({
        name: 'Grupo de Teste k6',
        description: 'Grupo gerado automaticamente pelo k6 para teste de carga',
        start_date: '2025-01-01',
        end_date: '2025-01-10',
    });

    const createGroupRes = http.post(`${BASE_URL}/groups`, createGroupPayload, authParams);

    if (createGroupRes.status !== 201) {
        throw new Error('Setup falhou: Não foi possível criar o grupo de teste.');
    }

    // Extrai o ID do grupo recém-criado
    const testGroupId = createGroupRes.json('id');
    console.log(`Setup: Grupo de teste (ID: ${testGroupId}) criado.`);

    // Retorna os dados que os VUs (default) irão usar
    return { authToken: authToken, testGroupId: testGroupId };
}

// --- FUNÇÃO DEFAULT (Roda em loop pelos VUs) ---
// 'data' é o objeto retornado pelo setup()
export default function (data) {
    // Prepara os headers de autenticação para este VU
    const authParams = {
        headers: {
            'Authorization': `Bearer ${data.authToken}`,
        },
    };

    // --- Cenário 1: Ver Perfil (GET /profile) ---
    group('Cenário: GET /profile', function () {
        const res = http.get(`${BASE_URL}/profile`, authParams);

        const checkRes = check(res, {
            'GET /profile status 200': (r) => r.status === 200,
        });
        mErrorRate.add(!checkRes); // Adiciona 1 se o check falhar
        mTTFB_Profile.add(res.timings.waiting); // Adiciona TTFB
    });

    sleep(1); // Simula usuário "pensando" por 1s

    // --- Cenário 2: Listar Grupos (GET /groups) ---
    group('Cenário: GET /groups', function () {
        const res = http.get(`${BASE_URL}/groups`, authParams);

        const checkRes = check(res, {
            'GET /groups status 200': (r) => r.status === 200,
        });
        mErrorRate.add(!checkRes);
        mTTFB_ListGroups.add(res.timings.waiting);
    });

    sleep(1); // Simula usuário "pensando" por 1s

    // --- Cenário 3: Ver Detalhes do Grupo (GET /groups/{id}) ---
    group('Cenário: GET /groups/{id}', function () {
        // Usa o ID do grupo que criamos no setup
        const res = http.get(`${BASE_URL}/groups/${data.testGroupId}`, authParams);

        const checkRes = check(res, {
            'GET /groups/{id} status 200': (r) => r.status === 200,
            'GET /groups/{id} ID correto': (r) => r.json('id') == data.testGroupId,
        });
        mErrorRate.add(!checkRes);
        mTTFB_ViewGroup.add(res.timings.waiting);
    });

    sleep(1); // Simula usuário "pensando" por 1s
}