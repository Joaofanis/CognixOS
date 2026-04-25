# 🛡️ Guia de Soberania CognixOS 7.0 (Local First & Privacy)

O CognixOS 7.0 foi projetado sob o princípio da **Soberania Digital**. Este guia detalha como configurar a infraestrutura para que sua inteligência e dados nunca dependam exclusivamente de servidores de terceiros.

---

## 1. IA Local (Ollama) — Processamento 100% Offline

A integração com o Ollama permite que seus clones rodem diretamente na sua GPU/CPU, garantindo que nada saia da sua máquina.

### A. Instalação e Modelos
1. Baixe o software em [ollama.com](https://ollama.com).
2. Recomendamos os modelos treinados para o protocolo CognixOS:
   ```bash
   ollama run llama3.1:8b       # Equilíbrio entre lógica e velocidade
   ollama run qwen2.5:7b        # Excelente para raciocínio técnico
   ollama run deepseek-v2:16b   # Para análises financeiras densas (requer +12GB VRAM)
   ```

### B. Habilitando a Ponte de Dados (CORS)
O navegador bloqueia conexões externas por segurança. Você deve autorizar o CognixOS a falar com o Ollama:

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
# IMPORTANTE: Reinicie o Ollama (feche no ícone da bandeja e abra de novo)
```

**Mac/Linux:**
```bash
OLLAMA_ORIGINS="*" ollama serve
```

---

## 2. Paging de Memória Virtual (Local Sync)

Diferente de chats comuns, o CognixOS 7.0 utiliza a **File System Access API** para espelhar suas conversas sensíveis em arquivos locais estruturados.

### Como Ativar:
1. No Dashboard, acesse **Configurações > Sincronização Física**.
2. Clique em **Vincular Arquivo JSON**.
3. Selecione um diretório seguro (recomendamos uma pasta criptografada ou um drive físico).
4. O sistema salvará o estado `Core Memory` de cada clone no arquivo toda vez que houver uma alteração.

> [!TIP]
> Isso permite que você mude de navegador ou de domínio e recupere toda a "alma" (memory pool) dos seus clones apenas apontando para o arquivo físico.

---

## 3. Soberania BYOK (Bring Your Own Key)

Se você utiliza modelos de nuvem, não use créditos de terceiros. Use suas próprias chaves para garantir autonomia total sobre os limites de tokens e custos.

1. Vá para **Configurações > Perfil IA**.
2. Insira sua chave do **OpenRouter** ou **OpenAI**.
3. Selecione o provedor no painel de controle.
4. **Segurança**: Suas chaves são armazenadas localmente no navegador (LocalStorage) ou no seu cofre pessoal no Supabase, protegidas por criptografia de ponta e RLS.

---

## 4. Ponte Omnichannel (Telegram & Webhooks)

Seus agentes podem atuar enquanto você está offline através do **Durable Execution Loop**.

- **Telegram:** Localize seu `Chat ID` no bot de configuração e vincule-o ao seu perfil.
- **Webhooks:** O CognixOS fornece endpoints únicos para receber alertas de n8n, Make ou Zapier, disparando raciocínios nos seus clones de forma assíncrona.

---

**CognixOS 7.0: A inteligência é sua. O hardware é seu. O destino é seu.**
