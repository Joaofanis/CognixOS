import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Save, Trash2, Plus, GitBranch, ShieldCheck, Zap } from 'lucide-react';

// Tipos de Nodos Personalizados para CognixOS
const nodeTypes = {
  // Poderíamos definir componentes customizados aqui para uma estética mais premium
};

interface IdentityGraphEditorProps {
  brainId: string;
}

export default function IdentityGraphEditor({ brainId }: IdentityGraphEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar dados da Crônica
  useEffect(() => {
    async function loadChronicle() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('brain_analysis')
          .select('identity_chronicle')
          .eq('brain_id', brainId)
          .maybeSingle();

        if (error) throw error;

        if (data?.identity_chronicle) {
          const chronicle = data.identity_chronicle as any;
          setNodes(chronicle.nodes || []);
          setEdges(chronicle.edges || []);
        }
      } catch (err: any) {
        toast.error('Erro ao carregar Crônica: ' + err.message);
      } finally {
        setLoading(false);
      }
    }

    if (brainId) loadChronicle();
  }, [brainId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#8b5cf6' } }, eds)),
    [setEdges]
  );

  const saveChronicle = async () => {
    setSaving(true);
    try {
      const chronicle = { nodes, edges, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from('brain_analysis')
        .update({ identity_chronicle: chronicle })
        .eq('brain_id', brainId);

      if (error) throw error;
      toast.success('Crônica de Identidade sincronizada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addAxiom = () => {
    const id = `axiom-${Date.now()}`;
    const newNode: Node = {
      id,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: 'Novo Axioma' },
      style: { 
        background: 'rgba(139, 92, 246, 0.2)', 
        color: '#fff', 
        border: '1px solid #8b5cf6',
        borderRadius: '12px',
        padding: '10px',
        fontSize: '12px',
        fontWeight: 'bold',
        width: 150,
        textAlign: 'center',
        backdropFilter: 'blur(4px)'
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <Zap className="h-8 w-8 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground italic">Mapeando rede semântica...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[700px] border rounded-2xl overflow-hidden bg-card/30 backdrop-blur-md relative border-primary/20 shadow-2xl shadow-primary/5">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(139, 92, 246, 0.1)" />
        <Controls />
        <MiniMap 
          nodeColor={(n: any) => {
            if (n.id.includes('axiom')) return '#8b5cf6';
            return '#333';
          }}
          maskColor="rgba(0,0,0,0.5)"
          className="bg-background/80 border-primary/20 rounded-lg"
        />
        
        <Panel position="top-right" className="flex gap-2">
          <Button 
            onClick={addAxiom} 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-background/50 backdrop-blur-md border-primary/30 hover:bg-primary/20 transition-all rounded-xl"
          >
            <Plus className="h-4 w-4" /> Injetar Axioma
          </Button>
          <Button 
            onClick={saveChronicle} 
            disabled={saving} 
            size="sm" 
            className="gap-2 bg-primary/80 hover:bg-primary transition-all rounded-xl shadow-lg shadow-primary/20"
          >
            {saving ? <Zap className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sincronizar DNA
          </Button>
        </Panel>

        <Panel position="top-left" className="bg-background/60 p-3 rounded-xl border border-primary/20 backdrop-blur-xl">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Identity Chronicle v3.0
            </h3>
            <p className="text-[10px] text-muted-foreground max-w-[200px]">
              Arraste nodos para organizar o léxico mental. Delete conexões espúrias (Pruning) para aumentar a fidelidade.
            </p>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
