import { Brain, User, BookOpen, Lightbulb, Compass } from "lucide-react";

export const BRAIN_TYPE_CONFIG = {
  person_clone: {
    label: "Clone de Pessoa",
    icon: User,
    color: "brain-person",
    description: "Responde no estilo e tom de uma pessoa específica",
  },
  knowledge_base: {
    label: "Base de Conhecimento",
    icon: BookOpen,
    color: "brain-knowledge",
    description: "Aplica dados técnicos e informações especializadas",
  },
  philosophy: {
    label: "Filosofia / Conceitos",
    icon: Lightbulb,
    color: "brain-philosophy",
    description: "Segue conceitos e linhas de pensamento específicas",
  },
  practical_guide: {
    label: "Guia Prático",
    icon: Compass,
    color: "brain-guide",
    description: "Usa dados práticos para guiar ações e processos",
  },
} as const;

export type BrainType = keyof typeof BRAIN_TYPE_CONFIG;
