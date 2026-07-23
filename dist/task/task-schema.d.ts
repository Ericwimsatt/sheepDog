import { z } from 'zod';
export declare const PhaseYamlSchema: z.ZodObject<{
    description: z.ZodString;
    runAfter: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    runAfter: string[];
}, {
    description: string;
    runAfter?: string[] | undefined;
}>;
export declare const TaskYamlSchema: z.ZodObject<{
    name: z.ZodString;
    phases: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        runAfter: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        runAfter: string[];
    }, {
        description: string;
        runAfter?: string[] | undefined;
    }>, "many">;
    runBeforeAll: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    runAfterAll: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    schemas: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    onPhaseFailure: z.ZodDefault<z.ZodOptional<z.ZodEnum<["stop", "continue", "attempt fix"]>>>;
    nudgeInterval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    phases: {
        description: string;
        runAfter: string[];
    }[];
    name: string;
    runBeforeAll: string[];
    runAfterAll: string[];
    schemas: string[];
    onPhaseFailure: "stop" | "continue" | "attempt fix";
    nudgeInterval: number;
}, {
    phases: {
        description: string;
        runAfter?: string[] | undefined;
    }[];
    name: string;
    runBeforeAll?: string[] | undefined;
    runAfterAll?: string[] | undefined;
    schemas?: string[] | undefined;
    onPhaseFailure?: "stop" | "continue" | "attempt fix" | undefined;
    nudgeInterval?: number | undefined;
}>;
export type ParsedTaskYaml = z.infer<typeof TaskYamlSchema>;
//# sourceMappingURL=task-schema.d.ts.map