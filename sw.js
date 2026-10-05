const CACHE_NAME = "kainan-sim-v20";
const APP_SHELL = [
  "./",
  "./index.html",
  "./audioManager.js",
  "./manifest.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/foods/fishball.png",
  "./assets/foods/kwekkwek.png",
  "./assets/foods/hotdog.png",
  "./assets/foods/day-old.png",
  "./assets/foods/fried-siomai.png",
  "./assets/foods/kikiam.png",
  "./assets/foods/lumpia.png",
  "./assets/foods/calamares.png",
  "./assets/drinks/sago-gulaman.png",
  "./assets/drinks/buko-juice.png",
  "./assets/drinks/melon-juice.png",
  "./assets/audio/wrong_order.mp3",
  "./assets/audio/thank_you_boy.mp3",
  "./assets/audio/thank_you_woman.mp3",
  "./assets/audio/click_food.mp3",
  "./assets/audio/bgm_musical.mp3",
  "./assets/sauces/sweet-sour.png",
  "./assets/sauces/spicy.png",
  "./assets/sauces/vinegar.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
