import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { phaseFilePath, contextFilePath, fixContextFilePath } from '../task/task-loader.js';
export function buildPhaseContext(options) {
    const { taskDir, phase, previousTestResults } = options;
    const todoPath = phaseFilePath(taskDir, phase);
    const todoContent = existsSync(todoPath)
        ? readFileSync(todoPath, 'utf-8')
        : '# No instructions provided\n';
    const lines = [];
    lines.push(`# Phase: ${phase.label}`);
    lines.push('');
    lines.push('## Instructions');
    lines.push('');
    lines.push(todoContent.trim());
    lines.push('');
    if (previousTestResults && previousTestResults.length > 0) {
        const failures = previousTestResults.filter(r => !r.passed);
        if (failures.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push('## Previous Phase Test Failures');
            lines.push('');
            lines.push('The following tests failed in the previous phase. Please address these before proceeding.');
            lines.push('');
            for (const failure of failures) {
                lines.push(`### \`${failure.command}\` (exit code ${failure.exitCode})`);
                lines.push('');
                lines.push('```');
                if (failure.stdout) {
                    lines.push(failure.stdout);
                }
                if (failure.stderr) {
                    lines.push(failure.stderr);
                }
                if (!failure.stdout && !failure.stderr) {
                    lines.push('(no output)');
                }
                lines.push('```');
                lines.push('');
            }
        }
    }
    const content = lines.join('\n');
    const outputPath = contextFilePath(taskDir, phase.id);
    writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
}
export function buildFixContext(options) {
    const { taskDir, phase, testResults, attempt, maxAttempts } = options;
    const failures = testResults.filter(r => !r.passed);
    const lines = [];
    lines.push(`# Fix Attempt ${attempt}/${maxAttempts}: ${phase.label}`);
    lines.push('');
    lines.push('The following tests failed after completing the phase. Please fix the code to make these tests pass.');
    lines.push('');
    lines.push(`Attempt ${attempt} of ${maxAttempts}.`);
    if (attempt > 1) {
        lines.push('');
        lines.push('**Previous fix attempt did not resolve the issue.** Please try a different approach.');
    }
    lines.push('');
    lines.push('## Failing Tests');
    lines.push('');
    for (const failure of failures) {
        lines.push(`### \`${failure.command}\` (exit code ${failure.exitCode})`);
        lines.push('');
        lines.push('```');
        if (failure.stdout) {
            lines.push(failure.stdout);
        }
        if (failure.stderr) {
            lines.push(failure.stderr);
        }
        if (!failure.stdout && !failure.stderr) {
            lines.push('(no output)');
        }
        lines.push('```');
        lines.push('');
    }
    lines.push('## Instructions');
    lines.push('');
    lines.push('1. Fix the code to make all the above tests pass.');
    lines.push(`2. After fixing, call the \`sheepdog_done\` tool to signal completion.`);
    lines.push('3. Do NOT modify the test files unless the tests themselves are clearly incorrect.');
    lines.push('');
    if (attempt === maxAttempts) {
        lines.push('> **This is the final attempt.** If tests still fail, the task will be aborted.');
        lines.push('');
    }
    const content = lines.join('\n');
    const outputPath = fixContextFilePath(taskDir, phase.id, attempt);
    writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
}
//# sourceMappingURL=context-builder.js.map