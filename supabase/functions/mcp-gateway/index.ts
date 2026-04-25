// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * MCP Gateway — Universal Model Context Protocol Proxy
 * 
 * Actions:
 *  - register: Add a new MCP server to the user's registry
 *  - list: List all MCPs for the authenticated user
 *  - discover: Auto-discover tools from a manifest URL
 *  - invoke: Execute a tool on a registered MCP server
 *  - link: Attach/detach an MCP to a brain
 *  - upload: Parse an uploaded SKILL.md or manifest.json file
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    // @ts-expect-error: Deno is available at runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-expect-error: Deno is available at runtime
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // @ts-expect-error: Deno is available at runtime
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Sessão inválida");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    // ─── REGISTER ──────────────────────────────────────────────────────────
    if (action === "register") {
      const { name, description, transport_type, server_config, icon_emoji, category } = body;
      
      if (!name?.trim()) throw new Error("Nome é obrigatório");

      // Auto-discover tools if URL provided
      let tools_manifest: unknown[] = [];
      if (server_config?.manifest_url) {
        try {
          const resp = await fetch(server_config.manifest_url);
          if (resp.ok) {
            const manifest = await resp.json();
            if (manifest.tools) tools_manifest = manifest.tools;
            else if (Array.isArray(manifest)) tools_manifest = manifest;
          }
        } catch (e) {
          console.warn("Auto-discover failed:", e);
        }
      }

      const { data, error } = await supabase
        .from("mcp_registry")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          transport_type: transport_type || "sse",
          server_config: server_config || {},
          tools_manifest,
          icon_emoji: icon_emoji || "🔌",
          category: category || "other",
          status: "active",
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      return json({ success: true, mcp: data });
    }

    // ─── LIST ──────────────────────────────────────────────────────────────
    if (action === "list") {
      const { data, error } = await supabase
        .from("mcp_registry")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return json({ mcps: data || [] });
    }

    // ─── DISCOVER ──────────────────────────────────────────────────────────
    if (action === "discover") {
      const { url } = body;
      if (!url) throw new Error("URL é obrigatória");

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Falha ao acessar manifest: ${resp.status}`);

      const manifest = await resp.json();
      let tools: unknown[] = [];
      
      if (manifest.tools) tools = manifest.tools;
      else if (manifest.mcpServers) {
        // Parse claude_desktop_config.json format
        tools = Object.entries(manifest.mcpServers).map(([name, config]: [string, any]) => ({
          name,
          description: `MCP Server: ${name}`,
          config,
        }));
      } else if (Array.isArray(manifest)) {
        tools = manifest;
      }

      return json({ tools, raw: manifest });
    }

    // ─── LINK / UNLINK ─────────────────────────────────────────────────────
    if (action === "link") {
      const { brain_id, mcp_id, config_overrides, enabled } = body;
      if (!brain_id || !mcp_id) throw new Error("brain_id e mcp_id são obrigatórios");

      // Verify brain ownership
      const { data: brain } = await supabase
        .from("brains")
        .select("id")
        .eq("id", brain_id)
        .eq("user_id", user.id)
        .single();
      if (!brain) throw new Error("Brain não encontrado");

      const { data, error } = await supabase
        .from("brain_mcp_links")
        .upsert({
          brain_id,
          mcp_id,
          config_overrides: config_overrides || {},
          enabled: enabled !== undefined ? enabled : true,
        }, { onConflict: "brain_id,mcp_id" })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return json({ success: true, link: data });
    }

    if (action === "unlink") {
      const { brain_id, mcp_id } = body;
      if (!brain_id || !mcp_id) throw new Error("brain_id e mcp_id são obrigatórios");

      const { error } = await supabase
        .from("brain_mcp_links")
        .delete()
        .eq("brain_id", brain_id)
        .eq("mcp_id", mcp_id);

      if (error) throw new Error(error.message);
      return json({ success: true });
    }

    // ─── UPLOAD / PARSE ─────────────────────────────────────────────────────
    if (action === "upload") {
      const { content, filename } = body;
      if (!content) throw new Error("Conteúdo é obrigatório");

      // Parse SKILL.md frontmatter
      if (filename?.endsWith(".md")) {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let name = "Custom Skill";
        let description = "";

        if (frontmatterMatch) {
          const fm = frontmatterMatch[1];
          const nameMatch = fm.match(/name:\s*(.+)/);
          const descMatch = fm.match(/description:\s*(.+)/);
          if (nameMatch) name = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }

        // Register as an MCP with the skill content as config
        const { data, error } = await supabase
          .from("mcp_registry")
          .insert({
            user_id: user.id,
            name,
            description,
            transport_type: "http",
            server_config: { type: "skill_md", content },
            tools_manifest: [{ name: name.replace(/\s+/g, "_").toLowerCase(), description, type: "skill" }],
            icon_emoji: "📄",
            category: "knowledge",
            status: "active",
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return json({ success: true, mcp: data, parsed: { name, description } });
      }

      // Parse manifest.json
      if (filename?.endsWith(".json")) {
        const manifest = JSON.parse(content);
        const tools = manifest.tools || (Array.isArray(manifest) ? manifest : []);
        const name = manifest.name || "Custom MCP";

        const { data, error } = await supabase
          .from("mcp_registry")
          .insert({
            user_id: user.id,
            name,
            description: manifest.description || null,
            transport_type: manifest.transport || "sse",
            server_config: manifest.config || manifest,
            tools_manifest: tools,
            icon_emoji: "⚙️",
            category: manifest.category || "other",
            status: "active",
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return json({ success: true, mcp: data });
      }

      throw new Error("Formato não suportado. Use .md ou .json");
    }

    // ─── INVOKE ─────────────────────────────────────────────────────────────
    if (action === "invoke") {
      const { mcp_id, tool_name, arguments: toolArgs } = body;
      if (!mcp_id || !tool_name) throw new Error("mcp_id e tool_name são obrigatórios");

      // Get MCP config
      const { data: mcp } = await supabase
        .from("mcp_registry")
        .select("*")
        .eq("id", mcp_id)
        .eq("user_id", user.id)
        .single();

      if (!mcp) throw new Error("MCP não encontrado");
      if (mcp.status !== "active") throw new Error("MCP está desabilitado");

      // Route based on transport type
      let result: unknown = null;

      if (mcp.transport_type === "sse" || mcp.transport_type === "http") {
        // HTTP-based MCP: call the configured URL
        const url = (mcp.server_config as any)?.url;
        if (!url) throw new Error("MCP não tem URL configurada");

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...((mcp.server_config as any)?.headers || {}),
        };

        const resp = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/call",
            params: { name: tool_name, arguments: toolArgs || {} },
            id: crypto.randomUUID(),
          }),
        });

        if (!resp.ok) throw new Error(`MCP server returned ${resp.status}`);
        result = await resp.json();
      } else if (mcp.server_config && (mcp.server_config as any)?.type === "skill_md") {
        // Skill-based MCP: return the skill content as context
        result = {
          content: (mcp.server_config as any).content,
          type: "skill_knowledge",
        };
      } else {
        throw new Error(`Transport "${mcp.transport_type}" não suportado na cloud. Use SSE ou HTTP.`);
      }

      // Audit log
      await supabase.from("security_audit_logs").insert({
        event_type: "MCP_TOOL_INVOCATION",
        table_name: "mcp_registry",
        record_id: mcp_id,
        user_id: user.id,
        new_data: { tool_name, status: "success" },
      });

      return json({ success: true, result });
    }

    // ─── UPDATE ─────────────────────────────────────────────────────────────
    if (action === "update") {
      const { mcp_id, updates } = body;
      if (!mcp_id) throw new Error("mcp_id é obrigatório");

      const { data, error } = await supabase
        .from("mcp_registry")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", mcp_id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return json({ success: true, mcp: data });
    }

    // ─── DELETE ─────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { mcp_id } = body;
      if (!mcp_id) throw new Error("mcp_id é obrigatório");

      const { error } = await supabase
        .from("mcp_registry")
        .delete()
        .eq("id", mcp_id)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);
      return json({ success: true });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("MCP Gateway Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}
