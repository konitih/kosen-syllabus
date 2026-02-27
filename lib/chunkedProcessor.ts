/**
 * Chunked processing utility for rate-limited API calls
 * Respects Firecrawl rate limits by processing 2-3 items at a time
 */

export interface ProcessingOptions {
  chunkSize?: number; // Number of items to process in parallel (default: 2)
  delayBetweenChunks?: number; // Milliseconds to wait between chunks (default: 500)
  onProgress?: (current: number, total: number, item?: any) => void;
  onError?: (error: Error, itemIndex: number, item?: any) => void;
}

export interface ProcessingResult<T> {
  successful: T[];
  failed: Array<{ index: number; error: Error; item?: any }>;
  total: number;
}

/**
 * Process items in chunks with controlled parallelism and rate limiting
 * @param items - Array of items to process
 * @param processor - Async function that processes each item
 * @param options - Configuration options
 * @returns Results with successful and failed items
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number, total: number) => Promise<R>,
  options: ProcessingOptions = {}
): Promise<ProcessingResult<R>> {
  const {
    chunkSize = 2,
    delayBetweenChunks = 500,
    onProgress,
    onError,
  } = options;

  const successful: R[] = [];
  const failed: Array<{ index: number; error: Error; item?: T }> = [];

  console.log(`[v0] Starting chunked processing: ${items.length} items, chunk size: ${chunkSize}`);

  // Process in chunks
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);

    console.log(
      `[v0] Processing chunk ${chunkIndex + 1} (items ${i + 1}-${Math.min(i + chunkSize, items.length)} of ${items.length})`
    );

    // Process all items in chunk in parallel
    const chunkPromises = chunk.map((item, offsetIndex) => {
      const itemIndex = i + offsetIndex;

      return processor(item, itemIndex, items.length)
        .then(result => {
          onProgress?.(itemIndex + 1, items.length, item);
          return { success: true, result, index: itemIndex };
        })
        .catch(error => {
          onError?.(error, itemIndex, item);
          return { success: false, error, index: itemIndex, item };
        });
    });

    // Wait for all items in chunk to complete
    const chunkResults = await Promise.all(chunkPromises);

    // Separate successful and failed results
    for (const chunkResult of chunkResults) {
      if (chunkResult.success) {
        successful.push(chunkResult.result);
      } else {
        failed.push({
          index: chunkResult.index,
          error: chunkResult.error as Error,
          item: chunkResult.item,
        });
      }
    }

    // Add delay between chunks (except after last chunk)
    if (i + chunkSize < items.length) {
      console.log(`[v0] Waiting ${delayBetweenChunks}ms before next chunk...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
    }
  }

  console.log(`[v0] Chunked processing complete: ${successful.length} successful, ${failed.length} failed`);

  return {
    successful,
    failed,
    total: items.length,
  };
}

/**
 * Simple wrapper for processing array of items with callback
 */
export async function processItemsChunked<T>(
  items: T[],
  callback: (item: T, index: number, total: number) => Promise<void>,
  chunkSize: number = 2,
  delayMs: number = 500
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map((item, offsetIndex) =>
        callback(item, i + offsetIndex, items.length)
      )
    );

    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Exponential backoff retry utility for failed requests
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(`[v0] Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
