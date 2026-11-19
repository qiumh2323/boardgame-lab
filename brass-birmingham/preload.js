// Keep background requests bounded so opening a game can fetch visible images first.
export async function preloadImages(urls, load = loadImage) {
  const queue = [...new Set(urls)];
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const url = queue[next++];
      try {
        await load(url);
      } catch {
        // Visible images still use the normal browser loading path.
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, queue.length)}, worker));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.fetchPriority = 'low';
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
}
