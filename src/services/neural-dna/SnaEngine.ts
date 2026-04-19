import { DNANode, DNANodeType, IdentityChronicle, NeuralDNAEngine } from './types';

export class StandardSnaEngine implements NeuralDNAEngine {
  id = 'standard-sna';
  name = 'Standard SNA Engine';
  description = 'Default Social Network Analysis engine for cognitive mapping.';

  createNode(label: string, type: DNANodeType = 'axiom'): DNANode {
    const id = `${type}-${Date.now()}`;
    return {
      id,
      type: 'default', // React Flow base type
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      style: { 
        background: type === 'axiom' ? 'rgba(139, 92, 246, 0.2)' : 
                   type === 'skill' ? 'rgba(30, 64, 175, 0.4)' : // Sapphire for Skills
                   'rgba(16, 185, 129, 0.2)', 
        color: '#fff', 
        border: `1px solid ${type === 'axiom' ? '#8b5cf6' : 
                             type === 'skill' ? '#3b82f6' : 
                             '10b981'}`,
        borderRadius: '12px',
        boxShadow: type === 'skill' ? '0 0 15px rgba(59, 130, 246, 0.3)' : 'none',
        padding: '10px',
        fontSize: '12px',
        fontWeight: 'bold',
        width: type === 'skill' ? 180 : 150,
        textAlign: 'center',
        backdropFilter: 'blur(4px)'
      },
      data: { 
        label, 
        type,
        weight: 0.5,
        steps: type === 'skill' ? ['Passo 1: Definir objetivo'] : undefined,
        prerequisites: type === 'skill' ? ['Requisito inicial'] : undefined,
        pitfalls: type === 'skill' ? ['Cuidado com X'] : undefined
      },
    };
  }

  validate(chronicle: IdentityChronicle): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!chronicle.nodes || chronicle.nodes.length === 0) {
      errors.push('O grafo deve conter pelo menos um nodo.');
    }
    
    // Check for isolated hubs
    const hubIds = chronicle.nodes.filter(n => n.data.type === 'hub').map(n => n.id);
    hubIds.forEach(id => {
      const hasEdge = chronicle.edges.some(e => e.source === id || e.target === id);
      if (!hasEdge) {
        errors.push(`Hub isolado detectado: ${id}. Hubs devem ter conexões.`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
