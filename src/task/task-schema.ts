import { z } from 'zod'

export const TestCommandSchema = z.object({
  command: z.string(),
  optional: z.boolean().optional().default(false),
  failOnError: z.boolean().optional().default(true),
})

export const PhaseSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  label: z.string().min(1),
})

export const OnTestFailureSchema = z.object({
  action: z.enum(['append_to_next_phase', 'stop']),
})

export const TaskSchema = z.object({
  name: z.string().min(1),
  phases: z.array(PhaseSchema).min(1).max(10),
  runBetween: z.array(TestCommandSchema).optional().default([]),
  runAfterAll: z.array(TestCommandSchema).optional().default([]),
  onTestFailure: OnTestFailureSchema.optional().default({ action: 'stop' }),
})

export type ParsedTask = z.infer<typeof TaskSchema>
