import { input } from "@actions-rs-plus/core";
import stringArgv from "string-argv";

// Parsed action input
export interface Input {
    toolchain: string | undefined;
    args: string[];
    argsFilePath: string | undefined;
    useCross: boolean;
}

export function get(): Input {
    let toolchain: string = input.getInput("toolchain");
    const argsFilePath: string = input.getInput("args-file");

    if (toolchain.startsWith("+")) {
        toolchain = toolchain.slice(1);
    }

    return {
        args: stringArgv(input.getInput("args")),
        argsFilePath: "" !== argsFilePath ? argsFilePath : undefined,
        useCross: input.getInputBool("use-cross"),
        toolchain: "" !== toolchain ? toolchain : undefined,
    };
}
