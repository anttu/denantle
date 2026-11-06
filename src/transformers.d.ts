// Type the API used from the pinned CDN module without bundling its runtime.
declare module "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1" {
  export interface FeatureTensor { data: Float32Array; dims: number[] }
  export type FeatureExtractor = (
    texts: string[], options: { pooling: "mean"; normalize: true }
  ) => Promise<FeatureTensor>;
  export const env: {
    allowLocalModels: boolean;
    backends: { onnx: { wasm: { numThreads: number } } };
  };
  export function pipeline(
    task: "feature-extraction", model: string,
    options: { revision: string; dtype: "q8"; device: "wasm" }
  ): Promise<FeatureExtractor>;
}
