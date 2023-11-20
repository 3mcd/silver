type PerfInit = () => () => void;
export declare const $iterations: unique symbol;
export declare class Perf {
    name: string;
    init: PerfInit;
    [$iterations]?: number;
    constructor(name: string, init: PerfInit, iterations?: number);
    iterations(iterations: number): this;
}
export declare let perfs: Map<string, Perf>;
export declare let perf: (name: string, run: PerfInit) => Perf;
export {};
