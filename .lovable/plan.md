

# Segundo Cérebro — Plano Completo

## Visão Geral
Uma plataforma onde o usuário alimenta textos (colados ou via upload de arquivos .txt, .pdf, .docx) e a IA aprende desses dados para responder como se fosse aquela pessoa, seguir uma filosofia, ou aplicar um conhecimento técnico. A IA também categoriza os dados automaticamente.

---

## 1. Autenticação e Conta
- Cadastro e login por email/senha
- Cada usuário tem seus dados isolados (RLS no Supabase)
- Perfil básico do usuário

## 2. Painel Principal (Dashboard)
- Lista de todos os "Cérebros" criados pelo usuário
- Cards visuais mostrando tipo (Pessoa, Conhecimento, Filosofia, Guia), nome e resumo
- Busca e filtros por tipo de cérebro
- Design mobile-first, responsivo para celular

## 3. Criação de Cérebros
- 4 tipos disponíveis: **Clone de Pessoa**, **Base de Conhecimento**, **Filosofia/Conceitos**, **Guia Prático**
- Ao criar, o usuário dá um nome e seleciona o tipo
- Alimentação de dados por:
  - Colar texto diretamente
  - Upload de arquivos (.txt, .pdf, .docx)
- A IA categoriza automaticamente os textos fornecidos em temas/tópicos
- Possibilidade de adicionar mais textos a qualquer momento

## 4. Chat com o Cérebro (IA)
- Interface de chat onde o usuário conversa com o cérebro selecionado
- A IA usa **exclusivamente** os textos fornecidos como contexto para responder
- Para Clones de Pessoa: responde no estilo/tom da pessoa
- Para Conhecimento/Guias: aplica os dados técnicos fornecidos
- Para Filosofia: segue os conceitos e linha de pensamento alimentados
- Streaming de respostas em tempo real (token por token)
- Histórico de conversas salvo por cérebro

## 5. Análise e Gráficos (Clone de Pessoa)
- **Gráfico Radar de Traços de Personalidade**: extroversão, criatividade, pragmatismo, empatia, assertividade, etc. — extraídos automaticamente pela IA dos textos
- **Gráfico de Temas Frequentes**: visualização dos assuntos mais abordados pela pessoa (gráfico de barras ou nuvem de palavras)
- Dados gerados pela IA ao processar os textos alimentados

## 6. Comparação entre Cérebros
- Selecionar dois clones de pessoa lado a lado
- Comparação visual dos traços de personalidade (radar chart sobreposto)
- Comparação dos temas frequentes
- Resumo textual das diferenças gerado pela IA

## 7. Backend (Supabase)
- **Tabelas**: profiles, brains (cérebros), brain_texts (textos alimentados), brain_analysis (análises/gráficos), conversations, messages
- **Storage**: bucket para upload de arquivos
- **Edge Functions**: processamento de textos pela IA (Lovable AI), extração de traços/temas, chat com contexto
- **RLS**: dados isolados por usuário

## 8. Design Mobile
- Layout responsivo, otimizado para uso no celular
- Navegação por bottom tabs ou menu hamburger
- Chat e gráficos adaptados para telas pequenas

