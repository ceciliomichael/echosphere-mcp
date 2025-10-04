/**
 * Min-heap data structure for efficient top-K selection
 * 
 * Provides O(n log k) time complexity for finding top-K items
 * instead of O(n log n) required by full sorting.
 */
export class MinHeap<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  /**
   * Create a new min-heap
   * 
   * @param compareFn - Comparison function where compareFn(a, b) < 0 means a has lower priority than b
   */
  constructor(compareFn: (a: T, b: T) => number) {
    this.compareFn = compareFn;
  }

  /**
   * Push an item into the heap, maintaining max size
   * 
   * @param item - Item to push
   * @param maxSize - Maximum heap size to maintain
   */
  push(item: T, maxSize: number): void {
    if (this.heap.length < maxSize) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else if (this.compareFn(item, this.heap[0]) > 0) {
      this.heap[0] = item;
      this.bubbleDown(0);
    }
  }

  /**
   * Move element up the heap to maintain heap property
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compareFn(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  /**
   * Move element down the heap to maintain heap property
   */
  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < this.heap.length && this.compareFn(this.heap[leftChild], this.heap[minIndex]) < 0) {
        minIndex = leftChild;
      }
      if (rightChild < this.heap.length && this.compareFn(this.heap[rightChild], this.heap[minIndex]) < 0) {
        minIndex = rightChild;
      }
      if (minIndex === index) break;

      [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex], this.heap[index]];
      index = minIndex;
    }
  }

  /**
   * Convert heap to sorted array (highest priority first)
   * 
   * @returns Sorted array with highest priority items first
   */
  toSortedArray(): T[] {
    return this.heap.sort((a, b) => this.compareFn(b, a));
  }
}

