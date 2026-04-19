import { Node, Edge } from '@xyflow/react';

export type DNANodeType = 'belief' | 'value' | 'heuristic' | 'hub' | 'axiom' | 'skill';

export type DNANode = Node<{
  label: string;
  type?: DNANodeType;
  weight?: number;
  description?: string;
  steps?: string[];
  prerequisites?: string[];
  pitfalls?: string[];
}, string>;

export type DNAEdge = Edge<{
  label?: string;
  weight?: number;
}, string>;

export interface IdentityChronicle {
  nodes: DNANode[];
  edges: DNAEdge[];
  updated_at?: string;
  version?: string;
}

export interface NeuralDNAEngine {
  id: string;
  name: string;
  description: string;
  
  /**
   * Generates a new node with default styles for this engine
   */
  createNode: (label: string, type?: DNANodeType) => DNANode;
  
  /**
   * Validates if the graph conforms to the engine's cognitive rules
   */
  validate: (chronicle: IdentityChronicle) => { valid: boolean; errors?: string[] };
}
