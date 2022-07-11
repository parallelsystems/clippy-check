/**
 * Parse action input into a some proper thing.
 */

import { input } from '@actions-rs/core';

import stringArgv from 'string-argv';

// Parsed action input
export interface Input {
    token: string,
    toolchain?: string,
    args: string[],
    useCross: boolean,
    name: string,
    argsFilePath: string,
}

export function get(): Input {
    const args = stringArgv(input.getInput('args'));
    let toolchain = input.getInput('toolchain');
    if (toolchain.startsWith('+')) {
        toolchain = toolchain.slice(1);
    }
    const useCross = input.getInputBool('use-cross');
    const name = input.getInput('name');
    const argsFilePath = input.getInput('args-file')

    //// Uncomment for local testing
    // const args: string[] = [];
    // const toolchain = '';
    // const useCross = false;
    // const name = '';
    // const argsFilePath = '../argsfile.sh';


    return {
        token: input.getInput('token', { required: true }),
        // token: '',
        args: args,
        useCross: useCross,
        toolchain: toolchain || undefined,
        name,
        argsFilePath: argsFilePath
    }
}
