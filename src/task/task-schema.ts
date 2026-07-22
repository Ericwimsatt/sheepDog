import { z } from 'zod'

export const PhaseYamlSchema = z.object({
  description: z.string().min(1),
  runAfter: z.array(z.string()).optional().default([]),
})

export const TaskYamlSchema = z.object({
  name: z.string().min(1),
  phases: z.array(PhaseYamlSchema).min(1).max(10),
  runBeforeAll: z.array(z.string()).optional().default([]),
  runAfterAll: z.array(z.string()).optional().default([]),
  schemas: z.array(z.string()).optional().default([]),
  onPhaseFailure: z.enum(['stop', 'continue', 'attempt fix']).optional().default('stop'),
  nudgeInterval: z.number().min(0).optional().default(180),
})

export type ParsedTaskYaml = z.infer<typeof TaskYamlSchema>
