export {
  runWritingAgent,
  ARTICLE_LENGTH,
  WRITING_HARD_RULES,
  type WritingAgentInput,
  type WritingAgentResult,
} from "@/lib/writing/agent";

export {
  CONFIDENCE_VOCAB,
} from "@/lib/writing/constraints";

export type { WritingMetadata } from "@/lib/writing/types";

export {
  pickStructureVariant,
  listStructureVariants,
  type StructureVariant,
} from "@/lib/writing/structure";
