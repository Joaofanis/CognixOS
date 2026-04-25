import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  Globe,
  FileJson,
  Power,
  PowerOff,
  RefreshCw,
  Plug,
} from "lucide-react";
import { toast } from "sonner";

interface McpServer {
  id: string;
  name: string;
  description: string | null;
  transport_type: string;
  server_config: any;
  tools_manifest: any[];
  status: string;
  icon_emoji: string;
  category: string;
  created_at: string;
}

interface McpRegistryPanelProps {
  /** If provided, shows link/unlink controls for this brain */
  brainId?: string;
  /** Currently linked MCP IDs for the brain */
  linkedMcpIds?: string[];
  /** Called when links change */
  onLinksChanged?: () => void;
}

export default function McpRegistryPanel({
  brainId,
  linkedMcpIds = [],
  onLinksChanged,
}: McpRegistryPanelProps) {
  const [mcps, setMcps] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"url" | "upload" | "manual">("manual");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTransport, setFormTransport] = useState("sse");
  const [formUrl, setFormUrl] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formEmoji, setFormEmoji] = useState("🔌");

  // URL tab
  const [discoverUrl, setDiscoverUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);

  // Upload tab
  const [uploadContent, setUploadContent] = useState("");
  const [uploadFilename, setUploadFilename] = useState("");

  const fetchMcps = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-gateway`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "list" }),
        }
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setMcps(data.mcps || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMcps();
  }, []);

  const callGateway = async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-gateway`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  // ── Register (Manual) ──────────────────────────────────────────────────
  const handleRegisterManual = async () => {
    if (!formName.trim()) return toast.error("Nome é obrigatório");
    setSubmitting(true);
    try {
      await callGateway({
        action: "register",
        name: formName,
        description: formDesc,
        transport_type: formTransport,
        server_config: formUrl ? { url: formUrl } : {},
        category: formCategory,
        icon_emoji: formEmoji,
      });
      toast.success("MCP registrado!");
      setAddOpen(false);
      resetForm();
      fetchMcps();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Discover (URL) ──────────────────────────────────────────────────────
  const handleDiscover = async () => {
    if (!discoverUrl.trim()) return toast.error("URL é obrigatória");
    setDiscovering(true);
    try {
      const result = await callGateway({
        action: "register",
        name: "Discovered MCP",
        description: "Auto-discovered from manifest",
        transport_type: "sse",
        server_config: { manifest_url: discoverUrl, url: discoverUrl },
        category: "other",
        icon_emoji: "🔍",
      });
      toast.success(`MCP descoberto! ${result.mcp?.tools_manifest?.length || 0} ferramentas.`);
      setAddOpen(false);
      setDiscoverUrl("");
      fetchMcps();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDiscovering(false);
    }
  };

  // ── Upload (File) ───────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setUploadContent(text);
    setUploadFilename(file.name);
  };

  const handleUploadSubmit = async () => {
    if (!uploadContent) return toast.error("Selecione um arquivo primeiro");
    setSubmitting(true);
    try {
      const result = await callGateway({
        action: "upload",
        content: uploadContent,
        filename: uploadFilename,
      });
      toast.success(`Arquivo processado! ${result.parsed?.name || "MCP criado"}`);
      setAddOpen(false);
      setUploadContent("");
      setUploadFilename("");
      fetchMcps();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (mcpId: string) => {
    try {
      await callGateway({ action: "delete", mcp_id: mcpId });
      toast.success("MCP removido");
      fetchMcps();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Toggle Status ───────────────────────────────────────────────────────
  const handleToggleStatus = async (mcp: McpServer) => {
    const newStatus = mcp.status === "active" ? "disabled" : "active";
    try {
      await callGateway({
        action: "update",
        mcp_id: mcp.id,
        updates: { status: newStatus },
      });
      toast.success(newStatus === "active" ? "MCP ativado" : "MCP desativado");
      fetchMcps();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Link / Unlink to Brain ──────────────────────────────────────────────
  const handleLinkToggle = async (mcpId: string) => {
    if (!brainId) return;
    const isLinked = linkedMcpIds.includes(mcpId);
    try {
      await callGateway({
        action: isLinked ? "unlink" : "link",
        brain_id: brainId,
        mcp_id: mcpId,
      });
      toast.success(isLinked ? "MCP desvinculado" : "MCP vinculado ao cérebro!");
      onLinksChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormTransport("sse");
    setFormUrl("");
    setFormCategory("other");
    setFormEmoji("🔌");
  };

  const categoryColors: Record<string, string> = {
    knowledge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    execution: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    automation: "bg-green-500/15 text-green-400 border-green-500/30",
    creative: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    other: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">
            {brainId ? "Integrações MCP" : "MCP Hub"}
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {mcps.length} registrados
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMcps}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-lg h-8 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                Adicionar MCP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar MCP Server</DialogTitle>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                {[
                  { id: "manual" as const, label: "Manual", icon: Plug },
                  { id: "url" as const, label: "URL", icon: Globe },
                  { id: "upload" as const, label: "Upload", icon: Upload },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAddTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all
                      ${addTab === tab.id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Manual Tab */}
              {addTab === "manual" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-[3rem_1fr] gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Emoji</Label>
                      <Input
                        value={formEmoji}
                        onChange={(e) => setFormEmoji(e.target.value)}
                        className="text-center text-lg p-1"
                        maxLength={4}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Ex: NotebookLM, n8n, Custom API..."
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Input
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="O que este MCP faz?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Transporte</Label>
                      <select
                        value={formTransport}
                        onChange={(e) => setFormTransport(e.target.value)}
                        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                      >
                        <option value="sse">SSE (Server-Sent Events)</option>
                        <option value="http">HTTP (REST API)</option>
                        <option value="websocket">WebSocket</option>
                        <option value="stdio">Stdio (Local)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Categoria</Label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                      >
                        <option value="knowledge">📚 Conhecimento</option>
                        <option value="execution">⚡ Execução</option>
                        <option value="automation">🤖 Automação</option>
                        <option value="creative">🎨 Criativo</option>
                        <option value="other">🔌 Outro</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>URL do Servidor (opcional)</Label>
                    <Input
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://..."
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    className="w-full rounded-lg"
                    onClick={handleRegisterManual}
                    disabled={submitting || !formName.trim()}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Registrar MCP
                  </Button>
                </div>
              )}

              {/* URL Tab */}
              {addTab === "url" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Cole a URL de um manifest MCP (manifest.json, package.json, ou endpoint SSE).
                    O sistema tentará auto-descobrir as ferramentas disponíveis.
                  </p>
                  <div className="space-y-1">
                    <Label>URL do Manifest</Label>
                    <Input
                      value={discoverUrl}
                      onChange={(e) => setDiscoverUrl(e.target.value)}
                      placeholder="https://api.example.com/mcp/manifest.json"
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    className="w-full rounded-lg"
                    onClick={handleDiscover}
                    disabled={discovering || !discoverUrl.trim()}
                  >
                    {discovering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                    Descobrir & Registrar
                  </Button>
                </div>
              )}

              {/* Upload Tab */}
              {addTab === "upload" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Faça upload de um arquivo <code>SKILL.md</code>, <code>manifest.json</code>, 
                    ou qualquer arquivo <code>.md</code> com frontmatter YAML para registrar como conhecimento.
                  </p>
                  <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center">
                    <input
                      type="file"
                      accept=".md,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="mcp-file-upload"
                    />
                    <label
                      htmlFor="mcp-file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {uploadFilename ? (
                        <>
                          <FileJson className="h-8 w-8 text-primary" />
                          <span className="text-sm font-medium">{uploadFilename}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {uploadContent.length.toLocaleString()} caracteres
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Clique para selecionar (.md ou .json)
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                  <Button
                    className="w-full rounded-lg"
                    onClick={handleUploadSubmit}
                    disabled={submitting || !uploadContent}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Processar & Registrar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MCP Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : mcps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Plug className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum MCP registrado ainda.</p>
          <p className="text-xs">Clique em "Adicionar MCP" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {mcps.map((mcp) => {
            const isLinked = linkedMcpIds.includes(mcp.id);
            return (
              <div
                key={mcp.id}
                className={`group relative rounded-xl border p-4 transition-all hover:shadow-md
                  ${mcp.status === "active"
                    ? "border-border/60 bg-card/60"
                    : "border-border/30 bg-card/30 opacity-60"
                  }
                  ${isLinked ? "ring-2 ring-primary/30 border-primary/40" : ""}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl shrink-0">
                    {mcp.icon_emoji}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">{mcp.name}</h4>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${categoryColors[mcp.category] || categoryColors.other}`}
                      >
                        {mcp.category}
                      </Badge>
                      {mcp.status === "active" ? (
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                      )}
                    </div>
                    {mcp.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {mcp.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[9px]">
                        {mcp.transport_type.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {(mcp.tools_manifest || []).length} ferramenta{(mcp.tools_manifest || []).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {brainId && (
                      <Button
                        variant={isLinked ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-[10px] gap-1 rounded-lg ${isLinked ? "bg-primary" : "border-primary/30 text-primary"}`}
                        onClick={() => handleLinkToggle(mcp.id)}
                      >
                        <LinkIcon className="h-3 w-3" />
                        {isLinked ? "Vinculado" : "Vincular"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggleStatus(mcp)}
                    >
                      {mcp.status === "active" ? (
                        <Power className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(mcp.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
