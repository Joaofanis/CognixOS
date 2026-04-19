# 🛠️ Guia de Configuração CognixOS 4.0

Este guia ensina como ativar e configurar as novas funcionalidades de Soberania de IA e Conectividade.

---

## 1. IA Local (Ollama)

O CognixOS permite processamento 100% offline. Para funcionar, você precisa do Ollama rodando localmente.

### A. Instalação

1. Baixe o Ollama em [ollama.com](https://ollama.com).
2. Baixe os modelos recomendados:

   ```bash
   ollama run llama3.1
   ollama run qwen2.5
   ```

### B. Habilitando o Acesso (CORS) - CRÍTICO

Por padrão, o Ollama bloqueia conexões do navegador. Você **DEVE** habilitar as origens:

**Windows (PowerShell):**

```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
# Reinicie o Ollama após este comando
```

**Linux/Mac:**

```bash
OLLAMA_ORIGINS="*" ollama serve
```

---

## 2. Sincronização Física (Backup Offline)

Esta funcionalidade salva seu chat em um arquivo físico no seu PC.

1. No Dashboard, vá em **Configurações**.
2. Clique em **Vincular Arquivo (.json)**.
3. Escolha uma pasta segura e crie um arquivo (ex: `meu_backup_cognix.json`).
4. **Nota**: Toda vez que você reiniciar o navegador, clique em "Reautorizar Escrita" para confirmar a permissão de segurança do Chrome/Edge.

---

## 3. Soberania BYOK (OpenRouter)

Se você não quer depender do servidor central para créditos de IA:

1. Pegue sua chave em [OpenRouter.ai](https://openrouter.ai).
2. No CognixOS Dashboard -> Configurações -> **Parâmetros de Acesso**.
3. Cole sua chave no campo **OpenRouter API Key** e salve.
4. Selecione o modo **BYOK (Própria Key)**. Suas conversas agora usarão seus próprios créditos diretamente.

---

## 4. Ponte Telegram

Para falar com seus clones via celular:

1. Crie um Bot no [@BotFather](https://t.me/botfather) e pegue o Token.
2. Certifique-se que o administrador do sistema configurou o segredo `TELEGRAM_BOT_TOKEN` no Supabase (veja `GUIA_SUPABASE.md`).
3. No dashboard do CognixOS, vá em **Telegram** e clique em **Gerar Link de Autenticação**.
4. Siga as instruções no bot para vincular sua conta.

---

**CognixOS 4.0: Sua mente, sua máquina, suas regras.**
