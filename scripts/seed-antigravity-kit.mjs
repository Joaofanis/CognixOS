#!/usr/bin/env node

/**
 * Seed Antigravity Kit — Parses .agent/agents/ and .agent/skills/ directories
 * and populates agent_templates + skill_templates in Supabase.
 * 
 * Usage: node scripts/seed-antigravity-kit.mjs
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set them as environment variables or in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- YAML Frontmatter Parser (minimal, no deps) ---
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const fm = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      fm[key] = value;
    }
  }
  return { frontmatter: fm, body: content.slice(match[0].length).trim() };
}

// --- Detect .agent directory ---
async function findAgentDir() {
  const candidates = [
    resolve(process.cwd(), '.agent'),
    resolve(process.cwd(), '..', '.agent'),
    resolve(process.env.HOME || process.env.USERPROFILE || '', 'OneDrive', 'Documentos', 'GitHub', '.agent'),
  ];

  for (const dir of candidates) {
    try {
      const s = await stat(dir);
      if (s.isDirectory()) return dir;
    } catch { }
  }
  return null;
}

// --- Seed Agents ---
async function seedAgents(agentDir) {
  const files = await readdir(agentDir);
  const agentFiles = files.filter(f => f.endsWith('.md'));

  console.log(`\n🤖 Found ${agentFiles.length} agent files`);

  let inserted = 0;
  for (const file of agentFiles) {
    const content = await readFile(join(agentDir, file), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const id = basename(file, '.md');
    const name = frontmatter.name || id;
    const description = frontmatter.description || '';
    const skills = frontmatter.skills
      ? frontmatter.skills.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const focus = frontmatter.tools || '';

    const { error } = await supabase
      .from('agent_templates')
      .upsert({
        id,
        name,
        description,
        skills,
        persona_md: body,
        focus,
        is_global: true,
      }, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ ${id}: ${error.message}`);
    } else {
      console.log(`  ✅ ${id} (${skills.length} skills)`);
      inserted++;
    }
  }

  console.log(`  → ${inserted}/${agentFiles.length} agents seeded`);
}

// --- Seed Skills ---
async function seedSkills(skillsDir) {
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skillDirs = entries.filter(e => e.isDirectory());

  console.log(`\n🧩 Found ${skillDirs.length} skill directories`);

  // Category detection from path or content
  const categoryMap = {
    'react-patterns': 'frontend',
    'nextjs-best-practices': 'frontend',
    'tailwind-patterns': 'frontend',
    'frontend-design': 'frontend',
    'api-patterns': 'backend',
    'nestjs-expert': 'backend',
    'nodejs-best-practices': 'backend',
    'python-patterns': 'backend',
    'database-design': 'database',
    'prisma-expert': 'database',
    'typescript-expert': 'typescript',
    'docker-expert': 'devops',
    'deployment-procedures': 'devops',
    'server-management': 'devops',
    'testing-patterns': 'testing',
    'webapp-testing': 'testing',
    'tdd-workflow': 'testing',
    'code-review-checklist': 'testing',
    'lint-and-validate': 'testing',
    'vulnerability-scanner': 'security',
    'red-team-tactics': 'security',
    'app-builder': 'architecture',
    'architecture': 'architecture',
    'plan-writing': 'planning',
    'brainstorming': 'planning',
    'mobile-design': 'mobile',
    'game-development': 'game',
    'seo-fundamentals': 'seo',
    'geo-fundamentals': 'seo',
    'bash-linux': 'infra',
    'powershell-windows': 'infra',
    'clean-code': 'general',
    'behavioral-modes': 'general',
    'parallel-agents': 'orchestration',
    'intelligent-routing': 'orchestration',
    'mcp-builder': 'mcp',
    'documentation-templates': 'general',
    'i18n-localization': 'general',
    'performance-profiling': 'performance',
    'systematic-debugging': 'debugging',
  };

  let inserted = 0;
  for (const dir of skillDirs) {
    const skillMdPath = join(skillsDir, dir.name, 'SKILL.md');
    let content;
    try {
      content = await readFile(skillMdPath, 'utf-8');
    } catch {
      console.log(`  ⏭️  ${dir.name}: no SKILL.md, skipping`);
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(content);

    const id = dir.name;
    const name = frontmatter.name || id;
    const description = frontmatter.description || '';
    const toolsRequired = frontmatter['allowed-tools']
      ? frontmatter['allowed-tools'].split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const category = categoryMap[id] || 'general';

    const { error } = await supabase
      .from('skill_templates')
      .upsert({
        id,
        name,
        description,
        category,
        content_md: body,
        tools_required: toolsRequired,
        is_global: true,
      }, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ ${id}: ${error.message}`);
    } else {
      console.log(`  ✅ ${id} [${category}]`);
      inserted++;
    }
  }

  console.log(`  → ${inserted}/${skillDirs.length} skills seeded`);
}

// --- Main ---
async function main() {
  console.log('🚀 Antigravity Kit Seeder');
  console.log(`   Supabase: ${SUPABASE_URL}`);

  const agentDir = await findAgentDir();
  if (!agentDir) {
    console.error('❌ Could not find .agent directory');
    process.exit(1);
  }
  console.log(`   .agent dir: ${agentDir}`);

  await seedAgents(join(agentDir, 'agents'));
  await seedSkills(join(agentDir, 'skills'));

  console.log('\n🎉 Seeding complete!');
}

main().catch(console.error);
