import { readFileSync } from "fs";

import { Cargo, Cross } from "@actions-rs-plus/core";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

import * as input from "./input";
import { OutputParser } from "./outputParser";
import { Reporter } from "./reporter";
import type { AnnotationWithMessageAndLevel, Context, Stats } from "./schema";

type Program = Cargo | Cross;
interface ClippyResult {
    stats: Stats;
    annotations: AnnotationWithMessageAndLevel[];
    exitCode: number;
}

async function buildContext(program: Program): Promise<Context> {
    const context: Context = {
        cargo: "",
        clippy: "",
        rustc: "",
    };

    await Promise.all([
        await exec.exec("rustc", ["-V"], {
            silent: true,
            listeners: {
                stdout: (buffer: Buffer) => {
                    return (context.rustc = buffer.toString().trim());
                },
            },
        }),
        await program.call(["-V"], {
            silent: true,
            listeners: {
                stdout: (buffer: Buffer) => {
                    return (context.cargo = buffer.toString().trim());
                },
            },
        }),
        await program.call(["clippy", "-V"], {
            silent: true,
            listeners: {
                stdout: (buffer: Buffer) => {
                    return (context.clippy = buffer.toString().trim());
                },
            },
        }),
    ]);

    return context;
}

/**
 * Parses a newline-delimited file of clippy args
 *
 * @remark sh-style comments are supported (using #)
 *
 * @param filePath - path of file that contains clippy arguments to parse
 * @returns parsed arguments as an array of strings
 */
function parseArgsFile(filePath: string): string[] {
    let parsedArgs: string[] = [];

    const file = readFileSync(filePath, "utf-8");

    for (const line of file.split(/\r?\n/)) {
        if (!line.startsWith("#") && line.trim() !== "") {
            parsedArgs = parsedArgs.concat(line.split(" "));
        }
    }

    return parsedArgs;
}

async function runClippy(actionInput: input.Input, program: Program): Promise<ClippyResult> {
    let args: string[] = [];

    // Toolchain selection MUST go first in any condition
    if (actionInput.toolchain) {
        args.push(`+${actionInput.toolchain}`);
    }

    args.push("clippy");

    // `--message-format=json` should just right after the `cargo clippy`
    // because usually people are adding the `-- -D warnings` at the end
    // of arguments and it will mess up the output.
    args.push("--message-format=json");

    if (actionInput.args.length !== 0 && actionInput.argsFilePath) {
        throw new Error("Only specify one argument source: `args` or `args-file`");
    }

    if (actionInput.args.length !== 0) {
        args = args.concat(actionInput.args);
    }

    if (actionInput.argsFilePath) {
        args = args.concat(parseArgsFile(actionInput.argsFilePath));
    }

    const outputParser = new OutputParser();

    let exitCode = 0;

    try {
        core.startGroup("Executing cargo clippy (JSON output)");
        exitCode = await program.call(args, {
            ignoreReturnCode: true,
            failOnStdErr: false,
            listeners: {
                stdline: (line: string) => {
                    outputParser.tryParseClippyLine(line);
                },
            },
        });
    } finally {
        core.endGroup();
    }

    return {
        stats: outputParser.stats,
        annotations: outputParser.annotations,
        exitCode,
    };
}

export async function run(actionInput: input.Input): Promise<void> {
    let program: Cargo | Cross;
    if (actionInput.useCross) {
        program = await Cross.getOrInstall();
    } else {
        program = await Cargo.get();
    }

    const context = await buildContext(program);

    const { stats, annotations, exitCode } = await runClippy(actionInput, program);

    await new Reporter().report(stats, annotations, context);

    if (exitCode !== 0) {
        throw new Error(`Clippy had exited with the ${exitCode} exit code`);
    }
}

async function main(): Promise<void> {
    try {
        const actionInput = input.get();

        await run(actionInput);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            // use the magic of string templates
            core.setFailed(`${error}`);
        }
    }
}

void main();
