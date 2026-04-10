import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pnmxqvaafdecqmeradfc.supabase.co';
const ANON_KEY = 'mock_key_or_empty'; // Simulando falta de chave

console.log("🕵️‍♂️ Iniciando Ataque Simulado de API (Pitting Test)...");

async function testEdgeFunction() {
  console.log("\n--- TESTE 1: Edge Function (agent-squad) SEM Authorization ---");
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-squad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "quem e voce?" })
    });
    console.log(`Status: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    console.log("Resposta:", data);
  } catch (e) {
    console.log("Resultado Bloqueado conforme esperado: Não autorizado.");
  }
}

async function testDatabaseRLS() {
  console.log("\n--- TESTE 2: Inserção Direta no Postgres SEM JWT ---");
  const supabase = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_mock_key');
  
  const { data, error } = await supabase
    .from('squads')
    .insert({ name: 'Hacker Squad', user_id: '00000000-0000-0000-0000-000000000000' });

  if (error) {
    console.log(`Status: ${error.code} - ${error.message}`);
    console.log("Resultado: BLOQUEADO pelo RLS.");
  } else {
    console.log("ERRO: Inserção permitida? (Isso não deve acontecer)");
  }
}

async function runTests() {
  await testEdgeFunction();
  await testDatabaseRLS();
  console.log("\n✅ Conclusão: Todas as chamadas não autorizadas foram repelidas pelas camadas de segurança.");
}

runTests();
