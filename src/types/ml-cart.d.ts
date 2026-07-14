declare module 'ml-cart' {
  export class DecisionTreeRegression {
    constructor(options?: { maxDepth?: number; minNumSamples?: number; [key: string]: any });
    train(X: number[][], y: number[]): void;
    predict(X: number[][]): number[];
    toJSON(): any;
    static load(model: any): DecisionTreeRegression;
  }
}
