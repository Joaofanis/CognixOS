import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: authErr } = await createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    ).auth.getUser();

    if (authErr || !user) {
      throw new Error("Unauthorized");
    }

    // --- AGENTS SEED ---
    const agentsData = [
      { id: 'orchestrator', name: 'Orchestrator', description: 'Multi-agent coordination and task orchestration.', skills: ['parallel-agents','plan-writing','brainstorming'], focus: 'coordination', is_global: true },
      { id: 'project-planner', name: 'Project Planner', description: 'Discovery and task planning specialist.', skills: ['brainstorming','plan-writing'], focus: 'planning', is_global: true },
      { id: 'frontend-specialist', name: 'Frontend Specialist', description: 'React, Next.js, and modern UI/UX.', skills: ['frontend-design','react-patterns','tailwind-patterns'], focus: 'frontend', is_global: true },
      { id: 'backend-specialist', name: 'Backend Specialist', description: 'API, business logic and backend.', skills: ['api-patterns','nodejs-best-practices','database-design'], focus: 'backend', is_global: true },
      { id: 'database-architect', name: 'Database Architect', description: 'Schema design and SQL optimization.', skills: ['database-design','prisma-expert'], focus: 'database', is_global: true },
      { id: 'mobile-developer', name: 'Mobile Developer', description: 'iOS, Android, React Native.', skills: ['mobile-design'], focus: 'mobile', is_global: true },
      { id: 'devops-engineer', name: 'DevOps Engineer', description: 'CI/CD, Docker, workflows.', skills: ['deployment-procedures','docker-expert'], focus: 'devops', is_global: true },
      { id: 'security-auditor', name: 'Security Auditor', description: 'Security compliance and OWASP.', skills: ['vulnerability-scanner','red-team-tactics'], focus: 'security', is_global: true },
      { id: 'test-engineer', name: 'Test Engineer', description: 'Testing strategies and QA.', skills: ['testing-patterns','tdd-workflow'], focus: 'testing', is_global: true }
    ];

    const { error: agentErr } = await supabaseClient.from('agent_templates').upsert(agentsData, { onConflict: 'id' });
    if (agentErr) throw new Error("Agent Seed Error: " + agentErr.message);

    // --- SKILLS SEED ---
    const skillsData = [
      { id: 'react-patterns', name: 'React Patterns', category: 'frontend', tools_required: ['Read', 'Grep'], is_global: true },
      { id: 'nextjs-best-practices', name: 'Next.js Best Practices', category: 'frontend', tools_required: ['Read'], is_global: true },
      { id: 'api-patterns', name: 'API Patterns', category: 'backend', tools_required: ['Read', 'Write'], is_global: true },
      { id: 'database-design', name: 'Database Design', category: 'database', tools_required: ['Read', 'Write'], is_global: true },
      { id: 'docker-expert', name: 'Docker Expert', category: 'devops', tools_required: ['Read', 'Bash'], is_global: true },
      { id: 'testing-patterns', name: 'Testing Patterns', category: 'testing', tools_required: ['Read', 'Grep'], is_global: true },
      { id: 'vulnerability-scanner', name: 'Vulnerability Scanner', category: 'security', tools_required: ['Read', 'Bash'], is_global: true },
      { id: 'brainstorming', name: 'Brainstorming', category: 'planning', tools_required: ['Read'], is_global: true },
      { id: 'clean-code', name: 'Clean Code', category: 'general', tools_required: ['Read', 'Glob'], is_global: true }
    ];

    const { error: skillErr } = await supabaseClient.from('skill_templates').upsert(skillsData, { onConflict: 'id' });
    if (skillErr) throw new Error("Skill Seed Error: " + skillErr.message);

    return new Response(JSON.stringify({ success: true, message: "Banco populado com sucesso!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
