import { NeuralDNAEngine } from './types';
import { StandardSnaEngine } from './SnaEngine';

class NeuralDNARegistry {
  private engines: Map<string, NeuralDNAEngine> = new Map();
  private defaultEngineId: string = 'standard-sna';

  constructor() {
    this.register(new StandardSnaEngine());
  }

  register(engine: NeuralDNAEngine) {
    this.engines.set(engine.id, engine);
  }

  getEngine(id?: string): NeuralDNAEngine {
    const engine = this.engines.get(id || this.defaultEngineId);
    if (!engine) {
      throw new Error(`Engine ${id} não encontrada no registro.`);
    }
    return engine;
  }

  getAllEngines(): NeuralDNAEngine[] {
    return Array.from(this.engines.values());
  }
}

export const dnaRegistry = new NeuralDNARegistry();
