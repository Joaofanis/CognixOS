// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Model waterfall — tries in order, skips on rate-limit/error
const MODELS = [
      "google/gemini-2.5-flash-lite",
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.3-70b-instruct:free",
      "arcee-ai/trinity-large-preview:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safe JSON parsing
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brainId } = body as { brainId: unknown };

    // Validate brainId — must be a UUID
    if (!brainId || typeof brainId !== "string" || !UUID_REGEX.test(brainId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing brainId. Must be a valid UUID." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get brain info and verify ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("name, type, description, user_id")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (brain.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get brain texts for context
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content")
      .eq("brain_id", brainId)
      .order("created_at", { ascending: false })
      .limit(30);

    // Larger context for person_clone
    const MAX_CONTEXT = brain.type === "person_clone" ? 40000 : 20000;
    let context = texts?.map((t) => t.content).join("\n\n---\n\n") || "";
    if (context.length > MAX_CONTEXT) {
      context = context.slice(0, MAX_CONTEXT) + "\n\n[...truncado]";
    }

    if (!context.trim()) {
      return new Response(JSON.stringify({ error: "Esse cérebro não tem textos ainda. Adicione conteúdo na aba Fontes primeiro." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing brain analysis for enrichment (if person_clone)
    let analysisEnrichment = "";
    if (brain.type === "person_clone") {
      const { data: analysis } = await supabase
        .from("brain_analysis")
        .select("communication_style, voice_patterns, signature_phrases, skills, personality_traits")
        .eq("brain_id", brainId)
        .single();

      if (analysis) {
        const parts: string[] = [];
        if (analysis.personality_traits && Object.keys(analysis.personality_traits).length > 0) {
          const pt = analysis.personality_traits as Record<string, number>;
          parts.push(`TRAÇOS DE PERSONALIDADE (escala 0-10):\n${Object.entries(pt).map(([k,v]) => `  - ${k}: ${v}/10`).join("\n")}`);
        }
        if (analysis.communication_style && Object.keys(analysis.communication_style).length > 0) {
          const cs = analysis.communication_style as Record<string, number>;
          parts.push(`ESTILO DE COMUNICAÇÃO (escala 0-10):\n${Object.entries(cs).map(([k,v]) => `  - ${k}: ${v}/10`).join("\n")}`);
        }
        if (analysis.voice_patterns && typeof analysis.voice_patterns === "object") {
          const vp = analysis.voice_patterns as Record<string, unknown>;
          const vpStr = Object.entries(vp)
            .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
          parts.push(`PADRÕES DE VOZ E ESCRITA:\n${vpStr}`);
        }
        if (Array.isArray(analysis.signature_phrases) && analysis.signature_phrases.length > 0) {
          parts.push(`FRASES CARACTERÍSTICAS (use como exemplos few-shot):\n${(analysis.signature_phrases as string[]).map(p => `  "${p}"`).join("\n")}`);
        }
        if (analysis.skills && Object.keys(analysis.skills).length > 0) {
          const sk = analysis.skills as Record<string, number>;
          parts.push(`HABILIDADES IDENTIFICADAS:\n${Object.entries(sk).map(([k,v]) => `  - ${k}: ${v}/10`).join("\n")}`);
        }
        if (parts.length > 0) {
          analysisEnrichment = `\n\n== PERFIL ANALÍTICO DO CLONE (gerado por análise de IA) ==\n${parts.join("\n\n")}`;
        }
      }

      // Also get signature quotes from brain_quotes
      const { data: quotes } = await supabase
        .from("brain_quotes")
        .select("quote, context")
        .eq("brain_id", brainId)
        .limit(20);

      if (quotes && quotes.length > 0) {
        const quotesStr = quotes.map(q => `  "${q.quote}"${q.context ? ` [${q.context}]` : ""}`).join("\n");
        analysisEnrichment += `\n\nBANCO DE FALAS E FRASES (use na seção de exemplos do prompt):\n${quotesStr}`;
      }
    }

    const isPersonClone = brain.type === "person_clone";

    let metaPrompt: string;

    if (isPersonClone) {
      metaPrompt = `Você é um engenheiro de prompts de elite especializado em CLONAGEM COGNITIVA de pessoas reais. Sua tarefa é analisar os textos de "${brain.name}" e gerar um System Prompt do tipo SYSTEM ARCHITECTURE — não uma biografia narrativa, mas um SISTEMA OPERACIONAL que replica como esta pessoa PENSA, DECIDE e SE EXPRESSA.

IMPORTANTE: Este é um prompt de IMPRINT COGNITIVO. O objetivo não é descrever a pessoa, é REPLICAR sua estrutura mental. O prompt gerado deve funcionar como um manual de operação para qualquer IA se tornar indistinguível desta pessoa.

## PRIORIDADE DAS SEÇÕES (do mais ao menos impactante)
1. Padrões de Pensamento e Heurísticas de Decisão
2. Exemplos Few-Shot reais
3. Reações Padrão contextuais
4. Estilo de Comunicação e ritmo
5. Vocabulário Assinatura

## INSTRUÇÕES DE EXTRAÇÃO
Antes de escrever o prompt, EXTRAIA dos textos:
• Padrões recorrentes de argumentação (como a pessoa constrói um raciocínio)
• Metáforas e analogias preferidas (de quais domínios vêm: construção, música, games, etc.)
• Estrutura de explicação (começa pelo problema? pelo princípio? pela história?)
• Perguntas retóricas que usa para engajar
• Heurísticas de decisão implícitas (regras práticas que a pessoa segue)
• Contradições ou nuances no pensamento

## O SYSTEM PROMPT GERADO DEVE CONTER TODAS ESTAS SEÇÕES, NESTA ORDEM:

### 1. 🧠 IDENTIDADE CENTRAL (IMUTÁVEL)
Quem a pessoa é. Como se posiciona no mundo. Qual sua missão. O que a diferencia.
NÃO use adjetivos genéricos. Use descrições concretas extraídas dos textos.

### 2. 🧬 TRAÇOS COGNITIVOS
Liste os traços cognitivos dominantes desta pessoa (mínimo 5). Exemplos:
• simplifica ideias complexas
• desafia premissas da pergunta
• prefere princípios antes de táticas
• usa analogias para ensinar
• conecta tecnologia com comportamento humano
Extraia APENAS traços observáveis nos textos.

### 3. ⚙️ PADRÕES DE PENSAMENTO E HEURÍSTICAS DE DECISÃO
Como a pessoa RACIOCINA. Inclua:
- Frameworks mentais que usa (mesmo que implícitos)
- Árvore de decisão: quando simplifica vs. aprofunda
- Heurísticas práticas (regras do tipo "sempre X antes de Y")
- Como conecta ideias de áreas diferentes
- Vieses cognitivos observáveis (otimismo, pragmatismo, etc.)
Esta é a seção MAIS IMPORTANTE. Quanto mais detalhada, melhor o clone.

### 4. 💡 POSTURA MENTAL — Crenças e Princípios Inegociáveis
Valores, crenças e princípios que transparecem nos textos.
Liste como regras concretas, não como descrição narrativa.
Ex: "Execução > Teoria. Sempre." em vez de "Ele valoriza a execução."

### 5. 🛑 MÓDULO ANTI-HYPE (OBRIGATÓRIO)
Se o usuário apresentar buzzwords, ideias vagas, hype tecnológico sem aplicação ou tentativas de pular etapas, o clone DEVE questionar imediatamente:
- "Ok, mas qual o caso de uso real disso?"
- "Quem pagaria por isso?"
- "Qual problema concreto resolve?"
- "Isso é uma alucinação ou você tem um plano?"
Adapte as frases ao estilo da pessoa. O objetivo é NUNCA validar por hype — validar apenas por valor real.

### 6. 🗣️ ESTILO DE COMUNICAÇÃO
Tom, formalidade (escala 0-10), ritmo de escrita, analogias preferidas.
Inclua: frases de transição, como abre e fecha argumentos, nível de humor, assertividade.

### 7. ✨ VOCABULÁRIO ASSINATURA
Palavras e expressões que esta pessoa usa com frequência.
Liste no mínimo 15 termos/expressões característicos extraídos dos textos.

### 8. 💬 COMO ESTA PESSOA FALA — Frases Reais
Mínimo 10 frases REAIS extraídas diretamente dos textos.
Estas servem como calibração de estilo. Agrupe por contexto quando possível.

### 9. 🔄 REAÇÕES PADRÃO — Modos de Resposta Contextuais
Defina como a pessoa reagiria a diferentes tipos de input:
- Pergunta técnica → como responde
- Ideia vaga/sem plano → como questiona (use o módulo anti-hype)
- Pedido de conselho → como estrutura
- Discordância → como reage
- Pergunta emocional → como equilibra empatia com pragmatismo
- Pergunta casual → tom e profundidade

### 10. 📋 FORMATO DE RESPOSTA OBRIGATÓRIO
Defina uma estrutura padrão que o clone deve seguir nas respostas:
1. Diagnóstico — o que está acontecendo de verdade
2. Insight central — a percepção que muda o jogo
3. Explicação simples — sem jargão, com analogia se necessário
4. Aplicação prática — próximo passo concreto
5. Pergunta provocativa — força o usuário a agir
Adapte ao estilo natural da pessoa, mas MANTENHA a estrutura.

### 11. 🎯 EXEMPLOS FEW-SHOT (mínimo 3)
Crie pares realistas de pergunta → resposta NO ESTILO EXATO da pessoa.
Use vocabulário, ritmo e estrutura observados nos textos.
Estes exemplos CALIBRAM o modelo — são a parte mais poderosa do prompt.

### 12. 🚫 REGRAS DE PERSONAGEM E ANTI-ALUCINAÇÃO
Regras obrigatórias:
- Nunca revelar ser IA
- Nunca quebrar personagem
- RESTRIÇÃO DE ESTILO: NÃO inventar bordões ou expressões novas. Reutilizar APENAS padrões linguísticos observados nos textos originais.
- Se não souber algo que a pessoa saberia, responda como a pessoa responderia a algo fora de seu domínio
- Manter consistência de tom mesmo em temas novos

## REGRAS DE GERAÇÃO
- Escreva o System Prompt COMPLETO, pronto para uso direto
- Use emojis e títulos para cada seção
- Seja EXTENSO e DETALHADO — não há limite de tamanho
- Priorize ESTRUTURA OPERACIONAL sobre descrição narrativa
- Cada seção deve ter instruções ACIONÁVEIS, não apenas descritivas
- O prompt é um SISTEMA, não uma biografia
- PRIORIDADE COGNITIVA: dedique mais tokens e profundidade às seções de maior impacto (padrões de pensamento > exemplos few-shot > reações > estilo > vocabulário)${analysisEnrichment}

TEXTOS DA PESSOA PARA ANÁLISE:\n${context}`;
    } else {
      metaPrompt = `Você é um especialista em criar System Prompts para assistentes de IA. Analise os textos abaixo que pertencem ao clone "${brain.name}" (tipo: ${brain.type}) e gere um System Prompt detalhado em português.

O System Prompt gerado deve:
1. Definir a IDENTIDADE CENTRAL do clone — quem ele é, como pensa, como se posiciona no mundo
2. Capturar o ESTILO DE COMUNICAÇÃO — vocabulário, tom, nível de formalidade
3. Identificar TEMAS E ÁREAS DE CONHECIMENTO que o clone domina
4. Definir a POSTURA MENTAL — crenças, princípios, valores
5. Estabelecer REGRAS DE COMPORTAMENTO — como responder, o que evitar, formato preferido
6. Incluir EXEMPLOS de como o clone responderia (few-shot), baseados nos textos reais
7. Ser auto-contido — quem ler o prompt deve entender perfeitamente como a IA deve agir

Formato: Escreva o System Prompt completo, pronto para uso. Use seções com emojis e títulos. Seja EXTENSO e DETALHADO.${analysisEnrichment}

TEXTOS DO CLONE:\n${context}`;
    }

    // Try each model in order — skip on rate limits, break on auth errors
    let generatedPrompt = "";
    let lastError: { status?: number; text?: string } | null = null;

    for (const model of MODELS) {
      try {
        console.log(`generate-prompt: trying model ${model}`);
        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-second-brain.app",
            "X-Title": "AI Second Brain",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: isPersonClone
                ? "Você é um engenheiro de System Prompts de elite. Gere APENAS o System Prompt final, sem explicações, sem comentários, sem markdown extra. O prompt deve ser um SISTEMA OPERACIONAL COGNITIVO — com estrutura de decisão, heurísticas, exemplos few-shot e regras operacionais. NÃO gere biografia narrativa. Gere um sistema que OPERA como a pessoa."
                : "Você gera System Prompts profissionais e detalhados para assistentes de IA. Responda APENAS com o System Prompt gerado, sem explicações extras, sem markdown extra." },
              { role: "user", content: metaPrompt },
            ],
            temperature: 0.7,
            max_tokens: 16000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`generate-prompt: model ${model} failed with ${aiResponse.status}:`, errText);
          lastError = { status: aiResponse.status, text: errText };
          if (aiResponse.status === 401) break;
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        const result = await aiResponse.json();
        const content = result.choices?.[0]?.message?.content?.trim() || "";
        if (content.length > 20) {
          generatedPrompt = content;
          console.log(`generate-prompt: success with model ${model}, length: ${content.length}`);
          break;
        } else {
          console.warn(`generate-prompt: model ${model} returned empty/short content`);
          lastError = { text: "Empty response from model" };
        }
      } catch (e) {
        console.error(`generate-prompt: fetch error for model ${model}:`, e);
        lastError = { text: "Erro interno" };
      }
    }

    if (!generatedPrompt) {
      const isRateLimit = lastError?.status === 429;
      // Log raw error server-side only — never expose provider details to client
      console.error("generate-prompt: all models failed. Last error:", JSON.stringify(lastError));
      const errorMsg = isRateLimit
        ? "Limite de requisições excedido pelos modelos de IA. Aguarde alguns segundos e tente novamente."
        : "Falha ao gerar o prompt. Todos os modelos de IA estão indisponíveis no momento. Tente novamente em alguns instantes.";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-prompt error:", e);
    return new Response(JSON.stringify({ error: "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
